// Налаштування бюджету після трьох правок поспіль.
//
// Спершу звідти прибрали план витрат на місяць: поле стояло під валютою і
// живило кільце «витрачено з плану» на головній — разом із полем пішли й
// кільце, і рядок «лишилось N з плану».
//
// Потім саме вікно розділу зникло: валюта й категорії переїхали у спільне
// вікно налаштувань (../settings.js), вкладка «Гроші». Шестерня в шапці
// відкриває тепер його, і перевіряти треба саме там.
//
// Насамкінець пішли регулярні операції й імпорт CSV — обидві можливості
// цілком, а не лише рядки, що їх відкривали. У вкладці «Гроші» лишились
// рівно валюта й два списки категорій.
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

// Обидві можливості прибрано цілком: не сховано рядок, а видалено екрани,
// форму, банер, підписку на правила й парсер CSV. Тому стережемо не лише
// відсутність рядків, а й те, що за ними нічого не лишилось.
test('рядків «Регулярні операції» й «Імпорт» у вкладці «Гроші» немає', async ({ page }) => {
  await openSettings(page);
  await expect(page.locator('[data-action="recurring"]')).toHaveCount(0);
  await expect(page.locator('[data-action="import"]')).toHaveCount(0);
  await expect(page.locator('#settingsOverlay')).not.toContainText('Регулярні');
  await expect(page.locator('#settingsOverlay')).not.toContainText('CSV');
});

test('у вкладці «Гроші» не лишилось жодного рядка-дії', async ({ page }) => {
  await openSettings(page);
  // Валюта й два списки категорій — це поля, а не дії; жодного рядка, що
  // кудись веде або щось відкриває, у вкладці більше немає.
  await expect(page.locator('#settingsOverlay .settings-action')).toHaveCount(0);
});

test('самих екранів і поля вибору файлу на сторінці теж немає', async ({ page }) => {
  await openModule(page, 'budget/index.html', {});
  await expect(page.locator('#recurringOverlay')).toHaveCount(0);
  await expect(page.locator('#recurringFormOverlay')).toHaveCount(0);
  await expect(page.locator('#importCsvInput')).toHaveCount(0);
});

// Банер «N регулярних операцій чекають» стояв над списком записів і був
// єдиним, що нагадувало про правила поза налаштуваннями.
test('банера насталих операцій над списком немає', async ({ page }) => {
  await openModule(page, 'budget/index.html', {});
  await expect(page.locator('#recBanner')).toHaveCount(0);
  await expect(page.locator('.rec-banner')).toHaveCount(0);
});

// Правила Firestore лишились, щоб уже заведене можна було прочитати й
// видалити, — але розділ до тієї колекції більше не ходить.
test('розділ не підписується на правила регулярних операцій', async ({ page }) => {
  await openModule(page, 'budget/index.html', {});
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => typeof window.BudgetRecurring)).toBe('undefined');
  expect(await page.evaluate(() =>
    Array.from(document.scripts).some((x) => /recurr/.test(x.src)))).toBe(false);
});
