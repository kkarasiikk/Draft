// Чисті обчислення розділу цілей (goals/review.js).
//
// Перевіряємо не «функція щось повертає», а рішення, заради яких модуль
// написаний: якому місяцю належить ціль, скільки вона прожила, що лишається
// на екрані після її закриття і коли про дедлайн уже час озватись увечері.
const R = require('./review');

const TODAY = '2026-08-27';

/** Ціль із розумними значеннями за замовчуванням. */
function goal(over = {}) {
  return {
    id: 'g1', title: 'Пробігти 100 км', category: 'health', why: '',
    status: 'active', targetDate: '2026-12-31',
    milestones: [], checkins: [], journal: [],
    ...over,
  };
}

// Окремого поля «дедлайн» у формі немає: для місячної цілі він уже сказаний
// вибором місяця, і питати вдруге означало б просити повторити те саме.
describe('deadlineForMonth — дедлайн, виведений із місяця', () => {
  test('останній день місяця, а не перший наступного', () => {
    expect(R.deadlineForMonth('2026-08')).toBe('2026-08-31');
    expect(R.deadlineForMonth('2026-09')).toBe('2026-09-30');
  });

  test('лютий рахується правильно, і високосний теж', () => {
    expect(R.deadlineForMonth('2026-02')).toBe('2026-02-28');
    expect(R.deadlineForMonth('2024-02')).toBe('2024-02-29');
  });

  test('грудень не перескакує в наступний рік', () => {
    expect(R.deadlineForMonth('2026-12')).toBe('2026-12-31');
  });

  test('без місяця дедлайну немає — річна ціль це напрямок, а не строк', () => {
    expect(R.deadlineForMonth(null)).toBeNull();
    expect(R.deadlineForMonth('')).toBeNull();
    expect(R.deadlineForMonth('2026')).toBeNull();
    expect(R.deadlineForMonth('серпень')).toBeNull();
    expect(R.deadlineForMonth('2026-13')).toBeNull();
  });
});

describe('closedOn — коли ціль закрили', () => {
  test('активну ціль ніхто не закривав', () => {
    expect(R.closedOn(goal({ completedAt: '2026-08-01' }))).toBeNull();
  });

  test('архівна — не завершена: ретроспектива про досягнення, не про кинуте', () => {
    expect(R.closedOn(goal({ status: 'archived', completedAt: '2026-08-01' }))).toBeNull();
  });

  test('записана дата закриття важливіша за здогадки', () => {
    const g = goal({
      status: 'done', completedAt: '2026-08-10',
      checkins: ['2026-08-20'],
    });
    expect(R.closedOn(g)).toBe('2026-08-10');
  });

  test('ціль, закрита до появи поля, датується останнім слідом у даних', () => {
    const g = goal({
      status: 'done',
      checkins: ['2026-03-01'],
      progressLog: [{ date: '2026-04-02', delta: 1 }],
    });
    expect(R.closedOn(g)).toBe('2026-04-02');
  });

  test('ні дати, ні слідів — дати закриття немає, і вигадувати її не треба', () => {
    expect(R.closedOn(goal({ status: 'done' }))).toBeNull();
  });
});

describe('goalSpan — скільки ціль прожила', () => {
  test('рахує від заведення до закриття', () => {
    const g = goal({ status: 'done', completedAt: '2026-03-11' });
    expect(R.goalSpan(g, { startIso: '2026-01-01' }).days).toBe(69);
  });

  test('заведена й закрита того самого дня — нуль днів, а не один', () => {
    const g = goal({ status: 'done', completedAt: '2026-03-11' });
    expect(R.goalSpan(g, { startIso: '2026-03-11' }).days).toBe(0);
  });

  test('закриття раніше за заведення не дає відʼємної тривалості', () => {
    const g = goal({ status: 'done', completedAt: '2026-01-01' });
    expect(R.goalSpan(g, { startIso: '2026-03-11' }).days).toBe(0);
  });

  test('без дня заведення ціль лишається, але тривалості в неї немає', () => {
    const g = goal({ status: 'done', completedAt: '2026-03-11' });
    const sp = R.goalSpan(g, {});
    expect(sp.doneIso).toBe('2026-03-11');
    expect(sp.days).toBeNull();
  });

  test('незакрита ціль тривалості не має', () => {
    expect(R.goalSpan(goal(), { startIso: '2026-01-01' })).toBeNull();
  });
});

describe('retrospective — що закрито за період', () => {
  /** Завершена ціль із датою закриття. */
  const done = (id, completedAt, over = {}) =>
    goal({ id, status: 'done', completedAt, ...over });

  const starts = {
    g1: '2026-01-01', a: '2026-01-01', b: '2026-06-01', c: '2026-08-01',
    long: '2025-01-01',
  };
  const startIsoOf = (g) => starts[g.id] || null;

  test('бере лише завершені й лише за вікном', () => {
    const r = R.retrospective([
      done('a', '2026-08-20'),
      done('b', '2025-02-02'),      // задовго до вікна
      goal({ id: 'c' }),            // ще активна
      goal({ id: 'd', status: 'archived' }),
    ], TODAY, { days: 365, startIsoOf });
    expect(r.count).toBe(1);
    expect(r.items[0].id).toBe('a');
  });

  test('без вікна видно все, що колись закрито', () => {
    const r = R.retrospective([
      done('a', '2026-08-20'), done('b', '2021-02-02'),
    ], TODAY, { days: null, startIsoOf });
    expect(r.count).toBe(2);
    expect(r.from).toBeNull();
  });

  test('найсвіжіше зверху — ретроспективу читають з кінця', () => {
    const r = R.retrospective([
      done('a', '2026-03-01'), done('c', '2026-08-15'), done('b', '2026-06-20'),
    ], TODAY, { days: 365, startIsoOf });
    expect(r.items.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });

  test('дата закриття з майбутнього — це збій годинника, а не досягнення', () => {
    const r = R.retrospective([done('a', '2027-01-01')], TODAY, { days: 365, startIsoOf });
    expect(r.count).toBe(0);
  });

  test('медіана, а не середнє: одна довга ціль не розтягує решту', () => {
    // 9, 10 і 587 днів. Середнє сказало б «зазвичай пів року» — брехня про
    // дві цілі з трьох. Медіана каже 10 днів.
    const r = R.retrospective([
      done('a', '2026-01-10'),      // старт 2026-01-01 → 9
      done('b', '2026-06-11'),      // старт 2026-06-01 → 10
      done('long', '2026-08-11'),   // старт 2025-01-01 → 587
    ], TODAY, { days: 365, startIsoOf });
    expect(r.medianDays).toBe(10);
    expect(r.fastestDays).toBe(9);
    expect(r.slowestDays).toBe(587);
  });

  test('парна кількість — медіана між двома середніми', () => {
    const r = R.retrospective([
      done('a', '2026-01-10'),      // 9
      done('b', '2026-06-11'),      // 10
    ], TODAY, { days: 365, startIsoOf });
    expect(r.medianDays).toBe(10);   // (9 + 10) / 2, округлено
  });

  test('ціль без відомого початку рахується в кількості, але не в медіані', () => {
    const r = R.retrospective([
      done('a', '2026-01-10'),          // 9 днів
      done('zz', '2026-08-01'),         // початку немає
    ], TODAY, { days: 365, startIsoOf });
    expect(r.count).toBe(2);
    expect(r.items.find((i) => i.id === 'zz').days).toBeNull();
    expect(r.medianDays).toBe(9);
  });

  test('нічого не закрито — порожня ретроспектива без чисел', () => {
    const r = R.retrospective([goal()], TODAY, { days: 365, startIsoOf });
    expect(r.count).toBe(0);
    expect(r.medianDays).toBeNull();
  });

  test('горизонт їде разом із ціллю — картці більше нічого рахувати', () => {
    const r = R.retrospective([
      done('a', '2026-08-20', { horizon: 'month' }),
    ], TODAY, { days: 365, startIsoOf });
    expect(r.items[0].horizon).toBe('month');
  });

  test('старі цілі без horizon вважаються річними — як і всюди в модулі', () => {
    const r = R.retrospective([done('a', '2026-08-20')], TODAY, { days: 365, startIsoOf });
    expect(r.items[0].horizon).toBe('year');
  });
});

describe('monthKeyOf — якого місяця ця ціль', () => {
  test('записаний місяць беремо як є', () => {
    expect(R.monthKeyOf(goal({ month: '2026-03' }))).toBe('2026-03');
  });

  test('стара ціль без поля датується місяцем заведення', () => {
    expect(R.monthKeyOf(goal(), { startIso: '2026-05-14' })).toBe('2026-05');
  });

  test('зіпсоване значення не приймаємо за місяць', () => {
    expect(R.monthKeyOf(goal({ month: 'березень' }), {})).toBeNull();
    expect(R.monthKeyOf(goal({ month: '2026-3' }), {})).toBeNull();
  });

  test('ні поля, ні дня заведення — місяця немає', () => {
    expect(R.monthKeyOf(goal(), {})).toBeNull();
  });
});

describe('goalsOfMonth — що показує вкладка місяця', () => {
  const m = (id, month, over = {}) => goal({ id, horizon: 'month', month, ...over });
  const CUR = '2026-08';
  const opts = { currentMonth: CUR };

  test('річні цілі сюди не потрапляють', () => {
    const list = [m('a', CUR), goal({ id: 'y', horizon: 'year' })];
    expect(R.goalsOfMonth(list, CUR, opts).map((g) => g.id)).toEqual(['a']);
  });

  test('поточний місяць показує свої цілі', () => {
    // Червнева тут закрита — перенесення її не стосується (див. тест нижче).
    const list = [m('a', CUR), m('b', '2026-06', { status: 'done' })];
    expect(R.goalsOfMonth(list, CUR, opts).map((g) => g.id)).toEqual(['a']);
  });

  test('незакрита ціль з минулого не зникає першого числа', () => {
    const list = [m('a', CUR), m('old', '2026-07', { status: 'active' })];
    expect(R.goalsOfMonth(list, CUR, opts).map((g) => g.id)).toEqual(['a', 'old']);
  });

  // Ціль, закриту саме цього місяця, лишаємо перед очима: інакше «Виконано»
  // на липневій цілі змусило б її зникнути тієї ж миті, ніби дію не зарахували.
  test('закрита цього місяця лишається у видимому місяці, хоч заведена раніше', () => {
    const g = { id: 'g1', horizon: 'month', month: '2026-07', status: 'done', completedAt: '2026-08-14' };
    expect(R.goalsOfMonth([g], '2026-08', { currentMonth: '2026-08' }).map((x) => x.id)).toEqual(['g1']);
    // І в липні теж: це його місяць, і те, що там сталось, нікуди не поділось.
    expect(R.goalsOfMonth([g], '2026-07', { currentMonth: '2026-08' }).map((x) => x.id)).toEqual(['g1']);
    // А у вересні її вже немає — питання закрите в серпні.
    expect(R.goalsOfMonth([g], '2026-09', { currentMonth: '2026-09' })).toEqual([]);
  });

  test('закрита й архівна з минулого не переносяться — питання закрите', () => {
    const list = [
      m('done', '2026-07', { status: 'done' }),
      m('arch', '2026-07', { status: 'archived' }),
    ];
    expect(R.goalsOfMonth(list, CUR, opts)).toHaveLength(0);
  });

  test('ціль на паузі переноситься: її ще доведеться зняти з паузи', () => {
    expect(R.goalsOfMonth([m('p', '2026-07', { status: 'paused' })], CUR, opts)).toHaveLength(1);
  });

  test('у минулому місяці показуємо, що було саме тоді, без перенесень', () => {
    const list = [m('jul', '2026-07', { status: 'active' }), m('jun', '2026-06', { status: 'active' })];
    expect(R.goalsOfMonth(list, '2026-07', opts).map((g) => g.id)).toEqual(['jul']);
  });

  test('майбутній місяць нічого чужого не збирає', () => {
    const list = [m('a', CUR, { status: 'active' })];
    expect(R.goalsOfMonth(list, '2026-09', opts)).toHaveLength(0);
  });

  test('стара ціль без поля лягає в місяць свого заведення', () => {
    const old = goal({ id: 'o', horizon: 'month', status: 'done' });
    delete old.month;
    const withStart = { ...opts, startIsoOf: () => '2026-06-10' };
    expect(R.goalsOfMonth([old], '2026-06', withStart).map((g) => g.id)).toEqual(['o']);
    expect(R.goalsOfMonth([old], CUR, withStart)).toHaveLength(0);
  });

  test('ціль, місяць якої не визначити, показуємо в поточному, а не ховаємо', () => {
    const lost = goal({ id: 'l', horizon: 'month' });
    delete lost.month;
    expect(R.goalsOfMonth([lost], CUR, opts).map((g) => g.id)).toEqual(['l']);
    expect(R.goalsOfMonth([lost], '2026-07', opts)).toHaveLength(0);
  });
});

// Арифметика днів переїхала сюди з goals/streak.js разом із рештою того, що
// в тому файлі не було про серію. Перевірка та сама: місцевий день, не UTC.
describe('дати', () => {
  // `new Date('2026-08-20')` — це UTC-північ; на заході вона показує
  // 19 серпня. Тому парсимо вручну.
  test('shift не з’їжджає через пояси', () => {
    expect(R.shift('2026-03-01', -1)).toBe('2026-02-28');
    expect(R.shift('2026-12-31', 1)).toBe('2027-01-01');
  });
  test('daysBetween рахує повні доби', () => {
    expect(R.daysBetween('2026-08-13', '2026-08-20')).toBe(7);
  });
});

describe('deadlineWarnDays — «ось-ось» у кожної цілі своє', () => {
  const g = (start, target) => ({
    status: 'active', targetDate: target, checkins: [],
    __start: start,
  });
  const opts = { startIsoOf: (x) => x.__start };

  test('коротка ціль: підлога в три дні, а не частка від двох тижнів', () => {
    // 14 днів × 0.1 = 1.4 — попереджати за півтора дня безглуздо.
    expect(R.deadlineWarnDays(g('2026-08-20', '2026-09-03'), TODAY, opts)).toBe(3);
  });

  test('ціль на квартал попереджає приблизно за тиждень-півтора', () => {
    // 92 дні × 0.1 ≈ 9.
    expect(R.deadlineWarnDays(g('2026-06-01', '2026-09-01'), TODAY, opts)).toBe(9);
  });

  test('ціль на вісім місяців — не три дні співчуття, а майже місяць', () => {
    expect(R.deadlineWarnDays(g('2026-01-01', '2026-09-01'), TODAY, opts)).toBe(24);
  });

  test('багаторічна не гуде чотири місяці — стеля 30 днів', () => {
    expect(R.deadlineWarnDays(g('2024-01-01', '2027-01-01'), TODAY, opts)).toBe(30);
  });

  test('без дедлайну попереджати нема про що', () => {
    expect(R.deadlineWarnDays(g('2026-01-01', null), TODAY, opts)).toBe(3);
  });

  test('коли початок невідомий, лишається обережна підлога', () => {
    expect(R.deadlineWarnDays(g(null, '2026-12-31'), TODAY, {})).toBe(3);
  });

  // Запасний початок — найраніший слід у самих даних. Нових відміток більше
  // не буває, але в старих цілей вони лежать, і це чесна дата початку.
  test('запасний початок — найраніший слід у даних', () => {
    const old = { status: 'active', targetDate: '2026-09-01', checkins: ['2026-06-01', '2026-07-01'] };
    expect(R.deadlineWarnDays(old, TODAY, {})).toBe(9);
  });
});

// Вечірній підсумок про цілі. Серії в ньому більше немає — лишився єдиний
// привід озватись увечері: дедлайн, який ось-ось або вже минув.
describe('goalsDigest — про що цілі нагадують увечері', () => {
  const opts = { startIsoOf: (x) => x.start };

  test('довга ціль потрапляє у вечірній підсумок за 20 днів до кінця', () => {
    // Ціль на 8 місяців: поріг 24 дні, до дедлайну 20.
    const d = R.goalsDigest([{
      title: 'Вивчити польську', status: 'active', start: '2026-01-01',
      targetDate: '2026-09-16', checkins: [],
    }], TODAY, opts);
    expect(d.deadlineTitle).toBe('Вивчити польську');
    expect(d.deadline).toBe(20);
  });

  test('коротка ціль за 20 днів ще мовчить — там це не терміново', () => {
    const d = R.goalsDigest([{
      title: 'Здати звіт', status: 'active', start: '2026-08-20',
      targetDate: '2026-09-16', checkins: [],
    }], TODAY, opts);
    expect(d.deadline).toBeNull();
  });

  test('прострочений дедлайн — відʼємне число, і воно найважливіше', () => {
    const d = R.goalsDigest([
      goal({ title: 'Здати звіт', targetDate: '2026-08-20' }),
      goal({ title: 'Пробігти 100 км', targetDate: '2026-08-28' }),
    ], TODAY, { deadlineDays: 3 });
    expect(d.deadline).toBe(-7);
    expect(d.deadlineTitle).toBe('Здати звіт');
  });

  test('закрита ціль дедлайном не турбує', () => {
    const d = R.goalsDigest([
      goal({ title: 'Здати звіт', targetDate: '2026-08-28', status: 'done' }),
    ], TODAY, { deadlineDays: 3 });
    expect(d.deadline).toBeNull();
  });

  test('порожній список нічого не вигадує', () => {
    expect(R.goalsDigest([], TODAY)).toEqual({ deadline: null, deadlineTitle: null });
  });
});
