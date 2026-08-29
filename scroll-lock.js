// ---- Замок прокрутки сторінки під відкритим шаром ----
// Поки відкрите модальне вікно, сторінка під ним лишалась живою: її можна
// було тягнути пальцем, і разом з нею їхало саме вікно — здавалось, що воно
// «не приклеєне». Особливо помітно з відкритою клавіатурою, коли iOS сам
// підкручує сторінку до поля вводу.
//
// Файл підключається на всіх п'яти сторінках і не знає нічого про їхній код:
// усі шари в застосунку показуються однаково — класом `show` на елементі з
// фіксованим положенням, — тож достатньо стежити за цим класом. Інакше
// довелося б смикати замок у кожному місці, де вікно відкривається чи
// закривається, а таких місць десятки, і хоч одне забути — питання часу.
(function () {
  'use strict';

  var SELECTOR = [
    '.modal-overlay.show',
    '.confirm-modal.show',
    '.app-menu-overlay.show',
    '.add-overlay.show',
    '.entry-menu-overlay.show',
    '.item-menu-overlay.show',
    '.task-menu-overlay.show',
    '.picker-overlay.show',
    '.export-overlay.show',
    '.aic-overlay.show',
  ].join(',');

  var locked = false;
  var savedY = 0;
  var pending = false;

  function lock() {
    if (locked) return;
    savedY = window.scrollY || window.pageYOffset || 0;
    // position:fixed, а не overflow:hidden — на iOS другого способу мало,
    // сторінка все одно лишалась тягучою. Ціна: тіло «стрибає» на початок,
    // тому зсуваємо його рівно на ту висоту, на якій людина зупинилась.
    document.body.style.position = 'fixed';
    document.body.style.top = -savedY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    locked = true;
  }

  function unlock() {
    if (!locked) return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    locked = false;
    // Повертаємо сторінку туди, де вона була: без цього закриття вікна
    // щоразу викидало б на початок списку.
    window.scrollTo(0, savedY);
  }

  function sync() {
    pending = false;
    if (document.querySelector(SELECTOR)) lock();
    else unlock();
  }

  // Клас міняють часто (і не лише на шарах), тож саму перевірку відкладаємо
  // до наступного кадру — інакше на кожен дотик рахували б селектор заново.
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(sync);
  }

  function start() {
    new MutationObserver(schedule).observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
      // Чат помічника вставляє свій шар у body вже після завантаження.
      childList: true,
    });
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
