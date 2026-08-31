// Ядро service worker (sw-core.js).
//
// Тестувати його варто саме тут, а не крізь браузер: рішення «звідки взяти
// відповідь» приймається до будь-якого рендера, а помиляється тихо. Дві з
// трьох помилок, які цей файл виправляє, роками жили непоміченими рівно тому,
// що нічого не ламали голосно: кеш просто мовчки не оновлювався, а відповіді
// Firestore так само мовчки в нього лягали.
//
// Середовище воркера підміняємо мінімальним фейком — рівно стільки поверхні,
// скільки ядро реально викликає.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(path.join(__dirname, 'sw-core.js'), 'utf8');

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';

/** Відповідь, схожа на Response рівно настільки, скільки треба ядру. */
function response(over = {}) {
  const r = {
    ok: true,
    type: 'basic',
    body: 'свіже',
    used: false,
    clone() {
      if (r.used) throw new Error('Response body is already used');
      return { ...r, clone: r.clone };
    },
    ...over,
  };
  return r;
}

/**
 * Піднімає ядро у фейковому воркері.
 * @param {{cached?: Object, network?: Function, openDelay?: number}} opts
 *   cached — що вже лежить у кеші (адреса -> відповідь);
 *   network — чим відповідає мережа;
 *   openDelay — на скільки тактів затримати caches.open(). Саме ця затримка
 *   й ловила стару помилку з клоном: копію робили вже після того, як
 *   відповідь віддали сторінці.
 */
function bootSw(opts = {}) {
  const cached = opts.cached || {};
  const stored = {};
  const listeners = {};
  const calls = { fetched: [], put: [] };

  const cache = {
    addAll: () => Promise.resolve(),
    put: (req, resp) => {
      const url = typeof req === 'string' ? req : req.url;
      // Справжній Cache вичитує тіло — клон, зроблений запізно, тут і впаде.
      if (resp.used) throw new Error('Response body is already used');
      calls.put.push(url);
      stored[url] = resp;
      return Promise.resolve();
    },
  };

  const sandbox = {
    URL,
    Set,
    Promise,
    console,
    self: null,
    caches: {
      open: () => (opts.openDelay
        ? new Promise((res) => setTimeout(() => res(cache), opts.openDelay))
        : Promise.resolve(cache)),
      match: (req) => Promise.resolve(cached[typeof req === 'string' ? req : req.url] || undefined),
      keys: () => Promise.resolve(opts.cacheKeys || []),
      delete: (k) => { (calls.deleted = calls.deleted || []).push(k); return Promise.resolve(true); },
    },
    fetch: (req) => {
      const url = typeof req === 'string' ? req : req.url;
      calls.fetched.push(url);
      const make = opts.network || (() => response());
      const out = make(url);
      return out instanceof Promise ? out : Promise.resolve(out);
    },
    setTimeout,
  };
  sandbox.self = {
    location: { origin: 'https://example.test' },
    addEventListener: (name, fn) => { listeners[name] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  sandbox.self.self = sandbox.self;

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  sandbox.self.LifeSW({
    name: 'budget',
    legacyPrefixes: ['moi-finansy-'],
    files: ['./', './index.html', './app.js'],
    external: [CDN],
  });

  function dispatch(url, init = {}) {
    let answered;
    const waits = [];
    const event = {
      request: { url, method: init.method || 'GET', mode: init.mode || 'no-cors' },
      respondWith: (p) => { answered = p; },
      waitUntil: (p) => waits.push(p),
    };
    listeners.fetch(event);
    return { answered, waits };
  }

  /** Чи взяв SW цей запит на себе (тобто чи викликав respondWith). */
  function takes(url, init) {
    return dispatch(url, init).answered !== undefined;
  }

  /** Проганяє запит і віддає те, що дісталось сторінці. */
  async function handle(url, init) {
    const { answered, waits } = dispatch(url, init);
    if (answered === undefined) throw new Error('SW не взяв запит на себе: ' + url);
    const resp = await answered;
    // Даємо фоновому оновленню добігти — інакше перевірити його нічим.
    await Promise.all(waits).catch(() => {});
    await new Promise((r) => setTimeout(r, 5));
    return resp;
  }

  return { handle, takes, listeners, calls, stored, cached };
}

describe('що SW бере на себе, а що лишає браузеру', () => {
  test('свої файли — бере', () => {
    expect(bootSw().takes('https://example.test/budget/app.js')).toBe(true);
  });

  // Раніше фільтра не було зовсім, і SW ліз у все підряд.
  test('запити до Firestore не чіпає — там кожна адреса своя, а дані живі', () => {
    const sw = bootSw();
    expect(sw.takes('https://firestore.googleapis.com/v1/projects/x/databases')).toBe(false);
    expect(sw.calls.fetched).toEqual([]);
  });

  test('дозволену бібліотеку з CDN бере, решту чужого — ні', () => {
    const sw = bootSw();
    expect(sw.takes(CDN)).toBe(true);
    expect(sw.takes('https://cdnjs.cloudflare.com/ajax/libs/чогось/іншого.js')).toBe(false);
  });

  test('не-GET лишає браузеру: у кеш кладуть відповіді, а не наслідки', () => {
    expect(bootSw().takes('https://example.test/budget/app.js', { method: 'POST' })).toBe(false);
  });

  // cache.put() на таких схемах просто кидає виняток.
  test('chrome-extension:// та інші схеми обходить', () => {
    expect(bootSw().takes('chrome-extension://abcdef/inject.js')).toBe(false);
  });
});

describe('оболонка віддається з кешу — заради цього все й робилось', () => {
  test('є в кеші — відповідь звідти, мережі не чекаємо', async () => {
    const sw = bootSw({
      cached: { 'https://example.test/budget/app.js': response({ body: 'з кешу' }) },
    });
    const r = await sw.handle('https://example.test/budget/app.js');
    expect(r.body).toBe('з кешу');
  });

  test('навігація теж із кешу — саме вона й тримала перехід між розділами', async () => {
    const sw = bootSw({
      cached: { 'https://example.test/budget/index.html': response({ body: 'з кешу' }) },
    });
    const r = await sw.handle('https://example.test/budget/index.html', { mode: 'navigate' });
    expect(r.body).toBe('з кешу');
  });

  test('свіжа версія все одно підтягується у фоні — для наступного разу', async () => {
    const sw = bootSw({
      cached: { 'https://example.test/budget/app.js': response({ body: 'з кешу' }) },
    });
    await sw.handle('https://example.test/budget/app.js');
    expect(sw.calls.fetched).toContain('https://example.test/budget/app.js');
    expect(sw.stored['https://example.test/budget/app.js'].body).toBe('свіже');
  });

  test('немає в кеші — лишається мережа', async () => {
    const sw = bootSw();
    const r = await sw.handle('https://example.test/budget/app.js');
    expect(r.body).toBe('свіже');
  });

  test('немає ні в кеші, ні в мережі — помилка доходить до сторінки, а не тиша', async () => {
    const sw = bootSw({ network: () => Promise.reject(new Error('офлайн')) });
    await expect(sw.handle('https://example.test/budget/app.js')).rejects.toThrow('офлайн');
  });

  test('офлайн із кешем — сторінка працює, і падіння мережі нікуди не спливає', async () => {
    const sw = bootSw({
      cached: { 'https://example.test/budget/app.js': response({ body: 'з кешу' }) },
      network: () => Promise.reject(new Error('офлайн')),
    });
    const r = await sw.handle('https://example.test/budget/app.js');
    expect(r.body).toBe('з кешу');
  });
});

describe('що потрапляє в кеш', () => {
  // Перевірки не було: у кеш лягали й 404, і 500, і потім віддавались
  // офлайн як «сторінка».
  test('невдалу відповідь не зберігаємо', async () => {
    const sw = bootSw({ network: () => response({ ok: false, body: '404' }) });
    await sw.handle('https://example.test/budget/app.js');
    expect(sw.calls.put).toEqual([]);
  });

  test('непрозору (opaque) теж не зберігаємо — у неї немає навіть статусу', async () => {
    const sw = bootSw({ network: () => response({ type: 'opaque' }) });
    await sw.handle('https://example.test/budget/app.js');
    expect(sw.calls.put).toEqual([]);
  });

  // Копію робили всередині caches.open().then(...) — тобто вже після того,
  // як відповідь віддано сторінці. Працювало, доки open() встигав першим.
  test('клон роблять до віддачі відповіді, а не після', async () => {
    const sw = bootSw({ openDelay: 20 });
    const r = await sw.handle('https://example.test/budget/app.js');
    // Сторінка «вичитує» тіло — справжній Response став би використаним.
    r.used = true;
    await new Promise((res) => setTimeout(res, 40));
    expect(sw.calls.put).toEqual(['https://example.test/budget/app.js']);
  });
});

describe('прибирання старих кешів', () => {
  test('чистить свої попередні версії й спадщину, чуже не чіпає', async () => {
    const sw = bootSw({
      cacheKeys: ['life-budget-old', 'moi-finansy-v3', 'life-goals-old', 'life-budget-__BUILD__'],
    });
    let waited;
    sw.listeners.activate({ waitUntil: (p) => { waited = p; } });
    await waited;
    expect(sw.calls.deleted.sort()).toEqual(['life-budget-old', 'moi-finansy-v3']);
  });
});

// ---- Переліки файлів у самих воркерах ----
// Найтихіша можлива поломка: один невірний шлях у списку — і cache.addAll()
// відхиляється цілком, install падає, кеш не створюється взагалі. Сторінка
// при цьому працює як звичайний сайт, тож помітити це можна хіба випадково,
// відкривши застосунок у метро.
describe('що воркери просять покласти в кеш — те й існує', () => {
  const MODULES = [
    { sw: 'service-worker.js', dir: '.' },
    { sw: 'budget/service-worker.js', dir: 'budget' },
    { sw: 'goals/service-worker.js', dir: 'goals' },
    { sw: 'tasks/service-worker.js', dir: 'tasks' },
    { sw: 'workout/service-worker.js', dir: 'workout' },
  ];

  /** Піднімає модульний SW і повертає конфіг, з яким той покликав LifeSW. */
  function configOf(swPath) {
    let captured = null;
    const box = {
      self: null,
      importScripts: () => {},
      LifeSW: (cfg) => { captured = cfg; },
      URL, Set, Promise, console, setTimeout,
    };
    box.self = box;
    vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(__dirname, swPath), 'utf8'), box);
    return captured;
  }

  test.each(MODULES)('$sw', ({ sw, dir }) => {
    const cfg = configOf(sw);
    expect(cfg).not.toBeNull();

    const missing = cfg.files.filter((rel) => {
      // './' — це сама сторінка розділу, файлом вона не є.
      if (rel === './') return false;
      return !fs.existsSync(path.join(__dirname, dir, rel));
    });
    expect(missing).toEqual([]);

    // Сторінка й головний скрипт мають бути в кеші обовʼязково: без них
    // офлайн-запуск неможливий, хоч би що ще там лежало.
    expect(cfg.files).toContain('./');
    expect(cfg.files).toContain('./index.html');

    // Зовнішні — тільки повні https-адреси: саме за ними ядро вирішує,
    // чужий запит брати чи лишати браузеру.
    (cfg.external || []).forEach((url) => expect(url).toMatch(/^https:\/\//));
  });

  test('назви кешів у розділів різні — інакше вони б витирали одне одного', () => {
    const names = MODULES.map(({ sw }) => configOf(sw).name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('кожен розділ кешує Firebase SDK — без нього сторінка не стартує офлайн', () => {
    MODULES.forEach(({ sw }) => {
      const ext = configOf(sw).external || [];
      expect(ext.some((u) => u.includes('firebase-app-compat'))).toBe(true);
      expect(ext.some((u) => u.includes('firebase-auth-compat'))).toBe(true);
      expect(ext.some((u) => u.includes('firebase-firestore-compat'))).toBe(true);
    });
  });
});
