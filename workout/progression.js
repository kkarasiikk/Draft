// ---- Прогресивне навантаження ----
// Відповідає на питання, яке людина ставить собі перед кожним підходом:
// «яку вагу ставити сьогодні?». Замість того щоб просто показати минулий
// результат і лишити рахувати в голові, тут із історії вправи виводиться
// конкретна наступна ціль.
//
// Правило — подвійна прогресія, класика силового тренування: у кожної вправи
// є діапазон повторень; поки він не закритий зверху, вага стоїть і ростуть
// повторення; закрив верх у всіх робочих підходах — вага росте, повторення
// падають на низ діапазону. Двічі поспіль не дотягнув до низу — вага
// скидається на 10%, бо це вже не «важкий день», а перевантаження.
//
// Тут свідомо немає ні DOM, ні Firestore — тільки чисті функції від історії.
// Через це поведінку можна перевірити тестами (workout/progression.test.js),
// а не «на око» через півтора місяця тренувань.
(function (root) {
  'use strict';

  // Діапазони й крок ваги по вправах. Числа не з повітря: базові рухи зі
  // штангою ростуть по 2.5 кг (найменший млинець — 1.25 з кожного боку),
  // ноги — по 5, ізоляція з гантелями — по 2, бо гантельні ряди йдуть саме
  // з таким кроком. Діапазон повторень тим нижчий, чим важча вправа.
  var PROFILES = {
    benchPress: { min: 5, max: 8, step: 2.5 },
    inclineDbPress: { min: 8, max: 12, step: 2 },
    chestFly: { min: 10, max: 15, step: 2 },
    barbellRow: { min: 6, max: 10, step: 2.5 },
    deadlift: { min: 3, max: 6, step: 5 },
    squat: { min: 5, max: 8, step: 5 },
    legPress: { min: 8, max: 12, step: 5 },
    lunge: { min: 8, max: 12, step: 2 },
    overheadPress: { min: 5, max: 8, step: 2.5 },
    lateralRaise: { min: 12, max: 15, step: 2 },
    bicepCurl: { min: 8, max: 12, step: 2 },
    tricepExtension: { min: 8, max: 12, step: 2 },
    // Вправи з власною вагою: поки обтяження немає, росте кількість
    // повторень. Закрив верх діапазону — час вішати млинець на пояс.
    pullUp: { min: 5, max: 10, step: 2.5, bodyweight: true },
    dip: { min: 6, max: 12, step: 2.5, bodyweight: true },
    // Планка міряється секундами в тому ж полі, що й повторення, тож і крок
    // тут не «плюс одне повторення», а плюс п'ять секунд. Обтяження не
    // передбачене: планку прогресують часом.
    plank: { min: 30, max: 60, step: 0, bodyweight: true, repStep: 5, noLoad: true },
    crunch: { min: 12, max: 20, step: 0, bodyweight: true, repStep: 2, noLoad: true },
  };

  // Власна вправа (не з бібліотеки) — про неї нічого не відомо, тож беремо
  // найпоширеніший діапазон і найдрібніший крок штанги.
  var DEFAULT_PROFILE = { min: 8, max: 12, step: 2.5 };

  function profileFor(libId) {
    var p = PROFILES[libId] || DEFAULT_PROFILE;
    return {
      min: p.min, max: p.max, step: p.step,
      repStep: p.repStep || 1,
      bodyweight: !!p.bodyweight,
      noLoad: !!p.noLoad,
    };
  }

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** Робочий підхід сесії: найважча вага, а серед підходів із нею —
   *  найгірший за повтореннями. Саме він і вирішує, чи діапазон закритий:
   *  «вісім, вісім, п'ять» це ще не вісім разів по вісім. */
  function workingSet(sets) {
    var valid = (sets || []).filter(function (s) { return s && num(s.reps) > 0; });
    if (!valid.length) return null;
    var top = valid.reduce(function (max, s) { return Math.max(max, num(s.weight)); }, 0);
    var atTop = valid.filter(function (s) { return num(s.weight) === top; });
    var reps = atTop.reduce(function (min, s) { return Math.min(min, num(s.reps)); }, Infinity);
    return { weight: top, reps: reps, sets: atTop.length };
  }

  /** Округлення до кроку — щоб не з'являлись ваги, яких не набрати
   *  млинцями: 71.25 кг це красиве число тільки на папері. */
  function roundToStep(value, step) {
    if (!step) return Math.round(value);
    return Math.round(value / step) * step;
  }

  /**
   * Що робити наступного разу.
   * @param history — [{ date, sets }] цієї ж вправи, найновіше першим.
   * @param libId — id з бібліотеки; порожній для власної вправи.
   * @returns null, якщо історії немає, інакше
   *   { weight, reps, verdict: 'up'|'hold'|'down', reason, profile }
   */
  function suggestNext(history, libId) {
    var rows = (history || []).map(function (r) { return workingSet(r && r.sets); });
    var last = rows[0];
    if (!last) return null;

    var p = profileFor(libId);

    // Власна вага без обтяження: прогресуємо повтореннями, доки не закриємо
    // верх діапазону. Далі — або обтяження, або (планка) просто далі час.
    if (!last.weight) {
      if (last.reps >= p.max && !p.noLoad) {
        return { weight: p.step, reps: p.min, verdict: 'up', reason: 'addLoad', profile: p };
      }
      return { weight: 0, reps: last.reps + p.repStep, verdict: 'up', reason: 'moreReps', profile: p };
    }

    if (last.reps >= p.max) {
      return {
        weight: roundToStep(last.weight + p.step, p.step),
        reps: p.min, verdict: 'up', reason: 'hitTop', profile: p,
      };
    }

    if (last.reps < p.min) {
      // Один провал буває від поганого сну. Два поспіль на тій самій вазі —
      // це вже сигнал, що вага завелика.
      var prev = rows[1];
      var failedTwice = prev && prev.weight === last.weight && prev.reps < p.min;
      if (failedTwice) {
        // Мінус десять відсотків, округлені до кроку. Але на легких вагах
        // округлення може дати ту саму цифру — «скидання», після якого
        // нічого не змінилось, гірше за чесне «спробуй ще раз».
        var target = roundToStep(last.weight * 0.9, p.step);
        if (target >= last.weight) target = roundToStep(last.weight - p.step, p.step);
        if (target > 0 && target < last.weight) {
          return { weight: target, reps: p.min, verdict: 'down', reason: 'missedTwice', profile: p };
        }
      }
      return { weight: last.weight, reps: p.min, verdict: 'hold', reason: 'missed', profile: p };
    }

    // Усередині діапазону — вага стоїть, повторення ростуть.
    return {
      weight: last.weight,
      reps: Math.min(p.max, last.reps + p.repStep),
      verdict: 'hold', reason: 'inRange', profile: p,
    };
  }

  var api = {
    PROFILES: PROFILES,
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    profileFor: profileFor,
    workingSet: workingSet,
    roundToStep: roundToStep,
    suggestNext: suggestNext,
  };

  root.WorkoutProgression = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
