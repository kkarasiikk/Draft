// Категорії цілей, які можна редагувати.
//
// Вісім категорій були захардкоджені й однакові для всіх. У бюджеті чужа
// розбивка ще терпима — витрата на 200 грн лишається витратою на 200 грн і в
// категорії «Інше». У цілях ні: розділ саме про те, як людина ділить своє
// життя, і ціль у чужій категорії просто не знаходить свого місця.
//
// Перевіряємо не «є вікно з полями», а те, що з нього виходить: що список
// приїжджає з профілю, що правка долітає до бази, що видалення не лишає цілей
// із «сирітською» категорією і що назви — це назви, а не службові id.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const goal = (over = {}) => ({
  id: 'g1', title: 'Пробігти 100 км', category: 'health', why: '',
  status: 'active', targetDate: null, horizon: 'month',
  milestones: [], checkins: [], journal: [],
  ...over,
});

/** Свій список у профілі — такий, який лишає по собі перша ж правка. */
const ownCategories = [
  { id: 'gcat_body', label: 'Тіло', colorIndex: 0 },
  { id: 'gcat_work', label: 'Робота', colorIndex: 1 },
  { id: 'other', label: 'Інше', colorIndex: 7 },
];

async function openGoals(page, opts = {}) {
  const seed = { goals: opts.goals || [goal()] };
  if (opts.profile) seed.profile = opts.profile;
  await openModule(page, 'goals/index.html', { seed, lang: opts.lang || 'uk' });
}

/** Відкрити форму нової цілі — саме звідти видно категорії. */
async function openForm(page) {
  await page.click('#openNewGoalBtn');
  await expect(page.locator('#goalFormOverlay')).toHaveClass(/show/);
}

// Керування категоріями переїхало у спільне вікно налаштувань
// (../settings.js), вкладка «Цілі». «Змінити» в рядку категорій відкриває
// саме його — форма цілі при цьому лишається під ним.
async function openManager(page) {
  await openForm(page);
  await page.click('#editCategoriesBtn');
  await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
  await expect(page.locator('.settings-tab.current')).toHaveText('Цілі');
}

const catChips = (page) => page.locator('#categoryPicker .category-choice');
const manageRows = (page) => page.locator('[data-cat-kind="goals"] .settings-cat-row');
const newCatInput = '[data-cat-kind="goals"] [data-cat-new]';
const addCatBtn = '[data-cat-kind="goals"] [data-cat-add]';
const lastSet = (page) => page.evaluate(() => {
  const sets = window.__fbCalls.set.filter((c) => c.col === 'users' && c.payload && c.payload.categoriesGoals);
  return sets.length ? sets[sets.length - 1].payload.categoriesGoals : null;
});

test.describe('Звідки береться список', () => {
  test('порожній профіль дає стандартні вісім, і це назви, а не id', async ({ page }) => {
    await openGoals(page);
    await openForm(page);
    await expect(catChips(page)).toHaveCount(8);
    await expect(catChips(page).first()).toHaveText('Здоров’я');
    await expect(catChips(page).last()).toHaveText('Інше');
  });

  test('свій список у профілі витісняє стандартний повністю', async ({ page }) => {
    await openGoals(page, { profile: { categoriesGoals: ownCategories } });
    await openForm(page);
    await expect(catChips(page)).toHaveCount(3);
    await expect(catChips(page).nth(0)).toHaveText('Тіло');
    await expect(catChips(page).nth(1)).toHaveText('Робота');
    // Стандартних більше немає — саме «витісняє», а не «доповнює».
    await expect(page.locator('#categoryPicker', { hasText: 'Подорожі' })).toHaveCount(0);
  });

  // Доки список стандартний, він переклад; після першої правки — власні слова
  // людини, і перекладати їх було б нахабством.
  test('стандартний список іде за мовою сторінки', async ({ page }) => {
    await openGoals(page, { lang: 'en' });
    await openForm(page);
    await expect(catChips(page).first()).toHaveText('Health');
  });

  test('а свій — не перекладається', async ({ page }) => {
    await openGoals(page, { lang: 'en', profile: { categoriesGoals: ownCategories } });
    await openForm(page);
    await expect(catChips(page).first()).toHaveText('Тіло');
  });

  // Ids стандартних категорій ті самі, що були захардкоджені, — інакше кожна
  // вже заведена ціль осиротіла б на своєму 'health'.
  test('стара ціль лишається у своїй категорії, а не переїжджає в «Інше»', async ({ page }) => {
    await openGoals(page);
    await expect(page.locator('[data-open-goal="g1"] .category-chip')).toHaveText('Здоров’я');
  });
});

test.describe('Вікно категорій', () => {
  test('«Змінити» стоїть останнім у рядку й відкриває список', async ({ page }) => {
    await openGoals(page);
    await openForm(page);
    // Саме за категоріями: спершу вибір, і лише тому, кому його не
    // вистачило, — правка.
    const order = await page.$$eval('#categoryPicker > button', (els) => els.map((e) => e.className));
    expect(order[order.length - 1]).toContain('category-edit-chip');
    await page.click('#editCategoriesBtn');
    await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
    await expect(manageRows(page)).toHaveCount(8);
  });

  test('форма цілі лишається під вікном, а не зникає', async ({ page }) => {
    await openGoals(page);
    await openManager(page);
    // Видно, у що саме повернешся — той самий принцип, що й у діалозі
    // незбережених змін.
    await expect(page.locator('#goalFormOverlay')).toHaveClass(/show/);
    await expect(page.locator('#goalTitleInput')).toBeVisible();
  });

  test('хрестик і тап повз вікно закривають його, а форму лишають', async ({ page }) => {
    await openGoals(page);
    await openManager(page);
    await page.click('#settingsClose');
    await expect(page.locator('#settingsOverlay')).not.toHaveClass(/show/);
    await expect(page.locator('#goalFormOverlay')).toHaveClass(/show/);

    await page.click('#editCategoriesBtn');
    await page.click('#settingsOverlay', { position: { x: 6, y: 6 } });
    await expect(page.locator('#settingsOverlay')).not.toHaveClass(/show/);
    await expect(page.locator('#goalFormOverlay')).toHaveClass(/show/);
  });
});

test.describe('Додати', () => {
  test('нова категорія пишеться в профіль і одразу зʼявляється чипом', async ({ page }) => {
    await openGoals(page, { profile: { categoriesGoals: ownCategories } });
    await openManager(page);
    await page.fill(newCatInput, 'Хобі');
    await page.click(addCatBtn);

    await expect(manageRows(page)).toHaveCount(4);
    const saved = await lastSet(page);
    expect(saved.map((c) => c.label)).toEqual(['Тіло', 'Робота', 'Інше', 'Хобі']);
    // id генерується, а не береться з назви: назву ще перейменують, а цілі
    // тримаються саме за id.
    expect(saved[3].id).toMatch(/^cat_/);

    await page.click('#settingsClose');
    await expect(catChips(page)).toHaveCount(4);
    await expect(catChips(page).last()).toHaveText('Хобі');
  });

  test('Enter у полі працює як кнопка, і поле очищається', async ({ page }) => {
    await openGoals(page, { profile: { categoriesGoals: ownCategories } });
    await openManager(page);
    await page.fill(newCatInput, 'Хобі');
    await page.press(newCatInput, 'Enter');
    await expect(manageRows(page)).toHaveCount(4);
    await expect(page.locator(newCatInput)).toHaveValue('');
  });

  test('порожнє поле нічого не створює', async ({ page }) => {
    await openGoals(page, { profile: { categoriesGoals: ownCategories } });
    await openManager(page);
    await page.fill(newCatInput, '   ');
    await page.click(addCatBtn);
    await expect(manageRows(page)).toHaveCount(3);
    expect(await lastSet(page)).toBeNull();
  });

  test('назва, що вже є, не дублюється — і про це сказано', async ({ page }) => {
    await openGoals(page, { profile: { categoriesGoals: ownCategories } });
    await openManager(page);
    await page.fill(newCatInput, 'робота');
    await page.click(addCatBtn);
    await expect(manageRows(page)).toHaveCount(3);
    await expect(page.locator('.settings-error')).toHaveText('Така категорія вже є.');
    expect(await lastSet(page)).toBeNull();
  });
});

test.describe('Перейменувати', () => {
  test('нова назва летить у профіль, а цілі лишаються на місці', async ({ page }) => {
    await openGoals(page, {
      profile: { categoriesGoals: ownCategories },
      goals: [goal({ category: 'gcat_body' })],
    });
    await openManager(page);
    const input = manageRows(page).first().locator('.settings-cat-input');
    await input.fill('Здоровʼя і сон');
    await input.blur();

    const saved = await lastSet(page);
    expect(saved[0]).toMatchObject({ id: 'gcat_body', label: 'Здоровʼя і сон' });
    // Перейменування не чіпає жодної цілі: у них лежить id, а не назва —
    // саме заради цього id взагалі й існує.
    const goalWrites = await page.evaluate(() => window.__fbCalls.update.filter((c) => c.col === 'goals'));
    expect(goalWrites).toEqual([]);
  });

  test('картка цілі одразу показує нову назву', async ({ page }) => {
    await openGoals(page, {
      profile: { categoriesGoals: ownCategories },
      goals: [goal({ category: 'gcat_body' })],
    });
    await expect(page.locator('[data-open-goal="g1"] .category-chip')).toHaveText('Тіло');
    await openManager(page);
    const input = manageRows(page).first().locator('.settings-cat-input');
    await input.fill('Здоровʼя і сон');
    await input.blur();
    await page.click('#settingsClose');
    await page.click('#closeGoalForm');
    await expect(page.locator('[data-open-goal="g1"] .category-chip')).toHaveText('Здоровʼя і сон');
  });

  test('порожня назва повертається як була — для видалення поруч є хрестик', async ({ page }) => {
    await openGoals(page, { profile: { categoriesGoals: ownCategories } });
    await openManager(page);
    const input = manageRows(page).first().locator('.settings-cat-input');
    await input.fill('');
    await input.blur();
    await expect(input).toHaveValue('Тіло');
    expect(await lastSet(page)).toBeNull();
  });

  test('чужа вже зайнята назва відхиляється, а поле відкочується', async ({ page }) => {
    await openGoals(page, { profile: { categoriesGoals: ownCategories } });
    await openManager(page);
    const input = manageRows(page).first().locator('.settings-cat-input');
    await input.fill('Робота');
    await input.blur();
    await expect(input).toHaveValue('Тіло');
    await expect(page.locator('.settings-error')).toHaveText('Така категорія вже є.');
  });
});

test.describe('Видалити', () => {
  test('порожня категорія зникає без питань', async ({ page }) => {
    await openGoals(page, {
      profile: { categoriesGoals: ownCategories },
      goals: [goal({ category: 'gcat_body' })],
    });
    await openManager(page);
    // Друга — «Робота», у ній цілей немає.
    await manageRows(page).nth(1).locator('[data-cat-del]').click();
    await expect(manageRows(page)).toHaveCount(2);
    const saved = await lastSet(page);
    expect(saved.map((c) => c.id)).toEqual(['gcat_body', 'other']);
  });

  test('цілі видаленої категорії переїжджають, а не лишаються сиротами', async ({ page }) => {
    await openGoals(page, {
      profile: { categoriesGoals: ownCategories },
      goals: [goal({ id: 'g1', category: 'gcat_work' }), goal({ id: 'g2', category: 'gcat_work' })],
    });
    page.on('dialog', (d) => d.accept());
    await openManager(page);
    await manageRows(page).nth(1).locator('[data-cat-del]').click();

    await expect(manageRows(page)).toHaveCount(2);
    const moved = await page.evaluate(() => window.__fbCalls.update
      .filter((c) => c.col === 'goals')
      .map((c) => ({ id: c.id, category: c.payload.category })));
    // Переносяться обидві, і саме на першу з тих, що лишились.
    expect(moved).toEqual([
      { id: 'g1', category: 'gcat_body' },
      { id: 'g2', category: 'gcat_body' },
    ]);
  });

  test('перед переїздом питають, і «скасувати» справді нічого не робить', async ({ page }) => {
    await openGoals(page, {
      profile: { categoriesGoals: ownCategories },
      goals: [goal({ category: 'gcat_work' })],
    });
    const asked = [];
    page.on('dialog', (d) => { asked.push(d.message()); d.dismiss(); });
    await openManager(page);
    await manageRows(page).nth(1).locator('[data-cat-del]').click();

    await expect(manageRows(page)).toHaveCount(3);
    expect(asked).toHaveLength(1);
    // У питанні видно і скільки цілей на кону, і куди вони поїдуть.
    expect(asked[0]).toContain('1');
    expect(asked[0]).toContain('Тіло');
    expect(await lastSet(page)).toBeNull();
  });

  test('останню категорію видалити не можна — вибирати стало б нема з чого', async ({ page }) => {
    await openGoals(page, {
      profile: { categoriesGoals: [{ id: 'gcat_only', label: 'Єдина', colorIndex: 0 }] },
    });
    await openManager(page);
    await manageRows(page).first().locator('[data-cat-del]').click();
    await expect(manageRows(page)).toHaveCount(1);
    await expect(page.locator('.settings-error')).toHaveText('Останню категорію прибрати не можна.');
    expect(await lastSet(page)).toBeNull();
  });

  test('вибрана у формі категорія після видалення підміняється, а не лишається порожньою', async ({ page }) => {
    await openGoals(page, { profile: { categoriesGoals: ownCategories } });
    await openForm(page);
    await catChips(page).nth(1).click();          // обрали «Робота»
    await expect(catChips(page).nth(1)).toHaveClass(/selected/);

    await page.click('#editCategoriesBtn');
    await manageRows(page).nth(1).locator('[data-cat-del]').click();
    await page.click('#settingsClose');

    // Порожній вибір зберіг би ціль невідомо куди — тож обраною стає запасна.
    await expect(catChips(page)).toHaveCount(2);
    await expect(page.locator('#categoryPicker .category-choice.selected')).toHaveCount(1);
    await expect(page.locator('#categoryPicker .category-choice.selected')).toHaveText('Інше');
  });
});

test.describe('Що зрештою записується в ціль', () => {
  test('у ціль летить id обраної категорії, а не її назва', async ({ page }) => {
    await openGoals(page, { profile: { categoriesGoals: ownCategories } });
    await openForm(page);
    await page.fill('#goalTitleInput', 'Зібрати модель');
    await catChips(page).nth(1).click();
    await page.click('#goalSubmitBtn');

    const added = await page.evaluate(() => window.__fbCalls.add.filter((c) => c.col === 'goals'));
    expect(added).toHaveLength(1);
    expect(added[0].payload.category).toBe('gcat_work');
  });

  test('ціль із категорією, якої вже немає, відкривається на запасній', async ({ page }) => {
    await openGoals(page, {
      profile: { categoriesGoals: ownCategories },
      // Категорію 'health' видалили на іншому пристрої.
      goals: [goal({ category: 'health' })],
    });
    await page.click('[data-open-goal="g1"]');
    await page.click('#detailEditBtn');
    await expect(page.locator('#goalFormOverlay')).toHaveClass(/show/);
    // Форма показує те, що збереже: інакше вибраного рядка не було б видно
    // зовсім, а зберігалося б щось третє.
    await expect(page.locator('#categoryPicker .category-choice.selected')).toHaveText('Інше');
  });
});
