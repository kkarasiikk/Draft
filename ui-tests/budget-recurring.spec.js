// Регулярні операції: оренда, підписки, зарплата.
//
// Ключове рішення, яке перевіряємо: настале НЕ записується само. Бюджет —
// реальні гроші, і транзакція, якої не було, тихо псує баланс.
const { test, expect } = require('@playwright/test');
const { openModule, isShown } = require('./helpers');

const rule = (over = {}) => ({
  id: 'r1', type: 'expense', amount: 12000, category: 'home', note: 'Оренда',
  recurrence: { type: 'monthly', interval: 1, day: 1, weekdays: [], anchor: 'schedule' },
  nextDate: '2026-08-01', active: true, ...over,
});

test.describe('Регулярні операції', () => {
  test('банер зʼявляється, коли операція настала', async ({ page }) => {
    await openModule(page, 'budget/index.html', { seed: { recurringTx: [rule()] } });
    await expect(page.locator('#recBanner')).toBeVisible();
    await expect(page.locator('#recBannerText')).not.toBeEmpty();
  });

  test('майбутня операція банера не показує', async ({ page }) => {
    const future = rule({ nextDate: '2099-01-01' });
    await openModule(page, 'budget/index.html', { seed: { recurringTx: [future] } });
    await page.waitForTimeout(400);
    expect(await isShown(page, '#recBanner')).toBe(false);
    await expect(page.locator('#recBanner')).toBeHidden();
  });

  test('«Записати» створює транзакцію і зсуває правило', async ({ page }) => {
    await openModule(page, 'budget/index.html', { seed: { recurringTx: [rule()] } });
    await page.click('#recBanner');
    await page.waitForSelector('#recurringOverlay.show');
    await page.click('[data-post="0"]');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
    const [add] = await page.evaluate(() => window.__fbCalls.add);
    expect(add.col).toBe('transactions');
    expect(add.payload.amount).toBe(12000);
    expect(add.payload.date).toBe('2026-08-01');
    // Позначка джерела: видно, що запис народився з правила.
    expect(add.payload.source).toBe('recurring');

    // Правило поїхало на наступний місяць.
    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBe(1);
    const [upd] = await page.evaluate(() => window.__fbCalls.update);
    expect(upd.col).toBe('recurringTx');
    expect(upd.payload.nextDate).toBe('2026-09-01');
  });

  test('«Пропустити» зсуває правило, але транзакції не створює', async ({ page }) => {
    await openModule(page, 'budget/index.html', { seed: { recurringTx: [rule()] } });
    await page.click('#recBanner');
    await page.waitForSelector('#recurringOverlay.show');
    await page.click('[data-skip="0"]');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBe(1);
    const [upd] = await page.evaluate(() => window.__fbCalls.update);
    expect(upd.payload.nextDate).toBe('2026-09-01');
    // Найважливіше: грошей не з'явилось.
    expect(await page.evaluate(() => window.__fbCalls.add.length)).toBe(0);
  });

  test('нове правило зберігається з коректним числом місяця', async ({ page }) => {
    await openModule(page, 'budget/index.html');
    await page.click('#categoriesBtn');
    await page.waitForSelector('#settingsOverlay.show');
    await page.click('[data-action="recurring"]');
    await page.waitForSelector('#recurringOverlay.show');
    await page.click('#addRecurringBtn');
    await page.waitForSelector('#recurringFormOverlay.show');

    await page.fill('#recAmountInput', '499');
    await page.fill('#recNoteInput', 'Netflix');
    await page.fill('#recNextInput', '2026-09-14');
    await page.click('#recSubmitBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
    const [add] = await page.evaluate(() => window.__fbCalls.add);
    expect(add.col).toBe('recurringTx');
    expect(add.payload.amount).toBe(499);
    expect(add.payload.note).toBe('Netflix');
    expect(add.payload.nextDate).toBe('2026-09-14');
    // Число місяця береться з дати, а не з дня заведення правила.
    expect(add.payload.recurrence.day).toBe(14);
    expect(add.payload.active).toBe(true);
    // Правила Firestore приймають рівно ці ключі.
    expect(Object.keys(add.payload).sort()).toEqual(
      ['active', 'amount', 'category', 'createdAt', 'nextDate', 'note', 'recurrence', 'type', 'updatedAt']);
  });

  test('сума нижче нуля не зберігається', async ({ page }) => {
    await openModule(page, 'budget/index.html');
    await page.click('#categoriesBtn');
    await page.waitForSelector('#settingsOverlay.show');
    await page.click('[data-action="recurring"]');
    await page.waitForSelector('#recurringOverlay.show');
    await page.click('#addRecurringBtn');
    await page.waitForSelector('#recurringFormOverlay.show');
    await page.click('#recSubmitBtn');
    await expect(page.locator('#recFormError')).toBeVisible();
    expect(await page.evaluate(() => window.__fbCalls.add.length)).toBe(0);
  });
});
