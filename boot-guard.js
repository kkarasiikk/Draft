// Запобіжник проти вічного спінера на старті.
//
// Кожна сторінка показує #authLoading доти, доки Firebase не скаже, чи є
// збережена сесія. Усередині app.js/home.js на це вже є таймер, але він
// живе в тому самому файлі, що й `firebase.initializeApp(...)`: якщо SDK з
// gstatic не завантажився, перший же рядок кидає виняток, решта файлу — з
// таймером включно — не виконується, і людина лишається дивитись на спінер
// нескінченно, без жодного повідомлення. Саме так виглядав «сайт не
// завантажується» без нічого на екрані.
//
// Тому перевірка живе в окремому файлі: виняток у сусідньому скрипті на неї
// не впливає. Підключати треба ПІСЛЯ тегів SDK — defer-скрипти виконуються
// в порядку документа, тож повільна (а не мертва) мережа сюди просто не
// дійде вчасно, і хибної тривоги не буде.
(function () {
  'use strict';

  // Скільки чекати, якщо SDK на місці, але сторінка чомусь так і не
  // сховала спінер. Власний таймер сторінки спрацьовує на 6-й секунді, тож
  // це вже суто аварійний випадок (виняток десь у app.js).
  var FALLBACK_MS = 12000;

  var STRINGS = {
    uk: {
      title: 'Не вдалося завантажити',
      sub: 'Схоже, немає зв’язку з мережею або її заблоковано. Перевір інтернет і спробуй ще раз — дані на місці.',
      retry: 'Спробувати ще раз',
    },
    ru: {
      title: 'Не удалось загрузить',
      sub: 'Похоже, нет связи с сетью или она заблокирована. Проверь интернет и попробуй ещё раз — данные на месте.',
      retry: 'Попробовать ещё раз',
    },
    pl: {
      title: 'Nie udało się wczytać',
      sub: 'Wygląda na to, że nie ma połączenia z siecią albo jest ono blokowane. Sprawdź internet i spróbuj ponownie — dane są bezpieczne.',
      retry: 'Spróbuj ponownie',
    },
    en: {
      title: 'Could not load',
      sub: 'Looks like there is no network connection, or it is blocked. Check your internet and try again — your data is safe.',
      retry: 'Try again',
    },
  };

  function strings() {
    try {
      var lang = localStorage.getItem('financeAppLang');
      if (STRINGS[lang]) return STRINGS[lang];
    } catch (err) { /* приватний режим */ }
    return STRINGS.uk;
  }

  // Сторінці потрібні саме ці три поверхні SDK: initializeApp, auth і
  // firestore. App Check і functions підключені під try/catch, тож їх
  // відсутність старт не ламає.
  function sdkMissing() {
    return typeof firebase === 'undefined' ||
      typeof firebase.initializeApp !== 'function' ||
      typeof firebase.auth !== 'function' ||
      typeof firebase.firestore !== 'function';
  }

  function spinnerVisible() {
    var host = document.getElementById('authLoading');
    return !!host && host.style.display !== 'none';
  }

  var shown = false;

  function showError() {
    if (shown) return;
    var host = document.getElementById('authLoading');
    if (!host || !spinnerVisible()) return;
    shown = true;

    var s = strings();
    while (host.firstChild) host.removeChild(host.firstChild);

    var box = document.createElement('div');
    box.className = 'auth-box';
    box.id = 'bootError';

    var title = document.createElement('div');
    title.className = 'auth-title';
    title.textContent = s.title;

    var sub = document.createElement('div');
    sub.className = 'auth-sub';
    sub.textContent = s.sub;

    var btn = document.createElement('button');
    btn.className = 'auth-submit';
    btn.type = 'button';
    btn.id = 'bootRetryBtn';
    btn.textContent = s.retry;
    btn.addEventListener('click', function () { location.reload(); });

    box.appendChild(title);
    box.appendChild(sub);
    box.appendChild(btn);
    host.appendChild(box);
    // Поки тут крутився декоративний спінер, екран був прихований від
    // читалок; тепер це справжнє повідомлення, яке треба озвучити.
    host.setAttribute('aria-hidden', 'false');
    host.setAttribute('role', 'alert');
  }

  if (sdkMissing()) {
    console.error('boot-guard: Firebase SDK не завантажився');
    // DOM у момент виконання defer-скрипта вже розібраний, але сторінку
    // підключають і по-іншому (тести, file://) — тому підстраховуємось.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showError);
    } else {
      showError();
    }
    return;
  }

  setTimeout(showError, FALLBACK_MS);
})();
