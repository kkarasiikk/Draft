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
  const calls = { add: [], update: [], set: [], delete: [], get: [] };
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

  // colName потрібне, щоб у документа був `ref`: код, який переносить записи
  // з видаленої категорії, пише саме через нього (batch.update(doc.ref, …)),
  // і без цього поля бачив би undefined.
  function snapOf(list, colName) {
    return {
      docs: (list || []).map((d) => {
        const doc = revive(d);
        return { id: d.id, data: () => doc, ref: docRef(colName, d.id) };
      }),
      empty: !(list && list.length),
    };
  }

  // Хто саме слухає документ профілю. Справжній Firestore віддає локальне
  // відлуння запису одразу, не чекаючи на сервер, — і сторінки на це
  // розраховують: вікно налаштувань пише категорії в профіль, а список
  // категорій у розділі перемальовується від снапшота. Без цього списку
  // заглушка мовчала б, і перевірялося б не те, що бачить людина.
  const profileWatchers = [];

  function docRef(colName, id) {
    // Документ профілю: те, що підклав тест, або порожньо.
    const profileDoc = () => (colName === 'users' && seed.profile
      ? { exists: true, id, data: () => seed.profile }
      : { exists: false, id, data: () => ({}) });
    // Запис у профіль міняє те, що віддадуть наступні читання, і будить
    // підписників — рівно як merge у справжній базі.
    //
    // arrayUnion / arrayRemove доводиться розуміти: сторінка тренувань пише
    // ними перелік схованих вправ, і якби заглушка поклала в поле сам
    // маркер, наступний снапшот віддав би не масив — і список вправ
    // «забув» би щойно приховану.
    const applyFieldValue = (prev, next) => {
      if (!next || typeof next !== 'object') return next;
      const base = Array.isArray(prev) ? prev.slice() : [];
      if (Array.isArray(next.__arrayUnion)) {
        next.__arrayUnion.forEach((v) => { if (base.indexOf(v) === -1) base.push(v); });
        return base;
      }
      if (Array.isArray(next.__arrayRemove)) {
        return base.filter((v) => next.__arrayRemove.indexOf(v) === -1);
      }
      if (typeof next.__increment === 'number') return (typeof prev === 'number' ? prev : 0) + next.__increment;
      return next;
    };
    const applyProfileWrite = (payload, merge) => {
      if (colName !== 'users' || !payload) return;
      const base = merge ? Object.assign({}, seed.profile || {}) : {};
      Object.keys(payload).forEach((key) => {
        base[key] = applyFieldValue(base[key], payload[key]);
      });
      seed.profile = base;
      profileWatchers.slice().forEach((cb) => cb(profileDoc()));
    };
    return {
      id,
      // Ім'я колекції потрібне пакетному запису: у batch.update() приїжджає
      // сам ref, і без цього поля не видно, куди саме він писав.
      __col: colName,
      // Профіль користувача теж треба вміти підкласти: від нього залежать, до
      // прикладу, план витрат на місяць і кільце на плитці бюджету.
      get: () => Promise.resolve(profileDoc()),
      set: (p, opts) => {
        calls.set.push({ col: colName, id, payload: p });
        applyProfileWrite(p, !!(opts && opts.merge));
        return Promise.resolve();
      },
      update: (p) => {
        calls.update.push({ col: colName, id, payload: p });
        applyProfileWrite(p, true);
        return Promise.resolve();
      },
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
        if (colName === 'users') {
          profileWatchers.push(cb);
          return () => {
            const i = profileWatchers.indexOf(cb);
            if (i !== -1) profileWatchers.splice(i, 1);
          };
        }
        return () => {};
      },
    };
  }

  // Скільки документів заглушка вже створила — з цього робиться id, щоб два
  // записи в одну колекцію не виявились одним документом.
  let generated = 0;

  // `where` не фільтрує (сід і так той, що потрібен тесту), але ЗАПАМʼЯТОВУЄ
  // умови: інакше не перевірити, що сторінка попросила в бази саме той
  // діапазон, який показує. Календар на головній гортається за межі
  // прочитаного, і без цього запису тест не відрізнив би «дочитали» від
  // «намалювали порожньо».
  function colRef(name, constraints) {
    const cons = constraints || [];
    const ref = {
      // Доданий документ лягає і в сід: наступне читання тієї ж колекції має
      // його побачити. Без цього не перевірити головного — що сторінка після
      // збереження перечитує розділ і показує новий підсумок, а не той, з
      // яким відкрилась.
      add: (p) => {
        const id = 'generated' + (generated++ ? '-' + generated : '');
        calls.add.push({ col: name, payload: p });
        if (!seed[name]) seed[name] = [];
        seed[name].push({ id, ...p });
        return Promise.resolve({ id });
      },
      doc: (id) => docRef(name, id),
      onSnapshot: (cb) => { setTimeout(() => cb(snapOf(seed[name], name)), 0); return () => {}; },
      get: () => {
        calls.get.push({ col: name, where: cons.slice() });
        return Promise.resolve(snapOf(seed[name], name));
      },
      where: (field, op, value) => colRef(name, cons.concat([[field, op, value]])),
      orderBy: () => ref, limit: () => ref,
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
