// ---- Тижневик ----
// Запис, який належить тижню, а не дню: план, намір, ідея, телефон майстра.
// У базі це звичайне завдання, тільки замість `dueDate` в нього стоїть
// `weekStart` — понеділок свого тижня, — а `weekCat` каже, у якій він
// категорії. Окрема колекція тут була б зайвою: галочка, підзадачі, теги й
// форма редагування потрібні йому ті самі, що й денному завданню, а дві майже
// однакові сутності довелося б синхронізувати вручну.
//
// Галочка є в КОЖНОГО запису, і це свідомо. Спершу тут були два види —
// «план» із галочкою і «нотатка» без неї, — але межа між ними виявилась
// вигаданою: та сама думка сьогодні просто думка, а завтра справа. Тепер
// відмітити можна будь-що, а можна не відмічати ніколи.
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
      if (!task || typeof task.weekStart !== 'string') return false;
      if (task.weekStart === weekStartIso) return true;
      return isCurrent && task.weekStart < weekStartIso && !task.done;
    });
  }

  /**
   * Записи, розкладені по категоріях — у порядку самих категорій.
   *
   * Категорії людина заводить сама («Дім», «Робота», «Ідеї»…), тож порядок
   * груп — той, у якому вона їх склала, а не алфавітний. Порожні групи не
   * малюються зовсім: список категорій — це не звіт про те, скільки їх є.
   *
   * Запис без категорії (або з такою, яку вже видалили) не зникає, а йде в
   * окрему групу в кінці: втратити написане через прибрану категорію було б
   * найгіршим, що ця вкладка може зробити.
   */
  function groupByCategory(entries, categories) {
    var known = {};
    (categories || []).forEach(function (cat) { if (cat && cat.id) known[cat.id] = true; });

    var groups = [];
    (categories || []).forEach(function (cat) {
      if (!cat || !cat.id) return;
      var list = (entries || []).filter(function (e) { return e && e.weekCat === cat.id; });
      if (list.length) groups.push({ id: cat.id, label: cat.label || cat.id, items: list });
    });

    var rest = (entries || []).filter(function (e) {
      return e && (!e.weekCat || !known[e.weekCat]);
    });
    if (rest.length) groups.push({ id: null, label: null, items: rest });
    return groups;
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
    groupByCategory: groupByCategory,
    isCarried: isCarried,
  };
  root.WeekPlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
