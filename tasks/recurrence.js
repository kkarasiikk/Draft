// ---- Повторювані завдання: обчислення наступної дати ----
// Серія наперед не генерується: наступне завдання створюється в момент
// виконання попереднього. Для застосунку без сервера-планувальника це єдиний
// чесний варіант — інакше «щоденне» завдання за рік створило б 365 документів,
// які ще й треба було б підчищати при зміні правила.
//
// Правило (поле `recurrence` в документі завдання):
//   { type: 'daily',   interval: 3 }                 -- кожні 3 дні
//   { type: 'weekly',  weekdays: [1, 3, 5] }         -- Пн/Ср/Пт (1 = понеділок)
//   { type: 'monthly', interval: 1, day: 1 }         -- 1 числа щомісяця
// Спільне поле:
//   anchor: 'schedule'   -- рахуємо від запланованої дати (щосуботи лишається
//                           щосуботою, навіть якщо прибирання зробили в неділю)
//   anchor: 'completion' -- рахуємо від дня виконання (кожні 7 днів ПІСЛЯ того,
//                           як людина реально це зробила)
//
// Файл підключається і як <script> у браузері, і як CommonJS-модуль у Jest.
(function (root) {
  'use strict';

  var MAX_STEPS = 500; // запобіжник від нескінченного циклу на зіпсованому правилі

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
  // Понеділок = 1 … неділя = 7.
  function isoWeekday(d) {
    return d.getDay() === 0 ? 7 : d.getDay();
  }
  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }
  // Додає місяці, утримуючи число місяця. 31 січня + 1 місяць -> 28/29 лютого,
  // а не 2 березня, як зробив би нативний setMonth.
  function addMonths(d, n, preferredDay) {
    var day = preferredDay || d.getDate();
    var target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    return target;
  }

  function normalize(rule) {
    if (!rule || typeof rule !== 'object') return null;
    var type = rule.type;
    if (type !== 'daily' && type !== 'weekly' && type !== 'monthly') return null;
    var interval = Math.round(Number(rule.interval));
    if (!Number.isFinite(interval) || interval < 1) interval = 1;
    if (interval > 365) interval = 365;
    var weekdays = Array.isArray(rule.weekdays)
      ? rule.weekdays.map(Number).filter(function (n) { return n >= 1 && n <= 7; })
      : [];
    weekdays = weekdays.filter(function (n, i) { return weekdays.indexOf(n) === i; }).sort();
    return {
      type: type,
      interval: interval,
      weekdays: weekdays,
      day: Math.round(Number(rule.day)) || null,
      anchor: rule.anchor === 'completion' ? 'completion' : 'schedule',
    };
  }

  // Один крок правила вперед від дати `from`.
  function step(rule, from) {
    if (rule.type === 'daily') return addDays(from, rule.interval);
    if (rule.type === 'monthly') return addMonths(from, rule.interval, rule.day || from.getDate());
    // weekly: найближчий наступний день із переліку; порожній перелік
    // означає «той самий день тижня, що й зараз».
    var days = rule.weekdays.length ? rule.weekdays : [isoWeekday(from)];
    for (var i = 1; i <= 7; i++) {
      var candidate = addDays(from, i);
      if (days.indexOf(isoWeekday(candidate)) !== -1) return candidate;
    }
    return addDays(from, 7);
  }

  /**
   * Дата наступного повторення.
   * @param {object} recurrence правило з документа завдання
   * @param {{dueDate?: string|null, today?: string}} opts
   *   dueDate — запланована дата завдання, що виконують; today — «сьогодні» в ISO.
   * @returns {string|null} ISO-дата або null, якщо правило некоректне
   */
  function nextOccurrence(recurrence, opts) {
    var rule = normalize(recurrence);
    if (!rule) return null;
    opts = opts || {};
    var today = parseIso(opts.today) || new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (rule.anchor === 'completion') {
      // Від дня виконання: «кожні 7 днів після прибирання».
      return isoOf(step(rule, today));
    }

    // Від розкладу: рухаємось від запланованої дати, поки не опинимось у
    // майбутньому. Саме це рятує пропущені повтори — інакше завдання, яке
    // не робили місяць, віддало б наступну дату теж у минулому, і людина
    // одразу отримала б ще одне прострочене.
    var base = parseIso(opts.dueDate) || today;
    var candidate = step(rule, base);
    var guard = 0;
    while (candidate <= today && guard++ < MAX_STEPS) {
      candidate = step(rule, candidate);
    }
    return isoOf(candidate);
  }

  root.nextOccurrence = nextOccurrence;
  root.normalizeRecurrence = normalize;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { nextOccurrence: nextOccurrence, normalizeRecurrence: normalize };
  }
})(typeof window !== 'undefined' ? window : globalThis);
