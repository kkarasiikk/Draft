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
   *  залежить від мови), власні зі списку — за стабільним id свого
   *  документа (перейменування не зʼїжджає), старі власні без customId —
   *  за нормалізованою назвою, як і раніше. */
  function exerciseKey(ex) {
    if (!ex) return '';
    if (ex.libId) return 'lib:' + ex.libId;
    if (ex.customId) return 'custom:' + ex.customId;
    return 'c:' + String(ex.name || '').trim().toLowerCase();
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
      // Тренування, записане наперед планом (усі підходи порожні), ще не
      // відбулось. Рахувати його зробленим означало б хвалити за намір —
      // і псувати порівняння «тренувань цього місяця проти минулого».
      var didWork = false;
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
          didWork = true;
          e.e1rm = Math.max(e.e1rm, epley1RM(w, r));
          e.tonnage += w * r;
          e.reps += r;
          m.tonnage += w * r;
          m.reps += r;
        });
      });
      if (didWork) count++;
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

  // ---- Що показує вкладка: наступне, минулі, міточки ----
  // Розділ перестав бути стрічкою однакових карток. Згори — тренування,
  // яке має бути, з вагами минулого разу; нижче зліва — минулі, справа —
  // календар лише з міточками. Числа для всіх трьох частин рахуються тут,
  // без DOM і без перекладів (див. progress.test.js).

  /** Тренування зроблене, щойно в ньому є хоч один підхід із повтореннями.
   *  Порожні підходи — це план, навіть якщо дата вже минула: намір і
   *  результат розрізняє робота, а не календар. */
  function isDone(session) {
    return (session && session.exercises || []).some(function (ex) {
      return (ex && ex.sets || []).some(function (set) { return num(set.reps) > 0; });
    });
  }

  /** Тоннаж: скільки кілограмів піднято за тренування. Одне число, яким
   *  тренування нарешті відрізняються одне від одного — раніше в кожної
   *  картки стояло однакове «6 вправ · 19 підходів». */
  function tonnage(session) {
    var total = 0;
    (session && session.exercises || []).forEach(function (ex) {
      (ex && ex.sets || []).forEach(function (set) {
        var r = num(set.reps);
        if (r > 0) total += num(set.weight) * r;
      });
    });
    return Math.round(total);
  }

  /** Зроблені підходи (для минулих) — порожні не рахуються. */
  function doneSetCount(session) {
    var n = 0;
    (session && session.exercises || []).forEach(function (ex) {
      (ex && ex.sets || []).forEach(function (set) { if (num(set.reps) > 0) n++; });
    });
    return n;
  }

  /** Усі підходи (для запланованого) — там жоден ще не зроблений. */
  function setCount(session) {
    var n = 0;
    (session && session.exercises || []).forEach(function (ex) {
      n += (ex && ex.sets || []).length;
    });
    return n;
  }

  /** Групи мʼязів тренування, у порядку, в якому людина набрала вправи. */
  function sessionMuscles(session) {
    var seen = {}, out = [];
    (session && session.exercises || []).forEach(function (ex) {
      var m = ex && ex.muscle;
      if (!m || seen[m]) return;
      seen[m] = true;
      out.push(m);
    });
    return out;
  }

  /**
   * Тренування, яке має бути. Спершу найближче заплановане від сьогодні
   * вперед — саме воно відповідає на «що мені робити». Якщо попереду
   * порожньо, беремо найсвіжіший невиконаний план із минулого: він нікуди
   * не подівся, і мовчки ховати його було б гірше, ніж показати з датою.
   */
  function nextSession(sessions, todayIso) {
    var planned = (sessions || []).filter(function (s) {
      return s && typeof s.date === 'string' && !isDone(s);
    });
    var ahead = planned.filter(function (s) { return s.date >= todayIso; })
      .sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    if (ahead.length) return ahead[0];
    var behind = planned.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
    return behind.length ? behind[0] : null;
  }

  /** Минулі тренування — тільки зроблені, від найсвіжішого. */
  function pastSessions(sessions) {
    return (sessions || []).filter(function (s) { return s && isDone(s); })
      .sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
  }

  /**
   * Що було минулого разу в цій вправі. Саме це треба знати, стоячи біля
   * штанги, і саме цього на вкладці не було: у плані ваги ще немає, тож
   * навпроти кожної вправи стояло «—».
   * @returns {weight, reps, date} або null
   */
  function lastResultFor(sessions, key, excludeId) {
    var best = null;
    (sessions || []).forEach(function (s) {
      if (!s || typeof s.date !== 'string') return;
      if (excludeId && s.id === excludeId) return;
      if (best && s.date < best.date) return;
      (s.exercises || []).forEach(function (ex) {
        if (exerciseKey(ex) !== key) return;
        var done = (ex.sets || []).filter(function (set) { return num(set.reps) > 0; });
        if (!done.length) return;
        var b = bestSet(done);
        var cand = { weight: num(b.weight), reps: num(b.reps), date: s.date };
        // Свіжіша дата виграє завжди; за рівних дат — важчий підхід, бо
        // порядок сесій у списку нічого не означає.
        var better = !best || cand.date > best.date
          || (cand.date === best.date && (cand.weight > best.weight
            || (cand.weight === best.weight && cand.reps > best.reps)));
        if (better) best = cand;
      });
    });
    return best;
  }

  /**
   * Найбільший приріст тренування проти попереднього разу — те, що варто
   * винести на картку: «+2,5 кг жим». Вправи з власною вагою міряються
   * повтореннями, бо кілограмів на штанзі там нуль.
   * @returns {key, libId, name, unit:'kg'|'reps', delta} або null
   */
  function topGain(sessions, session) {
    if (!session || !isDone(session)) return null;
    var earlier = (sessions || []).filter(function (s) {
      return s && s.id !== session.id && typeof s.date === 'string' && s.date <= session.date && isDone(s);
    });
    var best = null;
    (session.exercises || []).forEach(function (ex) {
      var key = exerciseKey(ex);
      if (!key) return;
      var done = (ex.sets || []).filter(function (set) { return num(set.reps) > 0; });
      if (!done.length) return;
      var now = bestSet(done);
      var prev = lastResultFor(earlier, key, session.id);
      if (!prev) return;
      var unit = (num(now.weight) > 0 || prev.weight > 0) ? 'kg' : 'reps';
      var delta = unit === 'kg'
        ? num(now.weight) - prev.weight
        : num(now.reps) - prev.reps;
      if (delta <= 0) return;
      if (!best || delta > best.delta) {
        best = { key: key, libId: ex.libId || null, name: ex.name || '', unit: unit, delta: Math.round(delta * 100) / 100 };
      }
    });
    return best;
  }

  /**
   * Міточки місяця: дата -> 'done' | 'planned'. Календар справа тепер лише
   * позначає дні, а не переказує їх, тож більше про день йому й не треба.
   * @param month — 'YYYY-MM'
   */
  function monthMarks(sessions, month) {
    var marks = {};
    (sessions || []).forEach(function (s) {
      if (!s || typeof s.date !== 'string' || s.date.slice(0, 7) !== month) return;
      // Зроблене перебиває заплановане: якщо того дня щось таки відбулось,
      // порожня крапка збрехала б.
      if (isDone(s)) marks[s.date] = 'done';
      else if (!marks[s.date]) marks[s.date] = 'planned';
    });
    return marks;
  }

  var api = {
    isDone: isDone,
    tonnage: tonnage,
    doneSetCount: doneSetCount,
    setCount: setCount,
    sessionMuscles: sessionMuscles,
    nextSession: nextSession,
    pastSessions: pastSessions,
    lastResultFor: lastResultFor,
    topGain: topGain,
    monthMarks: monthMarks,
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
