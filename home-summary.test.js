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

  // План на наступний тиждень записують тими самими документами, що й
  // зроблене. Найсвіжішим тоді ставав план — і виходило «-4 дні тому».
  test('запис майбутнім днем не рахується за останнє тренування', () => {
    const r = H.workoutSummary([{ date: '2026-08-23' }, { date: '2026-08-30' }], TODAY);
    expect(r).toEqual({ daysAgo: 3, lastDate: '2026-08-23' });
  });

  test('самі лише плани попереду — це «тренувань ще не було»', () => {
    // Не «0 днів тому» й не відʼємне число: жодного тренування ще не сталося.
    expect(H.workoutSummary([{ date: '2026-08-30' }], TODAY))
      .toEqual({ daysAgo: null, lastDate: null });
  });

  test('сьогоднішнє майбутнім не вважається', () => {
    expect(H.workoutSummary([{ date: TODAY }, { date: '2026-09-05' }], TODAY))
      .toEqual({ daysAgo: 0, lastDate: TODAY });
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


describe('Якір: який період малюємо, коли календар погортали', () => {
  const WED = '2026-08-26';   // середа
  const task = (dueDate, done = false) => ({ title: 'x', dueDate, done });

  test('без якоря — той самий тиждень, що й був: сьогоднішній', () => {
    expect(H.weekCalendar([], WED)).toEqual(H.weekCalendar([], WED, WED));
  });

  test('якір веде тиждень, а «сьогодні» лишається справжнім', () => {
    // Гортання НЕ підмінює сьогодні: інакше в сусідньому тижні виділеним
    // виявився б не той день, і сторінка брехала б про дату.
    const w = H.weekCalendar([], WED, '2026-09-02');
    expect(w.from).toBe('2026-08-31');
    expect(w.to).toBe('2026-09-06');
    expect(w.days.some((d) => d.today)).toBe(false);
    expect(w.days.every((d) => d.past === (d.date < WED))).toBe(true);
  });

  test('крапки в погортаному тижні — з тих самих завдань', () => {
    const w = H.weekCalendar([task('2026-09-03')], WED, '2026-09-02');
    expect(w.days.find((d) => d.date === '2026-09-03').hasTasks).toBe(true);
  });

  test('якір веде й місяць', () => {
    const m = H.monthCalendar([], '2026-08-26', '2026-10-15');
    expect(m.days.filter((d) => !d.otherMonth)).toHaveLength(31);
    expect(m.days.some((d) => d.today)).toBe(false);
  });

  test('shiftDays гортає тиждень і переходить через межу місяця', () => {
    expect(H.shiftDays('2026-08-26', 7)).toBe('2026-09-02');
    expect(H.shiftDays('2026-09-02', -7)).toBe('2026-08-26');
    expect(H.shiftDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  test('shiftMonths тримається першого числа, а не «того ж числа»', () => {
    // 31 січня + 1 місяць мусить дати лютий. Наївний setMonth дав би 2 чи
    // 3 березня — і гортання перескакувало б цілий місяць.
    expect(H.shiftMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(H.shiftMonths('2026-03-15', -1)).toBe('2026-02-01');
    expect(H.shiftMonths('2026-12-10', 1)).toBe('2027-01-01');
  });
});

describe('dayStrip — смуга днів, що гортається', () => {
  const WED = '2026-08-26';   // середа
  const task = (dueDate, done = false) => ({ title: 'x', dueDate, done });

  test('починається саме з того дня, який попросили, а не з понеділка', () => {
    // У цьому вся різниця з weekCalendar: смуга гортається по днях, і
    // підганяти початок до понеділка означало б не показати того, до чого
    // людина догорнула.
    const st = H.dayStrip([], WED, WED, 7);
    expect(st.from).toBe(WED);
    expect(st.to).toBe('2026-09-01');
    expect(st.days).toHaveLength(7);
  });

  test('дні йдуть поспіль і переходять через межу місяця', () => {
    const st = H.dayStrip([], WED, '2026-08-30', 4);
    expect(st.days.map((d) => d.date)).toEqual([
      '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
    ]);
    expect(st.days.map((d) => d.dayNum)).toEqual([30, 31, 1, 2]);
  });

  test('сьогодні лишається сьогодні, хоч би з якого дня смуга починалась', () => {
    const st = H.dayStrip([], WED, '2026-08-24', 7);
    expect(st.days.filter((d) => d.today).map((d) => d.date)).toEqual([WED]);
    expect(st.days.every((d) => d.past === (d.date < WED))).toBe(true);
  });

  test('крапки — з тих самих завдань, що й у решті календаря', () => {
    const st = H.dayStrip([task('2026-08-28'), task('2026-08-29', true)], WED, WED, 7);
    const at = (iso) => st.days.find((d) => d.date === iso);
    expect(at('2026-08-28').hasTasks).toBe(true);
    expect(at('2026-08-28').allDone).toBe(false);
    expect(at('2026-08-29').allDone).toBe(true);
    expect(at('2026-08-27').hasTasks).toBe(false);
  });

  test('хвостів сусіднього місяця тут не буває — смуга не сітка', () => {
    const st = H.dayStrip([], WED, '2026-08-30', 4);
    expect(st.days.every((d) => d.otherMonth === false)).toBe(true);
  });
});

describe('monthCalendar — місяць повними тижнями', () => {
  // Вересень 2026 починається у вівторок і закінчується в середу, тож у
  // сітці є хвости обох сусідніх місяців.
  const SEP = '2026-09-02';
  const task = (dueDate, done = false) => ({ title: 'x', dueDate, done });

  test('сітка починається в понеділок і закінчується в неділю', () => {
    const m = H.monthCalendar([], SEP);
    expect(m.from).toBe('2026-08-31');
    expect(m.to).toBe('2026-10-04');
    expect(m.days.length % 7).toBe(0);
  });

  test('усі числа місяця на місці — жодного пропуску', () => {
    const m = H.monthCalendar([], SEP);
    const own = m.days.filter((d) => !d.otherMonth).map((d) => d.dayNum);
    expect(own).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  test('хвости сусідніх місяців позначені, а не викинуті', () => {
    // Викинути їх означало б почати перший тиждень із дірки, і число стояло
    // б не під своїм днем тижня.
    const m = H.monthCalendar([], SEP);
    expect(m.days[0].otherMonth).toBe(true);
    expect(m.days[0].dayNum).toBe(31);
    expect(m.days[1].otherMonth).toBe(false);
    expect(m.days[m.days.length - 1].otherMonth).toBe(true);
  });

  test('крапка означає те саме, що й у тижні', () => {
    const m = H.monthCalendar([task('2026-09-10'), task('2026-09-11', true)], SEP);
    const byDate = {};
    m.days.forEach((d) => { byDate[d.date] = d; });
    expect(byDate['2026-09-10'].hasTasks).toBe(true);
    expect(byDate['2026-09-10'].allDone).toBe(false);
    expect(byDate['2026-09-11'].allDone).toBe(true);
    expect(byDate['2026-09-12'].hasTasks).toBe(false);
  });

  test('сьогодні одне, і воно в цьому місяці', () => {
    const m = H.monthCalendar([], SEP);
    const today = m.days.filter((d) => d.today);
    expect(today).toHaveLength(1);
    expect(today[0].date).toBe(SEP);
  });

  test('місяць, що починається в понеділок, не тягне зайвого тижня', () => {
    // Червень 2026 починається в понеділок — хвоста попереду немає.
    const m = H.monthCalendar([], '2026-06-15');
    expect(m.from).toBe('2026-06-01');
    expect(m.days[0].otherMonth).toBe(false);
  });

  test('лютий невисокосного року вміщається рівно у чотири тижні', () => {
    // 2027-02-01 — понеділок, 28 днів: рідкісний випадок, коли сітка
    // збігається з місяцем день у день.
    const m = H.monthCalendar([], '2027-02-10');
    expect(m.days).toHaveLength(28);
    expect(m.days.every((d) => !d.otherMonth)).toBe(true);
  });
});

describe('pickGoal — одна ціль на плитці', () => {
  const goals = [{ title: 'Перша' }, { title: 'Друга' }, { title: 'Третя' }];

  test('бере ціль за випадковим числом, а не завжди першу', () => {
    expect(H.pickGoal(goals, 0).title).toBe('Перша');
    expect(H.pickGoal(goals, 0.5).title).toBe('Друга');
    expect(H.pickGoal(goals, 0.99).title).toBe('Третя');
  });

  test('одиниця на межі не виходить за список', () => {
    // Math.random() одиниці не дає, але параметром прийти може.
    expect(H.pickGoal(goals, 1).title).toBe('Третя');
  });

  test('цілі без назви не показуються — підпис був би порожнім', () => {
    expect(H.pickGoal([{ title: '' }, { title: 'Є назва' }], 0).title).toBe('Є назва');
  });

  test('порожній список — нема чого показувати', () => {
    expect(H.pickGoal([], 0.5)).toBeNull();
    expect(H.pickGoal(null, 0.5)).toBeNull();
  });

  test('без числа працює від Math.random і завжди повертає ціль зі списку', () => {
    const titles = goals.map((g) => g.title);
    for (let i = 0; i < 50; i++) expect(titles).toContain(H.pickGoal(goals).title);
  });
});

describe('nextDayKind — як назвати день наступного тренування', () => {
  const T = '2026-09-02';

  test('завтра й післязавтра — словами', () => {
    expect(H.nextDayKind('2026-09-03', T)).toBe('tomorrow');
    expect(H.nextDayKind('2026-09-04', T)).toBe('dayAfter');
  });

  test('далі — датою: «через сім днів» треба рахувати в голові', () => {
    expect(H.nextDayKind('2026-09-05', T)).toBe('date');
    expect(H.nextDayKind('2026-10-01', T)).toBe('date');
  });

  test('сьогодні й минуле — не «наступне»', () => {
    expect(H.nextDayKind(T, T)).toBeNull();
    expect(H.nextDayKind('2026-09-01', T)).toBeNull();
  });

  test('без дати нема відповіді', () => {
    expect(H.nextDayKind(null, T)).toBeNull();
    expect(H.nextDayKind(undefined, T)).toBeNull();
  });

  test('межа місяця рахується днями, а не числами', () => {
    expect(H.nextDayKind('2026-10-01', '2026-09-30')).toBe('tomorrow');
  });
});
