// ---- Живі підсумки для плиток головного екрана ----
//
// Головна була просто меню з чотирьох кнопок — а це екран, з якого заходять
// щоразу. Чотири числа на ньому відповідають на питання, заради яких людина
// й відкриває розділ: скільки лишилось цього місяця, чи є справи на сьогодні,
// чи ціла серія, коли востаннє тренувався.
//
// Тут — лише арифметика над уже прочитаними даними. Самі запити робить
// home.js: кожен звужений (місяць / сьогодні / останній запис), щоб плитки не
// коштували вичитування всієї бази на кожне відкриття.
//
// Файл підключається і як <script> у браузері, і як CommonJS-модуль у Jest.
(function (root) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** Перше число місяця, до якого належить дата. */
  function monthStart(iso) {
    return String(iso || '').slice(0, 7) + '-01';
  }

  /**
   * Баланс поточного місяця: скільки прийшло, скільки пішло, що лишилось.
   * @param {Array} transactions транзакції (уже звужені до місяця)
   * @param {string} todayIso
   */
  function budgetSummary(transactions, todayIso) {
    var from = monthStart(todayIso);
    var income = 0;
    var expense = 0;
    (transactions || []).forEach(function (tx) {
      if (!tx || typeof tx.date !== 'string' || tx.date < from || tx.date > todayIso) return;
      if (tx.type === 'income') income += num(tx.amount);
      else if (tx.type === 'expense') expense += num(tx.amount);
    });
    return { income: income, expense: expense, balance: income - expense };
  }

  /**
   * Справи на сьогодні. Прострочене рахуємо окремо: воно так само вимагає
   * уваги, але це інша новина, ніж «на сьогодні заплановано три».
   */
  function tasksSummary(tasks, todayIso) {
    var open = 0;
    var done = 0;
    var overdue = 0;
    (tasks || []).forEach(function (task) {
      if (!task || typeof task.dueDate !== 'string') return;
      if (task.dueDate === todayIso) {
        if (task.done) done += 1; else open += 1;
      } else if (task.dueDate < todayIso && !task.done) {
        overdue += 1;
      }
    });
    return { open: open, done: done, overdue: overdue };
  }

  /**
   * Скільки днів минуло від останнього тренування.
   * @returns {{daysAgo:number|null, lastDate:string|null}} null — тренувань ще не було
   */
  function workoutSummary(workouts, todayIso) {
    var last = null;
    (workouts || []).forEach(function (w) {
      if (!w || typeof w.date !== 'string') return;
      if (!last || w.date > last) last = w.date;
    });
    if (!last) return { daysAgo: null, lastDate: null };
    var a = new Date(last + 'T00:00:00');
    var b = new Date(todayIso + 'T00:00:00');
    var days = Math.round((b - a) / 86400000);
    return { daysAgo: days, lastDate: last };
  }

  /**
   * Цілі: найдовша активна серія і скільки сьогодні без кроку.
   * Серію рахує GoalStreak — своя друга реалізація розійшлася б із першою.
   */
  function goalsSummary(goals, todayIso, streakApi) {
    var api = streakApi || root.GoalStreak;
    if (!api) return { pending: 0, streak: 0, active: 0 };
    var digest = api.goalsDigest(goals, todayIso);
    var active = (goals || []).filter(function (g) { return g && g.status === 'active'; }).length;

    // Найдовша серед УСІХ активних цілей, а не лише тих, що під загрозою:
    // відмічена сьогодні серія — це добра новина, її й показуємо.
    var best = 0;
    (goals || []).forEach(function (g) {
      if (!g || g.status !== 'active') return;
      var n = api.computeStreak(g.checkins, todayIso);
      if (n > best) best = n;
    });
    return { pending: digest.pending, streak: best, active: active };
  }

  var api = {
    isoOf: isoOf,
    monthStart: monthStart,
    budgetSummary: budgetSummary,
    tasksSummary: tasksSummary,
    workoutSummary: workoutSummary,
    goalsSummary: goalsSummary,
  };
  root.HomeSummary = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
