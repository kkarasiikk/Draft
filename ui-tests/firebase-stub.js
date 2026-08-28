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
    return {
      id,
      // Профіль користувача теж треба вміти підкласти: від нього залежать, до
      // прикладу, план витрат на місяць і кільце на плитці бюджету.
      get: () => Promise.resolve(colName === 'users' && seed.profile
        ? { exists: true, id, data: () => seed.profile }
        : { exists: false, id, data: () => ({}) }),
      set: (p) => { calls.set.push({ col: colName, id, payload: p }); return Promise.resolve(); },
      update: (p) => { calls.update.push({ col: colName, id, payload: p }); return Promise.resolve(); },
      delete: () => { calls.delete.push({ col: colName, id }); return Promise.resolve(); },
      collection: (name) => colRef(name),
      onSnapshot: (cb) => {
        setTimeout(() => cb({ exists: false, id, data: () => ({}) }), 0);
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

  const firestore = () => ({
    collection: (name) => colRef(name),
    doc: (path) => docRef('root', path),
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
