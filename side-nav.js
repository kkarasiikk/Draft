/**
 *  Бічна колонка розділів — одна на всі пʼять сторінок.
 *
 *  До неї навігація жила в плитках головної: щоб із Бюджету потрапити в
 *  Завдання, треба було вийти на головну й зайти вдруге. На телефоні це
 *  чесна ціна за екран, на комп'ютері — ні: місце під постійне меню там і
 *  так порожнє.
 *
 *  Назви розділів лежать ТУТ, а не в словнику кожної сторінки. Інакше
 *  «Тренування» довелось би написати пʼять разів, і пʼятий рано чи пізно
 *  розійшовся б із рештою.
 *
 *  Розмітку колонка малює сама (`mount`), а мову міняє точковими
 *  підписами (`setLang`) — перемальовувати все означало б повідривати
 *  обробники, які сторінка навісила на власні рядки внизу колонки.
 */
(function (root) {
  'use strict';

  var LABELS = {
    uk: { home: 'Головна', budget: 'Бюджет', goals: 'Цілі', tasks: 'Завдання', workout: 'Тренування' },
    ru: { home: 'Главная', budget: 'Бюджет', goals: 'Цели', tasks: 'Задачи', workout: 'Тренировки' },
    pl: { home: 'Główna', budget: 'Budżet', goals: 'Cele', tasks: 'Zadania', workout: 'Treningi' },
    en: { home: 'Home', budget: 'Budget', goals: 'Goals', tasks: 'Tasks', workout: 'Workouts' },
  };

  var ICONS = {
    home: '<path d="M4 10.5L12 4l8 6.5"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/>',
    budget: '<rect x="2.5" y="6" width="19" height="13" rx="3"/><path d="M2.5 10h19"/>',
    goals: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    tasks: '<path d="M4 7l2.5 2.5L11 5"/><path d="M4 17l2.5 2.5L11 15"/><path d="M14 8h6"/><path d="M14 18h6"/>',
    workout: '<path d="M6.5 8v8"/><path d="M17.5 8v8"/><path d="M3.5 10.5v3"/><path d="M20.5 10.5v3"/><path d="M6.5 12h11"/>',
  };

  var ITEMS = [
    { key: 'home', href: 'index.html' },
    { key: 'budget', href: 'budget/index.html' },
    { key: 'goals', href: 'goals/index.html' },
    { key: 'tasks', href: 'tasks/index.html' },
    { key: 'workout', href: 'workout/index.html' },
  ];

  var current = 'home';
  var lang = 'uk';
  var mounted = null;

  function labelOf(key, forLang) {
    var dict = LABELS[forLang || lang] || LABELS.uk;
    return dict[key] || LABELS.uk[key] || key;
  }

  function icon(key) {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke-width="1.9"' +
      ' stroke-linecap="round" stroke-linejoin="round">' + ICONS[key] + '</svg>';
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /**
   *  @param {Element} host   куди підставити колонку (замінюється цілком)
   *  @param {{current?:string, base?:string, lang?:string,
   *           extra?:Array<{id:string, labelId:string, label:string, icon:string}>}} opts
   *    extra — рядки внизу колонки, які належать самій сторінці (експорт,
   *    налаштування). Їхні підписи сторінка перекладає сама: тут вони лише
   *    отримують місце й id, за яким їх знайти.
   */
  function mount(host, opts) {
    if (!host) return null;
    var o = opts || {};
    current = o.current || 'home';
    if (LABELS[o.lang]) lang = o.lang;
    var base = o.base || '';
    var extra = o.extra || [];

    var rows = ITEMS.map(function (item) {
      var text = '<span id="sideLabel-' + item.key + '">' + escapeHtml(labelOf(item.key)) + '</span>';
      // Сторінка, на якій стоїш, — не посилання, а позначка місця: тиснути
      // на неї означало б перезавантажити те саме.
      if (item.key === current) {
        return '<span class="side-link current" aria-current="page">' + icon(item.key) + text + '</span>';
      }
      return '<a class="side-link" href="' + base + item.href + '">' + icon(item.key) + text + '</a>';
    }).join('');

    var bottom = '';
    if (extra.length) {
      bottom = '<div class="side-divider"></div>' + extra.map(function (row) {
        return '<button type="button" class="side-link side-quiet" id="' + row.id + '">' +
          (row.icon || '') + '<span id="' + row.labelId + '">' + escapeHtml(row.label || '') + '</span></button>';
      }).join('');
    }

    var aside = document.createElement('aside');
    aside.className = 'side-nav';
    aside.innerHTML = '<span class="side-brand">Life</span>' + rows +
      '<span class="side-grow"></span>' + bottom;
    host.parentNode.replaceChild(aside, host);
    mounted = aside;
    return aside;
  }

  /** Міняє лише підписи розділів. Рядки внизу перекладає сама сторінка. */
  function setLang(next) {
    if (!LABELS[next]) return;
    lang = next;
    if (!mounted) return;
    ITEMS.forEach(function (item) {
      var el = mounted.querySelector('#sideLabel-' + item.key);
      if (el) el.textContent = labelOf(item.key);
    });
  }

  var api = { mount: mount, setLang: setLang, label: labelOf, LABELS: LABELS };
  root.SideNav = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
