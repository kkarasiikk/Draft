// Мінімальна in-memory імітація Firestore Admin SDK — покриває лише ту
// підмножину API, якою реально користується functions/ai.js. Не претендує
// на повноту (немає індексів, транзакцій з ретраями тощо), лише щоб
// протестувати нашу бізнес-логіку без мережі й без живого GCP-проєкту.
// Працює в парі з jest.mock("firebase-admin", ...) в ai.test.js: FieldValue
// там підмінений на прості сентинели { __op: "increment", n } /
// "__SERVER_TIMESTAMP__", які ця імітація вміє розпізнавати.

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `mock_${idCounter}`;
}

function createFakeFirestore(seedDocs = {}) {
  // store: Map<fullPath, data>
  const store = new Map(Object.entries(seedDocs));

  function applyFieldValues(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && v.__op === "increment") {
        out[k] = (store.get(v.__path)?.[k] || 0) + v.n;
      } else if (v === "__SERVER_TIMESTAMP__") {
        out[k] = new Date();
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  function docRef(path) {
    return {
      id: path.split("/").pop(),
      path,
      async get() {
        const data = store.get(path);
        return {
          exists: data !== undefined,
          id: path.split("/").pop(),
          data: () => data,
        };
      },
      async set(data, opts) {
        const prev = store.get(path) || {};
        const resolved = applyFieldValues({ ...data });
        store.set(path, opts && opts.merge ? { ...prev, ...resolved } : resolved);
      },
      async update(data) {
        const prev = store.get(path) || {};
        store.set(path, { ...prev, ...applyFieldValues(data) });
      },
      async delete() {
        store.delete(path);
      },
      collection(sub) {
        return collectionRef(`${path}/${sub}`);
      },
    };
  }

  function collectionRef(path) {
    const filters = [];
    const api = {
      doc(id) {
        return docRef(`${path}/${id || nextId()}`);
      },
      async add(data) {
        const id = nextId();
        const ref = docRef(`${path}/${id}`);
        await ref.set(applyFieldValues(data));
        return ref;
      },
      where(field, op, value) {
        filters.push({ field, op, value });
        return api;
      },
      async get() {
        const prefix = `${path}/`;
        const docs = [...store.entries()]
          .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
          .map(([p, data]) => ({ id: p.split("/").pop(), data: () => data }))
          .filter((d) => filters.every((f) => matchFilter(d.data(), f)));
        return { docs, empty: docs.length === 0 };
      },
    };
    return api;
  }

  function matchFilter(data, f) {
    const v = data[f.field];
    if (f.op === "==") return v === f.value;
    if (f.op === ">=") return v >= f.value;
    if (f.op === "<=") return v <= f.value;
    return true;
  }

  return {
    collection: (name) => collectionRef(name),
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          return ref.get();
        },
        set(ref, data) {
          // синхронно в моку — достатньо для наших тестів
          store.set(ref.path, applyFieldValues(data));
        },
        update(ref, data) {
          const prev = store.get(ref.path) || {};
          const resolved = { ...data };
          for (const k of Object.keys(resolved)) {
            if (resolved[k] && resolved[k].__op === "increment") {
              resolved[k] = (prev[k] || 0) + resolved[k].n;
            }
          }
          store.set(ref.path, { ...prev, ...resolved });
        },
      };
      return fn(tx);
    },
    _dump: () => Object.fromEntries(store),
  };
}

module.exports = { createFakeFirestore };
