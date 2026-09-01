// ---- Дні тижня й підсумок дня для смуги ----
// Чисті функції для смуги тижня: які сім днів у ній стоять і що показувати
// під кожним числом.
//
// Файл названий now-queue.js, бо тут жила ще й черга «Зараз» — вона годувала
// картку над списком (одна наступна дія, «маю 15 хвилин», підсумок дня).
// Картку прибрано на прохання, разом із nowQueue() і daySummary(): вони не
// мали більше жодного читача. Назву лишено, щоб не тягнути перейменування
// у service worker, розмітку й тести заради самої назви.
//
// Тут свідомо немає ні DOM, ні Firestore — тільки чисті функції від даних
// (див. tasks/now-queue.test.js).
//
// Файл підключається і як <script> у браузері, і як CommonJS-модуль у Jest.
(function (root) {
  'use strict';

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

  /**
   * Сім днів тижня (понеділок -> неділя), у який потрапляє задана дата.
   * Тиждень скрізь у застосунку починається з понеділка.
   */
  function weekDaysOf(iso) {
    var d = parseIso(iso) || new Date();
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var weekday = d.getDay() === 0 ? 7 : d.getDay();
    var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (weekday - 1));
    var days = [];
    for (var i = 0; i < 7; i++) {
      days.push(isoOf(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
    }
    return days;
  }

  /** Скільки завдань на дату і скільки з них виконано — для позначок у рядку тижня. */
  function dayStats(tasks, iso) {
    var total = 0, done = 0;
    (tasks || []).forEach(function (t) {
      if (!t || t.dueDate !== iso) return;
      total++;
      if (t.done) done++;
    });
    return { total: total, done: done, allDone: total > 0 && total === done };
  }

  root.weekDaysOf = weekDaysOf;
  root.dayStats = dayStats;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { weekDaysOf: weekDaysOf, dayStats: dayStats };
  }
})(typeof window !== 'undefined' ? window : globalThis);
