// Форма витрати, відкрита з головної, має показувати ВЛАСНІ категорії.
//
// З головної «+» веде в бюджет одразу за #new: форма малюється в наступному
// ж такті, а свої категорії лежать у профілі й прилітають окремим снапшотом.
// Через це перехід з головної щоразу показував стандартні сім категорій, і
// полагодити це можна було лише закривши й відкривши форму вручну.
const { test, expect } = require('@playwright/test');
const { openModule, isShown, tapBackdrop, dialog } = require('./helpers');

// Форма категорії в профілі — {id, label, colorIndex}, саме її пише розділ.
const MY_CATS = [
  { id: 'home', label: 'Продукти додому', colorIndex: 0 },
  { id: 'street', label: 'Витрати на вулиці', colorIndex: 1 },
  { id: 'debt', label: 'Дав в борг', colorIndex: 2 },
];
const seed = { profile: { categoriesExpense: MY_CATS } };

const labels = (page) => page.locator('#catPicker .cat-choice').allTextContents();

test('форма з #new чекає на свої категорії, а не лишається зі стандартними', async ({ page }) => {
  // Профіль спізнюється — саме той випадок, у якому вада й ловилась.
  await openModule(page, 'budget/index.html#new', { seed, profileDelay: 250 });
  await page.waitForSelector('#formOverlay.show');
  await expect.poll(() => labels(page)).toEqual(MY_CATS.map((c) => c.label));
  await expect(page.locator('#catPicker')).not.toContainText('Транспорт');
});

test('перемальована форма не вважається зміненою', async ({ page }) => {
  // Категорія входить у знімок гарда, тож підміна стандартної на власну
  // могла б зійти за незбережену зміну — і закриття питало б про неї.
  await openModule(page, 'budget/index.html#new', { seed, profileDelay: 250 });
  await page.waitForSelector('#formOverlay.show');
  await expect.poll(() => labels(page)).toEqual(MY_CATS.map((c) => c.label));

  await tapBackdrop(page, 'formOverlay');
  expect(await dialog.shown(page), 'нічого не чіпали — питати нема про що').toBe(false);
  expect(await isShown(page, '#formOverlay')).toBe(false);
});

test('набране у формі перемалювання категорій не стирає', async ({ page }) => {
  await openModule(page, 'budget/index.html#new', { seed, profileDelay: 250 });
  await page.waitForSelector('#formOverlay.show');
  await page.fill('#amountInput', '130');
  await expect.poll(() => labels(page)).toEqual(MY_CATS.map((c) => c.label));
  expect(await page.inputValue('#amountInput')).toBe('130');
});

test('обрана категорія — перша зі своїх, а не зі стандартних', async ({ page }) => {
  await openModule(page, 'budget/index.html#new', { seed, profileDelay: 250 });
  await page.waitForSelector('#formOverlay.show');
  await expect.poll(() => labels(page)).toEqual(MY_CATS.map((c) => c.label));
  await page.fill('#amountInput', '130');
  await page.click('#submitBtn');
  await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
  const [call] = await page.evaluate(() => window.__fbCalls.add);
  expect(call.payload.category).toBe('home');
});

test('без затримки профілю все як було', async ({ page }) => {
  await openModule(page, 'budget/index.html#new', { seed });
  await page.waitForSelector('#formOverlay.show');
  await expect.poll(() => labels(page)).toEqual(MY_CATS.map((c) => c.label));
});
