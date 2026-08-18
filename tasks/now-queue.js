// ---- Черга «Зараз» ----
// Відповідає на питання «що мені робити прямо зараз?»: зі списку завдань
// вибирає впорядкованих кандидатів і рахує підсумок дня.
//
// Тут свідомо немає ні DOM, ні Firestore — тільки чисті функції від даних і
// поточного моменту. Через це порядок можна перевірити тестами, а не «на око»
// в застосунку (див. tasks/now-queue.test.js).
//
// Файл підключається і як <script> у браузері, і як CommonJS-модуль у Jest.
(function (root) {
  'use strict';

  // Умовний кінець дня: після цієї години «вільний час» вважаємо вичерпаним.
  // Не опівніч — плани на 23:50 не є реалістичними, і попередження про
  // перевантаження має спрацьовувати ДО того, як день фактично закінчився.
  var DAY_END_HOUR = 22;

  var PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  function pad2(n) {
    return String(n).padStart(2, '0');
  }
  function isoOf(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function hhmmOf(d) {
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // Група визначає порядок черги; всередині групи сортуємо однаково.
  // 0 — прострочене: воно вже підвело, тож іде першим.
  // 1 — сьогоднішнє, час якого вже настав.
  // 2 — сьогоднішнє, час якого попереду (найближче — вище).
  // 3 — сьогоднішнє без часу.
  // 4 — без дати: береться, лише якщо на сьогодні нічого не лишилось.
  function groupOf(task, todayIso, nowHhmm) {
    if (!task.dueDate) return 4;
    if (task.dueDate < todayIso) return 0;
    if (task.dueDate > todayIso) return null; // майбутнє — не «зараз»
    if (!task.dueTime) return 3;
    return task.dueTime <= nowHhmm ? 1 : 2;
  }

  function compare(a, b) {
    if (a.group !== b.group) return a.group - b.group;
    // У групі «час попереду» найближче за часом важливіше за пріоритет:
    // якщо о 15:00 зустріч, вона не стає менш терміновою від того, що
    // якесь інше завдання позначене «високим».
    if (a.group === 2 && a.task.dueTime !== b.task.dueTime) {
      return a.task.dueTime < b.task.dueTime ? -1 : 1;
    }
    var pa = PRIORITY_ORDER[a.task.priority] !== undefined ? PRIORITY_ORDER[a.task.priority] : 3;
    var pb = PRIORITY_ORDER[b.task.priority] !== undefined ? PRIORITY_ORDER[b.task.priority] : 3;
    if (pa !== pb) return pa - pb;
    // Коротше — вище: почати з п'ятихвилинної справи легше, ніж з двогодинної,
    // а зрушити з місця важливіше за ідеальний порядок.
    var ea = typeof a.task.estimateMin === 'number' ? a.task.estimateMin : Infinity;
    var eb = typeof b.task.estimateMin === 'number' ? b.task.estimateMin : Infinity;
    if (ea !== eb) return ea - eb;
    return (a.task.title || '').localeCompare(b.task.title || '');
  }

  /**
   * Впорядкована черга кандидатів на «зараз».
   * Завдання без дати потрапляють у чергу, лише якщо на сьогодні
   * (з урахуванням прострочених) уже нічого не лишилось.
   */
  function nowQueue(tasks, opts) {
    opts = opts || {};
    var now = opts.now instanceof Date ? opts.now : new Date();
    var todayIso = isoOf(now);
    var nowHhmm = hhmmOf(now);

    var entries = [];
    (tasks || []).forEach(function (task) {
      if (!task || task.done) return;
      var group = groupOf(task, todayIso, nowHhmm);
      if (group === null) return;
      entries.push({ task: task, group: group });
    });

    var scheduled = entries.filter(function (e) { return e.group < 4; });
    var pool = scheduled.length ? scheduled : entries;
    return pool.sort(compare).map(function (e) { return e.task; });
  }

  /** Скільки хвилин лишилось до умовного кінця дня (не менше нуля). */
  function minutesLeftToday(now) {
    var end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAY_END_HOUR, 0, 0);
    return Math.max(0, Math.round((end - now) / 60000));
  }

  /**
   * Підсумок дня: скільки зроблено, скільки лишилось часу за оцінками і чи
   * реалістичний план. Прострочене свідомо не додаємо в «сьогодні»: людина
   * має бачити навантаження на день, а не борг за весь місяць.
   */
  function daySummary(tasks, opts) {
    opts = opts || {};
    var now = opts.now instanceof Date ? opts.now : new Date();
    var todayIso = isoOf(now);

    var todays = (tasks || []).filter(function (t) { return t && t.dueDate === todayIso; });
    var done = todays.filter(function (t) { return t.done; });
    var left = todays.filter(function (t) { return !t.done; });

    var remainingMin = left.reduce(function (sum, t) {
      return sum + (typeof t.estimateMin === 'number' ? t.estimateMin : 0);
    }, 0);
    var freeMin = minutesLeftToday(now);
    var estimated = left.filter(function (t) { return typeof t.estimateMin === 'number'; }).length;

    return {
      doneCount: done.length,
      totalCount: todays.length,
      remainingMin: remainingMin,
      freeMin: freeMin,
      // Попереджаємо тільки коли є на чому базуватись: якщо жодне з
      // невиконаних завдань не має оцінки, сума 0 нічого не означає.
      overloaded: estimated > 0 && remainingMin > freeMin,
      overdueCount: (tasks || []).filter(function (t) {
        return t && !t.done && t.dueDate && t.dueDate < todayIso;
      }).length,
    };
  }

  function parseIso(iso) {
    var parts = String(iso || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(d) ? null : d;
  }

  /**
   * Сім днів тижня (понеділок -> неділя), у який потрапляє задана дата.
   * Тиждень скрізь у застосунку починається з понеділка.
   */
  function weekDaysOf(iso) {
    var d = parseIso(iso) || new Date();
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var weekday = d.getDay() === 0 ? 7 : d.getDay();
    var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (weekday - 1));
    var days = [];
    for (var i = 0; i < 7; i++) {
      days.push(isoOf(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
    }
    return days;
  }

  /** Скільки завдань на дату і скільки з них виконано — для позначок у рядку тижня. */
  function dayStats(tasks, iso) {
    var total = 0, done = 0;
    (tasks || []).forEach(function (t) {
      if (!t || t.dueDate !== iso) return;
      total++;
      if (t.done) done++;
    });
    return { total: total, done: done, allDone: total > 0 && total === done };
  }

  root.weekDaysOf = weekDaysOf;
  root.dayStats = dayStats;
  root.nowQueue = nowQueue;
  root.daySummary = daySummary;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      nowQueue: nowQueue, daySummary: daySummary, DAY_END_HOUR: DAY_END_HOUR,
      weekDaysOf: weekDaysOf, dayStats: dayStats,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
