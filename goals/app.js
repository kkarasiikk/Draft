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
    cat_health: 'Здоров’я', cat_finance: 'Фінанси', cat_learning: 'Навчання', cat_career: 'Кар’єра',
    cat_relationships: 'Стосунки', cat_travel: 'Подорожі', cat_creativity: 'Творчість', cat_other: 'Інше',
    whyLabel: 'Навіщо тобі це?', whyPlaceholder: 'Чому ця ціль важлива саме для тебе (необов’язково)',
    targetDateLabel: 'Дедлайн (необов’язково)',
    milestonesLabel: 'Віхи', targetValueLabel: 'Числова мета (необовʼязково)',
    targetValueHint: 'Якщо задати — прогрес рахується числом, а не віхами.',
    targetValuePlaceholder: '10', unitPlaceholder: 'км',
    addProgressPlaceholder: '+ скільки', addProgressBtn: 'Додати', milestonePlaceholder: 'Наприклад: пройти перші 5 уроків',
    addMilestoneBtn: '+ Додати віху',
    breakdownBtn: 'Запропонувати віхи', breakdownWorking: 'Думаю…',
    breakdownError: 'Не вдалося розбити ціль. Спробуй ще раз або сформулюй її конкретніше.',
    breakdownNoTitle: 'Спершу введи назву цілі.',
    titleRequiredError: 'Введи назву цілі',
    saveBtn: 'Зберегти', deleteBtn: 'Видалити', cancelBtn: 'Скасувати', deleteConfirmBtn: 'Видалити',
    unsavedTitle: 'Зберегти зміни?',
    unsavedSub: 'Є незбережені зміни. Якщо вийти зараз, вони пропадуть.',
    unsavedSave: 'Зберегти', unsavedDiscard: 'Не зберігати', unsavedKeep: 'Продовжити редагування',
    confirmDeleteTitle: 'Видалити ціль?',
    confirmDeleteSub: 'Цю дію не можна скасувати. Усі віхи, нотатки й серія теж зникнуть.',
    fabNewGoalLabel: 'Нова ціль', bnGoals: 'Цілі', bnHome: 'Головна',
    statusAll: 'Усі', statusActive: 'Активні', statusDone: 'Завершені', statusArchived: 'Архів',
    noMilestonesYet: 'Ще немає віх — додай перший крок у редагуванні цілі',
    allMilestonesDoneMsg: '🎉 Усі віхи пройдено!',
    markGoalDoneBtn: 'Позначити ціль виконаною',
    nextStopBadge: 'Наступна зупинка',
    checkinBtnLabel: 'Зробив крок сьогодні', checkinBtnLabelDone: 'Зроблено сьогодні',
    rescueMsg: (n) => `Вчора пропущено. Серія на ${n} дн. ще ціла — врятувати?`,
    rescueBtn: 'Врятувати серію',
    actionsLabel: 'Щоденні дії',
    actionsHint: 'Дрібні кроки, які ведуть до цілі. Виконав — день у серії відмічається сам.',
    actionPlaceholder: 'Що зробити для цієї цілі?',
    actionsEmpty: 'Ще немає щоденних дій — додай перший крок нижче.',
    actionOverdue: 'прострочено',
    rescueWait: (n) => `Серія обірвалась. Наступний рятунок буде доступний через ${n} дн.`,
    eveningTitle: 'Як пройшов день?',
    eveningSub: 'Відмічай, що вдалося. Якщо ні — скажи одним словом, що завадило.',
    eveningYes: '✓ Було', eveningNo: 'Не вийшло', eveningLater: 'Пізніше',
    eveningRescue: '🛟 Врятувати серію',
    reason_noTime: 'Не було часу', reason_forgot: 'Забув(ла)', reason_tired: 'Втома',
    reason_mood: 'Не було настрою', reason_other: 'Інше',
    journalPlaceholder: 'Що сьогодні зробив(ла) для цієї цілі?',
    journalEmpty: 'Ще нема нотаток', journalSectionLabel: 'Щоденник',
    summaryActiveLabel: 'Активні', summaryStreakLabel: 'Серія', summaryDoneMonthLabel: 'За місяць',
    badge_streak7: '🔥 Серія 7 днів', badge_firstDone: '🏆 Перша ціль завершена',
    badge_firstStep: '🌱 Перший крок', badge_perfect: '💯 Ціль без прогалин',
    dashboardEmptyTitle: 'Ще немає цілей', dashboardEmptySub: 'Додай першу ціль кнопкою внизу.',
    daysLeftLabel: (n) => `${n} дн. до дедлайну`, overdueLabel: 'Прострочено',
    milestonesCountSuffix: 'віх',
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
    cat_health: 'Здоровье', cat_finance: 'Финансы', cat_learning: 'Обучение', cat_career: 'Карьера',
    cat_relationships: 'Отношения', cat_travel: 'Путешествия', cat_creativity: 'Творчество', cat_other: 'Другое',
    whyLabel: 'Зачем тебе это?', whyPlaceholder: 'Почему эта цель важна именно для тебя (необязательно)',
    targetDateLabel: 'Дедлайн (необязательно)',
    milestonesLabel: 'Вехи', targetValueLabel: 'Числовая цель (необязательно)',
    targetValueHint: 'Если задать — прогресс считается числом, а не вехами.',
    targetValuePlaceholder: '10', unitPlaceholder: 'км',
    addProgressPlaceholder: '+ сколько', addProgressBtn: 'Добавить', milestonePlaceholder: 'Например: пройти первые 5 уроков',
    addMilestoneBtn: '+ Добавить веху',
    breakdownBtn: 'Предложить вехи', breakdownWorking: 'Думаю…',
    breakdownError: 'Не удалось разбить цель. Попробуй ещё раз или сформулируй её конкретнее.',
    breakdownNoTitle: 'Сначала введи название цели.',
    titleRequiredError: 'Введи название цели',
    saveBtn: 'Сохранить', deleteBtn: 'Удалить', cancelBtn: 'Отмена', deleteConfirmBtn: 'Удалить',
    unsavedTitle: 'Сохранить изменения?',
    unsavedSub: 'Есть несохранённые изменения. Если выйти сейчас, они пропадут.',
    unsavedSave: 'Сохранить', unsavedDiscard: 'Не сохранять', unsavedKeep: 'Продолжить редактирование',
    confirmDeleteTitle: 'Удалить цель?',
    confirmDeleteSub: 'Это действие нельзя отменить. Все вехи, заметки и серия тоже исчезнут.',
    fabNewGoalLabel: 'Новая цель', bnGoals: 'Цели', bnHome: 'Главная',
    statusAll: 'Все', statusActive: 'Активные', statusDone: 'Завершённые', statusArchived: 'Архив',
    noMilestonesYet: 'Ещё нет вех — добавь первый шаг в редактировании цели',
    allMilestonesDoneMsg: '🎉 Все вехи пройдены!',
    markGoalDoneBtn: 'Отметить цель выполненной',
    nextStopBadge: 'Следующая остановка',
    checkinBtnLabel: 'Сделал шаг сегодня', checkinBtnLabelDone: 'Сделано сегодня',
    rescueMsg: (n) => `Вчера пропущено. Серия на ${n} дн. ещё цела — спасти?`,
    rescueBtn: 'Спасти серию',
    actionsLabel: 'Ежедневные действия',
    actionsHint: 'Мелкие шаги к цели. Выполнил — день в серии отмечается сам.',
    actionPlaceholder: 'Что сделать для этой цели?',
    actionsEmpty: 'Ещё нет ежедневных действий — добавь первый шаг ниже.',
    actionOverdue: 'просрочено',
    rescueWait: (n) => `Серия оборвалась. Следующее спасение будет доступно через ${n} дн.`,
    eveningTitle: 'Как прошёл день?',
    eveningSub: 'Отмечай, что получилось. Если нет — скажи одним словом, что помешало.',
    eveningYes: '✓ Было', eveningNo: 'Не вышло', eveningLater: 'Позже',
    eveningRescue: '🛟 Спасти серию',
    reason_noTime: 'Не было времени', reason_forgot: 'Забыл(а)', reason_tired: 'Усталость',
    reason_mood: 'Не было настроения', reason_other: 'Другое',
    journalPlaceholder: 'Что сегодня сделал(а) для этой цели?',
    journalEmpty: 'Ещё нет заметок', journalSectionLabel: 'Дневник',
    summaryActiveLabel: 'Активные', summaryStreakLabel: 'Серия', summaryDoneMonthLabel: 'За месяц',
    badge_streak7: '🔥 Серия 7 дней', badge_firstDone: '🏆 Первая цель завершена',
    badge_firstStep: '🌱 Первый шаг', badge_perfect: '💯 Цель без пропусков',
    dashboardEmptyTitle: 'Пока нет целей', dashboardEmptySub: 'Добавь первую цель кнопкой внизу.',
    daysLeftLabel: (n) => `${n} дн. до дедлайна`, overdueLabel: 'Просрочено',
    milestonesCountSuffix: 'вех',
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
    cat_health: 'Zdrowie', cat_finance: 'Finanse', cat_learning: 'Nauka', cat_career: 'Kariera',
    cat_relationships: 'Relacje', cat_travel: 'Podróże', cat_creativity: 'Kreatywność', cat_other: 'Inne',
    whyLabel: 'Po co ci to?', whyPlaceholder: 'Dlaczego ten cel jest dla ciebie ważny (opcjonalnie)',
    targetDateLabel: 'Termin (opcjonalnie)',
    milestonesLabel: 'Kamienie milowe', targetValueLabel: 'Cel liczbowy (opcjonalnie)',
    targetValueHint: 'Jeśli podasz — postęp liczy się liczbą, a nie kamieniami milowymi.',
    targetValuePlaceholder: '10', unitPlaceholder: 'km',
    addProgressPlaceholder: '+ ile', addProgressBtn: 'Dodaj', milestonePlaceholder: 'Np.: ukończyć pierwsze 5 lekcji',
    addMilestoneBtn: '+ Dodaj kamień milowy',
    breakdownBtn: 'Zaproponuj kamienie milowe', breakdownWorking: 'Myślę…',
    breakdownError: 'Nie udało się rozbić celu. Spróbuj ponownie albo sformułuj go konkretniej.',
    breakdownNoTitle: 'Najpierw wpisz nazwę celu.',
    titleRequiredError: 'Wpisz nazwę celu',
    saveBtn: 'Zapisz', deleteBtn: 'Usuń', cancelBtn: 'Anuluj', deleteConfirmBtn: 'Usuń',
    unsavedTitle: 'Zapisać zmiany?',
    unsavedSub: 'Są niezapisane zmiany. Jeśli teraz wyjdziesz, przepadną.',
    unsavedSave: 'Zapisz', unsavedDiscard: 'Nie zapisuj', unsavedKeep: 'Wróć do edycji',
    confirmDeleteTitle: 'Usunąć cel?',
    confirmDeleteSub: 'Tej czynności nie można cofnąć. Wszystkie kamienie milowe, notatki i seria też znikną.',
    fabNewGoalLabel: 'Nowy cel', bnGoals: 'Cele', bnHome: 'Główna',
    statusAll: 'Wszystkie', statusActive: 'Aktywne', statusDone: 'Ukończone', statusArchived: 'Archiwum',
    noMilestonesYet: 'Jeszcze brak kamieni milowych — dodaj pierwszy krok w edycji celu',
    allMilestonesDoneMsg: '🎉 Wszystkie kamienie milowe osiągnięte!',
    markGoalDoneBtn: 'Oznacz cel jako ukończony',
    nextStopBadge: 'Następny przystanek',
    checkinBtnLabel: 'Zrobiłem krok dzisiaj', checkinBtnLabelDone: 'Zrobione dzisiaj',
    rescueMsg: (n) => `Wczoraj wypadło. Seria ${n} dni jest jeszcze cała — uratować?`,
    rescueBtn: 'Uratuj serię',
    actionsLabel: 'Codzienne działania',
    actionsHint: 'Drobne kroki do celu. Zrobione — dzień w serii zaznacza się sam.',
    actionPlaceholder: 'Co zrobić dla tego celu?',
    actionsEmpty: 'Brak codziennych działań — dodaj pierwszy krok poniżej.',
    actionOverdue: 'po terminie',
    rescueWait: (n) => `Seria się urwała. Kolejny ratunek będzie dostępny za ${n} dni.`,
    eveningTitle: 'Jak minął dzień?',
    eveningSub: 'Zaznacz, co się udało. Jeśli nie — powiedz jednym słowem, co przeszkodziło.',
    eveningYes: '✓ Udało się', eveningNo: 'Nie wyszło', eveningLater: 'Później',
    eveningRescue: '🛟 Uratuj serię',
    reason_noTime: 'Brak czasu', reason_forgot: 'Zapomniałem', reason_tired: 'Zmęczenie',
    reason_mood: 'Brak nastroju', reason_other: 'Inne',
    journalPlaceholder: 'Co dziś zrobiłeś(aś) dla tego celu?',
    journalEmpty: 'Jeszcze brak notatek', journalSectionLabel: 'Dziennik',
    summaryActiveLabel: 'Aktywne', summaryStreakLabel: 'Seria', summaryDoneMonthLabel: 'W tym mies.',
    badge_streak7: '🔥 Seria 7 dni', badge_firstDone: '🏆 Pierwszy ukończony cel',
    badge_firstStep: '🌱 Pierwszy krok', badge_perfect: '💯 Cel bez przerw',
    dashboardEmptyTitle: 'Jeszcze brak celów', dashboardEmptySub: 'Dodaj pierwszy cel przyciskiem poniżej.',
    daysLeftLabel: (n) => `${n} dni do terminu`, overdueLabel: 'Po terminie',
    milestonesCountSuffix: 'kam.',
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
    cat_health: 'Health', cat_finance: 'Finance', cat_learning: 'Learning', cat_career: 'Career',
    cat_relationships: 'Relationships', cat_travel: 'Travel', cat_creativity: 'Creativity', cat_other: 'Other',
    whyLabel: 'Why do you want this?', whyPlaceholder: 'Why this goal matters to you (optional)',
    targetDateLabel: 'Deadline (optional)',
    milestonesLabel: 'Milestones', targetValueLabel: 'Numeric target (optional)',
    targetValueHint: 'Set it and progress is counted by the number, not by milestones.',
    targetValuePlaceholder: '10', unitPlaceholder: 'km',
    addProgressPlaceholder: '+ how much', addProgressBtn: 'Add', milestonePlaceholder: 'E.g.: finish the first 5 lessons',
    addMilestoneBtn: '+ Add milestone',
    breakdownBtn: 'Suggest milestones', breakdownWorking: 'Thinking…',
    breakdownError: 'Could not break this goal down. Try again or make it more specific.',
    breakdownNoTitle: 'Give the goal a name first.',
    titleRequiredError: 'Enter a goal title',
    saveBtn: 'Save', deleteBtn: 'Delete', cancelBtn: 'Cancel', deleteConfirmBtn: 'Delete',
    unsavedTitle: 'Save changes?',
    unsavedSub: 'There are unsaved changes. Leaving now discards them.',
    unsavedSave: 'Save', unsavedDiscard: "Don't save", unsavedKeep: 'Keep editing',
    confirmDeleteTitle: 'Delete goal?',
    confirmDeleteSub: 'This action cannot be undone. Milestones, notes and streak will be lost too.',
    fabNewGoalLabel: 'New goal', bnGoals: 'Goals', bnHome: 'Home',
    statusAll: 'All', statusActive: 'Active', statusDone: 'Done', statusArchived: 'Archived',
    noMilestonesYet: 'No milestones yet — add the first step by editing the goal',
    allMilestonesDoneMsg: '🎉 All milestones reached!',
    markGoalDoneBtn: 'Mark goal as done',
    nextStopBadge: 'Next stop',
    checkinBtnLabel: 'I took a step today', checkinBtnLabelDone: 'Done for today',
    rescueMsg: (n) => `You missed yesterday. A ${n}-day streak is still savable — rescue it?`,
    rescueBtn: 'Rescue the streak',
    actionsLabel: 'Daily actions',
    actionsHint: 'Small steps toward the goal. Tick one off and the day is checked in for you.',
    actionPlaceholder: 'What should you do for this goal?',
    actionsEmpty: 'No daily actions yet — add the first step below.',
    actionOverdue: 'overdue',
    rescueWait: (n) => `The streak broke. The next rescue unlocks in ${n} days.`,
    eveningTitle: 'How did the day go?',
    eveningSub: 'Tick off what you managed. If not — say in one word what got in the way.',
    eveningYes: '✓ Did it', eveningNo: 'Didn\u2019t happen', eveningLater: 'Later',
    eveningRescue: '🛟 Rescue the streak',
    reason_noTime: 'No time', reason_forgot: 'Forgot', reason_tired: 'Too tired',
    reason_mood: 'Not in the mood', reason_other: 'Other',
    journalPlaceholder: 'What did you do for this goal today?',
    journalEmpty: 'No notes yet', journalSectionLabel: 'Journal',
    summaryActiveLabel: 'Active', summaryStreakLabel: 'Streak', summaryDoneMonthLabel: 'This month',
    badge_streak7: '🔥 7-day streak', badge_firstDone: '🏆 First goal completed',
    badge_firstStep: '🌱 First step', badge_perfect: '💯 Goal with no gaps',
    dashboardEmptyTitle: 'No goals yet', dashboardEmptySub: 'Add your first goal with the button below.',
    daysLeftLabel: (n) => `${n}d left`, overdueLabel: 'Overdue',
    milestonesCountSuffix: 'milestones',
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
const CATEGORIES = ['health', 'finance', 'learning', 'career', 'relationships', 'travel', 'creativity', 'other'];
function categoryLabel(cat) {
  return t('cat_' + (CATEGORIES.includes(cat) ? cat : 'other'));
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
}

// ---- Переклад статичних елементів ----
function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  document.title = `${t('pageTitle')} · Life`;
  document.getElementById('openNewGoalBtn').setAttribute('aria-label', t('fabNewGoalLabel'));
  document.getElementById('bnGoalsLabel').textContent = t('bnGoals');
  document.getElementById('bnHomeLabel').textContent = t('bnHome');
  document.getElementById('goalModalTitle').textContent = editingGoalId ? t('editGoalTitle') : t('newGoalTitle');
  document.getElementById('categoryLabel').textContent = t('categoryLabel');
  document.getElementById('whyLabel').textContent = t('whyLabel');
  document.getElementById('goalWhyInput').placeholder = t('whyPlaceholder');
  document.getElementById('targetDateLabel').textContent = t('targetDateLabel');
  document.getElementById('milestonesLabel').textContent = t('milestonesLabel');
  document.getElementById('targetValueLabel').textContent = t('targetValueLabel');
  document.getElementById('targetValueHint').textContent = t('targetValueHint');
  document.getElementById('goalTargetValue').placeholder = t('targetValuePlaceholder');
  document.getElementById('goalUnitInput').placeholder = t('unitPlaceholder');
  document.getElementById('addMilestoneBtn').textContent = t('addMilestoneBtn');
  document.getElementById('breakdownBtnLabel').textContent = t('breakdownBtn');
  document.getElementById('deleteGoalBtn').textContent = t('deleteBtn');
  document.getElementById('goalSubmitBtn').textContent = t('saveBtn');
  document.getElementById('goalTitleInput').placeholder = t('titlePlaceholder');
  document.getElementById('journalInput').placeholder = t('journalPlaceholder');
  document.getElementById('journalSectionLabel').textContent = t('journalSectionLabel');
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
  refreshDatePickersLang();
  if (document.getElementById('goalFormOverlay').classList.contains('show')) {
    renderCategoryPicker();
    renderMilestonesEditor();
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
function isoDateShift(iso, deltaDays) {
  const dt = parseISODate(iso);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid4() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`).slice(0, 36);
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

// ---- Стан ----
let goals = [];
let unsubscribeGoals = null;
let currentScreen = 'dashboard'; // 'dashboard' | 'detail'
let activeDetailGoalId = null;
let statusFilter = 'active'; // null(all) | 'active' | 'done' | 'archived'
let editingGoalId = null;
let formCategory = 'other';
let formMilestones = [];
let pendingDeleteId = null;
// Яка ціль у вечірньому підсумку зараз питає «що завадило».
let eveningReasonForId = null;
// Щоденні дії відкритої цілі — це звичайні завдання з розділу «Завдання»,
// просто відфільтровані за goalId. Слухаємо їх лише поки ціль відкрита:
// тримати підписку на весь список заради екрана, якого не видно, ні до чого.
let goalActions = [];
let unsubscribeActions = null;
const EVENING_DISMISS_KEY = 'goalsEveningDismissed';

// ---- Дані (Firestore, реалтайм) ----
function subscribeToGoals(uid) {
  if (unsubscribeGoals) unsubscribeGoals();
  const col = db.collection('users').doc(uid).collection('goals');
  unsubscribeGoals = col.onSnapshot((snap) => {
    goals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCurrentScreen();
  }, (err) => console.error('subscribeToGoals:', err));
}

// ---- Обчислення (завжди похідні від живих даних, нічого не кешується) ----
// Прогрес має два джерела, і числове важливіше: якщо людина задала мету
// «10 км», відсоток має рахуватись від пройденого, а не від того, скільки
// віх вона встигла придумати. Віхи лишаються для цілей, які числом не
// міряються — «вивчити польську».
function progressOf(goal) {
  const target = Number(goal.targetValue);
  if (Number.isFinite(target) && target > 0) {
    const current = Number(goal.currentValue) || 0;
    return {
      kind: 'value',
      current,
      target,
      unit: goal.unit || '',
      // Понад 100% не показуємо: смужка не вміє бути повнішою за повну,
      // а сам перебіг видно в числах поруч.
      pct: Math.min(100, Math.round((current / target) * 100)),
    };
  }
  const milestones = goal.milestones || [];
  if (!milestones.length) return null;
  const done = milestones.filter((m) => m.done).length;
  return { kind: 'milestones', done, total: milestones.length, pct: Math.round((done / milestones.length) * 100) };
}

// Число без хвоста нулів: 6.4, 10, 0.5 — а не 6.40 і не 10.00.
function fmtValue(n) {
  const num = Number(n) || 0;
  return String(Math.round(num * 100) / 100);
}
// Серія, рятунок і вечірня черга живуть у goals/streak.js — тим самим
// модулем користується AI-помічник на сервері. Правило «коли рятунок
// доступний» мусить бути одне: інакше в чаті пишеться одне, а на сторінці
// показується інше.
const Streak = window.GoalStreak;
function computeStreak(checkins) {
  return Streak.computeStreak(checkins, todayISO());
}

// Причини зберігаємо ключами, а не перекладеним текстом: людина може
// перемкнути мову, і тоді «Не було часу» та «No time» рахувалися б як дві
// різні причини. Вільний текст (з чату) лишається як є.
const BLOCKER_KEYS = ['noTime', 'forgot', 'tired', 'mood', 'other'];
function blockerLabel(reason) {
  return BLOCKER_KEYS.includes(reason) ? t('reason_' + reason) : reason;
}
function daysToDeadline(targetDate) {
  const today = parseISODate(todayISO());
  const target = parseISODate(targetDate);
  return Math.round((target - today) / 86400000);
}
function computeSummary(list) {
  const activeCount = list.filter((g) => g.status === 'active').length;
  const bestStreak = list.reduce((max, g) => Math.max(max, computeStreak(g.checkins)), 0);
  const now = new Date();
  // Наближення: рахуємо по updatedAt, а не окремому полі completedAt (якого
  // немає в схемі) — якщо вже завершену ціль відредагувати іншого місяця,
  // вона випаде з підрахунку. Прийнятно для інформативної плашки на
  // дашборді, не для точної статистики.
  const completedThisMonth = list.filter((g) => {
    if (g.status !== 'done' || !g.updatedAt || typeof g.updatedAt.toDate !== 'function') return false;
    const d = g.updatedAt.toDate();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  return { activeCount, bestStreak, completedThisMonth };
}
function computeBadges(list) {
  const badges = [];
  if (list.some((g) => computeStreak(g.checkins) >= 7)) badges.push('badge_streak7');
  if (list.filter((g) => g.status === 'done').length >= 1) badges.push('badge_firstDone');
  if (list.some((g) => (g.checkins || []).length >= 1)) badges.push('badge_firstStep');
  if (list.some((g) => { const p = progressOf(g); return p && p.pct === 100; })) badges.push('badge_perfect');
  return badges;
}

// ---- Рендер: дашборд ----
function renderCurrentScreen() {
  if (currentScreen === 'detail' && activeDetailGoalId) {
    const goal = goals.find((g) => g.id === activeDetailGoalId);
    if (goal) { renderGoalDetail(goal); return; }
    // Ціль зникла (видалена з іншого пристрою) — повертаємось на дашборд.
    currentScreen = 'dashboard';
    activeDetailGoalId = null;
    stopActions();
    document.getElementById('goalDetailScreen').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = '';
  }
  renderDashboard();
}

function renderDashboard() {
  renderSummaryStrip();
  renderBadgesRow();
  renderEveningCard();
  renderStatusFilterRow();
  renderGoalsList();
}

// ---- Вечірній підсумок ----
// З'являється надвечір і питає рівно про те, на що ще нема відповіді.
// Відповів «було» чи назвав причину — ціль зникає зі списку; відповів на
// всі — картка зникає сама. Це не звіт, а два дотики перед сном.
function renderEveningCard() {
  const host = document.getElementById('eveningCard');
  if (!host) return;
  const today = todayISO();
  if (!Streak.isEvening(new Date()) || localStorage.getItem(EVENING_DISMISS_KEY) === today) {
    host.innerHTML = '';
    return;
  }
  // Більше п'яти питань перед сном — це вже допит. Решта дочекається
  // наступного перерендеру: відповіді прибирають цілі з черги.
  const queue = Streak.eveningQueue(goals, today).slice(0, 5);
  if (!queue.length) { host.innerHTML = ''; return; }

  host.innerHTML = `
    <div class="evening-card">
      <div class="evening-head">
        <div class="evening-title">${escapeHtml(t('eveningTitle'))}</div>
        <button type="button" class="evening-later" id="eveningLaterBtn">${escapeHtml(t('eveningLater'))}</button>
      </div>
      <div class="evening-sub">${escapeHtml(t('eveningSub'))}</div>
      ${queue.map((g) => {
        const rescue = Streak.rescueState(g, today);
        const canRescue = rescue && rescue.available;
        const reasons = eveningReasonForId === g.id
          ? `<div class="evening-reasons">${BLOCKER_KEYS.map((k) =>
              `<button type="button" class="evening-reason" data-reason="${k}" data-goal="${g.id}">${escapeHtml(t('reason_' + k))}</button>`).join('')}</div>`
          : '';
        return `
        <div class="evening-goal">
          <div class="evening-goal-title">${escapeHtml(g.title || '')}</div>
          <div class="evening-actions">
            <button type="button" class="evening-btn yes" data-yes="${g.id}">${escapeHtml(t('eveningYes'))}</button>
            <button type="button" class="evening-btn" data-no="${g.id}">${escapeHtml(t('eveningNo'))}</button>
            ${canRescue ? `<button type="button" class="evening-btn" data-rescue="${g.id}">${escapeHtml(t('eveningRescue'))}</button>` : ''}
          </div>
          ${reasons}
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('eveningLaterBtn').addEventListener('click', () => {
    localStorage.setItem(EVENING_DISMISS_KEY, today);
    eveningReasonForId = null;
    renderEveningCard();
  });
  host.querySelectorAll('[data-yes]').forEach((btn) => {
    btn.addEventListener('click', () => { eveningReasonForId = null; toggleTodayCheckin(btn.dataset.yes); });
  });
  host.querySelectorAll('[data-no]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Другий дотик по «не вийшло» згортає причини — щоб натиснуте
      // помилково можна було закрити, а не тільки чимось відповісти.
      eveningReasonForId = eveningReasonForId === btn.dataset.no ? null : btn.dataset.no;
      renderEveningCard();
    });
  });
  host.querySelectorAll('[data-reason]').forEach((btn) => {
    btn.addEventListener('click', () => { eveningReasonForId = null; logBlocker(btn.dataset.goal, btn.dataset.reason); });
  });
  host.querySelectorAll('[data-rescue]').forEach((btn) => {
    btn.addEventListener('click', () => rescueStreak(btn.dataset.rescue));
  });
}

function renderSummaryStrip() {
  const s = computeSummary(goals);
  document.getElementById('summaryStrip').innerHTML = `
    <div class="summary-tile"><div class="summary-tile-value">${s.activeCount}</div><div class="summary-tile-label">${escapeHtml(t('summaryActiveLabel'))}</div></div>
    <div class="summary-tile"><div class="summary-tile-value">${s.bestStreak}</div><div class="summary-tile-label">${escapeHtml(t('summaryStreakLabel'))}</div></div>
    <div class="summary-tile"><div class="summary-tile-value">${s.completedThisMonth}</div><div class="summary-tile-label">${escapeHtml(t('summaryDoneMonthLabel'))}</div></div>`;
}

function renderBadgesRow() {
  const badges = computeBadges(goals);
  const row = document.getElementById('badgesRow');
  row.innerHTML = badges.map((key) => `<span class="badge-chip">${escapeHtml(t(key))}</span>`).join('');
}

function renderStatusFilterRow() {
  const options = [[null, t('statusAll')], ['active', t('statusActive')], ['done', t('statusDone')], ['archived', t('statusArchived')]];
  const row = document.getElementById('statusFilterRow');
  row.innerHTML = options.map(([val, label]) =>
    `<button type="button" class="tag-filter-chip${statusFilter === val ? ' selected' : ''}" data-status="${val === null ? '' : val}">${escapeHtml(label)}</button>`
  ).join('');
  row.querySelectorAll('[data-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      statusFilter = btn.dataset.status || null;
      renderStatusFilterRow();
      renderGoalsList();
    });
  });
}

function goalCardHtml(goal) {
  const prog = progressOf(goal);
  const streak = computeStreak(goal.checkins);
  const metaParts = [];
  if (streak > 0) metaParts.push(`<span class="goal-streak-flame">🔥 ${streak}</span>`);
  if (goal.targetDate) {
    const days = daysToDeadline(goal.targetDate);
    const overdue = days < 0;
    const activeOverdue = overdue && goal.status === 'active';
    metaParts.push(`<span class="goal-card-deadline${activeOverdue ? ' overdue' : ''}">${escapeHtml(overdue ? t('overdueLabel') : t('daysLeftLabel', days))}</span>`);
  }
  if (prog && prog.kind === 'value') {
    metaParts.push(`<span>${escapeHtml(fmtValue(prog.current))} / ${escapeHtml(fmtValue(prog.target))} ${escapeHtml(prog.unit)}</span>`);
  } else if (prog) {
    metaParts.push(`<span>${prog.done}/${prog.total} ${escapeHtml(t('milestonesCountSuffix'))}</span>`);
  }
  const statusBadge = goal.status !== 'active'
    ? `<span class="goal-card-status-badge">${escapeHtml(goal.status === 'done' ? t('statusDone') : t('statusArchived'))}</span>`
    : '';
  return `
    <div class="card goal-card" data-open-goal="${goal.id}">
      <div class="goal-card-top">
        <div>
          <span class="category-chip ${goal.category}">${escapeHtml(categoryLabel(goal.category))}</span>
          <div class="goal-card-title">${escapeHtml(goal.title)}</div>
        </div>
        ${statusBadge}
      </div>
      ${prog ? `<div class="goal-mini-progress"><div class="goal-mini-progress-fill" style="width:${prog.pct}%"></div></div>` : ''}
      ${metaParts.length ? `<div class="goal-card-meta">${metaParts.join('')}</div>` : ''}
    </div>`;
}

function renderGoalsList() {
  const list = statusFilter ? goals.filter((g) => g.status === statusFilter) : goals;
  const el = document.getElementById('goalsList');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="title">${escapeHtml(t('dashboardEmptyTitle'))}</div><div>${escapeHtml(t('dashboardEmptySub'))}</div></div>`;
    return;
  }
  el.innerHTML = list.map(goalCardHtml).join('');
  el.querySelectorAll('[data-open-goal]').forEach((card) => {
    card.addEventListener('click', () => showGoalDetail(card.dataset.openGoal));
  });
}

// ---- Навігація між екранами ----
function showGoalDetail(id) {
  activeDetailGoalId = id;
  currentScreen = 'detail';
  subscribeToActions(id);
  document.getElementById('journalInput').value = '';
  document.getElementById('dashboardScreen').style.display = 'none';
  document.getElementById('goalDetailScreen').style.display = 'block';
  renderCurrentScreen();
}
function showDashboard() {
  currentScreen = 'dashboard';
  activeDetailGoalId = null;
  stopActions();
  document.getElementById('goalDetailScreen').style.display = 'none';
  document.getElementById('dashboardScreen').style.display = '';
  renderCurrentScreen();
}
document.getElementById('detailBackBtn').addEventListener('click', showDashboard);
// Вкладка «Цілі» — і повернення з екрана деталей, і просто підсвічений стан.
document.getElementById('bnGoals').addEventListener('click', showDashboard);

// ---- Рендер: деталі цілі ----
function renderGoalDetail(goal) {
  document.getElementById('detailTitleLabel').textContent = goal.title;
  document.getElementById('detailEditBtn').onclick = () => openGoalForm(goal);

  const statusBadge = goal.status !== 'active'
    ? `<span class="goal-card-status-badge">${escapeHtml(goal.status === 'done' ? t('statusDone') : t('statusArchived'))}</span>`
    : '';
  document.getElementById('detailBadgesRow').innerHTML =
    `<span class="category-chip ${goal.category}">${escapeHtml(categoryLabel(goal.category))}</span>${statusBadge}`;

  document.getElementById('detailWhyBlock').innerHTML = goal.why
    ? `<div class="why-block">“${escapeHtml(goal.why)}”</div>` : '';

  const prog = progressOf(goal);
  const progressEl = document.getElementById('detailProgressBlock');
  if (prog && prog.kind === 'value') {
    // Числова мета показується смужкою, а не кільцем: у кільце не влазить
    // «6.4 / 10 км», а саме ці числа тут головні.
    progressEl.innerHTML = `
      <div class="value-progress">
        <div class="value-progress-head">
          <span class="value-progress-now">${escapeHtml(fmtValue(prog.current))} / ${escapeHtml(fmtValue(prog.target))} ${escapeHtml(prog.unit)}</span>
          <span class="value-progress-pct">${prog.pct}%</span>
        </div>
        <div class="value-progress-bar"><div class="value-progress-fill" style="width:${prog.pct}%"></div></div>
        <div class="value-add-row">
          <input type="number" id="valueAddInput" inputmode="decimal" step="any" placeholder="${escapeHtml(t('addProgressPlaceholder'))}">
          <button type="button" class="value-add-btn" id="valueAddBtn">${escapeHtml(t('addProgressBtn'))}</button>
        </div>
      </div>`;
    const input = document.getElementById('valueAddInput');
    const commit = () => {
      const delta = parseFloat(input.value);
      if (!Number.isFinite(delta) || delta === 0) return;
      input.value = '';
      addGoalProgress(goal.id, delta);
    };
    document.getElementById('valueAddBtn').addEventListener('click', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  } else if (prog) {
    progressEl.innerHTML = `
      <div class="progress-ring" style="--pct:${prog.pct}">
        <div class="progress-ring-value">
          <div class="progress-ring-pct">${prog.pct}%</div>
          <div class="progress-ring-frac">${prog.done}/${prog.total}</div>
        </div>
      </div>`;
  } else {
    progressEl.innerHTML = '';
  }

  document.getElementById('detailJourneyBlock').innerHTML = journeyHtml(goal);
  wireJourneyEvents(goal);
  renderActionsBlock(goal.id);

  // Рятунок серії показуємо тільки тоді, коли є що рятувати: вчора
  // пропущено, а до того ланцюг тягнувся. Якщо рятунок на паузі — чесно
  // кажемо, коли він знову буде, а не мовчимо.
  const rescue = Streak.rescueState(goal, todayISO());
  const rescueEl = document.getElementById('detailRescueBlock');
  if (rescue && rescue.available) {
    rescueEl.innerHTML = `
      <div class="rescue-banner">
        <span>${escapeHtml(t('rescueMsg', rescue.lost))}</span>
        <button type="button" id="rescueBtn">${escapeHtml(t('rescueBtn'))}</button>
      </div>`;
    document.getElementById('rescueBtn').addEventListener('click', () => rescueStreak(goal.id));
  } else if (rescue) {
    rescueEl.innerHTML = `<div class="rescue-banner waiting"><span>${escapeHtml(t('rescueWait', rescue.cooldownLeft))}</span></div>`;
  } else {
    rescueEl.innerHTML = '';
  }

  const streak = computeStreak(goal.checkins);
  const checkedToday = (goal.checkins || []).includes(todayISO());
  document.getElementById('detailStreakRow').innerHTML = `
    <button type="button" class="streak-btn${checkedToday ? ' checked-today' : ''}" id="streakToggleBtn">
      <span>${checkedToday ? '✓' : '🔥'}</span>
      <span>${escapeHtml(checkedToday ? t('checkinBtnLabelDone') : t('checkinBtnLabel'))}</span>
      ${streak > 0 ? `<span class="streak-count">${streak}</span>` : ''}
    </button>`;
  document.getElementById('streakToggleBtn').addEventListener('click', () => toggleTodayCheckin(goal.id));

  renderJournalList(goal);
}

// ---- Щоденні дії ----
function subscribeToActions(goalId) {
  if (unsubscribeActions) { unsubscribeActions(); unsubscribeActions = null; }
  goalActions = [];
  if (!auth.currentUser || !goalId) return;
  unsubscribeActions = db.collection('users').doc(auth.currentUser.uid).collection('tasks')
    .where('goalId', '==', goalId)
    .onSnapshot((snap) => {
      goalActions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (currentScreen === 'detail' && activeDetailGoalId === goalId) renderActionsBlock(goalId);
    }, (err) => console.error('actions:', err));
}

function stopActions() {
  if (unsubscribeActions) { unsubscribeActions(); unsubscribeActions = null; }
  goalActions = [];
}

/** Показуємо невиконані й те, що закрито сьогодні. Учорашні галочки тут
 *  тільки заважали б: список щоденних дій має лишатись коротким. */
function visibleActions() {
  const today = todayISO();
  return goalActions
    // Виконане показуємо ще сьогодні — інакше галочка змушувала б рядок
    // зникнути з-під пальця. Дата виконання приходить із сервера з
    // затримкою, тож поки її немає, орієнтуємось на день, на який дія
    // ставилась.
    .filter((a) => !a.done || a.dueDate === today || completedToday(a))
    .sort((a, b) => (a.done === b.done ? String(a.dueDate || '').localeCompare(String(b.dueDate || '')) : (a.done ? 1 : -1)));
}

function completedToday(task) {
  const at = task.completedAt;
  if (!at) return false;
  // Поки запис не долетів до сервера, у знімку лежить не Timestamp, а те,
  // що поклав клієнт, — приймаємо обидва.
  const d = typeof at.toDate === 'function' ? at.toDate() : (at instanceof Date ? at : null);
  if (!d) return false;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayISO();
}

function renderActionsBlock(goalId) {
  const host = document.getElementById('detailActionsBlock');
  if (!host) return;
  const list = visibleActions();
  const today = todayISO();
  host.innerHTML = `
    <div class="actions-block">
      <div class="section-label">${escapeHtml(t('actionsLabel'))}</div>
      ${list.length
        ? list.map((a) => {
            const overdue = !a.done && a.dueDate && a.dueDate < today;
            return `
        <div class="action-row${a.done ? ' done' : ''}">
          <button type="button" class="action-check${a.done ? ' checked' : ''}" data-action-toggle="${a.id}" aria-label="done">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
          <div>
            <div class="action-title">${escapeHtml(a.title || '')}</div>
            ${overdue ? `<div class="action-due overdue">${escapeHtml(t('actionOverdue'))}</div>` : ''}
          </div>
        </div>`;
          }).join('')
        : `<div class="actions-empty">${escapeHtml(t('actionsEmpty'))}</div>`}
      <div class="action-add-row">
        <input type="text" id="actionInput" maxlength="200" placeholder="${escapeHtml(t('actionPlaceholder'))}">
        <button type="button" class="action-add-btn" id="actionAddBtn">+</button>
      </div>
      <div class="field-hint">${escapeHtml(t('actionsHint'))}</div>
    </div>`;

  host.querySelectorAll('[data-action-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => toggleAction(btn.dataset.actionToggle, goalId));
  });
  const input = document.getElementById('actionInput');
  const commit = () => {
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    addAction(goalId, title);
  };
  document.getElementById('actionAddBtn').addEventListener('click', commit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
}

// Дія — звичайне завдання, тому поля тут ті самі, що й у формі завдання:
// інакше правила Firestore відкинули б документ, а сторінка «Завдання»
// не знала б, що з ним робити.
async function addAction(goalId, title) {
  if (!auth.currentUser) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('tasks').add({
    title: title.slice(0, 200),
    notes: '', done: false, completedAt: null,
    priority: null, tags: [],
    dueDate: todayISO(), dueTime: null,
    estimateMin: null, recurrence: null,
    reminderAt: null, notifiedAt: null,
    subtasks: [],
    goalId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('addAction:', err));
}

async function toggleAction(taskId, goalId) {
  const task = goalActions.find((a) => a.id === taskId);
  if (!task || !auth.currentUser) return;
  const done = !task.done;
  await db.collection('users').doc(auth.currentUser.uid).collection('tasks').doc(taskId).update({
    done,
    completedAt: done ? firebase.firestore.FieldValue.serverTimestamp() : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('toggleAction:', err));
  if (done) markGoalCheckin(goalId);
}

// Знята галочка чекін НЕ прибирає: до одного дня могли вести кілька дій,
// та й мовчки скасовувати вже відзначений день було б несподівано.
async function markGoalCheckin(goalId) {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !auth.currentUser) return;
  const result = Streak.applyCheckin(goal, todayISO());
  if (!result) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    checkins: result.checkins, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('markGoalCheckin:', err));
}

function journeyHtml(goal) {
  const milestones = goal.milestones || [];
  if (!milestones.length) {
    // У числової цілі прогрес уже показує смужка, тож віхи там —
    // необовʼязковий додаток. Нагадувати про порожній список нема сенсу:
    // це не прогалина, а свідомий вибір іншого способу міряти шлях.
    const prog = progressOf(goal);
    if (prog && prog.kind === 'value') return '';
    return `<div class="empty-state" style="padding:24px 10px;"><div>${escapeHtml(t('noMilestonesYet'))}</div></div>`;
  }
  const nextIdx = milestones.findIndex((m) => !m.done);
  const allDone = nextIdx === -1;
  let html = '';
  if (allDone && goal.status === 'active') {
    html += `<div class="all-done-banner"><span>${escapeHtml(t('allMilestonesDoneMsg'))}</span><button type="button" id="markDoneBtn">${escapeHtml(t('markGoalDoneBtn'))}</button></div>`;
  }
  html += '<div class="journey" role="list">' + milestones.map((m, i) => {
    const isNext = i === nextIdx;
    const cls = ['journey-stop'];
    if (m.done) cls.push('done');
    if (isNext) cls.push('next');
    return `
      <div class="${cls.join(' ')}" role="listitem">
        <button type="button" class="journey-node" data-toggle-milestone="${m.id}" aria-label="toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
        <div class="journey-label">${escapeHtml(m.title)}${isNext ? `<span class="journey-next-badge">${escapeHtml(t('nextStopBadge'))}</span>` : ''}</div>
      </div>`;
  }).join('') + '</div>';
  return html;
}
function wireJourneyEvents(goal) {
  const block = document.getElementById('detailJourneyBlock');
  block.querySelectorAll('[data-toggle-milestone]').forEach((btn) => {
    btn.addEventListener('click', () => toggleMilestone(goal.id, btn.dataset.toggleMilestone));
  });
  const markDoneBtn = document.getElementById('markDoneBtn');
  if (markDoneBtn) markDoneBtn.addEventListener('click', () => setGoalStatus(goal.id, 'done'));
}

function renderJournalList(goal) {
  const entries = [...(goal.journal || [])].sort((a, b) => b.createdAt - a.createdAt);
  const el = document.getElementById('journalList');
  if (!entries.length) {
    el.innerHTML = `<div class="empty-state" style="padding:20px 10px;"><div>${escapeHtml(t('journalEmpty'))}</div></div>`;
    return;
  }
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  el.innerHTML = entries.map((entry) => {
    const dateLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.createdAt));
    return `<div class="journal-entry"><div class="journal-entry-text">${escapeHtml(entry.text)}</div><div class="journal-entry-date">${escapeHtml(dateLabel)}</div></div>`;
  }).join('');
}
document.getElementById('journalAddBtn').addEventListener('click', () => {
  if (!activeDetailGoalId) return;
  const input = document.getElementById('journalInput');
  const text = input.value.trim();
  if (!text) return;
  addJournalEntry(activeDetailGoalId, text);
  input.value = '';
});

// ---- Дії над ціллю: усі — повний read-modify-write масиву з живого
// стану `goals` (Firestore SDK не вміє точково оновити елемент масиву
// об'єктів), і серверний updatedAt при кожному записі. ----
// Додаємо, а не задаємо: людина думає «пробіг ще 2 км», а не «тепер у мене
// 6.4». Нижче нуля не опускаємось — відʼємний пробіг ні про що не каже.
// Рятунок дописує вчорашній день у чекіни й лишає слід у rescues — інакше
// рятувати можна було б щодня, і серія перестала б щось означати.
async function rescueStreak(goalId) {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !auth.currentUser) return;
  const result = Streak.applyRescue(goal, todayISO());
  if (!result) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    checkins: result.checkins, rescues: result.rescues,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('rescueStreak:', err));
}

// «Не вийшло» — теж відповідь. Записуємо причину, щоб через місяць було
// видно, що саме заважає найчастіше, а не самий лише факт пропуску.
async function logBlocker(goalId, reason) {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !auth.currentUser) return;
  const result = Streak.applyBlocker(goal, reason, todayISO());
  if (!result) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    blockers: result.blockers, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('logBlocker:', err));
}

async function addGoalProgress(goalId, delta) {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !auth.currentUser) return;
  const next = Math.max(0, Math.round(((Number(goal.currentValue) || 0) + delta) * 100) / 100);
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    currentValue: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('addGoalProgress:', err));
}

async function toggleMilestone(goalId, milestoneId) {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !auth.currentUser) return;
  const next = (goal.milestones || []).map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m));
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    milestones: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('toggleMilestone:', err));
}

async function toggleTodayCheckin(goalId) {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !auth.currentUser) return;
  const today = todayISO();
  const has = (goal.checkins || []).includes(today);
  let next = has
    ? (goal.checkins || []).filter((d) => d !== today)
    : [...new Set([...(goal.checkins || []), today])].sort();
  if (next.length > 400) next = next.slice(next.length - 400); // ISO-рядки сортуються хронологічно — обрізаємо найстаріші
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    checkins: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('toggleTodayCheckin:', err));
}

async function addJournalEntry(goalId, text) {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !auth.currentUser) return;
  // createdAt — саме клієнтський Date.now(), а не serverTimestamp(): останній
  // заборонений усередині елемента масиву в Firestore.
  let next = [...(goal.journal || []), { id: uid4(), text: text.slice(0, 2000), createdAt: Date.now() }];
  if (next.length > 200) next = next.slice(next.length - 200);
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    journal: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('addJournalEntry:', err));
}

async function setGoalStatus(goalId, status) {
  if (!auth.currentUser) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    status, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('setGoalStatus:', err));
}

// ---- Форма цілі (створення / редагування) ----
function renderCategoryPicker() {
  const picker = document.getElementById('categoryPicker');
  picker.innerHTML = CATEGORIES.map((cat) =>
    `<button type="button" class="category-choice ${cat}${formCategory === cat ? ' selected' : ''}" data-cat="${cat}">${escapeHtml(categoryLabel(cat))}</button>`
  ).join('');
  picker.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => { formCategory = btn.dataset.cat; renderCategoryPicker(); });
  });
}

function renderMilestonesEditor() {
  const el = document.getElementById('milestonesEditor');
  el.innerHTML = formMilestones.map((m, i) => `
    <div class="milestone-editor-row" data-idx="${i}">
      <input type="text" data-milestone-title="${i}" value="${escapeHtml(m.title)}" placeholder="${escapeHtml(t('milestonePlaceholder'))}" maxlength="200">
      <button type="button" class="milestone-remove-btn" data-remove-milestone="${i}" aria-label="remove">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
  el.querySelectorAll('[data-milestone-title]').forEach((input) => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.milestoneTitle);
      if (formMilestones[idx]) formMilestones[idx].title = input.value;
    });
  });
  el.querySelectorAll('[data-remove-milestone]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeMilestone);
      formMilestones.splice(idx, 1);
      renderMilestonesEditor();
    });
  });
}
// ---- Розбиття цілі на віхи ----
// Віхи ДОДАЮТЬСЯ до вже написаних, а не замінюють їх: людина могла почати
// сама, і стерти її текст підказкою було б грубо. Дублі відсіюємо за назвою.
document.getElementById('breakdownBtn').addEventListener('click', async () => {
  const btn = document.getElementById('breakdownBtn');
  const label = document.getElementById('breakdownBtnLabel');
  const errorEl = document.getElementById('goalFormError');
  const noteEl = document.getElementById('breakdownNote');
  const title = document.getElementById('goalTitleInput').value.trim();
  if (!title) { errorEl.textContent = t('breakdownNoTitle'); return; }

  const targetRaw = parseFloat(document.getElementById('goalTargetValue').value);
  btn.disabled = true;
  label.textContent = t('breakdownWorking');
  errorEl.textContent = '';
  noteEl.textContent = '';
  try {
    const res = await firebase.functions().httpsCallable('goalBreakdown')({
      title,
      category: formCategory,
      why: document.getElementById('goalWhyInput').value.trim(),
      targetDate: document.getElementById('goalTargetDate').value || '',
      targetValue: Number.isFinite(targetRaw) && targetRaw > 0 ? targetRaw : null,
      unit: document.getElementById('goalUnitInput').value.trim(),
    });
    const have = new Set(formMilestones.map((m) => (m.title || '').trim().toLowerCase()));
    (res.data.milestones || []).forEach((mTitle) => {
      const clean = (mTitle || '').trim();
      if (!clean || have.has(clean.toLowerCase())) return;
      have.add(clean.toLowerCase());
      formMilestones.push({ id: uid4(), title: clean, done: false });
    });
    formMilestones = formMilestones.slice(0, 50);
    renderMilestonesEditor();
    noteEl.textContent = res.data.note || '';
  } catch (err) {
    console.error('goalBreakdown:', err);
    // Показуємо текст із сервера лише там, де він написаний для людини.
    // На мережевій помилці прилетіло б технічне «internal» — краще своє.
    const spoken = ['invalid-argument', 'resource-exhausted', 'unavailable'];
    errorEl.textContent = err && spoken.includes(err.code) && err.message ? err.message : t('breakdownError');
  } finally {
    btn.disabled = false;
    label.textContent = t('breakdownBtn');
  }
});

document.getElementById('addMilestoneBtn').addEventListener('click', () => {
  formMilestones.push({ id: uid4(), title: '', done: false });
  renderMilestonesEditor();
  const inputs = document.querySelectorAll('[data-milestone-title]');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

function openGoalForm(existingGoal) {
  editingGoalId = existingGoal ? existingGoal.id : null;
  document.getElementById('goalModalTitle').textContent = existingGoal ? t('editGoalTitle') : t('newGoalTitle');
  document.getElementById('deleteGoalBtn').style.display = existingGoal ? 'block' : 'none';
  document.getElementById('goalFormError').textContent = '';
  document.getElementById('goalTitleInput').value = existingGoal ? existingGoal.title : '';
  document.getElementById('goalWhyInput').value = existingGoal ? existingGoal.why || '' : '';
  document.getElementById('goalTargetDate').value = existingGoal ? existingGoal.targetDate || '' : '';
  document.getElementById('goalTargetValue').value =
    existingGoal && existingGoal.targetValue != null ? existingGoal.targetValue : '';
  document.getElementById('goalUnitInput').value = existingGoal ? existingGoal.unit || '' : '';
  formCategory = existingGoal ? existingGoal.category || 'other' : 'other';
  formMilestones = existingGoal ? (existingGoal.milestones || []).map((m) => ({ ...m })) : [];
  renderCategoryPicker();
  renderMilestonesEditor();
  document.getElementById('breakdownNote').textContent = '';
  goalGuard.arm();
  document.getElementById('goalFormOverlay').classList.add('show');
  setTimeout(() => document.getElementById('goalTitleInput').focus(), 50);
}

// ---- Незбережені зміни ----
// Ціль описують довго: навіщо вона, дедлайн, числова мета, віхи (а їх ще й
// AI підказує). Спільна логіка — в ../unsaved-guard.js.
const goalGuard = UnsavedGuard.create({
  overlay: 'goalFormOverlay',
  snapshot: () => JSON.stringify({
    title: document.getElementById('goalTitleInput').value.trim(),
    why: document.getElementById('goalWhyInput').value.trim(),
    targetDate: document.getElementById('goalTargetDate').value,
    targetValue: document.getElementById('goalTargetValue').value,
    unit: document.getElementById('goalUnitInput').value.trim(),
    category: formCategory,
    milestones: formMilestones.map((m) => [(m.title || '').trim(), !!m.done]),
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

// Винесено з обробника події, бо збереження запускає ще й діалог
// «зберегти зміни перед виходом».
async function saveGoalForm() {
  const title = document.getElementById('goalTitleInput').value.trim();
  const errorEl = document.getElementById('goalFormError');
  if (!title) {
    errorEl.textContent = t('titleRequiredError');
    return;
  }
  errorEl.textContent = '';
  const uidCur = auth.currentUser && auth.currentUser.uid;
  if (!uidCur) return;

  const cleanMilestones = formMilestones
    .map((m) => ({ id: m.id, title: (m.title || '').trim(), done: !!m.done }))
    .filter((m) => m.title)
    .slice(0, 50);

  const targetRaw = parseFloat(document.getElementById('goalTargetValue').value);
  const targetValue = Number.isFinite(targetRaw) && targetRaw > 0 ? targetRaw : null;

  const payload = {
    title,
    category: CATEGORIES.includes(formCategory) ? formCategory : 'other',
    why: document.getElementById('goalWhyInput').value.trim(),
    targetDate: document.getElementById('goalTargetDate').value || null,
    targetValue,
    // Одиниця без мети ні про що не каже, тож тримаються разом.
    unit: targetValue ? document.getElementById('goalUnitInput').value.trim().slice(0, 20) : '',
    milestones: cleanMilestones,
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
        currentValue: 0,
        checkins: [],
        journal: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    goalGuard.close();
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

// ---- Кастомний datepicker (той самий компонент, що й у tasks/app.js) ----
// Замінює нативний календар браузера (input type=date) на панель у стилі
// застосунку. Нативний <input> лишається в DOM (прихований, але функціональний)
// — перехоплено сеттер `.value`, щоб кастомний UI оновлювався синхронно.
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

  // Перехоплюємо .value, щоб `nativeInput.value = '...'` синхронно оновлювало кастомний UI.
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
      }
    }).catch(() => {});
    subscribeToGoals(user.uid);
  } else {
    if (unsubscribeGoals) { unsubscribeGoals(); unsubscribeGoals = null; }
    goals = [];
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
  if (!document.hidden && currentScreen === 'dashboard') renderEveningCard();
});

// ---- Ініціалізація ----
initDatePicker('goalTargetDate');
applyTheme();
applyTranslations();
renderAuthLangRow();
setAuthMode('login');
