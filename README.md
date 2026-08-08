# Life

Особистий застосунок для обліку витрат/доходів, заощаджень і нотаток —
PWA (Progressive Web App) без збірки: чистий HTML/CSS/JS + Firebase.

## Стек

- **Frontend** — один `index.html` + `app.js`, без фреймворків і без кроку збірки
- **Firebase Auth** — вхід через email/пароль
- **Cloud Firestore** — зберігання даних (транзакції, категорії, заощадження, нотатки)
- **Firestore Security Rules** — `firestore.rules`
- **Service Worker** — офлайн-режим і кеш статичних файлів (`service-worker.js`)
- **PWA manifest** — `manifest.json`, іконки в т.ч. `maskable`-варіанти для Android
- Зовнішні бібліотеки (з `cdnjs.cloudflare.com`, дозволено через CSP): Chart.js,
  DOMPurify (санітизація HTML нотаток), SheetJS/xlsx (експорт в Excel)
- Курс валют — публічне API НБУ (`bank.gov.ua`), кешується локально

## Локальний запуск

Це статичний сайт без білд-кроку — досить будь-якого локального HTTP-сервера
(відкрити напряму як `file://` не вийде через service worker і Firebase SDK):

```bash
npx serve .
# або
python3 -m http.server 8080
```

Потім відкрити `http://localhost:PORT`.

## Деплой

Проєкт налаштований на Firebase Hosting/Firestore (`.firebaserc`, `firebase.json`):

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

Це задеплоїть `firestore.rules`. Хостинг статичних файлів (GitHub Pages чи
Firebase Hosting) — окремо, залежно від того, де реально розміщений сайт.

## Конфігурація перед першим запуском

1. У `firebase-config.js` вкажи конфіг свого проєкту Firebase (`apiKey`,
   `projectId` тощо — з Firebase Console → Project settings).
2. Там же встав реальний **App Check reCAPTCHA v3 site key**
   (`RECAPTCHA_V3_SITE_KEY`) — без нього другий рівень захисту Firestore
   не активний. Отримати ключ: Firebase Console → App Check → reCAPTCHA v3.
3. У `.firebaserc` заміни `default` project id на свій.

## Модель даних (Firestore)

```
users/{uid}                     -- профіль: lang, currency, categoriesIncome, categoriesExpense
users/{uid}/transactions/{id}   -- {type, amount, category, note, date}
users/{uid}/savings/{id}        -- {type, amount, currency, note, date, goalId}
users/{uid}/savingsGoals/{id}   -- {name, createdAt}
users/{uid}/pages/{id}          -- {title, content, createdAt, updatedAt}
```

Детальні правила доступу — у `firestore.rules`.

## Мови

Інтерфейс перекладений на 4 мови: українська, російська, польська, англійська
(`LANGS` та словники перекладів у `app.js`).

## Резервне копіювання та імпорт даних

- Налаштування → «Експортувати в Excel (.xlsx)» — вивантажує всі дані
  користувача (транзакції, категорії, заощадження, цілі, нотатки) в один
  `.xlsx`-файл, повністю на клієнті, без додаткових запитів до Firestore.
- Налаштування → «Імпортувати транзакції з CSV» — масове додавання
  транзакцій з файлу `.csv` з колонками `дата, тип, категорія, сума, нотатка`
  (назви колонок і значення типу розпізнаються також англійською, російською
  і польською). Категорії, яких ще немає, створюються автоматично.

## Відомі обмеження / TODO

- Немає автотестів (є лише базовий CI-лінт синтаксису, див. `.github/workflows/lint.yml`)
