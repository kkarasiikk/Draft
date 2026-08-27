// Плюсик у скарбничці: той самий жест, що й у записах.
//
// Раніше «+» на вкладці «Збереження» розгортався у два пелюстки
// («Зняти» / «Поповнити»), і лише потім відкривалась форма — тобто той самий
// жест у сусідніх вкладках означав різні речі. Тепер він скрізь відкриває
// форму, а тип обирається перемикачем усередині неї.
const { test, expect } = require('@playwright/test');
const { openModule, isShown, dialog, tapBackdrop } = require('./helpers');

const GOAL = { id: 'g1', name: 'На відпустку', createdAt: '__ts__' };

/** Відкриває бюджет одразу на екрані конкретної цілі заощаджень. */
async function openGoal(page, seed = {}) {
  await openModule(page, 'budget/index.html', {
    seed: { savingsGoals: [GOAL], savings: [], ...seed },
  });
  await page.click('.bn-item[data-tab="savings"]');
  await page.click('.goal-card[data-id="g1"]');
  await expect(page.locator('#bnAddBtn')).toBeVisible();
}

test.describe('Форма заощаджень', () => {
  test('«+» відкриває форму одразу, без проміжного вибору', async ({ page }) => {
    await openGoal(page);
    await page.click('#bnAddBtn');
    await page.waitForSelector('#savingsFormOverlay.show');
    // Перемикач видно разом із сумою — передумати можна, вже почавши вводити.
    await expect(page.locator('#savingsTypeToggle')).toBeVisible();
    await expect(page.locator('#savingsAmountInput')).toBeFocused();
  });

  test('за замовчуванням — поповнення: у скарбничку частіше кладуть', async ({ page }) => {
    await openGoal(page);
    await page.click('#bnAddBtn');
    await page.waitForSelector('#savingsFormOverlay.show');
    await expect(page.locator('#savingsToggleDeposit')).toHaveClass(/active/);
    await expect(page.locator('#savingsToggleWithdraw')).not.toHaveClass(/active/);
  });

  test('перемикач справді міняє тип запису', async ({ page }) => {
    await openGoal(page);
    await page.click('#bnAddBtn');
    await page.waitForSelector('#savingsFormOverlay.show');
    await page.click('#savingsToggleWithdraw');
    await expect(page.locator('#savingsToggleWithdraw')).toHaveClass(/active/);

    await page.fill('#savingsAmountInput', '250');
    await page.click('#savingsSubmitBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
    const [add] = await page.evaluate(() => window.__fbCalls.add);
    expect(add.col).toBe('savings');
    expect(add.payload.type).toBe('withdraw');
    expect(add.payload.amount).toBe(250);
    expect(add.payload.goalId).toBe('g1');
  });

  test('форма відкривається чистою: тип попереднього запису не липне', async ({ page }) => {
    await openGoal(page);
    await page.click('#bnAddBtn');
    await page.waitForSelector('#savingsFormOverlay.show');
    await page.click('#savingsToggleWithdraw');
    await tapBackdrop(page, 'savingsFormOverlay');
    await dialog.discard(page);

    await page.click('#bnAddBtn');
    await page.waitForSelector('#savingsFormOverlay.show');
    await expect(page.locator('#savingsToggleDeposit')).toHaveClass(/active/);
  });

  test('у вже збереженому записі перемикача немає — це був би інший запис', async ({ page }) => {
    await openGoal(page, {
      savings: [{ id: 's1', type: 'deposit', amount: 500, currency: 'UAH',
                  note: '', date: '2026-08-01', goalId: 'g1' }],
    });
    await page.click('.entry-menu-btn');
    await page.waitForSelector('#entryMenuOverlay.show');
    await page.click('#editEntryBtn');
    await page.waitForSelector('#savingsFormOverlay.show');

    expect(await isShown(page, '#savingsTypeToggle')).toBe(false);
    await expect(page.locator('#savingsTypeToggle')).toBeHidden();
    // Замість перемикача — заголовок, який називає, що саме редагуємо.
    await expect(page.locator('#savingsModalTitle')).toBeVisible();
  });

  test('зміна типу рахується за незбережену зміну', async ({ page }) => {
    await openGoal(page);
    await page.click('#bnAddBtn');
    await page.waitForSelector('#savingsFormOverlay.show');
    await page.click('#savingsToggleWithdraw');
    await tapBackdrop(page, 'savingsFormOverlay');
    expect(await dialog.shown(page)).toBe(true);
  });
});
