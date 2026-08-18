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
// Ті самі мови й ключі localStorage, що й у budget/app.js та home.js —
// вибір мови/теми лишається синхронізованим по всьому сайту.
const LANGS = ['uk', 'ru', 'pl', 'en'];
const LANG_NAMES = { uk: 'UA', ru: 'RU', pl: 'PL', en: 'EN' };
const LOCALE_MAP = { uk: 'uk-UA', ru: 'ru-RU', pl: 'pl-PL', en: 'en-US' };

const T = {
  uk: {
    pageTitle: 'Завдання',
    noDateLabel: 'Без дати',
    dayViewEmptyTitle: 'На цю дату завдань немає', dayViewEmptySub: 'Додай завдання кнопкою внизу.',
    dayViewFabLabel: 'Нове завдання',
    completedLabel: (n) => `Виконано (${n})`,
    newTaskTitle: 'Нове завдання', editTaskTitle: 'Редагувати завдання',
    titlePlaceholder: 'Назва завдання',
    notesLabel: 'Нотатка', notesPlaceholder: 'Додаткові деталі (необовʼязково)',
    dueDateLabel: 'Дата', dueTimeLabel: 'Час', dpTodayBtn: 'Сьогодні',
    priorityNone: 'Немає', priorityLow: 'Низький', priorityMedium: 'Середній', priorityHigh: 'Високий',
    recurrenceLabel: 'Повторювати',
    recurNever: 'Ніколи', recurDaily: 'Щодня', recurWeekly: 'Щотижня', recurMonthly: 'Щомісяця',
    recurEveryDays: 'Кожні … днів:', recurEveryMonths: 'Кожні … місяців:',
    recurAnchorCompletion: 'Рахувати від дня виконання, а не від плану',
    recurShortDaily: (n) => (n === 1 ? 'Щодня' : `Кожні ${n} дн.`),
    recurShortMonthly: (n, day) => (n === 1 ? `${day} числа` : `Кожні ${n} міс.`),
    nowTitle: 'Зараз', nowSkip: 'Далі',
    nowNothingToday: 'На сьогодні завдань немає. Додай перше — або візьми щось із того, що без дати.',
    nowAllDone: 'Усе на сьогодні зроблено. Можна видихнути 🎉',
    nowOverdueBadge: 'Прострочено',
    nowProgress: (done, total) => `Сьогодні: ${done}/${total}`,
    nowRemaining: (time) => `лишилось роботи ~${time}`,
    nowFree: (time) => `вільного часу ~${time}`,
    nowOverloaded: 'Заплановано більше, ніж лишилось часу сьогодні',
    nowOverdueCount: (n) => `Прострочено: ${n}`,
    priorityLabel: 'Пріоритет',
    tagsLabel: 'Теги', tagPlaceholder: 'Додати тег', removeTagAria: 'Прибрати тег',
    subtasksLabel: 'Підзадачі', subtaskPlaceholder: 'Наступний крок',
    addSubtaskBtn: '+ Додати підзадачу', removeSubtaskAria: 'Прибрати підзадачу',
    estimateLabel: 'Скільки часу займе', estimatePlaceholder: 'хв',
    estimateShort: (min) => (min >= 60 ? `~${Math.floor(min / 60)} год${min % 60 ? ' ' + (min % 60) + ' хв' : ''}` : `~${min} хв`),
    quickAddFabLabel: 'Додати', quickAddTitle: 'Швидке додавання',
    quickAddPlaceholder: 'Купити молоко завтра о 18',
    quickAddHint: 'Дату, час, #тег, ~тривалість і пріоритет (!1 !2 !3) можна писати прямо в рядку.',
    quickAddSubmit: 'Додати', quickAddDetails: 'Деталі…',
    quickAddNothing: 'Нічого не розпізнано — напиши хоча б назву',
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
    pageTitle: 'Задачи',
    noDateLabel: 'Без даты',
    dayViewEmptyTitle: 'На эту дату задач нет', dayViewEmptySub: 'Добавь задачу кнопкой внизу.',
    dayViewFabLabel: 'Новая задача',
    completedLabel: (n) => `Выполнено (${n})`,
    newTaskTitle: 'Новая задача', editTaskTitle: 'Редактировать задачу',
    titlePlaceholder: 'Название задачи',
    notesLabel: 'Заметка', notesPlaceholder: 'Дополнительные детали (необязательно)',
    dueDateLabel: 'Дата', dueTimeLabel: 'Время', dpTodayBtn: 'Сегодня',
    priorityNone: 'Нет', priorityLow: 'Низкий', priorityMedium: 'Средний', priorityHigh: 'Высокий',
    recurrenceLabel: 'Повторять',
    recurNever: 'Никогда', recurDaily: 'Ежедневно', recurWeekly: 'Еженедельно', recurMonthly: 'Ежемесячно',
    recurEveryDays: 'Каждые … дней:', recurEveryMonths: 'Каждые … месяцев:',
    recurAnchorCompletion: 'Считать от дня выполнения, а не от плана',
    recurShortDaily: (n) => (n === 1 ? 'Ежедневно' : `Каждые ${n} дн.`),
    recurShortMonthly: (n, day) => (n === 1 ? `${day} числа` : `Каждые ${n} мес.`),
    nowTitle: 'Сейчас', nowSkip: 'Дальше',
    nowNothingToday: 'На сегодня задач нет. Добавь первую — или возьми что-то из того, что без даты.',
    nowAllDone: 'Всё на сегодня сделано. Можно выдохнуть 🎉',
    nowOverdueBadge: 'Просрочено',
    nowProgress: (done, total) => `Сегодня: ${done}/${total}`,
    nowRemaining: (time) => `осталось работы ~${time}`,
    nowFree: (time) => `свободного времени ~${time}`,
    nowOverloaded: 'Запланировано больше, чем осталось времени сегодня',
    nowOverdueCount: (n) => `Просрочено: ${n}`,
    priorityLabel: 'Приоритет',
    tagsLabel: 'Теги', tagPlaceholder: 'Добавить тег', removeTagAria: 'Убрать тег',
    subtasksLabel: 'Подзадачи', subtaskPlaceholder: 'Следующий шаг',
    addSubtaskBtn: '+ Добавить подзадачу', removeSubtaskAria: 'Убрать подзадачу',
    estimateLabel: 'Сколько времени займёт', estimatePlaceholder: 'мин',
    estimateShort: (min) => (min >= 60 ? `~${Math.floor(min / 60)} ч${min % 60 ? ' ' + (min % 60) + ' мин' : ''}` : `~${min} мин`),
    quickAddFabLabel: 'Добавить', quickAddTitle: 'Быстрое добавление',
    quickAddPlaceholder: 'Купить молоко завтра в 18',
    quickAddHint: 'Дату, время, #тег, ~длительность и приоритет (!1 !2 !3) можно писать прямо в строке.',
    quickAddSubmit: 'Добавить', quickAddDetails: 'Детали…',
    quickAddNothing: 'Ничего не распознано — напиши хотя бы название',
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
    pageTitle: 'Zadania',
    noDateLabel: 'Bez daty',
    dayViewEmptyTitle: 'Na ten dzień nie ma zadań', dayViewEmptySub: 'Dodaj zadanie przyciskiem poniżej.',
    dayViewFabLabel: 'Nowe zadanie',
    completedLabel: (n) => `Ukończono (${n})`,
    newTaskTitle: 'Nowe zadanie', editTaskTitle: 'Edytuj zadanie',
    titlePlaceholder: 'Nazwa zadania',
    notesLabel: 'Notatka', notesPlaceholder: 'Dodatkowe szczegóły (opcjonalnie)',
    dueDateLabel: 'Data', dueTimeLabel: 'Godzina', dpTodayBtn: 'Dzisiaj',
    priorityNone: 'Brak', priorityLow: 'Niski', priorityMedium: 'Średni', priorityHigh: 'Wysoki',
    recurrenceLabel: 'Powtarzaj',
    recurNever: 'Nigdy', recurDaily: 'Codziennie', recurWeekly: 'Co tydzień', recurMonthly: 'Co miesiąc',
    recurEveryDays: 'Co … dni:', recurEveryMonths: 'Co … miesięcy:',
    recurAnchorCompletion: 'Licz od dnia wykonania, nie od planu',
    recurShortDaily: (n) => (n === 1 ? 'Codziennie' : `Co ${n} dni`),
    recurShortMonthly: (n, day) => (n === 1 ? `${day}. dnia` : `Co ${n} mies.`),
    nowTitle: 'Teraz', nowSkip: 'Dalej',
    nowNothingToday: 'Na dziś nie ma zadań. Dodaj pierwsze — albo weź coś bez daty.',
    nowAllDone: 'Wszystko na dziś zrobione. Można odetchnąć 🎉',
    nowOverdueBadge: 'Zaległe',
    nowProgress: (done, total) => `Dziś: ${done}/${total}`,
    nowRemaining: (time) => `zostało pracy ~${time}`,
    nowFree: (time) => `wolnego czasu ~${time}`,
    nowOverloaded: 'Zaplanowano więcej, niż zostało dziś czasu',
    nowOverdueCount: (n) => `Zaległe: ${n}`,
    priorityLabel: 'Priorytet',
    tagsLabel: 'Tagi', tagPlaceholder: 'Dodaj tag', removeTagAria: 'Usuń tag',
    subtasksLabel: 'Podzadania', subtaskPlaceholder: 'Następny krok',
    addSubtaskBtn: '+ Dodaj podzadanie', removeSubtaskAria: 'Usuń podzadanie',
    estimateLabel: 'Ile czasu zajmie', estimatePlaceholder: 'min',
    estimateShort: (min) => (min >= 60 ? `~${Math.floor(min / 60)} godz${min % 60 ? ' ' + (min % 60) + ' min' : ''}` : `~${min} min`),
    quickAddFabLabel: 'Dodaj', quickAddTitle: 'Szybkie dodawanie',
    quickAddPlaceholder: 'Kupić mleko jutro o 18',
    quickAddHint: 'Datę, godzinę, #tag, ~czas trwania i priorytet (!1 !2 !3) możesz wpisać w tej samej linii.',
    quickAddSubmit: 'Dodaj', quickAddDetails: 'Szczegóły…',
    quickAddNothing: 'Nic nie rozpoznano — wpisz przynajmniej nazwę',
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
    pageTitle: 'Tasks',
    noDateLabel: 'No date',
    dayViewEmptyTitle: 'No tasks for this date', dayViewEmptySub: 'Add a task with the button below.',
    dayViewFabLabel: 'New task',
    completedLabel: (n) => `Completed (${n})`,
    newTaskTitle: 'New task', editTaskTitle: 'Edit task',
    titlePlaceholder: 'Task title',
    notesLabel: 'Notes', notesPlaceholder: 'Extra details (optional)',
    dueDateLabel: 'Date', dueTimeLabel: 'Time', dpTodayBtn: 'Today',
    priorityNone: 'None', priorityLow: 'Low', priorityMedium: 'Medium', priorityHigh: 'High',
    recurrenceLabel: 'Repeat',
    recurNever: 'Never', recurDaily: 'Daily', recurWeekly: 'Weekly', recurMonthly: 'Monthly',
    recurEveryDays: 'Every … days:', recurEveryMonths: 'Every … months:',
    recurAnchorCompletion: 'Count from the day it is done, not from the plan',
    recurShortDaily: (n) => (n === 1 ? 'Daily' : `Every ${n} days`),
    recurShortMonthly: (n, day) => (n === 1 ? `On the ${day}th` : `Every ${n} months`),
    nowTitle: 'Now', nowSkip: 'Next',
    nowNothingToday: 'Nothing scheduled for today. Add something — or pick one of the undated tasks.',
    nowAllDone: 'Everything for today is done. Take a breath 🎉',
    nowOverdueBadge: 'Overdue',
    nowProgress: (done, total) => `Today: ${done}/${total}`,
    nowRemaining: (time) => `~${time} of work left`,
    nowFree: (time) => `~${time} free`,
    nowOverloaded: 'You planned more than the time left today',
    nowOverdueCount: (n) => `Overdue: ${n}`,
    priorityLabel: 'Priority',
    tagsLabel: 'Tags', tagPlaceholder: 'Add a tag', removeTagAria: 'Remove tag',
    subtasksLabel: 'Subtasks', subtaskPlaceholder: 'Next step',
    addSubtaskBtn: '+ Add subtask', removeSubtaskAria: 'Remove subtask',
    estimateLabel: 'How long will it take', estimatePlaceholder: 'min',
    estimateShort: (min) => (min >= 60 ? `~${Math.floor(min / 60)}h${min % 60 ? ' ' + (min % 60) + 'm' : ''}` : `~${min}m`),
    quickAddFabLabel: 'Add', quickAddTitle: 'Quick add',
    quickAddPlaceholder: 'Buy milk tomorrow at 6pm',
    quickAddHint: 'Date, time, #tag, ~duration and priority (!1 !2 !3) can go right in the line.',
    quickAddSubmit: 'Add', quickAddDetails: 'Details…',
    quickAddNothing: 'Nothing recognised — type at least a title',
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
  renderCurrentScreen();
}

// ---- Переклад статичних елементів ----
function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  document.title = `${t('pageTitle')} · Life`;
  document.getElementById('dayViewFabLabel').textContent = t('dayViewFabLabel');
  document.getElementById('notesLabel').textContent = t('notesLabel');
  document.getElementById('taskNotesInput').placeholder = t('notesPlaceholder');
  document.getElementById('dueDateLabel').textContent = t('dueDateLabel');
  document.getElementById('dueTimeLabel').textContent = t('dueTimeLabel');
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
  document.getElementById('nowTitle').textContent = t('nowTitle');
  document.getElementById('quickAddFabLabel').textContent = t('quickAddFabLabel');
  document.getElementById('quickAddTitle').textContent = t('quickAddTitle');
  document.getElementById('quickAddInput').placeholder = t('quickAddPlaceholder');
  document.getElementById('quickAddHint').textContent = t('quickAddHint');
  document.getElementById('quickAddSubmitBtn').textContent = t('quickAddSubmit');
  document.getElementById('quickAddDetailsBtn').textContent = t('quickAddDetails');
  document.getElementById('priorityLabel').textContent = t('priorityLabel');
  document.getElementById('estimateLabel').textContent = t('estimateLabel');
  document.getElementById('taskEstimateInput').placeholder = t('estimatePlaceholder');
  document.getElementById('tagsLabel').textContent = t('tagsLabel');
  document.getElementById('taskTagInput').placeholder = t('tagPlaceholder');
  document.getElementById('recurrenceLabel').textContent = t('recurrenceLabel');
  document.getElementById('subtasksLabel').textContent = t('subtasksLabel');
  document.getElementById('addSubtaskBtn').textContent = t('addSubtaskBtn');
  setAuthMode(authMode);
  refreshDatePickersLang();
}

// ---- Пріоритет: використовується для відображення чипа на картці
// існуючого завдання (форма вибору пріоритету прибрана) ----
function priorityLabel(p) {
  return p === 'low' ? t('priorityLow') : p === 'medium' ? t('priorityMedium') : p === 'high' ? t('priorityHigh') : t('priorityNone');
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
// Парсить "YYYY-MM-DD" як ЛОКАЛЬНУ дату (без часу) — на відміну від
// `new Date("YYYY-MM-DD")`, який трактує рядок як UTC-північ і в поясах
// з від'ємним зсувом зсуває дату на день назад.
function parseISODate(s) {
  if (!s) return new Date(NaN);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
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
let selectedTags = new Set();
let editingTaskId = null;
let formPriority = null;
let formTags = [];
let formSubtasks = [];
let formEstimate = null;
let formRecurrence = null; // { type, interval, weekdays, day, anchor } або null
let quickAddDate = null;
let pendingDeleteId = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let calViewMode = 'month'; // 'month' | 'year'
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
  if (task.estimateMin) metaParts.push(`<span class="task-progress">${escapeHtml(t('estimateShort', task.estimateMin))}</span>`);
  if (task.recurrence) metaParts.push(`<span class="task-progress">\u21BB ${escapeHtml(recurrenceShortLabel(task.recurrence))}</span>`);
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
  if (calViewMode === 'year') return String(calYear);
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(calYear, calMonth, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function monthShortLabels() {
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const fmt = new Intl.DateTimeFormat(locale, { month: 'long' });
  const labels = [];
  for (let m = 0; m < 12; m++) {
    const label = fmt.format(new Date(2024, m, 1));
    labels.push(label.charAt(0).toUpperCase() + label.slice(1));
  }
  return labels;
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

// ---- Кастомний datepicker ----
// Замінює нативний календар браузера (input type=date) на панель у стилі
// застосунку. Нативний <input> лишається в DOM (прихований, але функціональний)
// — увесь існуючий код (`taskDueDate.value = ...`) працює без змін: сеттер
// `.value` перехоплено, щоб кастомний UI оновлювався синхронно з будь-яким
// записом у нативний інпут. Місяці/дні тижня — через Intl (як і решта
// календаря в цьому модулі), без ручних словників перекладу.
const datePickerInstances = [];
function initDatePicker(nativeId) {
  const native = document.getElementById(nativeId);
  if (!native || native.dataset.dpInit) return;
  native.dataset.dpInit = '1';
  const clearable = native.hasAttribute('data-dp-clearable');

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
    '<div class="dp-foot"><button type="button" class="dp-today-btn"></button>' +
      (clearable ? '<button type="button" class="dp-clear-btn"></button>' : '') +
    '</div>';
  // Панель монтуємо в <body>, а не всередину .dp-field: .modal має
  // backdrop-filter (створює containing block для position:fixed) і
  // overflow-y:auto (обрізало б випадаючий календар знизу).
  document.body.appendChild(panel);

  const triggerText = trigger.querySelector('.dp-trigger-text');
  const headLabel = panel.querySelector('.dp-head-label');
  const weekdaysEl = panel.querySelector('.dp-weekdays');
  const daysEl = panel.querySelector('.dp-days');
  const todayBtn = panel.querySelector('.dp-today-btn');
  const clearBtn = panel.querySelector('.dp-clear-btn');
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
      triggerText.textContent = t('noDateLabel');
      triggerText.classList.add('dp-placeholder');
      return;
    }
    const locale = LOCALE_MAP[currentLang] || 'uk-UA';
    // Компактний числовий формат (напр. "20.08.2026") — поле дати тут вузьке
    // (половина .field-row поруч із часом), і повний текстовий місяць
    // ("20 серпня 2026") в деяких локалях/розмірах екрана не влазить.
    triggerText.textContent = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(sel);
    triggerText.classList.remove('dp-placeholder');
  }

  function renderPanel() {
    const locale = LOCALE_MAP[currentLang] || 'uk-UA';
    const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1));
    headLabel.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    weekdaysEl.innerHTML = weekdayShortLabels().map((w) => '<div class="dp-weekday">' + escapeHtml(w) + '</div>').join('');
    todayBtn.textContent = t('dpTodayBtn');
    if (clearBtn) clearBtn.textContent = t('noDateLabel');

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
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      native.value = '';
      close();
    });
  }

  // Перехоплюємо .value, щоб `nativeInput.value = '...'` (як і надалі робить
  // решта коду застосунку) синхронно оновлювало кастомний UI.
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

function renderCalendar() {
  renderNowCard();
  document.getElementById('calMonthLabel').textContent = calMonthLabelText();
  if (calViewMode === 'year') {
    renderYearGrid();
    return;
  }
  renderMonthGrid();
}

function renderYearGrid() {
  const gridEl = document.getElementById('calendarGrid');
  gridEl.classList.add('cal-year-grid');
  gridEl.classList.remove('cal-grid');
  document.getElementById('calWeekdays').innerHTML = '';
  document.getElementById('tagFilterRow').innerHTML = '';
  document.getElementById('noDateSection').innerHTML = '';

  const today = new Date();
  const labels = monthShortLabels();
  const filtered = tasks.filter(matchesFilters);
  const countByMonth = new Array(12).fill(0);
  filtered.forEach((tsk) => {
    if (!tsk.dueDate) return;
    const [y, m] = tsk.dueDate.split('-').map(Number);
    if (y === calYear) countByMonth[m - 1] += 1;
  });

  let html = '';
  for (let m = 0; m < 12; m++) {
    const isCurrentMonth = calYear === today.getFullYear() && m === today.getMonth();
    const count = countByMonth[m];
    html += `
      <div class="cal-month-tile${isCurrentMonth ? ' today' : ''}" data-cal-month="${m}">
        <div class="cal-month-tile-name">${escapeHtml(labels[m])}</div>
        ${count ? `<div class="cal-month-tile-count">${count}</div>` : ''}
      </div>`;
  }
  gridEl.innerHTML = html;

  gridEl.querySelectorAll('[data-cal-month]').forEach((tile) => {
    tile.addEventListener('click', () => {
      calMonth = Number(tile.dataset.calMonth);
      calViewMode = 'month';
      renderCalendar();
    });
  });
}

function renderMonthGrid() {
  const gridEl = document.getElementById('calendarGrid');
  gridEl.classList.add('cal-grid');
  gridEl.classList.remove('cal-year-grid');
  renderTagFilterRow();
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


// ---- Картка «Зараз» ----
// Календар відповідає на «які в мене завдання», ця картка — на «що робити
// прямо зараз»: одна наступна дія плюс чесний підсумок дня. Порядок і
// підрахунки живуть у tasks/now-queue.js (чисті функції, покриті тестами).
let nowIndex = 0;      // на скільки кроків уперед людина «перегорнула» чергу
let nowClockTimer = null;

function formatMinutes(min) {
  return t('estimateShort', min).replace(/^~/, '');
}

function renderNowCard() {
  const bodyEl = document.getElementById('nowBody');
  const footEl = document.getElementById('nowFoot');
  if (!bodyEl) return;

  const now = new Date();
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  document.getElementById('nowClock').textContent =
    new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(now);

  const queue = nowQueue(tasks, { now });
  const summary = daySummary(tasks, { now });

  if (!queue.length) {
    nowIndex = 0;
    // Порожньо буває з двох причин, і це різні новини для людини.
    const message = summary.totalCount > 0 ? t('nowAllDone') : t('nowNothingToday');
    bodyEl.innerHTML = `<div class="now-empty">${escapeHtml(message)}</div>`;
  } else {
    if (nowIndex >= queue.length) nowIndex = 0;
    const task = queue[nowIndex];
    const isOverdue = task.dueDate && task.dueDate < todayISO();
    const meta = [];
    if (isOverdue) meta.push(`<span class="task-time overdue">${escapeHtml(t('nowOverdueBadge'))}</span>`);
    if (task.dueTime) meta.push(`<span class="task-time">${escapeHtml(task.dueTime)}</span>`);
    if (task.priority) meta.push(`<span class="priority-chip ${task.priority}">${escapeHtml(priorityLabel(task.priority))}</span>`);
    if (task.estimateMin) meta.push(`<span class="task-progress">${escapeHtml(t('estimateShort', task.estimateMin))}</span>`);
    if (task.recurrence) meta.push(`<span class="task-progress">\u21BB ${escapeHtml(recurrenceShortLabel(task.recurrence))}</span>`);
    if (!task.dueDate) meta.push(`<span class="task-progress">${escapeHtml(t('noDateLabel'))}</span>`);

    bodyEl.innerHTML = `
      <div class="now-next">
        <button type="button" class="task-check${task.priority ? ' priority-' + task.priority : ''}" data-now-done="${task.id}" aria-label="done">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
        <div class="now-body" data-now-open="${task.id}">
          <div class="now-name">${escapeHtml(task.title)}</div>
          ${meta.length ? `<div class="now-meta">${meta.join('')}</div>` : ''}
        </div>
        ${queue.length > 1 ? `<button type="button" class="now-skip" id="nowSkipBtn">${escapeHtml(t('nowSkip'))}</button>` : ''}
      </div>`;

    bodyEl.querySelector('[data-now-done]').addEventListener('click', (e) => {
      e.stopPropagation();
      // Після виконання показуємо наступне з початку черги, а не там,
      // де людина зупинилась, гортаючи.
      nowIndex = 0;
      toggleDone(task.id);
    });
    bodyEl.querySelector('[data-now-open]').addEventListener('click', () => openTaskForm(task));
    const skipBtn = bodyEl.querySelector('#nowSkipBtn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        nowIndex = (nowIndex + 1) % queue.length;
        renderNowCard();
      });
    }
  }

  const parts = [];
  if (summary.totalCount) parts.push(`<span>${escapeHtml(t('nowProgress', summary.doneCount, summary.totalCount))}</span>`);
  if (summary.remainingMin) parts.push(`<span>${escapeHtml(t('nowRemaining', formatMinutes(summary.remainingMin)))}</span>`);
  else if (summary.totalCount > summary.doneCount) parts.push(`<span>${escapeHtml(t('nowFree', formatMinutes(summary.freeMin)))}</span>`);
  if (summary.overdueCount) parts.push(`<span class="now-overdue">${escapeHtml(t('nowOverdueCount', summary.overdueCount))}</span>`);
  if (summary.overloaded) parts.push(`<span class="now-warn">${escapeHtml(t('nowOverloaded'))}</span>`);
  footEl.innerHTML = parts.join('');
}

// Черга залежить від поточного часу (завдання «о 15:00» о 15:01 змінює групу),
// тож раз на хвилину перемальовуємо картку — і заразом годинник у ній.
function startNowClock() {
  if (nowClockTimer) clearInterval(nowClockTimer);
  nowClockTimer = setInterval(() => {
    if (currentScreen === 'calendar') renderNowCard();
  }, 60000);
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
  openQuickAdd(dayViewDate);
});

function toggleDone(id) {
  const task = tasks.find((tsk) => tsk.id === id);
  if (!task || !auth.currentUser) return;
  const done = !task.done;
  const col = db.collection('users').doc(auth.currentUser.uid).collection('tasks');
  col.doc(id).update({
    done,
    // Без часу виконання неможливі ні історія, ні статистика — і відновити
    // його заднім числом уже не вийде, тож пишемо одразу.
    completedAt: done ? firebase.firestore.FieldValue.serverTimestamp() : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('toggleDone:', err));

  // Виконане повторюване завдання лишається в історії як виконане, а наступне
  // створюється окремим документом — інакше статистика бачила б одну задачу
  // замість двадцяти зроблених прибирань. Знята галочка наступне НЕ видаляє:
  // мовчки прибирати вже створене завдання було б несподівано.
  if (done && task.recurrence) {
    const nextDate = nextOccurrence(task.recurrence, { dueDate: task.dueDate, today: todayISO() });
    if (nextDate) {
      col.add({
        title: task.title,
        notes: task.notes || '',
        done: false,
        completedAt: null,
        priority: task.priority || null,
        tags: task.tags || [],
        dueDate: nextDate,
        dueTime: task.dueTime || null,
        estimateMin: task.estimateMin || null,
        recurrence: task.recurrence,
        // Підзадачі переносяться невиконаними — наступного разу їх робити знову.
        subtasks: (task.subtasks || []).map((sub) => ({ ...sub, done: false })),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch((err) => console.error('recurring next:', err));
    }
  }
}

// ---- Навігація календаря ----
document.getElementById('calPrevBtn').addEventListener('click', () => {
  if (calViewMode === 'year') {
    calYear -= 1;
  } else {
    calMonth -= 1;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
  }
  renderCalendar();
});
document.getElementById('calNextBtn').addEventListener('click', () => {
  if (calViewMode === 'year') {
    calYear += 1;
  } else {
    calMonth += 1;
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
  }
  renderCalendar();
});
document.getElementById('calMonthLabel').addEventListener('click', () => {
  calViewMode = calViewMode === 'year' ? 'month' : 'year';
  renderCalendar();
});


// ---- Редактори полів завдання ----
// Пріоритет, теги й підзадачі зберігались у документі, але редагувати їх у
// формі було нічим — значення можна було лише успадкувати від старого завдання.
function renderPriorityPicker() {
  const picker = document.getElementById('taskPriorityPicker');
  const options = [
    { value: null, label: t('priorityNone') },
    { value: 'low', label: t('priorityLow') },
    { value: 'medium', label: t('priorityMedium') },
    { value: 'high', label: t('priorityHigh') },
  ];
  picker.innerHTML = options.map((o) => `
    <button type="button" class="priority-choice${o.value === formPriority ? ' selected' : ''}"
      data-priority="${o.value || ''}">${escapeHtml(o.label)}</button>`).join('');
  picker.querySelectorAll('[data-priority]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formPriority = btn.dataset.priority || null;
      renderPriorityPicker();
    });
  });
}

function renderTagsEditor() {
  const editor = document.getElementById('taskTagsEditor');
  editor.innerHTML = formTags.map((tag) => `
    <span class="tag-edit-chip">${escapeHtml(tag)}<button type="button" data-remove-tag="${escapeHtml(tag)}" aria-label="${escapeHtml(t('removeTagAria'))}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button></span>`).join('');
  editor.querySelectorAll('[data-remove-tag]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formTags = formTags.filter((tag) => tag !== btn.dataset.removeTag);
      renderTagsEditor();
    });
  });
}

function addTagFromInput() {
  const input = document.getElementById('taskTagInput');
  const raw = input.value.trim().replace(/^#/, '');
  if (!raw) return;
  if (formTags.length >= 20) { input.value = ''; return; } // стеля з firestore.rules
  if (!formTags.some((tag) => tag.toLowerCase() === raw.toLowerCase())) formTags.push(raw);
  input.value = '';
  renderTagsEditor();
}

function renderSubtasksEditor() {
  const editor = document.getElementById('taskSubtasksEditor');
  editor.innerHTML = formSubtasks.map((sub, i) => `
    <div class="subtask-row" data-idx="${i}">
      <button type="button" class="subtask-check${sub.done ? ' checked' : ''}" data-toggle-sub="${i}" aria-label="done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </button>
      <input type="text" value="${escapeHtml(sub.title)}" data-sub-title="${i}" maxlength="200" placeholder="${escapeHtml(t('subtaskPlaceholder'))}">
      <button type="button" class="subtask-remove" data-remove-sub="${i}" aria-label="${escapeHtml(t('removeSubtaskAria'))}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
  editor.querySelectorAll('[data-toggle-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sub = formSubtasks[Number(btn.dataset.toggleSub)];
      sub.done = !sub.done;
      renderSubtasksEditor();
    });
  });
  editor.querySelectorAll('[data-sub-title]').forEach((input) => {
    // Пишемо в стан на кожен ввід, без перемальовування — інакше поле
    // втрачало б фокус після кожної набраної літери.
    input.addEventListener('input', () => { formSubtasks[Number(input.dataset.subTitle)].title = input.value; });
  });
  editor.querySelectorAll('[data-remove-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formSubtasks.splice(Number(btn.dataset.removeSub), 1);
      renderSubtasksEditor();
    });
  });
}

function addEmptySubtask() {
  if (formSubtasks.length >= 50) return; // стеля з firestore.rules
  formSubtasks.push({ id: uid4(), title: '', done: false });
  renderSubtasksEditor();
  const inputs = document.querySelectorAll('#taskSubtasksEditor [data-sub-title]');
  if (inputs.length) inputs[inputs.length - 1].focus();
}


// ---- Редактор повторення ----
// Наперед серія не створюється: наступне завдання з'являється в момент
// виконання поточного (див. toggleDone) — обчислення дати в tasks/recurrence.js.
function renderRecurrencePicker() {
  const picker = document.getElementById('taskRecurrencePicker');
  const options = [
    { value: null, label: t('recurNever') },
    { value: 'daily', label: t('recurDaily') },
    { value: 'weekly', label: t('recurWeekly') },
    { value: 'monthly', label: t('recurMonthly') },
  ];
  const current = formRecurrence ? formRecurrence.type : null;
  picker.innerHTML = options.map((o) => `
    <button type="button" class="priority-choice${o.value === current ? ' selected' : ''}"
      data-recur="${o.value || ''}">${escapeHtml(o.label)}</button>`).join('');
  picker.querySelectorAll('[data-recur]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.recur || null;
      if (!type) {
        formRecurrence = null;
      } else {
        const dueDate = document.getElementById('taskDueDate').value;
        const base = dueDate ? parseISODate(dueDate) : new Date();
        formRecurrence = {
          type,
          interval: 1,
          // За замовчуванням повторюємо в той самий день тижня / того ж числа,
          // що й саме завдання — це майже завжди те, що людина мала на увазі.
          weekdays: type === 'weekly' ? [base.getDay() === 0 ? 7 : base.getDay()] : [],
          day: type === 'monthly' ? base.getDate() : null,
          anchor: formRecurrence ? formRecurrence.anchor : 'schedule',
        };
      }
      renderRecurrencePicker();
      renderRecurrenceOptions();
    });
  });
}

function renderRecurrenceOptions() {
  const box = document.getElementById('recurrenceOptions');
  if (!formRecurrence) { box.innerHTML = ''; return; }
  const r = formRecurrence;
  let html = '';

  if (r.type === 'daily' || r.type === 'monthly') {
    const label = r.type === 'daily' ? t('recurEveryDays') : t('recurEveryMonths');
    html += `<div class="recur-interval"><span>${escapeHtml(label)}</span>
      <input type="number" id="recurIntervalInput" min="1" max="365" step="1" inputmode="numeric" value="${r.interval}"></div>`;
  }
  if (r.type === 'weekly') {
    html += `<div class="recur-weekdays">${weekdayShortLabels().map((w, i) => {
      const day = i + 1; // понеділок = 1
      return `<button type="button" class="recur-weekday${r.weekdays.indexOf(day) !== -1 ? ' selected' : ''}"
        data-weekday="${day}">${escapeHtml(w)}</button>`;
    }).join('')}</div>`;
  }
  html += `<label class="recur-anchor"><input type="checkbox" id="recurAnchorInput"${r.anchor === 'completion' ? ' checked' : ''}>
    <span>${escapeHtml(t('recurAnchorCompletion'))}</span></label>`;
  box.innerHTML = html;

  const intervalInput = box.querySelector('#recurIntervalInput');
  if (intervalInput) {
    intervalInput.addEventListener('input', () => {
      const n = parseInt(intervalInput.value, 10);
      formRecurrence.interval = Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 1;
    });
  }
  box.querySelectorAll('[data-weekday]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const day = Number(btn.dataset.weekday);
      const idx = formRecurrence.weekdays.indexOf(day);
      if (idx === -1) formRecurrence.weekdays.push(day);
      else formRecurrence.weekdays.splice(idx, 1);
      // Порожній перелік означав би «невідомо коли» — лишаємо хоча б один день.
      if (!formRecurrence.weekdays.length) formRecurrence.weekdays.push(day);
      formRecurrence.weekdays.sort();
      renderRecurrenceOptions();
    });
  });
  const anchorInput = box.querySelector('#recurAnchorInput');
  if (anchorInput) {
    anchorInput.addEventListener('change', () => {
      formRecurrence.anchor = anchorInput.checked ? 'completion' : 'schedule';
    });
  }
}

// Короткий підпис правила для картки завдання: «Щодня», «Пн/Ср/Пт», «1 числа».
function recurrenceShortLabel(rule) {
  const r = normalizeRecurrence(rule);
  if (!r) return '';
  if (r.type === 'daily') return t('recurShortDaily', r.interval);
  if (r.type === 'monthly') return t('recurShortMonthly', r.interval, r.day || 1);
  const names = weekdayShortLabels();
  return (r.weekdays.length ? r.weekdays : [1]).map((d) => names[d - 1]).join('/');
}

// ---- Форма завдання ----
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
  formEstimate = existingTask ? existingTask.estimateMin || null : null;
  formRecurrence = existingTask && existingTask.recurrence ? { ...existingTask.recurrence } : null;
  document.getElementById('taskEstimateInput').value = formEstimate || '';
  document.getElementById('taskTagInput').value = '';
  renderPriorityPicker();
  renderRecurrencePicker();
  renderRecurrenceOptions();
  renderTagsEditor();
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

  const estimateRaw = parseInt(document.getElementById('taskEstimateInput').value, 10);
  const estimateMin = Number.isFinite(estimateRaw) && estimateRaw > 0 ? Math.min(estimateRaw, 1440) : null;

  const payload = {
    title, notes: document.getElementById('taskNotesInput').value.trim(),
    dueDate, dueTime, priority: formPriority, tags: formTags,
    estimateMin,
    recurrence: formRecurrence,
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
      await col.add({ ...payload, done: false, completedAt: null, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
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


// ---- Швидке додавання ----
// Один рядок замість форми з семи полів: розбір робить parseQuickTask
// (tasks/quick-parse.js) — локально, без мережі й без AI. Що саме розпізналось,
// показуємо чипами під полем, щоб людина бачила результат ДО збереження.
function formatEstimate(min) {
  return t('estimateShort', min);
}

function quickAddPreviewHtml(parsed) {
  const chips = [];
  if (parsed.dueDate) {
    const [y, m, d] = parsed.dueDate.split('-').map(Number);
    const locale = LOCALE_MAP[currentLang] || 'uk-UA';
    const label = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d));
    chips.push(`<span class="quick-chip">${escapeHtml(label)}${parsed.dueTime ? ', ' + escapeHtml(parsed.dueTime) : ''}</span>`);
  }
  if (parsed.priority) {
    chips.push(`<span class="quick-chip">${escapeHtml(priorityLabel(parsed.priority))}</span>`);
  }
  if (parsed.estimateMin) {
    chips.push(`<span class="quick-chip">${escapeHtml(formatEstimate(parsed.estimateMin))}</span>`);
  }
  parsed.tags.forEach((tag) => chips.push(`<span class="quick-chip">#${escapeHtml(tag)}</span>`));
  if (!chips.length && parsed.title) {
    chips.push(`<span class="quick-chip muted">${escapeHtml(parsed.title)}</span>`);
  }
  return chips.join('');
}

function refreshQuickAddPreview() {
  const parsed = parseQuickTask(document.getElementById('quickAddInput').value);
  document.getElementById('quickAddPreview').innerHTML = quickAddPreviewHtml(parsed);
  return parsed;
}

function openQuickAdd(prefillDate) {
  const input = document.getElementById('quickAddInput');
  input.value = '';
  quickAddDate = prefillDate || null;
  document.getElementById('quickAddError').textContent = '';
  refreshQuickAddPreview();
  document.getElementById('quickAddOverlay').classList.add('show');
  setTimeout(() => input.focus(), 50);
}

function closeQuickAdd() {
  document.getElementById('quickAddOverlay').classList.remove('show');
}

async function submitQuickAdd() {
  const parsed = parseQuickTask(document.getElementById('quickAddInput').value);
  const errorEl = document.getElementById('quickAddError');
  if (!parsed.title) {
    errorEl.textContent = t('quickAddNothing');
    return;
  }
  errorEl.textContent = '';
  const uidCur = auth.currentUser && auth.currentUser.uid;
  if (!uidCur) return;

  const btn = document.getElementById('quickAddSubmitBtn');
  btn.disabled = true;
  try {
    await db.collection('users').doc(uidCur).collection('tasks').add({
      title: parsed.title,
      notes: '',
      done: false,
      completedAt: null,
      priority: parsed.priority,
      tags: parsed.tags,
      // Дата з рядка важливіша за екран, з якого відкрили форму: якщо людина
      // написала «завтра», вона мала на увазі саме завтра.
      dueDate: parsed.dueDate || quickAddDate || null,
      dueTime: parsed.dueTime,
      estimateMin: parsed.estimateMin,
      subtasks: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeQuickAdd();
  } catch (err) {
    console.error('quick add:', err);
    errorEl.textContent = t('err_generic');
  } finally {
    btn.disabled = false;
  }
}

// «Деталі…» — те саме, що вже набрано, але у повній формі: нічого
// перенабирати не треба.
function openQuickAddInForm() {
  const parsed = parseQuickTask(document.getElementById('quickAddInput').value);
  const prefillDate = parsed.dueDate || quickAddDate || '';
  closeQuickAdd();
  openTaskForm(null, prefillDate);
  document.getElementById('taskTitleInput').value = parsed.title;
  document.getElementById('taskDueTime').value = parsed.dueTime || '';
  formPriority = parsed.priority;
  formTags = parsed.tags.slice();
  formEstimate = parsed.estimateMin;
  document.getElementById('taskEstimateInput').value = parsed.estimateMin || '';
  renderPriorityPicker();
  renderTagsEditor();
}

document.getElementById('openQuickAdd').addEventListener('click', () => openQuickAdd(null));
document.getElementById('closeQuickAdd').addEventListener('click', closeQuickAdd);
document.getElementById('quickAddOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'quickAddOverlay') closeQuickAdd();
});
document.getElementById('quickAddInput').addEventListener('input', refreshQuickAddPreview);
document.getElementById('quickAddForm').addEventListener('submit', (e) => { e.preventDefault(); submitQuickAdd(); });
document.getElementById('quickAddDetailsBtn').addEventListener('click', openQuickAddInForm);
document.getElementById('taskTagInput').addEventListener('keydown', (e) => {
  // Enter у полі тега додає тег, а не відправляє всю форму завдання.
  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTagFromInput(); }
});
document.getElementById('taskTagInput').addEventListener('blur', addTagFromInput);
document.getElementById('addSubtaskBtn').addEventListener('click', addEmptySubtask);

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
initDatePicker('taskDueDate');
startNowClock();
applyTheme();
applyTranslations();
renderThemePicker();
renderLangPicker();
renderAuthLangRow();
setAuthMode('login');
