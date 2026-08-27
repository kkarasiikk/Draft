// Смуга статус-бару вгорі екрана.
//
// На iPhone у standalone-режимі iOS малює вгорі власну непрозору смугу
// кольором theme-color. Коли він не збігається з тим, чим сторінка починається
// одразу під ним, видно шов — рівно те, що було видно на головній: смуга
// #EDEEF3 над градієнтом, що стартує з #ffffff.
//
// Розійшлись вони тому, що жили нарізно: колір смуги — у applyTheme(),
// градієнт — у CSS. Тепер обидва беруться з --status-bar поруч із --bg-radial,
// і цей тест стежить саме за їхньою відповідністю.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const PAGES = [
  ['головна', 'index.html', '#homeScreen'],
  ['бюджет', 'budget/index.html', '#appScreen'],
  ['цілі', 'goals/index.html', '#appScreen'],
  ['завдання', 'tasks/index.html', '#appScreen'],
  ['тренування', 'workout/index.html', '#appScreen'],
];

/** Перший колір у radial-gradient — те, чим сторінка починається вгорі. */
function gradientStart(bgRadial) {
  const m = String(bgRadial).match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/g);
  return m ? m[0] : null;
}

for (const [name, path, ready] of PAGES) {
  for (const theme of ['light', 'dark']) {
    test(`${name} (${theme}): колір статус-бару збігається з початком градієнта`, async ({ page }) => {
      await openModule(page, path, { ready, theme });
      const { bar, start } = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return { bar: cs.getPropertyValue('--status-bar').trim(), radial: cs.getPropertyValue('--bg-radial').trim() };
      }).then(async (v) => ({ bar: v.bar, start: gradientStart(v.radial) }));

      expect(bar, '--status-bar не задано').toBeTruthy();
      expect(start, 'не вдалось прочитати початок --bg-radial').toBeTruthy();
      // Порівнюємо через canvas: браузер віддає одне як #hex, інше як rgb().
      const same = await page.evaluate(([a, b]) => {
        const norm = (c) => {
          const d = document.createElement('div');
          d.style.color = c;
          document.body.appendChild(d);
          const out = getComputedStyle(d).color;
          d.remove();
          return out;
        };
        return norm(a) === norm(b);
      }, [bar, start]);
      expect(same, `смуга ${bar} не збігається з початком градієнта ${start}`).toBe(true);
    });
  }

  test(`${name}: meta theme-color оновлюється під тему`, async ({ page }) => {
    await openModule(page, path, { ready, theme: 'dark' });
    const [meta, bar] = await page.evaluate(() => [
      document.querySelector('meta[name="theme-color"]').getAttribute('content').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--status-bar').trim(),
    ]);
    expect(meta.toLowerCase()).toBe(bar.toLowerCase());
  });
}

test('головна має ті самі теги для iOS, що й модулі', async ({ page }) => {
  await openModule(page, 'index.html', { ready: '#homeScreen' });
  for (const n of ['apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style', 'apple-mobile-web-app-title']) {
    await expect(page.locator(`meta[name="${n}"]`), `бракує ${n}`).toHaveCount(1);
  }
});
