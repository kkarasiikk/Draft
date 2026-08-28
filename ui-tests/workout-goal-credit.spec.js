// Тренування зараховується в ціль.
//
// Записаний біг нічого не знав про ціль «пробігти 100 км»: два розділи жили
// поруч і не бачили одне одного, тож те саме доводилось відмічати двічі.
// Перевіряємо місток — і те, що він нічого не вирішує сам: скільки саме було,
// знає лише людина, бо в тренуванні лежать підходи й ваги, а не кілометри.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const TODAY = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const shift = (days) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return iso(d);
};

const session = (date) => ({
  id: 'w1', date, name: 'Ранок', notes: '',
  exercises: [{ id: 'e1', libId: 'benchPress', name: 'Жим лежачи', sets: [{ weight: 60, reps: 8 }] }],
});

const goal = (over = {}) => ({
  id: 'g1', title: 'Пробігти 100 км', category: 'health', why: '',
  status: 'active', targetDate: shift(120), horizon: 'year',
  milestones: [], checkins: [], journal: [],
  ...over,
});

const open = (page, { workouts = [session(iso(TODAY))], goals = [goal()] } = {}) =>
  openModule(page, 'workout/index.html', { seed: { workouts, goals } });

const lastUpdate = (page) => page.evaluate(() => window.__fbCalls.update.at(-1));

test('після сьогоднішнього тренування ціль здоровʼя пропонується', async ({ page }) => {
  await open(page);
  await expect(page.locator('.goal-credit')).toBeVisible();
  await expect(page.locator('.credit-title')).toHaveText('Пробігти 100 км');
});

test('без сьогоднішнього тренування нічого не пропонуємо — це просто чужий список', async ({ page }) => {
  await open(page, { workouts: [session(shift(-2))] });
  await expect(page.locator('.goal-credit')).toHaveCount(0);
});

test('ціль не про здоровʼя тут ні до чого', async ({ page }) => {
  await open(page, { goals: [goal({ category: 'learning', title: 'Вивчити польську' })] });
  await expect(page.locator('.goal-credit')).toHaveCount(0);
});

test('ціль на паузі мовчить: про неї свідомо не питають', async ({ page }) => {
  await open(page, { goals: [goal({ status: 'paused' })] });
  await expect(page.locator('.goal-credit')).toHaveCount(0);
});

test('«Зарахувати день» відмічає сьогодні в серії цілі', async ({ page }) => {
  await open(page);
  await page.click('[data-credit-day="g1"]');
  await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
  const upd = await lastUpdate(page);
  expect(upd.payload.checkins).toEqual([iso(TODAY)]);
});

test('уже відмічена ціль без числа кнопки не показує', async ({ page }) => {
  await open(page, { goals: [goal({ checkins: [iso(TODAY)] })] });
  await expect(page.locator('.goal-credit')).toHaveCount(0);
});

test('числова ціль дає ввести, скільки саме було', async ({ page }) => {
  await open(page, { goals: [goal({ targetValue: 100, currentValue: 20, unit: 'км' })] });
  await page.fill('[data-credit-input="g1"]', '5');
  await page.click('[data-credit-add="g1"]');

  await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
  const upd = await lastUpdate(page);
  expect(upd.payload.currentValue).toBe(25);
  expect(upd.payload.progressLog).toEqual([{ date: iso(TODAY), delta: 5 }]);
});

test('додане число заразом відмічає день — дві кнопки поспіль тиснути не треба', async ({ page }) => {
  await open(page, { goals: [goal({ targetValue: 100, currentValue: 20, unit: 'км' })] });
  await page.fill('[data-credit-input="g1"]', '5');
  await page.click('[data-credit-add="g1"]');
  await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
  const upd = await lastUpdate(page);
  expect(upd.payload.checkins).toEqual([iso(TODAY)]);
});

test('порожнє поле нічого не пише — це не нуль кілометрів, це «не ввів»', async ({ page }) => {
  await open(page, { goals: [goal({ targetValue: 100, currentValue: 20, unit: 'км' })] });
  await page.click('[data-credit-add="g1"]');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__fbCalls.update.length)).toBe(0);
});

test('числовій цілі є що додати навіть після відмітки дня', async ({ page }) => {
  await open(page, { goals: [goal({ targetValue: 100, currentValue: 20, unit: 'км', checkins: [iso(TODAY)] })] });
  await expect(page.locator('[data-credit-add="g1"]')).toBeVisible();
  await expect(page.locator('[data-credit-day="g1"]')).toHaveCount(0);
  await expect(page.locator('.credit-done')).toBeVisible();
});
