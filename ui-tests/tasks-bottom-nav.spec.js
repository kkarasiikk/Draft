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

test('лишились рівно дві вкладки екранів плюс «Головна»', async ({ page }) => {
  await openModule(page, 'tasks/index.html');
  await expect(page.locator('#bottomNav [data-screen]')).toHaveCount(2);
  await expect(page.locator('#bnWeek')).toBeVisible();
  await expect(page.locator('#bnMonth')).toBeVisible();
  // «Головна» в розмітці є завжди, але на широкому екрані її ховають:
  // те саме робить перший рядок бічної колонки.
  await expect(page.locator('#bnHome')).toHaveCount(1);
});

// Панель була поділена на дві групи заради кнопки «+» посередині; та давно
// живе окремо, і після видалення однієї вкладки права половина лишилась би
// порожньою — а на широкому екрані, де «Головна» схована, порожньою цілком.
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

test('на широкому екрані дві кнопки, що лишились, заповнюють панель', async ({ page }) => {
  await openModule(page, 'tasks/index.html');
  await expect(page.locator('#bnHome')).toBeHidden();
  const { panel, items } = await page.evaluate(() => ({
    panel: document.getElementById('bottomNav').getBoundingClientRect().width,
    items: Array.from(document.querySelectorAll('#bottomNav .bn-item'))
      .map((el) => el.getBoundingClientRect().width).filter((w) => w > 0),
  }));
  expect(items).toHaveLength(2);
  expect(Math.max(...items) - Math.min(...items)).toBeLessThan(2);
  // Разом вони займають майже всю панель — порожньої половини немає.
  expect(items[0] + items[1]).toBeGreaterThan(panel - 30);
});

test('перемикання «Тиждень» ↔ «Календар» працює й далі', async ({ page }) => {
  await openModule(page, 'tasks/index.html');
  await page.click('#bnMonth');
  await expect(page.locator('#monthScreen')).toBeVisible();
  await expect(page.locator('#weekScreen')).toBeHidden();
  await expect(page.locator('#bnMonth')).toHaveClass(/active/);

  await page.click('#bnWeek');
  await expect(page.locator('#weekScreen')).toBeVisible();
  await expect(page.locator('#monthScreen')).toBeHidden();
  await expect(page.locator('#bnWeek')).toHaveClass(/active/);
});
