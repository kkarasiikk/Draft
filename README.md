# Life

Особистий застосунок: бюджет, а тепер і щоденні завдання — в одному місці.
PWA (Progressive Web App) без збірки: чистий HTML/CSS/JS + Firebase.

## Структура проєкту

```
index.html, index.js, home.js   -- домашній хаб (вибір розділу після входу)
budget/                          -- модуль «Бюджет»: транзакції, заощадження, цілі, нотатки
tasks/                           -- модуль «Завдання»: підзадачі, теги, пріоритет, push-нагадування
firebase-messaging-sw.js         -- service worker для фонових push (Cloud Messaging), у корені сайту
firestore.rules                  -- правила доступу Firestore (усі колекції, обидва модулі)
firestore.indexes.json           -- складені індекси (потрібні для запиту нагадувань)
firebase.json                    -- деплой: Firestore rules/indexes + Cloud Functions
index.js, ai.js, tasks.js        -- Cloud Functions (окремий Node-проєкт, package.json у корені)
```

Кожен модуль (`budget/`, `tasks/`) — самодостатня сторінка зі своїм входом
(email/пароль), темою й мовою; профіль і сесія спільні (той самий Firebase
проєкт), тому вхід один раз на домашній сторінці не обов'язковий — можна
увійти прямо в модулі.

## Стек

- **Frontend** — чистий HTML/CSS/JS на сторінку, без фреймворків і без кроку збірки
- **Firebase Auth** — вхід через email/пароль
- **Cloud Firestore** — зберігання даних (транзакції, категорії, заощадження, нотатки, завдання)
- **Firebase Cloud Messaging** — push-нагадування про завдання (навіть коли сайт закритий)
- **Cloud Functions** — `walletSync` (прийом транзакцій з Apple Shortcuts), `aiChat`
  (AI-асистент), `taskReminders` (заплановане надсилання push-нагадувань, кожні 5 хв)
- **Firestore Security Rules** — `firestore.rules`
- **Service Worker** — офлайн-кеш статики в `budget/` (`budget/service-worker.js`) +
  окремий SW для фонових push у корені (`firebase-messaging-sw.js`)
- **PWA manifest** — окремий `manifest.json` на кожен модуль (свій `scope`/`start_url`),
  іконки в т.ч. `maskable`-варіанти для Android — спільні, лежать у `budget/`
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

Потім відкрити `http://localhost:PORT` (домашній хаб) або одразу
`http://localhost:PORT/budget/` чи `http://localhost:PORT/tasks/`.

## Деплой

Проєкт налаштований на Firebase Hosting/Firestore/Functions (`firebase.json`):

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # вибрати/додати свій проєкт, якщо ще не зроблено
firebase deploy
```

Це задеплоїть `firestore.rules`, `firestore.indexes.json` і Cloud Functions
(`walletSync`, `aiChat`, `taskReminders`). Хостинг статичних файлів (GitHub
Pages чи Firebase Hosting) — окремо, залежно від того, де реально
розміщений сайт.

**Важливо:** `taskReminders` — це запланована функція (Cloud Scheduler),
а Cloud Scheduler і вихідний трафік Cloud Functions вимагають, щоб проєкт
Firebase був на тарифі **Blaze** (pay-as-you-go). Без Blaze функції
`walletSync`/`aiChat`/`taskReminders` задеплоїти не вдасться. У межах
безкоштовних лімітів Blaze (2 млн викликів Cloud Functions і 3 завдання
Cloud Scheduler на місяць) звичайне особисте використання нічого не коштує.

## Конфігурація перед першим запуском

1. У `budget/firebase-config.js` вкажи конфіг свого проєкту Firebase
   (`apiKey`, `projectId` тощо — з Firebase Console → Project settings).
   Цей самий файл підключають і `index.html` (домашній хаб), і `tasks/index.html`.
2. Там же встав реальний **App Check reCAPTCHA v3 site key**
   (`RECAPTCHA_V3_SITE_KEY`) — без нього другий рівень захисту Firestore
   не активний. Отримати ключ: Firebase Console → App Check → reCAPTCHA v3.
3. Щоб увімкнути **push-нагадування про завдання**, там же встав реальний
   **VAPID key** (`FCM_VAPID_KEY`): Firebase Console → Project settings →
   Cloud Messaging → Web configuration → Web Push certificates → Generate
   key pair. Без нього кнопка «Push-сповіщення» на сторінці завдань
   пояснить, що ключ ще не налаштований, і не даватиме увімкнутись —
   решта модуля «Завдання» (без push) працює й без цього кроку.
4. У `firebase-messaging-sw.js` (корінь сайту) конфіг Firebase продубльовано
   окремо (service worker не може підключити `budget/firebase-config.js`
   як звичайний скрипт сторінки) — онови його там теж, якщо змінюєш проєкт.
5. Переконайся, що `.firebaserc` вказує на твій `projectId` (створи файл,
   якщо його ще немає — `firebase use --add` зробить це автоматично).

## Модель даних (Firestore)

```
users/{uid}                     -- профіль: lang, currency, categoriesIncome, categoriesExpense
users/{uid}/transactions/{id}   -- {type, amount, category, note, date}
users/{uid}/savings/{id}        -- {type, amount, currency, note, date, goalId}
users/{uid}/savingsGoals/{id}   -- {name, createdAt}
users/{uid}/pages/{id}          -- {title, content, createdAt, updatedAt}
users/{uid}/tasks/{id}          -- {title, notes, done, priority, tags, dueDate, dueTime,
                                    reminderMinutesBefore, reminderAt, notifiedAt, subtasks,
                                    createdAt, updatedAt}
users/{uid}/fcmTokens/{token}   -- {createdAt, userAgent} — пристрої для push-нагадувань
```

Детальні правила доступу — у `firestore.rules`.

## Модуль «Завдання» (`tasks/`)

- Один список на всіх (без окремих проєктів/списків) — сортування за
  датою/часом дедлайну, потім пріоритетом.
- Вкладки **Сьогодні** / **Найближчі** (7 днів) / **Всі**; прострочені
  завдання показуються окремою групою у Сьогодні й Всі.
- Пріоритет (низький/середній/високий), довільні теги (з фільтром по
  тегах і пошуком за назвою/нотаткою/тегами), нотатка.
- Підзадачі (чек-лист усередині завдання) — зберігаються як масив у
  документі завдання, без окремої підколекції.
- **Push-нагадування** (Firebase Cloud Messaging): вмикаються перемикачем
  у меню «Нагадування», працюють навіть коли сайт закритий. Момент
  нагадування (`reminderAt`) рахує клієнт при збереженні завдання (у
  локальному часовому поясі пристрою), а надсилає — запланована Cloud
  Function `taskReminders` (`tasks.js`), яка кожні 5 хв перевіряє всі
  завдання всіх користувачів (`collectionGroup('tasks')`) і шле push
  через `admin.messaging().sendEachForMulticast()`, після чого прибирає
  недійсні токени пристроїв.

## Мови

Інтерфейс перекладений на 4 мови: українська, російська, польська, англійська
(`LANGS` та словники перекладів окремо в `home.js`, `budget/app.js`, `tasks/app.js`).

## Резервне копіювання та імпорт даних

- Бюджет → Налаштування → «Експортувати в Excel (.xlsx)» — вивантажує всі
  дані користувача (транзакції, категорії, заощадження, цілі, нотатки) в
  один `.xlsx`-файл, повністю на клієнті, без додаткових запитів до Firestore.
- Бюджет → Налаштування → «Імпортувати транзакції з CSV» — масове додавання
  транзакцій з файлу `.csv` з колонками `дата, тип, категорія, сума, нотатка`
  (назви колонок і значення типу розпізнаються також англійською, російською
  і польською). Категорії, яких ще немає, створюються автоматично.

## Тести

Юніт-тести для Cloud Functions (Jest, мок Firestore/Anthropic SDK — без
живих викликів): `ai.test.js` (AI-асистент), `tasks.test.js` (розрахунок
моменту нагадування). Запуск:

```bash
npm install
npm test
```

Фронтенд (`home.js`, `budget/app.js`, `tasks/app.js`) автотестами поки не
покритий — це основний пункт TODO нижче.

## Відомі обмеження / TODO

- Немає автотестів для фронтенду (`home.js`, `budget/app.js`, `tasks/app.js`) —
  лише для Cloud Functions, див. розділ «Тести».
- Немає CI (GitHub Actions) — перевірки (тести, синтаксис) прогоняються
  лише локально.
- «Завдання» — один спільний список без вкладених списків/проєктів і без
  повторюваних (recurring) завдань; підзадачі є, ручного перетягування
  порядку (drag-and-drop) немає, сортування завжди автоматичне.
- Модулі «Цілі» та «Тренування» на домашній сторінці — ще заглушки («Скоро»).
