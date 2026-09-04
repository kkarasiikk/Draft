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
    uk: { home: 'Головна', budget: 'Бюджет', goals: 'Цілі', tasks: 'Завдання', workout: 'Тренування',
      export: 'Експорт даних', settings: 'Налаштування' },
    ru: { home: 'Главная', budget: 'Бюджет', goals: 'Цели', tasks: 'Задачи', workout: 'Тренировки',
      export: 'Экспорт данных', settings: 'Настройки' },
    pl: { home: 'Główna', budget: 'Budżet', goals: 'Cele', tasks: 'Zadania', workout: 'Treningi',
      export: 'Eksport danych', settings: 'Ustawienia' },
    en: { home: 'Home', budget: 'Budget', goals: 'Goals', tasks: 'Tasks', workout: 'Workouts',
      export: 'Export data', settings: 'Settings' },
  };

  var ICONS = {
    home: '<path d="M4 10.5L12 4l8 6.5"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/>',
    budget: '<rect x="2.5" y="6" width="19" height="13" rx="3"/><path d="M2.5 10h19"/>',
    goals: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    tasks: '<path d="M4 7l2.5 2.5L11 5"/><path d="M4 17l2.5 2.5L11 15"/><path d="M14 8h6"/><path d="M14 18h6"/>',
    workout: '<path d="M6.5 8v8"/><path d="M17.5 8v8"/><path d="M3.5 10.5v3"/><path d="M20.5 10.5v3"/><path d="M6.5 12h11"/>',
    export: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/>',
    // Шестерня, а не сонце. Сонце тут стояло від першої версії меню, де
    // під «налаштуваннями» малась на увазі передусім тема — і читалось воно
    // як «світла тема», а не «налаштування».
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M19.2 14.6a1.6 1.6 0 0 0 .32 1.76l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.05-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.9 1.9 0 1 1-3.8 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.76.32l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.47-.98H3.4a1.9 1.9 0 1 1 0-3.8h.09a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.76l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.06.06a1.6 1.6 0 0 0 1.76.32h.08A1.6 1.6 0 0 0 10.15 3.5V3.4a1.9 1.9 0 1 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.05-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.06a1.6 1.6 0 0 0-.32 1.76v.08a1.6 1.6 0 0 0 1.47.97h.17a1.9 1.9 0 1 1 0 3.8h-.09a1.6 1.6 0 0 0-1.47.97z"/>',
  };

  var ITEMS = [
    { key: 'home', href: 'index.html' },
    { key: 'budget', href: 'budget/index.html' },
    { key: 'goals', href: 'goals/index.html' },
    { key: 'tasks', href: 'tasks/index.html' },
    { key: 'workout', href: 'workout/index.html' },
  ];

  // Два рядки внизу колонки. Вони не розділи, а дії над усім застосунком,
  // тож відділені рискою й приглушені.
  var BOTTOM = [
    { key: 'export', id: 'sideExportBtn', hash: '#export' },
    { key: 'settings', id: 'sideSettingsBtn', hash: '#settings' },
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
   *  @param {{current?:string, base?:string, lang?:string}} opts
   */
  function mount(host, opts) {
    if (!host) return null;
    var o = opts || {};
    current = o.current || 'home';
    if (LABELS[o.lang]) lang = o.lang;
    var base = o.base || '';

    var rows = ITEMS.map(function (item) {
      var text = '<span id="sideLabel-' + item.key + '">' + escapeHtml(labelOf(item.key)) + '</span>';
      // Сторінка, на якій стоїш, — не посилання, а позначка місця: тиснути
      // на неї означало б перезавантажити те саме.
      if (item.key === current) {
        return '<span class="side-link current" aria-current="page">' + icon(item.key) + text + '</span>';
      }
      return '<a class="side-link" href="' + base + item.href + '">' + icon(item.key) + text + '</a>';
    }).join('');

    var bottom = '<div class="side-divider"></div>' + BOTTOM.map(function (row) {
      var body = icon(row.key) + '<span id="sideLabel-' + row.key + '">' +
        escapeHtml(labelOf(row.key)) + '</span>';
      // На головній це кнопки: діалог експорту й меню налаштувань живуть
      // саме там, і сторінка навішує на них обробники за цими id.
      if (current === 'home') {
        return '<button type="button" class="side-link side-quiet" id="' + row.id + '">' + body + '</button>';
      }
      // З розділу — посилання на головну з хешем, який одразу відкриє
      // потрібне. Рядки стоять на всіх пʼятьох сторінках: вони позначають
      // те, що в застосунку є завжди, і зникати при переході в розділ не
      // мають. Той самий прийом, що й #new у зворотному напрямку.
      return '<a class="side-link side-quiet" href="' + base + 'index.html' + row.hash + '">' + body + '</a>';
    }).join('');

    var aside = document.createElement('aside');
    aside.className = 'side-nav';
    // Логотип — той самий знак, що на іконці застосунку (див. README).
    // Вектором і в currentColor, тож колір бере від теми.
    aside.innerHTML = '<span class="side-brand"><svg class="brand-mark" viewBox="35 9 497 276" fill="none" stroke="currentColor" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Life"><path d="M62 91 V195 H138 L163 97 L190 259 L214 195 H504"/><path d="M302 257 V141 Q302 93 358 107"/><path d="M504 195 A52 52 0 1 0 477.05 240.57"/><circle cx="163" cy="43.5" r="22.5" fill="currentColor" stroke="none"/></svg></span>' + rows +
      '<span class="side-grow"></span>' + bottom;
    host.parentNode.replaceChild(aside, host);
    mounted = aside;
    return aside;
  }

  /** Міняє підписи — і розділів, і двох рядків унизу. */
  function setLang(next) {
    if (!LABELS[next]) return;
    lang = next;
    if (!mounted) return;
    ITEMS.concat(BOTTOM).forEach(function (item) {
      var el = mounted.querySelector('#sideLabel-' + item.key);
      if (el) el.textContent = labelOf(item.key);
    });
  }

  var api = { mount: mount, setLang: setLang, label: labelOf, LABELS: LABELS };
  root.SideNav = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
