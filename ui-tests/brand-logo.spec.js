// Логотип «Life» — знак, а не текст.
//
// Слово намальоване однією лінією кардіограми (той самий знак, що на іконці
// застосунку), тож у розмітці це inline-SVG. Звідси три речі, які тихо
// ламаються і яких на око не помітиш:
//
//   1. Знак може зникнути — порожній `<svg>` не падає й не лишає сліду, на
//      місці логотипа просто нічого немає.
//   2. Він може втратити доступну назву. Текст «Life» читалка екрана читала
//      сама; SVG без aria-label для неї — порожнє місце.
//   3. Він може перестати слухати тему. Колір іде з `currentColor`, і варто
//      комусь вписати fill числом — у темній темі логотип стане чорним на
//      чорному.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Знак є на сторінці не в одному примірнику: крім шапки, він стоїть в
// колонці бічного меню й на екрані входу, а вони на телефоні сховані. Тому
// кожна сторінка називає СВІЙ, видимий.
const PAGES = [
  ['index.html', '#homeScreen', '.home-brand .brand-mark'],
  ['budget/index.html', '#appScreen', '#topbarHomeLink .brand-mark'],
  ['tasks/index.html', '#appScreen', '#topbarHomeLink .brand-mark'],
  ['goals/index.html', '#appScreen', '#topbarHomeLink .brand-mark'],
  ['workout/index.html', '#appScreen', '#topbarHomeLink .brand-mark'],
];

test.use({ viewport: { width: 390, height: 844 } });

for (const [path, ready, selector] of PAGES) {
  test(`${path}: логотип намальований`, async ({ page }) => {
    await openModule(page, path, { seed: { profile: {} }, ready });
    const mark = page.locator(selector);
    await expect(mark).toBeVisible();
    const box = await mark.boundingBox();
    expect(box.height).toBeGreaterThan(20);
    expect(box.width).toBeGreaterThan(box.height);   // знак широкий, не квадрат
  });

  test(`${path}: логотип бере колір від теми`, async ({ page }) => {
    // Питаємо саме обчислений `stroke` лінії, а не `color` обгортки: колір
    // обгортки лишається темозалежним, навіть якщо комусь зашити колір
    // просто в сам знак — а це рівно та поломка, якої ми боїмось.
    const strokeOf = async (theme) => {
      await openModule(page, path, { seed: { profile: {} }, ready, theme });
      return page.locator(selector + ' path').first()
        .evaluate((el) => getComputedStyle(el).stroke);
    };
    const light = await strokeOf('light');
    const dark = await strokeOf('dark');
    expect(light).not.toBe(dark);
  });
}

test('на головній логотип має доступну назву «Life»', async ({ page }) => {
  await openModule(page, 'index.html', { seed: { profile: {} }, ready: '#homeScreen' });
  await expect(page.locator('.home-brand .brand-mark')).toHaveAttribute('aria-label', 'Life');
});

test('у шапці розділу логотип — це посилання на головну, а не другий підпис', async ({ page }) => {
  // Знак усередині посилання схований від читалки навмисно: назву дає саме
  // посилання («На головну»), інакше воно прочиталось би двічі.
  await openModule(page, 'budget/index.html', { seed: { profile: {} } });
  await expect(page.locator('#topbarHomeLink')).toHaveAttribute('aria-label', 'На головну');
  await expect(page.locator('#topbarHomeLink .brand-mark')).toHaveAttribute('aria-hidden', 'true');
});
