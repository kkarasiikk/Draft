// ---- Стандартні категорії бюджету ----
// Живуть окремим файлом, бо потрібні двом сторінкам: самому бюджету і
// головному екрану (експорт має підписувати категорії словами, а не
// службовими id, навіть якщо людина ще жодної категорії не редагувала —
// доки цього не сталося, у профілі їх просто немає).
(function (root) {
  'use strict';

  var EXPENSE_CATEGORY_IDS = ['food', 'transport', 'housing', 'fun', 'health', 'clothes', 'other'];
  var INCOME_CATEGORY_IDS = ['salary', 'freelance', 'gift', 'other'];
  var CAT_LABELS = {
    uk: { food: 'Їжа', transport: 'Транспорт', housing: 'Житло', fun: 'Розваги', health: 'Здоров’я', clothes: 'Одяг', other: 'Інше', salary: 'Зарплата', freelance: 'Фріланс', gift: 'Подарунок' },
    ru: { food: 'Еда', transport: 'Транспорт', housing: 'Жильё', fun: 'Развлечения', health: 'Здоровье', clothes: 'Одежда', other: 'Другое', salary: 'Зарплата', freelance: 'Фриланс', gift: 'Подарок' },
    pl: { food: 'Jedzenie', transport: 'Transport', housing: 'Mieszkanie', fun: 'Rozrywka', health: 'Zdrowie', clothes: 'Ubrania', other: 'Inne', salary: 'Wypłata', freelance: 'Freelance', gift: 'Prezent' },
    en: { food: 'Food', transport: 'Transport', housing: 'Housing', fun: 'Fun', health: 'Health', clothes: 'Clothes', other: 'Other', salary: 'Salary', freelance: 'Freelance', gift: 'Gift' },
  };

  /** Список категорій за замовчуванням: [{ id, label, colorIndex }]. */
  function defaultCategoryList(type, lang, paletteSize) {
    var ids = type === 'income' ? INCOME_CATEGORY_IDS : EXPENSE_CATEGORY_IDS;
    var labels = CAT_LABELS[lang] || CAT_LABELS.uk;
    var size = paletteSize || 8;
    return ids.map(function (id, i) {
      return { id: id, label: labels[id] || id, colorIndex: i % size };
    });
  }

  root.EXPENSE_CATEGORY_IDS = EXPENSE_CATEGORY_IDS;
  root.INCOME_CATEGORY_IDS = INCOME_CATEGORY_IDS;
  root.CAT_LABELS = CAT_LABELS;
  root.defaultCategoryList = defaultCategoryList;
})(typeof window !== 'undefined' ? window : globalThis);
