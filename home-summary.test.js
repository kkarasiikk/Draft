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

  test('розділяє відкрите, зроблене й прострочене', () => {
    expect(H.tasksSummary([
      task(TODAY, false), task(TODAY, false), task(TODAY, true),
      task('2026-08-20', false),          // борг
      task('2026-08-19', true),           // зроблене вчора — не борг
      task('2026-09-01', false),          // майбутнє
    ], TODAY)).toEqual({ open: 2, done: 1, overdue: 1 });
  });

  test('завдання без дати підсумок не чіпають', () => {
    expect(H.tasksSummary([task(null, false), {}], TODAY)).toEqual({ open: 0, done: 0, overdue: 0 });
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
