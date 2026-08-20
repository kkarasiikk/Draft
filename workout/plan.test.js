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

describe('adjustForReadiness', () => {
  // Жим: закритий верх (5–8), тож прогресія піднімає 80 -> 82.5.
  const plan = () => Plan.suggestSession([
    s(5, ex('benchPress', 'chest', 80, 8, 4)),
    s(12, ex('benchPress', 'chest', 80, 8, 4)),
  ], TODAY).exercises;

  test('«готовий» нічого не міняє', () => {
    const e = Plan.adjustForReadiness(plan(), 'ready')[0];
    expect(e).toMatchObject({ weight: 82.5, reps: 5, sets: 4, direction: 'up' });
  });

  test('невідомий рівень теж нічого не міняє', () => {
    expect(Plan.adjustForReadiness(plan(), 'вигаданий')[0]).toMatchObject({ weight: 82.5, sets: 4 });
    expect(Plan.adjustForReadiness(plan(), null)[0]).toMatchObject({ weight: 82.5, sets: 4 });
  });

  // Піднімати вагу в день, коли людина сказала «так собі», — це
  // напрошуватись на провалений підхід.
  test('«так собі»: мінус підхід і вага не росте', () => {
    const e = Plan.adjustForReadiness(plan(), 'ok')[0];
    expect(e).toMatchObject({ weight: 80, reps: 8, sets: 3, direction: 'hold' });
  });

  test('«так собі» не опускає нижче двох підходів', () => {
    const one = Plan.suggestSession([s(5, ex('benchPress', 'chest', 80, 6, 1))], TODAY).exercises;
    expect(Plan.adjustForReadiness(one, 'ok')[0].sets).toBe(2);
  });

  test('«розбитий»: два підходи, мінус десять відсотків, низ діапазону', () => {
    const e = Plan.adjustForReadiness(plan(), 'low')[0];
    expect(e).toMatchObject({ weight: 72.5, reps: 5, sets: 2, direction: 'down' });
  });

  // Скидання, після якого вага та сама, — це не скидання.
  test('на дрібній вазі «розбитий» лишає вагу як є', () => {
    const light = Plan.suggestSession([s(5, ex('lateralRaise', 'shoulders', 2, 13, 3))], TODAY).exercises;
    const e = Plan.adjustForReadiness(light, 'low')[0];
    expect(e.weight).toBe(2);
    expect(e.sets).toBe(2);
  });

  test('власна вага: «так собі» тримає повторення, «розбитий» зрізає пʼяту частину', () => {
    const body = Plan.suggestSession([s(5, ex('pullUp', 'back', 0, 10, 3))], TODAY).exercises;
    expect(body[0]).toMatchObject({ weight: 2.5, reps: 5 });     // прогресія просить обтяження
    const ok = Plan.adjustForReadiness(body, 'ok')[0];
    expect(ok).toMatchObject({ reps: 10, sets: 2, direction: 'hold' });
    const low = Plan.adjustForReadiness(body, 'low')[0];
    expect(low).toMatchObject({ weight: 0, reps: 8, sets: 2 });
  });

  test('вихідний план не змінюється', () => {
    const original = plan();
    Plan.adjustForReadiness(original, 'low');
    expect(original[0]).toMatchObject({ weight: 82.5, sets: 4 });
  });
});
