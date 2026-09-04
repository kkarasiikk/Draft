// Реєстрація service worker — одна на пʼять сторінок.
//
// Ці рядки лежали пʼятьма копіями на початку кожного app.js: у найкращому
// місці, щоб розійтись і щоб правку забули в одному з файлів. Тепер вони в
// спільному sw-register.js, як scroll-lock.js та unsaved-guard.js.
//
// Самоперезавантаження після оновлення тут свідомо немає — чому саме, довгим
// коментарем описано в sw-register.js.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = [
  ['головна', 'index.html', '#homeScreen', 'service-worker.js'],
  ['бюджет', 'budget/index.html', '#appScreen', 'budget/service-worker.js'],
  ['цілі', 'goals/index.html', '#appScreen', 'goals/service-worker.js'],
  ['завдання', 'tasks/index.html', '#appScreen', 'tasks/service-worker.js'],
  ['тренування', 'workout/index.html', '#appScreen', 'workout/service-worker.js'],
];

test.describe('Спільний sw-register.js', () => {
  for (const [name, page_, ready] of PAGES) {
    test(`${name}: сторінка піднімається з ним і без своїх помилок`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await openModule(page, page_, { ready });
      expect(errors).toEqual([]);
    });
  }

  test('своїх копій реєстрації в коді сторінок більше немає', async () => {
    ['home.js', 'budget/app.js', 'goals/app.js', 'tasks/app.js', 'workout/app.js'].forEach((file) => {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(src, `${file} не має реєструвати воркер сам`).not.toContain('serviceWorker.register');
    });
  });

  test('файл підключено на всіх пʼятьох сторінках і закешовано всіма воркерами', async () => {
    // Файл, якого немає в переліку воркера, офлайн просто не знайдеться.
    PAGES.forEach(([name, pagePath, , swPath]) => {
      const html = fs.readFileSync(path.join(ROOT, pagePath), 'utf8');
      expect(html, `${name}: підключення sw-register.js`).toContain('sw-register.js');
      const sw = fs.readFileSync(path.join(ROOT, swPath), 'utf8');
      expect(sw, `${name}: sw-register.js у переліку воркера`).toContain('sw-register.js');
    });
  });
});

test.describe('Кеш воркера — свій, а не спільний', () => {
  // Файли в корені (side-nav.js, categories-default.js, sw-register.js…)
  // лежать у кешах УСІХ пʼятьох воркерів. Глобальний caches.match() перебирає
  // всі кеші походження в порядку створення, тож головна могла отримати
  // /side-nav.js із кеша бюджету — а той оновлюється лише тоді, коли людина
  // заходить у бюджет. Спільний файл так міг лишатись старим ще довго після
  // того, як оновилась сама головна.
  test('sw-core шукає лише у своєму кеші', () => {
    const core = fs.readFileSync(path.join(ROOT, 'sw-core.js'), 'utf8');
    // Коментарі відкидаємо: у них цей виклик згадується саме як те, чого тут
    // бути не повинно, і перевірка ловила б власне пояснення.
    const code = core.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
    expect(code, 'глобальний caches.match() шукає по всіх кешах походження')
      .not.toMatch(/(^|[^.\w])caches\.match\(/m);
    expect(code).toContain('caches.open(CACHE_NAME).then((cache) => cache.match(request))');
  });

  test('спільні файли кореня справді лежать у кількох кешах', () => {
    // Якщо це колись перестане бути правдою, перевірка вище втратить сенс —
    // хай про це скаже тест, а не тиша.
    const inSw = (p, file) => fs.readFileSync(path.join(ROOT, p), 'utf8').includes(file);
    expect(inSw('service-worker.js', 'side-nav.js')).toBe(true);
    expect(inSw('budget/service-worker.js', 'side-nav.js')).toBe(true);
    expect(inSw('goals/service-worker.js', 'side-nav.js')).toBe(true);
  });
});
