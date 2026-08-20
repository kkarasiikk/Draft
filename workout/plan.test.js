const Plan = require('./plan');

const TODAY = '2026-08-20';
const back = (n) => {
  const d = new Date(2026, 7, 20);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ex = (libId, muscle, weight, reps, sets = 3) => ({
  libId, muscle, name: '', sets: Array.from({ length: sets }, () => ({ weight, reps })),
});
const s = (daysAgo, ...exercises) => ({ date: back(daysAgo), exercises });

describe('exerciseStats', () => {
  test('рахує частоту, останню дату й підходи з найсвіжішого разу', () => {
    const stats = Plan.exerciseStats([
      s(2, ex('benchPress', 'chest', 80, 8, 4)),
      s(9, ex('benchPress', 'chest', 75, 8, 3)),
    ]);
    expect(stats['lib:benchPress']).toMatchObject({ count: 2, lastDate: back(2), sets: 4, muscle: 'chest' });
  });

  test('вправа без жодного повторення до статистики не потрапляє', () => {
    const stats = Plan.exerciseStats([{ date: back(1), exercises: [ex('squat', 'legs', 100, 0)] }]);
    expect(Object.keys(stats)).toEqual([]);
  });
});

describe('suggestSession', () => {
  test('без історії пропонувати нічого', () => {
    expect(Plan.suggestSession([], TODAY)).toBe(null);
    expect(Plan.suggestSession(undefined, TODAY)).toBe(null);
  });

  // Тренувати ту саму групу два дні поспіль — це не старанність,
  // а недовідновлення.
  test('усе тренувалось щойно — сьогодні відпочинок', () => {
    const r = Plan.suggestSession([s(0, ex('benchPress', 'chest', 80, 8))], TODAY);
    expect(r).toMatchObject({ rest: true, muscle: 'chest', daysAgo: 0 });
  });

  test('бере групу, яка найдовше відпочивала', () => {
    const r = Plan.suggestSession([
      s(1, ex('benchPress', 'chest', 80, 8)),
      s(9, ex('squat', 'legs', 100, 5)),
    ], TODAY);
    expect(r.muscles.map((m) => m.muscle)).toEqual(['legs']);
    expect(r.exercises.map((e) => e.libId)).toEqual(['squat']);
  });

  test('групу, яку тренували вчора, не пропонує', () => {
    const r = Plan.suggestSession([
      s(1, ex('benchPress', 'chest', 80, 8)),
      s(4, ex('squat', 'legs', 100, 5)),
    ], TODAY);
    expect(r.muscles.map((m) => m.muscle)).toEqual(['legs']);
  });

  test('дві групи в одну сесію, найдовше відпочилі першими', () => {
    const r = Plan.suggestSession([
      s(3, ex('benchPress', 'chest', 80, 8)),
      s(12, ex('barbellRow', 'back', 70, 8)),
      s(20, ex('squat', 'legs', 100, 5)),
    ], TODAY);
    expect(r.muscles.map((m) => m.muscle)).toEqual(['legs', 'back']);
  });

  // Випадкова вправа з одного разу в план не лізе — пропонуємо рутину,
  // а не експеримент піврічної давності.
  test('на групу беруться найчастіші вправи', () => {
    const r = Plan.suggestSession([
      s(5, ex('squat', 'legs', 100, 5), ex('legPress', 'legs', 120, 10)),
      s(12, ex('squat', 'legs', 100, 5), ex('legPress', 'legs', 120, 10)),
      s(19, ex('lunge', 'legs', 20, 10)),
    ], TODAY);
    expect(r.exercises.map((e) => e.libId).sort()).toEqual(['legPress', 'squat']);
  });

  test('більше чотирьох вправ не пропонує', () => {
    const r = Plan.suggestSession([
      s(5, ex('squat', 'legs', 100, 5), ex('legPress', 'legs', 120, 10), ex('lunge', 'legs', 20, 10)),
      s(12, ex('barbellRow', 'back', 70, 8), ex('pullUp', 'back', 0, 8), ex('deadlift', 'back', 120, 5)),
    ], TODAY);
    expect(r.exercises.length).toBeLessThanOrEqual(Plan.MAX_EXERCISES);
  });

  // Ваги в плані — ті самі, що дає правило прогресії у формі.
  test('ваги беруться з правила прогресії, а не з минулого разу', () => {
    const r = Plan.suggestSession([
      s(5, ex('benchPress', 'chest', 80, 8)),
      s(12, ex('benchPress', 'chest', 80, 8)),
    ], TODAY);
    expect(r.exercises[0]).toMatchObject({ weight: 82.5, reps: 5, direction: 'up', why: 'hitTop' });
  });

  test('кількість підходів — як минулого разу, в межах розумного', () => {
    const one = Plan.suggestSession([s(5, ex('benchPress', 'chest', 80, 6, 1))], TODAY);
    expect(one.exercises[0].sets).toBe(2);
    const many = Plan.suggestSession([s(5, ex('benchPress', 'chest', 80, 6, 9))], TODAY);
    expect(many.exercises[0].sets).toBe(5);
    const three = Plan.suggestSession([s(5, ex('benchPress', 'chest', 80, 6, 3))], TODAY);
    expect(three.exercises[0].sets).toBe(3);
  });

  test('власна вправа теж потрапляє в план', () => {
    const custom = { libId: null, muscle: null, name: 'Гакк-присід', sets: [{ weight: 90, reps: 10 }] };
    const r = Plan.suggestSession([{ date: back(5), exercises: [custom] }], TODAY);
    expect(r.exercises[0]).toMatchObject({ name: 'Гакк-присід', muscle: 'other' });
  });

  // Друга група могла вилетіти через ліміт вправ — тоді її назва в
  // заголовку була б обманом.
  test('у заголовку лише ті групи, вправи яких справді потрапили в план', () => {
    const r = Plan.suggestSession([
      s(5, ex('squat', 'legs', 100, 5), ex('legPress', 'legs', 120, 10)),
      s(6, ex('lunge', 'legs', 20, 10)),
      s(12, ex('barbellRow', 'back', 70, 8), ex('pullUp', 'back', 0, 8)),
    ], TODAY);
    const musclesInPlan = new Set(r.exercises.map((e) => e.muscle));
    r.muscles.forEach((m) => expect(musclesInPlan.has(m.muscle)).toBe(true));
  });
});
