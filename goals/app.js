// Реєстрація Service Worker переїхала у спільний ../sw-register.js: ці рядки
// лежали пʼятьма копіями, а тепер разом із ними живе й перезавантаження
// сторінки після деплою (див. довгий коментар там).

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
// Ті самі мови й ключі localStorage, що й у budget/tasks/workout — вибір
// мови/теми лишається синхронізованим по всьому сайту.
const LANGS = ['uk', 'ru', 'pl', 'en'];
const LANG_NAMES = { uk: 'UA', ru: 'RU', pl: 'PL', en: 'EN' };
const LOCALE_MAP = { uk: 'uk-UA', ru: 'ru-RU', pl: 'pl-PL', en: 'en-US' };

const T = {
  uk: {
    pageTitle: 'Цілі',
    newGoalTitle: 'Нова ціль', editGoalTitle: 'Редагувати ціль',
    titlePlaceholder: 'Назва цілі',
    categoryLabel: 'Категорія',
    catManageEdit: 'Змінити', catManageAria: 'Змінити категорії цілей',
    whyLabel: 'Навіщо тобі це?', whyPlaceholder: 'Чому ця ціль важлива саме для тебе (необов’язково)',
    titleRequiredError: 'Введи назву цілі',
    saveBtn: 'Зберегти', deleteBtn: 'Видалити', cancelBtn: 'Скасувати', deleteConfirmBtn: 'Видалити',
    unsavedTitle: 'Зберегти зміни?',
    unsavedSub: 'Є незбережені зміни. Якщо вийти зараз, вони пропадуть.',
    unsavedSave: 'Зберегти', unsavedDiscard: 'Не зберігати', unsavedKeep: 'Продовжити редагування',
    confirmDeleteTitle: 'Видалити ціль?',
    confirmDeleteSub: 'Цю дію не можна скасувати. Нотатки теж зникнуть.',
    fabNewGoalLabel: 'Нова ціль', bnMonth: 'Місяць', bnYear: 'Рік', bnNotes: 'Нотатки',
    horizonLabel: 'Горизонт', horizonMonth: 'Місячна', horizonYear: 'Річна',
    horizonHint: 'Місячна — що робиш цього місяця. Річна — куди йдеш загалом.',
    emptyMonthTitle: 'Немає цілей на місяць', emptyMonthSub: 'Що хочеш зрушити саме цього місяця?',
    emptyYearTitle: 'Немає річних цілей', emptyYearSub: 'Куди ти йдеш цього року?',
    statusWorking: 'В роботі', statusDone: 'Виконано', statusFailed: 'Не виконано',
    statusLabel: 'Стан', catAll: 'Усі',
    notesLabel: 'Нотатки', notesSaved: 'Збережено',
    notesPlaceholder: 'Пиши сюди все про цю ціль: думки, що вже зроблено, що далі.',
    dashboardEmptyTitle: 'Ще немає цілей', dashboardEmptySub: 'Додай першу ціль кнопкою внизу.',
    daysLeftLabel: (n) => `${n} дн. до дедлайну`, overdueLabel: 'Прострочено',
    monthPrev: 'Попередній місяць', monthNext: 'Наступний місяць',
    pickGoalTitle: 'Обери ціль зліва',
    pickGoalSub: 'Тут буде все про неї: навіщо, стан і нотатки.',
    emptyMonthNamed: (m) => `Немає цілей на ${m}`,
    carriedFrom: (m) => `з ${m}`,
    horizonHintMonth: (m) => `Ціль піде в ${m}.`,
    retroClosed: (n) => `Закрито цілей: ${n}`,
    retroTypical: (n) => `типово ${n} дн.`,
    retroRange: (a, b) => `від ${a} до ${b} дн.`,
    goalSpanDays: (n) => `${n} дн.`, goalSpanSameDay: 'того ж дня',
    dpTodayBtn: 'Сьогодні', noDateLabel: 'Без дати',
    themeLabel: 'Тема', themeLight: 'Світла', themeDark: 'Темна', themeSystem: 'Системна',
    langLabel: 'Мова', logout: 'Вийти',
    authTitleLogin: 'Вхід', authTitleSignup: 'Реєстрація',
    authSub: 'Увійди, щоб дані синхронізувались між твоїми пристроями.',
    emailLabel: 'Email', passwordLabel: 'Пароль', passwordHint: 'Мінімум 6 символів',
    rememberMe: 'Запам’ятати мене', forgotPassword: 'Забув(ла) пароль?',
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
    pageTitle: 'Цели',
    newGoalTitle: 'Новая цель', editGoalTitle: 'Редактировать цель',
    titlePlaceholder: 'Название цели',
    categoryLabel: 'Категория',
    catManageEdit: 'Изменить', catManageAria: 'Изменить категории целей',
    whyLabel: 'Зачем тебе это?', whyPlaceholder: 'Почему эта цель важна именно для тебя (необязательно)',
    titleRequiredError: 'Введи название цели',
    saveBtn: 'Сохранить', deleteBtn: 'Удалить', cancelBtn: 'Отмена', deleteConfirmBtn: 'Удалить',
    unsavedTitle: 'Сохранить изменения?',
    unsavedSub: 'Есть несохранённые изменения. Если выйти сейчас, они пропадут.',
    unsavedSave: 'Сохранить', unsavedDiscard: 'Не сохранять', unsavedKeep: 'Продолжить редактирование',
    confirmDeleteTitle: 'Удалить цель?',
    confirmDeleteSub: 'Это действие нельзя отменить. Заметки тоже исчезнут.',
    fabNewGoalLabel: 'Новая цель', bnMonth: 'Месяц', bnYear: 'Год', bnNotes: 'Заметки',
    horizonLabel: 'Горизонт', horizonMonth: 'Месячная', horizonYear: 'Годовая',
    horizonHint: 'Месячная — что делаешь в этом месяце. Годовая — куда идёшь в целом.',
    emptyMonthTitle: 'Нет целей на месяц', emptyMonthSub: 'Что хочешь сдвинуть именно в этом месяце?',
    emptyYearTitle: 'Нет годовых целей', emptyYearSub: 'Куда ты идёшь в этом году?',
    statusWorking: 'В работе', statusDone: 'Выполнено', statusFailed: 'Не выполнено',
    statusLabel: 'Состояние', catAll: 'Все',
    notesLabel: 'Заметки', notesSaved: 'Сохранено',
    notesPlaceholder: 'Пиши сюда всё об этой цели: мысли, что уже сделано, что дальше.',
    dashboardEmptyTitle: 'Пока нет целей', dashboardEmptySub: 'Добавь первую цель кнопкой внизу.',
    daysLeftLabel: (n) => `${n} дн. до дедлайна`, overdueLabel: 'Просрочено',
    monthPrev: 'Предыдущий месяц', monthNext: 'Следующий месяц',
    pickGoalTitle: 'Выбери цель слева',
    pickGoalSub: 'Здесь будет всё о ней: зачем, состояние и заметки.',
    emptyMonthNamed: (m) => `Нет целей на ${m}`,
    carriedFrom: (m) => `с ${m}`,
    horizonHintMonth: (m) => `Цель пойдёт в ${m}.`,
    retroClosed: (n) => `Закрыто целей: ${n}`,
    retroTypical: (n) => `обычно ${n} дн.`,
    retroRange: (a, b) => `от ${a} до ${b} дн.`,
    goalSpanDays: (n) => `${n} дн.`, goalSpanSameDay: 'в тот же день',
    dpTodayBtn: 'Сегодня', noDateLabel: 'Без даты',
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
    pageTitle: 'Cele',
    newGoalTitle: 'Nowy cel', editGoalTitle: 'Edytuj cel',
    titlePlaceholder: 'Nazwa celu',
    categoryLabel: 'Kategoria',
    catManageEdit: 'Zmień', catManageAria: 'Zmień kategorie celów',
    whyLabel: 'Po co ci to?', whyPlaceholder: 'Dlaczego ten cel jest dla ciebie ważny (opcjonalnie)',
    titleRequiredError: 'Wpisz nazwę celu',
    saveBtn: 'Zapisz', deleteBtn: 'Usuń', cancelBtn: 'Anuluj', deleteConfirmBtn: 'Usuń',
    unsavedTitle: 'Zapisać zmiany?',
    unsavedSub: 'Są niezapisane zmiany. Jeśli teraz wyjdziesz, przepadną.',
    unsavedSave: 'Zapisz', unsavedDiscard: 'Nie zapisuj', unsavedKeep: 'Wróć do edycji',
    confirmDeleteTitle: 'Usunąć cel?',
    confirmDeleteSub: 'Tej czynności nie można cofnąć. Notatki też znikną.',
    fabNewGoalLabel: 'Nowy cel', bnMonth: 'Miesiąc', bnYear: 'Rok', bnNotes: 'Notatki',
    horizonLabel: 'Horyzont', horizonMonth: 'Miesięczny', horizonYear: 'Roczny',
    horizonHint: 'Miesięczny — co robisz w tym miesiącu. Roczny — dokąd zmierzasz ogólnie.',
    emptyMonthTitle: 'Brak celów na miesiąc', emptyMonthSub: 'Co chcesz ruszyć właśnie w tym miesiącu?',
    emptyYearTitle: 'Brak celów rocznych', emptyYearSub: 'Dokąd zmierzasz w tym roku?',
    statusWorking: 'W trakcie', statusDone: 'Zrobione', statusFailed: 'Niezrobione',
    statusLabel: 'Stan', catAll: 'Wszystkie',
    notesLabel: 'Notatki', notesSaved: 'Zapisano',
    notesPlaceholder: 'Pisz tu wszystko o tym celu: myśli, co już zrobione, co dalej.',
    dashboardEmptyTitle: 'Jeszcze brak celów', dashboardEmptySub: 'Dodaj pierwszy cel przyciskiem poniżej.',
    daysLeftLabel: (n) => `${n} dni do terminu`, overdueLabel: 'Po terminie',
    monthPrev: 'Poprzedni miesiąc', monthNext: 'Następny miesiąc',
    pickGoalTitle: 'Wybierz cel po lewej',
    pickGoalSub: 'Tu będzie wszystko o nim: po co, stan i notatki.',
    emptyMonthNamed: (m) => `Brak celów na ${m}`,
    carriedFrom: (m) => `z ${m}`,
    horizonHintMonth: (m) => `Cel trafi do ${m}.`,
    retroClosed: (n) => `Ukończonych celów: ${n}`,
    retroTypical: (n) => `zwykle ${n} dni`,
    retroRange: (a, b) => `od ${a} do ${b} dni`,
    goalSpanDays: (n) => `${n} dni`, goalSpanSameDay: 'tego samego dnia',
    dpTodayBtn: 'Dzisiaj', noDateLabel: 'Bez daty',
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
    pageTitle: 'Goals',
    newGoalTitle: 'New goal', editGoalTitle: 'Edit goal',
    titlePlaceholder: 'Goal title',
    categoryLabel: 'Category',
    catManageEdit: 'Edit', catManageAria: 'Edit goal categories',
    whyLabel: 'Why do you want this?', whyPlaceholder: 'Why this goal matters to you (optional)',
    titleRequiredError: 'Enter a goal title',
    saveBtn: 'Save', deleteBtn: 'Delete', cancelBtn: 'Cancel', deleteConfirmBtn: 'Delete',
    unsavedTitle: 'Save changes?',
    unsavedSub: 'There are unsaved changes. Leaving now discards them.',
    unsavedSave: 'Save', unsavedDiscard: "Don't save", unsavedKeep: 'Keep editing',
    confirmDeleteTitle: 'Delete goal?',
    confirmDeleteSub: 'This action cannot be undone. Notes will be lost too.',
    fabNewGoalLabel: 'New goal', bnMonth: 'Month', bnYear: 'Year', bnNotes: 'Notes',
    horizonLabel: 'Horizon', horizonMonth: 'Monthly', horizonYear: 'Yearly',
    horizonHint: 'Monthly — what you are moving this month. Yearly — where you are heading overall.',
    emptyMonthTitle: 'No goals for this month', emptyMonthSub: 'What do you want to move this month?',
    emptyYearTitle: 'No yearly goals', emptyYearSub: 'Where are you heading this year?',
    statusWorking: 'In progress', statusDone: 'Done', statusFailed: 'Not done',
    statusLabel: 'State', catAll: 'All',
    notesLabel: 'Notes', notesSaved: 'Saved',
    notesPlaceholder: 'Write anything about this goal here: thoughts, what is done, what is next.',
    dashboardEmptyTitle: 'No goals yet', dashboardEmptySub: 'Add your first goal with the button below.',
    daysLeftLabel: (n) => `${n}d left`, overdueLabel: 'Overdue',
    monthPrev: 'Previous month', monthNext: 'Next month',
    pickGoalTitle: 'Pick a goal on the left',
    pickGoalSub: 'Everything about it lands here: why, state and notes.',
    emptyMonthNamed: (m) => `No goals for ${m}`,
    carriedFrom: (m) => `from ${m}`,
    horizonHintMonth: (m) => `This goal goes to ${m}.`,
    retroClosed: (n) => `Goals closed: ${n}`,
    retroTypical: (n) => `typically ${n}d`,
    retroRange: (a, b) => `from ${a}d to ${b}d`,
    goalSpanDays: (n) => `${n}d`, goalSpanSameDay: 'same day',
    dpTodayBtn: 'Today', noDateLabel: 'No date',
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

// ---- Категорії цілей ----
// Список був захардкодженим і на вісім назв — тих самих для всіх. Але «Цілі»
// це розділ про те, як людина ділить СВОЄ життя, і чужа розбивка тут гірша,
// ніж у бюджеті: витрата з категорією «Інше» лишається витратою на 200 грн,
// а ціль у чужій категорії просто не знаходить свого місця.
//
// Тепер список живе в профілі (`categoriesGoals`) — тим самим шляхом, що й
// категорії бюджету, і в тому ж форматі [{ id, label, colorIndex }]. Доки
// людина його не редагувала, у профілі його НЕМАЄ: тоді показуємо
// стандартний, спільний із помічником (categories-default.js) — інакше в
// чаті й на екрані стояли б різні списки.
//
// Ids стандартних категорій ті самі, що були в цьому масиві, тож усі вже
// заведені цілі лишились у своїх категоріях без жодної міграції.
const CATEGORY_SLOTS = 8; // скільки кольорових слотів дає --cat-c0..--cat-c7
let goalCategories = defaultGoalCategoryList(currentLang, CATEGORY_SLOTS);
// Доки список стандартний, він мусить іти за мовою сторінки: у ньому переклад,
// а не те, що людина написала своєю рукою. Після першої ж правки — навпаки:
// перекладати чужі слова не можна, тож прапорець гасне назавжди.
let usingDefaultCategories = true;

function findGoalCategory(id) {
  return goalCategories.find((c) => c.id === id) || null;
}

/**
 * Назва категорії. Незнайомий id означає категорію, видалену на іншому
 * пристрої: показуємо сам id, а не підміняємо його на «Інше» — підміна
 * виглядала б як факт про ціль, якого ніхто не встановлював.
 */
function categoryLabel(id) {
  const cat = findGoalCategory(id);
  return cat ? cat.label : String(id || '');
}

/**
 * Клас кольору (`c0`…`c7`) — саме клас, а не колір: слоти палітри визначені
 * в goals/index.html і мають дві версії, світлу й темну.
 * Для категорії, якої вже немає в списку, колір беремо хешем від id — щоб він
 * хоч лишався тим самим від перемальовування до перемальовування.
 */
function categoryColorClass(id) {
  const cat = findGoalCategory(id);
  if (cat && typeof cat.colorIndex === 'number') return 'c' + (cat.colorIndex % CATEGORY_SLOTS);
  const str = String(id || '');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return 'c' + (h % CATEGORY_SLOTS);
}

/** Куди подіти ціль, у якої категорії більше немає. */
function fallbackCategoryId() {
  const other = findGoalCategory('other');
  if (other) return other.id;
  return goalCategories[0] ? goalCategories[0].id : 'other';
}

/** Список із профілю, якщо він там є і не порожній; інакше стандартний. */
function applyProfileCategories(data) {
  const fromProfile = data && Array.isArray(data.categoriesGoals) ? data.categoriesGoals : null;
  const clean = (fromProfile || [])
    .filter((c) => c && typeof c.id === 'string' && c.id && typeof c.label === 'string')
    .map((c) => ({
      id: c.id,
      label: c.label,
      colorIndex: Number.isInteger(c.colorIndex) ? c.colorIndex : 0,
    }));
  if (clean.length) {
    goalCategories = clean;
    usingDefaultCategories = false;
  } else if (usingDefaultCategories) {
    goalCategories = defaultGoalCategoryList(currentLang, CATEGORY_SLOTS);
  }
}

// ---- Тема ----
// Вибір лежить у localStorage під тим самим ключем, що й на решті сторінок:
// зміна у вікні налаштувань підхоплюється скрізь.
const THEME_CHOICES = ['light', 'dark', 'system'];
const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
function themeChoiceNow() {
  const choice = localStorage.getItem('financeAppTheme') || 'system';
  return THEME_CHOICES.includes(choice) ? choice : 'system';
}
function resolveTheme() {
  const choice = themeChoiceNow();
  if (choice === 'system') return darkMediaQuery.matches ? 'dark' : 'light';
  return choice;
}
function applyTheme() {
  const resolved = resolveTheme();
  document.documentElement.setAttribute('data-theme', resolved === 'dark' ? 'dark' : 'light');
  // Колір беремо з --status-bar, а не з власного хардкоду: смуга мусить
  // повторювати початок --bg-radial, і тримати цю відповідність у двох
  // різних файлах означає рано чи пізно її загубити — саме так угорі
  // екрана й зʼявився шов. Атрибут data-theme уже виставлено вище, тож
  // обчислений стиль повертає значення потрібної теми.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bar = getComputedStyle(document.documentElement).getPropertyValue('--status-bar').trim();
    if (bar) meta.setAttribute('content', bar);
  }
}
darkMediaQuery.addEventListener('change', () => {
  if (themeChoiceNow() === 'system') applyTheme();
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
  // Свої назви не перекладаємо: після першої правки список належить людині.
  if (usingDefaultCategories) goalCategories = defaultGoalCategoryList(currentLang, CATEGORY_SLOTS);
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).set({ lang }, { merge: true }).catch(() => {});
  }
  applyTranslations();
  renderAuthLangRow();
  AppSettings.setLang(lang);
  AppNotes.setLang(lang);
}

// ---- Переклад статичних елементів ----
// ---- Бічна колонка розділів (лише широкий екран) ----
// Розмітку й назви розділів тримає ../side-nav.js — одні на всі пʼять
// сторінок. Експорту й теми тут немає навмисно: вони живуть на головній,
// і кнопка, яка веде на іншу сторінку щось зробити, — це не кнопка.
window.SideNav.mount(document.getElementById('sideNavHost'), {
  current: 'goals',
  base: '../',
  lang: currentLang,
});

// ---- Вікно налаштувань ----
// Одне на всі пʼять сторінок (../settings.js). У шапці його відкриває
// шестерня, у бічній колонці — рядок «Налаштування»: на телефоні колонки
// немає, тож без кнопки в шапці вікно було б недосяжне з розділу.
function setTheme(choice) {
  if (!THEME_CHOICES.includes(choice)) return;
  localStorage.setItem('financeAppTheme', choice);
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).set({ theme: choice }, { merge: true }).catch(() => {});
  }
  applyTheme();
}
AppSettings.init({
  db, auth,
  base: '../',
  lang: currentLang,
  theme: themeChoiceNow,
  onTheme: setTheme,
  onLang: setLang,
  onLogout: () => auth.signOut(),
});

// Блокнот розділу — той самий компонент, що в бюджеті й тренуваннях.
// Сторінка дає йому контейнер; чим показувати список, вирішує нижня
// навігація, і вона в кожного розділу своя.
AppNotes.init({
  db, auth, firebase,
  section: 'goals',
  host: '#notesHost',
  lang: currentLang,
  guardTexts: () => ({
    title: t('unsavedTitle'), sub: t('unsavedSub'),
    save: t('unsavedSave'), discard: t('unsavedDiscard'), keep: t('unsavedKeep'),
  }),
});
// Бічне меню відкриває вікно одразу на вкладці ЦЬОГО розділу.
document.getElementById('sideSettingsBtn').addEventListener('click', () => AppSettings.open('goals'));
document.getElementById('pageSettingsBtn').addEventListener('click', () => AppSettings.open('goals'));

function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  window.SideNav.setLang(currentLang);
  document.title = `${t('pageTitle')} · Life`;
  document.getElementById('openNewGoalBtn').setAttribute('aria-label', t('fabNewGoalLabel'));
  renderDetailPlaceholder();
  document.getElementById('bnMonthLabel').textContent = t('bnMonth');
  document.getElementById('bnNotesLabel').textContent = t('bnNotes');
  document.getElementById('bnYearLabel').textContent = t('bnYear');
  document.getElementById('goalModalTitle').textContent = editingGoalId ? t('editGoalTitle') : t('newGoalTitle');
  document.getElementById('categoryLabel').textContent = t('categoryLabel');
  document.getElementById('whyLabel').textContent = t('whyLabel');
  document.getElementById('goalWhyInput').placeholder = t('whyPlaceholder');
  document.getElementById('deleteGoalBtn').textContent = t('deleteBtn');
  document.getElementById('goalSubmitBtn').textContent = t('saveBtn');
  document.getElementById('goalTitleInput').placeholder = t('titlePlaceholder');
  document.getElementById('goalNotes').placeholder = t('notesPlaceholder');
  document.getElementById('notesLabel').textContent = t('notesLabel');
  document.getElementById('confirmTitle').textContent = t('confirmDeleteTitle');
  document.getElementById('confirmSub').textContent = t('confirmDeleteSub');
  document.getElementById('confirmCancel').textContent = t('cancelBtn');
  document.getElementById('confirmDelete').textContent = t('deleteConfirmBtn');
  document.getElementById('authSub').textContent = t('authSub');
  document.getElementById('authEmailLabel').textContent = t('emailLabel');
  document.getElementById('authPasswordLabel').textContent = t('passwordLabel');
  document.getElementById('authPasswordHint').textContent = t('passwordHint');
  document.getElementById('rememberMeLabel').textContent = t('rememberMe');
  document.getElementById('forgotPasswordLink').textContent = t('forgotPassword');
  setAuthMode(authMode);
  if (document.getElementById('goalFormOverlay').classList.contains('show')) {
    renderCategoryPicker();
  }
  renderCurrentScreen();
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
// ---- Стан ----
let goals = [];
let unsubscribeGoals = null;
let currentScreen = 'dashboard'; // 'dashboard' | 'detail'
let activeDetailGoalId = null;
// Обрана категорія або null — «усі». Категорії стали тим, чим раніше був
// фільтр статусів: цілей у людини десятки, і шукати серед них корисніше за
// сферою («що там зі здоровʼям»), ніж за станом — стан і так написаний над
// кожною групою списку.
let categoryFilter = null;
// Горизонт планування: дві вкладки внизу — «Місяць» і «Рік». Це не фільтр
// поверх одного списку, а два різні питання: що я роблю ЦЬОГО МІСЯЦЯ і куди
// я взагалі йду. Тримати їх в одному списку означало б, що дрібне щоразу
// ховає велике — його завжди більше.
const HORIZON_KEY = 'goalsHorizon';
let horizon = localStorage.getItem(HORIZON_KEY) === 'year' ? 'year' : 'month';
// Старі цілі поля не мають: вони заводились як довгострокові.
function horizonOf(goal) {
  return goal && goal.horizon === 'month' ? 'month' : 'year';
}
// Місяць, який зараз дивляться, як 'YYYY-MM'. Не памʼятається між
// відкриттями: розділ має відкриватись на тому місяці, у якому людина живе.
let viewMonth = todayISO().slice(0, 7);
let editingGoalId = null;
let formCategory = 'other';
let formHorizon = 'month';
let pendingDeleteId = null;

// ---- Дані (Firestore, реалтайм) ----
// Профіль тут потрібен заради двох речей: мови (сторінку могли відкрити з
// іншого пристрою, де її вже змінили) і списку категорій цілей. Раніше це був
// разовий `get()`, і мови вистачало; категорії ж редагуються просто з цієї
// сторінки, тож підписка стала обовʼязковою — інакше другий пристрій не
// побачив би правки, а власне вікно керування показувало б застарілий список.
let unsubscribeProfile = null;

function subscribeToProfile(uid) {
  if (unsubscribeProfile) unsubscribeProfile();
  unsubscribeProfile = db.collection('users').doc(uid).onSnapshot((doc) => {
    const data = doc.data();
    if (!data) return;
    let langChanged = false;
    if (data.lang && LANGS.includes(data.lang) && data.lang !== currentLang) {
      currentLang = data.lang;
      localStorage.setItem('financeAppLang', currentLang);
      langChanged = true;
    }
    applyProfileCategories(data);
    if (langChanged) {
      applyTranslations();
      renderAuthLangRow();
    }
    if (!findGoalCategory(formCategory)) formCategory = fallbackCategoryId();
    if (document.getElementById('goalFormOverlay').classList.contains('show')) renderCategoryPicker();
    renderCurrentScreen();
  }, (err) => console.error('subscribeToProfile:', err));
}

function subscribeToGoals(uid) {
  if (unsubscribeGoals) unsubscribeGoals();
  const col = db.collection('users').doc(uid).collection('goals');
  // Цілі йдуть у стан як є. Раніше тут стояло дві копії списку: сира з бази
  // й похідна, у якій числову мету «накопичити 50 тисяч» підставляли з
  // реальних операцій скарбнички. Числової мети більше немає — підставляти
  // нема куди, і копія лишилась одна.
  unsubscribeGoals = col.onSnapshot((snap) => {
    goals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCurrentScreen();
  }, (err) => console.error('subscribeToGoals:', err));
}

// ---- Обчислення (завжди похідні від живих даних, нічого не кешується) ----
// Місяць цілі, тривалість закритої, ретроспектива й нотатки — goals/review.js.
// Той самий модуль читає помічник на сервері: інакше в чаті звучало б одне
// число, а на екрані стояло інше.
const Review = window.GoalReview;

// ---- Стан цілі: три, і рівно три ----
//
// «В роботі», «Виконано», «Не виконано». У базі перші два лежать під своїми
// іменами, а «не виконано» — під `archived`, і це не недогляд: правила
// Firestore перелічують дозволені значення поіменно, тож нове довелось би
// туди дописувати й розгортати правила. Слово в базі старе, зміст новий —
// ціль, за яку більше не беруться.
//
// 'paused' у базі теж трапляється: пауза була четвертим станом і жила рівно
// заради серії — щоб ланцюг не рвався, поки людина у відпустці. Серії немає,
// і пауза разом із нею втратила сенс; старі цілі на паузі читаються як «в
// роботі», бо саме там вони й лишились.
const STATUSES = ['active', 'done', 'failed'];
const STATUS_DB = { active: 'active', done: 'done', failed: 'archived' };
const STATUS_LABEL = { active: 'statusWorking', done: 'statusDone', failed: 'statusFailed' };

function statusOf(goal) {
  const raw = goal && goal.status;
  if (raw === 'done') return 'done';
  if (raw === 'archived') return 'failed';
  return 'active';
}

function daysToDeadline(targetDate) {
  const today = parseISODate(todayISO());
  const target = parseISODate(targetDate);
  return Math.round((target - today) / 86400000);
}

// ---- Рендер: дашборд ----
// Чи обрана ціль обрана САМИМ екраном, а не людиною. Різниця потрібна лише
// в одному місці: коли вікно звужується до однієї колонки, вибір, якого
// людина не робила, не має відкривати їй екран цілі.
let autoSelectedGoal = false;

// На широкому екрані права колонка не має зустрічати порожнечею: перша ціль
// зі списку обирається сама. Це не вибір за людину — це рівно те, що вона
// зробила б першим кліком, і будь-який наступний клік його скасовує.
// Порожня підказка лишається для випадку, коли обирати нема з чого.
function autoSelectFirstGoal() {
  if (!isSplitView() || activeDetailGoalId) return;
  const first = goalsInDisplayOrder(visibleGoals())[0];
  if (!first) return;
  activeDetailGoalId = first.id;
  autoSelectedGoal = true;
  setScreen('detail');
}

function renderCurrentScreen() {
  autoSelectFirstGoal();
  if (currentScreen === 'detail' && activeDetailGoalId) {
    const goal = goals.find((g) => g.id === activeDetailGoalId);
    if (goal) {
      renderGoalDetail(goal);
      // На широкому екрані список нікуди не подівся й лишається живим: там
      // видно, яку саме ціль показує права колонка, і туди ж приїжджають
      // зміни, зроблені в деталях (серія, статус).
      if (isSplitView()) renderDashboard();
      return;
    }
    // Ціль зникла (видалена з іншого пристрою) — повертаємось на дашборд.
    activeDetailGoalId = null;
    setScreen('dashboard');
  }
  // Права колонка без обраної цілі не порожня: вона каже, що з нею робити.
  if (isSplitView()) renderDetailPlaceholder();
  renderDashboard();
}

// Порожня права колонка каже, що з нею робити. Підказка — окремий елемент
// поруч із деталями, а не замість них: блоків деталей півтора десятка, і
// перемальовувати їх щоразу заради двох рядків тексту було б і повільно, і
// крихко (усі id усередині зникали б і поверталися).
function renderDetailPlaceholder() {
  document.getElementById('pickGoalTitle').textContent = t('pickGoalTitle');
  document.getElementById('pickGoalSub').textContent = t('pickGoalSub');
}

function renderDashboard() {
  renderMonthHeader();
  renderCategoryFilterRow();
  renderGoalsList();
}

// Рядок категорій. На його місці стояли два: бейджі («🏆 Перша ціль
// завершена») і фільтр станів. Бейджі хвалили за те, що й так видно, а
// фільтр станів дублював те, що тепер написано над кожною групою списку.
//
// Категорія — те, за чим ціль справді шукають: «що там зі здоровʼям», а не
// «покажи архівні». Показуємо лише ті, у яких на цій вкладці щось є, і лише
// коли їх більше однієї: рядок із двох чипів, один з яких «Усі», нічого не
// фільтрує й лише займає місце.
function renderCategoryFilterRow() {
  const row = document.getElementById('categoryFilterRow');
  const scoped = goalsOfHorizon();
  const present = goalCategories
    .map((c) => c.id)
    .filter((id) => scoped.some((g) => (g.category || '') === id));
  // Категорія, якої в списку вже немає (стара ціль), теж має бути видимою —
  // інакше її цілі неможливо відфільтрувати.
  scoped.forEach((g) => {
    const id = g.category || '';
    if (present.indexOf(id) === -1) present.push(id);
  });

  if (present.length < 2) { row.innerHTML = ''; categoryFilter = null; return; }
  // Обрана категорія могла зникнути разом з останньою своєю ціллю.
  if (categoryFilter && present.indexOf(categoryFilter) === -1) categoryFilter = null;

  const chips = [[null, t('catAll')]].concat(present.map((id) => [id, categoryLabel(id)]));
  row.innerHTML = chips.map(([val, label]) =>
    `<button type="button" class="tag-filter-chip${categoryFilter === val ? ' selected' : ''}" data-cat="${val === null ? '' : escapeHtml(val)}">${escapeHtml(label)}</button>`
  ).join('');
  row.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      categoryFilter = btn.dataset.cat || null;
      renderCategoryFilterRow();
      renderGoalsList();
    });
  });
}

// Підсумок під списком: скільки цілей закрито й скільки типово займали.
//
// Закрита ціль досі просто зникала — статус міняється, картка випадає з
// активного списку, і рік роботи не лишає на екрані жодного сліду. А для
// довгих цілей винагорода саме в озиранні назад.
//
// Раніше цей блок жив над списком і мав власний перемикач періоду; він
// показувався лише у фільтрі «Завершені», якого більше немає. Тепер це один
// тихий рядок унизу за весь час — рахувати ретроспективу вікнами було
// цікавою можливістю рівно доти, доки хтось нею користувався.
function retroHtml() {
  const scoped = goals.filter((g) => horizonOf(g) === horizon);
  const r = Review.retrospective(scoped, todayISO(), { startIsoOf: createdIso, days: null });
  if (!r || !r.count) return '';
  const parts = [t('retroClosed', r.count)];
  if (r.medianDays !== null) parts.push(t('retroTypical', r.medianDays));
  return `<div class="retro-line">${escapeHtml(parts.join(' · '))}</div>`;
}

function goalCardHtml(goal) {
  const metaParts = [];
  const state = statusOf(goal);
  if (goal.targetDate && state === 'active') {
    const days = daysToDeadline(goal.targetDate);
    const overdue = days < 0;
    metaParts.push(`<span class="goal-card-deadline${overdue ? ' overdue' : ''}">${escapeHtml(overdue ? t('overdueLabel') : t('daysLeftLabel', days))}</span>`);
  }
  // Скільки ціль зайняла — головне число ретроспективи, тож стоїть на самій
  // картці, а не лише в підсумку під списком.
  if (state === 'done') {
    const sp = Review.goalSpan(goal, { startIso: createdIso(goal) });
    if (sp && sp.days !== null) {
      metaParts.push(`<span class="goal-card-days">${escapeHtml(sp.days === 0 ? t('goalSpanSameDay') : t('goalSpanDays', sp.days))}</span>`);
    }
  }
  // Ціль, перенесена з минулого місяця, має про це сказати: інакше липнева
  // серед серпневих виглядала б як щойно заведена.
  if (horizon === 'month') {
    const own = Review.monthKeyOf(goal, { startIso: createdIso(goal) });
    if (own && own !== viewMonth) {
      metaParts.push(`<span class="goal-carried">${escapeHtml(t('carriedFrom', monthLabel(own)))}</span>`);
    }
  }
  // Значка стану на картці немає: стан написаний над групою, у якій вона
  // стоїть, і писати те саме вдруге на кожній картці — шум.
  const selected = goal.id === activeDetailGoalId ? ' selected' : '';
  return `
    <div class="card goal-card state-${state}${selected}" data-open-goal="${goal.id}">
      <div class="goal-card-top">
        <div>
          <span class="category-chip ${categoryColorClass(goal.category)}">${escapeHtml(categoryLabel(goal.category))}</span>
          <div class="goal-card-title">${escapeHtml(goal.title)}</div>
        </div>
      </div>
      ${metaParts.length ? `<div class="goal-card-meta">${metaParts.join('')}</div>` : ''}
    </div>`;
}

function goalsOfHorizon() {
  if (horizon !== 'month') return goals.filter((g) => horizonOf(g) === 'year');
  return Review.goalsOfMonth(goals, viewMonth, {
    currentMonth: todayISO().slice(0, 7),
    startIsoOf: createdIso,
  });
}

/** Назва місяця словами: «серпень 2026». */
function monthLabel(monthKey) {
  const d = new Date(`${monthKey}-01T00:00:00`);
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
}

function shiftViewMonth(delta) {
  const d = new Date(`${viewMonth}-01T00:00:00`);
  d.setMonth(d.getMonth() + delta);
  viewMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderCurrentScreen();
}

// Заголовок місяця. Раніше вкладка «Місяць» показувала всі місячні цілі за
// весь час — горизонт казав, що ціль місячна, але не казав ЯКОГО місяця.
// Тап по назві вертає в поточний місяць: той самий жест, що в календарі
// тренувань, тож звідки завгодно є дорога назад одним дотиком.
function renderMonthHeader() {
  const el = document.getElementById('monthHeader');
  if (!el) return;
  if (horizon !== 'month') { el.innerHTML = ''; return; }
  const current = todayISO().slice(0, 7);
  el.innerHTML = `
    <div class="month-header">
      <button type="button" class="month-arrow" id="monthPrev" aria-label="${escapeHtml(t('monthPrev'))}">‹</button>
      <button type="button" class="month-name${viewMonth === current ? ' current' : ''}" id="monthNow">
        ${escapeHtml(monthLabel(viewMonth))}
      </button>
      <button type="button" class="month-arrow" id="monthNext" aria-label="${escapeHtml(t('monthNext'))}">›</button>
    </div>`;
  document.getElementById('monthPrev').addEventListener('click', () => shiftViewMonth(-1));
  document.getElementById('monthNext').addEventListener('click', () => shiftViewMonth(1));
  document.getElementById('monthNow').addEventListener('click', () => {
    viewMonth = todayISO().slice(0, 7);
    renderCurrentScreen();
  });
}

/** Цілі, які зараз у списку: горизонт плюс обрана категорія. */
function visibleGoals() {
  const scoped = goalsOfHorizon();
  return categoryFilter === null ? scoped : scoped.filter((g) => (g.category || '') === categoryFilter);
}

/** Список, розкладений по станах у сталому порядку: спершу те, над чим
 *  працюють, потім зроблене, потім закинуте. Порожні групи не малюються. */
function goalGroups(list) {
  return STATUSES
    .map((state) => ({ state, goals: list.filter((g) => statusOf(g) === state) }))
    .filter((grp) => grp.goals.length);
}

/** Цілі в тому порядку, в якому вони стоять на екрані: перша — перша у
 *  ПЕРШІЙ групі, а не в сирому списку. */
function goalsInDisplayOrder(list) {
  return goalGroups(list).reduce((acc, grp) => acc.concat(grp.goals), []);
}

function renderGoalsList() {
  const list = visibleGoals();
  const el = document.getElementById('goalsList');
  if (!list.length) {
    // Порожній екран питає рівно те, заради чого сюди зайшли, — а це різні
    // питання на різних вкладках.
    const title = horizon === 'month' ? t('emptyMonthNamed', monthLabel(viewMonth)) : t('emptyYearTitle');
    const sub = horizon === 'month' ? t('emptyMonthSub') : t('emptyYearSub');
    el.innerHTML = `<div class="empty-state"><div class="title">${escapeHtml(title)}</div><div>${escapeHtml(sub)}</div></div>${retroHtml()}`;
    return;
  }
  // Заголовок групи — це СТАН, а не категорія: категорії переїхали в рядок
  // фільтра над списком, і другий раз групувати за ними означало б показати
  // те саме двічі. Стан же інакше ніде не видно: значок на кожній картці був
  // би шумом, а список без поділу змішував би закрите з живим.
  el.innerHTML = goalGroups(list).map((grp) =>
    `<div class="goal-group-label">${escapeHtml(t(STATUS_LABEL[grp.state]))}</div>${grp.goals.map(goalCardHtml).join('')}`
  ).join('') + retroHtml();
  el.querySelectorAll('[data-open-goal]').forEach((card) => {
    card.addEventListener('click', () => showGoalDetail(card.dataset.openGoal));
  });
}

// ---- Навігація між екранами ----
// Який екран видно, вирішує CSS за атрибутом data-screen. Раніше це робив
// інлайновий style — і саме він не давав широкому екрану показати список і
// деталі ПОРУЧ: інлайновий display перебиває будь-який медіазапит.
function setScreen(name) {
  currentScreen = name;
  document.getElementById('screens').dataset.screen = name;
}

// Поріг той самий, що в CSS (1240px): інакше сторінка й скрипт розходились би
// в тому, яка зараз розкладка.
const SPLIT_SCREEN = '(min-width:1240px)';
function isSplitView() {
  return typeof window.matchMedia === 'function' && window.matchMedia(SPLIT_SCREEN).matches;
}

function showGoalDetail(id) {
  activeDetailGoalId = id;
  autoSelectedGoal = false;
  setScreen('detail');
  renderCurrentScreen();
}
function showDashboard() {
  // Нотатку, набрану й не дописану, зберігаємо перед виходом: у списку її
  // вже нікуди буде повернути.
  flushNotes();
  activeDetailGoalId = null;
  autoSelectedGoal = false;
  setScreen('dashboard');
  renderCurrentScreen();
}
document.getElementById('detailBackBtn').addEventListener('click', showDashboard);
// Вкладка «Цілі» — і повернення з екрана деталей, і просто підсвічений стан.
function selectHorizon(next) {
  horizon = next === 'year' ? 'year' : 'month';
  try { localStorage.setItem(HORIZON_KEY, horizon); } catch (err) { /* приватний режим */ }
  showNotes(false);
  document.getElementById('bnMonth').classList.toggle('active', horizon === 'month');
  document.getElementById('bnYear').classList.toggle('active', horizon === 'year');
  showDashboard();
}

// Нотатки лежать ПОРУЧ із .screens, а не третім їхнім станом: усередині
// на широкому екрані стоїть двоколонкова сітка, і блокнот опинився б у
// колонці завширшки 380px замість цілої сторінки.
function showNotes(on) {
  document.getElementById('screens').hidden = !!on;
  document.getElementById('notesScreen').hidden = !on;
  document.getElementById('bnNotes').classList.toggle('active', !!on);
  if (on) {
    document.getElementById('bnMonth').classList.remove('active');
    document.getElementById('bnYear').classList.remove('active');
    AppNotes.showList();
  }
}
document.getElementById('bnNotes').addEventListener('click', () => showNotes(true));
// Розкладка живе за медіазапитом, а список за нього ЗНАЄ (групи за
// категоріями є лише у двох колонках). Тож перетин порогу — це не лише
// справа CSS: сторінку треба перемалювати, інакше після зміни ширини вона
// малює список для іншої розкладки.
if (typeof window.matchMedia === 'function') {
  const splitQuery = window.matchMedia(SPLIT_SCREEN);
  const onSplitChange = () => {
    if (!isSplitView() && autoSelectedGoal) { showDashboard(); return; }
    renderCurrentScreen();
  };
  if (typeof splitQuery.addEventListener === 'function') splitQuery.addEventListener('change', onSplitChange);
  else if (typeof splitQuery.addListener === 'function') splitQuery.addListener(onSplitChange);
}

document.getElementById('bnMonth').addEventListener('click', () => selectHorizon('month'));
document.getElementById('bnYear').addEventListener('click', () => selectHorizon('year'));

// ---- Рендер: деталі цілі ----
// Тут лишилось рівно те, з чого ціль тепер складається: навіщо вона, у якому
// вона стані й що людина про неї написала.
//
// Пішли звідси: серія з кнопкою «зробив крок сьогодні», сітка відміток за
// вісім тижнів, банер рятунку серії, «що заважає найчастіше», банер довгої
// перерви, список щоденних дій і стрічка щоденника. Усе це трималось на
// щоденній галочці, і ціль на вісім місяців отримувала щовечора питання
// «так/ні» — механіку звички, накинуту на те, що звичкою не є.
function renderGoalDetail(goal) {
  document.getElementById('detailTitleLabel').textContent = goal.title;
  document.getElementById('detailEditBtn').onclick = () => openGoalForm(goal);

  document.getElementById('detailBadgesRow').innerHTML =
    `<span class="category-chip ${categoryColorClass(goal.category)}">${escapeHtml(categoryLabel(goal.category))}</span>`;

  document.getElementById('detailWhyBlock').innerHTML = goal.why
    ? `<div class="why-block">“${escapeHtml(goal.why)}”</div>` : '';

  renderStatusSwitch(goal);
  renderNotes(goal);
}

// Перемикач стану. Раніше на цьому місці стояв рядок із трьох різнорідних
// кнопок — «Виконано», «Поставити на паузу», «Перенести в архів», — і з них
// геть не читалось, що це один вибір із кількох, а не три різні дії.
//
// Тепер це перемикач: три стани поруч, поточний підсвічений. Натиснути на
// вже обраний — не помилка й не «зняти», а просто нічого: стан у цілі є
// завжди, і порожнього значення серед них немає.
function renderStatusSwitch(goal) {
  const el = document.getElementById('detailStatusRow');
  const current = statusOf(goal);
  el.innerHTML = `
    <div class="section-label">${escapeHtml(t('statusLabel'))}</div>
    <div class="status-switch" role="group">
      ${STATUSES.map((state) => `
        <button type="button" class="status-opt state-${state}${state === current ? ' selected' : ''}"
          data-status="${state}"${state === current ? ' aria-pressed="true"' : ''}>${escapeHtml(t(STATUS_LABEL[state]))}</button>`).join('')}
    </div>`;
  el.querySelectorAll('[data-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.status === current) return;
      setGoalStatus(goal.id, btn.dataset.status);
    });
  });
}

// ---- Нотатки ----
//
// Одне вільне поле на ціль замість щоденника. Щоденник був стрічкою окремих
// записів із датами, і його головна вада була саме в стрічці: дописати рядок
// до вчорашньої думки не виходило — доводилось заводити другий запис, — а
// звʼязного тексту про ціль не складалось ніколи.
//
// Зберігається саме поле, а не кнопка «зберегти»: текст, який треба окремо
// підтверджувати, губиться щоразу, коли сторінку закривають на півдумці.
// Пишемо через паузу після останньої літери, а не на кожну — інакше на
// сторінку з тисячею символів пішла б тисяча записів у базу.
const NOTES_DEBOUNCE_MS = 800;
// Чия саме нотатка зараз у полі. Порівняння з ним — єдине, що відрізняє
// «людина відкрила іншу ціль» від «приїхав знімок тієї самої».
let notesGoalId = null;
let notesTimer = null;
let notesSavedTimer = null;

function renderNotes(goal) {
  const el = document.getElementById('goalNotes');
  const incoming = Review.notesText(goal);
  if (notesGoalId !== goal.id) {
    // Спершу дописуємо те, що лишилось від попередньої цілі: інакше швидкий
    // перехід між цілями з'їдав би останню фразу.
    flushNotes();
    notesGoalId = goal.id;
    el.value = incoming;
    autoGrow(el);
    setNotesState('');
    return;
  }
  // Та сама ціль. Знімки приїжджають і на наш власний запис, тож поле, у
  // якому зараз пишуть (або чий запис ще не пішов), не чіпаємо: інакше текст
  // стрибав би під пальцями.
  if (notesTimer || document.activeElement === el) return;
  if (el.value !== incoming) { el.value = incoming; autoGrow(el); }
}

function setNotesState(text) {
  const el = document.getElementById('notesState');
  if (el) el.textContent = text;
}

function scheduleNotesSave() {
  if (notesTimer) clearTimeout(notesTimer);
  notesTimer = setTimeout(() => { notesTimer = null; saveNotes(notesGoalId); }, NOTES_DEBOUNCE_MS);
}

/** Дописати негайно те, що чекає на таймері. Викликається перед переходом на
 *  іншу ціль і коли сторінку згортають чи закривають. */
function flushNotes() {
  if (!notesTimer) return;
  clearTimeout(notesTimer);
  notesTimer = null;
  saveNotes(notesGoalId);
}

async function saveNotes(goalId) {
  const el = document.getElementById('goalNotes');
  if (!goalId || !auth.currentUser || !el) return;
  const goal = goals.find((g) => g.id === goalId);
  // Текст не змінився — писати нічого: знімок від власного запису інакше
  // ганяв би коло «запис → знімок → запис».
  if (goal && Review.notesText(goal) === el.value.trim()) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    journal: Review.notesPatch(el.value),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('saveNotes:', err));
  if (notesGoalId !== goalId) return;
  setNotesState(t('notesSaved'));
  if (notesSavedTimer) clearTimeout(notesSavedTimer);
  notesSavedTimer = setTimeout(() => setNotesState(''), 2000);
}

document.getElementById('goalNotes').addEventListener('input', (e) => {
  autoGrow(e.target);
  setNotesState('');
  scheduleNotesSave();
});
// Пішли з поля — не чекаємо паузи: людина вже перевела погляд деінде.
document.getElementById('goalNotes').addEventListener('blur', flushNotes);
// Вкладку згорнули, закрили чи перемкнули — останній шанс дописати.
// `pagehide` разом із `visibilitychange`, бо на телефоні перший не завжди
// встигає, а другий не буває при закритті.
window.addEventListener('pagehide', flushNotes);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushNotes();
});

// createdAt приходить із Firestore як Timestamp; тим, хто рахує вік цілі
// (ретроспектива, місяць «свого» місяця), потрібен день, від якого вести
// відлік. Якщо поля ще немає (щойно створений документ до підтвердження
// сервером) — review.js сам візьме найраніший слід у даних.
function createdIso(goal) {
  // Після перезапуску відлік цілі ведеться від нього, а не від заведення.
  // Самої кнопки «почати заново» більше немає — вона піднімала обірвану
  // серію, — але цілі, у яких дата вже проставлена, мають і далі рахуватись
  // від неї: інакше їхня тривалість у ретроспективі стрибнула б.
  if (goal && typeof goal.restartedAt === 'string' && goal.restartedAt.length === 10) {
    return goal.restartedAt;
  }
  const ts = goal && goal.createdAt;
  if (ts && typeof ts.toDate === 'function') return Review.isoOf(ts.toDate());
  return null;
}

async function setGoalStatus(goalId, state) {
  if (!auth.currentUser) return;
  // completedAt — день, коли питання закрили, яким би не була відповідь:
  // пишеться і для «виконано», і для «не виконано». Ретроспектива від нього
  // рахує тривалість (і бере лише виконані — див. closedOn у review.js), а
  // вкладка місяця з нього знає, що перенесену ціль, закриту сьогодні, треба
  // лишити перед очима, а не відправити назад у її давній місяць.
  // Ціль, відкриту назад у роботу, стара дата супроводжувати не має.
  const patch = {
    status: STATUS_DB[state] || 'active',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    completedAt: state === 'active' ? null : todayISO(),
  };
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId)
    .update(patch).catch((err) => console.error('setGoalStatus:', err));
}

// ---- Форма цілі (створення / редагування) ----
// Місяць уже заведеної цілі. Порожньо для нової й для тієї, що була річною:
// у неї місяця не було, і братись йому нема звідки, крім видимого.
function existingMonthKey() {
  if (!editingGoalId) return null;
  const g = goals.find((x) => x.id === editingGoalId);
  if (!g || g.horizon !== 'month') return null;
  return Review.monthKeyOf(g, { startIso: createdIso(g) });
}

function renderHorizonPicker() {
  document.getElementById('horizonLabel').textContent = t('horizonLabel');
  // Найпряміша відповідь на «а в який місяць це піде»: написати місяць.
  document.getElementById('horizonHint').textContent = formHorizon === 'month'
    ? t('horizonHintMonth', monthLabel(existingMonthKey() || viewMonth))
    : t('horizonHint');
  const picker = document.getElementById('horizonPicker');
  const options = [['month', t('horizonMonth')], ['year', t('horizonYear')]];
  picker.innerHTML = options.map(([val, label]) =>
    `<button type="button" class="choice${formHorizon === val ? ' selected' : ''}" data-horizon="${val}">${escapeHtml(label)}</button>`
  ).join('');
  picker.querySelectorAll('[data-horizon]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formHorizon = btn.dataset.horizon;
      renderHorizonPicker();
    });
  });
}

const PENCIL_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

function renderCategoryPicker() {
  const picker = document.getElementById('categoryPicker');
  const chips = goalCategories.map((cat) =>
    `<button type="button" class="category-choice ${categoryColorClass(cat.id)}${formCategory === cat.id ? ' selected' : ''}" data-cat="${escapeHtml(cat.id)}">${escapeHtml(cat.label)}</button>`
  ).join('');
  // «Змінити» стоїть ЗА категоріями, а не перед ними: спершу вибір, і лише
  // тому, кому запропонованого не вистачило, — правка.
  picker.innerHTML = chips +
    `<button type="button" class="category-edit-chip" id="editCategoriesBtn" aria-label="${escapeHtml(t('catManageAria'))}">${PENCIL_ICON}${escapeHtml(t('catManageEdit'))}</button>`;
  picker.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => { formCategory = btn.dataset.cat; renderCategoryPicker(); });
  });
  document.getElementById('editCategoriesBtn').addEventListener('click', () => AppSettings.open('goals'));
}

// ---- Поля, що ростуть під текст ----
// Назва цілі й «навіщо тобі це» — textarea, і сама вона рости не вміє:
// лишається заввишки rows і ховає решту за власною смугою гортання. Обидва
// поля від цього страждали по-своєму: довгу назву доводилось гортати вбік по
// одному слову, а «навіщо» — крутити всередині віконця на три рядки, хоч
// перечитати його цілком і є те, заради чого поле існує.
//
// scrollHeight міряє вміст разом із внутрішніми полями, але БЕЗ рамки, а
// box-sizing у застосунку border-box — тобто висота має включати й рамку.
// Без цієї поправки поле щоразу було б на два пікселі нижчим за вміст, і в
// ньому лишалась би смуга гортання завширшки з рамку.
//
// `height: auto` перед виміром обовʼязковий: без нього поле, яке щойно було
// високим, тримало б стару висоту, і scrollHeight повертав би її ж — текст
// можна було б лише додавати, а стерши половину, порожнє місце нікуди б не
// поділось. CSS-ний min-height лишається підлогою: «навіщо» не стискається
// нижче трьох рядків навіть порожнє.
const GROW_FIELDS = ['goalTitleInput', 'goalWhyInput'];

function autoGrow(el) {
  if (!el) return;
  const cs = getComputedStyle(el);
  const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight + border) + 'px';
}

function growFormFields() {
  GROW_FIELDS.forEach((id) => autoGrow(document.getElementById(id)));
}

// Назва — один рядок тексту, хай навіть поле тепер багаторядкове. Enter у
// ньому зберігає ціль (як робив input у формі), а переноси, що приїхали
// вставкою, склеюємо пробілом: у картці й у списку назва все одно стоїть
// одним рядком, і зберігати в базі невидимий злам ні до чого.
function goalTitleValue() {
  return document.getElementById('goalTitleInput').value.replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

function openGoalForm(existingGoal) {
  editingGoalId = existingGoal ? existingGoal.id : null;
  document.getElementById('goalModalTitle').textContent = existingGoal ? t('editGoalTitle') : t('newGoalTitle');
  document.getElementById('deleteGoalBtn').style.display = existingGoal ? 'block' : 'none';
  document.getElementById('goalFormError').textContent = '';
  document.getElementById('goalTitleInput').value = existingGoal ? existingGoal.title : '';
  document.getElementById('goalWhyInput').value = existingGoal ? existingGoal.why || '' : '';
  // Категорія цілі, якщо вона ще є в списку. Якщо її видалили на іншому
  // пристрої — беремо запасну одразу тут, а не при збереженні: інакше форма
  // показувала б невибраний рядок, а зберігала б щось третє.
  const wantCategory = existingGoal ? existingGoal.category : fallbackCategoryId();
  formCategory = findGoalCategory(wantCategory) ? wantCategory : fallbackCategoryId();
  // Нова ціль народжується на тій вкладці, з якої її заводять: людина щойно
  // дивилась на місяць — значить, і думає про місяць.
  formHorizon = existingGoal ? horizonOf(existingGoal) : horizon;
  renderHorizonPicker();
  renderCategoryPicker();
  goalGuard.arm();
  document.getElementById('goalFormOverlay').classList.add('show');
  // Саме після show: у схованому вікні scrollHeight дорівнює нулю, і поля
  // згорнулись би в нитку.
  growFormFields();
  focusWhenIdle('goalTitleInput', 'goalFormOverlay');
}

// ---- Незбережені зміни ----
// Ціль описують довго: назва й «навіщо» пишуться абзацами.
// Спільна логіка — в ../unsaved-guard.js.
const goalGuard = UnsavedGuard.create({
  overlay: 'goalFormOverlay',
  snapshot: () => JSON.stringify({
    title: goalTitleValue(),
    why: document.getElementById('goalWhyInput').value.trim(),
    horizon: formHorizon,
    category: formCategory,
  }),
  save: () => saveGoalForm(),
  texts: () => ({
    title: t('unsavedTitle'), sub: t('unsavedSub'),
    save: t('unsavedSave'), discard: t('unsavedDiscard'), keep: t('unsavedKeep'),
  }),
});

document.getElementById('openNewGoalBtn').addEventListener('click', () => openGoalForm(null));
document.getElementById('closeGoalForm').addEventListener('click', () => goalGuard.requestClose());

document.getElementById('goalForm').addEventListener('submit', (e) => {
  e.preventDefault();
  saveGoalForm();
});

// Обидва поля ростуть разом із текстом — і від набору, і від вставки.
GROW_FIELDS.forEach((id) => {
  document.getElementById(id).addEventListener('input', (e) => autoGrow(e.target));
});

// Enter зберігає, а не додає рядок — але ЛИШЕ в назві: вона однорядкова, і в
// input на цьому місці Enter робив саме це. У «навіщо» він, навпаки, мусить
// лишитись переносом: там пишуть абзацами, і зберігати ціль на пів слові було
// б несподіванкою.
document.getElementById('goalTitleInput').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  saveGoalForm();
});

// Винесено з обробника події, бо збереження запускає ще й діалог
// «зберегти зміни перед виходом».
async function saveGoalForm() {
  const title = goalTitleValue();
  const errorEl = document.getElementById('goalFormError');
  if (!title) {
    errorEl.textContent = t('titleRequiredError');
    return;
  }
  errorEl.textContent = '';
  const uidCur = auth.currentUser && auth.currentUser.uid;
  if (!uidCur) return;

  const month = formHorizon === 'month' ? (existingMonthKey() || viewMonth) : null;

  const payload = {
    title,
    category: findGoalCategory(formCategory) ? formCategory : fallbackCategoryId(),
    why: document.getElementById('goalWhyInput').value.trim(),
    // Дедлайн НЕ питається окремим полем: для місячної цілі він уже сказаний
    // вибором місяця («зробити в серпні» = «до 31 серпня»), і просити людину
    // повторити це датою означало б питати двічі про одне. Річна ціль місяця
    // не має, тож лишається без дедлайну: рік — це напрямок, а не строк.
    targetDate: Review.deadlineForMonth(month),
    horizon: formHorizon === 'month' ? 'month' : 'year',
    // Місяць ціль отримує той, який зараз дивляться, — це й написано у формі.
    // Наявній місячній цілі свій місяць лишаємо: правка не має її переносити.
    month,
    // СПАДЩИНА. Віх у застосунку більше немає, але правила Firestore досі
    // вимагають це поле в кожній цілі, тож воно пишеться далі — і пишеться
    // тим, що вже лежить у документі: правка назви не має стирати те, що
    // людина колись записала.
    milestones: (editingGoalId
      ? (goals.find((g) => g.id === editingGoalId) || {}).milestones
      : null) || [],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const submitBtn = document.getElementById('goalSubmitBtn');
  submitBtn.disabled = true;
  try {
    const col = db.collection('users').doc(uidCur).collection('goals');
    if (editingGoalId) {
      await col.doc(editingGoalId).update(payload);
    } else {
      await col.add({
        ...payload,
        status: 'active',
        // СПАДЩИНА. Відміток у застосунку немає, але правило вимагає поле.
        checkins: [],
        // Нотатки цілі лежать саме тут — див. goals/review.js. Нова ціль
        // заводиться без них.
        journal: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    goalGuard.close();
    // Ціль зі щойно зміненим горизонтом інакше зникла б із очей: збережеш
    // річну, стоячи на «Місяці», — і здається, що запис не пройшов.
    if (payload.horizon !== horizon) selectHorizon(payload.horizon);
  } catch (err) {
    console.error('save goal:', err);
    errorEl.textContent = t('err_generic');
  } finally {
    submitBtn.disabled = false;
  }
}

document.getElementById('deleteGoalBtn').addEventListener('click', () => {
  if (!editingGoalId) return;
  pendingDeleteId = editingGoalId;
  // Питати «зберегти зміни?» перед видаленням безглуздо — зберігати нема куди.
  goalGuard.close();
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
    await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(pendingDeleteId).delete();
    if (activeDetailGoalId === pendingDeleteId) showDashboard();
  } catch (err) {
    console.error('delete goal:', err);
  }
  pendingDeleteId = null;
  document.getElementById('confirmOverlay').classList.remove('show');
});

// ---- Автентифікація: стан ----
// Головна вміє привести одразу у форму створення: «+» на ній відкриває
// список, а не змушує спершу знайти потрібний розділ. Хеш прибираємо, щоб
// оновлення сторінки не відкривало форму вдруге, а «назад» вело туди,
// звідки прийшли.
function openFromHash(open) {
  if (location.hash !== '#new') return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* file:// */ }
  // Даємо підписці домалювати перший кадр: форма читає наявні цілі, щоб
  // запропонувати річну як батька для місячної.
  setTimeout(open, 0);
}

// Автофокус на першому полі форми — але не за будь-яку ціну.
//
// Затримка потрібна, щоб поле встигло зʼявитись разом із вікном. Але за ці
// 50 мс людина (чи автотест) може вже почати заповнювати ІНШЕ поле — і тоді
// фокус стрибав туди, куди його ніхто не просив, а набране летіло не в те
// поле й тихо зникало. Тому забираємо фокус лише тоді, коли його ще ніхто
// не зайняв усередині цієї ж форми.
function focusWhenIdle(inputId, overlayId, delay) {
  setTimeout(function () {
    var input = document.getElementById(inputId);
    var overlay = overlayId ? document.getElementById(overlayId) : null;
    if (!input) return;
    var active = document.activeElement;
    if (overlay && active && active !== document.body && overlay.contains(active)) return;
    input.focus();
  }, delay || 50);
}

auth.onAuthStateChanged((user) => {
  document.getElementById('authLoading').style.display = 'none';
  if (user) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    subscribeToProfile(user.uid);
    subscribeToGoals(user.uid);
    AppNotes.start();
    openFromHash(() => openGoalForm(null));
  } else {
    if (unsubscribeGoals) { unsubscribeGoals(); unsubscribeGoals = null; }
    if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
    // Наступний, хто увійде, побачить стандартний список своєю мовою, а не
    // залишки чужого.
    goalCategories = defaultGoalCategoryList(currentLang, CATEGORY_SLOTS);
    usingDefaultCategories = true;
    goals = [];
    AppNotes.stop();
    showNotes(false);
    showDashboard();
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

// Вкладку могли лишити відкритою з обіду — тоді вечірній підсумок нізвідки
// не з'явиться, бо перерендеру не було. Повернення до вкладки — достатній
// привід перевірити годинник ще раз.
document.addEventListener('visibilitychange', () => {
});

// ---- Ініціалізація ----
// Вкладка запамʼятовується: людина, яка живе місячними цілями, не має щоразу
// перемикатись із «Року» після кожного відкриття.
document.getElementById('bnMonth').classList.toggle('active', horizon === 'month');
document.getElementById('bnYear').classList.toggle('active', horizon === 'year');
applyTheme();
applyTranslations();
renderAuthLangRow();
setAuthMode('login');
