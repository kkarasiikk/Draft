const {
  reminderOptionsFor, reminderAtFor, isDue, digestDue, hourInZone, isoInZone,
} = require('./reminders');

const task = (over) => ({ title: 'Завдання', dueDate: null, dueTime: null, ...over });

describe('reminderOptionsFor', () => {
  test('для завдання з часом — зсуви від нього', () => {
    const opts = reminderOptionsFor(task({ dueDate: '2026-08-18', dueTime: '15:00' }));
    expect(opts.map((o) => o.offsetMin)).toEqual([0, 10, 30, 60]);
  });

  test('для завдання без часу — години дня, бо зсув відраховувати нема від чого', () => {
    const opts = reminderOptionsFor(task({ dueDate: '2026-08-18' }));
    expect(opts.map((o) => o.atHour)).toEqual([9, 18]);
  });

  test('без дати нагадувати нема коли', () => {
    expect(reminderOptionsFor(task({}))).toEqual([]);
    expect(reminderOptionsFor(null)).toEqual([]);
  });
});

describe('reminderAtFor', () => {
  const withTime = task({ dueDate: '2026-08-18', dueTime: '15:00' });

  test('у час завдання', () => {
    expect(reminderAtFor(withTime, { offsetMin: 0 })).toEqual(new Date(2026, 7, 18, 15, 0, 0, 0));
  });

  test('за 10 / 30 / 60 хвилин', () => {
    expect(reminderAtFor(withTime, { offsetMin: 10 })).toEqual(new Date(2026, 7, 18, 14, 50, 0, 0));
    expect(reminderAtFor(withTime, { offsetMin: 30 })).toEqual(new Date(2026, 7, 18, 14, 30, 0, 0));
    expect(reminderAtFor(withTime, { offsetMin: 60 })).toEqual(new Date(2026, 7, 18, 14, 0, 0, 0));
  });

  test('зсув переносить нагадування на попередній день', () => {
    const early = task({ dueDate: '2026-08-18', dueTime: '00:20' });
    expect(reminderAtFor(early, { offsetMin: 60 })).toEqual(new Date(2026, 7, 17, 23, 20, 0, 0));
  });

  test('завдання без часу: конкретна година дня', () => {
    const allDay = task({ dueDate: '2026-08-18' });
    expect(reminderAtFor(allDay, { atHour: 9 })).toEqual(new Date(2026, 7, 18, 9, 0, 0, 0));
    expect(reminderAtFor(allDay, { atHour: 18 })).toEqual(new Date(2026, 7, 18, 18, 0, 0, 0));
  });

  test('зсув без часу завдання не рахується', () => {
    expect(reminderAtFor(task({ dueDate: '2026-08-18' }), { offsetMin: 10 })).toBeNull();
  });

  test('сміттєві дані не ламають розрахунок', () => {
    expect(reminderAtFor(null, { offsetMin: 0 })).toBeNull();
    expect(reminderAtFor(withTime, null)).toBeNull();
    expect(reminderAtFor(withTime, { offsetMin: -5 })).toBeNull();
    expect(reminderAtFor(task({ dueDate: 'казна-що', dueTime: '15:00' }), { offsetMin: 0 })).toBeNull();
    expect(reminderAtFor(task({ dueDate: '2026-08-18', dueTime: '99:99' }), { offsetMin: 0 })).toBeNull();
  });
});

describe('isDue', () => {
  const now = new Date(2026, 7, 18, 15, 0, 0);

  test('момент у минулому — час слати', () => {
    expect(isDue(new Date(2026, 7, 18, 14, 59), now)).toBe(true);
  });

  test('момент у майбутньому — ще ні', () => {
    expect(isDue(new Date(2026, 7, 18, 15, 1), now)).toBe(false);
  });

  test('допуск покриває крок планувальника', () => {
    // Планувальник бігає раз на 5 хвилин: те, що настане за 3 хвилини,
    // краще надіслати зараз, ніж запізнитись на п'ять.
    expect(isDue(new Date(2026, 7, 18, 15, 3), now, 5)).toBe(true);
    expect(isDue(new Date(2026, 7, 18, 15, 7), now, 5)).toBe(false);
  });

  test('порожній або зіпсований момент', () => {
    expect(isDue(null, now)).toBe(false);
    expect(isDue(new Date('казна-що'), now)).toBe(false);
  });
});

describe('hourInZone / isoInZone', () => {
  // 18 серпня 2026, 23:30 UTC — у Києві це вже 19-е, 02:30.
  const night = new Date(Date.UTC(2026, 7, 18, 23, 30));

  test('година рахується в потрібній таймзоні', () => {
    expect(hourInZone(night, 'UTC')).toBe(23);
    expect(hourInZone(night, 'Europe/Kyiv')).toBe(2);
    expect(hourInZone(night, 'America/New_York')).toBe(19);
  });

  test('дата теж місцева, а не серверна', () => {
    expect(isoInZone(night, 'UTC')).toBe('2026-08-18');
    expect(isoInZone(night, 'Europe/Kyiv')).toBe('2026-08-19');
  });

  test('невідома таймзона не ламає розрахунок', () => {
    expect(typeof hourInZone(night, 'Мар/Сіріус')).toBe('number');
    expect(isoInZone(night, 'Мар/Сіріус')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('digestDue', () => {
  // 08:30 у Києві.
  const morning = new Date(Date.UTC(2026, 7, 18, 5, 30));
  const base = { enabled: true, morningHour: 8, eveningHour: 20, tz: 'Europe/Kyiv' };

  test('ранковий дайджест у свою годину', () => {
    expect(digestDue(base, morning)).toEqual({ kind: 'morning', date: '2026-08-18' });
  });

  test('вже надісланий сьогодні не повторюється', () => {
    expect(digestDue({ ...base, lastMorning: '2026-08-18' }, morning)).toBeNull();
  });

  test('надісланий учора не заважає сьогоднішньому', () => {
    expect(digestDue({ ...base, lastMorning: '2026-08-17' }, morning)).toEqual({ kind: 'morning', date: '2026-08-18' });
  });

  test('вечірній дайджест', () => {
    const evening = new Date(Date.UTC(2026, 7, 18, 17, 30)); // 20:30 у Києві
    expect(digestDue(base, evening)).toEqual({ kind: 'evening', date: '2026-08-18' });
  });

  test('не в годину дайджесту — нічого', () => {
    const noon = new Date(Date.UTC(2026, 7, 18, 9, 30)); // 12:30 у Києві
    expect(digestDue(base, noon)).toBeNull();
  });

  test('вимкнені нагадування', () => {
    expect(digestDue({ ...base, enabled: false }, morning)).toBeNull();
    expect(digestDue(null, morning)).toBeNull();
  });

  test('без вечірньої години шлеться лише ранковий', () => {
    const evening = new Date(Date.UTC(2026, 7, 18, 17, 30));
    expect(digestDue({ ...base, eveningHour: null }, evening)).toBeNull();
  });

  test('година рахується в таймзоні користувача, а не сервера', () => {
    // 08:30 у Нью-Йорку — це 12:30 UTC.
    const nyMorning = new Date(Date.UTC(2026, 7, 18, 12, 30));
    expect(digestDue({ ...base, tz: 'America/New_York' }, nyMorning)).toEqual({ kind: 'morning', date: '2026-08-18' });
    expect(digestDue(base, nyMorning)).toBeNull();
  });
});
