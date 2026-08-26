const R = require('./recurring');

const monthly = (day, nextDate, extra = {}) => ({
  type: 'expense', amount: 12000, category: 'home', note: 'Оренда',
  recurrence: { type: 'monthly', interval: 1, day, anchor: 'schedule' },
  nextDate, active: true, ...extra,
});

describe('dueDates: що вже настало', () => {
  test('дата в майбутньому ще не настала', () => {
    expect(R.dueDates(monthly(1, '2026-09-01'), { today: '2026-08-25' })).toEqual([]);
  });

  test('сьогоднішня дата вважається насталою', () => {
    expect(R.dueDates(monthly(25, '2026-08-25'), { today: '2026-08-25' })).toEqual(['2026-08-25']);
  });

  test('пропущені місяці віддаються всі, від найдавнішого', () => {
    // Застосунок не відкривали з травня — оренда за червень, липень, серпень.
    const dates = R.dueDates(monthly(1, '2026-06-01'), { today: '2026-08-25' });
    expect(dates).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
  });

  test('вимкнене правило нічого не віддає', () => {
    expect(R.dueDates(monthly(1, '2026-06-01', { active: false }), { today: '2026-08-25' })).toEqual([]);
  });

  test('правило без nextDate не ламає розбір', () => {
    expect(R.dueDates(monthly(1, null), { today: '2026-08-25' })).toEqual([]);
    expect(R.dueDates(null, { today: '2026-08-25' })).toEqual([]);
  });

  test('щотижневе правило', () => {
    const weekly = {
      recurrence: { type: 'weekly', weekdays: [1], anchor: 'schedule' },
      nextDate: '2026-08-03', active: true,   // понеділок
    };
    // Понеділки 3, 10, 17, 24 серпня; 31-ше ще попереду.
    expect(R.dueDates(weekly, { today: '2026-08-25' }))
      .toEqual(['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24']);
  });

  test('дуже довга пауза обрізається, лишаються найсвіжіші', () => {
    // Щоденне правило, не відкривали рік — сотні рядків нікому не потрібні.
    const daily = {
      recurrence: { type: 'daily', interval: 1, anchor: 'schedule' },
      nextDate: '2025-08-25', active: true,
    };
    const dates = R.dueDates(daily, { today: '2026-08-25' });
    expect(dates).toHaveLength(R.MAX_DUE);
    // Обрізаємо початок, а не кінець: найсвіжіші дати корисніші за торішні.
    expect(dates[dates.length - 1]).toBe('2026-08-25');
  });
});

describe('advance: куди зсувається правило', () => {
  test('рахує від дати повтору, а не від сьогодні', () => {
    // Оренду за червень записали 25 серпня — липень має лишитись липнем,
    // інакше пропущений місяць зсунув би всю подальшу серію.
    expect(R.advance(monthly(1, '2026-06-01'), '2026-06-01')).toBe('2026-07-01');
  });

  test('щомісячне 31 число не перестрибує лютий', () => {
    const rule = monthly(31, '2026-01-31');
    expect(R.advance(rule, '2026-01-31')).toBe('2026-02-28');
  });
});

describe('pendingSummary: що показати в банері', () => {
  test('рахує і правила, і окремі дати', () => {
    const rules = [
      monthly(1, '2026-06-01'),   // 3 дати
      monthly(10, '2026-08-10'),  // 1 дата
      monthly(1, '2026-09-01'),   // ще не настало
    ];
    expect(R.pendingSummary(rules, { today: '2026-08-25' })).toEqual({ rules: 2, occurrences: 4 });
  });

  test('порожній список — порожній підсумок', () => {
    expect(R.pendingSummary([], { today: '2026-08-25' })).toEqual({ rules: 0, occurrences: 0 });
    expect(R.pendingSummary(null, { today: '2026-08-25' })).toEqual({ rules: 0, occurrences: 0 });
  });
});
