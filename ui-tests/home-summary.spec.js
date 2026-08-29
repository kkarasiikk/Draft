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

// ---- Плитки-числа ----
// Плитка більше не речення з кнопкою «Відкрити», а головне число розділу.
// Перевіряємо і саме число, і головне правило: порожня база — це не «0»,
// а «ще немає», бо нуль і «немає даних» різні речі.
test.describe('Плитки', () => {
  const T = iso(0);
  const stat = (page, key) => page.locator(`#${key}Stat`);
  const cap = (page, key) => page.locator(`#${key}Sub`);
  const note = (page, key) => page.locator(`#${key}Note`);

  test('бюджет показує витрачене за місяць', async ({ page }) => {
    await openHub(page, { transactions: [
      { id: 't1', date: monthStart(), type: 'income', amount: 45000 },
      { id: 't2', date: iso(), type: 'expense', amount: 15000 },
    ] });
    await expect(stat(page, 'budget')).toHaveText('15 000');
    await expect(cap(page, 'budget')).toContainText('витрачено');
  });

  test('бюджет: із планом видно, скільки лишилось', async ({ page }) => {
    await openHub(page, {
      transactions: [{ type: 'expense', amount: 5000, date: T, category: 'food' }],
      profile: { monthlyBudget: 10000 },
    });
    await expect(note(page, 'budget')).toContainText('5 000');
    await expect(note(page, 'budget')).toBeVisible();
  });

  test('бюджет: перевитрата названа перевитратою', async ({ page }) => {
    await openHub(page, {
      transactions: [{ type: 'expense', amount: 12000, date: T, category: 'food' }],
      profile: { monthlyBudget: 10000 },
    });
    await expect(note(page, 'budget')).toContainText(/перевитрата/i);
  });

  test('бюджет: без плану рядка про план немає', async ({ page }) => {
    await openHub(page, { transactions: [{ type: 'expense', amount: 5000, date: T, category: 'food' }] });
    await expect(note(page, 'budget')).toBeHidden();
  });

  test('завдання показують, скільки на сьогодні', async ({ page }) => {
    await openHub(page, { tasks: [
      { id: 'a', dueDate: iso(), done: false },
      { id: 'b', dueDate: iso(), done: false },
      { id: 'c', dueDate: iso(), done: true },
    ] });
    await expect(stat(page, 'tasks')).toHaveText('2');
    await expect(cap(page, 'tasks')).toContainText('1');
  });

  test('завдання: борг видно окремим рядком', async ({ page }) => {
    await openHub(page, { tasks: [
      { id: 'a', dueDate: iso(), done: false },
      { id: 'b', dueDate: iso(-3), done: false },
    ] });
    await expect(note(page, 'tasks')).toContainText('1');
  });

  test('порожній день так і каже', async ({ page }) => {
    await openHub(page, { tasks: [] });
    await expect(cap(page, 'tasks')).toHaveText('на сьогодні вільно');
    await expect(note(page, 'tasks')).toBeHidden();
  });

  test('цілі показують серію', async ({ page }) => {
    await openHub(page, { goals: [
      { id: 'g1', status: 'active', checkins: [iso(-2), iso(-1), iso()], blockers: [] },
    ] });
    await expect(stat(page, 'goals')).toHaveText('3');
    await expect(cap(page, 'goals')).toContainText('серія');
  });

  test('цілі без кроку сьогодні — окремим рядком', async ({ page }) => {
    await openHub(page, { goals: [
      { id: 'g1', status: 'active', checkins: [], blockers: [] },
      { id: 'g2', status: 'active', checkins: [], blockers: [] },
    ] });
    await expect(note(page, 'goals')).toContainText('2 без кроку');
  });

  test('цілі: без серії плитка називає найтерміновішу', async ({ page }) => {
    await openHub(page, { goals: [
      { title: 'Далека', status: 'active', targetDate: iso(300), targetValue: 10, currentValue: 1, milestones: [], checkins: [] },
      { title: 'Близька', status: 'active', targetDate: iso(10), targetValue: 10, currentValue: 8, milestones: [], checkins: [] },
    ] });
    await expect(cap(page, 'goals')).toHaveText('Близька');
  });

  test('тренування показують, коли востаннє й що це було', async ({ page }) => {
    await openHub(page, { workouts: [{ id: 'w1', date: iso(-3), name: 'Ноги' }] });
    await expect(stat(page, 'workout')).toHaveText('3');
    await expect(cap(page, 'workout')).toContainText('Ноги');
  });

  test('тренування наперед — це план, а не зроблене', async ({ page }) => {
    await openHub(page, { workouts: [{ date: T, name: '', exercises: [
      { sets: [{ weight: 0, reps: 0 }, { weight: 0, reps: 0 }] },
    ] }] });
    await expect(cap(page, 'workout')).toContainText(/заплановано/i);
  });

  test('тренування в процесі рахує зроблені підходи', async ({ page }) => {
    await openHub(page, { workouts: [{ date: T, name: '', exercises: [
      { sets: [{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }, { weight: 0, reps: 0 }, { weight: 0, reps: 0 }] },
    ] }] });
    await expect(stat(page, 'workout')).toHaveText('2/4');
  });

  test('порожня база — це не нулі, а чесне «ще немає»', async ({ page }) => {
    await openHub(page, {});
    await expect(cap(page, 'workout')).toHaveText('тренувань ще немає');
    await expect(cap(page, 'goals')).toHaveText('цілей ще немає');
    await expect(stat(page, 'workout')).toHaveText('—');
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

  test('видно два завдання, решта — за посиланням', async ({ page }) => {
    await openHub(page, { tasks: [
      task('a', { title: 'Перше' }), task('b', { title: 'Друге' }),
      task('c', { title: 'Третє' }), task('d', { title: 'Четверте' }),
    ] });
    await expect(page.locator('[data-task]')).toHaveCount(2);
    await expect(page.locator('.today-more')).toHaveText(/2/);
  });

  test('посилання веде саме в завдання', async ({ page }) => {
    await openHub(page, { tasks: [
      task('a'), task('b'), task('c'),
    ] });
    await expect(page.locator('.today-more')).toHaveAttribute('href', 'tasks/index.html');
  });

  test('коли завдань два — посилання ні до чого', async ({ page }) => {
    await openHub(page, { tasks: [task('a'), task('b')] });
    await expect(page.locator('.today-more')).toHaveCount(0);
  });

  test('прострочене теж рахується в «ще N», а не губиться', async ({ page }) => {
    await openHub(page, { tasks: [
      task('a'), task('b'),
      task('old', { title: 'Страховка', dueDate: iso(-4) }),
    ] });
    await expect(page.locator('.today-more')).toHaveText(/1/);
  });

  test('лічильник у шапці рахує все, а не лише показане', async ({ page }) => {
    await openHub(page, {
      tasks: [task('a'), task('b'), task('c'), task('d')],
      workouts: [{ id: 'w', date: iso(), exercises: [] }],
    });
    await expect(page.locator('#todayCount')).toHaveText(/4/);
  });

  test('порожній день — це новина, а не порожній екран', async ({ page }) => {
    await openHub(page, { tasks: [], goals: [], workouts: [{ id: 'w', date: iso(), exercises: [] }] });
    await expect(page.locator('.today-empty')).toBeVisible();
  });
});

test.describe('Календар тижня', () => {
  // Понеділок того тижня, у якому лежить сьогодні.
  const monday = () => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const dayOffset = (n) => {
    const d = new Date(monday() + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  test('сім днів і назва місяця над ними', async ({ page }) => {
    await openHub(page, { tasks: [] });
    await expect(page.locator('.cal-day')).toHaveCount(7);
    await expect(page.locator('#calMonth')).not.toHaveText('');
  });

  test('сьогодні виділене рівно один раз', async ({ page }) => {
    await openHub(page, { tasks: [] });
    await expect(page.locator('.cal-day.today')).toHaveCount(1);
  });

  test('день із завданням має крапку, порожній — ні', async ({ page }) => {
    // Вівторок цього тижня — другий день у смузі.
    await openHub(page, { tasks: [{ id: 'a', dueDate: dayOffset(1), done: false }] });
    await expect(page.locator('.cal-day').nth(1)).toHaveClass(/has/);
    await expect(page.locator('.cal-day').nth(0)).not.toHaveClass(/has/);
  });

  test('крапка стоїть і на майбутньому дні — календар дивиться вперед', async ({ page }) => {
    await openHub(page, { tasks: [{ id: 'a', dueDate: dayOffset(6), done: false }] });
    await expect(page.locator('.cal-day').nth(6)).toHaveClass(/has/);
  });

  test('день, де все закрито, відрізняється від дня з відкритими', async ({ page }) => {
    await openHub(page, { tasks: [
      { id: 'a', dueDate: dayOffset(0), done: true },
      { id: 'b', dueDate: dayOffset(1), done: false },
    ] });
    await expect(page.locator('.cal-day').nth(0)).toHaveClass(/done/);
    await expect(page.locator('.cal-day').nth(1)).not.toHaveClass(/done/);
  });

  test('тиждень починається з понеділка, а не з сьогодні', async ({ page }) => {
    await openHub(page, { tasks: [] });
    const nums = await page.locator('.cal-num').allTextContents();
    const first = new Date(monday() + 'T00:00:00').getDate();
    expect(Number(nums[0])).toBe(first);
  });

  test('числа йдуть підряд, без розривів', async ({ page }) => {
    await openHub(page, { tasks: [] });
    const nums = (await page.locator('.cal-num').allTextContents()).map(Number);
    const dates = nums.map((n, i) => new Date(dayOffset(i) + 'T00:00:00').getDate());
    expect(nums).toEqual(dates);
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

});

// ---- «+»: одна кнопка на всі чотири розділи ----
// Щоб записати витрату, треба було спершу зайти в Бюджет, знайти кнопку й
// лише тоді відкрити форму. Перевіряємо, що шторка веде одразу у форму.
test.describe('Швидкий запис', () => {
  const goal = (id, title) => ({
    id, title, status: 'active', category: 'health', checkins: [], milestones: [], blockers: [],
  });

  test('кнопка стоїть завжди, ще до того як дані приїхали', async ({ page }) => {
    await openHub(page, {});
    await expect(page.locator('#addFab')).toBeVisible();
  });

  test('шторка відкривається й показує чотири шляхи', async ({ page }) => {
    await openHub(page, { goals: [goal('g1', 'Біг')] });
    await page.click('#addFab');
    await expect(page.locator('#addOverlay')).toHaveClass(/show/);
    await expect(page.locator('.add-row')).toHaveCount(4);
  });

  test('три рядки ведуть одразу у форму створення', async ({ page }) => {
    await openHub(page, {});
    await page.click('#addFab');
    const hrefs = await page.locator('.add-row[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs).toEqual(['budget/index.html#new', 'tasks/index.html#new', 'workout/index.html#new']);
  });

  test('крок до цілі нікуди не веде — це один тап, а не форма', async ({ page }) => {
    await openHub(page, { goals: [goal('g1', 'Біг')] });
    await page.click('#addFab');
    await expect(page.locator('[data-add-goal]')).toBeVisible();
    await expect(page.locator('[data-add-goal]')).not.toHaveAttribute('href', /./);
  });

  test('крок питає, у яку саме ціль, і зараховує його', async ({ page }) => {
    await openHub(page, { goals: [goal('g1', 'Біг'), goal('g2', 'Книжки')] });
    await page.click('#addFab');
    await page.click('[data-add-goal]');
    await expect(page.locator('[data-step]')).toHaveCount(2);
    await expect(page.locator('[data-step="g1"] .add-name')).toHaveText('Біг');

    await page.click('[data-step="g2"]');
    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.checkins).toEqual([iso()]);
    // Обрана ціль — і шторка закривається сама.
    await expect(page.locator('#addOverlay')).not.toHaveClass(/show/);
  });

  test('коли всі цілі відмічені, крок пропонувати нема чого', async ({ page }) => {
    await openHub(page, { goals: [{ ...goal('g1', 'Біг'), checkins: [iso()] }] });
    await page.click('#addFab');
    await expect(page.locator('[data-add-goal]')).toHaveCount(0);
    await expect(page.locator('.add-row[disabled]')).toBeVisible();
  });

  test('тап повз меню закриває, а по самому меню — ні', async ({ page }) => {
    await openHub(page, {});
    await page.click('#addFab');
    await page.click('#addMenu', { position: { x: 5, y: 5 } });
    await expect(page.locator('#addOverlay')).toHaveClass(/show/);

    await page.click('#addOverlay', { position: { x: 5, y: 5 } });
    await expect(page.locator('#addOverlay')).not.toHaveClass(/show/);
  });

  test('виїжджають самі плитки — без шапки й заголовка', async ({ page }) => {
    await openHub(page, {});
    await page.click('#addFab');
    // У меню немає нічого, крім рядків вибору.
    const kinds = await page.locator('#addMenu > div > *').evaluateAll((els) =>
      [...new Set(els.map((e) => e.className))]);
    expect(kinds).toEqual(['add-row']);
  });

  test('«+» другим дотиком закриває і сам показує це', async ({ page }) => {
    await openHub(page, {});
    await page.click('#addFab');
    await expect(page.locator('#addFab')).toHaveClass(/open/);

    await page.click('#addFab');
    await expect(page.locator('#addOverlay')).not.toHaveClass(/show/);
    await expect(page.locator('#addFab')).not.toHaveClass(/open/);
  });

  test('кнопка лишається над меню, а не ховається під ним', async ({ page }) => {
    await openHub(page, {});
    await page.click('#addFab');
    const [fab, overlay] = await page.evaluate(() => [
      Number(getComputedStyle(document.getElementById('addFab')).zIndex),
      Number(getComputedStyle(document.getElementById('addOverlay')).zIndex),
    ]);
    expect(fab).toBeGreaterThan(overlay);
  });
});

// ---- Що робить #new у модулях ----
// Обіцянка «+» тримається лише тоді, коли модуль справді відкриє форму, а не
// просто покаже свій список. Перевіряємо кожен, а заразом і те, що хеш після
// цього зникає: оновлення сторінки не має відкривати форму вдруге.
const NEW_FORM = [
  ['бюджет', 'budget/index.html', '#formOverlay'],
  ['завдання', 'tasks/index.html', '#taskFormOverlay'],
  ['тренування', 'workout/index.html', '#sessionFormOverlay'],
];

// Заглушка Firebase віддається лише на перший запит SDK, тож переходити між
// сторінками в одному тесті не можна — відкриваємо модуль одразу з хешем.
for (const [name, path, overlay] of NEW_FORM) {
  test(`${name}: #new відкриває форму створення`, async ({ page }) => {
    await openModule(page, `${path}#new`, { ready: '#appScreen' });
    await expect(page.locator(overlay)).toHaveClass(/show/);
  });

  test(`${name}: без #new форма не відкривається сама`, async ({ page }) => {
    await openModule(page, path, { ready: '#appScreen' });
    await page.waitForTimeout(200);
    await expect(page.locator(overlay)).not.toHaveClass(/show/);
  });

  test(`${name}: хеш зникає, щоб оновлення не відкрило форму вдруге`, async ({ page }) => {
    await openModule(page, `${path}#new`, { ready: '#appScreen' });
    await expect(page.locator(overlay)).toHaveClass(/show/);
    expect(new URL(page.url()).hash).toBe('');
  });
}
