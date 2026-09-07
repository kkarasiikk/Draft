// Вікно налаштувань — одне на всі пʼять сторінок.
//
// До нього налаштування жили в чотирьох різних місцях: тема й мова — в
// гамбургері головної, валюта й категорії витрат — у «⋮» бюджету,
// нагадування — в «⋮» завдань, категорії цілей — усередині форми цілі. Тож
// тут стережеться передусім те, заради чого вікно й робилось: воно
// відкривається звідусіль, і вкладка показує ЛИШЕ свої параметри.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Сторінка, кнопка розділу в її шапці, і на якій вкладці вікно має стати.
// Кнопка розділу — телефонна: на широкому екрані її немає, там вхід один,
// із бічної колонки (див. окремий блок нижче).
const PAGES = [
  ['головна', 'index.html', '#homeScreen', '#menuBtn', null],
  ['бюджет', 'budget/index.html', '#appScreen', '#categoriesBtn', 'Гроші'],
  ['завдання', 'tasks/index.html', '#appScreen', '#pageMenuBtn', 'Завдання'],
  ['цілі', 'goals/index.html', '#appScreen', '#pageSettingsBtn', 'Цілі'],
  ['тренування', 'workout/index.html', '#appScreen', '#pageSettingsBtn', 'Тренування'],
];

test.describe('Вікно відкривається з кожної сторінки', () => {
  // Телефон: бічної колонки немає, і кнопка в шапці — єдиний вхід.
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [name, path, ready, opener, tab] of PAGES) {
    test(`${name}: кнопка розділу відкриває вікно${tab ? ' на «' + tab + '»' : ''}`, async ({ page }) => {
      await openModule(page, path, { ready });
      await page.click(opener);
      await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
      await expect(page.locator('#settingsTitle')).toHaveText('Налаштування');
      // Вкладок скрізь однаково сім: вікно те саме, а не схоже.
      await expect(page.locator('.settings-tab')).toHaveCount(7);
      if (tab) await expect(page.locator('.settings-tab.current')).toHaveText(tab);
    });
  }
});

// На широкому екрані вхід у налаштування один — бічна колонка. Кнопка в
// шапці робила рівно те саме, тільки мовчки: два входи в одне вікно, з яких
// другий ще й треба знайти очима.
test.describe('Комп’ютер: вхід один, і він знає свій розділ', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  const SECTIONS = [
    ['бюджет', 'budget/index.html', '#appScreen', 'Гроші'],
    ['завдання', 'tasks/index.html', '#appScreen', 'Завдання'],
    ['цілі', 'goals/index.html', '#appScreen', 'Цілі'],
    ['тренування', 'workout/index.html', '#appScreen', 'Тренування'],
  ];

  for (const [name, path, ready, tab] of SECTIONS) {
    test(`${name}: «Налаштування» зліва відкриває вікно одразу на «${tab}»`, async ({ page }) => {
      await openModule(page, path, { ready });
      await page.click('#sideSettingsBtn');
      await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
      await expect(page.locator('.settings-tab.current')).toHaveText(tab);
    });
  }

  for (const [name, path, ready] of SECTIONS) {
    test(`${name}: кнопки в шапці більше немає`, async ({ page }) => {
      await openModule(page, path, { ready });
      await expect(page.locator('#pageSettingsBtn, #pageMenuBtn, #categoriesBtn')).toBeHidden();
    });
  }

  // Хаб — не розділ, і власної вкладки в нього немає: там «Загальні» — саме
  // те, що треба показати.
  test('головна відкриває «Загальні», а шапки з гамбургером на ПК немає', async ({ page }) => {
    await openModule(page, 'index.html', { ready: '#homeScreen' });
    await expect(page.locator('#menuBtn')).toBeHidden();
    await page.click('#sideSettingsBtn');
    await expect(page.locator('.settings-tab.current')).toHaveText('Загальні');
  });

  // У бюджету три вкладки мають ВЛАСНІ налаштування (діаграми, сортування
  // нотаток, валюта підсумку заощаджень) — цього бічна колонка не вміє, тож
  // там кнопка лишається. Правило просте: вона є рівно тоді, коли їй є що
  // запропонувати від себе.
  test('у бюджеті кнопка вертається на вкладки з власними налаштуваннями', async ({ page }) => {
    await openModule(page, 'budget/index.html', { ready: '#appScreen' });
    await expect(page.locator('#categoriesBtn')).toBeHidden();

    await page.click('#bnStats');
    await expect(page.locator('#categoriesBtn')).toBeVisible();
    await page.click('#categoriesBtn');
    // І відкриває саме їх, а не спільне вікно.
    await expect(page.locator('#statsSettingsOverlay')).toHaveClass(/show/);
    await expect(page.locator('#settingsOverlay')).not.toHaveClass(/show/);

    await page.click('#closeStatsSettings');
    await page.click('#bnEntries');
    await expect(page.locator('#categoriesBtn')).toBeHidden();
  });
});

test.describe('Вкладка показує лише свої параметри', () => {
  const openHub = async (page) => {
    await openModule(page, 'index.html', { ready: '#homeScreen' });
    await page.click('#sideSettingsBtn');
    await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
  };

  test('«Загальні» — тема й мова, і нічого з розділів', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('[data-theme-choice]')).toHaveCount(3);
    await expect(page.locator('[data-lang-choice]')).toHaveCount(4);
    await expect(page.locator('[data-cat-kind]')).toHaveCount(0);
    await expect(page.locator('[data-currency]')).toHaveCount(0);
  });

  test('«Гроші» — валюта й два списки категорій, без теми', async ({ page }) => {
    await openHub(page);
    await page.click('[data-tab="budget"]');
    await expect(page.locator('[data-currency]')).toHaveCount(4);
    await expect(page.locator('[data-cat-kind]')).toHaveCount(2);
    await expect(page.locator('[data-cat-kind="expense"]')).toHaveCount(1);
    await expect(page.locator('[data-cat-kind="income"]')).toHaveCount(1);
    await expect(page.locator('[data-theme-choice]')).toHaveCount(0);
  });

  test('«Цілі» — рівно один список, чужих немає', async ({ page }) => {
    await openHub(page);
    await page.click('[data-tab="goals"]');
    await expect(page.locator('[data-cat-kind]')).toHaveCount(1);
    await expect(page.locator('[data-cat-kind="goals"]')).toHaveCount(1);
  });

  test('«Завдання» — нагадування й категорії тижневика', async ({ page }) => {
    await openHub(page);
    await page.click('[data-tab="tasks"]');
    await expect(page.locator('[data-cat-kind="week"]')).toHaveCount(1);
    await expect(page.locator('[data-cat-kind="expense"]')).toHaveCount(0);
  });

  test('«Акаунт» — пошта і вихід', async ({ page }) => {
    await openHub(page);
    await page.click('[data-tab="account"]');
    await expect(page.locator('.settings-value')).toHaveText('test@example.com');
    await expect(page.locator('[data-logout]')).toHaveCount(1);
  });
});

test.describe('Категорії пишуться в профіль', () => {
  const lastSet = (page) => page.evaluate(() => {
    const sets = window.__fbCalls.set.filter((c) => c.col === 'users');
    return sets.length ? sets[sets.length - 1].payload : null;
  });

  test('нова категорія витрат лягає в профіль з ідентифікатором, а не назвою', async ({ page }) => {
    await openModule(page, 'index.html', { ready: '#homeScreen' });
    await page.click('#sideSettingsBtn');
    await page.click('[data-tab="budget"]');
    await page.fill('[data-cat-kind="expense"] [data-cat-new]', 'Тварини');
    await page.click('[data-cat-kind="expense"] [data-cat-add]');

    await expect.poll(async () => {
      const saved = await lastSet(page);
      return saved && saved.categoriesExpense && saved.categoriesExpense.map((c) => c.label);
    }).toEqual(['Їжа', 'Транспорт', 'Житло', 'Розваги', 'Здоров’я', 'Одяг', 'Інше', 'Тварини']);

    const saved = await lastSet(page);
    const added = saved.categoriesExpense[7];
    // id генерований: назву ще перейменують, а транзакції тримаються за id.
    expect(added.id).toMatch(/^cat_/);
    // Колір — перший вільний слот палітри, а не наступний по колу: інакше
    // нова категорія повторювала б колір уже наявної.
    expect(added.colorIndex).toBe(7);
  });

  test('назва, що вже є, не дублюється — і про це сказано', async ({ page }) => {
    await openModule(page, 'index.html', { ready: '#homeScreen' });
    await page.click('#sideSettingsBtn');
    await page.click('[data-tab="budget"]');
    await page.fill('[data-cat-kind="expense"] [data-cat-new]', 'їжа');
    await page.click('[data-cat-kind="expense"] [data-cat-add]');
    await expect(page.locator('.settings-error')).toHaveText('Така категорія вже є.');
    expect(await lastSet(page)).toBeNull();
  });

  // Стандартні id категорій витрат і доходів перетинаються на «other», тож
  // пошук записів іде по одному полю, а тип відсівається вже в коді. Якби
  // сюди потрапляли обидва, видалення «Іншого» з витрат чіпало б і доходи.
  test('видалення переносить лише записи свого типу', async ({ page }) => {
    await openModule(page, 'index.html', {
      ready: '#homeScreen',
      seed: {
        transactions: [
          { id: 'tx1', type: 'expense', category: 'other', amount: 100, date: '2026-09-01' },
          { id: 'tx2', type: 'income', category: 'other', amount: 500, date: '2026-09-01' },
        ],
      },
    });
    page.on('dialog', (d) => d.accept());
    await page.click('#sideSettingsBtn');
    await page.click('[data-tab="budget"]');
    await page.locator('[data-cat-kind="expense"] .settings-cat-row')
      .filter({ has: page.locator('input[value="Інше"]') })
      .locator('[data-cat-del]').click();

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBe(1);
    const [call] = await page.evaluate(() => window.__fbCalls.update);
    expect(call.id).toBe('tx1');
  });
});

// Експорт мав власний діалог, який відкривався з того самого рядка бічної
// колонки, що й налаштування, — тобто два вікна про те саме. Тепер вибір
// розділів і формату стоїть просто у вкладці «Дані».
test.describe('Експорт живе у вкладці «Дані»', () => {
  const openData = async (page) => {
    await openModule(page, 'index.html', { ready: '#homeScreen' });
    await page.click('#sideExportBtn');
    await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
    await expect(page.locator('.settings-tab.current')).toHaveText('Дані');
  };

  test('окремого діалогу експорту більше немає', async ({ page }) => {
    await openData(page);
    await expect(page.locator('#exportOverlay')).toHaveCount(0);
  });

  test('розділи й формат стоять прямо у вкладці', async ({ page }) => {
    await openData(page);
    await expect(page.locator('[data-export-section]')).toHaveCount(4);
    await expect(page.locator('[data-export-format]')).toHaveCount(3);
    await expect(page.locator('[data-export-run]')).toHaveText('Зберегти');
    // За замовчуванням обрано все: людина частіше зберігає всю базу, ніж
    // один розділ.
    await expect(page.locator('[data-export-section].selected')).toHaveCount(4);
  });

  test('розділів можна обрати кілька, а формат — один', async ({ page }) => {
    await openData(page);
    await page.click('[data-export-section="budget"]');
    await expect(page.locator('[data-export-section].selected')).toHaveCount(3);
    await page.click('[data-export-section="budget"]');
    await expect(page.locator('[data-export-section].selected')).toHaveCount(4);

    await page.click('[data-export-format="json"]');
    await expect(page.locator('[data-export-format].selected')).toHaveCount(1);
    await expect(page.locator('[data-export-format="json"]')).toHaveClass(/selected/);
  });

  // Скільки файлів вийде — це те, що варто знати ДО натискання, а не
  // побачити потім у теці завантажень.
  test('підказка під форматом каже, що саме вийде', async ({ page }) => {
    await openData(page);
    await expect(page.locator('.settings-pane .settings-hint'))
      .toContainText('Один файл');
    await page.click('[data-export-format="csv"]');
    await expect(page.locator('.settings-pane .settings-hint')).toContainText('файл');
  });

  test('без жодного розділу зберігати нема чого — і про це сказано', async ({ page }) => {
    await openData(page);
    for (const key of ['budget', 'goals', 'tasks', 'workout']) {
      await page.click(`[data-export-section="${key}"]`);
    }
    await page.click('[data-export-run]');
    await expect(page.locator('.settings-error')).toHaveText('Обери хоча б один розділ.');
  });

  // Збирає файл сторінка, а не вікно: для цього потрібні export-data.js,
  // бібліотека xlsx і читання всіх колекцій. У розділах їх немає, тож там
  // лишається рядок, що веде на головну.
  test('у розділі — рядок на головну, а не сам вибір', async ({ page }) => {
    await openModule(page, 'tasks/index.html', { ready: '#appScreen' });
    await page.click('#sideSettingsBtn');
    await page.click('[data-tab="data"]');
    await expect(page.locator('[data-export-section]')).toHaveCount(0);
    await expect(page.locator('.settings-pane a[href$="index.html#export"]')).toHaveCount(1);
  });
});

test.describe('Телефон: спершу список розділів', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('гамбургер відкриває список, тап по розділу — його параметри', async ({ page }) => {
    await openModule(page, 'index.html', { ready: '#homeScreen' });
    await page.click('#menuBtn');
    await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
    // Колонки вкладок і панелі поруч немає — спершу лише список.
    await expect(page.locator('.settings-tabs')).toBeVisible();
    await expect(page.locator('.settings-pane')).toBeHidden();
    await expect(page.locator('#settingsBack')).toBeHidden();

    await page.click('[data-tab="general"]');
    await expect(page.locator('.settings-pane')).toBeVisible();
    await expect(page.locator('.settings-tabs')).toBeHidden();
    await expect(page.locator('#settingsBack')).toBeVisible();

    await page.click('#settingsBack');
    await expect(page.locator('.settings-tabs')).toBeVisible();
    await expect(page.locator('.settings-pane')).toBeHidden();
  });

  test('на комп’ютері колонка й панель стоять поруч', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await openModule(page, 'index.html', { ready: '#homeScreen' });
    await page.click('#sideSettingsBtn');
    await expect(page.locator('.settings-tabs')).toBeVisible();
    await expect(page.locator('.settings-pane')).toBeVisible();
    await expect(page.locator('#settingsBack')).toBeHidden();
  });
});

test.describe('Мова міняється просто з вікна', () => {
  test('підписи вкладок і бічної колонки їдуть разом', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await openModule(page, 'index.html', { ready: '#homeScreen' });
    await page.click('#sideSettingsBtn');
    await page.click('[data-lang-choice="en"]');
    await expect(page.locator('#settingsTitle')).toHaveText('Settings');
    await expect(page.locator('.settings-tab.current')).toHaveText('General');
    await expect(page.locator('#sideLabel-settings')).toHaveText('Settings');
  });
});
