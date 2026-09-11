/**
 *  Нотатки — один блокнот на три розділи.
 *
 *  Блокнот жив лише в бюджеті: картки, читання, редактор із форматуванням,
 *  чекбокси, санітизація — близько трьохсот рядків усередині budget/app.js.
 *  Коли нотатки знадобились і в цілях, і в тренуваннях, вибір був простий:
 *  скопіювати ці триста рядків ще двічі або винести їх сюди. Копії вже одного
 *  разу розійшлись у service worker (див. sw-core.js), і повторювати це на
 *  коді, який чіпає дані користувача, не варто.
 *
 *  Розділи не бачать нотаток одне одного: в документі стоїть `section`.
 *  Документи, записані до цієї зміни, поля не мають — вони бюджетні, бо
 *  тоді блокнот був лише там (див. sectionOf).
 *
 *  Що компонент бере на себе: підписку на колекцію, список карток, читання
 *  з робочими чекбоксами, редактор, видалення. Що лишається сторінці: дати
 *  йому контейнер і сказати, коли показати список — бо нижня навігація в
 *  кожного розділу своя.
 *
 *  Розмітку малює сам, стилі — в notes.css.
 */
(function (root) {
  'use strict';

  var SECTIONS = ['budget', 'goals', 'workout'];
  var DEFAULT_SECTION = 'budget';

  var TEXTS = {
    uk: {
      addBtn: 'Нова нотатка', emptyTitle: 'Тут поки порожньо',
      emptySub: 'Додай першу нотатку кнопкою нижче',
      titleLabel: 'Назва', contentLabel: 'Текст',
      titlePlaceholder: 'Напр. Ідеї на відпустку', contentPlaceholder: 'Пиши тут що завгодно…',
      newTitle: 'Нова нотатка', editTitle: 'Редагувати нотатку',
      noTitle: 'Без назви', save: 'Зберегти', del: 'Видалити',
      errTitle: 'Введи назву нотатки',
      errSave: 'Не вдалося зберегти. Перевір інтернет-зʼєднання',
      confirmTitle: 'Видалити нотатку?', confirmSub: 'Цю дію не можна скасувати',
      cancel: 'Скасувати', back: 'Назад', edit: 'Редагувати', close: 'Закрити',
      fmtBold: 'Жирний', fmtH1: 'Заголовок', fmtH2: 'Підзаголовок',
      fmtBullet: 'Список', fmtCheck: 'Чек-лист',
    },
    ru: {
      addBtn: 'Новая заметка', emptyTitle: 'Здесь пока пусто',
      emptySub: 'Добавь первую заметку кнопкой снизу',
      titleLabel: 'Название', contentLabel: 'Текст',
      titlePlaceholder: 'Напр. Идеи на отпуск', contentPlaceholder: 'Пиши здесь что угодно…',
      newTitle: 'Новая заметка', editTitle: 'Редактировать заметку',
      noTitle: 'Без названия', save: 'Сохранить', del: 'Удалить',
      errTitle: 'Введи название заметки',
      errSave: 'Не удалось сохранить. Проверь интернет-соединение',
      confirmTitle: 'Удалить заметку?', confirmSub: 'Это действие нельзя отменить',
      cancel: 'Отмена', back: 'Назад', edit: 'Редактировать', close: 'Закрыть',
      fmtBold: 'Жирный', fmtH1: 'Заголовок', fmtH2: 'Подзаголовок',
      fmtBullet: 'Список', fmtCheck: 'Чек-лист',
    },
    pl: {
      addBtn: 'Nowa notatka', emptyTitle: 'Tu jeszcze pusto',
      emptySub: 'Dodaj pierwszą notatkę przyciskiem poniżej',
      titleLabel: 'Tytuł', contentLabel: 'Treść',
      titlePlaceholder: 'Np. Pomysły na wakacje', contentPlaceholder: 'Napisz tu cokolwiek…',
      newTitle: 'Nowa notatka', editTitle: 'Edytuj notatkę',
      noTitle: 'Bez tytułu', save: 'Zapisz', del: 'Usuń',
      errTitle: 'Wpisz tytuł notatki',
      errSave: 'Nie udało się zapisać. Sprawdź połączenie z internetem',
      confirmTitle: 'Usunąć notatkę?', confirmSub: 'Tej operacji nie można cofnąć',
      cancel: 'Anuluj', back: 'Wstecz', edit: 'Edytuj', close: 'Zamknij',
      fmtBold: 'Pogrubienie', fmtH1: 'Nagłówek', fmtH2: 'Podtytuł',
      fmtBullet: 'Lista', fmtCheck: 'Lista zadań',
    },
    en: {
      addBtn: 'New note', emptyTitle: 'Nothing here yet',
      emptySub: 'Add your first note using the button below',
      titleLabel: 'Title', contentLabel: 'Content',
      titlePlaceholder: 'E.g. Vacation ideas', contentPlaceholder: 'Write anything here…',
      newTitle: 'New note', editTitle: 'Edit note',
      noTitle: 'Untitled', save: 'Save', del: 'Delete',
      errTitle: 'Enter a note title',
      errSave: 'Could not save. Check your internet connection',
      confirmTitle: 'Delete note?', confirmSub: 'This cannot be undone',
      cancel: 'Cancel', back: 'Back', edit: 'Edit', close: 'Close',
      fmtBold: 'Bold', fmtH1: 'Heading', fmtH2: 'Subheading',
      fmtBullet: 'List', fmtCheck: 'Checklist',
    },
  };

  var MONTHS_GEN = {
    uk: ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'],
    ru: ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
    pl: ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };

  // Чи вміст нотатки — це HTML з редактора, а не старий текстовий формат.
  // Вирішує наявність тега чи сутності БУДЬ-ДЕ, а не на початку:
  // contenteditable не загортає перший рядок у тег, тільки наступні, тож
  // майже кожна нотатка з редактора починається зі слова.
  var HTMLISH_RE = /<[a-z!/][^>]*>|&[a-z]+;|&#\d+;/i;

  var cfg = null;
  var lang = 'uk';
  var pages = [];
  var openId = null;
  var editingId = null;
  var pendingDeleteId = null;
  var host = null;
  var editor = null;
  var confirmBox = null;
  var unsubscribe = null;

  function t(key) {
    var pack = TEXTS[lang] || TEXTS.uk;
    return pack[key] || TEXTS.uk[key] || key;
  }

  // ---- Чисті перетворення вмісту ----

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function looksLikeHtml(content) {
    return HTMLISH_RE.test(content || '');
  }

  function inlineFormat(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // Старий текстовий формат (нотатки, збережені до появи редактора):
  // "# Заголовок", "**жирний**", "- пункт", "[ ] діло".
  function legacyToHtml(text) {
    var lines = (text || '').split('\n');
    var html = '';
    var buffer = [];
    var listType = null;

    function flush() {
      if (!buffer.length) return;
      if (listType === 'checklist') {
        html += buffer.map(function (item) {
          return '<div class="note-check-row"><input type="checkbox"' +
            (item.checked ? ' checked' : '') + '><span' +
            (item.checked ? ' class="checked-text"' : '') + '>' +
            inlineFormat(item.text) + '</span></div>';
        }).join('');
      } else {
        html += '<ul>' + buffer.map(function (item) {
          return '<li>' + inlineFormat(item.text) + '</li>';
        }).join('') + '</ul>';
      }
      buffer = [];
      listType = null;
    }

    lines.forEach(function (line) {
      var check = line.match(/^\[([ x])\]\s?(.*)$/i);
      var bullet = line.match(/^-\s+(.*)$/);
      var h2 = line.match(/^##\s+(.*)$/);
      var h1 = line.match(/^#\s+(.*)$/);
      if (check) {
        if (listType !== 'checklist') flush();
        listType = 'checklist';
        buffer.push({ checked: check[1].toLowerCase() === 'x', text: check[2] });
      } else if (bullet) {
        if (listType !== 'bullet') flush();
        listType = 'bullet';
        buffer.push({ text: bullet[1] });
      } else {
        flush();
        if (h2) html += '<h4>' + inlineFormat(h2[1]) + '</h4>';
        else if (h1) html += '<h3>' + inlineFormat(h1[1]) + '</h3>';
        else if (line.trim() !== '') html += '<div>' + inlineFormat(line) + '</div>';
      }
    });
    flush();
    return html;
  }

  // Нотатки містять лише текст, чекбокси, заголовки, списки й жирний шрифт —
  // тому білий список вузький, а все інше (скрипти, обробники, посилання)
  // відкидається. Без бібліотеки показуємо як текст: краще побачити розмітку
  // очима, ніж виконати неперевірений HTML.
  function sanitize(html) {
    if (typeof DOMPurify === 'undefined') return escapeHtml(html);
    return DOMPurify.sanitize(html || '', {
      ALLOWED_TAGS: ['div', 'span', 'h3', 'h4', 'ul', 'li', 'strong', 'br', 'input'],
      ALLOWED_ATTR: ['type', 'checked', 'class'],
      ALLOW_DATA_ATTR: false,
    });
  }

  function contentToHtml(content) {
    var c = content || '';
    return sanitize(looksLikeHtml(c) ? c : legacyToHtml(c));
  }

  // Підпис під назвою — звичайний текст, тож розмітку треба прибрати, а не
  // показати. Розриви рядків стають проміжками: без них «за серпень<br>Діма»
  // злиплось би в одне слово.
  var ENTITIES = {
    nbsp: '\u00A0', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
  };

  function decodeEntities(text) {
    return String(text).replace(/&(#\d+|[a-z]+);/gi, function (whole, name) {
      if (name.charAt(0) === '#') return String.fromCharCode(parseInt(name.slice(1), 10));
      var key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : whole;
    });
  }

  function snippetOf(content, maxLen) {
    var limit = maxLen || 90;
    var c = content || '';
    var text;
    if (looksLikeHtml(c)) {
      var spaced = c.replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, ' ');
      if (typeof DOMParser !== 'undefined') {
        // Інертний документ: <img onerror> у ньому нічого не запускає.
        var doc = new DOMParser().parseFromString(spaced, 'text/html');
        text = (doc.body && doc.body.textContent) || '';
      } else {
        // Без DOMParser (тести в Node) робимо те саме руками: інакше та сама
        // функція давала б різний результат у браузері й у тесті, а перевіряти
        // тоді нема сенсу.
        text = decodeEntities(spaced.replace(/<[^>]*>/g, ' '));
      }
    } else {
      text = c.replace(/^\[([ x])\]\s?/gim, '')
        .replace(/^#{1,2}\s+/gim, '')
        .replace(/^-\s+/gim, '')
        .replace(/\*\*(.+?)\*\*/g, '$1');
    }
    var clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > limit ? clean.slice(0, limit) + '…' : clean;
  }

  function sectionOf(page) {
    var s = page && page.section;
    return SECTIONS.indexOf(s) === -1 ? DEFAULT_SECTION : s;
  }

  /** Нотатки лише свого розділу, у порядку, який просила сторінка. */
  function visible(all, section, sortMode) {
    var list = (all || []).filter(function (p) { return sectionOf(p) === section; });
    return list.sort(function (a, b) {
      if (sortMode === 'title') {
        return String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' });
      }
      var key = sortMode === 'created' ? 'createdAt' : 'updatedAt';
      var ta = a[key] && a[key].toMillis ? a[key].toMillis() : 0;
      var tb = b[key] && b[key].toMillis ? b[key].toMillis() : 0;
      return tb - ta;
    });
  }

  function formatDate(ts) {
    if (!ts || !ts.toDate) return '';
    var d = ts.toDate();
    var months = MONTHS_GEN[lang] || MONTHS_GEN.uk;
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  // ---- Розмітка ----

  var ICON = {
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"/></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    sheet: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h11l5 5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5Z"/><path d="M14.5 4.5v5.5H20M8 13h8M8 16.5h5"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    bullet: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/><path d="M9 6h11M9 12h11M9 18h11"/></svg>',
    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="14" height="14" rx="3"/><path d="M6 11l2 2 4-4"/></svg>',
  };

  function el(id) { return document.getElementById(id); }

  function renderList() {
    var list = visible(pages, cfg.section, cfg.sort ? cfg.sort() : 'updated');
    var withSnippet = cfg.snippet ? cfg.snippet() : true;
    host.innerHTML =
      (list.length ? '' :
        '<div class="notes-empty">' + ICON.sheet +
          '<div class="notes-empty-title">' + escapeHtml(t('emptyTitle')) + '</div>' +
          '<div class="notes-empty-sub">' + escapeHtml(t('emptySub')) + '</div>' +
        '</div>') +
      '<div class="notes-cards">' +
        list.map(function (p) {
          // Дата — лише коли вона є. Порожній рядок лишав під назвою
          // необжитий проміжок, від якого картка виглядала недомальованою.
          var date = formatDate(p.updatedAt);
          var snippet = withSnippet && p.content ? snippetOf(p.content, 180) : '';
          return '<button type="button" class="note-card" data-note="' + escapeHtml(p.id) + '">' +
            '<div class="note-card-title">' + escapeHtml(p.title || t('noTitle')) + '</div>' +
            (snippet ? '<div class="note-card-snippet">' + escapeHtml(snippet) + '</div>' : '') +
            (date ? '<div class="note-card-date">' + escapeHtml(date) + '</div>' : '') +
          '</button>';
        }).join('') +
      '</div>' +
      '<button type="button" class="notes-add-btn" id="noteAddBtn" data-note-add>' + ICON.plus +
        '<span>' + escapeHtml(t('addBtn')) + '</span></button>';

    host.querySelectorAll('[data-note]').forEach(function (card) {
      card.addEventListener('click', function () {
        openId = card.dataset.note;
        render();
      });
    });
    host.querySelector('[data-note-add]').addEventListener('click', function () { openEditor(null); });
  }

  function renderView() {
    var page = pages.find(function (p) { return p.id === openId; });
    // Нотатку могли видалити з іншого пристрою, поки вона відкрита тут.
    if (!page) { openId = null; renderList(); return; }

    var date = formatDate(page.updatedAt);
    // Своя картка, а не .card сторінки: той клас у кожного розділу свій, із
    // власними тінями й анімацією появи, і нотатка виглядала б у трьох
    // місцях по-різному — саме те, заради чого блокнот і виносили.
    host.innerHTML =
      '<div class="note-view-card">' +
        '<div class="note-view-head">' +
          '<button type="button" class="note-view-back" data-note-back aria-label="' + escapeHtml(t('back')) + '">' +
            ICON.back + '</button>' +
          '<div class="note-view-heading">' +
            '<div class="note-view-title"></div>' +
            (date ? '<div class="note-view-date">' + escapeHtml(date) + '</div>' : '') +
          '</div>' +
          '<div class="note-view-actions">' +
            '<button type="button" class="note-view-act" data-note-edit aria-label="' + escapeHtml(t('edit')) + '">' + ICON.edit + '</button>' +
            '<button type="button" class="note-view-act" data-note-del aria-label="' + escapeHtml(t('del')) + '">' + ICON.trash + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="note-view-content"></div>' +
      '</div>';

    host.querySelector('.note-view-title').textContent = page.title || t('noTitle');
    var content = host.querySelector('.note-view-content');
    content.innerHTML = contentToHtml(page.content || '');
    content.querySelectorAll('.note-check-row input[type=checkbox]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (cb.checked) cb.setAttribute('checked', ''); else cb.removeAttribute('checked');
        var span = cb.nextElementSibling;
        if (span) span.classList.toggle('checked-text', cb.checked);
        saveCheckboxes(page.id, content);
      });
    });

    host.querySelector('[data-note-back]').addEventListener('click', showList);
    host.querySelector('[data-note-edit]').addEventListener('click', function () { openEditor(page.id); });
    host.querySelector('[data-note-del]').addEventListener('click', function () { askDelete(page.id); });
  }

  function render() {
    if (!host || !cfg) return;
    if (openId) renderView(); else renderList();
  }

  // ---- Редактор ----

  function buildEditor() {
    editor = document.createElement('div');
    editor.className = 'note-overlay';
    editor.id = 'noteOverlay';
    editor.innerHTML =
      '<div class="note-modal">' +
        '<div class="note-modal-head">' +
          '<div class="note-modal-title" id="noteModalTitle" data-note-modal-title></div>' +
          '<button type="button" class="note-modal-close" data-note-cancel></button>' +
        '</div>' +
        '<label class="note-field-label" data-note-title-label></label>' +
        '<input type="text" class="note-title-input" id="noteTitleInput" data-note-title maxlength="300">' +
        '<label class="note-field-label" data-note-content-label></label>' +
        '<div class="note-toolbar">' +
          '<button type="button" class="note-tb-btn" data-fmt="bold"><b>' + escapeHtml(t('fmtBold').charAt(0)) + '</b></button>' +
          '<button type="button" class="note-tb-btn" data-fmt="h1">H1</button>' +
          '<button type="button" class="note-tb-btn" data-fmt="h2">H2</button>' +
          '<button type="button" class="note-tb-btn" data-fmt="bullet">' + ICON.bullet + '</button>' +
          '<button type="button" class="note-tb-btn" data-fmt="check">' + ICON.check + '</button>' +
        '</div>' +
        '<div class="note-editor" id="noteContentInput" contenteditable="true" data-note-content></div>' +
        '<div class="note-form-error" id="noteError" data-note-error style="display:none;" role="alert" aria-live="assertive"></div>' +
        '<div class="note-modal-actions">' +
          '<button type="button" class="note-btn-delete" id="noteDeleteBtn" data-note-delete style="display:none;"></button>' +
          '<button type="button" class="note-btn-save" id="noteSaveBtn" data-note-save></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(editor);

    editor.querySelector('[data-note-cancel]').innerHTML = ICON.close;
    editor.querySelector('[data-note-cancel]').addEventListener('click', requestCloseEditor);
    editor.querySelector('[data-note-save]').addEventListener('click', save);
    editor.querySelector('[data-note-delete]').addEventListener('click', function () {
      if (editingId) askDelete(editingId);
    });
    editor.querySelectorAll('.note-tb-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { applyFormat(btn.dataset.fmt); });
    });

    var area = editor.querySelector('[data-note-content]');
    // Вставка — тільки текстом: інакше в нотатку приїжджає чужа розмітка зі
    // стилями, і санітайзер вирізає з неї половину вже при збереженні.
    area.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
    area.addEventListener('change', function (e) {
      var cb = e.target;
      if (cb.tagName === 'INPUT' && cb.type === 'checkbox') {
        if (cb.checked) cb.setAttribute('checked', ''); else cb.removeAttribute('checked');
        var span = cb.nextElementSibling;
        if (span) span.classList.toggle('checked-text', cb.checked);
      }
    });
    applyEditorLang();
  }

  function applyEditorLang() {
    if (!editor) return;
    editor.querySelector('[data-note-title-label]').textContent = t('titleLabel');
    editor.querySelector('[data-note-content-label]').textContent = t('contentLabel');
    editor.querySelector('[data-note-title]').placeholder = t('titlePlaceholder');
    editor.querySelector('[data-note-content]').setAttribute('data-placeholder', t('contentPlaceholder'));
    editor.querySelector('[data-note-save]').textContent = t('save');
    editor.querySelector('[data-note-delete]').textContent = t('del');
    editor.querySelector('[data-note-cancel]').setAttribute('aria-label', t('close'));
    var fmt = { bold: 'fmtBold', h1: 'fmtH1', h2: 'fmtH2', bullet: 'fmtBullet', check: 'fmtCheck' };
    editor.querySelectorAll('.note-tb-btn').forEach(function (btn) {
      btn.title = t(fmt[btn.dataset.fmt]);
      btn.setAttribute('aria-label', t(fmt[btn.dataset.fmt]));
    });
  }

  function openEditor(id) {
    if (!editor) buildEditor();
    editingId = id || null;
    var page = id ? pages.find(function (p) { return p.id === id; }) : null;
    editor.querySelector('[data-note-modal-title]').textContent = page ? t('editTitle') : t('newTitle');
    editor.querySelector('[data-note-title]').value = page ? (page.title || '') : '';
    editor.querySelector('[data-note-content]').innerHTML = page ? contentToHtml(page.content || '') : '';
    editor.querySelector('[data-note-error]').style.display = 'none';
    editor.querySelector('[data-note-delete]').style.display = page ? 'block' : 'none';
    if (cfg.guard && cfg.guard.arm) cfg.guard.arm();
    editor.classList.add('show');
  }

  function closeEditor() {
    if (editor) editor.classList.remove('show');
    editingId = null;
  }

  function requestCloseEditor() {
    if (cfg.guard && cfg.guard.requestClose) cfg.guard.requestClose();
    else closeEditor();
  }

  function applyFormat(fmt) {
    var area = editor.querySelector('[data-note-content]');
    area.focus();
    if (fmt === 'bold') document.execCommand('bold');
    else if (fmt === 'h1') document.execCommand('formatBlock', false, 'h3');
    else if (fmt === 'h2') document.execCommand('formatBlock', false, 'h4');
    else if (fmt === 'bullet') document.execCommand('insertUnorderedList');
    else if (fmt === 'check') insertChecklistItem(area);
  }

  function insertChecklistItem(area) {
    area.focus();
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    if (!area.contains(range.commonAncestorContainer)) return;
    range.deleteContents();

    var row = document.createElement('div');
    row.className = 'note-check-row';
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.contentEditable = 'false';
    var span = document.createElement('span');
    span.textContent = ' ';
    row.appendChild(checkbox);
    row.appendChild(span);

    range.insertNode(row);
    var after = document.createElement('div');
    after.innerHTML = '<br>';
    row.after(after);

    var newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  // ---- Запис ----

  function col() {
    var uid = cfg.auth.currentUser && cfg.auth.currentUser.uid;
    if (!uid) return null;
    return cfg.db.collection('users').doc(uid).collection('pages');
  }

  function stamp() {
    return cfg.firebase.firestore.FieldValue.serverTimestamp();
  }

  async function save() {
    var titleEl = editor.querySelector('[data-note-title]');
    var errEl = editor.querySelector('[data-note-error]');
    var btn = editor.querySelector('[data-note-save]');
    var title = titleEl.value.trim();
    var content = sanitize(editor.querySelector('[data-note-content]').innerHTML);
    errEl.style.display = 'none';
    if (!title) {
      errEl.textContent = t('errTitle');
      errEl.style.display = 'block';
      return;
    }
    var c = col();
    if (!c) return;
    btn.disabled = true;
    try {
      if (editingId) {
        await c.doc(editingId).update({ title: title, content: content, updatedAt: stamp() });
      } else {
        var ref = await c.add({
          title: title, content: content, section: cfg.section,
          createdAt: stamp(), updatedAt: stamp(),
        });
        openId = ref.id;
      }
      if (cfg.guard && cfg.guard.close) cfg.guard.close(); else closeEditor();
    } catch (e) {
      console.error('AppNotes.save:', e);
      errEl.textContent = t('errSave');
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
    }
  }

  function saveCheckboxes(id, contentEl) {
    var c = col();
    if (!c) return;
    c.doc(id).update({ content: sanitize(contentEl.innerHTML), updatedAt: stamp() })
      .catch(function (e) { console.error('AppNotes.saveCheckboxes:', e); });
  }

  function askDelete(id) {
    pendingDeleteId = id;
    if (!confirmBox) buildConfirm();
    confirmBox.querySelector('[data-note-confirm-title]').textContent = t('confirmTitle');
    confirmBox.querySelector('[data-note-confirm-sub]').textContent = t('confirmSub');
    confirmBox.querySelector('[data-note-confirm-cancel]').textContent = t('cancel');
    confirmBox.querySelector('[data-note-confirm-ok]').textContent = t('del');
    confirmBox.classList.add('show');
  }

  function buildConfirm() {
    confirmBox = document.createElement('div');
    confirmBox.className = 'note-overlay note-confirm-overlay';
    confirmBox.id = 'noteConfirmOverlay';
    confirmBox.innerHTML =
      '<div class="note-confirm">' +
        '<div class="note-confirm-title" data-note-confirm-title></div>' +
        '<div class="note-confirm-sub" data-note-confirm-sub></div>' +
        '<div class="note-confirm-actions">' +
          '<button type="button" class="note-btn-cancel" data-note-confirm-cancel></button>' +
          '<button type="button" class="note-btn-delete" data-note-confirm-ok></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(confirmBox);
    confirmBox.querySelector('[data-note-confirm-cancel]').addEventListener('click', function () {
      pendingDeleteId = null;
      confirmBox.classList.remove('show');
    });
    confirmBox.querySelector('[data-note-confirm-ok]').addEventListener('click', doDelete);
  }

  async function doDelete() {
    var id = pendingDeleteId;
    pendingDeleteId = null;
    confirmBox.classList.remove('show');
    var c = col();
    if (!id || !c) return;
    try {
      await c.doc(id).delete();
      if (openId === id) openId = null;
      closeEditor();
    } catch (e) {
      console.error('AppNotes.delete:', e);
    }
  }

  // ---- Підписка ----

  function subscribe() {
    var c = col();
    if (!c) return;
    if (unsubscribe) unsubscribe();
    unsubscribe = c.onSnapshot(function (snap) {
      pages = snap.docs.map(function (d) {
        var data = d.data();
        data.id = d.id;
        return data;
      });
      render();
    }, function (err) {
      console.error('AppNotes sync error', err);
    });
  }

  // ---- Публічне ----

  function init(options) {
    cfg = options || {};
    if (TEXTS[cfg.lang]) lang = cfg.lang;
    if (SECTIONS.indexOf(cfg.section) === -1) cfg.section = DEFAULT_SECTION;
    // Приймаємо і селектор, і сам елемент: сторінки передають '#notesHost',
    // а тести зручніше піднімати з готовим вузлом.
    host = typeof cfg.host === 'string' ? document.querySelector(cfg.host) : cfg.host;
    if (!host) throw new Error('AppNotes: не знайдено контейнер ' + cfg.host);
    buildEditor();
    buildGuard();
    if (cfg.auth.currentUser) subscribe();
    render();
  }

  // Набраний і не збережений текст нотатки має пережити випадковий тап повз
  // вікно. Сторожа будує компонент, а не сторінка: інакше редактор поводився б
  // по-різному залежно від того, у якому розділі його відкрили, — а виносили
  // його рівно для того, щоб не поводився.
  function buildGuard() {
    if (cfg.guard) return;
    if (typeof UnsavedGuard === 'undefined' || !UnsavedGuard.create) return;
    cfg.guard = UnsavedGuard.create({
      overlay: 'noteOverlay',
      snapshot: function () {
        return JSON.stringify({
          title: editor.querySelector('[data-note-title]').value.trim(),
          // Порожній contenteditable браузер сам добудовує тегом <br> при
          // фокусі — без цієї нормалізації нотатка вважалась би зміненою від
          // самого лише дотику до поля.
          content: editor.querySelector('[data-note-content]').innerHTML
            .replace(/<br\s*\/?>\s*$/i, '').replace(/\s+/g, ' ').trim(),
        });
      },
      save: function () { return save(); },
      texts: cfg.guardTexts,
    });
  }

  /** Сторінка каже, що користувач увійшов: тільки тепер є куди підписуватись. */
  function start() { subscribe(); }

  function stop() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    pages = [];
    openId = null;
    render();
  }

  /** Нижня навігація розділу повернулась на «Нотатки» — показуємо список. */
  function showList() {
    openId = null;
    render();
  }

  function setLang(next) {
    if (!TEXTS[next]) return;
    lang = next;
    applyEditorLang();
    render();
  }

  /** Чи відкрита якась нотатка на читання — сторінці це треба для заголовка. */
  function isViewing() { return !!openId; }

  var api = {
    init: init, start: start, stop: stop, showList: showList,
    setLang: setLang, render: render, isViewing: isViewing,
    openEditor: openEditor, closeEditor: closeEditor,
    // Чисті функції — для тестів і для сторінок, яким треба показати
    // шматок нотатки поза блокнотом.
    sectionOf: sectionOf,
    visible: visible,
    snippetOf: snippetOf,
    looksLikeHtml: looksLikeHtml,
    legacyToHtml: legacyToHtml,
    SECTIONS: SECTIONS,
  };

  root.AppNotes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
