// ---- Service Worker ----
// Реєструємо тут, а не інлайн у <script> в index.html, щоб CSP міг
// забороняти інлайн-скрипти (script-src без 'unsafe-inline') без винятків.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
}

// ---- Firebase ----
firebase.initializeApp(firebaseConfig);

// Той самий App Check, що й у budget/app.js — якщо ключ ще заглушка, просто
// пропускаємо, застосунок далі працює без нього.
if (typeof RECAPTCHA_V3_SITE_KEY === 'string' && RECAPTCHA_V3_SITE_KEY && !RECAPTCHA_V3_SITE_KEY.startsWith('ВСТАВ_')) {
  try {
    firebase.appCheck().activate(RECAPTCHA_V3_SITE_KEY, /* isTokenAutoRefreshEnabled */ true);
  } catch (err) {
    console.warn('App Check: не вдалося активувати', err);
  }
}

const auth = firebase.auth();
const db = firebase.firestore();

// ---- Переклади ----
// Ті самі мови й ключі localStorage/Firestore, що й у budget/app.js, тому
// вибір мови (і теми) синхронізований між головною сторінкою та бюджетом.
const LANGS = ['uk', 'ru', 'pl', 'en'];
const LANG_NAMES = { uk: 'UA', ru: 'RU', pl: 'PL', en: 'EN' };
const LOCALE_MAP = { uk: 'uk-UA', ru: 'ru-RU', pl: 'pl-PL', en: 'en-US' };

const STRINGS = {
  uk: {
    themeLabel: 'Тема', themeLight: 'Світла', themeDark: 'Темна', themeSystem: 'Системна',
    langLabel: 'Мова', logout: 'Вийти', exportLabel: 'Експорт даних',
    exportBusy: 'Готую файл…', exportError: 'Не вдалося зібрати файл. Спробуй ще раз.',
    exportModalTitle: 'Експорт даних', exportWhat: 'Що зберегти', exportFormat: 'Формат',
    exportSave: 'Зберегти', exportNothing: 'Обери хоча б один розділ.',
    sec_budget: 'Бюджет', sec_goals: 'Цілі', sec_tasks: 'Завдання', sec_workout: 'Тренування',
    fmt_xlsx: 'Excel (.xlsx)', fmt_csv: 'CSV', fmt_json: 'JSON',
    hint_xlsx: 'Один файл, кожен розділ окремою вкладкою. Щоб подивитись і порахувати.',
    hint_csv: (n) => (n > 1
      ? `Збережеться ${n} ${plural(n, { one: 'файл', few: 'файли', many: 'файлів' })} — CSV не має вкладок, тож на кожну таблицю свій файл.`
      : 'Проста таблиця — щоб закинути кудись іще.'),
    hint_json: 'Повна резервна копія: усе як є, без втрат. Для читання очима не призначено.',
    budgetTitle: 'Бюджет', budgetSub: 'витрати й доходи',
    goalsTitle: 'Цілі', goalsSub: 'довгострокові',
    tasksTitle: 'Завдання', tasksSub: 'на кожен день',
    workoutTitle: 'Тренування', workoutSub: 'сесії й рекорди',
 openBtn: 'Відкрити',
    authTitleLogin: 'Вхід', authTitleSignup: 'Реєстрація',
    authSub: 'Увійди, щоб потрапити у свій особистий простір.',
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
    themeLabel: 'Тема', themeLight: 'Светлая', themeDark: 'Тёмная', themeSystem: 'Системная',
    langLabel: 'Язык', logout: 'Выйти', exportLabel: 'Экспорт данных',
    exportBusy: 'Готовлю файл…', exportError: 'Не удалось собрать файл. Попробуй ещё раз.',
    exportModalTitle: 'Экспорт данных', exportWhat: 'Что сохранить', exportFormat: 'Формат',
    exportSave: 'Сохранить', exportNothing: 'Выбери хотя бы один раздел.',
    sec_budget: 'Бюджет', sec_goals: 'Цели', sec_tasks: 'Задачи', sec_workout: 'Тренировки',
    fmt_xlsx: 'Excel (.xlsx)', fmt_csv: 'CSV', fmt_json: 'JSON',
    hint_xlsx: 'Один файл, каждый раздел отдельной вкладкой. Чтобы посмотреть и посчитать.',
    hint_csv: (n) => (n > 1
      ? `Сохранится ${n} ${plural(n, { one: 'файл', few: 'файла', many: 'файлов' })} — у CSV нет вкладок, поэтому на каждую таблицу свой файл.`
      : 'Простая таблица — чтобы закинуть куда-то ещё.'),
    hint_json: 'Полная резервная копия: всё как есть, без потерь. Для чтения глазами не предназначено.',
    budgetTitle: 'Бюджет', budgetSub: 'расходы и доходы',
    goalsTitle: 'Цели', goalsSub: 'долгосрочные',
    tasksTitle: 'Задачи', tasksSub: 'на каждый день',
    workoutTitle: 'Тренировки', workoutSub: 'сессии и рекорды',
 openBtn: 'Открыть',
    authTitleLogin: 'Вход', authTitleSignup: 'Регистрация',
    authSub: 'Войди, чтобы попасть в своё личное пространство.',
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
    themeLabel: 'Motyw', themeLight: 'Jasny', themeDark: 'Ciemny', themeSystem: 'Systemowy',
    langLabel: 'Język', logout: 'Wyloguj', exportLabel: 'Eksport danych',
    exportBusy: 'Przygotowuję plik…', exportError: 'Nie udało się zebrać pliku. Spróbuj ponownie.',
    exportModalTitle: 'Eksport danych', exportWhat: 'Co zapisać', exportFormat: 'Format',
    exportSave: 'Zapisz', exportNothing: 'Wybierz przynajmniej jedną sekcję.',
    sec_budget: 'Budżet', sec_goals: 'Cele', sec_tasks: 'Zadania', sec_workout: 'Treningi',
    fmt_xlsx: 'Excel (.xlsx)', fmt_csv: 'CSV', fmt_json: 'JSON',
    hint_xlsx: 'Jeden plik, każda sekcja w osobnej zakładce. Do przejrzenia i policzenia.',
    hint_csv: (n) => (n > 1
      ? `Zapisze się ${n} ${plural(n, { one: 'plik', few: 'pliki', many: 'plików' })} — CSV nie ma zakładek, więc każda tabela osobno.`
      : 'Prosta tabela — żeby wrzucić gdzie indziej.'),
    hint_json: 'Pełna kopia zapasowa: wszystko bez strat. Nie do czytania oczami.',
    budgetTitle: 'Budżet', budgetSub: 'wydatki i dochody',
    goalsTitle: 'Cele', goalsSub: 'długoterminowe',
    tasksTitle: 'Zadania', tasksSub: 'na każdy dzień',
    workoutTitle: 'Treningi', workoutSub: 'sesje i rekordy',
 openBtn: 'Otwórz',
    authTitleLogin: 'Logowanie', authTitleSignup: 'Rejestracja',
    authSub: 'Zaloguj się, aby przejść do swojej przestrzeni.',
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
    themeLabel: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System',
    langLabel: 'Language', logout: 'Log out', exportLabel: 'Export data',
    exportBusy: 'Preparing the file…', exportError: 'Could not build the file. Try again.',
    exportModalTitle: 'Export data', exportWhat: 'What to save', exportFormat: 'Format',
    exportSave: 'Save', exportNothing: 'Pick at least one section.',
    sec_budget: 'Budget', sec_goals: 'Goals', sec_tasks: 'Tasks', sec_workout: 'Workouts',
    fmt_xlsx: 'Excel (.xlsx)', fmt_csv: 'CSV', fmt_json: 'JSON',
    hint_xlsx: 'One file, each section on its own tab. For looking and counting.',
    hint_csv: (n) => (n > 1
      ? `${n} ${plural(n, { one: 'file', other: 'files' })} will be saved — CSV has no tabs, so every table gets its own.`
      : 'A plain table — to load somewhere else.'),
    hint_json: 'A full backup: everything as-is, nothing lost. Not meant for reading.',
    budgetTitle: 'Budget', budgetSub: 'spending & income',
    goalsTitle: 'Goals', goalsSub: 'long-term',
    tasksTitle: 'Tasks', tasksSub: 'day to day',
    workoutTitle: 'Workouts', workoutSub: 'sessions & records',
 openBtn: 'Open',
    authTitleLogin: 'Log in', authTitleSignup: 'Sign up',
    authSub: 'Sign in to get to your personal space.',
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
// Частина рядків — функції від аргументів («збережеться N файлів»), тож t
// або підставляє їх, або віддає саму функцію, коли аргументів не передали.
// Друге лишилось заради `t('resetSent')(email)` у формі входу.
function t(key, ...args) {
  const val = (STRINGS[currentLang] && STRINGS[currentLang][key]) || STRINGS.uk[key] || key;
  return typeof val === 'function' && args.length ? val(...args) : val;
}

// «2 файлів» — так не кажуть. Форму слова бере Intl, бо правила у чотирьох
// мовах різні.
function plural(n, forms) {
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  let cat = 'other';
  try { cat = new Intl.PluralRules(locale).select(n); } catch (err) { cat = 'other'; }
  return forms[cat] || forms.other || forms.many || '';
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  document.getElementById('themeMenuLabel').textContent = t('themeLabel');
  document.getElementById('langMenuLabel').textContent = t('langLabel');
  document.getElementById('exportLabel').textContent = t('exportLabel');
  document.getElementById('logoutLabel').textContent = t('logout');
  document.getElementById('budgetTitle').textContent = t('budgetTitle');
  document.getElementById('budgetSub').textContent = t('budgetSub');
  document.getElementById('openBtnLabel').textContent = t('openBtn');
  document.getElementById('goalsTitle').textContent = t('goalsTitle');
  document.getElementById('goalsSub').textContent = t('goalsSub');
  document.getElementById('goalsOpenBtnLabel').textContent = t('openBtn');
  document.getElementById('tasksTitle').textContent = t('tasksTitle');
  document.getElementById('tasksSub').textContent = t('tasksSub');
  document.getElementById('tasksOpenBtnLabel').textContent = t('openBtn');
  document.getElementById('workoutTitle').textContent = t('workoutTitle');
  document.getElementById('workoutSub').textContent = t('workoutSub');
  document.getElementById('workoutOpenBtnLabel').textContent = t('openBtn');
  document.getElementById('authSub').textContent = t('authSub');
  document.getElementById('authEmailLabel').textContent = t('emailLabel');
  document.getElementById('authPasswordLabel').textContent = t('passwordLabel');
  document.getElementById('authPasswordHint').textContent = t('passwordHint');
  document.getElementById('rememberMeLabel').textContent = t('rememberMe');
  document.getElementById('forgotPasswordLink').textContent = t('forgotPassword');
  setAuthMode(authMode);
}

function renderLangPicker() {
  const picker = document.getElementById('langPicker');
  if (!picker) return;
  picker.innerHTML = LANGS
    .map((l) => `<button type="button" class="lang-choice${l === currentLang ? ' selected' : ''}" data-lang="${l}">${LANG_NAMES[l]}</button>`)
    .join('');
  picker.querySelectorAll('.lang-choice').forEach((btn) => {
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
  renderLangPicker();
}

// ---- Тема (світла / темна / як в системі) ----
// Той самий ключ localStorage, що й у budget/app.js — вибір тут одразу
// підхоплюється і на сторінці бюджету, і навпаки.
const THEME_CHOICES = ['light', 'dark', 'system'];
let themeChoice = localStorage.getItem('financeAppTheme') || 'system';
if (!THEME_CHOICES.includes(themeChoice)) themeChoice = 'system';
const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function resolveTheme() {
  if (themeChoice === 'dark') return 'dark';
  if (themeChoice === 'light') return 'light';
  return darkMediaQuery.matches ? 'dark' : 'light';
}
function applyTheme() {
  const resolved = resolveTheme();
  document.documentElement.setAttribute('data-theme', resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0B0B0E' : '#EDEEF3');
}
function renderThemePicker() {
  const picker = document.getElementById('themePicker');
  if (!picker) return;
  const options = [
    { key: 'light', label: t('themeLight') },
    { key: 'dark', label: t('themeDark') },
    { key: 'system', label: t('themeSystem') },
  ];
  picker.innerHTML = options
    .map((o) => `<button type="button" class="theme-choice${o.key === themeChoice ? ' selected' : ''}" data-theme-choice="${o.key}">${o.label}</button>`)
    .join('');
  picker.querySelectorAll('.theme-choice').forEach((btn) => {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeChoice));
  });
}
function setTheme(choice) {
  if (!THEME_CHOICES.includes(choice)) return;
  themeChoice = choice;
  localStorage.setItem('financeAppTheme', choice);
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).set({ theme: choice }, { merge: true }).catch(() => {});
  }
  applyTheme();
  renderThemePicker();
}
darkMediaQuery.addEventListener('change', () => {
  if (themeChoice === 'system') applyTheme();
});

// ---- Гамбургер-меню (тема / мова / вихід) ----
document.getElementById('menuBtn').addEventListener('click', () => {
  const overlay = document.getElementById('appMenuOverlay');
  const btn = document.getElementById('menuBtn');
  const isOpen = overlay.classList.toggle('show');
  btn.classList.toggle('open', isOpen);
});
document.getElementById('appMenuOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'appMenuOverlay') {
    e.currentTarget.classList.remove('show');
    document.getElementById('menuBtn').classList.remove('open');
  }
});

// ---- Вхід / реєстрація ----
let authMode = 'login';

function authErrorMessage(code) {
  const map = {
    'auth/invalid-email': t('err_invalidEmail'),
    'auth/missing-password': t('err_missingPassword'),
    'auth/weak-password': t('err_weakPassword'),
    'auth/email-already-in-use': t('err_emailInUse'),
    'auth/invalid-credential': t('err_invalidCred'),
    'auth/wrong-password': t('err_invalidCred'),
    'auth/user-not-found': t('err_userNotFound'),
    'auth/too-many-requests': t('err_tooMany'),
  };
  return map[code] || t('err_generic');
}

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('authTitle').textContent = mode === 'login' ? t('authTitleLogin') : t('authTitleSignup');
  document.getElementById('authSubmit').textContent = mode === 'login' ? t('signInLink') : t('signUpLink');
  document.getElementById('authSwitch').innerHTML = mode === 'login'
    ? `${t('noAccount')} <a id="authToggle">${t('signUpLink')}</a>`
    : `${t('haveAccount')} <a id="authToggle">${t('signInLink')}</a>`;
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authInfo').style.display = 'none';
  const hintEl = document.getElementById('authPasswordHint');
  hintEl.style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('authPassword').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
  document.getElementById('authToggle').addEventListener('click', () => setAuthMode(mode === 'login' ? 'signup' : 'login'));
}
setAuthMode('login');

// ---- Початкове застосування теми / мови / екрана входу ----
// Виконуємо після того, як authMode і setAuthMode вже визначені, бо
// applyTranslations() всередині повторно викликає setAuthMode(authMode).
applyTheme();
renderThemePicker();
renderLangPicker();
applyTranslations();

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const remember = document.getElementById('rememberMe').checked;
  const errEl = document.getElementById('authError');
  const infoEl = document.getElementById('authInfo');
  const btn = document.getElementById('authSubmit');
  errEl.style.display = 'none';
  infoEl.style.display = 'none';
  if (!email || !password) {
    errEl.textContent = t('fillBoth');
    errEl.style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = t('waitLabel');
  try {
    await auth.setPersistence(remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);
    if (authMode === 'login') {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      await auth.createUserWithEmailAndPassword(email, password);
    }
    if (remember) {
      localStorage.setItem('financeAppLastEmail', email);
    } else {
      localStorage.removeItem('financeAppLastEmail');
    }
  } catch (err) {
    errEl.textContent = authErrorMessage(err.code);
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? t('signInLink') : t('signUpLink');
  }
});

document.getElementById('forgotPasswordLink').addEventListener('click', async () => {
  const email = document.getElementById('authEmail').value.trim();
  const errEl = document.getElementById('authError');
  const infoEl = document.getElementById('authInfo');
  const link = document.getElementById('forgotPasswordLink');
  errEl.style.display = 'none';
  infoEl.style.display = 'none';
  if (!email) {
    errEl.textContent = t('enterEmailFirst');
    errEl.style.display = 'block';
    return;
  }
  link.style.pointerEvents = 'none';
  try {
    await auth.sendPasswordResetEmail(email);
    infoEl.textContent = t('resetSent')(email);
    infoEl.style.display = 'block';
  } catch (err) {
    errEl.textContent = err.code === 'auth/invalid-email' ? t('err_invalidEmail')
      : err.code === 'auth/user-not-found' ? t('err_userNotFound')
      : t('err_resetGeneric');
    errEl.style.display = 'block';
  } finally {
    link.style.pointerEvents = '';
  }
});

// ---- Експорт даних ----
// Резервна копія стосується всього застосунку, а не однієї вкладки, тож
// кнопка живе на головному екрані. Дані читаємо разово запитом, а не
// підпискою: хаб не тримає їх у пам'яті й не має цього робити заради
// однієї кнопки.
const EXPORT_LABELS = {
  uk: { sheetTx: 'Транзакції', sheetSavings: 'Заощадження', sheetSavingsGoals: 'Цілі заощаджень', sheetNotes: 'Нотатки', sheetCats: 'Категорії',
        sheetLifeGoals: 'Цілі', sheetJournal: 'Щоденник цілей', sheetTasks: 'Завдання', sheetWorkouts: 'Тренування',
        colDate: 'Дата', colType: 'Тип', colCategory: 'Категорія', colAmount: 'Сума', colCurrency: 'Валюта', colNote: 'Нотатка',
        colGoal: 'Ціль', colName: 'Назва', colCreated: 'Створено', colUpdated: 'Оновлено', colTitle: 'Заголовок', colContent: 'Зміст',
        colStatus: 'Статус', colDeadline: 'Дедлайн', colTarget: 'Мета', colCurrent: 'Пройдено', colUnit: 'Одиниця',
        colMilestones: 'Віхи', colCheckins: 'Чекінів', colWhy: 'Навіщо',
        colDone: 'Виконано', colTime: 'Час', colPriority: 'Пріоритет', colTags: 'Теги', colEstimate: 'Хвилин',
        colRepeat: 'Повтор', colSubtasks: 'Підзадачі', colCompleted: 'Завершено',
        colExercise: 'Вправа', colMuscle: 'Група', colSets: 'Підходів', colDetails: 'Підходи', colVolume: 'Обсяг, кг',
        typeExpense: 'Витрата', typeIncome: 'Дохід', typeDeposit: 'Поповнення', typeWithdraw: 'Зняття',
        status_active: 'Активна', status_done: 'Завершена', status_archived: 'Архів',
        prio_high: 'Високий', prio_medium: 'Середній', prio_low: 'Низький',
        yes: 'Так', no: 'Ні',
        defaultGoalName: 'Заощадження', noTitle: 'Без заголовка' },
  ru: { sheetTx: 'Транзакции', sheetSavings: 'Накопления', sheetSavingsGoals: 'Цели накоплений', sheetNotes: 'Заметки', sheetCats: 'Категории',
        sheetLifeGoals: 'Цели', sheetJournal: 'Дневник целей', sheetTasks: 'Задачи', sheetWorkouts: 'Тренировки',
        colDate: 'Дата', colType: 'Тип', colCategory: 'Категория', colAmount: 'Сумма', colCurrency: 'Валюта', colNote: 'Заметка',
        colGoal: 'Цель', colName: 'Название', colCreated: 'Создано', colUpdated: 'Обновлено', colTitle: 'Заголовок', colContent: 'Содержимое',
        colStatus: 'Статус', colDeadline: 'Дедлайн', colTarget: 'Цель', colCurrent: 'Пройдено', colUnit: 'Единица',
        colMilestones: 'Вехи', colCheckins: 'Чекинов', colWhy: 'Зачем',
        colDone: 'Выполнено', colTime: 'Время', colPriority: 'Приоритет', colTags: 'Теги', colEstimate: 'Минут',
        colRepeat: 'Повтор', colSubtasks: 'Подзадачи', colCompleted: 'Завершено',
        colExercise: 'Упражнение', colMuscle: 'Группа', colSets: 'Подходов', colDetails: 'Подходы', colVolume: 'Объём, кг',
        typeExpense: 'Расход', typeIncome: 'Доход', typeDeposit: 'Пополнение', typeWithdraw: 'Снятие',
        status_active: 'Активная', status_done: 'Завершена', status_archived: 'Архив',
        prio_high: 'Высокий', prio_medium: 'Средний', prio_low: 'Низкий',
        yes: 'Да', no: 'Нет',
        defaultGoalName: 'Накопления', noTitle: 'Без заголовка' },
  pl: { sheetTx: 'Transakcje', sheetSavings: 'Oszczędności', sheetSavingsGoals: 'Cele oszczędnościowe', sheetNotes: 'Notatki', sheetCats: 'Kategorie',
        sheetLifeGoals: 'Cele', sheetJournal: 'Dziennik celów', sheetTasks: 'Zadania', sheetWorkouts: 'Treningi',
        colDate: 'Data', colType: 'Typ', colCategory: 'Kategoria', colAmount: 'Kwota', colCurrency: 'Waluta', colNote: 'Notatka',
        colGoal: 'Cel', colName: 'Nazwa', colCreated: 'Utworzono', colUpdated: 'Zaktualizowano', colTitle: 'Tytuł', colContent: 'Treść',
        colStatus: 'Status', colDeadline: 'Termin', colTarget: 'Cel liczbowy', colCurrent: 'Postęp', colUnit: 'Jednostka',
        colMilestones: 'Kamienie milowe', colCheckins: 'Odhaczeń', colWhy: 'Po co',
        colDone: 'Zrobione', colTime: 'Godzina', colPriority: 'Priorytet', colTags: 'Tagi', colEstimate: 'Minut',
        colRepeat: 'Powtarzanie', colSubtasks: 'Podzadania', colCompleted: 'Ukończono',
        colExercise: 'Ćwiczenie', colMuscle: 'Partia', colSets: 'Serii', colDetails: 'Serie', colVolume: 'Objętość, kg',
        typeExpense: 'Wydatek', typeIncome: 'Przychód', typeDeposit: 'Wpłata', typeWithdraw: 'Wypłata',
        status_active: 'Aktywny', status_done: 'Ukończony', status_archived: 'Archiwum',
        prio_high: 'Wysoki', prio_medium: 'Średni', prio_low: 'Niski',
        yes: 'Tak', no: 'Nie',
        defaultGoalName: 'Oszczędności', noTitle: 'Bez tytułu' },
  en: { sheetTx: 'Transactions', sheetSavings: 'Savings', sheetSavingsGoals: 'Savings goals', sheetNotes: 'Notes', sheetCats: 'Categories',
        sheetLifeGoals: 'Goals', sheetJournal: 'Goal journal', sheetTasks: 'Tasks', sheetWorkouts: 'Workouts',
        colDate: 'Date', colType: 'Type', colCategory: 'Category', colAmount: 'Amount', colCurrency: 'Currency', colNote: 'Note',
        colGoal: 'Goal', colName: 'Name', colCreated: 'Created', colUpdated: 'Updated', colTitle: 'Title', colContent: 'Content',
        colStatus: 'Status', colDeadline: 'Deadline', colTarget: 'Target', colCurrent: 'Progress', colUnit: 'Unit',
        colMilestones: 'Milestones', colCheckins: 'Check-ins', colWhy: 'Why',
        colDone: 'Done', colTime: 'Time', colPriority: 'Priority', colTags: 'Tags', colEstimate: 'Minutes',
        colRepeat: 'Repeat', colSubtasks: 'Subtasks', colCompleted: 'Completed',
        colExercise: 'Exercise', colMuscle: 'Muscle', colSets: 'Sets', colDetails: 'Set detail', colVolume: 'Volume, kg',
        typeExpense: 'Expense', typeIncome: 'Income', typeDeposit: 'Deposit', typeWithdraw: 'Withdrawal',
        status_active: 'Active', status_done: 'Done', status_archived: 'Archived',
        prio_high: 'High', prio_medium: 'Medium', prio_low: 'Low',
        yes: 'Yes', no: 'No',
        defaultGoalName: 'Savings', noTitle: 'Untitled' },
};

async function collectDocs(userRef, name) {
  const snap = await userRef.collection(name).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---- Експорт ----
// Кнопка більше не тягне файл одразу: спершу людина каже, ЩО зберегти й у
// ЯКОМУ вигляді. За замовчуванням обрано все й xlsx — тобто попередня
// поведінка лишається за два дотики, а не зникає.
let exportSections = LifeExport.SECTION_KEYS.slice();
let exportFormat = 'xlsx';

function renderExportOptions() {
  document.getElementById('exportSections').innerHTML = LifeExport.SECTION_KEYS.map((key) => `
    <button type="button" class="export-chip${exportSections.includes(key) ? ' selected' : ''}" data-section="${key}">${escapeHtml(t('sec_' + key))}</button>`).join('');
  document.getElementById('exportFormats').innerHTML = LifeExport.FORMATS.map((fmt) => `
    <button type="button" class="export-chip${exportFormat === fmt ? ' selected' : ''}" data-format="${fmt}">${escapeHtml(t('fmt_' + fmt))}</button>`).join('');

  // Скільки файлів вийде — це те, що людині варто знати ДО натискання, а
  // не побачити потім у теці завантажень.
  const hintEl = document.getElementById('exportFormatHint');
  if (exportFormat === 'csv') {
    hintEl.textContent = t('hint_csv', countCsvFiles());
  } else {
    hintEl.textContent = t('hint_' + exportFormat);
  }

  document.getElementById('exportSections').querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.section;
      exportSections = exportSections.includes(key)
        ? exportSections.filter((k) => k !== key)
        : exportSections.concat([key]);
      document.getElementById('exportModalError').textContent = '';
      renderExportOptions();
    });
  });
  document.getElementById('exportFormats').querySelectorAll('[data-format]').forEach((btn) => {
    btn.addEventListener('click', () => { exportFormat = btn.dataset.format; renderExportOptions(); });
  });
}

// Рахуємо на порожніх даних: кількість аркушів залежить тільки від того,
// які розділи обрано, а не від того, скільки в них записів.
function countCsvFiles() {
  return LifeExport.buildSheets(exportSections, {}, EXPORT_LABELS[currentLang] || EXPORT_LABELS.uk).length;
}

function openExportDialog() {
  document.getElementById('exportModalTitle').textContent = t('exportModalTitle');
  document.getElementById('exportWhatLabel').textContent = t('exportWhat');
  document.getElementById('exportFormatLabel').textContent = t('exportFormat');
  document.getElementById('exportSaveBtn').textContent = t('exportSave');
  document.getElementById('exportModalError').textContent = '';
  document.getElementById('exportSaveBtn').disabled = false;
  renderExportOptions();
  document.getElementById('appMenuOverlay').classList.remove('show');
  document.getElementById('exportOverlay').classList.add('show');
}

function closeExportDialog() {
  document.getElementById('exportOverlay').classList.remove('show');
}

document.getElementById('exportBtn').addEventListener('click', openExportDialog);
document.getElementById('exportCloseBtn').addEventListener('click', closeExportDialog);
document.getElementById('exportOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'exportOverlay') closeExportDialog();
});

document.getElementById('exportSaveBtn').addEventListener('click', async () => {
  const btn = document.getElementById('exportSaveBtn');
  const errorEl = document.getElementById('exportModalError');
  const user = auth.currentUser;
  if (!user || btn.disabled) return;
  if (!exportSections.length) { errorEl.textContent = t('exportNothing'); return; }

  btn.disabled = true;
  btn.textContent = t('exportBusy');
  errorEl.textContent = '';
  try {
    const userRef = db.collection('users').doc(user.uid);
    // Читаємо лише те, що обрали: вивантажувати всю базу заради однієї
    // вкладки — це і час, і чужі читання Firestore.
    const wants = (key) => exportSections.includes(key);
    // Цілі потрібні й самі по собі, і як назви для завдань, привʼязаних до них.
    const needGoals = wants('goals') || wants('tasks');
    const [profile, transactions, savings, savingsGoals, notes, goals, tasks, workouts] = await Promise.all([
      userRef.get(),
      wants('budget') ? collectDocs(userRef, 'transactions') : [],
      wants('budget') ? collectDocs(userRef, 'savings') : [],
      wants('budget') ? collectDocs(userRef, 'savingsGoals') : [],
      wants('budget') ? collectDocs(userRef, 'pages') : [],
      needGoals ? collectDocs(userRef, 'goals') : [],
      wants('tasks') ? collectDocs(userRef, 'tasks') : [],
      wants('workout') ? collectDocs(userRef, 'workouts') : [],
    ]);
    const data = profile.exists ? (profile.data() || {}) : {};
    const result = LifeExport.exportData(exportSections, exportFormat, {
      transactions, savings, savingsGoals, notes, goals, tasks, workouts,
      // Поки людина не редагувала категорії, у профілі їх немає — тоді
      // беремо стандартні, щоб у файлі були слова, а не службові id.
      categoriesExpense: data.categoriesExpense || defaultCategoryList('expense', currentLang),
      categoriesIncome: data.categoriesIncome || defaultCategoryList('income', currentLang),
    }, EXPORT_LABELS[currentLang] || EXPORT_LABELS.uk);
    if (!result.files) throw new Error('nothing exported');
    closeExportDialog();
  } catch (err) {
    console.error('export:', err);
    errorEl.textContent = t('exportError');
  }
  btn.textContent = t('exportSave');
  btn.disabled = false;
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut();
});

auth.onAuthStateChanged((user) => {
  document.getElementById('authLoading').style.display = 'none';
  if (user) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('homeScreen').style.display = 'block';
    // Підтягуємо тему й мову з профілю користувача (якщо їх уже змінювали в
    // budget/ або на іншому пристрої) — щоб сторінки не розходились візуально.
    db.collection('users').doc(user.uid).get().then((doc) => {
      const data = doc.data();
      let changed = false;
      if (data && data.theme && THEME_CHOICES.includes(data.theme) && data.theme !== themeChoice) {
        themeChoice = data.theme;
        localStorage.setItem('financeAppTheme', themeChoice);
        applyTheme();
        changed = true;
      }
      if (data && data.lang && LANGS.includes(data.lang) && data.lang !== currentLang) {
        currentLang = data.lang;
        localStorage.setItem('financeAppLang', currentLang);
        changed = true;
      }
      if (changed) {
        applyTranslations();
        renderThemePicker();
        renderLangPicker();
      }
    }).catch(() => {});
  } else {
    document.getElementById('homeScreen').style.display = 'none';
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

// Захист від вічного спінера (аналогічно budget/app.js) — якщо Firebase
// не відповість за кілька секунд, показуємо форму входу замість того,
// щоб лишати користувача дивитись на спінер нескінченно.
setTimeout(() => {
  const loadingEl = document.getElementById('authLoading');
  if (loadingEl && loadingEl.style.display !== 'none') {
    loadingEl.style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
  }
}, 6000);
