// Спільна обв'язка UI-тестів: підняти сторінку модуля з підміненим Firebase
// і дати кілька коротких запитів до діалогу незбереженого.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const STUB = fs.readFileSync(path.join(__dirname, 'firebase-stub.js'), 'utf8');

/**
 * Відкриває сторінку модуля так, ніби користувач уже увійшов.
 * @param {import('@playwright/test').Page} page
 * @param {string} modulePath напр. 'workout/index.html'
 * @param {{seed?:object, theme?:string, lang?:string, ready?:string}} [opts]
 *   ready — селектор, поява якого означає «сторінка готова». Модулі показують
 *   #appScreen, домашній хаб — #homeScreen.
 *   profileDelay — на скільки мілісекунд затримати снапшот профілю; потрібен,
 *   щоб відтворити випадок «сторінка намалювалась раніше за свої категорії».
 */
async function openModule(page, modulePath, opts = {}) {
  // Скрипти Firebase із gstatic підміняються заглушкою: перший запит віддає
  // її, решта — порожньо (сторінка підключає п'ять файлів SDK, а поверхня
  // потрібна одна).
  let served = false;
  await page.route('**/firebasejs/**', (route) => {
    const body = served ? '' : STUB;
    served = true;
    route.fulfill({ status: 200, contentType: 'application/javascript', body });
  });
  // Решта зовнішніх CDN у тестах не потрібна — без них сторінка працює, а
  // чекати на мережу в CI немає сенсу.
  await page.route('**/cdnjs.cloudflare.com/**', (route) => route.fulfill({ status: 200, body: '' }));
  // DOMPurify — виняток серед CDN, і маршрут для нього стоїть ПІСЛЯ
  // загального: Playwright бере останній доданий обробник, тож вужчий
  // маршрут має бути нижчим, інакше його перекриє «все з cdnjs — порожньо».
  // Без бібліотеки sanitizeNoteHtml() свідомо
  // віддає екранований текст замість HTML, і будь-яка перевірка вигляду
  // нотатки перевіряла б цей запасний шлях, а не те, що бачить людина.
  // Тут стоїть двійник із тією ж роллю, що й firebase-stub: віддає HTML,
  // прибираючи те, чого в нотатках і так не буває — скрипти й обробники
  // подій. Білий список тегів залишаємо справжньому DOMPurify у бою.
  await page.route('**/dompurify/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.DOMPurify = { sanitize: function (html) {
      var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
      doc.body.querySelectorAll('script, style, iframe, object, embed').forEach(function (el) { el.remove(); });
      doc.body.querySelectorAll('*').forEach(function (el) {
        Array.prototype.slice.call(el.attributes).forEach(function (a) {
          if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        });
      });
      return doc.body.innerHTML;
    } };`,
  }));
  await page.route('**/fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  await page.addInitScript(([seed, theme, lang, profileDelay]) => {
    window.__fbSeed = seed;
    // Скільки мілісекунд заглушка тримає снапшот профілю (0 — віддає одразу).
    window.__fbProfileDelay = profileDelay;
    try {
      localStorage.setItem('financeAppTheme', theme);
      localStorage.setItem('financeAppLang', lang);
    } catch (err) { /* приватний режим — тест від цього не залежить */ }
  }, [opts.seed || {}, opts.theme || 'light', opts.lang || 'uk', opts.profileDelay || 0]);

  await page.goto(`/${modulePath}`);
  await page.waitForSelector(opts.ready || '#appScreen', { state: 'visible' });
  // Сервіс-воркер у тестах тільки заважає: він кешує сторінку між прогонами.
  await page.evaluate(() => navigator.serviceWorker &&
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())));
}

const DIALOG = '#unsavedGuardOverlay';

/** Чи показано зараз щось із класом .show. */
function isShown(page, selector) {
  return page.$eval(selector, (el) => el.classList.contains('show')).catch(() => false);
}

/** Тап по підкладці — саме та випадковість, заради якої існує гард. */
function tapBackdrop(page, overlayId) {
  return page.click(`#${overlayId}`, { position: { x: 6, y: 6 } });
}

const dialog = {
  selector: DIALOG,
  shown: (page) => isShown(page, DIALOG),
  save: (page) => page.click(`${DIALOG} [data-act="save"]`),
  discard: (page) => page.click(`${DIALOG} [data-act="discard"]`),
  keep: (page) => page.click(`${DIALOG} [data-act="keep"]`),
  tapOutside: (page) => page.click(DIALOG, { position: { x: 6, y: 6 } }),
};

/**
 * Повний сценарій захисту однієї форми. Кроки однакові для всіх модулів,
 * різниця лише в тому, як форму відкрити й що в ній змінити.
 * @param {{page:any, overlay:string, open:function, dirty:function,
 *          closeBtn:string}} cfg
 */
async function checksOutUnsavedGuard({ page, overlay, open, dirty, closeBtn }) {
  // 1. Форма без змін закривається одразу — питати нема про що.
  await open();
  await tapBackdrop(page, overlay);
  expect(await isShown(page, `#${overlay}`), 'чиста форма мала закритись').toBe(false);
  expect(await dialog.shown(page), 'чиста форма не мала нічого питати').toBe(false);

  // 2. Змінена форма перепитує, і сама лишається видимою під діалогом.
  await open();
  await dirty();
  await tapBackdrop(page, overlay);
  expect(await dialog.shown(page), 'змінена форма мала перепитати').toBe(true);
  expect(await isShown(page, `#${overlay}`), 'форма мала лишитись під діалогом').toBe(true);

  // 3. «Продовжити редагування» повертає до форми.
  await dialog.keep(page);
  expect(await dialog.shown(page)).toBe(false);
  expect(await isShown(page, `#${overlay}`)).toBe(true);

  // 4. Хрестик перепитує так само, як і тап повз вікно.
  await page.click(closeBtn);
  expect(await dialog.shown(page), 'хрестик мав перепитати').toBe(true);

  // 5. Тап повз сам діалог нічого не втрачає.
  await dialog.tapOutside(page);
  expect(await dialog.shown(page)).toBe(false);
  expect(await isShown(page, `#${overlay}`), 'тап повз діалог не мав закривати форму').toBe(true);

  // 6. «Не зберігати» закриває все.
  await tapBackdrop(page, overlay);
  await dialog.discard(page);
  expect(await isShown(page, `#${overlay}`)).toBe(false);
  expect(await dialog.shown(page)).toBe(false);
}

/**
 * Що зараз у кадрі смуги днів на головній.
 *
 * Смуга гортається, тож клітинок намальовано більше, ніж видно (запас у обидва
 * боки), і звертатись до них за порядковим номером означало б рахувати той
 * запас у кожному тесті окремо. Тут це рахується один раз — з позиції
 * прокрутки, тобто так само, як це робить сама сторінка.
 * @returns {Promise<{count:number, days:string[], total:number}>}
 */
function calendarFrame(page) {
  return page.evaluate(() => {
    const el = document.getElementById('calWeek');
    const cells = Array.from(el.children);
    const step = cells[1].offsetLeft - cells[0].offsetLeft;
    const i = Math.round(el.scrollLeft / step);
    return {
      total: cells.length,
      count: Math.round(el.clientWidth / step),
      days: cells.slice(i, i + 7).map((c) => c.getAttribute('href').split('#day=')[1]),
    };
  });
}

module.exports = { openModule, isShown, tapBackdrop, dialog, checksOutUnsavedGuard, calendarFrame };
