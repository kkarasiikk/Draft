const { nowQueue, daySummary } = require('./now-queue');

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
  test('прострочене йде поперед сьогоднішнього', () => {
    const q = nowQueue([
      task({ title: 'Сьогодні', dueDate: TODAY }),
      task({ title: 'Вчорашнє', dueDate: YESTERDAY }),
    ], { now: NOW });
    expect(titles(q)).toEqual(['Вчорашнє', 'Сьогодні']);
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

  test('прострочене рахується окремо, а не як навантаження на сьогодні', () => {
    const s = daySummary([
      task({ title: 'старе', dueDate: YESTERDAY, estimateMin: 500 }),
      task({ title: 'сьогодні', dueDate: TODAY, estimateMin: 30 }),
    ], { now: NOW });
    expect(s.overdueCount).toBe(1);
    expect(s.totalCount).toBe(1);
    expect(s.remainingMin).toBe(30);
  });
});
