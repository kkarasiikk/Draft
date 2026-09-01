// Заглушка compat-SDK Firebase для UI-тестів.
//
// Сторінки модулів жорстко залежать від Firebase: перший рядок кожного app.js —
// firebase.initializeApp(). Тягнути в тести справжній SDK означало б живий
// проєкт, живу мережу і живі дані — тобто тест, який падає з причин, що не
// стосуються перевірюваного. Тому SDK підмінюється ось цим: рівно стільки
// поверхні, скільки сторінки реально викликають, плюс запис зроблених
// звернень у window.__fbCalls, щоб тест міг перевірити, що збереження таки
// дійшло до бази.
(function () {
  const calls = { add: [], update: [], set: [], delete: [] };
  window.__fbCalls = calls;

  // Дані, які «вже є в базі»: тест підкладає їх через window.__fbSeed
  // ДО завантаження сторінки.
  const seed = window.__fbSeed || {};

  // Firestore віддає дати як Timestamp з .toDate(), а сід їде в сторінку через
  // серіалізацію — методи в ній не виживають. Тому тест пише {__ts: '2026-01-01'},
  // а заглушка перетворює це на Timestamp, як і справжня база. Полудень, а не
  // північ: локальний день не має залежати від зсуву часового поясу.
  function revive(doc) {
    if (!doc || typeof doc !== 'object') return doc;
    const out = {};
    Object.keys(doc).forEach((k) => {
      const v = doc[k];
      if (v && typeof v === 'object' && typeof v.__ts === 'string') {
        const at = new Date(v.__ts + 'T12:00:00');
        out[k] = { toDate: () => at };
      } else out[k] = v;
    });
    return out;
  }

  function snapOf(list) {
    return {
      docs: (list || []).map((d) => {
        const doc = revive(d);
        return { id: d.id, data: () => doc };
      }),
      empty: !(list && list.length),
    };
  }

  function docRef(colName, id) {
    // Документ профілю: те, що підклав тест, або порожньо.
    const profileDoc = () => (colName === 'users' && seed.profile
      ? { exists: true, id, data: () => seed.profile }
      : { exists: false, id, data: () => ({}) });
    return {
      id,
      // Ім'я колекції потрібне пакетному запису: у batch.update() приїжджає
      // сам ref, і без цього поля не видно, куди саме він писав.
      __col: colName,
      // Профіль користувача теж треба вміти підкласти: від нього залежать, до
      // прикладу, план витрат на місяць і кільце на плитці бюджету.
      get: () => Promise.resolve(profileDoc()),
      set: (p) => { calls.set.push({ col: colName, id, payload: p }); return Promise.resolve(); },
      update: (p) => { calls.update.push({ col: colName, id, payload: p }); return Promise.resolve(); },
      delete: () => { calls.delete.push({ col: colName, id }); return Promise.resolve(); },
      collection: (name) => colRef(name),
      // Раніше підписка на документ завжди віддавала порожнечу, і сід профілю
      // доїжджав лише через get(). Сторінка цілей читає профіль саме
      // підпискою (там живе список категорій цілей), тож віддаємо те саме,
      // що й get() — інакше тест бачив би базу, якої немає.
      // Затримка профілю — окремий важіль для тестів. Профіль приїжджає
      // своїм снапшотом, і сторінка може встигнути намалювати форму до
      // нього: саме так з головної відкривалась форма витрати зі
      // стандартними категоріями замість власних. Без цієї затримки таке
      // не відтворити — заглушка віддає все в тому ж такті.
      onSnapshot: (cb) => {
        setTimeout(() => cb(profileDoc()), window.__fbProfileDelay || 0);
        return () => {};
      },
    };
  }

  function colRef(name) {
    const ref = {
      doc: (id) => docRef(name, id),
      add: (p) => { calls.add.push({ col: name, payload: p }); return Promise.resolve({ id: 'generated' }); },
      onSnapshot: (cb) => { setTimeout(() => cb(snapOf(seed[name])), 0); return () => {}; },
      get: () => Promise.resolve(snapOf(seed[name])),
      where: () => ref, orderBy: () => ref, limit: () => ref,
    };
    return ref;
  }

  const user = { uid: 'test-uid', email: 'test@example.com' };
  const authObj = {
    currentUser: user,
    onAuthStateChanged: (cb) => { setTimeout(() => cb(user), 0); return () => {}; },
    setPersistence: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
    sendPasswordResetEmail: () => Promise.resolve(),
  };

  // Пакетний запис. Потрібен там, де одна дія міняє багато документів —
  // видалення категорії переносить у ній усі цілі. Операції складаються
  // в той самий __fbCalls, що й поодинокі, тільки з позначкою batch: тест
  // питає «що дійшло до бази», а не «яким саме API це надіслали».
  function batch() {
    const ops = [];
    const record = (kind, ref, payload) => { ops.push({ kind, ref, payload }); };
    return {
      set: (ref, payload) => record('set', ref, payload),
      update: (ref, payload) => record('update', ref, payload),
      delete: (ref) => record('delete', ref),
      commit: () => {
        ops.forEach((op) => {
          const entry = { col: op.ref.__col, id: op.ref.id, batch: true };
          if (op.kind !== 'delete') entry.payload = op.payload;
          calls[op.kind].push(entry);
        });
        return Promise.resolve();
      },
    };
  }

  const firestore = () => ({
    collection: (name) => colRef(name),
    doc: (path) => docRef('root', path),
    batch,
    enablePersistence: () => Promise.resolve(),
    settings: () => {},
  });
  firestore.FieldValue = {
    serverTimestamp: () => '__ts__',
    increment: (n) => ({ __increment: n }),
    arrayUnion: (...v) => ({ __arrayUnion: v }),
    arrayRemove: (...v) => ({ __arrayRemove: v }),
  };

  const auth = () => authObj;
  auth.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session' } };

  window.firebase = {
    initializeApp: () => {},
    apps: [],
    auth,
    firestore,
    appCheck: () => ({ activate: () => {} }),
    functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }),
    messaging: () => ({ getToken: () => Promise.resolve(null), onMessage: () => {} }),
  };
})();
