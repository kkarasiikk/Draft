// ---- Регулярні операції: які з них уже настали ----
//
// Оренда, підписки, зарплата повторюються щомісяця, і вбивати їх руками —
// найнудніша частина ведення бюджету. Саме обчислення дати живе поруч, у
// `budget/recurrence.js`.
//
// ГОЛОВНЕ РІШЕННЯ: настала операція НЕ записується сама.
// Бюджет — це реальні гроші. Автоматично створена транзакція, якої насправді
// не було (підписку скасували, зарплату затримали), тихо псує баланс — тобто
// шкодить більше, ніж економить ручна праця. Тому модуль лише КАЖЕ, що настало,
// а записує людина одним тапом. Той самий підхід, що й «розбір минулих днів» у
// завданнях: борги не осідають мовчки, але й не вирішуються за тебе.
//
// Файл підключається і як <script> у браузері, і як CommonJS-модуль у Jest.
(function (root) {
  'use strict';

  // Скільки пропущених повторів показувати за раз. Якщо застосунок не
  // відкривали пів року, щоденне правило дало б сотні рядків — списком, який
  // неможливо розібрати. Показуємо останні MAX_DUE, решту правило просто
  // прокручує повз (їх уже не відновити чесно — людина не пам'ятає тих сум).
  var MAX_DUE = 24;

  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function todayIso() { return isoOf(new Date()); }

  // nextOccurrence живе в budget/recurrence.js: у браузері він уже в window,
  // у Jest — підтягуємо через require.
  function nextOccurrence(rule, opts) {
    var fn = root.nextOccurrence;
    if (!fn && typeof require !== 'undefined') {
      try { fn = require('./recurrence.js').nextOccurrence; } catch (err) { fn = null; }
    }
    return fn ? fn(rule, opts) : null;
  }

  /**
   * Дати, на які правило вже настало й чекає рішення.
   *
   * @param {{recurrence: object, nextDate: string, active?: boolean}} rule
   * @param {{today?: string}} [opts]
   * @returns {string[]} ISO-дати від найдавнішої до найновішої (може бути порожньо)
   */
  function dueDates(rule, opts) {
    opts = opts || {};
    var today = opts.today || todayIso();
    if (!rule || rule.active === false) return [];
    if (typeof rule.nextDate !== 'string' || !rule.nextDate) return [];

    var out = [];
    var cursor = rule.nextDate;
    var guard = 0;
    // Дата в майбутньому ще не настала — чекаємо.
    while (cursor <= today && guard++ < 400) {
      out.push(cursor);
      var next = nextOccurrence(rule.recurrence, { dueDate: cursor, today: cursor });
      // Зіпсоване правило не має зациклити застосунок: без наступної дати
      // просто зупиняємось на тому, що вже назбирали.
      if (!next || next <= cursor) break;
      cursor = next;
    }
    // Занадто довга пауза — беремо найсвіжіші, а не перші-ліпші.
    return out.length > MAX_DUE ? out.slice(out.length - MAX_DUE) : out;
  }

  /**
   * Куди зсунути nextDate після того, як операцію записали або пропустили.
   * Рахуємо від самої дати повтору, а не від «сьогодні»: пропущений місяць не
   * має зсувати всю подальшу серію (оренда 1 числа лишається 1 числом).
   */
  function advance(rule, postedDate) {
    var next = nextOccurrence(rule.recurrence, { dueDate: postedDate, today: postedDate });
    return next || null;
  }

  /** Скільки правил чекають рішення і скільки всього дат — для банера. */
  function pendingSummary(rules, opts) {
    var total = 0;
    var count = 0;
    (rules || []).forEach(function (rule) {
      var dates = dueDates(rule, opts);
      if (!dates.length) return;
      count += 1;
      total += dates.length;
    });
    return { rules: count, occurrences: total };
  }

  var api = { dueDates: dueDates, advance: advance, pendingSummary: pendingSummary, MAX_DUE: MAX_DUE };
  root.BudgetRecurring = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
