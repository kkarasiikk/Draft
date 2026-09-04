// ---- Плани на тиждень ----
// Пункт, який треба зробити «цього тижня», але не в конкретний день: ідея,
// намір, справа без години. У базі це звичайне завдання, тільки замість
// `dueDate` в нього стоїть `weekStart` — понеділок свого тижня. Окрема
// колекція тут була б зайвою: галочка, підзадачі, теги й форма редагування
// потрібні йому ті самі, що й денному завданню, а дві майже однакові сутності
// довелося б синхронізувати вручну.
//
// Файл підключається і як звичайний <script> у браузері (кладе WeekPlan у
// window), і як CommonJS-модуль у Jest — тому тут немає ні import, ні export.
(function (root) {
  'use strict';

  function isoOf(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  /** Понеділок того тижня, у якому лежить дата. Тиждень скрізь у застосунку
   *  починається з понеділка — календар, смуга днів, і тут так само. */
  function weekStartOf(iso) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoOf(d);
  }

  function shiftWeeks(weekStartIso, delta) {
    var d = new Date(weekStartIso + 'T00:00:00');
    d.setDate(d.getDate() + delta * 7);
    return isoOf(d);
  }

  /** Неділя того ж тижня — потрібна лише для підпису «31 серпня — 6 вересня». */
  function weekEndOf(weekStartIso) {
    var d = new Date(weekStartIso + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    return isoOf(d);
  }

  /** Нотатка — не план: її не виконують, а читають. Тому в неї немає галочки
   *  і вона не переїжджає між тижнями (див. нижче). */
  function isNote(task) {
    return !!(task && task.kind === 'note');
  }

  /**
   * ПЛАНИ, які показує вкладка тижня.
   *
   * Незакритий пункт із МИНУЛОГО тижня переїжджає в поточний: саме про нього
   * треба памʼятати найбільше, а лишившись у своєму тижні, він тихо зникав би
   * з очей щопонеділка. Те саме правило, що й у місячних цілей
   * (goals/review.js), і свідомо не друге власне.
   *
   * Переїжджає лише в ПОТОЧНИЙ тиждень: гортаючи назад, людина дивиться на
   * той тиждень, який був, а не на звалище всього незробленого.
   * Виконане лишається там, де його зробили, — це вже історія.
   */
  function plansOfWeek(tasks, weekStartIso, opts) {
    var isCurrent = !!(opts && opts.currentWeekStart === weekStartIso);
    return (tasks || []).filter(function (task) {
      if (!task || typeof task.weekStart !== 'string' || isNote(task)) return false;
      if (task.weekStart === weekStartIso) return true;
      return isCurrent && task.weekStart < weekStartIso && !task.done;
    });
  }

  /**
   * НОТАТКИ того ж тижня.
   *
   * Переїзду тут немає свідомо: нотатка — це те, що ти думав ТОГО тижня, і
   * тягнути її за собою означало б поступово перетворити вкладку на стрічку
   * всього написаного за рік. Незроблений план — борг, а незабута думка —
   * запис на своєму місці.
   */
  function notesOfWeek(tasks, weekStartIso) {
    return (tasks || []).filter(function (task) {
      return isNote(task) && task.weekStart === weekStartIso;
    });
  }

  /** Чи приїхав пункт із давнішого тижня — тоді про це варто сказати. */
  function isCarried(task, weekStartIso) {
    return !!(task && typeof task.weekStart === 'string' && task.weekStart < weekStartIso);
  }

  var api = {
    isoOf: isoOf,
    weekStartOf: weekStartOf,
    weekEndOf: weekEndOf,
    shiftWeeks: shiftWeeks,
    plansOfWeek: plansOfWeek,
    notesOfWeek: notesOfWeek,
    isNote: isNote,
    isCarried: isCarried,
  };
  root.WeekPlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
