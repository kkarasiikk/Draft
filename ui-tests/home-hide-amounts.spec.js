// Сума витрат на головній ховається за крапками.
//
// Головна — єдиний екран, який видно з чужого боку мимохідь: телефон лежить
// на столі, хтось зазирнув через плече. Перемикач живе в меню головної, а
// стан — у localStorage: це налаштування ПРИСТРОЮ, а не людини (телефон
// носять із собою, компʼютер стоїть удома).
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

test.use({ viewport: { width: 390, height: 844 } });

const iso = (shift = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};
const monthStart = () => iso().slice(0, 7) + '-01';

const SEED = {
  transactions: [
    { id: 't1', date: monthStart(), type: 'expense', amount: 15400 },
  ],
  profile: { currency: 'PLN' },
};

async function openHub(page, seed = SEED) {
  await openModule(page, 'index.html', { seed, ready: '#homeScreen' });
}

const openMenu = (page) => page.click('#menuBtn');
const hide = (page) => page.click('[data-hide-amounts="true"]');
const show = (page) => page.click('[data-hide-amounts="false"]');

test('за замовчуванням сума видна', async ({ page }) => {
  await openHub(page);
  await expect(page.locator('#budgetStat')).toContainText('15');
});

test('перемикач ховає суму за крапками', async ({ page }) => {
  await openHub(page);
  await openMenu(page);
  await hide(page);
  await expect(page.locator('#budgetStat')).toHaveText('•••');
  // Валюта лишається: таємниця в сумі, а не в тому, у чому її рахують.
  await expect(page.locator('#budgetUnit')).toHaveText('PLN');
});

test('і повертає її назад', async ({ page }) => {
  await openHub(page);
  await openMenu(page);
  await hide(page);
  await expect(page.locator('#budgetStat')).toHaveText('•••');
  await show(page);
  await expect(page.locator('#budgetStat')).toContainText('15');
});

test('вибір лягає в localStorage цього пристрою', async ({ page }) => {
  await openHub(page);
  await openMenu(page);
  await hide(page);
  await expect(page.locator('#budgetStat')).toHaveText('•••');
  expect(await page.evaluate(() => localStorage.getItem('financeAppHideAmounts'))).toBe('1');
  await show(page);
  expect(await page.evaluate(() => localStorage.getItem('financeAppHideAmounts'))).toBe('0');
});

test('раз схована — схована й на наступному відкритті', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('financeAppHideAmounts', '1'); } catch (err) { /* приватний режим */ }
  });
  await openHub(page);
  // Ані першого кадру з сумою: маска стоїть уже в першому рендері плитки.
  await expect(page.locator('#budgetStat')).toHaveText('•••');
  await openMenu(page);
  await expect(page.locator('[data-hide-amounts="true"]')).toHaveClass(/selected/);
});

test('рядок про план теж не світить числом', async ({ page }) => {
  // З планом під сумою стоїть «лишилось N із плану» — це теж гроші.
  await openHub(page, {
    transactions: [{ id: 't1', date: monthStart(), type: 'expense', amount: 15400 }],
    profile: { monthlyBudget: 30000, currency: 'PLN' },
  });
  await expect(page.locator('#budgetNote')).toHaveText(/\d/);

  await openMenu(page);
  await hide(page);
  await expect(page.locator('#budgetNote')).toContainText('•••');
  await expect(page.locator('#budgetNote'), 'у рядку не має лишитись жодної цифри').not.toHaveText(/\d/);
});

test('решта плиток не маскується — гроші лише в бюджеті', async ({ page }) => {
  await openHub(page, Object.assign({}, SEED, {
    tasks: [{ id: 'a', title: 'Справа', done: false, dueDate: iso() }],
  }));
  await openMenu(page);
  await hide(page);
  await expect(page.locator('#tasksStat')).toHaveText('1');
});
