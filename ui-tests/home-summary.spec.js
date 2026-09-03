// Живі підсумки на плитках головного екрана.
//
// Головна — екран, з якого заходять щоразу, а показувала вона лише назви
// розділів. Перевіряємо, що кожна плитка каже те, заради чого в розділ ідуть.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Тут перевіряється телефонна розкладка — та, з якою головну відкривають
// щодня. Комп'ютерна переставляє ті самі блоки й має власний файл.
test.use({ viewport: { width: 390, height: 844 } });

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
// Порядок плиток обраний людиною, а не випадковий: щоденне ближче до ока.
test('плитки стоять у своєму порядку: бюджет, завдання, цілі, тренування', async ({ page }) => {
  await openHub(page, {});
  const names = await page.locator('.tile .tile-name').allTextContents();
  expect(names).toEqual(['Бюджет', 'Завдання', 'Цілі', 'Тренування']);
});

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

  // Плану витрат на місяць більше немає — ні поля в налаштуваннях, ні рядка
  // «лишилось N з плану» під сумою. Навіть якщо число ще лежить у профілі з
  // тих часів, плитка про нього мовчить.
  test('бюджет: рядка про план немає навіть зі старим числом у профілі', async ({ page }) => {
    await openHub(page, {
      transactions: [{ type: 'expense', amount: 5000, date: T, category: 'food' }],
      profile: { monthlyBudget: 10000 },
    });
    await expect(stat(page, 'budget')).toHaveText('5 000');
    await expect(note(page, 'budget')).toBeHidden();
  });

  // Велике число — скільки СПЛАНОВАНО, разом із уже виконаним. Раніше тут
  // стояло невиконане, і число падало з кожною галочкою: плитка ніби
  // забувала про зроблене.
  test('завдання показують, скільки заплановано на сьогодні', async ({ page }) => {
    await openHub(page, { tasks: [
      { id: 'a', dueDate: iso(), done: false },
      { id: 'b', dueDate: iso(), done: false },
      { id: 'c', dueDate: iso(), done: true },
    ] });
    // Одним рядком: слово перед числом і слово після — «Заплановано 3 завдання».
    await expect(page.locator('#tasksPre')).toHaveText('Заплановано');
    await expect(stat(page, 'tasks')).toHaveText('3');
    await expect(page.locator('#tasksUnit')).toHaveText('завдання');
    // І все: скільки з них уже закрито, плитка не рахує — по галочки людина
    // йде в сам розділ, а тут вона дивиться, чим зайнятий день.
    await expect(cap(page, 'tasks')).toHaveText('');
    await expect(note(page, 'tasks')).toBeHidden();
  });

  // Раніше тут був рядок «N боргів». Невиконане з минулих днів лишається у
  // своєму дні: плитка каже про сьогодні й мовчить про те, що вже минуло.
  test('завдання: невиконане з минулих днів плитку не чіпає', async ({ page }) => {
    await openHub(page, { tasks: [
      { id: 'a', dueDate: iso(), done: false },
      { id: 'b', dueDate: iso(-3), done: false },
    ] });
    await expect(stat(page, 'tasks')).toHaveText('1');
    await expect(note(page, 'tasks')).toBeHidden();
  });

  test('порожній день не просто «нуль», а питання', async ({ page }) => {
    await openHub(page, { tasks: [] });
    await expect(page.locator('#tasksPre')).toHaveText('Заплановано');
    await expect(stat(page, 'tasks')).toHaveText('0');
    await expect(page.locator('#tasksUnit')).toHaveText('завдань');
    await expect(cap(page, 'tasks')).toHaveText('Маєш вихідний, чи просто не записано?');
    await expect(note(page, 'tasks')).toBeHidden();
  });

  // Плитка рахує цілі ПОТОЧНОГО МІСЯЦЯ — тієї вкладки, на якій відкривається
  // розділ, — і бере правило з goals/review.js, а не своє друге.
  const monthGoal = (over) => Object.assign({
    status: 'active', horizon: 'month', month: iso().slice(0, 7),
    checkins: [], milestones: [], blockers: [],
  }, over);

  test('цілі рахують місяць, а не серію', async ({ page }) => {
    await openHub(page, { goals: [
      monthGoal({ id: 'g1', title: 'Перша', checkins: [iso(-2), iso(-1), iso()] }),
      monthGoal({ id: 'g2', title: 'Друга' }),
    ] });
    await expect(stat(page, 'goals')).toHaveText('2');
    await expect(page.locator('#goalsUnit')).toHaveText('на цей місяць');
  });

  test('річні цілі в число місяця не потрапляють', async ({ page }) => {
    await openHub(page, { goals: [
      monthGoal({ id: 'g1', title: 'Місячна' }),
      monthGoal({ id: 'g2', title: 'Річна', horizon: 'year', month: null }),
    ] });
    await expect(stat(page, 'goals')).toHaveText('1');
  });

  test('цілі без кроку сьогодні — окремим рядком', async ({ page }) => {
    await openHub(page, { goals: [
      { id: 'g1', status: 'active', checkins: [], blockers: [] },
      { id: 'g2', status: 'active', checkins: [], blockers: [] },
    ] });
    await expect(note(page, 'goals')).toContainText('2 без кроку');
  });

  // Під числом — одна ціль, і на кожне відкриття головної інша: раніше тут
  // стояла найтерміновіша, і з десятка цілей на очі місяцями потрапляла та
  // сама. Перевіряємо не «яка саме», а що вона зі списку.
  test('під числом стоїть одна з цілей місяця', async ({ page }) => {
    await openHub(page, { goals: [
      monthGoal({ id: 'g1', title: 'Перша' }),
      monthGoal({ id: 'g2', title: 'Друга' }),
      monthGoal({ id: 'g3', title: 'Третя' }),
    ] });
    await expect(cap(page, 'goals')).toHaveText(/^(Перша|Друга|Третя)$/);
  });

  test('коли цілей на місяць немає, плитка так і каже', async ({ page }) => {
    await openHub(page, { goals: [monthGoal({ id: 'g1', title: 'Річна', horizon: 'year', month: null })] });
    await expect(stat(page, 'goals')).toHaveText('0');
    await expect(cap(page, 'goals')).toHaveText('цілей на цей місяць ще немає');
  });

  // Плитка відповідає на «що в мене сьогодні», а коли сьогодні нічого — на
  // «а коли наступне». «Скільки днів тому» звідси пішло: воно казало про
  // минуле, а плитка потрібна для того, що попереду.
  test('сьогоднішнє тренування — один рядок, і «є» в ньому жирне', async ({ page }) => {
    await openHub(page, { workouts: [{ id: 'w1', date: T, name: 'Ноги',
      exercises: [{ sets: [{ weight: 0, reps: 0 }] }] }] });
    await expect(cap(page, 'workout')).toHaveText('Сьогодні є тренування');
    await expect(cap(page, 'workout').locator('b')).toHaveText('є');
  });

  // Підпис один на обидва випадки: «сьогодні є тренування» правда і про
  // заплановане, і про розпочате. Різниця лишається в числі.
  test('розпочате тренування каже те саме, але рахує підходи', async ({ page }) => {
    await openHub(page, { workouts: [{ id: 'w1', date: T, name: 'Ноги', exercises: [
      { sets: [{ weight: 60, reps: 8 }, { weight: 0, reps: 0 }] },
    ] }] });
    await expect(cap(page, 'workout')).toHaveText('Сьогодні є тренування');
    await expect(stat(page, 'workout')).toHaveText('1/2');
  });

  test('без тренування сьогодні плитка каже, коли наступне', async ({ page }) => {
    await openHub(page, { workouts: [
      { id: 'w1', date: iso(-3), name: 'Ноги' },
      { id: 'p', date: iso(1), name: 'Груди', exercises: [{ sets: [{ weight: 0, reps: 0 }] }] },
    ] });
    await expect(stat(page, 'workout')).toHaveText('—');
    await expect(cap(page, 'workout')).toHaveText('Сьогодні тренувань немає\nНаступне — завтра');
  });

  test('післязавтра теж словом, а не датою', async ({ page }) => {
    await openHub(page, { workouts: [
      { id: 'p', date: iso(2), name: 'Груди', exercises: [{ sets: [{ weight: 0, reps: 0 }] }] },
    ] });
    await expect(cap(page, 'workout')).toContainText('Наступне — післязавтра');
  });

  test('далі за післязавтра — датою: «через сім днів» треба рахувати в голові', async ({ page }) => {
    await openHub(page, { workouts: [
      { id: 'p', date: iso(7), name: 'Груди', exercises: [{ sets: [{ weight: 0, reps: 0 }] }] },
    ] });
    await expect(cap(page, 'workout')).toContainText(/Наступне — \d+ \p{L}+/u);
  });

  // План на наступний тиждень записують тими самими документами, що й
  // зроблене, тож найсвіжішим записом виявлявся план — і плитка казала
  // «-4 дні тому», а рядок стану про зал мовчав.
  // План на наступний тиждень записують тими самими документами, що й
  // зроблене, тож найсвіжішим записом виявлявся план — і рядок стану про зал
  // мовчав. Сьогоднішнє тренування план не витісняє.
  test('план на майбутнє не витісняє сьогоднішнє тренування', async ({ page }) => {
    await openHub(page, { workouts: [
      { id: 'w1', date: T, name: 'Fullbody СБ', exercises: [{ sets: [{ weight: 0, reps: 0 }] }] },
      { id: 'plan', date: iso(5), name: 'Ноги', exercises: [{ sets: [{ weight: 0, reps: 0 }] }] },
    ] });
    await expect(cap(page, 'workout')).toHaveText('Сьогодні є тренування');
  });

  test('тренування наперед — це план, а не зроблене', async ({ page }) => {
    await openHub(page, { workouts: [{ date: T, name: '', exercises: [
      { sets: [{ weight: 0, reps: 0 }, { weight: 0, reps: 0 }] },
    ] }] });
    await expect(stat(page, 'workout')).toHaveText('1');
    await expect(page.locator('#workoutUnit')).toHaveText('вправ');
  });

  test('тренування в процесі рахує зроблені підходи', async ({ page }) => {
    await openHub(page, { workouts: [{ date: T, name: '', exercises: [
      { sets: [{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }, { weight: 0, reps: 0 }, { weight: 0, reps: 0 }] },
    ] }] });
    await expect(stat(page, 'workout')).toHaveText('2/4');
  });

  // Порожня база — це не нулі, а запрошення: плитка не звітує, а каже, що
  // сюди можна класти.
  test('порожня база кличе, а не звітує', async ({ page }) => {
    await openHub(page, {});
    await expect(stat(page, 'workout')).toHaveText('—');
    await expect(cap(page, 'workout'))
      .toHaveText('Сьогодні тренувань немає\nСюди можеш додавати власні тренування, та слідкувати за їх прогресом.');
    await expect(cap(page, 'goals')).toHaveText('цілей на цей місяць ще немає');
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

  test('невиконане з минулих днів у «Сьогодні» не потрапляє', async ({ page }) => {
    await openHub(page, { tasks: [
      task('t1'),
      task('old', { title: 'Продовжити страховку', dueDate: iso(-4) }),
    ] });
    await expect(page.locator('#todayList')).toContainText('Забрати документи');
    await expect(page.locator('#todayList')).not.toContainText('Продовжити страховку');
  });

  test('виконане закреслене й лежить нижче невиконаного', async ({ page }) => {
    await openHub(page, {
      tasks: [
        task('done', { title: 'Купити протеїн', done: true }),
        task('open', { title: 'Відповісти Міші' }),
      ],
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

  // Картка називається «Сьогодні» й показує саме завдання на сьогодні.
  // Цілі без кроку й рядок про тренування звідси пішли: разом із «побачити
  // ще N» виходило шість рядків, і головна не вміщалась в екран.
  test('ціль без сьогоднішнього кроку в картку не лізе', async ({ page }) => {
    await openHub(page, {
      tasks: [task('t1')],
      goals: [{ id: 'g1', title: 'Подушка 20 000', status: 'active', category: 'finance', checkins: [], milestones: [] }],
    });
    await expect(page.locator('#todayList')).toContainText('Забрати документи');
    await expect(page.locator('#todayList')).not.toContainText('Подушка');
    await expect(page.locator('[data-goal-step]')).toHaveCount(0);
  });

  test('рядка про тренування в картці немає', async ({ page }) => {
    // Тренувань немає взагалі — саме той випадок, коли рядок «востаннє N днів
    // тому» зʼявлявся й займав місце під справами.
    await openHub(page, { tasks: [task('t1')], workouts: [] });
    await expect(page.locator('#todayList .today-row')).toHaveCount(1);
  });

  test('більше чотирьох завдань — показуємо чотири, решта за посиланням', async ({ page }) => {
    await openHub(page, { tasks: [
      task('a', { title: 'Перше' }), task('b', { title: 'Друге' }),
      task('c', { title: 'Третє' }), task('d', { title: 'Четверте' }),
      task('e', { title: 'Пʼяте' }), task('f', { title: 'Шосте' }),
    ] });
    await expect(page.locator('[data-task]')).toHaveCount(4);
    await expect(page.locator('#todayList')).not.toContainText('Пʼяте');
    // Те, що не вмістилось, не зникає мовчки — рядок веде в розділ завдань
    // (стеля й сам рядок залежать від ширини екрана, див. home-fill.spec.js).
    await expect(page.locator('.today-more')).toHaveText('Ще 2 у завданнях →');
  });

  test('чотири завдання вміщаються всі', async ({ page }) => {
    await openHub(page, { tasks: [task('a'), task('b'), task('c'), task('d')] });
    await expect(page.locator('[data-task]')).toHaveCount(4);
  });

  test('лічильник рахує сьогоднішні завдання, а не показані рядки', async ({ page }) => {
    await openHub(page, {
      tasks: [task('a'), task('b'), task('c'), task('d'), task('e'),
        task('old', { dueDate: iso(-4) })],
      goals: [{ id: 'g1', title: 'Подушка', status: 'active', category: 'finance', checkins: [], milestones: [] }],
    });
    // Пʼять сьогоднішніх: ані вчорашнє, ані ціль сюди не додаються.
    await expect(page.locator('#todayCount')).toHaveText(/5/);
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

  // Під числом — крапка, і більше нічого. Назви справ тут були обрізані до
  // «Ввече…»: упізнати за ними своє однаково не виходило, а смуга виростала
  // втричі й виштовхувала решту головної за межу екрана.
  test('у дні зі справами стоїть крапка, у порожньому — ні', async ({ page }) => {
    // Вівторок цього тижня — другий день у смузі.
    await openHub(page, { tasks: [{ id: 'a', dueDate: dayOffset(1), title: 'Пошта', done: false }] });
    await expect(page.locator('.cal-day').nth(1).locator('.cal-dot')).toHaveClass(/has/);
    await expect(page.locator('.cal-day').nth(0).locator('.cal-dot')).not.toHaveClass(/has|all-done/);
  });

  test('назв справ у смузі немає', async ({ page }) => {
    await openHub(page, { tasks: [{ id: 'a', dueDate: dayOffset(1), title: 'Пошта', done: false }] });
    await expect(page.locator('#calWeek')).not.toContainText('Пошта');
  });

  test('крапка стоїть і на майбутньому дні — тиждень дивиться вперед', async ({ page }) => {
    await openHub(page, { tasks: [{ id: 'a', dueDate: dayOffset(6), title: 'Звіт', done: false }] });
    await expect(page.locator('.cal-day').nth(6).locator('.cal-dot')).toHaveClass(/has/);
  });

  test('день, де все закрито, виглядає інакше за день, де ще є що робити', async ({ page }) => {
    await openHub(page, { tasks: [
      { id: 'a', dueDate: dayOffset(0), title: 'Готово', done: true },
      { id: 'b', dueDate: dayOffset(1), title: 'Робити', done: false },
    ] });
    await expect(page.locator('.cal-day').nth(0).locator('.cal-dot')).toHaveClass(/all-done/);
    await expect(page.locator('.cal-day').nth(1).locator('.cal-dot')).toHaveClass(/has/);
  });

  test('день з відкритим і закритим лишається днем, де є що робити', async ({ page }) => {
    await openHub(page, { tasks: [
      { id: 'a', dueDate: dayOffset(1), title: 'Закрите', done: true },
      { id: 'b', dueDate: dayOffset(1), title: 'Відкрите', done: false },
    ] });
    await expect(page.locator('.cal-day').nth(1).locator('.cal-dot')).toHaveClass(/has/);
  });

  test('десять справ у дні — та сама одна крапка', async ({ page }) => {
    await openHub(page, { tasks: Array.from({ length: 10 }, (_, n) => (
      { id: 't' + n, dueDate: dayOffset(2), title: 'Справа ' + n, done: false }
    )) });
    await expect(page.locator('.cal-day').nth(2).locator('.cal-dot')).toHaveCount(1);
  });

  test('порожній день не робить смугу нижчою — числа не стрибають', async ({ page }) => {
    await openHub(page, { tasks: [{ id: 'a', dueDate: dayOffset(1), title: 'Пошта', done: false }] });
    const heights = await page.locator('.cal-day').evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);
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

// Рядок під датою — одне речення про день: скільки завдань заплановано і чи
// є тренування. Раніше це був перелік через кому, у якому третім пунктом
// стояли «11 цілей без кроку» й «1 день без залу» — тобто не про сьогодні, а
// про те, чого не зроблено.
test.describe('Рядок під датою', () => {
  const line = (page) => page.locator('#todayLine');
  const workout = (name) => ({ id: 'w', date: iso(), name: name || 'Ноги',
    exercises: [{ sets: [{ weight: 0, reps: 0 }] }] });
  const task = (id, done) => ({ id, title: 'Справа ' + id, done, dueDate: iso() });

  test('завдання й тренування — одним реченням', async ({ page }) => {
    await openHub(page, { tasks: [task('a'), task('b'), task('c')], workouts: [workout()] });
    await expect(line(page)).toHaveText('На сьогодні маєш 3 заплановані завдання та тренування.');
  });

  // Рахуємо заплановане, разом із уже зробленим — те саме число, що й на
  // плитці. Інакше рядок і плитка казали б різне про один день.
  test('виконане з числа не зникає', async ({ page }) => {
    await openHub(page, { tasks: [task('a'), task('b', true)], workouts: [] });
    await expect(line(page)).toContainText('2 заплановані завдання');
  });

  test('без тренування речення це й каже', async ({ page }) => {
    await openHub(page, { tasks: [task('a')], workouts: [] });
    await expect(line(page)).toHaveText('На сьогодні маєш 1 заплановане завдання, а тренування немає.');
  });

  test('саме тренування без завдань', async ({ page }) => {
    await openHub(page, { tasks: [], workouts: [workout()] });
    await expect(line(page)).toHaveText('На сьогодні маєш тренування, а завдань не заплановано.');
  });

  test('порожній день — так і каже, а не мовчить', async ({ page }) => {
    await openHub(page, { tasks: [], workouts: [] });
    await expect(line(page)).toHaveText('На сьогодні нічого не заплановано.');
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

  test('шторка відкривається й показує всі шляхи запису', async ({ page }) => {
    await openHub(page, { goals: [goal('g1', 'Біг')] });
    await page.click('#addFab');
    await expect(page.locator('#addOverlay')).toHaveClass(/show/);
    await expect(page.locator('.add-row')).toHaveCount(5);
    await expect(page.locator('.add-row[disabled]')).toHaveCount(0);
  });

  // Куди рядок веде — не косметика, а межа: витрата й завдання пишуться
  // просто тут (див. home-quick-add.spec.js), а ціль і тренування ведуть у
  // свій розділ, бо там не форма, а екран.
  test('витрата й завдання нікуди не ведуть — форма відкривається тут', async ({ page }) => {
    await openHub(page, {});
    await page.click('#addFab');
    await expect(page.locator('[data-quick="expense"]')).not.toHaveAttribute('href', /./);
    await expect(page.locator('[data-quick="task"]')).not.toHaveAttribute('href', /./);
  });

  test('ціль і тренування ведуть одразу у форму створення в розділі', async ({ page }) => {
    await openHub(page, {});
    await page.click('#addFab');
    const hrefs = await page.locator('.add-row[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs).toEqual(['goals/index.html#new', 'workout/index.html#new']);
  });

  test('ціль можна завести з головної, навіть коли жодної немає', async ({ page }) => {
    await openHub(page, { goals: [] });
    await page.click('#addFab');
    await expect(page.locator('.add-row[href="goals/index.html#new"]')).toBeVisible();
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

  test('коли крок нема куди зарахувати, рядка просто немає', async ({ page }) => {
    // Неактивний рядок лише займав місце й читався як поламаний.
    await openHub(page, { goals: [{ ...goal('g1', 'Біг'), checkins: [iso()] }] });
    await page.click('#addFab');
    await expect(page.locator('[data-add-goal]')).toHaveCount(0);
    await expect(page.locator('.add-row')).toHaveCount(4);
  });

  test('без жодної цілі крок теж не пропонується, а завести ціль — так', async ({ page }) => {
    await openHub(page, { goals: [] });
    await page.click('#addFab');
    await expect(page.locator('[data-add-goal]')).toHaveCount(0);
    await expect(page.locator('.add-row[href="goals/index.html#new"]')).toBeVisible();
  });

  test('тап повз меню закриває, а по самому меню — ні', async ({ page }) => {
    await openHub(page, {});
    await page.click('#addFab');

    // Ціль — проміжок МІЖ рядками: це меню, але не дія. Кут першого рядка
    // сюди не годиться: у нього скруглення 16px, і потрапляння в нього
    // залежить від півпікселя, на який меню зсунулось по горизонталі.
    const menu = await page.locator('#addMenu').boundingBox();
    const row = await page.locator('.add-row').first().boundingBox();
    await page.click('#addMenu', {
      position: { x: menu.width / 2, y: (row.y + row.height + 4) - menu.y },
    });
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
  ['цілі', 'goals/index.html', '#goalFormOverlay'],
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
