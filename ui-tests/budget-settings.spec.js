// Налаштування бюджету після двох правок поспіль.
//
// Спершу звідти прибрали план витрат на місяць: поле стояло під валютою і
// живило кільце «витрачено з плану» на головній — разом із полем пішли й
// кільце, і рядок «лишилось N з плану».
//
// Потім саме вікно розділу зникло: валюта й категорії переїхали у спільне
// вікно налаштувань (../settings.js), вкладка «Гроші». Шестерня в шапці
// відкриває тепер його, і перевіряти треба саме там.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const openSettings = async (page, seed) => {
  await openModule(page, 'budget/index.html', seed ? { seed } : {});
  await page.click('#categoriesBtn');
  await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
  await expect(page.locator('.settings-tab.current')).toHaveText('Гроші');
};

test('поля «План витрат на місяць» у налаштуваннях немає', async ({ page }) => {
  await openSettings(page);
  await expect(page.locator('#monthlyPlanInput')).toHaveCount(0);
  await expect(page.locator('#monthlyPlanClear')).toHaveCount(0);
  await expect(page.locator('#settingsOverlay')).not.toContainText('План витрат');
});

test('валюта й категорії лишились на місці — тільки вже у вкладці «Гроші»', async ({ page }) => {
  await openSettings(page);
  await expect(page.locator('[data-currency="UAH"]')).toBeVisible();
  await expect(page.locator('[data-cat-kind="expense"]')).toBeVisible();
  await expect(page.locator('[data-cat-kind="income"]')).toBeVisible();
});

test('старе число з профілю не воскрешає поле', async ({ page }) => {
  await openSettings(page, { profile: { monthlyBudget: 30000 } });
  await expect(page.locator('#monthlyPlanInput')).toHaveCount(0);
});

// Регулярні операції й імпорт CSV — це вміст, а не параметр, тож вони
// лишились екранами розділу. У вкладці «Гроші» стоять рядки, що їх
// відкривають, і на своїй-таки сторінці це має бути кнопка, а не посилання:
// перехід за посиланням просто перезавантажив би ту саму сторінку.
test('рядки «Регулярні операції» й «Імпорт» відкривають екрани розділу', async ({ page }) => {
  await openSettings(page);
  await expect(page.locator('a[href*="#recurring"]')).toHaveCount(0);
  await page.click('[data-action="recurring"]');
  await expect(page.locator('#recurringOverlay')).toHaveClass(/show/);
  // Вікно налаштувань при цьому закривається: два шари один над одним
  // читались би як одне вікно з двома заголовками.
  await expect(page.locator('#settingsOverlay')).not.toHaveClass(/show/);
});
