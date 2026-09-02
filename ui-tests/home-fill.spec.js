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
