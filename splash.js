// Заставка застосунку: кардіограма з логотипа збирається в знак Life.
//
// Це не відео, а те саме креслення, що й у шапці — ті самі координати з
// index.html. Тому заставка важить чотири кілобайти замість шестисот,
// зʼявляється миттєво (нема чого підвантажувати) і лишається різкою на
// будь-якому екрані.
//
// Показується РАЗ НА СЕАНС. У встановленому застосунку кожен запуск — новий
// сеанс, тож заставка вітає при відкритті; а перехід між розділами (це
// повне перезавантаження сторінки — розділи окремі) сеанс не міняє, і
// крутити ту саму анімацію вчетверте за хвилину вона не буде.
(function () {
  'use strict';

  var KEY = 'lifeSplashShown';
  var HOLD_MS = 1550;      // поки триває саме креслення й коротка витримка
  var FADE_MS = 350;       // згасання
  var CALM_HOLD_MS = 650;  // якщо система просить менше руху — просто знак
  var FAILSAFE_MS = 6000;  // аварійне зняття, якщо щось піде не так

  function seen() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (err) { return false; }
  }
  function remember() {
    try { sessionStorage.setItem(KEY, '1'); } catch (err) { /* приватний режим */ }
  }

  if (seen()) return;
  // Позначку ставимо одразу: якщо людина закриє вкладку на півдорозі,
  // повторний показ їй потрібен не більше, ніж перший.
  remember();

  var calm = false;
  try {
    calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (err) { /* старий браузер — рахуємо, що рух дозволено */ }

  var CSS = [
    '.life-splash{position:fixed;inset:0;z-index:99999;background:#000;',
    '  display:flex;align-items:center;justify-content:center;',
    '  opacity:1;transition:opacity ' + FADE_MS + 'ms ease;}',
    '.life-splash.gone{opacity:0;}',
    '.life-splash svg{width:min(52vw,300px);height:auto;color:#fff;',
    '  filter:drop-shadow(0 0 22px rgba(255,255,255,.16));}',
    // pathLength="1" дає однакову шкалу всім лініям: довжина кожної — рівно
    // одиниця, тож затримки в секундах читаються як задум, а не як підбір.
    '.life-splash path{stroke-dasharray:1;stroke-dashoffset:1;',
    '  animation:lifeDraw var(--dur) cubic-bezier(.33,0,.2,1) var(--wait) forwards;}',
    '.life-splash circle{opacity:0;animation:lifeDot .28s cubic-bezier(.2,.9,.3,1) .98s forwards;}',
    '@keyframes lifeDraw{to{stroke-dashoffset:0;}}',
    '@keyframes lifeDot{from{opacity:0;transform:translateY(-70px);}to{opacity:1;transform:translateY(0);}}',
    // Менше руху — знак просто стоїть, без креслення.
    '.life-splash.calm path{animation:none;stroke-dashoffset:0;}',
    '.life-splash.calm circle{animation:none;opacity:1;}',
  ].join('\n');

  // Ті самі шляхи, що й у шапці застосунку (index.html, .brand-mark).
  // Порядок інший: першою йде лінія пульсу, і вже з неї виростає буква.
  var SVG = '<svg viewBox="35 9 497 276" fill="none" stroke="currentColor" stroke-width="30"' +
    ' stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Life">' +
    '<path pathLength="1" style="--dur:.46s;--wait:0s"   d="M138 195 L163 97 L190 259 L214 195 H504"/>' +
    '<path pathLength="1" style="--dur:.34s;--wait:.34s" d="M138 195 H62 V91"/>' +
    '<path pathLength="1" style="--dur:.30s;--wait:.60s" d="M302 257 V141 Q302 93 358 107"/>' +
    '<path pathLength="1" style="--dur:.34s;--wait:.74s" d="M504 195 A52 52 0 1 0 477.05 240.57"/>' +
    '<circle cx="163" cy="43.5" r="22.5" fill="currentColor" stroke="none"/>' +
    '</svg>';

  function start() {
    if (document.getElementById('lifeSplash')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.className = 'life-splash' + (calm ? ' calm' : '');
    box.id = 'lifeSplash';
    // Для читалок це декорація: знак застосунку вони й так назвуть у шапці.
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = SVG;
    document.body.appendChild(box);

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      box.classList.add('gone');
      setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
        if (style.parentNode) style.parentNode.removeChild(style);
      }, FADE_MS);
    }

    // Тап або будь-яка клавіша знімають заставку одразу: людина, яка
    // поспішає, не має чекати на красу.
    box.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close, { once: true });

    setTimeout(close, calm ? CALM_HOLD_MS : HOLD_MS);
    // Запобіжник на випадок, якщо таймер вище чомусь не спрацює: заставка,
    // що лишилась на екрані, — це застосунок, який не відкрився.
    setTimeout(function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    }, FAILSAFE_MS);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
