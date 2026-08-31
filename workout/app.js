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
// Ті самі мови й ключі localStorage, що й у budget/app.js, tasks/app.js та
// home.js — вибір мови/теми лишається синхронізованим по всьому сайту.
const LANGS = ['uk', 'ru', 'pl', 'en'];
const LANG_NAMES = { uk: 'UA', ru: 'RU', pl: 'PL', en: 'EN' };
const LOCALE_MAP = { uk: 'uk-UA', ru: 'ru-RU', pl: 'pl-PL', en: 'en-US' };

// ---- Невелика вбудована бібліотека вправ ----
// id — стабільний ключ (не перекладається, зберігається в документі),
// muscle — група м'язів для групування у пікері й на екрані рекордів.
// Бібліотека вправ і їхні назви — у workout/exercises.js: той самий список
// читає Cloud Function AI-помічника, коли записує тренування з чату.
const { EXERCISE_LIB, MUSCLE_ORDER, exerciseLabel: libLabel } = window.WorkoutExercises;

const T = {
  uk: {
    pageTitle: 'Тренування',
    tabSessions: 'Тренування', tabRecords: 'Рекорди',
    newSessionLabel: 'Нове тренування',
    newSessionTitle: 'Нове тренування', editSessionTitle: 'Редагувати тренування',
    sessionNamePlaceholder: 'Назва (необовʼязково)',
    sessionDateLabel: 'Дата',
    dpTodayBtn: 'Сьогодні',
    exercisesLabel: 'Вправи', addExerciseLabel: 'Додати вправу',
    sessionNotesLabel: 'Нотатка', sessionNotesPlaceholder: 'Як пройшло тренування? (необовʼязково)',
    saveBtn: 'Зберегти', deleteBtn: 'Видалити',
    noExerciseError: 'Додай хоча б одну вправу',
    confirmDeleteSessionTitle: 'Видалити тренування?', confirmDeleteSessionSub: 'Цю дію не можна скасувати.',
    confirmDeleteExerciseTitle: 'Видалити вправу зі списку?',
    confirmDeleteExerciseSub: 'Вона зникне з вибору. Записані тренування з нею лишаться недоторканими.',
    deleteExerciseAria: 'Видалити вправу зі списку',
    cancelBtn: 'Скасувати', deleteConfirmBtn: 'Видалити',
    unsavedTitle: 'Зберегти зміни?',
    unsavedSub: 'Є незбережені зміни. Якщо вийти зараз, вони пропадуть.',
    unsavedSave: 'Зберегти', unsavedDiscard: 'Не зберігати', unsavedKeep: 'Продовжити редагування',
    templatesTitle: 'Шаблони', manageTemplates: 'Керувати шаблонами',
    reorderExercise: 'Перемістити вправу',
    calPrevMonth: 'Попередній місяць', calNextMonth: 'Наступний місяць',
    calDayHasWorkout: '— є тренування', calShowAll: 'Усі дні',
    saveAsTemplate: 'Зберегти як шаблон', templateSaved: 'Збережено ✓',
    exCount: (n) => `${n} ${plural(n, { one: 'вправа', few: 'вправи', many: 'вправ', other: 'вправи' })}`,
    setCount: (n) => `${n} ${plural(n, { one: 'підхід', few: 'підходи', many: 'підходів', other: 'підходу' })}`,
    templateNeedsName: 'Дай тренуванню назву — вона буде на кнопці шаблону',
    templateEmpty: 'Шаблонів ще немає. Набери тренування як звичайно й натисни «Зберегти як шаблон» — далі ті самі вправи заводитимуться одним тапом, лишиться тільки виставити вагу.',
    templateLimit: (n) => `Більше ${n} шаблонів — це вже щоденник. Видали зайві у списку шаблонів.`,
    pickerTitle: 'Обрати вправу', pickerSearchPlaceholder: 'Пошук вправи…',
    pickerCustomLabel: 'Додати свою вправу', pickerCustomPlaceholder: 'Назва вправи', pickerCustomAdd: 'Додати',
    pickerCustomMuscleLabel: 'Група мʼязів', pickerCustomNeedMuscle: 'Обери, на яку групу мʼязів ця вправа',
    pickerCustomExisting: 'Уже є у списку — просто додано',
    setPlaceholderWeight: 'кг', setPlaceholderReps: 'повт.', addSetLabel: '+ Підхід',
    lastTimeLabel: (w, r) => (w ? `Минулого разу: ${w}×${r}` : `Минулого разу: ${r} разів`),
    nextTryLabel: (w, r) => (w ? `Спробуй: ${w}×${r}` : `Спробуй: ${r} разів`),
    nextTryHold: 'та сама вага', nextTryUp: 'вага росте', nextTryDown: 'вага вниз',
    nextTryMoreReps: 'плюс повторення',
    progressTitle: 'Прогрес за 4 тижні',
    progressUp: 'Ти став сильнішим', progressFlat: 'Тримаєш рівень', progressDown: 'Сила просіла',
    progressStrength: (pct) => `Сила ${pct > 0 ? '+' : ''}${pct}%`,
    progressSessions: (n, prev) => `${n} ${plural(n, { one: 'тренування', few: 'тренування', many: 'тренувань' })} · місяць тому ${prev}`,
    progressNotEnough: (n) => `Замало даних — ще ${n} ${plural(n, { one: 'тренування', few: 'тренування', many: 'тренувань' })}, і зʼявиться порівняння з минулим місяцем.`,
    progressNoCompare: 'Ще немає з чим порівнювати — потрібен місяць історії тих самих вправ.',
    progressVolumeLabel: 'Обсяг', progressNewMark: 'нове',
    planTitle: 'План на сьогодні',
    creditTitle: 'Зарахувати в ціль', creditDay: 'Зарахувати день',
    creditCounted: 'День зараховано',
    // Без дієслова: «Спина відпочивали» — так не кажуть, а рід і число
    // назв мʼязів різні.
    planRested: (m, d) => `${m} — ${d} ${plural(d, { one: 'день', few: 'дні', many: 'днів' })} відпочинку`,
    planRestDay: 'Усі групи тренувались щойно. Дай їм день — і повертайся.',
    planStartBtn: 'Почати тренування',
    readyLabel: 'Як почуваєшся?',
    ready_ready: '🟢 Готовий', ready_ok: '🟡 Так собі', ready_low: '🔴 Розбитий',
    readyNoteOk: 'Обсяг трохи менший, вага не росте — сьогодні без геройства.',
    readyNoteLow: 'Легка сесія: два підходи й менша вага. Пропустити теж нормально.',
    unitKg: 'кг', unitReps: 'повт.',
    nextTryAddLoad: 'час на обтяження', nextTryFill: 'Підставити',
    prToastText: (name, w, r) => `Новий рекорд: ${name} — ${w}×${r}`,
    emptySessionsTitle: 'Ще немає тренувань', emptySessionsSub: 'Додай перше тренування кнопкою внизу.',
    emptyRecordsTitle: 'Ще немає рекордів', emptyRecordsSub: 'Записуй тренування — рекорди зʼявляться тут.',
    exMore: (n) => `ще ${n}`,
    historyBestLabel: 'Найкраще', historyEstLabel: '1ПМ (оцінка)', historySessionsLabel: 'Тренувань',
    prBadge: 'PR', trendUp: (p) => `+${p}% від першого разу`, trendFlat: 'Без змін',
    muscle_chest: "Груди", muscle_back: 'Спина', muscle_legs: 'Ноги', muscle_shoulders: 'Плечі', muscle_arms: 'Руки', muscle_core: 'Кор',
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
    err_permission: 'Сервер відхилив запис — схоже, правила доступу Firestore ще не опубліковані.',
    err_resetGeneric: 'Не вдалося надіслати лист. Спробуй пізніше.',
  },
  ru: {
    pageTitle: 'Тренировки',
    tabSessions: 'Тренировки', tabRecords: 'Рекорды',
    newSessionLabel: 'Новая тренировка',
    newSessionTitle: 'Новая тренировка', editSessionTitle: 'Редактировать тренировку',
    sessionNamePlaceholder: 'Название (необязательно)',
    sessionDateLabel: 'Дата',
    dpTodayBtn: 'Сегодня',
    exercisesLabel: 'Упражнения', addExerciseLabel: 'Добавить упражнение',
    sessionNotesLabel: 'Заметка', sessionNotesPlaceholder: 'Как прошла тренировка? (необязательно)',
    saveBtn: 'Сохранить', deleteBtn: 'Удалить',
    noExerciseError: 'Добавь хотя бы одно упражнение',
    confirmDeleteSessionTitle: 'Удалить тренировку?', confirmDeleteSessionSub: 'Это действие нельзя отменить.',
    confirmDeleteExerciseTitle: 'Удалить упражнение из списка?',
    confirmDeleteExerciseSub: 'Оно исчезнет из выбора. Записанные тренировки с ним останутся нетронутыми.',
    deleteExerciseAria: 'Удалить упражнение из списка',
    cancelBtn: 'Отмена', deleteConfirmBtn: 'Удалить',
    unsavedTitle: 'Сохранить изменения?',
    unsavedSub: 'Есть несохранённые изменения. Если выйти сейчас, они пропадут.',
    unsavedSave: 'Сохранить', unsavedDiscard: 'Не сохранять', unsavedKeep: 'Продолжить редактирование',
    templatesTitle: 'Шаблоны', manageTemplates: 'Управлять шаблонами',
    reorderExercise: 'Переместить упражнение',
    calPrevMonth: 'Предыдущий месяц', calNextMonth: 'Следующий месяц',
    calDayHasWorkout: '— есть тренировка', calShowAll: 'Все дни',
    saveAsTemplate: 'Сохранить как шаблон', templateSaved: 'Сохранено ✓',
    exCount: (n) => `${n} ${plural(n, { one: 'упражнение', few: 'упражнения', many: 'упражнений', other: 'упражнения' })}`,
    setCount: (n) => `${n} ${plural(n, { one: 'подход', few: 'подхода', many: 'подходов', other: 'подхода' })}`,
    templateNeedsName: 'Дай тренировке название — оно будет на кнопке шаблона',
    templateEmpty: 'Шаблонов пока нет. Набери тренировку как обычно и нажми «Сохранить как шаблон» — дальше те же упражнения будут заводиться одним тапом, останется только выставить вес.',
    templateLimit: (n) => `Больше ${n} шаблонов — это уже дневник. Удали лишние в списке шаблонов.`,
    pickerTitle: 'Выбрать упражнение', pickerSearchPlaceholder: 'Поиск упражнения…',
    pickerCustomLabel: 'Добавить своё упражнение', pickerCustomPlaceholder: 'Название упражнения', pickerCustomAdd: 'Добавить',
    pickerCustomMuscleLabel: 'Группа мышц', pickerCustomNeedMuscle: 'Выбери, на какую группу мышц это упражнение',
    pickerCustomExisting: 'Уже есть в списке — просто добавлено',
    setPlaceholderWeight: 'кг', setPlaceholderReps: 'повт.', addSetLabel: '+ Подход',
    lastTimeLabel: (w, r) => (w ? `В прошлый раз: ${w}×${r}` : `В прошлый раз: ${r} раз`),
    nextTryLabel: (w, r) => (w ? `Попробуй: ${w}×${r}` : `Попробуй: ${r} раз`),
    nextTryHold: 'тот же вес', nextTryUp: 'вес растёт', nextTryDown: 'вес вниз',
    nextTryMoreReps: 'плюс повторение',
    progressTitle: 'Прогресс за 4 недели',
    progressUp: 'Ты стал сильнее', progressFlat: 'Держишь уровень', progressDown: 'Сила просела',
    progressStrength: (pct) => `Сила ${pct > 0 ? '+' : ''}${pct}%`,
    progressSessions: (n, prev) => `${n} ${plural(n, { one: 'тренировка', few: 'тренировки', many: 'тренировок' })} · месяц назад ${prev}`,
    progressNotEnough: (n) => `Мало данных — ещё ${n} ${plural(n, { one: 'тренировка', few: 'тренировки', many: 'тренировок' })}, и появится сравнение с прошлым месяцем.`,
    progressNoCompare: 'Пока не с чем сравнивать — нужен месяц истории тех же упражнений.',
    progressVolumeLabel: 'Объём', progressNewMark: 'новое',
    planTitle: 'План на сегодня',
    creditTitle: 'Засчитать в цель', creditDay: 'Засчитать день',
    creditCounted: 'День засчитан',
    planRested: (m, d) => `${m} — ${d} ${plural(d, { one: 'день', few: 'дня', many: 'дней' })} отдыха`,
    planRestDay: 'Все группы тренировались только что. Дай им день — и возвращайся.',
    planStartBtn: 'Начать тренировку',
    readyLabel: 'Как самочувствие?',
    ready_ready: '🟢 Готов', ready_ok: '🟡 Так себе', ready_low: '🔴 Разбит',
    readyNoteOk: 'Объём чуть меньше, вес не растёт — сегодня без геройства.',
    readyNoteLow: 'Лёгкая сессия: два подхода и меньший вес. Пропустить тоже нормально.',
    unitKg: 'кг', unitReps: 'повт.',
    nextTryAddLoad: 'пора на отягощение', nextTryFill: 'Подставить',
    prToastText: (name, w, r) => `Новый рекорд: ${name} — ${w}×${r}`,
    emptySessionsTitle: 'Пока нет тренировок', emptySessionsSub: 'Добавь первую тренировку кнопкой внизу.',
    emptyRecordsTitle: 'Пока нет рекордов', emptyRecordsSub: 'Записывай тренировки — рекорды появятся здесь.',
    exMore: (n) => `ещё ${n}`,
    historyBestLabel: 'Лучшее', historyEstLabel: '1ПМ (оценка)', historySessionsLabel: 'Тренировок',
    prBadge: 'PR', trendUp: (p) => `+${p}% с первого раза`, trendFlat: 'Без изменений',
    muscle_chest: 'Грудь', muscle_back: 'Спина', muscle_legs: 'Ноги', muscle_shoulders: 'Плечи', muscle_arms: 'Руки', muscle_core: 'Кор',
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
    err_permission: 'Сервер отклонил запись — похоже, правила доступа Firestore ещё не опубликованы.',
    err_resetGeneric: 'Не удалось отправить письмо. Попробуй позже.',
  },
  pl: {
    pageTitle: 'Treningi',
    tabSessions: 'Treningi', tabRecords: 'Rekordy',
    newSessionLabel: 'Nowy trening',
    newSessionTitle: 'Nowy trening', editSessionTitle: 'Edytuj trening',
    sessionNamePlaceholder: 'Nazwa (opcjonalnie)',
    sessionDateLabel: 'Data',
    dpTodayBtn: 'Dziś',
    exercisesLabel: 'Ćwiczenia', addExerciseLabel: 'Dodaj ćwiczenie',
    sessionNotesLabel: 'Notatka', sessionNotesPlaceholder: 'Jak poszedł trening? (opcjonalnie)',
    saveBtn: 'Zapisz', deleteBtn: 'Usuń',
    noExerciseError: 'Dodaj przynajmniej jedno ćwiczenie',
    confirmDeleteSessionTitle: 'Usunąć trening?', confirmDeleteSessionSub: 'Tej czynności nie można cofnąć.',
    confirmDeleteExerciseTitle: 'Usunąć ćwiczenie z listy?',
    confirmDeleteExerciseSub: 'Zniknie z wyboru. Zapisane treningi z nim pozostaną nienaruszone.',
    deleteExerciseAria: 'Usuń ćwiczenie z listy',
    cancelBtn: 'Anuluj', deleteConfirmBtn: 'Usuń',
    unsavedTitle: 'Zapisać zmiany?',
    unsavedSub: 'Są niezapisane zmiany. Jeśli teraz wyjdziesz, przepadną.',
    unsavedSave: 'Zapisz', unsavedDiscard: 'Nie zapisuj', unsavedKeep: 'Wróć do edycji',
    templatesTitle: 'Szablony', manageTemplates: 'Zarządzaj szablonami',
    reorderExercise: 'Przenieś ćwiczenie',
    calPrevMonth: 'Poprzedni miesiąc', calNextMonth: 'Następny miesiąc',
    calDayHasWorkout: '— jest trening', calShowAll: 'Wszystkie dni',
    saveAsTemplate: 'Zapisz jako szablon', templateSaved: 'Zapisano ✓',
    exCount: (n) => `${n} ${plural(n, { one: 'ćwiczenie', few: 'ćwiczenia', many: 'ćwiczeń', other: 'ćwiczenia' })}`,
    setCount: (n) => `${n} ${plural(n, { one: 'seria', few: 'serie', many: 'serii', other: 'serii' })}`,
    templateNeedsName: 'Nadaj treningowi nazwę — będzie na przycisku szablonu',
    templateEmpty: 'Nie ma jeszcze szablonów. Wpisz trening jak zwykle i naciśnij „Zapisz jako szablon" — potem te same ćwiczenia dodasz jednym tapnięciem, zostanie tylko ustawić ciężar.',
    templateLimit: (n) => `Więcej niż ${n} szablonów to już dziennik. Usuń zbędne na liście szablonów.`,
    pickerTitle: 'Wybierz ćwiczenie', pickerSearchPlaceholder: 'Szukaj ćwiczenia…',
    pickerCustomLabel: 'Dodaj własne ćwiczenie', pickerCustomPlaceholder: 'Nazwa ćwiczenia', pickerCustomAdd: 'Dodaj',
    pickerCustomMuscleLabel: 'Partia mięśniowa', pickerCustomNeedMuscle: 'Wybierz, na którą partię jest to ćwiczenie',
    pickerCustomExisting: 'Już jest na liście — po prostu dodano',
    setPlaceholderWeight: 'kg', setPlaceholderReps: 'powt.', addSetLabel: '+ Seria',
    lastTimeLabel: (w, r) => (w ? `Poprzednio: ${w}×${r}` : `Poprzednio: ${r} powtórzeń`),
    nextTryLabel: (w, r) => (w ? `Spróbuj: ${w}×${r}` : `Spróbuj: ${r} powtórzeń`),
    nextTryHold: 'ten sam ciężar', nextTryUp: 'ciężar rośnie', nextTryDown: 'ciężar w dół',
    nextTryMoreReps: 'więcej powtórzeń',
    progressTitle: 'Postęp z 4 tygodni',
    progressUp: 'Jesteś silniejszy', progressFlat: 'Utrzymujesz poziom', progressDown: 'Siła spadła',
    progressStrength: (pct) => `Siła ${pct > 0 ? '+' : ''}${pct}%`,
    progressSessions: (n, prev) => `${n} ${plural(n, { one: 'trening', few: 'treningi', many: 'treningów' })} · miesiąc temu ${prev}`,
    progressNotEnough: (n) => `Za mało danych — jeszcze ${n} ${plural(n, { one: 'trening', few: 'treningi', many: 'treningów' })} i pojawi się porównanie z poprzednim miesiącem.`,
    progressNoCompare: 'Nie ma jeszcze do czego porównać — potrzeba miesiąca historii tych samych ćwiczeń.',
    progressVolumeLabel: 'Objętość', progressNewMark: 'nowe',
    planTitle: 'Plan na dziś',
    creditTitle: 'Zalicz do celu', creditDay: 'Zalicz dzień',
    creditCounted: 'Dzień zaliczony',
    planRested: (m, d) => `${m} — ${d} ${plural(d, { one: 'dzień', few: 'dni', many: 'dni' })} odpoczynku`,
    planRestDay: 'Wszystkie partie trenowane były przed chwilą. Daj im dzień i wracaj.',
    planStartBtn: 'Zacznij trening',
    readyLabel: 'Jak się czujesz?',
    ready_ready: '🟢 Gotowy', ready_ok: '🟡 Tak sobie', ready_low: '🔴 Rozbity',
    readyNoteOk: 'Objętość nieco mniejsza, ciężar nie rośnie — dziś bez bohaterstwa.',
    readyNoteLow: 'Lekka sesja: dwie serie i mniejszy ciężar. Odpuścić też jest w porządku.',
    unitKg: 'kg', unitReps: 'powt.',
    nextTryAddLoad: 'czas na obciążenie', nextTryFill: 'Wstaw',
    prToastText: (name, w, r) => `Nowy rekord: ${name} — ${w}×${r}`,
    emptySessionsTitle: 'Brak treningów', emptySessionsSub: 'Dodaj pierwszy trening przyciskiem poniżej.',
    emptyRecordsTitle: 'Brak rekordów', emptyRecordsSub: 'Zapisuj treningi — rekordy pojawią się tutaj.',
    exMore: (n) => `jeszcze ${n}`,
    historyBestLabel: 'Najlepszy', historyEstLabel: '1RM (szac.)', historySessionsLabel: 'Treningów',
    prBadge: 'PR', trendUp: (p) => `+${p}% od pierwszego razu`, trendFlat: 'Bez zmian',
    muscle_chest: 'Klatka', muscle_back: 'Plecy', muscle_legs: 'Nogi', muscle_shoulders: 'Barki', muscle_arms: 'Ręce', muscle_core: 'Core',
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
    err_permission: 'Serwer odrzucił zapis — wygląda na to, że reguły Firestore nie zostały opublikowane.',
    err_resetGeneric: 'Nie udało się wysłać wiadomości. Spróbuj później.',
  },
  en: {
    pageTitle: 'Workouts',
    tabSessions: 'Workouts', tabRecords: 'Records',
    newSessionLabel: 'New workout',
    newSessionTitle: 'New workout', editSessionTitle: 'Edit workout',
    sessionNamePlaceholder: 'Name (optional)',
    sessionDateLabel: 'Date',
    dpTodayBtn: 'Today',
    exercisesLabel: 'Exercises', addExerciseLabel: 'Add exercise',
    sessionNotesLabel: 'Notes', sessionNotesPlaceholder: 'How did the workout go? (optional)',
    saveBtn: 'Save', deleteBtn: 'Delete',
    noExerciseError: 'Add at least one exercise',
    confirmDeleteSessionTitle: 'Delete workout?', confirmDeleteSessionSub: 'This action cannot be undone.',
    confirmDeleteExerciseTitle: 'Remove exercise from the list?',
    confirmDeleteExerciseSub: 'It disappears from the picker. Workouts already logged with it stay untouched.',
    deleteExerciseAria: 'Remove exercise from the list',
    cancelBtn: 'Cancel', deleteConfirmBtn: 'Delete',
    unsavedTitle: 'Save changes?',
    unsavedSub: 'There are unsaved changes. Leaving now discards them.',
    unsavedSave: 'Save', unsavedDiscard: "Don't save", unsavedKeep: 'Keep editing',
    templatesTitle: 'Templates', manageTemplates: 'Manage templates',
    reorderExercise: 'Move exercise',
    calPrevMonth: 'Previous month', calNextMonth: 'Next month',
    calDayHasWorkout: '— has a workout', calShowAll: 'All days',
    saveAsTemplate: 'Save as template', templateSaved: 'Saved ✓',
    exCount: (n) => `${n} ${plural(n, { one: 'exercise', other: 'exercises' })}`,
    setCount: (n) => `${n} ${plural(n, { one: 'set', other: 'sets' })}`,
    templateNeedsName: 'Name the workout — that name goes on the template button',
    templateEmpty: 'No templates yet. Enter a workout as usual and hit "Save as template" — after that the same exercises come back with one tap and you only set the weight.',
    templateLimit: (n) => `More than ${n} templates is a diary of its own. Remove some from the template list.`,
    pickerTitle: 'Choose exercise', pickerSearchPlaceholder: 'Search exercise…',
    pickerCustomLabel: 'Add custom exercise', pickerCustomPlaceholder: 'Exercise name', pickerCustomAdd: 'Add',
    pickerCustomMuscleLabel: 'Muscle group', pickerCustomNeedMuscle: 'Pick which muscle group this exercise targets',
    pickerCustomExisting: 'Already on the list — just added',
    setPlaceholderWeight: 'kg', setPlaceholderReps: 'reps', addSetLabel: '+ Set',
    lastTimeLabel: (w, r) => (w ? `Last time: ${w}×${r}` : `Last time: ${r} reps`),
    nextTryLabel: (w, r) => (w ? `Try: ${w}×${r}` : `Try: ${r} reps`),
    nextTryHold: 'same weight', nextTryUp: 'weight goes up', nextTryDown: 'weight goes down',
    nextTryMoreReps: 'more reps',
    progressTitle: 'Last 4 weeks',
    progressUp: 'You got stronger', progressFlat: 'Holding steady', progressDown: 'Strength dipped',
    progressStrength: (pct) => `Strength ${pct > 0 ? '+' : ''}${pct}%`,
    progressSessions: (n, prev) => `${n} ${plural(n, { one: 'workout', other: 'workouts' })} · ${prev} a month ago`,
    progressNotEnough: (n) => `Not enough data — ${n} more ${plural(n, { one: 'workout', other: 'workouts' })} and the month-over-month comparison appears.`,
    progressNoCompare: 'Nothing to compare yet — needs a month of history on the same exercises.',
    progressVolumeLabel: 'Volume', progressNewMark: 'new',
    planTitle: 'Today',
    creditTitle: 'Count toward a goal', creditDay: 'Count the day',
    creditCounted: 'Day counted',
    planRested: (m, d) => `${m} — rested ${d} ${plural(d, { one: 'day', other: 'days' })}`,
    planRestDay: 'Everything was trained just now. Give it a day and come back.',
    planStartBtn: 'Start workout',
    readyLabel: 'How do you feel?',
    ready_ready: '🟢 Ready', ready_ok: '🟡 So-so', ready_low: '🔴 Wrecked',
    readyNoteOk: 'Slightly less volume, no weight increase — no heroics today.',
    readyNoteLow: 'Light session: two sets and less weight. Skipping is fine too.',
    unitKg: 'kg', unitReps: 'reps',
    nextTryAddLoad: 'time to add load', nextTryFill: 'Fill in',
    prToastText: (name, w, r) => `New PR: ${name} — ${w}×${r}`,
    emptySessionsTitle: 'No workouts yet', emptySessionsSub: 'Add your first workout with the button below.',
    emptyRecordsTitle: 'No records yet', emptyRecordsSub: 'Log workouts — your records will show up here.',
    exMore: (n) => `+${n} more`,
    historyBestLabel: 'Best', historyEstLabel: 'Est. 1RM', historySessionsLabel: 'Workouts',
    prBadge: 'PR', trendUp: (p) => `+${p}% since first log`, trendFlat: 'No change',
    muscle_chest: 'Chest', muscle_back: 'Back', muscle_legs: 'Legs', muscle_shoulders: 'Shoulders', muscle_arms: 'Arms', muscle_core: 'Core',
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
    err_permission: 'The server rejected the write — the Firestore rules seem not to be published yet.',
    err_resetGeneric: 'Could not send the email. Try again later.',
  },
};

let currentLang = localStorage.getItem('financeAppLang') || 'uk';
if (!LANGS.includes(currentLang)) currentLang = 'uk';
function t(key, ...args) {
  const val = (T[currentLang] && T[currentLang][key]) || T.uk[key] || key;
  return typeof val === 'function' ? val(...args) : val;
}
function exerciseLabel(libId) { return libLabel(libId, currentLang); }
// «3 тренувань» — так не кажуть. Форму слова бере Intl, а не ланцюжок if:
// правила у чотирьох мовах різні, і вгадувати їх вручну немає потреби.
function plural(n, forms) {
  var locale = LOCALE_MAP[currentLang] || 'uk-UA';
  var cat = 'other';
  try { cat = new Intl.PluralRules(locale).select(n); } catch (err) { cat = 'other'; }
  return forms[cat] || forms.other || forms.many || '';
}
function muscleLabel(muscle) { return t(`muscle_${muscle}`); }

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
  renderCurrentScreen();
}

// ---- Переклад статичних елементів ----
// ---- Бічна колонка розділів (лише широкий екран) ----
// Розмітку й назви розділів тримає ../side-nav.js — одні на всі пʼять
// сторінок. Експорту й теми тут немає навмисно: вони живуть на головній,
// і кнопка, яка веде на іншу сторінку щось зробити, — це не кнопка.
window.SideNav.mount(document.getElementById('sideNavHost'), {
  current: 'workout',
  base: '../',
  lang: currentLang,
});

function applyTranslations() {
  document.getElementById('htmlRoot').setAttribute('lang', currentLang);
  window.SideNav.setLang(currentLang);
  document.title = `${t('pageTitle')} · Life`;
  document.getElementById('bnSessionsLabel').textContent = t('tabSessions');
  document.getElementById('bnRecordsLabel').textContent = t('tabRecords');
  document.getElementById('newSessionBtn').setAttribute('aria-label', t('newSessionLabel'));
  document.getElementById('sessionNameInput').placeholder = t('sessionNamePlaceholder');
  document.getElementById('sessionDateLabel').textContent = t('sessionDateLabel');
  document.getElementById('exercisesLabel').textContent = t('exercisesLabel');
  document.getElementById('addExerciseLabel').textContent = t('addExerciseLabel');
  document.getElementById('sessionNotesLabel').textContent = t('sessionNotesLabel');
  document.getElementById('sessionNotesInput').placeholder = t('sessionNotesPlaceholder');
  document.getElementById('deleteSessionBtn').textContent = t('deleteBtn');
  document.getElementById('sessionSubmitBtn').textContent = t('saveBtn');
  applyConfirmTexts();
  document.getElementById('confirmCancel').textContent = t('cancelBtn');
  document.getElementById('confirmDelete').textContent = t('deleteConfirmBtn');
  document.getElementById('templatesTitle').textContent = t('templatesTitle');
  document.getElementById('saveAsTemplateBtn').textContent = t('saveAsTemplate');
  renderTemplateRow();
  document.getElementById('pickerTitle').textContent = t('pickerTitle');
  document.getElementById('pickerSearch').placeholder = t('pickerSearchPlaceholder');
  document.getElementById('pickerCustomLabel').textContent = t('pickerCustomLabel');
  document.getElementById('pickerCustomInput').placeholder = t('pickerCustomPlaceholder');
  document.getElementById('pickerCustomAdd').textContent = t('pickerCustomAdd');
  document.getElementById('pickerCustomMuscleLabel').textContent = t('pickerCustomMuscleLabel');
  renderPickerCustomMuscleRow();
  document.getElementById('authSub').textContent = t('authSub');
  document.getElementById('authEmailLabel').textContent = t('emailLabel');
  document.getElementById('authPasswordLabel').textContent = t('passwordLabel');
  document.getElementById('authPasswordHint').textContent = t('passwordHint');
  document.getElementById('rememberMeLabel').textContent = t('rememberMe');
  document.getElementById('forgotPasswordLink').textContent = t('forgotPassword');
  setAuthMode(authMode);
  refreshDatePickersLang();
}

// Firestore відмовляє записом permission-denied, коли правила для колекції
// ще не опубліковані. Загальне «щось пішло не так» тут лише збиває з
// пантелику: з нього не видно ні причини, ні що робити далі.
function writeErrorMessage(err) {
  return t(err && err.code === 'permission-denied' ? 'err_permission' : 'err_generic');
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
function pad2(n) {
  return String(n).padStart(2, '0');
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid4() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`).slice(0, 36);
}
// Парсить "YYYY-MM-DD" як ЛОКАЛЬНУ дату (без часу) — на відміну від
// `new Date("YYYY-MM-DD")`, який трактує рядок як UTC-північ і в поясах
// з від'ємним зсувом зсуває дату на день назад.
function parseISODate(s) {
  if (!s) return new Date(NaN);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
// Короткі назви днів тижня, понеділок першим — для кастомного datepicker.
function weekdayShortLabels() {
  const fmt = new Intl.DateTimeFormat(LOCALE_MAP[currentLang] || 'uk-UA', { weekday: 'short' });
  const monday = new Date(2024, 0, 1); // відомий понеділок
  const labels = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    labels.push(fmt.format(d));
  }
  return labels;
}
function fmtNum(n) {
  // Прибирає зайві .0, залишає до 2 знаків після коми (для дробової ваги).
  return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : '0';
}
function dayLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(LOCALE_MAP[currentLang] || 'uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });
}
function shortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(LOCALE_MAP[currentLang] || 'uk-UA', { day: 'numeric', month: 'short' });
}
// Оцінка одноповторного максимуму (формула Epley) — використовується лише
// для внутрішнього ранжування прогресу, не показується як точна цифра.
function epley1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}
// Ключ вправи для групування/пошуку історії: бібліотечні вправи — за
// стабільним id (незалежно від мови), власні зі списку — за стабільним id
// свого документа (можна перейменувати, ключ не зʼїде), а стара власна
// вправа без customId (записана до цієї фічі) — за нормалізованою назвою,
// як і раніше.
function exerciseKey(ex) {
  if (ex.libId) return `lib:${ex.libId}`;
  if (ex.customId) return `custom:${ex.customId}`;
  return `c:${(ex.name || '').trim().toLowerCase()}`;
}
function exerciseDisplayName(ex) {
  return ex.libId ? exerciseLabel(ex.libId) : (ex.name || '');
}

// ---- Кастомний datepicker ----
// Замінює нативний календар браузера (input type=date) на панель у стилі
// застосунку — так само, як у budget/ і tasks/. Нативний <input> лишається в
// DOM (прихований, але функціональний): увесь існуючий код
// (`sessionDateInput.value = ...`) працює без змін, бо сеттер `.value`
// перехоплено, щоб кастомний UI оновлювався синхронно. Місяці/дні тижня —
// через Intl, без ручних словників перекладу.
const datePickerInstances = [];
function initDatePicker(nativeId) {
  const native = document.getElementById(nativeId);
  if (!native || native.dataset.dpInit) return;
  native.dataset.dpInit = '1';

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
    '<div class="dp-foot"><button type="button" class="dp-today-btn"></button></div>';
  // Панель монтуємо в <body>, а не всередину .dp-field: .modal має
  // overflow-y:auto, що обрізало б випадаючий календар знизу.
  document.body.appendChild(panel);

  const triggerText = trigger.querySelector('.dp-trigger-text');
  const headLabel = panel.querySelector('.dp-head-label');
  const weekdaysEl = panel.querySelector('.dp-weekdays');
  const daysEl = panel.querySelector('.dp-days');
  const todayBtn = panel.querySelector('.dp-today-btn');
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
      triggerText.textContent = '—';
      triggerText.classList.add('dp-placeholder');
      return;
    }
    const locale = LOCALE_MAP[currentLang] || 'uk-UA';
    triggerText.textContent = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(sel);
    triggerText.classList.remove('dp-placeholder');
  }

  function renderPanel() {
    const locale = LOCALE_MAP[currentLang] || 'uk-UA';
    const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1));
    headLabel.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    weekdaysEl.innerHTML = weekdayShortLabels().map((w) => '<div class="dp-weekday">' + escapeHtml(w) + '</div>').join('');
    todayBtn.textContent = t('dpTodayBtn');

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

  // Перехоплюємо .value, щоб `nativeInput.value = '...'` (як робить решта
  // коду застосунку) синхронно оновлювало кастомний UI.
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

// ---- Стан ----
let sessions = [];
let unsubscribeSessions = null;
// Самопочуття на сьогодні: 'ready' | 'ok' | 'low' або null, поки не питали.
let readiness = null;
let unsubscribeReadiness = null;
// Цілі здоровʼя: тренування вміє зарахуватись у них просто тут, не
// змушуючи йти в інший розділ і повторювати те саме руками.
let goals = [];
let unsubscribeGoals = null;
// Власні вправи людини — ті, яких немає в бібліотеці. Зберігаються окремо
// від тренувань (users/{uid}/customExercises), тож обрана один раз вправа
// лишається в пікері для наступних тренувань, а не набирається щоразу
// наново.
let customExercises = []; // [{ id, name, muscle, createdAt }]
let unsubscribeCustomExercises = null;
let activeTab = 'sessions';
let editingSessionId = null;
let formExercises = []; // [{ id, libId, customId, name, muscle, sets:[{weight, reps}] }]
let pendingDeleteId = null;
// Підтвердження одне на два випадки — тренування й власна вправа, — тож
// саме воно й вирішує, який текст показати і в яку колекцію писати.
let pendingDeleteKind = 'session'; // 'session' | 'customExercise'
let pickerTargetBlockId = null; // якщо задано — заміна вправи в існуючому блоці, інакше — новий блок
let templates = [];
let unsubscribeTemplates = null;
// Календар на екрані тренувань: який місяць показано і чи звужено список
// до одного дня (null — показані всі).
let calMonth = todayISO().slice(0, 7); // 'YYYY-MM'
let calSelectedDate = null;
let pickerCustomMuscle = null; // обрана група мʼязів для нової своєї вправи в пікері

// ---- Дані (Firestore, реалтайм) ----
function subscribeToSessions(uid) {
  if (unsubscribeSessions) unsubscribeSessions();
  const col = db.collection('users').doc(uid).collection('workouts');
  unsubscribeSessions = col.onSnapshot((snap) => {
    sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCurrentScreen();
  }, (err) => console.error('subscribeToSessions:', err));
}

function subscribeToTemplates(uid) {
  if (unsubscribeTemplates) unsubscribeTemplates();
  const col = db.collection('users').doc(uid).collection('workoutTemplates');
  unsubscribeTemplates = col.onSnapshot((snap) => {
    templates = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    renderTemplateRow();
    if (document.getElementById('templatesOverlay').classList.contains('show')) renderTemplateManageList();
  }, (err) => console.error('subscribeToTemplates:', err));
}

// Один документ на добу, id — сама дата: перезапис замість накопичення
// й нуль зайвих читань.
function subscribeToReadiness(uid) {
  if (unsubscribeReadiness) unsubscribeReadiness();
  unsubscribeReadiness = db.collection('users').doc(uid).collection('readiness').doc(todayISO())
    .onSnapshot((doc) => {
      const data = doc.exists ? (doc.data() || {}) : {};
      readiness = data.level || null;
      renderCurrentScreen();
    }, (err) => console.error('subscribeToReadiness:', err));
}

// Категорії цілей людина редагує в розділі «Цілі», і сюди вони потрібні рівно
// заради одного: зрозуміти, чи існує ще категорія 'health', за якою
// відбирається, що зарахувати після тренування. `null` — профіль ще не
// приїхав або списку в ньому немає (значить, стандартний, а в ньому 'health'
// є), і тоді відбір лишається таким, як був.
let goalCategoryIds = null;
let unsubscribeGoalCategories = null;

function subscribeToGoalCategories(uid) {
  if (unsubscribeGoalCategories) unsubscribeGoalCategories();
  unsubscribeGoalCategories = db.collection('users').doc(uid).onSnapshot((doc) => {
    const data = doc.data();
    const list = data && Array.isArray(data.categoriesGoals) ? data.categoriesGoals : null;
    goalCategoryIds = list && list.length ? list.map((c) => c && c.id) : null;
    renderCurrentScreen();
  }, (err) => console.error('subscribeToGoalCategories:', err));
}

function subscribeToGoals(uid) {
  if (unsubscribeGoals) unsubscribeGoals();
  unsubscribeGoals = db.collection('users').doc(uid).collection('goals')
    .onSnapshot((snap) => {
      goals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCurrentScreen();
    }, (err) => console.error('subscribeToGoals:', err));
}

// Сортуємо за назвою одразу тут — інакше довелось би робити це при
// кожному рендері пікера.
function subscribeToCustomExercises(uid) {
  if (unsubscribeCustomExercises) unsubscribeCustomExercises();
  const col = db.collection('users').doc(uid).collection('customExercises');
  unsubscribeCustomExercises = col.onSnapshot((snap) => {
    customExercises = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (document.getElementById('exercisePickerOverlay').classList.contains('show')) {
      renderPickerGroups(document.getElementById('pickerSearch').value);
    }
  }, (err) => console.error('subscribeToCustomExercises:', err));
}

async function setReadiness(level) {
  if (!auth.currentUser) return;
  // Повторний дотик по тій самій кнопці знімає відповідь: людина могла
  // промахнутись, і застрягти в «розбитий» до півночі було б безглуздо.
  const next = readiness === level ? null : level;
  const ref = db.collection('users').doc(auth.currentUser.uid).collection('readiness').doc(todayISO());
  readiness = next;   // не чекаємо на сервер: кнопка має відповідати одразу
  renderCurrentScreen();
  try {
    if (!next) await ref.delete();
    else await ref.set({ level: next, date: todayISO(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  } catch (err) {
    console.error('setReadiness:', err);
  }
}

function sortedSessions() {
  return [...sessions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const ca = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const cb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return cb - ca;
  });
}

// Найкращий підхід вправи (найважча вага, при рівності — більше повторень).
// Підхід без повторень — це план, а не результат: у тренуванні, записаному
// наперед, такі стоять порожні. Нуль повторень означає «ще не зроблено» всюди
// в модулі (див. progress.js, progression.js, plan.js), і рекорди з
// підказками беруться лише з реально виконаного.
function bestSet(sets) {
  const done = (sets || []).filter((s) => Number(s.reps) > 0);
  if (!done.length) return null;
  return done.sort((a, b) => (b.weight - a.weight) || (b.reps - a.reps))[0];
}

// ---- Обчислення записів (PR) по всій історії ----
function computeRecords(excludeSessionId) {
  const map = new Map(); // key -> { key, name, muscle, best:{weight,reps,date}, first:{weight,reps,date}, sessionsCount }
  const list = sortedSessions().filter((s) => s.id !== excludeSessionId);
  // Ідемо від найстарішого до найновішого, щоб коректно зафіксувати "перший запис".
  const chrono = [...list].reverse();
  chrono.forEach((session) => {
    (session.exercises || []).forEach((ex) => {
      const key = exerciseKey(ex);
      const best = bestSet(ex.sets);
      if (!best || (!best.weight && !best.reps)) return;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          key, libId: ex.libId || null, name: exerciseDisplayName(ex), muscle: ex.muscle || null,
          best: { ...best, date: session.date }, first: { ...best, date: session.date }, sessionsCount: 0,
        };
        map.set(key, entry);
      }
      entry.sessionsCount += 1;
      entry.name = exerciseDisplayName(ex); // завжди свіже локалізоване імʼя
      const bestScore = epley1RM(entry.best.weight, entry.best.reps);
      const curScore = epley1RM(best.weight, best.reps);
      // Для вправ із власною вагою обидва «бали» — нулі (Еплі від нульової
      // ваги дає нуль), тож рекорд стояв на першому ж записі й не рухався
      // ніколи. Там, де ваги немає, рекорд міряється повтореннями.
      const better = curScore > bestScore
        || (curScore === bestScore && best.weight > entry.best.weight)
        || (curScore === 0 && bestScore === 0 && best.reps > entry.best.reps);
      if (better) entry.best = { ...best, date: session.date };
    });
  });
  return map;
}

function historyForExercise(key) {
  const rows = [];
  sortedSessions().forEach((session) => {
    (session.exercises || []).forEach((ex) => {
      if (exerciseKey(ex) !== key) return;
      const best = bestSet(ex.sets);
      if (!best) return;
      rows.push({ date: session.date, best, name: exerciseDisplayName(ex) });
    });
  });
  return rows; // вже відсортовано за датою спадно (sortedSessions)
}

// ---- Рендер ----
function renderCurrentScreen() {
  if (activeTab === 'sessions') renderSessionsTab(); else renderRecordsTab();
}

// ---- План на сьогодні ----
// Найперше питання в залі — не «яку вагу», а «що взагалі робити». Тут
// показуємо групу, яка найдовше відпочивала, і її звичні вправи з уже
// порахованими вагами. Нічого не вигадується: у плані лише те, що людина
// вже робила.
function renderPlanCard() {
  const list = sortedSessions();
  // Сьогодні вже тренувався — план більше ні до чого й зникає сам,
  // без жодних «сховати на сьогодні».
  if (list.some((s) => s.date === todayISO())) return '';

  const plan = window.WorkoutPlan.suggestSession(sessions, todayISO());
  if (!plan) return '';
  if (plan.rest) {
    return `
      <div class="plan-card">
        <div class="plan-title">${escapeHtml(t('planTitle'))}</div>
        <div class="plan-rest">${escapeHtml(t('planRestDay'))}</div>
      </div>`;
  }

  const names = plan.muscles.map((m) => muscleLabel(m.muscle));
  const head = names.join(' + ');
  const why = t('planRested', names[0], plan.muscles[0].daysAgo);
  // Самопочуття зсуває план, а не замінює його: та сама сесія, менший
  // обсяг. Сну й пульсу застосунок не знає, тож питаємо навпростець.
  const shown = window.WorkoutPlan.adjustForReadiness(plan.exercises, readiness);
  const note = readiness === 'ok' ? t('readyNoteOk') : (readiness === 'low' ? t('readyNoteLow') : '');

  return `
    <div class="plan-card">
      <div class="plan-title">${escapeHtml(t('planTitle'))}</div>
      <div class="plan-head">${escapeHtml(head)}</div>
      <div class="plan-why">${escapeHtml(why)}</div>
      <div class="ready-label">${escapeHtml(t('readyLabel'))}</div>
      <div class="ready-row">
        ${window.WorkoutPlan.READINESS.map((lvl) => `
          <button type="button" class="ready-btn${readiness === lvl ? ' selected ' + lvl : ''}" data-ready="${lvl}">${escapeHtml(t('ready_' + lvl))}</button>`).join('')}
      </div>
      ${note ? `<div class="ready-note">${escapeHtml(note)}</div>` : ''}
      ${shown.map((e) => `
        <div class="plan-row">
          <span class="plan-name">${escapeHtml(e.libId ? exerciseLabel(e.libId) : e.name)}</span>
          <span class="plan-load ${e.direction}">${e.sets}\u00D7\u2009${escapeHtml(setLabel(e.weight, e.reps))}</span>
        </div>`).join('')}
      <button type="button" class="plan-start-btn" id="planStartBtn">${escapeHtml(t('planStartBtn'))}</button>
    </div>`;
}

// Кнопка не «створює тренування», а відкриває форму вже заповненою:
// далі людина міняє що завгодно, а зайве прибирає хрестиком.
function startPlannedSession() {
  const plan = window.WorkoutPlan.suggestSession(sessions, todayISO());
  if (!plan || plan.rest) return;
  openSessionForm(null);
  formExercises = window.WorkoutPlan.adjustForReadiness(plan.exercises, readiness).map((e) => ({
    id: uid4(), libId: e.libId || null, name: e.name || '', muscle: e.muscle === 'other' ? null : e.muscle,
    sets: Array.from({ length: e.sets }, () => ({ weight: e.weight, reps: e.reps })),
  }));
  renderExerciseBlocks();
}

// ---- Календар тренувань ----
// Список у зворотному порядку відповідає на «що я робив останнім часом», але
// не на «а чи тренувався я тієї середи». Календар відповідає на друге за
// секунду: крапка = того дня було тренування.
//
// Клікабельні лише дні з тренуванням — саме вони щось відкривають. Робити
// клікабельною всю сітку означало б обіцяти те, чого за порожнім днем немає.
function monthShift(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  const label = new Date(y, m - 1, 1)
    .toLocaleDateString(LOCALE_MAP[currentLang] || 'uk-UA', { month: 'long', year: 'numeric' });
  // Велика літера лише на першій: CSS-capitalize підняв би ще й «р.» у
  // «серпень 2026 р.».
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Пн…Нд назвами поточної мови — тиждень скрізь у застосунку з понеділка.
function weekdayShortLabels() {
  const locale = LOCALE_MAP[currentLang] || 'uk-UA';
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  // 2024-01-01 — понеділок; беремо сім поспіль.
  return [0, 1, 2, 3, 4, 5, 6].map((i) => fmt.format(new Date(2024, 0, 1 + i)));
}

function sessionsByDate() {
  const map = new Map();
  sessions.forEach((s) => {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date).push(s);
  });
  return map;
}

function renderCalendar() {
  const [y, m] = calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  // getDay(): неділя = 0. Переводимо в «скільки порожніх клітинок до 1 числа»
  // для тижня, що починається з понеділка.
  const lead = (first.getDay() + 6) % 7;
  const byDate = sessionsByDate();
  const today = todayISO();

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<button type="button" class="wcal-day blank" tabindex="-1"></button>');
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${calMonth}-${pad2(day)}`;
    const has = byDate.has(iso);
    const cls = ['wcal-day'];
    if (has) cls.push('has');
    if (iso === today) cls.push('today');
    if (iso === calSelectedDate) cls.push('selected');
    const label = has ? ` ${t('calDayHasWorkout')}` : '';
    cells.push(`<button type="button" class="${cls.join(' ')}"${has ? ` data-cal-day="${iso}"` : ' tabindex="-1"'} aria-label="${day}${escapeHtml(label)}">
      <span>${day}</span><span class="wcal-dot${has ? '' : ' ghost'}"></span>
    </button>`);
  }

  return `
    <div class="wcal">
      <div class="wcal-head">
        <button type="button" class="wcal-nav" data-cal-shift="-1" aria-label="${escapeHtml(t('calPrevMonth'))}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button type="button" class="wcal-title" id="wcalTitle">${escapeHtml(monthTitle(calMonth))}</button>
        <button type="button" class="wcal-nav" data-cal-shift="1" aria-label="${escapeHtml(t('calNextMonth'))}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div class="wcal-grid">
        ${weekdayShortLabels().map((w) => `<div class="wcal-wd">${escapeHtml(w)}</div>`).join('')}
        ${cells.join('')}
      </div>
    </div>`;
}

// Тап по дню — це «покажи мені той день». Коли тренування одне (а так майже
// завжди), «той день» і є саме тренування, тож відкриваємо його одразу.
// Коли їх кілька — звужуємо список, бо вгадувати, яке з них мали на увазі,
// було б гірше, ніж показати обидва.
function openCalendarDay(iso) {
  const items = sessionsByDate().get(iso) || [];
  if (!items.length) return;
  if (items.length === 1) {
    calSelectedDate = null;
    openSessionForm(items[0]);
    return;
  }
  calSelectedDate = calSelectedDate === iso ? null : iso;
  renderCurrentScreen();
}

function attachCalendarEvents(root) {
  root.querySelectorAll('[data-cal-shift]').forEach((btn) => {
    btn.addEventListener('click', () => {
      calMonth = monthShift(calMonth, Number(btn.dataset.calShift));
      calSelectedDate = null;
      renderCurrentScreen();
    });
  });
  const title = root.querySelector('#wcalTitle');
  // Заблукав по місяцях — один тап по назві вертає в поточний.
  if (title) title.addEventListener('click', () => {
    calMonth = todayISO().slice(0, 7);
    calSelectedDate = null;
    renderCurrentScreen();
  });
  root.querySelectorAll('[data-cal-day]').forEach((btn) => {
    btn.addEventListener('click', () => openCalendarDay(btn.dataset.calDay));
  });
  const clear = root.querySelector('#wcalClearBtn');
  if (clear) clear.addEventListener('click', () => {
    calSelectedDate = null;
    renderCurrentScreen();
  });
}

function renderSessionsTab() {
  const root = document.getElementById('sessionsTab');
  const list = sortedSessions();
  if (!list.length) {
    root.innerHTML = `
      <div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="currentColor"><rect x="8.2" y="10.4" width="7.6" height="3.2" rx="1.6"/><rect x="0.8" y="5.8" width="3.4" height="12.4" rx="1.7"/><rect x="4.8" y="4.2" width="3.8" height="15.6" rx="1.9"/><rect x="15.4" y="4.2" width="3.8" height="15.6" rx="1.9"/><rect x="19.8" y="5.8" width="3.4" height="12.4" rx="1.7"/></svg>
        <div class="title">${escapeHtml(t('emptySessionsTitle'))}</div>
        <div>${escapeHtml(t('emptySessionsSub'))}</div>
      </div>`;
    return;
  }
  // Групування за датою (список уже відсортований desc).
  const groups = [];
  list.forEach((s) => {
    const last = groups[groups.length - 1];
    if (last && last.date === s.date) last.items.push(s); else groups.push({ date: s.date, items: [s] });
  });
  const shownGroups = calSelectedDate ? groups.filter((g) => g.date === calSelectedDate) : groups;
  const filterBar = calSelectedDate ? `
    <div class="wcal-filter">
      <span class="day-label" style="margin:0;">${escapeHtml(dayLabel(calSelectedDate))}</span>
      <button type="button" id="wcalClearBtn">${escapeHtml(t('calShowAll'))}</button>
    </div>` : '';

  root.innerHTML = renderCalendar() + renderPlanCard() + renderGoalCreditCard() + filterBar + shownGroups.map((g) => `
    <div class="day-group">
      <div class="day-label">${escapeHtml(dayLabel(g.date))}</div>
      ${g.items.map((s) => renderSessionCard(s)).join('')}
    </div>
  `).join('');
  attachCalendarEvents(root);
  root.querySelectorAll('[data-open-session]').forEach((el) => {
    el.addEventListener('click', () => openSessionForm(sessions.find((s) => s.id === el.dataset.openSession)));
  });
  const startBtn = document.getElementById('planStartBtn');
  if (startBtn) startBtn.addEventListener('click', startPlannedSession);
  root.querySelectorAll('[data-ready]').forEach((btn) => {
    btn.addEventListener('click', () => setReadiness(btn.dataset.ready));
  });
  wireGoalCreditCard(root);
}

// ---- Тренування зараховується в ціль ----
// Записаний біг нічого не знав про ціль «пробігти 100 км»: два розділи жили
// поруч і не бачили одне одного, тож те саме доводилось відмічати двічі.
// Тут — місток, і саме такий, як усюди в застосунку: він КАЖЕ, що можна
// зарахувати, але сам не вирішує. Скільки кілометрів було, знає лише людина:
// у тренуванні лежать підходи й ваги, і вигадувати з них дистанцію не можна.
function renderGoalCreditCard() {
  // Пропонуємо тільки після сьогоднішнього тренування: без нього це просто
  // ще один список цілей у чужому розділі.
  if (!sessions.some((s) => s.date === todayISO())) return '';
  const list = window.GoalStreak.trainingGoals(goals, todayISO(), goalCategoryIds);
  if (!list.length) return '';

  return `
    <div class="plan-card goal-credit">
      <div class="plan-title">${escapeHtml(t('creditTitle'))}</div>
      ${list.map((g) => `
        <div class="credit-row">
          <div class="credit-title">${escapeHtml(g.title || '')}</div>
          <div class="credit-actions">
            <button type="button" class="credit-btn" data-credit-day="${g.id}">${escapeHtml(t('creditDay'))}</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function wireGoalCreditCard(root) {
  root.querySelectorAll('[data-credit-day]').forEach((btn) => {
    btn.addEventListener('click', () => creditGoalCheckin(btn.dataset.creditDay));
  });
}

// Запис іде через goals/streak.js — тією ж арифметикою, що й на сторінці
// цілей. Своя копія тут розійшлася б із серією.
async function creditGoalCheckin(goalId) {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !auth.currentUser) return;
  const result = window.GoalStreak.applyCheckin(goal, todayISO());
  if (!result) return;
  await db.collection('users').doc(auth.currentUser.uid).collection('goals').doc(goalId).update({
    checkins: result.checkins, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => console.error('creditGoalCheckin:', err));
}

function renderSessionCard(session) {
  const exs = session.exercises || [];
  const shown = exs.slice(0, 4);
  const rows = shown.map((ex) => {
    const b = bestSet(ex.sets);
    const bestStr = b ? `${fmtNum(b.weight)}×${b.reps}` : '—';
    return `<div class="session-ex-row"><span class="session-ex-name">${escapeHtml(exerciseDisplayName(ex))}</span><span class="session-ex-best">${escapeHtml(bestStr)}</span></div>`;
  }).join('');
  const more = exs.length > shown.length ? `<div class="session-more">${escapeHtml(t('exMore', exs.length - shown.length))}</div>` : '';
  const setTotal = exs.reduce((sum, ex) => sum + (ex.sets ? ex.sets.length : 0), 0);
  return `
    <div class="session-card" data-open-session="${session.id}">
      <div class="session-head">
        <div class="session-name">${escapeHtml(session.name || t('newSessionLabel'))}</div>
        <div class="session-meta">${escapeHtml(t('exCount', exs.length))} · ${escapeHtml(t('setCount', setTotal))}</div>
      </div>
      <div class="session-ex-list">${rows}</div>
      ${more}
    </div>`;
}

// ---- Прогрес: одна відповідь замість двадцяти графіків ----
// Питання, заради якого людина взагалі веде записи, — «я реально став
// сильнішим?». Відповідь має читатись за секунду, тому спершу одне речення
// й одне число, і лише під ними — розклад по вправах і мʼязах.
function fmtInt(n) {
  // Нерозривний тонкий пробіл між тисячами: «4 200» читається, «4200» — ні.
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
}

// Підхід без ваги — це не «0×8», а вісім разів. Той самий формат
// використовує підказка у формі.
function setLabel(weight, reps) {
  return weight ? `${fmtNum(weight)}\u00D7${reps}` : `${reps}\u00A0${t('unitReps')}`;
}

function progressExerciseName(entry) {
  return entry.libId ? exerciseLabel(entry.libId) : (entry.name || '');
}

function deltaHtml(pct) {
  if (pct === null || pct === undefined) return `<span class="pg-delta new">${escapeHtml(t('progressNewMark'))}</span>`;
  const cls = pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat');
  return `<span class="pg-delta ${cls}">${pct > 0 ? '+' : ''}${pct}%</span>`;
}

function renderProgressSummary() {
  const data = window.WorkoutProgress.analyze(sessions, todayISO());
  if (!data.enough) {
    const text = data.needSessions > 0 ? t('progressNotEnough', data.needSessions) : t('progressNoCompare');
    return `
      <div class="pg-card">
        <div class="pg-title">${escapeHtml(t('progressTitle'))}</div>
        <div class="pg-empty">${escapeHtml(text)}</div>
      </div>`;
  }

  const headline = data.verdict === 'up' ? t('progressUp') : (data.verdict === 'down' ? t('progressDown') : t('progressFlat'));
  // Три вправи зі списку — це вже відповідь; решта видно нижче, у рекордах.
  const top = data.exercises.filter((e) => e.pct !== null).slice(0, 3);
  const unit = (m) => (m.unit === 'kg' ? t('unitKg') : t('unitReps'));

  return `
    <div class="pg-card">
      <div class="pg-title">${escapeHtml(t('progressTitle'))}</div>
      <div class="pg-headline ${data.verdict}">${escapeHtml(headline)}</div>
      <div class="pg-sub">${escapeHtml(t('progressStrength', data.strengthPct))} · ${escapeHtml(t('progressSessions', data.sessionsNow, data.sessionsPrev))}</div>
      ${top.map((e) => `
        <div class="pg-row">
          <span class="pg-name">${escapeHtml(progressExerciseName(e))}</span>
          <span class="pg-nums">${escapeHtml(fmtNum(Math.round(e.prevE1rm)))} → ${escapeHtml(fmtNum(Math.round(e.e1rm)))}</span>
          ${deltaHtml(e.pct)}
        </div>`).join('')}
      ${data.muscles.length ? `
      <div class="pg-section">${escapeHtml(t('progressVolumeLabel'))}</div>
      ${data.muscles.map((m) => `
        <div class="pg-row">
          <span class="pg-name">${escapeHtml(muscleLabel(m.muscle))}</span>
          <span class="pg-nums">${escapeHtml(fmtInt(m.now))}\u00A0${escapeHtml(unit(m))}</span>
          ${deltaHtml(m.pct)}
        </div>`).join('')}` : ''}
    </div>`;
}

function renderRecordsTab() {
  const root = document.getElementById('recordsTab');
  const map = computeRecords(null);
  if (!map.size) {
    root.innerHTML = `
      <div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>
        <div class="title">${escapeHtml(t('emptyRecordsTitle'))}</div>
        <div>${escapeHtml(t('emptyRecordsSub'))}</div>
      </div>`;
    return;
  }
  const byMuscle = new Map();
  map.forEach((entry) => {
    const m = entry.muscle || 'other';
    if (!byMuscle.has(m)) byMuscle.set(m, []);
    byMuscle.get(m).push(entry);
  });
  const order = [...MUSCLE_ORDER, ...[...byMuscle.keys()].filter((m) => !MUSCLE_ORDER.includes(m))];
  root.innerHTML = renderProgressSummary() + order.filter((m) => byMuscle.has(m)).map((m) => {
    const entries = byMuscle.get(m).sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div class="muscle-group">
        <div class="muscle-label">${m === 'other' ? '' : escapeHtml(muscleLabel(m))}</div>
        <div class="pr-card">
          ${entries.map((e) => renderPrRow(e)).join('')}
        </div>
      </div>`;
  }).join('');
  root.querySelectorAll('[data-open-history]').forEach((el) => {
    el.addEventListener('click', () => openHistory(el.dataset.openHistory));
  });
}

function renderPrRow(entry) {
  // Там, де ваги немає, зростання міряється повтореннями — інакше
  // підтягування назавжди лишались би «без змін».
  const bodyweight = !entry.best.weight && !entry.first.weight;
  const firstScore = bodyweight ? entry.first.reps : epley1RM(entry.first.weight, entry.first.reps);
  const bestScore = bodyweight ? entry.best.reps : epley1RM(entry.best.weight, entry.best.reps);
  let trendHtml;
  if (firstScore > 0 && bestScore > firstScore) {
    const pct = Math.round(((bestScore - firstScore) / firstScore) * 100);
    trendHtml = `<div class="pr-trend up">↑ ${escapeHtml(t('trendUp', pct))}</div>`;
  } else {
    trendHtml = `<div class="pr-trend flat">${escapeHtml(t('trendFlat'))}</div>`;
  }
  return `
    <div class="pr-row" data-open-history="${escapeHtml(entry.key)}">
      <div class="pr-icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>
      </div>
      <div class="pr-body">
        <div class="pr-name">${escapeHtml(entry.name)}</div>
        <div class="pr-sub">${escapeHtml(shortDate(entry.best.date))} · ${entry.sessionsCount}\u00A0${escapeHtml(t('historySessionsLabel')).toLowerCase()}</div>
      </div>
      <div class="pr-value">
        <div class="pr-weight">${escapeHtml(setLabel(entry.best.weight, entry.best.reps))}</div>
        ${trendHtml}
      </div>
    </div>`;
}

// ---- Історія вправи ----
function openHistory(key) {
  const rows = historyForExercise(key);
  if (!rows.length) return;
  const name = rows[0].name;
  const best = rows.reduce((acc, r) => (epley1RM(r.best.weight, r.best.reps) > epley1RM(acc.weight, acc.reps) ? r.best : acc), rows[0].best);
  const est1rm = Math.round(epley1RM(best.weight, best.reps));
  document.getElementById('historyTitle').textContent = name;
  document.getElementById('historySummary').innerHTML = `
    <div class="hist-stat"><div class="hist-stat-value">${escapeHtml(fmtNum(best.weight))}×${best.reps}</div><div class="hist-stat-label">${escapeHtml(t('historyBestLabel'))}</div></div>
    <div class="hist-stat"><div class="hist-stat-value">${est1rm || '—'}</div><div class="hist-stat-label">${escapeHtml(t('historyEstLabel'))}</div></div>
    <div class="hist-stat"><div class="hist-stat-value">${rows.length}</div><div class="hist-stat-label">${escapeHtml(t('historySessionsLabel'))}</div></div>
  `;
  document.getElementById('historyList').innerHTML = rows.map((r) => {
    const isBest = r.best.weight === best.weight && r.best.reps === best.reps;
    return `
      <div class="hist-row">
        <div class="hist-date">${escapeHtml(shortDate(r.date))}</div>
        <div class="hist-sets">${escapeHtml(fmtNum(r.best.weight))}×${r.best.reps}</div>
        ${isBest ? `<div class="hist-badge">🏆 ${escapeHtml(t('prBadge'))}</div>` : ''}
      </div>`;
  }).join('');
  document.getElementById('historyOverlay').classList.add('show');
}
document.getElementById('closeHistory').addEventListener('click', () => {
  document.getElementById('historyOverlay').classList.remove('show');
});
document.getElementById('historyOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'historyOverlay') e.currentTarget.classList.remove('show');
});

// ---- Вкладки ----
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('#bottomNav [data-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('sessionsTab').style.display = tab === 'sessions' ? 'block' : 'none';
  document.getElementById('recordsTab').style.display = tab === 'records' ? 'block' : 'none';
  // «Рекорди» лише показують історію — додавати там нема чого. Ховаємо
  // кнопку зовсім, а не робимо невидимою: інакше помічник над нею лишався б
  // висіти з порожнім місцем під собою. Клас на <body> опускає його на
  // звільнене місце — правило поруч із рештою стилів кнопки.
  const hasAdd = tab === 'sessions';
  document.getElementById('newSessionBtn').style.display = hasAdd ? '' : 'none';
  document.body.classList.toggle('no-page-fab', !hasAdd);
  renderCurrentScreen();
}
document.querySelectorAll('#bottomNav [data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ---- Форма тренування ----
// Історія цієї ж вправи для розрахунку наступного кроку: повні набори
// підходів, найновіше першим, без сесії, яку зараз редагують.
function progressionHistory(ex) {
  const key = exerciseKey(ex);
  const rows = [];
  sortedSessions().forEach((session) => {
    if (session.id === editingSessionId) return;
    (session.exercises || []).forEach((e) => {
      if (exerciseKey(e) !== key) return;
      // Запланована вправа підказку не годує: підказка про те, що ти вже
      // підняв, а не про те, що збирався.
      const done = (e.sets || []).filter((set) => Number(set.reps) > 0);
      if (done.length) rows.push({ date: session.date, sets: done });
    });
  });
  return rows;
}

// Останні ФАКТИЧНІ підходи цієї вправи — те, що людина реально зробила
// минулого разу. На відміну від findLastPerformance, повертає весь набір
// підходів, а не найважчий з них: для підстановки ваги в шаблон важливо,
// скільки саме стояло на кожному підході.
function lastSetsFor(ex) {
  const key = exerciseKey(ex);
  for (const session of sortedSessions()) {
    if (session.id === editingSessionId) continue;
    const match = (session.exercises || []).find((e) => exerciseKey(e) === key);
    // Тренування, записане наперед, ваги не підказує — там її ще немає.
    const done = match ? (match.sets || []).filter((s) => Number(s.reps) > 0) : [];
    if (done.length) return done;
  }
  return null;
}

function verdictLabel(suggestion) {
  if (suggestion.reason === 'addLoad') return t('nextTryAddLoad');
  // Власна вага росте повтореннями — казати «вага росте» там, де вага
  // взагалі не змінюється, було б неправдою.
  if (suggestion.reason === 'moreReps') return t('nextTryMoreReps');
  if (suggestion.verdict === 'up') return t('nextTryUp');
  if (suggestion.verdict === 'down') return t('nextTryDown');
  return t('nextTryHold');
}

function findLastPerformance(ex) {
  // Шукає останній (за датою) підхід цієї ж вправи серед ІНШИХ тренувань,
  // ніж те, що зараз редагується — основа для підказки прогресивного навантаження.
  const key = exerciseKey(ex);
  for (const session of sortedSessions()) {
    if (session.id === editingSessionId) continue;
    const match = (session.exercises || []).find((e) => exerciseKey(e) === key);
    if (match) {
      const b = bestSet(match.sets);
      if (b) return b;
    }
  }
  return null;
}

function openSessionForm(existingSession) {
  editingSessionId = existingSession ? existingSession.id : null;
  document.getElementById('sessionModalTitle').textContent = existingSession ? t('editSessionTitle') : t('newSessionTitle');
  document.getElementById('deleteSessionBtn').style.display = existingSession ? 'block' : 'none';
  document.getElementById('sessionFormError').textContent = '';
  document.getElementById('sessionNameInput').value = existingSession ? (existingSession.name || '') : '';
  document.getElementById('sessionDateInput').value = existingSession ? existingSession.date : todayISO();
  document.getElementById('sessionNotesInput').value = existingSession ? (existingSession.notes || '') : '';
  formExercises = existingSession
    ? (existingSession.exercises || []).map((ex) => ({
        id: uid4(), libId: ex.libId || null, customId: ex.customId || null, name: ex.name || '', muscle: ex.muscle || null,
        sets: (ex.sets || []).map((s) => ({ weight: s.weight, reps: s.reps })),
      }))
    : [];
  renderExerciseBlocks();
  renderTemplateRow();
  sessionGuard.arm();
  document.getElementById('sessionFormOverlay').classList.add('show');
}

// ---- Незбережені зміни ----
// Тренування записують довго: назва, вправи, підходи. А форма закривається
// тапом повз вікно. Спільна логіка — в ../unsaved-guard.js.
const sessionGuard = UnsavedGuard.create({
  overlay: 'sessionFormOverlay',
  snapshot: () => JSON.stringify({
    name: document.getElementById('sessionNameInput').value.trim(),
    date: document.getElementById('sessionDateInput').value,
    notes: document.getElementById('sessionNotesInput').value.trim(),
    exercises: formExercises.map((ex) => ({
      libId: ex.libId || null,
      name: (ex.name || '').trim(),
      sets: (ex.sets || []).map((s) => [String(s.weight), String(s.reps)]),
    })),
  }),
  save: () => saveSessionForm(),
  texts: () => ({
    title: t('unsavedTitle'), sub: t('unsavedSub'),
    save: t('unsavedSave'), discard: t('unsavedDiscard'), keep: t('unsavedKeep'),
  }),
});
const closeSessionForm = () => sessionGuard.close();

document.getElementById('newSessionBtn').addEventListener('click', () => openSessionForm(null));
document.getElementById('closeSessionForm').addEventListener('click', () => sessionGuard.requestClose());

function renderExerciseBlocks() {
  const root = document.getElementById('exerciseBlocks');
  root.innerHTML = formExercises.map((ex) => renderExerciseBlock(ex)).join('');
  // Хінти обчислюються один раз при рендері: що було минулого разу і що
  // робити сьогодні. Друге — не прикраса до першого, а те, заради чого
  // людина сюди дивиться: рахувати наступну вагу в голові між підходами
  // ніхто не хоче.
  formExercises.forEach((ex) => {
    const hintEl = root.querySelector(`[data-hint-for="${ex.id}"]`);
    if (!hintEl) return;
    const last = findLastPerformance(ex);
    if (!last) { hintEl.innerHTML = ''; hintEl.style.display = 'none'; return; }

    const next = window.WorkoutProgression.suggestNext(progressionHistory(ex), ex.libId || '');
    hintEl.style.display = 'block';
    hintEl.innerHTML = `
      <div class="hint-last">${escapeHtml(t('lastTimeLabel', last.weight ? fmtNum(last.weight) : '', last.reps))}</div>
      ${next ? `
      <div class="hint-next ${next.verdict}">
        <span class="hint-next-text">${escapeHtml(t('nextTryLabel', next.weight ? fmtNum(next.weight) : '', next.reps))}</span>
        <span class="hint-next-why">${escapeHtml(verdictLabel(next))}</span>
        <button type="button" class="hint-fill-btn" data-fill="${ex.id}">${escapeHtml(t('nextTryFill'))}</button>
      </div>` : ''}`;
  });
  attachExerciseBlockEvents();
  attachExerciseDrag(root);
}

// Що показати в полях підходу. Запланований підхід (нуль повторень) має
// виглядати порожнім, а не «0»: інакше відкритий назавтра план читався б як
// нульовий результат. Нуль ваги при реальних повтореннях — це власна вага,
// і його якраз показуємо.
function setInputValue(s) {
  const done = Number(s.reps) > 0;
  return {
    weight: done || Number(s.weight) ? s.weight : '',
    reps: done ? s.reps : '',
  };
}

function renderExerciseBlock(ex) {
  const setsHtml = ex.sets.map((s, i) => `
    <div class="set-row" data-set-idx="${i}">
      <div class="set-num">${i + 1}</div>
      <input type="number" inputmode="decimal" step="0.5" min="0" max="2000" class="set-weight" placeholder="${escapeHtml(t('setPlaceholderWeight'))}" value="${setInputValue(s).weight}">
      <input type="number" inputmode="numeric" step="1" min="0" max="999" class="set-reps" placeholder="${escapeHtml(t('setPlaceholderReps'))}" value="${setInputValue(s).reps}">
      <button type="button" class="set-remove" data-remove-set="${i}" aria-label="Remove set">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
  return `
    <div class="ex-block" data-block-id="${ex.id}">
      <div class="ex-block-head">
        <button type="button" class="ex-drag-handle" data-drag-handle="${ex.id}" aria-label="${escapeHtml(t('reorderExercise'))}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
        </button>
        <div class="ex-block-name">${escapeHtml(exerciseDisplayName(ex))}</div>
        <button type="button" class="ex-remove-btn" data-remove-block="${ex.id}" aria-label="Remove exercise">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="ex-block-muscle">${ex.muscle ? escapeHtml(muscleLabel(ex.muscle)) : ''}</div>
      <div class="set-hint" data-hint-for="${ex.id}"></div>
      ${setsHtml}
      <button type="button" class="add-set-btn" data-add-set="${ex.id}">${escapeHtml(t('addSetLabel'))}</button>
    </div>`;
}

function attachExerciseBlockEvents() {
  const root = document.getElementById('exerciseBlocks');
  root.querySelectorAll('[data-remove-block]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formExercises = formExercises.filter((ex) => ex.id !== btn.dataset.removeBlock);
      renderExerciseBlocks();
    });
  });
  // Підставляємо в порожні рядки — заповнені не чіпаємо: людина могла вже
  // щось записати, і затерти це підказкою було б гірше, ніж не допомогти.
  root.querySelectorAll('[data-fill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ex = formExercises.find((e) => e.id === btn.dataset.fill);
      if (!ex) return;
      const next = window.WorkoutProgression.suggestNext(progressionHistory(ex), ex.libId || '');
      if (!next) return;
      let filled = false;
      ex.sets.forEach((set) => {
        if (set.weight !== '' && set.weight != null) return;
        if (set.reps !== '' && set.reps != null) return;
        set.weight = next.weight;
        set.reps = next.reps;
        filled = true;
      });
      // Порожніх рядків не лишилось — додаємо новий, інакше кнопка мовчала б.
      if (!filled) ex.sets.push({ weight: next.weight, reps: next.reps });
      renderExerciseBlocks();
    });
  });
  root.querySelectorAll('[data-add-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ex = formExercises.find((e) => e.id === btn.dataset.addSet);
      if (!ex) return;
      const prev = ex.sets[ex.sets.length - 1];
      ex.sets.push({ weight: prev ? prev.weight : '', reps: prev ? prev.reps : '' });
      renderExerciseBlocks();
    });
  });
  root.querySelectorAll('.ex-block').forEach((blockEl) => {
    const exId = blockEl.dataset.blockId;
    const ex = formExercises.find((e) => e.id === exId);
    if (!ex) return;
    blockEl.querySelectorAll('[data-remove-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ex.sets.splice(Number(btn.dataset.removeSet), 1);
        renderExerciseBlocks();
      });
    });
    blockEl.querySelectorAll('.set-weight').forEach((input, i) => {
      input.addEventListener('input', () => { ex.sets[i].weight = input.value === '' ? '' : Number(input.value); });
    });
    blockEl.querySelectorAll('.set-reps').forEach((input, i) => {
      input.addEventListener('input', () => { ex.sets[i].reps = input.value === '' ? '' : Number(input.value); });
    });
  });
  if (!formExercises.length) {
    // Порожній стан всередині форми не потребує окремого блоку — кнопка
    // "Додати вправу" вже достатньо помітна.
  }
}

// ---- Порядок вправ: перетягування ----
// Порядок вправ у тренуванні — це порядок, у якому їх реально роблять, і
// помилитись легко: додав жим після присідань, а треба навпаки. Виправляти
// це через «видалити й додати заново» означало б набирати підходи вдруге.
//
// Реалізовано на pointer events, а не на HTML5 drag-and-drop: останній на
// тач-екранах просто не працює, а застосунок передусім телефонний.
//
// Під час жесту нічого не перемальовується: перетягувану картку ведемо
// transform'ом, сусідні зсуваємо на її висоту, а масив переставляємо один раз
// на відпусканні. Перемальовування на кожен рух гасило б фокус у полях і
// плодило б нові вузли під самим пальцем.
const EX_BLOCK_GAP = 12; // = margin-bottom .ex-block
let exDrag = null;

function exerciseBlockEls() {
  return [...document.getElementById('exerciseBlocks').querySelectorAll('.ex-block')];
}

function beginExerciseDrag(e, handle) {
  if (exDrag) return;
  const blockEl = handle.closest('.ex-block');
  const blocks = exerciseBlockEls();
  const from = blocks.indexOf(blockEl);
  if (from < 0 || blocks.length < 2) return;

  e.preventDefault();
  exDrag = {
    pointerId: e.pointerId,
    blocks,
    rects: blocks.map((b) => b.getBoundingClientRect()),
    from,
    to: from,
    startY: e.clientY,
  };
  blockEl.classList.add('dragging');
  blocks.forEach((b, i) => { if (i !== from) b.classList.add('drag-idle'); });
  handle.setPointerCapture(e.pointerId);
}

function moveExerciseDrag(e) {
  if (!exDrag || e.pointerId !== exDrag.pointerId) return;
  const { blocks, rects, from } = exDrag;
  const dy = e.clientY - exDrag.startY;
  blocks[from].style.transform = `translateY(${dy}px)`;

  // Куди картка потрапить, якщо відпустити зараз: перетинаємо середину
  // сусіда — значить, стаємо на його місце.
  const center = rects[from].top + rects[from].height / 2 + dy;
  let to = from;
  rects.forEach((r, i) => {
    if (i === from) return;
    const mid = r.top + r.height / 2;
    if (i > from && center > mid) to = Math.max(to, i);
    if (i < from && center < mid) to = Math.min(to, i);
  });
  exDrag.to = to;

  // Сусіди розступаються рівно на висоту тієї картки, що їде.
  const shift = rects[from].height + EX_BLOCK_GAP;
  blocks.forEach((b, i) => {
    if (i === from) return;
    let offset = 0;
    if (from < i && i <= to) offset = -shift;
    else if (from > i && i >= to) offset = shift;
    b.style.transform = offset ? `translateY(${offset}px)` : '';
  });
}

function endExerciseDrag(e) {
  if (!exDrag || (e && e.pointerId !== exDrag.pointerId)) return;
  const { from, to } = exDrag;
  exDrag = null;
  if (from !== to) formExercises.splice(to, 0, formExercises.splice(from, 1)[0]);
  // Перемальовуємо в будь-якому разі: це заразом прибирає transform'и,
  // класи й перенумеровує підходи.
  renderExerciseBlocks();
}

function attachExerciseDrag(root) {
  root.querySelectorAll('[data-drag-handle]').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => beginExerciseDrag(e, handle));
    handle.addEventListener('pointermove', moveExerciseDrag);
    handle.addEventListener('pointerup', endExerciseDrag);
    // Скасований жест (системний свайп, вхідний дзвінок) має лишити список
    // у тому вигляді, що й був, а не завмерти на півдорозі.
    handle.addEventListener('pointercancel', endExerciseDrag);
    // З клавіатури те саме без жестів: на комп'ютері це швидше за мишу,
    // а для доступності — єдиний спосіб узагалі.
    handle.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const id = handle.dataset.dragHandle;
      const from = formExercises.findIndex((ex) => ex.id === id);
      const to = from + (e.key === 'ArrowUp' ? -1 : 1);
      if (from < 0 || to < 0 || to >= formExercises.length) return;
      formExercises.splice(to, 0, formExercises.splice(from, 1)[0]);
      renderExerciseBlocks();
      const next = document.querySelector(`[data-drag-handle="${id}"]`);
      if (next) next.focus();
    });
  });
}

document.getElementById('addExerciseBtn').addEventListener('click', () => {
  pickerTargetBlockId = null;
  openExercisePicker();
});

// ---- Пікер вправ ----
function openExercisePicker() {
  document.getElementById('pickerCustomInput').value = '';
  document.getElementById('pickerSearch').value = '';
  pickerCustomMuscle = null;
  document.getElementById('pickerCustomHint').textContent = '';
  // Форма своєї вправи щоразу починається згорнутою: у більшості випадків
  // потрібна вправа вже є в списку, і розгорнута форма лише з'їдала б висоту.
  setCustomFormOpen(false);
  renderPickerGroups('');
  renderPickerCustomMuscleRow();
  document.getElementById('exercisePickerOverlay').classList.add('show');
  focusWhenIdle('pickerSearch', 'exercisePickerOverlay');
}

function setCustomFormOpen(open) {
  document.getElementById('pickerCustomForm').classList.toggle('show', open);
  const toggle = document.getElementById('pickerCustomToggle');
  toggle.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

document.getElementById('pickerCustomToggle').addEventListener('click', () => {
  const open = !document.getElementById('pickerCustomForm').classList.contains('show');
  setCustomFormOpen(open);
  if (open) setTimeout(() => document.getElementById('pickerCustomInput').focus(), 50);
});
function renderPickerGroups(query) {
  const q = query.trim().toLowerCase();
  const root = document.getElementById('pickerGroups');
  const byMuscle = new Map();
  EXERCISE_LIB.forEach((item) => {
    const label = exerciseLabel(item.id);
    if (q && !label.toLowerCase().includes(q)) return;
    if (!byMuscle.has(item.muscle)) byMuscle.set(item.muscle, []);
    byMuscle.get(item.muscle).push({ kind: 'lib', id: item.id, label });
  });
  // Власні вправи додаються в ту саму групу мʼязів, що й бібліотечні —
  // людина шукає «щось на груди», а не окремо «моє» й «з бібліотеки».
  customExercises.forEach((item) => {
    if (q && !(item.name || '').toLowerCase().includes(q)) return;
    const m = item.muscle || 'other';
    if (!byMuscle.has(m)) byMuscle.set(m, []);
    byMuscle.get(m).push({ kind: 'custom', id: item.id, label: item.name || '' });
  });
  const order = [...MUSCLE_ORDER, ...[...byMuscle.keys()].filter((m) => !MUSCLE_ORDER.includes(m))];
  root.innerHTML = order.filter((m) => byMuscle.has(m)).map((m) => `
    <div class="picker-group">
      ${m === 'other' ? '' : `<div class="picker-group-label">${escapeHtml(muscleLabel(m))}</div>`}
      ${byMuscle.get(m).map((item) => item.kind === 'lib'
        ? `<div class="picker-item" data-pick-lib="${item.id}" data-muscle="${m}"><span class="picker-item-name">${escapeHtml(item.label)}</span></div>`
        // Хрестик лише у своїх вправ: бібліотечні вбудовані, їх видаляти нема сенсу.
        : `<div class="picker-item" data-pick-custom="${item.id}" data-muscle="${m}">
             <span class="picker-item-name">${escapeHtml(item.label)}</span>
             <button type="button" class="picker-item-del" data-del-custom="${item.id}" aria-label="${escapeHtml(t('deleteExerciseAria'))}">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
             </button>
           </div>`
      ).join('')}
    </div>
  `).join('');
  root.querySelectorAll('[data-pick-lib]').forEach((el) => {
    el.addEventListener('click', () => selectExercise({ libId: el.dataset.pickLib, muscle: el.dataset.muscle, name: exerciseLabel(el.dataset.pickLib) }));
  });
  root.querySelectorAll('[data-pick-custom]').forEach((el) => {
    el.addEventListener('click', () => {
      const item = customExercises.find((c) => c.id === el.dataset.pickCustom);
      if (!item) return;
      selectExercise({ customId: item.id, muscle: item.muscle, name: item.name });
    });
  });
  // Хрестик живе всередині рядка, тож без зупинки події дотик по ньому
  // спершу обрав би вправу й закрив пікер.
  root.querySelectorAll('[data-del-custom]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      askDelete('customExercise', btn.dataset.delCustom);
    });
  });
}
document.getElementById('pickerSearch').addEventListener('input', (e) => renderPickerGroups(e.target.value));

function renderPickerCustomMuscleRow() {
  document.getElementById('pickerCustomMuscleRow').innerHTML = MUSCLE_ORDER.map((m) => `
    <button type="button" class="picker-muscle-choice${pickerCustomMuscle === m ? ' selected' : ''}" data-muscle="${m}">${escapeHtml(muscleLabel(m))}</button>
  `).join('');
  document.querySelectorAll('#pickerCustomMuscleRow [data-muscle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pickerCustomMuscle = btn.dataset.muscle;
      document.getElementById('pickerCustomHint').textContent = '';
      renderPickerCustomMuscleRow();
    });
  });
}

// Своя вправа зберігається один раз і далі просто обирається зі списку —
// повторний ввід того самого імені (без урахування регістру) не плодить
// дублікат, а підхоплює вже наявний запис.
document.getElementById('pickerCustomAdd').addEventListener('click', async () => {
  const name = document.getElementById('pickerCustomInput').value.trim();
  const hintEl = document.getElementById('pickerCustomHint');
  if (!name) return;
  if (!pickerCustomMuscle) { hintEl.textContent = t('pickerCustomNeedMuscle'); return; }
  hintEl.textContent = '';

  const existing = customExercises.find((c) => (c.name || '').trim().toLowerCase() === name.toLowerCase());
  if (existing) {
    selectExercise({ customId: existing.id, muscle: existing.muscle, name: existing.name });
    return;
  }
  const uidCur = auth.currentUser && auth.currentUser.uid;
  if (!uidCur) return;
  try {
    const ref = await db.collection('users').doc(uidCur).collection('customExercises').add({
      name: name.slice(0, 120), muscle: pickerCustomMuscle,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    selectExercise({ customId: ref.id, muscle: pickerCustomMuscle, name });
  } catch (err) {
    console.error('addCustomExercise:', err);
    hintEl.textContent = writeErrorMessage(err);
  }
});
document.getElementById('closePicker').addEventListener('click', () => {
  document.getElementById('exercisePickerOverlay').classList.remove('show');
});
document.getElementById('exercisePickerOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'exercisePickerOverlay') e.currentTarget.classList.remove('show');
});

function selectExercise({ libId, customId, muscle, name }) {
  if (pickerTargetBlockId) {
    const ex = formExercises.find((e) => e.id === pickerTargetBlockId);
    if (ex) { ex.libId = libId || null; ex.customId = customId || null; ex.muscle = muscle; ex.name = name; }
  } else {
    formExercises.push({ id: uid4(), libId: libId || null, customId: customId || null, muscle, name, sets: [{ weight: '', reps: '' }] });
  }
  pickerTargetBlockId = null;
  document.getElementById('exercisePickerOverlay').classList.remove('show');
  renderExerciseBlocks();
}

// ---- Шаблони тренувань ----
// Одна й та сама програма повторюється тижнями: ті самі вправи, той самий
// порядок, змінюється тільки вага. Шаблон знімає з людини найнуднішу частину —
// щоразу набирати той самий каркас.
//
// Застосування шаблону НЕ створює тренування одразу (на відміну від шаблонів
// завдань): воно наповнює відкриту форму, бо вагу все одно треба виставити
// під сьогодні. Заразом на кожній вправі одразу вмикаються звичні підказки
// «Минулого разу / Спробуй» — рівно те, чого бракує в цей момент.
const MAX_TEMPLATES = 12;

function templateSummary(tpl) {
  const exCount = (tpl.exercises || []).length;
  const names = (tpl.exercises || []).map((ex) => exerciseDisplayName(ex)).filter(Boolean);
  return [t('exCount', exCount), names.join(', ')].filter(Boolean).join(' · ');
}

function renderTemplateRow() {
  const row = document.getElementById('sessionTemplateRow');
  if (!row) return;
  // У вже записаному тренуванні шаблон нема куди застосовувати: підмінити
  // вправи в історії — не те, чого від кнопки чекають.
  if (editingSessionId || !templates.length) { row.innerHTML = ''; return; }
  row.innerHTML =
    `<span class="field-label" style="margin:0;">${escapeHtml(t('templatesTitle'))}:</span>` +
    templates.map((tpl) => `
      <button type="button" class="template-chip" data-template="${tpl.id}">
        <span class="name">${escapeHtml(tpl.name)}</span>
        <span class="count">${(tpl.exercises || []).length}</span>
      </button>`).join('') +
    `<button type="button" class="template-chip manage" id="manageTemplatesBtn" aria-label="${escapeHtml(t('manageTemplates'))}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
    </button>`;
  row.querySelectorAll('[data-template]').forEach((btn) => {
    btn.addEventListener('click', () => applyTemplate(btn.dataset.template));
  });
  document.getElementById('manageTemplatesBtn').addEventListener('click', openTemplatesManager);
}

// Підходи для вправи з шаблону.
//
// Шаблон описує ПРОГРАМУ — які вправи, скільки підходів, скільки повторень.
// Вага в програму не входить: вона змінюється щотижня, і числа, збережені
// місяць тому, довелось би щоразу перебивати руками. Тому вагу беремо з
// останнього фактичного виконання цієї вправи, а повторення лишаємо з
// шаблону — це прескрипція, а не спогад.
//
// Історії ще немає (вправа нова) — лишається вага з шаблону: краще стартова
// точка, ніж порожні поля.
function templateSets(ex) {
  const last = lastSetsFor(ex);
  return (ex.sets || []).map((set, i) => {
    // Минулого разу підходів могло бути менше, ніж у шаблоні — тоді решта
    // бере вагу з останнього виконаного.
    const src = last ? last[Math.min(i, last.length - 1)] : null;
    const weight = src && src.weight !== undefined && src.weight !== null ? src.weight : set.weight;
    return { weight, reps: set.reps };
  });
}

// Вправи ДОДАЮТЬСЯ, а не заміняють набране: два шаблони поспіль («Груди» +
// «Прес») дають одне тренування, а повторний тап по тому самому шаблону
// нічого не дублює.
function applyTemplate(id) {
  const tpl = templates.find((x) => x.id === id);
  if (!tpl) return;
  const nameInput = document.getElementById('sessionNameInput');
  if (!nameInput.value.trim()) nameInput.value = tpl.name || '';

  const have = new Set(formExercises.map(exerciseKey));
  (tpl.exercises || []).forEach((ex) => {
    const key = exerciseKey(ex);
    if (have.has(key)) return;
    have.add(key);
    formExercises.push({
      id: uid4(),
      libId: ex.libId || null,
      name: ex.name || '',
      muscle: ex.muscle || null,
      sets: templateSets(ex),
    });
  });
  renderExerciseBlocks();
}

async function saveSessionAsTemplate() {
  const uidCur = auth.currentUser && auth.currentUser.uid;
  const errorEl = document.getElementById('sessionFormError');
  if (!uidCur) return;

  const name = document.getElementById('sessionNameInput').value.trim();
  // У тренування назва необовʼязкова, а от у шаблону — обовʼязкова: саме вона
  // стоїть на кнопці, і «(без назви)» не підкаже, що всередині.
  if (!name) { errorEl.textContent = t('templateNeedsName'); return; }
  if (templates.length >= MAX_TEMPLATES) { errorEl.textContent = t('templateLimit', MAX_TEMPLATES); return; }

  const exercises = formExercises
    .map((ex) => ({
      id: ex.id,
      libId: ex.libId || null,
      muscle: ex.muscle || null,
      name: ex.libId ? exerciseLabel(ex.libId) : (ex.name || '').trim(),
      // Ваги й повторення лишаємо як є — це стартова точка, яку наступного
      // разу правлять, а не порожні поля, які треба заповнювати з нуля.
      // Порожні підходи теж лишаються: шаблон плану — це теж шаблон.
      sets: (ex.sets || []).map((set) => ({
        weight: Number(set.weight) || 0,
        reps: Math.round(Number(set.reps) || 0),
      })),
    }))
    .filter((ex) => ex.name);
  if (!exercises.length) { errorEl.textContent = t('noExerciseError'); return; }

  const btn = document.getElementById('saveAsTemplateBtn');
  btn.disabled = true;
  try {
    await db.collection('users').doc(uidCur).collection('workoutTemplates').add({
      name,
      exercises,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    errorEl.textContent = '';
    // Підтвердження прямо на кнопці: окремий тост заради одного слова —
    // зайва конструкція, а без відгуку незрозуміло, чи спрацювало.
    btn.textContent = t('templateSaved');
    setTimeout(() => { btn.textContent = t('saveAsTemplate'); }, 2000);
  } catch (err) {
    console.error('saveAsTemplate:', err);
    errorEl.textContent = t('err_generic');
  } finally {
    btn.disabled = false;
  }
}

function renderTemplateManageList() {
  const el = document.getElementById('templateManageList');
  if (!templates.length) {
    el.innerHTML = `<div class="template-empty">${escapeHtml(t('templateEmpty'))}</div>`;
    return;
  }
  el.innerHTML = templates.map((tpl) => `
    <div class="template-item">
      <div class="template-item-body">
        <div class="template-item-name">${escapeHtml(tpl.name)}</div>
        <div class="template-item-meta">${escapeHtml(templateSummary(tpl))}</div>
      </div>
      <button type="button" class="template-item-del" data-del-template="${tpl.id}" aria-label="${escapeHtml(t('deleteBtn'))}">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>`).join('');
  el.querySelectorAll('[data-del-template]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uidCur = auth.currentUser && auth.currentUser.uid;
      if (!uidCur) return;
      db.collection('users').doc(uidCur).collection('workoutTemplates').doc(btn.dataset.delTemplate).delete()
        .catch((err) => console.error('deleteTemplate:', err));
    });
  });
}

function openTemplatesManager() {
  renderTemplateManageList();
  document.getElementById('templatesOverlay').classList.add('show');
}

document.getElementById('saveAsTemplateBtn').addEventListener('click', saveSessionAsTemplate);
document.getElementById('closeTemplates').addEventListener('click', () => {
  document.getElementById('templatesOverlay').classList.remove('show');
});
document.getElementById('templatesOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'templatesOverlay') e.currentTarget.classList.remove('show');
});

// ---- Збереження / видалення тренування ----
document.getElementById('sessionForm').addEventListener('submit', (e) => {
  e.preventDefault();
  saveSessionForm();
});

// Винесено з обробника події, бо збереження запускає ще й діалог
// «зберегти зміни перед виходом».
async function saveSessionForm() {
  const errorEl = document.getElementById('sessionFormError');
  const uidCur = auth.currentUser && auth.currentUser.uid;
  if (!uidCur) return;

  const cleanExercises = formExercises
    .map((ex) => ({
      id: ex.id, libId: ex.libId || null, customId: ex.libId ? null : (ex.customId || null), muscle: ex.muscle || null,
      name: ex.libId ? exerciseLabel(ex.libId) : (ex.name || '').trim(),
      // Порожні підходи лишаються, і вправа без жодного заповненого — теж.
      // Тренування часто записують наперед, планом: три порожні рядки — це
      // «три підходи, ваги ще не знаю». Викидати їх означало б стирати сам
      // план на очах у того, хто його щойно набрав.
      sets: (ex.sets || []).map((s) => ({
        weight: Number(s.weight) || 0,
        reps: Math.round(Number(s.reps) || 0),
      })),
    }))
    .filter((ex) => ex.name);

  if (!cleanExercises.length) {
    errorEl.textContent = t('noExerciseError');
    return;
  }
  errorEl.textContent = '';

  // Визначаємо, чи є новий рекорд, ПОРІВНЯНО зі станом до цього збереження.
  const priorRecords = computeRecords(editingSessionId);
  let bestPr = null; // { name, weight, reps, score }
  cleanExercises.forEach((ex) => {
    const key = exerciseKey(ex);
    const b = bestSet(ex.sets);
    if (!b || (!b.weight && !b.reps)) return;
    const prior = priorRecords.get(key);
    const priorScore = prior ? epley1RM(prior.best.weight, prior.best.reps) : 0;
    const curScore = epley1RM(b.weight, b.reps);
    if (curScore > priorScore && (curScore > 0)) {
      if (!bestPr || curScore > bestPr.score) {
        bestPr = { name: exerciseDisplayName(ex), weight: b.weight, reps: b.reps, score: curScore };
      }
    }
  });

  const payload = {
    date: document.getElementById('sessionDateInput').value || todayISO(),
    name: document.getElementById('sessionNameInput').value.trim(),
    notes: document.getElementById('sessionNotesInput').value.trim(),
    exercises: cleanExercises,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const submitBtn = document.getElementById('sessionSubmitBtn');
  submitBtn.disabled = true;
  try {
    const col = db.collection('users').doc(uidCur).collection('workouts');
    if (editingSessionId) {
      await col.doc(editingSessionId).update(payload);
    } else {
      await col.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    closeSessionForm();
    if (bestPr) showPrToast(bestPr.name, bestPr.weight, bestPr.reps);
  } catch (err) {
    console.error('save session:', err);
    errorEl.textContent = writeErrorMessage(err);
  } finally {
    submitBtn.disabled = false;
  }
}

let prToastTimer = null;
function showPrToast(name, weight, reps) {
  const toast = document.getElementById('prToast');
  document.getElementById('prToastText').textContent = t('prToastText', name, fmtNum(weight), reps);
  toast.classList.add('show');
  if (prToastTimer) clearTimeout(prToastTimer);
  prToastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
}

function applyConfirmTexts() {
  const isExercise = pendingDeleteKind === 'customExercise';
  document.getElementById('confirmTitle').textContent =
    t(isExercise ? 'confirmDeleteExerciseTitle' : 'confirmDeleteSessionTitle');
  document.getElementById('confirmSub').textContent =
    t(isExercise ? 'confirmDeleteExerciseSub' : 'confirmDeleteSessionSub');
}

function askDelete(kind, id) {
  pendingDeleteKind = kind;
  pendingDeleteId = id;
  applyConfirmTexts();
  document.getElementById('confirmOverlay').classList.add('show');
}

document.getElementById('deleteSessionBtn').addEventListener('click', () => {
  if (!editingSessionId) return;
  // Питати «зберегти зміни?» перед видаленням безглуздо — зберігати нема куди.
  // closeSessionForm() (а не просто ховання оверлея) скидає ще й знімок
  // гарда незбереженого; askDelete виставляє тексти й колекцію для видалення.
  closeSessionForm();
  askDelete('session', editingSessionId);
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
  const colName = pendingDeleteKind === 'customExercise' ? 'customExercises' : 'workouts';
  try {
    await db.collection('users').doc(auth.currentUser.uid).collection(colName).doc(pendingDeleteId).delete();
  } catch (err) {
    console.error('delete ' + colName + ':', err);
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
  // Даємо підписці домалювати перший кадр: форма читає категорії, шаблони
  // й решту того, що приїжджає першим снапшотом.
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
    db.collection('users').doc(user.uid).get().then((doc) => {
      const data = doc.data();
      if (data && data.lang && LANGS.includes(data.lang) && data.lang !== currentLang) {
        currentLang = data.lang;
        localStorage.setItem('financeAppLang', currentLang);
        applyTranslations();
        renderAuthLangRow();
        renderCurrentScreen();
      }
    }).catch(() => {});
    subscribeToSessions(user.uid);
    subscribeToReadiness(user.uid);
    subscribeToGoals(user.uid);
    subscribeToGoalCategories(user.uid);
    openFromHash(() => openSessionForm(null));
    subscribeToTemplates(user.uid);
    subscribeToCustomExercises(user.uid);
  } else {
    if (unsubscribeSessions) { unsubscribeSessions(); unsubscribeSessions = null; }
    if (unsubscribeReadiness) { unsubscribeReadiness(); unsubscribeReadiness = null; }
    if (unsubscribeGoals) { unsubscribeGoals(); unsubscribeGoals = null; goals = []; }
    if (unsubscribeGoalCategories) { unsubscribeGoalCategories(); unsubscribeGoalCategories = null; goalCategoryIds = null; }
    if (unsubscribeTemplates) { unsubscribeTemplates(); unsubscribeTemplates = null; }
    if (unsubscribeCustomExercises) { unsubscribeCustomExercises(); unsubscribeCustomExercises = null; }
    readiness = null;
    customExercises = [];
    sessions = [];
    templates = [];
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
initDatePicker('sessionDateInput');
applyTheme();
applyTranslations();
renderAuthLangRow();
setAuthMode('login');
switchTab('sessions');
