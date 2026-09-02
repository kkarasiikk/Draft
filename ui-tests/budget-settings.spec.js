// Налаштування бюджету після того, як звідти прибрали план витрат на місяць.
//
// Поле стояло під валютою і живило кільце «витрачено з плану» на головній.
// Прибране на прохання: разом із полем пішли й кільце, і рядок «лишилось N
// з плану» — бо задавати той план більше нема де.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const openSettings = async (page, seed) => {
  await openModule(page, 'budget/index.html', seed ? { seed } : {});
  await page.click('#categoriesBtn');
  await expect(page.locator('#categoriesOverlay')).toHaveClass(/show/);
};

test('поля «План витрат на місяць» у налаштуваннях немає', async ({ page }) => {
  await openSettings(page);
  await expect(page.locator('#monthlyPlanInput')).toHaveCount(0);
  await expect(page.locator('#monthlyPlanClear')).toHaveCount(0);
  await expect(page.locator('#categoriesOverlay')).not.toContainText('План витрат');
});

test('валюта й категорії лишились на місці', async ({ page }) => {
  await openSettings(page);
  await expect(page.locator('#currencyPicker')).toBeVisible();
  await expect(page.locator('#expenseCatManageList')).toBeVisible();
});

test('старе число з профілю не воскрешає поле', async ({ page }) => {
  await openSettings(page, { profile: { monthlyBudget: 30000 } });
  await expect(page.locator('#monthlyPlanInput')).toHaveCount(0);
});
