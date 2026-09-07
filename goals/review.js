// ---- Цілі: чисті обчислення ----
//
// Усе, що в розділі цілей рахується від даних і поточної дати, живе тут:
// арифметика днів, місяць цілі, тривалість закритої цілі, ретроспектива й
// попередження про дедлайн. Ні DOM, ні Firestore — тільки чисті функції
// (див. goals/review.test.js).
//
// Той самий модуль читає AI-помічник і розсилка нагадувань на сервері:
// інакше в чаті звучала б одна оцінка, у сповіщенні друга, а на екрані
// третя.
//
// Раніше поруч лежав goals/streak.js — серія, рятунок серії, вечірня черга
// «чи був сьогодні крок». Серії більше немає: ціль рухають не щоденні
// галочки, а те, що людина записує в нотатках, і власний статус цілі. Разом
// із серією пішли й похідні від неї — сітка відміток, причини пропусків,
// «довга перерва». Арифметика дат була в тому ж файлі й до серії стосунку не
// мала, тож переїхала сюди.
(function (root) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }

  /** Локальна дата як YYYY-MM-DD. Саме локальна: `toISOString()` у поясах
   *  на схід від Гринвіча ввечері вже показує завтра. */
  function isoOf(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  /** Парсить "YYYY-MM-DD" як локальну дату — на відміну від `new Date(s)`,
   *  який трактує рядок як UTC-північ і зсуває день назад на заході. */
  function parseISO(s) {
    if (!s) return new Date(NaN);
    var parts = String(s).split('-').map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function shift(iso, days) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return isoOf(d);
  }

  function daysBetween(fromIso, toIso) {
    return Math.round((parseISO(toIso) - parseISO(fromIso)) / 86400000);
  }

  /**
   * Дедлайн місячної цілі — останній день її місяця.
   *
   * Окремого поля «до якого числа» більше немає, і не тому, що дедлайн
   * перестав існувати, а тому, що для місячної цілі він і так уже сказаний:
   * «зробити в серпні» означає «до 31 серпня». Питати про це вдруге означало б
   * просити людину повторити те, що вона щойно ввела вибором місяця.
   *
   * Річна ціль місяця не має, тож і дедлайну не отримує: рік — це напрямок,
   * а не строк, і вигадувати їй 31 грудня було б припущенням, а не фактом.
   *
   * @param {string} monthKey 'YYYY-MM'
   * @returns {string|null} 'YYYY-MM-DD' або null, якщо місяць не заданий
   */
  function deadlineForMonth(monthKey) {
    if (typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
    var year = Number(monthKey.slice(0, 4));
    var month = Number(monthKey.slice(5, 7));
    if (!year || month < 1 || month > 12) return null;
    // Нульовий день наступного місяця — це останній день цього, і рахувати
    // високосні роки вручну не доводиться.
    var last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return monthKey + '-' + (last < 10 ? '0' + last : String(last));
  }

  /** Найраніший слід життя цілі в самих даних — коли createdAt не передали.
   *
   *  progressLog тут читається як спадщина: числової мети більше немає й нових
   *  записів не буває, але в цілей, заведених раніше, вони лежать — і це такі
   *  самі справжні дати життя цілі, як чекіни. Викинути їх означало б
   *  «омолодити» стару ціль на кілька місяців. Те саме нижче в latestSignal
   */
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

  /** Найпізніший слід життя цілі — коли дати закриття в записі немає. */
  function latestSignal(goal) {
    var dates = [];
    ((goal && goal.progressLog) || []).forEach(function (e) {
      if (e && typeof e.date === 'string') dates.push(e.date);
    });
    ((goal && goal.checkins) || []).forEach(function (d) {
      if (typeof d === 'string') dates.push(d);
    });
    dates.sort();
    return dates.length ? dates[dates.length - 1] : null;
  }

  /**
   * Місяць, до якого належить місячна ціль, як 'YYYY-MM'.
   *
   * Вкладка «Місяць» довго була просто другим списком: горизонт казав, що
   * ціль місячна, але не казав ЯКОГО місяця, тож березнева ціль лежала поруч
   * із серпневою й «цілі на місяць» означало «цілі на будь-який місяць».
   *
   * Старі документи поля не мають — беремо місяць, коли ціль завели. Це не
   * здогадка: місячну ціль заводять на той місяць, у якому заводять.
   */
  function monthKeyOf(goal, opts) {
    var m = goal && goal.month;
    if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) return m;
    var startIso = (opts && opts.startIso) || null;
    return startIso && startIso.length >= 7 ? startIso.slice(0, 7) : null;
  }

  /**
   * Цілі місяця, який зараз дивляться.
   *
   * У ПОТОЧНОМУ місяці показуємо ще й незакриті цілі з минулих: інакше
   * липнева ціль, яку не встигли, першого серпня тихо зникла б з очей — а це
   * рівно та ціль, про яку треба памʼятати найбільше. У минулих місяцях
   * такого перенесення немає: там показуємо, що було саме тоді.
   *
   * Перенесена ціль лишається у видимому місяці й ПІСЛЯ того, як її закрили:
   * інакше вийшло б, що людина ставить липневій цілі «Виконано» — і та
   * зникає з екрана тієї ж миті, ніби дію не зарахували. `completedAt`
   * пишеться і для «виконано», і для «не виконано»: це день, коли питання
   * закрили, яким би не була відповідь.
   *
   * @param {Array} goals
   * @param {string} monthKey 'YYYY-MM', який дивляться
   * @param {{currentMonth?: string, startIsoOf?: function}} [opts]
   */
  function goalsOfMonth(goals, monthKey, opts) {
    var isCurrent = !!(opts && opts.currentMonth === monthKey);
    var startIsoOf = (opts && opts.startIsoOf) || function () { return null; };
    return (goals || []).filter(function (g) {
      if (!g || g.horizon !== 'month') return false;
      var m = monthKeyOf(g, { startIso: startIsoOf(g) });
      // Місяць невідомий узагалі — краще в поточному, ніж ніде.
      if (!m) return isCurrent;
      if (m === monthKey) return true;
      // Закрита саме в цьому місяці — показуємо тут, хоч заведена була раніше.
      if (typeof g.completedAt === 'string' && g.completedAt.slice(0, 7) === monthKey) return true;
      return isCurrent && m < monthKey && (g.status === 'active' || g.status === 'paused');
    });
  }

  /**
   * День, коли ціль закрили. `completedAt` пишеться при переході в 'done'
   * (setGoalStatus у goals/app.js); цілі, закриті до появи поля, дати не
   * мають — для них беремо останній слід у самих даних, і це чесніше за
   * «невідомо», бо саме тоді ціллю й займались востаннє.
   */
  function closedOn(goal) {
    if (!goal || goal.status !== 'done') return null;
    if (typeof goal.completedAt === 'string' && goal.completedAt.length === 10) {
      return goal.completedAt;
    }
    return latestSignal(goal);
  }

  /**
   * Скільки ціль прожила: від заведення до закриття.
   *
   * `days` — саме різниця в днях, без «+1 за сьогодні»: ціль, заведена і
   * закрита того самого дня, зайняла нуль днів, і хай сторінка сама вирішує,
   * як це назвати. null означає, що одного з кінців відрізка немає, — тоді
   * ціль у ретроспективі лишається, але без тривалості.
   */
  function goalSpan(goal, opts) {
    var doneIso = closedOn(goal);
    if (!doneIso) return null;
    var startIso = (opts && opts.startIso) || earliestSignal(goal);
    if (!startIso) return { startIso: null, doneIso: doneIso, days: null };
    // Дата закриття раніша за заведення трапляється лише на зіпсованих даних
    // (або коли startIso — це вже слід із середини шляху). Відʼємну тривалість
    // показувати нема сенсу.
    var days = Math.max(0, daysBetween(startIso, doneIso));
    return { startIso: startIso, doneIso: doneIso, days: days };
  }

  /**
   * Ретроспектива: що закрито за період і скільки кожна ціль зайняла.
   *
   * Сенс не в статистиці, а в озиранні назад: закрита ціль зникає зі списку,
   * і рік роботи лишається без жодного сліду на екрані. Тут — той слід.
   *
   * @param {Array} goals
   * @param {string} todayIso
   * @param {{days?: number|null, startIsoOf?: function}} [opts]
   *   days: довжина вікна; null або 0 — за весь час.
   *   startIsoOf: звідки взяти день заведення цілі (createdAt лежить у
   *     Firestore Timestamp, а модуль про Firestore нічого не знає).
   */
  function retrospective(goals, todayIso, opts) {
    var span = opts && opts.days;
    var from = span ? shift(todayIso, -(span - 1)) : null;
    var startIsoOf = (opts && opts.startIsoOf) || function () { return null; };

    var items = [];
    (goals || []).forEach(function (g) {
      var doneIso = closedOn(g);
      if (!doneIso) return;
      if (from && doneIso < from) return;
      // Дата з майбутнього — це збій годинника, а не досягнення.
      if (doneIso > todayIso) return;
      var sp = goalSpan(g, { startIso: startIsoOf(g) });
      items.push({
        id: g.id,
        title: g.title || '',
        category: g.category || '',
        horizon: g.horizon === 'month' ? 'month' : 'year',
        doneIso: doneIso,
        startIso: sp ? sp.startIso : null,
        days: sp ? sp.days : null,
      });
    });

    // Найсвіжіше зверху: ретроспективу читають від «що я щойно закрив».
    items.sort(function (a, b) {
      if (a.doneIso !== b.doneIso) return a.doneIso < b.doneIso ? 1 : -1;
      return a.title.localeCompare(b.title);
    });

    var spans = items
      .map(function (i) { return i.days; })
      .filter(function (d) { return typeof d === 'number'; })
      .sort(function (a, b) { return a - b; });

    // Медіана, а не середнє: одна ціль на два роки не має робити вигляд,
    // ніби всі інші тривали по пів року.
    var median = null;
    if (spans.length) {
      var mid = Math.floor(spans.length / 2);
      median = spans.length % 2 ? spans[mid] : Math.round((spans[mid - 1] + spans[mid]) / 2);
    }

    return {
      from: from,
      to: todayIso,
      count: items.length,
      items: items,
      medianDays: median,
      fastestDays: spans.length ? spans[0] : null,
      slowestDays: spans.length ? spans[spans.length - 1] : null,
    };
  }

  /** Скільки днів лишилось до дедлайну цілі (може бути відʼємно). */
  function daysToDeadline(goal, todayIso) {
    if (!goal || typeof goal.targetDate !== 'string' || !goal.targetDate) return null;
    return daysBetween(todayIso, goal.targetDate);
  }

  /**
   * За скільки днів попереджати про дедлайн ЦІЄЇ цілі.
   *
   * Три дні — розумно для справи на два тижні й безглуздо для цілі на вісім
   * місяців: там це вже не попередження, а співчуття, бо зробити нічого не
   * можна. Тому поріг — частка від довжини самої цілі, з підлогою (коротка
   * ціль не має мовчати до останнього дня) і стелею (багаторічна не має
   * гудіти чотири місяці поспіль).
   */
  var WARN_SHARE = 0.1;
  var WARN_MIN_DAYS = 3;
  var WARN_MAX_DAYS = 30;

  function deadlineWarnDays(goal, todayIso, opts) {
    if (!goal || !goal.targetDate) return WARN_MIN_DAYS;
    var startIso = (opts && opts.startIsoOf && opts.startIsoOf(goal)) || earliestSignal(goal);
    // Довжину цілі нізвідки взяти — лишається обережна підлога.
    if (!startIso) return WARN_MIN_DAYS;
    var span = daysBetween(startIso, goal.targetDate);
    if (!(span > 0)) return WARN_MIN_DAYS;
    return Math.max(WARN_MIN_DAYS, Math.min(WARN_MAX_DAYS, Math.round(span * WARN_SHARE)));
  }

  /**
   * Що сказати про цілі у вечірньому дайджесті.
   *
   * Раніше головним тут була серія: ввечері ще є час не обірвати ланцюг.
   * Серії немає, і щовечірнє «чи був крок» пішло разом із нею — про ціль на
   * вісім місяців питати щодня однаково не було сенсу. Лишився єдиний
   * привід озватись увечері: дедлайн, який ось-ось або вже минув. Це не
   * питання, а факт, і людина його могла просто не побачити.
   *
   * @param {Array} goals усі цілі користувача
   * @param {string} todayIso «сьогодні»
   * @param {{deadlineDays?: number, startIsoOf?: function}} [opts]
   * @returns {{deadline:number|null, deadlineTitle:string|null}}
   */
  function goalsDigest(goals, todayIso, opts) {
    // Найближчий дедлайн серед цілей у роботі: прострочений або той, що
    // ось-ось. «Ось-ось» у кожної цілі своє — див. deadlineWarnDays.
    var deadline = null;
    var deadlineTitle = null;
    (goals || []).forEach(function (g) {
      if (!g || g.status !== 'active') return;
      var left = daysToDeadline(g, todayIso);
      if (left === null) return;
      var warn = (opts && opts.deadlineDays) || deadlineWarnDays(g, todayIso, opts);
      if (left > warn) return;
      if (deadline === null || left < deadline) { deadline = left; deadlineTitle = g.title || null; }
    });

    return { deadline: deadline, deadlineTitle: deadlineTitle };
  }

  // ---- Нотатки цілі ----
  //
  // Одне вільне поле на ціль: усе, що людина хоче про неї сказати. Раніше на
  // цьому місці був щоденник — стрічка окремих записів із датами, — і його
  // головна вада була саме в стрічці: щоб дописати рядок до вчорашньої думки,
  // доводилось заводити другий запис, а зв'язного тексту про ціль не виходило
  // ніколи.
  //
  // У базі нотатки лежать у полі `journal` — тому самому масиві. Це не
  // недогляд, а свідомий вибір: правила Firestore перелічують дозволені ключі
  // документа поіменно, і нове поле `notes` вимагало б їх розгортати. Формат
  // елемента лишився тим самим {id, text, createdAt}, тож старі записи
  // читаються без жодної міграції — просто показуються одним текстом.
  var NOTES_MAX = 20000;

  /** Текст нотаток цілі. Кілька старих записів щоденника зливаються в один
   *  текст у хронологічному порядку: нічого не губиться, а перший же запис
   *  згортає їх в один елемент. */
  function notesText(goal) {
    var list = (goal && goal.journal) || [];
    if (!list.length) return '';
    return list
      .slice()
      .sort(function (a, b) { return (a && a.createdAt || 0) - (b && b.createdAt || 0); })
      .map(function (e) { return (e && e.text) || ''; })
      .filter(function (x) { return x !== ''; })
      .join('\n\n');
  }

  /** Масив `journal`, який треба записати для цього тексту. Порожній текст —
   *  порожній масив: нотатка, яку стерли, має зникнути, а не лишитись
   *  порожнім записом.
   *
   *  createdAt — саме клієнтський Date.now(), а не serverTimestamp(): останній
   *  заборонений усередині елемента масиву Firestore. */
  function notesPatch(text) {
    var body = typeof text === 'string' ? text.trim() : '';
    if (!body) return [];
    return [{
      id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      text: body.slice(0, NOTES_MAX),
      createdAt: Date.now(),
    }];
  }

  var api = {
    isoOf: isoOf,
    parseISO: parseISO,
    shift: shift,
    daysBetween: daysBetween,
    deadlineForMonth: deadlineForMonth,
    daysToDeadline: daysToDeadline,
    deadlineWarnDays: deadlineWarnDays,
    goalsDigest: goalsDigest,
    NOTES_MAX: NOTES_MAX,
    notesText: notesText,
    notesPatch: notesPatch,
    monthKeyOf: monthKeyOf,
    goalsOfMonth: goalsOfMonth,
    closedOn: closedOn,
    goalSpan: goalSpan,
    retrospective: retrospective,
  };

  root.GoalReview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
