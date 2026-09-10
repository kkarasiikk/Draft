// Колір категорії: тепер його можна обрати, і тижневик перестав бути
// винятком серед списків категорій.
//
// Раніше колір визначався сам — за порядком у списку — і змінити його не
// було як. А категорії тижневика кольору не мали зовсім: на тлі кольорових
// бюджету й цілей вони єдині лишались сірими.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Шестерня в шапці відкриває вікно одразу на вкладці свого розділу, тож
// список вкладок на телефоні лишається за кадром — клікати по ньому не треба.
const openSettings = async (page, path, ready) => {
  await openModule(page, path, { seed: {}, ready });
  await page.click('#pageSettingsBtn');
  await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
};

test.describe('Підписи', () => {
  test.use({ viewport: { width: 430, height: 900 } });

  test('вкладка зветься «Бюджет», а не «Гроші»', async ({ page }) => {
    await openSettings(page, 'index.html', '#homeScreen');
    // Розділу «Гроші» в застосунку немає: у меню, на плитці головної та в
    // заголовку сторінки він скрізь «Бюджет».
    await expect(page.locator('[data-tab="budget"]')).toContainText('Бюджет');
    await expect(page.locator('[data-tab="budget"]')).not.toContainText('Гроші');
  });

  test('підпис валюти називає заощадження', async ({ page }) => {
    await openSettings(page, 'budget/index.html', '#appScreen');
    const pane = page.locator('.settings-pane');
    await expect(pane).toContainText('Валюта балансу заощаджень');
    await expect(pane).not.toContainText('Валюта загального балансу');
  });
});

test.describe('Вибір кольору', () => {
  test.use({ viewport: { width: 430, height: 900 } });

  test('крапочка відкриває палітру, і лише одну', async ({ page }) => {
    await openSettings(page, 'budget/index.html', '#appScreen');
    await expect(page.locator('[data-cat-palette]:not([hidden])')).toHaveCount(0);
    const dots = page.locator('[data-cat-color]');
    await dots.first().click();
    await expect(page.locator('[data-cat-palette]:not([hidden])')).toHaveCount(1);
    // Друга крапочка не додає другу палітру, а перемикає на себе: дві
    // розгорнуті поруч перетворили б список категорій на кашу.
    await dots.nth(1).click();
    await expect(page.locator('[data-cat-palette]:not([hidden])')).toHaveCount(1);
  });

  test('обраний колір записується в категорію', async ({ page }) => {
    await openSettings(page, 'budget/index.html', '#appScreen');
    await page.locator('[data-cat-color]').first().click();
    await page.locator('[data-cat-palette]:not([hidden]) [data-cat-swatch="5"]').click();
    await expect.poll(async () => page.evaluate(() => {
      const calls = (window.__fbCalls.set || []).filter((c) => c.payload && c.payload.categoriesExpense);
      const last = calls[calls.length - 1];
      return last ? last.payload.categoriesExpense[0].colorIndex : null;
    })).toBe(5);
  });

  test('поточний колір позначено в палітрі', async ({ page }) => {
    await openSettings(page, 'budget/index.html', '#appScreen');
    await page.locator('[data-cat-color]').first().click();
    const box = page.locator('[data-cat-palette]:not([hidden])');
    await expect(box.locator('.settings-swatch.on')).toHaveCount(1);
  });
});

test.describe('Тижневик більше не виняток', () => {
  test.use({ viewport: { width: 430, height: 900 } });

  test('його категорії теж мають крапочку кольору', async ({ page }) => {
    await openSettings(page, 'tasks/index.html', '#appScreen');
    const week = page.locator('[data-cat-kind="week"]');
    await expect(week).toHaveCount(1);
    // Було colored:false — крапочок не малювалось зовсім.
    expect(await week.locator('[data-cat-color]').count()).toBeGreaterThan(0);
  });

  test('заголовок групи в тижні має міточку кольору', async ({ page }) => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const monday = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
    await openModule(page, 'tasks/index.html', { seed: { tasks: [{
      id: 'w1', title: 'Прибрати в шафі', done: false, weekStart: monday, weekCat: 'home',
      completedAt: null, dueDate: null, notes: '', dueTime: null, reminderAt: null, notifiedAt: null,
    }] } });
    await page.click('#bnWeek');
    const dot = page.locator('.plan-group-dot');
    await expect(dot).toHaveCount(1);
    // Колір беруть із палітри, а не з кольору застосунку.
    const bg = await dot.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });
});
