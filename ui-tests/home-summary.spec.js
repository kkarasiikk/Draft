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

// ---- Кільця на плитках ----
// Головне, що тут перевіряється, — коли кільця бути НЕ повинно. Порожнє коло
// читається як «нуль», а нуль і «немає даних» — різні речі.
test.describe('Кільця', () => {
  const T = iso(0);

  const pct = (page, id) => page.$eval(`#${id} .tile-ring-arc`, (el) =>
    Number(getComputedStyle(el).getPropertyValue('--pct')));
  const mid = (page, id) => page.$eval(`#${id} .tile-ring-mid`, (el) => el.textContent.trim());
  const shown = (page, id) => page.$eval(`#${id}`, (el) => !el.hidden);

  test('бюджет: без плану кільця немає, з планом — є', async ({ page }) => {
    const tx = [{ type: 'expense', amount: 5000, date: T, category: 'food' }];
    await openHub(page, { transactions: tx });
    await page.waitForTimeout(400);
    expect(await shown(page, 'budgetRing'), 'без плану кільце малювати нема з чого').toBe(false);

    await openHub(page, { transactions: tx, profile: { monthlyBudget: 10000 } });
    await expect.poll(() => shown(page, 'budgetRing')).toBe(true);
    expect(await pct(page, 'budgetRing')).toBe(50);
    await expect(page.locator('#budgetSub')).toContainText('5 000');
  });

  test('бюджет: перевитрата видно числом, а кільце не переповнюється', async ({ page }) => {
    await openHub(page, {
      transactions: [{ type: 'expense', amount: 12000, date: T, category: 'food' }],
      profile: { monthlyBudget: 10000 },
    });
    await expect.poll(() => pct(page, 'budgetRing')).toBe(100);
    await expect(page.locator('#budgetSub')).toContainText('2 000');
  });

  test('завдання: кільце рахує закрите за сьогодні', async ({ page }) => {
    await openHub(page, { tasks: [
      { dueDate: T, done: true }, { dueDate: T, done: true },
      { dueDate: T, done: false }, { dueDate: T, done: false },
    ] });
    await expect.poll(() => pct(page, 'tasksRing')).toBe(50);
    expect(await mid(page, 'tasksRing')).toBe('2');
  });

  test('завдання: вільний день кільця не отримує', async ({ page }) => {
    await openHub(page, { tasks: [] });
    await page.waitForTimeout(400);
    expect(await shown(page, 'tasksRing')).toBe(false);
  });

  test('цілі: кільце показує найтерміновішу, підпис її називає', async ({ page }) => {
    await openHub(page, { goals: [
      { title: 'Далека', status: 'active', targetDate: iso(300), targetValue: 10, currentValue: 1, milestones: [], checkins: [] },
      { title: 'Близька', status: 'active', targetDate: iso(10), targetValue: 10, currentValue: 8, milestones: [], checkins: [] },
    ] });
    await expect.poll(() => pct(page, 'goalsRing')).toBe(80);
    await expect(page.locator('#goalsSub')).toContainText('Близька');
  });

  test('цілі: назва не витісняє того, що стосується сьогодні', async ({ page }) => {
    // Серія й «сьогодні без кроку» лишаються на плитці поруч із назвою:
    // дедлайн через місяць нікуди не втече, а невідмічений день — втече.
    await openHub(page, { goals: [
      { title: 'Біг', status: 'active', targetDate: iso(30), checkins: [], blockers: [], milestones: [{ done: true }, { done: false }] },
    ] });
    await expect(page.locator('#goalsSub')).toContainText('Біг');
    await expect(page.locator('#goalsSub')).toContainText('без кроку');
  });

  test('тренування: сьогодні нічого — кільця немає, і так і сказано', async ({ page }) => {
    await openHub(page, { workouts: [{ date: iso(-3), exercises: [{ sets: [{ weight: 50, reps: 5 }] }] }] });
    await page.waitForTimeout(400);
    expect(await shown(page, 'workoutRing')).toBe(false);
    await expect(page.locator('#workoutSub')).toContainText(/немає/i);
  });

  test('тренування наперед: кільце порожнє, підпис каже «заплановано»', async ({ page }) => {
    await openHub(page, { workouts: [{ date: T, name: '', exercises: [
      { sets: [{ weight: 0, reps: 0 }, { weight: 0, reps: 0 }] },
    ] }] });
    await expect.poll(() => shown(page, 'workoutRing')).toBe(true);
    expect(await pct(page, 'workoutRing')).toBe(0);
    await expect(page.locator('#workoutSub')).toContainText(/заплановано/i);
  });

  test('тренування в процесі: кільце рахує зроблені підходи', async ({ page }) => {
    await openHub(page, { workouts: [{ date: T, name: '', exercises: [
      { sets: [{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }, { weight: 0, reps: 0 }, { weight: 0, reps: 0 }] },
    ] }] });
    await expect.poll(() => pct(page, 'workoutRing')).toBe(50);
    expect(await mid(page, 'workoutRing')).toBe('2/4');
  });
});

// ---- Головна перестала бути меню ----
// Раніше це був список із чотирьох кнопок «Відкрити». Перевіряємо не вигляд,
// а обіцянку: типовий день закривається, не виходячи звідси.
test.describe('Сьогодні', () => {
  const task = (id, over = {}) => ({ id, title: 'Забрати документи', done: false, dueDate: iso(), ...over });

  test('справа на сьогодні стоїть у списку, а не лише в лічильнику', async ({ page }) => {
    await openHub(page, { tasks: [task('t1')] });
    await expect(page.locator('#todayPanel')).toBeVisible();
    await expect(page.locator('.today-name').first()).toHaveText('Забрати документи');
  });

  test('прострочене відділене від сьогоднішнього', async ({ page }) => {
    await openHub(page, { tasks: [
      task('t1'),
      task('old', { title: 'Продовжити страховку', dueDate: iso(-4) }),
    ] });
    await expect(page.locator('.today-row.overdue')).toHaveCount(1);
    await expect(page.locator('.today-row.overdue .today-name')).toHaveText('Продовжити страховку');
  });

  test('виконане закреслене й лежить нижче невиконаного', async ({ page }) => {
    // Тренування на сьогодні — щоб у списку лишились самі завдання.
    await openHub(page, {
      tasks: [
        task('done', { title: 'Купити протеїн', done: true }),
        task('open', { title: 'Відповісти Міші' }),
      ],
      workouts: [{ id: 'w', date: iso(), exercises: [] }],
    });
    const names = await page.locator('.today-row .today-name').allTextContents();
    expect(names).toEqual(['Відповісти Міші', 'Купити протеїн']);
  });

  test('галочка пише в базу, не виходячи з головної', async ({ page }) => {
    await openHub(page, { tasks: [task('t1')] });
    await page.click('[data-task="t1"]');
    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.done).toBe(true);
  });

  test('ціль без кроку показана з кнопкою, і кнопка відмічає день', async ({ page }) => {
    await openHub(page, { goals: [
      { id: 'g1', title: 'Подушка 20 000', status: 'active', category: 'finance', checkins: [], milestones: [] },
    ] });
    await expect(page.locator('[data-goal-step="g1"]')).toBeVisible();
    await page.click('[data-goal-step="g1"]');
    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.checkins).toEqual([iso()]);
  });

  test('відмічена сьогодні ціль у списку не висить', async ({ page }) => {
    await openHub(page, { goals: [
      { id: 'g1', title: 'Подушка', status: 'active', category: 'finance', checkins: [iso()], milestones: [] },
    ] });
    await expect(page.locator('[data-goal-step="g1"]')).toHaveCount(0);
  });

  test('порожній день — це новина, а не порожній екран', async ({ page }) => {
    await openHub(page, { tasks: [], goals: [], workouts: [{ id: 'w', date: iso(), exercises: [] }] });
    await expect(page.locator('.today-empty')).toBeVisible();
  });
});

test.describe('Тиждень', () => {
  test('сітка — чотири розділи на сім днів', async ({ page }) => {
    await openHub(page, { workouts: [{ id: 'w1', date: iso(-2), exercises: [] }] });
    await expect(page.locator('#weekPanel')).toBeVisible();
    await expect(page.locator('.week-cell')).toHaveCount(28);
  });

  test('день із рухом пофарбований, порожній — ні', async ({ page }) => {
    await openHub(page, { workouts: [{ id: 'w1', date: iso(), exercises: [] }] });
    // Сьогодні — остання клітинка рядка тренувань (четвертого).
    const cells = page.locator('.week-row').nth(4).locator('.week-cell');
    await expect(cells.nth(6)).toHaveClass(/l1/);
    await expect(cells.nth(0)).not.toHaveClass(/l1|l2/);
  });

  test('сьогоднішній стовпчик виділено в кожному рядку', async ({ page }) => {
    await openHub(page, { workouts: [{ id: 'w1', date: iso(), exercises: [] }] });
    await expect(page.locator('.week-cell.today')).toHaveCount(4);
  });

  test('рядки названі, бо колір несе лише кількість руху', async ({ page }) => {
    await openHub(page, { workouts: [{ id: 'w1', date: iso(), exercises: [] }] });
    await expect(page.locator('.week-name')).toHaveText(['Бюджет', 'Цілі', 'Завдання', 'Тренування']);
  });
});

test.describe('Рядок під датою', () => {
  test('називає, що чекає, одним реченням', async ({ page }) => {
    await openHub(page, {
      tasks: [{ id: 't1', title: 'Справа', done: false, dueDate: iso() }],
      goals: [{ id: 'g1', title: 'Ціль', status: 'active', category: 'finance', checkins: [], milestones: [] }],
    });
    await expect(page.locator('#todayLine')).toContainText('на сьогодні');
    await expect(page.locator('#todayLine')).toContainText('без кроку');
  });

  test('коли нічого не чекає — так і каже, а не мовчить', async ({ page }) => {
    await openHub(page, { tasks: [], goals: [], workouts: [{ id: 'w', date: iso(), exercises: [] }] });
    await expect(page.locator('#todayLine')).toHaveText('Сьогодні нічого не чекає.');
  });

  test('дата стоїть над рядком', async ({ page }) => {
    await openHub(page, { tasks: [] });
    await expect(page.locator('#todayDate')).not.toHaveText('');
  });
});
