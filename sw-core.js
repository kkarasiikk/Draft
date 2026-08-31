// Спільне ядро service worker для всіх пʼятьох сторінок.
//
// Досі кожен розділ мав власну копію цього файлу — пʼять майже дослівних
// близнюків. Копії й розійшлись: та сама помилка (кешування відповідей
// Firestore, клон відповіді після її віддачі) лежала в кожній, і виправляти
// довелося б пʼять разів. Тепер логіка одна, а розділ дає їй лише свій
// перелік файлів.
//
// ГОЛОВНЕ, ЩО ТУТ ЗМІНИЛОСЬ ПРОТИ КОПІЙ: оболонка застосунку віддається
// З КЕШУ, а не з мережі.
//
// Раніше сторінка, `app.js` і решта власних файлів стояли в списку
// «спочатку мережа», а кеш був лише запасним варіантом на випадок обриву.
// Через це кожен перехід між розділами чекав на мережу ~270 КБ (сторінка +
// скрипт розділу), маючи ті самі байти під рукою: на телефоні це секунди
// білого екрана на рівному місці. Тепер навпаки — з кешу одразу, а свіжу
// версію SW тягне у фоні, і вона стає до роботи на наступному переході.
//
// Ціна цього рішення чесна й невелика: після деплою перший перехід ще
// показує попередню версію. Саме ТОМУ версія кешу підставляється при
// складанні сайту з SHA коміта (див. __BUILD__ нижче й крок «Зібрати
// статику» в .github/workflows/deploy.yml), а не пишеться руками: варіант
// «оновити число в пʼятьох файлах і не забути» вже одного разу обернувся
// тим, що змін ніхто не побачив.
'use strict';

// Підставляється при деплої на SHA коміта. Локально лишається як є — і це
// правильно: у розробці сторінку перезавантажують із вимкненим кешем.
const BUILD = '__BUILD__';

/**
 * @param {{
 *   name: string,                 назва розділу: 'budget', 'goals', …
 *   legacyPrefixes?: string[],    префікси кешів попередніх версій, які теж треба прибрати
 *   files: string[],              власні файли розділу (відносні шляхи)
 *   external?: string[],          бібліотеки з CDN, без яких сторінка не запуститься
 * }} config
 */
self.LifeSW = function LifeSW(config) {
  const CACHE_NAME = 'life-' + config.name + '-' + BUILD;
  // Чистимо лише СВОЇ кеші: `caches` спільний для всього походження, тож
  // видалення «всього зайвого» стерло б кеші сусідніх розділів.
  const PREFIXES = ['life-' + config.name + '-'].concat(config.legacyPrefixes || []);
  const FILES = config.files || [];
  const EXTERNAL = config.external || [];
  // Точні адреси зовнішніх бібліотек, які нам дозволено кешувати. Усе інше
  // з чужих доменів SW не чіпає взагалі — див. shouldHandle().
  const EXTERNAL_SET = new Set(EXTERNAL);

  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => Promise.all([
        cache.addAll(FILES),
        // Зовнішні кешуємо окремо й толерантно до помилок: недоступне CDN
        // під час встановлення не має зривати весь install.
        ...EXTERNAL.map((url) =>
          fetch(url, { mode: 'cors' })
            .then((resp) => (resp && resp.ok ? cache.put(url, resp) : null))
            .catch(() => {})),
      ]))
    );
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME && PREFIXES.some((p) => k.startsWith(p)))
          .map((k) => caches.delete(k))
      ))
    );
    self.clients.claim();
  });

  /**
   * Чи це взагалі наш запит.
   *
   * Раніше перевірки не було зовсім, і SW ліз у все підряд — зокрема в
   * GET-запити до firestore.googleapis.com. Кешувати відповіді бази —
   * щонайменше марно (адреси щоразу різні, кеш просто розпухає), а в
   * гіршому разі означає віддати вчорашній стан замість сьогоднішнього.
   * Так само сюди потрапляли схеми на кшталт chrome-extension://, на яких
   * cache.put() просто кидає виняток.
   */
  function shouldHandle(request) {
    if (request.method !== 'GET') return false;
    let url;
    try { url = new URL(request.url); } catch (err) { return false; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.origin === self.location.origin) return true;
    return EXTERNAL_SET.has(url.href);
  }

  /**
   * Кладе відповідь у кеш — але лише вдалу.
   *
   * Перевірки `ok` теж не було: у кеш лягали й 404, і 500, і потім офлайн
   * віддавались як «сторінка». Відповіді з type 'opaque' не мають статусу
   * взагалі, тож їх теж не беремо.
   */
  function put(request, response) {
    if (!response || !response.ok || response.type === 'opaque') return;
    // Клон робимо ТУТ, синхронно, поки тіло ще ніхто не читав. Копії
    // клонували всередині caches.open().then(...) — тобто вже після того,
    // як відповідь віддано сторінці, а її тіло почали вичитувати. Це
    // класична пастка: працює, доки caches.open() встигає резолвитись
    // першим, і кидає «Response body is already used», коли не встигає.
    const copy = response.clone();
    return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
  }

  self.addEventListener('fetch', (event) => {
    if (!shouldHandle(event.request)) return;

    event.respondWith(
      caches.match(event.request).then((cached) => {
        // Оновлення у фоні: сторінка вже отримала свою відповідь із кешу, а
        // свіжа версія ляже туди для наступного разу.
        const fromNetwork = fetch(event.request).then((response) => {
          const saving = put(event.request, response);
          // waitUntil тримає SW живим до кінця запису: без цього браузер міг
          // приспати воркер посеред нього, і кеш лишався б старим назавжди.
          if (saving && event.waitUntil) event.waitUntil(saving);
          return response;
        });

        if (cached) {
          // Мережа могла й не відповісти — тоді просто нічого не оновиться.
          fromNetwork.catch(() => {});
          return cached;
        }
        // Нема в кеші (перший захід у розділ) — лишається чекати на мережу.
        return fromNetwork;
      })
    );
  });
};
