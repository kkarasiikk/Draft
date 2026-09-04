// ---- Темп цілі ----
//
// Модуль називається «довгострокові цілі», а вся його механіка досі працювала
// з одним днем: серія, вечірнє «чи був крок», причини пропуску. Ціль із
// дедлайном через вісім місяців отримувала щовечора «так/ні» — і попередження
// за три дні до кінця. Між ними не було нічого: застосунок знав і дедлайн, і
// прогрес, але ніде не рахував звʼязок між ними.
//
// Тут — саме цей звʼязок:
//   pace()         чи встигаєш до дедлайну таким темпом;
//   weekMovement() що зрушило за тиждень.
//
// Ні DOM, ні Firestore — тільки чисті функції від даних і поточної дати
// (див. goals/review.test.js). Той самий модуль читає й AI-помічник: інакше
// в чаті звучала б одна оцінка темпу, а на екрані стояла інша.
(function (root) {
  'use strict';

  // Вікно, за яким рахується «що зрушило»: тиждень. Довше — і рух місячної
  // цілі губиться в середньому; коротше — кожен вихідний виглядає застоєм.
  var REVIEW_PERIOD_DAYS = 7;

  // Скільки днів мовчання роблять паузу «перервою», а не звичайним
  // пропуском. Два тижні: тиждень без кроку буває в кожної живої цілі, а от
  // три — це вже не збій ритму, це вихід із нього.
  var LAPSE_DAYS = 14;

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
   *  і в lapse. */
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

    // Записи щоденника мають createdAt у мілісекундах (serverTimestamp
    // усередині елемента масиву Firestore заборонений), тож день доводиться
    // діставати з Date, а не порівнювати рядки.
    var journal = ((goal && goal.journal) || []).filter(function (e) {
      if (!e || typeof e.createdAt !== 'number') return false;
      var day = S.isoOf(new Date(e.createdAt));
      return day >= from && day <= todayIso;
    }).length;

    return {
      from: from,
      checkins: checkins,
      journal: journal,
      moved: checkins > 0,
    };
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
      return isCurrent && m < monthKey && (g.status === 'active' || g.status === 'paused');
    });
  }

  /**
   * Довга перерва — і момент повернення.
   *
   * Типовий кінець довгої цілі виглядає так: тиждень руху, пропуск, провина,
   * і застосунок більше не відкривають. Різниця між тимчасовим збоєм і
   * повним крахом — у тому, чи є куди повернутись. Досі ціль після трьох
   * тижнів мовчання зустрічала обірваною серією й вердиктом «не встигаєш» —
   * тобто рівно тим, від чого й тікають.
   *
   * Рахуємо від останнього СЛІДУ будь-якого роду: відмітка, прогрес, закрита
   * віха. Слідом вважається й запис про те, що завадило: людина приходила й
   * чесно сказала «не вийшло», і це не мовчання.
   *
   * Повертає null, коли перерви немає або говорити про неї не час: ціль на
   * паузі (про неї свідомо не питають), закрита чи архівна.
   */
  function lapse(goal, todayIso, opts) {
    if (!goal || goal.status !== 'active') return null;
    var S = streak();
    if (!S) return null;

    var marks = [];
    (goal.checkins || []).forEach(function (d) {
      if (typeof d === 'string') marks.push(d);
    });
    (goal.progressLog || []).forEach(function (e) {
      if (e && typeof e.date === 'string') marks.push(e.date);
    });
    (goal.blockers || []).forEach(function (b) {
      if (b && typeof b.date === 'string') marks.push(b.date);
    });

    var last = null;
    marks.forEach(function (d) {
      if (d <= todayIso && (last === null || d > last)) last = d;
    });

    // Точка відліку — ПІЗНІШЕ з двох: останній слід і початок цілі. Початок
    // тут не лише «коли завели»: після перезапуску (restartedAt) він
    // зсувається на день повернення, а сам перезапуск — це вже дія, тож
    // мовчання від нього й рахується. Брати просто останній слід означало б,
    // що ціль, до якої людина щойно повернулась, назавжди лишається
    // покинутою через торішню відмітку.
    var startIso = (opts && opts.startIso) || null;
    var from = last;
    if (!from || (startIso && startIso > from)) from = startIso;
    if (!from) return null;

    var days = S.daysBetween(from, todayIso);
    if (days < LAPSE_DAYS) return null;
    return { days: days, lastIso: last, everMoved: last !== null };
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
    var S = streak();
    if (!S) return null;
    var doneIso = closedOn(goal);
    if (!doneIso) return null;
    var startIso = (opts && opts.startIso) || earliestSignal(goal);
    if (!startIso) return { startIso: null, doneIso: doneIso, days: null };
    // Дата закриття раніша за заведення трапляється лише на зіпсованих даних
    // (або коли startIso — це вже слід із середини шляху). Відʼємну тривалість
    // показувати нема сенсу.
    var days = Math.max(0, S.daysBetween(startIso, doneIso));
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
    var S = streak();
    if (!S) return null;
    var span = opts && opts.days;
    var from = span ? S.shift(todayIso, -(span - 1)) : null;
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

  var api = {
    REVIEW_PERIOD_DAYS: REVIEW_PERIOD_DAYS,
    LAPSE_DAYS: LAPSE_DAYS,
    deadlineForMonth: deadlineForMonth,
    weekMovement: weekMovement,
    lapse: lapse,
    monthKeyOf: monthKeyOf,
    goalsOfMonth: goalsOfMonth,
    closedOn: closedOn,
    goalSpan: goalSpan,
    retrospective: retrospective,
  };

  root.GoalReview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
