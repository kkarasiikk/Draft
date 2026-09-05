// Тло сторінки не має залежати від того, що зараз відкрито.
//
// Було інакше: `body` мав власне непрозоре тло, а шар тла лежить під вмістом
// (z-index:-1). Потокові нащадки малюються після відʼємних z-index, тож тло
// body зафарбовувало його повністю. Проступало воно тільки при відкритому
// меню — у `.app-menu` тоді був backdrop-filter, і він змушував браузер
// перезібрати композицію. Звідси й враження, що тло «вмикає» бургер.
//
// Градієнта немає, пастка з порядком малювання лишилась — її стереже друга
// половина файлу (в `body` не має бути власного тла).
//
// А backdrop-filter повернувся, але вже свідомо й в іншому місці: підкладка
// вікна налаштувань розмиває сторінку під собою. Тож перша половина файлу
// перевіряє протилежне до того, що перевіряла колись: тло під відкритим
// вікном МАЄ змінитись, бо саме заради цього підкладку й зробили.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Вікно налаштувань відкриває гамбургер, а він живе в телефонній розкладці:
// на широкому екрані замість нього бічна колонка. Тож і вікно тут телефонне.
test.use({ viewport: { width: 390, height: 844 } });

// Проба береться з ЛІВОГО ПОЛЯ сторінки — смуги під внутрішнім відступом
// .wrap. Це чисте тло, без жодного тексту, і меню туди не дістає: воно
// притиснуте до правого краю.
//
// Без тексту навмисно. Оверлей створює новий шар композиції, і літери
// під ним перемикаються з субпіксельного згладжування на сіре — кольорові
// облямівки гліфів міняються, хоч саме тло лишається тим самим. Порівнювати
// текст тут означало б ловити артефакт растеризації замість того, заради
// чого тест написаний.
const STRIP = { x: 0, y: 300, width: 16, height: 300 };

async function openHome(page, theme) {
  await openModule(page, 'index.html', { ready: '#homeScreen', theme });
  // Тло має власний перехід — даємо йому доїхати, інакше порівнюємо півдороги.
  await page.waitForTimeout(350);
}

for (const theme of ['light', 'dark']) {
  test(`${theme}: відкрите вікно налаштувань затемнює сторінку під собою`, async ({ page }) => {
    await openHome(page, theme);
    const closed = await page.screenshot({ clip: STRIP });

    await page.click('#menuBtn');
    await page.waitForSelector('#settingsOverlay.show');
    await page.waitForTimeout(350);
    const opened = await page.screenshot({ clip: STRIP });

    expect(opened.equals(closed),
      'сторінка під вікном лишилась такою самою — підкладки не видно').toBe(false);
  });

  test(`${theme}: закрите вікно повертає тло таким, яким воно було`, async ({ page }) => {
    await openHome(page, theme);
    const before = await page.screenshot({ clip: STRIP });

    await page.click('#menuBtn');
    await page.waitForSelector('#settingsOverlay.show');
    await page.waitForTimeout(350);
    await page.click('#settingsClose');
    await page.waitForTimeout(350);
    const after = await page.screenshot({ clip: STRIP });

    expect(after.equals(before),
      'після закриття вікна тло не повернулось — щось лишилось поверх нього').toBe(true);
  });
}

// Розмиття — не косметика, а те, заради чого підкладку й міняли: без нього
// світла картка на світлій сторінці зливалася з нею, і межу було видно лише
// по тонкій рамці.
test('підкладка вікна і затемнює, і розмиває', async ({ page }) => {
  await openHome(page, 'light');
  await page.click('#menuBtn');
  await page.waitForSelector('#settingsOverlay.show');
  const style = await page.locator('#settingsOverlay').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, blur: cs.backdropFilter || cs.webkitBackdropFilter };
  });
  expect(style.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(style.blur).toMatch(/blur/);
});

// Кругла кнопка «+» лежить високо (z-index 70), і без окремої турботи вона
// світилася б поверх розмиття, ніби вона не в цій сцені.
test('«+» не світиться поверх розмиття', async ({ page }) => {
  await openHome(page, 'light');
  await page.click('#menuBtn');
  await page.waitForSelector('#settingsOverlay.show');
  const [fab, overlay] = await page.evaluate(() => [
    Number(getComputedStyle(document.getElementById('addFab')).zIndex),
    Number(getComputedStyle(document.getElementById('settingsOverlay')).zIndex),
  ]);
  expect(overlay).toBeGreaterThan(fab);
});

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
