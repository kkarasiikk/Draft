// ---- Чи я реально став сильнішим ----
// Записів у застосунку вистачає, а відповіді на головне питання не було:
// список тренувань — це дані, а не розуміння. Цей модуль зводить історію до
// кількох чисел, які можна прочитати за секунду: сила за вправами, обсяг за
// групами мʼязів і одне речення про те, куди все рухається.
//
// Порівнюємо два однакові вікна по 28 днів: останній місяць проти
// попереднього. Саме так людина й думає про свій прогрес — «краще, ніж
// місяць тому», а не «краще, ніж 17 серпня».
//
// Ні DOM, ні Firestore, ні перекладів тут немає — тільки числа й ключі
// (див. workout/progress.test.js). Назви підставляє сторінка.
(function (root) {
  'use strict';

  var WINDOW_DAYS = 28;
  // Скільки тренувань має бути в свіжому вікні, щоб узагалі щось казати.
  // З одного тренування «тренд» вигадується, а не рахується.
  var MIN_SESSIONS = 2;
  // Нижче цього порогу зміна — це шум ваги й сну, а не прогрес.
  var FLAT_PCT = 2;

  function pad2(n) { return String(n).padStart(2, '0'); }

  function parseISO(s) {
    if (!s) return new Date(NaN);
    var p = String(s).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function shift(iso, days) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** Оцінка одноповторного максимуму за Еплі. Одне число замість пари
   *  «вага × повторення» — інакше 80×8 і 90×3 нічим не порівняти. */
  function epley1RM(weight, reps) {
    if (!weight || !reps) return 0;
    return weight * (1 + reps / 30);
  }

  /** Ключ вправи для групування: бібліотечні — за стабільним id (не
   *  залежить від мови), власні — за нормалізованою назвою. */
  function exerciseKey(ex) {
    if (!ex) return '';
    return ex.libId ? 'lib:' + ex.libId : 'c:' + String(ex.name || '').trim().toLowerCase();
  }

  function bestSet(sets) {
    if (!sets || !sets.length) return null;
    return sets.slice().sort(function (a, b) {
      return (num(b.weight) - num(a.weight)) || (num(b.reps) - num(a.reps));
    })[0];
  }

  function pctChange(now, prev) {
    if (!prev) return null;
    return Math.round(((now - prev) / prev) * 100);
  }

  /** Зводить вікно сесій до показників по вправах і по мʼязах. */
  function summarize(sessions) {
    var byExercise = {};
    var byMuscle = {};
    var count = 0;

    sessions.forEach(function (session) {
      count++;
      (session.exercises || []).forEach(function (ex) {
        var key = exerciseKey(ex);
        if (!key) return;
        var muscle = ex.muscle || 'other';
        var e = byExercise[key] || (byExercise[key] = {
          key: key, libId: ex.libId || null, name: ex.name || '', muscle: muscle, e1rm: 0, tonnage: 0, reps: 0,
        });
        var m = byMuscle[muscle] || (byMuscle[muscle] = { muscle: muscle, tonnage: 0, reps: 0 });

        (ex.sets || []).forEach(function (set) {
          var w = num(set.weight);
          var r = num(set.reps);
          if (r <= 0) return;
          e.e1rm = Math.max(e.e1rm, epley1RM(w, r));
          e.tonnage += w * r;
          e.reps += r;
          m.tonnage += w * r;
          m.reps += r;
        });
      });
    });

    return { sessions: count, byExercise: byExercise, byMuscle: byMuscle };
  }

  function inRange(iso, from, to) {
    return typeof iso === "string" && iso >= from && iso <= to;
  }

  /**
   * Головна функція: два вікна по 28 днів і висновок.
   * @param sessions — усі тренування [{ date, exercises: [{libId,name,muscle,sets}] }]
   * @param todayIso — «сьогодні» у вигляді YYYY-MM-DD
   */
  function analyze(sessions, todayIso) {
    var list = sessions || [];
    var nowFrom = shift(todayIso, -(WINDOW_DAYS - 1));
    var prevTo = shift(todayIso, -WINDOW_DAYS);
    var prevFrom = shift(todayIso, -(WINDOW_DAYS * 2 - 1));

    var now = summarize(list.filter(function (s) { return inRange(s && s.date, nowFrom, todayIso); }));
    var prev = summarize(list.filter(function (s) { return inRange(s && s.date, prevFrom, prevTo); }));

    // Вправи, які були в обох вікнах: тільки їх і можна порівнювати.
    // Вправа, яку почали робити цього місяця, «зростання» не показує —
    // їй просто нема з чим порівнюватись.
    var exercises = Object.keys(now.byExercise).map(function (key) {
      var e = now.byExercise[key];
      var p = prev.byExercise[key];
      return {
        key: key, libId: e.libId, name: e.name, muscle: e.muscle,
        e1rm: Math.round(e.e1rm * 10) / 10,
        prevE1rm: p ? Math.round(p.e1rm * 10) / 10 : null,
        pct: p ? pctChange(e.e1rm, p.e1rm) : null,
        tonnage: Math.round(e.tonnage),
        reps: e.reps,
      };
    }).sort(function (a, b) {
      // Спершу те, що змінилось найпомітніше; вправи без порівняння — в кінець.
      if ((a.pct === null) !== (b.pct === null)) return a.pct === null ? 1 : -1;
      if (a.pct === null) return b.e1rm - a.e1rm;
      return b.pct - a.pct;
    });

    var compared = exercises.filter(function (e) { return e.pct !== null; });
    var strengthPct = compared.length
      ? Math.round(compared.reduce(function (sum, e) { return sum + e.pct; }, 0) / compared.length)
      : null;

    var muscles = Object.keys(now.byMuscle).concat(
      Object.keys(prev.byMuscle).filter(function (m) { return !now.byMuscle[m]; })
    ).map(function (muscle) {
      var n = now.byMuscle[muscle] || { tonnage: 0, reps: 0 };
      var p = prev.byMuscle[muscle] || { tonnage: 0, reps: 0 };
      // Вправи з власною вагою тоннажу не дають зовсім: підтягування — це
      // нуль кілограмів на штанзі. Для таких груп міряємо повтореннями,
      // інакше «обсяг 0 кг» виглядав би як відсутність роботи.
      var byTonnage = n.tonnage > 0 || p.tonnage > 0;
      return {
        muscle: muscle,
        unit: byTonnage ? 'kg' : 'reps',
        now: byTonnage ? Math.round(n.tonnage) : n.reps,
        prev: byTonnage ? Math.round(p.tonnage) : p.reps,
        pct: pctChange(byTonnage ? n.tonnage : n.reps, byTonnage ? p.tonnage : p.reps),
      };
    }).sort(function (a, b) { return b.now - a.now; });

    var enough = now.sessions >= MIN_SESSIONS && compared.length > 0;
    var verdict = 'flat';
    if (strengthPct !== null) {
      if (strengthPct >= FLAT_PCT) verdict = 'up';
      else if (strengthPct <= -FLAT_PCT) verdict = 'down';
    }

    return {
      enough: enough,
      needSessions: Math.max(0, MIN_SESSIONS - now.sessions),
      windowDays: WINDOW_DAYS,
      sessionsNow: now.sessions,
      sessionsPrev: prev.sessions,
      strengthPct: strengthPct,
      comparedCount: compared.length,
      verdict: verdict,
      exercises: exercises,
      muscles: muscles,
    };
  }

  function daysBetween(fromIso, toIso) {
    return Math.round((parseISO(toIso) - parseISO(fromIso)) / 86400000);
  }

  /** Коли кожну групу мʼязів тренували востаннє й скільки днів тому.
   *  Дивиться на всю історію, а не на вікно: група, якої не було два
   *  місяці, — це теж відповідь, і найважливіша. */
  function restByMuscle(sessions, todayIso) {
    var last = {};
    (sessions || []).forEach(function (session) {
      if (!session || typeof session.date !== 'string') return;
      (session.exercises || []).forEach(function (ex) {
        // Вправа без жодного зробленого повторення тренуванням не була.
        var worked = (ex.sets || []).some(function (set) { return num(set.reps) > 0; });
        if (!worked) return;
        var m = ex.muscle || 'other';
        if (!last[m] || session.date > last[m]) last[m] = session.date;
      });
    });
    return Object.keys(last).map(function (muscle) {
      return { muscle: muscle, lastDate: last[muscle], daysAgo: daysBetween(last[muscle], todayIso) };
    }).sort(function (a, b) { return b.daysAgo - a.daysAgo; });
  }

  var api = {
    daysBetween: daysBetween,
    restByMuscle: restByMuscle,
    WINDOW_DAYS: WINDOW_DAYS,
    MIN_SESSIONS: MIN_SESSIONS,
    FLAT_PCT: FLAT_PCT,
    epley1RM: epley1RM,
    exerciseKey: exerciseKey,
    bestSet: bestSet,
    pctChange: pctChange,
    summarize: summarize,
    analyze: analyze,
  };

  root.WorkoutProgress = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
