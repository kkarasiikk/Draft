// Скільки головна показує на широкому екрані.
//
// Було: смуга з семи днів і чотири справи — стеля, підібрана під телефон.
// На компʼютері від цього лишалась порожньою половина сторінки. Тепер обидві
// межі залежать від ширини: тиждень / місяць і 4 / 10 справ, а те, що не
// вмістилось, веде в розділ завдань, а не зникає мовчки.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const iso = (shift = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};
const T = iso(0);

const task = (n, done = false) => ({
  id: 't' + n, title: 'Справа ' + n, notes: '', done, completedAt: null,
  priority: null, tags: [], dueDate: T, dueTime: null, estimateMin: null,
  recurrence: null, reminderAt: null, notifiedAt: null, subtasks: [],
});
const manyTasks = (n) => ({ tasks: Array.from({ length: n }, (_, i) => task(i + 1)) });

async function openHub(page, seed) {
  await page.route('**/cdnjs.cloudflare.com/**', (r) => r.fulfill({ status: 200, body: '' }));
  await openModule(page, 'index.html', { seed: seed || {}, ready: '#homeScreen' });
}

test.describe('Широкий екран', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('календар показує весь місяць, а не сім днів', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('.cal-grid')).toBeVisible();
    await expect(page.locator('.cal-week')).toHaveCount(0);
    // Повні тижні, що накривають місяць: 28, 35 або 42 клітинки.
    const cells = await page.locator('.cal-grid .cal-day').count();
    expect([28, 35, 42]).toContain(cells);
    // Дні тижня стоять шапкою один раз, а не в кожній клітинці.
    await expect(page.locator('.cal-dow-head')).toHaveCount(7);
    await expect(page.locator('.cal-grid .cal-dow')).toHaveCount(0);
  });

  test('у сітці є всі числа місяця', async ({ page }) => {
    await openHub(page);
    const inMonth = page.locator('.cal-grid .cal-day:not(.other-month) .cal-num');
    const nums = (await inMonth.allTextContents()).map(Number);
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    expect(nums).toEqual(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  });

  test('сьогодні позначене саме сьогоднішнім числом', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('.cal-grid .cal-day.today .cal-num'))
      .toHaveText(String(new Date().getDate()));
  });

  test('картка «Сьогодні» показує до десяти справ', async ({ page }) => {
    await openHub(page, manyTasks(14));
    await expect(page.locator('#todayList .today-row')).toHaveCount(10);
  });

  test('решта не зникає мовчки — рядок веде в завдання', async ({ page }) => {
    await openHub(page, manyTasks(14));
    const more = page.locator('.today-more');
    await expect(more).toHaveText('Ще 4 у завданнях →');
    await expect(more).toHaveAttribute('href', 'tasks/index.html');
  });

  test('коли все вміщається, зайвого рядка немає', async ({ page }) => {
    await openHub(page, manyTasks(6));
    await expect(page.locator('#todayList .today-row')).toHaveCount(6);
    await expect(page.locator('.today-more')).toHaveCount(0);
  });
});

test.describe('Телефон', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('лишається смуга тижня — місяць туди не вліз би', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('.cal-week')).toBeVisible();
    await expect(page.locator('.cal-grid')).toHaveCount(0);
    await expect(page.locator('.cal-week .cal-day')).toHaveCount(7);
  });

  test('стеля лишається на чотирьох справах', async ({ page }) => {
    await openHub(page, manyTasks(14));
    await expect(page.locator('#todayList .today-row')).toHaveCount(4);
    await expect(page.locator('.today-more')).toHaveText('Ще 10 у завданнях →');
  });
});

// Підпис над календарем — це місяць СЬОГОДНІШНЬОГО дня. Тиждень на межі
// місяців підписувався обома назвами («серпень — вересень»), а в сітці
// місяця хвости сусідніх місяців є завжди, тож підпис по краях однаково
// брехав би. 31 серпня — це ще серпень; 1 вересня — вже вересень.
test.describe('Назва місяця над календарем', () => {
  const atNoon = (iso) => new Date(`${iso}T12:00:00`);

  test.describe('телефон', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('останній день серпня підписаний серпнем, хоч у тижні вже вересень', async ({ page }) => {
      await page.clock.install({ time: atNoon('2026-08-31') });
      await openHub(page);
      // Той самий тиждень: 31 серпня — 6 вересня.
      await expect(page.locator('.cal-week .cal-day').first().locator('.cal-num')).toHaveText('31');
      await expect(page.locator('#calMonth')).toHaveText('серпень');
    });

    test('наступного дня той самий тиждень підписаний вереснем', async ({ page }) => {
      await page.clock.install({ time: atNoon('2026-09-01') });
      await openHub(page);
      await expect(page.locator('.cal-week .cal-day').first().locator('.cal-num')).toHaveText('31');
      await expect(page.locator('#calMonth')).toHaveText('вересень');
    });
  });

  test.describe('широкий екран', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('сітка серпня підписана серпнем, хоч по краях є липень і вересень', async ({ page }) => {
      await page.clock.install({ time: atNoon('2026-08-31') });
      await openHub(page);
      await expect(page.locator('#calMonth')).toHaveText('серпень');
    });
  });
});

// На великому моніторі вміст мав власну висоту й тулився до верху, а під ним
// лишалась порожня третина сторінки. Тепер сітка головної має мінімальну
// висоту на весь екран: плитки стають нижнім краєм, а ряд «Сьогодні +
// календар» забирає решту. Там, де вміст і так вищий за екран, це не
// змінює нічого.
test.describe('Великий монітор', () => {
  test.use({ viewport: { width: 1900, height: 950 } });

  test('сторінка заповнює екран і не гортається', async ({ page }) => {
    await openHub(page, manyTasks(6));
    const { doc, win } = await page.evaluate(() => ({
      doc: document.documentElement.scrollHeight,
      win: window.innerHeight,
    }));
    expect(doc).toBeLessThanOrEqual(win);
  });

  test('плитки стоять унизу, а не посеред сторінки', async ({ page }) => {
    await openHub(page, manyTasks(6));
    const gap = await page.evaluate(() => {
      const r = document.querySelector('.sections').getBoundingClientRect();
      return window.innerHeight - r.bottom;
    });
    // Рівно поле сторінки знизу (48px) — і нічого більше.
    expect(gap).toBeLessThan(60);
  });

  test('ряд «Сьогодні + календар» забирає вільну висоту', async ({ page }) => {
    await openHub(page, manyTasks(6));
    const h = await page.evaluate(() => ({
      panel: document.getElementById('todayPanel').getBoundingClientRect().height,
      cal: document.querySelector('.cal').getBoundingClientRect().height,
    }));
    // Обидві картки однієї висоти й помітно вищі за свій вміст.
    expect(Math.abs(h.panel - h.cal)).toBeLessThan(2);
    expect(h.panel).toBeGreaterThan(500);
  });

  // Ростуть рядки, а не клітинки: інакше виділення сьогоднішнього дня
  // витягувалось у високу синю смугу замість позначки дня.
  test('клітинка сьогодні лишається позначкою дня, а не смугою', async ({ page }) => {
    await openHub(page, manyTasks(6));
    const cell = await page.locator('.cal-grid .cal-day.today').boundingBox();
    expect(cell.height).toBeLessThanOrEqual(97);
    // І не вужча за себе саму по горизонталі — тобто це все ще квадратик.
    expect(cell.height / cell.width).toBeLessThan(1.6);
  });
});

// Ноутбук: тут вміст і так заповнював екран, і розкладка не мала змінитись.
test.describe('Ноутбук', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('десять справ і місяць не породжують горизонтального скролу', async ({ page }) => {
    await openHub(page, manyTasks(14));
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
