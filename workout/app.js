// ---- Service Worker ----
// Реєструємо тут, а не інлайн у <script> в index.html, щоб CSP міг
// забороняти інлайн-скрипти (script-src без 'unsafe-inline') без винятків.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
}

// ---- Firebase ----
firebase.initializeApp(firebaseConfig);

if (typeof RECAPTCHA_V3_SITE_KEY === 'string' && RECAPTCHA_V3_SITE_KEY && !RECAPTCHA_V3_SITE_KEY.startsWith('ВСТАВ_')) {
  try {
    firebase.appCheck().activate(RECAPTCHA_V3_SITE_KEY, /* isTokenAutoRefreshEnabled */ true);
  } catch (err) {
    console.warn('App Check: не вдалося активувати', err);
  }
}

const auth = firebase.auth();
const db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

// ---- Мови ----
// Ті самі мови й ключі localStorage, що й у budget/app.js, tasks/app.js та
// home.js — вибір мови/теми лишається синхронізованим по всьому сайту.
const LANGS = ['uk', 'ru', 'pl', 'en'];
const LANG_NAMES = { uk: 'UA', ru: 'RU', pl: 'PL', en: 'EN' };
const LOCALE_MAP = { uk: 'uk-UA', ru: 'ru-RU', pl: 'pl-PL', en: 'en-US' };

// ---- Невелика вбудована бібліотека вправ ----
// id — стабільний ключ (не перекладається, зберігається в документі),
// muscle — група м'язів для групування у пікері й на екрані рекордів.
const EXERCISE_LIB = [
  { id: 'benchPress', muscle: 'chest' },
  { id: 'inclineDbPress', muscle: 'chest' },
  { id: 'chestFly', muscle: 'chest' },
  { id: 'barbellRow', muscle: 'back' },
  { id: 'pullUp', muscle: 'back' },
  { id: 'deadlift', muscle: 'back' },
  { id: 'squat', muscle: 'legs' },
  { id: 'legPress', muscle: 'legs' },
  { id: 'lunge', muscle: 'legs' },
  { id: 'overheadPress', muscle: 'shoulders' },
  { id: 'lateralRaise', muscle: 'shoulders' },
  { id: 'bicepCurl', muscle: 'arms' },
  { id: 'tricepExtension', muscle: 'arms' },
  { id: 'dip', muscle: 'arms' },
  { id: 'plank', muscle: 'core' },
  { id: 'crunch', muscle: 'core' },
];
const MUSCLE_ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

const T = {
  uk: {
    pageTitle: 'Тренування',
    tabSessions: 'Тренування', tabRecords: 'Рекорди',
    newSessionLabel: 'Нове тренування',
    newSessionTitle: 'Нове тренування', editSessionTitle: 'Редагувати тренування',
    sessionNamePlaceholder: 'Назва (необовʼязково)',
    sessionDateLabel: 'Дата',
    dpTodayBtn: 'Сьогодні',
    exercisesLabel: 'Вправи', addExerciseLabel: 'Додати вправу',
    sessionNotesLabel: 'Нотатка', sessionNotesPlaceholder: 'Як пройшло тренування? (необовʼязково)',
    saveBtn: 'Зберегти', deleteBtn: 'Видалити',
    noExerciseError: 'Додай хоча б одну вправу з підходом',
    confirmDeleteSessionTitle: 'Видалити тренування?', confirmDeleteSessionSub: 'Цю дію не можна скасувати.',
    cancelBtn: 'Скасувати', deleteConfirmBtn: 'Видалити',
    pickerTitle: 'Обрати вправу', pickerSearchPlaceholder: 'Пошук вправи…',
    pickerCustomLabel: 'Своя вправа', pickerCustomPlaceholder: 'Назва вправи', pickerCustomAdd: 'Додати',
    setPlaceholderWeight: 'кг', setPlaceholderReps: 'повт.', addSetLabel: '+ Підхід',
    lastTimeLabel: (w, r) => `Минулого разу: ${w}×${r}`,
    prToastText: (name, w, r) => `Новий рекорд: ${name} — ${w}×${r}`,
    emptySessionsTitle: 'Ще немає тренувань', emptySessionsSub: 'Додай перше тренування кнопкою внизу.',
    emptyRecordsTitle: 'Ще немає рекордів', emptyRecordsSub: 'Записуй тренування — рекорди зʼявляться тут.',
    exMore: (n) => `ще ${n}`,
    historyBestLabel: 'Найкраще', historyEstLabel: '1ПМ (оцінка)', historySessionsLabel: 'Тренувань',
    prBadge: 'PR', trendUp: (p) => `+${p}% від першого разу`, trendFlat: 'Без змін',
    muscle_chest: "Груди", muscle_back: 'Спина', muscle_legs: 'Ноги', muscle_shoulders: 'Плечі', muscle_arms: 'Руки', muscle_core: 'Кор',
    ex_benchPress: 'Жим лежачи', ex_inclineDbPress: 'Жим гантелей на похилій', ex_chestFly: 'Розведення гантелей лежачи',
    ex_barbellRow: 'Тяга штанги в нахилі', ex_pullUp: 'Підтягування', ex_deadlift: 'Станова тяга',
    ex_squat: 'Присідання зі штангою', ex_legPress: 'Жим ногами', ex_lunge: 'Випади',
    ex_overheadPress: 'Жим стоячи', ex_lateralRaise: 'Розведення гантелей в сторони',
    ex_bicepCurl: 'Підйом на біцепс', ex_tricepExtension: 'Французький жим', ex_dip: 'Віджимання на брусах',
    ex_plank: 'Планка', ex_crunch: 'Скручування',
    themeLabel: 'Тема', themeLight: 'Світла', themeDark: 'Темна', themeSystem: 'Системна',
    langLabel: 'Мова', logout: 'Вийти',
    authTitleLogin: 'Вхід', authTitleSignup: 'Реєстрація',
    authSub: 'Увійди, щоб дані синхронізувались між твоїми пристроями.',
    emailLabel: 'Email', passwordLabel: 'Пароль', passwordHint: 'Мінімум 6 символів',
    rememberMe: 'Запам\u2019ятати мене', forgotPassword: 'Забув(ла) пароль?',
    noAccount: 'Ще немає акаунта?', haveAccount: 'Вже є акаунт?',
    signUpLink: 'Зареєструватися', signInLink: 'Увійти', waitLabel: 'Зачекай…',
    fillBoth: 'Заповни обидва поля.', enterEmailFirst: 'Спочатку введи email.',
    resetSent: (email) => `Лист для відновлення паролю надіслано на ${email}.`,
    err_invalidEmail: 'Некоректний email.', err_missingPassword: 'Введи пароль.',
    err_weakPassword: 'Пароль надто слабкий (мінімум 6 символів).',
    err_emailInUse: 'Цей email вже зареєстрований.', err_invalidCred: 'Невірний email або пароль.',
    err_userNotFound: 'Користувача з таким email не знайдено.',
    err_tooMany: 'Забагато спроб. Спробуй трохи пізніше.', err_generic: 'Щось пішло не так. Спробуй ще раз.',
    err_resetGeneric: 'Не вдалося надіслати лист. Спробуй пізніше.',
  },
  ru: {
    pageTitle: 'Тренировки',
    tabSessions: 'Тренировки', tabRecords: 'Рекорды',
    newSessionLabel: 'Новая тренировка',
    newSessionTitle: 'Новая тренировка', editSessionTitle: 'Редактировать тренировку',
    sessionNamePlaceholder: 'Название (необязательно)',
    sessionDateLabel: 'Дата',
    dpTodayBtn: 'Сегодня',
    exercisesLabel: 'Упражнения', addExerciseLabel: 'Добавить упражнение',
    sessionNotesLabel: 'Заметка', sessionNotesPlaceholder: 'Как прошла тренировка? (необязательно)',
    saveBtn: 'Сохранить', deleteBtn: 'Удалить',
    noExerciseError: 'Добавь хотя бы одно упражнение с подходом',
    confirmDeleteSessionTitle: 'Удалить тренировку?', confirmDeleteSessionSub: 'Это действие нельзя отменить.',
    cancelBtn: 'Отмена', deleteConfirmBtn: 'Удалить',
    pickerTitle: 'Выбрать упражнение', pickerSearchPlaceholder: 'Поиск упражнения…',
    pickerCustomLabel: 'Своё упражнение', pickerCustomPlaceholder: 'Название упражнения', pickerCustomAdd: 'Добавить',
    setPlaceholderWeight: 'кг', setPlaceholderReps: 'повт.', addSetLabel: '+ Подход',
    lastTimeLabel: (w, r) => `В прошлый раз: ${w}×${r}`,
    prToastText: (name, w, r) => `Новый рекорд: ${name} — ${w}×${r}`,
    emptySessionsTitle: 'Пока нет тренировок', emptySessionsSub: 'Добавь первую тренировку кнопкой внизу.',
    emptyRecordsTitle: 'Пока нет рекордов', emptyRecordsSub: 'Записывай тренировки — рекорды появятся здесь.',
    exMore: (n) => `ещё ${n}`,
    historyBestLabel: 'Лучшее', historyEstLabel: '1ПМ (оценка)', historySessionsLabel: 'Тренировок',
    prBadge: 'PR', trendUp: (p) => `+${p}% с первого раза`, trendFlat: 'Без изменений',
    muscle_chest: 'Грудь', muscle_back: 'Спина', muscle_legs: 'Ноги', muscle_shoulders: 'Плечи', muscle_arms: 'Руки', muscle_core: 'Кор',
    ex_benchPress: 'Жим лёжа', ex_inclineDbPress: 'Жим гантелей на наклонной', ex_chestFly: 'Разведение гантелей лёжа',
    ex_barbellRow: 'Тяга штанги в наклоне', ex_pullUp: 'Подтягивания', ex_deadlift: 'Становая тяга',
    ex_squat: 'Приседания со штангой', ex_legPress: 'Жим ногами', ex_lunge: 'Выпады',
    ex_overheadPress: 'Жим стоя', ex_lateralRaise: 'Разведение гантелей в стороны',
    ex_bicepCurl: 'Подъём на бицепс', ex_tricepExtension: 'Французский жим', ex_dip: 'Отжимания на брусьях',
    ex_plank: 'Планка', ex_crunch: 'Скручивания',
    themeLabel: 'Тема', themeLight: 'Светлая', themeDark: 'Тёмная', themeSystem: 'Системная',
    langLabel: 'Язык', logout: 'Выйти',
    authTitleLogin: 'Вход', authTitleSignup: 'Регистрация',
    authSub: 'Войди, чтобы данные синхронизировались между устройствами.',
    emailLabel: 'Email', passwordLabel: 'Пароль', passwordHint: 'Минимум 6 символов',
    rememberMe: 'Запомнить меня', forgotPassword: 'Забыл(а) пароль?',
    noAccount: 'Ещё нет аккаунта?', haveAccount: 'Уже есть аккаунт?',
    signUpLink: 'Зарегистрироваться', signInLink: 'Войти', waitLabel: 'Подожди…',
    fillBoth: 'Заполни оба поля.', enterEmailFirst: 'Сначала введи email.',
    resetSent: (email) => `Письмо для восстановления пароля отправлено на ${email}.`,
    err_invalidEmail: 'Некорректный email.', err_missingPassword: 'Введи пароль.',
    err_weakPassword: 'Пароль слишком короткий (минимум 6 символов).',
    err_emailInUse: 'Этот email уже зарегистрирован.', err_invalidCred: 'Неверный email или пароль.',
    err_userNotFound: 'Аккаунт с таким email не найден.',
    err_tooMany: 'Слишком много попыток. Попробуй позже.', err_generic: 'Что-то пошло не так. Попробуй ещё раз.',
    err_resetGeneric: 'Не удалось отправить письмо. Попробуй позже.',
  },
  pl: {
    pageTitle: 'Treningi',
    tabSessions: 'Treningi', tabRecords: 'Rekordy',
    newSessionLabel: 'Nowy trening',
    newSessionTitle: 'Nowy trening', editSessionTitle: 'Edytuj trening',
    sessionNamePlaceholder: 'Nazwa (opcjonalnie)',
    sessionDateLabel: 'Data',
    dpTodayBtn: 'Dziś',
    exercisesLabel: 'Ćwiczenia', addExerciseLabel: 'Dodaj ćwiczenie',
    sessionNotesLabel: 'Notatka', sessionNotesPlaceholder: 'Jak poszedł trening? (opcjonalnie)',
    saveBtn: 'Zapisz', deleteBtn: 'Usuń',
    noExerciseError: 'Dodaj przynajmniej jedno ćwiczenie z serią',
    confirmDeleteSessionTitle: 'Usunąć trening?', confirmDeleteSessionSub: 'Tej czynności nie można cofnąć.',
    cancelBtn: 'Anuluj', deleteConfirmBtn: 'Usuń',
    pickerTitle: 'Wybierz ćwiczenie', pickerSearchPlaceholder: 'Szukaj ćwiczenia…',
    pickerCustomLabel: 'Własne ćwiczenie', pickerCustomPlaceholder: 'Nazwa ćwiczenia', pickerCustomAdd: 'Dodaj',
    setPlaceholderWeight: 'kg', setPlaceholderReps: 'powt.', addSetLabel: '+ Seria',
    lastTimeLabel: (w, r) => `Poprzednio: ${w}×${r}`,
    prToastText: (name, w, r) => `Nowy rekord: ${name} — ${w}×${r}`,
    emptySessionsTitle: 'Brak treningów', emptySessionsSub: 'Dodaj pierwszy trening przyciskiem poniżej.',
    emptyRecordsTitle: 'Brak rekordów', emptyRecordsSub: 'Zapisuj treningi — rekordy pojawią się tutaj.',
    exMore: (n) => `jeszcze ${n}`,
    historyBestLabel: 'Najlepszy', historyEstLabel: '1RM (szac.)', historySessionsLabel: 'Treningów',
    prBadge: 'PR', trendUp: (p) => `+${p}% od pierwszego razu`, trendFlat: 'Bez zmian',
    muscle_chest: 'Klatka', muscle_back: 'Plecy', muscle_legs: 'Nogi', muscle_shoulders: 'Barki', muscle_arms: 'Ręce', muscle_core: 'Core',
    ex_benchPress: 'Wyciskanie leżąc', ex_inclineDbPress: 'Wyciskanie hantli skos dodatni', ex_chestFly: 'Rozpiętki z hantlami',
    ex_barbellRow: 'Wiosłowanie sztangą', ex_pullUp: 'Podciąganie', ex_deadlift: 'Martwy ciąg',
    ex_squat: 'Przysiad ze sztangą', ex_legPress: 'Wyciskanie nogami', ex_lunge: 'Wykroki',
    ex_overheadPress: 'Wyciskanie nad głowę', ex_lateralRaise: 'Unoszenie hantli bokiem',
    ex_bicepCurl: 'Uginanie na biceps', ex_tricepExtension: 'Francuskie wyciskanie', ex_dip: 'Pompki na poręczach',
    ex_plank: 'Deska', ex_crunch: 'Brzuszki',
    themeLabel: 'Motyw', themeLight: 'Jasny', themeDark: 'Ciemny', themeSystem: 'Systemowy',
    langLabel: 'Język', logout: 'Wyloguj',
    authTitleLogin: 'Logowanie', authTitleSignup: 'Rejestracja',
    authSub: 'Zaloguj się, aby dane synchronizowały się między urządzeniami.',
    emailLabel: 'Email', passwordLabel: 'Hasło', passwordHint: 'Minimum 6 znaków',
    rememberMe: 'Zapamiętaj mnie', forgotPassword: 'Zapomniałeś(aś) hasła?',
    noAccount: 'Nie masz jeszcze konta?', haveAccount: 'Masz już konto?',
    signUpLink: 'Zarejestruj się', signInLink: 'Zaloguj się', waitLabel: 'Czekaj…',
    fillBoth: 'Wypełnij oba pola.', enterEmailFirst: 'Najpierw wpisz email.',
    resetSent: (email) => `Wiadomość do resetu hasła wysłano na ${email}.`,
    err_invalidEmail: 'Nieprawidłowy email.', err_missingPassword: 'Wpisz hasło.',
    err_weakPassword: 'Hasło za krótkie (min. 6 znaków).',
    err_emailInUse: 'Ten email już zarejestrowano.', err_invalidCred: 'Nieprawidłowy email lub hasło.',
    err_userNotFound: 'Nie znaleziono konta z tym emailem.',
    err_tooMany: 'Zbyt wiele prób. Spróbuj później.', err_generic: 'Coś poszło nie tak. Spróbuj ponownie.',
    err_resetGeneric: 'Nie udało się wysłać wiadomości. Spróbuj później.',
  },
  en: {
    pageTitle: 'Workouts',
    tabSessions: 'Workouts', tabRecords: 'Records',
    newSessionLabel: 'New workout',
    newSessionTitle: 'New workout', editSessionTitle: 'Edit workout',
    sessionNamePlaceholder: 'Name (optional)',
    sessionDateLabel: 'Date',
    dpTodayBtn: 'Today',
    exercisesLabel: 'Exercises', addExerciseLabel: 'Add exercise',
    sessionNotesLabel: 'Notes', sessionNotesPlaceholder: 'How did the workout go? (optional)',
    saveBtn: 'Save', deleteBtn: 'Delete',
    noExerciseError: 'Add at least one exercise with a set',
    confirmDeleteSessionTitle: 'Delete workout?', confirmDeleteSessionSub: 'This action cannot be undone.',
    cancelBtn: 'Cancel', deleteConfirmBtn: 'Delete',
    pickerTitle: 'Choose exercise', pickerSearchPlaceholder: 'Search exercise…',
    pickerCustomLabel: 'Custom exercise', pickerCustomPlaceholder: 'Exercise name', pickerCustomAdd: 'Add',
    setPlaceholderWeight: 'kg', setPlaceholderReps: 'reps', addSetLabel: '+ Set',
    lastTimeLabel: (w, r) => `Last time: ${w}×${r}`,
    prToastText: (name, w, r) => `New PR: ${name} — ${w}×${r}`,
    emptySessionsTitle: 'No workouts yet', emptySessionsSub: 'Add your first workout with the button below.',
    emptyRecordsTitle: 'No records yet', emptyRecordsSub: 'Log workouts — your records will show up here.',
    exMore: (n) => `+${n} more`,
    historyBestLabel: 'Best', historyEstLabel: 'Est. 1RM', historySessionsLabel: 'Workouts',
    prBadge: 'PR', trendUp: (p) => `+${p}% since first log`, trendFlat: 'No change',
    muscle_chest: 'Chest', muscle_back: 'Back', muscle_legs: 'Legs', muscle_shoulders: 'Shoulders', muscle_arms: 'Arms', muscle_core: 'Core',
    ex_benchPress: 'Bench Press', ex_inclineDbPress: 'Incline DB Press', ex_chestFly: 'DB Chest Fly',
    ex_barbellRow: 'Barbell Row', ex_pullUp: 'Pull-up', ex_deadlift: 'Deadlift',
    ex_squat: 'Barbell Squat', ex_legPress: 'Leg Press', ex_lunge: 'Lunges',
    ex_overheadPress: 'Overhead Press', ex_lateralRaise: 'Lateral Raise',
    ex_bicepCurl: 'Bicep Curl', ex_tricepExtension: 'Tricep Extension', ex_dip: 'Dips',
    ex_plank: 'Plank', ex_crunch: 'Crunches',
    themeLabel: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System',
    langLabel: 'Language', logout: 'Log out',
    authTitleLogin: 'Log in', authTitleSignup: 'Sign up',
    authSub: 'Sign in so your data syncs across devices.',
    emailLabel: 'Email', passwordLabel: 'Password', passwordHint: 'Minimum 6 characters',
    rememberMe: 'Remember me', forgotPassword: 'Forgot password?',
    noAccount: "Don't have an account yet?", haveAccount: 'Already have an account?',
    signUpLink: 'Sign up', signInLink: 'Log in', waitLabel: 'Please wait…',
    fillBoth: 'Fill in both fields.', enterEmailFirst: 'Enter your email first.',
    resetSent: (email) => `Password reset email sent to ${email}.`,
    err_invalidEmail: 'Invalid email.', err_missingPassword: 'Enter a password.',
    err_weakPassword: 'Password too short (min. 6 characters).',
    err_emailInUse: 'This email is already registered.', err_invalidCred: 'Incorrect email or password.',
    err_userNotFound: 'No account found with this email.',
    err_tooMany: 'Too many attempts. Try again later.', err_generic: 'Something went wrong. Try again.',
    err_resetGeneric: 'Could not send the email. Try again later.',
  },
};

let currentLang = localStorage.getItem('financeAppLang') || 'uk';
if (!LANGS.includes(currentLang)) currentLang = 'uk';
function t(key, ...args) {
  const val = (T[currentLang] && T[currentLang][key]) || T.uk[key] || key;
  return typeof val === 'function' ? val(...args) : val;
}
function exerciseLabel(libId) { return t(`ex_${libId}`); }
function muscleLabel(muscle) { return t(`muscle_${muscle}`); }

// ---- Тема ----
const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
function resolveTheme() {
  const choice = localStorage.getItem('financeAppTheme') || 'system';
  if (choice === 'system') return darkMediaQuery.matches ? 'dark' : 'light';
  return choice;
}
function applyTheme() {
  const resolved = resolveTheme();
  document.documentElement.setAttribute('data-theme', resolved === 'dark' ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0B0B0E' : '#EDEEF3');
}
darkMediaQuery.addEventListener('change', () => {
  if ((localStorage.getItem('financeAppTheme') || 'system') === 'system') applyTheme();
});

function renderAuthLangRow() {
  const row = document.getElementById('authLangRow');
  if (!row) return;
  row.innerHTML = LANGS
    .map((l) => `<button type="button" class="lang-chip${l === currentLang ? ' selected' : ''}" data-lang="${l}">${LANG_NAMES[l]}</button>`)
    .join('');
  row.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
}
function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem('financeAppLang', lang);
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).set({ lang }, { merge: true }).catch(() => {});
  }
  applyTranslations();
  renderAuthLangRow();
  renderCurrentScreen();
}

// ---- Переклад статичних елементів ----
function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  document.title = `${t('pageTitle')} · Life`;
  document.getElementById('bnSessionsLabel').textContent = t('tabSessions');
  document.getElementById('bnRecordsLabel').textContent = t('tabRecords');
  document.getElementById('newSessionBtn').setAttribute('aria-label', t('newSessionLabel'));
  document.getElementById('sessionNameInput').placeholder = t('sessionNamePlaceholder');
  document.getElementById('sessionDateLabel').textContent = t('sessionDateLabel');
  document.getElementById('exercisesLabel').textContent = t('exercisesLabel');
  document.getElementById('addExerciseLabel').textContent = t('addExerciseLabel');
  document.getElementById('sessionNotesLabel').textContent = t('sessionNotesLabel');
  document.getElementById('sessionNotesInput').placeholder = t('sessionNotesPlaceholder');
  document.getElementById('deleteSessionBtn').textContent = t('deleteBtn');
  document.getElementById('sessionSubmitBtn').textContent = t('saveBtn');
  document.getElementById('confirmTitle').textContent = t('confirmDeleteSessionTitle');
  document.getElementById('confirmSub').textContent = t('confirmDeleteSessionSub');
  document.getElementById('confirmCancel').textContent = t('cancelBtn');
  document.getElementById('confirmDelete').textContent = t('deleteConfirmBtn');
  document.getElementById('pickerTitle').textContent = t('pickerTitle');
  document.getElementById('pickerSearch').placeholder = t('pickerSearchPlaceholder');
  document.getElementById('pickerCustomLabel').textContent = t('pickerCustomLabel');
  document.getElementById('pickerCustomInput').placeholder = t('pickerCustomPlaceholder');
  document.getElementById('pickerCustomAdd').textContent = t('pickerCustomAdd');
  document.getElementById('authSub').textContent = t('authSub');
  document.getElementById('authEmailLabel').textContent = t('emailLabel');
  document.getElementById('authPasswordLabel').textContent = t('passwordLabel');
  document.getElementById('authPasswordHint').textContent = t('passwordHint');
  document.getElementById('rememberMeLabel').textContent = t('rememberMe');
  document.getElementById('forgotPasswordLink').textContent = t('forgotPassword');
  setAuthMode(authMode);
  refreshDatePickersLang();
}

// ---- Вхід / реєстрація ----
let authMode = 'login';
function authErrorMessage(code) {
  const map = {
    'auth/invalid-email': 'err_invalidEmail', 'auth/missing-password': 'err_missingPassword',
    'auth/weak-password': 'err_weakPassword', 'auth/email-already-in-use': 'err_emailInUse',
    'auth/invalid-credential': 'err_invalidCred', 'auth/wrong-password': 'err_invalidCred',
    'auth/user-not-found': 'err_userNotFound', 'auth/too-many-requests': 'err_tooMany',
  };
  return t(map[code] || 'err_generic');
}
function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  document.getElementById('authTitle').textContent = isLogin ? t('authTitleLogin') : t('authTitleSignup');
  document.getElementById('authSubmit').textContent = isLogin ? t('signInLink') : t('signUpLink');
  document.getElementById('authSwitch').innerHTML =
    `${isLogin ? t('noAccount') : t('haveAccount')} <a id="authToggle">${isLogin ? t('signUpLink') : t('signInLink')}</a>`;
  document.getElementById('authPasswordHint').style.display = isLogin ? 'none' : 'block';
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authInfo').style.display = 'none';
  document.getElementById('authToggle').addEventListener('click', () => setAuthMode(isLogin ? 'signup' : 'login'));
}
document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  const infoEl = document.getElementById('authInfo');
  errorEl.style.display = 'none';
  infoEl.style.display = 'none';
  if (!email || !password) {
    errorEl.textContent = t('fillBoth');
    errorEl.style.display = 'block';
    return;
  }
  const submitBtn = document.getElementById('authSubmit');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = t('waitLabel');
  try {
    // Той самий контракт, що й у budget/app.js та home.js: без "запам'ятати мене"
    // сесія живе лише до закриття вкладки (SESSION), інакше — зберігається (LOCAL).
    const remember = document.getElementById('rememberMe').checked;
    await auth.setPersistence(remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);
    if (remember) {
      localStorage.setItem('financeAppLastEmail', email);
    } else {
      localStorage.removeItem('financeAppLastEmail');
    }
    if (authMode === 'login') {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      await auth.createUserWithEmailAndPassword(email, password);
    }
  } catch (err) {
    errorEl.textContent = authErrorMessage(err.code);
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});
document.getElementById('forgotPasswordLink').addEventListener('click', async () => {
  const email = document.getElementById('authEmail').value.trim();
  const errorEl = document.getElementById('authError');
  const infoEl = document.getElementById('authInfo');
  errorEl.style.display = 'none';
  infoEl.style.display = 'none';
  if (!email) {
    errorEl.textContent = t('enterEmailFirst');
    errorEl.style.display = 'block';
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    infoEl.textContent = t('resetSent', email);
    infoEl.style.display = 'block';
  } catch (err) {
    errorEl.textContent = err.code === 'auth/user-not-found' ? t('err_userNotFound') : t('err_resetGeneric');
    errorEl.style.display = 'block';
  }
});

// ---- Утиліти ----
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid4() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`).slice(0, 36);
}
// Парсить "YYYY-MM-DD" як ЛОКАЛЬНУ дату (без часу) — на відміну від
// `new Date("YYYY-MM-DD")`, який трактує рядок як UTC-північ і в поясах
// з від'ємним зсувом зсуває дату на день назад.
function parseISODate(s) {
  if (!s) return new Date(NaN);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
// Короткі назви днів тижня, понеділок першим — для кастомного datepicker.
function weekdayShortLabels() {
  const fmt = new Intl.DateTimeFormat(LOCALE_MAP[currentLang] || 'uk-UA', { weekday: 'short' });
  const monday = new Date(2024, 0, 1); // відомий понеділок
  const labels = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    labels.push(fmt.format(d));
  }
  return labels;
}
function fmtNum(n) {
  // Прибирає зайві .0, залишає до 2 знаків після коми (для дробової ваги).
  return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : '0';
}
function dayLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(LOCALE_MAP[currentLang] || 'uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });
}
function shortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(LOCALE_MAP[currentLang] || 'uk-UA', { day: 'numeric', month: 'short' });
}
// Оцінка одноповторного максимуму (формула Epley) — використовується лише
// для внутрішнього ранжування прогресу, не показується як точна цифра.
function epley1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}
// Ключ вправи для групування/пошуку історії: бібліотечні вправи group за
// стабільним id (незалежно від мови), власні — за нормалізованою назвою.
function exerciseKey(ex) {
  return ex.libId ? `lib:${ex.libId}` : `c:${(ex.name || '').trim().toLowerCase()}`;
}
function exerciseDisplayName(ex) {
  return ex.libId ? exerciseLabel(ex.libId) : (ex.name || '');
}

// ---- Кастомний datepicker ----
// Замінює нативний календар браузера (input type=date) на панель у стилі
// застосунку — так само, як у budget/ і tasks/. Нативний <input> лишається в
// DOM (прихований, але функціональний): увесь існуючий код
// (`sessionDateInput.value = ...`) працює без змін, бо сеттер `.value`
// перехоплено, щоб кастомний UI оновлювався синхронно. Місяці/дні тижня —
// через Intl, без ручних словників перекладу.
const datePickerInstances = [];
function initDatePicker(nativeId) {
  const native = document.getElementById(nativeId);
  if (!native || native.dataset.dpInit) return;
  native.dataset.dpInit = '1';

  const field = document.createElement('div');
  field.className = 'dp-field';
  native.insertAdjacentElement('afterend', field);
  field.appendChild(native);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'dp-trigger';
  trigger.innerHTML = '<span class="dp-trigger-text"></span>' +
    '<span class="dp-trigger-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></span>';
  field.appendChild(trigger);

  const panel = document.createElement('div');
  panel.className = 'dp-panel';
  panel.innerHTML =
    '<div class="dp-head">' +
      '<button type="button" class="dp-nav-btn dp-prev" aria-label="‹"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<div class="dp-head-label"></div>' +
      '<button type="button" class="dp-nav-btn dp-next" aria-label="›"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg></button>' +
    '</div>' +
    '<div class="dp-weekdays"></div>' +
    '<div class="dp-days"></div>' +
    '<div class="dp-foot"><button type="button" class="dp-today-btn"></button></div>';
  // Панель монтуємо в <body>, а не всередину .dp-field: .modal має
  // overflow-y:auto, що обрізало б випадаючий календар знизу.
  document.body.appendChild(panel);

  const triggerText = trigger.querySelector('.dp-trigger-text');
  const headLabel = panel.querySelector('.dp-head-label');
  const weekdaysEl = panel.querySelector('.dp-weekdays');
  const daysEl = panel.querySelector('.dp-days');
  const todayBtn = panel.querySelector('.dp-today-btn');
  const prevBtn = panel.querySelector('.dp-prev');
  const nextBtn = panel.querySelector('.dp-next');

  let viewYear, viewMonth;

  function isoOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function selectedDate() {
    const raw = nativeValueGetter.call(native);
    if (!raw) return null;
    const d = parseISODate(raw);
    return isNaN(d) ? null : d;
  }
  function maxDate() {
    const raw = native.getAttribute('max');
    if (!raw) return null;
    const d = parseISODate(raw);
    return isNaN(d) ? null : d;
  }
  function minDate() {
    const raw = native.getAttribute('min');
    if (!raw) return null;
    const d = parseISODate(raw);
    return isNaN(d) ? null : d;
  }

  function refreshTriggerText() {
    const sel = selectedDate();
    if (!sel) {
      triggerText.textContent = '—';
      triggerText.classList.add('dp-placeholder');
      return;
    }
    const locale = LOCALE_MAP[currentLang] || 'uk-UA';
    triggerText.textContent = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(sel);
    triggerText.classList.remove('dp-placeholder');
  }

  function renderPanel() {
    const locale = LOCALE_MAP[currentLang] || 'uk-UA';
    const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1));
    headLabel.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    weekdaysEl.innerHTML = weekdayShortLabels().map((w) => '<div class="dp-weekday">' + escapeHtml(w) + '</div>').join('');
    todayBtn.textContent = t('dpTodayBtn');

    const sel = selectedDate();
    const max = maxDate();
    const min = minDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // понеділок = 0
    const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);

    let html = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const inMonth = d.getMonth() === viewMonth;
      const isToday = d.getTime() === today.getTime();
      const isSelected = sel && d.getTime() === new Date(sel.getFullYear(), sel.getMonth(), sel.getDate()).getTime();
      const disabled = (max && d.getTime() > new Date(max.getFullYear(), max.getMonth(), max.getDate()).getTime()) ||
        (min && d.getTime() < new Date(min.getFullYear(), min.getMonth(), min.getDate()).getTime());
      const cls = ['dp-day'];
      if (!inMonth) cls.push('dp-day-muted');
      if (isToday) cls.push('dp-day-today');
      if (isSelected) cls.push('dp-day-selected');
      html += '<button type="button" class="' + cls.join(' ') + '" data-date="' + isoOf(d) + '"' + (disabled ? ' disabled' : '') + '>' + d.getDate() + '</button>';
    }
    daysEl.innerHTML = html;
    daysEl.querySelectorAll('.dp-day').forEach((btn) => {
      btn.addEventListener('click', () => {
        native.value = btn.dataset.date;
        close();
      });
    });
  }

  function positionPanel() {
    const rect = trigger.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 280;
    let left = rect.left;
    const maxLeft = window.innerWidth - panelWidth - 16;
    if (left > maxLeft) left = Math.max(16, maxLeft);
    let top = rect.bottom + 6;
    const panelHeight = panel.offsetHeight || 320;
    if (top + panelHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - panelHeight - 6);
    }
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }
  function isOpen() { return panel.classList.contains('show'); }
  function openPanel() {
    const sel = selectedDate() || new Date();
    viewYear = sel.getFullYear();
    viewMonth = sel.getMonth();
    renderPanel();
    field.classList.add('open');
    panel.classList.add('show');
    positionPanel();
    document.addEventListener('click', onOutsideClick, true);
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
  }
  function close() {
    field.classList.remove('open');
    panel.classList.remove('show');
    document.removeEventListener('click', onOutsideClick, true);
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('scroll', close, true);
    window.removeEventListener('resize', close);
  }
  function onOutsideClick(e) {
    if (!field.contains(e.target) && !panel.contains(e.target)) close();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  trigger.addEventListener('click', () => {
    if (isOpen()) close(); else openPanel();
  });
  prevBtn.addEventListener('click', () => {
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderPanel();
  });
  nextBtn.addEventListener('click', () => {
    viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderPanel();
  });
  todayBtn.addEventListener('click', () => {
    native.value = todayISO();
    close();
  });

  // Перехоплюємо .value, щоб `nativeInput.value = '...'` (як робить решта
  // коду застосунку) синхронно оновлювало кастомний UI.
  const proto = Object.getPrototypeOf(native);
  const valueDesc = Object.getOwnPropertyDescriptor(proto, 'value');
  const nativeValueGetter = valueDesc.get;
  const nativeValueSetter = valueDesc.set;
  Object.defineProperty(native, 'value', {
    configurable: true,
    get() { return nativeValueGetter.call(native); },
    set(v) { nativeValueSetter.call(native, v); refreshTriggerText(); },
  });

  refreshTriggerText();
  datePickerInstances.push({ refreshLang: () => { refreshTriggerText(); if (isOpen()) renderPanel(); } });
}
function refreshDatePickersLang() {
  datePickerInstances.forEach((dp) => dp.refreshLang());
}

// ---- Стан ----
let sessions = [];
let unsubscribeSessions = null;
let activeTab = 'sessions';
let editingSessionId = null;
let formExercises = []; // [{ id, libId, name, muscle, sets:[{weight, reps}] }]
let pendingDeleteId = null;
let pickerTargetBlockId = null; // якщо задано — заміна вправи в існуючому блоці, інакше — новий блок

// ---- Дані (Firestore, реалтайм) ----
function subscribeToSessions(uid) {
  if (unsubscribeSessions) unsubscribeSessions();
  const col = db.collection('users').doc(uid).collection('workouts');
  unsubscribeSessions = col.onSnapshot((snap) => {
    sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCurrentScreen();
  }, (err) => console.error('subscribeToSessions:', err));
}

function sortedSessions() {
  return [...sessions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const ca = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const cb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return cb - ca;
  });
}

// Найкращий підхід вправи (найважча вага, при рівності — більше повторень).
function bestSet(sets) {
  if (!sets || !sets.length) return null;
  return [...sets].sort((a, b) => (b.weight - a.weight) || (b.reps - a.reps))[0];
}

// ---- Обчислення записів (PR) по всій історії ----
function computeRecords(excludeSessionId) {
  const map = new Map(); // key -> { key, name, muscle, best:{weight,reps,date}, first:{weight,reps,date}, sessionsCount }
  const list = sortedSessions().filter((s) => s.id !== excludeSessionId);
  // Ідемо від найстарішого до найновішого, щоб коректно зафіксувати "перший запис".
  const chrono = [...list].reverse();
  chrono.forEach((session) => {
    (session.exercises || []).forEach((ex) => {
      const key = exerciseKey(ex);
      const best = bestSet(ex.sets);
      if (!best || (!best.weight && !best.reps)) return;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          key, libId: ex.libId || null, name: exerciseDisplayName(ex), muscle: ex.muscle || null,
          best: { ...best, date: session.date }, first: { ...best, date: session.date }, sessionsCount: 0,
        };
        map.set(key, entry);
      }
      entry.sessionsCount += 1;
      entry.name = exerciseDisplayName(ex); // завжди свіже локалізоване імʼя
      const bestScore = epley1RM(entry.best.weight, entry.best.reps);
      const curScore = epley1RM(best.weight, best.reps);
      if (curScore > bestScore || (curScore === bestScore && best.weight > entry.best.weight)) {
        entry.best = { ...best, date: session.date };
      }
    });
  });
  return map;
}

function historyForExercise(key) {
  const rows = [];
  sortedSessions().forEach((session) => {
    (session.exercises || []).forEach((ex) => {
      if (exerciseKey(ex) !== key) return;
      const best = bestSet(ex.sets);
      if (!best) return;
      rows.push({ date: session.date, best, name: exerciseDisplayName(ex) });
    });
  });
  return rows; // вже відсортовано за датою спадно (sortedSessions)
}

// ---- Рендер ----
function renderCurrentScreen() {
  if (activeTab === 'sessions') renderSessionsTab(); else renderRecordsTab();
}

function renderSessionsTab() {
  const root = document.getElementById('sessionsTab');
  const list = sortedSessions();
  if (!list.length) {
    root.innerHTML = `
      <div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="currentColor"><rect x="8.2" y="10.4" width="7.6" height="3.2" rx="1.6"/><rect x="0.8" y="5.8" width="3.4" height="12.4" rx="1.7"/><rect x="4.8" y="4.2" width="3.8" height="15.6" rx="1.9"/><rect x="15.4" y="4.2" width="3.8" height="15.6" rx="1.9"/><rect x="19.8" y="5.8" width="3.4" height="12.4" rx="1.7"/></svg>
        <div class="title">${escapeHtml(t('emptySessionsTitle'))}</div>
        <div>${escapeHtml(t('emptySessionsSub'))}</div>
      </div>`;
    return;
  }
  // Групування за датою (список уже відсортований desc).
  const groups = [];
  list.forEach((s) => {
    const last = groups[groups.length - 1];
    if (last && last.date === s.date) last.items.push(s); else groups.push({ date: s.date, items: [s] });
  });
  root.innerHTML = groups.map((g) => `
    <div class="day-group">
      <div class="day-label">${escapeHtml(dayLabel(g.date))}</div>
      ${g.items.map((s) => renderSessionCard(s)).join('')}
    </div>
  `).join('');
  root.querySelectorAll('[data-open-session]').forEach((el) => {
    el.addEventListener('click', () => openSessionForm(sessions.find((s) => s.id === el.dataset.openSession)));
  });
}

function renderSessionCard(session) {
  const exs = session.exercises || [];
  const shown = exs.slice(0, 4);
  const rows = shown.map((ex) => {
    const b = bestSet(ex.sets);
    const bestStr = b ? `${fmtNum(b.weight)}×${b.reps}` : '—';
    return `<div class="session-ex-row"><span class="session-ex-name">${escapeHtml(exerciseDisplayName(ex))}</span><span class="session-ex-best">${escapeHtml(bestStr)}</span></div>`;
  }).join('');
  const more = exs.length > shown.length ? `<div class="session-more">${escapeHtml(t('exMore', exs.length - shown.length))}</div>` : '';
  const setCount = exs.reduce((sum, ex) => sum + (ex.sets ? ex.sets.length : 0), 0);
  return `
    <div class="session-card" data-open-session="${session.id}">
      <div class="session-head">
        <div class="session-name">${escapeHtml(session.name || t('newSessionLabel'))}</div>
        <div class="session-meta">${exs.length}\u00A0${escapeHtml(t('exercisesLabel')).toLowerCase()} · ${setCount}\u00A0${escapeHtml(t('setPlaceholderReps'))}</div>
      </div>
      <div class="session-ex-list">${rows}</div>
      ${more}
    </div>`;
}

function renderRecordsTab() {
  const root = document.getElementById('recordsTab');
  const map = computeRecords(null);
  if (!map.size) {
    root.innerHTML = `
      <div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>
        <div class="title">${escapeHtml(t('emptyRecordsTitle'))}</div>
        <div>${escapeHtml(t('emptyRecordsSub'))}</div>
      </div>`;
    return;
  }
  const byMuscle = new Map();
  map.forEach((entry) => {
    const m = entry.muscle || 'other';
    if (!byMuscle.has(m)) byMuscle.set(m, []);
    byMuscle.get(m).push(entry);
  });
  const order = [...MUSCLE_ORDER, ...[...byMuscle.keys()].filter((m) => !MUSCLE_ORDER.includes(m))];
  root.innerHTML = order.filter((m) => byMuscle.has(m)).map((m) => {
    const entries = byMuscle.get(m).sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div class="muscle-group">
        <div class="muscle-label">${m === 'other' ? '' : escapeHtml(muscleLabel(m))}</div>
        <div class="pr-card">
          ${entries.map((e) => renderPrRow(e)).join('')}
        </div>
      </div>`;
  }).join('');
  root.querySelectorAll('[data-open-history]').forEach((el) => {
    el.addEventListener('click', () => openHistory(el.dataset.openHistory));
  });
}

function renderPrRow(entry) {
  const firstScore = epley1RM(entry.first.weight, entry.first.reps);
  const bestScore = epley1RM(entry.best.weight, entry.best.reps);
  let trendHtml;
  if (firstScore > 0 && bestScore > firstScore) {
    const pct = Math.round(((bestScore - firstScore) / firstScore) * 100);
    trendHtml = `<div class="pr-trend up">↑ ${escapeHtml(t('trendUp', pct))}</div>`;
  } else {
    trendHtml = `<div class="pr-trend flat">${escapeHtml(t('trendFlat'))}</div>`;
  }
  return `
    <div class="pr-row" data-open-history="${escapeHtml(entry.key)}">
      <div class="pr-icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>
      </div>
      <div class="pr-body">
        <div class="pr-name">${escapeHtml(entry.name)}</div>
        <div class="pr-sub">${escapeHtml(shortDate(entry.best.date))} · ${entry.sessionsCount}\u00A0${escapeHtml(t('historySessionsLabel')).toLowerCase()}</div>
      </div>
      <div class="pr-value">
        <div class="pr-weight">${escapeHtml(fmtNum(entry.best.weight))}×${entry.best.reps}</div>
        ${trendHtml}
      </div>
    </div>`;
}

// ---- Історія вправи ----
function openHistory(key) {
  const rows = historyForExercise(key);
  if (!rows.length) return;
  const name = rows[0].name;
  const best = rows.reduce((acc, r) => (epley1RM(r.best.weight, r.best.reps) > epley1RM(acc.weight, acc.reps) ? r.best : acc), rows[0].best);
  const est1rm = Math.round(epley1RM(best.weight, best.reps));
  document.getElementById('historyTitle').textContent = name;
  document.getElementById('historySummary').innerHTML = `
    <div class="hist-stat"><div class="hist-stat-value">${escapeHtml(fmtNum(best.weight))}×${best.reps}</div><div class="hist-stat-label">${escapeHtml(t('historyBestLabel'))}</div></div>
    <div class="hist-stat"><div class="hist-stat-value">${est1rm || '—'}</div><div class="hist-stat-label">${escapeHtml(t('historyEstLabel'))}</div></div>
    <div class="hist-stat"><div class="hist-stat-value">${rows.length}</div><div class="hist-stat-label">${escapeHtml(t('historySessionsLabel'))}</div></div>
  `;
  document.getElementById('historyList').innerHTML = rows.map((r) => {
    const isBest = r.best.weight === best.weight && r.best.reps === best.reps;
    return `
      <div class="hist-row">
        <div class="hist-date">${escapeHtml(shortDate(r.date))}</div>
        <div class="hist-sets">${escapeHtml(fmtNum(r.best.weight))}×${r.best.reps}</div>
        ${isBest ? `<div class="hist-badge">🏆 ${escapeHtml(t('prBadge'))}</div>` : ''}
      </div>`;
  }).join('');
  document.getElementById('historyOverlay').classList.add('show');
}
document.getElementById('closeHistory').addEventListener('click', () => {
  document.getElementById('historyOverlay').classList.remove('show');
});
document.getElementById('historyOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'historyOverlay') e.currentTarget.classList.remove('show');
});

// ---- Вкладки ----
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('#bottomNav [data-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('sessionsTab').style.display = tab === 'sessions' ? 'block' : 'none';
  document.getElementById('recordsTab').style.display = tab === 'records' ? 'block' : 'none';
  // «Рекорди» лише показують історію — додавати там нема чого.
  document.getElementById('newSessionBtn').style.visibility = tab === 'sessions' ? '' : 'hidden';
  renderCurrentScreen();
}
document.querySelectorAll('#bottomNav [data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ---- Форма тренування ----
function findLastPerformance(ex) {
  // Шукає останній (за датою) підхід цієї ж вправи серед ІНШИХ тренувань,
  // ніж те, що зараз редагується — основа для підказки прогресивного навантаження.
  const key = exerciseKey(ex);
  for (const session of sortedSessions()) {
    if (session.id === editingSessionId) continue;
    const match = (session.exercises || []).find((e) => exerciseKey(e) === key);
    if (match) {
      const b = bestSet(match.sets);
      if (b) return b;
    }
  }
  return null;
}

function openSessionForm(existingSession) {
  editingSessionId = existingSession ? existingSession.id : null;
  document.getElementById('sessionModalTitle').textContent = existingSession ? t('editSessionTitle') : t('newSessionTitle');
  document.getElementById('deleteSessionBtn').style.display = existingSession ? 'block' : 'none';
  document.getElementById('sessionFormError').textContent = '';
  document.getElementById('sessionNameInput').value = existingSession ? (existingSession.name || '') : '';
  document.getElementById('sessionDateInput').value = existingSession ? existingSession.date : todayISO();
  document.getElementById('sessionNotesInput').value = existingSession ? (existingSession.notes || '') : '';
  formExercises = existingSession
    ? (existingSession.exercises || []).map((ex) => ({
        id: uid4(), libId: ex.libId || null, name: ex.name || '', muscle: ex.muscle || null,
        sets: (ex.sets || []).map((s) => ({ weight: s.weight, reps: s.reps })),
      }))
    : [];
  renderExerciseBlocks();
  document.getElementById('sessionFormOverlay').classList.add('show');
}
document.getElementById('newSessionBtn').addEventListener('click', () => openSessionForm(null));
document.getElementById('closeSessionForm').addEventListener('click', () => {
  document.getElementById('sessionFormOverlay').classList.remove('show');
});
document.getElementById('sessionFormOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'sessionFormOverlay') e.currentTarget.classList.remove('show');
});

function renderExerciseBlocks() {
  const root = document.getElementById('exerciseBlocks');
  root.innerHTML = formExercises.map((ex) => renderExerciseBlock(ex)).join('');
  // Хінти "минулого разу" — обчислюються один раз при рендері.
  formExercises.forEach((ex) => {
    const hintEl = root.querySelector(`[data-hint-for="${ex.id}"]`);
    if (!hintEl) return;
    const last = findLastPerformance(ex);
    hintEl.textContent = last ? t('lastTimeLabel', fmtNum(last.weight), last.reps) : '';
    hintEl.style.display = last ? 'block' : 'none';
  });
  attachExerciseBlockEvents();
}

function renderExerciseBlock(ex) {
  const setsHtml = ex.sets.map((s, i) => `
    <div class="set-row" data-set-idx="${i}">
      <div class="set-num">${i + 1}</div>
      <input type="number" inputmode="decimal" step="0.5" min="0" max="2000" class="set-weight" placeholder="${escapeHtml(t('setPlaceholderWeight'))}" value="${s.weight || s.weight === 0 ? s.weight : ''}">
      <input type="number" inputmode="numeric" step="1" min="0" max="999" class="set-reps" placeholder="${escapeHtml(t('setPlaceholderReps'))}" value="${s.reps || s.reps === 0 ? s.reps : ''}">
      <button type="button" class="set-remove" data-remove-set="${i}" aria-label="Remove set">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
  return `
    <div class="ex-block" data-block-id="${ex.id}">
      <div class="ex-block-head">
        <div class="ex-block-name">${escapeHtml(exerciseDisplayName(ex))}</div>
        <button type="button" class="ex-remove-btn" data-remove-block="${ex.id}" aria-label="Remove exercise">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="ex-block-muscle">${ex.muscle ? escapeHtml(muscleLabel(ex.muscle)) : ''}</div>
      <div class="set-hint" data-hint-for="${ex.id}"></div>
      ${setsHtml}
      <button type="button" class="add-set-btn" data-add-set="${ex.id}">${escapeHtml(t('addSetLabel'))}</button>
    </div>`;
}

function attachExerciseBlockEvents() {
  const root = document.getElementById('exerciseBlocks');
  root.querySelectorAll('[data-remove-block]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formExercises = formExercises.filter((ex) => ex.id !== btn.dataset.removeBlock);
      renderExerciseBlocks();
    });
  });
  root.querySelectorAll('[data-add-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ex = formExercises.find((e) => e.id === btn.dataset.addSet);
      if (!ex) return;
      const prev = ex.sets[ex.sets.length - 1];
      ex.sets.push({ weight: prev ? prev.weight : '', reps: prev ? prev.reps : '' });
      renderExerciseBlocks();
    });
  });
  root.querySelectorAll('.ex-block').forEach((blockEl) => {
    const exId = blockEl.dataset.blockId;
    const ex = formExercises.find((e) => e.id === exId);
    if (!ex) return;
    blockEl.querySelectorAll('[data-remove-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ex.sets.splice(Number(btn.dataset.removeSet), 1);
        renderExerciseBlocks();
      });
    });
    blockEl.querySelectorAll('.set-weight').forEach((input, i) => {
      input.addEventListener('input', () => { ex.sets[i].weight = input.value === '' ? '' : Number(input.value); });
    });
    blockEl.querySelectorAll('.set-reps').forEach((input, i) => {
      input.addEventListener('input', () => { ex.sets[i].reps = input.value === '' ? '' : Number(input.value); });
    });
  });
  if (!formExercises.length) {
    // Порожній стан всередині форми не потребує окремого блоку — кнопка
    // "Додати вправу" вже достатньо помітна.
  }
}

document.getElementById('addExerciseBtn').addEventListener('click', () => {
  pickerTargetBlockId = null;
  openExercisePicker();
});

// ---- Пікер вправ ----
function openExercisePicker() {
  document.getElementById('pickerCustomInput').value = '';
  document.getElementById('pickerSearch').value = '';
  renderPickerGroups('');
  document.getElementById('exercisePickerOverlay').classList.add('show');
  setTimeout(() => document.getElementById('pickerSearch').focus(), 50);
}
function renderPickerGroups(query) {
  const q = query.trim().toLowerCase();
  const root = document.getElementById('pickerGroups');
  const byMuscle = new Map();
  EXERCISE_LIB.forEach((item) => {
    const label = exerciseLabel(item.id);
    if (q && !label.toLowerCase().includes(q)) return;
    if (!byMuscle.has(item.muscle)) byMuscle.set(item.muscle, []);
    byMuscle.get(item.muscle).push({ id: item.id, label });
  });
  root.innerHTML = MUSCLE_ORDER.filter((m) => byMuscle.has(m)).map((m) => `
    <div class="picker-group">
      <div class="picker-group-label">${escapeHtml(muscleLabel(m))}</div>
      ${byMuscle.get(m).map((item) => `<div class="picker-item" data-pick-lib="${item.id}" data-muscle="${m}">${escapeHtml(item.label)}</div>`).join('')}
    </div>
  `).join('');
  root.querySelectorAll('[data-pick-lib]').forEach((el) => {
    el.addEventListener('click', () => selectExercise({ libId: el.dataset.pickLib, muscle: el.dataset.muscle, name: exerciseLabel(el.dataset.pickLib) }));
  });
}
document.getElementById('pickerSearch').addEventListener('input', (e) => renderPickerGroups(e.target.value));
document.getElementById('pickerCustomAdd').addEventListener('click', () => {
  const name = document.getElementById('pickerCustomInput').value.trim();
  if (!name) return;
  selectExercise({ libId: null, muscle: null, name });
});
document.getElementById('closePicker').addEventListener('click', () => {
  document.getElementById('exercisePickerOverlay').classList.remove('show');
});
document.getElementById('exercisePickerOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'exercisePickerOverlay') e.currentTarget.classList.remove('show');
});

function selectExercise({ libId, muscle, name }) {
  if (pickerTargetBlockId) {
    const ex = formExercises.find((e) => e.id === pickerTargetBlockId);
    if (ex) { ex.libId = libId; ex.muscle = muscle; ex.name = name; }
  } else {
    formExercises.push({ id: uid4(), libId, muscle, name, sets: [{ weight: '', reps: '' }] });
  }
  pickerTargetBlockId = null;
  document.getElementById('exercisePickerOverlay').classList.remove('show');
  renderExerciseBlocks();
}

// ---- Збереження / видалення тренування ----
document.getElementById('sessionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('sessionFormError');
  const uidCur = auth.currentUser && auth.currentUser.uid;
  if (!uidCur) return;

  const cleanExercises = formExercises
    .map((ex) => ({
      id: ex.id, libId: ex.libId || null, muscle: ex.muscle || null,
      name: ex.libId ? exerciseLabel(ex.libId) : (ex.name || '').trim(),
      sets: (ex.sets || [])
        .filter((s) => s.weight !== '' || s.reps !== '')
        .map((s) => ({ weight: Number(s.weight) || 0, reps: Math.round(Number(s.reps) || 0) })),
    }))
    .filter((ex) => ex.name && ex.sets.length);

  if (!cleanExercises.length) {
    errorEl.textContent = t('noExerciseError');
    return;
  }
  errorEl.textContent = '';

  // Визначаємо, чи є новий рекорд, ПОРІВНЯНО зі станом до цього збереження.
  const priorRecords = computeRecords(editingSessionId);
  let bestPr = null; // { name, weight, reps, score }
  cleanExercises.forEach((ex) => {
    const key = exerciseKey(ex);
    const b = bestSet(ex.sets);
    if (!b || (!b.weight && !b.reps)) return;
    const prior = priorRecords.get(key);
    const priorScore = prior ? epley1RM(prior.best.weight, prior.best.reps) : 0;
    const curScore = epley1RM(b.weight, b.reps);
    if (curScore > priorScore && (curScore > 0)) {
      if (!bestPr || curScore > bestPr.score) {
        bestPr = { name: exerciseDisplayName(ex), weight: b.weight, reps: b.reps, score: curScore };
      }
    }
  });

  const payload = {
    date: document.getElementById('sessionDateInput').value || todayISO(),
    name: document.getElementById('sessionNameInput').value.trim(),
    notes: document.getElementById('sessionNotesInput').value.trim(),
    exercises: cleanExercises,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const submitBtn = document.getElementById('sessionSubmitBtn');
  submitBtn.disabled = true;
  try {
    const col = db.collection('users').doc(uidCur).collection('workouts');
    if (editingSessionId) {
      await col.doc(editingSessionId).update(payload);
    } else {
      await col.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    document.getElementById('sessionFormOverlay').classList.remove('show');
    if (bestPr) showPrToast(bestPr.name, bestPr.weight, bestPr.reps);
  } catch (err) {
    console.error('save session:', err);
    errorEl.textContent = t('err_generic');
  } finally {
    submitBtn.disabled = false;
  }
});

let prToastTimer = null;
function showPrToast(name, weight, reps) {
  const toast = document.getElementById('prToast');
  document.getElementById('prToastText').textContent = t('prToastText', name, fmtNum(weight), reps);
  toast.classList.add('show');
  if (prToastTimer) clearTimeout(prToastTimer);
  prToastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
}

document.getElementById('deleteSessionBtn').addEventListener('click', () => {
  if (!editingSessionId) return;
  pendingDeleteId = editingSessionId;
  document.getElementById('sessionFormOverlay').classList.remove('show');
  document.getElementById('confirmOverlay').classList.add('show');
});
document.getElementById('confirmCancel').addEventListener('click', () => {
  document.getElementById('confirmOverlay').classList.remove('show');
  pendingDeleteId = null;
});
document.getElementById('confirmOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'confirmOverlay') { e.currentTarget.classList.remove('show'); pendingDeleteId = null; }
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (!pendingDeleteId || !auth.currentUser) return;
  try {
    await db.collection('users').doc(auth.currentUser.uid).collection('workouts').doc(pendingDeleteId).delete();
  } catch (err) {
    console.error('delete session:', err);
  }
  pendingDeleteId = null;
  document.getElementById('confirmOverlay').classList.remove('show');
});

// ---- Автентифікація: стан ----
auth.onAuthStateChanged((user) => {
  document.getElementById('authLoading').style.display = 'none';
  if (user) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    db.collection('users').doc(user.uid).get().then((doc) => {
      const data = doc.data();
      if (data && data.lang && LANGS.includes(data.lang) && data.lang !== currentLang) {
        currentLang = data.lang;
        localStorage.setItem('financeAppLang', currentLang);
        applyTranslations();
        renderAuthLangRow();
        renderCurrentScreen();
      }
    }).catch(() => {});
    subscribeToSessions(user.uid);
  } else {
    if (unsubscribeSessions) { unsubscribeSessions(); unsubscribeSessions = null; }
    sessions = [];
    document.getElementById('appScreen').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('authPassword').value = '';
    document.getElementById('authInfo').style.display = 'none';
    const savedEmail = localStorage.getItem('financeAppLastEmail');
    if (savedEmail) {
      document.getElementById('authEmail').value = savedEmail;
      document.getElementById('rememberMe').checked = true;
    } else {
      document.getElementById('authEmail').value = '';
      document.getElementById('rememberMe').checked = true;
    }
  }
});
setTimeout(() => {
  const loadingEl = document.getElementById('authLoading');
  if (loadingEl && loadingEl.style.display !== 'none') {
    loadingEl.style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
  }
}, 6000);

// ---- Ініціалізація ----
initDatePicker('sessionDateInput');
applyTheme();
applyTranslations();
renderAuthLangRow();
setAuthMode('login');
switchTab('sessions');
