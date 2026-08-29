// Смуга над сторінкою вгорі екрана.
//
// У встановленому на головний екран застосунку (standalone, iOS) над сторінкою
// лежить область статус-бару. Шар .background туди НЕ дістає: він розтягнутий
// на viewport, а ця область поза ним. Малює її тло html.
//
// Виміряно піксель у піксель на скріншоті з телефона: смуга була одного
// кольору, а сторінка одразу під нею — іншого, і вгорі виднівся шов.
//
// Відколи тло рівне, інваріант простий: --status-bar, тло html і
// meta[theme-color] — це той самий колір, що й --bg. Тест стежить за всіма
// одразу, бо розійтись вони можуть у будь-який бік.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const PAGES = [
  ['головна', 'index.html', '#homeScreen'],
  ['бюджет', 'budget/index.html', '#appScreen'],
  ['цілі', 'goals/index.html', '#appScreen'],
  ['завдання', 'tasks/index.html', '#appScreen'],
  ['тренування', 'workout/index.html', '#appScreen'],
];

for (const [name, path, ready] of PAGES) {
  for (const theme of ['light', 'dark']) {
    test(`${name} (${theme}): смуга статус-бару того ж кольору, що й сторінка`, async ({ page }) => {
      await openModule(page, path, { ready, theme });
      // Тло html має власний перехід (.2s) — без паузи тут читається колір
      // посеред нього, тобто щось середнє між старою й новою темою.
      await page.waitForTimeout(350);

      const { bar, bg, htmlBg } = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          bar: cs.getPropertyValue('--status-bar').trim(),
          bg: cs.getPropertyValue('--bg').trim(),
          htmlBg: cs.backgroundColor,
        };
      });

      expect(bar, '--status-bar не задано').toBeTruthy();
      expect(bg, '--bg не задано').toBeTruthy();

      // Порівнюємо через браузер: одне приходить як #hex, інше як rgb().
      const norm = ([a, b]) => page.evaluate(([x, y]) => {
        const as = (c) => {
          const d = document.createElement('div');
          d.style.color = c;
          document.body.appendChild(d);
          const out = getComputedStyle(d).color;
          d.remove();
          return out;
        };
        return as(x) === as(y);
      }, [a, b]);

      expect(await norm([bar, bg]), `смуга ${bar} не збігається з тлом ${bg}`).toBe(true);
      expect(await norm([htmlBg, bg]), `тло html ${htmlBg} не збігається з ${bg}`).toBe(true);
    });
  }

  test(`${name}: meta theme-color оновлюється під тему`, async ({ page }) => {
    await openModule(page, path, { ready, theme: 'dark' });
    await page.waitForTimeout(350);
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
