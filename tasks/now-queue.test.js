const { nowQueue, daySummary, weekDaysOf, dayStats } = require('./now-queue');

// Вівторок, 18 серпня 2026, 14:30 — «зараз» для всіх тестів.
const NOW = new Date(2026, 7, 18, 14, 30, 0);
const TODAY = '2026-08-18';
const YESTERDAY = '2026-08-17';
const TOMORROW = '2026-08-19';

const task = (over) => ({
  id: over.id || over.title, title: over.title || 'Завдання', done: false,
  dueDate: null, dueTime: null, priority: null, estimateMin: null, tags: [], subtasks: [],
  ...over,
});

const titles = (list) => list.map((t) => t.title);

describe('nowQueue: порядок', () => {
  // Раніше вчорашнє йшло першим — «воно вже підвело». Через це картка
  // місяцями показувала найстаріший борг замість того, що варто зробити
  // зараз. Невиконане лишається у своєму дні, як і завтрашнє в своєму.
  test('вчорашнє в «зараз» не потрапляє — так само, як завтрашнє', () => {
    const q = nowQueue([
      task({ title: 'Сьогодні', dueDate: TODAY }),
      task({ title: 'Вчорашнє', dueDate: YESTERDAY }),
      task({ title: 'Завтрашнє', dueDate: TOMORROW }),
    ], { now: NOW });
    expect(titles(q)).toEqual(['Сьогодні']);
  });

  // Без дати — запас на випадок порожнього дня. Вчорашнє його не заміняє:
  // інакше «зараз» знову підсовувало б минуле.
  test('порожній сьогоднішній день падає на «без дати», а не на вчорашнє', () => {
    const q = nowQueue([
      task({ title: 'Вчорашнє', dueDate: YESTERDAY }),
      task({ title: 'Без дати' }),
    ], { now: NOW });
    expect(titles(q)).toEqual(['Без дати']);
  });

  test('час, що вже настав, важливіший за час попереду', () => {
    const q = nowQueue([
      task({ title: 'О 16:00', dueDate: TODAY, dueTime: '16:00' }),
      task({ title: 'О 12:00', dueDate: TODAY, dueTime: '12:00' }),
    ], { now: NOW });
    expect(titles(q)).toEqual(['О 12:00', 'О 16:00']);
  });

  test('серед майбутнього сьогодні найближче за часом — вище, навіть за нижчого пріоритету', () => {
    const q = nowQueue([
      task({ title: 'Пізніше і важливе', dueDate: TODAY, dueTime: '20:00', priority: 'high' }),
      task({ title: 'Скоро', dueDate: TODAY, dueTime: '15:00' }),
    ], { now: NOW });
    expect(titles(q)).toEqual(['Скоро', 'Пізніше і важливе']);
  });

  test('завдання з часом іде поперед завдання без часу', () => {
    const q = nowQueue([
      task({ title: 'Без часу', dueDate: TODAY, priority: 'high' }),
      task({ title: 'З часом', dueDate: TODAY, dueTime: '18:00' }),
    ], { now: NOW });
    expect(titles(q)).toEqual(['З часом', 'Без часу']);
  });

  test('у межах групи вирішує пріоритет, потім коротша оцінка', () => {
    const q = nowQueue([
      task({ title: 'Довге важливе', dueDate: TODAY, priority: 'high', estimateMin: 120 }),
      task({ title: 'Коротке важливе', dueDate: TODAY, priority: 'high', estimateMin: 10 }),
      task({ title: 'Звичайне', dueDate: TODAY }),
    ], { now: NOW });
    expect(titles(q)).toEqual(['Коротке важливе', 'Довге важливе', 'Звичайне']);
  });

  test('завдання без оцінки не випереджає оцінене всередині групи', () => {
    const q = nowQueue([
      task({ title: 'Без оцінки', dueDate: TODAY }),
      task({ title: 'З оцінкою', dueDate: TODAY, estimateMin: 45 }),
    ], { now: NOW });
    expect(titles(q)).toEqual(['З оцінкою', 'Без оцінки']);
  });
});

describe('nowQueue: що взагалі потрапляє в чергу', () => {
  test('майбутні дати не потрапляють', () => {
    const q = nowQueue([task({ title: 'Завтра', dueDate: TOMORROW })], { now: NOW });
    expect(q).toEqual([]);
  });

  test('виконані не потрапляють', () => {
    const q = nowQueue([task({ title: 'Готове', dueDate: TODAY, done: true })], { now: NOW });
    expect(q).toEqual([]);
  });

  test('без дати підхоплюється, лише коли на сьогодні нічого не лишилось', () => {
    const withToday = nowQueue([
      task({ title: 'Сьогодні', dueDate: TODAY }),
      task({ title: 'Колись' }),
    ], { now: NOW });
    expect(titles(withToday)).toEqual(['Сьогодні']);

    const emptyToday = nowQueue([
      task({ title: 'Сьогодні', dueDate: TODAY, done: true }),
      task({ title: 'Колись' }),
    ], { now: NOW });
    expect(titles(emptyToday)).toEqual(['Колись']);
  });

  test('порожній або некоректний список не ламає розрахунок', () => {
    expect(nowQueue([], { now: NOW })).toEqual([]);
    expect(nowQueue(null, { now: NOW })).toEqual([]);
    expect(nowQueue([null, undefined], { now: NOW })).toEqual([]);
  });
});

describe('daySummary', () => {
  test('рахує виконані й загальну кількість саме за сьогодні', () => {
    const s = daySummary([
      task({ title: 'a', dueDate: TODAY, done: true }),
      task({ title: 'b', dueDate: TODAY }),
      task({ title: 'c', dueDate: TOMORROW }),
      task({ title: 'd' }),
    ], { now: NOW });
    expect(s.doneCount).toBe(1);
    expect(s.totalCount).toBe(2);
  });

  test('лишок часу рахується до 22:00', () => {
    // 14:30 -> до 22:00 лишилось 7 год 30 хв.
    expect(daySummary([], { now: NOW }).freeMin).toBe(450);
    expect(daySummary([], { now: new Date(2026, 7, 18, 23, 0) }).freeMin).toBe(0);
  });

  test('перевантаження: сума оцінок більша за вільний час', () => {
    const s = daySummary([
      task({ title: 'a', dueDate: TODAY, estimateMin: 300 }),
      task({ title: 'b', dueDate: TODAY, estimateMin: 200 }),
    ], { now: NOW });
    expect(s.remainingMin).toBe(500);
    expect(s.overloaded).toBe(true);
  });

  test('без жодної оцінки перевантаження не оголошуємо', () => {
    const s = daySummary([task({ title: 'a', dueDate: TODAY })], { now: NOW });
    expect(s.remainingMin).toBe(0);
    expect(s.overloaded).toBe(false);
  });

  test('виконані не додаються до залишку часу', () => {
    const s = daySummary([
      task({ title: 'a', dueDate: TODAY, estimateMin: 600, done: true }),
      task({ title: 'b', dueDate: TODAY, estimateMin: 30 }),
    ], { now: NOW });
    expect(s.remainingMin).toBe(30);
    expect(s.overloaded).toBe(false);
  });

  // Попередження за кількістю («заплановано 4, а зазвичай закриваєш 3»)
  // прибрано на прохання — воно бурчало мало не щодня. Підсумок дня про
  // норму більше не знає взагалі: скільки б завдань не стояло на день,
  // сам по собі їх список приводом для попередження не є.
  test('великий список на день сам по собі попередженням не стає', () => {
    const list = Array.from({ length: 20 }, (_, i) => task({ title: 'x' + i, dueDate: TODAY }));
    const s = daySummary(list, { now: NOW, norm: 3 });
    expect(s.leftCount).toBe(20);
    expect(s.overloaded).toBe(false);
    expect(s.overCapacity).toBeUndefined();
    expect(s.norm).toBeUndefined();
  });

  test('невиконане з минулого навантаженням на сьогодні не стає', () => {
    const s = daySummary([
      task({ title: 'старе', dueDate: YESTERDAY, estimateMin: 500 }),
      task({ title: 'сьогодні', dueDate: TODAY, estimateMin: 30 }),
    ], { now: NOW });
    expect(s.totalCount).toBe(1);
    expect(s.remainingMin).toBe(30);
    expect(s.overdueCount).toBeUndefined();
  });
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
