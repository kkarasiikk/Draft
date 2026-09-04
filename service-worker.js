// Service Worker домашнього хаба (scope `/`).
//
// Уся логіка — у спільному ../sw-core.js: тут лишається тільки те, чим хаб
// відрізняється від решти, тобто перелік його файлів. Кожен розділ має свій
// SW зі своїм scope, і для сторінки виграє реєстрація з найдовшим збігом.
importScripts('./sw-core.js');

LifeSW({
  name: 'home',
  files: [
    './', './index.html', './home.js', './home-summary.js', './export-data.js',
    './side-nav.js', './side-nav.css', './scroll-lock.js', './boot-guard.js',
    './unsaved-guard.js', './sw-register.js',
    './goals/streak.js', './goals/review.js', './categories-default.js',
    './manifest.json',
    './budget/firebase-config.js',
    './icons/icon-192.png', './icons/icon-512.png',
    './icons/icon-192-maskable.png', './icons/icon-512-maskable.png',
  ],
  // Сторінка жорстко залежить від Firebase SDK (firebase.initializeApp() —
  // перший рядок home.js), тож без цих файлів офлайн-запуск падав би з
  // "firebase is not defined", навіть коли локальні файли є в кеші.
  external: [
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js',
  ],
});
