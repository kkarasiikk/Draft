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

describe('parseQuickTask: пріоритет, теги, оцінка часу', () => {
  test('!1 / !2 / !3', () => {
    expect(parse('Терміновий дзвінок !1').priority).toBe('high');
    expect(parse('Звичайна справа !2').priority).toBe('medium');
    expect(parse('Колись потім !3').priority).toBe('low');
  });

  test('!!! / !! / !', () => {
    expect(parse('Здати звіт !!!').priority).toBe('high');
    expect(parse('Здати звіт !!').priority).toBe('medium');
    expect(parse('Здати звіт !').priority).toBe('high');
  });

  test('словами, різними мовами', () => {
    expect(parse('Терміново оплатити рахунок').priority).toBe('high');
    expect(parse('Pilne spotkanie').priority).toBe('high');
    expect(parse('Urgent call').priority).toBe('high');
  });

  test('теги через #, без дублікатів', () => {
    const r = parse('Купити подарунок #дім #сімʼя #дім');
    expect(r.tags).toEqual(['дім', 'сімʼя']);
    expect(r.title).toBe('Купити подарунок');
  });

  test('оцінка часу у хвилинах і годинах', () => {
    expect(parse('Прибрати ~30хв').estimateMin).toBe(30);
    expect(parse('Презентація 2 год').estimateMin).toBe(120);
    expect(parse('Робота 1,5 год').estimateMin).toBe(90);
    expect(parse('Дзвінок ~15m').estimateMin).toBe(15);
  });

  test('години і хвилини разом', () => {
    expect(parse('Прибирання 1 год 30 хв').estimateMin).toBe(90);
  });

  test('нереалістична оцінка відкидається', () => {
    expect(parse('Проєкт 50 годин').estimateMin).toBeNull();
  });

  test('час доби не плутається з оцінкою тривалості', () => {
    const r = parse('Зустріч о 14 год ~40хв');
    expect(r.dueTime).toBe('14:00');
    expect(r.estimateMin).toBe(40);
  });

  test('тривалість усередині фрази лишається в назві', () => {
    // Найболючіший випадок: «30 хвилин» тут — доповнення до дієслова, а не
    // позначка. Вирізавши його, застосунок лишав «Виділити , посидіти в
    // тишині» — назву без половини сенсу.
    const r = parse('Виділити 30 хвилин, посидіти в тишині');
    expect(r.title).toBe('Виділити 30 хвилин, посидіти в тишині');
    expect(r.estimateMin).toBeNull();

    expect(parse('Виділити 2 години на спорт').title).toBe('Виділити 2 години на спорт');
    expect(parse('Zrobić 15 min rozgrzewki').estimateMin).toBeNull();
  });

  test('тривалість з краю фрази — це оцінка', () => {
    expect(parse('Медитація 10 хв').estimateMin).toBe(10);
    expect(parse('Медитація 10 хв').title).toBe('Медитація');
    expect(parse('30 хв на медитацію').estimateMin).toBe(30);
    // Позначки, вирізані раніше, не роблять тривалість «серединою»:
    // після них у хвості лишаються тільки пробіли.
    expect(parse('Медитація 10 хв щодня').estimateMin).toBe(10);
  });

  test('явне «~» робить оцінку з тривалості будь-де', () => {
    const r = parse('Виділити ~30хв, посидіти в тишині');
    expect(r.estimateMin).toBe(30);
    expect(r.title).toBe('Виділити, посидіти в тишині');
  });

  test('відкинута оцінка не з\'їдає текст назви', () => {
    expect(parse('Проєкт 50 годин').title).toBe('Проєкт 50 годин');
  });
});

describe('parseQuickTask: повторення', () => {
  test('щодня / ежедневно / codziennie / daily', () => {
    ['Вітаміни щодня', 'Витамины ежедневно', 'Witaminy codziennie', 'Vitamins daily'].forEach((s) => {
      expect(parse(s).recurrence).toEqual({ type: 'daily', interval: 1, weekdays: [], day: null, anchor: 'schedule' });
    });
  });

  test('кожні N днів', () => {
    expect(parse('Тренування кожні 3 дні').recurrence)
      .toEqual({ type: 'daily', interval: 3, weekdays: [], day: null, anchor: 'schedule' });
    expect(parse('Water plants every 5 days').recurrence.interval).toBe(5);
  });

  test('конкретний день тижня і не з\'їдає його як дату', () => {
    const r = parse('Прибирання щосуботи');
    expect(r.recurrence).toEqual({ type: 'weekly', interval: 1, weekdays: [6], day: null, anchor: 'schedule' });
    // Найважливіше: «щосуботи» не має перетворитись на разове завдання на суботу.
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe('Прибирання');
  });

  test('«кожної п\'ятниці» через маркер + назву дня', () => {
    expect(parse("Звіт кожної п'ятниці").recurrence.weekdays).toEqual([5]);
    expect(parse('Take out trash every friday').recurrence.weekdays).toEqual([5]);
    expect(parse('Уборка по субботам').recurrence.weekdays).toEqual([6]);
  });

  test('щомісяця бере число з дати завдання', () => {
    const r = parse('Оплатити оренду щомісяця 01.09');
    expect(r.dueDate).toBe('2026-09-01');
    expect(r.recurrence.type).toBe('monthly');
    expect(r.recurrence.day).toBe(1);
  });

  test('повторення поєднується з часом і тегом', () => {
    const r = parse('Вітаміни щодня о 9 #здоровя');
    expect(r.recurrence.type).toBe('daily');
    expect(r.dueTime).toBe('09:00');
    expect(r.tags).toEqual(['здоровя']);
    expect(r.title).toBe('Вітаміни');
  });

  test('звичайне завдання не отримує повторення', () => {
    expect(parse('Купити молоко завтра').recurrence).toBeNull();
  });
});

describe('parseQuickTask: назва', () => {
  test('усе разом', () => {
    const r = parse('Купити молоко завтра о 18 #дім ~15хв !1');
    expect(r).toEqual({
      title: 'Купити молоко',
      dueDate: '2026-08-19',
      dueTime: '18:00',
      priority: 'high',
      tags: ['дім'],
      estimateMin: 15,
      recurrence: null,
    });
  });

  test('англійською', () => {
    const r = parse('Call the dentist tomorrow at 9:30 #health ~10m !2');
    expect(r).toEqual({
      title: 'Call the dentist',
      dueDate: '2026-08-19',
      dueTime: '09:30',
      priority: 'medium',
      tags: ['health'],
      estimateMin: 10,
      recurrence: null,
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
      priority: null,
      tags: [],
      estimateMin: null,
      recurrence: null,
    });
  });

  test('порожній або нетекстовий ввід не ламає розбір', () => {
    expect(parse('').title).toBe('');
    expect(parseQuickTask(null, { now: NOW }).title).toBe('');
    expect(parse('   ').title).toBe('');
  });
});
