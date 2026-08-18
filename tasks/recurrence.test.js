const { nextOccurrence, normalizeRecurrence } = require('./recurrence');

// Вівторок, 18 серпня 2026.
const TODAY = '2026-08-18';

describe('nextOccurrence: щодня / кожні N днів', () => {
  test('щодня -> наступний день', () => {
    expect(nextOccurrence({ type: 'daily' }, { dueDate: TODAY, today: TODAY })).toBe('2026-08-19');
  });

  test('кожні 3 дні від запланованої дати', () => {
    expect(nextOccurrence({ type: 'daily', interval: 3 }, { dueDate: TODAY, today: TODAY })).toBe('2026-08-21');
  });

  test('пропущені повтори прокручуються в майбутнє, а не лишаються в минулому', () => {
    // Щоденне завдання не робили з 1 серпня: наступне має бути 19-м, а не 2-м.
    expect(nextOccurrence({ type: 'daily' }, { dueDate: '2026-08-01', today: TODAY })).toBe('2026-08-19');
  });

  test('кожні 7 днів після виконання (anchor: completion)', () => {
    // Прибирання планувалось на 1 серпня, зробили 18-го -> наступне через тиждень.
    expect(nextOccurrence({ type: 'daily', interval: 7, anchor: 'completion' }, { dueDate: '2026-08-01', today: TODAY }))
      .toBe('2026-08-25');
  });
});

describe('nextOccurrence: щотижня', () => {
  test('кілька днів тижня — найближчий наступний', () => {
    // Пн/Ср/Пт; 18.08 — вівторок, тож наступне — середа 19-го.
    expect(nextOccurrence({ type: 'weekly', weekdays: [1, 3, 5] }, { dueDate: TODAY, today: TODAY })).toBe('2026-08-19');
    // Від середи -> п'ятниця.
    expect(nextOccurrence({ type: 'weekly', weekdays: [1, 3, 5] }, { dueDate: '2026-08-19', today: '2026-08-19' })).toBe('2026-08-21');
    // Від п'ятниці -> понеділок наступного тижня.
    expect(nextOccurrence({ type: 'weekly', weekdays: [1, 3, 5] }, { dueDate: '2026-08-21', today: '2026-08-21' })).toBe('2026-08-24');
  });

  test('без переліку днів повторюється в той самий день тижня', () => {
    expect(nextOccurrence({ type: 'weekly' }, { dueDate: TODAY, today: TODAY })).toBe('2026-08-25');
  });

  test('пропущений тиждень не дає дати в минулому', () => {
    // Щосуботи, останній раз планувалось 1 серпня (субота).
    const next = nextOccurrence({ type: 'weekly', weekdays: [6] }, { dueDate: '2026-08-01', today: TODAY });
    expect(next).toBe('2026-08-22');
  });
});

describe('nextOccurrence: щомісяця', () => {
  test('те саме число наступного місяця', () => {
    expect(nextOccurrence({ type: 'monthly', day: 1 }, { dueDate: '2026-08-01', today: TODAY })).toBe('2026-09-01');
  });

  test('31 число клампиться до останнього дня коротшого місяця', () => {
    expect(nextOccurrence({ type: 'monthly', day: 31 }, { dueDate: '2026-01-31', today: '2026-01-31' })).toBe('2026-02-28');
  });

  test('кожні 3 місяці', () => {
    expect(nextOccurrence({ type: 'monthly', interval: 3, day: 10 }, { dueDate: '2026-08-10', today: TODAY })).toBe('2026-11-10');
  });
});

describe('nextOccurrence: некоректні дані', () => {
  test('без правила або з невідомим типом -> null', () => {
    expect(nextOccurrence(null, { today: TODAY })).toBeNull();
    expect(nextOccurrence({ type: 'yearly' }, { today: TODAY })).toBeNull();
    expect(nextOccurrence({}, { today: TODAY })).toBeNull();
  });

  test('без dueDate рахуємо від сьогодні', () => {
    expect(nextOccurrence({ type: 'daily' }, { today: TODAY })).toBe('2026-08-19');
  });

  test('сміттєвий інтервал не ламає розрахунок', () => {
    expect(nextOccurrence({ type: 'daily', interval: 0 }, { dueDate: TODAY, today: TODAY })).toBe('2026-08-19');
    expect(nextOccurrence({ type: 'daily', interval: -5 }, { dueDate: TODAY, today: TODAY })).toBe('2026-08-19');
    expect(nextOccurrence({ type: 'daily', interval: 'багато' }, { dueDate: TODAY, today: TODAY })).toBe('2026-08-19');
  });
});

describe('normalizeRecurrence', () => {
  test('прибирає дублікати й некоректні дні тижня', () => {
    expect(normalizeRecurrence({ type: 'weekly', weekdays: [3, 1, 3, 9, 0] }).weekdays).toEqual([1, 3]);
  });

  test('anchor за замовчуванням — розклад', () => {
    expect(normalizeRecurrence({ type: 'daily' }).anchor).toBe('schedule');
    expect(normalizeRecurrence({ type: 'daily', anchor: 'completion' }).anchor).toBe('completion');
  });

  test('інтервал обмежений зверху', () => {
    expect(normalizeRecurrence({ type: 'daily', interval: 10000 }).interval).toBe(365);
  });
});
