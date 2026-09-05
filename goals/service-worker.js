// Service Worker модуля «Цілі» (scope /goals/).
// Логіка — у спільному ../sw-core.js; тут лише перелік файлів розділу.
importScripts('../sw-core.js');

LifeSW({
  name: 'goals',
  files: [
    './', './index.html', './app.js', './streak.js', './review.js',
    '../boot-guard.js', '../side-nav.js', '../side-nav.css', '../settings.js', '../settings.css',
    '../scroll-lock.js', '../unsaved-guard.js',
    '../sw-register.js',
    '../ai-chat.js', '../ai-chat.css', '../categories-default.js',
    './manifest.json',
    '../budget/firebase-config.js',
    '../icons/icon-192.png', '../icons/icon-512.png',
    '../icons/icon-192-maskable.png', '../icons/icon-512-maskable.png',
  ],
  external: [
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js',
  ],
});
