const { parseQuickTask } = require('./quick-parse');

// Вівторок, 18 серпня 2026 — фіксована «зараз» для всіх тестів, щоб
// відносні дати («завтра», «у п'ятницю») були передбачуваними.
const NOW = new Date(2026, 7, 18, 10, 0, 0);
const parse = (text) => parseQuickTask(text, { now: NOW });

describe('parseQuickTask: дати', () => {
  test('«завтра» -> наступний день', () => {
    expect(parse('Купити молоко завтра').dueDate).toBe('2026-08-19');
  });

  test('«сьогодні» / «today» / «dziś» / «сегодня»', () => {
    ['Дзвінок сьогодні', 'Call today', 'Telefon dziś', 'Звонок сегодня'].forEach((s) => {
      expect(parse(s).dueDate).toBe('2026-08-18');
    });
  });

  test('«післязавтра» -> +2 дні', () => {
    expect(parse('Здати звіт післязавтра').dueDate).toBe('2026-08-20');
  });

  test('апостроф у будь-якому написанні (клавіатури ставлять різні символи)', () => {
    ["Зустріч у п'ятницю", 'Зустріч у п\u2019ятницю', 'Зустріч у п\u02BCятницю'].forEach((s) => {
      const r = parse(s);
      expect(r.dueDate).toBe('2026-08-21');
      expect(r.title).toBe('Зустріч');
    });
  });

  test('день тижня -> найближчий майбутній', () => {
    // 18.08.2026 — вівторок, тож п'ятниця це 21-е.
    expect(parse("Зустріч у п'ятницю").dueDate).toBe('2026-08-21');
    // Той самий день тижня означає наступний тиждень, а не сьогодні.
    expect(parse('Планерка у вівторок').dueDate).toBe('2026-08-25');
  });

  test('«через N днів» / «in N days»', () => {
    expect(parse('Передзвонити через 3 дні').dueDate).toBe('2026-08-21');
    expect(parse('Follow up in 10 days').dueDate).toBe('2026-08-28');
  });

  test('числова дата, рік не вказано', () => {
    expect(parse('Оплатити 25.12').dueDate).toBe('2026-12-25');
  });

  test('числова дата, що вже минула цього року -> наступний рік', () => {
    expect(parse('Оплатити 05.01').dueDate).toBe('2027-01-05');
  });

  test('явний рік і ISO-формат', () => {
    expect(parse('Візит 03.09.2027').dueDate).toBe('2027-09-03');
    expect(parse('Реліз 2026-11-30').dueDate).toBe('2026-11-30');
  });

  test('неіснуюча дата не розбирається як дата', () => {
    const r = parse('Купити 45.99 чогось');
    expect(r.dueDate).toBeNull();
  });
});

describe('parseQuickTask: час', () => {
  test('«о 18» -> 18:00 і дата за замовчуванням сьогодні', () => {
    const r = parse('Подзвонити о 18');
    expect(r.dueTime).toBe('18:00');
    expect(r.dueDate).toBe('2026-08-18');
  });

  test('формат HH:MM без маркера', () => {
    expect(parse('Дзвінок 9:30').dueTime).toBe('09:30');
  });

  test('«at 6pm» / «в 9 утра» / «o 20»', () => {
    expect(parse('Call mom at 6pm').dueTime).toBe('18:00');
    expect(parse('Позвонить маме в 9 утра').dueTime).toBe('09:00');
    expect(parse('Spotkanie o 20').dueTime).toBe('20:00');
  });

  test('«6 вечора» без прийменника', () => {
    expect(parse('Тренування 6 вечора').dueTime).toBe('18:00');
  });

  test('12 ранку -> 00:00, 12 дня -> 12:00', () => {
    expect(parse('Подія 12 ранку').dueTime).toBe('00:00');
    expect(parse('Подія 12 дня').dueTime).toBe('12:00');
  });

  test('числа в назві не стають часом', () => {
    const r = parse('Купити 2 л молока');
    expect(r.dueTime).toBeNull();
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe('Купити 2 л молока');
  });
});

describe('parseQuickTask: те, що більше не розбирається', () => {
  // Пріоритет, теги, оцінка часу й повторення прибрані із завдань — тож
  // рядок їх більше не з'їдає. Це не дрібниця: доки розбір лишався, «#дім»
  // зникав із назви й не з'являвся ніде більше.
  test('позначки пріоритету лишаються в назві', () => {
    expect(parse('Терміновий дзвінок !1').title).toBe('Терміновий дзвінок !1');
    expect(parse('Зробити !!!').title).toBe('Зробити !!!');
  });

  test('#тег лишається в назві', () => {
    expect(parse('Полити квіти #дім').title).toBe('Полити квіти #дім');
  });

  test('тривалість лишається в назві', () => {
    expect(parse('Медитація 10 хв').title).toBe('Медитація 10 хв');
    expect(parse('Розтяжка ~15хв').title).toBe('Розтяжка ~15хв');
  });

  test('слова повторення не роблять із завдання серію, але й не калічать назву', () => {
    expect(parse('Пробіжка щодня').title).toBe('Пробіжка щодня');
    // «кожної суботи» -> звичайне завдання на найближчу суботу.
    const r = parse('Прибирання кожної суботи');
    expect(r.title).toBe('Прибирання');
    expect(r.dueDate).toBe('2026-08-22');
  });

  test('розбір повертає рівно три поля', () => {
    expect(Object.keys(parse('Подумати про відпустку')).sort())
      .toEqual(['dueDate', 'dueTime', 'title']);
  });
});

describe('parseQuickTask: назва', () => {
  test('усе разом', () => {
    const r = parse('Купити молоко завтра о 18');
    expect(r).toEqual({
      title: 'Купити молоко',
      dueDate: '2026-08-19',
      dueTime: '18:00',
    });
  });

  test('англійською', () => {
    const r = parse('Call the dentist tomorrow at 9:30');
    expect(r).toEqual({
      title: 'Call the dentist',
      dueDate: '2026-08-19',
      dueTime: '09:30',
    });
  });

  test('польською', () => {
    const r = parse('Kupić mleko jutro o 18');
    expect(r.title).toBe('Kupić mleko');
    expect(r.dueDate).toBe('2026-08-19');
    expect(r.dueTime).toBe('18:00');
  });

  test('«висячий» прийменник прибирається', () => {
    expect(parse('Зустріч на завтра').title).toBe('Зустріч');
    expect(parse('Прибирання у суботу').title).toBe('Прибирання');
  });

  test('назва без жодних маркерів лишається як є', () => {
    const r = parse('Подумати про відпустку');
    expect(r).toEqual({
      title: 'Подумати про відпустку',
      dueDate: null,
      dueTime: null,
    });
  });

  test('порожній або нетекстовий ввід не ламає розбір', () => {
    expect(parse('').title).toBe('');
    expect(parseQuickTask(null, { now: NOW }).title).toBe('');
    expect(parse('   ').title).toBe('');
  });
});
