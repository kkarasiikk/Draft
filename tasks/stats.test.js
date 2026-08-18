const {
  completedIso, carryOver, doneOn, historyDays, streakDays, personalNorm, statsSummary,
} = require('./stats');

// Вівторок, 18 серпня 2026.
const TODAY = '2026-08-18';

const at = (iso, hh = 12) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hh, 0, 0);
};

const task = (over) => ({
  id: over.id || over.title, title: over.title || 'Завдання', done: false,
  dueDate: null, dueTime: null, priority: null, estimateMin: null,
  completedAt: null, tags: [], subtasks: [],
  ...over,
});
// Виконане завдання: done + момент виконання.
const doneTask = (title, iso, extra) => task({ title, done: true, completedAt: at(iso), ...extra });

const titles = (list) => list.map((t) => t.title);

describe('completedIso: різні формати completedAt', () => {
  test('Date', () => {
    expect(completedIso(doneTask('a', TODAY))).toBe(TODAY);
  });

  test('Timestamp з Firestore (.toDate)', () => {
    const ts = { toDate: () => at(TODAY) };
    expect(completedIso(task({ title: 'a', done: true, completedAt: ts }))).toBe(TODAY);
  });

  test('{seconds} з офлайн-кешу', () => {
    const secs = { seconds: Math.floor(at(TODAY).getTime() / 1000) };
    expect(completedIso(task({ title: 'a', done: true, completedAt: secs }))).toBe(TODAY);
  });

  test('невиконане або без часу виконання -> null', () => {
    expect(completedIso(task({ title: 'a' }))).toBeNull();
    expect(completedIso(task({ title: 'a', done: true }))).toBeNull();
    expect(completedIso(null)).toBeNull();
  });

  test('зіпсоване значення не ламає розрахунок', () => {
    expect(completedIso(task({ title: 'a', done: true, completedAt: { toDate: () => { throw new Error('x'); } } }))).toBeNull();
    expect(completedIso(task({ title: 'a', done: true, completedAt: 'казна-що' }))).toBeNull();
  });

  test('пізній вечір лишається тим самим днем (місцевий час, не UTC)', () => {
    expect(completedIso(doneTask('a', TODAY, { completedAt: at(TODAY, 23) }))).toBe(TODAY);
  });
});

describe('carryOver: що треба розібрати', () => {
  const list = [
    task({ title: 'Вчорашнє', dueDate: '2026-08-17' }),
    task({ title: 'Тижневої давнини', dueDate: '2026-08-11' }),
    task({ title: 'Сьогоднішнє', dueDate: TODAY }),
    task({ title: 'Завтрашнє', dueDate: '2026-08-19' }),
    task({ title: 'Без дати' }),
    doneTask('Виконане вчора', '2026-08-17', { dueDate: '2026-08-17' }),
  ];

  test('лише невиконані з минулих днів, найдавніші вгорі', () => {
    expect(titles(carryOver(list, { today: TODAY }))).toEqual(['Тижневої давнини', 'Вчорашнє']);
  });

  test('за однакової дати вирішує пріоритет', () => {
    const same = [
      task({ title: 'Звичайне', dueDate: '2026-08-17' }),
      task({ title: 'Важливе', dueDate: '2026-08-17', priority: 'high' }),
    ];
    expect(titles(carryOver(same, { today: TODAY }))).toEqual(['Важливе', 'Звичайне']);
  });

  test('порожній або некоректний список', () => {
    expect(carryOver([], { today: TODAY })).toEqual([]);
    expect(carryOver(null, { today: TODAY })).toEqual([]);
    expect(carryOver([null], { today: TODAY })).toEqual([]);
  });
});

describe('doneOn / historyDays', () => {
  const list = [
    doneTask('a', TODAY), doneTask('b', TODAY),
    doneTask('c', '2026-08-17'),
    doneTask('d', '2026-08-01'),
    task({ title: 'e', dueDate: TODAY }),
  ];

  test('рахує закриті саме за цей день', () => {
    expect(doneOn(list, TODAY)).toBe(2);
    expect(doneOn(list, '2026-08-17')).toBe(1);
    expect(doneOn(list, '2026-08-16')).toBe(0);
  });

  test('ряд днів: від найдавнішого до сьогодні, з нулями', () => {
    const h = historyDays(list, { today: TODAY, days: 3 });
    expect(h).toEqual([
      { iso: '2026-08-16', count: 0 },
      { iso: '2026-08-17', count: 1 },
      { iso: '2026-08-18', count: 2 },
    ]);
  });

  test('ряд перетинає межу місяця', () => {
    const h = historyDays(list, { today: '2026-09-02', days: 3 });
    expect(h.map((d) => d.iso)).toEqual(['2026-08-31', '2026-09-01', '2026-09-02']);
  });
});

describe('streakDays', () => {
  test('дні поспіль, рахуючи сьогодні', () => {
    const list = [doneTask('a', TODAY), doneTask('b', '2026-08-17'), doneTask('c', '2026-08-16')];
    expect(streakDays(list, { today: TODAY })).toEqual({ days: 3, includesToday: true });
  });

  test('зранку, коли сьогодні ще нічого не зроблено, серія не рветься', () => {
    const list = [doneTask('b', '2026-08-17'), doneTask('c', '2026-08-16')];
    expect(streakDays(list, { today: TODAY })).toEqual({ days: 2, includesToday: false });
  });

  test('пропущений день обриває серію', () => {
    const list = [doneTask('a', TODAY), doneTask('c', '2026-08-16')];
    expect(streakDays(list, { today: TODAY })).toEqual({ days: 1, includesToday: true });
  });

  test('кілька справ за день — це один день серії', () => {
    const list = [doneTask('a', TODAY), doneTask('b', TODAY, { id: 'b' })];
    expect(streakDays(list, { today: TODAY }).days).toBe(1);
  });

  test('порожня історія', () => {
    expect(streakDays([], { today: TODAY })).toEqual({ days: 0, includesToday: false });
  });
});

describe('personalNorm', () => {
  // Допоміжне: n закритих справ у день iso.
  const dayWith = (iso, n) => Array.from({ length: n }, (_, i) => doneTask(iso + '#' + i, iso));

  test('медіана по днях, у які людина щось закривала', () => {
    const list = [
      ...dayWith('2026-08-17', 3), ...dayWith('2026-08-16', 4), ...dayWith('2026-08-15', 5),
      ...dayWith('2026-08-14', 4), ...dayWith('2026-08-13', 4),
    ];
    expect(personalNorm(list, { today: TODAY })).toBe(4);
  });

  test('порожні дні не занижують норму', () => {
    // П'ять активних днів по 4 справи, між ними — тиждень нічого.
    const list = [
      ...dayWith('2026-08-17', 4), ...dayWith('2026-08-16', 4), ...dayWith('2026-08-10', 4),
      ...dayWith('2026-08-09', 4), ...dayWith('2026-08-03', 4),
    ];
    expect(personalNorm(list, { today: TODAY })).toBe(4);
  });

  test('один героїчний день не задирає планку', () => {
    const list = [
      ...dayWith('2026-08-17', 2), ...dayWith('2026-08-16', 2), ...dayWith('2026-08-15', 20),
      ...dayWith('2026-08-14', 2), ...dayWith('2026-08-13', 3),
    ];
    expect(personalNorm(list, { today: TODAY })).toBe(2);
  });

  test('поки історії мало — норми немає', () => {
    const list = [...dayWith('2026-08-17', 4), ...dayWith('2026-08-16', 4)];
    expect(personalNorm(list, { today: TODAY })).toBeNull();
    expect(personalNorm([], { today: TODAY })).toBeNull();
  });

  test('старіше за вікно не враховується', () => {
    const old = [];
    for (let i = 30; i < 40; i++) old.push(...dayWith('2026-07-' + String(i - 20).padStart(2, '0'), 9));
    expect(personalNorm(old, { today: TODAY })).toBeNull();
  });
});

describe('statsSummary', () => {
  const list = [
    doneTask('t1', TODAY), doneTask('t2', TODAY),
    doneTask('y1', '2026-08-17'),
    // Понеділок цього тижня — 17-е, тож неділя 16-го вже інший тиждень.
    doneTask('s1', '2026-08-16'),
    task({ title: 'борг', dueDate: '2026-08-10' }),
  ];

  test('сьогодні, тиждень з понеділка, борг і серія', () => {
    const s = statsSummary(list, { today: TODAY });
    expect(s.todayDone).toBe(2);
    expect(s.weekDone).toBe(3);
    expect(s.totalDone).toBe(4);
    expect(s.streak).toBe(3);
    expect(s.streakIncludesToday).toBe(true);
    expect(s.overdue).toBe(1);
  });

  test('норми немає, поки історії мало', () => {
    expect(statsSummary(list, { today: TODAY }).norm).toBeNull();
  });

  test('порожній список не ламає підсумок', () => {
    expect(statsSummary([], { today: TODAY })).toEqual({
      todayDone: 0, weekDone: 0, totalDone: 0, streak: 0,
      streakIncludesToday: false, norm: null, overdue: 0,
    });
  });
});
