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
