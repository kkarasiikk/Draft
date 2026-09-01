// Вікна форм гортаються лише вгору-вниз.
//
// На телефоні вікно форми можна було потягнути пальцем убік — і половина
// її ховалась за краєм екрана: заголовок обрізаний, поля починаються
// «...азва завдання». Виглядає як поламана верстка, хоча верстка ціла:
// це браузер возить прокручуваний блок по горизонталі, бо ніхто не сказав
// йому цього не робити.
//
// Правило одне на всі чотири модулі (клас .modal), тож і перевірка тут
// одна: інакше наступний модуль просто забули б.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const FORMS = [
  { module: 'budget', overlay: 'formOverlay' },
  { module: 'tasks', overlay: 'taskFormOverlay' },
  { module: 'goals', overlay: 'goalFormOverlay' },
  { module: 'workout', overlay: 'sessionFormOverlay' },
];

for (const { module, overlay } of FORMS) {
  test(`${module}: вікно форми замкнене на вертикаль`, async ({ page }) => {
    // Телефонний екран — саме там жест і працює.
    await page.setViewportSize({ width: 390, height: 844 });
    // #new відкриває форму створення в кожному з модулів.
    await openModule(page, `${module}/index.html#new`);
    await page.waitForSelector(`#${overlay}.show`);
    const modal = page.locator(`#${overlay} .modal`);

    // touch-action:pan-y забороняє браузеру возити вікно пальцем убік.
    await expect(modal).toHaveCSS('touch-action', 'pan-y');
    await expect(modal).toHaveCSS('overflow-x', 'hidden');
    // І горизонтального оверфлоу немає: ширший вміст був би другою
    // причиною того самого зсуву, і одного touch-action не вистачило б.
    const overflows = await modal.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflows, 'вміст не має вилазити вбік').toBe(false);
  });
}

test('швидке додавання завдання — те саме вікно, те саме правило', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openModule(page, 'tasks/index.html');
  await page.click('#openQuickAdd');
  await page.waitForSelector('#quickAddOverlay.show');
  await expect(page.locator('#quickAddOverlay .modal')).toHaveCSS('touch-action', 'pan-y');
});
