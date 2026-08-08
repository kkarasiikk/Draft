const CACHE_NAME = 'moi-finansy-v4';
const NETWORK_FIRST = ['./', './index.html', './app.js'];
const FILES_TO_CACHE = ['./', './index.html', './app.js', './firebase-config.js', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-192-maskable.png', './icon-512-maskable.png'];
// Застосунок жорстко залежить від цих зовнішніх бібліотек (firebase.initializeApp()
// викликається у першому рядку app.js) — без них офлайн-запуск падав з
// "firebase is not defined", навіть коли локальні файли були в кеші.
const EXTERNAL_FILES_TO_CACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all([
      cache.addAll(FILES_TO_CACHE),
      // Кешуємо зовнішні скрипти окремо і толерантно до помилок — якщо одне
      // CDN недоступне під час встановлення SW, це не має зривати весь install.
      ...EXTERNAL_FILES_TO_CACHE.map((url) =>
        fetch(url, { mode: 'cors' }).then((resp) => resp.ok && cache.put(url, resp)).catch(() => {})
      ),
    ]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const path = './' + url.pathname.split('/').pop();
  const isNetworkFirst = NETWORK_FIRST.includes(path) || event.request.mode === 'navigate';

  if (isNetworkFirst) {
    // Головні файли додатку: завжди тягнемо свіжу версію, кеш — лише якщо немає інтернету
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Другорядні файли (іконки тощо): кеш спочатку, оновлення у фоні
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
