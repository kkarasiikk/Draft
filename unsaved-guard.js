// ---- Захист від втрати незбереженого ----
// Усі модулі закривають форми тапом повз вікно. На телефоні промах повз вікно
// трапляється легко, а форми заповнюють довго — і разом із вікном зникало все
// набране, без жодного питання. Цей модуль додає до форми одне: якщо в ній
// щось змінилось, вихід перепитує, що робити зі змінами.
//
// Живе в корені й підключається кожним модулем як <script src="../unsaved-guard.js">
// (той самий підхід, що й у ai-chat.js та export-xlsx.js) — інакше та сама
// логіка лежала б у чотирьох копіях і розʼїхалась би при першій же правці.
//
// Порівнюється завжди знімок ДАНИХ, а не HTML: id рядків у формах генеруються
// заново на кожному відкритті й до змін користувача стосунку не мають.
(function (root) {
  'use strict';

  // Одне вікно на сторінку: одночасно відкрита рівно одна форма, тож і
  // питання про незбережене буває тільки одне.
  var dialog = null;
  var active = null; // гард, який зараз тримає діалог

  function build() {
    if (dialog) return dialog;

    // Класи .confirm-modal / .confirm-box / .btn-cancel / .submit-btn уже є
    // в кожному модулі — беремо їх. Своїх правил тут рівно три, і саме тому
    // вони тут, а не в чотирьох однакових копіях по index.html.
    var style = document.createElement('style');
    style.textContent =
      // Три дії в рядок не влазять: «Продовжити редагування» саме по собі
      // ширше за половину діалогу.
      '.unsaved-actions{flex-direction:column;}' +
      '.unsaved-actions .submit-btn{margin-top:0;font-size:14px;padding:11px 0;}' +
      '.unsaved-actions .btn-cancel.danger{color:var(--expense);}';
    document.head.appendChild(style);

    dialog = document.createElement('div');
    dialog.className = 'confirm-modal';
    dialog.id = 'unsavedGuardOverlay';
    dialog.innerHTML =
      '<div class="confirm-box">' +
        '<div class="confirm-title" data-part="title"></div>' +
        '<div class="confirm-sub" data-part="sub"></div>' +
        '<div class="confirm-actions unsaved-actions">' +
          '<button type="button" class="submit-btn" data-act="save"></button>' +
          '<button type="button" class="btn-cancel danger" data-act="discard"></button>' +
          '<button type="button" class="btn-cancel" data-act="keep"></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dialog);

    dialog.addEventListener('click', function (e) {
      // Тап повз сам діалог — найобережніше тлумачення: раз людина вже раз
      // промахнулась повз вікно, другий промах не має нічого коштувати.
      if (e.target === dialog) { hide(); return; }
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act || !active) return;
      var guard = active;
      hide();
      if (act === 'discard') guard.close();
      else if (act === 'save') guard.save();
      // 'keep' — діалог уже сховано, форма лишилась відкритою
    });
    return dialog;
  }

  function hide() {
    if (dialog) dialog.classList.remove('show');
    active = null;
  }

  function show(guard, texts) {
    var d = build();
    d.querySelector('[data-part="title"]').textContent = texts.title || '';
    d.querySelector('[data-part="sub"]').textContent = texts.sub || '';
    d.querySelector('[data-act="save"]').textContent = texts.save || '';
    d.querySelector('[data-act="discard"]').textContent = texts.discard || '';
    d.querySelector('[data-act="keep"]').textContent = texts.keep || '';
    active = guard;
    d.classList.add('show');
  }

  /**
   * @param {{overlay:string, snapshot:function, save:function,
   *          texts:function, onClose?:function}} opts
   *   overlay  — id елемента-підкладки форми
   *   snapshot — повертає рядок зі станом форми (JSON.stringify даних)
   *   save     — запускає збереження форми (те саме, що кнопка «Зберегти»)
   *   texts    — повертає {title, sub, save, discard, keep}; функція, а не
   *              обʼєкт, бо мову інтерфейсу можна перемкнути на льоту
   *   onClose  — необовʼязкове прибирання після реального закриття форми
   * @returns {{arm:function, isDirty:function, close:function,
   *            save:function, requestClose:function}}
   */
  function create(opts) {
    var snapshot = null;
    var overlay = document.getElementById(opts.overlay);
    // Будуємо одразу, а не при першому показі: гарди створюються з коду
    // сторінки, тобто body вже є, а діалог, який існує з самого початку,
    // поводиться передбачувано (і в тестах теж).
    build();

    function state() {
      try {
        return opts.snapshot();
      } catch (err) {
        // Знімок не вдався — вважаємо форму незміненою. Хибне «у вас є
        // незбережені зміни» на кожному закритті дратувало б сильніше,
        // ніж користь від нього.
        console.error('unsaved-guard snapshot:', err);
        return null;
      }
    }

    var guard = {
      // Викликати ПІСЛЯ того, як форму заповнили даними, і до показу:
      // інакше вона вважалась би зміненою одразу після відкриття.
      arm: function () { snapshot = state(); },
      isDirty: function () {
        var now = state();
        return snapshot !== null && now !== null && now !== snapshot;
      },
      // Закрити по-справжньому: і форму, і питання про неї.
      close: function () {
        snapshot = null;
        hide();
        if (overlay) overlay.classList.remove('show');
        if (opts.onClose) opts.onClose();
      },
      save: function () { return opts.save(); },
      // Форму лишаємо видимою під діалогом (.confirm-modal завжди вище за
      // .modal-overlay): видно, що саме на кону, а якщо збереження не пройде,
      // помилка читається на місці, а не в порожньому екрані.
      requestClose: function () {
        if (!guard.isDirty()) { guard.close(); return; }
        show(guard, opts.texts());
      },
    };

    // Тап повз вікно — саме та випадковість, заради якої це все.
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) guard.requestClose();
      });
    } else {
      console.error('unsaved-guard: немає елемента #' + opts.overlay);
    }

    return guard;
  }

  root.UnsavedGuard = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
