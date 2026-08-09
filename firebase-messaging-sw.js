// ---- Service Worker для фонових push-сповіщень (нагадування про завдання) ----
// Навмисно ОКРЕМИЙ файл від budget/service-worker.js (той відповідає лише за
// офлайн-кеш статики /budget/ і має інший скоуп). Цей файл має лежати в
// КОРЕНІ сайту, щоб отримати скоуп "/" — Firebase Messaging вимагає, щоб
// service worker покривав сторінку, з якої викликається getToken().
//
// Реєструється з tasks/app.js через:
//   navigator.serviceWorker.register('/firebase-messaging-sw.js')
//
// Це "класичний" (не ES-модульний) service worker, тому SDK підключається
// через importScripts, а не <script>/import — інакше довелось би тягнути
// bundler, чого цей проєкт свідомо уникає.

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Той самий публічний конфіг, що й у budget/firebase-config.js. Не можемо
// зробити importScripts на нього напряму (той файл оголошує firebaseConfig
// через `const` у своєму власному скоупі модуля сторінки — а не глобально
// придатний для SW), тож дублюємо значення тут. Це не секрет (як і в
// firebase-config.js), тому дублювання нешкідливе, хоч і не dry.
firebase.initializeApp({
  apiKey: "AIzaSyAaLHA17S-_76Q3mP6RSDyVvD6kvqg9o1c",
  authDomain: "me-and-only-me-7f531.firebaseapp.com",
  projectId: "me-and-only-me-7f531",
  storageBucket: "me-and-only-me-7f531.firebasestorage.app",
  messagingSenderId: "770760377734",
  appId: "1:770760377734:web:8820059bd6cd8089285807",
});

const messaging = firebase.messaging();

// Спрацьовує, коли пуш прийшов, а сайт НЕ у фокусі (вкладка в фоні або
// закрита взагалі) — саме цей сценарій і був потрібен ("сповіщення, навіть
// коли сайт закритий"). Коли сайт відкритий і у фокусі, повідомлення замість
// цього ловить onMessage() у tasks/app.js (там ми показуємо його самі,
// без дублювання від браузера).
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "Завдання";
  const body = (payload.notification && payload.notification.body) || "";
  self.registration.showNotification(title, {
    body,
    icon: "/budget/icon-192.png",
    badge: "/budget/icon-192.png",
    tag: "life-task-reminder",
    data: { url: (payload.fcmOptions && payload.fcmOptions.link) || "/tasks/index.html" },
  });
});

// Клік по сповіщенню — фокусуємо вже відкриту вкладку /tasks/, якщо є,
// інакше відкриваємо нову.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/tasks/index.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/tasks/") && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
