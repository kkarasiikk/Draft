// Темп цілі та щотижневий огляд (goals/review.js).
//
// Перевіряємо не «функція щось повертає», а рішення, заради яких модуль
// написаний: коли застосунок має право сказати «не встигаєш», коли зобовʼязаний
// промовчати, і про що саме питати на огляді.
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

describe('weekMovement — що зрушило', () => {
  test('рахує чекіни й записи щоденника за вікно', () => {
    const m = R.weekMovement(goal({
      checkins: ['2026-08-26', '2026-08-24', '2026-07-01'],
      journal: [
        { id: 'j1', text: 'нотатка', createdAt: new Date('2026-08-26T10:00:00').getTime() },
        { id: 'j2', text: 'стара', createdAt: new Date('2026-01-02T10:00:00').getTime() },
      ],
    }), TODAY);

    expect(m.checkins).toBe(2);
    expect(m.journal).toBe(1);
    expect(m.moved).toBe(true);
  });

  test('тиждень без жодного руху — і про це кажемо чесно', () => {
    const m = R.weekMovement(goal({ checkins: ['2026-06-01'] }), TODAY);
    expect(m.moved).toBe(false);
    expect(m.checkins).toBe(0);
  });

  test('вікно включає сьогодні й не залазить у майбутнє', () => {
    const m = R.weekMovement(goal({
      checkins: [TODAY, '2026-09-30'],
    }), TODAY);
    expect(m.checkins).toBe(1);
  });

  // Запис у щоденнику — це слід, але не рух: людина могла прийти й написати,
  // що нічого не вийшло. Рухом рахуються тільки відмітки.
  test('сам лише запис у щоденнику рухом не вважається', () => {
    const m = R.weekMovement(goal({
      journal: [{ id: 'j1', text: 'нічого', createdAt: new Date('2026-08-26T10:00:00').getTime() }],
    }), TODAY);
    expect(m.journal).toBe(1);
    expect(m.moved).toBe(false);
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

describe('lapse — довга перерва і момент повернення', () => {
  const start = { startIso: '2026-01-01' };

  test('свіжий рух — жодної перерви', () => {
    expect(R.lapse(goal({ checkins: ['2026-08-25'] }), TODAY, start)).toBeNull();
  });

  test('тиждень без кроку — це ще не перерва, це живе життя', () => {
    expect(R.lapse(goal({ checkins: ['2026-08-21'] }), TODAY, start)).toBeNull();
  });

  test('три тижні мовчання — перерва, і про неї варто сказати', () => {
    const l = R.lapse(goal({ checkins: ['2026-08-06'] }), TODAY, start);
    expect(l.days).toBe(21);
    expect(l.lastIso).toBe('2026-08-06');
    expect(l.everMoved).toBe(true);
  });

  test('слідом вважається будь-який рух, не лише відмітка', () => {
    expect(R.lapse(goal({ progressLog: [{ date: '2026-08-25', delta: 3 }] }), TODAY, start)).toBeNull();
  });

  test('«не вийшло» — теж слід: людина приходила й чесно відповіла', () => {
    expect(R.lapse(goal({
      blockers: [{ date: '2026-08-24', reason: 'Втома' }],
    }), TODAY, start)).toBeNull();
  });

  test('береться найсвіжіший слід, а не перший-ліпший', () => {
    expect(R.lapse(goal({
      checkins: ['2026-05-01'],
      progressLog: [{ date: '2026-08-26', delta: 1 }],
    }), TODAY, start)).toBeNull();
  });

  test('ціль без жодного руху рахується від заведення', () => {
    const l = R.lapse(goal(), TODAY, { startIso: '2026-07-01' });
    expect(l.days).toBe(57);
    expect(l.everMoved).toBe(false);
  });

  test('щойно заведена ціль покинутою не виглядає', () => {
    expect(R.lapse(goal(), TODAY, { startIso: '2026-08-25' })).toBeNull();
  });

  test('пауза мовчить: про неї свідомо не питають', () => {
    expect(R.lapse(goal({ status: 'paused', checkins: ['2026-01-05'] }), TODAY, start)).toBeNull();
  });

  test('закриту й архівну не турбуємо', () => {
    expect(R.lapse(goal({ status: 'done' }), TODAY, start)).toBeNull();
    expect(R.lapse(goal({ status: 'archived' }), TODAY, start)).toBeNull();
  });

  test('відмітка з майбутнього перерву не скасовує', () => {
    const l = R.lapse(goal({ checkins: ['2026-08-06', '2027-01-01'] }), TODAY, start);
    expect(l.days).toBe(21);
  });
});

describe('lapse: перезапуск — це вже повернення', () => {
  test('після перезапуску ціль не лишається покинутою через стару відмітку', () => {
    // Останній рух був 30 днів тому, але вчора людина натиснула «почати заново».
    expect(R.lapse(goal({ checkins: ['2026-07-28'] }), TODAY, { startIso: '2026-08-26' })).toBeNull();
  });

  test('якщо після перезапуску знову тиша — перерва рахується від нього', () => {
    const l = R.lapse(goal({ checkins: ['2026-01-01'] }), TODAY, { startIso: '2026-08-01' });
    expect(l.days).toBe(26);
    // Рух колись усе-таки був — це не та сама ситуація, що ціль без кроків.
    expect(l.everMoved).toBe(true);
  });

  test('свіжий рух після перезапуску важливіший за сам перезапуск', () => {
    expect(R.lapse(goal({ checkins: ['2026-08-25'] }), TODAY, { startIso: '2026-08-01' })).toBeNull();
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
