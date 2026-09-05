// Вікно налаштувань — одне на всі пʼять сторінок.
//
// До нього налаштування жили в чотирьох різних місцях: тема й мова — в
// гамбургері головної, валюта й категорії витрат — у «⋮» бюджету,
// нагадування — в «⋮» завдань, категорії цілей — усередині форми цілі. Тож
// тут стережеться передусім те, заради чого вікно й робилось: воно
// відкривається звідусіль, і вкладка показує ЛИШЕ свої параметри.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Сторінка, як її відкрити з неї самої, і на якій вкладці вона має стати.
const PAGES = [
  ['головна', 'index.html', '#homeScreen', '#sideSettingsBtn', null],
  ['бюджет', 'budget/index.html', '#appScreen', '#categoriesBtn', 'Гроші'],
  ['завдання', 'tasks/index.html', '#appScreen', '#pageMenuBtn', 'Завдання'],
  ['цілі', 'goals/index.html', '#appScreen', '#pageSettingsBtn', 'Цілі'],
  ['тренування', 'workout/index.html', '#appScreen', '#pageSettingsBtn', 'Тренування'],
];

test.describe('Вікно відкривається з кожної сторінки', () => {
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
