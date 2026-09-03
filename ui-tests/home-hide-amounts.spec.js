// Сума витрат на головній ховається за крапками.
//
// Головна — єдиний екран, який видно з чужого боку мимохідь: телефон лежить
// на столі, хтось зазирнув через плече. Перемикач — око на самій плитці
// бюджету: спершу він був рядком у меню налаштувань, і його ніхто не
// знаходив, хоч ховати суму хочеться в ту саму секунду, коли до тебе
// підходять. Стан лежить у localStorage: це налаштування ПРИСТРОЮ, а не
// людини (телефон носять із собою, компʼютер стоїть удома).
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

const eye = (page) => page.locator('#hideAmountsBtn');
const toggle = (page) => eye(page).click();

test('за замовчуванням сума видна', async ({ page }) => {
  await openHub(page);
  await expect(page.locator('#budgetStat')).toContainText('15');
});

test('око на плитці ховає суму за крапками', async ({ page }) => {
  await openHub(page);
  await expect(eye(page)).toBeVisible();
  await toggle(page);
  await expect(page.locator('#budgetStat')).toHaveText('•••');
  // Валюта лишається: таємниця в сумі, а не в тому, у чому її рахують.
  await expect(page.locator('#budgetUnit')).toHaveText('PLN');
});

test('і повертає її назад', async ({ page }) => {
  await openHub(page);
  await toggle(page);
  await expect(page.locator('#budgetStat')).toHaveText('•••');
  await toggle(page);
  await expect(page.locator('#budgetStat')).toContainText('15');
});

// Плитка — посилання в бюджет, тож око мусить лишитись поза ним: інакше тап
// відкривав би розділ замість того, щоб сховати суму.
test('тап по оку не відкриває бюджет', async ({ page }) => {
  await openHub(page);
  await toggle(page);
  await expect(page).toHaveURL(/index\.html$/);
  await expect(page.locator('#homeScreen')).toBeVisible();
});

// Значок показує ДІЮ, а не стан: коли сума видна, він пропонує сховати.
test('підказка на оку каже, що буде далі', async ({ page }) => {
  await openHub(page);
  await expect(eye(page)).toHaveAttribute('aria-label', 'Сховати суму');
  await expect(eye(page)).toHaveAttribute('aria-pressed', 'false');
  await toggle(page);
  await expect(eye(page)).toHaveAttribute('aria-label', 'Показати суму');
  await expect(eye(page)).toHaveAttribute('aria-pressed', 'true');
});

test('вибір лягає в localStorage цього пристрою', async ({ page }) => {
  await openHub(page);
  await toggle(page);
  await expect(page.locator('#budgetStat')).toHaveText('•••');
  expect(await page.evaluate(() => localStorage.getItem('financeAppHideAmounts'))).toBe('1');
  await toggle(page);
  expect(await page.evaluate(() => localStorage.getItem('financeAppHideAmounts'))).toBe('0');
});

test('раз схована — схована й на наступному відкритті', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('financeAppHideAmounts', '1'); } catch (err) { /* приватний режим */ }
  });
  await openHub(page);
  // Ані першого кадру з сумою: маска стоїть уже в першому рендері плитки.
  await expect(page.locator('#budgetStat')).toHaveText('•••');
  await expect(eye(page)).toHaveAttribute('aria-pressed', 'true');
});

test('решта плиток не маскується — гроші лише в бюджеті', async ({ page }) => {
  await openHub(page, Object.assign({}, SEED, {
    tasks: [{ id: 'a', title: 'Справа', done: false, dueDate: iso() }],
  }));
  await toggle(page);
  await expect(page.locator('#tasksStat')).toHaveText('1');
});
