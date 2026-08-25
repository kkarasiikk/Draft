const P = require('./progress');

const TODAY = '2026-08-20';
const back = (n) => {
  const d = new Date(2026, 7, 20);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const bench = (weight, reps) => ({ libId: 'benchPress', muscle: 'chest', sets: [{ weight, reps }] });
const squat = (weight, reps) => ({ libId: 'squat', muscle: 'legs', sets: [{ weight, reps }] });
const pull = (reps) => ({ libId: 'pullUp', muscle: 'back', sets: [{ weight: 0, reps }] });
const session = (daysAgo, ...exercises) => ({ date: back(daysAgo), exercises });

describe('epley1RM', () => {
  test('зводить вагу й повторення до одного числа', () => {
    expect(P.epley1RM(80, 8)).toBeCloseTo(101.33, 1);
    expect(P.epley1RM(100, 1)).toBeCloseTo(103.33, 1);
  });
  test('без ваги або без повторень — нуль', () => {
    expect(P.epley1RM(0, 10)).toBe(0);
    expect(P.epley1RM(80, 0)).toBe(0);
  });
});

describe('exerciseKey', () => {
  test('бібліотечна вправа групується за id, а не за назвою', () => {
    expect(P.exerciseKey({ libId: 'benchPress', name: 'Bench Press' })).toBe('lib:benchPress');
    expect(P.exerciseKey({ libId: 'benchPress', name: 'Жим лежачи' })).toBe('lib:benchPress');
  });
  // Стара власна вправа (записана до появи списку своїх вправ) не має
  // customId — для неї лишається групування за назвою, як і раніше.
  test('стара власна вправа без customId — за нормалізованою назвою', () => {
    expect(P.exerciseKey({ name: '  Гакк-присід ' })).toBe('c:гакк-присід');
  });
  // Своя вправа зі списку групується за id документа: перейменування
  // (майбутнє) чи однакові назви різними регістрами не розʼїжджають історію.
  test('своя вправа зі списку групується за customId, а не назвою', () => {
    expect(P.exerciseKey({ customId: 'x1', name: 'Гакк-присід' })).toBe('custom:x1');
    expect(P.exerciseKey({ customId: 'x1', name: 'Стара назва' })).toBe('custom:x1');
  });
  test('libId переважає над customId, якщо обидва раптом задані', () => {
    expect(P.exerciseKey({ libId: 'squat', customId: 'x1' })).toBe('lib:squat');
  });
});

describe('summarize', () => {
  test('рахує тоннаж, повторення й найкращий e1RM', () => {
    const s = P.summarize([{ date: TODAY, exercises: [
      { libId: 'benchPress', muscle: 'chest', sets: [{ weight: 80, reps: 8 }, { weight: 85, reps: 5 }] },
    ] }]);
    const e = s.byExercise['lib:benchPress'];
    expect(e.tonnage).toBe(80 * 8 + 85 * 5);
    expect(e.reps).toBe(13);
    expect(e.e1rm).toBeCloseTo(P.epley1RM(80, 8), 5);   // 101.3 > 99.2
    expect(s.byMuscle.chest.tonnage).toBe(e.tonnage);
  });

  test('порожні підходи не рахуються', () => {
    const s = P.summarize([{ date: TODAY, exercises: [
      { libId: 'squat', muscle: 'legs', sets: [{ weight: 100, reps: 0 }, { weight: '', reps: '' }] },
    ] }]);
    expect(s.byExercise['lib:squat'].reps).toBe(0);
    expect(s.byMuscle.legs.tonnage).toBe(0);
  });
});

describe('analyze', () => {
  test('без тренувань — чесно каже, що даних мало', () => {
    const r = P.analyze([], TODAY);
    expect(r.enough).toBe(false);
    expect(r.needSessions).toBe(2);
    expect(r.strengthPct).toBe(null);
  });

  // З одного тренування «тренд» вигадується, а не рахується.
  test('одного тренування замало', () => {
    const r = P.analyze([session(2, bench(80, 8))], TODAY);
    expect(r.enough).toBe(false);
    expect(r.needSessions).toBe(1);
  });

  // Вправа, яку почали робити цього місяця, зростання не показує:
  // їй просто нема з чим порівнюватись.
  test('без попереднього вікна порівнювати нічого', () => {
    const r = P.analyze([session(2, bench(80, 8)), session(9, bench(80, 6))], TODAY);
    expect(r.enough).toBe(false);
    expect(r.comparedCount).toBe(0);
    expect(r.exercises[0].pct).toBe(null);
  });

  test('рахує зміну сили між місяцями', () => {
    const r = P.analyze([
      session(2, bench(90, 8)), session(9, bench(87.5, 8)),
      session(35, bench(80, 8)), session(42, bench(80, 6)),
    ], TODAY);
    expect(r.enough).toBe(true);
    expect(r.sessionsNow).toBe(2);
    expect(r.sessionsPrev).toBe(2);
    expect(r.comparedCount).toBe(1);
    expect(r.strengthPct).toBe(13);   // 90×8 проти 80×8
    expect(r.verdict).toBe('up');
  });

  test('падіння сили теж видно', () => {
    const r = P.analyze([
      session(2, bench(70, 8)), session(9, bench(70, 6)),
      session(35, bench(80, 8)), session(42, bench(80, 8)),
    ], TODAY);
    expect(r.strengthPct).toBe(-13);
    expect(r.verdict).toBe('down');
  });

  // Кілька відсотків — це вага води й сон, а не прогрес.
  test('дрібна зміна вважається «тримаєш рівень»', () => {
    const r = P.analyze([
      session(2, bench(81, 8)), session(9, bench(81, 8)),
      session(35, bench(80, 8)), session(42, bench(80, 8)),
    ], TODAY);
    expect(r.verdict).toBe('flat');
  });

  test('загальна зміна — середнє по вправах, а не по одній', () => {
    const r = P.analyze([
      session(2, bench(88, 8), squat(100, 5)), session(9, bench(88, 8)),
      session(35, bench(80, 8), squat(100, 5)), session(42, bench(80, 8)),
    ], TODAY);
    // жим +10%, присід 0% -> 5%
    expect(r.strengthPct).toBe(5);
    expect(r.comparedCount).toBe(2);
  });

  test('вправи впорядковані за помітністю зміни', () => {
    const r = P.analyze([
      session(2, bench(88, 8), squat(90, 5)), session(9, bench(88, 8), squat(90, 5)),
      session(35, bench(80, 8), squat(100, 5)), session(42, bench(80, 8), squat(100, 5)),
    ], TODAY);
    expect(r.exercises.map((e) => [e.libId, e.pct])).toEqual([['benchPress', 10], ['squat', -10]]);
  });

  test('обсяг по мʼязах рахується тоннажем', () => {
    const r = P.analyze([
      session(2, bench(80, 10)), session(9, bench(80, 10)),
      session(35, bench(80, 5)), session(42, bench(80, 5)),
    ], TODAY);
    const chest = r.muscles.find((m) => m.muscle === 'chest');
    expect(chest).toMatchObject({ unit: 'kg', now: 1600, prev: 800, pct: 100 });
  });

  // Підтягування — це нуль кілограмів на штанзі; показувати «обсяг 0 кг»
  // означало б сказати, що людина нічого не робила.
  test('групи без обтяження міряються повтореннями', () => {
    const r = P.analyze([
      session(2, pull(10)), session(9, pull(10)),
      session(35, pull(8)), session(42, pull(8)),
    ], TODAY);
    const backM = r.muscles.find((m) => m.muscle === 'back');
    expect(backM).toMatchObject({ unit: 'reps', now: 20, prev: 16, pct: 25 });
  });

  test('мʼяз, який був тільки минулого місяця, зі списку не зникає', () => {
    const r = P.analyze([
      session(2, bench(80, 8)), session(9, bench(80, 8)),
      session(35, bench(80, 8), squat(100, 5)), session(42, bench(80, 8)),
    ], TODAY);
    const legs = r.muscles.find((m) => m.muscle === 'legs');
    expect(legs).toMatchObject({ now: 0, prev: 500 });
  });

  // Межі вікон: 28-й день ще «цей місяць», 29-й — уже минулий.
  test('межі вікон рівно на 28 днях', () => {
    const r = P.analyze([
      session(0, bench(90, 8)), session(27, bench(90, 8)),
      session(28, bench(80, 8)), session(55, bench(80, 8)),
    ], TODAY);
    expect(r.sessionsNow).toBe(2);
    expect(r.sessionsPrev).toBe(2);
  });

  test('старіше за два вікна не враховується', () => {
    const r = P.analyze([
      session(2, bench(90, 8)), session(9, bench(90, 8)),
      session(56, bench(10, 8)),
    ], TODAY);
    expect(r.sessionsPrev).toBe(0);
    expect(r.comparedCount).toBe(0);
  });

  test('тренування без дати не ламає підрахунок', () => {
    const r = P.analyze([{ exercises: [bench(80, 8)] }, session(2, bench(80, 8)), session(9, bench(80, 8))], TODAY);
    expect(r.sessionsNow).toBe(2);
  });

  // Своя вправа зі списку прив'язана до цілі й тренуванням через стабільний
  // id, тож прогрес по ній рахується так само надійно, як і по бібліотечній.
  test('своя вправа зі списку прогресує так само, як бібліотечна', () => {
    const own = (weight, reps) => ({ customId: 'x1', name: 'Гакк-присід', muscle: 'legs', sets: [{ weight, reps }] });
    const r = P.analyze([
      session(2, own(90, 8)), session(9, own(88, 8)),
      session(35, own(80, 8)), session(42, own(80, 8)),
    ], TODAY);
    expect(r.comparedCount).toBe(1);
    expect(r.exercises[0]).toMatchObject({ key: 'custom:x1', pct: 13 });
  });
});

describe('план не рахується зробленим тренуванням', () => {
  // Тренування можна записати наперед: вправи є, підходи порожні. Поки в
  // ньому нуль повторень, воно ще не відбулось — інакше «тренувань цього
  // місяця: 5» рахувало б наміри нарівні з роботою.
  const planned = (date) => ({
    date, exercises: [{ libId: 'benchPress', muscle: 'chest', sets: [{ weight: 0, reps: 0 }, { weight: 0, reps: 0 }] }],
  });
  const done = (date, weight) => ({
    date, exercises: [{ libId: 'benchPress', muscle: 'chest', sets: [{ weight, reps: 8 }] }],
  });

  test('порожнє тренування не додається до лічильника', () => {
    const withPlan = P.analyze([done('2026-08-20', 80), planned('2026-08-21')], '2026-08-24');
    const without = P.analyze([done('2026-08-20', 80)], '2026-08-24');
    expect(withPlan.sessionsNow).toBe(without.sessionsNow);
  });

  test('план не додає ні тоннажу, ні повторень', () => {
    const a = P.analyze([
      done('2026-07-10', 70), done('2026-08-20', 80), planned('2026-08-22'),
    ], '2026-08-24');
    const b = P.analyze([done('2026-07-10', 70), done('2026-08-20', 80)], '2026-08-24');
    expect(a.muscles).toEqual(b.muscles);
    expect(a.strengthPct).toBe(b.strengthPct);
  });
});

describe('restByMuscle', () => {
  test('рахує, скільки днів група відпочивала', () => {
    const r = P.restByMuscle([session(1, bench(80, 8)), session(6, squat(100, 5)), session(9, bench(80, 8))], TODAY);
    expect(r).toEqual([
      { muscle: 'legs', lastDate: back(6), daysAgo: 6 },
      { muscle: 'chest', lastDate: back(1), daysAgo: 1 },
    ]);
  });

  // Група, якої не було два місяці, — це теж відповідь, і найважливіша,
  // тож дивимось на всю історію, а не на вікно порівняння.
  test('давня група зі списку не випадає', () => {
    const r = P.restByMuscle([session(2, bench(80, 8)), session(90, squat(100, 5))], TODAY);
    expect(r[0]).toMatchObject({ muscle: 'legs', daysAgo: 90 });
  });

  test('вправа без жодного повторення тренуванням не рахується', () => {
    const r = P.restByMuscle([{ date: back(1), exercises: [{ libId: 'squat', muscle: 'legs', sets: [{ weight: 100, reps: 0 }] }] }], TODAY);
    expect(r).toEqual([]);
  });

  test('порожня історія — порожній список', () => {
    expect(P.restByMuscle([], TODAY)).toEqual([]);
    expect(P.restByMuscle(undefined, TODAY)).toEqual([]);
  });
});
