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
// Публічний ключ Web Push (VAPID) для FCM.
// Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates.
// Як і apiKey вище, він публічний за задумом: приватна половина пари
// лишається на боці Firebase і клієнту ніколи не видається.
const FCM_VAPID_KEY = "BNEdyox0tk4XTbZQXnbFyBXDB6KZGddK2jxmJRLk0Z4AYMFPPbbVF_ogNlWZ8E8mBJISCldZIA_uy7hsbxyRIZU";
