// ---- Розбір рядка швидкого додавання завдання ----
// Перетворює «Купити молоко завтра о 18» на готові поля завдання.
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
    { day: 1, words: 'понеділок|понеділка|понеділку|понедельник|понедельника|poniedziałek|poniedzialek|monday' },
    { day: 2, words: 'вівторок|вівторка|вівторку|вторник|вторника|wtorek|tuesday' },
    { day: 3, words: 'середа|середу|середи|среда|среду|среды|środa|środę|sroda|wednesday' },
    { day: 4, words: 'четвер|четверга|четвергу|четверг|czwartek|thursday' },
    { day: 5, words: "п'ятниця|п'ятницю|п'ятниці|пятница|пятницу|пятницы|piątek|piatek|friday" },
    { day: 6, words: 'субота|суботу|суботи|суббота|субботу|субботы|sobota|sobotę|sobote|saturday' },
    { day: 7, words: 'неділя|неділю|неділі|воскресенье|воскресенья|niedziela|niedzielę|niedziele|sunday' },
  ];

  // Прийменники, що лишаються «висіти» в кінці назви після вирізання дати/часу
  // («Зустріч на завтра» -> «Зустріч на»).
  //
  // Слова-маркери повторення («кожної», «every») тут із тієї ж причини.
  // Повторюваних завдань у застосунку більше немає, і «Прибирання кожної
  // суботи» тепер читається як звичайне завдання на найближчу суботу — але
  // без цього рядка від назви лишилось би «Прибирання кожної».
  var TRAILING_FILLER = 'на|у|в|о|до|за|кожної|кожного|кожен|кожні|кожних|каждую|каждый|каждое|каждые|' +
    'na|w|o|do|co|w każdy|w każdą|on|at|in|by|about|every';

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

  function cleanTitle(text) {
    var title = text.replace(/\s+/g, ' ').trim();
    // Вирізана позначка лишає по собі пробіл там, де його не було:
    // «Зустріч завтра, о 18» -> «Зустріч ,». Підтягуємо розділовий знак
    // назад до слова, щоб назва не виглядала друкарською помилкою.
    //
    // Тільки знак, що стоїть окремо (далі пробіл або кінець рядка): «!» тепер
    // звичайний символ назви, а не позначка пріоритету, і «Дзвінок !1» не
    // має злипатись у «Дзвінок!1».
    title = title.replace(/\s+([,;:.!?])(?=\s|$)/g, '$1');
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
   * @returns {{title:string, dueDate:string|null, dueTime:string|null}}
   */
  function parseQuickTask(input, opts) {
    opts = opts || {};
    var state = {
      text: typeof input === 'string' ? input : '',
      now: opts.now instanceof Date ? opts.now : new Date(),
    };

    parseDate(state);
    parseTime(state);

    // Час без дати сам по собі марний — це майже завжди «сьогодні».
    if (state.dueTime && !state.dueDate) state.dueDate = isoOf(startOfDay(state.now));

    return {
      title: cleanTitle(state.text),
      dueDate: state.dueDate,
      dueTime: state.dueTime,
    };
  }

  root.parseQuickTask = parseQuickTask;
  if (typeof module !== 'undefined' && module.exports) module.exports = { parseQuickTask: parseQuickTask };
})(typeof window !== 'undefined' ? window : globalThis);
