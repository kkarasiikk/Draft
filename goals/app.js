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
    savingsLinkLabel: 'Брати число зі скарбнички', savingsLinkNone: 'Не брати — вестиму руками',
    savingsLinkHint: 'Прогрес рахуватиметься з реальних операцій у «Бюджеті», вручну вводити не доведеться.',
    savingsLinkEmpty: 'У «Бюджеті» ще немає жодної скарбнички.',
    linkedFromSavings: 'Число береться зі скарбнички в «Бюджеті»',
    milestoneDateLabel: 'Коли планую (необовʼязково)', milestoneReorderAria: 'Перетягнути; ↑/↓ з клавіатури',
    milestoneOverdue: (n) => `прострочено на ${n} дн.`, milestoneDue: (d) => `до ${d}`,
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
    fabNewGoalLabel: 'Нова ціль', bnMonth: 'Місяць', bnYear: 'Рік',
    horizonLabel: 'Горизонт', horizonMonth: 'Місячна', horizonYear: 'Річна',
    horizonHint: 'Місячна — що робиш цього місяця. Річна — куди йдеш загалом.',
    emptyMonthTitle: 'Немає цілей на місяць', emptyMonthSub: 'Що хочеш зрушити саме цього місяця?',
    emptyYearTitle: 'Немає річних цілей', emptyYearSub: 'Куди ти йдеш цього року?',
    statusAll: 'Усі', statusActive: 'Активні', statusDone: 'Завершені', statusArchived: 'Архів',
    statusPaused: 'На паузі', pauseBtn: 'Поставити на паузу', resumeBtn: 'Повернути в роботу',
    pausedNote: 'Ціль на паузі: про неї не питають вечорами, і серія не рветься.',
    paceAhead: 'Випереджаєш графік', paceOnTrack: 'У графіку',
    paceBehind: 'Не встигаєш таким темпом', paceOverdue: 'Дедлайн минув',
    paceUnknown: 'Даних для прогнозу ще замало',
    paceProjected: (d) => `Таким темпом — приблизно ${d}`,
    paceLate: (n) => `На ${n} дн. пізніше за дедлайн`,
    paceNeed: (v, u) => `Щоб устигнути: ${v}${u ? ' ' + u : ''} на день`,
    paceTimeVsWork: (t, p) => `Часу минуло ${t}%, зроблено ${p}%`,
    paceDaysLeft: (n) => `${n} дн. до дедлайну`,
    reviewTitle: 'Огляд тижня', reviewOpen: 'Переглянути',
    reviewBanner: (n) => `${n} ${n === 1 ? 'ціль чекає' : 'цілей чекають'} на огляд`,
    reviewStalled: (n) => `${n} без руху цього тижня`,
    reviewSub: 'Раз на тиждень — коротке питання: ти досі цього хочеш?',
    reviewLater: 'Пізніше', reviewMoved: 'Цього тижня', reviewNoMove: 'Цього тижня нічого не зрушило',
    reviewCheckins: (n) => `${n} дн. із кроком`, reviewMilestones: (n) => `віх: ${n}`,
    reviewProgress: (v, u) => `+${v}${u ? ' ' + u : ''}`, reviewJournal: (n) => `записів: ${n}`,
    reviewKeep: 'Веду далі', reviewShift: 'Зсунути дедлайн', reviewPause: 'На паузу', reviewArchive: 'В архів',
    reviewShiftHint: 'Новий дедлайн', reviewDone: 'Огляд завершено', reviewEmpty: 'Усе оглянуто',
    whyReminder: 'Ти писав(ла), навіщо це:',
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
    parentLabel: 'Служить річній цілі', parentNone: 'Сама по собі',
    parentHint: 'Рік — напрямок, місяць — крок до нього. На річній цілі буде видно, що на неї працює.',
    parentEmpty: 'Річних цілей ще немає — заведи одну на вкладці «Рік».',
    childrenTitle: (n) => `Цього місяця над цим працюють: ${n}`,
    blockersTitle: 'Що заважає найчастіше', blockersShort: 'Заважало:',
    reason_noTime: 'Не було часу', reason_forgot: 'Забув(ла)', reason_tired: 'Втома',
    reason_mood: 'Не було настрою', reason_other: 'Інше',
    journalPlaceholder: 'Що сьогодні зробив(ла) для цієї цілі?',
    journalEmpty: 'Ще нема нотаток', journalSectionLabel: 'Щоденник',
    badge_streak7: '🔥 Серія 7 днів', badge_firstDone: '🏆 Перша ціль завершена',
    badge_firstStep: '🌱 Перший крок', badge_perfect: '💯 Ціль без прогалин',
    dashboardEmptyTitle: 'Ще немає цілей', dashboardEmptySub: 'Додай першу ціль кнопкою внизу.',
    daysLeftLabel: (n) => `${n} дн. до дедлайну`, overdueLabel: 'Прострочено',
    milestonesCountSuffix: 'віх',
    milestoneToTask: 'У завдання', milestoneInTasks: 'У завданнях',
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
    cat_health: 'Здоровье', cat_finance: 'Финансы', cat_learning: 'Обучение', cat_career: 'Карьера',
    cat_relationships: 'Отношения', cat_travel: 'Путешествия', cat_creativity: 'Творчество', cat_other: 'Другое',
    whyLabel: 'Зачем тебе это?', whyPlaceholder: 'Почему эта цель важна именно для тебя (необязательно)',
    targetDateLabel: 'Дедлайн (необязательно)',
    milestonesLabel: 'Вехи', targetValueLabel: 'Числовая цель (необязательно)',
    targetValueHint: 'Если задать — прогресс считается числом, а не вехами.',
    targetValuePlaceholder: '10', unitPlaceholder: 'км',
    addProgressPlaceholder: '+ сколько', addProgressBtn: 'Добавить', milestonePlaceholder: 'Например: пройти первые 5 уроков',
    savingsLinkLabel: 'Брать число из копилки', savingsLinkNone: 'Не брать — буду вести вручную',
    savingsLinkHint: 'Прогресс будет считаться из реальных операций в «Бюджете», вручную вводить не придётся.',
    savingsLinkEmpty: 'В «Бюджете» ещё нет ни одной копилки.',
    linkedFromSavings: 'Число берётся из копилки в «Бюджете»',
    milestoneDateLabel: 'Когда планирую (необязательно)', milestoneReorderAria: 'Перетащить; ↑/↓ с клавиатуры',
    milestoneOverdue: (n) => `просрочено на ${n} дн.`, milestoneDue: (d) => `до ${d}`,
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
    fabNewGoalLabel: 'Новая цель', bnMonth: 'Месяц', bnYear: 'Год',
    horizonLabel: 'Горизонт', horizonMonth: 'Месячная', horizonYear: 'Годовая',
    horizonHint: 'Месячная — что делаешь в этом месяце. Годовая — куда идёшь в целом.',
    emptyMonthTitle: 'Нет целей на месяц', emptyMonthSub: 'Что хочешь сдвинуть именно в этом месяце?',
    emptyYearTitle: 'Нет годовых целей', emptyYearSub: 'Куда ты идёшь в этом году?',
    statusAll: 'Все', statusActive: 'Активные', statusDone: 'Завершённые', statusArchived: 'Архив',
    statusPaused: 'На паузе', pauseBtn: 'Поставить на паузу', resumeBtn: 'Вернуть в работу',
    pausedNote: 'Цель на паузе: о ней не спрашивают вечерами, и серия не рвётся.',
    paceAhead: 'Опережаешь график', paceOnTrack: 'В графике',
    paceBehind: 'Не успеваешь таким темпом', paceOverdue: 'Дедлайн прошёл',
    paceUnknown: 'Данных для прогноза пока мало',
    paceProjected: (d) => `Таким темпом — примерно ${d}`,
    paceLate: (n) => `На ${n} дн. позже дедлайна`,
    paceNeed: (v, u) => `Чтобы успеть: ${v}${u ? ' ' + u : ''} в день`,
    paceTimeVsWork: (t, p) => `Времени прошло ${t}%, сделано ${p}%`,
    paceDaysLeft: (n) => `${n} дн. до дедлайна`,
    reviewTitle: 'Обзор недели', reviewOpen: 'Посмотреть',
    reviewBanner: (n) => `${n} ${n === 1 ? 'цель ждёт' : 'целей ждут'} обзора`,
    reviewStalled: (n) => `${n} без движения на этой неделе`,
    reviewSub: 'Раз в неделю — короткий вопрос: ты всё ещё этого хочешь?',
    reviewLater: 'Позже', reviewMoved: 'На этой неделе', reviewNoMove: 'На этой неделе ничего не сдвинулось',
    reviewCheckins: (n) => `${n} дн. с шагом`, reviewMilestones: (n) => `вех: ${n}`,
    reviewProgress: (v, u) => `+${v}${u ? ' ' + u : ''}`, reviewJournal: (n) => `записей: ${n}`,
    reviewKeep: 'Веду дальше', reviewShift: 'Сдвинуть дедлайн', reviewPause: 'На паузу', reviewArchive: 'В архив',
    reviewShiftHint: 'Новый дедлайн', reviewDone: 'Обзор завершён', reviewEmpty: 'Всё просмотрено',
    whyReminder: 'Ты писал(а), зачем это:',
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
    parentLabel: 'Служит годовой цели', parentNone: 'Сама по себе',
    parentHint: 'Год — направление, месяц — шаг к нему. На годовой цели будет видно, что на неё работает.',
    parentEmpty: 'Годовых целей ещё нет — заведи одну на вкладке «Год».',
    childrenTitle: (n) => `В этом месяце над этим работают: ${n}`,
    blockersTitle: 'Что мешает чаще всего', blockersShort: 'Мешало:',
    reason_noTime: 'Не было времени', reason_forgot: 'Забыл(а)', reason_tired: 'Усталость',
    reason_mood: 'Не было настроения', reason_other: 'Другое',
    journalPlaceholder: 'Что сегодня сделал(а) для этой цели?',
    journalEmpty: 'Ещё нет заметок', journalSectionLabel: 'Дневник',
    badge_streak7: '🔥 Серия 7 дней', badge_firstDone: '🏆 Первая цель завершена',
    badge_firstStep: '🌱 Первый шаг', badge_perfect: '💯 Цель без пропусков',
    dashboardEmptyTitle: 'Пока нет целей', dashboardEmptySub: 'Добавь первую цель кнопкой внизу.',
    daysLeftLabel: (n) => `${n} дн. до дедлайна`, overdueLabel: 'Просрочено',
    milestonesCountSuffix: 'вех',
    milestoneToTask: 'В задачи', milestoneInTasks: 'В задачах',
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
    cat_health: 'Zdrowie', cat_finance: 'Finanse', cat_learning: 'Nauka', cat_career: 'Kariera',
    cat_relationships: 'Relacje', cat_travel: 'Podróże', cat_creativity: 'Kreatywność', cat_other: 'Inne',
    whyLabel: 'Po co ci to?', whyPlaceholder: 'Dlaczego ten cel jest dla ciebie ważny (opcjonalnie)',
    targetDateLabel: 'Termin (opcjonalnie)',
    milestonesLabel: 'Kamienie milowe', targetValueLabel: 'Cel liczbowy (opcjonalnie)',
    targetValueHint: 'Jeśli podasz — postęp liczy się liczbą, a nie kamieniami milowymi.',
    targetValuePlaceholder: '10', unitPlaceholder: 'km',
    addProgressPlaceholder: '+ ile', addProgressBtn: 'Dodaj', milestonePlaceholder: 'Np.: ukończyć pierwsze 5 lekcji',
    savingsLinkLabel: 'Bierz liczbę ze skarbonki', savingsLinkNone: 'Nie bierz — poprowadzę ręcznie',
    savingsLinkHint: 'Postęp policzy się z rzeczywistych operacji w «Budżecie», bez ręcznego wpisywania.',
    savingsLinkEmpty: 'W «Budżecie» nie ma jeszcze żadnej skarbonki.',
    linkedFromSavings: 'Liczba pochodzi ze skarbonki w «Budżecie»',
    milestoneDateLabel: 'Planowana data (opcjonalnie)', milestoneReorderAria: 'Przeciągnij; ↑/↓ z klawiatury',
    milestoneOverdue: (n) => `spóźnione o ${n} dni`, milestoneDue: (d) => `do ${d}`,
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
    fabNewGoalLabel: 'Nowy cel', bnMonth: 'Miesiąc', bnYear: 'Rok',
    horizonLabel: 'Horyzont', horizonMonth: 'Miesięczny', horizonYear: 'Roczny',
    horizonHint: 'Miesięczny — co robisz w tym miesiącu. Roczny — dokąd zmierzasz ogólnie.',
    emptyMonthTitle: 'Brak celów na miesiąc', emptyMonthSub: 'Co chcesz ruszyć właśnie w tym miesiącu?',
    emptyYearTitle: 'Brak celów rocznych', emptyYearSub: 'Dokąd zmierzasz w tym roku?',
    statusAll: 'Wszystkie', statusActive: 'Aktywne', statusDone: 'Ukończone', statusArchived: 'Archiwum',
    statusPaused: 'Wstrzymane', pauseBtn: 'Wstrzymaj', resumeBtn: 'Wznów',
    pausedNote: 'Cel wstrzymany: wieczorem nie pytamy o niego, a seria się nie rwie.',
    paceAhead: 'Wyprzedzasz plan', paceOnTrack: 'Zgodnie z planem',
    paceBehind: 'W tym tempie nie zdążysz', paceOverdue: 'Termin minął',
    paceUnknown: 'Za mało danych na prognozę',
    paceProjected: (d) => `W tym tempie — około ${d}`,
    paceLate: (n) => `${n} dni po terminie`,
    paceNeed: (v, u) => `Aby zdążyć: ${v}${u ? ' ' + u : ''} dziennie`,
    paceTimeVsWork: (t, p) => `Czasu minęło ${t}%, zrobione ${p}%`,
    paceDaysLeft: (n) => `${n} dni do terminu`,
    reviewTitle: 'Przegląd tygodnia', reviewOpen: 'Zobacz',
    reviewBanner: (n) => `${n} ${n === 1 ? 'cel czeka' : 'celów czeka'} na przegląd`,
    reviewStalled: (n) => `${n} bez ruchu w tym tygodniu`,
    reviewSub: 'Raz w tygodniu krótkie pytanie: czy nadal tego chcesz?',
    reviewLater: 'Później', reviewMoved: 'W tym tygodniu', reviewNoMove: 'W tym tygodniu nic się nie ruszyło',
    reviewCheckins: (n) => `${n} dni z krokiem`, reviewMilestones: (n) => `kamieni: ${n}`,
    reviewProgress: (v, u) => `+${v}${u ? ' ' + u : ''}`, reviewJournal: (n) => `wpisów: ${n}`,
    reviewKeep: 'Prowadzę dalej', reviewShift: 'Przesuń termin', reviewPause: 'Wstrzymaj', reviewArchive: 'Do archiwum',
    reviewShiftHint: 'Nowy termin', reviewDone: 'Przegląd zakończony', reviewEmpty: 'Wszystko przejrzane',
    whyReminder: 'Napisałeś(-aś), po co to:',
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
    parentLabel: 'Służy celowi rocznemu', parentNone: 'Sam w sobie',
    parentHint: 'Rok to kierunek, miesiąc to krok do niego. Na celu rocznym będzie widać, co na niego pracuje.',
    parentEmpty: 'Nie ma jeszcze celów rocznych — dodaj jeden na zakładce «Rok».',
    childrenTitle: (n) => `W tym miesiącu pracuje nad tym: ${n}`,
    blockersTitle: 'Co przeszkadza najczęściej', blockersShort: 'Przeszkadzało:',
    reason_noTime: 'Brak czasu', reason_forgot: 'Zapomniałem', reason_tired: 'Zmęczenie',
    reason_mood: 'Brak nastroju', reason_other: 'Inne',
    journalPlaceholder: 'Co dziś zrobiłeś(aś) dla tego celu?',
    journalEmpty: 'Jeszcze brak notatek', journalSectionLabel: 'Dziennik',
    badge_streak7: '🔥 Seria 7 dni', badge_firstDone: '🏆 Pierwszy ukończony cel',
    badge_firstStep: '🌱 Pierwszy krok', badge_perfect: '💯 Cel bez przerw',
    dashboardEmptyTitle: 'Jeszcze brak celów', dashboardEmptySub: 'Dodaj pierwszy cel przyciskiem poniżej.',
    daysLeftLabel: (n) => `${n} dni do terminu`, overdueLabel: 'Po terminie',
    milestonesCountSuffix: 'kam.',
    milestoneToTask: 'Do zadań', milestoneInTasks: 'W zadaniach',
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
    cat_health: 'Health', cat_finance: 'Finance', cat_learning: 'Learning', cat_career: 'Career',
    cat_relationships: 'Relationships', cat_travel: 'Travel', cat_creativity: 'Creativity', cat_other: 'Other',
    whyLabel: 'Why do you want this?', whyPlaceholder: 'Why this goal matters to you (optional)',
    targetDateLabel: 'Deadline (optional)',
    milestonesLabel: 'Milestones', targetValueLabel: 'Numeric target (optional)',
    targetValueHint: 'Set it and progress is counted by the number, not by milestones.',
    targetValuePlaceholder: '10', unitPlaceholder: 'km',
    addProgressPlaceholder: '+ how much', addProgressBtn: 'Add', milestonePlaceholder: 'E.g.: finish the first 5 lessons',
    savingsLinkLabel: 'Take the number from a savings pot', savingsLinkNone: 'No — I will track it by hand',
    savingsLinkHint: 'Progress will be counted from real entries in Budget, no manual typing.',
    savingsLinkEmpty: 'No savings pots in Budget yet.',
    linkedFromSavings: 'The number comes from a savings pot in Budget',
    milestoneDateLabel: 'Planned date (optional)', milestoneReorderAria: 'Drag to reorder; ↑/↓ from the keyboard',
    milestoneOverdue: (n) => `${n} days overdue`, milestoneDue: (d) => `by ${d}`,
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
    fabNewGoalLabel: 'New goal', bnMonth: 'Month', bnYear: 'Year',
    horizonLabel: 'Horizon', horizonMonth: 'Monthly', horizonYear: 'Yearly',
    horizonHint: 'Monthly — what you are moving this month. Yearly — where you are heading overall.',
    emptyMonthTitle: 'No goals for this month', emptyMonthSub: 'What do you want to move this month?',
    emptyYearTitle: 'No yearly goals', emptyYearSub: 'Where are you heading this year?',
    statusAll: 'All', statusActive: 'Active', statusDone: 'Done', statusArchived: 'Archived',
    statusPaused: 'Paused', pauseBtn: 'Pause this goal', resumeBtn: 'Resume',
    pausedNote: 'Paused: no evening questions, and the streak stays intact.',
    paceAhead: 'Ahead of schedule', paceOnTrack: 'On track',
    paceBehind: 'Not on pace to finish in time', paceOverdue: 'Deadline has passed',
    paceUnknown: 'Not enough history to forecast yet',
    paceProjected: (d) => `At this pace — around ${d}`,
    paceLate: (n) => `${n} days past the deadline`,
    paceNeed: (v, u) => `To finish in time: ${v}${u ? ' ' + u : ''} per day`,
    paceTimeVsWork: (t, p) => `${t}% of the time gone, ${p}% done`,
    paceDaysLeft: (n) => `${n} days to the deadline`,
    reviewTitle: 'Weekly review', reviewOpen: 'Review',
    reviewBanner: (n) => `${n} ${n === 1 ? 'goal is' : 'goals are'} due for review`,
    reviewStalled: (n) => `${n} with no movement this week`,
    reviewSub: 'Once a week, one short question: do you still want this?',
    reviewLater: 'Later', reviewMoved: 'This week', reviewNoMove: 'Nothing moved this week',
    reviewCheckins: (n) => `${n} days with a step`, reviewMilestones: (n) => `milestones: ${n}`,
    reviewProgress: (v, u) => `+${v}${u ? ' ' + u : ''}`, reviewJournal: (n) => `entries: ${n}`,
    reviewKeep: 'Keep going', reviewShift: 'Move the deadline', reviewPause: 'Pause', reviewArchive: 'Archive',
    reviewShiftHint: 'New deadline', reviewDone: 'Review done', reviewEmpty: 'All reviewed',
    whyReminder: 'You wrote why this matters:',
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
    parentLabel: 'Serves a yearly goal', parentNone: 'Stands alone',
    parentHint: 'The year is the direction, the month is a step toward it. The yearly goal will show what feeds it.',
    parentEmpty: 'No yearly goals yet — add one on the Year tab.',
    childrenTitle: (n) => `Working on this: ${n}`,
    blockersTitle: 'What gets in the way most', blockersShort: 'Blocked by:',
    reason_noTime: 'No time', reason_forgot: 'Forgot', reason_tired: 'Too tired',
    reason_mood: 'Not in the mood', reason_other: 'Other',
    journalPlaceholder: 'What did you do for this goal today?',
    journalEmpty: 'No notes yet', journalSectionLabel: 'Journal',
    badge_streak7: '🔥 7-day streak', badge_firstDone: '🏆 First goal completed',
    badge_firstStep: '🌱 First step', badge_perfect: '💯 Goal with no gaps',
    dashboardEmptyTitle: 'No goals yet', dashboardEmptySub: 'Add your first goal with the button below.',
    daysLeftLabel: (n) => `${n}d left`, overdueLabel: 'Overdue',
    milestonesCountSuffix: 'milestones',
    milestoneToTask: 'To tasks', milestoneInTasks: 'In tasks',
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
  document.getElementById('bnMonthLabel').textContent = t('bnMonth');
  document.getElementById('bnYearLabel').textContent = t('bnYear');
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
let currentScreen = 'dashboard'; // 'dashboard' | 'detail' | 'review'
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
let editingGoalId = null;
let formCategory = 'other';
let formMilestones = [];
let formSavingsGoalId = null;
let formParentGoalId = null;
let formHorizon = 'month';
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
    rawGoals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    syncSavingsSubscription(uid);
    applySavingsLink();
    renderCurrentScreen();
  }, (err) => console.error('subscribeToGoals:', err));
}

// ---- Звʼязок зі скарбничкою бюджету ----
// «Накопичити 50 тисяч» жило в застосунку двічі: ціллю тут і скарбничкою в
// бюджеті, — і прогрес довелось би вбивати руками в обох місцях. Тепер число
// береться з реальних операцій: ціль лише посилається на скарбничку, а сума
// рахується з savings, як і на сторінці бюджету.
//
// Підписку тримаємо ЛИШЕ тоді, коли хоч одна ціль справді звʼязана: платити
// читаннями за колекцію, яка нікому на цьому екрані не потрібна, — та сама
// плата без причини, якої уникають плитки на головній.
let rawGoals = [];
let savingsEntries = [];
let savingsGoalsList = [];
let unsubscribeSavings = null;
let unsubscribeSavingsGoals = null;
let savingsUid = null;

function needsSavings() {
  return rawGoals.some((g) => g && g.savingsGoalId);
}

function syncSavingsSubscription(uid) {
  const need = needsSavings();
  if (need && !unsubscribeSavings) {
    savingsUid = uid;
    const base = db.collection('users').doc(uid);
    unsubscribeSavings = base.collection('savings').onSnapshot((snap) => {
      savingsEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      applySavingsLink();
      renderCurrentScreen();
    }, (err) => console.error('savings:', err));
    unsubscribeSavingsGoals = base.collection('savingsGoals').onSnapshot((snap) => {
      savingsGoalsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCurrentScreen();
    }, (err) => console.error('savingsGoals:', err));
  } else if (!need && unsubscribeSavings) {
    stopSavings();
  }
}

function stopSavings() {
  if (unsubscribeSavings) { unsubscribeSavings(); unsubscribeSavings = null; }
  if (unsubscribeSavingsGoals) { unsubscribeSavingsGoals(); unsubscribeSavingsGoals = null; }
  savingsEntries = [];
  savingsGoalsList = [];
  savingsUid = null;
}

/** Баланс скарбнички по валютах — та сама конвенція знаків, що й у бюджеті. */
function savingsBalance(savingsGoalId) {
  const res = {};
  savingsEntries.filter((sv) => sv.goalId === savingsGoalId).forEach((sv) => {
    const cur = sv.currency || 'UAH';
    res[cur] = (res[cur] || 0) + (sv.type === 'deposit' ? Number(sv.amount) || 0 : -(Number(sv.amount) || 0));
  });
  return res;
}

/**
 * Підставляє в звʼязані цілі число з реальних грошей.
 *
 * Валюта: скарбничка може містити операції в кількох валютах, а складати їх
 * без курсу — брехня. Тому беремо ту, у якій операцій найбільше, і її ж
 * ставимо одиницею. Це чесніше за суму різних валют і не вимагає тягнути
 * сюди курси НБУ заради одного рядка.
 *
 * progressLog складаємо із самих операцій: у них уже є дати, тож темп
 * рахується без жодного окремого журналу.
 */
function applySavingsLink() {
  goals = rawGoals.map((g) => {
    if (!g.savingsGoalId) return g;
    const entries = savingsEntries.filter((sv) => sv.goalId === g.savingsGoalId);
    if (!entries.length) return { ...g, currentValue: 0, progressLog: [], linkedSavings: true };

    const counts = {};
    entries.forEach((sv) => { const c = sv.currency || 'UAH'; counts[c] = (counts[c] || 0) + 1; });
    const cur = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))[0];

    const mine = entries.filter((sv) => (sv.currency || 'UAH') === cur);
    const sum = mine.reduce((acc, sv) =>
      acc + (sv.type === 'deposit' ? Number(sv.amount) || 0 : -(Number(sv.amount) || 0)), 0);
    const log = mine
      .filter((sv) => typeof sv.date === 'string')
      .map((sv) => ({ date: sv.date, delta: sv.type === 'deposit' ? Number(sv.amount) || 0 : -(Number(sv.amount) || 0) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { ...g, currentValue: Math.max(0, Math.round(sum * 100) / 100), unit: cur, progressLog: log, linkedSavings: true };
  });
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
// Темп і черга огляду — goals/review.js. Той самий модуль читає помічник на
// сервері: інакше в чаті звучала б одна оцінка, а на екрані стояла інша.
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
  if (list.some((g) => { const p = progressOf(g); return p && p.pct === 100; })) badges.push('badge_perfect');
  return badges;
}

// ---- Рендер: дашборд ----
function renderCurrentScreen() {
  if (currentScreen === 'review') { renderReviewScreen(); return; }
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
  renderBadgesRow();
  renderReviewBanner();
  renderEveningCard();
  renderStatusFilterRow();
  renderRetro();
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
  // По ВСІХ цілях, а не лише по видимій вкладці: серія тримається на тому, що
  // людина не забула, і мовчки рватись, поки відкрито інший горизонт, вона не
  // має. Те саме з оглядом тижня нижче — це ритуал над усім списком.
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
        // «Навіщо» має сенс рівно тут: поле заповнюють на холодну голову, а
        // читати його треба тоді, коли не хочеться. Показуємо не завжди —
        // лише коли є що втрачати: серія, яку обірве саме сьогоднішній
        // пропуск. Інакше цитата стала б декором і перестала б читатись.
        const streakAtRisk = Streak.computeStreak(g.checkins, today);
        const whyBlock = g.why && streakAtRisk >= 3
          ? `<div class="evening-why">${escapeHtml(t('whyReminder'))} “${escapeHtml(g.why)}”</div>`
          : '';
        return `
        <div class="evening-goal">
          <div class="evening-goal-title">${escapeHtml(g.title || '')}${streakAtRisk >= 3 ? ` <span class="evening-streak">🔥 ${streakAtRisk}</span>` : ''}</div>
          ${whyBlock}
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
  // Скільки ціль зайняла — головне число ретроспективи, тож стоїть на самій
  // картці, а не лише в підсумку над списком.
  if (goal.status === 'done') {
    const sp = Review.goalSpan(goal, { startIso: createdIso(goal) });
    if (sp && sp.days !== null) {
      metaParts.push(`<span class="goal-card-days">${escapeHtml(sp.days === 0 ? t('goalSpanSameDay') : t('goalSpanDays', sp.days))}</span>`);
    }
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

function goalsOfHorizon() {
  return goals.filter((g) => horizonOf(g) === horizon);
}

function renderGoalsList() {
  const scoped = goalsOfHorizon();
  const list = statusFilter ? scoped.filter((g) => g.status === statusFilter) : scoped;
  const el = document.getElementById('goalsList');
  if (!list.length) {
    // Порожній екран питає рівно те, заради чого сюди зайшли, — а це різні
    // питання на різних вкладках.
    const title = horizon === 'month' ? t('emptyMonthTitle') : t('emptyYearTitle');
    const sub = horizon === 'month' ? t('emptyMonthSub') : t('emptyYearSub');
    el.innerHTML = `<div class="empty-state"><div class="title">${escapeHtml(title)}</div><div>${escapeHtml(sub)}</div></div>`;
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
  document.getElementById('reviewScreen').style.display = 'none';
  document.getElementById('dashboardScreen').style.display = '';
  renderCurrentScreen();
}
function showReview() {
  currentScreen = 'review';
  activeDetailGoalId = null;
  stopActions();
  document.getElementById('goalDetailScreen').style.display = 'none';
  document.getElementById('dashboardScreen').style.display = 'none';
  document.getElementById('reviewScreen').style.display = 'block';
  renderReviewScreen();
}
document.getElementById('detailBackBtn').addEventListener('click', showDashboard);
document.getElementById('reviewBackBtn').addEventListener('click', showDashboard);
// Вкладка «Цілі» — і повернення з екрана деталей, і просто підсвічений стан.
function selectHorizon(next) {
  horizon = next === 'year' ? 'year' : 'month';
  try { localStorage.setItem(HORIZON_KEY, horizon); } catch (err) { /* приватний режим */ }
  document.getElementById('bnMonth').classList.toggle('active', horizon === 'month');
  document.getElementById('bnYear').classList.toggle('active', horizon === 'year');
  showDashboard();
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
        ${goal.linkedSavings
          ? `<div class="linked-note">${escapeHtml(t('linkedFromSavings'))}</div>`
          : `<div class="value-add-row">
          <input type="number" id="valueAddInput" inputmode="decimal" step="any" placeholder="${escapeHtml(t('addProgressPlaceholder'))}">
          <button type="button" class="value-add-btn" id="valueAddBtn">${escapeHtml(t('addProgressBtn'))}</button>
        </div>`}
      </div>`;
    // У звʼязаної зі скарбничкою цілі полів немає — там нема що підключати,
    // і решта екрана мусить намалюватись однаково.
    const input = document.getElementById('valueAddInput');
    if (input) {
      const commit = () => {
        const delta = parseFloat(input.value);
        if (!Number.isFinite(delta) || delta === 0) return;
        input.value = '';
        addGoalProgress(goal.id, delta);
      };
      document.getElementById('valueAddBtn').addEventListener('click', commit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    }
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

  renderPaceBlock(goal);

  renderJourney(goal);
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

  renderLadder(goal);
  renderBlockers(goal);
  renderPauseRow(goal);
  renderJournalList(goal);
}

// ---- Огляд тижня ----
// Той самий каркас, що й «розбір минулих днів» у завданнях і «регулярні
// операції» в бюджеті: банер каже, що настало, окремий екран дає вирішити,
// і НІЧОГО не вирішується само. Довгі цілі гинуть не тому, що важкі, а тому,
// що про них забувають — і через півроку це вже чуже сміття в списку.
const REVIEW_DISMISS_KEY = 'goalsReviewDismissed';

function renderReviewBanner() {
  const host = document.getElementById('reviewBanner');
  if (!host) return;
  const today = todayISO();
  // «Пізніше» ховає банер до кінця дня, а не назавжди: завтра питання
  // актуальне знову. Так само, як із боргами в завданнях.
  if (localStorage.getItem(REVIEW_DISMISS_KEY) === today) { host.innerHTML = ''; return; }
  // Свідомо по всіх горизонтах — див. коментар у вечірній картці.
  const digest = Review.reviewDigest(goals, today);
  if (!digest.pending) { host.innerHTML = ''; return; }

  host.innerHTML = `
    <div class="review-banner">
      <div id="reviewBannerBtn" style="flex:1;cursor:pointer;">
        <div class="review-banner-text">${escapeHtml(t('reviewBanner', digest.pending))}</div>
        ${digest.stalled ? `<div class="review-banner-sub">${escapeHtml(t('reviewStalled', digest.stalled))}</div>` : ''}
      </div>
      <span class="review-banner-go" id="reviewBannerGo">${escapeHtml(t('reviewOpen'))} →</span>
      <button type="button" class="review-later" id="reviewLaterBtn">${escapeHtml(t('reviewLater'))}</button>
    </div>`;
  const open = () => showReview();
  document.getElementById('reviewBannerBtn').addEventListener('click', open);
  document.getElementById('reviewBannerGo').addEventListener('click', open);
  document.getElementById('reviewLaterBtn').addEventListener('click', () => {
    localStorage.setItem(REVIEW_DISMISS_KEY, todayISO());
    renderReviewBanner();
  });
}

function movementChips(item, goal) {
  const m = item.movement;
  if (!m || !m.moved) return `<div class="review-moved">${escapeHtml(t('reviewNoMove'))}</div>`;
  const chips = [];
  if (m.checkins) chips.push(t('reviewCheckins', m.checkins));
  if (m.progressDelta) chips.push(t('reviewProgress', fmtValue(m.progressDelta), goal.unit || ''));
  if (m.milestonesDone) chips.push(t('reviewMilestones', m.milestonesDone));
  if (m.journal) chips.push(t('reviewJournal', m.journal));
  return `
    <div class="review-moved">${escapeHtml(t('reviewMoved'))}</div>
    <div class="review-chips">${chips.map((c) => `<span class="review-chip">${escapeHtml(c)}</span>`).join('')}</div>`;
}

// В огляді причини йдуть одним рядком, а не чипами: там і так щільно, а
// питання тижня — «ти досі цього хочеш», і причини тут лише підказка до
// відповіді, а не окремий блок.
function blockersLine(goal) {
  const top = Streak.blockerStats(goal, 2);
  if (!top.length) return '';
  const text = top.map((b) => `${blockerLabel(b.reason)} (${b.count})`).join(', ');
  return `<div class="review-blockers">${escapeHtml(t('blockersShort'))} ${escapeHtml(text)}</div>`;
}

function renderReviewScreen() {
  document.getElementById('reviewTitleLabel').textContent = t('reviewTitle');
  document.getElementById('reviewSubLabel').textContent = t('reviewSub');
  const host = document.getElementById('reviewList');
  const today = todayISO();
  const queue = Review.reviewQueue(goals, today);

  if (!queue.length) {
    host.innerHTML = `<div class="review-empty">${escapeHtml(t('reviewEmpty'))}</div>`;
    return;
  }

  host.innerHTML = queue.map((goal) => {
    const item = Review.reviewItem(goal, today, { startIso: createdIso(goal) });
    const p = item.pace;
    const VERDICT = { ahead: 'paceAhead', onTrack: 'paceOnTrack', behind: 'paceBehind',
      overdue: 'paceOverdue', unknown: 'paceUnknown' };
    return `
      <div class="review-item" data-review="${goal.id}">
        <div class="review-item-title">${escapeHtml(goal.title)}</div>
        ${p ? `<div class="pace ${p.verdict}" style="margin:10px 0 0;">
            <div class="pace-head"><span class="pace-dot"></span>${escapeHtml(t(VERDICT[p.verdict] || 'paceUnknown'))}</div>
          </div>` : ''}
        ${movementChips(item, goal)}
        ${goal.why ? `<div class="review-why">${escapeHtml(t('whyReminder'))} “${escapeHtml(goal.why)}”</div>` : ''}
        ${blockersLine(goal)}
        <div class="review-actions">
          <button type="button" class="review-btn primary" data-keep="${goal.id}">${escapeHtml(t('reviewKeep'))}</button>
          <button type="button" class="review-btn" data-shift="${goal.id}">${escapeHtml(t('reviewShift'))}</button>
          <button type="button" class="review-btn" data-pause="${goal.id}">${escapeHtml(goal.status === 'paused' ? t('resumeBtn') : t('reviewPause'))}</button>
          <button type="button" class="review-btn" data-archive="${goal.id}">${escapeHtml(t('reviewArchive'))}</button>
        </div>
        <div class="review-shift-row" data-shift-row="${goal.id}" style="display:none;">
          <input type="date" data-shift-input="${goal.id}" value="${escapeHtml(goal.targetDate || '')}">
          <button type="button" class="review-btn primary" data-shift-save="${goal.id}">${escapeHtml(t('reviewKeep'))}</button>
        </div>
      </div>`;
  }).join('');

  host.querySelectorAll('[data-keep]').forEach((btn) => {
    btn.addEventListener('click', () => markReviewed(btn.dataset.keep));
  });
  host.querySelectorAll('[data-pause]').forEach((btn) => {
    const goal = goals.find((g) => g.id === btn.dataset.pause);
    btn.addEventListener('click', () =>
      markReviewed(btn.dataset.pause, { status: goal && goal.status === 'paused' ? 'active' : 'paused' }));
  });
  host.querySelectorAll('[data-archive]').forEach((btn) => {
    btn.addEventListener('click', () => markReviewed(btn.dataset.archive, { status: 'archived' }));
  });
  // Зсув дедлайну розкриває поле, а не питає в prompt(): дату вводять
  // календарем, і бачити поточну перед зміною важливо.
  host.querySelectorAll('[data-shift]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = host.querySelector(`[data-shift-row="${btn.dataset.shift}"]`);
      if (row) row.style.display = row.style.display === 'none' ? 'flex' : 'none';
    });
  });
  host.querySelectorAll('[data-shift-save]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.shiftSave;
      const input = host.querySelector(`[data-shift-input="${id}"]`);
      const value = input && input.value;
      markReviewed(id, value ? { targetDate: value } : {});
    });
  });
}

// Огляд завершено — ціль виходить із черги на тиждень. Патч дописується тим
// самим записом, тож «на паузу» і «оглянуто» це одна дія, а не дві.
async function markReviewed(goalId, patch) {
  if (!auth.currentUser) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    ...(patch || {}),
    reviewedAt: todayISO(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('markReviewed:', err));
  // Черга перерахується з живих даних, коли долетить onSnapshot; але екран
  // має відреагувати одразу — інакше здається, що тап не спрацював.
  const goal = goals.find((g) => g.id === goalId);
  if (goal) Object.assign(goal, patch || {}, { reviewedAt: todayISO() });
  renderReviewScreen();
}

// ---- Темп: чи встигаєш до дедлайну ----
// Рахує goals/review.js — тут лише слова навколо його чисел. Головне рішення
// модуля видно й тут: поки історії мало, показуємо чесне «даних замало», а не
// прогноз упевненим тоном. Порада без підстав гірша за мовчання.
function renderPaceBlock(goal) {
  const el = document.getElementById('detailPaceBlock');
  const p = Review.pace(goal, todayISO(), { startIso: createdIso(goal) });
  if (!p) { el.innerHTML = ''; return; }

  const VERDICT = { ahead: 'paceAhead', onTrack: 'paceOnTrack', behind: 'paceBehind',
    overdue: 'paceOverdue', unknown: 'paceUnknown' };
  const lines = [];

  if (p.verdict === 'overdue') {
    lines.push(t('paceLate', Math.abs(p.daysLeft)));
  } else {
    if (p.enough && p.projectedDate) {
      lines.push(t('paceProjected', formatDateShort(p.projectedDate)));
      if (p.diffDays > 0) lines.push(t('paceLate', p.diffDays));
    } else if (p.kind === 'value' && p.requiredPerDay !== null) {
      lines.push(t('paceNeed', fmtValue(Math.ceil(p.requiredPerDay * 100) / 100), goal.unit || ''));
    } else {
      lines.push(t('paceTimeVsWork', p.timePct, p.pct));
    }
    if (p.daysLeft >= 0) lines.push(t('paceDaysLeft', p.daysLeft));
  }

  el.innerHTML = `
    <div class="pace ${p.verdict}">
      <div class="pace-head"><span class="pace-dot"></span>${escapeHtml(t(VERDICT[p.verdict] || 'paceUnknown'))}</div>
      <div class="pace-sub">${escapeHtml(lines.join(' · '))}</div>
    </div>`;
}

// createdAt приходить із Firestore як Timestamp; темпу потрібен день, від
// якого рахувати «скільки часу вже минуло». Якщо поля ще немає (щойно
// створений документ до підтвердження сервером) — review.js сам візьме
// найраніший слід у даних.
function createdIso(goal) {
  const ts = goal && goal.createdAt;
  if (ts && typeof ts.toDate === 'function') return Streak.isoOf(ts.toDate());
  return null;
}

// ---- Драбина: місяць -> рік ----
// Річна ціль показує, що на неї працює; місячна — кому вона служить. Обидва
// боки клікабельні, бо звʼязок без переходу — це напис, а не звʼязок.
//
// Прогрес дитини рахуємо тим самим правилом, що й усюди (progressOf), а не
// власним: два способи міряти той самий шлях розійшлися б.
function renderLadder(goal) {
  const parentEl = document.getElementById('detailParentBlock');
  const childrenEl = document.getElementById('detailChildrenBlock');

  const parent = goal.parentGoalId ? goals.find((g) => g.id === goal.parentGoalId) : null;
  parentEl.innerHTML = parent
    ? `<button type="button" class="parent-link" id="parentLinkBtn">
         <span class="parent-link-arrow">↑</span>${escapeHtml(parent.title || '')}
       </button>`
    : '';
  if (parent) {
    document.getElementById('parentLinkBtn').addEventListener('click', () => showGoalDetail(parent.id));
  }

  // Діти є лише в річної цілі, і показуємо їх навіть закритими: закрита
  // місячна ціль — це якраз доказ, що рік рухається.
  const children = goals.filter((g) => g.parentGoalId === goal.id);
  if (!children.length) { childrenEl.innerHTML = ''; return; }
  childrenEl.innerHTML = `
    <div class="children-block">
      <div class="children-title">${escapeHtml(t('childrenTitle', children.length))}</div>
      ${children.map((c) => {
        const prog = progressOf(c);
        const done = c.status === 'done';
        return `<div class="child-row${done ? ' done' : ''}" data-child="${escapeHtml(c.id)}">
          <span class="child-title">${escapeHtml(c.title || '')}</span>
          <span class="child-pct">${done ? '✓' : (prog ? prog.pct + '%' : '')}</span>
        </div>`;
      }).join('')}
    </div>`;
  childrenEl.querySelectorAll('[data-child]').forEach((row) => {
    row.addEventListener('click', () => showGoalDetail(row.dataset.child));
  });
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

// ---- Пауза ----
// Раніше вибір був між «щовечора нагадувати» і «поховати в архів». Пауза —
// це третє: ціль жива, але про неї свідомо не питають. Серія при цьому не
// рветься, бо eveningQueue бере лише активні.
function renderPauseRow(goal) {
  const el = document.getElementById('detailPauseRow');
  if (goal.status === 'done' || goal.status === 'archived') { el.innerHTML = ''; return; }
  const paused = goal.status === 'paused';
  el.innerHTML = `
    <div class="pause-row">
      <button type="button" class="pause-btn" id="pauseToggleBtn">${escapeHtml(paused ? t('resumeBtn') : t('pauseBtn'))}</button>
    </div>`;
  document.getElementById('pauseToggleBtn').addEventListener('click', () => {
    setGoalStatus(goal.id, paused ? 'active' : 'paused');
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
        // Маршрут теж: кнопка «у завдання» на віхі показує, чи завдання вже
        // є, а знає про це саме цей список.
        const goal = goals.find((g) => g.id === goalId);
        if (goal) renderJourney(goal);
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
        <div class="journey-label">${escapeHtml(m.title)}${isNext ? `<span class="journey-next-badge">${escapeHtml(t('nextStopBadge'))}</span>` : ''}${milestoneDueHtml(m)}</div>
        ${milestoneTaskBtnHtml(m)}
      </div>`;
  }).join('') + '</div>';
  return html;
}
// Дата віхи, якщо вона є. Прострочену показуємо окремим кольором: це те
// саме, що застосунок робить із дедлайном цілі, тільки на крок нижче —
// «мала бути три тижні тому» помітно конкретніше за просто невиконаний пункт.
// У вже пройденій віхі дата ні до чого: там питання закрите.
function milestoneDueHtml(m) {
  if (!m || m.done || !m.date) return '';
  const left = Streak.daysBetween(todayISO(), m.date);
  const overdue = left < 0;
  const text = overdue ? t('milestoneOverdue', Math.abs(left)) : t('milestoneDue', formatDateShort(m.date));
  return `<span class="journey-due${overdue ? ' overdue' : ''}">${escapeHtml(text)}</span>`;
}

function renderJourney(goal) {
  document.getElementById('detailJourneyBlock').innerHTML = journeyHtml(goal);
  wireJourneyEvents(goal);
}

// Віха — це те, що треба зробити, але зробити її можна тільки «колись»:
// підсвічена «наступна зупинка» ні до чого не веде. Кнопка переносить її в
// завдання на дату самої віхи, і крок нарешті потрапляє туди, куди людина
// дивиться щодня.
//
// Завдання вже створене впізнаємо за назвою: у віхи немає власного id
// всередині завдання, а заводити ще одне поле заради кнопки — забагато.
// Збіг назв усередині однієї цілі означає, що це та сама справа.
function milestoneTask(m) {
  if (!m || !m.title) return null;
  return goalActions.find((a) => a && !a.done && a.title === m.title) || null;
}

function milestoneTaskBtnHtml(m) {
  if (!m || m.done) return '';
  const existing = milestoneTask(m);
  if (existing) {
    return `<span class="journey-task-mark" title="${escapeHtml(t('milestoneInTasks'))}">${escapeHtml(t('milestoneInTasks'))}</span>`;
  }
  return `<button type="button" class="journey-task-btn" data-milestone-task="${m.id}">${escapeHtml(t('milestoneToTask'))}</button>`;
}

function wireJourneyEvents(goal) {
  const block = document.getElementById('detailJourneyBlock');
  block.querySelectorAll('[data-toggle-milestone]').forEach((btn) => {
    btn.addEventListener('click', () => toggleMilestone(goal.id, btn.dataset.toggleMilestone));
  });
  block.querySelectorAll('[data-milestone-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = (goal.milestones || []).find((x) => x.id === btn.dataset.milestoneTask);
      if (!m || milestoneTask(m)) return;
      // Дата віхи — це план, і саме на неї завдання й ставимо. Без дати
      // ставимо на сьогодні: завдання без дати нікуди не спливе.
      addAction(goal.id, m.title, m.date || todayISO());
    });
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
  // Саме число показує смужка, але одне число не памʼятає, КОЛИ прогрес був —
  // а без цього не порахувати ні темп, ні рух за тиждень. Тому поруч росте
  // журнал: currentValue лишається сумою, progressLog — історією.
  let log = [...(goal.progressLog || []), { date: todayISO(), delta: Math.round(delta * 100) / 100 }];
  if (log.length > 400) log = log.slice(log.length - 400);
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    currentValue: next, progressLog: log,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('addGoalProgress:', err));
}

async function toggleMilestone(goalId, milestoneId) {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !auth.currentUser) return;
  // doneAt — день, коли віху реально закрили. Без нього тижневий огляд не
  // може сказати «цього тижня зроблено дві віхи»: у самій віхі стоїть лише
  // done, і вчорашня галочка не відрізняється від торішньої.
  const next = (goal.milestones || []).map((m) => {
    if (m.id !== milestoneId) return m;
    const done = !m.done;
    const updated = { ...m, done };
    if (done) updated.doneAt = todayISO();
    else delete updated.doneAt;
    return updated;
  });
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
function renderHorizonPicker() {
  document.getElementById('horizonLabel').textContent = t('horizonLabel');
  document.getElementById('horizonHint').textContent = t('horizonHint');
  const picker = document.getElementById('horizonPicker');
  const options = [['month', t('horizonMonth')], ['year', t('horizonYear')]];
  picker.innerHTML = options.map(([val, label]) =>
    `<button type="button" class="choice${formHorizon === val ? ' selected' : ''}" data-horizon="${val}">${escapeHtml(label)}</button>`
  ).join('');
  picker.querySelectorAll('[data-horizon]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formHorizon = btn.dataset.horizon;
      // Річна ціль нікому не служить — звʼязок при перемиканні знімається,
      // інакше він тихо лишився б у записі й спливав при поверненні назад.
      if (formHorizon !== 'month') formParentGoalId = null;
      renderHorizonPicker();
      renderParentPicker();
    });
  });
}

// Драбина: рік — напрямок, місяці — кроки до нього. Без цього поля дві
// вкладки лишались просто двома списками, які нічого одне про одного не знають.
//
// Пікер показуємо тільки на МІСЯЧНІЙ цілі: підпорядковувати річну ціль комусь
// ні до чого, а вибір «служить самій собі» був би безглуздим.
function renderParentPicker() {
  const block = document.getElementById('parentBlock');
  if (formHorizon !== 'month') { block.style.display = 'none'; return; }

  const candidates = goals.filter((g) =>
    horizonOf(g) === 'year' && (g.status === 'active' || g.status === 'paused') && g.id !== editingGoalId);
  if (!candidates.length) {
    // Річних цілей ще немає — не показуємо порожній вибір, а пояснюємо, чому.
    block.style.display = 'block';
    document.getElementById('parentLabel').textContent = t('parentLabel');
    document.getElementById('parentPicker').innerHTML = '';
    document.getElementById('parentHint').textContent = t('parentEmpty');
    return;
  }

  block.style.display = 'block';
  document.getElementById('parentLabel').textContent = t('parentLabel');
  document.getElementById('parentHint').textContent = t('parentHint');
  const options = [[null, t('parentNone')]].concat(candidates.map((g) => [g.id, g.title || '']));
  const picker = document.getElementById('parentPicker');
  picker.innerHTML = options.map(([id, label]) =>
    `<button type="button" class="choice${formParentGoalId === id ? ' selected' : ''}" data-parent="${id === null ? '' : escapeHtml(id)}">${escapeHtml(label)}</button>`
  ).join('');
  picker.querySelectorAll('[data-parent]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formParentGoalId = btn.dataset.parent || null;
      renderParentPicker();
    });
  });
}

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
    <div class="milestone-editor-row" data-idx="${i}" data-mid="${escapeHtml(m.id)}">
      <button type="button" class="milestone-drag" data-drag-milestone="${escapeHtml(m.id)}"
        aria-label="${escapeHtml(t('milestoneReorderAria'))}" title="${escapeHtml(t('milestoneReorderAria'))}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>
      </button>
      <div class="milestone-fields">
        <input type="text" data-milestone-title="${i}" value="${escapeHtml(m.title)}" placeholder="${escapeHtml(t('milestonePlaceholder'))}" maxlength="200">
        <input type="date" class="milestone-date" data-milestone-date="${i}" value="${escapeHtml(m.date || '')}" title="${escapeHtml(t('milestoneDateLabel'))}">
      </div>
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
  // Дата віхи необовʼязкова. Коли вона є, віха перестає бути просто галочкою
  // й починає годувати темп: «мала бути три тижні тому» — це вже відповідь
  // на «чи встигаю», а не просто невиконаний пункт.
  el.querySelectorAll('[data-milestone-date]').forEach((input) => {
    input.addEventListener('change', () => {
      const idx = Number(input.dataset.milestoneDate);
      if (formMilestones[idx]) formMilestones[idx].date = input.value || '';
    });
  });
  el.querySelectorAll('[data-remove-milestone]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeMilestone);
      formMilestones.splice(idx, 1);
      renderMilestonesEditor();
    });
  });
  attachMilestoneDrag(el);
}

// ---- Порядок віх: перетягування ----
// Віхи — це кроки в тому порядку, у якому їх робитимуть, і переставити їх
// хочеться саме тоді, коли список уже набраний. Підхід той самий, що й із
// вправами у workout/app.js: pointer events (HTML5 drag-and-drop на тач-екранах
// не працює), під час жесту нічого не перемальовується — рядок ведемо
// transform'ом, сусідні зсуваємо, а масив переставляємо один раз на
// відпусканні. Перемальовування на кожен рух гасило б фокус у полях.
const MS_ROW_GAP = 8;
let msDrag = null;

function beginMilestoneDrag(e, handle) {
  if (msDrag) return;
  const host = document.getElementById('milestonesEditor');
  const rows = [...host.querySelectorAll('.milestone-editor-row')];
  const rowEl = handle.closest('.milestone-editor-row');
  const from = rows.indexOf(rowEl);
  if (from < 0 || rows.length < 2) return;

  e.preventDefault();
  msDrag = {
    pointerId: e.pointerId, rows,
    rects: rows.map((r) => r.getBoundingClientRect()),
    from, to: from, startY: e.clientY,
  };
  rowEl.classList.add('dragging');
  handle.setPointerCapture(e.pointerId);
}

function moveMilestoneDrag(e) {
  if (!msDrag || e.pointerId !== msDrag.pointerId) return;
  const { rows, rects, from } = msDrag;
  const dy = e.clientY - msDrag.startY;
  rows[from].style.transform = `translateY(${dy}px)`;

  const center = rects[from].top + rects[from].height / 2 + dy;
  let to = from;
  rects.forEach((r, i) => {
    if (i === from) return;
    const mid = r.top + r.height / 2;
    if (i > from && center > mid) to = Math.max(to, i);
    if (i < from && center < mid) to = Math.min(to, i);
  });
  msDrag.to = to;

  const shift = rects[from].height + MS_ROW_GAP;
  rows.forEach((r, i) => {
    if (i === from) return;
    let offset = 0;
    if (from < i && i <= to) offset = -shift;
    else if (from > i && i >= to) offset = shift;
    r.style.transform = offset ? `translateY(${offset}px)` : '';
  });
}

function endMilestoneDrag(e) {
  if (!msDrag || (e && e.pointerId !== msDrag.pointerId)) return;
  const { from, to } = msDrag;
  msDrag = null;
  if (from !== to) formMilestones.splice(to, 0, formMilestones.splice(from, 1)[0]);
  // Перемальовуємо в будь-якому разі — це заразом прибирає transform'и,
  // класи й перенумеровує індекси в data-атрибутах.
  renderMilestonesEditor();
}

function attachMilestoneDrag(root) {
  root.querySelectorAll('[data-drag-milestone]').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => beginMilestoneDrag(e, handle));
    handle.addEventListener('pointermove', moveMilestoneDrag);
    handle.addEventListener('pointerup', endMilestoneDrag);
    // Скасований жест (системний свайп, вхідний дзвінок) має лишити список
    // таким, як був, а не завмерти на півдорозі.
    handle.addEventListener('pointercancel', endMilestoneDrag);
    // З клавіатури те саме: на компʼютері швидше за мишу, а для доступності —
    // єдиний спосіб узагалі.
    handle.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const id = handle.dataset.dragMilestone;
      const from = formMilestones.findIndex((m) => m.id === id);
      const to = from + (e.key === 'ArrowUp' ? -1 : 1);
      if (from < 0 || to < 0 || to >= formMilestones.length) return;
      formMilestones.splice(to, 0, formMilestones.splice(from, 1)[0]);
      renderMilestonesEditor();
      const next = document.querySelector(`[data-drag-milestone="${id}"]`);
      if (next) next.focus();
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
  formSavingsGoalId = existingGoal ? existingGoal.savingsGoalId || null : null;
  // Нова ціль народжується на тій вкладці, з якої її заводять: людина щойно
  // дивилась на місяць — значить, і думає про місяць.
  formHorizon = existingGoal ? horizonOf(existingGoal) : horizon;
  formParentGoalId = existingGoal ? existingGoal.parentGoalId || null : null;
  renderHorizonPicker();
  renderParentPicker();
  renderCategoryPicker();
  renderMilestonesEditor();
  renderSavingsLink();
  loadSavingsGoalsForPicker();
  document.getElementById('breakdownNote').textContent = '';
  goalGuard.arm();
  document.getElementById('goalTargetValue').removeEventListener('input', renderSavingsLink);
  document.getElementById('goalTargetValue').addEventListener('input', renderSavingsLink);
  document.getElementById('goalFormOverlay').classList.add('show');
  setTimeout(() => document.getElementById('goalTitleInput').focus(), 50);
}

// Скарбнички читаємо разовим запитом і лише коли форму відкрито: підписка на
// цілу колекцію заради списку у вікні, яке буває раз на місяць, — плата без
// причини. Той самий підхід, що й в експорті на головному екрані.
let savingsPickerList = null;
async function loadSavingsGoalsForPicker() {
  if (!auth.currentUser) return;
  if (savingsPickerList) { renderSavingsLink(); return; }
  try {
    const snap = await db.collection('users').doc(auth.currentUser.uid).collection('savingsGoals').get();
    savingsPickerList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('savingsGoals picker:', err);
    savingsPickerList = [];
  }
  renderSavingsLink();
}

function renderSavingsLink() {
  const block = document.getElementById('savingsLinkBlock');
  const hasTarget = parseFloat(document.getElementById('goalTargetValue').value) > 0;
  // Без числової мети підтягувати нема куди: скарбничка дає число, а не віхи.
  block.style.display = hasTarget ? 'block' : 'none';
  if (!hasTarget) return;

  document.getElementById('savingsLinkLabel').textContent = t('savingsLinkLabel');
  const hint = document.getElementById('savingsLinkHint');
  const picker = document.getElementById('savingsLinkPicker');

  if (savingsPickerList === null) { picker.innerHTML = ''; hint.textContent = ''; return; }
  if (!savingsPickerList.length) {
    picker.innerHTML = '';
    hint.textContent = t('savingsLinkEmpty');
    return;
  }
  hint.textContent = t('savingsLinkHint');
  const options = [[null, t('savingsLinkNone')]].concat(
    savingsPickerList.map((sg) => [sg.id, sg.name || t('savingsLinkLabel')]));
  picker.innerHTML = options.map(([id, label]) =>
    `<button type="button" class="choice${formSavingsGoalId === id ? ' selected' : ''}" data-savings="${id === null ? '' : escapeHtml(id)}">${escapeHtml(label)}</button>`
  ).join('');
  picker.querySelectorAll('[data-savings]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formSavingsGoalId = btn.dataset.savings || null;
      renderSavingsLink();
    });
  });
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
    savingsGoalId: formSavingsGoalId,
    horizon: formHorizon,
    parentGoalId: formParentGoalId,
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
    // date (план) і doneAt (факт) переносимо як є: форма їх не редагує
    // напряму — інакше редагування назви стирало б і те, й те.
    .map((m) => {
      const out = { id: m.id, title: (m.title || '').trim(), done: !!m.done };
      if (m.date) out.date = m.date;
      if (m.doneAt) out.doneAt = m.doneAt;
      return out;
    })
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
    // Звʼязок зі скарбничкою тримається на числовій меті: без неї підтягувати
    // нема куди, тож і посилання зберігати ні до чого.
    savingsGoalId: targetValue ? formSavingsGoalId || null : null,
    horizon: formHorizon === 'month' ? 'month' : 'year',
    parentGoalId: formHorizon === 'month' ? formParentGoalId || null : null,
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
    stopSavings();
    savingsPickerList = null;
    goals = [];
    rawGoals = [];
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
// Вкладка запамʼятовується: людина, яка живе місячними цілями, не має щоразу
// перемикатись із «Року» після кожного відкриття.
document.getElementById('bnMonth').classList.toggle('active', horizon === 'month');
document.getElementById('bnYear').classList.toggle('active', horizon === 'year');
initDatePicker('goalTargetDate');
applyTheme();
applyTranslations();
renderAuthLangRow();
setAuthMode('login');
