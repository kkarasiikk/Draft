// Нижня панель «Завдань» після того, як вкладку «Статистика» прибрали.
//
// Екран «Що я зробив» показував плитки, стовпчики за два тижні й список
// закритого днями. Прибраний на прохання: у розділі, куди заходять
// планувати день, це зайвий пункт. Разом із ним пішов і модуль
// tasks/stats.js — його більше нікому було годувати.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

test('вкладки «Статистика» немає, а сам екран не лишився в розмітці', async ({ page }) => {
  await openModule(page, 'tasks/index.html');
  await expect(page.locator('#bnStats')).toHaveCount(0);
  await expect(page.locator('#statsScreen')).toHaveCount(0);
  await expect(page.locator('#bottomNav')).not.toContainText('Статистика');
});

// Три вкладки — три горизонти: день, тиждень, календар. «Головна» звідси
// пішла разом із появою третьої: на хаб веде напис Life у шапці, той самий,
// що й у решті модулів, тож виходу це не забирає (див. tasks-week-plan.spec.js).
test('лишились рівно три вкладки екранів, і жодної «Головної»', async ({ page }) => {
  await openModule(page, 'tasks/index.html');
  await expect(page.locator('#bottomNav [data-screen]')).toHaveCount(3);
  await expect(page.locator('#bnDay')).toBeVisible();
  await expect(page.locator('#bnWeek')).toBeVisible();
  await expect(page.locator('#bnMonth')).toBeVisible();
  await expect(page.locator('#bnHome')).toHaveCount(0);
});

// Панель була поділена на дві групи заради кнопки «+» посередині; та давно
// живе окремо, і без цього права половина лишалась би порожньою.
test('на телефоні три кнопки стоять рівним рядком', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openModule(page, 'tasks/index.html');
  await expect(page.locator('#bottomNav .bn-side')).toHaveCount(0);
  const widths = await page.locator('#bottomNav .bn-item').evaluateAll(
    (els) => els.map((el) => el.getBoundingClientRect().width));
  expect(widths).toHaveLength(3);
  // Однакові з точністю до округлення — тобто панель заповнена вся.
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
});

test('на широкому екрані ті самі три кнопки заповнюють панель', async ({ page }) => {
  await openModule(page, 'tasks/index.html');
  const { panel, items } = await page.evaluate(() => ({
    panel: document.getElementById('bottomNav').getBoundingClientRect().width,
    items: Array.from(document.querySelectorAll('#bottomNav .bn-item'))
      .map((el) => el.getBoundingClientRect().width).filter((w) => w > 0),
  }));
  expect(items).toHaveLength(3);
  expect(Math.max(...items) - Math.min(...items)).toBeLessThan(2);
  // Разом вони займають майже всю панель — порожньої частини немає.
  expect(items.reduce((a, b) => a + b, 0)).toBeGreaterThan(panel - 30);
});

test('перемикання «День» ↔ «Календар» працює й далі', async ({ page }) => {
  await openModule(page, 'tasks/index.html');
  await page.click('#bnMonth');
  await expect(page.locator('#monthScreen')).toBeVisible();
  await expect(page.locator('#dayScreen')).toBeHidden();
  await expect(page.locator('#bnMonth')).toHaveClass(/active/);

  await page.click('#bnDay');
  await expect(page.locator('#dayScreen')).toBeVisible();
  await expect(page.locator('#monthScreen')).toBeHidden();
  await expect(page.locator('#bnDay')).toHaveClass(/active/);
});
