const { weekDaysOf, dayStats } = require('./now-queue');

// Вівторок, 18 серпня 2026.
const TODAY = '2026-08-18';
const TOMORROW = '2026-08-19';

const task = (over) => ({
  id: over.id || over.title, title: over.title || 'Завдання', done: false,
  dueDate: null, dueTime: null, priority: null, estimateMin: null, tags: [], subtasks: [],
  ...over,
});

describe('weekDaysOf', () => {
  test('повертає понеділок–неділя тижня, у який потрапляє дата', () => {
    // 18.08.2026 — вівторок.
    expect(weekDaysOf(TODAY)).toEqual([
      '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20',
      '2026-08-21', '2026-08-22', '2026-08-23',
    ]);
  });

  test('неділя належить своєму тижню, а не наступному', () => {
    expect(weekDaysOf('2026-08-23')[0]).toBe('2026-08-17');
    expect(weekDaysOf('2026-08-24')[0]).toBe('2026-08-24');
  });

  test('тиждень на межі місяця й року', () => {
    expect(weekDaysOf('2026-12-31')).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
      '2027-01-01', '2027-01-02', '2027-01-03',
    ]);
  });

  test('некоректна дата не ламає розрахунок', () => {
    expect(weekDaysOf('казна-що')).toHaveLength(7);
    expect(weekDaysOf(null)).toHaveLength(7);
  });
});

describe('dayStats', () => {
  const list = [
    task({ title: 'a', dueDate: TODAY, done: true }),
    task({ title: 'b', dueDate: TODAY }),
    task({ title: 'c', dueDate: TOMORROW, done: true }),
    task({ title: 'd' }),
  ];

  test('рахує завдання конкретної дати', () => {
    expect(dayStats(list, TODAY)).toEqual({ total: 2, done: 1, allDone: false });
  });

  test('позначає день, де все виконано', () => {
    expect(dayStats(list, TOMORROW)).toEqual({ total: 1, done: 1, allDone: true });
  });

  test('порожній день', () => {
    expect(dayStats(list, '2026-09-09')).toEqual({ total: 0, done: 0, allDone: false });
  });
});
