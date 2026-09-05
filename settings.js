/**
 *  Вікно налаштувань — одне на всі пʼять сторінок.
 *
 *  До нього налаштування жили в чотирьох різних місцях: тема й мова — в
 *  гамбургері головної, валюта й категорії витрат — у «⋮» бюджету,
 *  нагадування — в «⋮» завдань, категорії цілей — усередині форми цілі.
 *  Щоб змінити мову, треба було спершу згадати, що вона на головній.
 *  Тепер вхід один, а вкладка каже, до чого належить параметр.
 *
 *  ЩО СЮДИ НЕ ПЕРЕЇХАЛО і чому: шаблони, регулярні операції й імпорт CSV —
 *  це не параметри, а вміст, який ведуть постійно. Вони лишились у своїх
 *  розділах, а тут стоять рядки, що ведуть туди: інакше вікно налаштувань
 *  перетворилось би на другий застосунок.
 *
 *  Стан вікно тримає САМЕ: підписується на профіль користувача при першому
 *  відкритті й пише туди ж. Сторінки нічого йому не переказують — у них
 *  свої підписки на той самий документ, тож зміна звідси доїжджає до них
 *  сама. Ціна — один зайвий слухач на сторінку, і той лише після того, як
 *  вікно бодай раз відкрили.
 *
 *  Тему й мову вікно НЕ застосовує: воно лише каже сторінці, що обрали
 *  (`onTheme` / `onLang`), а та робить те саме, що робила з власного меню.
 *  Інакше довелось би переносити сюди applyTranslations кожної сторінки.
 *
 *  Розмітку малює mount(), стилі — в settings.css.
 */
(function (root) {
  'use strict';

  var LANGS = ['uk', 'ru', 'pl', 'en'];
  var LANG_NAMES = { uk: 'Українська', ru: 'Русский', pl: 'Polski', en: 'English' };
  var THEME_CHOICES = ['light', 'dark', 'system'];
  var CURRENCIES = { UAH: '₴', USD: '$', EUR: '€', PLN: 'zł' };
  var CURRENCY_CODES = ['UAH', 'USD', 'EUR', 'PLN'];
  // Ті самі години, що пропонувало вікно нагадувань у завданнях.
  var MORNING_HOURS = [6, 7, 8, 9, 10, 21];
  var EVENING_HOURS = [18, 19, 20, 21, 22];

  var TEXTS = {
    uk: {
      title: 'Налаштування', close: 'Закрити', back: 'Назад',
      groupApp: 'Застосунок', groupSections: 'Розділи', groupOther: 'Дані й акаунт',
      tabGeneral: 'Загальні', tabBudget: 'Гроші', tabTasks: 'Завдання',
      tabGoals: 'Цілі', tabWorkout: 'Тренування', tabData: 'Дані', tabAccount: 'Акаунт',
      theme: 'Тема', themeLight: 'Світла', themeDark: 'Темна', themeSystem: 'Як у системі',
      lang: 'Мова',
      currency: 'Валюта',
      catExpense: 'Категорії витрат', catIncome: 'Категорії доходів',
      catGoals: 'Категорії цілей', catWeek: 'Категорії тижневика',
      newCat: 'Нова категорія', addCat: 'Додати категорію', delCat: 'Видалити категорію',
      catDuplicate: 'Така категорія вже є.',
      catLast: 'Останню категорію прибрати не можна.',
      catSaveError: 'Не вдалося зберегти. Перевір інтернет і спробуй ще раз.',
      catInUse: function (n, target) {
        return 'Ця категорія стоїть у ' + n + ' записах. Вони перейдуть у «' + target + '». Прибрати?';
      },
      catWeekHint: 'Прибрана категорія нічого не стирає: її записи просто йдуть у групу без назви.',
      catGoalsHint: 'Список спільний для всіх цілей. Видалена категорія віддає свої цілі першій зі списку.',
      reminders: 'Нагадування',
      remindOn: 'Сповіщення увімкнені на цьому пристрої.',
      remindOff: 'Сповіщення вимкнені. Увімкни — і застосунок нагадає про завдання й пришле огляд дня.',
      remindEnable: 'Увімкнути сповіщення',
      remindMorning: 'Ранковий огляд дня', remindEvening: 'Вечірній підсумок',
      remindNever: 'Не треба',
      remindElsewhere: 'Сповіщення вмикаються для пристрою в розділі «Завдання» — там живе служба, яка їх приймає.',
      goToTasks: 'Відкрити «Завдання»',
      recurring: 'Регулярні операції',
      recurringSub: 'Оренда, підписки, зарплата — щоб не вбивати їх щомісяця руками.',
      importCsv: 'Імпорт транзакцій з CSV',
      importCsvSub: 'Колонки: дата (РРРР-ММ-ДД), тип (дохід/витрата), категорія, сума, нотатка.',
      taskTemplates: 'Шаблони завдань',
      taskTemplatesSub: 'Те, що заводиш раз у раз, — одним тапом у швидкому додаванні.',
      workoutTemplates: 'Шаблони тренувань',
      workoutTemplatesSub: 'Готовий каркас вправ, з якого починається тренування.',
      exportTitle: 'Експорт даних',
      exportSub: 'Уся база одним файлом: таблиця або JSON.',
      email: 'Пошта',
      logout: 'Вийти', logoutSub: 'З цього пристрою. Дані лишаються в акаунті.',
      workoutEmpty: 'Окремих параметрів у тренувань поки немає.',
    },
    ru: {
      title: 'Настройки', close: 'Закрыть', back: 'Назад',
      groupApp: 'Приложение', groupSections: 'Разделы', groupOther: 'Данные и аккаунт',
      tabGeneral: 'Общие', tabBudget: 'Деньги', tabTasks: 'Задачи',
      tabGoals: 'Цели', tabWorkout: 'Тренировки', tabData: 'Данные', tabAccount: 'Аккаунт',
      theme: 'Тема', themeLight: 'Светлая', themeDark: 'Тёмная', themeSystem: 'Как в системе',
      lang: 'Язык',
      currency: 'Валюта',
      catExpense: 'Категории расходов', catIncome: 'Категории доходов',
      catGoals: 'Категории целей', catWeek: 'Категории недели',
      newCat: 'Новая категория', addCat: 'Добавить категорию', delCat: 'Удалить категорию',
      catDuplicate: 'Такая категория уже есть.',
      catLast: 'Последнюю категорию убрать нельзя.',
      catSaveError: 'Не удалось сохранить. Проверь интернет и попробуй ещё раз.',
      catInUse: function (n, target) {
        return 'Эта категория стоит в ' + n + ' записях. Они перейдут в «' + target + '». Убрать?';
      },
      catWeekHint: 'Убранная категория ничего не стирает: её записи просто идут в группу без названия.',
      catGoalsHint: 'Список общий для всех целей. Удалённая категория отдаёт свои цели первой в списке.',
      reminders: 'Напоминания',
      remindOn: 'Уведомления включены на этом устройстве.',
      remindOff: 'Уведомления выключены. Включи — и приложение напомнит о задачах и пришлёт обзор дня.',
      remindEnable: 'Включить уведомления',
      remindMorning: 'Утренний обзор дня', remindEvening: 'Вечерний итог',
      remindNever: 'Не надо',
      remindElsewhere: 'Уведомления включаются для устройства в разделе «Задачи» — там живёт служба, которая их принимает.',
      goToTasks: 'Открыть «Задачи»',
      recurring: 'Регулярные операции',
      recurringSub: 'Аренда, подписки, зарплата — чтобы не вбивать их каждый месяц руками.',
      importCsv: 'Импорт транзакций из CSV',
      importCsvSub: 'Колонки: дата (ГГГГ-ММ-ДД), тип (доход/расход), категория, сумма, заметка.',
      taskTemplates: 'Шаблоны задач',
      taskTemplatesSub: 'То, что заводишь раз за разом, — одним тапом в быстром добавлении.',
      workoutTemplates: 'Шаблоны тренировок',
      workoutTemplatesSub: 'Готовый каркас упражнений, с которого начинается тренировка.',
      exportTitle: 'Экспорт данных',
      exportSub: 'Вся база одним файлом: таблица или JSON.',
      email: 'Почта',
      logout: 'Выйти', logoutSub: 'С этого устройства. Данные остаются в аккаунте.',
      workoutEmpty: 'Отдельных параметров у тренировок пока нет.',
    },
    pl: {
      title: 'Ustawienia', close: 'Zamknij', back: 'Wstecz',
      groupApp: 'Aplikacja', groupSections: 'Sekcje', groupOther: 'Dane i konto',
      tabGeneral: 'Ogólne', tabBudget: 'Pieniądze', tabTasks: 'Zadania',
      tabGoals: 'Cele', tabWorkout: 'Treningi', tabData: 'Dane', tabAccount: 'Konto',
      theme: 'Motyw', themeLight: 'Jasny', themeDark: 'Ciemny', themeSystem: 'Jak w systemie',
      lang: 'Język',
      currency: 'Waluta',
      catExpense: 'Kategorie wydatków', catIncome: 'Kategorie przychodów',
      catGoals: 'Kategorie celów', catWeek: 'Kategorie tygodnia',
      newCat: 'Nowa kategoria', addCat: 'Dodaj kategorię', delCat: 'Usuń kategorię',
      catDuplicate: 'Taka kategoria już jest.',
      catLast: 'Nie można usunąć ostatniej kategorii.',
      catSaveError: 'Nie udało się zapisać. Sprawdź internet i spróbuj ponownie.',
      catInUse: function (n, target) {
        return 'Ta kategoria jest w ' + n + ' wpisach. Przejdą do „' + target + '". Usunąć?';
      },
      catWeekHint: 'Usunięta kategoria niczego nie kasuje: jej wpisy trafiają do grupy bez nazwy.',
      catGoalsHint: 'Lista jest wspólna dla wszystkich celów. Usunięta kategoria oddaje swoje cele pierwszej z listy.',
      reminders: 'Przypomnienia',
      remindOn: 'Powiadomienia są włączone na tym urządzeniu.',
      remindOff: 'Powiadomienia są wyłączone. Włącz — a aplikacja przypomni o zadaniach i przyśle przegląd dnia.',
      remindEnable: 'Włącz powiadomienia',
      remindMorning: 'Poranny przegląd dnia', remindEvening: 'Wieczorne podsumowanie',
      remindNever: 'Nie trzeba',
      remindElsewhere: 'Powiadomienia włącza się dla urządzenia w sekcji „Zadania" — tam działa usługa, która je odbiera.',
      goToTasks: 'Otwórz „Zadania"',
      recurring: 'Operacje cykliczne',
      recurringSub: 'Czynsz, subskrypcje, wypłata — żeby nie wbijać ich co miesiąc ręcznie.',
      importCsv: 'Import transakcji z CSV',
      importCsvSub: 'Kolumny: data (RRRR-MM-DD), typ (przychód/wydatek), kategoria, kwota, notatka.',
      taskTemplates: 'Szablony zadań',
      taskTemplatesSub: 'To, co zakładasz raz po raz — jednym tapnięciem w szybkim dodawaniu.',
      workoutTemplates: 'Szablony treningów',
      workoutTemplatesSub: 'Gotowy szkielet ćwiczeń, od którego zaczyna się trening.',
      exportTitle: 'Eksport danych',
      exportSub: 'Cała baza w jednym pliku: tabela albo JSON.',
      email: 'E-mail',
      logout: 'Wyloguj się', logoutSub: 'Z tego urządzenia. Dane zostają na koncie.',
      workoutEmpty: 'Treningi nie mają jeszcze osobnych ustawień.',
    },
    en: {
      title: 'Settings', close: 'Close', back: 'Back',
      groupApp: 'App', groupSections: 'Sections', groupOther: 'Data and account',
      tabGeneral: 'General', tabBudget: 'Money', tabTasks: 'Tasks',
      tabGoals: 'Goals', tabWorkout: 'Workouts', tabData: 'Data', tabAccount: 'Account',
      theme: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System',
      lang: 'Language',
      currency: 'Currency',
      catExpense: 'Expense categories', catIncome: 'Income categories',
      catGoals: 'Goal categories', catWeek: 'Week categories',
      newCat: 'New category', addCat: 'Add category', delCat: 'Delete category',
      catDuplicate: 'That category already exists.',
      catLast: 'The last category cannot be removed.',
      catSaveError: 'Could not save. Check your connection and try again.',
      catInUse: function (n, target) {
        return 'This category is used by ' + n + ' entries. They will move to "' + target + '". Remove it?';
      },
      catWeekHint: 'Removing a category deletes nothing: its entries move to the unnamed group.',
      catGoalsHint: 'The list is shared by every goal. A deleted category hands its goals to the first one on the list.',
      reminders: 'Reminders',
      remindOn: 'Notifications are on for this device.',
      remindOff: 'Notifications are off. Turn them on and the app will remind you about tasks and send the daily digest.',
      remindEnable: 'Turn on notifications',
      remindMorning: 'Morning digest', remindEvening: 'Evening summary',
      remindNever: 'Off',
      remindElsewhere: 'Notifications are switched on for a device in the Tasks section — that is where the service receiving them lives.',
      goToTasks: 'Open Tasks',
      recurring: 'Recurring transactions',
      recurringSub: 'Rent, subscriptions, salary — so you do not enter them by hand every month.',
      importCsv: 'Import transactions from CSV',
      importCsvSub: 'Columns: date (YYYY-MM-DD), type (income/expense), category, amount, note.',
      taskTemplates: 'Task templates',
      taskTemplatesSub: 'What you create over and over — one tap in quick add.',
      workoutTemplates: 'Workout templates',
      workoutTemplatesSub: 'A ready set of exercises a workout starts from.',
      exportTitle: 'Export data',
      exportSub: 'The whole database in one file: a table or JSON.',
      email: 'Email',
      logout: 'Log out', logoutSub: 'From this device. Your data stays in the account.',
      workoutEmpty: 'Workouts have no separate settings yet.',
    },
  };

  var ICONS = {
    general: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56v.17a1.9 1.9 0 1 1-3.8 0v-.1a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.06A1.7 1.7 0 0 0 5 15a1.7 1.7 0 0 0-1.56-1.04H3.3a1.9 1.9 0 1 1 0-3.8h.1A1.7 1.7 0 0 0 5 9.05a1.7 1.7 0 0 0-.34-1.87l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.06.06a1.7 1.7 0 0 0 1.87.34H9.3a1.7 1.7 0 0 0 1.03-1.56V3.3a1.9 1.9 0 1 1 3.8 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.56 1.03h.17a1.9 1.9 0 1 1 0 3.8h-.1A1.7 1.7 0 0 0 19.4 15z"/>',
    budget: '<rect x="2.5" y="6" width="19" height="13" rx="3"/><path d="M2.5 10h19"/>',
    tasks: '<path d="M4 7l2.5 2.5L11 5"/><path d="M4 17l2.5 2.5L11 15"/><path d="M14 8h6"/><path d="M14 18h6"/>',
    goals: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    workout: '<path d="M6.5 8v8"/><path d="M17.5 8v8"/><path d="M3.5 10.5v3"/><path d="M20.5 10.5v3"/><path d="M6.5 12h11"/>',
    data: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/>',
    account: '<circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  };

  // Порядок такий самий, як у бічній колонці розділів: спершу застосунок,
  // далі розділи в тому ж порядку, наприкінці — те, що стосується акаунта.
  var TABS = [
    { key: 'general', group: 'groupApp' },
    { key: 'budget', group: 'groupSections' },
    { key: 'tasks', group: 'groupSections' },
    { key: 'goals', group: 'groupSections' },
    { key: 'workout', group: 'groupSections' },
    { key: 'data', group: 'groupOther' },
    { key: 'account', group: 'groupOther' },
  ];

  // Що вміє кожен зі списків категорій. Різниця між ними лише в трьох
  // речах — де лежить, чи має колір і куди йдуть осиротілі записи, — тож
  // сам редактор один на всі чотири.
  var CAT_KINDS = {
    expense: { field: 'categoriesExpense', colored: true, reassign: 'transactions', label: 'catExpense' },
    income: { field: 'categoriesIncome', colored: true, reassign: 'transactions', label: 'catIncome' },
    goals: { field: 'categoriesGoals', colored: true, reassign: 'goals', label: 'catGoals' },
    week: { field: 'categoriesWeek', colored: false, reassign: null, label: 'catWeek' },
  };

  var cfg = null;
  var lang = 'uk';
  var profile = {};
  var unsubProfile = null;
  var currentTab = 'general';
  var win = null;
  var overlay = null;
  var errorText = '';
  var pushError = null;

  function t(key) {
    var dict = TEXTS[lang] || TEXTS.uk;
    var value = dict[key];
    if (value === undefined) value = TEXTS.uk[key];
    return value === undefined ? key : value;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function icon(key, size) {
    var s = size || 17;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none"' +
      ' stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ICONS[key] + '</svg>';
  }

  function uid() {
    return cfg && cfg.auth && cfg.auth.currentUser ? cfg.auth.currentUser.uid : null;
  }

  function profileRef() {
    var id = uid();
    return id ? cfg.db.collection('users').doc(id) : null;
  }

  // ---- Категорії ----

  var PALETTE_FALLBACK = [{ text: '#3E7C59' }];
  function palette() {
    return (root.CATEGORY_PALETTE && root.CATEGORY_PALETTE.length)
      ? root.CATEGORY_PALETTE : PALETTE_FALLBACK;
  }

  // Колір за colorIndex, а без нього — виведений з id. Категорія без
  // colorIndex тут реальна: такою її міг записати давніший запис.
  function catColor(cat) {
    var pal = palette();
    if (cat && typeof cat.colorIndex === 'number' && isFinite(cat.colorIndex)) {
      return pal[Math.abs(cat.colorIndex) % pal.length].text;
    }
    var id = String((cat && cat.id) || '');
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return pal[h % pal.length].text;
  }

  function defaultsFor(kind) {
    var size = palette().length;
    if (kind === 'goals') return root.defaultGoalCategoryList(lang, size);
    if (kind === 'week') return root.defaultWeekCategoryList(lang);
    return root.defaultCategoryList(kind, lang, size);
  }

  // Порожньо в профілі означає не «категорій немає», а «людина їх ще не
  // чіпала»: тоді показуємо стандартні — рівно те, що показує сама сторінка.
  function categoriesOf(kind) {
    var saved = profile[CAT_KINDS[kind].field];
    if (Array.isArray(saved) && saved.length) return saved;
    return defaultsFor(kind);
  }

  function saveCategories(kind, list) {
    var ref = profileRef();
    if (!ref) return Promise.resolve();
    var patch = {};
    patch[CAT_KINDS[kind].field] = list;
    // Малюємо одразу, не чекаючи на снапшот: інакше поле назви на секунду
    // поверталось би до старого значення.
    profile[CAT_KINDS[kind].field] = list;
    renderPane();
    return ref.set(patch, { merge: true });
  }

  function newCatId() {
    return 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addCategory(kind, label) {
    label = String(label || '').trim();
    if (!label) return Promise.resolve();
    var list = categoriesOf(kind);
    if (list.some(function (c) { return c.label.trim().toLowerCase() === label.toLowerCase(); })) {
      return Promise.reject(new Error('duplicate'));
    }
    var cat = { id: newCatId(), label: label };
    if (CAT_KINDS[kind].colored) {
      // Перший вільний слот палітри, а не наступний по колу: інакше нова
      // категорія повторювала б колір уже наявної, доки палітра не скінчиться.
      var used = list.map(function (c) { return c.colorIndex; });
      var pal = palette();
      cat.colorIndex = list.length % pal.length;
      for (var i = 0; i < pal.length; i++) {
        if (used.indexOf(i) === -1) { cat.colorIndex = i; break; }
      }
    }
    return saveCategories(kind, list.concat([cat]));
  }

  function renameCategory(kind, id, label) {
    label = String(label || '').trim();
    if (!label) return Promise.resolve();
    var list = categoriesOf(kind);
    if (list.some(function (c) {
      return c.id !== id && c.label.trim().toLowerCase() === label.toLowerCase();
    })) return Promise.reject(new Error('duplicate'));
    return saveCategories(kind, list.map(function (c) {
      return c.id === id ? Object.assign({}, c, { label: label }) : c;
    }));
  }

  /**
   * Скільки записів стоїть у категорії і які саме.
   *
   * Запитом, а не з уже завантаженого масиву: вікно відкривається з
   * будь-якої сторінки, і на сторінці завдань ніяких транзакцій у памʼяті
   * немає. Запит по одному полю — щоб не заводити складений індекс; тип
   * («витрата» чи «дохід») відсіюємо вже тут, бо стандартні id категорій
   * витрат і доходів перетинаються на «other».
   */
  function usersOfCategory(kind, id) {
    var ref = profileRef();
    var reassign = CAT_KINDS[kind].reassign;
    if (!ref || !reassign) return Promise.resolve([]);
    var col = ref.collection(reassign === 'goals' ? 'goals' : 'transactions');
    return col.where('category', '==', id).get().then(function (snap) {
      return snap.docs.filter(function (doc) {
        var data = doc.data() || {};
        // Категорію звіряємо ще раз самі: помилка тут коштувала б переносу
        // чужих записів, а це те, чого вже не відкотиш.
        if (data.category !== id) return false;
        if (reassign !== 'transactions') return true;
        return data.type === kind;
      });
    });
  }

  function deleteCategory(kind, id, docs) {
    var ref = profileRef();
    if (!ref) return Promise.resolve();
    var list = categoriesOf(kind).filter(function (c) { return c.id !== id; });
    if (!docs || !docs.length) return saveCategories(kind, list);
    // Осиротілий id показувався б у списках службовим рядком замість
    // людяної назви, тож записи переходять до першої з тих, що лишились.
    var fallback = list[0].id;
    var batch = cfg.db.batch();
    docs.forEach(function (doc) { batch.update(doc.ref, { category: fallback }); });
    return batch.commit().then(function () { return saveCategories(kind, list); });
  }

  function catEditorHtml(kind) {
    var kindCfg = CAT_KINDS[kind];
    var rows = categoriesOf(kind).map(function (cat) {
      var dot = kindCfg.colored
        ? '<span class="settings-cat-dot" style="background:' + catColor(cat) + '"></span>'
        : '';
      return '<div class="settings-cat-row">' + dot +
        '<input type="text" class="settings-cat-input" maxlength="40" value="' +
          escapeHtml(cat.label) + '" data-cat-name="' + escapeHtml(cat.id) + '">' +
        '<button type="button" class="settings-cat-del" data-cat-del="' + escapeHtml(cat.id) +
          '" aria-label="' + escapeHtml(t('delCat')) + '">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
          ' stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button></div>';
    }).join('');
    return '<div class="settings-section" data-cat-kind="' + kind + '">' +
      '<span class="settings-label">' + escapeHtml(t(kindCfg.label)) + '</span>' +
      rows +
      '<div class="settings-cat-add">' +
        '<input type="text" maxlength="40" data-cat-new placeholder="' + escapeHtml(t('newCat')) + '">' +
        '<button type="button" data-cat-add aria-label="' + escapeHtml(t('addCat')) + '">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
          ' stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
        '</button>' +
      '</div>' +
      (kind === 'week' ? '<div class="settings-hint">' + escapeHtml(t('catWeekHint')) + '</div>' : '') +
      (kind === 'goals' ? '<div class="settings-hint">' + escapeHtml(t('catGoalsHint')) + '</div>' : '') +
      '</div>';
  }

  function bindCatEditor(section) {
    var kind = section.dataset.catKind;

    section.querySelectorAll('[data-cat-name]').forEach(function (input) {
      var id = input.dataset.catName;
      var commit = function () {
        var cat = categoriesOf(kind).filter(function (c) { return c.id === id; })[0];
        if (!cat) return;
        var value = input.value.trim();
        // Порожнє поле — це не «прибрати назву», а промах: для видалення
        // поруч стоїть хрестик. Повертаємо як було.
        if (!value || value === cat.label) { input.value = cat.label; return; }
        showError('');
        renameCategory(kind, id, value).catch(function (err) {
          input.value = cat.label;
          showError(err && err.message === 'duplicate' ? t('catDuplicate') : t('catSaveError'));
        });
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    });

    section.querySelectorAll('[data-cat-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.catDel;
        var list = categoriesOf(kind);
        if (list.length <= 1) { showError(t('catLast')); return; }
        showError('');
        var target = list.filter(function (c) { return c.id !== id; })[0];
        usersOfCategory(kind, id).then(function (docs) {
          if (docs.length && !root.confirm(t('catInUse')(docs.length, target.label))) return null;
          return deleteCategory(kind, id, docs);
        }).catch(function () { showError(t('catSaveError')); });
      });
    });

    var input = section.querySelector('[data-cat-new]');
    var add = function () {
      var label = input.value.trim();
      if (!label) return;
      showError('');
      addCategory(kind, label).then(function () { input.value = ''; }).catch(function (err) {
        showError(err && err.message === 'duplicate' ? t('catDuplicate') : t('catSaveError'));
      });
    };
    section.querySelector('[data-cat-add]').addEventListener('click', add);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); add(); }
    });
  }

  // ---- Дрібні цеглинки панелі ----

  function choicesHtml(label, options, selected, attr) {
    return '<div class="settings-section">' +
      '<span class="settings-label">' + escapeHtml(label) + '</span>' +
      '<div class="settings-choices">' + options.map(function (o) {
        return '<button type="button" class="settings-choice' +
          (o.value === selected ? ' selected' : '') + '" ' + attr + '="' +
          escapeHtml(String(o.value)) + '">' + escapeHtml(o.label) + '</button>';
      }).join('') + '</div></div>';
  }

  /**
   * Рядок-дія. href — перехід у розділ, без нього це кнопка.
   * Саме посилання, а не кнопка з location.href: тап середньою кнопкою й
   * «відкрити в новій вкладці» на комп'ютері мають працювати.
   */
  function actionHtml(opts) {
    var body = '<span class="settings-action-icon">' +
        '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
        ' stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + opts.icon + '</svg>' +
      '</span><span class="settings-action-text">' +
        '<span class="settings-action-title">' + escapeHtml(opts.title) + '</span>' +
        (opts.sub ? '<span class="settings-action-sub">' + escapeHtml(opts.sub) + '</span>' : '') +
      '</span>';
    var cls = 'settings-action' + (opts.danger ? ' danger' : '');
    if (opts.href) return '<a class="' + cls + '" href="' + escapeHtml(opts.href) + '">' + body + '</a>';
    return '<button type="button" class="' + cls + '" ' + opts.attr + '>' + body + '</button>';
  }

  var ICON_ARROW = '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>';
  var ICON_REPEAT = '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>';
  var ICON_UP = '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M4 5h16"/>';
  var ICON_DOWN = '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/>';
  var ICON_LIST = '<path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/>';
  var ICON_EXIT = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>';

  function sectionHref(name) {
    return (cfg.base || '') + name + '/index.html';
  }

  /**
   * Рядок, що веде до екрана розділу. Коли ми вже на цій сторінці, вести
   * нема куди — вона просто перезавантажилась би, — тож сторінка передає
   * сюди свій обробник (`actions`), і рядок стає кнопкою.
   */
  function sectionRow(key, section, hash, opts) {
    var action = cfg.actions && cfg.actions[key];
    return actionHtml(Object.assign({}, opts, action
      ? { attr: 'data-action="' + key + '"' }
      : { href: sectionHref(section) + hash }));
  }

  // ---- Нагадування ----

  function reminderSettings() {
    var saved = profile.taskReminders || {};
    return {
      enabled: !!saved.enabled,
      morningHour: typeof saved.morningHour === 'number' ? saved.morningHour : 8,
      eveningHour: typeof saved.eveningHour === 'number' ? saved.eveningHour : 20,
    };
  }

  function saveReminders(patch) {
    var ref = profileRef();
    if (!ref) return Promise.resolve();
    var next = Object.assign({}, profile.taskReminders || {}, reminderSettings(), patch, {
      // Таймзона потрібна серверу: він живе в UTC і без неї надіслав би
      // «ранковий» дайджест серед ночі.
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    });
    profile.taskReminders = next;
    renderPane();
    return ref.set({ taskReminders: next }, { merge: true })
      .catch(function () { showError(t('catSaveError')); });
  }

  function hoursHtml(label, hours, selected, attr) {
    var options = hours.map(function (h) {
      return { value: h, label: (h < 10 ? '0' : '') + h + ':00' };
    });
    options.push({ value: 'off', label: t('remindNever') });
    return choicesHtml(label, options, selected === null ? 'off' : selected, attr);
  }

  function remindersHtml() {
    // Дозвіл на сповіщення дає служба, яка їх приймає, а живе вона в
    // розділі завдань. Тому з інших сторінок вікно показує стан і години,
    // а вмикання відсилає туди, де воно справді працює.
    if (!cfg.push) {
      return '<div class="settings-section">' +
        '<span class="settings-label">' + escapeHtml(t('reminders')) + '</span>' +
        '<div class="settings-hint">' + escapeHtml(t('remindElsewhere')) + '</div>' +
        actionHtml({ icon: ICON_ARROW, title: t('goToTasks'), href: sectionHref('tasks') + '#reminders' }) +
        '</div>';
    }
    var support = cfg.push.support();
    var permission = cfg.push.permission();
    var s = reminderSettings();
    var active = support === 'ok' && permission === 'granted' && s.enabled;
    var state = pushError ? pushError
      : support !== 'ok' || permission === 'denied' ? cfg.push.stateText(support, permission)
      : active ? t('remindOn') : t('remindOff');

    var html = '<div class="settings-section">' +
      '<span class="settings-label">' + escapeHtml(t('reminders')) + '</span>' +
      '<div class="settings-hint">' + escapeHtml(state) + '</div>';
    if (!active && support === 'ok' && permission !== 'denied') {
      html += actionHtml({ icon: ICON_ARROW, title: t('remindEnable'), attr: 'data-push-enable' });
    }
    html += '</div>';
    if (!active) return html;
    return html +
      hoursHtml(t('remindMorning'), MORNING_HOURS, s.morningHour, 'data-morning') +
      hoursHtml(t('remindEvening'), EVENING_HOURS, s.eveningHour, 'data-evening');
  }

  // ---- Вміст вкладок ----

  function paneHtml(tab) {
    if (tab === 'general') {
      return choicesHtml(t('theme'), THEME_CHOICES.map(function (k) {
        return { value: k, label: t('theme' + k.charAt(0).toUpperCase() + k.slice(1)) };
      }), cfg.theme(), 'data-theme-choice') +
        choicesHtml(t('lang'), LANGS.map(function (l) {
          return { value: l, label: LANG_NAMES[l] };
        }), lang, 'data-lang-choice');
    }

    if (tab === 'budget') {
      var currency = profile.currency || root.localStorage.getItem('financeAppCurrency') || 'UAH';
      return choicesHtml(t('currency'), CURRENCY_CODES.map(function (c) {
        return { value: c, label: c + ' ' + CURRENCIES[c] };
      }), currency, 'data-currency') +
        catEditorHtml('expense') +
        catEditorHtml('income') +
        '<div class="settings-section">' +
          sectionRow('recurring', 'budget', '#recurring',
            { icon: ICON_REPEAT, title: t('recurring'), sub: t('recurringSub') }) +
          sectionRow('import', 'budget', '#import',
            { icon: ICON_UP, title: t('importCsv'), sub: t('importCsvSub') }) +
        '</div>';
    }

    if (tab === 'tasks') {
      return remindersHtml() + catEditorHtml('week') +
        '<div class="settings-section">' +
          sectionRow('taskTemplates', 'tasks', '#templates',
            { icon: ICON_LIST, title: t('taskTemplates'), sub: t('taskTemplatesSub') }) +
        '</div>';
    }

    if (tab === 'goals') return catEditorHtml('goals');

    if (tab === 'workout') {
      return '<div class="settings-section">' +
        '<div class="settings-hint" style="margin-top:0;margin-bottom:12px;">' +
          escapeHtml(t('workoutEmpty')) + '</div>' +
        sectionRow('workoutTemplates', 'workout', '#templates',
          { icon: ICON_LIST, title: t('workoutTemplates'), sub: t('workoutTemplatesSub') }) +
        '</div>';
    }

    if (tab === 'data') {
      return '<div class="settings-section">' + (cfg.onExport
        ? actionHtml({ icon: ICON_DOWN, title: t('exportTitle'), sub: t('exportSub'), attr: 'data-export' })
        : actionHtml({
          icon: ICON_DOWN, title: t('exportTitle'), sub: t('exportSub'),
          href: (cfg.base || '') + 'index.html#export',
        })) + '</div>';
    }

    if (tab === 'account') {
      var user = cfg.auth && cfg.auth.currentUser;
      return '<div class="settings-section">' +
        '<span class="settings-label">' + escapeHtml(t('email')) + '</span>' +
        '<div class="settings-value">' + escapeHtml((user && user.email) || '') + '</div>' +
        '</div>' +
        '<div class="settings-section">' + actionHtml({
          icon: ICON_EXIT, title: t('logout'), sub: t('logoutSub'),
          attr: 'data-logout', danger: true,
        }) + '</div>';
    }
    return '';
  }

  // ---- Малювання ----

  function renderTabs() {
    var el = win.querySelector('.settings-tabs');
    var group = null;
    el.innerHTML = TABS.map(function (tab) {
      var head = '';
      if (tab.group !== group) {
        group = tab.group;
        head = '<div class="settings-group-label">' + escapeHtml(t(group)) + '</div>';
      }
      return head + '<button type="button" class="settings-tab' +
        (tab.key === currentTab ? ' current' : '') + '" data-tab="' + tab.key + '">' +
        icon(tab.key) + '<span>' + escapeHtml(t('tab' + tab.key.charAt(0).toUpperCase() + tab.key.slice(1))) +
        '</span><span class="settings-tab-arrow">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
        ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' +
        '</span></button>';
    }).join('');
    el.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { openTab(btn.dataset.tab); });
    });
  }

  function tabTitle(key) {
    return t('tab' + key.charAt(0).toUpperCase() + key.slice(1));
  }

  function renderPane() {
    var pane = win.querySelector('.settings-pane');
    pane.innerHTML = '<div class="settings-pane-title">' + escapeHtml(tabTitle(currentTab)) + '</div>' +
      paneHtml(currentTab) +
      '<div class="settings-error">' + escapeHtml(errorText) + '</div>';
    pane.scrollTop = 0;
    bindPane(pane);
  }

  function showError(text) {
    errorText = text || '';
    var el = win.querySelector('.settings-error');
    if (el) el.textContent = errorText;
  }

  function bindPane(pane) {
    pane.querySelectorAll('[data-cat-kind]').forEach(bindCatEditor);

    pane.querySelectorAll('[data-theme-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cfg.onTheme(btn.dataset.themeChoice);
        renderPane();
      });
    });
    pane.querySelectorAll('[data-lang-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () { cfg.onLang(btn.dataset.langChoice); });
    });
    pane.querySelectorAll('[data-currency]').forEach(function (btn) {
      btn.addEventListener('click', function () { setCurrency(btn.dataset.currency); });
    });
    pane.querySelectorAll('[data-morning]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveReminders({ morningHour: btn.dataset.morning === 'off' ? null : Number(btn.dataset.morning) });
      });
    });
    pane.querySelectorAll('[data-evening]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveReminders({ eveningHour: btn.dataset.evening === 'off' ? null : Number(btn.dataset.evening) });
      });
    });

    var pushBtn = pane.querySelector('[data-push-enable]');
    if (pushBtn) {
      pushBtn.addEventListener('click', function () {
        pushBtn.disabled = true;
        cfg.push.enable().then(function (result) {
          pushBtn.disabled = false;
          if (result && result.ok) { pushError = null; saveReminders({ enabled: true }); }
          else { pushError = (result && result.text) || t('catSaveError'); renderPane(); }
        });
      });
    }

    pane.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        close();
        cfg.actions[btn.dataset.action]();
      });
    });

    var exportBtn = pane.querySelector('[data-export]');
    if (exportBtn) exportBtn.addEventListener('click', function () { close(); cfg.onExport(); });

    var logoutBtn = pane.querySelector('[data-logout]');
    if (logoutBtn) logoutBtn.addEventListener('click', function () { close(); cfg.onLogout(); });
  }

  function setCurrency(code) {
    if (CURRENCY_CODES.indexOf(code) === -1) return;
    profile.currency = code;
    try { root.localStorage.setItem('financeAppCurrency', code); } catch (err) { /* приватний режим */ }
    renderPane();
    var ref = profileRef();
    if (ref) ref.set({ currency: code }, { merge: true }).catch(function () { showError(t('catSaveError')); });
  }

  // ---- Відкриття й закриття ----

  function openTab(key) {
    currentTab = key;
    errorText = '';
    win.classList.add('at-pane');
    renderTabs();
    renderPane();
  }

  function open(tab) {
    if (!win) return;
    pushError = null;
    subscribeProfile();
    currentTab = tab && TABS.some(function (x) { return x.key === tab; }) ? tab : 'general';
    errorText = '';
    // Телефон відкривається на списку розділів, якщо вкладку не назвали:
    // одразу кинути в «Загальні» означало б сховати від людини все інше.
    win.classList.toggle('at-pane', !!tab);
    renderTabs();
    renderPane();
    overlay.classList.add('show');
  }

  function close() {
    if (overlay) overlay.classList.remove('show');
  }

  function isOpen() {
    return !!overlay && overlay.classList.contains('show');
  }

  function subscribeProfile() {
    var ref = profileRef();
    if (!ref || unsubProfile) return;
    unsubProfile = ref.onSnapshot(function (doc) {
      profile = (doc.exists && doc.data()) || {};
      if (isOpen()) renderPane();
    }, function () { /* офлайн — показуємо те, що вже маємо */ });
  }

  // ---- Побудова ----

  /**
   *  @param {{db, auth, base?:string, lang?:string,
   *           theme:function():string, onTheme:function(string),
   *           onLang:function(string), onLogout:function(),
   *           onExport?:function(), push?:object}} options
   */
  function init(options) {
    cfg = options || {};
    if (TEXTS[cfg.lang]) lang = cfg.lang;

    overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.id = 'settingsOverlay';
    overlay.innerHTML =
      '<div class="settings-window" id="settingsWindow">' +
        '<div class="settings-head">' +
          '<button type="button" class="settings-back" id="settingsBack">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
            ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' +
          '</button>' +
          '<div class="settings-title" id="settingsTitle"></div>' +
          '<button type="button" class="settings-close" id="settingsClose">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
            ' stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="settings-body">' +
          '<div class="settings-tabs"></div>' +
          '<div class="settings-pane"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    win = overlay.querySelector('.settings-window');

    document.getElementById('settingsClose').addEventListener('click', close);
    // Назад — до списку розділів; на широкому екрані кнопки не видно.
    document.getElementById('settingsBack').addEventListener('click', function () {
      win.classList.remove('at-pane');
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });

    applyLang();
    return api;
  }

  function applyLang() {
    if (!win) return;
    document.getElementById('settingsTitle').textContent = t('title');
    document.getElementById('settingsClose').setAttribute('aria-label', t('close'));
    document.getElementById('settingsBack').setAttribute('aria-label', t('back'));
    renderTabs();
    if (isOpen()) renderPane();
  }

  function setLang(next) {
    if (!TEXTS[next]) return;
    lang = next;
    applyLang();
  }

  var api = {
    init: init, open: open, close: close, isOpen: isOpen, setLang: setLang,
    // Для тестів: який список категорій вікно вважає поточним.
    categoriesOf: function (kind) { return categoriesOf(kind); },
  };
  root.AppSettings = api;
})(typeof window !== 'undefined' ? window : globalThis);
