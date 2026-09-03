// Цілі на широкому екрані: список і деталі поруч.
//
// Раніше вміст був затиснутий у 640px по центру, а клік по цілі ХОВАВ список
// і показував окремий екран. Щоб глянути сусідню ціль, доводилось тиснути
// «назад» і шукати її заново — при тому що порівнювати цілі якраз і є те,
// заради чого в розділ заходять.
//
// Категорії в списку — роздільники, а не колонки-стопки: колонка означала б
// стан, крізь який ціль проходить, а категорія не змінюється. З восьми
// категорій у місячному виді зайняті дві-три, тож п'ять колонок стояли б
// порожніми, а зайняті були б заввишки в одну картку.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const MONTH = new Date().toISOString().slice(0, 7);
const goal = (id, title, category, extra = {}) => ({
  id, title, category, status: 'active', horizon: 'month', month: MONTH,
  createdAt: { __ts: `${MONTH}-01` }, ...extra,
});

const GOALS = [
  goal('g1', 'Відпочинок на природі', 'health'),
  goal('g2', 'Активна торгівля', 'career'),
  goal('g3', 'Публікація сайту', 'career'),
  goal('g4', 'Тридцять хвилин на думки', 'other'),
];

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 390, height: 844 };

async function openGoals(page, goals = GOALS) {
  await openModule(page, 'goals/index.html', { seed: { profile: {}, goals } });
}

test.describe('Широкий екран', () => {
  test.use({ viewport: WIDE });

  test('клік по цілі НЕ ховає список — обидві колонки лишаються', async ({ page }) => {
    await openGoals(page);
    await expect(page.locator('#goalsList')).toBeVisible();
    await page.click('[data-open-goal="g3"]');
    await expect(page.locator('#goalsList'), 'список мав лишитись на місці').toBeVisible();
    await expect(page.locator('#detailTitleLabel')).toHaveText('Публікація сайту');
  });

  test('видно, яку саме ціль показує права колонка', async ({ page }) => {
    await openGoals(page);
    await page.click('[data-open-goal="g3"]');
    await expect(page.locator('.goal-card.selected')).toHaveCount(1);
    await expect(page.locator('[data-open-goal="g3"]')).toHaveClass(/selected/);
    // Сусідня ціль — один клік, а не «назад» і пошук наново.
    await page.click('[data-open-goal="g2"]');
    await expect(page.locator('[data-open-goal="g2"]')).toHaveClass(/selected/);
    await expect(page.locator('[data-open-goal="g3"]')).not.toHaveClass(/selected/);
    await expect(page.locator('#detailTitleLabel')).toHaveText('Активна торгівля');
  });

  test('«назад» звідси прибрано — вертатись нікуди', async ({ page }) => {
    await openGoals(page);
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('#detailBackBtn')).toBeHidden();
  });

  test('права колонка не зустрічає порожнечею — перша ціль обрана сама', async ({ page }) => {
    await openGoals(page);
    await expect(page.locator('#detailTitleLabel')).toHaveText('Відпочинок на природі');
    await expect(page.locator('[data-open-goal="g1"]')).toHaveClass(/selected/);
    await expect(page.locator('#detailPlaceholder')).toBeHidden();
  });

  test('коли обирати нема з чого — підказка замість деталей', async ({ page }) => {
    await openGoals(page, []);
    await expect(page.locator('#detailPlaceholder')).toBeVisible();
    await expect(page.locator('#detailBody')).toBeHidden();
  });

  test('категорії стають роздільниками, і порожніх серед них немає', async ({ page }) => {
    await openGoals(page);
    // Рівно три: у восьми стандартних категоріях зайняті три.
    await expect(page.locator('.goal-group-label')).toHaveCount(3);
    await expect(page.locator('.goal-group-label')).toHaveText([/Здоров/i, /Кар/i, /Інше/i]);
  });

  test('порядок груп — той самий, що в списку категорій, а не алфавітний', async ({ page }) => {
    // «Кар'єра» стоїть у стандартному списку раніше за «Інше», хоч за
    // алфавітом було б навпаки.
    await openGoals(page, [goal('a', 'Раз', 'other'), goal('b', 'Два', 'career')]);
    await expect(page.locator('.goal-group-label')).toHaveText([/Кар/i, /Інше/i]);
  });

  test('перша обрана — перша у ПЕРШІЙ групі, а не в сирому списку', async ({ page }) => {
    // У сирому списку першою йде ціль «Інше», але на екрані вище стоїть група
    // «Кар'єра» — обиратись має та, що людина бачить першою.
    await openGoals(page, [goal('a', 'Раз', 'other'), goal('b', 'Два', 'career')]);
    await expect(page.locator('#detailTitleLabel')).toHaveText('Два');
  });
});

test.describe('Телефон', () => {
  test.use({ viewport: NARROW });

  test('лишається як був: клік відкриває екран цілі замість списку', async ({ page }) => {
    await openGoals(page);
    await expect(page.locator('#goalsList')).toBeVisible();
    await page.click('[data-open-goal="g3"]');
    await expect(page.locator('#goalsList')).toBeHidden();
    await expect(page.locator('#detailTitleLabel')).toHaveText('Публікація сайту');
    await expect(page.locator('#detailBackBtn')).toBeVisible();
    await page.click('#detailBackBtn');
    await expect(page.locator('#goalsList')).toBeVisible();
  });

  test('нічого не обирається саме — екран цілі відкриває людина', async ({ page }) => {
    await openGoals(page);
    await expect(page.locator('#goalDetailScreen')).toBeHidden();
  });

  test('список суцільний — групи за категоріями лише додали б прокрутки', async ({ page }) => {
    await openGoals(page);
    await expect(page.locator('.goal-group-label')).toHaveCount(0);
  });
});
