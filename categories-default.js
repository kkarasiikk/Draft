// ---- Стандартні категорії бюджету й цілей ----
// Живуть окремим файлом, бо потрібні трьом споживачам: самому бюджету,
// головному екрану (експорт має підписувати категорії словами, а не
// службовими id) і AI-помічнику на сервері. Категорії цілей приїхали сюди
// тією ж дорогою й з тієї ж причини: відколи їх можна редагувати, помічник
// мусить знати той самий список, що показує форма цілі.
//
// Спільними вони мусять бути саме тому, що доки людина жодного разу не
// редагувала категорії, у профілі їх НЕМАЄ — сторінки просто показують цей
// список. Поки помічник його не знав, він чесно бачив у профілі порожнечу
// й міг писати витрати лише в «Інше».
//
// Лежить у корені, а не в budget/: теку бюджету свідомо не включено в пакет
// Cloud Functions (див. ignore у firebase.json), тож звідти сервер файл
// не дістав би.
(function (root) {
  'use strict';

  // Палітра категорій. Лежить тут, а не в budget/app.js, з тієї ж причини,
  // що й самі категорії: споживачів більше одного. Форма витрати живе тепер
  // не лише в бюджеті, а й на головній, і дві копії масиву розʼїхались би
  // при першій же правці — та сама категорія була б різного кольору залежно
  // від того, з якого екрана її відкрили. Довжина масиву — це той самий
  // paletteSize, який приймає defaultCategoryList нижче.
  var CATEGORY_PALETTE = [
    { text: '#3E7C59', bg: '#EAF5EF' },
    { text: '#3D6E9E', bg: '#EAF1F8' },
    { text: '#A8792B', bg: '#FBF3E7' },
    { text: '#B6584A', bg: '#FBEEEC' },
    { text: '#7A5C9E', bg: '#F3EFF8' },
    { text: '#4C7A83', bg: '#EAF3F4' },
    { text: '#8A6A45', bg: '#F6F0E9' },
    { text: '#5B7A9D', bg: '#EAF0F5' },
  ];

  var EXPENSE_CATEGORY_IDS = ['food', 'transport', 'housing', 'fun', 'health', 'clothes', 'other'];
  var INCOME_CATEGORY_IDS = ['salary', 'freelance', 'gift', 'other'];
  var CAT_LABELS = {
    uk: { food: 'Їжа', transport: 'Транспорт', housing: 'Житло', fun: 'Розваги', health: 'Здоров’я', clothes: 'Одяг', other: 'Інше', salary: 'Зарплата', freelance: 'Фріланс', gift: 'Подарунок' },
    ru: { food: 'Еда', transport: 'Транспорт', housing: 'Жильё', fun: 'Развлечения', health: 'Здоровье', clothes: 'Одежда', other: 'Другое', salary: 'Зарплата', freelance: 'Фриланс', gift: 'Подарок' },
    pl: { food: 'Jedzenie', transport: 'Transport', housing: 'Mieszkanie', fun: 'Rozrywka', health: 'Zdrowie', clothes: 'Ubrania', other: 'Inne', salary: 'Wypłata', freelance: 'Freelance', gift: 'Prezent' },
    en: { food: 'Food', transport: 'Transport', housing: 'Housing', fun: 'Fun', health: 'Health', clothes: 'Clothes', other: 'Other', salary: 'Salary', freelance: 'Freelance', gift: 'Gift' },
  };

  // Категорії цілей. Ids ті самі, що стояли захардкодженим списком у
  // goals/app.js, — інакше кожна вже заведена ціль осиротіла б на своєму
  // 'health' чи 'travel'. Порядок теж той самий: colorIndex дорівнює місцю
  // в списку, а слоти палітри в goals/index.html ідуть у цьому ж порядку,
  // тож стандартні категорії лишаються рівно тих кольорів, що й були.
  var GOAL_CATEGORY_IDS = ['health', 'finance', 'learning', 'career',
    'relationships', 'travel', 'creativity', 'other'];
  var GOAL_CAT_LABELS = {
    uk: { health: 'Здоров\u2019я', finance: 'Фінанси', learning: 'Навчання', career: 'Кар\u2019єра', relationships: 'Стосунки', travel: 'Подорожі', creativity: 'Творчість', other: 'Інше' },
    ru: { health: 'Здоровье', finance: 'Финансы', learning: 'Обучение', career: 'Карьера', relationships: 'Отношения', travel: 'Путешествия', creativity: 'Творчество', other: 'Другое' },
    pl: { health: 'Zdrowie', finance: 'Finanse', learning: 'Nauka', career: 'Kariera', relationships: 'Relacje', travel: 'Podróże', creativity: 'Kreatywność', other: 'Inne' },
    en: { health: 'Health', finance: 'Finance', learning: 'Learning', career: 'Career', relationships: 'Relationships', travel: 'Travel', creativity: 'Creativity', other: 'Other' },
  };

  /** Стандартні категорії цілей: [{ id, label, colorIndex }]. */
  function defaultGoalCategoryList(lang, paletteSize) {
    var labels = GOAL_CAT_LABELS[lang] || GOAL_CAT_LABELS.uk;
    var size = paletteSize || 8;
    return GOAL_CATEGORY_IDS.map(function (id, i) {
      return { id: id, label: labels[id] || id, colorIndex: i % size };
    });
  }

  /** Список категорій за замовчуванням: [{ id, label, colorIndex }]. */
  function defaultCategoryList(type, lang, paletteSize) {
    var ids = type === 'income' ? INCOME_CATEGORY_IDS : EXPENSE_CATEGORY_IDS;
    var labels = CAT_LABELS[lang] || CAT_LABELS.uk;
    var size = paletteSize || 8;
    return ids.map(function (id, i) {
      return { id: id, label: labels[id] || id, colorIndex: i % size };
    });
  }

  root.GOAL_CATEGORY_IDS = GOAL_CATEGORY_IDS;
  root.GOAL_CAT_LABELS = GOAL_CAT_LABELS;
  root.defaultGoalCategoryList = defaultGoalCategoryList;
  root.CATEGORY_PALETTE = CATEGORY_PALETTE;
  root.EXPENSE_CATEGORY_IDS = EXPENSE_CATEGORY_IDS;
  root.INCOME_CATEGORY_IDS = INCOME_CATEGORY_IDS;
  root.CAT_LABELS = CAT_LABELS;
  root.defaultCategoryList = defaultCategoryList;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CATEGORY_PALETTE: CATEGORY_PALETTE,
      EXPENSE_CATEGORY_IDS: EXPENSE_CATEGORY_IDS,
      INCOME_CATEGORY_IDS: INCOME_CATEGORY_IDS,
      CAT_LABELS: CAT_LABELS,
      defaultCategoryList: defaultCategoryList,
      GOAL_CATEGORY_IDS: GOAL_CATEGORY_IDS,
      GOAL_CAT_LABELS: GOAL_CAT_LABELS,
      defaultGoalCategoryList: defaultGoalCategoryList,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
