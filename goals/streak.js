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

  var api = {
    RESCUE_COOLDOWN_DAYS: RESCUE_COOLDOWN_DAYS,
    EVENING_HOUR: EVENING_HOUR,
    isoOf: isoOf,
    parseISO: parseISO,
    shift: shift,
    daysBetween: daysBetween,
    streakEndingAt: streakEndingAt,
    computeStreak: computeStreak,
    rescueState: rescueState,
    applyRescue: applyRescue,
    applyCheckin: applyCheckin,
    applyBlocker: applyBlocker,
    blockerStats: blockerStats,
    isEvening: isEvening,
    eveningQueue: eveningQueue,
  };

  root.GoalStreak = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
