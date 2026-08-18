// ---- Розбір рядка швидкого додавання завдання ----
// Перетворює «Купити молоко завтра о 18 #дім ~15хв» на готові поля завдання.
// Свідомо БЕЗ звернень до AI: працює миттєво, офлайн і безкоштовно — саме там,
// де користувач найчастіше додає завдання (на ходу, однією рукою).
//
// Розпізнаються всі 4 мови застосунку одночасно, незалежно від мови інтерфейсу
// (той самий підхід, що й в імпорті CSV у budget/app.js): людина може почати
// думати українською, а дописати англійською — і це має спрацювати.
//
// Файл підключається і як звичайний <script> у браузері (кладе parseQuickTask
// у window), і як CommonJS-модуль у Jest — тому тут немає ні import, ні export.
(function (root) {
  'use strict';

  // Межа слова, що працює з кирилицею: \b у JS розрахований на ASCII, тож
  // /\bзавтра\b/ просто не спрацює. Lookbehind навмисно не використовуємо
  // (старі Safari падають на ньому ще на етапі парсингу файлу) — зліва просто
  // дозволяємо будь-який символ, що не літера й не цифра, незахоплюваною групою
  // (захоплювана зсувала б нумерацію всіх наступних груп).
  // Апостроф користувач може ввести чотирма різними символами (клавіатура
  // iOS автозаміною ставить ’, Android — ʼ або '), тож у шаблонах будь-який
  // апостроф означає «будь-який із них»: інакше «п’ятниця» не збігалась би
  // з «п'ятниця» і дата просто лишалась би в назві завдання.
  var APOSTROPHES = "['\u2019\u02BC\u0060\u00B4]";
  function wordRe(body, flags) {
    var pattern = body.replace(/['\u2019\u02BC]/g, APOSTROPHES);
    return new RegExp('(?:^|[^\\p{L}\\p{N}])(?:' + pattern + ')(?![\\p{L}\\p{N}])', 'iu' + (flags || ''));
  }

  var DAY_WORDS = [
    { offset: 2, words: 'післязавтра|послезавтра|pojutrze|day after tomorrow' },
    { offset: 1, words: 'завтра|jutro|tomorrow' },
    { offset: 0, words: 'сьогодні|сегодня|dzisiaj|dziś|today' },
  ];

  // Понеділок = 1 … неділя = 7 (як у ISO), бо тиждень скрізь у застосунку
  // починається з понеділка.
  var WEEKDAYS = [
    { day: 1, words: 'понеділок|понеділка|понедельник|poniedziałek|poniedzialek|monday' },
    { day: 2, words: 'вівторок|вівторка|вторник|wtorek|tuesday' },
    { day: 3, words: 'середа|середу|среда|среду|środa|środę|sroda|wednesday' },
    { day: 4, words: 'четвер|четверга|czwartek|thursday' },
    { day: 5, words: "п'ятниця|п'ятницю|пятница|пятницу|piątek|piatek|friday" },
    { day: 6, words: 'субота|суботу|суббота|субботу|sobota|sobotę|sobote|saturday' },
    { day: 7, words: 'неділя|неділю|воскресенье|niedziela|niedzielę|niedziele|sunday' },
  ];

  var MIN_UNITS = 'хвилин\\w*|хвилі?в?|хв|мин\\w*|мін|minut\\w*|minutes|minute|mins|min|m';
  var HOUR_UNITS = 'годин\\w*|год|час[іао]?в?|godzin\\w*|godz|hours|hour|hrs|hr|h';

  var PRIORITY_WORDS = {
    high: 'терміново|термінове|важливо|важливе|срочно|важно|pilne|ważne|wazne|urgent|important',
    low: 'колись|потім|когда-нибудь|kiedyś|kiedys|someday|later',
  };

  // Прийменники, що лишаються «висіти» в кінці назви після вирізання дати/часу
  // («Зустріч на завтра» -> «Зустріч на»).
  var TRAILING_FILLER = 'на|у|в|о|до|за|na|w|o|do|on|at|in|by|about';

  function pad2(n) {
    return String(n).padStart(2, '0');
  }
  function isoOf(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function shiftDays(d, days) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  }

  // Вирізає знайдений фрагмент разом із роздільником зліва — той за
  // визначенням не літера й не цифра, а зайві пробіли приберуться в cleanTitle.
  function cut(text, re) {
    return text.replace(re, ' ');
  }

  function parseTags(state) {
    var tags = [];
    // Тег — #слово; дублікати прибираємо, регістр лишаємо як ввели.
    state.text = state.text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/giu, function (m, pre, tag) {
      if (!tags.some(function (t) { return t.toLowerCase() === tag.toLowerCase(); })) tags.push(tag);
      return pre;
    });
    state.tags = tags;
  }

  function parsePriority(state) {
    var priority = null;
    // Числова форма (!1/!2/!3) і «окличні» (!!!/!!/!) — перевіряємо від
    // найдовшої, інакше !!! з'їлося б як !.
    var marks = [
      { re: /(^|\s)!1(?=\s|$)/i, value: 'high' },
      { re: /(^|\s)!2(?=\s|$)/i, value: 'medium' },
      { re: /(^|\s)!3(?=\s|$)/i, value: 'low' },
      { re: /(^|\s)!!!(?=\s|$)/, value: 'high' },
      { re: /(^|\s)!!(?=\s|$)/, value: 'medium' },
      { re: /(^|\s)!(?=\s|$)/, value: 'high' },
    ];
    for (var i = 0; i < marks.length; i++) {
      if (marks[i].re.test(state.text)) {
        priority = marks[i].value;
        state.text = state.text.replace(marks[i].re, '$1');
        break;
      }
    }
    if (!priority) {
      var keys = Object.keys(PRIORITY_WORDS);
      for (var k = 0; k < keys.length; k++) {
        var re = wordRe(PRIORITY_WORDS[keys[k]]);
        if (re.test(state.text)) {
          priority = keys[k];
          state.text = cut(state.text, re);
          break;
        }
      }
    }
    state.priority = priority;
  }

  function parseDate(state) {
    var today = startOfDay(state.now);
    var text = state.text;
    var found = null;

    // 1. ISO — найоднозначніший запис, тож перевіряємо першим.
    var isoRe = /(^|[^\d])(\d{4})-(\d{2})-(\d{2})(?!\d)/;
    var m = text.match(isoRe);
    if (m) {
      var isoDate = new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]));
      if (!isNaN(isoDate)) {
        found = isoDate;
        text = text.replace(isoRe, '$1 ');
      }
    }

    // 2. «сьогодні / завтра / післязавтра».
    if (!found) {
      for (var i = 0; i < DAY_WORDS.length; i++) {
        var dre = wordRe(DAY_WORDS[i].words);
        if (dre.test(text)) {
          found = shiftDays(today, DAY_WORDS[i].offset);
          text = cut(text, dre);
          break;
        }
      }
    }

    // 3. «через N днів / in N days».
    if (!found) {
      var inRe = wordRe('(?:через|za|in)\\s+(\\d{1,3})\\s*(?:днів|дні|дня|день|дней|dni|dzień|dzien|days|day)');
      var im = text.match(new RegExp(inRe.source, 'iu'));
      if (im) {
        var n = Number(im[1]);
        if (n > 0 && n < 400) {
          found = shiftDays(today, n);
          text = cut(text, inRe);
        }
      }
    }

    // 4. День тижня — найближчий майбутній (сьогоднішній день не рахуємо:
    // «у понеділок» у понеділок майже завжди означає наступний тиждень).
    if (!found) {
      for (var w = 0; w < WEEKDAYS.length; w++) {
        var wre = wordRe(WEEKDAYS[w].words);
        if (wre.test(text)) {
          var todayIso = today.getDay() === 0 ? 7 : today.getDay();
          var delta = WEEKDAYS[w].day - todayIso;
          if (delta <= 0) delta += 7;
          found = shiftDays(today, delta);
          text = cut(text, wre);
          break;
        }
      }
    }

    // 5. Числова дата: 12.05, 12/05, 12.05.2026.
    if (!found) {
      var numRe = /(^|[^\d.:/])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d.:/])/;
      var nm = text.match(numRe);
      if (nm) {
        var day = Number(nm[2]);
        var month = Number(nm[3]);
        var year = nm[4] ? Number(nm[4]) : today.getFullYear();
        if (year < 100) year += 2000;
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          var candidate = new Date(year, month - 1, day);
          // Рік не вказали, а дата вже минула -> людина має на увазі наступний рік.
          if (!nm[4] && candidate < today) candidate = new Date(year + 1, month - 1, day);
          if (candidate.getMonth() === month - 1) {
            found = candidate;
            text = text.replace(numRe, '$1 ');
          }
        }
      }
    }

    state.text = text;
    state.dueDate = found ? isoOf(found) : null;
  }

  function normalizeHour(hour, meridiem) {
    if (!meridiem) return hour;
    var m = meridiem.toLowerCase();
    var isPm = m === 'pm' || m === 'вечора' || m === 'дня' || m === 'ночі' || m === 'ночи' || m === 'вечера';
    if (isPm && hour < 12) return hour + 12;
    if (!isPm && hour === 12) return 0; // 12 ранку = 00:00
    return hour;
  }

  function parseTime(state) {
    var text = state.text;
    var hour = null, minute = 0;
    var meridiemWords = 'am|pm|ранку|утра|вечора|вечера|дня|ночі|ночи';

    // 1. HH:MM — однозначно час, маркер не потрібен.
    var colonRe = /(^|[^\d:])(\d{1,2})[:.](\d{2})(?![\d:])/;
    var m = text.match(colonRe);
    if (m && Number(m[2]) <= 23 && Number(m[3]) <= 59) {
      hour = Number(m[2]);
      minute = Number(m[3]);
      text = text.replace(colonRe, '$1 ');
    }

    // 2. З маркером: «о 18», «at 6», «w 9». Без маркера числа не чіпаємо —
    // інакше «Купити 2 л молока» перетворилось би на завдання на 02:00.
    if (hour === null) {
      var markerRe = wordRe('(?:о|about|at|в|у|w|o)\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:год(?:ині|ини)?|годин)?\\s*(' + meridiemWords + ')?');
      var mm = text.match(new RegExp(markerRe.source, 'iu'));
      if (mm && Number(mm[1]) <= 23) {
        hour = Number(mm[1]);
        minute = mm[2] ? Number(mm[2]) : 0;
        hour = normalizeHour(hour, mm[3]);
        text = cut(text, markerRe);
      }
    }

    // 3. Без маркера, але з «ранку/вечора/am/pm»: «зустріч 6 вечора».
    if (hour === null) {
      var merRe = wordRe('(\\d{1,2})\\s*(' + meridiemWords + ')');
      var em = text.match(new RegExp(merRe.source, 'iu'));
      if (em && Number(em[1]) <= 23) {
        hour = normalizeHour(Number(em[1]), em[2]);
        minute = 0;
        text = cut(text, merRe);
      }
    }

    if (hour !== null && minute <= 59) {
      state.dueTime = pad2(hour) + ':' + pad2(minute);
      state.text = text;
    } else {
      state.dueTime = null;
    }
  }

  function parseEstimate(state) {
    // Час доби вже вирізаний раніше, тож «о 14 год» сюди не долетить і
    // «год» лишається однозначною одиницею тривалості.
    var hoursRe = wordRe('~?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:' + HOUR_UNITS + ')');
    var minsRe = wordRe('~?\\s*(\\d+)\\s*(?:' + MIN_UNITS + ')');
    var total = 0;

    var hm = state.text.match(new RegExp(hoursRe.source, 'iu'));
    if (hm) {
      total += Math.round(parseFloat(hm[1].replace(',', '.')) * 60);
      state.text = cut(state.text, hoursRe);
    }
    var mm = state.text.match(new RegExp(minsRe.source, 'iu'));
    if (mm) {
      total += Number(mm[1]);
      state.text = cut(state.text, minsRe);
    }

    // Понад добу — це вже не оцінка часу на завдання, а помилка розбору.
    state.estimateMin = total > 0 && total <= 1440 ? total : null;
  }

  function cleanTitle(text) {
    var title = text.replace(/\s+/g, ' ').trim();
    title = title.replace(/^[-–—,;:.]+|[-–—,;:.]+$/g, '').trim();
    // Прибираємо прийменник, що лишився без свого слова («Зустріч на» -> «Зустріч»),
    // але тільки якщо після нього щось лишається — інакше зникне вся назва.
    var trailing = new RegExp('(^|[^\\p{L}\\p{N}])(?:' + TRAILING_FILLER + ')\\s*$', 'iu');
    var stripped = title.replace(trailing, '').trim();
    if (stripped) title = stripped;
    return title.replace(/\s+/g, ' ').trim();
  }

  /**
   * @param {string} input рядок, який ввела людина
   * @param {{now?: Date}} [opts] `now` підмінюється в тестах
   * @returns {{title:string, dueDate:string|null, dueTime:string|null,
   *            priority:string|null, tags:string[], estimateMin:number|null}}
   */
  function parseQuickTask(input, opts) {
    opts = opts || {};
    var state = {
      text: typeof input === 'string' ? input : '',
      now: opts.now instanceof Date ? opts.now : new Date(),
    };

    parseTags(state);
    parsePriority(state);
    parseDate(state);
    parseTime(state);
    parseEstimate(state);

    // Час без дати сам по собі марний — це майже завжди «сьогодні».
    if (state.dueTime && !state.dueDate) state.dueDate = isoOf(startOfDay(state.now));

    return {
      title: cleanTitle(state.text),
      dueDate: state.dueDate,
      dueTime: state.dueTime,
      priority: state.priority,
      tags: state.tags,
      estimateMin: state.estimateMin,
    };
  }

  root.parseQuickTask = parseQuickTask;
  if (typeof module !== 'undefined' && module.exports) module.exports = { parseQuickTask: parseQuickTask };
})(typeof window !== 'undefined' ? window : globalThis);
