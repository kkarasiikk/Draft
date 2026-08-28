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

/** Журнал прогресу: рівний темп по `perDay` щодня, `days` днів поспіль,
 *  останній запис — `endIso`. */
function evenLog(perDay, days, endIso = TODAY) {
  const out = [];
  const end = new Date(endIso + 'T00:00:00');
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), delta: perDay });
  }
  return out;
}

describe('progressPct — чим міряємо шлях', () => {
  test('числова мета важливіша за віхи', () => {
    const p = R.progressPct(goal({
      targetValue: 100, currentValue: 40,
      milestones: [{ id: 'm1', title: 'a', done: true }],
    }));
    expect(p.kind).toBe('value');
    expect(p.pct).toBe(40);
    expect(p.remaining).toBe(60);
  });

  test('без числа рахуються віхи', () => {
    const p = R.progressPct(goal({
      milestones: [
        { id: 'm1', title: 'a', done: true },
        { id: 'm2', title: 'b', done: false },
      ],
    }));
    expect(p.kind).toBe('milestones');
    expect(p.pct).toBe(50);
  });

  test('ні числа, ні віх — міряти нічим', () => {
    expect(R.progressPct(goal())).toBeNull();
  });

  test('перебір понад мету не дає більше за 100%', () => {
    expect(R.progressPct(goal({ targetValue: 10, currentValue: 25 })).pct).toBe(100);
  });
});

describe('pace — чи встигаєш', () => {
  test('без дедлайну темп ні з чим порівнювати', () => {
    expect(R.pace(goal({ targetDate: null, targetValue: 10 }), TODAY)).toBeNull();
  });

  test('закриту й архівну ціль не оцінюємо', () => {
    expect(R.pace(goal({ status: 'done', targetValue: 10 }), TODAY)).toBeNull();
    expect(R.pace(goal({ status: 'archived', targetValue: 10 }), TODAY)).toBeNull();
  });

  test('ціль на паузі оцінюємо: її ще доведеться зняти з паузи', () => {
    const p = R.pace(goal({ status: 'paused', targetValue: 100, currentValue: 10 }), TODAY);
    expect(p).not.toBeNull();
  });

  test('поки історії мало — застосунок мовчить, а не вгадує', () => {
    // Два записи, але за три дні: це збіг, а не темп.
    const p = R.pace(goal({
      targetValue: 100, currentValue: 6,
      progressLog: evenLog(3, 3),
    }), TODAY);
    expect(p.enough).toBe(false);
    expect(p.projectedDate).toBeNull();
  });

  test('одного запису мало навіть за довгий проміжок', () => {
    const p = R.pace(goal({
      targetValue: 100, currentValue: 5,
      progressLog: [{ date: '2026-07-01', delta: 5 }],
    }), TODAY);
    expect(p.enough).toBe(false);
  });

  test('рівний темп, якого вистачає — «в графіку»', () => {
    // 1 км/день протягом 30 днів; лишилось 70 км і 126 днів до дедлайну.
    const p = R.pace(goal({
      targetValue: 100, currentValue: 30,
      progressLog: evenLog(1, 30),
    }), TODAY);
    expect(p.enough).toBe(true);
    expect(p.ratePerDay).toBeCloseTo(1, 1);
    expect(p.verdict).not.toBe('behind');
    expect(p.diffDays).toBeLessThanOrEqual(0);
  });

  test('надто повільний темп — «не встигаєш», із датою прогнозу', () => {
    // 0.1 км/день: на 90 км, що лишились, потрібно ~900 днів.
    const p = R.pace(goal({
      targetValue: 100, currentValue: 10,
      progressLog: evenLog(0.1, 100),
    }), TODAY);
    expect(p.enough).toBe(true);
    expect(p.verdict).toBe('behind');
    expect(p.diffDays).toBeGreaterThan(0);
    expect(p.projectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Прогноз мусить лежати ПІСЛЯ дедлайну — інакше вердикт суперечив би даті.
    expect(p.projectedDate > '2026-12-31').toBe(true);
  });

  test('скільки треба на день, щоб устигнути — рахується й без історії', () => {
    const p = R.pace(goal({ targetValue: 100, currentValue: 0 }), TODAY);
    // 100 одиниць на 126 днів.
    expect(p.requiredPerDay).toBeCloseTo(100 / 126, 3);
  });

  test('прострочене — це факт, а не прогноз', () => {
    const p = R.pace(goal({
      targetDate: '2026-08-01', targetValue: 100, currentValue: 20,
      progressLog: evenLog(1, 20),
    }), TODAY);
    expect(p.verdict).toBe('overdue');
    expect(p.overdue).toBe(true);
    expect(p.daysLeft).toBeLessThan(0);
  });

  test('мета досягнута — прогнозувати нема чого', () => {
    const p = R.pace(goal({ targetValue: 100, currentValue: 100 }), TODAY);
    expect(p.verdict).toBe('ahead');
  });

  test('записи є, а руху немає — це теж відповідь', () => {
    const p = R.pace(goal({
      targetValue: 100, currentValue: 0,
      progressLog: evenLog(0, 30),
    }), TODAY);
    expect(p.enough).toBe(true);
    expect(p.ratePerDay).toBe(0);
    expect(p.verdict).toBe('behind');
  });
});

describe('pace для віх — без жодних нових даних', () => {
  const milestones = (doneCount, total) =>
    Array.from({ length: total }, (_, i) => ({ id: 'm' + i, title: 'крок', done: i < doneCount }));

  test('часу минуло майже все, зроблено мало — «не встигаєш»', () => {
    const p = R.pace(goal({
      targetValue: null, targetDate: '2026-09-05',
      milestones: milestones(1, 10),
    }), TODAY, { startIso: '2026-01-01' });
    expect(p.kind).toBe('milestones');
    expect(p.verdict).toBe('behind');
    expect(p.timePct).toBeGreaterThan(p.pct);
  });

  test('зроблено більше, ніж минуло часу — «випереджаєш»', () => {
    const p = R.pace(goal({
      targetValue: null, targetDate: '2026-12-31',
      milestones: milestones(8, 10),
    }), TODAY, { startIso: '2026-08-01' });
    expect(p.verdict).toBe('ahead');
  });

  test('прогрес іде врівень із часом — «в графіку»', () => {
    // Половина шляху, половина часу.
    const p = R.pace(goal({
      targetValue: null, targetDate: '2026-10-26',
      milestones: milestones(5, 10),
    }), TODAY, { startIso: '2026-06-27' });
    expect(p.verdict).toBe('onTrack');
  });

  test('щойно заведена ціль не оголошується такою, що випереджає графік', () => {
    // Часу минуло 0%, а віха вже закрита — це не привід хвалити.
    const p = R.pace(goal({
      targetValue: null, targetDate: '2026-12-31',
      milestones: milestones(1, 3),
    }), TODAY, { startIso: TODAY });
    expect(p.verdict).toBe('unknown');
  });

  test('невеликий відрив не робить людину боржником', () => {
    // Часу 55%, зроблено 45% — це ще не «відстаєш».
    const p = R.pace(goal({
      targetValue: null,
      milestones: milestones(45, 100),
      targetDate: '2026-11-06',
    }), TODAY, { startIso: '2026-06-01' });
    expect(p.verdict).toBe('onTrack');
  });
});

describe('weekMovement — що зрушило', () => {
  test('рахує чекіни, віхи, прогрес і записи щоденника за вікно', () => {
    const m = R.weekMovement(goal({
      checkins: ['2026-08-26', '2026-08-24', '2026-07-01'],
      milestones: [
        { id: 'm1', title: 'a', done: true, doneAt: '2026-08-25' },
        { id: 'm2', title: 'b', done: true, doneAt: '2026-05-01' },
      ],
      progressLog: [{ date: '2026-08-25', delta: 4 }, { date: '2026-01-01', delta: 99 }],
      journal: [
        { id: 'j1', text: 'нотатка', createdAt: new Date('2026-08-26T10:00:00').getTime() },
        { id: 'j2', text: 'стара', createdAt: new Date('2026-01-02T10:00:00').getTime() },
      ],
    }), TODAY);

    expect(m.checkins).toBe(2);
    expect(m.milestonesDone).toBe(1);
    expect(m.progressDelta).toBe(4);
    expect(m.journal).toBe(1);
    expect(m.moved).toBe(true);
  });

  test('тиждень без жодного руху — і про це кажемо чесно', () => {
    const m = R.weekMovement(goal({ checkins: ['2026-06-01'] }), TODAY);
    expect(m.moved).toBe(false);
    expect(m.checkins).toBe(0);
    expect(m.progressDelta).toBe(0);
  });

  test('вікно включає сьогодні й не залазить у майбутнє', () => {
    const m = R.weekMovement(goal({
      checkins: [TODAY, '2026-09-30'],
    }), TODAY);
    expect(m.checkins).toBe(1);
  });

  test('віха без doneAt у тижневий рух не рахується — дати виконання немає', () => {
    const m = R.weekMovement(goal({
      milestones: [{ id: 'm1', title: 'a', done: true }],
    }), TODAY);
    expect(m.milestonesDone).toBe(0);
  });
});

describe('reviewQueue — про що час спитати', () => {
  test('ціль, яку не оглядали жодного разу, потрапляє в чергу', () => {
    expect(R.reviewQueue([goal()], TODAY)).toHaveLength(1);
  });

  test('оглянуту цього тижня не перепитуємо', () => {
    expect(R.reviewQueue([goal({ reviewedAt: '2026-08-24' })], TODAY)).toHaveLength(0);
  });

  test('через тиждень питання актуальне знову', () => {
    expect(R.reviewQueue([goal({ reviewedAt: '2026-08-20' })], TODAY)).toHaveLength(1);
  });

  test('закриті й архівні не питаємо — там нема чого вирішувати', () => {
    const list = [goal({ status: 'done' }), goal({ status: 'archived' })];
    expect(R.reviewQueue(list, TODAY)).toHaveLength(0);
  });

  test('паузу питаємо: інакше вона тихо стає архівом', () => {
    expect(R.reviewQueue([goal({ status: 'paused' })], TODAY)).toHaveLength(1);
  });
});

describe('reviewDigest — що написати на банері', () => {
  test('рахує, скільки чекає й скільки з них не рухалось', () => {
    const moving = goal({ id: 'a', checkins: ['2026-08-26'] });
    const stalled = goal({ id: 'b' });
    const d = R.reviewDigest([moving, stalled], TODAY);
    expect(d.pending).toBe(2);
    expect(d.stalled).toBe(1);
  });

  test('порожній список — порожній банер', () => {
    expect(R.reviewDigest([], TODAY)).toEqual({ pending: 0, stalled: 0 });
  });
});

describe('reviewItem — один рядок огляду', () => {
  test('несе назву, «навіщо», рух і темп', () => {
    const item = R.reviewItem(goal({
      why: 'щоб бігти півмарафон',
      targetValue: 100, currentValue: 30,
      progressLog: evenLog(1, 30),
    }), TODAY);
    expect(item.title).toBe('Пробігти 100 км');
    expect(item.why).toBe('щоб бігти півмарафон');
    expect(item.movement.moved).toBe(true);
    expect(item.pace.enough).toBe(true);
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
      milestones: [{ id: 'm1', title: 'a', done: true, doneAt: '2026-05-09' }],
    });
    expect(R.closedOn(g)).toBe('2026-05-09');
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

  test('горизонт і прогрес їдуть разом із ціллю — картці більше нічого рахувати', () => {
    const r = R.retrospective([
      done('a', '2026-08-20', { horizon: 'month', targetValue: 100, currentValue: 100 }),
    ], TODAY, { days: 365, startIsoOf });
    expect(r.items[0].horizon).toBe('month');
    expect(r.items[0].progress.pct).toBe(100);
  });

  test('старі цілі без horizon вважаються річними — як і всюди в модулі', () => {
    const r = R.retrospective([done('a', '2026-08-20')], TODAY, { days: 365, startIsoOf });
    expect(r.items[0].horizon).toBe('year');
  });
});
