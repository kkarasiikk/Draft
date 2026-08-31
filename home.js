// ---- Service Worker ----
// Реєструємо тут, а не інлайн у <script> в index.html, щоб CSP міг
// забороняти інлайн-скрипти (script-src без 'unsafe-inline') без винятків.
if ('serviceWorker' in navigator) {
  // updateViaCache:'none' — щоб і сам воркер, і його importScripts('sw-core.js')
  // бралися з мережі, а не з HTTP-кешу браузера. За замовчуванням ('imports')
  // імпорти віддаються з кешу, і оболонка, яку тримає sw-core, лишалась би
  // старою навіть після деплою: саме в цьому файлі живе версія збірки.
  window.addEventListener('load', () => navigator.serviceWorker
    .register('service-worker.js', { updateViaCache: 'none' })
    .catch(() => {}));
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
    settingsLabel: 'Налаштування', recordBtn: 'Записати',
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
    sumLoading: '…',
    sumBudget: (s) => `цього місяця ${s}`,
    sumTasksOpen: (n) => `${n} ${plural(n, { one: 'справа', few: 'справи', many: 'справ', other: 'справи' })} на сьогодні`,
    sumTasksFree: 'на сьогодні вільно',
    sumStreak: (n) => `серія ${n} ${plural(n, { one: 'день', few: 'дні', many: 'днів', other: 'дня' })}`,
    sumGoalsPending: (n) => `${n} без кроку сьогодні`,
    sumGoalsDone: 'усе відмічено',
    sumGoalsNone: 'цілей ще немає',
    sumWorkoutToday: 'сьогодні тренувався',
    sumPlanLeft: (v) => `лишилось ${v} з плану`,
    sumPlanOver: (v) => `перевитрата ${v}`,
    sumGoalDays: (days) => days < 0 ? 'дедлайн минув' : `${days} дн. лишилось`,
    sumWorkoutPlan: (n) => `на сьогодні заплановано ${n} ${plural(n, { one: 'вправу', few: 'вправи', many: 'вправ', other: 'вправи' })}`,
    sumWorkoutDoing: (a, b) => `сьогодні: ${a} з ${b} підходів`,
    sumWorkoutNoneToday: (n) => n <= 0
      ? 'сьогодні тренувань немає'
      : `сьогодні тренувань немає · востаннє ${n} ${plural(n, { one: 'день', few: 'дні', many: 'днів', other: 'дня' })} тому`,
    sumWorkoutAgo: (n) => `востаннє ${n} ${plural(n, { one: 'день', few: 'дні', many: 'днів', other: 'дня' })} тому`,
    sumWorkoutNever: 'тренувань ще немає',
    addExpense: 'Витрата', addExpenseHint: 'сума, категорія, опис',
    addTask: 'Завдання', addTaskHint: 'на сьогодні або з датою',
    addGoalStep: 'Крок до цілі',
    addGoalStepHint: (n) => `${n} ${plural(n, { one: 'ціль', few: 'цілі', many: 'цілей', other: 'цілі' })} без кроку`,
    addGoalStepNone: 'сьогодні всі відмічені', addGoalStepNoGoals: 'цілей ще немає',
    addGoal: 'Нова ціль', addGoalHint: 'на місяць або на рік',
    addGoalPickHint: 'зарахувати крок',
    addWorkout: 'Тренування', addWorkoutHint: 'вправи й підходи',
    todayTitle: 'Сьогодні',
    todayCount: (n) => `${n} ${plural(n, { one: 'пункт', few: 'пункти', many: 'пунктів', other: 'пункту' })}`,
    todayMore: (n) => `Побачити ще ${n}`,
    unitToday: 'на сьогодні', unitDays: 'дн.', unitActive: 'активних',
    unitSets: 'підходів', unitExercises: 'вправ', unitDaysAgo: 'дні тому',
    capSpent: (m) => `витрачено за ${m}`, capStreak: 'найдовша серія',
    capNoStep: (n) => `${n} без кроку`,
    capDone: (n) => `${n} вже ${plural(n, { one: 'закрито', few: 'закрито', many: 'закрито', other: 'закрито' })}`,
    capPlanned: 'заплановано на сьогодні', capDoing: 'сьогодні зроблено',
    capLast: (name) => `останнє — ${name}`, capLastPlain: 'від останнього',
    todayEmpty: 'На сьогодні нічого не чекає.',
    todayAt: (hhmm) => `до ${hhmm}`,
    todayNoStep: 'сьогодні без кроку',
    todayStepBtn: 'Крок', todayLogBtn: 'Записати',
    lineGoals: (n) => `${n} ${plural(n, { one: 'ціль', few: 'цілі', many: 'цілей', other: 'цілі' })} без кроку`,
    lineWorkout: (n) => `${n} ${plural(n, { one: 'день', few: 'дні', many: 'днів', other: 'дня' })} без залу`,
    lineFree: 'Сьогодні нічого не чекає.',
    goalsTitle: 'Цілі', goalsSub: 'довгострокові',
    tasksTitle: 'Завдання', tasksSub: 'на кожен день',
    workoutTitle: 'Тренування', workoutSub: 'сесії й рекорди',
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
    settingsLabel: 'Настройки', recordBtn: 'Записать',
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
    sumLoading: '…',
    sumBudget: (s) => `в этом месяце ${s}`,
    sumTasksOpen: (n) => `${n} ${plural(n, { one: 'дело', few: 'дела', many: 'дел', other: 'дела' })} на сегодня`,
    sumTasksFree: 'на сегодня свободно',
    sumStreak: (n) => `серия ${n} ${plural(n, { one: 'день', few: 'дня', many: 'дней', other: 'дня' })}`,
    sumGoalsPending: (n) => `${n} без шага сегодня`,
    sumGoalsDone: 'всё отмечено',
    sumGoalsNone: 'целей пока нет',
    sumWorkoutToday: 'сегодня тренировался',
    sumPlanLeft: (v) => `осталось ${v} из плана`,
    sumPlanOver: (v) => `перерасход ${v}`,
    sumGoalDays: (days) => days < 0 ? 'дедлайн прошёл' : `${days} дн. осталось`,
    sumWorkoutPlan: (n) => `на сегодня запланировано ${n} ${plural(n, { one: 'упражнение', few: 'упражнения', many: 'упражнений', other: 'упражнения' })}`,
    sumWorkoutDoing: (a, b) => `сегодня: ${a} из ${b} подходов`,
    sumWorkoutNoneToday: (n) => n <= 0
      ? 'сегодня тренировок нет'
      : `сегодня тренировок нет · последний раз ${n} ${plural(n, { one: 'день', few: 'дня', many: 'дней', other: 'дня' })} назад`,
    sumWorkoutAgo: (n) => `последний раз ${n} ${plural(n, { one: 'день', few: 'дня', many: 'дней', other: 'дня' })} назад`,
    sumWorkoutNever: 'тренировок пока нет',
    addExpense: 'Расход', addExpenseHint: 'сумма, категория, описание',
    addTask: 'Задача', addTaskHint: 'на сегодня или с датой',
    addGoalStep: 'Шаг к цели',
    addGoalStepHint: (n) => `${n} ${plural(n, { one: 'цель', few: 'цели', many: 'целей', other: 'цели' })} без шага`,
    addGoalStepNone: 'сегодня все отмечены', addGoalStepNoGoals: 'целей ещё нет',
    addGoal: 'Новая цель', addGoalHint: 'на месяц или на год',
    addGoalPickHint: 'засчитать шаг',
    addWorkout: 'Тренировка', addWorkoutHint: 'упражнения и подходы',
    todayTitle: 'Сегодня',
    todayCount: (n) => `${n} ${plural(n, { one: 'пункт', few: 'пункта', many: 'пунктов', other: 'пункта' })}`,
    todayMore: (n) => `Посмотреть ещё ${n}`,
    unitToday: 'на сегодня', unitDays: 'дн.', unitActive: 'активных',
    unitSets: 'подходов', unitExercises: 'упражнений', unitDaysAgo: 'дня назад',
    capSpent: (m) => `потрачено за ${m}`, capStreak: 'самая длинная серия',
    capNoStep: (n) => `${n} без шага`,
    capDone: (n) => `${n} уже закрыто`,
    capPlanned: 'запланировано на сегодня', capDoing: 'сегодня сделано',
    capLast: (name) => `последняя — ${name}`, capLastPlain: 'от последней',
    todayEmpty: 'На сегодня ничего не ждёт.',
    todayAt: (hhmm) => `до ${hhmm}`,
    todayNoStep: 'сегодня без шага',
    todayStepBtn: 'Шаг', todayLogBtn: 'Записать',
    lineGoals: (n) => `${n} ${plural(n, { one: 'цель', few: 'цели', many: 'целей', other: 'цели' })} без шага`,
    lineWorkout: (n) => `${n} ${plural(n, { one: 'день', few: 'дня', many: 'дней', other: 'дня' })} без зала`,
    lineFree: 'Сегодня ничего не ждёт.',
    goalsTitle: 'Цели', goalsSub: 'долгосрочные',
    tasksTitle: 'Задачи', tasksSub: 'на каждый день',
    workoutTitle: 'Тренировки', workoutSub: 'сессии и рекорды',
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
    settingsLabel: 'Ustawienia', recordBtn: 'Zapisz',
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
    sumLoading: '…',
    sumBudget: (s) => `w tym miesiącu ${s}`,
    sumTasksOpen: (n) => `${n} ${plural(n, { one: 'zadanie', few: 'zadania', many: 'zadań', other: 'zadania' })} na dziś`,
    sumTasksFree: 'na dziś wolne',
    sumStreak: (n) => `seria ${n} ${plural(n, { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' })}`,
    sumGoalsPending: (n) => `${n} bez kroku dziś`,
    sumGoalsDone: 'wszystko odhaczone',
    sumGoalsNone: 'nie ma jeszcze celów',
    sumWorkoutToday: 'dziś trenowałeś',
    sumPlanLeft: (v) => `zostało ${v} z planu`,
    sumPlanOver: (v) => `przekroczenie o ${v}`,
    sumGoalDays: (days) => days < 0 ? 'termin minął' : `zostało ${days} dni`,
    sumWorkoutPlan: (n) => `na dziś zaplanowano ${n} ${plural(n, { one: 'ćwiczenie', few: 'ćwiczenia', many: 'ćwiczeń', other: 'ćwiczenia' })}`,
    sumWorkoutDoing: (a, b) => `dziś: ${a} z ${b} serii`,
    sumWorkoutNoneToday: (n) => n <= 0
      ? 'dziś brak treningu'
      : `dziś brak treningu · ostatnio ${n} ${plural(n, { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' })} temu`,
    sumWorkoutAgo: (n) => `ostatnio ${n} ${plural(n, { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' })} temu`,
    sumWorkoutNever: 'nie ma jeszcze treningów',
    addExpense: 'Wydatek', addExpenseHint: 'kwota, kategoria, opis',
    addTask: 'Zadanie', addTaskHint: 'na dziś lub z datą',
    addGoalStep: 'Krok do celu',
    addGoalStepHint: (n) => `${n} ${plural(n, { one: 'cel', few: 'cele', many: 'celów', other: 'celu' })} bez kroku`,
    addGoalStepNone: 'dziś wszystkie odhaczone', addGoalStepNoGoals: 'nie ma jeszcze celów',
    addGoal: 'Nowy cel', addGoalHint: 'na miesiąc lub na rok',
    addGoalPickHint: 'zalicz krok',
    addWorkout: 'Trening', addWorkoutHint: 'ćwiczenia i serie',
    todayTitle: 'Dziś',
    todayCount: (n) => `${n} ${plural(n, { one: 'pozycja', few: 'pozycje', many: 'pozycji', other: 'pozycji' })}`,
    todayMore: (n) => `Zobacz jeszcze ${n}`,
    unitToday: 'na dziś', unitDays: 'dni', unitActive: 'aktywnych',
    unitSets: 'serii', unitExercises: 'ćwiczeń', unitDaysAgo: 'dni temu',
    capSpent: (m) => `wydano w ${m}`, capStreak: 'najdłuższa seria',
    capNoStep: (n) => `${n} bez kroku`,
    capDone: (n) => `${n} już zamknięto`,
    capPlanned: 'zaplanowano na dziś', capDoing: 'dziś zrobione',
    capLast: (name) => `ostatni — ${name}`, capLastPlain: 'od ostatniego',
    todayEmpty: 'Na dziś nic nie czeka.',
    todayAt: (hhmm) => `do ${hhmm}`,
    todayNoStep: 'dziś bez kroku',
    todayStepBtn: 'Krok', todayLogBtn: 'Zapisz',
    lineGoals: (n) => `${n} ${plural(n, { one: 'cel', few: 'cele', many: 'celów', other: 'celu' })} bez kroku`,
    lineWorkout: (n) => `${n} ${plural(n, { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' })} bez siłowni`,
    lineFree: 'Na dziś nic nie czeka.',
    goalsTitle: 'Cele', goalsSub: 'długoterminowe',
    tasksTitle: 'Zadania', tasksSub: 'na każdy dzień',
    workoutTitle: 'Treningi', workoutSub: 'sesje i rekordy',
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
    settingsLabel: 'Settings', recordBtn: 'Add',
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
    sumLoading: '…',
    sumBudget: (s) => `this month ${s}`,
    sumTasksOpen: (n) => `${n} ${plural(n, { one: 'task', other: 'tasks' })} today`,
    sumTasksFree: 'nothing due today',
    sumStreak: (n) => `${n}-day streak`,
    sumGoalsPending: (n) => `${n} with no step today`,
    sumGoalsDone: 'all checked in',
    sumGoalsNone: 'no goals yet',
    sumWorkoutToday: 'trained today',
    sumPlanLeft: (v) => `${v} left of the plan`,
    sumPlanOver: (v) => `${v} over the plan`,
    sumGoalDays: (days) => days < 0 ? 'deadline passed' : `${days} days left`,
    sumWorkoutPlan: (n) => `${n} ${n === 1 ? 'exercise' : 'exercises'} planned for today`,
    sumWorkoutDoing: (a, b) => `today: ${a} of ${b} sets`,
    sumWorkoutNoneToday: (n) => n <= 0
      ? 'no workout today'
      : `no workout today · last one ${n} ${n === 1 ? 'day' : 'days'} ago`,
    sumWorkoutAgo: (n) => `last ${n} ${plural(n, { one: 'day', other: 'days' })} ago`,
    sumWorkoutNever: 'no workouts yet',
    addExpense: 'Expense', addExpenseHint: 'amount, category, note',
    addTask: 'Task', addTaskHint: 'for today or with a date',
    addGoalStep: 'Step toward a goal',
    addGoalStepHint: (n) => `${n} ${plural(n, { one: 'goal', other: 'goals' })} without a step`,
    addGoalStepNone: 'all marked today', addGoalStepNoGoals: 'no goals yet',
    addGoal: 'New goal', addGoalHint: 'monthly or yearly',
    addGoalPickHint: 'count the step',
    addWorkout: 'Workout', addWorkoutHint: 'exercises and sets',
    todayTitle: 'Today',
    todayCount: (n) => `${n} ${plural(n, { one: 'item', other: 'items' })}`,
    todayMore: (n) => `See ${n} more`,
    unitToday: 'today', unitDays: 'days', unitActive: 'active',
    unitSets: 'sets', unitExercises: 'exercises', unitDaysAgo: 'days ago',
    capSpent: (m) => `spent in ${m}`, capStreak: 'longest streak',
    capNoStep: (n) => `${n} without a step`,
    capDone: (n) => `${n} already done`,
    capPlanned: 'planned for today', capDoing: 'done today',
    capLast: (name) => `last — ${name}`, capLastPlain: 'since the last one',
    todayEmpty: 'Nothing waiting today.',
    todayAt: (hhmm) => `by ${hhmm}`,
    todayNoStep: 'no step today',
    todayStepBtn: 'Step', todayLogBtn: 'Log',
    lineGoals: (n) => `${n} ${plural(n, { one: 'goal', other: 'goals' })} without a step`,
    lineWorkout: (n) => `${n} ${plural(n, { one: 'day', other: 'days' })} without the gym`,
    lineFree: 'Nothing waiting today.',
    goalsTitle: 'Goals', goalsSub: 'long-term',
    tasksTitle: 'Tasks', tasksSub: 'day to day',
    workoutTitle: 'Workouts', workoutSub: 'sessions & records',
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

// ---- Бічна колонка розділів ----
// Ставимо ДО applyTranslations(): він перекладає її нижні рядки, а обробники
// на них навішуються далі по файлу — обох треба, щоб колонка вже була в DOM.
// Експорт і тема живуть тільки тут: на сторінках розділів цих рядків немає,
// бо кнопка, яка веде на іншу сторінку щось зробити, — це не кнопка.
window.SideNav.mount(document.getElementById('sideNavHost'), {
  current: 'home',
  lang: currentLang,
  extra: [
    { id: 'sideExportBtn', labelId: 'sideExportLabel', label: t('exportLabel'),
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>' },
    { id: 'sideSettingsBtn', labelId: 'sideSettingsLabel', label: t('settingsLabel'),
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4"/></svg>' },
  ],
});

function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  document.getElementById('themeMenuLabel').textContent = t('themeLabel');
  document.getElementById('langMenuLabel').textContent = t('langLabel');
  document.getElementById('exportLabel').textContent = t('exportLabel');
  document.getElementById('logoutLabel').textContent = t('logout');
  // Назви розділів у колонці живуть у side-nav.js — одні на пʼять сторінок.
  window.SideNav.setLang(currentLang);
  document.getElementById('sideExportLabel').textContent = t('exportLabel');
  document.getElementById('sideSettingsLabel').textContent = t('settingsLabel');
  document.getElementById('recordBtnLabel').textContent = t('recordBtn');
  document.getElementById('recordBtn').setAttribute('aria-label', t('recordBtn'));
  document.getElementById('todayTitle').textContent = t('todayTitle');
  // Дата й рядок стану залежать від мови так само, як підписи, — і мова
  // може перемкнутись уже після того, як дані прийшли.
  renderLine();
  renderToday();
  renderCalendar();
  document.getElementById('budgetTitle').textContent = t('budgetTitle');
  document.getElementById('budgetSub').textContent = t('budgetSub');
  document.getElementById('goalsTitle').textContent = t('goalsTitle');
  document.getElementById('goalsSub').textContent = t('goalsSub');
  document.getElementById('tasksTitle').textContent = t('tasksTitle');
  document.getElementById('tasksSub').textContent = t('tasksSub');
  document.getElementById('workoutTitle').textContent = t('workoutTitle');
  document.getElementById('workoutSub').textContent = t('workoutSub');
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
// Сирі дані, з яких збираються «Сьогодні», рядок під датою і сітка тижня.
// Кожен запит домальовує свою частину, щойно долетить: чекати на найповільніший,
// щоб показати все разом, означало б дивитись на порожній екран довше, ніж треба.
// Скільки назв показувати в дні. Більше — і смуга починає важити більше за
// сам список справ під нею; менше — і тиждень нічого не каже.
const CAL_CHIPS = 2;

let homeData = { transactions: null, tasks: null, goals: null, workouts: null };
// Валюта з профілю — той самий документ, що вже читається заради мови й теми.
let homeCurrency = '';

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
// На телефоні меню відкриває гамбургер, на комп'ютері — «Налаштування» в
// бічній колонці. Кнопки різні, меню одне.
function toggleAppMenu() {
  const overlay = document.getElementById('appMenuOverlay');
  const isOpen = overlay.classList.toggle('show');
  document.getElementById('menuBtn').classList.toggle('open', isOpen);
}
document.getElementById('menuBtn').addEventListener('click', toggleAppMenu);
document.getElementById('sideSettingsBtn').addEventListener('click', toggleAppMenu);
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
        colStatus: 'Статус', colDeadline: 'Дедлайн',
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
        colStatus: 'Статус', colDeadline: 'Дедлайн',
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
        colStatus: 'Status', colDeadline: 'Termin',
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
        colStatus: 'Status', colDeadline: 'Deadline',
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


// ---- Живі підсумки на плитках ----
// Головна — екран, з якого заходять щоразу, а показувала вона лише назви
// розділів. Тепер кожна плитка відповідає на питання, заради якого в розділ і
// заходять. Арифметика — у home-summary.js (чисті функції, покриті тестами),
// тут лише запити й тексти.
//
// Кожен запит свідомо звужений: місяць / сьогодні / останній запис. Читати
// всю базу заради чотирьох чисел на кожне відкриття головної було б платою
// без причини.
function todayISO() {
  return HomeSummary.isoOf(new Date());
}

// Плитка називає головне число розділу: великим — саме число, дрібним —
// одиницю, під ним — за що воно, і окремим рядком те, що вимагає уваги.
// Кільця пішли разом із кнопкою «Відкрити»: число читається швидше за дугу
// й не потребує пояснень.
function setStat(key, value, unit, caption, note) {
  const stat = document.getElementById(key + 'Stat');
  const unitEl = document.getElementById(key + 'Unit');
  const cap = document.getElementById(key + 'Sub');
  const noteEl = document.getElementById(key + 'Note');
  if (stat) stat.textContent = value;
  if (unitEl) unitEl.textContent = unit || '';
  if (cap) cap.textContent = caption || '';
  if (noteEl) {
    noteEl.textContent = note || '';
    noteEl.hidden = !note;
  }
}

// ---- «Сьогодні»: один список із трьох розділів ----
// Щоб відмітити справу й крок до цілі, раніше треба було зайти у два розділи
// й вийти назад. Тепер типовий день закривається, не виходячи з головної.
// Два пункти й «побачити більше»: головна відповідає на «що зараз», а не
// заміняє собою розділ завдань. Довгий список тут витіснив би тиждень і
// плитки за межу екрана.
const TODAY_TASK_LIMIT = 2;

function renderToday() {
  const panel = document.getElementById('todayPanel');
  const list = document.getElementById('todayList');
  if (!panel || !list) return;
  const today = todayISO();
  let html = '';

  let count = 0;
  if (homeData.tasks) {
    // Тільки сьогоднішні. Невиконане з минулих днів лишається у своєму дні:
    // воно не стає справою на сьогодні від того, що день минув, і тягнути
    // його сюди означало б показувати борг замість дня.
    const mine = homeData.tasks.filter((x) => x && x.dueDate === today);
    // Невиконане згори: закреслене вже нікуди не поспішає.
    mine.sort((a, b) => (a.done === b.done ? 0 : (a.done ? 1 : -1)));
    count += mine.length;
    // Показуємо лише два: головна відповідає на «що зараз», а не заміняє
    // собою розділ. Решта — за посиланням.
    const shownTasks = mine.slice(0, TODAY_TASK_LIMIT);
    const hidden = mine.length - shownTasks.length;

    html += shownTasks.map((task) => `
      <div class="today-row${task.done ? ' checked' : ''}">
        <button type="button" class="today-box${task.done ? ' checked' : ''}" data-task="${escapeHtml(task.id)}" aria-label="${escapeHtml(task.title || '')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>
        </button>
        <span class="today-name">${escapeHtml(task.title || '')}</span>
        <span class="today-spacer"></span>
        ${task.dueTime ? `<span class="today-when">${escapeHtml(t('todayAt', task.dueTime))}</span>` : ''}
      </div>`).join('');
    if (hidden > 0) {
      html += `<a class="today-more" href="tasks/index.html">${escapeHtml(t('todayMore', hidden))}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></a>`;
    }
  }

  // Ціль без сьогоднішнього кроку. Черга та сама, що й у вечірній картці
  // розділу: друге правило «яку ціль питати» розійшлося б із першим.
  if (homeData.goals && window.GoalStreak) {
    const pending = window.GoalStreak.eveningQueue(homeData.goals, today);
    count += pending.length;
    html += pending.slice(0, 2).map((g) => `
      <div class="today-row">
        <span class="today-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg></span>
        <span class="today-name">${escapeHtml(g.title || '')}</span>
        <span class="today-spacer"></span>
        <span class="today-when">${escapeHtml(t('todayNoStep'))}</span>
        <button type="button" class="today-go" data-goal-step="${escapeHtml(g.id)}">${escapeHtml(t('todayStepBtn'))}</button>
      </div>`).join('');
  }

  if (homeData.workouts) {
    const wt = HomeSummary.workoutToday(homeData.workouts, today);
    const sum = HomeSummary.workoutSummary(homeData.workouts, today);
    if (!wt) {
      count += 1;
      html += `
        <div class="today-row">
          <span class="today-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6.5 8v8"/><path d="M17.5 8v8"/><path d="M3.5 10.5v3"/><path d="M20.5 10.5v3"/><path d="M6.5 12h11"/></svg></span>
          <span class="today-name">${escapeHtml(sum.daysAgo === null ? t('sumWorkoutNever') : t('sumWorkoutAgo', sum.daysAgo))}</span>
          <span class="today-spacer"></span>
          <a class="today-go" href="workout/index.html">${escapeHtml(t('todayLogBtn'))}</a>
        </div>`;
    }
  }

  // Порожній список — теж відповідь, і ховати панель не треба: «нічого не
  // чекає» це новина, а не відсутність новин.
  const ready = homeData.tasks || homeData.goals || homeData.workouts;
  panel.hidden = !ready;
  list.innerHTML = html || `<div class="today-empty">${escapeHtml(t('todayEmpty'))}</div>`;
  const countEl = document.getElementById('todayCount');
  if (countEl) countEl.textContent = count ? t('todayCount', count) : '';

  list.querySelectorAll('[data-task]').forEach((btn) => {
    btn.addEventListener('click', () => toggleHomeTask(btn.dataset.task));
  });
  list.querySelectorAll('[data-goal-step]').forEach((btn) => {
    btn.addEventListener('click', () => stepHomeGoal(btn.dataset.goalStep));
  });
}

// Обидва записи — ті самі поля, що пише сам розділ: інакше документ не
// пройшов би правила, а сторінка розділу не знала б, що з ним робити.
async function toggleHomeTask(taskId) {
  const task = (homeData.tasks || []).find((x) => x.id === taskId);
  if (!task || !auth.currentUser) return;
  const done = !task.done;
  task.done = done;
  task.completedAt = done ? new Date() : null;
  renderToday();
  await db.collection('users').doc(auth.currentUser.uid).collection('tasks').doc(taskId).update({
    done,
    completedAt: done ? firebase.firestore.FieldValue.serverTimestamp() : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('toggleHomeTask:', err));
  // Виконане завдання, привʼязане до цілі, відмічає її день — так само, як
  // у самому розділі завдань.
  if (done && task.goalId) stepHomeGoal(task.goalId);
}

async function stepHomeGoal(goalId) {
  const goal = (homeData.goals || []).find((g) => g.id === goalId);
  if (!goal || !auth.currentUser || !window.GoalStreak) return;
  const result = window.GoalStreak.applyCheckin(goal, todayISO());
  if (!result) return;
  goal.checkins = result.checkins;
  renderToday();
  renderCalendar();
  renderLine();
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    checkins: result.checkins,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('stepHomeGoal:', err));
}

// ---- «+»: одна кнопка на всі чотири розділи ----
// Щоб записати витрату, треба було спершу зайти в Бюджет, знайти кнопку й
// лише тоді відкрити форму. Тепер шторка веде одразу у потрібну форму —
// модулі відкривають її за #new у адресі.
//
// «Крок до цілі» — виняток: це не форма, а один тап, і код для нього на
// головній уже є. Тому рядок не веде нікуди, а розкриває список активних
// цілей просто тут.
const ADD_ICONS = {
  expense: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/></svg>',
  task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5l2 2 3.5-3.5"/><path d="M3 17.5l2 2 3.5-3.5"/><path d="M12 7h9"/><path d="M12 18h9"/></svg>',
  goal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  newGoal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="13" r="7.5"/><circle cx="11" cy="13" r="3.4"/><path d="M18.5 3v6M21.5 6h-6"/></svg>',
  workout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6.5 8v8"/><path d="M17.5 8v8"/><path d="M3.5 10.5v3"/><path d="M20.5 10.5v3"/><path d="M6.5 12h11"/></svg>',
};
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';

function addRow(kind, name, hint, href, attr) {
  const inner = `
    <span class="add-ico">${ADD_ICONS[kind]}</span>
    <span class="add-text"><span class="add-name">${escapeHtml(name)}</span>
      <span class="add-hint">${escapeHtml(hint)}</span></span>
    <span class="add-arrow">${ARROW}</span>`;
  if (href) return `<a class="add-row" href="${href}">${inner}</a>`;
  return `<button type="button" class="add-row" ${attr}>${inner}</button>`;
}

function renderAddSheet() {
  const host = document.getElementById('addChoices');
  if (!host) return;

  // Крок можна зарахувати лише в ціль, яку сьогодні ще не відмічали, — та
  // сама черга, що й у списку «Сьогодні».
  const pending = (homeData.goals && window.GoalStreak)
    ? window.GoalStreak.eveningQueue(homeData.goals, todayISO()) : [];
  // Коли крок нема куди зарахувати, рядка просто немає: неактивний він лише
  // займав місце й читався як поламаний. Завести ціль однаково є чим —
  // рядок «Нова ціль» стоїть поруч.
  host.innerHTML = [
    addRow('expense', t('addExpense'), t('addExpenseHint'), 'budget/index.html#new'),
    addRow('task', t('addTask'), t('addTaskHint'), 'tasks/index.html#new'),
    pending.length
      ? addRow('goal', t('addGoalStep'), t('addGoalStepHint', pending.length), null, 'data-add-goal')
      : '',
    addRow('newGoal', t('addGoal'), t('addGoalHint'), 'goals/index.html#new'),
    addRow('workout', t('addWorkout'), t('addWorkoutHint'), 'workout/index.html#new'),
  ].join('');

  const goalBtn = host.querySelector('[data-add-goal]');
  if (goalBtn) goalBtn.addEventListener('click', () => renderAddGoalList(pending));
}

/** Другий крок: яку саме ціль відмітити. Заголовка немає — рядки з тим самим
 *  значком і назвами цілей самі кажуть, що обирають; підпис «крок» лишається
 *  на кожному, щоб дія не загубилась. */
function renderAddGoalList(pending) {
  const host = document.getElementById('addChoices');
  host.innerHTML = pending
    .map((g) => addRow('goal', g.title || '', t('addGoalPickHint'), null, `data-step="${escapeHtml(g.id)}"`))
    .join('');
  host.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      stepHomeGoal(btn.dataset.step);
      closeAddSheet();
    });
  });
}

// Прокрутку під шторкою тримає scroll-lock.js: він стежить за класом `show`
// на відомих йому оверлеях, тож смикати замок звідси не треба — досить, що
// `.add-overlay.show` є в його списку.
function openAddSheet() {
  renderAddSheet();
  document.getElementById('addOverlay').classList.add('show');
  document.getElementById('addFab').classList.add('open');
  document.getElementById('recordBtn').classList.add('open');
}

function closeAddSheet() {
  document.getElementById('addOverlay').classList.remove('show');
  document.getElementById('addFab').classList.remove('open');
  document.getElementById('recordBtn').classList.remove('open');
}

// Обидві кнопки — одна дія: на телефоні видно «+», на комп'ютері «Записати».
function toggleAddSheet() {
  const open = document.getElementById('addOverlay').classList.contains('show');
  if (open) closeAddSheet(); else openAddSheet();
}
document.getElementById('addFab').addEventListener('click', toggleAddSheet);
document.getElementById('recordBtn').addEventListener('click', toggleAddSheet);
document.getElementById('addOverlay').addEventListener('click', (e) => {
  // Тап повз аркуш закриває: усередині нього клік не має нічого закривати.
  if (e.target.id === 'addOverlay') closeAddSheet();
});

// ---- Календар тижня ----
// Показує саме календарний тиждень (пн—нд), а не останні сім днів: день має
// стояти там, де він стоїть у місяці. Крапка означає рівно одне — на цей
// день є завдання.
function renderCalendar() {
  const monthEl = document.getElementById('calMonth');
  const weekEl = document.getElementById('calWeek');
  if (!monthEl || !weekEl) return;

  const today = todayISO();
  const week = HomeSummary.weekCalendar(homeData.tasks || [], today);
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const dow = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const month = new Intl.DateTimeFormat(locale, { month: 'long' });

  // Тиждень може лежати на межі двох місяців — тоді один підпис збрехав би.
  const first = month.format(new Date(week.from + 'T00:00:00'));
  const last = month.format(new Date(week.to + 'T00:00:00'));
  monthEl.textContent = first === last ? first : `${first} — ${last}`;

  weekEl.innerHTML = week.days.map((d) => {
    const cls = ['cal-day'];
    if (d.today) cls.push('today');
    if (d.past) cls.push('past');
    // Два чипи — стільки вміщається в колонку, не роблячи смугу вищою за
    // сам список справ під нею. Решта згортається в «+N»: це вже привід
    // відкрити день, а не читати його згори.
    const shown = d.items.slice(0, CAL_CHIPS);
    const rest = d.items.length - shown.length;
    return `
      <div class="${cls.join(' ')}">
        <span class="cal-dow">${escapeHtml(dow.format(new Date(d.date + 'T00:00:00')))}</span>
        <span class="cal-num">${d.dayNum}</span>
        <span class="cal-items">
          ${shown.map((it) => `<span class="cal-chip${it.done ? ' done' : ''}" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</span>`).join('')}
          ${rest > 0 ? `<span class="cal-more">+${rest}</span>` : ''}
        </span>
      </div>`;
  }).join('');
}

// ---- Рядок під датою ----
// Увесь стан життя за секунду читання, ще до того, як око кудись поїхало.
function renderLine() {
  const lineEl = document.getElementById('todayLine');
  if (!lineEl) return;
  const today = todayISO();

  const dateEl = document.getElementById('todayDate');
  if (dateEl) dateEl.textContent = capitalizeFirst(formatFullDate(today));

  const parts = [];
  if (homeData.tasks) {
    const open = homeData.tasks.filter((x) => x && !x.done && x.dueDate === today).length;
    if (open) parts.push(t('sumTasksOpen', open));
  }
  if (homeData.goals && window.GoalStreak) {
    const pending = window.GoalStreak.eveningQueue(homeData.goals, today).length;
    if (pending) parts.push(t('lineGoals', pending));
  }
  if (homeData.workouts) {
    const sum = HomeSummary.workoutSummary(homeData.workouts, today);
    if (sum.daysAgo !== null && sum.daysAgo > 0) parts.push(t('lineWorkout', sum.daysAgo));
  }
  // Нічого не чекає — так і кажемо. Порожній рядок виглядав би як помилка
  // завантаження, а не як вільний день.
  lineEl.textContent = parts.length ? capitalizeFirst(parts.join(', ')) + '.' : t('lineFree');
}

function capitalizeFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

/** День тижня, число й місяць: «Субота, 29 серпня».
 *
 *  День тижня береться окремим форматом навмисно. В одному шаблоні з датою
 *  українська ICU ставить його в знахідному — виходило «Суботу, 29 серпня»,
 *  ніби речення обірвали на півслові. Окремо він у називному, як і треба
 *  підпису. */
function formatFullDate(iso) {
  if (!iso) return '';
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const date = new Date(iso + 'T00:00:00');
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
  const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
  return `${weekday}, ${dayMonth}`;
}

async function loadHomeSummary(uid) {
  const userRef = db.collection('users').doc(uid);
  const today = todayISO();
  const monthFrom = HomeSummary.monthStart(today);
  // Календар показує ВЕСЬ тиждень, зокрема дні попереду, тож завдання
  // читаються і наперед. Межі беремо ширші з двох: місяць потрібен плиткам,
  // тиждень — крапкам у календарі, і на межі місяця вони не збігаються.
  const cal = HomeSummary.weekCalendar([], today);
  const taskFrom = monthFrom < cal.from ? monthFrom : cal.from;
  const taskTo = today > cal.to ? today : cal.to;
  homeData = { transactions: null, tasks: null, goals: null, workouts: null };

  // Бюджет: лише поточний місяць.
  // План витрат читаємо з профілю тим самим запитом, що вже потрібен для мови
  // й теми, — окремого звернення заради одного числа не робимо.
  const txPromise = userRef.collection('transactions').where('date', '>=', monthFrom).where('date', '<=', today).get();
  Promise.all([txPromise, userRef.get()])
    .then(([snap, profileDoc]) => {
      const monthTxs = snap.docs.map((d) => d.data());
      homeData.transactions = monthTxs;
      const sum = HomeSummary.budgetSummary(monthTxs, today);
      // Знак ставимо тут, а не в перекладі: у переклад має приходити готовий
      // рядок, інакше кожна мова мусила б сама вирішувати, як його показати.
      const profile = profileDoc.data() || {};
      homeCurrency = typeof profile.currency === 'string' ? profile.currency : '';
      const plan = profile.monthlyBudget;
      const ring = HomeSummary.budgetRing(monthTxs, today, plan);
      const monthName = new Intl.DateTimeFormat(LOCALE_MAP[currentLang] || 'uk-UA', { month: 'long' })
        .format(new Date(today + 'T00:00:00'));
      if (!ring) {
        // Без плану головне число — витрачене за місяць: воно й відповідає
        // на питання, з яким у бюджет заходять.
        setStat('budget', formatAmount(sum.expense), homeCurrency,
          t('capSpent', monthName), null);
        return;
      }
      // З планом плитка відповідає на інше питання — не «скільки лишилось
      // у балансі», а «скільки лишилось до межі». Саме заради нього план і
      // заводять, тож воно й витісняє баланс.
      setStat('budget', formatAmount(sum.expense), homeCurrency,
        t('capSpent', monthName),
        ring.over ? t('sumPlanOver', formatAmount(-ring.left)) : t('sumPlanLeft', formatAmount(ring.left)));
    })
    .catch((err) => console.error('homeSummary budget:', err));

  // Завдання: від початку місяця до сьогодні — один діапазон по одному полю,
  // тож складений індекс не потрібен. Борги давніші за місяць сюди не
  // потраплять: для них у самому модулі є «розбір минулих днів».
  userRef.collection('tasks').where('dueDate', '>=', taskFrom).where('dueDate', '<=', taskTo).get()
    .then((snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      homeData.tasks = docs;
      renderToday();
      renderLine();
      const sum = HomeSummary.tasksSummary(docs, today);
      const ring = HomeSummary.tasksRing(docs, today);
      setStat('tasks', String(sum.open), t('unitToday'),
        ring.done ? t('capDone', ring.done) : t('sumTasksFree'), null);
    })
    .catch((err) => console.error('homeSummary tasks:', err));

  // Цілі: їх завжди небагато, тож читаємо всі.
  userRef.collection('goals').get()
    .then((snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      homeData.goals = docs;
      renderToday();
      renderCalendar();
      renderLine();
      const sum = HomeSummary.goalsSummary(docs, today);
      // Кільце показує одну ціль — найтерміновішу. Плитка не список, і
      // чотири кільця в ряд не сказали б більше за одне.
      const featured = HomeSummary.featuredGoal(docs, today);
      if (!sum.active) { setStat('goals', '0', '', t('sumGoalsNone'), null); return; }
      // Кільце показує ЯК далеко зайшла найтерміновіша ціль, підпис — ЯКА це
      // ціль і що з нею сьогодні. Без назви кільце нічого не означало б, а без
      // другої половини плитка втратила б те, заради чого й ожила: серію й
      // «сьогодні без кроку».
      //
      // Порядок важливий: те, що стосується сьогодні, витісняє те, що
      // стосується строку. Дедлайн через 40 днів нікуди не втече, а
      // невідмічений сьогодні день — втече.
      // Велике число — серія: це найдовше, що людина втримала, і саме воно
      // вартує погляду. Те, що вимагає дії сьогодні, іде окремим рядком.
      if (sum.streak) {
        setStat('goals', String(sum.streak), t('unitDays'), t('capStreak'),
          sum.pending ? t('capNoStep', sum.pending) : null);
      } else {
        setStat('goals', String(sum.active), t('unitActive'),
          featured ? featured.title : t('sumGoalsDone'),
          sum.pending ? t('capNoStep', sum.pending) : null);
      }
    })
    .catch((err) => console.error('homeSummary goals:', err));

  // Тренування: досить найсвіжішого запису.
  // Найсвіжішого запису досить і для «скільки днів тому», і для «що сьогодні»:
  // якщо він датований сьогодні — це і є сьогоднішнє тренування.
  // Найсвіжішого запису досить: він відповідає і на «скільки днів тому», і на
  // «що сьогодні», і дає назву останнього тренування для підпису плитки.
  userRef.collection('workouts').orderBy('date', 'desc').limit(1).get()
    .then((snap) => {
      const docs = snap.docs.map((d) => d.data());
      homeData.workouts = docs;
      renderToday();
      renderCalendar();
      renderLine();
      const todayWorkout = HomeSummary.workoutToday(docs, today);
      if (todayWorkout) {
        // Записане наперед (підходи порожні) — це план, і казати про нього
        // «зроблено» було б неправдою: його ще тільки роблять.
        setStat('workout', todayWorkout.planned
          ? String(todayWorkout.exercises) : `${todayWorkout.setsDone}/${todayWorkout.setsTotal}`,
          todayWorkout.planned ? t('unitExercises') : t('unitSets'),
          todayWorkout.planned ? t('capPlanned') : t('capDoing'),
          null);
        return;
      }
      const sum = HomeSummary.workoutSummary(docs, today);
      if (sum.daysAgo === null) { setStat('workout', '—', '', t('sumWorkoutNever'), null); return; }
      const last = docs.find((w) => w && w.date === sum.lastDate);
      setStat('workout', String(sum.daysAgo), t('unitDaysAgo'),
        last && last.name ? t('capLast', last.name) : t('capLastPlain'), null);
    })
    .catch((err) => console.error('homeSummary workout:', err));
}

// Суми на плитці — без копійок: на головній важливий порядок, а не точність
// до копійки, і «+30 000» читається швидше за «+30 000,00».
function formatAmount(n) {
  return Math.round(Math.abs(n)).toLocaleString(LOCALE_MAP[currentLang] || 'uk-UA');
}

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
  document.getElementById('menuBtn').classList.remove('open');
  document.getElementById('exportOverlay').classList.add('show');
}

function closeExportDialog() {
  document.getElementById('exportOverlay').classList.remove('show');
}

document.getElementById('exportBtn').addEventListener('click', openExportDialog);
document.getElementById('sideExportBtn').addEventListener('click', openExportDialog);
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
    loadHomeSummary(user.uid);
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
