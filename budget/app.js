// ---- Service Worker ----
// Перенесено сюди з inline <script> в index.html, щоб CSP міг забороняти
// інлайн-скрипти (script-src без 'unsafe-inline') без винятків.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
}

// ---- Firebase ----
firebase.initializeApp(firebaseConfig);

// ---- App Check ----
// Дозволяє звертатись до Firestore/Auth лише зі сторінок нашого сайту (перевірено
// через reCAPTCHA v3), а не з довільного скрипта, що напряму викликає Firebase API
// з чужого домену. Активуємо ДО того, як почнемо користуватись auth/db — так радить
// документація Firebase. Якщо ключ у firebase-config.js ще не налаштовано (заглушка),
// просто пропускаємо — застосунок далі працює як і раніше, без App Check.
if (typeof RECAPTCHA_V3_SITE_KEY === 'string' && RECAPTCHA_V3_SITE_KEY && !RECAPTCHA_V3_SITE_KEY.startsWith('ВСТАВ_')) {
  try {
    firebase.appCheck().activate(RECAPTCHA_V3_SITE_KEY, /* isTokenAutoRefreshEnabled */ true);
  } catch (err) {
    console.warn('App Check: не вдалося активувати', err);
  }
}

const auth = firebase.auth();
const db = firebase.firestore();
// Кешуємо дані Firestore локально (IndexedDB), щоб застосунок реально працював
// офлайн: читання беруться з кешу, а записи (нові транзакції, нотатки тощо),
// зроблені без інтернету, ставляться в чергу й відправляються самі, коли
// з'явиться мережа. synchronizeTabs дозволяє тримати кілька вкладок одночасно
// замість того, щоб persistence вмикався лише в першій відкритій вкладці.
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Малоймовірно з synchronizeTabs, але про всяк випадок: якщо persistence
    // не вдалося узгодити між вкладками, застосунок просто працює без офлайн-кешу.
    console.warn('Firestore: офлайн-кеш недоступний (конфлікт вкладок).');
  } else if (err.code === 'unimplemented') {
    // Браузер не підтримує потрібні можливості (рідкісні/старі браузери,
    // деякі приватні режими) — застосунок продовжує працювати онлайн.
    console.warn('Firestore: офлайн-кеш не підтримується цим браузером.');
  }
});

// ---- Мови ----
const LANGS = ['uk', 'ru', 'pl', 'en'];
const LANG_NAMES = { uk: 'UA', ru: 'RU', pl: 'PL', en: 'EN' };
const LOCALE_MAP = { uk: 'uk-UA', ru: 'ru-RU', pl: 'pl-PL', en: 'en-US' };

const T = {
  uk: {
    appTitle: 'Life',
    authTitleLogin: 'Вхід', authTitleSignup: 'Реєстрація',
    authSub: 'Увійди, щоб дані синхронізувались між твоїми пристроями.',
    emailLabel: 'Email', passwordLabel: 'Пароль',
    loginBtn: 'Увійти', signupBtn: 'Зареєструватися', waitBtn: 'Зачекай…',
    switchToSignup: 'Ще немає акаунта?', switchToLogin: 'Вже є акаунт?',
    fillBoth: 'Заповни email і пароль',
    err_invalidEmail: 'Некоректний email', err_missingPassword: 'Введи пароль',
    err_weakPassword: 'Пароль надто короткий (мінімум 6 символів)',
    err_emailInUse: 'Цей email вже зареєстровано. Спробуй увійти',
    err_invalidCred: 'Невірний email або пароль', err_userNotFound: 'Акаунт з таким email не знайдено',
    err_tooMany: 'Забагато спроб. Спробуй трохи пізніше', err_generic: 'Щось пішло не так. Спробуй ще раз',
    rememberMe: 'Запам’ятати мене', forgotPassword: 'Забув(ла) пароль?',
    enterEmailFirst: 'Спочатку введи свій email',
    resetSent: 'Лист для відновлення паролю надіслано на {email}',
    err_resetFailed: 'Не вдалося надіслати лист. Перевір email і спробуй ще раз',
    balanceLabel: 'Кошти', logout: 'Вийти',
    incomeMonthLabel: 'Дохід за місяць', expenseMonthLabel: 'Витрати за місяць',
    tabEntries: 'Кошти', tabStats: 'Статистика', tabPages: 'Нотатки', tabSavings: 'Збереження', savingsBalanceLabel: 'Баланс заощаджень', savingsEmptySub: 'Додай першу операцію кнопкою внизу', fabDepositLabel: 'Поповнити', fabWithdrawLabel: 'Зняти', newDepositTitle: 'Поповнення', newWithdrawTitle: 'Зняття коштів', editDepositTitle: 'Редагувати поповнення', editWithdrawTitle: 'Редагувати зняття', savingsTotalLabel: 'Загальний баланс', addGoalLabel: 'Нова ціль', goalFormTitleNew: 'Нова ціль', goalFormTitleEdit: 'Редагувати ціль', goalNameLabel: 'Назва', goalNamePlaceholder: 'Напр. На відпустку', goalNameError: 'Введи назву цілі', deleteGoalLabel: 'Видалити ціль', confirmTitleGoal: 'Видалити ціль?', confirmSubGoal: 'Усі операції в цій цілі теж буде видалено.', defaultGoalName: 'Загальні заощадження', savingsTrendTitle: 'Збереження', savingsTrendSub: 'Динаміка за 6 місяців', savingsTrendEmpty: 'Ще немає заощаджень',
    prevMonthAria: 'Попередній місяць', nextMonthAria: 'Наступний місяць',
    newPageBtn: 'Нова нотатка', pageTitleLabel: 'Назва', pageContentLabel: 'Текст', tabNotes: 'Нотатки', addNoteBtnLabel: 'Нова нотатка', notesEmptyTitle: 'Тут поки порожньо', notesEmptySub: 'Додай першу нотатку кнопкою нижче',
    pageTitlePlaceholder: 'Напр. Ідеї на відпустку', pageContentPlaceholder: 'Пиши тут що завгодно…',
    editPageTitle: 'Редагувати нотатку', newPageTitle: 'Нова нотатка',
    savePageBtn: 'Зберегти', deletePageBtn: 'Видалити',
    pageEmptyTitle: 'Ще немає сторінок', pageEmptySub: 'Створи першу кнопкою внизу',
    pageError: 'Введи назву нотатки', pageSaveError: 'Не вдалося зберегти. Перевір інтернет-з’єднання',
    confirmTitlePage: 'Видалити сторінку?',
    pageNoTitle: 'Без назви',
    emptyTitle: 'Тут поки порожньо', recentEntriesLabel: 'Останні операції', emptySub: 'Додай перший запис кнопкою внизу', searchPlaceholder: 'Пошук по нотатках і категоріях', searchEmptyTitle: 'Нічого не знайдено', searchEmptySub: 'Спробуй інше слово для пошуку',
    deleteAria: 'Видалити запис', entryMenuAria: 'Дії із записом', menuEdit: 'Редагувати', menuDelete: 'Видалити', toggleCatAria: 'Показати/приховати категорію', rateAsOf: 'курс НБУ на', rateUnavailable: 'курс недоступний офлайн', rateStaleSuffix: 'можливо застарів', statsSettingsTitle: 'Налаштування статистики', statsSettingsChartsLabel: 'Видимі діаграми', savingsSettingsTitle: 'Налаштування заощаджень', showSavingsTotalLabel: 'Показувати загальний баланс заощаджень', savingsTotalModeLabel: 'Загальний баланс — валюта', savingsTotalModeMulti: 'Кілька валют', savingsTotalModeSingle: 'Одна валюта', notesSettingsTitle: 'Налаштування нотаток', notesSortLabel: 'Сортування', notesSortUpdated: 'Спочатку нещодавно оновлені', notesSortCreated: 'Спочатку нещодавно створені', notesSortTitle: 'За назвою (А-Я)', showNoteSnippetLabel: 'Показувати текст нотатки в списку', passwordHint: 'Мінімум 6 символів',
    statsCatTitle: 'Витрати за категоріями', statsNoExpenses: 'Немає витрат цього місяця',
    statsTrendTitle: 'Дохід і витрати', statsTrendSub: 'Останні 6 місяців', lastLabel: 'Останні',
    chartIncome: 'Дохід', chartExpense: 'Витрати',
    fabExpense: 'Витрата', fabIncome: 'Дохід',
    newExpenseTitle: 'Нова витрата', newIncomeTitle: 'Новий дохід', editExpenseTitle: 'Редагувати витрату', editIncomeTitle: 'Редагувати дохід',
    amountLabel: 'Сума, {symbol}', amountLabelPlain: 'Сума', catLabel: 'Категорія', dateLabel: 'Дата',
    noteLabel: 'Нотатка (необовʼязково)', notePlaceholder: 'Напр. кава з другом',
    saveBtn: 'Зберегти запис', amountError: 'Введи суму більшу за нуль',
    saveError: 'Не вдалося зберегти. Перевір інтернет-з’єднання',
    confirmTitle: 'Видалити запис?', confirmSub: 'Цю дію не можна скасувати.', confirmTitleLogout: 'Вийти з акаунту?', confirmSubLogout: 'Доведеться увійти знову, щоб побачити свої дані.',
    cancelBtn: 'Скасувати', deleteBtn: 'Видалити',
    settingsTitle: 'Налаштування', themeLabel: 'Тема', themeLight: 'Світла', themeDark: 'Темна', themeSystem: 'Як в системі',
    langLabel: 'Мова', currencyLabel: 'Валюта', categoriesTitle: 'Категорії',
    expenseCatManageLabel: 'Категорії витрат', incomeCatManageLabel: 'Категорії доходів',
    newCatPlaceholder: 'Нова категорія', addCatAria: 'Додати категорію', deleteCatAria: 'Видалити категорію',
    catLastError: 'Має залишитися хоча б одна категорія',
    catDuplicateError: 'Категорія з такою назвою вже існує',
    catInUseConfirm: 'Ця категорія використовується у {count} записах. Їх буде перенесено в іншу категорію. Видалити її?',
    chooseFileBtn: 'Обрати файл',
    exportDataLabel: 'Дані',
    exportDataDesc: 'Завантажить файл з усіма твоїми записами, категоріями, заощадженнями й нотатками.',
    exportDataError: 'Не вдалося підготувати експорт. Спробуй ще раз.',
    exportXlsxBtn: 'Експортувати в Excel (.xlsx)',
    exportXlsxSheetTx: 'Транзакції', exportXlsxSheetSavings: 'Заощадження', exportXlsxSheetGoals: 'Цілі заощаджень',
    exportXlsxSheetNotes: 'Нотатки', exportXlsxSheetCats: 'Категорії',
    exportXlsxColDate: 'Дата', exportXlsxColType: 'Тип', exportXlsxColCategory: 'Категорія', exportXlsxColAmount: 'Сума',
    exportXlsxColCurrency: 'Валюта', exportXlsxColNote: 'Нотатка', exportXlsxColGoal: 'Ціль', exportXlsxColName: 'Назва',
    exportXlsxColCreated: 'Створено', exportXlsxColUpdated: 'Оновлено', exportXlsxColTitle: 'Заголовок', exportXlsxColContent: 'Зміст',
    exportXlsxTypeExpense: 'Витрата', exportXlsxTypeIncome: 'Дохід', exportXlsxTypeDeposit: 'Поповнення', exportXlsxTypeWithdraw: 'Зняття',
    importCsvBtn: 'Імпортувати транзакції з CSV', importDataDesc: 'Колонки: дата (РРРР-ММ-ДД), тип (дохід/витрата), категорія, сума, нотатка.',
    importConfirm: 'Знайдено рядків: {total}. Буде додано записів: {ok}, нових категорій: {newCats}. Пропущено через помилки: {skipped}. Продовжити?',
    importSuccess: 'Імпортовано записів: {count}', importNoValidRows: 'У файлі не знайдено жодного коректного рядка',
    importParseError: 'Не вдалося прочитати файл. Перевір, що це коректний CSV.',
  },
  ru: {
    appTitle: 'Life',
    authTitleLogin: 'Вход', authTitleSignup: 'Регистрация',
    authSub: 'Войди, чтобы данные синхронизировались между твоими устройствами.',
    emailLabel: 'Email', passwordLabel: 'Пароль',
    loginBtn: 'Войти', signupBtn: 'Зарегистрироваться', waitBtn: 'Подожди…',
    switchToSignup: 'Ещё нет аккаунта?', switchToLogin: 'Уже есть аккаунт?',
    fillBoth: 'Заполни email и пароль',
    err_invalidEmail: 'Некорректный email', err_missingPassword: 'Введи пароль',
    err_weakPassword: 'Пароль слишком короткий (минимум 6 символов)',
    err_emailInUse: 'Этот email уже зарегистрирован. Попробуй войти',
    err_invalidCred: 'Неверный email или пароль', err_userNotFound: 'Аккаунт с таким email не найден',
    err_tooMany: 'Слишком много попыток. Попробуй позже', err_generic: 'Что-то пошло не так. Попробуй ещё раз',
    rememberMe: 'Запомнить меня', forgotPassword: 'Забыл(а) пароль?',
    enterEmailFirst: 'Сначала введи свой email',
    resetSent: 'Письмо для восстановления пароля отправлено на {email}',
    err_resetFailed: 'Не удалось отправить письмо. Проверь email и попробуй ещё раз',
    balanceLabel: 'Средства', logout: 'Выйти',
    incomeMonthLabel: 'Доход за месяц', expenseMonthLabel: 'Расходы за месяц',
    tabEntries: 'Средства', tabStats: 'Статистика', tabPages: 'Заметки', tabSavings: 'Сбережения', savingsBalanceLabel: 'Баланс сбережений', savingsEmptySub: 'Добавь первую операцию кнопкой внизу', fabDepositLabel: 'Пополнить', fabWithdrawLabel: 'Снять', newDepositTitle: 'Пополнение', newWithdrawTitle: 'Снятие средств', editDepositTitle: 'Редактировать пополнение', editWithdrawTitle: 'Редактировать снятие', savingsTotalLabel: 'Общий баланс', addGoalLabel: 'Новая цель', goalFormTitleNew: 'Новая цель', goalFormTitleEdit: 'Редактировать цель', goalNameLabel: 'Название', goalNamePlaceholder: 'Напр. На отпуск', goalNameError: 'Введи название цели', deleteGoalLabel: 'Удалить цель', confirmTitleGoal: 'Удалить цель?', confirmSubGoal: 'Все операции в этой цели тоже будут удалены.', defaultGoalName: 'Общие сбережения', savingsTrendTitle: 'Сбережения', savingsTrendSub: 'Динамика за 6 месяцев', savingsTrendEmpty: 'Пока нет сбережений',
    prevMonthAria: 'Предыдущий месяц', nextMonthAria: 'Следующий месяц',
    newPageBtn: 'Новая заметка', pageTitleLabel: 'Название', pageContentLabel: 'Текст', tabNotes: 'Заметки', addNoteBtnLabel: 'Новая заметка', notesEmptyTitle: 'Здесь пока пусто', notesEmptySub: 'Добавь первую заметку кнопкой снизу',
    pageTitlePlaceholder: 'Напр. Идеи на отпуск', pageContentPlaceholder: 'Пиши здесь что угодно…',
    editPageTitle: 'Редактировать заметку', newPageTitle: 'Новая заметка',
    savePageBtn: 'Сохранить', deletePageBtn: 'Удалить',
    pageEmptyTitle: 'Пока нет страниц', pageEmptySub: 'Создай первую кнопкой внизу',
    pageError: 'Введи название заметки', pageSaveError: 'Не удалось сохранить. Проверь интернет-соединение',
    confirmTitlePage: 'Удалить страницу?',
    pageNoTitle: 'Без названия',
    emptyTitle: 'Здесь пока пусто', recentEntriesLabel: 'Последние операции', emptySub: 'Добавь первую запись кнопкой внизу', searchPlaceholder: 'Поиск по заметкам и категориям', searchEmptyTitle: 'Ничего не найдено', searchEmptySub: 'Попробуй другое слово для поиска',
    deleteAria: 'Удалить запись', entryMenuAria: 'Действия с записью', menuEdit: 'Редактировать', menuDelete: 'Удалить', toggleCatAria: 'Показать/скрыть категорию', rateAsOf: 'курс НБУ на', rateUnavailable: 'курс недоступен офлайн', rateStaleSuffix: 'возможно устарел', statsSettingsTitle: 'Настройки статистики', statsSettingsChartsLabel: 'Видимые диаграммы', savingsSettingsTitle: 'Настройки сбережений', showSavingsTotalLabel: 'Показывать общий баланс сбережений', savingsTotalModeLabel: 'Общий баланс — валюта', savingsTotalModeMulti: 'Несколько валют', savingsTotalModeSingle: 'Одна валюта', notesSettingsTitle: 'Настройки заметок', notesSortLabel: 'Сортировка', notesSortUpdated: 'Сначала недавно обновлённые', notesSortCreated: 'Сначала недавно созданные', notesSortTitle: 'По названию (А-Я)', showNoteSnippetLabel: 'Показывать текст заметки в списке', passwordHint: 'Минимум 6 символов',
    statsCatTitle: 'Расходы по категориям', statsNoExpenses: 'Нет расходов в этом месяце',
    statsTrendTitle: 'Доход и расходы', statsTrendSub: 'Последние 6 месяцев', lastLabel: 'Последние',
    chartIncome: 'Доход', chartExpense: 'Расходы',
    fabExpense: 'Расход', fabIncome: 'Доход',
    newExpenseTitle: 'Новый расход', newIncomeTitle: 'Новый доход', editExpenseTitle: 'Редактировать расход', editIncomeTitle: 'Редактировать доход',
    amountLabel: 'Сумма, {symbol}', amountLabelPlain: 'Сумма', catLabel: 'Категория', dateLabel: 'Дата',
    noteLabel: 'Заметка (необязательно)', notePlaceholder: 'Напр. кофе с другом',
    saveBtn: 'Сохранить запись', amountError: 'Введи сумму больше нуля',
    saveError: 'Не удалось сохранить. Проверь интернет-соединение',
    confirmTitle: 'Удалить запись?', confirmSub: 'Это действие нельзя отменить.', confirmTitleLogout: 'Выйти из аккаунта?', confirmSubLogout: 'Придётся войти снова, чтобы увидеть свои данные.',
    cancelBtn: 'Отмена', deleteBtn: 'Удалить',
    settingsTitle: 'Настройки', themeLabel: 'Тема', themeLight: 'Светлая', themeDark: 'Тёмная', themeSystem: 'Как в системе',
    langLabel: 'Язык', currencyLabel: 'Валюта', categoriesTitle: 'Категории',
    expenseCatManageLabel: 'Категории расходов', incomeCatManageLabel: 'Категории доходов',
    newCatPlaceholder: 'Новая категория', addCatAria: 'Добавить категорию', deleteCatAria: 'Удалить категорию',
    catLastError: 'Должна остаться хотя бы одна категория',
    catDuplicateError: 'Категория с таким названием уже существует',
    catInUseConfirm: 'Эта категория используется в {count} записях. Они будут перенесены в другую категорию. Удалить её?',
    chooseFileBtn: 'Выбрать файл',
    exportDataLabel: 'Данные',
    exportDataDesc: 'Скачает файл со всеми твоими записями, категориями, накоплениями и заметками.',
    exportDataError: 'Не удалось подготовить экспорт. Попробуй ещё раз.',
    exportXlsxBtn: 'Экспортировать в Excel (.xlsx)',
    exportXlsxSheetTx: 'Транзакции', exportXlsxSheetSavings: 'Накопления', exportXlsxSheetGoals: 'Цели накоплений',
    exportXlsxSheetNotes: 'Заметки', exportXlsxSheetCats: 'Категории',
    exportXlsxColDate: 'Дата', exportXlsxColType: 'Тип', exportXlsxColCategory: 'Категория', exportXlsxColAmount: 'Сумма',
    exportXlsxColCurrency: 'Валюта', exportXlsxColNote: 'Заметка', exportXlsxColGoal: 'Цель', exportXlsxColName: 'Название',
    exportXlsxColCreated: 'Создано', exportXlsxColUpdated: 'Обновлено', exportXlsxColTitle: 'Заголовок', exportXlsxColContent: 'Содержимое',
    exportXlsxTypeExpense: 'Расход', exportXlsxTypeIncome: 'Доход', exportXlsxTypeDeposit: 'Пополнение', exportXlsxTypeWithdraw: 'Снятие',
    importCsvBtn: 'Импортировать транзакции из CSV', importDataDesc: 'Колонки: дата (ГГГГ-ММ-ДД), тип (доход/расход), категория, сумма, заметка.',
    importConfirm: 'Найдено строк: {total}. Будет добавлено записей: {ok}, новых категорий: {newCats}. Пропущено из-за ошибок: {skipped}. Продолжить?',
    importSuccess: 'Импортировано записей: {count}', importNoValidRows: 'В файле не найдено ни одной корректной строки',
    importParseError: 'Не удалось прочитать файл. Проверь, что это корректный CSV.',
  },
  pl: {
    appTitle: 'Life',
    authTitleLogin: 'Logowanie', authTitleSignup: 'Rejestracja',
    authSub: 'Zaloguj się, aby dane synchronizowały się między urządzeniami.',
    emailLabel: 'Email', passwordLabel: 'Hasło',
    loginBtn: 'Zaloguj się', signupBtn: 'Zarejestruj się', waitBtn: 'Czekaj…',
    switchToSignup: 'Nie masz konta?', switchToLogin: 'Masz już konto?',
    fillBoth: 'Wypełnij email i hasło',
    err_invalidEmail: 'Nieprawidłowy email', err_missingPassword: 'Wpisz hasło',
    err_weakPassword: 'Hasło za krótkie (min. 6 znaków)',
    err_emailInUse: 'Ten email już zarejestrowano. Spróbuj się zalogować',
    err_invalidCred: 'Nieprawidłowy email lub hasło', err_userNotFound: 'Nie znaleziono konta z tym emailem',
    err_tooMany: 'Zbyt wiele prób. Spróbuj później', err_generic: 'Coś poszło nie tak. Spróbuj ponownie',
    rememberMe: 'Zapamiętaj mnie', forgotPassword: 'Zapomniałeś(aś) hasła?',
    enterEmailFirst: 'Najpierw wpisz swój email',
    resetSent: 'Wysłano email do resetowania hasła na {email}',
    err_resetFailed: 'Nie udało się wysłać emaila. Sprawdź adres i spróbuj ponownie',
    balanceLabel: 'Środki', logout: 'Wyloguj',
    incomeMonthLabel: 'Przychód w tym miesiącu', expenseMonthLabel: 'Wydatki w tym miesiącu',
    tabEntries: 'Środki', tabStats: 'Statystyki', tabPages: 'Notatki', tabSavings: 'Oszczędności', savingsBalanceLabel: 'Saldo oszczędności', savingsEmptySub: 'Dodaj pierwszą operację przyciskiem poniżej', fabDepositLabel: 'Wpłać', fabWithdrawLabel: 'Wypłać', newDepositTitle: 'Wpłata', newWithdrawTitle: 'Wypłata środków', editDepositTitle: 'Edytuj wpłatę', editWithdrawTitle: 'Edytuj wypłatę', savingsTotalLabel: 'Łączne saldo', addGoalLabel: 'Nowy cel', goalFormTitleNew: 'Nowy cel', goalFormTitleEdit: 'Edytuj cel', goalNameLabel: 'Nazwa', goalNamePlaceholder: 'Np. Na wakacje', goalNameError: 'Wpisz nazwę celu', deleteGoalLabel: 'Usuń cel', confirmTitleGoal: 'Usunąć cel?', confirmSubGoal: 'Wszystkie operacje w tym celu też zostaną usunięte.', defaultGoalName: 'Ogólne oszczędności', savingsTrendTitle: 'Oszczędności', savingsTrendSub: 'Dynamika za 6 miesięcy', savingsTrendEmpty: 'Jeszcze brak oszczędności',
    prevMonthAria: 'Poprzedni miesiąc', nextMonthAria: 'Następny miesiąc',
    newPageBtn: 'Nowa notatka', pageTitleLabel: 'Tytuł', pageContentLabel: 'Treść', tabNotes: 'Notatki', addNoteBtnLabel: 'Nowa notatka', notesEmptyTitle: 'Tu jeszcze pusto', notesEmptySub: 'Dodaj pierwszą notatkę przyciskiem poniżej',
    pageTitlePlaceholder: 'Np. Pomysły na wakacje', pageContentPlaceholder: 'Napisz tu cokolwiek…',
    editPageTitle: 'Edytuj notatkę', newPageTitle: 'Nowa notatka',
    savePageBtn: 'Zapisz', deletePageBtn: 'Usuń',
    pageEmptyTitle: 'Jeszcze brak stron', pageEmptySub: 'Utwórz pierwszą przyciskiem poniżej',
    pageError: 'Wpisz tytuł notatki', pageSaveError: 'Nie udało się zapisać. Sprawdź połączenie z internetem',
    confirmTitlePage: 'Usunąć stronę?',
    pageNoTitle: 'Bez tytułu',
    emptyTitle: 'Tu jeszcze pusto', recentEntriesLabel: 'Ostatnie operacje', emptySub: 'Dodaj pierwszy wpis przyciskiem poniżej', searchPlaceholder: 'Szukaj w notatkach i kategoriach', searchEmptyTitle: 'Nic nie znaleziono', searchEmptySub: 'Spróbuj innego słowa',
    deleteAria: 'Usuń wpis', entryMenuAria: 'Działania na wpisie', menuEdit: 'Edytuj', menuDelete: 'Usuń', toggleCatAria: 'Pokaż/ukryj kategorię', rateAsOf: 'kurs NBU na', rateUnavailable: 'kurs niedostępny offline', rateStaleSuffix: 'może być nieaktualny', statsSettingsTitle: 'Ustawienia statystyk', statsSettingsChartsLabel: 'Widoczne wykresy', savingsSettingsTitle: 'Ustawienia oszczędności', showSavingsTotalLabel: 'Pokazuj łączne saldo oszczędności', savingsTotalModeLabel: 'Łączne saldo — waluta', savingsTotalModeMulti: 'Kilka walut', savingsTotalModeSingle: 'Jedna waluta', notesSettingsTitle: 'Ustawienia notatek', notesSortLabel: 'Sortowanie', notesSortUpdated: 'Najpierw ostatnio zaktualizowane', notesSortCreated: 'Najpierw ostatnio utworzone', notesSortTitle: 'Według nazwy (A-Z)', showNoteSnippetLabel: 'Pokazuj tekst notatki na liście', passwordHint: 'Minimum 6 znaków',
    statsCatTitle: 'Wydatki wg kategorii', statsNoExpenses: 'Brak wydatków w tym miesiącu',
    statsTrendTitle: 'Przychody i wydatki', statsTrendSub: 'Ostatnie 6 miesięcy', lastLabel: 'Ostatnie',
    chartIncome: 'Przychód', chartExpense: 'Wydatki',
    fabExpense: 'Wydatek', fabIncome: 'Przychód',
    newExpenseTitle: 'Nowy wydatek', newIncomeTitle: 'Nowy przychód', editExpenseTitle: 'Edytuj wydatek', editIncomeTitle: 'Edytuj przychód',
    amountLabel: 'Kwota, {symbol}', amountLabelPlain: 'Kwota', catLabel: 'Kategoria', dateLabel: 'Data',
    noteLabel: 'Notatka (opcjonalnie)', notePlaceholder: 'Np. kawa ze znajomym',
    saveBtn: 'Zapisz wpis', amountError: 'Wpisz kwotę większą od zera',
    saveError: 'Nie udało się zapisać. Sprawdź połączenie z internetem',
    confirmTitle: 'Usunąć wpis?', confirmSub: 'Tej czynności nie można cofnąć.', confirmTitleLogout: 'Wylogować się?', confirmSubLogout: 'Aby zobaczyć swoje dane, trzeba będzie zalogować się ponownie.',
    cancelBtn: 'Anuluj', deleteBtn: 'Usuń',
    settingsTitle: 'Ustawienia', themeLabel: 'Motyw', themeLight: 'Jasny', themeDark: 'Ciemny', themeSystem: 'Jak w systemie',
    langLabel: 'Język', currencyLabel: 'Waluta', categoriesTitle: 'Kategorie',
    expenseCatManageLabel: 'Kategorie wydatków', incomeCatManageLabel: 'Kategorie przychodów',
    newCatPlaceholder: 'Nowa kategoria', addCatAria: 'Dodaj kategorię', deleteCatAria: 'Usuń kategorię',
    catLastError: 'Musi zostać przynajmniej jedna kategoria',
    catDuplicateError: 'Kategoria o takiej nazwie już istnieje',
    catInUseConfirm: 'Ta kategoria jest używana w {count} wpisach. Zostaną przeniesione do innej kategorii. Usunąć ją?',
    chooseFileBtn: 'Wybierz plik',
    exportDataLabel: 'Dane',
    exportDataDesc: 'Pobierze plik ze wszystkimi wpisami, kategoriami, oszczędnościami i notatkami.',
    exportDataError: 'Nie udało się przygotować eksportu. Spróbuj ponownie.',
    exportXlsxBtn: 'Eksportuj do Excela (.xlsx)',
    exportXlsxSheetTx: 'Transakcje', exportXlsxSheetSavings: 'Oszczędności', exportXlsxSheetGoals: 'Cele oszczędnościowe',
    exportXlsxSheetNotes: 'Notatki', exportXlsxSheetCats: 'Kategorie',
    exportXlsxColDate: 'Data', exportXlsxColType: 'Typ', exportXlsxColCategory: 'Kategoria', exportXlsxColAmount: 'Kwota',
    exportXlsxColCurrency: 'Waluta', exportXlsxColNote: 'Notatka', exportXlsxColGoal: 'Cel', exportXlsxColName: 'Nazwa',
    exportXlsxColCreated: 'Utworzono', exportXlsxColUpdated: 'Zaktualizowano', exportXlsxColTitle: 'Tytuł', exportXlsxColContent: 'Treść',
    exportXlsxTypeExpense: 'Wydatek', exportXlsxTypeIncome: 'Przychód', exportXlsxTypeDeposit: 'Wpłata', exportXlsxTypeWithdraw: 'Wypłata',
    importCsvBtn: 'Importuj transakcje z CSV', importDataDesc: 'Kolumny: data (RRRR-MM-DD), typ (przychód/wydatek), kategoria, kwota, notatka.',
    importConfirm: 'Znaleziono wierszy: {total}. Zostanie dodanych wpisów: {ok}, nowych kategorii: {newCats}. Pominięto z powodu błędów: {skipped}. Kontynuować?',
    importSuccess: 'Zaimportowano wpisów: {count}', importNoValidRows: 'W pliku nie znaleziono żadnego poprawnego wiersza',
    importParseError: 'Nie udało się odczytać pliku. Sprawdź, czy to poprawny plik CSV.',
  },
  en: {
    appTitle: 'Life',
    authTitleLogin: 'Log in', authTitleSignup: 'Sign up',
    authSub: 'Log in so your data syncs across your devices.',
    emailLabel: 'Email', passwordLabel: 'Password',
    loginBtn: 'Log in', signupBtn: 'Sign up', waitBtn: 'Please wait…',
    switchToSignup: "Don't have an account?", switchToLogin: 'Already have an account?',
    fillBoth: 'Fill in email and password',
    err_invalidEmail: 'Invalid email', err_missingPassword: 'Enter a password',
    err_weakPassword: 'Password too short (min. 6 characters)',
    err_emailInUse: 'This email is already registered. Try logging in',
    err_invalidCred: 'Incorrect email or password', err_userNotFound: 'No account found with this email',
    err_tooMany: 'Too many attempts. Try again later', err_generic: 'Something went wrong. Try again',
    rememberMe: 'Remember me', forgotPassword: 'Forgot password?',
    enterEmailFirst: 'Enter your email first',
    resetSent: 'Password reset email sent to {email}',
    err_resetFailed: 'Could not send the email. Check the address and try again',
    balanceLabel: 'Funds', logout: 'Log out',
    incomeMonthLabel: 'Income this month', expenseMonthLabel: 'Expenses this month',
    tabEntries: 'Funds', tabStats: 'Stats', tabPages: 'Notes', tabSavings: 'Savings', savingsBalanceLabel: 'Savings balance', savingsEmptySub: 'Add your first entry using the button below', fabDepositLabel: 'Deposit', fabWithdrawLabel: 'Withdraw', newDepositTitle: 'Deposit', newWithdrawTitle: 'Withdrawal', editDepositTitle: 'Edit deposit', editWithdrawTitle: 'Edit withdrawal', savingsTotalLabel: 'Total balance', addGoalLabel: 'New goal', goalFormTitleNew: 'New goal', goalFormTitleEdit: 'Edit goal', goalNameLabel: 'Name', goalNamePlaceholder: 'E.g. Vacation fund', goalNameError: 'Enter a goal name', deleteGoalLabel: 'Delete goal', confirmTitleGoal: 'Delete goal?', confirmSubGoal: 'All entries in this goal will be deleted too.', defaultGoalName: 'General savings', savingsTrendTitle: 'Savings', savingsTrendSub: 'Trend over 6 months', savingsTrendEmpty: 'No savings yet',
    prevMonthAria: 'Previous month', nextMonthAria: 'Next month',
    newPageBtn: 'New note', pageTitleLabel: 'Title', pageContentLabel: 'Content', tabNotes: 'Notes', addNoteBtnLabel: 'New note', notesEmptyTitle: 'Nothing here yet', notesEmptySub: 'Add your first note using the button below',
    pageTitlePlaceholder: 'E.g. Vacation ideas', pageContentPlaceholder: 'Write anything here…',
    editPageTitle: 'Edit note', newPageTitle: 'New note',
    savePageBtn: 'Save', deletePageBtn: 'Delete',
    pageEmptyTitle: 'No pages yet', pageEmptySub: 'Create your first one with the button below',
    pageError: 'Enter a note title', pageSaveError: 'Could not save. Check your internet connection',
    confirmTitlePage: 'Delete page?',
    pageNoTitle: 'Untitled',
    emptyTitle: 'Nothing here yet', recentEntriesLabel: 'Recent activity', emptySub: 'Add your first entry using the button below', searchPlaceholder: 'Search notes and categories', searchEmptyTitle: 'Nothing found', searchEmptySub: 'Try a different search term',
    deleteAria: 'Delete entry', entryMenuAria: 'Entry actions', menuEdit: 'Edit', menuDelete: 'Delete', toggleCatAria: 'Show/hide category', rateAsOf: 'NBU rate as of', rateUnavailable: 'rate unavailable offline', rateStaleSuffix: 'may be outdated', statsSettingsTitle: 'Statistics settings', statsSettingsChartsLabel: 'Visible charts', savingsSettingsTitle: 'Savings settings', showSavingsTotalLabel: 'Show total savings balance', savingsTotalModeLabel: 'Total balance currency', savingsTotalModeMulti: 'Multiple currencies', savingsTotalModeSingle: 'Single currency', notesSettingsTitle: 'Notes settings', notesSortLabel: 'Sort by', notesSortUpdated: 'Recently updated first', notesSortCreated: 'Recently created first', notesSortTitle: 'By title (A-Z)', showNoteSnippetLabel: 'Show note text in list', passwordHint: 'At least 6 characters',
    statsCatTitle: 'Expenses by category', statsNoExpenses: 'No expenses this month',
    statsTrendTitle: 'Income & expenses', statsTrendSub: 'Last 6 months', lastLabel: 'Last',
    chartIncome: 'Income', chartExpense: 'Expenses',
    fabExpense: 'Expense', fabIncome: 'Income',
    newExpenseTitle: 'New expense', newIncomeTitle: 'New income', editExpenseTitle: 'Edit expense', editIncomeTitle: 'Edit income',
    amountLabel: 'Amount, {symbol}', amountLabelPlain: 'Amount', catLabel: 'Category', dateLabel: 'Date',
    noteLabel: 'Note (optional)', notePlaceholder: 'E.g. coffee with a friend',
    saveBtn: 'Save entry', amountError: 'Enter an amount greater than zero',
    saveError: 'Could not save. Check your internet connection',
    confirmTitle: 'Delete entry?', confirmSub: 'This action cannot be undone.', confirmTitleLogout: 'Log out?', confirmSubLogout: "You'll need to sign in again to see your data.",
    cancelBtn: 'Cancel', deleteBtn: 'Delete',
    settingsTitle: 'Settings', themeLabel: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System',
    langLabel: 'Language', currencyLabel: 'Currency', categoriesTitle: 'Categories',
    expenseCatManageLabel: 'Expense categories', incomeCatManageLabel: 'Income categories',
    newCatPlaceholder: 'New category', addCatAria: 'Add category', deleteCatAria: 'Delete category',
    catLastError: 'At least one category must remain',
    catDuplicateError: 'A category with this name already exists',
    catInUseConfirm: 'This category is used in {count} entries. They will be moved to another category. Delete it anyway?',
    chooseFileBtn: 'Choose file',
    exportDataLabel: 'Data',
    exportDataDesc: 'Downloads a file with all your entries, categories, savings, and notes.',
    exportDataError: 'Could not prepare the export. Please try again.',
    exportXlsxBtn: 'Export to Excel (.xlsx)',
    exportXlsxSheetTx: 'Transactions', exportXlsxSheetSavings: 'Savings', exportXlsxSheetGoals: 'Savings goals',
    exportXlsxSheetNotes: 'Notes', exportXlsxSheetCats: 'Categories',
    exportXlsxColDate: 'Date', exportXlsxColType: 'Type', exportXlsxColCategory: 'Category', exportXlsxColAmount: 'Amount',
    exportXlsxColCurrency: 'Currency', exportXlsxColNote: 'Note', exportXlsxColGoal: 'Goal', exportXlsxColName: 'Name',
    exportXlsxColCreated: 'Created', exportXlsxColUpdated: 'Updated', exportXlsxColTitle: 'Title', exportXlsxColContent: 'Content',
    exportXlsxTypeExpense: 'Expense', exportXlsxTypeIncome: 'Income', exportXlsxTypeDeposit: 'Deposit', exportXlsxTypeWithdraw: 'Withdrawal',
    importCsvBtn: 'Import transactions from CSV', importDataDesc: 'Columns: date (YYYY-MM-DD), type (income/expense), category, amount, note.',
    importConfirm: 'Found rows: {total}. Will add entries: {ok}, new categories: {newCats}. Skipped due to errors: {skipped}. Continue?',
    importSuccess: 'Imported entries: {count}', importNoValidRows: 'No valid rows found in the file',
    importParseError: 'Could not read the file. Make sure it is a valid CSV.',
  },
};

function t(key, vars) {
  let s = (T[currentLang] && T[currentLang][key]) || T.uk[key] || key;
  if (vars) Object.keys(vars).forEach(k => { s = s.replace(`{${k}}`, vars[k]); });
  return s;
}

// ---- Категорії (базові набори + користувацькі, зберігаються в профілі користувача) ----
const EXPENSE_CATEGORY_IDS = ['food', 'transport', 'housing', 'fun', 'health', 'clothes', 'other'];
const INCOME_CATEGORY_IDS = ['salary', 'freelance', 'gift', 'other'];
const CAT_LABELS = {
  uk: { food: 'Їжа', transport: 'Транспорт', housing: 'Житло', fun: 'Розваги', health: 'Здоров\u2019я', clothes: 'Одяг', other: 'Інше', salary: 'Зарплата', freelance: 'Фріланс', gift: 'Подарунок' },
  ru: { food: 'Еда', transport: 'Транспорт', housing: 'Жильё', fun: 'Развлечения', health: 'Здоровье', clothes: 'Одежда', other: 'Другое', salary: 'Зарплата', freelance: 'Фриланс', gift: 'Подарок' },
  pl: { food: 'Jedzenie', transport: 'Transport', housing: 'Mieszkanie', fun: 'Rozrywka', health: 'Zdrowie', clothes: 'Ubrania', other: 'Inne', salary: 'Wypłata', freelance: 'Freelance', gift: 'Prezent' },
  en: { food: 'Food', transport: 'Transport', housing: 'Housing', fun: 'Fun', health: 'Health', clothes: 'Clothes', other: 'Other', salary: 'Salary', freelance: 'Freelance', gift: 'Gift' },
};

const CATEGORY_PALETTE = [
  { text: '#3E7C59', bg: '#EAF5EF' },
  { text: '#3D6E9E', bg: '#EAF1F8' },
  { text: '#A8792B', bg: '#FBF3E7' },
  { text: '#B6584A', bg: '#FBEEEC' },
  { text: '#7A5C9E', bg: '#F3EFF8' },
  { text: '#4C7A83', bg: '#EAF3F4' },
  { text: '#8A6A45', bg: '#F6F0E9' },
  { text: '#5B7A9D', bg: '#EAF0F5' },
];

function defaultCategories(type) {
  const ids = type === 'income' ? INCOME_CATEGORY_IDS : EXPENSE_CATEGORY_IDS;
  return ids.map((id, i) => ({ id, label: (CAT_LABELS[currentLang] && CAT_LABELS[currentLang][id]) || id, colorIndex: i % CATEGORY_PALETTE.length }));
}

function findCategory(type, id) {
  const list = type === 'income' ? categoriesIncome : categoriesExpense;
  return list.find(c => c.id === id);
}
function catLabel(type, id) {
  const c = findCategory(type, id);
  return c ? c.label : id;
}
function catPair(type, id) {
  const c = findCategory(type, id);
  if (c && typeof c.colorIndex === 'number') return CATEGORY_PALETTE[c.colorIndex % CATEGORY_PALETTE.length];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length];
}
function catColor(type, id) { return catPair(type, id).text; }
function catDisplay(type, id) { return catLabel(type, id); }

// ---- Місяці ----
const MONTHS_NOM = {
  uk: ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],
  ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
  pl: ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
};
const MONTHS_GEN = {
  uk: ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'],
  ru: ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
  pl: ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
};

// ---- Валюта ----
const CURRENCIES = {
  UAH: { symbol: '\u20B4', position: 'after' },
  USD: { symbol: '$', position: 'before' },
  EUR: { symbol: '\u20AC', position: 'after' },
  PLN: { symbol: 'zł', position: 'after' },
};
const CURRENCY_CODES = ['UAH', 'USD', 'EUR', 'PLN'];

// ---- Курси валют (НБУ, база — гривня) ----
let exchangeRates = { UAH: 1 };
let exchangeRatesDate = null;
try {
  const cachedRates = JSON.parse(localStorage.getItem('financeAppExchangeRates') || 'null');
  if (cachedRates && cachedRates.rates) {
    exchangeRates = cachedRates.rates;
    exchangeRatesDate = cachedRates.date;
  }
} catch (e) { /* ignore corrupted cache */ }

// Чи знаємо ми реальний курс цієї валюти (UAH завжди базова = 1).
function hasRate(cur) {
  return cur === 'UAH' || typeof exchangeRates[cur] === 'number';
}
// Повертає null, якщо курс однієї з валют невідомий, замість того щоб мовчки
// рахувати 1:1 (раніше це показувало явно неправильну суму без попередження).
function convertAmount(amount, fromCur, toCur) {
  if (fromCur === toCur) return amount;
  if (!hasRate(fromCur) || !hasRate(toCur)) return null;
  const from = exchangeRates[fromCur] || 1;
  const to = exchangeRates[toCur] || 1;
  return amount * from / to;
}

// Слова для розпізнавання типу транзакції в CSV незалежно від того, якою
// мовою підписані колонки (працює завжди, а не лише для поточної мови UI).
const IMPORT_EXPENSE_WORDS = ['витрата', 'витрати', 'expense', 'расход', 'расходы', 'wydatek', 'wydatki'];
const IMPORT_INCOME_WORDS = ['дохід', 'доход', 'доходи', 'income', 'приход', 'przychod', 'przychód'];

// Мінімальний, залежностей-незалежний CSV-парсер: підтримує кому й крапку з
// комою як роздільник (визначається автоматично за заголовком), лапки для
// полів з комами/переносами рядків, і "" як екранування лапки всередині поля.
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length) ? ';' : ',';
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

// Знаходить індекс колонки за списком можливих назв заголовка (без
// урахування регістру та мови).
function findColumn(header, names) {
  const norm = header.map(h => h.trim().toLowerCase());
  for (const name of names) {
    const idx = norm.indexOf(name);
    if (idx !== -1) return idx;
  }
  return -1;
}

function normalizeImportDate(raw) {
  raw = (raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function normalizeImportAmount(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/\s/g, '').replace(/,/g, '.').replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n) || n === 0) return null;
  return Math.abs(n);
}

function normalizeImportType(raw, amountRaw) {
  const v = (raw || '').trim().toLowerCase();
  if (v === 'income' || IMPORT_INCOME_WORDS.includes(v)) return 'income';
  if (v === 'expense' || IMPORT_EXPENSE_WORDS.includes(v)) return 'expense';
  if (!v && amountRaw != null) {
    const n = parseFloat(String(amountRaw).replace(/\s/g, '').replace(/,/g, '.'));
    if (!isNaN(n)) return n < 0 ? 'expense' : 'income';
  }
  return null;
}

// Читає файл CSV, показує підсумок і після підтвердження масово додає
// транзакції (і, за потреби, нові категорії) у Firestore.
async function importTransactionsFromCsv(file) {
  let text;
  try {
    text = await file.text();
  } catch (e) {
    alert(t('importParseError'));
    return;
  }
  let rows;
  try {
    rows = parseCsv(text);
  } catch (e) {
    alert(t('importParseError'));
    return;
  }
  if (rows.length < 2) { alert(t('importNoValidRows')); return; }

  const header = rows[0];
  const dateIdx = findColumn(header, ['дата', 'date', 'data']);
  const typeIdx = findColumn(header, ['тип', 'type', 'typ']);
  const catIdx = findColumn(header, ['категорія', 'категория', 'category', 'kategoria']);
  const amountIdx = findColumn(header, ['сума', 'сумма', 'amount', 'kwota']);
  const noteIdx = findColumn(header, ['нотатка', 'заметка', 'note', 'notatka']);
  if (dateIdx === -1 || amountIdx === -1) { alert(t('importParseError')); return; }

  // Робочі копії списків категорій — нові категорії з файлу додаємо сюди й
  // зберігаємо одним записом у профіль, замість одного запису на категорію.
  const workingCats = { expense: categoriesExpense.map(c => ({ ...c })), income: categoriesIncome.map(c => ({ ...c })) };
  const newCatsCount = { expense: 0, income: 0 };

  function resolveCategoryId(type, label) {
    label = (label || '').trim();
    const list = workingCats[type];
    if (!label) return list[0] ? list[0].id : null;
    const existing = list.find(c => c.label.trim().toLowerCase() === label.toLowerCase());
    if (existing) return existing.id;
    const usedColors = list.map(c => c.colorIndex);
    let colorIndex = list.length % CATEGORY_PALETTE.length;
    for (let i = 0; i < CATEGORY_PALETTE.length; i++) { if (!usedColors.includes(i)) { colorIndex = i; break; } }
    const id = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + list.length;
    list.push({ id, label, colorIndex });
    newCatsCount[type]++;
    return id;
  }

  const toImport = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const date = normalizeImportDate(r[dateIdx]);
    const amount = normalizeImportAmount(r[amountIdx]);
    const type = normalizeImportType(typeIdx !== -1 ? r[typeIdx] : null, r[amountIdx]);
    if (!date || !amount || !type) { skipped++; continue; }
    const categoryLabel = catIdx !== -1 ? r[catIdx] : '';
    const category = resolveCategoryId(type, categoryLabel);
    if (!category) { skipped++; continue; }
    const note = (noteIdx !== -1 ? r[noteIdx] : '') || '';
    toImport.push({ type, amount, category, note: note.slice(0, 2000), date });
  }

  if (!toImport.length) { alert(t('importNoValidRows')); return; }

  const totalNewCats = newCatsCount.expense + newCatsCount.income;
  const proceed = confirm(t('importConfirm', { total: rows.length - 1, ok: toImport.length, newCats: totalNewCats, skipped }));
  if (!proceed) return;

  try {
    const uid = auth.currentUser.uid;
    if (newCatsCount.expense) await saveCategoriesList('expense', workingCats.expense);
    if (newCatsCount.income) await saveCategoriesList('income', workingCats.income);

    // Firestore дозволяє максимум 500 операцій в одному batch — ріжемо на
    // шматки по 400, щоб мати запас.
    const col = db.collection('users').doc(uid).collection('transactions');
    for (let i = 0; i < toImport.length; i += 400) {
      const batch = db.batch();
      toImport.slice(i, i + 400).forEach(tx => batch.set(col.doc(), tx));
      await batch.commit();
    }
    alert(t('importSuccess', { count: toImport.length }));
  } catch (e) {
    console.error('CSV import failed', e);
    alert(t('importParseError'));
  }
}


// Курс НБУ кешується локально і може лежати без оновлення довго, якщо
// застосунок офлайн. Позначаємо як "застарілий", коли кешу більше 2 днів,
// щоб не вводити в оману сумами, порахованими за старим курсом.
function isRateStale() {
  if (!exchangeRatesDate) return false;
  const parts = String(exchangeRatesDate).split('.');
  const d = parts.length === 3
    ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
    : new Date(exchangeRatesDate);
  if (isNaN(d)) return false;
  return (Date.now() - d.getTime()) / 86400000 > 2;
}

async function loadExchangeRates() {
  try {
    const resp = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
    if (!resp.ok) throw new Error('bad response');
    const data = await resp.json();
    const rates = { UAH: 1 };
    data.forEach(item => {
      if (CURRENCY_CODES.includes(item.cc) && item.rate) rates[item.cc] = item.rate;
    });
    exchangeRates = rates;
    exchangeRatesDate = (data[0] && data[0].exchangedate) || todayISO();
    localStorage.setItem('financeAppExchangeRates', JSON.stringify({ rates: exchangeRates, date: exchangeRatesDate }));
  } catch (e) {
    // офлайн або недоступний НБУ — залишаємось на кешованих курсах
  }
  if (currentTab === 'stats') render();
}

// ---- Стан ----
let currentLang = (localStorage.getItem('financeAppLang')) || 'uk';
let currentCurrency = (localStorage.getItem('financeAppCurrency')) || 'UAH';
if (!LANGS.includes(currentLang)) currentLang = 'uk';
if (!CURRENCY_CODES.includes(currentCurrency)) currentCurrency = 'UAH';

// ---- Тема (світла / темна / як в системі) ----
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
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#1C1B18' : '#FAF8F4');
}
// Chart.js приймає лише готові значення кольорів (не CSS var()), тож читаємо
// поточне значення змінної теми напряму з обчислених стилів документа.
function themeVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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
  // Кольори на графіках Chart.js обчислюються на момент побудови, тож при
  // зміні теми їх треба перемалювати, інакше лишаться кольори старої теми.
  refreshChartsForTheme();
}
// Коли обрано "як в системі" — стежимо за зміною системної теми наживо,
// без потреби перезавантажувати сторінку.
darkMediaQuery.addEventListener('change', () => { if (themeChoice === 'system') { applyTheme(); refreshChartsForTheme(); } });
function refreshChartsForTheme() {
  if (currentTab === 'stats') render();
  else if (currentTab === 'savings') renderSavings();
}
applyTheme();

let savingsTrendCurrency = localStorage.getItem('financeAppSavingsTrendCurrency') || currentCurrency;
if (!CURRENCY_CODES.includes(savingsTrendCurrency)) savingsTrendCurrency = 'UAH';

let transactions = [];
let monthOffset = 0;
let currentTab = 'entries';
let searchQuery = '';
let trendPeriodMonths = 6;
let savingsTrendPeriodMonths = 6;
let hiddenStatsCategories = [];
try { hiddenStatsCategories = JSON.parse(localStorage.getItem('financeAppHiddenStatsCats') || '[]'); } catch (e) { hiddenStatsCategories = []; }
let hiddenSavingsTrendGoals = [];
try { hiddenSavingsTrendGoals = JSON.parse(localStorage.getItem('financeAppHiddenSavingsGoals') || '[]'); } catch (e) { hiddenSavingsTrendGoals = []; }
let showChartPie = localStorage.getItem('financeAppShowChartPie') !== '0';
let notesSortMode = localStorage.getItem('financeAppNotesSortMode') || 'updated';
if (!['updated', 'created', 'title'].includes(notesSortMode)) notesSortMode = 'updated';
let showNoteSnippet = localStorage.getItem('financeAppShowNoteSnippet') !== '0';
let showChartTrend = localStorage.getItem('financeAppShowChartTrend') !== '0';
let showChartSavings = localStorage.getItem('financeAppShowChartSavings') !== '0';
let showSavingsTotal = localStorage.getItem('financeAppShowSavingsTotal') !== '0';
let savingsTotalMode = localStorage.getItem('financeAppSavingsTotalMode') || 'multi';
if (!['multi', 'single'].includes(savingsTotalMode)) savingsTotalMode = 'multi';
let savingsTotalCurrency = localStorage.getItem('financeAppSavingsTotalCurrency') || currentCurrency;
if (!CURRENCY_CODES.includes(savingsTotalCurrency)) savingsTotalCurrency = 'UAH';
const MONTHS_WORD = {
  uk: { 3: 'місяці', 6: 'місяців', 12: 'місяців', 24: 'місяці', 36: 'місяців' },
  ru: { 3: 'месяца', 6: 'месяцев', 12: 'месяцев', 24: 'месяца', 36: 'месяцев' },
  pl: { 3: 'miesiące', 6: 'miesięcy', 12: 'miesięcy', 24: 'miesiące', 36: 'miesięcy' },
  en: { 3: 'months', 6: 'months', 12: 'months', 24: 'months', 36: 'months' },
};
let formType = 'expense';
let categoriesExpense = defaultCategories('expense');
let categoriesIncome = defaultCategories('income');
let usingDefaultCategories = { expense: true, income: true };
let selectedCategory = categoriesExpense[0] ? categoriesExpense[0].id : null;
let pendingDeleteId = null;
let pendingDeleteType = 'entry'; // 'entry' | 'page' | 'saving' | 'goal' | 'logout' | 'account'
let entryMenuTxId = null;
let editingTxId = null;
let pages = [];
let unsubscribePages = null;
let savings = [];
let unsubscribeSavings = null;
let savingsFormType = 'deposit';
let savingsFormCurrency = 'UAH';
let editingSavingId = null;
let savingsGoals = [];
let unsubscribeSavingsGoals = null;
let currentSavingsGoalId = null;
let editingGoalId = null;
let savingsDataLoaded = false;
let goalsDataLoaded = false;
let migrationDone = false;
let entryMenuKind = 'tx'; // 'tx' | 'saving'
let currentPageId = null; // page being edited, null = new page
let pageOriginTab = 'entries'; // where to return to when leaving a page view
let pieChart = null, barChart = null, savingsTrendChart = null;
let unsubscribeSnapshot = null;
let unsubscribeProfile = null;
let authMode = 'login'; // 'login' | 'signup'

// ---- Утиліти ----
function formatMoney(n) {
  return formatMoneyCur(n, currentCurrency);
}
function formatMoneyCur(n, curCode) {
  const sign = n < 0 ? '\u2212' : '';
  const cur = CURRENCIES[curCode] || CURRENCIES[currentCurrency] || CURRENCIES.UAH;
  const num = Math.abs(n).toLocaleString(LOCALE_MAP[currentLang] || 'uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cur.position === 'before' ? `${sign}${cur.symbol}${num}` : `${sign}${num} ${cur.symbol}`;
}
function renderBalanceBlock(el, balancesObj) {
  const entries = Object.entries(balancesObj).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length <= 1) {
    const cur = entries.length ? entries[0][0] : currentCurrency;
    const val = entries.length ? entries[0][1] : 0;
    el.className = 'balance' + (val < 0 ? ' neg' : '');
    el.textContent = formatMoneyCur(val, cur);
  } else {
    el.className = 'balance balance-multi';
    el.innerHTML = entries.map(([cur, val]) => `<div class="balance-multi-row${val < 0 ? ' neg' : ''}">${formatMoneyCur(val, cur)}</div>`).join('');
  }
}
function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}
// Парсить дату у форматі "YYYY-MM-DD" як ЛОКАЛЬНУ дату (без часу).
// На відміну від `new Date("YYYY-MM-DD")`, який трактує рядок як UTC-північ
// і в поясах з від'ємним зсувом (Америка тощо) зсуває дату на день назад
// після конвертації в локальний час — це ламало групування за датою/місяцем.
function parseISODate(s) {
  if (!s) return new Date(NaN);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ---- Переклад статичних елементів ----
function applyStaticTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  document.title = t('appTitle');
  document.getElementById('authSub').textContent = t('authSub');
  document.getElementById('authEmailLabel').textContent = t('emailLabel');
  document.getElementById('authPasswordLabel').textContent = t('passwordLabel');
  document.getElementById('rememberMeLabel').textContent = t('rememberMe');
  document.getElementById('forgotPasswordLink').textContent = t('forgotPassword');
  setAuthMode(authMode);
  document.getElementById('logoutLabel').textContent = t('logout');
  document.getElementById('incomeLabel').textContent = t('incomeMonthLabel');
  document.getElementById('expenseLabel').textContent = t('expenseMonthLabel');
  document.getElementById('tabEntriesLabel').textContent = t('tabEntries');
  document.getElementById('topbarBrandLabel').textContent = t('appTitle');
  document.getElementById('settingsMenuLabel').textContent = t('settingsTitle');
  document.getElementById('pageTitleLabel').textContent = t('pageTitleLabel');
  document.getElementById('pageContentLabel').textContent = t('pageContentLabel');
  document.getElementById('pageTitleInput').placeholder = t('pageTitlePlaceholder');
  document.getElementById('pageContentInput').setAttribute('data-placeholder', t('pageContentPlaceholder'));
  document.getElementById('savePageBtn').textContent = t('savePageBtn');
  document.getElementById('deletePageBtn').textContent = t('deletePageBtn');
  document.getElementById('prevMonth').setAttribute('aria-label', t('prevMonthAria'));
  document.getElementById('nextMonth').setAttribute('aria-label', t('nextMonthAria'));
  document.getElementById('statsCatTitle').textContent = t('statsCatTitle');
  document.getElementById('pieEmpty').textContent = t('statsNoExpenses');
  document.getElementById('statsTrendTitle').textContent = t('statsTrendTitle');
  document.getElementById('savingsTrendTitle').textContent = t('savingsTrendTitle');
  document.getElementById('savingsTrendSub').textContent = t('savingsTrendSub');
  document.getElementById('savingsTrendEmpty').textContent = t('savingsTrendEmpty');
  document.getElementById('statsTrendSub').textContent = t('statsTrendSub');
  document.getElementById('fabExpLabel').textContent = t('fabExpense');
  document.getElementById('fabIncLabel').textContent = t('fabIncome');
  document.getElementById('catLabel').textContent = t('catLabel');
  document.getElementById('dateLabel').textContent = t('dateLabel');
  document.getElementById('noteLabel').textContent = t('noteLabel');
  document.getElementById('confirmTitle').textContent = t('confirmTitle');
  document.getElementById('confirmSub').textContent = t('confirmSub');
  document.getElementById('cancelDelete').textContent = t('cancelBtn');
  document.getElementById('confirmDelete').textContent = t('deleteBtn');
  document.getElementById('settingsTitle').textContent = t('settingsTitle');
  document.getElementById('categoriesTitle').textContent = t('categoriesTitle');
  document.getElementById('statsToggleBtn').setAttribute('aria-label', t('tabStats'));
  document.getElementById('categoriesBtn').setAttribute('aria-label', t('categoriesTitle'));
  document.getElementById('statsSettingsTitle').textContent = t('statsSettingsTitle');
  document.getElementById('statsSettingsChartsLabel').textContent = t('statsSettingsChartsLabel');
  document.getElementById('showChartPieLabel').textContent = t('statsCatTitle');
  document.getElementById('showChartTrendLabel').textContent = t('statsTrendTitle');
  document.getElementById('showChartSavingsLabel').textContent = t('savingsTrendTitle');
  document.getElementById('savingsSettingsTitle').textContent = t('savingsSettingsTitle');
  document.getElementById('showSavingsTotalToggleLabel').textContent = t('showSavingsTotalLabel');
  document.getElementById('notesSettingsTitle').textContent = t('notesSettingsTitle');
  document.getElementById('notesSortLabel').textContent = t('notesSortLabel');
  document.getElementById('notesSortSelect').innerHTML = `
    <option value="updated">${t('notesSortUpdated')}</option>
    <option value="created">${t('notesSortCreated')}</option>
    <option value="title">${t('notesSortTitle')}</option>`;
  document.getElementById('notesSortSelect').value = notesSortMode;
  document.getElementById('showNoteSnippetToggleLabel').textContent = t('showNoteSnippetLabel');
  document.getElementById('showNoteSnippetToggle').checked = showNoteSnippet;
  document.getElementById('showChartPie').checked = showChartPie;
  document.getElementById('showChartTrend').checked = showChartTrend;
  document.getElementById('showChartSavings').checked = showChartSavings;
  document.getElementById('showSavingsTotalToggle').checked = showSavingsTotal;
  document.getElementById('savingsTotalModeLabel').textContent = t('savingsTotalModeLabel');
  renderSavingsTotalModePicker();
  renderSavingsTotalCurrencySelect();
  document.getElementById('settingsThemeLabel').textContent = t('themeLabel');
  document.getElementById('settingsLangLabel').textContent = t('langLabel');
  document.getElementById('settingsCurrencyLabel').textContent = t('currencyLabel');
  document.getElementById('exportDataLabel').textContent = t('exportDataLabel');
  document.getElementById('exportXlsxBtnLabel').textContent = t('exportXlsxBtn');
  document.getElementById('exportDataDesc').textContent = t('exportDataDesc');
  document.getElementById('importCsvBtnLabel').textContent = t('importCsvBtn');
  document.getElementById('importDataDesc').textContent = t('importDataDesc');
  document.getElementById('searchInput').setAttribute('placeholder', t('searchPlaceholder'));
  document.getElementById('recentHeaderTitle').textContent = t('recentEntriesLabel');
  document.getElementById('expenseCatManageLabel').textContent = t('expenseCatManageLabel');
  document.getElementById('incomeCatManageLabel').textContent = t('incomeCatManageLabel');
  document.getElementById('newExpenseCatInput').placeholder = t('newCatPlaceholder');
  document.getElementById('newIncomeCatInput').placeholder = t('newCatPlaceholder');
  document.getElementById('addExpenseCatBtn').setAttribute('aria-label', t('addCatAria'));
  document.getElementById('addIncomeCatBtn').setAttribute('aria-label', t('addCatAria'));
  const cur = CURRENCIES[currentCurrency] || CURRENCIES.UAH;
  document.getElementById('amountLabel').textContent = t('amountLabel', { symbol: cur.symbol });
  document.getElementById('editEntryLabel').textContent = t('menuEdit');
  document.getElementById('deleteEntryLabel').textContent = t('menuDelete');
  document.getElementById('statsToggleLabel').textContent = t('tabStats');
  document.getElementById('savingsToggleLabel').textContent = t('tabSavings');
  document.getElementById('notesToggleLabel').textContent = t('tabNotes');
  document.getElementById('notesToggleBtn').setAttribute('aria-label', t('tabNotes'));
  document.getElementById('addNoteBtnLabel').textContent = t('addNoteBtnLabel');
  document.getElementById('notesEmptyTitle').textContent = t('notesEmptyTitle');
  document.getElementById('notesEmptySub').textContent = t('notesEmptySub');
  document.getElementById('savingsBalanceLabel').textContent = t('savingsBalanceLabel');
  document.getElementById('savingsTotalLabel').textContent = t('savingsTotalLabel');
  document.getElementById('addGoalLabel').textContent = t('addGoalLabel');
  document.getElementById('goalNameLabel').textContent = t('goalNameLabel');
  document.getElementById('goalNameInput').setAttribute('placeholder', t('goalNamePlaceholder'));
  document.getElementById('deleteGoalBtn').textContent = t('deleteGoalLabel');
  document.getElementById('fabDepositLabel').textContent = t('fabDepositLabel');
  document.getElementById('fabWithdrawLabel').textContent = t('fabWithdrawLabel');
  document.getElementById('savingsAmountLabel').textContent = t('amountLabelPlain');
  document.getElementById('savingsDateLabel').textContent = t('dateLabel');
  document.getElementById('savingsNoteLabel').textContent = t('noteLabel');
  renderLangPicker();
  renderCurrencyPicker();
  renderThemePicker();
  renderSavingsTrendCurrencySelect();
  renderCategoryManager();
  renderAuthLangRow();
  if (typeof currentTab !== 'undefined') updateHeaderSectionTitle();
}

function renderAuthLangRow() {
  const row = document.getElementById('authLangRow');
  row.innerHTML = LANGS.map(l => `<button type="button" class="lang-chip${l === currentLang ? ' selected' : ''}" data-lang="${l}">${LANG_NAMES[l]}</button>`).join('');
  row.querySelectorAll('.lang-chip').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
}

function renderLangPicker() {
  const picker = document.getElementById('langPicker');
  picker.innerHTML = LANGS.map(l => `<button type="button" class="cat-choice${l === currentLang ? ' selected' : ''}"
    data-lang="${l}" style="${l === currentLang ? 'background:var(--accent);' : ''}">${LANG_NAMES[l]}</button>`).join('');
  picker.querySelectorAll('.cat-choice').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
}

function renderThemePicker() {
  const picker = document.getElementById('themePicker');
  const options = [
    { key: 'light', label: t('themeLight') },
    { key: 'dark', label: t('themeDark') },
    { key: 'system', label: t('themeSystem') },
  ];
  picker.innerHTML = options.map(o => `<button type="button" class="cat-choice${o.key === themeChoice ? ' selected' : ''}"
    data-theme-choice="${o.key}" style="${o.key === themeChoice ? 'background:var(--accent);' : ''}">${o.label}</button>`).join('');
  picker.querySelectorAll('.cat-choice').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeChoice));
  });
}

function renderCurrencyPicker() {
  const picker = document.getElementById('currencyPicker');
  picker.innerHTML = CURRENCY_CODES.map(c => `<button type="button" class="cat-choice${c === currentCurrency ? ' selected' : ''}"
    data-cur="${c}" style="${c === currentCurrency ? 'background:var(--accent);' : ''}">${c} ${CURRENCIES[c].symbol}</button>`).join('');
  picker.querySelectorAll('.cat-choice').forEach(btn => {
    btn.addEventListener('click', () => setCurrency(btn.dataset.cur));
  });
}

function renderSavingsTrendCurrencySelect() {
  const select = document.getElementById('savingsTrendCurrencySelect');
  if (select.dataset.bound !== '1') {
    select.innerHTML = CURRENCY_CODES.map(c => `<option value="${c}">${c} ${CURRENCIES[c].symbol}</option>`).join('');
    select.addEventListener('change', () => {
      savingsTrendCurrency = select.value;
      localStorage.setItem('financeAppSavingsTrendCurrency', savingsTrendCurrency);
      render();
    });
    select.dataset.bound = '1';
  }
  select.value = savingsTrendCurrency;
}

function renderSavingsTotalModePicker() {
  const picker = document.getElementById('savingsTotalModePicker');
  picker.innerHTML = `
    <button type="button" class="cat-choice${savingsTotalMode === 'multi' ? ' selected' : ''}" data-mode="multi" style="${savingsTotalMode === 'multi' ? 'background:var(--accent);' : ''}">${t('savingsTotalModeMulti')}</button>
    <button type="button" class="cat-choice${savingsTotalMode === 'single' ? ' selected' : ''}" data-mode="single" style="${savingsTotalMode === 'single' ? 'background:var(--accent);' : ''}">${t('savingsTotalModeSingle')}</button>`;
  picker.querySelectorAll('.cat-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      savingsTotalMode = btn.dataset.mode;
      localStorage.setItem('financeAppSavingsTotalMode', savingsTotalMode);
      renderSavingsTotalModePicker();
      renderSavingsGoalsList();
    });
  });
  document.getElementById('savingsTotalCurrencyWrap').style.display = savingsTotalMode === 'single' ? 'block' : 'none';
}

function renderSavingsTotalCurrencySelect() {
  const select = document.getElementById('savingsTotalCurrencySelect');
  if (select.dataset.bound !== '1') {
    select.innerHTML = CURRENCY_CODES.map(c => `<option value="${c}">${c} ${CURRENCIES[c].symbol}</option>`).join('');
    select.addEventListener('change', () => {
      savingsTotalCurrency = select.value;
      localStorage.setItem('financeAppSavingsTotalCurrency', savingsTotalCurrency);
      renderSavingsGoalsList();
    });
    select.dataset.bound = '1';
  }
  select.value = savingsTotalCurrency;
}

function renderCategoryManager() {
  ['expense', 'income'].forEach(type => {
    const list = type === 'income' ? categoriesIncome : categoriesExpense;
    const container = document.getElementById(type === 'income' ? 'incomeCatManageList' : 'expenseCatManageList');
    if (!container) return;
    container.innerHTML = list.map(c => `
      <div class="cat-manage-row">
        <span class="cat-manage-dot" style="background:${CATEGORY_PALETTE[c.colorIndex % CATEGORY_PALETTE.length].text}"></span>
        <input type="text" class="cat-manage-input" value="${escapeHtml(c.label)}" data-id="${c.id}" data-type="${type}">
        <button type="button" class="cat-manage-del" data-id="${c.id}" data-type="${type}" aria-label="${t('deleteCatAria')}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>`).join('');
    container.querySelectorAll('.cat-manage-input').forEach(input => {
      const commit = () => {
        const id = input.dataset.id, ty = input.dataset.type;
        const src = ty === 'income' ? categoriesIncome : categoriesExpense;
        const cat = src.find(c => c.id === id);
        if (!cat) return;
        const val = input.value.trim();
        if (!val || val === cat.label) { input.value = cat.label; return; }
        renameCategory(ty, id, val).catch((err) => {
          input.value = cat.label;
          if (err && err.message === 'duplicate') alert(t('catDuplicateError'));
        });
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    });
    container.querySelectorAll('.cat-manage-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id, ty = btn.dataset.type;
        const src = ty === 'income' ? categoriesIncome : categoriesExpense;
        if (src.length <= 1) { alert(t('catLastError')); return; }
        const used = transactions.filter(tx => tx.type === ty && tx.category === id).length;
        if (used > 0 && !confirm(t('catInUseConfirm', { count: used }))) return;
        try { await deleteCategory(ty, id); } catch (e) {}
      });
    });
  });
}

function addCategoryFromInput(type) {
  const input = document.getElementById(type === 'income' ? 'newIncomeCatInput' : 'newExpenseCatInput');
  const label = input.value.trim();
  if (!label) return;
  addCategory(type, label).then(() => { input.value = ''; }).catch((err) => {
    if (err && err.message === 'duplicate') alert(t('catDuplicateError'));
  });
}

function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem('financeAppLang', lang);
  if (usingDefaultCategories.expense) categoriesExpense = defaultCategories('expense');
  if (usingDefaultCategories.income) categoriesIncome = defaultCategories('income');
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).set({ lang }, { merge: true }).catch(() => {});
  }
  applyStaticTranslations();
  render();
}

function setCurrency(cur) {
  if (!CURRENCY_CODES.includes(cur)) return;
  currentCurrency = cur;
  localStorage.setItem('financeAppCurrency', cur);
  if (auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).set({ currency: cur }, { merge: true }).catch(() => {});
  }
  applyStaticTranslations();
  render();
}

// ---- Автентифікація ----
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
  document.getElementById('authSubmit').textContent = mode === 'login' ? t('loginBtn') : t('signupBtn');
  document.getElementById('authSwitch').innerHTML = mode === 'login'
    ? `${t('switchToSignup')} <a id="authToggle">${t('signupBtn')}</a>`
    : `${t('switchToLogin')} <a id="authToggle">${t('loginBtn')}</a>`;
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authInfo').style.display = 'none';
  const hintEl = document.getElementById('authPasswordHint');
  hintEl.textContent = t('passwordHint');
  hintEl.style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('authPassword').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
  document.getElementById('authToggle').addEventListener('click', () => setAuthMode(mode === 'login' ? 'signup' : 'login'));
}

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
  btn.textContent = t('waitBtn');
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
  } catch (e2) {
    errEl.textContent = authErrorMessage(e2.code);
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? t('loginBtn') : t('signupBtn');
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
    infoEl.textContent = t('resetSent', { email });
    infoEl.style.display = 'block';
  } catch (e) {
    errEl.textContent = e.code === 'auth/invalid-email' ? t('err_invalidEmail')
      : e.code === 'auth/user-not-found' ? t('err_userNotFound')
      : t('err_resetFailed');
    errEl.style.display = 'block';
  } finally {
    link.style.pointerEvents = '';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  document.getElementById('appMenuOverlay').classList.remove('show');
  pendingDeleteId = null;
  pendingDeleteType = 'logout';
  document.getElementById('confirmTitle').textContent = t('confirmTitleLogout');
  document.getElementById('confirmSub').textContent = t('confirmSubLogout');
  document.getElementById('confirmDelete').textContent = t('logout');
  document.getElementById('confirmOverlay').classList.add('show');
});

auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    subscribeToTransactions(user.uid);
    subscribeToProfile(user.uid);
    subscribeToPages(user.uid);
    subscribeToSavings(user.uid);
    subscribeToSavingsGoals(user.uid);
    loadExchangeRates();
  } else {
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
    if (unsubscribePages) { unsubscribePages(); unsubscribePages = null; }
    if (unsubscribeSavings) { unsubscribeSavings(); unsubscribeSavings = null; }
    if (unsubscribeSavingsGoals) { unsubscribeSavingsGoals(); unsubscribeSavingsGoals = null; }
    transactions = [];
    pages = [];
    savings = [];
    savingsGoals = [];
    currentSavingsGoalId = null;
    savingsDataLoaded = false;
    goalsDataLoaded = false;
    migrationDone = false;
    document.getElementById('appScreen').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('authPassword').value = '';
    document.getElementById('authInfo').style.display = 'none';
    const savedEmail = localStorage.getItem('financeAppLastEmail');
    if (savedEmail) {
      document.getElementById('authEmail').value = savedEmail;
      document.getElementById('rememberMe').checked = true;
      setTimeout(() => document.getElementById('authPassword').focus(), 50);
    } else {
      document.getElementById('authEmail').value = '';
      document.getElementById('rememberMe').checked = true;
    }
  }
});

// ---- Дані (Firestore, реалтайм-синхронізація) ----
function subscribeToTransactions(uid) {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  const col = db.collection('users').doc(uid).collection('transactions');
  unsubscribeSnapshot = col.onSnapshot((snapshot) => {
    transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => {
    console.error('Sync error', err);
  });
}

function subscribeToProfile(uid) {
  if (unsubscribeProfile) unsubscribeProfile();
  unsubscribeProfile = db.collection('users').doc(uid).onSnapshot((doc) => {
    const data = doc.data();
    if (!data) return;
    let changed = false;
    if (data.lang && LANGS.includes(data.lang) && data.lang !== currentLang) { currentLang = data.lang; localStorage.setItem('financeAppLang', currentLang); changed = true; }
    if (data.currency && CURRENCY_CODES.includes(data.currency) && data.currency !== currentCurrency) { currentCurrency = data.currency; localStorage.setItem('financeAppCurrency', currentCurrency); changed = true; }
    if (data.theme && THEME_CHOICES.includes(data.theme) && data.theme !== themeChoice) {
      themeChoice = data.theme; localStorage.setItem('financeAppTheme', themeChoice); applyTheme(); changed = true;
    }
    if (Array.isArray(data.categoriesExpense) && data.categoriesExpense.length) {
      categoriesExpense = data.categoriesExpense;
      usingDefaultCategories.expense = false;
      changed = true;
    } else if (usingDefaultCategories.expense) {
      categoriesExpense = defaultCategories('expense');
    }
    if (Array.isArray(data.categoriesIncome) && data.categoriesIncome.length) {
      categoriesIncome = data.categoriesIncome;
      usingDefaultCategories.income = false;
      changed = true;
    } else if (usingDefaultCategories.income) {
      categoriesIncome = defaultCategories('income');
    }
    if (formType === 'expense' && !findCategory('expense', selectedCategory)) selectedCategory = categoriesExpense[0] ? categoriesExpense[0].id : null;
    if (formType === 'income' && !findCategory('income', selectedCategory)) selectedCategory = categoriesIncome[0] ? categoriesIncome[0].id : null;
    if (changed) { applyStaticTranslations(); render(); }
  }, () => {});
}

function addTransactionRemote(tx) {
  const uid = auth.currentUser.uid;
  return db.collection('users').doc(uid).collection('transactions').add(tx);
}
function updateTransactionRemote(id, tx) {
  const uid = auth.currentUser.uid;
  return db.collection('users').doc(uid).collection('transactions').doc(id).update(tx);
}
function deleteTransactionRemote(id) {
  const uid = auth.currentUser.uid;
  return db.collection('users').doc(uid).collection('transactions').doc(id).delete();
}

function subscribeToSavings(uid) {
  if (unsubscribeSavings) unsubscribeSavings();
  const col = db.collection('users').doc(uid).collection('savings');
  unsubscribeSavings = col.onSnapshot((snapshot) => {
    savings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    savingsDataLoaded = true;
    maybeMigrateSavings();
    if (currentTab === 'savings') {
      if (currentSavingsGoalId) renderSavings(); else renderSavingsGoalsList();
    }
  }, (err) => {
    console.error('Savings sync error', err);
  });
}
function subscribeToSavingsGoals(uid) {
  if (unsubscribeSavingsGoals) unsubscribeSavingsGoals();
  const col = db.collection('users').doc(uid).collection('savingsGoals');
  unsubscribeSavingsGoals = col.onSnapshot((snapshot) => {
    savingsGoals = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    goalsDataLoaded = true;
    maybeMigrateSavings();
    if (currentTab === 'savings') {
      if (currentSavingsGoalId) renderSavings(); else renderSavingsGoalsList();
    }
  }, (err) => {
    console.error('Savings goals sync error', err);
  });
}
function maybeMigrateSavings() {
  if (migrationDone || !savingsDataLoaded || !goalsDataLoaded) return;
  const orphaned = savings.filter(sv => !sv.goalId);
  if (orphaned.length === 0) { migrationDone = true; return; }
  migrationDone = true;
  const uid = auth.currentUser.uid;
  db.collection('users').doc(uid).collection('savingsGoals').add({ name: t('defaultGoalName'), createdAt: firebase.firestore.FieldValue.serverTimestamp() })
    .then(ref => {
      const batch = db.batch();
      orphaned.forEach(sv => {
        const docRef = db.collection('users').doc(uid).collection('savings').doc(sv.id);
        batch.update(docRef, { goalId: ref.id });
      });
      return batch.commit();
    })
    .catch(err => console.error('Migration failed', err));
}
function addSavingsGoalRemote(name) {
  const uid = auth.currentUser.uid;
  return db.collection('users').doc(uid).collection('savingsGoals').add({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}
function updateSavingsGoalRemote(id, name) {
  const uid = auth.currentUser.uid;
  return db.collection('users').doc(uid).collection('savingsGoals').doc(id).update({ name });
}
async function deleteSavingsGoalRemote(id) {
  const uid = auth.currentUser.uid;
  const batch = db.batch();
  savings.filter(sv => sv.goalId === id).forEach(sv => {
    batch.delete(db.collection('users').doc(uid).collection('savings').doc(sv.id));
  });
  batch.delete(db.collection('users').doc(uid).collection('savingsGoals').doc(id));
  return batch.commit();
}
function addSavingRemote(item) {
  const uid = auth.currentUser.uid;
  return db.collection('users').doc(uid).collection('savings').add(item);
}
function updateSavingRemote(id, item) {
  const uid = auth.currentUser.uid;
  return db.collection('users').doc(uid).collection('savings').doc(id).update(item);
}
function deleteSavingRemote(id) {
  const uid = auth.currentUser.uid;
  return db.collection('users').doc(uid).collection('savings').doc(id).delete();
}

function saveCategoriesList(type, list) {
  const uid = auth.currentUser.uid;
  const field = type === 'income' ? 'categoriesIncome' : 'categoriesExpense';
  return db.collection('users').doc(uid).set({ [field]: list }, { merge: true });
}
function addCategory(type, label) {
  label = label.trim();
  if (!label) return Promise.resolve();
  const current = type === 'income' ? categoriesIncome : categoriesExpense;
  if (current.some(c => c.label.trim().toLowerCase() === label.toLowerCase())) {
    return Promise.reject(new Error('duplicate'));
  }
  const usedColors = current.map(c => c.colorIndex);
  let colorIndex = current.length % CATEGORY_PALETTE.length;
  for (let i = 0; i < CATEGORY_PALETTE.length; i++) { if (!usedColors.includes(i)) { colorIndex = i; break; } }
  const id = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const list = [...current, { id, label, colorIndex }];
  return saveCategoriesList(type, list);
}
function renameCategory(type, id, label) {
  label = label.trim();
  if (!label) return Promise.resolve();
  const current = type === 'income' ? categoriesIncome : categoriesExpense;
  if (current.some(c => c.id !== id && c.label.trim().toLowerCase() === label.toLowerCase())) {
    return Promise.reject(new Error('duplicate'));
  }
  const list = current.map(c => c.id === id ? { ...c, label } : c);
  return saveCategoriesList(type, list);
}
function deleteCategory(type, id) {
  const current = type === 'income' ? categoriesIncome : categoriesExpense;
  if (current.length <= 1) return Promise.reject(new Error('last'));
  const list = current.filter(c => c.id !== id);
  // Транзакції, що використовували видалену категорію, переносимо на першу
  // з категорій, що залишилися, — інакше вони лишаться з "сирітським" id,
  // який в інтерфейсі показувався б замість людяної назви.
  const fallbackId = list[0].id;
  const affected = transactions.filter(tx => tx.type === type && tx.category === id);
  const uid = auth.currentUser.uid;
  const batch = db.batch();
  affected.forEach(tx => {
    batch.update(db.collection('users').doc(uid).collection('transactions').doc(tx.id), { category: fallbackId });
  });
  return batch.commit().then(() => saveCategoriesList(type, list));
}

// Перетворює Firestore Timestamp / рядок / Date у людський рядок дати-часу.
function formatExportTimestamp(value) {
  if (!value) return '';
  if (typeof value.toDate === 'function') value = value.toDate();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d) ? value : d.toLocaleString();
  }
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
}

// Прибирає HTML-розмітку нотатки, лишаючи тільки текст (для клітинки Excel).
function stripHtmlForExport(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
}

// Формує книгу Excel (.xlsx) з окремими листами для транзакцій, заощаджень,
// цілей, нотаток і категорій. Використовує SheetJS (window.XLSX),
// завантажену з cdnjs — того ж CDN, що вже дозволений у CSP.
function exportAllDataXlsx() {
  try {
    if (typeof XLSX === 'undefined') {
      alert(t('exportDataError'));
      return;
    }
    const wb = XLSX.utils.book_new();

    const txRows = transactions
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(tx => ({
        [t('exportXlsxColDate')]: tx.date || '',
        [t('exportXlsxColType')]: tx.type === 'income' ? t('exportXlsxTypeIncome') : t('exportXlsxTypeExpense'),
        [t('exportXlsxColCategory')]: catLabel(tx.type, tx.category),
        [t('exportXlsxColAmount')]: typeof tx.amount === 'number' ? tx.amount : Number(tx.amount) || 0,
        [t('exportXlsxColNote')]: tx.note || '',
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows), t('exportXlsxSheetTx'));

    const goalNameById = {};
    savingsGoals.forEach(g => { goalNameById[g.id] = g.name || t('defaultGoalName'); });
    const savingsRows = savings
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(sv => ({
        [t('exportXlsxColDate')]: sv.date || '',
        [t('exportXlsxColGoal')]: goalNameById[sv.goalId] || '',
        [t('exportXlsxColType')]: sv.type === 'withdraw' ? t('exportXlsxTypeWithdraw') : t('exportXlsxTypeDeposit'),
        [t('exportXlsxColAmount')]: typeof sv.amount === 'number' ? sv.amount : Number(sv.amount) || 0,
        [t('exportXlsxColCurrency')]: sv.currency || '',
        [t('exportXlsxColNote')]: sv.note || '',
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savingsRows), t('exportXlsxSheetSavings'));

    const goalsRows = savingsGoals.map(g => ({
      [t('exportXlsxColName')]: g.name || t('defaultGoalName'),
      [t('exportXlsxColCreated')]: formatExportTimestamp(g.createdAt),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalsRows), t('exportXlsxSheetGoals'));

    const notesRows = pages.map(p => ({
      [t('exportXlsxColTitle')]: p.title || t('pageNoTitle'),
      [t('exportXlsxColContent')]: stripHtmlForExport(p.content),
      [t('exportXlsxColCreated')]: formatExportTimestamp(p.createdAt),
      [t('exportXlsxColUpdated')]: formatExportTimestamp(p.updatedAt),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notesRows), t('exportXlsxSheetNotes'));

    const catRows = [
      ...categoriesExpense.map(c => ({ [t('exportXlsxColType')]: t('exportXlsxTypeExpense'), [t('exportXlsxColName')]: c.label })),
      ...categoriesIncome.map(c => ({ [t('exportXlsxColType')]: t('exportXlsxTypeIncome'), [t('exportXlsxColName')]: c.label })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), t('exportXlsxSheetCats'));

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `life-backup-${stamp}.xlsx`);
  } catch (err) {
    console.error('XLSX export failed', err);
    alert(t('exportDataError'));
  }
}

// ---- Обчислення на основі поточного місяця ----
function getTargetDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
}

function render() {
  const target = getTargetDate();
  const ty = target.getFullYear(), tm = target.getMonth();
  const nomMonths = MONTHS_NOM[currentLang] || MONTHS_NOM.uk;

  document.getElementById('monthLabel').textContent = `${nomMonths[tm]} ${ty}`;
  document.getElementById('monthLabelHeader').textContent = `${nomMonths[tm]} ${ty}`;
  document.getElementById('statsMonthLabel').textContent = `${nomMonths[tm]} ${ty}`;
  document.getElementById('nextMonth').disabled = monthOffset === 0;
  document.getElementById('nextMonthHeader').disabled = monthOffset === 0;

  const monthTx = transactions.filter(tx => {
    const d = parseISODate(tx.date);
    return d.getFullYear() === ty && d.getMonth() === tm;
  }).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));

  const balance = monthTx.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
  const balEl = document.getElementById('balance');
  balEl.textContent = formatMoney(balance);
  balEl.className = 'balance' + (balance < 0 ? ' neg' : '');

  const monthIncome = monthTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
  const monthExpense = monthTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
  document.getElementById('monthIncome').textContent = formatMoney(monthIncome);
  document.getElementById('monthExpense').textContent = formatMoney(monthExpense);

  const searchResults = searchTransactions(searchQuery);
  renderEntries(searchResults !== null ? searchResults : monthTx, searchResults !== null);
  if (currentTab === 'stats') renderStats(monthTx, ty, tm);
  if (currentTab.startsWith('page:')) renderPageView(currentTab.slice(5));
}

function searchTransactions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return transactions.filter(tx => {
    const note = (tx.note || '').toLowerCase();
    const catLabel = catDisplay(tx.type, tx.category).toLowerCase();
    return note.includes(q) || catLabel.includes(q);
  }).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
}

function renderEntries(monthTx, isSearch) {
  const container = document.getElementById('entriesTab');
  if (monthTx.length === 0) {
    const title = isSearch ? t('searchEmptyTitle') : t('emptyTitle');
    const sub = isSearch ? t('searchEmptySub') : t('emptySub');
    container.innerHTML = `<div class="empty"><div class="title">${title}</div><div>${sub}</div></div>`;
    return;
  }
  const genMonths = MONTHS_GEN[currentLang] || MONTHS_GEN.uk;
  const groups = {};
  monthTx.forEach(tx => { (groups[tx.date] = groups[tx.date] || []).push(tx); });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  container.innerHTML = dates.map(d => {
    const dateObj = parseISODate(d);
    const dayLabel = isSearch
      ? `${dateObj.getDate()} ${genMonths[dateObj.getMonth()]} ${dateObj.getFullYear()}`
      : `${dateObj.getDate()} ${genMonths[dateObj.getMonth()]}`;
    const items = groups[d].map(tx => `
      <div class="entry">
        <span class="cat-tag" style="color:${catPair(tx.type, tx.category).text};background:${catPair(tx.type, tx.category).bg};">${escapeHtml(catDisplay(tx.type, tx.category))}</span>
        <div class="entry-note">${escapeHtml(tx.note || '')}</div>
        <div class="entry-amount ${tx.type === 'income' ? 'inc' : ''}">${tx.type === 'income' ? '+' : '\u2212'}${formatMoney(tx.amount).replace('\u2212', '')}</div>
        <button class="del-btn entry-menu-btn" data-id="${tx.id}" aria-label="${t('entryMenuAria')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
      </div>`).join('');
    return `<div class="day-group"><div class="day-label">${dayLabel}</div><div class="day-card">${items}</div></div>`;
  }).join('');

  container.querySelectorAll('.entry-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEntryMenu(btn, 'tx');
    });
  });
}

function goalBalance(goalId) {
  const res = {};
  savings.filter(sv => sv.goalId === goalId).forEach(sv => {
    const cur = sv.currency || currentCurrency;
    res[cur] = (res[cur] || 0) + (sv.type === 'deposit' ? sv.amount : -sv.amount);
  });
  return res;
}
function totalSavingsBalance() {
  const res = {};
  savings.forEach(sv => {
    const cur = sv.currency || currentCurrency;
    res[cur] = (res[cur] || 0) + (sv.type === 'deposit' ? sv.amount : -sv.amount);
  });
  return res;
}
function lastUsedGoalCurrency(goalId) {
  const goalSavings = savings.filter(sv => sv.goalId === goalId);
  if (goalSavings.length === 0) return currentCurrency;
  const latest = [...goalSavings].sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id))).pop();
  return latest.currency || currentCurrency;
}

function renderSavingsGoalsList() {
  document.getElementById('savingsTotalCard').style.display = showSavingsTotal ? '' : 'none';
  const rateSub = document.getElementById('savingsTotalRateSub');
  if (savingsTotalMode === 'single') {
    const needsConversion = savings.some(sv => (sv.currency || currentCurrency) !== savingsTotalCurrency);
    const rateMissing = savings.some(sv => convertAmount(sv.amount, sv.currency || currentCurrency, savingsTotalCurrency) === null);
    if (rateMissing) {
      // Курс невідомий (офлайн, кеш порожній) — показуємо прочерк замість
      // помилкової суми, порахованої так, ніби всі валюти рівні гривні.
      document.getElementById('savingsTotalBalance').className = 'balance';
      document.getElementById('savingsTotalBalance').textContent = '—';
    } else {
      const totalConverted = savings.reduce((s, sv) => {
        const converted = convertAmount(sv.amount, sv.currency || currentCurrency, savingsTotalCurrency);
        return s + (sv.type === 'deposit' ? converted : -converted);
      }, 0);
      renderBalanceBlock(document.getElementById('savingsTotalBalance'), { [savingsTotalCurrency]: totalConverted });
    }
    if (exchangeRatesDate) {
      rateSub.textContent = isRateStale()
        ? `${t('rateAsOf')} ${exchangeRatesDate} (${t('rateStaleSuffix')})`
        : `${t('rateAsOf')} ${exchangeRatesDate}`;
      rateSub.classList.toggle('stale', isRateStale());
      rateSub.style.display = 'block';
    } else if (needsConversion) {
      rateSub.textContent = t('rateUnavailable');
      rateSub.classList.remove('stale');
      rateSub.style.display = 'block';
    } else {
      rateSub.style.display = 'none';
    }
  } else {
    renderBalanceBlock(document.getElementById('savingsTotalBalance'), totalSavingsBalance());
    rateSub.style.display = 'none';
  }

  const container = document.getElementById('savingsGoalsCards');
  const sorted = [...savingsGoals].sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return ta - tb;
  });
  container.innerHTML = sorted.map(g => {
    const balEntries = Object.entries(goalBalance(g.id)).sort((a, b) => a[0].localeCompare(b[0]));
    const balHtml = balEntries.length <= 1
      ? `<span class="goal-card-balance">${formatMoneyCur(balEntries.length ? balEntries[0][1] : 0, balEntries.length ? balEntries[0][0] : currentCurrency)}</span>`
      : `<span class="goal-card-balances">${balEntries.map(([cur, val]) => `<span class="goal-card-balance">${formatMoneyCur(val, cur)}</span>`).join('')}</span>`;
    return `<button type="button" class="goal-card" data-id="${g.id}">
      <span class="goal-card-name">${escapeHtml(g.name || t('defaultGoalName'))}</span>
      ${balHtml}
    </button>`;
  }).join('');
  container.querySelectorAll('.goal-card').forEach(card => {
    card.addEventListener('click', () => openGoalDetail(card.dataset.id));
  });
}

function openGoalDetail(goalId) {
  currentSavingsGoalId = goalId;
  const goal = savingsGoals.find(g => g.id === goalId);
  document.getElementById('goalDetailTitle').textContent = goal ? (goal.name || t('defaultGoalName')) : '';
  document.getElementById('savingsGoalsList').style.display = 'none';
  document.getElementById('savingsGoalDetail').style.display = 'block';
  document.getElementById('savingsFabRow').style.display = 'flex';
  renderSavings();
}

function backToGoalsList() {
  currentSavingsGoalId = null;
  document.getElementById('savingsGoalDetail').style.display = 'none';
  document.getElementById('savingsGoalsList').style.display = 'block';
  document.getElementById('savingsFabRow').style.display = 'none';
  renderSavingsGoalsList();
}

function openGoalForm(existingGoal) {
  editingGoalId = existingGoal ? existingGoal.id : null;
  document.getElementById('goalFormTitle').textContent = editingGoalId ? t('goalFormTitleEdit') : t('goalFormTitleNew');
  document.getElementById('goalNameInput').value = existingGoal ? (existingGoal.name || '') : '';
  document.getElementById('goalFormError').style.display = 'none';
  document.getElementById('deleteGoalBtn').style.display = editingGoalId ? 'block' : 'none';
  document.getElementById('goalFormOverlay').classList.add('show');
  setTimeout(() => document.getElementById('goalNameInput').focus(), 50);
}

async function submitGoalForm() {
  const name = document.getElementById('goalNameInput').value.trim();
  const errEl = document.getElementById('goalFormError');
  if (!name) {
    errEl.textContent = t('goalNameError');
    errEl.style.display = 'block';
    return;
  }
  const btn = document.getElementById('goalFormSubmitBtn');
  btn.disabled = true;
  try {
    if (editingGoalId) {
      await updateSavingsGoalRemote(editingGoalId, name);
    } else {
      await addSavingsGoalRemote(name);
    }
    editingGoalId = null;
    document.getElementById('goalFormOverlay').classList.remove('show');
  } catch (e) {
    errEl.textContent = t('saveError');
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

function renderSavings() {
  const currentGoal = savingsGoals.find(g => g.id === currentSavingsGoalId);
  document.getElementById('goalDetailTitle').textContent = currentGoal ? (currentGoal.name || t('defaultGoalName')) : '';
  const goalSavings = savings.filter(sv => sv.goalId === currentSavingsGoalId);
  renderBalanceBlock(document.getElementById('savingsBalance'), goalBalance(currentSavingsGoalId));

  const container = document.getElementById('savingsList');
  if (goalSavings.length === 0) {
    container.innerHTML = `<div class="empty"><div class="title">${t('emptyTitle')}</div><div>${t('savingsEmptySub')}</div></div>`;
    return;
  }
  const genMonths = MONTHS_GEN[currentLang] || MONTHS_GEN.uk;
  const groups = {};
  goalSavings.forEach(sv => { (groups[sv.date] = groups[sv.date] || []).push(sv); });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  container.innerHTML = dates.map(d => {
    const dateObj = parseISODate(d);
    const dayLabel = `${dateObj.getDate()} ${genMonths[dateObj.getMonth()]}`;
    const items = [...groups[d]].sort((a, b) => String(b.id).localeCompare(String(a.id))).map(sv => `
      <div class="entry">
        <span class="cat-tag" style="color:${sv.type === 'deposit' ? '#3E7C59' : '#B6584A'};background:${sv.type === 'deposit' ? '#EAF5EF' : '#FBEEEC'};">${sv.type === 'deposit' ? t('fabDepositLabel') : t('fabWithdrawLabel')}</span>
        <div class="entry-note">${escapeHtml(sv.note || '')}</div>
        <div class="entry-amount ${sv.type === 'deposit' ? 'inc' : ''}">${sv.type === 'deposit' ? '+' : '\u2212'}${formatMoneyCur(sv.amount, sv.currency || currentCurrency).replace('\u2212', '')}</div>
        <button class="del-btn entry-menu-btn" data-id="${sv.id}" aria-label="${t('entryMenuAria')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
      </div>`).join('');
    return `<div class="day-group"><div class="day-label">${dayLabel}</div><div class="day-card">${items}</div></div>`;
  }).join('');

  container.querySelectorAll('.entry-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEntryMenu(btn, 'saving');
    });
  });
}

function openSavingsForm(type, existing) {
  savingsFormType = type;
  editingSavingId = existing ? existing.id : null;
  const isEdit = !!existing;
  document.getElementById('savingsModalTitle').textContent = isEdit
    ? (type === 'deposit' ? t('editDepositTitle') : t('editWithdrawTitle'))
    : (type === 'deposit' ? t('newDepositTitle') : t('newWithdrawTitle'));
  document.getElementById('savingsModalTitle').style.color = type === 'deposit' ? 'var(--income)' : 'var(--expense)';
  document.getElementById('savingsSubmitBtn').style.background = type === 'deposit' ? 'var(--income)' : 'var(--expense)';
  document.getElementById('savingsSubmitBtn').textContent = t('saveBtn');
  document.getElementById('savingsAmountInput').value = existing ? String(existing.amount).replace('.', ',') : '';
  document.getElementById('savingsNoteInput').value = existing ? (existing.note || '') : '';
  document.getElementById('savingsDateInput').value = existing ? existing.date : todayISO();
  document.getElementById('savingsDateInput').max = todayISO();
  document.getElementById('savingsFormError').style.display = 'none';
  savingsFormCurrency = existing ? (existing.currency || currentCurrency) : lastUsedGoalCurrency(currentSavingsGoalId);
  renderSavingsCurrencyPicker();
  document.getElementById('savingsFormOverlay').classList.add('show');
  setTimeout(() => document.getElementById('savingsAmountInput').focus(), 50);
}

function renderSavingsCurrencyPicker() {
  const picker = document.getElementById('savingsCurrencyPicker');
  picker.innerHTML = CURRENCY_CODES.map(c => `<button type="button" class="cat-choice${c === savingsFormCurrency ? ' selected' : ''}"
    data-cur="${c}" style="${c === savingsFormCurrency ? 'background:var(--accent);' : ''}">${c} ${CURRENCIES[c].symbol}</button>`).join('');
  picker.querySelectorAll('.cat-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      savingsFormCurrency = btn.dataset.cur;
      renderSavingsCurrencyPicker();
    });
  });
}

async function submitSavingsForm() {
  const input = document.getElementById('savingsAmountInput');
  const num = parseFloat(input.value.replace(',', '.'));
  const errEl = document.getElementById('savingsFormError');
  if (!input.value || isNaN(num) || num <= 0) {
    errEl.textContent = t('amountError');
    errEl.style.display = 'block';
    return;
  }
  const btn = document.getElementById('savingsSubmitBtn');
  btn.disabled = true;
  const item = {
    type: savingsFormType,
    amount: Math.round(num * 100) / 100,
    currency: savingsFormCurrency,
    note: document.getElementById('savingsNoteInput').value.trim(),
    date: document.getElementById('savingsDateInput').value || todayISO(),
    goalId: currentSavingsGoalId,
  };
  try {
    if (editingSavingId) {
      await updateSavingRemote(editingSavingId, item);
    } else {
      await addSavingRemote(item);
    }
    editingSavingId = null;
    document.getElementById('savingsFormOverlay').classList.remove('show');
  } catch (e) {
    errEl.textContent = t('saveError');
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

function openEntryMenu(btn, kind) {
  entryMenuTxId = btn.dataset.id;
  entryMenuKind = kind || 'tx';
  const rect = btn.getBoundingClientRect();
  const overlay = document.getElementById('entryMenuOverlay');
  const menu = document.getElementById('entryMenu');
  overlay.classList.add('show');
  const menuWidth = menu.offsetWidth || 170;
  let left = rect.right - menuWidth;
  if (left < 8) left = 8;
  const maxLeft = window.innerWidth - menuWidth - 8;
  if (left > maxLeft) left = maxLeft;
  let top = rect.bottom + 6;
  const menuHeight = menu.offsetHeight || 100;
  if (top + menuHeight > window.innerHeight - 8) top = rect.top - menuHeight - 6;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function inlineFormat(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// Старий текстовий формат (нотатки, збережені до появи WYSIWYG-редактора) —
// конвертує "# Заголовок", "**жирний**", "- пункт", "[ ] діло" у нормальний HTML.
function legacyNoteToHtml(text) {
  const lines = (text || '').split('\n');
  let html = '';
  let listBuffer = [];
  let listType = null; // 'bullet' | 'checklist'

  function flushList() {
    if (!listBuffer.length) return;
    if (listType === 'checklist') {
      html += listBuffer.map(item => `
        <div class="note-check-row"><input type="checkbox" ${item.checked ? 'checked' : ''}><span${item.checked ? ' class="checked-text"' : ''}>${inlineFormat(item.text)}</span></div>`).join('');
    } else {
      html += '<ul>' + listBuffer.map(item => `<li>${inlineFormat(item.text)}</li>`).join('') + '</ul>';
    }
    listBuffer = [];
    listType = null;
  }

  lines.forEach(line => {
    const checkMatch = line.match(/^\[([ x])\]\s?(.*)$/i);
    const bulletMatch = line.match(/^-\s+(.*)$/);
    const h2Match = line.match(/^##\s+(.*)$/);
    const h1Match = line.match(/^#\s+(.*)$/);

    if (checkMatch) {
      if (listType !== 'checklist') flushList();
      listType = 'checklist';
      listBuffer.push({ checked: checkMatch[1].toLowerCase() === 'x', text: checkMatch[2] });
    } else if (bulletMatch) {
      if (listType !== 'bullet') flushList();
      listType = 'bullet';
      listBuffer.push({ text: bulletMatch[1] });
    } else {
      flushList();
      if (h2Match) html += `<h4>${inlineFormat(h2Match[1])}</h4>`;
      else if (h1Match) html += `<h3>${inlineFormat(h1Match[1])}</h3>`;
      else if (line.trim() === '') html += '';
      else html += `<div>${inlineFormat(line)}</div>`;
    }
  });
  flushList();
  return html;
}

// Стара нотатка зберігалась як звичайний текст, нова — як HTML з редактора.
// Розрізняємо за тим, чи починається вміст з тега.
function noteContentToHtml(content) {
  const c = content || '';
  return sanitizeNoteHtml(/^\s*</.test(c) ? c : legacyNoteToHtml(c));
}

// Санітизація HTML нотаток. Нотатки містять лише простий текст, чекбокси,
// заголовки, списки й жирний шрифт — тому дозволяємо вузький білий список
// тегів/атрибутів і відкидаємо все інше (скрипти, обробники подій, посилання тощо).
// Це захищає від XSS, якщо в контент потрапить шкідливий HTML (напр. вставка
// зі буфера обміну, або чужий запис, якщо колись зʼявиться шеринг нотаток).
function sanitizeNoteHtml(html) {
  if (typeof DOMPurify === 'undefined') {
    // Немає бібліотеки-санітайзера — краще показати як текст, ніж виконати неперевірений HTML.
    return escapeHtml(html);
  }
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: ['div', 'span', 'h3', 'h4', 'ul', 'li', 'strong', 'br', 'input'],
    ALLOWED_ATTR: ['type', 'checked', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}

function toggleNoteCheckboxAndSave(pageId, containerEl) {
  const uid = auth.currentUser.uid;
  db.collection('users').doc(uid).collection('pages').doc(pageId)
    .update({ content: sanitizeNoteHtml(containerEl.innerHTML), updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    .catch(e => console.error(e));
}

function pageSnippet(content) {
  const c = content || '';
  let text;
  if (/^\s*</.test(c)) {
    const tmp = document.createElement('div');
    tmp.innerHTML = c;
    text = tmp.textContent || '';
  } else {
    text = c
      .replace(/^\[([ x])\]\s?/gim, '')
      .replace(/^#{1,2}\s+/gim, '')
      .replace(/^-\s+/gim, '')
      .replace(/\*\*(.+?)\*\*/g, '$1');
  }
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 90 ? clean.slice(0, 90) + '…' : clean;
}

function formatPageDate(ts) {
  if (!ts || !ts.toDate) return '';
  const d = ts.toDate();
  const genMonths = MONTHS_GEN[currentLang] || MONTHS_GEN.uk;
  return `${d.getDate()} ${genMonths[d.getMonth()]} ${d.getFullYear()}`;
}

function saveNotesSettings() {
  localStorage.setItem('financeAppNotesSortMode', notesSortMode);
  localStorage.setItem('financeAppShowNoteSnippet', showNoteSnippet ? '1' : '0');
}

function renderNotesTab() {
  document.getElementById('notesSortSelect').value = notesSortMode;
  document.getElementById('showNoteSnippetToggle').checked = showNoteSnippet;
  const sorted = [...pages].sort((a, b) => {
    if (notesSortMode === 'title') {
      return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    }
    if (notesSortMode === 'created') {
      const ca = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const cb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return cb - ca;
    }
    const ta = a.updatedAt && a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0;
    const tb = b.updatedAt && b.updatedAt.toMillis ? b.updatedAt.toMillis() : 0;
    return tb - ta;
  });
  const container = document.getElementById('notesCards');
  document.getElementById('notesEmpty').style.display = sorted.length === 0 ? 'block' : 'none';
  container.innerHTML = sorted.map(p => `
    <button type="button" class="note-card" data-id="${p.id}">
      <div class="note-card-title">${escapeHtml(p.title || t('pageNoTitle'))}</div>
      ${(showNoteSnippet && p.content) ? `<div class="note-card-snippet">${escapeHtml(pageSnippet(p.content))}</div>` : ''}
      <div class="note-card-date">${formatPageDate(p.updatedAt)}</div>
    </button>`).join('');
  container.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', () => {
      pageOriginTab = 'notes';
      selectTab('page:' + card.dataset.id);
    });
  });
}

function renderPageTabs() {
  if (currentTab.startsWith('page:') && !pages.find(p => 'page:' + p.id === currentTab)) {
    selectTab(pageOriginTab === 'notes' ? 'notes' : 'entries');
  } else if (currentTab.startsWith('page:')) {
    renderPageView(currentTab.slice(5));
  }
}

function renderPageView(id) {
  const page = pages.find(p => p.id === id);
  if (!page) return;
  document.getElementById('pageViewTitle').textContent = page.title || t('pageNoTitle');
  const contentEl = document.getElementById('pageViewContent');
  contentEl.innerHTML = noteContentToHtml(page.content || '');
  contentEl.querySelectorAll('.note-check-row input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) cb.setAttribute('checked', ''); else cb.removeAttribute('checked');
      const span = cb.nextElementSibling;
      if (span) span.classList.toggle('checked-text', cb.checked);
      toggleNoteCheckboxAndSave(id, contentEl);
    });
  });
}

function openPageEditor(id) {
  currentPageId = id || null;
  const page = id ? pages.find(p => p.id === id) : null;
  document.getElementById('pageModalTitle').textContent = page ? t('editPageTitle') : t('newPageTitle');
  document.getElementById('pageTitleInput').value = page ? (page.title || '') : '';
  document.getElementById('pageContentInput').innerHTML = page ? noteContentToHtml(page.content || '') : '';
  document.getElementById('pageError').style.display = 'none';
  document.getElementById('deletePageBtn').style.display = page ? 'block' : 'none';
  document.getElementById('pageOverlay').classList.add('show');
}

async function savePage() {
  const title = document.getElementById('pageTitleInput').value.trim();
  const content = sanitizeNoteHtml(document.getElementById('pageContentInput').innerHTML);
  const errEl = document.getElementById('pageError');
  errEl.style.display = 'none';
  if (!title) {
    errEl.textContent = t('pageError');
    errEl.style.display = 'block';
    return;
  }
  const btn = document.getElementById('savePageBtn');
  btn.disabled = true;
  const uid = auth.currentUser.uid;
  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    if (currentPageId) {
      await db.collection('users').doc(uid).collection('pages').doc(currentPageId).update({ title, content, updatedAt: now });
    } else {
      const ref = await db.collection('users').doc(uid).collection('pages').add({ title, content, createdAt: now, updatedAt: now });
      selectTab('page:' + ref.id);
    }
    document.getElementById('pageOverlay').classList.remove('show');
  } catch (e) {
    errEl.textContent = t('pageSaveError');
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

function deletePageRemote(id) {
  const uid = auth.currentUser.uid;
  return db.collection('users').doc(uid).collection('pages').doc(id).delete();
}

function subscribeToPages(uid) {
  if (unsubscribePages) unsubscribePages();
  const col = db.collection('users').doc(uid).collection('pages');
  unsubscribePages = col.onSnapshot((snapshot) => {
    pages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPageTabs();
  }, (err) => {
    console.error('Pages sync error', err);
  });
}

function openCategoryTxModal(catId, monthTx, ty, tm) {
  const nomMonths = MONTHS_NOM[currentLang] || MONTHS_NOM.uk;
  const genMonths = MONTHS_GEN[currentLang] || MONTHS_GEN.uk;
  const catTx = monthTx.filter(tx => tx.type === 'expense' && tx.category === catId)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  const total = catTx.reduce((s, tx) => s + tx.amount, 0);

  document.getElementById('categoryTxTitle').textContent = catDisplay('expense', catId);
  document.getElementById('categoryTxSub').textContent = `${nomMonths[tm]} ${ty} · ${formatMoney(total)}`;

  const list = document.getElementById('categoryTxList');
  if (catTx.length === 0) {
    list.innerHTML = `<div class="empty" style="padding:24px 0;">${t('statsNoExpenses')}</div>`;
  } else {
    list.innerHTML = catTx.map(tx => {
      const dateObj = parseISODate(tx.date);
      const dayLabel = `${dateObj.getDate()} ${genMonths[dateObj.getMonth()]}`;
      return `<div class="entry">
        <span class="cat-tag-date">${dayLabel}</span>
        <div class="entry-note">${escapeHtml(tx.note || '')}</div>
        <div class="entry-amount">\u2212${formatMoney(tx.amount).replace('\u2212', '')}</div>
      </div>`;
    }).join('');
  }
  document.getElementById('categoryTxOverlay').classList.add('show');
}

function toggleStatsCategory(id) {
  if (hiddenStatsCategories.includes(id)) {
    hiddenStatsCategories = hiddenStatsCategories.filter(c => c !== id);
  } else {
    hiddenStatsCategories = [...hiddenStatsCategories, id];
  }
  localStorage.setItem('financeAppHiddenStatsCats', JSON.stringify(hiddenStatsCategories));
  render();
}

function toggleSavingsTrendGoal(goalId) {
  if (hiddenSavingsTrendGoals.includes(goalId)) {
    hiddenSavingsTrendGoals = hiddenSavingsTrendGoals.filter(id => id !== goalId);
  } else {
    hiddenSavingsTrendGoals = [...hiddenSavingsTrendGoals, goalId];
  }
  localStorage.setItem('financeAppHiddenSavingsGoals', JSON.stringify(hiddenSavingsTrendGoals));
  render();
}

function renderStats(monthTx, ty, tm) {
  document.getElementById('pieChartCard').style.display = showChartPie ? '' : 'none';
  document.getElementById('trendChartCard').style.display = showChartTrend ? '' : 'none';
  document.getElementById('savingsTrendCard').style.display = showChartSavings ? '' : 'none';

  if (!showChartPie) {
    if (pieChart) { pieChart.destroy(); pieChart = null; }
  } else {
  const map = {};
  monthTx.filter(tx => tx.type === 'expense').forEach(tx => { map[tx.category] = (map[tx.category] || 0) + tx.amount; });
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const visibleEntries = entries.filter(([id]) => !hiddenStatsCategories.includes(id));

  const pieEmpty = document.getElementById('pieEmpty');
  const pieCanvas = document.getElementById('pieChart');
  if (entries.length === 0) {
    pieEmpty.style.display = 'block';
    pieCanvas.style.display = 'none';
    document.getElementById('pieLegend').innerHTML = '';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
  } else {
    document.getElementById('pieLegend').innerHTML = entries.map(([id, val]) => {
      const hidden = hiddenStatsCategories.includes(id);
      return `<div class="legend-row-wrap${hidden ? ' hidden-cat' : ''}">
        <button type="button" class="legend-toggle${hidden ? '' : ' checked'}" data-cat="${id}" aria-label="${t('toggleCatAria')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
        <button type="button" class="legend-row" data-cat="${id}">
          <span class="legend-dot" style="background:${catColor('expense', id)}"></span>
          <span class="legend-name">${escapeHtml(catDisplay('expense', id))}</span>
          <span class="legend-val">${formatMoney(val)}</span>
        </button>
      </div>`;
    }).join('');
    document.getElementById('pieLegend').querySelectorAll('.legend-row').forEach(row => {
      row.addEventListener('click', () => openCategoryTxModal(row.dataset.cat, monthTx, ty, tm));
    });
    document.getElementById('pieLegend').querySelectorAll('.legend-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStatsCategory(btn.dataset.cat);
      });
    });

    if (visibleEntries.length === 0) {
      pieEmpty.style.display = 'block';
      pieCanvas.style.display = 'none';
      if (pieChart) { pieChart.destroy(); pieChart = null; }
    } else {
      pieEmpty.style.display = 'none';
      pieCanvas.style.display = 'block';
      const ids = visibleEntries.map(e => e[0]);
      const labels = ids.map(id => catDisplay('expense', id));
      const values = visibleEntries.map(e => e[1]);
      const colors = ids.map(id => catColor('expense', id));
      if (pieChart) pieChart.destroy();
      pieChart = new Chart(pieCanvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: themeVar('--surface'), borderWidth: 2 }] },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatMoney(ctx.raw)}` } }
          }
        }
      });
    }
  }
  }

  const now = new Date();
  const nomMonths = MONTHS_NOM[currentLang] || MONTHS_NOM.uk;
  const labels = [], incomeData = [], expenseData = [];
  for (let i = trendPeriodMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    labels.push(nomMonths[m].slice(0, 3));
    incomeData.push(transactions.filter(tx => { const td = parseISODate(tx.date); return td.getFullYear() === y && td.getMonth() === m && tx.type === 'income'; }).reduce((s, tx) => s + tx.amount, 0));
    expenseData.push(transactions.filter(tx => { const td = parseISODate(tx.date); return td.getFullYear() === y && td.getMonth() === m && tx.type === 'expense'; }).reduce((s, tx) => s + tx.amount, 0));
  }
  const wordMap = MONTHS_WORD[currentLang] || MONTHS_WORD.uk;
  if (!showChartTrend) {
    if (barChart) { barChart.destroy(); barChart = null; }
  } else {
  document.getElementById('statsTrendSub').textContent = `${t('lastLabel')} ${trendPeriodMonths} ${wordMap[trendPeriodMonths] || wordMap[6]}`;
  const barCanvas = document.getElementById('barChart');
  if (barChart) barChart.destroy();
  barChart = new Chart(barCanvas, {
    type: 'bar',
    data: { labels, datasets: [
      { label: t('chartIncome'), data: incomeData, backgroundColor: themeVar('--income'), borderRadius: 3 },
      { label: t('chartExpense'), data: expenseData, backgroundColor: themeVar('--expense'), borderRadius: 3 },
    ]},
    options: {
      maintainAspectRatio: false,
      plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.raw)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 12 }, color: themeVar('--ink-muted') } },
        y: { grid: { color: themeVar('--border') }, ticks: { font: { family: 'Inter', size: 11 }, color: themeVar('--ink-muted') } }
      }
    }
  });
  }

  // ---- Графік динаміки заощаджень (по лінії на кожну ціль, у вибраній валюті) ----
  if (!showChartSavings) {
    if (savingsTrendChart) { savingsTrendChart.destroy(); savingsTrendChart = null; }
  } else {
  const trendEmptyEl = document.getElementById('savingsTrendEmpty');
  const savingsCanvas = document.getElementById('savingsTrendChart');
  const legendEl = document.getElementById('savingsTrendLegend');
  if (savings.length === 0 || savingsGoals.length === 0) {
    trendEmptyEl.style.display = 'block';
    savingsCanvas.style.display = 'none';
    legendEl.innerHTML = '';
    if (savingsTrendChart) { savingsTrendChart.destroy(); savingsTrendChart = null; }
  } else {
    trendEmptyEl.style.display = 'none';
    savingsCanvas.style.display = 'block';
    const svMonths = savingsTrendPeriodMonths;
    const svLabels = [];
    const monthPoints = [];
    for (let i = svMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      svLabels.push(nomMonths[d.getMonth()].slice(0, 3));
      monthPoints.push({ y: d.getFullYear(), m: d.getMonth() });
    }
    const svWordMap = MONTHS_WORD[currentLang] || MONTHS_WORD.uk;
    const periodText = `${t('lastLabel')} ${savingsTrendPeriodMonths} ${svWordMap[savingsTrendPeriodMonths] || svWordMap[6]}`;
    const needsConversion = savings.some(sv => (sv.currency || currentCurrency) !== savingsTrendCurrency);
    const rateMissing = savings.some(sv => convertAmount(sv.amount, sv.currency || currentCurrency, savingsTrendCurrency) === null);
    let subText = periodText;
    if (exchangeRatesDate) {
      subText += ` · ${t('rateAsOf')} ${exchangeRatesDate}`;
      if (isRateStale()) subText += ` (${t('rateStaleSuffix')})`;
    } else if (needsConversion) subText += ` · ${t('rateUnavailable')}`;
    document.getElementById('savingsTrendSub').textContent = subText;
    if (rateMissing) {
      // Курс частини валют невідомий — краще показати порожній стан з
      // поясненням, ніж графік із хибними (NaN) точками.
      trendEmptyEl.style.display = 'block';
      savingsCanvas.style.display = 'none';
      legendEl.innerHTML = '';
      if (savingsTrendChart) { savingsTrendChart.destroy(); savingsTrendChart = null; }
      return;
    }
    const sortedGoals = [...savingsGoals].sort((a, b) => {
      const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return ta - tb;
    });
    const datasets = [];
    let colorIdx = 0;
    sortedGoals.forEach(g => {
      const goalTx = savings.filter(sv => sv.goalId === g.id);
      if (goalTx.length === 0) return;
      const color = CATEGORY_PALETTE[colorIdx % CATEGORY_PALETTE.length].text;
      colorIdx++;
      const data = monthPoints.map(pt => {
        const cutoff = new Date(pt.y, pt.m + 1, 0);
        return goalTx.filter(sv => parseISODate(sv.date) <= cutoff).reduce((s, sv) => {
          const converted = convertAmount(sv.amount, sv.currency || currentCurrency, savingsTrendCurrency);
          return s + (sv.type === 'deposit' ? converted : -converted);
        }, 0);
      });
      datasets.push({ label: g.name || t('defaultGoalName'), data, borderColor: color, backgroundColor: color, tension: 0.3, pointRadius: 3, fill: false, _goalId: g.id });
    });

    // Загальний баланс — сума всіх цілей разом
    const totalData = monthPoints.map(pt => {
      const cutoff = new Date(pt.y, pt.m + 1, 0);
      return savings.filter(sv => parseISODate(sv.date) <= cutoff).reduce((s, sv) => {
        const converted = convertAmount(sv.amount, sv.currency || currentCurrency, savingsTrendCurrency);
        return s + (sv.type === 'deposit' ? converted : -converted);
      }, 0);
    });
    datasets.push({
      label: t('savingsTotalLabel'), data: totalData, borderColor: themeVar('--ink'), backgroundColor: themeVar('--ink'),
      borderWidth: 3, tension: 0.3, pointRadius: 3, fill: false, _goalId: '__total__',
    });

    legendEl.innerHTML = datasets.map(ds => {
      const hidden = hiddenSavingsTrendGoals.includes(ds._goalId);
      return `<div class="legend-row-wrap${hidden ? ' hidden-cat' : ''}">
        <button type="button" class="legend-toggle${hidden ? '' : ' checked'}" data-goal="${ds._goalId}" aria-label="${t('toggleCatAria')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
        <div class="legend-row" style="cursor:default;">
          <span class="legend-dot" style="background:${ds.borderColor}"></span>
          <span class="legend-name">${escapeHtml(ds.label)}</span>
        </div>
      </div>`;
    }).join('');
    legendEl.querySelectorAll('.legend-toggle').forEach(btn => {
      btn.addEventListener('click', () => toggleSavingsTrendGoal(btn.dataset.goal));
    });

    const visibleDatasets = datasets.filter(ds => !hiddenSavingsTrendGoals.includes(ds._goalId));
    if (visibleDatasets.length === 0) {
      trendEmptyEl.style.display = 'block';
      savingsCanvas.style.display = 'none';
      if (savingsTrendChart) { savingsTrendChart.destroy(); savingsTrendChart = null; }
    } else {
      trendEmptyEl.style.display = 'none';
      savingsCanvas.style.display = 'block';
      if (savingsTrendChart) savingsTrendChart.destroy();
      savingsTrendChart = new Chart(savingsCanvas, {
        type: 'line',
        data: { labels: svLabels, datasets: visibleDatasets },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoneyCur(ctx.raw, savingsTrendCurrency)}` } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 12 }, color: themeVar('--ink-muted') } },
            y: { grid: { color: themeVar('--border') }, ticks: { font: { family: 'Inter', size: 11 }, color: themeVar('--ink-muted') } }
          }
        }
      });
    }
  }
  }
}

// ---- Форма додавання ----
function openForm(type, existingTx) {
  formType = type;
  editingTxId = existingTx ? existingTx.id : null;
  const list = type === 'expense' ? categoriesExpense : categoriesIncome;
  selectedCategory = existingTx ? existingTx.category : (list[0] ? list[0].id : null);
  const isEdit = !!existingTx;
  document.getElementById('modalTitle').textContent = isEdit
    ? (type === 'income' ? t('editIncomeTitle') : t('editExpenseTitle'))
    : (type === 'income' ? t('newIncomeTitle') : t('newExpenseTitle'));
  document.getElementById('modalTitle').style.color = type === 'income' ? 'var(--income)' : 'var(--expense)';
  document.getElementById('submitBtn').style.background = type === 'income' ? 'var(--income)' : 'var(--expense)';
  document.getElementById('submitBtn').textContent = t('saveBtn');
  document.getElementById('amountInput').value = existingTx ? String(existingTx.amount).replace('.', ',') : '';
  document.getElementById('noteInput').value = existingTx ? (existingTx.note || '') : '';
  document.getElementById('dateInput').value = existingTx ? existingTx.date : todayISO();
  document.getElementById('dateInput').max = todayISO();
  document.getElementById('formError').style.display = 'none';
  renderCatPicker();
  document.getElementById('formOverlay').classList.add('show');
  setTimeout(() => document.getElementById('amountInput').focus(), 50);
}

function renderCatPicker() {
  const cats = formType === 'expense' ? categoriesExpense : categoriesIncome;
  const picker = document.getElementById('catPicker');
  picker.innerHTML = cats.map(c => `<button type="button" class="cat-choice${c.id === selectedCategory ? ' selected' : ''}"
    data-cat="${c.id}"
    style="${c.id === selectedCategory ? `background:${catColor(formType, c.id)};` : ''}">${escapeHtml(catLabel(formType, c.id))}</button>`).join('');
  picker.querySelectorAll('.cat-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.cat;
      renderCatPicker();
    });
  });
}

async function submitForm() {
  const amountInput = document.getElementById('amountInput');
  const num = parseFloat(amountInput.value.replace(',', '.'));
  const errEl = document.getElementById('formError');
  if (!amountInput.value || isNaN(num) || num <= 0) {
    errEl.textContent = t('amountError');
    errEl.style.display = 'block';
    return;
  }
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  const tx = {
    type: formType,
    amount: Math.round(num * 100) / 100,
    category: selectedCategory,
    note: document.getElementById('noteInput').value.trim(),
    date: document.getElementById('dateInput').value || todayISO(),
  };
  try {
    if (editingTxId) {
      await updateTransactionRemote(editingTxId, tx);
    } else {
      await addTransactionRemote(tx);
    }
    editingTxId = null;
    document.getElementById('formOverlay').classList.remove('show');
  } catch (e) {
    errEl.textContent = t('saveError');
    errEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
  }
}

// ---- Події ----
function selectTab(tabKey) {
  currentTab = tabKey;
  if (!tabKey.startsWith('page:')) pageOriginTab = 'entries';
  document.querySelectorAll('#tabsList .tab-btn[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tabKey));
  document.getElementById('statsToggleBtn').classList.toggle('active', tabKey === 'stats');
  document.getElementById('savingsToggleBtn').classList.toggle('active', tabKey === 'savings');
  document.getElementById('notesToggleBtn').classList.toggle('active', tabKey === 'notes');
  const isPage = tabKey.startsWith('page:');
  const isSavings = tabKey === 'savings';
  const isNotes = tabKey === 'notes';
  document.getElementById('balanceSummary').style.display = tabKey === 'entries' ? 'block' : 'none';
  document.getElementById('header').classList.toggle('slim', tabKey !== 'entries');
  document.getElementById('entriesTab').style.display = tabKey === 'entries' ? 'block' : 'none';
  document.getElementById('recentHeader').style.display = tabKey === 'entries' ? 'flex' : 'none';
  if (tabKey !== 'entries') closeSearchBar();
  document.getElementById('statsTab').style.display = tabKey === 'stats' ? 'block' : 'none';
  document.getElementById('savingsTab').style.display = isSavings ? 'block' : 'none';
  document.getElementById('notesTab').style.display = isNotes ? 'block' : 'none';
  document.getElementById('pageViewTab').style.display = isPage ? 'block' : 'none';
  document.getElementById('categoriesBtn').style.display = isPage ? 'none' : 'flex';
  document.getElementById('monthNavHeader').classList.toggle('show', tabKey === 'entries' || tabKey === 'stats');
  document.getElementById('backToEntriesBtn').classList.toggle('show', tabKey !== 'entries');
  document.getElementById('fabRow').style.display = (isPage || isSavings || isNotes) ? 'none' : 'flex';
  document.getElementById('appMenuOverlay').classList.remove('show');
  document.getElementById('categoriesBtn').setAttribute('aria-label',
    tabKey === 'stats' ? t('statsSettingsTitle') : tabKey === 'savings' ? t('savingsSettingsTitle') : tabKey === 'notes' ? t('notesSettingsTitle') : t('categoriesTitle'));
  updateHeaderSectionTitle();
  if (isSavings) {
    currentSavingsGoalId = null;
    document.getElementById('savingsGoalDetail').style.display = 'none';
    document.getElementById('savingsGoalsList').style.display = 'block';
    document.getElementById('savingsFabRow').style.display = 'none';
    renderSavingsGoalsList();
  } else {
    document.getElementById('savingsFabRow').style.display = 'none';
  }
  if (isNotes) renderNotesTab();
  render();
}

function updateHeaderSectionTitle() {
  const titleEl = document.getElementById('headerSectionTitle');
  titleEl.textContent = '';
  titleEl.classList.remove('show');
}
document.getElementById('tabsList').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn[data-tab]');
  if (!btn) return;
  selectTab(btn.dataset.tab);
});
document.getElementById('editPageBtn').addEventListener('click', () => {
  if (!currentTab.startsWith('page:')) return;
  openPageEditor(currentTab.slice(5));
});
document.getElementById('deletePageInlineBtn').addEventListener('click', () => {
  if (!currentTab.startsWith('page:')) return;
  pendingDeleteId = currentTab.slice(5);
  pendingDeleteType = 'page';
  document.getElementById('confirmTitle').textContent = t('confirmTitlePage');
  document.getElementById('confirmSub').textContent = t('confirmSub');
  document.getElementById('confirmDelete').textContent = t('deleteBtn');
  document.getElementById('confirmOverlay').classList.add('show');
});
document.getElementById('prevMonth').addEventListener('click', () => { monthOffset--; render(); });
document.getElementById('nextMonth').addEventListener('click', () => { if (monthOffset < 0) { monthOffset++; render(); } });
function closeSearchBar() {
  const bar = document.getElementById('searchBar');
  const btn = document.getElementById('searchToggleBtn');
  bar.classList.remove('open');
  btn.classList.remove('active');
  btn.setAttribute('aria-expanded', 'false');
  if (searchQuery) {
    searchQuery = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    render();
  }
}
document.getElementById('searchToggleBtn').addEventListener('click', () => {
  const bar = document.getElementById('searchBar');
  const btn = document.getElementById('searchToggleBtn');
  const opening = !bar.classList.contains('open');
  if (opening) {
    bar.classList.add('open');
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
    setTimeout(() => document.getElementById('searchInput').focus(), 260);
  } else {
    closeSearchBar();
  }
});
document.getElementById('searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  document.getElementById('clearSearchBtn').style.display = searchQuery ? 'flex' : 'none';
  render();
});
document.getElementById('clearSearchBtn').addEventListener('click', () => {
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  render();
});
document.getElementById('backToEntriesBtn').addEventListener('click', () => {
  selectTab(currentTab.startsWith('page:') && pageOriginTab === 'notes' ? 'notes' : 'entries');
});
document.getElementById('trendPeriodPicker').addEventListener('click', (e) => {
  const btn = e.target.closest('.period-btn');
  if (!btn) return;
  trendPeriodMonths = parseInt(btn.dataset.months, 10);
  document.querySelectorAll('#trendPeriodPicker .period-btn').forEach(b => b.classList.toggle('active', b === btn));
  render();
});
document.getElementById('savingsTrendPeriodPicker').addEventListener('click', (e) => {
  const btn = e.target.closest('.period-btn');
  if (!btn) return;
  savingsTrendPeriodMonths = parseInt(btn.dataset.months, 10);
  document.querySelectorAll('#savingsTrendPeriodPicker .period-btn').forEach(b => b.classList.toggle('active', b === btn));
  render();
});
document.getElementById('prevMonthHeader').addEventListener('click', () => { monthOffset--; render(); });
document.getElementById('nextMonthHeader').addEventListener('click', () => { if (monthOffset < 0) { monthOffset++; render(); } });
document.getElementById('openExpense').addEventListener('click', () => openForm('expense'));
document.getElementById('openIncome').addEventListener('click', () => openForm('income'));
document.getElementById('closeForm').addEventListener('click', () => { editingTxId = null; document.getElementById('formOverlay').classList.remove('show'); });
document.getElementById('formOverlay').addEventListener('click', (e) => { if (e.target.id === 'formOverlay') { editingTxId = null; e.currentTarget.classList.remove('show'); } });
document.getElementById('submitBtn').addEventListener('click', submitForm);
document.getElementById('cancelDelete').addEventListener('click', () => { pendingDeleteId = null; document.getElementById('confirmOverlay').classList.remove('show'); });
document.getElementById('confirmOverlay').addEventListener('click', (e) => { if (e.target.id === 'confirmOverlay') e.currentTarget.classList.remove('show'); });
document.getElementById('confirmDelete').addEventListener('click', async () => {
  const id = pendingDeleteId;
  const type = pendingDeleteType;
  pendingDeleteId = null;
  document.getElementById('confirmOverlay').classList.remove('show');
  try {
    if (type === 'page') {
      await deletePageRemote(id);
      document.getElementById('pageOverlay').classList.remove('show');
    } else if (type === 'saving') {
      await deleteSavingRemote(id);
    } else if (type === 'goal') {
      await deleteSavingsGoalRemote(id);
      document.getElementById('goalFormOverlay').classList.remove('show');
      backToGoalsList();
    } else if (type === 'logout') {
      auth.signOut();
    } else {
      await deleteTransactionRemote(id);
    }
  } catch (e) { console.error(e); }
});
document.getElementById('entryMenuOverlay').addEventListener('click', (e) => { if (e.target.id === 'entryMenuOverlay') e.currentTarget.classList.remove('show'); });
document.getElementById('editEntryBtn').addEventListener('click', () => {
  document.getElementById('entryMenuOverlay').classList.remove('show');
  if (entryMenuKind === 'saving') {
    const sv = savings.find(s => s.id === entryMenuTxId);
    if (sv) openSavingsForm(sv.type, sv);
  } else {
    const tx = transactions.find(t => t.id === entryMenuTxId);
    if (tx) openForm(tx.type, tx);
  }
});
document.getElementById('deleteEntryBtn').addEventListener('click', () => {
  document.getElementById('entryMenuOverlay').classList.remove('show');
  pendingDeleteId = entryMenuTxId;
  pendingDeleteType = entryMenuKind === 'saving' ? 'saving' : 'entry';
  document.getElementById('confirmTitle').textContent = t('confirmTitle');
  document.getElementById('confirmSub').textContent = t('confirmSub');
  document.getElementById('confirmDelete').textContent = t('deleteBtn');
  document.getElementById('confirmOverlay').classList.add('show');
});
document.getElementById('addSavingsGoalBtn').addEventListener('click', () => openGoalForm(null));
document.getElementById('backToGoalsBtn').addEventListener('click', () => backToGoalsList());
document.getElementById('editGoalBtn').addEventListener('click', () => {
  const goal = savingsGoals.find(g => g.id === currentSavingsGoalId);
  openGoalForm(goal);
});
document.getElementById('closeGoalForm').addEventListener('click', () => { editingGoalId = null; document.getElementById('goalFormOverlay').classList.remove('show'); });
document.getElementById('goalFormOverlay').addEventListener('click', (e) => { if (e.target.id === 'goalFormOverlay') { editingGoalId = null; e.currentTarget.classList.remove('show'); } });
document.getElementById('goalFormSubmitBtn').addEventListener('click', submitGoalForm);
document.getElementById('deleteGoalBtn').addEventListener('click', () => {
  if (!editingGoalId) return;
  pendingDeleteId = editingGoalId;
  pendingDeleteType = 'goal';
  document.getElementById('confirmTitle').textContent = t('confirmTitleGoal');
  document.getElementById('confirmSub').textContent = t('confirmSubGoal');
  document.getElementById('confirmDelete').textContent = t('deleteBtn');
  document.getElementById('confirmOverlay').classList.add('show');
});
document.getElementById('openDeposit').addEventListener('click', () => openSavingsForm('deposit'));
document.getElementById('openWithdraw').addEventListener('click', () => openSavingsForm('withdraw'));
document.getElementById('closeSavingsForm').addEventListener('click', () => { editingSavingId = null; document.getElementById('savingsFormOverlay').classList.remove('show'); });
document.getElementById('savingsFormOverlay').addEventListener('click', (e) => { if (e.target.id === 'savingsFormOverlay') { editingSavingId = null; e.currentTarget.classList.remove('show'); } });
document.getElementById('savingsSubmitBtn').addEventListener('click', submitSavingsForm);
document.getElementById('menuBtn').addEventListener('click', () => document.getElementById('appMenuOverlay').classList.add('show'));
document.getElementById('appMenuOverlay').addEventListener('click', (e) => { if (e.target.id === 'appMenuOverlay') e.currentTarget.classList.remove('show'); });
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('appMenuOverlay').classList.remove('show');
  document.getElementById('settingsOverlay').classList.add('show');
});
document.getElementById('closeSettings').addEventListener('click', () => document.getElementById('settingsOverlay').classList.remove('show'));
document.getElementById('exportXlsxBtn').addEventListener('click', exportAllDataXlsx);
document.getElementById('importCsvBtn').addEventListener('click', () => document.getElementById('importCsvInput').click());
document.getElementById('importCsvInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) importTransactionsFromCsv(file);
});
document.getElementById('closeCategoryTx').addEventListener('click', () => document.getElementById('categoryTxOverlay').classList.remove('show'));
document.getElementById('categoryTxOverlay').addEventListener('click', (e) => { if (e.target.id === 'categoryTxOverlay') e.currentTarget.classList.remove('show'); });
document.getElementById('settingsOverlay').addEventListener('click', (e) => { if (e.target.id === 'settingsOverlay') e.currentTarget.classList.remove('show'); });
document.getElementById('addExpenseCatBtn').addEventListener('click', () => addCategoryFromInput('expense'));
document.getElementById('addIncomeCatBtn').addEventListener('click', () => addCategoryFromInput('income'));
document.getElementById('newExpenseCatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCategoryFromInput('expense'); });
document.getElementById('newIncomeCatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCategoryFromInput('income'); });
document.getElementById('categoriesBtn').addEventListener('click', () => {
  if (currentTab === 'stats') {
    document.getElementById('statsSettingsOverlay').classList.add('show');
  } else if (currentTab === 'savings') {
    document.getElementById('savingsSettingsOverlay').classList.add('show');
  } else if (currentTab === 'notes') {
    document.getElementById('notesSettingsOverlay').classList.add('show');
  } else {
    document.getElementById('categoriesOverlay').classList.add('show');
  }
});
document.getElementById('closeCategories').addEventListener('click', () => document.getElementById('categoriesOverlay').classList.remove('show'));
document.getElementById('categoriesOverlay').addEventListener('click', (e) => { if (e.target.id === 'categoriesOverlay') e.currentTarget.classList.remove('show'); });

document.getElementById('closeStatsSettings').addEventListener('click', () => document.getElementById('statsSettingsOverlay').classList.remove('show'));
document.getElementById('statsSettingsOverlay').addEventListener('click', (e) => { if (e.target.id === 'statsSettingsOverlay') e.currentTarget.classList.remove('show'); });
document.getElementById('showChartPie').addEventListener('change', (e) => {
  showChartPie = e.target.checked;
  localStorage.setItem('financeAppShowChartPie', showChartPie ? '1' : '0');
  render();
});
document.getElementById('showChartTrend').addEventListener('change', (e) => {
  showChartTrend = e.target.checked;
  localStorage.setItem('financeAppShowChartTrend', showChartTrend ? '1' : '0');
  render();
});
document.getElementById('showChartSavings').addEventListener('change', (e) => {
  showChartSavings = e.target.checked;
  localStorage.setItem('financeAppShowChartSavings', showChartSavings ? '1' : '0');
  render();
});

document.getElementById('closeSavingsSettings').addEventListener('click', () => document.getElementById('savingsSettingsOverlay').classList.remove('show'));
document.getElementById('savingsSettingsOverlay').addEventListener('click', (e) => { if (e.target.id === 'savingsSettingsOverlay') e.currentTarget.classList.remove('show'); });
document.getElementById('closeNotesSettings').addEventListener('click', () => document.getElementById('notesSettingsOverlay').classList.remove('show'));
document.getElementById('notesSettingsOverlay').addEventListener('click', (e) => { if (e.target.id === 'notesSettingsOverlay') e.currentTarget.classList.remove('show'); });
document.getElementById('notesSortSelect').addEventListener('change', (e) => {
  notesSortMode = e.target.value;
  saveNotesSettings();
  renderNotesTab();
});
document.getElementById('showNoteSnippetToggle').addEventListener('change', (e) => {
  showNoteSnippet = e.target.checked;
  saveNotesSettings();
  renderNotesTab();
});
document.getElementById('showSavingsTotalToggle').addEventListener('change', (e) => {
  showSavingsTotal = e.target.checked;
  localStorage.setItem('financeAppShowSavingsTotal', showSavingsTotal ? '1' : '0');
  renderSavingsGoalsList();
});
document.getElementById('statsToggleBtn').addEventListener('click', () => selectTab(currentTab === 'stats' ? 'entries' : 'stats'));
document.getElementById('savingsToggleBtn').addEventListener('click', () => selectTab(currentTab === 'savings' ? 'entries' : 'savings'));
document.getElementById('notesToggleBtn').addEventListener('click', () => selectTab(currentTab === 'notes' ? 'entries' : 'notes'));
document.getElementById('addNoteBtn').addEventListener('click', () => {
  pageOriginTab = 'notes';
  openPageEditor(null);
});
function insertChecklistItem() {
  const editor = document.getElementById('pageContentInput');
  editor.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  range.deleteContents();

  const row = document.createElement('div');
  row.className = 'note-check-row';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.contentEditable = 'false';
  const span = document.createElement('span');
  span.textContent = '\u00A0';
  row.appendChild(checkbox);
  row.appendChild(span);

  range.insertNode(row);
  const after = document.createElement('div');
  after.innerHTML = '<br>';
  row.after(after);

  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  newRange.collapse(false);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

function applyNoteFormat(fmt) {
  const editor = document.getElementById('pageContentInput');
  editor.focus();
  if (fmt === 'bold') {
    document.execCommand('bold');
  } else if (fmt === 'h1') {
    document.execCommand('formatBlock', false, 'h3');
  } else if (fmt === 'h2') {
    document.execCommand('formatBlock', false, 'h4');
  } else if (fmt === 'bullet') {
    document.execCommand('insertUnorderedList');
  } else if (fmt === 'check') {
    insertChecklistItem();
  }
}
document.querySelectorAll('.note-tb-btn').forEach(btn => {
  btn.addEventListener('click', () => applyNoteFormat(btn.dataset.fmt));
});
document.getElementById('pageContentInput').addEventListener('paste', (e) => {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
});
document.getElementById('pageContentInput').addEventListener('change', (e) => {
  const cb = e.target;
  if (cb.tagName === 'INPUT' && cb.type === 'checkbox') {
    if (cb.checked) cb.setAttribute('checked', ''); else cb.removeAttribute('checked');
    const span = cb.nextElementSibling;
    if (span) span.classList.toggle('checked-text', cb.checked);
  }
});
document.getElementById('closePage').addEventListener('click', () => document.getElementById('pageOverlay').classList.remove('show'));
document.getElementById('pageOverlay').addEventListener('click', (e) => { if (e.target.id === 'pageOverlay') e.currentTarget.classList.remove('show'); });
document.getElementById('savePageBtn').addEventListener('click', savePage);
document.getElementById('deletePageBtn').addEventListener('click', () => {
  if (!currentPageId) return;
  pendingDeleteId = currentPageId;
  pendingDeleteType = 'page';
  document.getElementById('confirmTitle').textContent = t('confirmTitlePage');
  document.getElementById('confirmSub').textContent = t('confirmSub');
  document.getElementById('confirmDelete').textContent = t('deleteBtn');
  document.getElementById('confirmOverlay').classList.add('show');
});

// ---- Старт ----
applyStaticTranslations();
selectTab('entries');
