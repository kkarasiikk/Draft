const firebaseConfig = {
  apiKey: "AIzaSyAaLHA17S-_76Q3mP6RSDyVvD6kvqg9o1c",
  authDomain: "me-and-only-me-7f531.firebaseapp.com",
  projectId: "me-and-only-me-7f531",
  storageBucket: "me-and-only-me-7f531.firebasestorage.app",
  messagingSenderId: "770760377734",
  appId: "1:770760377734:web:8820059bd6cd8089285807"
};

// Site key reCAPTCHA v3 для Firebase App Check.
// Отримати: Firebase Console → Build → App Check → зареєструвати веб-застосунок
// → провайдер "reCAPTCHA v3" → буде запропоновано створити/вставити site key
// (можна одразу з консолі Firebase, вона сама заведе його в Google Cloud reCAPTCHA).
// Це публічний ключ (як і apiKey вище) — його не потрібно приховувати,
// секретна частина reCAPTCHA лишається на боці Google/Firebase.
// Поки тут заглушка — App Check просто не активується (initializeAppCheck
// нижче обгорнутий у try/catch), застосунок працює як раніше.
const RECAPTCHA_V3_SITE_KEY = "ВСТАВ_СЮДИ_СВІЙ_SITE_KEY";

// Web Push сертифікат (VAPID key) для Firebase Cloud Messaging — потрібен,
// щоб /tasks/ міг попросити браузер підписатись на push-нагадування.
// Отримати: Firebase Console → Project settings → Cloud Messaging →
// вкладка "Web configuration" → "Web Push certificates" → Generate key pair.
// Це теж публічний ключ (як apiKey і RECAPTCHA_V3_SITE_KEY вище).
// Поки заглушка — кнопка "Увімкнути нагадування" на сторінці задач
// покаже пояснення, що ключ ще не налаштований.
const FCM_VAPID_KEY = "ВСТАВ_СЮДИ_СВІЙ_VAPID_KEY";