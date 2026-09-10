// Дрібні налаштування вигляду бюджету — в одному місці, у вкладці «Бюджет»
// спільного вікна.
//
// Було три окремі вікна, по одному на вкладку, і шестерня в шапці відкривала
// то одне з них, то спільне — залежно від того, де ти стояв. Тепер вона
// завжди веде в те саме місце, а всі сім параметрів лежать поруч.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const SEED = {
  transactions: [
    { id: 't1', type: 'expense', amount: 100, category: 'food', currency: 'UAH', date: '2026-09-03', note: '' },
  ],
  savings: [
    { id: 's1', name: 'Подорожі', amount: 700, currency: 'PLN' },
    { id: 's2', name: 'Власна справа', amount: 600, currency: 'EUR' },
  ],
  pages: [
    { id: 'p1', title: 'Борги', content: 'Міша винен 2160' },
  ],
};

const open = async (page, seed = SEED) => {
  await openModule(page, 'budget/index.html', { seed, ready: '#appScreen' });
  await page.click('#pageSettingsBtn');
  await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
};

test.describe('Телефон: усе в одному вікні', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('окремих вікон більше немає — ні в розмітці, ні на екрані', async ({ page }) => {
    await openModule(page, 'budget/index.html', { seed: SEED, ready: '#appScreen' });
    await expect(page.locator('#statsSettingsOverlay')).toHaveCount(0);
    await expect(page.locator('#savingsSettingsOverlay')).toHaveCount(0);
    await expect(page.locator('#notesSettingsOverlay')).toHaveCount(0);
  });

  // Головне, на що скаржились: шестерня відкривала щоразу інше.
  test('шестерня веде в те саме вікно з будь-якої вкладки', async ({ page }) => {
    await openModule(page, 'budget/index.html', { seed: SEED, ready: '#appScreen' });
    for (const tab of ['#bnEntries', '#bnStats', '#bnNotes', '#bnSavings']) {
      await page.click(tab);
      await page.click('#pageSettingsBtn');
      await expect(page.locator('#settingsOverlay'), tab).toHaveClass(/show/);
      // І одразу на вкладці «Бюджет», а не в списку розділів.
      await expect(page.locator('.settings-pane-title')).toHaveText('Бюджет');
      await page.click('#settingsClose');
    }
  });

  test('усі сім параметрів стоять поруч, у вкладці «Бюджет»', async ({ page }) => {
    await open(page);
    const pane = page.locator('.settings-pane');
    // Великими вони лише на вигляд — це text-transform, а не сам текст.
    for (const label of ['Валюта', 'Видимі діаграми', 'Загальний баланс заощаджень',
      'Валюта балансу заощаджень', 'Сортування нотаток', 'Текст нотатки в списку',
      'Категорії витрат', 'Категорії доходів']) {
      await expect(pane).toContainText(label);
    }
  });
});

test.describe('Діаграми', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('чипи перемикаються незалежно — це не вибір одного з трьох', async ({ page }) => {
    await open(page);
    const pie = page.locator('[data-view-chart="chartPie"]');
    const trend = page.locator('[data-view-chart="chartTrend"]');
    await expect(pie).toHaveClass(/selected/);
    await expect(trend).toHaveClass(/selected/);

    await pie.click();
    await expect(page.locator('[data-view-chart="chartPie"]')).not.toHaveClass(/selected/);
    await expect(page.locator('[data-view-chart="chartTrend"]')).toHaveClass(/selected/);
  });

  test('діаграма зникає одразу, поки вікно ще відкрите', async ({ page }) => {
    await open(page);
    await page.click('[data-view-chart="chartPie"]');
    await page.click('#settingsClose');
    await page.click('#bnStats');
    await expect(page.locator('#pieChartCard')).toBeHidden();
    await expect(page.locator('#trendChartCard')).toBeVisible();
  });

  test('вибір лишається після перезавантаження', async ({ page }) => {
    await open(page);
    await page.click('[data-view-chart="chartSavings"]');
    await page.click('#settingsClose');
    // Відкриваємо сторінку заново — localStorage той самий.
    await openModule(page, 'budget/index.html', { seed: SEED, ready: '#appScreen' });
    await page.click('#bnStats');
    await expect(page.locator('#savingsTrendCard')).toBeHidden();
  });
});

test.describe('Заощадження', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('загальний баланс ховається й вертається', async ({ page }) => {
    await open(page);
    await page.click('[data-view-bool="savingsTotal"][data-view-value="off"]');
    await page.click('#settingsClose');
    await page.click('#bnSavings');
    await expect(page.locator('#savingsTotalCard')).toBeHidden();
  });

  // Валюта підсумку має сенс, лише коли підсумок зводиться в одну.
  test('вибір валюти зʼявляється тільки при «одній валюті»', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-view-savings-currency]')).toHaveCount(0);
    await page.click('[data-view-savings-mode="single"]');
    await expect(page.locator('[data-view-savings-currency]')).toHaveCount(4);
    await page.click('[data-view-savings-mode="multi"]');
    await expect(page.locator('[data-view-savings-currency]')).toHaveCount(0);
  });

  // Курсів у тестах немає, тож зводимо те, що конвертувати не треба:
  // перевіряємо саме режим, а не арифметику обміну.
  test('«одна валюта» зводить підсумок в один рядок, а не в три', async ({ page }) => {
    const seed = { savings: [
      { id: 's1', name: 'Подорожі', amount: 700, currency: 'PLN' },
      { id: 's2', name: 'Збереження', amount: 300, currency: 'PLN' },
    ] };
    await open(page, seed);
    await expect(page.locator('[data-view-savings-mode="multi"]')).toHaveClass(/selected/);
    await page.click('[data-view-savings-mode="single"]');
    await page.click('[data-view-savings-currency="PLN"]');
    await page.click('#settingsClose');
    await page.click('#bnSavings');
    await expect(page.locator('#savingsTotalBalance')).toContainText('1');
    await expect(page.locator('#savingsTotalBalance')).toContainText('zł');
  });
});

test.describe('Нотатки', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  const notesSeed = {
    pages: [
      { id: 'b', title: 'Борги', content: 'Міша винен 2160' },
      { id: 'a', title: 'Автівка', content: 'Замінити масло' },
    ],
  };

  test('сортування за назвою переставляє список', async ({ page }) => {
    await open(page, notesSeed);
    await page.click('[data-view-notes-sort="title"]');
    await page.click('#settingsClose');
    await page.click('#bnNotes');
    await expect(page.locator('.note-card-title')).toHaveText(['Автівка', 'Борги']);
  });

  test('текст нотатки в списку ховається', async ({ page }) => {
    await open(page, notesSeed);
    await page.click('#settingsClose');
    await page.click('#bnNotes');
    await expect(page.locator('.note-card-snippet').first()).toBeVisible();

    await page.click('#pageSettingsBtn');
    await page.click('[data-view-bool="noteSnippet"][data-view-value="off"]');
    await page.click('#settingsClose');
    await expect(page.locator('.note-card-snippet')).toHaveCount(0);
  });
});

test.describe('Вікно однакове звідусіль', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  // Налаштування лежать у localStorage, спільному для всього застосунку,
  // тож вкладка «Бюджет» показує їх і з інших сторінок — і зміна доїжджає.
  test('те саме видно й із цілей, і звідти ж міняється', async ({ page }) => {
    await openModule(page, 'goals/index.html', { ready: '#appScreen' });
    await page.click('#pageSettingsBtn');
    // З розділу вікно відкривається одразу на його вкладці, тож до списку
    // розділів вертаємось кнопкою «Назад».
    await page.click('#settingsBack');
    await page.click('[data-tab="budget"]');
    await expect(page.locator('.settings-pane')).toContainText('Видимі діаграми');
    await page.click('[data-view-chart="chartTrend"]');

    await openModule(page, 'budget/index.html', { seed: SEED, ready: '#appScreen' });
    await page.click('#bnStats');
    await expect(page.locator('#trendChartCard')).toBeHidden();
  });
});
