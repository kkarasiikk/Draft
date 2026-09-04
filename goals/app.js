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
    catManageTitle: 'Категорії цілей', newCatPlaceholder: 'Нова категорія',
    addCatAria: 'Додати категорію', deleteCatAria: 'Видалити категорію',
    catManageHint: 'Список спільний для всіх цілей. Видалена категорія віддає свої цілі першій зі списку.',
    catDuplicateError: 'Така категорія вже є.',
    catLastError: 'Має лишитись хоча б одна категорія.',
    catSaveError: 'Не вдалося зберегти. Спробуй ще раз.',
    catInUseConfirm: (n, target) => `${n} ${n === 1 ? 'ціль перейде' : 'цілей перейде'} в «${target}». Видалити категорію?`,
    whyLabel: 'Навіщо тобі це?', whyPlaceholder: 'Чому ця ціль важлива саме для тебе (необов’язково)',
    titleRequiredError: 'Введи назву цілі',
    saveBtn: 'Зберегти', deleteBtn: 'Видалити', cancelBtn: 'Скасувати', deleteConfirmBtn: 'Видалити',
    unsavedTitle: 'Зберегти зміни?',
    unsavedSub: 'Є незбережені зміни. Якщо вийти зараз, вони пропадуть.',
    unsavedSave: 'Зберегти', unsavedDiscard: 'Не зберігати', unsavedKeep: 'Продовжити редагування',
    confirmDeleteTitle: 'Видалити ціль?',
    confirmDeleteSub: 'Цю дію не можна скасувати. Нотатки й серія теж зникнуть.',
    fabNewGoalLabel: 'Нова ціль', bnMonth: 'Місяць', bnYear: 'Рік',
    horizonLabel: 'Горизонт', horizonMonth: 'Місячна', horizonYear: 'Річна',
    horizonHint: 'Місячна — що робиш цього місяця. Річна — куди йдеш загалом.',
    emptyMonthTitle: 'Немає цілей на місяць', emptyMonthSub: 'Що хочеш зрушити саме цього місяця?',
    emptyYearTitle: 'Немає річних цілей', emptyYearSub: 'Куди ти йдеш цього року?',
    statusAll: 'Усі', statusActive: 'Активні', statusDone: 'Завершені', statusArchived: 'Архів',
    statusPaused: 'На паузі', pauseBtn: 'Поставити на паузу', resumeBtn: 'Повернути в роботу',
    archiveBtn: 'Перенести в архів', markGoalDoneBtn: 'Виконано',
    checkinBtnLabel: 'Зробив крок сьогодні', checkinBtnLabelDone: 'Зроблено сьогодні',
    rescueMsg: (n) => `Вчора пропущено. Серія на ${n} дн. ще ціла — врятувати?`,
    rescueBtn: 'Врятувати серію',
    actionsLabel: 'Щоденні дії',
    actionsHint: 'Дрібні кроки, які ведуть до цілі. Виконав — день у серії відмічається сам.',
    actionPlaceholder: 'Що зробити для цієї цілі?',
    actionsEmpty: 'Ще немає щоденних дій — додай перший крок нижче.',
    actionOverdue: 'прострочено',
    rescueWait: (n) => `Серія обірвалась. Наступний рятунок буде доступний через ${n} дн.`,
    blockersTitle: 'Що заважає найчастіше',
    reason_noTime: 'Не було часу', reason_forgot: 'Забув(ла)', reason_tired: 'Втома',
    reason_mood: 'Не було настрою', reason_other: 'Інше',
    journalPlaceholder: 'Що сьогодні зробив(ла) для цієї цілі?',
    journalEmpty: 'Ще нема нотаток', journalSectionLabel: 'Щоденник',
    badge_streak7: '🔥 Серія 7 днів', badge_firstDone: '🏆 Перша ціль завершена',
    badge_firstStep: '🌱 Перший крок',
    dashboardEmptyTitle: 'Ще немає цілей', dashboardEmptySub: 'Додай першу ціль кнопкою внизу.',
    daysLeftLabel: (n) => `${n} дн. до дедлайну`, overdueLabel: 'Прострочено',
    lapseTitle: (n) => `Тебе не було ${n} дн.`,
    lapseNeverTitle: (n) => `Ціль стоїть ${n} дн. без жодного кроку`,
    lapseSub: 'Це буває. Питання не в тому, чому так вийшло, а в тому, куди повертатись.',
    lapseRestart: 'Почати відлік заново', lapseEdit: 'Змінити ціль', lapsePause: 'На паузу',
    gridLabel: 'Останні вісім тижнів', gridDone: 'був крок', gridBlocked: 'сказав, що завадило',
    monthPrev: 'Попередній місяць', monthNext: 'Наступний місяць',
    pickGoalTitle: 'Обери ціль зліва',
    pickGoalSub: 'Тут буде все про неї: навіщо, темп, серія і щоденник.',
    emptyMonthNamed: (m) => `Немає цілей на ${m}`,
    carriedFrom: (m) => `з ${m}`,
    horizonHintMonth: (m) => `Ціль піде в ${m}.`,
    retroYear: 'За рік', retroAll: 'За весь час',
    retroClosed: (n) => `Закрито цілей: ${n}`,
    retroEmptyPeriod: 'За цей період нічого не закрито',
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
    catManageTitle: 'Категории целей', newCatPlaceholder: 'Новая категория',
    addCatAria: 'Добавить категорию', deleteCatAria: 'Удалить категорию',
    catManageHint: 'Список общий для всех целей. Удалённая категория отдаёт свои цели первой в списке.',
    catDuplicateError: 'Такая категория уже есть.',
    catLastError: 'Должна остаться хотя бы одна категория.',
    catSaveError: 'Не удалось сохранить. Попробуй ещё раз.',
    catInUseConfirm: (n, target) => `${n} ${n === 1 ? 'цель перейдёт' : 'целей перейдёт'} в «${target}». Удалить категорию?`,
    whyLabel: 'Зачем тебе это?', whyPlaceholder: 'Почему эта цель важна именно для тебя (необязательно)',
    titleRequiredError: 'Введи название цели',
    saveBtn: 'Сохранить', deleteBtn: 'Удалить', cancelBtn: 'Отмена', deleteConfirmBtn: 'Удалить',
    unsavedTitle: 'Сохранить изменения?',
    unsavedSub: 'Есть несохранённые изменения. Если выйти сейчас, они пропадут.',
    unsavedSave: 'Сохранить', unsavedDiscard: 'Не сохранять', unsavedKeep: 'Продолжить редактирование',
    confirmDeleteTitle: 'Удалить цель?',
    confirmDeleteSub: 'Это действие нельзя отменить. Заметки и серия тоже исчезнут.',
    fabNewGoalLabel: 'Новая цель', bnMonth: 'Месяц', bnYear: 'Год',
    horizonLabel: 'Горизонт', horizonMonth: 'Месячная', horizonYear: 'Годовая',
    horizonHint: 'Месячная — что делаешь в этом месяце. Годовая — куда идёшь в целом.',
    emptyMonthTitle: 'Нет целей на месяц', emptyMonthSub: 'Что хочешь сдвинуть именно в этом месяце?',
    emptyYearTitle: 'Нет годовых целей', emptyYearSub: 'Куда ты идёшь в этом году?',
    statusAll: 'Все', statusActive: 'Активные', statusDone: 'Завершённые', statusArchived: 'Архив',
    statusPaused: 'На паузе', pauseBtn: 'Поставить на паузу', resumeBtn: 'Вернуть в работу',
    archiveBtn: 'Перенести в архив', markGoalDoneBtn: 'Выполнено',
    checkinBtnLabel: 'Сделал шаг сегодня', checkinBtnLabelDone: 'Сделано сегодня',
    rescueMsg: (n) => `Вчера пропущено. Серия на ${n} дн. ещё цела — спасти?`,
    rescueBtn: 'Спасти серию',
    actionsLabel: 'Ежедневные действия',
    actionsHint: 'Мелкие шаги к цели. Выполнил — день в серии отмечается сам.',
    actionPlaceholder: 'Что сделать для этой цели?',
    actionsEmpty: 'Ещё нет ежедневных действий — добавь первый шаг ниже.',
    actionOverdue: 'просрочено',
    rescueWait: (n) => `Серия оборвалась. Следующее спасение будет доступно через ${n} дн.`,
    blockersTitle: 'Что мешает чаще всего',
    reason_noTime: 'Не было времени', reason_forgot: 'Забыл(а)', reason_tired: 'Усталость',
    reason_mood: 'Не было настроения', reason_other: 'Другое',
    journalPlaceholder: 'Что сегодня сделал(а) для этой цели?',
    journalEmpty: 'Ещё нет заметок', journalSectionLabel: 'Дневник',
    badge_streak7: '🔥 Серия 7 дней', badge_firstDone: '🏆 Первая цель завершена',
    badge_firstStep: '🌱 Первый шаг',
    dashboardEmptyTitle: 'Пока нет целей', dashboardEmptySub: 'Добавь первую цель кнопкой внизу.',
    daysLeftLabel: (n) => `${n} дн. до дедлайна`, overdueLabel: 'Просрочено',
    lapseTitle: (n) => `Тебя не было ${n} дн.`,
    lapseNeverTitle: (n) => `Цель стоит ${n} дн. без единого шага`,
    lapseSub: 'Так бывает. Вопрос не в том, почему так вышло, а в том, куда возвращаться.',
    lapseRestart: 'Начать отсчёт заново', lapseEdit: 'Изменить цель', lapsePause: 'На паузу',
    gridLabel: 'Последние восемь недель', gridDone: 'был шаг', gridBlocked: 'сказал, что помешало',
    monthPrev: 'Предыдущий месяц', monthNext: 'Следующий месяц',
    pickGoalTitle: 'Выбери цель слева',
    pickGoalSub: 'Здесь будет всё о ней: зачем, темп, серия и дневник.',
    emptyMonthNamed: (m) => `Нет целей на ${m}`,
    carriedFrom: (m) => `с ${m}`,
    horizonHintMonth: (m) => `Цель пойдёт в ${m}.`,
    retroYear: 'За год', retroAll: 'За всё время',
    retroClosed: (n) => `Закрыто целей: ${n}`,
    retroEmptyPeriod: 'За этот период ничего не закрыто',
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
    catManageTitle: 'Kategorie celów', newCatPlaceholder: 'Nowa kategoria',
    addCatAria: 'Dodaj kategorię', deleteCatAria: 'Usuń kategorię',
    catManageHint: 'Lista jest wspólna dla wszystkich celów. Usunięta kategoria oddaje swoje cele pierwszej z listy.',
    catDuplicateError: 'Taka kategoria już istnieje.',
    catLastError: 'Musi zostać co najmniej jedna kategoria.',
    catSaveError: 'Nie udało się zapisać. Spróbuj ponownie.',
    catInUseConfirm: (n, target) => `${n} ${n === 1 ? 'cel przejdzie' : 'celów przejdzie'} do «${target}». Usunąć kategorię?`,
    whyLabel: 'Po co ci to?', whyPlaceholder: 'Dlaczego ten cel jest dla ciebie ważny (opcjonalnie)',
    titleRequiredError: 'Wpisz nazwę celu',
    saveBtn: 'Zapisz', deleteBtn: 'Usuń', cancelBtn: 'Anuluj', deleteConfirmBtn: 'Usuń',
    unsavedTitle: 'Zapisać zmiany?',
    unsavedSub: 'Są niezapisane zmiany. Jeśli teraz wyjdziesz, przepadną.',
    unsavedSave: 'Zapisz', unsavedDiscard: 'Nie zapisuj', unsavedKeep: 'Wróć do edycji',
    confirmDeleteTitle: 'Usunąć cel?',
    confirmDeleteSub: 'Tej czynności nie można cofnąć. Notatki i seria też znikną.',
    fabNewGoalLabel: 'Nowy cel', bnMonth: 'Miesiąc', bnYear: 'Rok',
    horizonLabel: 'Horyzont', horizonMonth: 'Miesięczny', horizonYear: 'Roczny',
    horizonHint: 'Miesięczny — co robisz w tym miesiącu. Roczny — dokąd zmierzasz ogólnie.',
    emptyMonthTitle: 'Brak celów na miesiąc', emptyMonthSub: 'Co chcesz ruszyć właśnie w tym miesiącu?',
    emptyYearTitle: 'Brak celów rocznych', emptyYearSub: 'Dokąd zmierzasz w tym roku?',
    statusAll: 'Wszystkie', statusActive: 'Aktywne', statusDone: 'Ukończone', statusArchived: 'Archiwum',
    statusPaused: 'Wstrzymane', pauseBtn: 'Wstrzymaj', resumeBtn: 'Wznów',
    archiveBtn: 'Przenieś do archiwum', markGoalDoneBtn: 'Ukończony',
    checkinBtnLabel: 'Zrobiłem krok dzisiaj', checkinBtnLabelDone: 'Zrobione dzisiaj',
    rescueMsg: (n) => `Wczoraj wypadło. Seria ${n} dni jest jeszcze cała — uratować?`,
    rescueBtn: 'Uratuj serię',
    actionsLabel: 'Codzienne działania',
    actionsHint: 'Drobne kroki do celu. Zrobione — dzień w serii zaznacza się sam.',
    actionPlaceholder: 'Co zrobić dla tego celu?',
    actionsEmpty: 'Brak codziennych działań — dodaj pierwszy krok poniżej.',
    actionOverdue: 'po terminie',
    rescueWait: (n) => `Seria się urwała. Kolejny ratunek będzie dostępny za ${n} dni.`,
    blockersTitle: 'Co przeszkadza najczęściej',
    reason_noTime: 'Brak czasu', reason_forgot: 'Zapomniałem', reason_tired: 'Zmęczenie',
    reason_mood: 'Brak nastroju', reason_other: 'Inne',
    journalPlaceholder: 'Co dziś zrobiłeś(aś) dla tego celu?',
    journalEmpty: 'Jeszcze brak notatek', journalSectionLabel: 'Dziennik',
    badge_streak7: '🔥 Seria 7 dni', badge_firstDone: '🏆 Pierwszy ukończony cel',
    badge_firstStep: '🌱 Pierwszy krok',
    dashboardEmptyTitle: 'Jeszcze brak celów', dashboardEmptySub: 'Dodaj pierwszy cel przyciskiem poniżej.',
    daysLeftLabel: (n) => `${n} dni do terminu`, overdueLabel: 'Po terminie',
    lapseTitle: (n) => `Nie było cię ${n} dni`,
    lapseNeverTitle: (n) => `Cel stoi ${n} dni bez żadnego kroku`,
    lapseSub: 'Tak bywa. Pytanie nie brzmi dlaczego, tylko dokąd wracasz.',
    lapseRestart: 'Zacznij liczyć od nowa', lapseEdit: 'Zmień cel', lapsePause: 'Wstrzymaj',
    gridLabel: 'Ostatnie osiem tygodni', gridDone: 'był krok', gridBlocked: 'powiedziałeś, co przeszkodziło',
    monthPrev: 'Poprzedni miesiąc', monthNext: 'Następny miesiąc',
    pickGoalTitle: 'Wybierz cel po lewej',
    pickGoalSub: 'Tu będzie wszystko o nim: po co, tempo, seria i dziennik.',
    emptyMonthNamed: (m) => `Brak celów na ${m}`,
    carriedFrom: (m) => `z ${m}`,
    horizonHintMonth: (m) => `Cel trafi do ${m}.`,
    retroYear: 'Za rok', retroAll: 'Cały czas',
    retroClosed: (n) => `Ukończonych celów: ${n}`,
    retroEmptyPeriod: 'W tym okresie nic nie ukończono',
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
    catManageTitle: 'Goal categories', newCatPlaceholder: 'New category',
    addCatAria: 'Add category', deleteCatAria: 'Delete category',
    catManageHint: 'The list is shared by every goal. A deleted category hands its goals to the first one on the list.',
    catDuplicateError: 'That category already exists.',
    catLastError: 'At least one category must remain.',
    catSaveError: 'Could not save. Try again.',
    catInUseConfirm: (n, target) => `${n} ${n === 1 ? 'goal moves' : 'goals move'} to “${target}”. Delete the category?`,
    whyLabel: 'Why do you want this?', whyPlaceholder: 'Why this goal matters to you (optional)',
    titleRequiredError: 'Enter a goal title',
    saveBtn: 'Save', deleteBtn: 'Delete', cancelBtn: 'Cancel', deleteConfirmBtn: 'Delete',
    unsavedTitle: 'Save changes?',
    unsavedSub: 'There are unsaved changes. Leaving now discards them.',
    unsavedSave: 'Save', unsavedDiscard: "Don't save", unsavedKeep: 'Keep editing',
    confirmDeleteTitle: 'Delete goal?',
    confirmDeleteSub: 'This action cannot be undone. Notes and streak will be lost too.',
    fabNewGoalLabel: 'New goal', bnMonth: 'Month', bnYear: 'Year',
    horizonLabel: 'Horizon', horizonMonth: 'Monthly', horizonYear: 'Yearly',
    horizonHint: 'Monthly — what you are moving this month. Yearly — where you are heading overall.',
    emptyMonthTitle: 'No goals for this month', emptyMonthSub: 'What do you want to move this month?',
    emptyYearTitle: 'No yearly goals', emptyYearSub: 'Where are you heading this year?',
    statusAll: 'All', statusActive: 'Active', statusDone: 'Done', statusArchived: 'Archived',
    statusPaused: 'Paused', pauseBtn: 'Pause this goal', resumeBtn: 'Resume',
    archiveBtn: 'Move to archive', markGoalDoneBtn: 'Done',
    checkinBtnLabel: 'I took a step today', checkinBtnLabelDone: 'Done for today',
    rescueMsg: (n) => `You missed yesterday. A ${n}-day streak is still savable — rescue it?`,
    rescueBtn: 'Rescue the streak',
    actionsLabel: 'Daily actions',
    actionsHint: 'Small steps toward the goal. Tick one off and the day is checked in for you.',
    actionPlaceholder: 'What should you do for this goal?',
    actionsEmpty: 'No daily actions yet — add the first step below.',
    actionOverdue: 'overdue',
    rescueWait: (n) => `The streak broke. The next rescue unlocks in ${n} days.`,
    blockersTitle: 'What gets in the way most',
    reason_noTime: 'No time', reason_forgot: 'Forgot', reason_tired: 'Too tired',
    reason_mood: 'Not in the mood', reason_other: 'Other',
    journalPlaceholder: 'What did you do for this goal today?',
    journalEmpty: 'No notes yet', journalSectionLabel: 'Journal',
    badge_streak7: '🔥 7-day streak', badge_firstDone: '🏆 First goal completed',
    badge_firstStep: '🌱 First step',
    dashboardEmptyTitle: 'No goals yet', dashboardEmptySub: 'Add your first goal with the button below.',
    daysLeftLabel: (n) => `${n}d left`, overdueLabel: 'Overdue',
    lapseTitle: (n) => `You were away ${n} days`,
    lapseNeverTitle: (n) => `This goal has stood ${n} days without a single step`,
    lapseSub: 'It happens. The question is not why, but where you come back to.',
    lapseRestart: 'Start the count over', lapseEdit: 'Change the goal', lapsePause: 'Pause',
    gridLabel: 'Last eight weeks', gridDone: 'a step happened', gridBlocked: 'said what got in the way',
    monthPrev: 'Previous month', monthNext: 'Next month',
    pickGoalTitle: 'Pick a goal on the left',
    pickGoalSub: 'Everything about it lands here: why, pace, streak and journal.',
    emptyMonthNamed: (m) => `No goals for ${m}`,
    carriedFrom: (m) => `from ${m}`,
    horizonHintMonth: (m) => `This goal goes to ${m}.`,
    retroYear: 'Past year', retroAll: 'All time',
    retroClosed: (n) => `Goals closed: ${n}`,
    retroEmptyPeriod: 'Nothing closed in this period',
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
const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
function resolveTheme() {
  const choice = localStorage.getItem('financeAppTheme') || 'system';
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
  // Свої назви не перекладаємо: після першої правки список належить людині.
  if (usingDefaultCategories) goalCategories = defaultGoalCategoryList(currentLang, CATEGORY_SLOTS);
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).set({ lang }, { merge: true }).catch(() => {});
  }
  applyTranslations();
  renderAuthLangRow();
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

function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  window.SideNav.setLang(currentLang);
  document.title = `${t('pageTitle')} · Life`;
  document.getElementById('openNewGoalBtn').setAttribute('aria-label', t('fabNewGoalLabel'));
  renderDetailPlaceholder();
  document.getElementById('bnMonthLabel').textContent = t('bnMonth');
  document.getElementById('bnYearLabel').textContent = t('bnYear');
  document.getElementById('goalModalTitle').textContent = editingGoalId ? t('editGoalTitle') : t('newGoalTitle');
  document.getElementById('categoryLabel').textContent = t('categoryLabel');
  document.getElementById('catManageTitle').textContent = t('catManageTitle');
  document.getElementById('catManageHint').textContent = t('catManageHint');
  document.getElementById('newGoalCatInput').placeholder = t('newCatPlaceholder');
  document.getElementById('addGoalCatBtn').setAttribute('aria-label', t('addCatAria'));
  document.getElementById('whyLabel').textContent = t('whyLabel');
  document.getElementById('goalWhyInput').placeholder = t('whyPlaceholder');
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
// Дата прогнозу словами: «12 березня». Рік не пишемо, поки він поточний —
// у прогнозі на пів року вперед він тільки заважає читати.
function formatDateShort(iso) {
  const d = Streak.parseISO(iso);
  if (isNaN(d)) return iso;
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const opts = sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat(locale, opts).format(d);
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
let statusFilter = 'active'; // null(all) | 'active' | 'paused' | 'done' | 'archived'
// Вікно ретроспективи: 365 днів або null — за весь час.
let retroWindowDays = 365;
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
// Яка ціль у вечірньому підсумку зараз питає «що завадило».
// Щоденні дії відкритої цілі — це звичайні завдання з розділу «Завдання»,
// просто відфільтровані за goalId. Слухаємо їх лише поки ціль відкрита:
// тримати підписку на весь список заради екрана, якого не видно, ні до чого.
let goalActions = [];
let unsubscribeActions = null;

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
    // Вікно керування може бути відкрите просто зараз — на другому пристрої
    // чи в сусідній вкладці.
    if (document.getElementById('catManageOverlay').classList.contains('show')) renderGoalCatManager();
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
// Серія, рятунок і вечірня черга живуть у goals/streak.js — тим самим
// модулем користується AI-помічник на сервері. Правило «коли рятунок
// доступний» мусить бути одне: інакше в чаті пишеться одне, а на сторінці
// показується інше.
const Streak = window.GoalStreak;
// Темп цілі — goals/review.js. Той самий модуль читає помічник на сервері:
// інакше в чаті звучала б одна оцінка, а на екрані стояла інша.
const Review = window.GoalReview;
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
function computeBadges(list) {
  const badges = [];
  if (list.some((g) => computeStreak(g.checkins) >= 7)) badges.push('badge_streak7');
  if (list.filter((g) => g.status === 'done').length >= 1) badges.push('badge_firstDone');
  if (list.some((g) => (g.checkins || []).length >= 1)) badges.push('badge_firstStep');
  return badges;
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
  subscribeToActions(first.id);
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
    stopActions();
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
  renderBadgesRow();
  renderMonthHeader();
  renderStatusFilterRow();
  renderRetro();
  renderGoalsList();
}

function renderBadgesRow() {
  const badges = computeBadges(goalsOfHorizon());
  const row = document.getElementById('badgesRow');
  row.innerHTML = badges.map((key) => `<span class="badge-chip">${escapeHtml(t(key))}</span>`).join('');
}

function renderStatusFilterRow() {
  const options = [[null, t('statusAll')], ['active', t('statusActive')], ['paused', t('statusPaused')],
    ['done', t('statusDone')], ['archived', t('statusArchived')]];
  const row = document.getElementById('statusFilterRow');
  row.innerHTML = options.map(([val, label]) =>
    `<button type="button" class="tag-filter-chip${statusFilter === val ? ' selected' : ''}" data-status="${val === null ? '' : val}">${escapeHtml(label)}</button>`
  ).join('');
  row.querySelectorAll('[data-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      statusFilter = btn.dataset.status || null;
      renderStatusFilterRow();
      renderMonthHeader();
      renderRetro();
      renderGoalsList();
    });
  });
}

// Ретроспектива над списком «Завершені». Закрита ціль досі просто зникала:
// статус міняється, картка випадає з активного списку — і рік роботи не
// лишає на екрані жодного сліду. А для довгих цілей винагорода саме в
// озиранні назад, і всі дані для нього вже лежать у записах.
function renderRetro() {
  const el = document.getElementById('retroBlock');
  if (statusFilter !== 'done') { el.innerHTML = ''; return; }

  const scoped = goalsOfHorizon();
  const opts = { startIsoOf: createdIso };
  // Якщо не закрито взагалі нічого — блок мовчить: порожній стан списку вже
  // сказав усе, що треба, і другий раз цього повторювати не варто.
  const ever = Review.retrospective(scoped, todayISO(), { ...opts, days: null });
  if (!ever || !ever.count) { el.innerHTML = ''; return; }

  const r = Review.retrospective(scoped, todayISO(), { ...opts, days: retroWindowDays });
  const head = r.count
    ? `<span class="retro-count">${escapeHtml(t('retroClosed', r.count))}</span>`
    : `<span class="retro-count">${escapeHtml(t('retroEmptyPeriod'))}</span>`;
  // Розкид показуємо лише тоді, коли він є: «від 40 до 40» — не інформація.
  const spanParts = [];
  if (r.medianDays !== null) spanParts.push(t('retroTypical', r.medianDays));
  if (r.fastestDays !== null && r.fastestDays !== r.slowestDays) {
    spanParts.push(t('retroRange', r.fastestDays, r.slowestDays));
  }
  const span = spanParts.length
    ? `<span class="retro-span">${escapeHtml(spanParts.join(' · '))}</span>` : '';

  const periods = [[365, t('retroYear')], [null, t('retroAll')]];
  const chips = periods.map(([val, label]) =>
    `<button type="button" class="tag-filter-chip${retroWindowDays === val ? ' selected' : ''}" data-retro="${val === null ? '' : val}">${escapeHtml(label)}</button>`
  ).join('');

  el.innerHTML = `
    <div class="retro">
      <div class="retro-periods">${chips}</div>
      <div class="retro-head">${head}${span}</div>
    </div>`;
  el.querySelectorAll('[data-retro]').forEach((btn) => {
    btn.addEventListener('click', () => {
      retroWindowDays = btn.dataset.retro ? Number(btn.dataset.retro) : null;
      renderRetro();
      renderGoalsList();
    });
  });
}

function goalCardHtml(goal) {
  const streak = computeStreak(goal.checkins);
  const metaParts = [];
  if (streak > 0) metaParts.push(`<span class="goal-streak-flame">🔥 ${streak}</span>`);
  if (goal.targetDate) {
    const days = daysToDeadline(goal.targetDate);
    const overdue = days < 0;
    const activeOverdue = overdue && goal.status === 'active';
    metaParts.push(`<span class="goal-card-deadline${activeOverdue ? ' overdue' : ''}">${escapeHtml(overdue ? t('overdueLabel') : t('daysLeftLabel', days))}</span>`);
  }
  // Скільки ціль зайняла — головне число ретроспективи, тож стоїть на самій
  // картці, а не лише в підсумку над списком.
  if (goal.status === 'done') {
    const sp = Review.goalSpan(goal, { startIso: createdIso(goal) });
    if (sp && sp.days !== null) {
      metaParts.push(`<span class="goal-card-days">${escapeHtml(sp.days === 0 ? t('goalSpanSameDay') : t('goalSpanDays', sp.days))}</span>`);
    }
  }
  // Ціль, перенесена з минулого місяця, має про це сказати: інакше липнева
  // серед серпневих виглядала б як щойно заведена.
  if (horizon === 'month' && statusFilter !== 'done') {
    const own = Review.monthKeyOf(goal, { startIso: createdIso(goal) });
    if (own && own !== viewMonth) {
      metaParts.push(`<span class="goal-carried">${escapeHtml(t('carriedFrom', monthLabel(own)))}</span>`);
    }
  }
  const statusBadge = goal.status !== 'active'
    ? `<span class="goal-card-status-badge">${escapeHtml(goal.status === 'done' ? t('statusDone') : t('statusArchived'))}</span>`
    : '';
  // Обрана ціль підсвічена: у режимі двох колонок інакше не видно, чию саме
  // сторінку показує права колонка.
  const selected = goal.id === activeDetailGoalId ? ' selected' : '';
  return `
    <div class="card goal-card${selected}" data-open-goal="${goal.id}">
      <div class="goal-card-top">
        <div>
          <span class="category-chip ${categoryColorClass(goal.category)}">${escapeHtml(categoryLabel(goal.category))}</span>
          <div class="goal-card-title">${escapeHtml(goal.title)}</div>
        </div>
        ${statusBadge}
      </div>
      ${metaParts.length ? `<div class="goal-card-meta">${metaParts.join('')}</div>` : ''}
    </div>`;
}

function goalsOfHorizon() {
  if (horizon !== 'month') return goals.filter((g) => horizonOf(g) === 'year');
  // Ретроспектива дивиться НАЗАД через місяці — у неї свій перемикач періоду
  // («за рік / за весь час»), і місячна рамка його б душила: на вкладці
  // лишились би тільки цілі, закриті цього місяця. Тому у фільтрі
  // «Завершені» місяць не обмежує, і заголовок місяця там теж ховається.
  if (statusFilter === 'done') return goals.filter((g) => horizonOf(g) === 'month');
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
  if (horizon !== 'month' || statusFilter === 'done') { el.innerHTML = ''; return; }
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

/** Цілі, які зараз у списку: горизонт плюс обраний статус. */
function visibleGoals() {
  const scoped = goalsOfHorizon();
  return statusFilter ? scoped.filter((g) => g.status === statusFilter) : scoped;
}

/** Порядок груп — той самий, що в списку категорій, а не алфавітний: людина
 *  сама його й склала. Категорія, якої в списку вже немає (стара ціль), стає
 *  власною групою в кінці, а не зникає. */
function goalGroups(list) {
  const order = goalCategories.map((c) => c.id);
  const seen = [];
  list.forEach((g) => {
    const id = g.category || '';
    if (seen.indexOf(id) === -1) seen.push(id);
  });
  seen.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  });
  return seen.map((id) => ({ id, goals: list.filter((g) => (g.category || '') === id) }));
}

/** Цілі в тому порядку, в якому вони стоять на екрані. У двох колонках список
 *  згрупований, тож «перша» там — перша у ПЕРШІЙ групі, а не в сирому списку. */
function goalsInDisplayOrder(list) {
  if (!isSplitView()) return list;
  return goalGroups(list).reduce((acc, g) => acc.concat(g.goals), []);
}

function renderGoalsList() {
  const list = visibleGoals();
  const el = document.getElementById('goalsList');
  if (!list.length) {
    // Порожній екран питає рівно те, заради чого сюди зайшли, — а це різні
    // питання на різних вкладках.
    const title = horizon === 'month' ? t('emptyMonthNamed', monthLabel(viewMonth)) : t('emptyYearTitle');
    const sub = horizon === 'month' ? t('emptyMonthSub') : t('emptyYearSub');
    el.innerHTML = `<div class="empty-state"><div class="title">${escapeHtml(title)}</div><div>${escapeHtml(sub)}</div></div>`;
    return;
  }
  // У вузькій колонці двох-колонкового вигляду категорія стає РОЗДІЛЬНИКОМ:
  // порожні категорії при цьому просто не малюються — на відміну від
  // колонки-стопки на кожну, де п'ять із восьми стояли б порожніми, а
  // місячний вид дав би колонки заввишки в одну картку. На телефоні список
  // лишається суцільним: там групи лише додали б прокрутки.
  el.innerHTML = isSplitView()
    ? goalGroups(list).map((grp) =>
      `<div class="goal-group-label">${escapeHtml(categoryLabel(grp.id))}</div>${grp.goals.map(goalCardHtml).join('')}`).join('')
    : list.map(goalCardHtml).join('');
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
  subscribeToActions(id);
  document.getElementById('journalInput').value = '';
  setScreen('detail');
  renderCurrentScreen();
}
function showDashboard() {
  activeDetailGoalId = null;
  autoSelectedGoal = false;
  stopActions();
  setScreen('dashboard');
  renderCurrentScreen();
}
document.getElementById('detailBackBtn').addEventListener('click', showDashboard);
// Вкладка «Цілі» — і повернення з екрана деталей, і просто підсвічений стан.
function selectHorizon(next) {
  horizon = next === 'year' ? 'year' : 'month';
  try { localStorage.setItem(HORIZON_KEY, horizon); } catch (err) { /* приватний режим */ }
  document.getElementById('bnMonth').classList.toggle('active', horizon === 'month');
  document.getElementById('bnYear').classList.toggle('active', horizon === 'year');
  showDashboard();
}
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
function renderGoalDetail(goal) {
  document.getElementById('detailTitleLabel').textContent = goal.title;
  document.getElementById('detailEditBtn').onclick = () => openGoalForm(goal);

  const statusBadge = goal.status !== 'active'
    ? `<span class="goal-card-status-badge">${escapeHtml(goal.status === 'done' ? t('statusDone') : t('statusArchived'))}</span>`
    : '';
  document.getElementById('detailBadgesRow').innerHTML =
    `<span class="category-chip ${categoryColorClass(goal.category)}">${escapeHtml(categoryLabel(goal.category))}</span>${statusBadge}`;

  document.getElementById('detailWhyBlock').innerHTML = goal.why
    ? `<div class="why-block">“${escapeHtml(goal.why)}”</div>` : '';

  renderLapseBanner(goal);

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

  renderCheckinGrid(goal);
  renderBlockers(goal);
  renderPauseRow(goal);
  renderJournalList(goal);
}

// Сітка відміток. Серія показує лише ПОТОЧНИЙ ланцюг — і однаково виглядає
// в того, хто відмічався тричі на тиждень пів року, і в того, хто вчора
// почав. Сітка показує частоту: де густо, де діри, і чи ритм узагалі був.
const GRID_WEEKS = 8;

function renderCheckinGrid(goal) {
  const el = document.getElementById('detailGridBlock');
  if (!el) return;
  // Порожня сітка нічого не каже, а місце займає: показуємо, коли є хоч
  // одна відмітка.
  if (!((goal.checkins || []).length)) { el.innerHTML = ''; return; }
  const grid = Streak.checkinGrid(goal, todayISO(), GRID_WEEKS);
  const cells = grid.map((week) => week.map((d) => {
    const cls = ['grid-cell'];
    if (d.future) cls.push('future');
    else if (d.done) cls.push('done');
    else if (d.blocked) cls.push('blocked');
    if (d.today) cls.push('today');
    return `<span class="${cls.join(' ')}" title="${escapeHtml(d.date)}"></span>`;
  }).join('')).join('');
  el.innerHTML = `
    <div class="grid-block">
      <div class="section-label">${escapeHtml(t('gridLabel'))}</div>
      <div class="grid">${cells}</div>
      <div class="grid-legend">
        <span><i class="grid-key done"></i>${escapeHtml(t('gridDone'))}</span>
        <span><i class="grid-key blocked"></i>${escapeHtml(t('gridBlocked'))}</span>
      </div>
    </div>`;
}

// Повернення після довгої перерви.
//
// Так помирає більшість довгих цілей: тиждень руху, пропуск, провина — і
// застосунок більше не відкривають. Різниця між тимчасовим збоєм і повним
// крахом у тому, чи є куди повернутись. Досі ціль після трьох тижнів
// мовчання зустрічала обірваною серією й вердиктом «не встигаєш», тобто
// рівно тим, від чого й тікають.
//
// Тому тут — три виходи й жодного докору. Нічого не робиться само: банер
// каже, що сталось, а вирішує людина.
function renderLapseBanner(goal) {
  const el = document.getElementById('detailLapseBlock');
  if (!el) return;
  const l = Review.lapse(goal, todayISO(), { startIso: createdIso(goal) });
  if (!l) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="lapse">
      <div class="lapse-title">${escapeHtml(l.everMoved ? t('lapseTitle', l.days) : t('lapseNeverTitle', l.days))}</div>
      <div class="lapse-sub">${escapeHtml(t('lapseSub'))}</div>
      <div class="lapse-actions">
        <button type="button" class="lapse-btn primary" id="lapseRestartBtn">${escapeHtml(t('lapseRestart'))}</button>
        <button type="button" class="lapse-btn" id="lapseEditBtn">${escapeHtml(t('lapseEdit'))}</button>
        <button type="button" class="lapse-btn" id="lapsePauseBtn">${escapeHtml(t('lapsePause'))}</button>
      </div>
    </div>`;
  document.getElementById('lapseRestartBtn').addEventListener('click', () => restartGoal(goal.id));
  document.getElementById('lapseEditBtn').addEventListener('click', () => openGoalForm(goal));
  document.getElementById('lapsePauseBtn').addEventListener('click', () => setGoalStatus(goal.id, 'paused'));
}

// Перезапуск НЕ стирає історію: пройдені кілометри лишаються пройденими, а
// журнал — журналом. Міняється лише точка, від якої ведеться відлік, бо
// рахувати темп від дати, з якої півроку нічого не було, безглуздо.
async function restartGoal(goalId) {
  if (!auth.currentUser) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    restartedAt: todayISO(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('restartGoal:', err));
}

// Намір «якщо ситуація — то дія». Порожню половину зберігаємо як є: людина
// createdAt приходить із Firestore як Timestamp; тим, хто рахує вік цілі
// (ретроспектива, довга перерва, місяць «свого» місяця), потрібен день, від
// якого вести відлік. Якщо поля ще немає (щойно створений документ до
// підтвердження сервером) — review.js сам візьме найраніший слід у даних.
function createdIso(goal) {
  // Після перезапуску відлік цілі ведеться від нього, а не від заведення:
  // саме в цьому й полягає «почати заново».
  if (goal && typeof goal.restartedAt === 'string' && goal.restartedAt.length === 10) {
    return goal.restartedAt;
  }
  const ts = goal && goal.createdAt;
  if (ts && typeof ts.toDate === 'function') return Streak.isoOf(ts.toDate());
  return null;
}

// ---- Що заважає найчастіше ----
// Щовечора застосунок питає «що завадило» і зберігає відповідь. Рахунок за
// частотою вже вмів goals/streak.js (blockerStats), але показувати його було
// ніде: цифри бачив лише помічник у чаті. Виходило, що людина відповідає на
// питання, відповіді на яке ніколи не отримує.
//
// Три найчастіші причини, не більше: список із десяти — це вже не висновок,
// а сирий журнал. Одна-єдина причина теж показується: коли пропуск був один,
// це все одно чесна відповідь на «чому не виходить».
function renderBlockers(goal) {
  const el = document.getElementById('detailBlockersBlock');
  const top = Streak.blockerStats(goal, 3);
  if (!top.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="blockers">
      <div class="blockers-title">${escapeHtml(t('blockersTitle'))}</div>
      <div class="blockers-row">
        ${top.map((b) => `<span class="blocker-chip">${escapeHtml(blockerLabel(b.reason))}<span class="blocker-count">${b.count}</span></span>`).join('')}
      </div>
    </div>`;
}

// ---- Пауза й архів ----
// Пауза — це середнє між «ціль тисне» і «поховати в архів»: ціль жива, але
// свідомо відкладена, і серія при цьому не рветься.
//
// Архів колись жив лише в екрані щотижневого огляду. Огляд прибрано, а
// фільтр «Архів» лишився й далі показує складене туди раніше, тож кнопка
// переїхала сюди — інакше застосунок умів би показувати архів, але не вмів
// би нічого туди покласти.
// «Виконано» стоїть тут, поруч із паузою й архівом, бо це така сама зміна
// статусу. Раніше воно жило в банері «усі віхи пройдено» — тобто ціль без
// віх завершити було нічим, хоч фільтр «Завершені» в застосунку є.
function renderPauseRow(goal) {
  const el = document.getElementById('detailPauseRow');
  if (goal.status === 'done' || goal.status === 'archived') { el.innerHTML = ''; return; }
  const paused = goal.status === 'paused';
  el.innerHTML = `
    <div class="pause-row">
      <button type="button" class="pause-btn primary" id="markDoneBtn">${escapeHtml(t('markGoalDoneBtn'))}</button>
      <button type="button" class="pause-btn" id="pauseToggleBtn">${escapeHtml(paused ? t('resumeBtn') : t('pauseBtn'))}</button>
      <button type="button" class="pause-btn" id="archiveGoalBtn">${escapeHtml(t('archiveBtn'))}</button>
    </div>`;
  document.getElementById('markDoneBtn').addEventListener('click', () => {
    setGoalStatus(goal.id, 'done');
  });
  document.getElementById('pauseToggleBtn').addEventListener('click', () => {
    setGoalStatus(goal.id, paused ? 'active' : 'paused');
  });
  document.getElementById('archiveGoalBtn').addEventListener('click', () => {
    setGoalStatus(goal.id, 'archived');
  });
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
      if (currentScreen === 'detail' && activeDetailGoalId === goalId) {
        renderActionsBlock(goalId);
      }
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
async function addAction(goalId, title, dueDate) {
  if (!auth.currentUser) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('tasks').add({
    title: title.slice(0, 200),
    notes: '', done: false, completedAt: null,
    priority: null, tags: [],
    dueDate: dueDate || todayISO(), dueTime: null,
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
  // completedAt — день, коли ціль закрили. Без нього ретроспектива могла б
  // хіба вгадувати тривалість за останнім слідом у даних; а якщо ціль
  // відкривають назад, стара дата має піти разом зі статусом.
  const patch = {
    status, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    completedAt: status === 'done' ? todayISO() : null,
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
  document.getElementById('editCategoriesBtn').addEventListener('click', openCatManage);
}

// ---- Керування категоріями ----
// Той самий контракт, що й у категорій бюджету: правка одразу летить у
// профіль, а не чекає на «зберегти». Категорії — не частина цілі, яку зараз
// редагують; тримати їх у чернетці форми означало б, що скасування форми
// скасовує ще й перейменування, зроблене для всіх цілей одразу.
function saveGoalCategories(list) {
  const uidCur = auth.currentUser && auth.currentUser.uid;
  if (!uidCur) return Promise.reject(new Error('no-auth'));
  // Показуємо новий список одразу, не чекаючи, поки долетить onSnapshot:
  // інакше щойно набрана назва на мить зникала б із рядка.
  goalCategories = list;
  usingDefaultCategories = false;
  return db.collection('users').doc(uidCur).set({ categoriesGoals: list }, { merge: true });
}

function newCategoryId() {
  return 'gcat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Найменш зайнятий слот палітри — щоб дві сусідні категорії не злились. */
function freeColorIndex() {
  const used = goalCategories.map((c) => c.colorIndex);
  for (let i = 0; i < CATEGORY_SLOTS; i++) if (!used.includes(i)) return i;
  return goalCategories.length % CATEGORY_SLOTS;
}

function addGoalCategory(label) {
  const clean = label.trim().slice(0, 40);
  if (!clean) return Promise.resolve();
  if (goalCategories.some((c) => c.label.trim().toLowerCase() === clean.toLowerCase())) {
    return Promise.reject(new Error('duplicate'));
  }
  return saveGoalCategories([...goalCategories, { id: newCategoryId(), label: clean, colorIndex: freeColorIndex() }]);
}

function renameGoalCategory(id, label) {
  const clean = label.trim().slice(0, 40);
  if (!clean) return Promise.resolve();
  if (goalCategories.some((c) => c.id !== id && c.label.trim().toLowerCase() === clean.toLowerCase())) {
    return Promise.reject(new Error('duplicate'));
  }
  // Перейменування не чіпає цілей: у них лежить id, а не назва — саме заради
  // цього id взагалі й існує.
  return saveGoalCategories(goalCategories.map((c) => (c.id === id ? { ...c, label: clean } : c)));
}

/** Скільки цілей носить цю категорію — рахуємо по всьому списку, а не по видимій вкладці. */
function goalsInCategory(id) {
  return goals.filter((g) => g && g.category === id);
}

function deleteGoalCategory(id) {
  if (goalCategories.length <= 1) return Promise.reject(new Error('last'));
  const list = goalCategories.filter((c) => c.id !== id);
  // Цілі видаленої категорії переносимо на першу з тих, що лишились: інакше
  // вони лишились би з «сирітським» id, і замість назви в чипі стояв би він.
  const fallback = list[0].id;
  const affected = goalsInCategory(id);
  const uidCur = auth.currentUser && auth.currentUser.uid;
  if (!uidCur) return Promise.reject(new Error('no-auth'));
  const col = db.collection('users').doc(uidCur).collection('goals');
  const batch = db.batch();
  affected.forEach((g) => {
    batch.update(col.doc(g.id), {
      category: fallback,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });
  return batch.commit().then(() => saveGoalCategories(list));
}

function renderGoalCatManager() {
  const container = document.getElementById('goalCatManageList');
  if (!container) return;
  container.innerHTML = goalCategories.map((cat) => `
    <div class="cat-manage-row">
      <span class="cat-manage-dot ${categoryColorClass(cat.id)}"></span>
      <input type="text" class="cat-manage-input" maxlength="40" value="${escapeHtml(cat.label)}" data-id="${escapeHtml(cat.id)}">
      <button type="button" class="cat-manage-del" data-id="${escapeHtml(cat.id)}" aria-label="${escapeHtml(t('deleteCatAria'))}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');

  container.querySelectorAll('.cat-manage-input').forEach((input) => {
    const commit = () => {
      const cat = findGoalCategory(input.dataset.id);
      if (!cat) return;
      const val = input.value.trim();
      // Порожнє поле — це не «прибрати назву», а промах: для видалення поруч
      // стоїть хрестик. Повертаємо як було.
      if (!val || val === cat.label) { input.value = cat.label; return; }
      catManageError('');
      renameGoalCategory(cat.id, val)
        .then(() => refreshAfterCategoryChange())
        .catch((err) => {
          input.value = cat.label;
          catManageError(err && err.message === 'duplicate' ? t('catDuplicateError') : t('catSaveError'));
        });
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  });

  container.querySelectorAll('.cat-manage-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = findGoalCategory(btn.dataset.id);
      if (!cat) return;
      if (goalCategories.length <= 1) { catManageError(t('catLastError')); return; }
      const used = goalsInCategory(cat.id).length;
      const target = goalCategories.filter((c) => c.id !== cat.id)[0];
      if (used > 0 && !confirm(t('catInUseConfirm', used, target.label))) return;
      catManageError('');
      deleteGoalCategory(cat.id)
        .then(() => refreshAfterCategoryChange())
        .catch(() => catManageError(t('catSaveError')));
    });
  });
}

function catManageError(text) {
  const el = document.getElementById('catManageError');
  if (el) el.textContent = text;
}

/**
 * Перемалювати все, на що впливає список: рядки вікна, чипи форми і самі
 * картки цілей (у них теж стоїть назва категорії).
 */
function refreshAfterCategoryChange() {
  if (!findGoalCategory(formCategory)) formCategory = fallbackCategoryId();
  renderGoalCatManager();
  renderCategoryPicker();
  renderCurrentScreen();
}

function addGoalCategoryFromInput() {
  const input = document.getElementById('newGoalCatInput');
  const label = input.value.trim();
  if (!label) return;
  catManageError('');
  addGoalCategory(label)
    .then(() => { input.value = ''; refreshAfterCategoryChange(); })
    .catch((err) => {
      catManageError(err && err.message === 'duplicate' ? t('catDuplicateError') : t('catSaveError'));
    });
}

function openCatManage() {
  catManageError('');
  document.getElementById('newGoalCatInput').value = '';
  renderGoalCatManager();
  document.getElementById('catManageOverlay').classList.add('show');
}

function closeCatManage() {
  document.getElementById('catManageOverlay').classList.remove('show');
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

// Вікно категорій. Закривається хрестиком і тапом повз вікно — як усі шари
// застосунку; питати «зберегти?» тут нема про що: кожна правка вже в базі.
document.getElementById('closeCatManage').addEventListener('click', closeCatManage);
document.getElementById('catManageOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('catManageOverlay')) closeCatManage();
});
document.getElementById('addGoalCatBtn').addEventListener('click', addGoalCategoryFromInput);
document.getElementById('newGoalCatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addGoalCategoryFromInput(); }
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
        checkins: [],
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
    openFromHash(() => openGoalForm(null));
  } else {
    if (unsubscribeGoals) { unsubscribeGoals(); unsubscribeGoals = null; }
    if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
    // Наступний, хто увійде, побачить стандартний список своєю мовою, а не
    // залишки чужого.
    goalCategories = defaultGoalCategoryList(currentLang, CATEGORY_SLOTS);
    usingDefaultCategories = true;
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
