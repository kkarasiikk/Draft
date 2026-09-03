// Головна на комп'ютері.
//
// Телефонну колонку не можна просто розтягнути: центрована смуга на 720px
// лишала півекрана порожнім, а верхня панель тим часом тулилась до самого
// лівого краю — два різні центри в одному вікні. Тут інша розкладка, і
// стережемо саме те, що в ній може мовчки поламатись: щоб блоки стояли
// поруч, а не один під одним, щоб їхні краї збігались, і щоб дії, які на
// телефоні робить гамбургер і «+», лишились доступними без них.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

test.use({ viewport: { width: 1280, height: 900 } });

const iso = (shift = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};

async function openHub(page, seed) {
  await openModule(page, 'index.html', { seed: seed || {}, ready: '#homeScreen' });
}

const box = (page, sel) => page.locator(sel).boundingBox();

test.describe('Розкладка', () => {
  test('меню розділів стоїть зліва, вміст — праворуч від нього', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('.side-nav')).toBeVisible();
    const nav = await box(page, '.side-nav');
    const main = await box(page, '.home-main');
    expect(nav.x + nav.width).toBeLessThanOrEqual(main.x);
  });

  test('«Сьогодні» й тиждень стоять поруч, а не один під одним', async ({ page }) => {
    await openHub(page, { tasks: [{ id: 't1', title: 'Пошта', dueDate: iso(), done: false }] });
    const panel = await box(page, '#todayPanel');
    const cal = await box(page, '.cal');
    expect(panel.x + panel.width).toBeLessThanOrEqual(cal.x + 1);
    // Одна лінія зверху: саме її розсинхрон і був видно на знімку.
    expect(Math.abs(panel.y - cal.y)).toBeLessThan(2);
  });

  test('шапка, картки й плитки починаються з однієї вертикалі', async ({ page }) => {
    await openHub(page, { tasks: [{ id: 't1', title: 'Пошта', dueDate: iso(), done: false }] });
    const head = await box(page, '.today-head');
    const panel = await box(page, '#todayPanel');
    const tiles = await box(page, '.sections');
    expect(Math.abs(head.x - panel.x)).toBeLessThan(2);
    expect(Math.abs(head.x - tiles.x)).toBeLessThan(2);
    // І закінчуються теж: раніше шапка була на всю ширину, а решта — на 720.
    expect(Math.abs((head.x + head.width) - (tiles.x + tiles.width))).toBeLessThan(2);
  });

  test('плитки стоять рядком по чотири', async ({ page }) => {
    await openHub(page);
    const tops = await page.locator('.tile').evaluateAll(
      (els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(tops).toHaveLength(4);
    expect(new Set(tops).size).toBe(1);
  });

  test('порожнього поля справа не лишається', async ({ page }) => {
    await openHub(page);
    const main = await box(page, '.home-main');
    const wrap = await box(page, '.wrap');
    // Вміст доходить до поля сторінки. Раніше він упирався в 720px, і
    // праворуч лишалась порожня половина вікна.
    expect((wrap.x + wrap.width) - (main.x + main.width)).toBeLessThan(45);
  });
});

test.describe('Дії без гамбургера', () => {
  test('гамбургер на комп’ютері схований, а «+» — ні', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('#menuBtn')).toBeHidden();
    // Той самий круглий «+», що й у розділах. Колись його тут ховали, а
    // замість нього в шапці стояла кнопка «Записати» — виходило дві звички
    // на одну дію, залежно від того, з чого відкрив застосунок.
    await expect(page.locator('#addFab')).toBeVisible();
    await expect(page.locator('#recordBtn')).toHaveCount(0);
  });

  test('«+» стоїть у нижньому куті, як у розділах', async ({ page }) => {
    await openHub(page);
    const box = await page.locator('#addFab').boundingBox();
    const size = page.viewportSize();
    expect(size.width - (box.x + box.width)).toBeLessThan(60);
    expect(size.height - (box.y + box.height)).toBeLessThan(60);
  });

  test('«+» відкриває список і другим дотиком закриває', async ({ page }) => {
    await openHub(page);
    await page.click('#addFab');
    await expect(page.locator('#addOverlay')).toHaveClass(/show/);
    await expect(page.locator('.add-row')).not.toHaveCount(0);
    // Кнопка лишається над затемненням — інакше другий дотик упирався б у
    // підкладку, і вона не вміла б закрити те, що сама відкрила.
    await page.click('#addFab');
    await expect(page.locator('#addOverlay')).not.toHaveClass(/show/);
  });

  test('список виїжджає з-під кнопки, а не з іншого кута', async ({ page }) => {
    await openHub(page);
    await page.click('#addFab');
    const menu = await page.locator('#addMenu').boundingBox();
    const fab = await page.locator('#addFab').boundingBox();
    expect(menu.y + menu.height).toBeLessThanOrEqual(fab.y + 1);
    expect(Math.abs((menu.x + menu.width) - (fab.x + fab.width))).toBeLessThan(30);
  });

  test('«Налаштування» відкривають меню теми й мови', async ({ page }) => {
    await openHub(page);
    await page.click('#sideSettingsBtn');
    await expect(page.locator('#appMenuOverlay')).toHaveClass(/show/);
    await expect(page.locator('#themePicker .theme-choice').first()).toBeVisible();
  });

  test('«Експорт даних» із колонки відкриває той самий діалог', async ({ page }) => {
    await openHub(page);
    await page.click('#sideExportBtn');
    await expect(page.locator('#exportOverlay')).toHaveClass(/show/);
  });

  test('розділи відкриваються з колонки', async ({ page }) => {
    await openHub(page);
    const hrefs = await page.locator('.side-nav a.side-link').evaluateAll(
      (els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toEqual([
      'budget/index.html', 'goals/index.html', 'tasks/index.html', 'workout/index.html',
    ]);
    // Головна — не посилання: тиснути на неї означало б перезавантажити те саме.
    await expect(page.locator('.side-link.current')).toHaveText('Головна');
    await expect(page.locator('a.side-link.current')).toHaveCount(0);
  });
});

test.describe('Шапка', () => {
  test('дата словами стоїть над рядком стану', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('#todayDate')).toBeVisible();
    const today = new Date();
    const expected = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(today);
    await expect(page.locator('#todayDate')).toContainText(expected);
  });

  test('мова перемикає і дату, і підписи колонки', async ({ page }) => {
    await openHub(page);
    await page.click('#sideSettingsBtn');
    await page.click('#langPicker .lang-choice[data-lang="en"]');
    await expect(page.locator('#sideLabel-home')).toHaveText('Home');
    await expect(page.locator('#sideLabel-workout')).toHaveText('Workouts');
    await expect(page.locator('#sideLabel-settings')).toHaveText('Settings');
    await expect(page.locator('#sideLabel-export')).toHaveText('Export data');
    const expected = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
    await expect(page.locator('#todayDate')).toContainText(expected);
  });
});

// Між телефоном і двома колонками є середина: колонка розділів уже є, а
// календар іще на всю ширину. Поріг ставить саме він — у вужчому вікні дні
// сходяться впритул, і від назви справи лишається одна літера.
test.describe('Вузький екран: колонка є, розкладка одноколонкова', () => {
  test.use({ viewport: { width: 1000, height: 900 } });

  test('меню розділів уже стоїть, а картки — одна під одною', async ({ page }) => {
    await openHub(page, { tasks: [{ id: 't1', title: 'Пошта', dueDate: iso(), done: false }] });
    await expect(page.locator('.side-nav')).toBeVisible();
    const cal = await box(page, '.cal');
    const panel = await box(page, '#todayPanel');
    expect(panel.y).toBeGreaterThan(cal.y + cal.height - 1);
    // Календар бере всю ширину — заради читабельних сімох стовпчиків.
    expect(Math.abs(cal.width - panel.width)).toBeLessThan(2);
  });

  test('шапка все одно згори, а не під календарем, як на телефоні', async ({ page }) => {
    await openHub(page);
    const head = await box(page, '.today-head');
    const cal = await box(page, '.cal');
    expect(head.y + head.height).toBeLessThanOrEqual(cal.y + 1);
  });

  test('плитки стоять 2×2, а не вчотирьох упритул', async ({ page }) => {
    await openHub(page);
    const tops = await page.locator('.tile').evaluateAll(
      (els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(2);
  });
});

// На телефоні розкладка лишається тією, що є: колонка, календар угорі,
// гамбургер і «+». Комп'ютерні блоки туди не мають протікати.
test.describe('Телефон не змінився', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('бічної колонки на телефоні немає, а «+» стоїть як стояв', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('.side-nav')).toBeHidden();
    await expect(page.locator('#todayDate')).toBeHidden();
    await expect(page.locator('#menuBtn')).toBeVisible();
    await expect(page.locator('#addFab')).toBeVisible();
  });

  test('календар лишається над рядком стану', async ({ page }) => {
    await openHub(page);
    const cal = await box(page, '.cal');
    const head = await box(page, '.today-head');
    expect(cal.y + cal.height).toBeLessThanOrEqual(head.y + 1);
  });
});
