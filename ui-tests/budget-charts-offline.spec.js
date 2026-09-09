// Chart.js вантажиться з CDN, а застосунок — PWA, який має працювати офлайн.
// Заглушка UI-тестів віддає з cdnjs порожню відповідь, тобто кожен тут прогін
// уже йде «без Chart.js». Перевіряємо, що вкладка «Статистика» від цього не
// падає й малюється до кінця: на старому коді перший же `new Chart` кидав
// виняток і все після нього — підписи й легенда заощаджень — лишалось сирим.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const TODAY = new Date().toISOString().slice(0, 10);
const SEED = {
  profile: { currency: 'PLN', categoriesExpense: [{ id: 'food', label: 'Продукти', colorIndex: 0 }] },
  transactions: [{ id: 'x1', type: 'expense', amount: 128, category: 'food', currency: 'PLN', date: TODAY, note: '' }],
  savingsGoals: [{ id: 'sg1', name: 'Подорож', createdAt: { __ts: '2026-01-01' } }],
  savings: [{ id: 'v1', type: 'deposit', amount: 1200, currency: 'PLN', note: '', date: '2026-05-01', goalId: 'sg1' }],
};

async function openStats(page, lang) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Графік заощаджень зводить усе до однієї валюти, а курсів у тестах немає.
  // Ставимо ту саму валюту, що й у записах, щоб перевіряти саме відсутність
  // Chart.js, а не відсутність курсу.
  await page.addInitScript(() => {
    try { localStorage.setItem('financeAppSavingsTrendCurrency', 'PLN'); } catch (err) { /* приватний режим */ }
  });
  await openModule(page, 'budget/index.html', { seed: SEED, lang });
  await page.click('#bnStats');
  await page.waitForTimeout(400);
  return errors;
}

test('без Chart.js вкладка «Статистика» не кидає винятків', async ({ page }) => {
  const errors = await openStats(page, 'uk');
  expect(errors).toEqual([]);
});

test('без Chart.js малюється все, що йде після графіків', async ({ page }) => {
  await openStats(page, 'uk');
  // Легенда пирога — до першого графіка, вона малювалась і раніше.
  await expect(page.locator('#pieLegend')).toContainText('Продукти');
  // А це все — після нього, і саме воно зникало.
  await expect(page.locator('#savingsTrendLegend')).toContainText('Подорож');
  await expect(page.locator('#savingsTrendLegend')).toContainText('Загальний баланс');
});

test('без Chart.js підпис періоду все одно оновлюється', async ({ page }) => {
  await openStats(page, 'en');
  // Підпис графіка заощаджень має показати обраний період («Last 6 months»).
  // Раніше renderStats обривався до цього рядка, і лишався загальний підпис
  // із applyLang — «Trend over 6 months», однаковий за будь-якого періоду.
  await expect(page.locator('#savingsTrendSub')).toContainText('Last 6');
  await expect(page.locator('#savingsTrendSub')).not.toContainText('Trend over');
});

test('без Chart.js полотна графіків сховані, а не порожні прямокутники', async ({ page }) => {
  await openStats(page, 'uk');
  for (const id of ['#pieChart', '#barChart', '#savingsTrendChart']) {
    await expect(page.locator(id), id).toBeHidden();
  }
});

test('коли бібліотека є — графіки будуються, полотна видимі', async ({ page }) => {
  // Двійник Chart.js: справжня бібліотека в тести не потрапляє (cdnjs
  // заглушено), а перевірити треба саме гілку «бібліотека на місці».
  await page.addInitScript(() => {
    window.__charts = [];
    window.Chart = function (canvas, config) {
      window.__charts.push({ id: canvas && canvas.id, type: config && config.type });
      this.destroy = function () {};
    };
  });
  const errors = await openStats(page, 'uk');
  expect(errors).toEqual([]);
  const built = await page.evaluate(() => window.__charts.map((c) => c.id));
  expect(built).toContain('pieChart');
  expect(built).toContain('barChart');
  expect(built).toContain('savingsTrendChart');
  for (const id of ['#pieChart', '#barChart', '#savingsTrendChart']) {
    await expect(page.locator(id), id).toBeVisible();
  }
});
