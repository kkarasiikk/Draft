const firebaseConfig = {
  apiKey: "AIzaSyAaLHA17S-_76Q3mP6RSDyVvD6kvqg9o1c",
  authDomain: "me-and-only-me-7f531.firebaseapp.com",
  projectId: "me-and-only-me-7f531",
  storageBucket: "me-and-only-me-7f531.firebasestorage.app",
  messagingSenderId: "770760377734",
  appId: "1:770760377734:web:8820059bd6cd8089285807"
};

// Site key reCAPTCHA v3 для Firebase App Check.
//
// Саме v3, а не v2: сторінки викликають firebase.appCheck().activate() РЯДКОМ,
// а SDK на рядок ставить ReCaptchaV3Provider. З ключем v2 атестація не пройде,
// і застосунок втратить доступ до Firestore — при тому що в коді все виглядає
// правильно. Для Enterprise довелось би передавати обʼєкт провайдера, тобто
// правити всі пʼять сторінок.
//
// Пара ключів створюється в https://www.google.com/recaptcha/admin (тип v3,
// домени: kkarasiikk.github.io і localhost), у наявному GCP-проєкті, а не
// новому. Далі ключі розходяться:
//   site key   -> сюди; він публічний, як і apiKey вище, і однаково їде
//                 в браузер кожному відвідувачу;
//   secret key -> Firebase Console → App Check → reCAPTCHA. У репозиторії
//                 його немає й бути не повинно.
//
// Якщо тут колись знову опиниться заглушка, застосунок не зламається:
// initializeAppCheck на сторінках обгорнутий у try/catch, App Check просто
// не активується.
const RECAPTCHA_V3_SITE_KEY = "6LcIYZotAAAAAAltf2rpcLi1dUfVw84XF2345A_l";
// Публічний ключ Web Push (VAPID) для FCM.
// Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates.
// Як і apiKey вище, він публічний за задумом: приватна половина пари
// лишається на боці Firebase і клієнту ніколи не видається.
const FCM_VAPID_KEY = "BNEdyox0tk4XTbZQXnbFyBXDB6KZGddK2jxmJRLk0Z4AYMFPPbbVF_ogNlWZ8E8mBJISCldZIA_uy7hsbxyRIZU";
