// Service Worker модуля «Завдання» (scope /tasks/).
// Логіка — у спільному ../sw-core.js; тут лише перелік файлів розділу.
importScripts('../sw-core.js');

LifeSW({
  name: 'tasks',
  files: [
    './', './index.html', './app.js', './quick-parse.js', './now-queue.js',
    './recurrence.js', './stats.js', './reminders.js', './push.js',
    '../boot-guard.js', '../side-nav.js', '../side-nav.css', '../scroll-lock.js', '../unsaved-guard.js',
    '../ai-chat.js', '../ai-chat.css', '../goals/streak.js',
    './manifest.json',
    '../budget/firebase-config.js',
    '../budget/icon-192.png', '../budget/icon-512.png',
    '../budget/icon-192-maskable.png', '../budget/icon-512-maskable.png',
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
