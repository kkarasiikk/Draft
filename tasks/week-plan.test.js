// Плани на тиждень: що показує вкладка й що з нею робить кінець тижня.
const W = require('./week-plan');

// 2026-08-31 — понеділок, 2026-09-06 — неділя.
const THIS_WEEK = '2026-08-31';
const PREV_WEEK = '2026-08-24';

const plan = (weekStart, over = {}) => ({ title: 'Пункт', weekStart, done: false, ...over });

describe('межі тижня', () => {
  test('понеділок лишається понеділком, решта днів до нього й зводиться', () => {
    expect(W.weekStartOf('2026-08-31')).toBe(THIS_WEEK);
    expect(W.weekStartOf('2026-09-02')).toBe(THIS_WEEK);
    expect(W.weekStartOf('2026-09-06')).toBe(THIS_WEEK);
  });

  test('неділя не починає тиждень, хоч getDay() і вважає її нулем', () => {
    // Класична пастка: у JS неділя — 0, тож наївний зсув відкидав би її на
    // тиждень назад разом з усіма її пунктами.
    expect(W.weekStartOf('2026-09-06')).toBe(THIS_WEEK);
    expect(W.weekStartOf('2026-09-07')).toBe('2026-09-07');
  });

  test('гортання тижнями переходить через межу місяця й року', () => {
    expect(W.shiftWeeks(THIS_WEEK, -1)).toBe(PREV_WEEK);
    expect(W.shiftWeeks(THIS_WEEK, 1)).toBe('2026-09-07');
    expect(W.shiftWeeks('2026-12-28', 1)).toBe('2027-01-04');
  });

  test('кінець тижня — неділя, і саме він іде в підпис', () => {
    expect(W.weekEndOf(THIS_WEEK)).toBe('2026-09-06');
    expect(W.weekEndOf('2026-12-28')).toBe('2027-01-03');
  });
});

describe('нотатки — не плани', () => {
  const note = (weekStart, over = {}) => ({ title: 'Думка', weekStart, kind: 'note', ...over });
  const opts = { currentWeekStart: THIS_WEEK };

  test('нотатка не потрапляє в плани — її не виконують, а читають', () => {
    const list = W.plansOfWeek([plan(THIS_WEEK), note(THIS_WEEK)], THIS_WEEK, opts);
    expect(list).toHaveLength(1);
    expect(W.isNote(list[0])).toBe(false);
  });

  test('нотатки того ж тижня — окремим списком', () => {
    const list = W.notesOfWeek([plan(THIS_WEEK), note(THIS_WEEK)], THIS_WEEK);
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('note');
  });

  test('нотатка НЕ переїжджає в новий тиждень', () => {
    // Незроблений план — борг, а незабута думка — запис на своєму місці.
    // Інакше вкладка поступово стала б стрічкою всього написаного за рік.
    expect(W.notesOfWeek([note(PREV_WEEK)], THIS_WEEK)).toHaveLength(0);
    expect(W.notesOfWeek([note(PREV_WEEK)], PREV_WEEK)).toHaveLength(1);
  });

  test('нотатка не тягнеться в плани навіть із минулого тижня', () => {
    expect(W.plansOfWeek([note(PREV_WEEK)], THIS_WEEK, opts)).toHaveLength(0);
  });

  test('звичайне завдання нотаткою не вважається', () => {
    expect(W.isNote(plan(THIS_WEEK))).toBe(false);
    expect(W.isNote(null)).toBe(false);
    expect(W.isNote({ kind: 'plan' })).toBe(false);
  });
});

describe('що показує вкладка тижня', () => {
  const opts = { currentWeekStart: THIS_WEEK };

  test('денні завдання сюди не потрапляють — у них немає тижня', () => {
    const day = { title: 'Денне', dueDate: '2026-09-02', done: false };
    expect(W.plansOfWeek([day, plan(THIS_WEEK)], THIS_WEEK, opts)).toHaveLength(1);
  });

  test('незакритий пункт минулого тижня переїжджає в поточний', () => {
    // Лишившись у своєму тижні, він тихо зникав би з очей щопонеділка — а це
    // саме те, про що треба памʼятати найбільше.
    const list = W.plansOfWeek([plan(PREV_WEEK)], THIS_WEEK, opts);
    expect(list).toHaveLength(1);
    expect(W.isCarried(list[0], THIS_WEEK)).toBe(true);
  });

  test('виконане лишається там, де його зробили', () => {
    expect(W.plansOfWeek([plan(PREV_WEEK, { done: true })], THIS_WEEK, opts)).toHaveLength(0);
    expect(W.plansOfWeek([plan(PREV_WEEK, { done: true })], PREV_WEEK, opts)).toHaveLength(1);
  });

  test('назад гортаємо — бачимо той тиждень, а не звалище незробленого', () => {
    // PREV_WEEK не поточний, тож борги з іще давніших тижнів сюди не лізуть.
    const list = W.plansOfWeek([plan('2026-08-17'), plan(PREV_WEEK)], PREV_WEEK, opts);
    expect(list.map((p) => p.weekStart)).toEqual([PREV_WEEK]);
  });

  test('майбутній тиждень не тягне до себе нічого з минулого', () => {
    const next = '2026-09-07';
    expect(W.plansOfWeek([plan(PREV_WEEK), plan(THIS_WEEK)], next, opts)).toHaveLength(0);
  });

  test('пункт свого тижня не вважається переїханим', () => {
    expect(W.isCarried(plan(THIS_WEEK), THIS_WEEK)).toBe(false);
    expect(W.isCarried({ title: 'Без тижня' }, THIS_WEEK)).toBe(false);
  });

  test('порожній вхід не падає', () => {
    expect(W.plansOfWeek(null, THIS_WEEK, opts)).toEqual([]);
    expect(W.plansOfWeek([null, undefined], THIS_WEEK, opts)).toEqual([]);
  });
});
