// ---- Історія й статистика завдань ----
// Відповідає на питання «що я зробив» (а не звичне «що не встиг») і рахує
// особисту норму — скільки справ людина реально закриває за день.
//
// Навіщо норма: попередження про перевантаження досі порівнювало план із
// часом до 22:00, ніби всі ці години робочі. Норма з власної історії чесніша:
// «зазвичай ти закриваєш 4 справи, а заплановано 9».
//
// Як і now-queue.js, тут немає ні DOM, ні Firestore — лише чисті функції від
// даних (див. tasks/stats.test.js). Файл підключається і як <script>
// у браузері, і як CommonJS-модуль у Jest.
(function (root) {
  'use strict';

  // Скільки днів історії враховуємо в нормі. Місяць — компроміс: досить,
  // щоб згладити випадковий тиждень, і не так багато, щоб тягнути за собою
  // темп, у якому людина жила пів року тому.
  var NORM_WINDOW_DAYS = 28;
  // Менше цього — це ще не статистика, а кілька випадкових днів.
  var NORM_MIN_ACTIVE_DAYS = 5;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }
  function isoOf(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function parseIso(iso) {
    var parts = String(iso || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(d) ? null : d;
  }
  function shiftIso(iso, days) {
    var d = parseIso(iso);
    if (!d) return iso;
    return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
  }

  /**
   * День виконання завдання як 'YYYY-MM-DD' у місцевому часі.
   * completedAt приходить у різних виглядах: Timestamp з Firestore (.toDate()),
   * Date після локального запису, або {seconds} з кешу — тому нормалізуємо тут,
   * а не в кожному місці, де рахується статистика.
   */
  function completedIso(task) {
    if (!task || !task.done) return null;
    var raw = task.completedAt;
    if (!raw) return null;
    var d = null;
    if (raw instanceof Date) d = raw;
    else if (typeof raw.toDate === 'function') { try { d = raw.toDate(); } catch (e) { d = null; } }
    else if (typeof raw.seconds === 'number') d = new Date(raw.seconds * 1000);
    else if (typeof raw === 'string') d = parseIso(raw.slice(0, 10)) || new Date(raw);
    else if (typeof raw === 'number') d = new Date(raw);
    return d && !isNaN(d) ? isoOf(d) : null;
  }

  /**
   * Невиконані завдання з минулих днів — те, що треба розібрати.
   * Спершу найдавніші: борг, який висить два тижні, важливіший за вчорашній.
   */
  function carryOver(tasks, opts) {
    opts = opts || {};
    var today = opts.today || isoOf(new Date());
    var prio = { high: 0, medium: 1, low: 2 };
    return (tasks || [])
      .filter(function (t) { return t && !t.done && t.dueDate && t.dueDate < today; })
      .sort(function (a, b) {
        if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        var pa = prio[a.priority] !== undefined ? prio[a.priority] : 3;
        var pb = prio[b.priority] !== undefined ? prio[b.priority] : 3;
        if (pa !== pb) return pa - pb;
        return (a.title || '').localeCompare(b.title || '');
      });
  }

  /** Скільки завдань закрито в конкретний день. */
  function doneOn(tasks, iso) {
    var n = 0;
    (tasks || []).forEach(function (t) { if (completedIso(t) === iso) n++; });
    return n;
  }

  /**
   * Останні N днів як [{iso, count}] від найдавнішого до сьогодні —
   * готовий ряд для стовпчиків.
   */
  function historyDays(tasks, opts) {
    opts = opts || {};
    var today = opts.today || isoOf(new Date());
    var days = opts.days > 0 ? Math.floor(opts.days) : 14;
    var counts = {};
    (tasks || []).forEach(function (t) {
      var iso = completedIso(t);
      if (iso) counts[iso] = (counts[iso] || 0) + 1;
    });
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var iso = shiftIso(today, -i);
      out.push({ iso: iso, count: counts[iso] || 0 });
    }
    return out;
  }

  /**
   * Серія днів поспіль, у які закрито хоча б одну справу.
   * Сьогоднішній день не обов'язковий: о 9 ранку серія ще не порвана, просто
   * сьогодні ще нічого не зроблено — інакше лічильник щоранку падав би в нуль.
   */
  function streakDays(tasks, opts) {
    opts = opts || {};
    var today = opts.today || isoOf(new Date());
    var counts = {};
    (tasks || []).forEach(function (t) {
      var iso = completedIso(t);
      if (iso) counts[iso] = (counts[iso] || 0) + 1;
    });
    var includesToday = !!counts[today];
    var cursor = includesToday ? today : shiftIso(today, -1);
    var days = 0;
    // Обмеження на випадок зіпсованих дат — щоб цикл не став вічним.
    while (counts[cursor] && days < 3650) {
      days++;
      cursor = shiftIso(cursor, -1);
    }
    return { days: days, includesToday: includesToday };
  }

  function median(list) {
    var sorted = list.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  /**
   * Особиста норма: скільки справ людина закриває за робочий день.
   * Медіана, а не середнє — один героїчний день з 15 справами не має
   * задирати планку на весь місяць. Дні без жодної закритої справи в
   * розрахунок не входять: норма відповідає на «скільки встигаю, коли
   * працюю», а не «скільки в середньому по календарю».
   * Поки історії мало — повертаємо null, і застосунок просто мовчить.
   */
  function personalNorm(tasks, opts) {
    opts = opts || {};
    var today = opts.today || isoOf(new Date());
    var window = opts.days > 0 ? Math.floor(opts.days) : NORM_WINDOW_DAYS;
    var minActive = opts.minActiveDays > 0 ? Math.floor(opts.minActiveDays) : NORM_MIN_ACTIVE_DAYS;
    var active = historyDays(tasks, { today: today, days: window })
      .filter(function (d) { return d.count > 0; })
      .map(function (d) { return d.count; });
    if (active.length < minActive) return null;
    return median(active);
  }

  /**
   * Підсумок для екрана статистики: сьогодні, цей тиждень (з понеділка),
   * серія і норма — усе, що потрібно, щоб побачити «я рухаюсь».
   */
  function statsSummary(tasks, opts) {
    opts = opts || {};
    var today = opts.today || isoOf(new Date());
    var d = parseIso(today) || new Date();
    var weekday = d.getDay() === 0 ? 7 : d.getDay();
    var weekDone = 0;
    for (var i = 0; i < weekday; i++) weekDone += doneOn(tasks, shiftIso(today, -i));
    var streak = streakDays(tasks, { today: today });
    return {
      todayDone: doneOn(tasks, today),
      weekDone: weekDone,
      totalDone: (tasks || []).filter(function (t) { return !!completedIso(t); }).length,
      streak: streak.days,
      streakIncludesToday: streak.includesToday,
      norm: personalNorm(tasks, { today: today }),
      overdue: carryOver(tasks, { today: today }).length,
    };
  }

  root.completedIso = completedIso;
  root.carryOver = carryOver;
  root.doneOn = doneOn;
  root.historyDays = historyDays;
  root.streakDays = streakDays;
  root.personalNorm = personalNorm;
  root.statsSummary = statsSummary;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      completedIso: completedIso, carryOver: carryOver, doneOn: doneOn,
      historyDays: historyDays, streakDays: streakDays, personalNorm: personalNorm,
      statsSummary: statsSummary,
      NORM_WINDOW_DAYS: NORM_WINDOW_DAYS, NORM_MIN_ACTIVE_DAYS: NORM_MIN_ACTIVE_DAYS,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
