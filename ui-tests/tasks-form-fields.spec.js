// Форма завдання після чистки: назва, нотатка, дата, час, нагадування.
//
// Пріоритет, «скільки часу займе», повторення, теги й підзадачі прибрані на
// прохання. Тест стереже дві різні речі, і обидві легко зламати наосліп:
// 1) полів у формі справді немає — і немає слідів, які вони лишали в списку;
// 2) дані, записані ДО прибирання, збереження не стирає. Правила Firestore
//    досі вимагають ці поля в кожному завданні, тож застосунок пише їх далі —
//    і має писати те, що вже лежить у документі.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const TODAY = (() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
})();

// Завдання з часів, коли всі ці поля ще заповнювались.
const OLD_TASK = {
  id: 't-old', title: 'Прибирання', notes: '', done: false, completedAt: null,
  dueDate: TODAY, dueTime: null,
  priority: 'high',
  tags: ['дім', 'вихідні'],
  estimateMin: 45,
  recurrence: { type: 'weekly', interval: 1, weekdays: [6], day: null, anchor: 'schedule' },
  subtasks: [{ id: 's1', title: 'Помити вікна', done: false }],
  reminderAt: null, notifiedAt: null,
};

const SEED = { tasks: [OLD_TASK] };

const openForm = async (page) => {
  await page.waitForSelector('#dayList .task-row');
  await page.click('[data-open="t-old"]');
  await page.waitForSelector('#taskFormOverlay.show');
};

test('прибраних полів у формі немає', async ({ page }) => {
  await openModule(page, 'tasks/index.html', { seed: SEED });
  await openForm(page);

  for (const sel of [
    '#taskPriorityPicker', '#taskEstimateInput', '#taskRecurrencePicker',
    '#recurrenceOptions', '#taskTagsEditor', '#taskTagInput',
    '#taskSubtasksEditor', '#addSubtaskBtn',
  ]) {
    await expect(page.locator(sel), sel + ' має зникнути з форми').toHaveCount(0);
  }

  // Нагадування — навпаки, лишається: його прибирати не просили.
  await expect(page.locator('#taskReminderPicker')).toHaveCount(1);
});

test('картка завдання більше не показує прибраних полів', async ({ page }) => {
  await openModule(page, 'tasks/index.html', { seed: SEED });
  await page.waitForSelector('#dayList .task-row');

  // Чипи пріоритету, тегів, оцінки й повторення та лічильник підзадач.
  await expect(page.locator('.priority-chip')).toHaveCount(0);
  await expect(page.locator('.tag-chip')).toHaveCount(0);
  await expect(page.locator('.task-progress')).toHaveCount(0);
  // Кольорова рамка чекбокса за пріоритетом.
  await expect(page.locator('.task-check.priority-high')).toHaveCount(0);
  // Рядок фільтра за тегами над списком дня.
  await expect(page.locator('#tagFilterRow')).toHaveCount(0);
});

test('збереження не стирає те, що записали до прибирання', async ({ page }) => {
  await openModule(page, 'tasks/index.html', { seed: SEED });
  await openForm(page);
  await page.fill('#taskTitleInput', 'Прибирання квартири');
  await page.click('#taskSubmitBtn');

  await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBe(1);
  const [call] = await page.evaluate(() => window.__fbCalls.update);
  expect(call.payload.title).toBe('Прибирання квартири');
  expect(call.payload.priority).toBe('high');
  expect(call.payload.tags).toEqual(['дім', 'вихідні']);
  expect(call.payload.estimateMin).toBe(45);
  expect(call.payload.recurrence).toMatchObject({ type: 'weekly' });
  expect(call.payload.subtasks).toEqual([{ id: 's1', title: 'Помити вікна', done: false }]);
});

test('нове завдання отримує ці поля порожніми — інакше правила відхилять запис', async ({ page }) => {
  await openModule(page, 'tasks/index.html', { seed: { tasks: [] } });
  await page.click('#openQuickAdd');
  await page.waitForSelector('#quickAddOverlay.show');
  await page.click('#quickAddDetailsBtn');
  await page.waitForSelector('#taskFormOverlay.show');
  await page.fill('#taskTitleInput', 'Купити молоко');
  await page.click('#taskSubmitBtn');

  await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
  const [call] = await page.evaluate(() => window.__fbCalls.add);
  expect(call.payload.priority).toBeNull();
  expect(call.payload.tags).toEqual([]);
  expect(call.payload.estimateMin).toBeNull();
  expect(call.payload.recurrence).toBeNull();
  expect(call.payload.subtasks).toEqual([]);
});

// Виконане повторюване завдання створювало наступне. Правила більше немає в
// формі, але старі завдання свій `recurrence` зберегли — і серія не має
// ожити від однієї галочки.
test('виконання старого повторюваного завдання не створює наступного', async ({ page }) => {
  await openModule(page, 'tasks/index.html', { seed: SEED });
  await page.waitForSelector('#dayList .task-row');
  await page.click('[data-toggle="t-old"]');

  await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBe(1);
  expect(await page.evaluate(() => window.__fbCalls.add.length)).toBe(0);
});
