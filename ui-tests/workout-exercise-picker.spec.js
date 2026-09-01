// Список вибору вправи: що з нього можна прибрати й як повернути.
//
// Приводом було просте питання: «чому я не можу видалити цю вправу?».
// Хрестик стояв лише біля власних вправ, бо вбудовані живуть у файлі
// бібліотеки, а не в базі. Людині від цього не легше: у списку висіли
// вправи, яких вона не робить. Тепер вбудовані ховаються — оборотно.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Вправа з бібліотеки (workout/exercises.js), група «груди».
const LIB_ID = 'benchPress';

const openPicker = async (page) => {
  await page.click('#newSessionBtn');
  await page.waitForSelector('#sessionFormOverlay.show');
  await page.click('#addExerciseBtn');
  await page.waitForSelector('#exercisePickerOverlay.show');
};

test('вбудовану вправу можна прибрати зі списку', async ({ page }) => {
  await openModule(page, 'workout/index.html');
  await openPicker(page);
  await expect(page.locator(`[data-pick-lib="${LIB_ID}"]`)).toHaveCount(1);

  await page.click(`[data-hide-lib="${LIB_ID}"]`);
  // Питання про оборотну дію не має лякати словом «видалити».
  await expect(page.locator('#confirmTitle')).toHaveText('Сховати вправу зі списку?');
  await expect(page.locator('#confirmDelete')).toHaveText('Сховати');
  await page.click('#confirmDelete');

  await expect(page.locator(`[data-pick-lib="${LIB_ID}"]`)).toHaveCount(0);
  // У базу їде сам перелік id, а не копія вправи.
  await expect.poll(() => page.evaluate(() => window.__fbCalls.set.length)).toBe(1);
  const [call] = await page.evaluate(() => window.__fbCalls.set);
  expect(call.col).toBe('users');
  expect(call.payload.hiddenExercises).toEqual({ __arrayUnion: [LIB_ID] });
});

test('сховану вправу видно в кінці списку — і її повертають одним тапом', async ({ page }) => {
  await openModule(page, 'workout/index.html');
  await openPicker(page);
  await page.click(`[data-hide-lib="${LIB_ID}"]`);
  await page.click('#confirmDelete');

  const hidden = page.locator('.picker-hidden');
  await expect(hidden).toHaveCount(1);
  await expect(hidden).toContainText('Жим лежачи');

  await page.click(`[data-restore-lib="${LIB_ID}"]`);
  await expect(page.locator(`[data-pick-lib="${LIB_ID}"]`)).toHaveCount(1);
  await expect(page.locator('.picker-hidden')).toHaveCount(0);
  const calls = await page.evaluate(() => window.__fbCalls.set);
  expect(calls[calls.length - 1].payload.hiddenExercises).toEqual({ __arrayRemove: [LIB_ID] });
});

test('сховане з профілю не зʼявляється в списку після відкриття', async ({ page }) => {
  await openModule(page, 'workout/index.html', { seed: { profile: { hiddenExercises: [LIB_ID] } } });
  await openPicker(page);
  await expect(page.locator(`[data-pick-lib="${LIB_ID}"]`)).toHaveCount(0);
  await expect(page.locator('.picker-hidden')).toContainText('Жим лежачи');
  // Решта бібліотеки на місці — сховали одну вправу, а не групу.
  await expect(page.locator('[data-pick-lib="squat"]')).toHaveCount(1);
});

test('своя вправа й далі саме видаляється, а не ховається', async ({ page }) => {
  await openModule(page, 'workout/index.html', {
    seed: { customExercises: [{ id: 'c1', name: 'Жим в смітті', muscle: 'chest' }] },
  });
  await openPicker(page);
  await page.click('[data-del-custom="c1"]');
  await expect(page.locator('#confirmTitle')).toHaveText('Видалити вправу зі списку?');
  await expect(page.locator('#confirmDelete')).toHaveText('Видалити');
  await page.click('#confirmDelete');
  await expect.poll(() => page.evaluate(() => window.__fbCalls.delete.length)).toBe(1);
  const [del] = await page.evaluate(() => window.__fbCalls.delete);
  expect(del.col).toBe('customExercises');
  expect(del.id).toBe('c1');
});
