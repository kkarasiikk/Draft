// Список завдань дня: виконане лишається на екрані, просто внизу.
//
// Раніше виконане ховалось у згорнутий блок «Виконано (N)»: щоб побачити
// зроблене за день, його доводилось розгортати, а сам блок займав рядок
// екрана заради лічильника. Тепер картка дня одна, і зроблене просто
// опускається в її кінець.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Тиждень відкривається на сьогодні, тож і сід — на сьогодні.
const TODAY = (() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
})();

const task = (id, title, over = {}) => Object.assign({
  id, title, notes: '', done: false, completedAt: null, priority: null, tags: [],
  dueDate: TODAY, dueTime: null, estimateMin: null, recurrence: null,
  reminderAt: null, notifiedAt: null, subtasks: [],
}, over);

// Виконане стоїть у сіді ПЕРШИМ — щоб перевірка порядку щось означала.
const SEED = {
  tasks: [
    task('t-done', 'Прочитати 20 сторінок', { done: true, completedAt: { __ts: TODAY } }),
    task('t-a', 'Зробити аналіз торгівлі'),
    task('t-b', 'Посидіти в тишині'),
  ],
};

// Над списком стояла картка «Зараз»: одна наступна дія, «маю час: 15/30/60
// хв» і підсумок дня. Прибрана на прохання — тиждень і список дня тепер
// стоять поруч, без прошарку між ними.
test('картки «Зараз» над списком немає', async ({ page }) => {
  await openModule(page, 'tasks/index.html', { seed: SEED });
  await page.waitForSelector('#dayList .task-row');
  await expect(page.locator('#nowCard')).toHaveCount(0);
  await expect(page.locator('.now-card')).toHaveCount(0);
  await expect(page.locator('#appScreen')).not.toContainText('Маю час');
});

test('виконане опускається вниз списку, а не зникає з нього', async ({ page }) => {
  await openModule(page, 'tasks/index.html', { seed: SEED });
  await page.waitForSelector('#dayList .task-row');
  const titles = await page.locator('#dayList .task-title').allTextContents();
  expect(titles).toEqual([
    'Зробити аналіз торгівлі',
    'Посидіти в тишині',
    'Прочитати 20 сторінок',
  ]);
});

test('блока «Виконано (N)» більше немає — картка дня одна', async ({ page }) => {
  await openModule(page, 'tasks/index.html', { seed: SEED });
  await page.waitForSelector('#dayList .task-row');
  await expect(page.locator('#completedToggle')).toHaveCount(0);
  await expect(page.locator('#completedSection')).toHaveCount(0);
  await expect(page.locator('#dayList .day-card')).toHaveCount(1);
});

test('галочку з виконаного знімають там же, де вона стоїть', async ({ page }) => {
  await openModule(page, 'tasks/index.html', { seed: SEED });
  await page.waitForSelector('#dayList .task-row');
  // Нічого розгортати не треба: рядок видимий одразу.
  await expect(page.locator('[data-toggle="t-done"]')).toBeVisible();
  await page.click('[data-toggle="t-done"]');
  await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBe(1);
  const [call] = await page.evaluate(() => window.__fbCalls.update);
  expect(call.id).toBe('t-done');
  expect(call.payload.done).toBe(false);
});
