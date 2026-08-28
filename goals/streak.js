// ---- Серія, рятунок серії та вечірній підсумок ----
// Спільний модуль для сторінки цілей і для AI-помічника (ai.js на сервері).
// Тут свідомо немає ні DOM, ні Firestore — тільки чисті функції від даних і
// поточної дати. Через це поведінку серії можна перевірити тестами, а не
// «на око», підводячи годинник (див. goals/streak.test.js).
//
// Логіка живе в одному місці ще й тому, що помічник уміє рятувати серію
// голосом, а сторінка — кнопкою. Дві копії правила «коли рятунок доступний»
// розійшлися б з першою ж правкою, і людина побачила б у чаті одне, а на
// сторінці інше.
(function (root) {
  'use strict';

  // Скільки днів мусить пройти між рятунками. Тиждень — компроміс: одна
  // пропущена п'ятниця серію не ламає, але серія, яку рятують через день,
  // перестає щось означати.
  var RESCUE_COOLDOWN_DAYS = 7;

  // З якої години день уже можна підсумовувати. Не опівночі: питати «як
  // пройшов день» о 23:59 запізно, людина вже спить.
  var EVENING_HOUR = 18;

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

  /** Скільки днів поспіль тягнеться серія, якщо рахувати назад від endIso
   *  включно. Нуль означає, що самого endIso в списку немає. */
  function streakEndingAt(checkins, endIso) {
    var set = {};
    (checkins || []).forEach(function (d) { set[d] = true; });
    var count = 0;
    var cursor = endIso;
    while (set[cursor]) { count++; cursor = shift(cursor, -1); }
    return count;
  }

  /** Довжина живої серії. Грація на один день: якщо сьогодні ще не
   *  відмічено, але вчора було — серія жива, день іще не закінчився. */
  function computeStreak(checkins, todayIso) {
    if (!checkins || !checkins.length) return 0;
    var today = streakEndingAt(checkins, todayIso);
    if (today) return today;
    return streakEndingAt(checkins, shift(todayIso, -1));
  }

  function lastRescue(goal) {
    var list = (goal && goal.rescues) || [];
    var max = '';
    list.forEach(function (d) { if (typeof d === 'string' && d > max) max = d; });
    return max || null;
  }

  /** Чи є що рятувати і чи можна. Повертає null, коли рятунок не до речі:
   *  вчора відмічено (нема розриву) або до вчора теж було порожньо (це вже
   *  не порваний ланцюг, а початок нового). */
  function rescueState(goal, todayIso) {
    var checkins = (goal && goal.checkins) || [];
    var yesterday = shift(todayIso, -1);
    if (checkins.indexOf(yesterday) >= 0) return null;

    var lost = streakEndingAt(checkins, shift(todayIso, -2));
    if (!lost) return null;

    // Відлік ведемо від врятованого дня — того, який людина «докупила».
    var last = lastRescue(goal);
    var since = last === null ? Infinity : daysBetween(last, todayIso);
    var cooldownLeft = Math.max(0, RESCUE_COOLDOWN_DAYS - since);
    return { day: yesterday, lost: lost, available: cooldownLeft === 0, cooldownLeft: cooldownLeft };
  }

  /** Готує нові checkins/rescues для рятунку. null — рятувати нічого або
   *  рано. Тільки рахує: писати в базу — справа того, хто викликав. */
  function applyRescue(goal, todayIso) {
    var state = rescueState(goal, todayIso);
    if (!state || !state.available) return null;

    var checkins = ((goal && goal.checkins) || []).slice();
    if (checkins.indexOf(state.day) < 0) checkins.push(state.day);
    checkins.sort();
    // ISO-рядки сортуються хронологічно, тож зайве відрізається з початку.
    if (checkins.length > 400) checkins = checkins.slice(checkins.length - 400);

    var rescues = ((goal && goal.rescues) || []).concat([state.day]).sort();
    if (rescues.length > 50) rescues = rescues.slice(rescues.length - 50);

    return { day: state.day, checkins: checkins, rescues: rescues, streak: computeStreak(checkins, todayIso) };
  }

  /** Дописує сьогоднішній чекін. null — день уже відмічено, писати нема
   *  чого. Живе тут, бо чекін ставить не лише сторінка цілей: виконане
   *  завдання, привʼязане до цілі, відмічає день само. */
  function applyCheckin(goal, todayIso) {
    var checkins = ((goal && goal.checkins) || []).slice();
    if (checkins.indexOf(todayIso) >= 0) return null;
    checkins.push(todayIso);
    checkins.sort();
    if (checkins.length > 400) checkins = checkins.slice(checkins.length - 400);
    return { checkins: checkins };
  }

  /** Додає прогрес до числової цілі: сума плюс запис у журнал.
   *
   *  Живе тут, а не на сторінці цілей, бо прогрес додає не лише вона: у
   *  тренуваннях пробіг зараховується в ціль «пробігти 100 км» просто там, де
   *  його записали. Дві копії арифметики розійшлися б — а від неї залежать і
   *  смужка, і темп.
   *
   *  currentValue лишається сумою, progressLog — історією: одне число не
   *  памʼятає, КОЛИ прогрес був, і без цього не порахувати ні темп, ні рух
   *  за тиждень. */
  function applyProgress(goal, delta, todayIso) {
    var d = Number(delta);
    if (!Number.isFinite(d) || d === 0) return null;
    var round2 = function (n) { return Math.round(n * 100) / 100; };
    var next = Math.max(0, round2((Number(goal && goal.currentValue) || 0) + d));
    var log = ((goal && goal.progressLog) || []).slice();
    log.push({ date: todayIso, delta: round2(d) });
    if (log.length > 400) log = log.slice(log.length - 400);
    return { currentValue: next, progressLog: log };
  }

  /** Цілі, у які має сенс зарахувати сьогоднішнє тренування.
   *
   *  Тільки здоровʼя і тільки активні: ціль на паузі саме тим і є, що про неї
   *  не питають, а «вивчити польську» до тренування стосунку не має. Ті, де
   *  сьогодні вже відмічено І нема куди додавати число, теж відпадають —
   *  пропонувати нема чого. Числовій цілі є що запропонувати навіть після
   *  чекіна: кілометри додаються окремо від «сьогодні був крок».
   *
   *  Сам факт «тренування сьогодні було» приходить ззовні: про тренування цей
   *  модуль нічого не знає й знати не повинен. */
  function trainingGoals(goals, todayIso) {
    return (goals || []).filter(function (g) {
      if (!g || g.status !== 'active' || g.category !== 'health') return false;
      var measurable = Number(g.targetValue) > 0;
      var checkedIn = ((g.checkins || []).indexOf(todayIso) >= 0);
      return measurable || !checkedIn;
    });
  }

  /** Записує, що завадило сьогодні. Один запис на день: людина може
   *  передумати щодо причини, але «сьогодні не вийшло» лишається одним
   *  фактом, а не двома. */
  function applyBlocker(goal, reason, todayIso) {
    var text = typeof reason === 'string' ? reason.trim().slice(0, 80) : '';
    if (!text) return null;
    var blockers = ((goal && goal.blockers) || [])
      .filter(function (b) { return b && b.date !== todayIso; })
      .concat([{ date: todayIso, reason: text }]);
    if (blockers.length > 200) blockers = blockers.slice(blockers.length - 200);
    return { reason: text, blockers: blockers };
  }

  /** Причини за спаданням частоти — щоб було видно, що заважає найчастіше. */
  function blockerStats(goal, limit) {
    var counts = {};
    ((goal && goal.blockers) || []).forEach(function (b) {
      if (!b || !b.reason) return;
      counts[b.reason] = (counts[b.reason] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function (reason) { return { reason: reason, count: counts[reason] }; })
      .sort(function (a, b) { return b.count - a.count || a.reason.localeCompare(b.reason); })
      .slice(0, limit || 3);
  }

  function isEvening(date) {
    return (date || new Date()).getHours() >= EVENING_HOUR;
  }

  /** Про які цілі варто спитати ввечері: активні, ще не відмічені сьогодні
   *  і без сьогоднішньої причини. Відповів — питання зникає. */
  function eveningQueue(goals, todayIso) {
    return (goals || []).filter(function (g) {
      if (!g || g.status !== 'active') return false;
      if (((g.checkins) || []).indexOf(todayIso) >= 0) return false;
      return !((g.blockers) || []).some(function (b) { return b && b.date === todayIso; });
    });
  }

  /** Скільки днів лишилось до дедлайну цілі (може бути відʼємно). */
  function daysToDeadline(goal, todayIso) {
    if (!goal || typeof goal.targetDate !== 'string' || !goal.targetDate) return null;
    return daysBetween(todayIso, goal.targetDate);
  }

  /**
   * Що сказати про цілі у вечірньому дайджесті.
   *
   * Серія — єдина механіка в застосунку, яка тримається виключно на тому, що
   * людина не забула. Рветься вона саме в щільний день, і саме ввечері ще є
   * час це врятувати — тому нагадування живе не окремим пушем, а всередині
   * вечірнього підсумку: два сповіщення за вечір читаються як спам.
   *
   * @param {Array} goals усі цілі користувача
   * @param {string} todayIso «сьогодні»
   * @param {{deadlineDays?: number}} [opts] за скільки днів попереджати про дедлайн
   * @returns {{pending:number, streak:number, streakTitle:string|null,
   *            deadline:number|null, deadlineTitle:string|null}}
   */
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
    var startIso = (opts && opts.startIsoOf && opts.startIsoOf(goal)) || earliestCheckin(goal);
    // Довжину цілі нізвідки взяти — лишається обережна підлога.
    if (!startIso) return WARN_MIN_DAYS;
    var span = daysBetween(startIso, goal.targetDate);
    if (!(span > 0)) return WARN_MIN_DAYS;
    return Math.max(WARN_MIN_DAYS, Math.min(WARN_MAX_DAYS, Math.round(span * WARN_SHARE)));
  }

  /** Найраніша відмітка — запасний спосіб дізнатись, коли ціль почалась. */
  function earliestCheckin(goal) {
    var min = null;
    ((goal && goal.checkins) || []).forEach(function (d) {
      if (typeof d === 'string' && (min === null || d < min)) min = d;
    });
    return min;
  }

  /** Найпростроченіша (або найближча) віха серед активних цілей. */
  function milestoneAlert(goals, todayIso) {
    var best = null;
    (goals || []).forEach(function (g) {
      if (!g || g.status !== 'active') return;
      (g.milestones || []).forEach(function (m) {
        if (!m || m.done || typeof m.date !== 'string') return;
        var left = daysBetween(todayIso, m.date);
        // Віха має сенс як сигнал лише коли вона вже прострочена або
        // настає сьогодні: попереджати про кожну наперед — це шум.
        if (left > 0) return;
        if (!best || left < best.days) {
          best = { days: left, title: m.title || '', goalTitle: g.title || '' };
        }
      });
    });
    return best;
  }

  function goalsDigest(goals, todayIso, opts) {
    var queue = eveningQueue(goals, todayIso);

    // Найдовша серія, яку сьогоднішня бездіяльність обірве. computeStreak
    // рахує серію, що тримається включно з учора, — саме її й видно втратити.
    var streak = 0;
    var streakTitle = null;
    queue.forEach(function (g) {
      var n = computeStreak(g.checkins, todayIso);
      if (n > streak) { streak = n; streakTitle = g.title || null; }
    });

    // Найближчий дедлайн серед активних цілей: прострочений або той, що
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

    var milestone = milestoneAlert(goals, todayIso);

    return {
      pending: queue.length,
      streak: streak,
      streakTitle: streakTitle,
      deadline: deadline,
      deadlineTitle: deadlineTitle,
      // Прострочена віха — теж момент, коли ще можна щось зробити, і досі
      // вона лишалась видною тільки тому, хто сам відкрив ціль.
      milestone: milestone,
    };
  }

  var api = {
    RESCUE_COOLDOWN_DAYS: RESCUE_COOLDOWN_DAYS,
    EVENING_HOUR: EVENING_HOUR,
    daysToDeadline: daysToDeadline,
    goalsDigest: goalsDigest,
    deadlineWarnDays: deadlineWarnDays,
    milestoneAlert: milestoneAlert,
    isoOf: isoOf,
    parseISO: parseISO,
    shift: shift,
    daysBetween: daysBetween,
    streakEndingAt: streakEndingAt,
    computeStreak: computeStreak,
    rescueState: rescueState,
    applyRescue: applyRescue,
    applyCheckin: applyCheckin,
    applyProgress: applyProgress,
    trainingGoals: trainingGoals,
    applyBlocker: applyBlocker,
    blockerStats: blockerStats,
    isEvening: isEvening,
    eveningQueue: eveningQueue,
  };

  root.GoalStreak = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
