// Живі підсумки на плитках головного екрана.
//
// Головна — екран, з якого заходять щоразу, а показувала вона лише назви
// розділів. Перевіряємо, що кожна плитка каже те, заради чого в розділ ідуть.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// «Сьогодні» береться з реального годинника, тож дати рахуємо від нього —
// інакше тест протух би наступного дня.
const iso = (shift = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};
const monthStart = () => iso().slice(0, 7) + '-01';

async function openHub(page, seed) {
  await page.route('**/cdnjs.cloudflare.com/**', (r) => r.fulfill({ status: 200, body: '' }));
  await openModule(page, 'index.html', { seed, ready: '#homeScreen' });
}

test.describe('Живі плитки', () => {
  test('бюджет показує баланс місяця', async ({ page }) => {
    await openHub(page, { transactions: [
      { id: 't1', date: monthStart(), type: 'income', amount: 45000 },
      { id: 't2', date: iso(), type: 'expense', amount: 15000 },
    ] });
    await expect(page.locator('#budgetSub')).toContainText('30 000');
  });

  test('завдання показують, скільки на сьогодні', async ({ page }) => {
    await openHub(page, { tasks: [
      { id: 'a', dueDate: iso(), done: false },
      { id: 'b', dueDate: iso(), done: false },
      { id: 'c', dueDate: iso(), done: true },
    ] });
    await expect(page.locator('#tasksSub')).toContainText('2');
  });

  test('порожній день так і каже', async ({ page }) => {
    await openHub(page, { tasks: [] });
    await expect(page.locator('#tasksSub')).toHaveText('на сьогодні вільно');
  });

  test('цілі показують серію', async ({ page }) => {
    await openHub(page, { goals: [
      { id: 'g1', status: 'active', checkins: [iso(-2), iso(-1), iso()], blockers: [] },
    ] });
    await expect(page.locator('#goalsSub')).toContainText('серія 3');
  });

  test('цілі без кроку сьогодні', async ({ page }) => {
    await openHub(page, { goals: [
      { id: 'g1', status: 'active', checkins: [], blockers: [] },
      { id: 'g2', status: 'active', checkins: [], blockers: [] },
    ] });
    await expect(page.locator('#goalsSub')).toContainText('2 без кроку');
  });

  test('тренування показують, коли востаннє', async ({ page }) => {
    await openHub(page, { workouts: [{ id: 'w1', date: iso(-3) }] });
    await expect(page.locator('#workoutSub')).toContainText('3');
  });

  test('без даних плитки лишаються з описом розділу, а не з нулями', async ({ page }) => {
    await openHub(page, {});
    // Порожня база — це не «0 ₴», а «тренувань ще немає»: чесніше й корисніше.
    await expect(page.locator('#workoutSub')).toHaveText('тренувань ще немає');
    await expect(page.locator('#goalsSub')).toHaveText('цілей ще немає');
  });
});
