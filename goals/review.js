// ---- Темп цілі та щотижневий огляд ----
//
// Модуль називається «довгострокові цілі», а вся його механіка досі працювала
// з одним днем: серія, вечірнє «чи був крок», причини пропуску. Ціль із
// дедлайном через вісім місяців отримувала щовечора «так/ні» — і попередження
// за три дні до кінця. Між ними не було нічого: застосунок знав і дедлайн, і
// прогрес, але ніде не рахував звʼязок між ними.
//
// Тут — саме цей звʼязок:
//   pace()         чи встигаєш до дедлайну таким темпом;
//   weekMovement() що зрушило за тиждень;
//   reviewQueue()  про які цілі час спитати «ти досі цього хочеш».
//
// Ні DOM, ні Firestore — тільки чисті функції від даних і поточної дати
// (див. goals/review.test.js). Той самий модуль читає й AI-помічник: інакше
// в чаті звучала б одна оцінка темпу, а на екрані стояла інша.
(function (root) {
  'use strict';

  // Раз на тиждень. Частіше — це вже не огляд, а те саме вечірнє питання;
  // рідше — і ціль встигає протухнути непоміченою.
  var REVIEW_PERIOD_DAYS = 7;

  // Скільки днів історії треба, щоб узагалі говорити про темп. Два записи за
  // три дні — це не темп, це збіг; прогноз на них збрехав би впевненим тоном.
  var MIN_HISTORY_DAYS = 7;
  var MIN_PROGRESS_ENTRIES = 2;

  // Наскільки прогрес може відставати від часу, і це ще «в графіку». Рівно
  // нуль означав би, що будь-який день відпочинку робить людину боржником.
  var BEHIND_GAP_PCT = 15;
  var AHEAD_GAP_PCT = 10;

  // Арифметика дат живе в streak.js — другої копії «що таке локальний день»
  // у проєкті бути не повинно. У браузері модуль уже в window, у Jest
  // підтягуємо через require.
  function streak() {
    var api = root.GoalStreak;
    if (!api && typeof require !== 'undefined') {
      try { api = require('./streak.js'); } catch (err) { api = null; }
    }
    return api;
  }

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function clampPct(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  /** Найраніший слід життя цілі в самих даних — коли createdAt не передали. */
  function earliestSignal(goal) {
    var dates = [];
    ((goal && goal.progressLog) || []).forEach(function (e) {
      if (e && typeof e.date === 'string') dates.push(e.date);
    });
    ((goal && goal.checkins) || []).forEach(function (d) {
      if (typeof d === 'string') dates.push(d);
    });
    dates.sort();
    return dates.length ? dates[0] : null;
  }

  /** Прогрес цілі у відсотках плюс сирі числа. Дзеркалить progressOf зі
   *  сторінки: числова мета важливіша за віхи, бо коли людина задала «10 км»,
   *  відсоток має рахуватись від пройденого, а не від кількості придуманих
   *  кроків. */
  function progressPct(goal) {
    var target = num(goal && goal.targetValue);
    if (target > 0) {
      var current = num(goal && goal.currentValue);
      return {
        kind: 'value',
        pct: clampPct((current / target) * 100),
        current: current,
        target: target,
        remaining: Math.max(0, target - current),
      };
    }
    var milestones = (goal && goal.milestones) || [];
    if (!milestones.length) return null;
    var done = milestones.filter(function (m) { return m && m.done; }).length;
    return {
      kind: 'milestones',
      pct: clampPct((done / milestones.length) * 100),
      done: done,
      total: milestones.length,
      remaining: milestones.length - done,
    };
  }

  /** Сума прогресу, набраного за останні `days` днів. */
  function progressSince(goal, fromIso) {
    var sum = 0;
    ((goal && goal.progressLog) || []).forEach(function (e) {
      if (e && typeof e.date === 'string' && e.date >= fromIso) sum += num(e.delta);
    });
    return sum;
  }

  /**
   * Чи встигаєш до дедлайну.
   *
   * Повертає null, коли говорити нема про що: немає дедлайну (тоді темп ні з
   * чим порівнювати), ціль уже закрита або в архіві, або в ній немає жодного
   * способу міряти прогрес.
   *
   * `verdict` навмисно окремо від чисел: сторінці треба слово, а помічнику —
   * цифри, і хай обидва беруть їх звідси, а не рахують самі.
   *
   * @param {Object} goal
   * @param {string} todayIso
   * @param {{startIso?: string}} [opts] коли ціль заведено (createdAt); без
   *   нього беремо найраніший слід у самих даних
   */
  function pace(goal, todayIso, opts) {
    if (!goal || !goal.targetDate) return null;
    if (goal.status === 'done' || goal.status === 'archived') return null;

    var S = streak();
    if (!S) return null;

    var prog = progressPct(goal);
    if (!prog) return null;

    var daysLeft = S.daysBetween(todayIso, goal.targetDate);
    var startIso = (opts && opts.startIso) || earliestSignal(goal) || todayIso;
    // Дедлайн у минулому або старт пізніше за дедлайн — ділити нема на що.
    var totalDays = Math.max(1, S.daysBetween(startIso, goal.targetDate));
    var elapsed = Math.max(0, S.daysBetween(startIso, todayIso));
    var timePct = clampPct((elapsed / totalDays) * 100);

    var out = {
      kind: prog.kind,
      pct: prog.pct,
      timePct: timePct,
      daysLeft: daysLeft,
      overdue: daysLeft < 0,
      // «Є прогноз із конкретною датою». Запасний шлях (частка часу проти
      // частки роботи) дати не дає, тож там лишається false.
      enough: false,
      ratePerDay: null,
      requiredPerDay: null,
      projectedDate: null,
      diffDays: null,
      verdict: 'unknown',
    };

    // Прострочене — це вже не прогноз, а факт. Прогнозувати тут означало б
    // ховати головне за арифметикою.
    if (daysLeft < 0 && prog.pct < 100) {
      out.verdict = 'overdue';
      return out;
    }
    if (prog.pct >= 100) {
      out.verdict = 'ahead';
      return out;
    }

    if (prog.kind === 'value') {
      var log = (goal.progressLog || []).filter(function (e) {
        return e && typeof e.date === 'string';
      });
      var dates = log.map(function (e) { return e.date; }).sort();
      var spanDays = dates.length ? S.daysBetween(dates[0], todayIso) : 0;

      out.requiredPerDay = daysLeft > 0 ? prog.remaining / daysLeft : null;

      if (log.length >= MIN_PROGRESS_ENTRIES && spanDays >= MIN_HISTORY_DAYS) {
        var gained = 0;
        log.forEach(function (e) { gained += num(e.delta); });
        // Ділимо на прожиті дні, а не на кількість записів: темп — це
        // «скільки на день», а не «скільки за підхід».
        var rate = gained / Math.max(1, spanDays);
        if (rate > 0) {
          out.enough = true;
          out.ratePerDay = rate;
          var daysNeeded = Math.ceil(prog.remaining / rate);
          out.projectedDate = S.shift(todayIso, daysNeeded);
          out.diffDays = S.daysBetween(goal.targetDate, out.projectedDate);
          out.verdict = out.diffDays > 0 ? 'behind' : (out.diffDays < -Math.round(totalDays * 0.1) ? 'ahead' : 'onTrack');
          return out;
        }
        // Записи є, а руху нема (усе в нуль або назад) — це теж відповідь.
        out.enough = true;
        out.ratePerDay = 0;
        out.verdict = 'behind';
        return out;
      }
    }

    // Спільний запасний шлях: порівнюємо частку пройденого шляху з часткою
    // витраченого часу. Він не потребує ЖОДНИХ нових даних і однаково працює
    // для віх — саме тому «вивчити польську» теж отримує чесну оцінку.
    //
    // Але не з першого дня: у щойно заведеної цілі часу минуло 0%, і будь-яка
    // закрита віха читалась би як «випереджаєш графік». Це той самий поріг, що
    // й для числового темпу, — поки історії мало, застосунок мовчить.
    if (elapsed < MIN_HISTORY_DAYS) return out;

    // enough лишається false: воно означає рівно «є прогноз із датою», а
    // запасний шлях дати не дає — він порівнює частки. Висновок несе verdict.
    var gap = timePct - prog.pct;
    if (gap > BEHIND_GAP_PCT) out.verdict = 'behind';
    else if (gap < -AHEAD_GAP_PCT) out.verdict = 'ahead';
    else out.verdict = 'onTrack';
    return out;
  }

  /**
   * Що зрушило за останні `days` днів. Саме це показує екран огляду: не «як
   * справи», а перелік того, що реально сталося, — і чесне «нічого», коли
   * нічого.
   */
  function weekMovement(goal, todayIso, days) {
    var S = streak();
    if (!S) return null;
    var span = days || REVIEW_PERIOD_DAYS;
    var from = S.shift(todayIso, -(span - 1));

    var checkins = ((goal && goal.checkins) || []).filter(function (d) {
      return typeof d === 'string' && d >= from && d <= todayIso;
    }).length;

    var milestonesDone = ((goal && goal.milestones) || []).filter(function (m) {
      return m && m.done && typeof m.doneAt === 'string' && m.doneAt >= from && m.doneAt <= todayIso;
    }).length;

    // Записи щоденника мають createdAt у мілісекундах (serverTimestamp
    // усередині елемента масиву Firestore заборонений), тож день доводиться
    // діставати з Date, а не порівнювати рядки.
    var journal = ((goal && goal.journal) || []).filter(function (e) {
      if (!e || typeof e.createdAt !== 'number') return false;
      var day = S.isoOf(new Date(e.createdAt));
      return day >= from && day <= todayIso;
    }).length;

    var progressDelta = progressSince(goal, from);

    return {
      from: from,
      checkins: checkins,
      milestonesDone: milestonesDone,
      journal: journal,
      progressDelta: progressDelta,
      moved: checkins > 0 || milestonesDone > 0 || progressDelta > 0,
    };
  }

  /** Скільки днів минуло від останнього огляду. null — не оглядали жодного разу. */
  function daysSinceReview(goal, todayIso) {
    var S = streak();
    if (!S) return null;
    var last = goal && goal.reviewedAt;
    if (typeof last !== 'string' || last.length !== 10) return null;
    return S.daysBetween(last, todayIso);
  }

  /**
   * Про які цілі час спитати. Той самий підхід, що й «розбір минулих днів» у
   * завданнях і «регулярні операції» в бюджеті: застосунок КАЖЕ, що настало,
   * але нічого не вирішує сам.
   *
   * Закриті й архівні не питаємо — там нема чого вирішувати. Паузу питаємо:
   * саме її й треба колись зняти, інакше пауза тихо стає архівом.
   */
  function reviewQueue(goals, todayIso, opts) {
    var period = (opts && opts.periodDays) || REVIEW_PERIOD_DAYS;
    return (goals || []).filter(function (g) {
      if (!g || (g.status !== 'active' && g.status !== 'paused')) return false;
      var since = daysSinceReview(g, todayIso);
      return since === null || since >= period;
    });
  }

  /**
   * Один рядок огляду: ціль, що зрушило, як із темпом. Зібрано тут, а не на
   * сторінці, щоб те саме міг показати помічник.
   */
  function reviewItem(goal, todayIso, opts) {
    return {
      id: goal && goal.id,
      title: (goal && goal.title) || '',
      why: (goal && goal.why) || '',
      status: goal && goal.status,
      movement: weekMovement(goal, todayIso, opts && opts.periodDays),
      pace: pace(goal, todayIso, opts),
    };
  }

  /** Чи є про що показувати банер, і скільки там пунктів. */
  function reviewDigest(goals, todayIso, opts) {
    var queue = reviewQueue(goals, todayIso, opts);
    var stalled = 0;
    queue.forEach(function (g) {
      var m = weekMovement(g, todayIso, opts && opts.periodDays);
      if (m && !m.moved) stalled += 1;
    });
    return { pending: queue.length, stalled: stalled };
  }

  var api = {
    REVIEW_PERIOD_DAYS: REVIEW_PERIOD_DAYS,
    MIN_HISTORY_DAYS: MIN_HISTORY_DAYS,
    MIN_PROGRESS_ENTRIES: MIN_PROGRESS_ENTRIES,
    progressPct: progressPct,
    progressSince: progressSince,
    pace: pace,
    weekMovement: weekMovement,
    daysSinceReview: daysSinceReview,
    reviewQueue: reviewQueue,
    reviewItem: reviewItem,
    reviewDigest: reviewDigest,
  };

  root.GoalReview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
