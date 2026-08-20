// Service Worker домашнього хаба. Кожен модуль має власний SW зі своїм
// scope (`/`, `/budget/`, `/tasks/`, `/workout/`) — для сторінки завжди
// виграє реєстрація з найдовшим збігом scope, тож цей файл фактично
// обслуговує лише хаб.
const CACHE_NAME = 'life-home-v14';
// Чистимо лише власні (застарілі) кеші: `caches` спільний для всього
// походження, тож видалення "всього зайвого" стерло б кеші інших модулів.
const CACHE_PREFIXES = ['life-home-'];
const NETWORK_FIRST = ['./ai-chat.js', './ai-chat.css', './', './index.html', './home.js', './export-xlsx.js'];
const FILES_TO_CACHE = ['./ai-chat.js', './ai-chat.css', './', './index.html', './home.js', './export-xlsx.js',
  './budget/categories-default.js', './manifest.json',
  './budget/firebase-config.js', './budget/icon-192.png', './budget/icon-512.png',
  './budget/icon-192-maskable.png', './budget/icon-512-maskable.png'];
// Сторінка жорстко залежить від Firebase SDK (firebase.initializeApp() —
// перший рядок home.js), тож без цих файлів офлайн-запуск падав би з
// "firebase is not defined", навіть коли локальні файли є в кеші.
const EXTERNAL_FILES_TO_CACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all([
      cache.addAll(FILES_TO_CACHE),
      // Зовнішні скрипти кешуємо толерантно до помилок — недоступне CDN
      // під час встановлення не має зривати весь install.
      ...EXTERNAL_FILES_TO_CACHE.map((url) =>
        fetch(url, { mode: 'cors' }).then((resp) => resp.ok && cache.put(url, resp)).catch(() => {})
      ),
    ]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME && CACHE_PREFIXES.some((p) => k.startsWith(p)))
        .map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const path = './' + url.pathname.split('/').pop();
  const isNetworkFirst = NETWORK_FIRST.includes(path) || event.request.mode === 'navigate';

  if (isNetworkFirst) {
    // Головні файли: завжди свіжа версія, кеш — лише якщо немає інтернету.
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Другорядні файли (іконки тощо): кеш спочатку, оновлення у фоні.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
