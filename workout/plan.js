// ---- Що тренувати сьогодні ----
// Питання «яку вагу ставити» вже має відповідь (progression.js), «чи росту
// я» — теж (progress.js). Лишалось найперше: людина заходить у зал і думає,
// що взагалі сьогодні робити. Тут із власної історії збирається готова
// сесія — група мʼязів, яка найдовше відпочивала, її звичні вправи і ваги
// на сьогодні.
//
// Нічого не вигадується: пропонуються тільки ті вправи, які людина вже
// робила. Це не «програма тренувань», а її власна рутина, підставлена
// назад — саме тому підказка не потребує ні опитувальника, ні рівня
// підготовки, ні цілей, яких застосунок не питав.
(function (root) {
  'use strict';

  var progress = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./progress') : root.WorkoutProgress;
  var progression = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./progression') : root.WorkoutProgression;

  // Групу мʼязів беремо не раніше, ніж через день: тренувати те саме два дні
  // поспіль — це не старанність, а недовідновлення.
  var MIN_REST_DAYS = 2;
  // Скільки груп і вправ у пропозиції. Більше — це вже не підказка, а
  // програма, яку однаково ніхто не дочитає.
  var MAX_MUSCLES = 2;
  var MAX_PER_MUSCLE = 2;
  var MAX_EXERCISES = 4;
  // Скільки підходів пропонувати, якщо минулого разу їх було надто мало
  // або надто багато.
  var MIN_SETS = 2;
  var MAX_SETS = 5;

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function worked(ex) {
    return (ex.sets || []).some(function (set) { return num(set.reps) > 0; });
  }

  /** Що людина реально робить: по кожній вправі — скільки разів, коли
   *  востаннє, скільки робочих підходів і вся історія для прогресії. */
  function exerciseStats(sessions) {
    var map = {};
    (sessions || [])
      .filter(function (s) { return s && typeof s.date === 'string'; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
      .forEach(function (session) {
        (session.exercises || []).forEach(function (ex) {
          if (!worked(ex)) return;
          var key = progress.exerciseKey(ex);
          if (!key) return;
          var e = map[key] || (map[key] = {
            key: key, libId: ex.libId || null, name: ex.name || '',
            muscle: ex.muscle || 'other', count: 0, lastDate: session.date,
            sets: 0, history: [],
          });
          e.count++;
          if (session.date > e.lastDate) e.lastDate = session.date;
          // Кількість підходів беремо з найсвіжішого разу — саме він
          // перший у відсортованому списку.
          if (!e.history.length) {
            e.sets = (ex.sets || []).filter(function (set) { return num(set.reps) > 0; }).length;
          }
          e.history.push({ date: session.date, sets: ex.sets || [] });
        });
      });
    return map;
  }

  /**
   * Пропозиція на сьогодні.
   * @returns null — історії немає, пропонувати нічого;
   *   { rest: true, muscle, daysAgo } — усе тренувалось щойно;
   *   { muscles: [...], exercises: [...] } — готова сесія.
   */
  function suggestSession(sessions, todayIso) {
    var list = sessions || [];
    var stats = exerciseStats(list);
    var keys = Object.keys(stats);
    if (!keys.length) return null;

    var rest = progress.restByMuscle(list, todayIso);   // найдовше відпочилі — першими
    if (!rest.length) return null;
    if (rest[0].daysAgo < MIN_REST_DAYS) {
      return { rest: true, muscle: rest[0].muscle, daysAgo: rest[0].daysAgo };
    }

    var chosen = rest.filter(function (r) { return r.daysAgo >= MIN_REST_DAYS; }).slice(0, MAX_MUSCLES);
    var exercises = [];
    chosen.forEach(function (group) {
      keys
        .filter(function (k) { return stats[k].muscle === group.muscle; })
        // Спершу те, що людина робить найчастіше; за однакової частоти —
        // те, що робила недавно. Випадкова вправа з одного разу в план не лізе.
        .sort(function (a, b) {
          return (stats[b].count - stats[a].count)
            || (stats[a].lastDate < stats[b].lastDate ? 1 : -1);
        })
        .slice(0, MAX_PER_MUSCLE)
        .forEach(function (key) {
          if (exercises.length >= MAX_EXERCISES) return;
          var e = stats[key];
          var next = progression.suggestNext(e.history, e.libId || '');
          if (!next) return;
          // Минулий робочий підхід потрібен, щоб у поганий день можна було
          // не піднімати вагу, а лишити ту саму — без нього довелось би
          // вгадувати, від чого відступати.
          var last = progression.workingSet(e.history[0] && e.history[0].sets) || { weight: 0, reps: 0 };
          exercises.push({
            key: e.key, libId: e.libId, name: e.name, muscle: e.muscle,
            weight: next.weight, reps: next.reps,
            sets: Math.min(MAX_SETS, Math.max(MIN_SETS, e.sets || MIN_SETS)),
            direction: next.verdict, why: next.reason,
            lastWeight: last.weight, lastReps: last.reps,
            step: next.profile.step, minReps: next.profile.min,
            lastDate: e.lastDate, timesDone: e.count,
          });
        });
    });

    if (!exercises.length) return null;
    // У план потрапили не всі обрані групи (наприклад, друга вилетіла через
    // ліміт вправ) — показувати її в заголовку було б обманом.
    var used = {};
    exercises.forEach(function (e) { used[e.muscle] = true; });
    return {
      rest: false,
      muscles: chosen.filter(function (g) { return used[g.muscle]; }),
      exercises: exercises,
    };
  }

  // ---- Готовність ----
  // Сну, пульсу й HRV застосунок не знає й ніколи не знатиме: це
  // веб-сторінка, доступу до годинника в неї немає. Тому єдине чесне
  // джерело — сама людина: три кнопки перед тренуванням.
  var READINESS = ['ready', 'ok', 'low'];

  /** Підганяє план під самопочуття. 'ready' лишає як є; 'ok' знімає один
   *  підхід і не піднімає вагу; 'low' — легка сесія: два підходи, мінус
   *  десять відсотків, повторення з низу діапазону. */
  function adjustForReadiness(exercises, level) {
    if (READINESS.indexOf(level) < 0 || level === 'ready') return (exercises || []).slice();
    return (exercises || []).map(function (e) {
      var out = {};
      Object.keys(e).forEach(function (k) { out[k] = e[k]; });

      if (level === 'ok') {
        out.sets = Math.max(MIN_SETS, e.sets - 1);
        // Піднімати вагу в день, коли людина сказала «так собі», — це
        // напрошуватись на провалений підхід. Лишаємо минулу.
        if (e.direction === 'up' && e.lastWeight) {
          out.weight = e.lastWeight;
          out.reps = e.lastReps;
          out.direction = 'hold';
        } else if (e.direction === 'up' && !e.lastWeight) {
          out.reps = e.lastReps || e.reps;
          out.direction = 'hold';
        }
        return out;
      }

      // low
      out.sets = MIN_SETS;
      out.direction = 'down';
      if (e.lastWeight) {
        var base = progression.roundToStep(e.lastWeight * 0.9, e.step);
        out.weight = base > 0 && base < e.lastWeight ? base : e.lastWeight;
        out.reps = e.minReps || e.reps;
      } else {
        out.weight = 0;
        out.reps = Math.max(1, Math.round((e.lastReps || e.reps) * 0.8));
      }
      return out;
    });
  }

  var api = {
    READINESS: READINESS,
    adjustForReadiness: adjustForReadiness,
    MIN_REST_DAYS: MIN_REST_DAYS,
    MAX_MUSCLES: MAX_MUSCLES,
    MAX_PER_MUSCLE: MAX_PER_MUSCLE,
    MAX_EXERCISES: MAX_EXERCISES,
    exerciseStats: exerciseStats,
    suggestSession: suggestSession,
  };

  root.WorkoutPlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
