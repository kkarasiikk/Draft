// Витрата й завдання записуються просто з головної.
//
// Раніше «+» → «Витрата» вів у Бюджет за #new: повне перезавантаження сторінки
// заради двох полів, а потім ще й дорога назад — при тому що людина нікуди йти
// не збиралась, вона хотіла записати суму. Тепер форма відкривається тут же.
//
// Ціль і тренування лишаються посиланнями свідомо: там не форма, а екран
// (горизонт і категорія в цілі, вправи з підходами в тренуванні), і стискати
// його до аркуша означало б зробити другу, гіршу форму замість наявної.
const { test, expect } = require('@playwright/test');
const { openModule, isShown, tapBackdrop, checksOutUnsavedGuard } = require('./helpers');

test.use({ viewport: { width: 390, height: 844 } });

const iso = (shift = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};
const monthStart = () => iso().slice(0, 7) + '-01';

const SEED = {
  profile: { currency: 'PLN' },
  transactions: [{ id: 't1', date: monthStart(), type: 'expense', amount: 100 }],
  tasks: [{ id: 'k1', title: 'Стара справа', dueDate: iso(), done: false }],
  goals: [{ id: 'g1', title: 'Бігати', status: 'active', horizon: 'month', month: iso().slice(0, 7) }],
};

async function openHub(page, opts = {}) {
  await openModule(page, 'index.html', { seed: SEED, ready: '#homeScreen', ...opts });
}

/** Шлях людини: «+» → рядок у шторці. */
async function openQuick(page, kind) {
  await page.click('#addFab');
  await page.click(`[data-quick="${kind}"]`);
  await expect(page.locator('#quickOverlay')).toHaveClass(/show/);
}

const adds = (page) => page.evaluate(() => window.__fbCalls.add);
const lastAdd = async (page) => (await adds(page)).pop();

test.describe('Форма відкривається тут, а не в розділі', () => {
  test('«Витрата» не веде в бюджет — вікно виїжджає на головній', async ({ page }) => {
    await openHub(page);
    const before = page.url();
    await openQuick(page, 'expense');
    expect(page.url(), 'сторінка не мала змінитись').toBe(before);
    await expect(page.locator('#quickExpenseFields')).toBeVisible();
    await expect(page.locator('#quickTaskFields')).toBeHidden();
  });

  test('«Завдання» відкриває свою форму — з назвою, датою й часом', async ({ page }) => {
    await openHub(page);
    await openQuick(page, 'task');
    await expect(page.locator('#quickTaskFields')).toBeVisible();
    await expect(page.locator('#quickExpenseFields')).toBeHidden();
    await expect(page.locator('#quickTitle')).toHaveText('Нове завдання');
    // Перемикача «витрата / дохід» у завданні бути не може.
    await expect(page.locator('#quickTypeToggle')).toBeHidden();
  });

  test('шторка «+» закривається — вікно не виїжджає поверх власного меню', async ({ page }) => {
    await openHub(page);
    await openQuick(page, 'expense');
    expect(await isShown(page, '#addOverlay')).toBe(false);
  });

  test('ціль і тренування досі ведуть у свій розділ', async ({ page }) => {
    await openHub(page);
    await page.click('#addFab');
    await expect(page.locator('#addChoices a[href*="goals/index.html#new"]')).toHaveCount(1);
    await expect(page.locator('#addChoices a[href*="workout/index.html#new"]')).toHaveCount(1);
  });
});

test.describe('Витрата', () => {
  test('записується тими самими полями, що й у бюджеті', async ({ page }) => {
    await openHub(page);
    await openQuick(page, 'expense');
    await page.fill('#quickAmount', '124,50');
    await page.fill('#quickNote', 'кава');
    await page.click('#quickSubmitBtn');
    await expect(page.locator('#quickOverlay')).not.toHaveClass(/show/);
    // Кома — теж десяткова крапка: на телефоні кому дає українська розкладка.
    expect(await lastAdd(page)).toEqual({
      col: 'transactions',
      payload: { type: 'expense', amount: 124.5, category: 'food', note: 'кава', date: iso() },
    });
  });

  test('порожня чи нульова сума не зберігається, а каже чому', async ({ page }) => {
    await openHub(page);
    await openQuick(page, 'expense');
    await page.click('#quickSubmitBtn');
    await expect(page.locator('#quickError')).toBeVisible();
    await expect(page.locator('#quickOverlay')).toHaveClass(/show/);
    await page.fill('#quickAmount', '0');
    await page.click('#quickSubmitBtn');
    await expect(page.locator('#quickError')).toBeVisible();
    expect((await adds(page)).length, 'нічого не мало дійти до бази').toBe(0);
  });

  test('«Дохід» міняє і категорії, і тип запису', async ({ page }) => {
    await openHub(page);
    await openQuick(page, 'expense');
    await page.click('#quickTypeIncome');
    await expect(page.locator('#quickCats .cat-choice').first()).toHaveText('Зарплата');
    await page.fill('#quickAmount', '3000');
    await page.click('#quickSubmitBtn');
    const add = await lastAdd(page);
    expect(add.payload.type).toBe('income');
    expect(add.payload.category).toBe('salary');
  });

  test('категорії беруться з профілю, а не стандартні', async ({ page }) => {
    await openModule(page, 'index.html', {
      ready: '#homeScreen',
      seed: { ...SEED, profile: { currency: 'PLN', categoriesExpense: [{ id: 'cats', label: 'Коти', colorIndex: 2 }] } },
    });
    await openQuick(page, 'expense');
    await expect(page.locator('#quickCats .cat-choice')).toHaveCount(1);
    await expect(page.locator('#quickCats .cat-choice')).toHaveText('Коти');
  });

  test('категорії, що приїхали пізніше за форму, однаково в неї потрапляють', async ({ page }) => {
    // Профіль приїжджає своїм запитом, і форму могли відкрити раніше. Той
    // самий випадок, який колись показував у бюджеті стандартні сім категорій
    // замість власних.
    await openModule(page, 'index.html', {
      ready: '#homeScreen',
      profileDelay: 400,
      seed: { ...SEED, profile: { currency: 'PLN', categoriesExpense: [{ id: 'cats', label: 'Коти', colorIndex: 2 }] } },
    });
    await openQuick(page, 'expense');
    await expect(page.locator('#quickCats .cat-choice')).toHaveText('Коти');
  });
});

test.describe('Завдання', () => {
  test('записується з тими ж порожніми полями, що й незаймана повна форма', async ({ page }) => {
    await openHub(page);
    await openQuick(page, 'task');
    await page.fill('#quickTaskTitle', 'Купити молоко');
    await page.fill('#quickTaskTime', '18:30');
    await page.click('#quickSubmitBtn');
    await expect(page.locator('#quickOverlay')).not.toHaveClass(/show/);
    const add = await lastAdd(page);
    expect(add.col).toBe('tasks');
    expect(add.payload).toMatchObject({
      title: 'Купити молоко', notes: '', done: false, completedAt: null,
      priority: null, tags: [], dueDate: iso(), dueTime: '18:30',
      estimateMin: null, recurrence: null, reminderAt: null, notifiedAt: null, subtasks: [],
    });
  });

  test('дата за замовчуванням — сьогодні, бо саме сьогоднішнє записують з головної', async ({ page }) => {
    await openHub(page);
    await openQuick(page, 'task');
    await expect(page.locator('#quickTaskDate')).toHaveValue(iso());
  });

  test('без назви не зберігається, а каже чому', async ({ page }) => {
    await openHub(page);
    await openQuick(page, 'task');
    await page.click('#quickSubmitBtn');
    await expect(page.locator('#quickError')).toBeVisible();
    expect((await adds(page)).length).toBe(0);
  });
});

test.describe('Головна після запису', () => {
  test('плитка бюджету одразу рахує щойно записану витрату', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('#budgetStat')).toHaveText('100');
    await openQuick(page, 'expense');
    await page.fill('#quickAmount', '50');
    await page.click('#quickSubmitBtn');
    await expect(page.locator('#budgetStat')).toHaveText('150');
  });

  test('нове завдання одразу видно і в «Сьогодні», і на плитці', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('#tasksStat')).toHaveText('1');
    await openQuick(page, 'task');
    await page.fill('#quickTaskTitle', 'Купити молоко');
    await page.click('#quickSubmitBtn');
    await expect(page.locator('#tasksStat')).toHaveText('2');
    await expect(page.locator('#todayList')).toContainText('Купити молоко');
  });

  test('решта головної від запису не блимає — рядок під датою лишається на місці', async ({ page }) => {
    // Перечитуємо ЛИШЕ той розділ, якого торкнувся запис. Повне перезавантаження
    // головної скидало homeData в нулі, і рядок під датою на мить порожнів —
    // тобто вдале збереження виглядало як збій.
    await openHub(page);
    await expect(page.locator('#todayLine')).not.toHaveText('');
    // Порожнім рядок буває на мить, і кінцевою перевіркою його не спіймати:
    // до неї він уже знову заповнений. Тому стежимо за КОЖНИМ присвоєнням.
    await page.evaluate(() => {
      window.__lineBlanked = false;
      const el = document.getElementById('todayLine');
      const desc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      Object.defineProperty(el, 'textContent', {
        get() { return desc.get.call(this); },
        set(v) { if (!String(v).trim()) window.__lineBlanked = true; desc.set.call(this, v); },
      });
    });
    await openQuick(page, 'expense');
    await page.fill('#quickAmount', '50');
    await page.click('#quickSubmitBtn');
    await expect(page.locator('#quickOverlay')).not.toHaveClass(/show/);
    await expect(page.locator('#budgetStat')).toHaveText('150');
    expect(await page.evaluate(() => window.__lineBlanked),
      'рядок під датою порожнів — головна перечитувалась уся, а не потрібний розділ').toBe(false);
  });
});

test.describe('Незбережене', () => {
  test('промах повз вікно не стирає набране мовчки', async ({ page }) => {
    await openHub(page);
    await checksOutUnsavedGuard({
      page,
      overlay: 'quickOverlay',
      open: () => openQuick(page, 'expense'),
      dirty: () => page.fill('#quickAmount', '77'),
      closeBtn: '#quickCloseBtn',
    });
  });

  test('чиста форма закривається без питань', async ({ page }) => {
    await openHub(page);
    await openQuick(page, 'task');
    await tapBackdrop(page, 'quickOverlay');
    expect(await isShown(page, '#quickOverlay')).toBe(false);
    expect(await isShown(page, '#unsavedGuardOverlay')).toBe(false);
  });
});
