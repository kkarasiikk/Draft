// Де живе кнопка AI-помічника.
//
// Раніше вона плавала над нижнім меню окремим колом і перекривала останній
// рядок списку. Помічник — це не дія над списком, як «+», а інструмент
// розділу, як налаштування; у шапці він і стоїть поруч із ними.
//
// На головній його немає взагалі: там нема даних розділу, з якими він
// працює, — і сам чат туди більше не вантажиться.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const MODULES = [
  ['бюджет', 'budget/index.html'],
  ['цілі', 'goals/index.html'],
  ['завдання', 'tasks/index.html'],
  ['тренування', 'workout/index.html'],
];

for (const [name, path] of MODULES) {
  test(`${name}: кнопка помічника — у шапці, а не плаває`, async ({ page }) => {
    await openModule(page, path, { ready: '#appScreen' });
    const btn = page.locator('#aiChatBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass(/ai-topbar-btn/);
    // Літери, а не значок: піктограму треба вгадувати, «AI» читається одразу.
    await expect(btn).toHaveText('AI');
    // Саме всередині верхньої панелі: плаваюча кнопка лежала в <body>.
    await expect(page.locator('.app-topbar #aiChatBtn')).toHaveCount(1);
    // Плаваючої більше немає ніде.
    await expect(page.locator('.ai-fab')).toHaveCount(0);
  });

  test(`${name}: кнопка відкриває чат`, async ({ page }) => {
    await openModule(page, path, { ready: '#appScreen' });
    await page.click('#aiChatBtn');
    await expect(page.locator('.aic-overlay')).toHaveClass(/show/);
  });
}

test('бюджет: помічник стоїть поруч із налаштуваннями, а не замість них', async ({ page }) => {
  await openModule(page, 'budget/index.html', { ready: '#appScreen' });
  await expect(page.locator('.app-topbar #aiChatBtn')).toBeVisible();
  await expect(page.locator('.app-topbar #categoriesBtn')).toBeVisible();
});

test('значок не важчий за 700: у бюджеті Inter далі не підвантажується', async ({ page }) => {
  // 800 браузер підробив би синтетично, і кнопка в бюджеті виглядала б інакше,
  // ніж у решті розділів.
  await openModule(page, 'budget/index.html', { ready: '#appScreen' });
  const weight = await page.$eval('#aiChatBtn', (el) => getComputedStyle(el).fontWeight);
  expect(Number(weight)).toBeLessThanOrEqual(700);
});

test('головна: помічника немає, і чат туди не вантажиться', async ({ page }) => {
  await openModule(page, 'index.html', { ready: '#homeScreen' });
  await expect(page.locator('#aiChatBtn')).toHaveCount(0);
  await expect(page.locator('.ai-fab')).toHaveCount(0);
  // Мертвий код на кожне відкриття головної — це плата без причини.
  const loaded = await page.evaluate(() =>
    [...document.querySelectorAll('script[src], link[href]')]
      .some((el) => (el.src || el.href || '').includes('ai-chat')));
  expect(loaded, 'ai-chat досі підключений на головній').toBe(false);
});
