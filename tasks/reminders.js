// ---- Час нагадувань ----
// Коли саме слати push для завдання і чи час слати щоденний дайджест.
//
// Уся арифметика зібрана тут, бо помилка в ній не видно очима: нагадування
// просто не прийде або прийде вночі. Тести — tasks/reminders.test.js.
//
// Файл підключається і як <script> у браузері, і як CommonJS-модуль у Jest
// (сервером він теж використовується — Cloud Function рахує дайджест).
(function (root) {
  'use strict';

  // Завдання без часу нагадувати опівночі безглуздо — беремо ранок.
  var DEFAULT_DAY_HOUR = 9;

  // Варіанти зсуву від часу завдання, у хвилинах. null — «у час завдання».
  var OFFSETS = [0, 10, 30, 60];

  function parseIso(iso) {
    var parts = String(iso || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return { y: parts[0], m: parts[1], d: parts[2] };
  }

  function parseHhmm(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    if (!m) return null;
    var h = Number(m[1]), min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return { h: h, min: min };
  }

  /**
   * Які варіанти нагадування взагалі має сенс пропонувати для завдання.
   * Без часу «за 10 хвилин» ні від чого відраховувати, тож там інший набір.
   */
  function reminderOptionsFor(task) {
    if (!task || !task.dueDate) return [];
    if (task.dueTime) return OFFSETS.map(function (min) { return { offsetMin: min }; });
    return [{ atHour: DEFAULT_DAY_HOUR }, { atHour: 18 }];
  }

  /**
   * Момент нагадування як Date у місцевому часі пристрою.
   * option — {offsetMin} для завдань із часом або {atHour} для завдань без нього.
   * Повертає null, якщо порахувати неможливо (немає дати, сміттєвий варіант).
   */
  function reminderAtFor(task, option) {
    if (!task || !task.dueDate || !option) return null;
    var date = parseIso(task.dueDate);
    if (!date) return null;

    if (typeof option.atHour === 'number') {
      return new Date(date.y, date.m - 1, date.d, option.atHour, 0, 0, 0);
    }
    if (typeof option.offsetMin !== 'number' || option.offsetMin < 0) return null;
    var time = parseHhmm(task.dueTime);
    // Зсув «за 10 хвилин» без часу завдання ні від чого відраховувати.
    if (!time) return null;
    var at = new Date(date.y, date.m - 1, date.d, time.h, time.min, 0, 0);
    at.setMinutes(at.getMinutes() - option.offsetMin);
    return at;
  }

  /** Чи вже настав момент слати (з допуском на крок планувальника). */
  function isDue(reminderAt, now, toleranceMin) {
    if (!(reminderAt instanceof Date) || isNaN(reminderAt)) return false;
    var current = now instanceof Date ? now : new Date();
    var tolerance = typeof toleranceMin === 'number' ? toleranceMin : 0;
    return reminderAt.getTime() <= current.getTime() + tolerance * 60000;
  }

  /**
   * Година за місцевим часом користувача для довільної таймзони.
   * Дайджест має приходити о 8 ранку ЙОГО ранку, а сервер живе в UTC.
   */
  function hourInZone(date, timeZone) {
    var d = date instanceof Date ? date : new Date();
    if (!timeZone) return d.getHours();
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone, hour: 'numeric', hour12: false,
      }).format(d);
      var hour = parseInt(parts, 10);
      // 24 замість 0 трапляється в частині реалізацій Intl.
      return isNaN(hour) ? d.getHours() : hour % 24;
    } catch (err) {
      return d.getHours();
    }
  }

  /** Дата 'YYYY-MM-DD' за місцевим часом заданої таймзони. */
  function isoInZone(date, timeZone) {
    var d = date instanceof Date ? date : new Date();
    if (!timeZone) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
        '-' + String(d.getDate()).padStart(2, '0');
    }
    try {
      // en-CA дає саме YYYY-MM-DD, без ручного складання частин.
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(d);
    } catch (err) {
      return isoInZone(d, null);
    }
  }

  /**
   * Чи час слати щоденний дайджест цьому користувачу.
   * settings — { enabled, morningHour, eveningHour, tz, lastMorning, lastEvening }.
   * Останні два поля — дати ('YYYY-MM-DD') вже надісланих дайджестів: без них
   * планувальник, що бігає щогодини, слав би той самий дайджест знову і знову.
   */
  function digestDue(settings, now) {
    var s = settings || {};
    if (!s.enabled) return null;
    var tz = s.tz || null;
    var hour = hourInZone(now, tz);
    var today = isoInZone(now, tz);
    if (typeof s.morningHour === 'number' && hour === s.morningHour && s.lastMorning !== today) {
      return { kind: 'morning', date: today };
    }
    if (typeof s.eveningHour === 'number' && hour === s.eveningHour && s.lastEvening !== today) {
      return { kind: 'evening', date: today };
    }
    return null;
  }

  root.reminderOptionsFor = reminderOptionsFor;
  root.reminderAtFor = reminderAtFor;
  root.reminderIsDue = isDue;
  root.digestDue = digestDue;
  root.hourInZone = hourInZone;
  root.isoInZone = isoInZone;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      reminderOptionsFor: reminderOptionsFor, reminderAtFor: reminderAtFor,
      isDue: isDue, digestDue: digestDue, hourInZone: hourInZone, isoInZone: isoInZone,
      DEFAULT_DAY_HOUR: DEFAULT_DAY_HOUR, OFFSETS: OFFSETS,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
