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

test.describe('Тренування наперед (план)', () => {
  // Привід: людина пише собі план на завтра — вправи є, ваг ще немає. Раніше
  // такі вправи мовчки зникали при збереженні, і план перетворювався на
  // порожнечу.
  async function planWith(page, count) {
    await page.click('#newSessionBtn');
    await page.waitForSelector('#sessionFormOverlay.show');
    for (let i = 0; i < count; i++) {
      await page.click('#addExerciseBtn');
      await page.waitForSelector('#exercisePickerOverlay.show');
      await page.locator('[data-pick-lib]').nth(i).click();
      await page.waitForSelector(`.ex-block >> nth=${i}`);
    }
  }

  test('вправа без жодної цифри зберігається, а не зникає', async ({ page }) => {
    await openModule(page, 'workout/index.html');
    await planWith(page, 2);
    await page.fill('#sessionNameInput', 'План на завтра');
    await page.click('#sessionSubmitBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
    const [call] = await page.evaluate(() => window.__fbCalls.add);
    expect(call.payload.exercises).toHaveLength(2);
    // Порожні рядки лишились: три порожні підходи — це «три підходи,
    // ваги ще не знаю», а не «підходів немає».
    expect(call.payload.exercises[0].sets.length).toBeGreaterThan(0);
    expect(call.payload.exercises[0].sets.every((s) => s.reps === 0)).toBe(true);
    expect(await isShown(page, '#sessionFormOverlay')).toBe(false);
  });

  test('запланований підхід відкривається порожнім, а не нулями', async ({ page }) => {
    const seed = {
      workouts: [{
        id: 'p1', date: '2026-08-25', name: 'План', notes: '',
        exercises: [{ id: 'a', libId: 'benchPress', muscle: 'chest', name: 'Жим лежачи',
          sets: [{ weight: 0, reps: 0 }, { weight: 0, reps: 0 }] }],
      }],
    };
    await openModule(page, 'workout/index.html', { seed });
    await page.click('[data-open-session="p1"]');
    await page.waitForSelector('#sessionFormOverlay.show');
    const weights = await page.locator('.set-weight').evaluateAll((els) => els.map((e) => e.value));
    const reps = await page.locator('.set-reps').evaluateAll((els) => els.map((e) => e.value));
    expect(weights, 'план — це порожні поля, а не нульовий результат').toEqual(['', '']);
    expect(reps).toEqual(['', '']);
  });

  test('власна вага (0 кг, але є повторення) нулем не стирається', async ({ page }) => {
    const seed = {
      workouts: [{
        id: 'b1', date: '2026-08-20', name: 'Турнік', notes: '',
        exercises: [{ id: 'a', libId: 'pullUp', muscle: 'back', name: 'Підтягування',
          sets: [{ weight: 0, reps: 12 }] }],
      }],
    };
    await openModule(page, 'workout/index.html', { seed });
    await page.click('[data-open-session="b1"]');
    await page.waitForSelector('#sessionFormOverlay.show');
    expect(await page.locator('.set-weight').first().inputValue()).toBe('0');
    expect(await page.locator('.set-reps').first().inputValue()).toBe('12');
  });

  test('план не стає рекордом і не підказує вагу наступного разу', async ({ page }) => {
    const seed = {
      workouts: [
        { id: 'done', date: '2026-08-10', name: 'Робота', notes: '',
          exercises: [{ id: 'a', libId: 'benchPress', muscle: 'chest', name: 'Жим лежачи',
            sets: [{ weight: 80, reps: 8 }] }] },
        { id: 'plan', date: '2026-08-22', name: 'План', notes: '',
          exercises: [{ id: 'b', libId: 'benchPress', muscle: 'chest', name: 'Жим лежачи',
            sets: [{ weight: 0, reps: 0 }] }] },
      ],
    };
    await openModule(page, 'workout/index.html', { seed });
    // У списку планове тренування показує «—», а не «0×0».
    await page.click('[data-cal-day="2026-08-22"]');
    await page.waitForSelector('#sessionFormOverlay.show');
    await page.click('#closeSessionForm');

    // Підказка бере 80×8 із реального тренування, а не нулі з плану.
    await page.click('#newSessionBtn');
    await page.waitForSelector('#sessionFormOverlay.show');
    await page.click('#addExerciseBtn');
    await page.waitForSelector('#exercisePickerOverlay.show');
    await page.click('[data-pick-lib="benchPress"]');
    await expect(page.locator('.hint-last')).toContainText('80');
  });
});

test.describe('Підпис у картці тренування', () => {
  const seed = {
    workouts: [{
      id: 's1', date: '2026-08-20', name: 'Ноги', notes: '',
      exercises: [
        ex('squat', 'Присідання', 'legs', [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }]),
        ex('lunge', 'Випади', 'legs', [{ weight: 20, reps: 10 }]),
      ],
    }],
  };

  test('рахує підходи й називає їх підходами, а не повтореннями', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed });
    // Дві вправи, три підходи. Раніше тут стояло «2 вправи · 3 повт.» —
    // рахувались підходи, а підписувались повтореннями.
    await expect(page.locator('.session-meta')).toHaveText('2 вправи · 3 підходи');
  });

  test('однина не ламається', async ({ page }) => {
    const one = { workouts: [{ id: 's2', date: '2026-08-20', name: 'Швидке', notes: '',
      exercises: [ex('plank', 'Планка', 'core', [{ weight: 0, reps: 60 }])] }] };
    await openModule(page, 'workout/index.html', { seed: one });
    // Було «1 вправи · 1 повт.».
    await expect(page.locator('.session-meta')).toHaveText('1 вправа · 1 підхід');
  });
});

test.describe('Форма гортається лише вертикально', () => {
  test('вікно тренування замкнене на вертикаль (не тягнеться вбік)', async ({ page }) => {
    await openModule(page, 'workout/index.html');
    await page.click('#newSessionBtn');
    await page.waitForSelector('#sessionFormOverlay.show');
    const modal = page.locator('#sessionFormOverlay .modal');
    // touch-action:pan-y забороняє браузеру возити вікно пальцем убік.
    await expect(modal).toHaveCSS('touch-action', 'pan-y');
    await expect(modal).toHaveCSS('overflow-x', 'hidden');
    // І горизонтального оверфлоу немає навіть при кількох вправах.
    const overflows = await modal.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflows, 'контент не має вилазити вбік').toBe(false);
  });
});
