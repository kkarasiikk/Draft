// Календар на головній — не картинка: тап по числу відкриває розділ завдань
// саме на цьому дні.
//
// Раніше числа нічого не робили: побачив крапку на четвергу — і йди шукай той
// четвер у розділі руками.
const { test, expect } = require('@playwright/test');
const { openModule, calendarFrame } = require('./helpers');

const iso = (shift = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};
const T = iso(0);
const TARGET = iso(3);

const task = (id, title, dueDate) => ({
  id, title, notes: '', done: false, completedAt: null, priority: null, tags: [],
  dueDate, dueTime: null, estimateMin: null, recurrence: null,
  reminderAt: null, notifiedAt: null, subtasks: [],
});
const SEED = { tasks: [task('a', 'Сьогоднішня', T), task('b', 'Через три дні', TARGET)] };

async function openHub(page, seed) {
  await page.route('**/cdnjs.cloudflare.com/**', (r) => r.fulfill({ status: 200, body: '' }));
  await openModule(page, 'index.html', { seed: seed || {}, ready: '#homeScreen' });
}

test.describe('Числа календаря ведуть у завдання', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('кожен день — посилання на свій день у завданнях', async ({ page }) => {
    await openHub(page);
    const days = page.locator('.cal-grid .cal-day');
    const count = await days.count();
    expect(count).toBeGreaterThan(27);
    for (let i = 0; i < count; i++) {
      await expect(days.nth(i)).toHaveAttribute('href', /^tasks\/index\.html#day=\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('сьогоднішнє число веде на сьогодні', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('.cal-day.today')).toHaveAttribute('href', `tasks/index.html#day=${T}`);
  });

  // Посилання, а не кнопка з обробником: так працює середня кнопка миші,
  // «відкрити в новій вкладці» й клавіатура.
  test('це справжнє посилання, а не div з обробником', async ({ page }) => {
    await openHub(page);
    const tag = await page.locator('.cal-day.today').evaluate((el) => el.tagName);
    expect(tag).toBe('A');
    await expect(page.locator('.cal-day.today')).toHaveAttribute('aria-label', /\d/);
  });
});

test.describe('Телефон: смуга тижня теж клікабельна', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('дні тижня ведуть у завдання так само', async ({ page }) => {
    await openHub(page);
    // Смуга гортається, тож клітинок намальовано більше, ніж видно; сім — це
    // те, що в кадрі.
    expect((await calendarFrame(page)).count).toBe(7);
    await expect(page.locator('.cal-day.today')).toHaveAttribute('href', `tasks/index.html#day=${T}`);
  });
});

test.describe('Розділ завдань відкривається на потрібному дні', () => {
  test('#day=… обирає той день і показує його завдання', async ({ page }) => {
    await openModule(page, `tasks/index.html#day=${TARGET}`, { seed: SEED });
    await expect(page.locator('.week-day.selected .week-day-num'))
      .toHaveText(String(Number(TARGET.slice(8))));
    await expect(page.locator('#dayList .task-title')).toHaveText(['Через три дні']);
  });

  test('хеш прибирається — оновлення не відкриє те саме вдруге', async ({ page }) => {
    await openModule(page, `tasks/index.html#day=${TARGET}`, { seed: SEED });
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
  });

  test('без хеша розділ лишається на сьогодні', async ({ page }) => {
    await openModule(page, 'tasks/index.html', { seed: SEED });
    await expect(page.locator('#dayList .task-title')).toHaveText(['Сьогоднішня']);
  });

  // Форма дати збігається — це ще не дата: parseISODate тихо перелляла б
  // «2026-13-45» у лютий наступного року.
  test('неможлива дата в хеші нічого не обирає', async ({ page }) => {
    await openModule(page, 'tasks/index.html#day=2026-13-45', { seed: SEED });
    await expect(page.locator('#dayList .task-title')).toHaveText(['Сьогоднішня']);
  });
});
