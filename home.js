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
    amountsShow: 'Показати суму', amountsHide: 'Сховати суму',
    langLabel: 'Мова', logout: 'Вийти', exportLabel: 'Експорт даних',
    settingsLabel: 'Налаштування',
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
    sumStreak: (n) => `серія ${n} ${plural(n, { one: 'день', few: 'дні', many: 'днів', other: 'дня' })}`,
    sumGoalsPending: (n) => `${n} без кроку сьогодні`,
    sumWorkoutToday: 'сьогодні тренувався',
    sumGoalDays: (days) => days < 0 ? 'дедлайн минув' : `${days} дн. лишилось`,
    sumWorkoutPlan: (n) => `на сьогодні заплановано ${n} ${plural(n, { one: 'вправу', few: 'вправи', many: 'вправ', other: 'вправи' })}`,
    sumWorkoutDoing: (a, b) => `сьогодні: ${a} з ${b} підходів`,
    sumWorkoutNoneToday: (n) => n <= 0
      ? 'сьогодні тренувань немає'
      : `сьогодні тренувань немає · востаннє ${n} ${plural(n, { one: 'день', few: 'дні', many: 'днів', other: 'дня' })} тому`,
    sumWorkoutAgo: (n) => `востаннє ${n} ${plural(n, { one: 'день', few: 'дні', many: 'днів', other: 'дня' })} тому`,
    addExpense: 'Витрата', addExpenseHint: 'сума, категорія, опис',
    addTask: 'Завдання', addTaskHint: 'на сьогодні або з датою',
    addGoalStep: 'Крок до цілі',
    addGoalStepHint: (n) => `${n} ${plural(n, { one: 'ціль', few: 'цілі', many: 'цілей', other: 'цілі' })} без кроку`,
    addGoalStepNone: 'сьогодні всі відмічені', addGoalStepNoGoals: 'цілей ще немає',
    quickClose: 'Закрити',
    quickExpenseTitle: 'Нова витрата', quickIncomeTitle: 'Новий дохід',
    quickTaskTitle: 'Нове завдання',
    quickTypeExpense: 'Витрата', quickTypeIncome: 'Дохід',
    quickAmount: 'Сума', quickCat: 'Категорія', quickDate: 'Дата',
    quickNote: 'Нотатка (необовʼязково)',
    quickTitleField: 'Назва', quickTime: 'Час',
    quickSave: 'Зберегти запис', quickSaveTask: 'Зберегти завдання',
    quickAmountError: 'Вкажи суму більшу за нуль',
    quickTitleError: 'Напиши назву завдання',
    quickSaveError: 'Не вдалося зберегти. Спробуй ще раз.',
    unsavedTitle: 'Зберегти зміни?',
    unsavedSub: 'Є незбережені зміни. Якщо вийти зараз, вони пропадуть.',
    unsavedSave: 'Зберегти', unsavedDiscard: 'Не зберігати', unsavedKeep: 'Продовжити редагування',
    addGoal: 'Нова ціль', addGoalHint: 'на місяць або на рік',
    addGoalPickHint: 'зарахувати крок',
    addWorkout: 'Тренування', addWorkoutHint: 'вправи й підходи',
    todayTitle: 'Сьогодні',
    todayCount: (n) => `${n} ${plural(n, { one: 'пункт', few: 'пункти', many: 'пунктів', other: 'пункту' })}`,
    prefixPlanned: 'Заплановано', unitTasks: (n) => plural(n, { one: 'завдання', few: 'завдання', many: 'завдань', other: 'завдання' }),
    unitThisMonth: 'на цей місяць',
    unitSets: 'підходів', unitExercises: 'вправ',
    capSpent: 'витрачено за поточний місяць',
    capNoStep: (n) => `${n} без кроку`,
    capTasksEmpty: 'Маєш вихідний, чи просто не записано?',
    capGoalsMonthNone: 'цілей на цей місяць ще немає',
    capWorkoutToday: 'Сьогодні *є* тренування',
    capWorkoutNone: 'Сьогодні тренувань немає',
    capWorkoutNext: (when) => `Наступне — ${when}`,
    whenTomorrow: 'завтра', whenDayAfter: 'післязавтра',
    capWorkoutInvite: 'Сюди можеш додавати власні тренування, та слідкувати за їх прогресом.',
    todayEmpty: 'На сьогодні нічого не чекає.',
    todayMore: (n) => `Ще ${n} у завданнях →`,
    todayAt: (hhmm) => `до ${hhmm}`,
    lineTasks: (n) => `${n} ${plural(n, { one: 'заплановане завдання', few: 'заплановані завдання', many: 'запланованих завдань', other: 'запланованого завдання' })}`,
    lineBoth: (n) => `На сьогодні маєш ${t('lineTasks', n)} та тренування.`,
    lineTasksOnly: (n) => `На сьогодні маєш ${t('lineTasks', n)}, а тренування немає.`,
    lineWorkoutOnly: 'На сьогодні маєш тренування, а завдань не заплановано.',
    lineNothing: 'На сьогодні нічого не заплановано.',
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
    amountsShow: 'Показать сумму', amountsHide: 'Скрыть сумму',
    langLabel: 'Язык', logout: 'Выйти', exportLabel: 'Экспорт данных',
    settingsLabel: 'Настройки',
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
    sumStreak: (n) => `серия ${n} ${plural(n, { one: 'день', few: 'дня', many: 'дней', other: 'дня' })}`,
    sumGoalsPending: (n) => `${n} без шага сегодня`,
    sumWorkoutToday: 'сегодня тренировался',
    sumGoalDays: (days) => days < 0 ? 'дедлайн прошёл' : `${days} дн. осталось`,
    sumWorkoutPlan: (n) => `на сегодня запланировано ${n} ${plural(n, { one: 'упражнение', few: 'упражнения', many: 'упражнений', other: 'упражнения' })}`,
    sumWorkoutDoing: (a, b) => `сегодня: ${a} из ${b} подходов`,
    sumWorkoutNoneToday: (n) => n <= 0
      ? 'сегодня тренировок нет'
      : `сегодня тренировок нет · последний раз ${n} ${plural(n, { one: 'день', few: 'дня', many: 'дней', other: 'дня' })} назад`,
    sumWorkoutAgo: (n) => `последний раз ${n} ${plural(n, { one: 'день', few: 'дня', many: 'дней', other: 'дня' })} назад`,
    addExpense: 'Расход', addExpenseHint: 'сумма, категория, описание',
    addTask: 'Задача', addTaskHint: 'на сегодня или с датой',
    addGoalStep: 'Шаг к цели',
    addGoalStepHint: (n) => `${n} ${plural(n, { one: 'цель', few: 'цели', many: 'целей', other: 'цели' })} без шага`,
    addGoalStepNone: 'сегодня все отмечены', addGoalStepNoGoals: 'целей ещё нет',
    quickClose: 'Закрыть',
    quickExpenseTitle: 'Новый расход', quickIncomeTitle: 'Новый доход',
    quickTaskTitle: 'Новая задача',
    quickTypeExpense: 'Расход', quickTypeIncome: 'Доход',
    quickAmount: 'Сумма', quickCat: 'Категория', quickDate: 'Дата',
    quickNote: 'Заметка (необязательно)',
    quickTitleField: 'Название', quickTime: 'Время',
    quickSave: 'Сохранить запись', quickSaveTask: 'Сохранить задачу',
    quickAmountError: 'Укажи сумму больше нуля',
    quickTitleError: 'Напиши название задачи',
    quickSaveError: 'Не удалось сохранить. Попробуй ещё раз.',
    unsavedTitle: 'Сохранить изменения?',
    unsavedSub: 'Есть несохранённые изменения. Если выйти сейчас, они пропадут.',
    unsavedSave: 'Сохранить', unsavedDiscard: 'Не сохранять', unsavedKeep: 'Продолжить редактирование',
    addGoal: 'Новая цель', addGoalHint: 'на месяц или на год',
    addGoalPickHint: 'засчитать шаг',
    addWorkout: 'Тренировка', addWorkoutHint: 'упражнения и подходы',
    todayTitle: 'Сегодня',
    todayCount: (n) => `${n} ${plural(n, { one: 'пункт', few: 'пункта', many: 'пунктов', other: 'пункта' })}`,
    prefixPlanned: 'Запланировано', unitTasks: (n) => plural(n, { one: 'задача', few: 'задачи', many: 'задач', other: 'задачи' }),
    unitThisMonth: 'на этот месяц',
    unitSets: 'подходов', unitExercises: 'упражнений',
    capSpent: 'потрачено за текущий месяц',
    capNoStep: (n) => `${n} без шага`,
    capTasksEmpty: 'У тебя выходной или просто не записано?',
    capGoalsMonthNone: 'целей на этот месяц пока нет',
    capWorkoutToday: 'Сегодня *есть* тренировка',
    capWorkoutNone: 'Сегодня тренировок нет',
    capWorkoutNext: (when) => `Следующая — ${when}`,
    whenTomorrow: 'завтра', whenDayAfter: 'послезавтра',
    capWorkoutInvite: 'Сюда можешь добавлять свои тренировки и следить за их прогрессом.',
    todayEmpty: 'На сегодня ничего не ждёт.',
    todayMore: (n) => `Ещё ${n} в задачах →`,
    todayAt: (hhmm) => `до ${hhmm}`,
    lineTasks: (n) => `${n} ${plural(n, { one: 'запланированная задача', few: 'запланированные задачи', many: 'запланированных задач', other: 'запланированной задачи' })}`,
    lineBoth: (n) => `На сегодня у тебя ${t('lineTasks', n)} и тренировка.`,
    lineTasksOnly: (n) => `На сегодня у тебя ${t('lineTasks', n)}, а тренировки нет.`,
    lineWorkoutOnly: 'На сегодня у тебя тренировка, а задач не запланировано.',
    lineNothing: 'На сегодня ничего не запланировано.',
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
    amountsShow: 'Pokaż kwotę', amountsHide: 'Ukryj kwotę',
    langLabel: 'Język', logout: 'Wyloguj', exportLabel: 'Eksport danych',
    settingsLabel: 'Ustawienia',
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
    sumStreak: (n) => `seria ${n} ${plural(n, { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' })}`,
    sumGoalsPending: (n) => `${n} bez kroku dziś`,
    sumWorkoutToday: 'dziś trenowałeś',
    sumGoalDays: (days) => days < 0 ? 'termin minął' : `zostało ${days} dni`,
    sumWorkoutPlan: (n) => `na dziś zaplanowano ${n} ${plural(n, { one: 'ćwiczenie', few: 'ćwiczenia', many: 'ćwiczeń', other: 'ćwiczenia' })}`,
    sumWorkoutDoing: (a, b) => `dziś: ${a} z ${b} serii`,
    sumWorkoutNoneToday: (n) => n <= 0
      ? 'dziś brak treningu'
      : `dziś brak treningu · ostatnio ${n} ${plural(n, { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' })} temu`,
    sumWorkoutAgo: (n) => `ostatnio ${n} ${plural(n, { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' })} temu`,
    addExpense: 'Wydatek', addExpenseHint: 'kwota, kategoria, opis',
    addTask: 'Zadanie', addTaskHint: 'na dziś lub z datą',
    addGoalStep: 'Krok do celu',
    addGoalStepHint: (n) => `${n} ${plural(n, { one: 'cel', few: 'cele', many: 'celów', other: 'celu' })} bez kroku`,
    addGoalStepNone: 'dziś wszystkie odhaczone', addGoalStepNoGoals: 'nie ma jeszcze celów',
    quickClose: 'Zamknij',
    quickExpenseTitle: 'Nowy wydatek', quickIncomeTitle: 'Nowy przychód',
    quickTaskTitle: 'Nowe zadanie',
    quickTypeExpense: 'Wydatek', quickTypeIncome: 'Przychód',
    quickAmount: 'Kwota', quickCat: 'Kategoria', quickDate: 'Data',
    quickNote: 'Notatka (opcjonalnie)',
    quickTitleField: 'Nazwa', quickTime: 'Godzina',
    quickSave: 'Zapisz wpis', quickSaveTask: 'Zapisz zadanie',
    quickAmountError: 'Podaj kwotę większą od zera',
    quickTitleError: 'Wpisz nazwę zadania',
    quickSaveError: 'Nie udało się zapisać. Spróbuj ponownie.',
    unsavedTitle: 'Zapisać zmiany?',
    unsavedSub: 'Są niezapisane zmiany. Jeśli teraz wyjdziesz, przepadną.',
    unsavedSave: 'Zapisz', unsavedDiscard: 'Nie zapisuj', unsavedKeep: 'Wróć do edycji',
    addGoal: 'Nowy cel', addGoalHint: 'na miesiąc lub na rok',
    addGoalPickHint: 'zalicz krok',
    addWorkout: 'Trening', addWorkoutHint: 'ćwiczenia i serie',
    todayTitle: 'Dziś',
    todayCount: (n) => `${n} ${plural(n, { one: 'pozycja', few: 'pozycje', many: 'pozycji', other: 'pozycji' })}`,
    prefixPlanned: 'Zaplanowano', unitTasks: (n) => plural(n, { one: 'zadanie', few: 'zadania', many: 'zadań', other: 'zadania' }),
    unitThisMonth: 'na ten miesiąc',
    unitSets: 'serii', unitExercises: 'ćwiczeń',
    capSpent: 'wydano w tym miesiącu',
    capNoStep: (n) => `${n} bez kroku`,
    capTasksEmpty: 'Masz wolne czy po prostu nie zapisane?',
    capGoalsMonthNone: 'nie ma jeszcze celów na ten miesiąc',
    capWorkoutToday: 'Dziś *jest* trening',
    capWorkoutNone: 'Dziś nie ma treningu',
    capWorkoutNext: (when) => `Następny — ${when}`,
    whenTomorrow: 'jutro', whenDayAfter: 'pojutrze',
    capWorkoutInvite: 'Tu możesz dodawać własne treningi i śledzić ich postępy.',
    todayEmpty: 'Na dziś nic nie czeka.',
    todayMore: (n) => `Jeszcze ${n} w zadaniach →`,
    todayAt: (hhmm) => `do ${hhmm}`,
    lineTasks: (n) => `${n} ${plural(n, { one: 'zaplanowane zadanie', few: 'zaplanowane zadania', many: 'zaplanowanych zadań', other: 'zaplanowanego zadania' })}`,
    lineBoth: (n) => `Na dziś masz ${t('lineTasks', n)} i trening.`,
    lineTasksOnly: (n) => `Na dziś masz ${t('lineTasks', n)}, a treningu nie ma.`,
    lineWorkoutOnly: 'Na dziś masz trening, a zadań nie zaplanowano.',
    lineNothing: 'Na dziś nic nie zaplanowano.',
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
    amountsShow: 'Show the amount', amountsHide: 'Hide the amount',
    langLabel: 'Language', logout: 'Log out', exportLabel: 'Export data',
    settingsLabel: 'Settings',
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
    sumStreak: (n) => `${n}-day streak`,
    sumGoalsPending: (n) => `${n} with no step today`,
    sumWorkoutToday: 'trained today',
    sumGoalDays: (days) => days < 0 ? 'deadline passed' : `${days} days left`,
    sumWorkoutPlan: (n) => `${n} ${n === 1 ? 'exercise' : 'exercises'} planned for today`,
    sumWorkoutDoing: (a, b) => `today: ${a} of ${b} sets`,
    sumWorkoutNoneToday: (n) => n <= 0
      ? 'no workout today'
      : `no workout today · last one ${n} ${n === 1 ? 'day' : 'days'} ago`,
    sumWorkoutAgo: (n) => `last ${n} ${plural(n, { one: 'day', other: 'days' })} ago`,
    addExpense: 'Expense', addExpenseHint: 'amount, category, note',
    addTask: 'Task', addTaskHint: 'for today or with a date',
    addGoalStep: 'Step toward a goal',
    addGoalStepHint: (n) => `${n} ${plural(n, { one: 'goal', other: 'goals' })} without a step`,
    addGoalStepNone: 'all marked today', addGoalStepNoGoals: 'no goals yet',
    quickClose: 'Close',
    quickExpenseTitle: 'New expense', quickIncomeTitle: 'New income',
    quickTaskTitle: 'New task',
    quickTypeExpense: 'Expense', quickTypeIncome: 'Income',
    quickAmount: 'Amount', quickCat: 'Category', quickDate: 'Date',
    quickNote: 'Note (optional)',
    quickTitleField: 'Title', quickTime: 'Time',
    quickSave: 'Save entry', quickSaveTask: 'Save task',
    quickAmountError: 'Enter an amount greater than zero',
    quickTitleError: 'Type a task title',
    quickSaveError: 'Could not save. Try again.',
    unsavedTitle: 'Save changes?',
    unsavedSub: 'You have unsaved changes. Leaving now discards them.',
    unsavedSave: 'Save', unsavedDiscard: 'Discard', unsavedKeep: 'Keep editing',
    addGoal: 'New goal', addGoalHint: 'monthly or yearly',
    addGoalPickHint: 'count the step',
    addWorkout: 'Workout', addWorkoutHint: 'exercises and sets',
    todayTitle: 'Today',
    todayCount: (n) => `${n} ${plural(n, { one: 'item', other: 'items' })}`,
    prefixPlanned: 'Planned', unitTasks: (n) => plural(n, { one: 'task', other: 'tasks' }),
    unitThisMonth: 'this month',
    unitSets: 'sets', unitExercises: 'exercises',
    capSpent: 'spent this month',
    capNoStep: (n) => `${n} without a step`,
    capTasksEmpty: 'A day off, or just nothing written down?',
    capGoalsMonthNone: 'no goals for this month yet',
    capWorkoutToday: 'There *is* a workout today',
    capWorkoutNone: 'No workout today',
    capWorkoutNext: (when) => `Next — ${when}`,
    whenTomorrow: 'tomorrow', whenDayAfter: 'the day after tomorrow',
    capWorkoutInvite: 'Add your own workouts here and follow their progress.',
    todayEmpty: 'Nothing waiting today.',
    todayMore: (n) => `${n} more in Tasks →`,
    todayAt: (hhmm) => `by ${hhmm}`,
    lineTasks: (n) => `${n} ${plural(n, { one: 'planned task', other: 'planned tasks' })}`,
    lineBoth: (n) => `Today you have ${t('lineTasks', n)} and a workout.`,
    lineTasksOnly: (n) => `Today you have ${t('lineTasks', n)}, and no workout.`,
    lineWorkoutOnly: 'Today you have a workout, and no tasks planned.',
    lineNothing: 'Nothing planned for today.',
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
// Рядки «Експорт даних» і «Налаштування» малює сама колонка — вони стоять
// на всіх пʼятьох сторінках. Тут вони кнопки, бо діалог експорту й меню
// налаштувань живуть саме на головній; з розділів колонка веде сюди хешем.
window.SideNav.mount(document.getElementById('sideNavHost'), {
  current: 'home',
  lang: currentLang,
});

function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  document.getElementById('themeMenuLabel').textContent = t('themeLabel');
  document.getElementById('langMenuLabel').textContent = t('langLabel');
  document.getElementById('exportLabel').textContent = t('exportLabel');
  document.getElementById('logoutLabel').textContent = t('logout');
  // Назви розділів у колонці живуть у side-nav.js — одні на пʼять сторінок.
  window.SideNav.setLang(currentLang);
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
  applyQuickTranslations();
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
// Скільки справ показує картка «Сьогодні» і який календар малюється — те й
// те залежить від ширини екрана, і поріг той самий, що в CSS (880px), інакше
// сторінка й скрипт розходились би в тому, яка зараз розкладка.
//
// Чотири рядки — стеля телефона: разом зі смугою тижня й плитками розділів
// вони ще вміщаються без гортання. На широкому екрані та сама стеля лишала
// півсторінки порожньою, тож там їх десять, а решта ховається за рядком
// «ще N» — посиланням у розділ, а не мовчазним обрізанням.
//
// Але десять рядків вимагають не лише ширини, а й ВИСОТИ. На ноутбуці з
// невисоким вікном (1366x768, або 1920x1080 при масштабі 125%) картка з
// десятьма справами виштовхувала плитки за край, і сторінка починала
// гортатись — тобто ламала те, заради чого розкладку й робили. Тому там
// стеля менша, а решта так само йде за посилання. Поріг висоти той самий,
// що в CSS (820px), інакше сторінка й скрипт розходились би в тому, яка
// зараз розкладка.
const TODAY_TASK_LIMIT = 4;
const TODAY_TASK_LIMIT_WIDE = 10;
const TODAY_TASK_LIMIT_SHORT = 7;
const WIDE_SCREEN = '(min-width:880px)';
const TALL_SCREEN = '(min-height:820px)';

function matchesMedia(query) {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

function isWideScreen() {
  return matchesMedia(WIDE_SCREEN);
}

function todayTaskLimit() {
  if (!isWideScreen()) return TODAY_TASK_LIMIT;
  return matchesMedia(TALL_SCREEN) ? TODAY_TASK_LIMIT_WIDE : TODAY_TASK_LIMIT_SHORT;
}

let homeData = { transactions: null, tasks: null, goals: null, workouts: null };
// План витрат на місяць із профілю (null/undefined — плану немає). Лежить
// тут, а не в замиканні запиту: плитку перемальовує ще й перемикач сум.
// Валюта з профілю — той самий документ, що вже читається заради мови й теми.
let homeCurrency = '';

const THEME_CHOICES = ['light', 'dark', 'system'];
// Ховати суму витрат на плитці «Бюджет».
//
// Головна — єдиний екран, який видно з чужого боку мимохідь: телефон лежить
// на столі, хтось зазирнув через плече. Тому ховається саме тут, а не в
// самому бюджеті: туди заходять свідомо.
//
// Тільки localStorage, без профілю: це налаштування ПРИСТРОЮ, а не людини.
// Телефон носять із собою, компʼютер стоїть удома, і синхронізувати між
// ними «ховати» означало б ховати там, де ховати нема від кого.
let hideAmounts = localStorage.getItem('financeAppHideAmounts') === '1';
// Крапки, а не зірочки: зірочки в тій самій позиції читаються як виноска.
const AMOUNT_MASK = '•••';

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
// Око на самій плитці, а не рядок у меню налаштувань. Перемикач був там, і
// його ніхто не знаходив: ховати суму хочеться в ту саму секунду, коли до
// тебе підходять, а не після подорожі в меню.
const EYE_OPEN = '<path d="M2 12s3.6-6.4 10-6.4S22 12 22 12s-3.6 6.4-10 6.4S2 12 2 12Z"/><circle cx="12" cy="12" r="2.7"/>';
const EYE_OFF = '<path d="M3 3l18 18"/><path d="M10.7 6.1A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.3 17.3 0 0 1-3.3 3.9"/>'
  + '<path d="M6.6 8A16.9 16.9 0 0 0 2 12s3.6 6 10 6c1.2 0 2.3-.2 3.3-.5"/><path d="M9.9 10.1a2.8 2.8 0 0 0 4 4"/>';

function renderAmountsToggle() {
  const btn = document.getElementById('hideAmountsBtn');
  if (!btn) return;
  // Значок показує ДІЮ, а не стан: коли сума видна, око перекреслене —
  // «сховати». Інакше довелось би гадати, що саме він означає.
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
    stroke-linecap="round" stroke-linejoin="round">${hideAmounts ? EYE_OPEN : EYE_OFF}</svg>`;
  btn.setAttribute('aria-label', t(hideAmounts ? 'amountsShow' : 'amountsHide'));
  btn.setAttribute('title', t(hideAmounts ? 'amountsShow' : 'amountsHide'));
  btn.setAttribute('aria-pressed', hideAmounts ? 'true' : 'false');
}

function setHideAmounts(hide) {
  hideAmounts = !!hide;
  try { localStorage.setItem('financeAppHideAmounts', hideAmounts ? '1' : '0'); }
  catch (err) { /* приватний режим — сховати на цей сеанс однаково вийде */ }
  renderAmountsToggle();
  // Плитка малюється з даних, які вже прийшли: перезапитувати базу заради
  // перемикача не треба.
  renderBudgetTile();
}

// Сума або крапки — залежно від перемикача. Один вхід на всі місця, де на
// головній зʼявляються гроші: інакше наступне таке місце неминуче забули б.
function shownAmount(value) {
  return hideAmounts ? AMOUNT_MASK : formatAmount(value);
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
renderAmountsToggle();
applyTranslations();

document.getElementById('hideAmountsBtn').addEventListener('click', () => setHideAmounts(!hideAmounts));

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
// Підпис може нести жирне слово: «Сьогодні *є* тренування». Зірочки, а не
// теги, бо рядок живе у словнику й перекладається — а перекладачеві простіше
// не загубити зірочку, ніж закритий тег. Збираємо вузлами, тож у розмітку
// потрапляє лише текст, хай би що стояло в словнику.
function fillCaption(el, text) {
  el.textContent = '';
  String(text || '').split(/\*([^*]+)\*/).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 0) { el.appendChild(document.createTextNode(part)); return; }
    const b = document.createElement('b');
    b.textContent = part;
    el.appendChild(b);
  });
}

// prefix — слово ПЕРЕД числом («Заплановано 8 завдань»). Порожній елемент
// сховано в CSS (.tile-stat i:empty), тож плитки без нього не отримують
// зайвого проміжку.
function setStat(key, value, unit, caption, note, prefix) {
  const stat = document.getElementById(key + 'Stat');
  const unitEl = document.getElementById(key + 'Unit');
  const preEl = document.getElementById(key + 'Pre');
  const cap = document.getElementById(key + 'Sub');
  const noteEl = document.getElementById(key + 'Note');
  if (stat) stat.textContent = value;
  if (unitEl) unitEl.textContent = unit || '';
  if (preEl) preEl.textContent = prefix || '';
  if (cap) fillCaption(cap, caption);
  if (noteEl) {
    noteEl.textContent = note || '';
    noteEl.hidden = !note;
  }
}

// Плитка «Бюджет». Винесена з обробника запиту: перемикач «ховати суму»
// перемальовує її з даних, які вже прийшли, а не ходить у базу вдруге.
function renderBudgetTile() {
  const txs = homeData.transactions;
  if (!txs) return;
  const today = todayISO();
  const sum = HomeSummary.budgetSummary(txs, today);
  // Головне число — витрачене за місяць: воно й відповідає на питання, з
  // яким у бюджет заходять. Другим рядком колись стояло «лишилось N з
  // плану», але поля, звідки брався той план, більше немає.
  //
  // Підпис каже «за поточний місяць», а не називає місяць: назва місяця
  // читалась як фільтр («а де решта?»), хоч плитка завжди показує саме
  // поточний і ніколи інший.
  setStat('budget', shownAmount(sum.expense), homeCurrency, t('capSpent'), null);
}

// ---- «Сьогодні»: завдання на сьогодні, і все ----
// Тут був спільний список трьох розділів: завдання, цілі без сьогоднішнього
// кроку, рядок про тренування. Виходило, що картка «Сьогодні» показувала що
// завгодно, крім самих справ на сьогодні: два завдання, «побачити ще N», дві
// цілі й тренування — шість рядків, головна не вміщалась в екран, і по ній
// доводилось гортати. Тепер тут рівно те, що написано в заголовку.
//
// Крок до цілі нікуди не подівся — він живе у шторці «+», де його й шукають
// свідомо, а не натикаються на нього між справами.
//
// Саму стелю оголошено вище, разом зі станом сторінки: applyLang() малює
// картку ще до того, як дійде сюди виконання, і const у цьому місці був би
// прочитаний до ініціалізації.

function renderToday() {
  const panel = document.getElementById('todayPanel');
  const list = document.getElementById('todayList');
  if (!panel || !list) return;
  const today = todayISO();

  // Тільки сьогоднішні. Невиконане з минулих днів лишається у своєму дні:
  // воно не стає справою на сьогодні від того, що день минув, і тягнути
  // його сюди означало б показувати борг замість дня.
  const mine = (homeData.tasks || []).filter((x) => x && x.dueDate === today);
  // Невиконане згори: закреслене вже нікуди не поспішає.
  mine.sort((a, b) => (a.done === b.done ? 0 : (a.done ? 1 : -1)));

  // Стелю бере todayTaskLimit(): 4 на телефоні, 7 у низькому вікні, 10 на
  // просторому широкому екрані.
  const limit = todayTaskLimit();
  const html = mine.slice(0, limit).map((task) => `
      <div class="today-row${task.done ? ' checked' : ''}">
        <button type="button" class="today-box${task.done ? ' checked' : ''}" data-task="${escapeHtml(task.id)}" aria-label="${escapeHtml(task.title || '')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>
        </button>
        <span class="today-name">${escapeHtml(task.title || '')}</span>
        <span class="today-spacer"></span>
        ${task.dueTime ? `<span class="today-when">${escapeHtml(t('todayAt', task.dueTime))}</span>` : ''}
      </div>`).join('');

  // Те, що не вмістилось, не зникає мовчки: рядок веде в розділ завдань, де
  // видно весь день. Лічильник у шапці каже, скільки справ усього, а цей
  // рядок — скільки з них лишилось за межею картки.
  const hidden = mine.length - limit;
  const more = hidden > 0
    ? `<a class="today-more" href="tasks/index.html">${escapeHtml(t('todayMore', hidden))}</a>`
    : '';

  // Порожній список — теж відповідь, і ховати панель не треба: «нічого не
  // чекає» це новина, а не відсутність новин.
  panel.hidden = !homeData.tasks;
  list.innerHTML = html ? html + more : `<div class="today-empty">${escapeHtml(t('todayEmpty'))}</div>`;
  const countEl = document.getElementById('todayCount');
  if (countEl) countEl.textContent = mine.length ? t('todayCount', mine.length) : '';

  list.querySelectorAll('[data-task]').forEach((btn) => {
    btn.addEventListener('click', () => toggleHomeTask(btn.dataset.task));
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
// лише тоді відкрити форму. Тепер шторка веде одразу у потрібну форму.
//
// Витрата й завдання відкривають її ПРОСТО ТУТ, без переходу: два поля не
// варті перезавантаження сторінки й дороги назад. Ціль і тренування ведуть
// у розділ за #new — там не форма, а екран, і стиснути його до аркуша
// означало б зробити другу, гіршу форму замість наявної.
//
// «Крок до цілі» — виняток серед винятків: це не форма, а один тап, і код
// для нього на головній уже є. Тому рядок не веде нікуди, а розкриває список
// активних цілей просто тут.
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
    addRow('expense', t('addExpense'), t('addExpenseHint'), null, 'data-quick="expense"'),
    addRow('task', t('addTask'), t('addTaskHint'), null, 'data-quick="task"'),
    pending.length
      ? addRow('goal', t('addGoalStep'), t('addGoalStepHint', pending.length), null, 'data-add-goal')
      : '',
    addRow('newGoal', t('addGoal'), t('addGoalHint'), 'goals/index.html#new'),
    addRow('workout', t('addWorkout'), t('addWorkoutHint'), 'workout/index.html#new'),
  ].join('');

  // Витрата й завдання відкривають форму просто тут; шторка при цьому
  // закривається — інакше вікно виїжджало б поверх власного меню.
  host.querySelectorAll('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => { closeAddSheet(); openQuick(btn.dataset.quick); });
  });

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
}

function closeAddSheet() {
  document.getElementById('addOverlay').classList.remove('show');
  document.getElementById('addFab').classList.remove('open');
}

// Обидві кнопки — одна дія: на телефоні видно «+», на комп'ютері «Записати».
function toggleAddSheet() {
  const open = document.getElementById('addOverlay').classList.contains('show');
  if (open) closeAddSheet(); else openAddSheet();
}
document.getElementById('addFab').addEventListener('click', toggleAddSheet);
document.getElementById('addOverlay').addEventListener('click', (e) => {
  // Тап повз аркуш закриває: усередині нього клік не має нічого закривати.
  if (e.target.id === 'addOverlay') closeAddSheet();
});


// ---- Форма швидкого запису просто тут ----
// Рядки «Витрата» й «Завдання» більше не ведуть у розділ: форма відкривається
// на самій головній. Перехід коштував повного перезавантаження сторінки
// заради двох полів, а потім треба було ще й вернутись назад — при тому що
// людина нікуди йти й не збиралась, вона хотіла записати суму.
//
// «Нова ціль» і «Тренування» лишаються посиланнями: там не два поля, а екран
// (горизонт і категорія в цілі, вправи з підходами в тренуванні), і стиснути
// його до аркуша означало б зробити другу, гіршу форму замість наявної.
//
// Категорії, палітра, набір полів і сам вигляд вікна — ті самі, що в бюджеті:
// класи .modal-overlay / .modal і файл ../categories-default.js спільні. Якби
// форма тут була «своя», вона розійшлася б із розділом при першій же правці.
let quickKind = null;        // 'expense' | 'task' — що саме записуємо
let quickTxType = 'expense'; // усередині грошового запису: витрата чи дохід
let quickCategory = null;
// Категорії з профілю. null означає «профіль ще не приїхав або своїх немає» —
// тоді беруться стандартні за мовою сторінки, як і в бюджеті.
let quickProfileCats = { expense: null, income: null };

function quickCatList(type) {
  const own = quickProfileCats[type];
  if (own && own.length) return own;
  return defaultCategoryList(type, currentLang, CATEGORY_PALETTE.length);
}

// Колір категорії — той самий, що в бюджеті: інакше «Їжа» була б зеленою в
// розділі й іншою на головній. Категорія без colorIndex (стара, заведена до
// палітри) отримує стабільний колір з власного id.
function quickCatColor(type, id) {
  const cat = quickCatList(type).find((c) => c.id === id);
  if (cat && typeof cat.colorIndex === 'number') {
    return CATEGORY_PALETTE[cat.colorIndex % CATEGORY_PALETTE.length].text;
  }
  let h = 0;
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length].text;
}

function renderQuickCats() {
  const host = document.getElementById('quickCats');
  if (!host) return;
  const list = quickCatList(quickTxType);
  if (!list.some((c) => c.id === quickCategory)) quickCategory = list[0] ? list[0].id : null;
  host.innerHTML = list.map((c) => `<button type="button" class="cat-choice${c.id === quickCategory ? ' selected' : ''}"
    data-cat="${escapeHtml(c.id)}"
    style="${c.id === quickCategory ? `background:${quickCatColor(quickTxType, c.id)};` : ''}">${escapeHtml(c.label)}</button>`).join('');
  host.querySelectorAll('.cat-choice').forEach((btn) => {
    btn.addEventListener('click', () => { quickCategory = btn.dataset.cat; renderQuickCats(); });
  });
}

function isQuickOpen() {
  const overlay = document.getElementById('quickOverlay');
  return !!overlay && overlay.classList.contains('show');
}

// Свої категорії лежать у профілі й прилітають окремо від сторінки — форму
// могли відкрити раніше. Тоді її треба перемалювати, інакше людина побачила
// б стандартні сім замість власних (той самий випадок, що описано у
// refreshOpenTxForm у budget/app.js). Знімок гарда оновлюємо, лише якщо у
// формі ще нічого не чіпали: підміна, якої людина не робила, не має
// рахуватись за незбережену зміну.
function setQuickCategories(profile) {
  quickProfileCats.expense = Array.isArray(profile.categoriesExpense) && profile.categoriesExpense.length
    ? profile.categoriesExpense : null;
  quickProfileCats.income = Array.isArray(profile.categoriesIncome) && profile.categoriesIncome.length
    ? profile.categoriesIncome : null;
  if (quickKind !== 'expense' || !isQuickOpen()) return;
  const wasClean = !quickGuard.isDirty();
  renderQuickCats();
  if (wasClean) quickGuard.arm();
}

function applyQuickTranslations() {
  document.getElementById('quickTypeExpense').textContent = t('quickTypeExpense');
  document.getElementById('quickTypeIncome').textContent = t('quickTypeIncome');
  document.getElementById('quickAmountLabel').textContent = t('quickAmount');
  document.getElementById('quickCatLabel').textContent = t('quickCat');
  document.getElementById('quickDateLabel').textContent = t('quickDate');
  document.getElementById('quickNoteLabel').textContent = t('quickNote');
  document.getElementById('quickTaskTitleLabel').textContent = t('quickTitleField');
  document.getElementById('quickTaskDateLabel').textContent = t('quickDate');
  document.getElementById('quickTaskTimeLabel').textContent = t('quickTime');
  document.getElementById('quickTaskNotesLabel').textContent = t('quickNote');
  document.getElementById('quickCloseBtn').setAttribute('aria-label', t('quickClose'));
  if (isQuickOpen()) applyQuickMode();
}

// Заголовок, кнопка й видимі поля — усе, що відрізняє два записи один від
// одного. Винесено окремо, бо перемикач «витрата / дохід» міняє те саме, що
// й відкриття форми, і двома копіями це розійшлося б.
function applyQuickMode() {
  const isTask = quickKind === 'task';
  const title = isTask ? t('quickTaskTitle')
    : t(quickTxType === 'income' ? 'quickIncomeTitle' : 'quickExpenseTitle');
  // На грошовому записі заголовок ховається за перемикачем: він каже те саме,
  // тільки ще й дозволяє це змінити. Ім'я вікна лишається в aria-label — для
  // тих, хто його не бачить, а чує.
  document.getElementById('quickTitle').textContent = isTask ? title : '';
  document.getElementById('quickTitle').style.display = isTask ? 'block' : 'none';
  document.getElementById('quickTypeToggle').style.display = isTask ? 'none' : 'flex';
  document.getElementById('quickModal').setAttribute('aria-label', title);
  document.getElementById('quickExpenseFields').style.display = isTask ? 'none' : 'block';
  document.getElementById('quickTaskFields').style.display = isTask ? 'block' : 'none';
  document.getElementById('quickTypeExpense').classList.toggle('active', !isTask && quickTxType === 'expense');
  document.getElementById('quickTypeIncome').classList.toggle('active', !isTask && quickTxType === 'income');
  const submit = document.getElementById('quickSubmitBtn');
  submit.textContent = isTask ? t('quickSaveTask') : t('quickSave');
  submit.style.background = isTask ? 'var(--accent)'
    : (quickTxType === 'income' ? 'var(--income)' : 'var(--expense)');
}

function openQuick(kind) {
  quickKind = kind;
  quickTxType = 'expense';
  const today = todayISO();
  document.getElementById('quickAmount').value = '';
  document.getElementById('quickNote').value = '';
  document.getElementById('quickDate').value = today;
  // Гроші заднім числом записують, наперед — ні: витрати, якої ще не було,
  // у бюджеті бути не може. Та сама межа, що у формі бюджету.
  document.getElementById('quickDate').max = today;
  document.getElementById('quickTaskTitle').value = '';
  document.getElementById('quickTaskNotes').value = '';
  // Завдання за замовчуванням — на сьогодні: саме його записують з головної,
  // і порожня дата означала б «колись», тобто справу, яка нікуди не потрапить.
  document.getElementById('quickTaskDate').value = today;
  document.getElementById('quickTaskTime').value = '';
  quickCategory = null;
  renderQuickCats();
  setQuickError('');
  applyQuickMode();
  // Знімок — після заповнення полів і до показу: інакше щойно відкрита форма
  // вважалась би зміненою ще до першої літери.
  quickGuard.arm();
  document.getElementById('quickOverlay').classList.add('show');
  const first = document.getElementById(kind === 'task' ? 'quickTaskTitle' : 'quickAmount');
  setTimeout(() => { try { first.focus(); } catch (err) { /* поле сховане */ } }, 50);
}

function setQuickError(text) {
  const el = document.getElementById('quickError');
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

function switchQuickType(type) {
  if (quickKind !== 'expense' || quickTxType === type) return;
  quickTxType = type;
  quickCategory = null;
  renderQuickCats();
  applyQuickMode();
}

// ---- Незбережене у швидкому записі ----
// Вікно закривається тапом повз нього — на телефоні промахнутись легко, а
// набране нікуди не пишеться, доки не натиснуто «Зберегти». Гард той самий,
// що в модулях (../unsaved-guard.js): своя копія логіки тут розійшлася б із
// їхньою при першій же правці.
const quickGuard = UnsavedGuard.create({
  overlay: 'quickOverlay',
  snapshot: () => JSON.stringify({
    kind: quickKind,
    type: quickTxType,
    category: quickCategory,
    amount: document.getElementById('quickAmount').value.trim(),
    note: document.getElementById('quickNote').value.trim(),
    date: document.getElementById('quickDate').value,
    title: document.getElementById('quickTaskTitle').value.trim(),
    notes: document.getElementById('quickTaskNotes').value.trim(),
    taskDate: document.getElementById('quickTaskDate').value,
    taskTime: document.getElementById('quickTaskTime').value,
  }),
  save: () => submitQuick(),
  texts: () => ({
    title: t('unsavedTitle'), sub: t('unsavedSub'),
    save: t('unsavedSave'), discard: t('unsavedDiscard'), keep: t('unsavedKeep'),
  }),
});

async function submitQuick() {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) return;
  const userRef = db.collection('users').doc(uid);
  const btn = document.getElementById('quickSubmitBtn');

  let write;
  if (quickKind === 'task') {
    const title = document.getElementById('quickTaskTitle').value.trim();
    if (!title) { setQuickError(t('quickTitleError')); return; }
    write = () => userRef.collection('tasks').add({
      title,
      notes: document.getElementById('quickTaskNotes').value.trim(),
      done: false,
      completedAt: null,
      // Пріоритет, теги, підзадачі, оцінка й повторення лишаються порожніми —
      // рівно те, що записує повна форма, якої не чіпали. Для них треба вже
      // не запис, а обдумування, і живуть вони в самому розділі.
      priority: null,
      tags: [],
      dueDate: document.getElementById('quickTaskDate').value || null,
      dueTime: document.getElementById('quickTaskTime').value || null,
      estimateMin: null,
      recurrence: null,
      reminderAt: null,
      notifiedAt: null,
      subtasks: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    const raw = document.getElementById('quickAmount').value;
    const num = parseFloat(raw.replace(',', '.'));
    if (!raw || isNaN(num) || num <= 0) { setQuickError(t('quickAmountError')); return; }
    if (!quickCategory) { setQuickError(t('quickSaveError')); return; }
    write = () => userRef.collection('transactions').add({
      type: quickTxType,
      amount: Math.round(num * 100) / 100,
      category: quickCategory,
      note: document.getElementById('quickNote').value.trim(),
      date: document.getElementById('quickDate').value || todayISO(),
    });
  }

  setQuickError('');
  btn.disabled = true;
  try {
    await write();
    quickGuard.close();
    // Перечитуємо ЛИШЕ той розділ, якого торкнувся запис: повне перезавантаження
    // головної на секунду стерло б і плитки, і рядок під датою — тобто показало
    // б порожній екран у відповідь на вдале збереження.
    if (quickKind === 'task') loadTasksSection(userRef);
    else loadBudgetSection(userRef);
  } catch (err) {
    console.error('quick save:', err);
    setQuickError(t('quickSaveError'));
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('quickCloseBtn').addEventListener('click', () => quickGuard.requestClose());
document.getElementById('quickSubmitBtn').addEventListener('click', () => submitQuick());
document.getElementById('quickTypeToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-qtype]');
  if (btn) switchQuickType(btn.dataset.qtype);
});
// Enter у будь-якому однорядковому полі — те саме, що кнопка: форма з двох
// полів не має вимагати тягнутись до неї мишею.
document.getElementById('quickModal').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submitQuick(); }
});

// ---- Календар ----
// Крапка означає рівно одне — на цей день є завдання; порожнє кільце — день,
// де все вже закрито (те саме, що в розділі завдань: два різні стани не мають
// виглядати однаково).
//
// Днів у сітці стільки, скільки вміщає екран. На телефоні це календарний
// тиждень (пн—нд), а не останні сім днів: день має стояти там, де він стоїть
// у місяці. На широкому екрані — весь місяць: смуга з семи днів лишала
// півсторінки порожньою, а місяць відповідає на те саме питання й заразом
// показує, що попереду.
function renderCalendar() {
  const monthEl = document.getElementById('calMonth');
  const weekEl = document.getElementById('calWeek');
  if (!monthEl || !weekEl) return;

  const today = todayISO();
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const month = new Intl.DateTimeFormat(locale, { month: 'long' });
  const wide = isWideScreen();
  const cal = wide
    ? HomeSummary.monthCalendar(homeData.tasks || [], today)
    : HomeSummary.weekCalendar(homeData.tasks || [], today);

  // Підпис — це місяць СЬОГОДНІШНЬОГО дня, а не країв сітки. Тиждень на межі
  // місяців підписувався обома назвами («серпень — вересень»), і в сітці
  // місяця хвости сусідніх місяців є завжди, тож обидва варіанти по краях
  // однаково брехали б. 31 серпня це ще серпень, 1 вересня — вже вересень,
  // хай навіть у тому самому рядку стоять числа обох.
  monthEl.textContent = month.format(new Date(today + 'T00:00:00'));

  const dow = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  // У місяці день тижня стоїть один раз шапкою над стовпчиком, а не в кожній
  // клітинці: тридцять однакових підписів — це шум, а не орієнтир.
  const head = wide
    ? cal.days.slice(0, 7).map((d) => `<div class="cal-dow-head">${escapeHtml(dow.format(new Date(d.date + 'T00:00:00')))}</div>`).join('')
    : '';

  // Кожен день — посилання в розділ завдань на цей самий день (#day=…).
  // Саме посилання, а не кнопка з обробником: так працює середня кнопка миші,
  // «відкрити в новій вкладці» й клавіатура, і нічого з цього не треба
  // писати руками.
  const dayName = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  const cells = cal.days.map((d) => {
    const cls = ['cal-day'];
    if (d.today) cls.push('today');
    if (d.past) cls.push('past');
    if (d.otherMonth) cls.push('other-month');
    const dot = d.hasTasks ? (d.allDone ? ' all-done' : ' has') : '';
    const at = new Date(d.date + 'T00:00:00');
    return `
      <a class="${cls.join(' ')}" href="tasks/index.html#day=${escapeHtml(d.date)}"
         aria-label="${escapeHtml(dayName.format(at))}">
        ${wide ? '' : `<span class="cal-dow">${escapeHtml(dow.format(at))}</span>`}
        <span class="cal-num">${d.dayNum}</span>
        <span class="cal-dot${dot}"></span>
      </a>`;
  }).join('');

  weekEl.className = wide ? 'cal-grid' : 'cal-week';
  weekEl.innerHTML = head + cells;
}

// Розкладка міняється не лише при завантаженні: вікно на компʼютері
// розтягують і звужують — і по ширині, і по висоті. Перемальовуємо з тих
// самих даних — у базу за цим ходити не треба.
if (typeof window.matchMedia === 'function') {
  const onChange = () => { renderCalendar(); renderToday(); };
  [WIDE_SCREEN, TALL_SCREEN].forEach((query) => {
    const mq = window.matchMedia(query);
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange);
  });
}

// ---- Рядок під датою ----
// Увесь стан життя за секунду читання, ще до того, як око кудись поїхало.
function renderLine() {
  const lineEl = document.getElementById('todayLine');
  if (!lineEl) return;
  const today = todayISO();

  const dateEl = document.getElementById('todayDate');
  if (dateEl) dateEl.textContent = capitalizeFirst(formatFullDate(today));

  // Поки не приїхало і те, й те — мовчимо. Сказати «а тренування немає» до
  // того, як тренування прочитались, означало б збрехати на пів секунди, а
  // потім себе виправити; рядок читають одним поглядом, і встигне лишитись
  // саме перша версія. Раніше тут ще був окремий шматок про цілі — він пішов
  // разом із перебудовою рядка на одне речення; «11 без кроку» лишилось на
  // плитці цілей, де воно й доречне.
  if (!homeData.tasks || !homeData.workouts) { lineEl.textContent = ''; return; }

  // Рахуємо ЗАПЛАНОВАНЕ на сьогодні, разом із уже зробленим, — те саме
  // число, що й на плитці завдань. Інакше рядок і плитка казали б різне про
  // один день.
  const planned = homeData.tasks.filter((x) => x && x.dueDate === today).length;
  const hasWorkout = !!HomeSummary.workoutToday(homeData.workouts, today);

  if (planned && hasWorkout) lineEl.textContent = t('lineBoth', planned);
  else if (planned) lineEl.textContent = t('lineTasksOnly', planned);
  else if (hasWorkout) lineEl.textContent = t('lineWorkoutOnly');
  else lineEl.textContent = t('lineNothing');
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

// Бюджет і завдання читаються окремими функціями, а не всередині
// loadHomeSummary: форма швидкого запису дописує рівно один із цих розділів і
// має перечитати саме його. Перезавантажувати всю головну заради однієї
// витрати означало б на секунду стерти плитки й рядок під датою — тобто
// показати порожній екран у відповідь на вдале збереження.

// Бюджет: лише поточний місяць.
// Профіль читаємо тим самим запитом, що вже потрібен для валюти, — окремого
// звернення заради категорій форми не робимо.
function loadBudgetSection(userRef) {
  const today = todayISO();
  const monthFrom = HomeSummary.monthStart(today);
  const txPromise = userRef.collection('transactions').where('date', '>=', monthFrom).where('date', '<=', today).get();
  return Promise.all([txPromise, userRef.get()])
    .then(([snap, profileDoc]) => {
      homeData.transactions = snap.docs.map((d) => d.data());
      const profile = profileDoc.data() || {};
      homeCurrency = typeof profile.currency === 'string' ? profile.currency : '';
      setQuickCategories(profile);
      renderBudgetTile();
    })
    .catch((err) => console.error('homeSummary budget:', err));
}

// Завдання: від початку місяця до сьогодні — один діапазон по одному полю,
// тож складений індекс не потрібен. Борги давніші за місяць сюди не
// потраплять: для них у самому модулі є «розбір минулих днів».
//
// Календар показує дні попереду, тож завдання читаються і наперед. Межі
// беремо по сітці МІСЯЦЯ, а не тижня: на широкому екрані малюється саме
// вона, і на неї ж перемальовується сторінка, якщо вікно розтягнути вже
// після завантаження. Ширше на кілька днів — дешевше за другий запит.
function loadTasksSection(userRef) {
  const today = todayISO();
  const monthFrom = HomeSummary.monthStart(today);
  const cal = HomeSummary.monthCalendar([], today);
  const taskFrom = monthFrom < cal.from ? monthFrom : cal.from;
  const taskTo = today > cal.to ? today : cal.to;
  return userRef.collection('tasks').where('dueDate', '>=', taskFrom).where('dueDate', '<=', taskTo).get()
    .then((snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      homeData.tasks = docs;
      renderToday();
      renderCalendar();
      renderLine();
      const sum = HomeSummary.tasksSummary(docs, today);
      // Велике число — скільки СПЛАНОВАНО на сьогодні, разом із уже
      // виконаним. Раніше тут стояло невиконане, і число падало щоразу, як
      // людина ставила галочку: плитка ніби забувала про зроблене. Скільки
      // з них уже закрито, каже окремий рядок.
      const planned = sum.open + sum.done;
      // «Заплановано 8 завдань» — одним рядком, слово перед числом і слово
      // після. Підпис лишається порожнім: скільки з них закрито, видно в
      // самому розділі, куди по галочки й ідуть.
      setStat('tasks', String(planned), t('unitTasks', planned),
        planned ? '' : t('capTasksEmpty'), null, t('prefixPlanned'));
    })
    .catch((err) => console.error('homeSummary tasks:', err));
}

async function loadHomeSummary(uid) {
  const userRef = db.collection('users').doc(uid);
  const today = todayISO();
  const monthFrom = HomeSummary.monthStart(today);
  // Календар показує дні попереду, тож завдання читаються і наперед. Межі
  // беремо по сітці МІСЯЦЯ, а не тижня: на широкому екрані малюється саме
  // вона, і на неї ж перемальовується сторінка, якщо вікно розтягнути вже
  // після завантаження. Ширше на кілька днів — дешевше за другий запит.
  homeData = { transactions: null, tasks: null, goals: null, workouts: null };

  loadBudgetSection(userRef);
  loadTasksSection(userRef);

  // Цілі: їх завжди небагато, тож читаємо всі.
  userRef.collection('goals').get()
    .then((snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      homeData.goals = docs;
      renderToday();
      renderCalendar();
      renderLine();
      const sum = HomeSummary.goalsSummary(docs, today);
      // Рахуємо цілі ПОТОЧНОГО МІСЯЦЯ — тієї самої вкладки, на якій розділ
      // відкривається. Правило бере goals/review.js, а не своє друге: інакше
      // плитка й розділ рахували б по-різному, і число на головній нічого не
      // означало б. Незакриті цілі з минулих місяців воно теж підтягує сюди —
      // саме про них треба памʼятати найбільше.
      const monthKey = today.slice(0, 7);
      const monthGoals = window.GoalReview
        ? window.GoalReview.goalsOfMonth(docs, monthKey, { currentMonth: monthKey })
          .filter((g) => g && g.status === 'active')
        : docs.filter((g) => g && g.status === 'active');
      // Одна ціль під числом — випадкова, і на кожне відкриття головної інша.
      // Раніше тут стояла найтерміновіша, і з десятка цілей на очі місяцями
      // потрапляла та сама.
      const shown = HomeSummary.pickGoal(monthGoals);
      setStat('goals', String(monthGoals.length), t('unitThisMonth'),
        shown ? shown.title : t('capGoalsMonthNone'),
        sum.pending ? t('capNoStep', sum.pending) : null);
    })
    .catch((err) => console.error('homeSummary goals:', err));

  // Тренування: два запити — останнє зроблене (не в майбутньому) і найближче
  // заплановане (у майбутньому). Плитка відповідає на «що в мене сьогодні», а
  // коли сьогодні нічого — на «а коли наступне».
  //
  // Межа `date <= today` у першому запиті не косметична: план на наступний
  // тиждень записують тими самими документами, що й зроблене, тож без неї
  // найсвіжішим виявлявся план, і плитка казала «-4 дні тому». Діапазон і
  // сортування по одному полю — окремий складений індекс не потрібен.
  Promise.all([
    userRef.collection('workouts').where('date', '<=', today).orderBy('date', 'desc').limit(1).get(),
    userRef.collection('workouts').where('date', '>', today).orderBy('date', 'asc').limit(1).get(),
  ])
    .then(([pastSnap, nextSnap]) => {
      const docs = pastSnap.docs.map((d) => d.data());
      const next = HomeSummary.nextWorkout(nextSnap.docs.map((d) => d.data()), today);
      homeData.workouts = docs;
      renderToday();
      renderCalendar();
      renderLine();

      const todayWorkout = HomeSummary.workoutToday(docs, today);
      if (todayWorkout) {
        // Записане наперед (підходи порожні) — це план, і казати про нього
        // «зроблено» було б неправдою: його ще тільки роблять. Тому різниця
        // лишається в числі (вправи проти підходів), а підпис один: «сьогодні
        // є тренування» правда і про заплановане, і про розпочате.
        setStat('workout', todayWorkout.planned
          ? String(todayWorkout.exercises) : `${todayWorkout.setsDone}/${todayWorkout.setsTotal}`,
          todayWorkout.planned ? t('unitExercises') : t('unitSets'),
          t('capWorkoutToday'), null);
        return;
      }

      // Сьогодні нічого. Тоді головне — коли наступне: «завтра» й
      // «післязавтра» словами, далі датою (див. nextDayKind).
      const kind = next ? HomeSummary.nextDayKind(next.date, today) : null;
      let second;
      if (!kind) {
        // Попереду не заплановано нічого — тоді плитка не звітує, а запрошує.
        second = t('capWorkoutInvite');
      } else if (kind === 'date') {
        const when = new Intl.DateTimeFormat(LOCALE_MAP[currentLang] || 'uk-UA',
          { day: 'numeric', month: 'long' }).format(new Date(next.date + 'T00:00:00'));
        second = t('capWorkoutNext', when);
      } else {
        second = t('capWorkoutNext', t(kind === 'tomorrow' ? 'whenTomorrow' : 'whenDayAfter'));
      }
      setStat('workout', '—', '', `${t('capWorkoutNone')}\n${second}`, null);
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

// Колонка розділів веде сюди з хешем: у розділі кнопки «Експорт даних» і
// «Налаштування» нічого відкрити не можуть — і діалог експорту, і меню
// налаштувань живуть на головній. Хеш прибираємо одразу, щоб оновлення
// сторінки не відкривало те саме вдруге, а «назад» вело туди, звідки
// прийшли: той самий прийом, що й #new у розділах.
function openFromHash() {
  const hash = location.hash;
  if (hash !== '#export' && hash !== '#settings') return;
  try { history.replaceState(null, '', location.pathname + location.search); }
  catch (err) { /* file:// */ }
  // Даємо сторінці домалювати перший кадр — інакше діалог відкривається
  // над ще порожнім екраном.
  setTimeout(() => {
    if (hash === '#export') openExportDialog(); else toggleAppMenu();
  }, 0);
}
openFromHash();
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
        // Підписи «Показувати / Ховати» теж мовні.
        renderAmountsToggle();
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
