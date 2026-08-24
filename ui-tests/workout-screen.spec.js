// Календар тренувань і порядок вправ у формі.
const { test, expect } = require('@playwright/test');
const { openModule, isShown } = require('./helpers');

const ex = (libId, name, muscle, sets) => ({ id: libId, libId, name, muscle, sets });

// Серпень 2026: тренування 5-го, 18-го і два 20-го.
const SEED = {
  workouts: [
    { id: 'w1', date: '2026-08-05', name: 'Груди', notes: '',
      exercises: [ex('benchPress', 'Жим лежачи', 'chest', [{ weight: 70, reps: 8 }])] },
    { id: 'w2', date: '2026-08-18', name: 'Ноги', notes: '',
      exercises: [ex('squat', 'Присідання', 'legs', [{ weight: 100, reps: 5 }])] },
    { id: 'w3', date: '2026-08-20', name: 'Ранкове', notes: '',
      exercises: [ex('plank', 'Планка', 'core', [{ weight: 0, reps: 60 }])] },
    { id: 'w4', date: '2026-08-20', name: 'Вечірнє', notes: '',
      exercises: [ex('deadlift', 'Станова', 'back', [{ weight: 120, reps: 5 }])] },
  ],
};

test.describe('Календар', () => {
  test('крапки стоять рівно на днях із тренуваннями', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await page.waitForSelector('.wcal');
    // Клікабельні лише дні з тренуванням; 20-те одне, хоч тренувань там два.
    const days = await page.locator('[data-cal-day]').evaluateAll((els) => els.map((e) => e.dataset.calDay));
    expect(days.sort()).toEqual(['2026-08-05', '2026-08-18', '2026-08-20']);
  });

  test('тап по дню з одним тренуванням відкриває саме його', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await page.click('[data-cal-day="2026-08-18"]');
    await page.waitForSelector('#sessionFormOverlay.show');
    expect(await page.inputValue('#sessionNameInput')).toBe('Ноги');
    expect(await page.inputValue('#sessionDateInput')).toBe('2026-08-18');
  });

  test('день із кількома тренуваннями звужує список, а не вгадує', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await page.click('[data-cal-day="2026-08-20"]');
    expect(await isShown(page, '#sessionFormOverlay'), 'вгадувати, яке з двох — гірше').toBe(false);
    await expect(page.locator('.session-card')).toHaveCount(2);

    // «Усі дні» знімає звуження.
    await page.click('#wcalClearBtn');
    await expect(page.locator('.session-card')).toHaveCount(4);
  });

  test('стрілки гортають місяці, назва вертає в поточний', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    const title = () => page.textContent('#wcalTitle');
    const august = await title();

    await page.click('[data-cal-shift="-1"]');
    expect(await title()).not.toBe(august);
    // У липні тренувань не було — і клікати нема на що.
    await expect(page.locator('[data-cal-day]')).toHaveCount(0);

    await page.click('#wcalTitle');
    expect(await title()).toBe(august);
    await expect(page.locator('[data-cal-day]')).toHaveCount(3);
  });
});

test.describe('Порядок вправ', () => {
  // Форма з трьома вправами, набрана через пікер.
  async function openFormWith(page, count) {
    await page.click('#newSessionBtn');
    await page.waitForSelector('#sessionFormOverlay.show');
    for (let i = 0; i < count; i++) {
      await page.click('#addExerciseBtn');
      await page.waitForSelector('#exercisePickerOverlay.show');
      await page.locator('[data-pick-lib]').nth(i).click();
      await page.waitForSelector(`.ex-block >> nth=${i}`);
    }
  }
  const names = (page) => page.locator('.ex-block-name').allTextContents();

  test('перетягування міняє вправи місцями', async ({ page }) => {
    await openModule(page, 'workout/index.html');
    await openFormWith(page, 3);
    const before = await names(page);

    // Тягнемо першу картку нижче середини другої — цього досить, щоб вони
    // помінялись місцями.
    const handle = page.locator('[data-drag-handle]').first();
    const from = await handle.boundingBox();
    const second = await page.locator('.ex-block').nth(1).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, second.y + second.height / 2 + 10, { steps: 12 });
    await page.mouse.up();

    const after = await names(page);
    expect(after).toEqual([before[1], before[0], before[2]]);
  });

  test('порядок після перетягування саме такий і зберігається', async ({ page }) => {
    await openModule(page, 'workout/index.html');
    await openFormWith(page, 2);
    await page.fill('.ex-block >> nth=0 >> .set-weight', '50');
    await page.fill('.ex-block >> nth=0 >> .set-reps', '5');
    await page.fill('.ex-block >> nth=1 >> .set-weight', '60');
    await page.fill('.ex-block >> nth=1 >> .set-reps', '6');
    const before = await names(page);

    // З клавіатури — той самий результат, що й жестом.
    await page.locator('[data-drag-handle]').first().focus();
    await page.keyboard.press('ArrowDown');
    expect(await names(page)).toEqual([before[1], before[0]]);

    await page.fill('#sessionNameInput', 'Порядок');
    await page.click('#sessionSubmitBtn');
    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
    const [call] = await page.evaluate(() => window.__fbCalls.add);
    // Підходи переїхали разом зі своїми вправами, а не лишились на місці.
    expect(call.payload.exercises.map((e) => e.sets[0])).toEqual([{ weight: 60, reps: 6 }, { weight: 50, reps: 5 }]);
  });

  test('одна вправа — тягнути нема куди, і нічого не ламається', async ({ page }) => {
    await openModule(page, 'workout/index.html');
    await openFormWith(page, 1);
    const handle = page.locator('[data-drag-handle]').first();
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.ex-block')).toHaveCount(1);
  });
});
