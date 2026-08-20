const P = require('./progression');

const sets = (...pairs) => pairs.map(([weight, reps]) => ({ weight, reps }));
const hist = (...rows) => rows.map((s, i) => ({ date: `2026-08-${20 - i}`, sets: s }));

describe('workingSet', () => {
  test('бере найважчу вагу й найгірші повторення на ній', () => {
    expect(P.workingSet(sets([60, 10], [80, 8], [80, 5]))).toEqual({ weight: 80, reps: 5, sets: 2 });
  });

  // Розминочні підходи з нулем повторень і порожні рядки форми не мають
  // впливати на рішення.
  test('порожні підходи ігноруються', () => {
    expect(P.workingSet(sets([80, 8], ['', ''], [80, 0]))).toEqual({ weight: 80, reps: 8, sets: 1 });
    expect(P.workingSet([])).toBe(null);
    expect(P.workingSet(sets([80, 0]))).toBe(null);
  });

  test('вага з власною вагою тіла — нуль, не помилка', () => {
    expect(P.workingSet(sets([0, 10], ['', 8]))).toEqual({ weight: 0, reps: 8, sets: 2 });
  });
});

describe('suggestNext — штанга', () => {
  test('без історії пропонувати нічого', () => {
    expect(P.suggestNext([], 'benchPress')).toBe(null);
    expect(P.suggestNext(undefined, 'benchPress')).toBe(null);
  });

  // Жим: діапазон 5–8, крок 2.5. Вісім повторень — верх закрито.
  test('закрив верх діапазону — вага росте, повторення падають на низ', () => {
    const r = P.suggestNext(hist(sets([80, 8], [80, 8])), 'benchPress');
    expect(r).toMatchObject({ weight: 82.5, reps: 5, verdict: 'up', reason: 'hitTop' });
  });

  test('усередині діапазону — вага стоїть, повторення ростуть', () => {
    const r = P.suggestNext(hist(sets([80, 6])), 'benchPress');
    expect(r).toMatchObject({ weight: 80, reps: 7, verdict: 'hold', reason: 'inRange' });
  });

  // «Вісім, вісім, п'ять» — це не вісім разів по вісім: діапазон не закритий.
  test('провалений останній підхід не рахується за закритий діапазон', () => {
    const r = P.suggestNext(hist(sets([80, 8], [80, 8], [80, 5])), 'benchPress');
    expect(r).toMatchObject({ weight: 80, reps: 6, verdict: 'hold' });
  });

  test('не дотягнув до низу — вага стоїть, ще одна спроба', () => {
    const r = P.suggestNext(hist(sets([85, 3])), 'benchPress');
    expect(r).toMatchObject({ weight: 85, reps: 5, verdict: 'hold', reason: 'missed' });
  });

  // Один провал буває від поганого сну; два поспіль на тій самій вазі — ні.
  test('двічі поспіль не дотягнув — мінус десять відсотків', () => {
    const r = P.suggestNext(hist(sets([100, 3]), sets([100, 4])), 'benchPress');
    expect(r).toMatchObject({ weight: 90, verdict: 'down', reason: 'missedTwice' });
  });

  // Скидання, після якого вага та сама, — це не скидання. На легких
  // вагах чесніше сказати «спробуй ще раз».
  test('на дрібній вазі скидати нікуди — лишається спроба', () => {
    const r = P.suggestNext(hist(sets([2.5, 3]), sets([2.5, 4])), 'benchPress');
    expect(r).toMatchObject({ weight: 2.5, verdict: 'hold', reason: 'missed' });
  });

  test('провал на іншій вазі серією не рахується', () => {
    const r = P.suggestNext(hist(sets([100, 3]), sets([95, 4])), 'benchPress');
    expect(r).toMatchObject({ weight: 100, verdict: 'hold', reason: 'missed' });
  });

  // Скидання округлюється до кроку: 71.25 кг млинцями не набрати.
  test('скидання округлюється до кроку ваги', () => {
    const r = P.suggestNext(hist(sets([77.5, 2]), sets([77.5, 2])), 'benchPress');
    expect(r.weight).toBe(70);
    expect(r.weight % 2.5).toBe(0);
  });

  test('ноги ростуть по пʼять, а не по два з половиною', () => {
    expect(P.suggestNext(hist(sets([100, 8])), 'squat')).toMatchObject({ weight: 105, reps: 5 });
    expect(P.suggestNext(hist(sets([140, 6])), 'deadlift')).toMatchObject({ weight: 145, reps: 3 });
  });

  test('ізоляція має свій діапазон і крок', () => {
    expect(P.suggestNext(hist(sets([12, 15])), 'lateralRaise')).toMatchObject({ weight: 14, reps: 12 });
  });

  test('власна вправа працює за загальним правилом', () => {
    expect(P.suggestNext(hist(sets([40, 12])), '')).toMatchObject({ weight: 42.5, reps: 8, verdict: 'up' });
    expect(P.suggestNext(hist(sets([40, 9])), null)).toMatchObject({ weight: 40, reps: 10 });
  });
});

describe('suggestNext — власна вага', () => {
  test('поки діапазон не закрито — ростуть повторення', () => {
    expect(P.suggestNext(hist(sets([0, 8])), 'pullUp'))
      .toMatchObject({ weight: 0, reps: 9, verdict: 'up', reason: 'moreReps' });
  });

  // Десять підтягувань — далі має сенс не двадцять, а млинець на пояс.
  test('закрив верх — час вішати обтяження', () => {
    expect(P.suggestNext(hist(sets([0, 10])), 'pullUp'))
      .toMatchObject({ weight: 2.5, reps: 5, verdict: 'up', reason: 'addLoad' });
  });

  test('з обтяженням підтягування рахуються як звичайна вправа', () => {
    expect(P.suggestNext(hist(sets([5, 10])), 'pullUp')).toMatchObject({ weight: 7.5, reps: 5, reason: 'hitTop' });
  });

  // Планка міряється секундами в полі повторень, і вішати на неї млинець
  // застосунок не пропонує — вона прогресує часом.
  test('планка росте секундами й обтяження не просить', () => {
    expect(P.suggestNext(hist(sets([0, 45])), 'plank')).toMatchObject({ weight: 0, reps: 50 });
    expect(P.suggestNext(hist(sets([0, 60])), 'plank')).toMatchObject({ weight: 0, reps: 65, reason: 'moreReps' });
  });

  test('скручування ростуть по два', () => {
    expect(P.suggestNext(hist(sets([0, 14])), 'crunch')).toMatchObject({ reps: 16 });
  });
});

describe('profileFor', () => {
  test('невідомий id дає загальний профіль', () => {
    expect(P.profileFor('вигаданий')).toMatchObject({ min: 8, max: 12, step: 2.5, repStep: 1 });
  });
  test('кожна вправа бібліотеки має свій профіль', () => {
    const lib = require('./exercises').EXERCISE_LIB.map((e) => e.id);
    lib.forEach((id) => expect(P.PROFILES[id]).toBeDefined());
  });
});

describe('roundToStep', () => {
  test('округлює до найближчого кроку', () => {
    expect(P.roundToStep(71.25, 2.5)).toBe(72.5);
    expect(P.roundToStep(69.75, 2.5)).toBe(70);
    expect(P.roundToStep(72, 2.5)).toBe(72.5);
    expect(P.roundToStep(103, 5)).toBe(105);
  });
  test('нульовий крок — просто ціле число', () => {
    expect(P.roundToStep(41.4, 0)).toBe(41);
  });
});
