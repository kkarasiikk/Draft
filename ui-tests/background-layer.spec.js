// Тло сторінки не має залежати від того, що зараз відкрито.
//
// Було інакше: `body` мав власне непрозоре тло, а шар тла лежить під вмістом
// (z-index:-1). Потокові нащадки малюються після відʼємних z-index, тож тло
// body зафарбовувало його повністю. Проступало воно тільки при відкритому
// меню — у `.app-menu` тоді був backdrop-filter, і він змушував браузер
// перезібрати композицію. Звідси й враження, що тло «вмикає» бургер.
//
// Градієнта й backdrop-filter уже немає, але сама пастка з порядком малювання
// нікуди не поділась — саме її тут і стережемо.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Проба береться ЗЛІВА ВІД ВМІСТУ і нижче шапки: вміст сторінки центрований,
// тож ця смуга — чисте тло, без жодного тексту.
//
// Без тексту навмисно. Оверлей меню створює новий шар композиції, і літери
// під ним перемикаються з субпіксельного згладжування на сіре — кольорові
// облямівки гліфів міняються, хоч саме тло лишається тим самим. Порівнювати
// текст тут означало б ловити артефакт растеризації замість того, заради
// чого тест написаний.
const STRIP = { x: 0, y: 300, width: 250, height: 200 };

async function openHome(page, theme) {
  await openModule(page, 'index.html', { ready: '#homeScreen', theme });
  // Тло має власний перехід — даємо йому доїхати, інакше порівнюємо півдороги.
  await page.waitForTimeout(350);
}

for (const theme of ['light', 'dark']) {
  test(`${theme}: тло не залежить від того, відкрите меню чи ні`, async ({ page }) => {
    await openHome(page, theme);
    const closed = await page.screenshot({ clip: STRIP });

    await page.click('#menuBtn');
    await page.waitForSelector('#appMenuOverlay.show');
    await page.waitForTimeout(350);
    const opened = await page.screenshot({ clip: STRIP });

    expect(opened.equals(closed),
      'світло стрибнуло при відкритті меню — тло знову чимось перекрите').toBe(true);
  });
}

// Той самий шар — і та сама пастка — на кожній сторінці застосунку.
const PAGES = [
  ['головна', 'index.html', '#homeScreen'],
  ['бюджет', 'budget/index.html', '#appScreen'],
  ['цілі', 'goals/index.html', '#appScreen'],
  ['завдання', 'tasks/index.html', '#appScreen'],
  ['тренування', 'workout/index.html', '#appScreen'],
];

for (const [name, path, ready] of PAGES) {
  test(`${name}: у body немає власного тла — інакше воно ховає шар зі світлом`, async ({ page }) => {
    await openModule(page, path, { ready, theme: 'dark' });
    // rgba(0, 0, 0, 0) — прозоре. Колір полотна задає html, і тільки він.
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe('rgba(0, 0, 0, 0)');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor))
      .not.toBe('rgba(0, 0, 0, 0)');
  });

  test(`${name}: шар зі світлом лежить під вмістом, а не над ним`, async ({ page }) => {
    await openModule(page, path, { ready, theme: 'dark' });
    const z = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.background')).zIndex);
    expect(Number(z)).toBeLessThan(0);
  });
}
