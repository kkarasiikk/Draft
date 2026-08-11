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
// Ті самі мови й ключі localStorage, що й у budget/app.js та home.js —
// вибір мови/теми лишається синхронізованим по всьому сайту.
const LANGS = ['uk', 'ru', 'pl', 'en'];
const LANG_NAMES = { uk: 'UA', ru: 'RU', pl: 'PL', en: 'EN' };
const LOCALE_MAP = { uk: 'uk-UA', ru: 'ru-RU', pl: 'pl-PL', en: 'en-US' };

const T = {
  uk: {
    pageTitle: 'Завдання', pageSub: 'Що зробити сьогодні, а що вже зроблено',
    searchPlaceholder: 'Пошук за назвою, нотатками, тегами',
    noDateLabel: 'Без дати',
    dayViewEmptyTitle: 'На цю дату завдань немає', dayViewEmptySub: 'Додай завдання кнопкою внизу.',
    dayViewFabLabel: 'Нове завдання',
    completedLabel: (n) => `Виконано (${n})`,
    newTaskTitle: 'Нове завдання', editTaskTitle: 'Редагувати завдання',
    titlePlaceholder: 'Назва завдання',
    notesLabel: 'Нотатка', notesPlaceholder: 'Додаткові деталі (необовʼязково)',
    dueDateLabel: 'Дата', dueTimeLabel: 'Час',
    priorityLabel: 'Пріоритет', priorityNone: 'Немає', priorityLow: 'Низький', priorityMedium: 'Середній', priorityHigh: 'Високий',
    tagsLabel: 'Теги', tagsPlaceholder: 'Додай тег і натисни Enter',
    subtasksLabel: 'Підзадачі', subtaskPlaceholder: 'Нова підзадача',
    deleteBtn: 'Видалити', saveBtn: 'Зберегти',
    titleRequiredError: 'Введи назву завдання',
    confirmDeleteTitle: 'Видалити завдання?', confirmDeleteSub: 'Цю дію не можна скасувати.',
    cancelBtn: 'Скасувати', deleteConfirmBtn: 'Видалити',
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
    pageTitle: 'Задачи', pageSub: 'Что сделать сегодня, а что уже сделано',
    searchPlaceholder: 'Поиск по названию, заметкам, тегам',
    noDateLabel: 'Без даты',
    dayViewEmptyTitle: 'На эту дату задач нет', dayViewEmptySub: 'Добавь задачу кнопкой внизу.',
    dayViewFabLabel: 'Новая задача',
    completedLabel: (n) => `Выполнено (${n})`,
    newTaskTitle: 'Новая задача', editTaskTitle: 'Редактировать задачу',
    titlePlaceholder: 'Название задачи',
    notesLabel: 'Заметка', notesPlaceholder: 'Дополнительные детали (необязательно)',
    dueDateLabel: 'Дата', dueTimeLabel: 'Время',
    priorityLabel: 'Приоритет', priorityNone: 'Нет', priorityLow: 'Низкий', priorityMedium: 'Средний', priorityHigh: 'Высокий',
    tagsLabel: 'Теги', tagsPlaceholder: 'Добавь тег и нажми Enter',
    subtasksLabel: 'Подзадачи', subtaskPlaceholder: 'Новая подзадача',
    deleteBtn: 'Удалить', saveBtn: 'Сохранить',
    titleRequiredError: 'Введи название задачи',
    confirmDeleteTitle: 'Удалить задачу?', confirmDeleteSub: 'Это действие нельзя отменить.',
    cancelBtn: 'Отмена', deleteConfirmBtn: 'Удалить',
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
    pageTitle: 'Zadania', pageSub: 'Co zrobić dziś, a co już zrobione',
    searchPlaceholder: 'Szukaj po nazwie, notatkach, tagach',
    noDateLabel: 'Bez daty',
    dayViewEmptyTitle: 'Na ten dzień nie ma zadań', dayViewEmptySub: 'Dodaj zadanie przyciskiem poniżej.',
    dayViewFabLabel: 'Nowe zadanie',
    completedLabel: (n) => `Ukończono (${n})`,
    newTaskTitle: 'Nowe zadanie', editTaskTitle: 'Edytuj zadanie',
    titlePlaceholder: 'Nazwa zadania',
    notesLabel: 'Notatka', notesPlaceholder: 'Dodatkowe szczegóły (opcjonalnie)',
    dueDateLabel: 'Data', dueTimeLabel: 'Godzina',
    priorityLabel: 'Priorytet', priorityNone: 'Brak', priorityLow: 'Niski', priorityMedium: 'Średni', priorityHigh: 'Wysoki',
    tagsLabel: 'Tagi', tagsPlaceholder: 'Dodaj tag i naciśnij Enter',
    subtasksLabel: 'Podzadania', subtaskPlaceholder: 'Nowe podzadanie',
    deleteBtn: 'Usuń', saveBtn: 'Zapisz',
    titleRequiredError: 'Wpisz nazwę zadania',
    confirmDeleteTitle: 'Usunąć zadanie?', confirmDeleteSub: 'Tej czynności nie można cofnąć.',
    cancelBtn: 'Anuluj', deleteConfirmBtn: 'Usuń',
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
    pageTitle: 'Tasks', pageSub: "What to do today, and what's already done",
    searchPlaceholder: 'Search title, notes, tags',
    noDateLabel: 'No date',
    dayViewEmptyTitle: 'No tasks for this date', dayViewEmptySub: 'Add a task with the button below.',
    dayViewFabLabel: 'New task',
    completedLabel: (n) => `Completed (${n})`,
    newTaskTitle: 'New task', editTaskTitle: 'Edit task',
    titlePlaceholder: 'Task title',
    notesLabel: 'Notes', notesPlaceholder: 'Extra details (optional)',
    dueDateLabel: 'Date', dueTimeLabel: 'Time',
    priorityLabel: 'Priority', priorityNone: 'None', priorityLow: 'Low', priorityMedium: 'Medium', priorityHigh: 'High',
    tagsLabel: 'Tags', tagsPlaceholder: 'Add a tag and press Enter',
    subtasksLabel: 'Subtasks', subtaskPlaceholder: 'New subtask',
    deleteBtn: 'Delete', saveBtn: 'Save',
    titleRequiredError: 'Enter a task title',
    confirmDeleteTitle: 'Delete task?', confirmDeleteSub: 'This action cannot be undone.',
    cancelBtn: 'Cancel', deleteConfirmBtn: 'Delete',
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
function renderThemePicker() {
  const picker = document.getElementById('themePicker');
  if (!picker) return;
  const choice = localStorage.getItem('financeAppTheme') || 'system';
  const opts = [['light', t('themeLight')], ['dark', t('themeDark')], ['system', t('themeSystem')]];
  picker.innerHTML = opts.map(([v, label]) =>
    `<button type="button" class="lang-chip${choice === v ? ' selected' : ''}" data-theme-choice="${v}" style="flex:1;">${label}</button>`
  ).join('');
  picker.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeChoice));
  });
}
function setTheme(choice) {
  localStorage.setItem('financeAppTheme', choice);
  applyTheme();
  renderThemePicker();
}
darkMediaQuery.addEventListener('change', () => {
  if ((localStorage.getItem('financeAppTheme') || 'system') === 'system') applyTheme();
});

function renderLangPicker() {
  const picker = document.getElementById('langPicker');
  if (!picker) return;
  picker.innerHTML = LANGS
    .map((l) => `<button type="button" class="lang-chip${l === currentLang ? ' selected' : ''}" data-lang="${l}">${LANG_NAMES[l]}</button>`)
    .join('');
  picker.querySelectorAll('.lang-choice, [data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
}
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
  renderLangPicker();
  renderAuthLangRow();
  renderPriorityPicker();
  renderCurrentScreen();
}

// ---- Переклад статичних елементів ----
function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  document.title = `${t('pageTitle')} · Life`;
  document.getElementById('pageTitle').textContent = t('pageTitle');
  document.getElementById('pageSub').textContent = t('pageSub');
  document.getElementById('searchInput').placeholder = t('searchPlaceholder');
  document.getElementById('dayViewFabLabel').textContent = t('dayViewFabLabel');
  document.getElementById('notesLabel').textContent = t('notesLabel');
  document.getElementById('taskNotesInput').placeholder = t('notesPlaceholder');
  document.getElementById('dueDateLabel').textContent = t('dueDateLabel');
  document.getElementById('dueTimeLabel').textContent = t('dueTimeLabel');
  document.getElementById('priorityLabel').textContent = t('priorityLabel');
  document.getElementById('tagsLabel').textContent = t('tagsLabel');
  document.getElementById('tagInput').placeholder = t('tagsPlaceholder');
  document.getElementById('subtasksLabel').textContent = t('subtasksLabel');
  document.getElementById('subtaskInput').placeholder = t('subtaskPlaceholder');
  document.getElementById('deleteTaskBtn').textContent = t('deleteBtn');
  document.getElementById('taskSubmitBtn').textContent = t('saveBtn');
  document.getElementById('taskTitleInput').placeholder = t('titlePlaceholder');
  document.getElementById('confirmTitle').textContent = t('confirmDeleteTitle');
  document.getElementById('confirmSub').textContent = t('confirmDeleteSub');
  document.getElementById('confirmCancel').textContent = t('cancelBtn');
  document.getElementById('confirmDelete').textContent = t('deleteConfirmBtn');
  document.getElementById('themeMenuLabel').textContent = t('themeLabel');
  document.getElementById('langMenuLabel').textContent = t('langLabel');
  document.getElementById('logoutLabel').textContent = t('logout');
  document.getElementById('topbarBrandLabel').textContent = 'Life';
  document.getElementById('authSub').textContent = t('authSub');
  document.getElementById('authEmailLabel').textContent = t('emailLabel');
  document.getElementById('authPasswordLabel').textContent = t('passwordLabel');
  document.getElementById('authPasswordHint').textContent = t('passwordHint');
  document.getElementById('rememberMeLabel').textContent = t('rememberMe');
  document.getElementById('forgotPasswordLink').textContent = t('forgotPassword');
  setAuthMode(authMode);
}

// ---- Пріоритет / нагадування: опції форми (залежать від мови) ----
const PRIORITIES = [null, 'low', 'medium', 'high'];
function priorityLabel(p) {
  return p === 'low' ? t('priorityLow') : p === 'medium' ? t('priorityMedium') : p === 'high' ? t('priorityHigh') : t('priorityNone');
}
function renderPriorityPicker() {
  const el = document.getElementById('priorityPicker');
  el.innerHTML = PRIORITIES.map((p) =>
    `<button type="button" class="choice${formPriority === p ? ' selected' : ''}${p ? ' ' + p : ''}" data-priority="${p || ''}">${priorityLabel(p)}</button>`
  ).join('');
  el.querySelectorAll('[data-priority]').forEach((btn) => {
    btn.addEventListener('click', () => { formPriority = btn.dataset.priority || null; renderPriorityPicker(); });
  });
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
    if (document.getElementById('rememberMe').checked) {
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

// ---- Гамбургер-меню ----
document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('appMenuOverlay').classList.add('show');
});
document.getElementById('appMenuOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'appMenuOverlay') e.currentTarget.classList.remove('show');
});
document.getElementById('logoutBtn').addEventListener('click', () => {
  document.getElementById('appMenuOverlay').classList.remove('show');
  auth.signOut();
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

// ---- Стан ----
let tasks = [];
let unsubscribeTasks = null;
let searchQuery = '';
let selectedTags = new Set();
let editingTaskId = null;
let formPriority = null;
let formTags = [];
let formSubtasks = [];
let pendingDeleteId = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let expandedCalDays = new Set();

// ---- Дані (Firestore, реалтайм) ----
function subscribeToTasks(uid) {
  if (unsubscribeTasks) unsubscribeTasks();
  const col = db.collection('users').doc(uid).collection('tasks');
  unsubscribeTasks = col.onSnapshot((snap) => {
    tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCurrentScreen();
  }, (err) => console.error('subscribeToTasks:', err));
}

function sortTasks(list) {
  const prioOrder = { high: 0, medium: 1, low: 2 };
  return [...list].sort((a, b) => {
    const ta = a.dueTime || (a.dueDate ? '23:59' : '99:99');
    const tb = b.dueTime || (b.dueDate ? '23:59' : '99:99');
    if (ta !== tb) return ta < tb ? -1 : 1;
    const pa = a.priority ? prioOrder[a.priority] : 3;
    const pb = b.priority ? prioOrder[b.priority] : 3;
    if (pa !== pb) return pa - pb;
    return (a.title || '').localeCompare(b.title || '');
  });
}

function matchesFilters(task) {
  if (selectedTags.size > 0 && !(task.tags || []).some((tag) => selectedTags.has(tag))) return false;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const hay = [task.title, task.notes, ...(task.tags || [])].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function allTags() {
  const set = new Set();
  tasks.forEach((tsk) => (tsk.tags || []).forEach((tag) => set.add(tag)));
  return [...set].sort();
}

function renderTagFilterRow() {
  const row = document.getElementById('tagFilterRow');
  const tags = allTags();
  if (tags.length === 0) {
    row.innerHTML = '';
    return;
  }
  row.innerHTML = tags.map((tag) =>
    `<button type="button" class="tag-filter-chip${selectedTags.has(tag) ? ' selected' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
  ).join('');
  row.querySelectorAll('[data-tag]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (selectedTags.has(tag)) selectedTags.delete(tag); else selectedTags.add(tag);
      renderCalendar();
    });
  });
}

function taskRowHtml(task) {
  const checkedClass = task.done ? ' checked' : '';
  const prioClass = task.priority ? ` priority-${task.priority}` : '';
  const doneRowClass = task.done ? ' done' : '';
  const isOverdue = !task.done && task.dueDate && task.dueDate < todayISO();
  const subtasks = task.subtasks || [];
  const subDone = subtasks.filter((s) => s.done).length;
  const metaParts = [];
  if (task.dueTime) metaParts.push(`<span class="task-time${isOverdue ? ' overdue' : ''}">${escapeHtml(task.dueTime)}</span>`);
  if (task.priority) metaParts.push(`<span class="priority-chip ${task.priority}">${priorityLabel(task.priority)}</span>`);
  if (subtasks.length) metaParts.push(`<span class="task-progress">${subDone}/${subtasks.length}</span>`);
  (task.tags || []).forEach((tag) => metaParts.push(`<span class="tag-chip">${escapeHtml(tag)}</span>`));
  return `
    <div class="task-row${doneRowClass}" data-id="${task.id}">
      <button type="button" class="task-check${checkedClass}${prioClass}" data-toggle="${task.id}" aria-label="done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </button>
      <div class="task-body" data-open="${task.id}">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${metaParts.length ? `<div class="task-meta">${metaParts.join('')}</div>` : ''}
      </div>
    </div>`;
}

function dayGroupHtml(label, list, overdue) {
  return `
    <div class="day-group">
      <div class="day-label${overdue ? ' overdue' : ''}">${escapeHtml(label)}</div>
      <div class="day-card">${sortTasks(list).map(taskRowHtml).join('')}</div>
    </div>`;
}

function completedSectionHtml(list) {
  if (!list.length) return '';
  const expanded = document.getElementById('completedSection')?.classList.contains('open');
  return `
    <div class="day-group" id="completedSection">
      <button type="button" class="day-label" id="completedToggle" style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;">
        ${escapeHtml(t('completedLabel', list.length))}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transition:transform .2s;${expanded ? 'transform:rotate(180deg);' : ''}"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="day-card" style="${expanded ? '' : 'display:none;'}" id="completedList">${sortTasks(list).map(taskRowHtml).join('')}</div>
    </div>`;
}

// ---- Мітки місяця/днів тижня для календаря (без ручного перекладу — через Intl) ----
function calMonthLabelText() {
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(calYear, calMonth, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function weekdayShortLabels() {
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  // 2024-01-01 — відомий понеділок; тиждень завжди рендеримо з понеділка.
  const monday = new Date(2024, 0, 1);
  const labels = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    labels.push(fmt.format(d));
  }
  return labels;
}

function renderCalendar() {
  renderTagFilterRow();
  document.getElementById('calMonthLabel').textContent = calMonthLabelText();
  document.getElementById('calWeekdays').innerHTML = weekdayShortLabels()
    .map((w) => `<div class="cal-weekday">${escapeHtml(w)}</div>`).join('');

  const today = todayISO();
  const first = new Date(calYear, calMonth, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = понеділок
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const filtered = tasks.filter(matchesFilters);
  const tasksByDate = {};
  filtered.forEach((tsk) => {
    if (!tsk.dueDate) return;
    (tasksByDate[tsk.dueDate] = tasksByDate[tsk.dueDate] || []).push(tsk);
  });

  let html = '';
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    const cellDate = new Date(calYear, calMonth, dayNum);
    const iso = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const dayTasks = sortTasks(tasksByDate[iso] || []);
    const isToday = iso === today;
    const isPast = iso < today;
    const expanded = expandedCalDays.has(iso);
    const visible = expanded ? dayTasks : dayTasks.slice(0, 3);
    const extra = dayTasks.length - visible.length;
    const chips = visible.map((tsk) => {
      const doneClass = tsk.done ? ' cal-chip-done' : '';
      const prioClass = tsk.priority ? ` cal-chip-${tsk.priority}` : '';
      return `<div class="cal-chip${doneClass}${prioClass}" data-open-task="${tsk.id}">${escapeHtml(tsk.title)}</div>`;
    }).join('');
    const moreHtml = extra > 0 ? `<div class="cal-chip-more" data-cal-more="${iso}">+${extra}</div>` : '';
    html += `
      <div class="cal-day${inMonth ? '' : ' other-month'}${isToday ? ' today' : ''}${isPast && inMonth ? ' past' : ''}" data-cal-day="${iso}">
        <div class="cal-day-num">${cellDate.getDate()}</div>
        <div class="cal-day-tasks">${chips}${moreHtml}</div>
      </div>`;
  }
  const gridEl = document.getElementById('calendarGrid');
  gridEl.innerHTML = html;

  gridEl.querySelectorAll('[data-cal-day]').forEach((cell) => {
    cell.addEventListener('click', () => showDayView(cell.dataset.calDay));
  });
  gridEl.querySelectorAll('[data-open-task]').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const tsk = tasks.find((x) => x.id === chip.dataset.openTask);
      if (tsk) openTaskForm(tsk);
    });
  });
  gridEl.querySelectorAll('[data-cal-more]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      expandedCalDays.add(btn.dataset.calMore);
      renderCalendar();
    });
  });

  renderNoDateSection();
}

function renderNoDateSection() {
  const el = document.getElementById('noDateSection');
  const undated = tasks.filter(matchesFilters).filter((tsk) => !tsk.dueDate);
  if (!undated.length) { el.innerHTML = ''; return; }
  const undone = undated.filter((tsk) => !tsk.done);
  const done = undated.filter((tsk) => tsk.done);
  let html = '';
  if (undone.length) html += dayGroupHtml(t('noDateLabel'), undone, false);
  html += completedSectionHtml(done);
  el.innerHTML = html;

  el.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleDone(btn.dataset.toggle); });
  });
  el.querySelectorAll('[data-open]').forEach((elx) => {
    elx.addEventListener('click', () => openTaskForm(tasks.find((tsk) => tsk.id === elx.dataset.open)));
  });
  const completedToggle = el.querySelector('#completedToggle');
  if (completedToggle) {
    completedToggle.addEventListener('click', () => {
      document.getElementById('completedSection').classList.toggle('open');
      renderNoDateSection();
    });
  }
}

// ---- Екран дня (детальний перегляд однієї дати) ----
let currentScreen = 'calendar'; // 'calendar' | 'day'
let dayViewDate = null;

function renderCurrentScreen() {
  if (currentScreen === 'day' && dayViewDate) renderDayView();
  else renderCalendar();
}

function showDayView(iso) {
  dayViewDate = iso;
  currentScreen = 'day';
  document.getElementById('calendarScreen').style.display = 'none';
  document.getElementById('dayViewScreen').style.display = 'block';
  renderDayView();
}

function showCalendarView() {
  currentScreen = 'calendar';
  dayViewDate = null;
  document.getElementById('dayViewScreen').style.display = 'none';
  document.getElementById('calendarScreen').style.display = '';
  renderCalendar();
}

function renderDayView() {
  const iso = dayViewDate;
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const [y, m, d] = iso.split('-').map(Number);
  const label = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(y, m - 1, d));
  document.getElementById('dayViewDateLabel').textContent = label.charAt(0).toUpperCase() + label.slice(1);

  const dayTasks = sortTasks(tasks.filter((tsk) => tsk.dueDate === iso));
  const listEl = document.getElementById('dayViewList');
  if (!dayTasks.length) {
    listEl.innerHTML = `<div class="day-view-empty"><div class="title">${escapeHtml(t('dayViewEmptyTitle'))}</div><div>${escapeHtml(t('dayViewEmptySub'))}</div></div>`;
    return;
  }
  const undone = dayTasks.filter((tsk) => !tsk.done);
  const done = dayTasks.filter((tsk) => tsk.done);
  let html = '';
  if (undone.length) html += `<div class="day-card">${undone.map(taskRowHtml).join('')}</div>`;
  html += completedSectionHtml(done);
  listEl.innerHTML = html;

  listEl.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleDone(btn.dataset.toggle); });
  });
  listEl.querySelectorAll('[data-open]').forEach((elx) => {
    elx.addEventListener('click', () => openTaskForm(tasks.find((tsk) => tsk.id === elx.dataset.open)));
  });
  const completedToggle = listEl.querySelector('#completedToggle');
  if (completedToggle) {
    completedToggle.addEventListener('click', () => {
      document.getElementById('completedSection').classList.toggle('open');
      renderDayView();
    });
  }
}

document.getElementById('dayViewBackBtn').addEventListener('click', showCalendarView);
document.getElementById('openNewTaskDay').addEventListener('click', () => {
  openTaskForm(null, dayViewDate);
});

function toggleDone(id) {
  const task = tasks.find((tsk) => tsk.id === id);
  if (!task || !auth.currentUser) return;
  db.collection('users').doc(auth.currentUser.uid).collection('tasks').doc(id).update({
    done: !task.done,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('toggleDone:', err));
}

// ---- Навігація календаря ----
document.getElementById('calPrevBtn').addEventListener('click', () => {
  calMonth -= 1;
  if (calMonth < 0) { calMonth = 11; calYear -= 1; }
  renderCalendar();
});
document.getElementById('calNextBtn').addEventListener('click', () => {
  calMonth += 1;
  if (calMonth > 11) { calMonth = 0; calYear += 1; }
  renderCalendar();
});
document.getElementById('calMonthLabel').addEventListener('click', () => {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
});

// ---- Пошук ----
document.getElementById('searchToggleBtn').addEventListener('click', () => {
  const bar = document.getElementById('searchBar');
  const btn = document.getElementById('searchToggleBtn');
  const show = !bar.classList.contains('show');
  bar.classList.toggle('show', show);
  btn.classList.toggle('active', show);
  if (show) document.getElementById('searchInput').focus();
  else { document.getElementById('searchInput').value = ''; searchQuery = ''; renderCalendar(); }
});
document.getElementById('searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  document.getElementById('clearSearchBtn').style.display = searchQuery ? 'flex' : 'none';
  renderCalendar();
});
document.getElementById('clearSearchBtn').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  searchQuery = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  renderCalendar();
});

// ---- Форма завдання ----
function renderTagsInput() {
  const row = document.getElementById('tagsInputRow');
  const input = document.getElementById('tagInput');
  row.querySelectorAll('.tag-chip-removable').forEach((el) => el.remove());
  formTags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip-removable';
    chip.innerHTML = `${escapeHtml(tag)} <button type="button" aria-label="remove">&times;</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      formTags = formTags.filter((tg) => tg !== tag);
      renderTagsInput();
    });
    row.insertBefore(chip, input);
  });
}
document.getElementById('tagInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    if (val && !formTags.includes(val) && formTags.length < 20) formTags.push(val);
    e.target.value = '';
    renderTagsInput();
  } else if (e.key === 'Backspace' && !e.target.value && formTags.length) {
    formTags.pop();
    renderTagsInput();
  }
});

function renderSubtasksEditor() {
  const list = document.getElementById('subtasksList');
  list.innerHTML = formSubtasks.map((s) => `
    <div class="subtask-row${s.done ? ' done' : ''}" data-sid="${s.id}">
      <input type="checkbox" data-sub-toggle="${s.id}" ${s.done ? 'checked' : ''}>
      <input type="text" data-sub-title="${s.id}" value="${escapeHtml(s.title)}" maxlength="300">
      <button type="button" class="subtask-del" data-sub-del="${s.id}" aria-label="delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    </div>`).join('');
  list.querySelectorAll('[data-sub-toggle]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const s = formSubtasks.find((x) => x.id === cb.dataset.subToggle);
      if (s) s.done = cb.checked;
      renderSubtasksEditor();
    });
  });
  list.querySelectorAll('[data-sub-title]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const s = formSubtasks.find((x) => x.id === inp.dataset.subTitle);
      if (s) s.title = inp.value;
    });
  });
  list.querySelectorAll('[data-sub-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formSubtasks = formSubtasks.filter((x) => x.id !== btn.dataset.subDel);
      renderSubtasksEditor();
    });
  });
}
function addSubtaskFromInput() {
  const input = document.getElementById('subtaskInput');
  const val = input.value.trim();
  if (!val || formSubtasks.length >= 50) return;
  formSubtasks.push({ id: uid4(), title: val, done: false });
  input.value = '';
  renderSubtasksEditor();
}
document.getElementById('addSubtaskBtn').addEventListener('click', addSubtaskFromInput);
document.getElementById('subtaskInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addSubtaskFromInput(); }
});

function openTaskForm(existingTask, prefillDate) {
  editingTaskId = existingTask ? existingTask.id : null;
  document.getElementById('taskModalTitle').textContent = existingTask ? t('editTaskTitle') : t('newTaskTitle');
  document.getElementById('deleteTaskBtn').style.display = existingTask ? 'block' : 'none';
  document.getElementById('taskFormError').textContent = '';
  document.getElementById('taskTitleInput').value = existingTask ? existingTask.title : '';
  document.getElementById('taskNotesInput').value = existingTask ? existingTask.notes || '' : '';
  document.getElementById('taskDueDate').value = existingTask ? existingTask.dueDate || '' : (prefillDate || '');
  document.getElementById('taskDueTime').value = existingTask ? existingTask.dueTime || '' : '';
  formPriority = existingTask ? existingTask.priority || null : null;
  formTags = existingTask ? [...(existingTask.tags || [])] : [];
  formSubtasks = existingTask ? (existingTask.subtasks || []).map((s) => ({ ...s })) : [];
  renderPriorityPicker();
  renderTagsInput();
  renderSubtasksEditor();
  document.getElementById('taskFormOverlay').classList.add('show');
  setTimeout(() => document.getElementById('taskTitleInput').focus(), 50);
}
document.getElementById('closeTaskForm').addEventListener('click', () => {
  document.getElementById('taskFormOverlay').classList.remove('show');
});
document.getElementById('taskFormOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'taskFormOverlay') e.currentTarget.classList.remove('show');
});

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskTitleInput').value.trim();
  const errorEl = document.getElementById('taskFormError');
  if (!title) {
    errorEl.textContent = t('titleRequiredError');
    return;
  }
  errorEl.textContent = '';
  const uidCur = auth.currentUser && auth.currentUser.uid;
  if (!uidCur) return;

  const dueDate = document.getElementById('taskDueDate').value || null;
  const dueTime = document.getElementById('taskDueTime').value || null;

  const cleanSubtasks = formSubtasks
    .map((s) => ({ id: s.id, title: (s.title || '').trim(), done: !!s.done }))
    .filter((s) => s.title);

  const payload = {
    title, notes: document.getElementById('taskNotesInput').value.trim(),
    dueDate, dueTime, priority: formPriority, tags: formTags,
    subtasks: cleanSubtasks,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const submitBtn = document.getElementById('taskSubmitBtn');
  submitBtn.disabled = true;
  try {
    const col = db.collection('users').doc(uidCur).collection('tasks');
    if (editingTaskId) {
      await col.doc(editingTaskId).update(payload);
    } else {
      await col.add({ ...payload, done: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    document.getElementById('taskFormOverlay').classList.remove('show');
  } catch (err) {
    console.error('save task:', err);
    errorEl.textContent = t('err_generic');
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById('deleteTaskBtn').addEventListener('click', () => {
  if (!editingTaskId) return;
  pendingDeleteId = editingTaskId;
  document.getElementById('taskFormOverlay').classList.remove('show');
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
    await db.collection('users').doc(auth.currentUser.uid).collection('tasks').doc(pendingDeleteId).delete();
  } catch (err) {
    console.error('delete task:', err);
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
        renderLangPicker();
        renderAuthLangRow();
      }
    }).catch(() => {});
    subscribeToTasks(user.uid);
  } else {
    if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
    tasks = [];
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
applyTheme();
applyTranslations();
renderThemePicker();
renderLangPicker();
renderAuthLangRow();
renderPriorityPicker();
setAuthMode('login');
