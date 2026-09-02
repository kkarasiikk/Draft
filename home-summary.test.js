const H = require('./home-summary');
const GoalStreak = require('./goals/streak');

const TODAY = '2026-08-26';

describe('budgetSummary: баланс місяця', () => {
  const tx = (date, type, amount) => ({ date, type, amount });

  test('рахує дохід, витрату й залишок', () => {
    expect(H.budgetSummary([
      tx('2026-08-05', 'income', 45000),
      tx('2026-08-06', 'expense', 12000),
      tx('2026-08-20', 'expense', 3000),
    ], TODAY)).toEqual({ income: 45000, expense: 15000, balance: 30000 });
  });

  test('минулий місяць не потрапляє в підсумок', () => {
    expect(H.budgetSummary([
      tx('2026-07-31', 'expense', 99999),
      tx('2026-08-01', 'expense', 100),
    ], TODAY).expense).toBe(100);
  });

  test('майбутні дати теж не рахуються — місяць ще не прожитий', () => {
    expect(H.budgetSummary([tx('2026-08-31', 'expense', 500)], TODAY).expense).toBe(0);
  });

  test('порожньо або сміття не ламає підрахунок', () => {
    expect(H.budgetSummary([], TODAY)).toEqual({ income: 0, expense: 0, balance: 0 });
    expect(H.budgetSummary(null, TODAY).balance).toBe(0);
    expect(H.budgetSummary([{ date: null }, { }], TODAY).balance).toBe(0);
  });
});

describe('tasksSummary: справи на сьогодні', () => {
  const task = (dueDate, done) => ({ dueDate, done });

  test('розділяє відкрите й зроблене на сьогодні', () => {
    expect(H.tasksSummary([
      task(TODAY, false), task(TODAY, false), task(TODAY, true),
      task('2026-09-01', false),          // майбутнє
    ], TODAY)).toEqual({ open: 2, done: 1 });
  });

  // Невиконане з минулого лишається у своєму дні. Раніше воно рахувалось
  // окремим числом «боргів» і показувалось на головній; тепер день минув —
  // і питання разом із ним.
  test('невиконане з минулих днів у сьогодні не потрапляє', () => {
    expect(H.tasksSummary([
      task('2026-08-20', false),
      task('2026-08-19', true),
    ], TODAY)).toEqual({ open: 0, done: 0 });
  });

  test('завдання без дати підсумок не чіпають', () => {
    expect(H.tasksSummary([task(null, false), {}], TODAY)).toEqual({ open: 0, done: 0 });
  });
});

describe('workoutSummary: коли востаннє', () => {
  test('рахує дні від найсвіжішого тренування', () => {
    const r = H.workoutSummary([{ date: '2026-08-20' }, { date: '2026-08-23' }], TODAY);
    expect(r).toEqual({ daysAgo: 3, lastDate: '2026-08-23' });
  });

  test('сьогоднішнє тренування — нуль днів', () => {
    expect(H.workoutSummary([{ date: TODAY }], TODAY).daysAgo).toBe(0);
  });

  test('тренувань ще не було', () => {
    expect(H.workoutSummary([], TODAY)).toEqual({ daysAgo: null, lastDate: null });
  });
});

describe('goalsSummary: серія і що без кроку', () => {
  const goal = (checkins, over = {}) => ({
    title: 'Ціль', status: 'active', checkins, blockers: [], ...over,
  });

  test('показує найдовшу серед активних, навіть якщо її вже відмічено', () => {
    const r = H.goalsSummary([
      goal(['2026-08-24', '2026-08-25', '2026-08-26']),  // 3, відмічено сьогодні
      goal(['2026-08-25']),                              // під загрозою
    ], TODAY, GoalStreak);
    expect(r.streak).toBe(3);
    // Відмічена сьогодні в «без кроку» не потрапляє.
    expect(r.pending).toBe(1);
    expect(r.active).toBe(2);
  });

  test('завершені цілі не рахуються активними', () => {
    const r = H.goalsSummary([goal([], { status: 'done' })], TODAY, GoalStreak);
    expect(r.active).toBe(0);
    expect(r.pending).toBe(0);
  });

  test('без GoalStreak повертає нулі, а не падає', () => {
    // Модуль сам реєструється в globalThis при require, тож щоб перевірити
    // запобіжник, його треба на час прибрати — інакше спрацює фолбек.
    const saved = globalThis.GoalStreak;
    delete globalThis.GoalStreak;
    try {
      expect(H.goalsSummary([goal([])], TODAY, null)).toEqual({ pending: 0, streak: 0, active: 0 });
    } finally {
      globalThis.GoalStreak = saved;
    }
  });

  test('явно переданий GoalStreak має пріоритет над глобальним', () => {
    expect(H.goalsSummary([goal(['2026-08-26'])], TODAY, GoalStreak).streak).toBe(1);
  });
});

describe('monthStart', () => {
  test('перше число того самого місяця', () => {
    expect(H.monthStart('2026-08-26')).toBe('2026-08-01');
    expect(H.monthStart('2026-01-01')).toBe('2026-01-01');
  });
});

// ---- Кільця на плитках ----
// Плитка мала показувати число; кільце показує його ще й у частці. Головне,
// що тут перевіряється, — коли кільця бути НЕ повинно: без знаменника воно
// показувало б відсоток невідомо від чого.

describe('tasksRing — скільки з сьогоднішнього закрито', () => {
  const T = '2026-08-27';

  test('рахує частку виконаного за сьогодні', () => {
    const r = HomeSummary.tasksRing([
      { dueDate: T, done: true }, { dueDate: T, done: true },
      { dueDate: T, done: false }, { dueDate: T, done: false },
    ], T);
    expect(r).toMatchObject({ done: 2, total: 4, pct: 50 });
  });

  test('невиконане з минулого в знаменник не входить — це інший день', () => {
    const r = HomeSummary.tasksRing([
      { dueDate: T, done: true },
      { dueDate: '2026-08-20', done: false },
    ], T);
    expect(r.total).toBe(1);
    expect(r.pct).toBe(100);
  });

  test('порожній день — нуль, а не ділення на нуль', () => {
    expect(HomeSummary.tasksRing([], T)).toMatchObject({ done: 0, total: 0, pct: 0 });
  });
});

describe('workoutToday — що сьогодні в залі', () => {
  const T = '2026-08-27';
  const w = (over = {}) => ({ date: T, name: '', exercises: [], ...over });

  test('запису на сьогодні немає — і це не нуль, а «немає»', () => {
    expect(HomeSummary.workoutToday([{ date: '2026-08-26', exercises: [] }], T)).toBeNull();
  });

  test('тренування наперед: вправи є, підходи порожні', () => {
    const r = HomeSummary.workoutToday([w({
      exercises: [{ sets: [{ weight: 0, reps: 0 }, { weight: 0, reps: 0 }] }],
    })], T);
    expect(r.planned).toBe(true);
    expect(r).toMatchObject({ setsDone: 0, setsTotal: 2, pct: 0, exercises: 1 });
  });

  test('половина підходів зроблена', () => {
    const r = HomeSummary.workoutToday([w({
      exercises: [{ sets: [{ weight: 60, reps: 8 }, { weight: 0, reps: 0 }] }],
    })], T);
    expect(r.planned).toBe(false);
    expect(r).toMatchObject({ setsDone: 1, setsTotal: 2, pct: 50 });
  });

  test('власна вага (0 кг, але є повторення) рахується зробленою', () => {
    const r = HomeSummary.workoutToday([w({
      exercises: [{ sets: [{ weight: 0, reps: 12 }] }],
    })], T);
    expect(r.setsDone).toBe(1);
  });
});

describe('featuredGoal — яку ціль показати', () => {
  const T = '2026-08-27';
  const g = (over = {}) => ({ title: 'ціль', status: 'active', milestones: [], ...over });

  test('без активних цілей показувати нічого', () => {
    expect(HomeSummary.featuredGoal([g({ status: 'done' })], T)).toBeNull();
  });

  test('виграє найближчий дедлайн', () => {
    const r = HomeSummary.featuredGoal([
      g({ title: 'далека', targetDate: '2026-12-01' }),
      g({ title: 'близька', targetDate: '2026-09-01' }),
    ], T);
    expect(r.title).toBe('близька');
    expect(r.daysLeft).toBe(5);
  });

  test('ціль без дедлайну поступається цілі з дедлайном', () => {
    const r = HomeSummary.featuredGoal([
      g({ title: 'без дати' }),
      g({ title: 'з датою', targetDate: '2026-11-01' }),
    ], T);
    expect(r.title).toBe('з датою');
  });

  test('серед цілей без дедлайну виграє та, де більше пройдено', () => {
    const ms = (done, total) => Array.from({ length: total }, (_, i) => ({ done: i < done }));
    const r = HomeSummary.featuredGoal([
      g({ title: 'початок', milestones: ms(1, 10) }),
      g({ title: 'майже', milestones: ms(9, 10) }),
    ], T);
    expect(r.title).toBe('майже');
    expect(r.pct).toBe(90);
  });

  test('прогрес рахується віхами — числової мети в застосунку немає', () => {
    expect(HomeSummary.goalPct({ milestones: [{ done: true }, { done: false }] })).toBe(50);
    expect(HomeSummary.goalPct({ milestones: [] })).toBe(0);
    // Число, що лишилось у старому документі, кільце не малює.
    expect(HomeSummary.goalPct({ targetValue: 4, currentValue: 3 })).toBe(0);
  });
});

describe('weekCalendar — календарний тиждень', () => {
  const WED = '2026-08-26';   // середа
  const SUN = '2026-08-30';   // неділя
  const MON = '2026-08-24';   // понеділок
  const task = (dueDate, done = false) => ({ title: 'x', dueDate, done });

  test('сім днів від понеділка до неділі', () => {
    const w = H.weekCalendar([], WED);
    expect(w.days).toHaveLength(7);
    expect(w.from).toBe(MON);
    expect(w.to).toBe(SUN);
  });

  test('тиждень календарний, а не «останні сім днів»', () => {
    // Середа стоїть третьою, а не останньою: це календар, і день має
    // лишатись там, де він у місяці.
    const w = H.weekCalendar([], WED);
    expect(w.days[2].date).toBe(WED);
    expect(w.days[2].today).toBe(true);
  });

  test('неділя не починає тиждень, хоч getDay() і вважає її нулем', () => {
    const w = H.weekCalendar([], SUN);
    expect(w.from).toBe(MON);
    expect(w.days[6].today).toBe(true);
  });

  test('у понеділок тиждень починається з нього ж', () => {
    const w = H.weekCalendar([], MON);
    expect(w.days[0].today).toBe(true);
    expect(w.to).toBe(SUN);
  });

  test('сьогодні позначене рівно один раз', () => {
    expect(H.weekCalendar([], WED).days.filter((d) => d.today)).toHaveLength(1);
  });

  test('число дня — саме число місяця', () => {
    expect(H.weekCalendar([], WED).days.map((d) => d.dayNum))
      .toEqual([24, 25, 26, 27, 28, 29, 30]);
  });

  test('день із завданням отримує крапку', () => {
    const w = H.weekCalendar([task('2026-08-25')], WED);
    expect(w.days[1].hasTasks).toBe(true);
    expect(w.days[0].hasTasks).toBe(false);
  });

  test('майбутній день теж отримує крапку — календар дивиться вперед', () => {
    const w = H.weekCalendar([task('2026-08-28')], WED);
    expect(w.days[4].hasTasks).toBe(true);
    expect(w.days[4].past).toBe(false);
  });

  test('день, де все закрито, відрізняється від дня, де ще є що робити', () => {
    const w = H.weekCalendar([
      task('2026-08-24', true),
      task('2026-08-25', true), task('2026-08-25', false),
    ], WED);
    expect(w.days[0].allDone).toBe(true);
    expect(w.days[1].allDone).toBe(false);
    expect(w.days[1].open).toBe(1);
  });

  test('завдання поза тижнем крапок не додають', () => {
    const w = H.weekCalendar([task('2026-08-01'), task('2026-09-15')], WED);
    expect(w.days.every((d) => !d.hasTasks)).toBe(true);
  });

  test('завдання без дати нікуди не потрапляє', () => {
    const w = H.weekCalendar([{ title: 'колись', done: false }], WED);
    expect(w.days.every((d) => !d.hasTasks)).toBe(true);
  });

  test('минуле й майбутнє розмічені відносно сьогодні', () => {
    const w = H.weekCalendar([], WED);
    expect(w.days.map((d) => d.past)).toEqual([true, true, false, false, false, false, false]);
  });
});

