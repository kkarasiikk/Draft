const E = require('./export-data');

// Мінімальний словник: тестуємо структуру, а не переклади.
const L = {
  sheetTx: 'Транзакції', sheetSavings: 'Заощадження', sheetSavingsGoals: 'Цілі заощаджень',
  sheetNotes: 'Нотатки', sheetCats: 'Категорії', sheetLifeGoals: 'Цілі', sheetJournal: 'Щоденник цілей',
  sheetTasks: 'Завдання', sheetWorkouts: 'Тренування',
  colDate: 'Дата', colType: 'Тип', colCategory: 'Категорія', colAmount: 'Сума', colCurrency: 'Валюта',
  colNote: 'Нотатка', colGoal: 'Ціль', colName: 'Назва', colCreated: 'Створено', colUpdated: 'Оновлено',
  colTitle: 'Заголовок', colContent: 'Зміст', colStatus: 'Статус', colDeadline: 'Дедлайн',
  colCheckins: 'Чекінів', colWhy: 'Навіщо', colDone: 'Виконано', colTime: 'Час', colPriority: 'Пріоритет',
  colTags: 'Теги', colEstimate: 'Хвилин', colRepeat: 'Повтор', colSubtasks: 'Підзадачі',
  colCompleted: 'Завершено', colExercise: 'Вправа', colMuscle: 'Група', colSets: 'Підходів',
  colDetails: 'Підходи', colVolume: 'Обсяг, кг',
  typeExpense: 'Витрата', typeIncome: 'Дохід', typeDeposit: 'Поповнення', typeWithdraw: 'Зняття',
  status_active: 'Активна', status_done: 'Завершена', status_archived: 'Архів',
  prio_high: 'Високий', prio_medium: 'Середній', prio_low: 'Низький',
  yes: 'Так', no: 'Ні', defaultGoalName: 'Заощадження', noTitle: 'Без заголовка',
};

const DATA = {
  transactions: [
    { date: '2026-08-10', type: 'expense', category: 'food', amount: 80, note: 'кава' },
    { date: '2026-08-01', type: 'income', category: 'salary', amount: 30000, note: '' },
  ],
  savings: [{ date: '2026-08-05', goalId: 'g1', type: 'deposit', amount: 500, currency: 'UAH', note: '' }],
  savingsGoals: [{ id: 'g1', name: 'На відпустку' }],
  notes: [{ title: 'Ідеї', content: '<p>Перша</p><p>Друга</p>' }],
  categoriesExpense: [{ id: 'food', label: 'Їжа' }],
  categoriesIncome: [{ id: 'salary', label: 'Зарплата' }],
  goals: [{
    id: 'lg1', title: 'Пробігти марафон', category: 'health', status: 'active', targetDate: '2027-04-18',
    targetValue: 42.2, currentValue: 10, unit: 'км', why: 'хочу дожити до 90',
    milestones: [{ title: '10 км', done: true }, { title: '21 км', done: false }],
    checkins: ['2026-08-18', '2026-08-19'],
    journal: [{ text: 'перший забіг', createdAt: '2026-08-18T10:00:00Z' }],
  }],
  tasks: [
    { title: 'Купити молоко', done: false, dueDate: '2026-08-20', priority: 'high', tags: ['дім'], subtasks: [] },
    { title: 'Пробігти 3 км', done: true, dueDate: '2026-08-19', goalId: 'lg1', tags: [], subtasks: [{ title: 'Розминка', done: true }] },
  ],
  workouts: [{
    date: '2026-08-18', name: 'Груди', notes: '',
    exercises: [{ libId: 'benchPress', name: 'Жим лежачи', muscle: 'chest', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 6 }, { weight: 0, reps: 0 }] }],
  }],
};

const sheet = (keys, name) => E.buildSheets(keys, DATA, L).find((s) => s.name === name);

describe('buildSheets', () => {
  test('віддає лише обрані розділи, у сталому порядку', () => {
    expect(E.buildSheets(['workout', 'goals'], DATA, L).map((s) => s.name))
      .toEqual([L.sheetLifeGoals, L.sheetJournal, L.sheetWorkouts]);
    expect(E.buildSheets([], DATA, L)).toEqual([]);
  });

  test('невідомий розділ мовчки ігнорується', () => {
    expect(E.buildSheets(['вигаданий'], DATA, L)).toEqual([]);
  });

  // Порожній розділ теж дає аркуш: інакше людина відкриє файл і вирішить,
  // що експорт зламався, хоча просто ще немає даних.
  test('порожні дані дають аркуші без рядків', () => {
    const sheets = E.buildSheets(E.SECTION_KEYS, {}, L);
    expect(sheets.length).toBe(9);
    sheets.forEach((s) => expect(s.rows).toEqual([]));
  });
});

describe('бюджет', () => {
  test('категорії підставляються словами, а не id', () => {
    const rows = sheet(['budget'], L.sheetTx).rows;
    expect(rows[0][L.colCategory]).toBe('Зарплата');   // 01.08 — раніше
    expect(rows[1][L.colCategory]).toBe('Їжа');
  });

  test('операції відсортовані за датою', () => {
    expect(sheet(['budget'], L.sheetTx).rows.map((r) => r[L.colDate]))
      .toEqual(['2026-08-01', '2026-08-10']);
  });

  test('заощадження підписані назвою цілі', () => {
    expect(sheet(['budget'], L.sheetSavings).rows[0][L.colGoal]).toBe('На відпустку');
  });

  // Нотатки зберігаються як HTML, а в таблиці потрібен текст.
  test('розмітка з нотаток прибирається', () => {
    expect(sheet(['budget'], L.sheetNotes).rows[0][L.colContent]).toBe('ПершаДруга');
  });
});

describe('цілі', () => {
  test('ціль іде рядком: назва, статус, відмітки', () => {
    const row = sheet(['goals'], L.sheetLifeGoals).rows[0];
    expect(row[L.colCheckins]).toBe(2);
    expect(row[L.colStatus]).toBe('Активна');
  });

  // Дедлайн ціль отримує з місяця, а не окремим полем: у місячної це кінець
  // її місяця, у річної його немає — і тоді клітинка порожня.
  test('дедлайн їде у файл як є, а річна ціль лишає клітинку порожньою', () => {
    const rows = E.buildSheets(['goals'], { goals: [
      { title: 'Прочитати дві книжки', horizon: 'month', month: '2026-08', targetDate: '2026-08-31', milestones: [], checkins: [] },
      { title: 'Вивчити польську', horizon: 'year', targetDate: null, milestones: [], checkins: [] },
    ] }, L)[0].rows;
    expect(rows[0][L.colDeadline]).toBe('2026-08-31');
    expect(rows[1][L.colDeadline]).toBe('');
  });

  test('щоденник — окремим аркушем, із назвою цілі', () => {
    const rows = sheet(['goals'], L.sheetJournal).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0][L.colGoal]).toBe('Пробігти марафон');
    expect(rows[0][L.colContent]).toBe('перший забіг');
  });
});

describe('завдання', () => {
  test('привʼязане завдання підписане назвою цілі', () => {
    const rows = sheet(['tasks'], L.sheetTasks).rows;
    const run = rows.find((r) => r[L.colTitle] === 'Пробігти 3 км');
    expect(run[L.colGoal]).toBe('Пробігти марафон');
    expect(run[L.colDone]).toBe('Так');
    expect(run[L.colSubtasks]).toBe('Розминка ✓');
  });

  test('завдання без цілі не отримує чужої назви', () => {
    const milk = sheet(['tasks'], L.sheetTasks).rows.find((r) => r[L.colTitle] === 'Купити молоко');
    expect(milk[L.colGoal]).toBe('');
    expect(milk[L.colDone]).toBe('Ні');
    expect(milk[L.colPriority]).toBe('Високий');
  });

  // Завдання експортуються навіть тоді, коли цілі не обрані, — просто без
  // підписів. Читати чужу колекцію заради стовпця не варто.
  test('без розділу цілей звʼязок просто не підписується', () => {
    const rows = E.buildSheets(['tasks'], { tasks: DATA.tasks }, L)[0].rows;
    expect(rows.find((r) => r[L.colTitle] === 'Пробігти 3 км')[L.colGoal]).toBe('');
  });
});

describe('тренування', () => {
  test('рядок на вправу, підходи одним текстом', () => {
    const row = sheet(['workout'], L.sheetWorkouts).rows[0];
    expect(row[L.colExercise]).toBe('Жим лежачи');
    expect(row[L.colDetails]).toBe('80×8, 80×6');
    expect(row[L.colSets]).toBe(2);            // порожній підхід не рахується
    expect(row[L.colVolume]).toBe(80 * 8 + 80 * 6);
  });

  test('вправа з власною вагою не дає нульового множення', () => {
    const rows = E.buildSheets(['workout'], { workouts: [{ date: '2026-08-18', exercises: [
      { libId: 'pullUp', name: 'Підтягування', muscle: 'back', sets: [{ weight: 0, reps: 10 }] }] }] }, L)[0].rows;
    expect(rows[0][L.colDetails]).toBe('10 ×');
    expect(rows[0][L.colVolume]).toBe(0);
  });
});

describe('toCsv', () => {
  test('заголовок і рядки', () => {
    expect(E.toCsv([{ a: 1, b: 'два' }, { a: 3, b: 'чотири' }]))
      .toBe('a,b\r\n1,два\r\n3,чотири');
  });

  // RFC 4180: кома, лапка й перенос рядка вимагають лапок навколо поля.
  test('коми, лапки й переноси екрануються', () => {
    expect(E.toCsv([{ a: 'кава, чай' }])).toBe('a\r\n"кава, чай"');
    expect(E.toCsv([{ a: 'він сказав "ні"' }])).toBe('a\r\n"він сказав ""ні"""');
    expect(E.toCsv([{ a: 'перший\nдругий' }])).toBe('a\r\n"перший\nдругий"');
  });

  test('стовпці збираються з усіх рядків, а не з першого', () => {
    expect(E.toCsv([{ a: 1 }, { a: 2, b: 3 }])).toBe('a,b\r\n1,\r\n2,3');
  });

  test('порожній список — порожній рядок', () => {
    expect(E.toCsv([])).toBe('');
    expect(E.toCsv(undefined)).toBe('');
  });
});

describe('toJson', () => {
  test('віддає сирі документи обраних розділів', () => {
    const out = E.toJson(['goals', 'workout'], DATA);
    expect(Object.keys(out.sections).sort()).toEqual(['goals', 'workout']);
    // JSON віддає документи СИРИМИ, тож спадщина в них лишається як є:
    // резервна копія має бути копією, а не переказом.
    expect(out.sections.goals[0].milestones).toHaveLength(2);
    expect(out.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('бюджет складається з усіх своїх колекцій', () => {
    const out = E.toJson(['budget'], DATA);
    expect(Object.keys(out.sections.budget).sort())
      .toEqual(['categoriesExpense', 'categoriesIncome', 'notes', 'savings', 'savingsGoals', 'transactions']);
  });
});

describe('імена файлів', () => {
  test('один розділ — його назва у файлі', () => {
    expect(E.fileBase(['goals'], '2026-08-20')).toBe('life-goals-2026-08-20');
  });
  test('кілька розділів — просто life', () => {
    expect(E.fileBase(['goals', 'tasks'], '2026-08-20')).toBe('life-2026-08-20');
    expect(E.fileBase(E.SECTION_KEYS, '2026-08-20')).toBe('life-2026-08-20');
  });
  // Chromium мовчки втрачає кириличне ім'я в атрибуті download, тож у
  // назві файлу лишається тільки латиниця.
  test('ім’я файлу лишається латиницею', () => {
    expect(E.slug('savings-goals')).toBe('savings-goals');
    expect(E.slug('A/B: "C"')).toBe('a-b-c');
    expect(E.slug('Цілі')).toBe('sheet');
    expect(E.slug('')).toBe('sheet');
  });

  test('кожен аркуш має латинський ключ для імені файлу', () => {
    E.buildSheets(E.SECTION_KEYS, {}, L).forEach((sh) => {
      expect(sh.key).toMatch(/^[a-z-]+$/);
      expect(E.slug(sh.key)).toBe(sh.key);
    });
  });
});

describe('stripHtml без DOM', () => {
  test('теги прибираються й у середовищі без документа', () => {
    expect(E.stripHtml('<p>Текст</p><br><b>жирний</b>')).toBe('Текстжирний');
    expect(E.stripHtml('')).toBe('');
  });
});
