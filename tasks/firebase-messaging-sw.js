// Service Worker для push-нагадувань.
//
// Окремий від tasks/service-worker.js і навмисно з іншим scope: два SW не
// можуть мати однаковий scope — пізніша реєстрація витіснила б попередню, і
// офлайн-кеш модуля перестав би працювати. Push приходить у цей SW незалежно
// від того, наскільки вузький його scope.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
importScripts('../budget/firebase-config.js');

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Фонове повідомлення: застосунок закритий або в іншій вкладці.
// Показуємо системне сповіщення самі — саме заради цього SW і потрібен.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || 'Life';
  self.registration.showNotification(title, {
    body: data.body || '',
    icon: '../budget/icon-192.png',
    badge: '../budget/icon-192.png',
    // tag склеює повторні сповіщення про те саме завдання в одне,
    // замість стосу однакових карток у центрі сповіщень.
    tag: data.tag || 'life-tasks',
    data: { url: data.url || '../tasks/index.html' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/tasks/index.html', self.location.origin).href;
  event.waitUntil(
    // Якщо застосунок уже відкритий — фокусуємо його, а не плодимо вкладки.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.indexOf('/tasks/') !== -1 && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : null;
    })
  );
});
