// Шаблони тренувань: та сама програма повторюється тижнями, змінюється лише
// вага. Перевіряємо весь шлях — зберегти каркас, застосувати його в новій
// формі, поправити вагу, записати.
const { test, expect } = require('@playwright/test');
const { openModule, isShown } = require('./helpers');

// Шаблон, який «уже є в базі»: заглушка Firestore віддає його підписці.
const SEED = {
  workoutTemplates: [{
    id: 'tpl-1',
    name: 'Груди',
    exercises: [{
      id: 'e1', libId: 'benchPress', muscle: 'chest', name: 'Жим лежачи',
      sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }],
    }],
  }],
};

// Те саме, але з історією: минулого тижня жим ішов уже з іншою вагою.
const SEED_WITH_HISTORY = {
  ...SEED,
  workouts: [
    {
      id: 'w-old', date: '2026-08-01', name: 'Груди', notes: '',
      exercises: [{ id: 'x', libId: 'benchPress', muscle: 'chest', name: 'Жим лежачи',
        sets: [{ weight: 70, reps: 8 }, { weight: 70, reps: 8 }] }],
    },
    {
      id: 'w-last', date: '2026-08-18', name: 'Груди', notes: '',
      exercises: [{ id: 'y', libId: 'benchPress', muscle: 'chest', name: 'Жим лежачи',
        sets: [{ weight: 90, reps: 6 }] }],
    },
  ],
};

test('вага береться з останнього виконання, а не з шаблону', async ({ page }) => {
  await openModule(page, 'workout/index.html', { seed: SEED_WITH_HISTORY });
  await page.click('#newSessionBtn');
  await page.waitForSelector('#sessionFormOverlay.show');
  await page.click('[data-template="tpl-1"]');
  await page.waitForSelector('.ex-block');

  // У шаблоні збережено 80 кг, але востаннє (18 серпня, не 1-го) жим ішов
  // з 90 — саме її й підставляємо.
  const weights = await page.locator('.set-weight').evaluateAll((els) => els.map((e) => e.value));
  expect(weights).toEqual(['90', '90']);

  // Повторення лишаються з шаблону: це прескрипція програми, а не спогад
  // про те, скільки вийшло минулого разу (6).
  const reps = await page.locator('.set-reps').evaluateAll((els) => els.map((e) => e.value));
  expect(reps).toEqual(['8', '8']);
});

test('без історії лишається вага з шаблону', async ({ page }) => {
  await openModule(page, 'workout/index.html', { seed: SEED });
  await page.click('#newSessionBtn');
  await page.waitForSelector('#sessionFormOverlay.show');
  await page.click('[data-template="tpl-1"]');
  await page.waitForSelector('.ex-block');

  const weights = await page.locator('.set-weight').evaluateAll((els) => els.map((e) => e.value));
  expect(weights, 'вправа нова — стартова точка краща за порожні поля').toEqual(['80', '80']);
});

test('шаблон наповнює форму, лишається тільки виправити вагу', async ({ page }) => {
  await openModule(page, 'workout/index.html', { seed: SEED });
  await page.click('#newSessionBtn');
  await page.waitForSelector('#sessionFormOverlay.show');

  // Чипи шаблонів видно одразу — без них довелось би набирати вправи заново.
  await expect(page.locator('#sessionTemplateRow [data-template]')).toHaveCount(1);
  await page.click('[data-template="tpl-1"]');

  // Назва підставилась, вправа з підходами теж.
  expect(await page.inputValue('#sessionNameInput')).toBe('Груди');
  await expect(page.locator('.ex-block')).toHaveCount(1);
  await expect(page.locator('.set-row')).toHaveCount(2);
  expect(await page.locator('.set-weight').first().inputValue()).toBe('80');

  // Єдине, що робить людина: править вагу під сьогодні.
  await page.locator('.set-weight').first().fill('85');
  await page.click('#sessionSubmitBtn');

  await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
  const [call] = await page.evaluate(() => window.__fbCalls.add);
  expect(call.col).toBe('workouts');
  expect(call.payload.name).toBe('Груди');
  expect(call.payload.exercises[0].sets).toEqual([{ weight: 85, reps: 8 }, { weight: 80, reps: 8 }]);
  expect(await isShown(page, '#sessionFormOverlay')).toBe(false);
});

test('повторний тап по шаблону не дублює вправи, а другий шаблон додається', async ({ page }) => {
  const seed = {
    workoutTemplates: [
      SEED.workoutTemplates[0],
      { id: 'tpl-2', name: 'Прес', exercises: [{ id: 'e2', libId: null, muscle: 'core', name: 'Планка', sets: [{ weight: 0, reps: 60 }] }] },
    ],
  };
  await openModule(page, 'workout/index.html', { seed });
  await page.click('#newSessionBtn');
  await page.waitForSelector('#sessionFormOverlay.show');

  await page.click('[data-template="tpl-1"]');
  await page.click('[data-template="tpl-1"]');
  await expect(page.locator('.ex-block'), 'той самий шаблон двічі — не дві копії').toHaveCount(1);

  await page.click('[data-template="tpl-2"]');
  await expect(page.locator('.ex-block'), 'другий шаблон дописується до першого').toHaveCount(2);
  // Назва лишається від першого шаблону: перезаписати набране було б гірше.
  expect(await page.inputValue('#sessionNameInput')).toBe('Груди');
});

test('«зберегти як шаблон» пише каркас без дати й нотатки', async ({ page }) => {
  await openModule(page, 'workout/index.html');
  await page.click('#newSessionBtn');
  await page.waitForSelector('#sessionFormOverlay.show');

  await page.fill('#sessionNameInput', 'Спина');
  await page.click('#addExerciseBtn');
  await page.waitForSelector('#exercisePickerOverlay.show');
  await page.click('[data-pick-lib]');
  await page.waitForSelector('.ex-block');
  await page.fill('.set-weight', '60');
  await page.fill('.set-reps', '10');

  await page.click('#saveAsTemplateBtn');
  await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
  const [call] = await page.evaluate(() => window.__fbCalls.add);
  expect(call.col).toBe('workoutTemplates');
  expect(call.payload.name).toBe('Спина');
  expect(call.payload.exercises[0].sets).toEqual([{ weight: 60, reps: 10 }]);
  // Правила Firestore приймають рівно ці ключі — зайве поле відхилиться.
  expect(Object.keys(call.payload).sort()).toEqual(['createdAt', 'exercises', 'name', 'updatedAt']);
  // Форма лишається відкритою: зберегти шаблон — не те саме, що записати тренування.
  expect(await isShown(page, '#sessionFormOverlay')).toBe(true);
});

test('шаблон без назви не зберігається — назва стоїть на кнопці', async ({ page }) => {
  await openModule(page, 'workout/index.html');
  await page.click('#newSessionBtn');
  await page.waitForSelector('#sessionFormOverlay.show');
  await page.click('#addExerciseBtn');
  await page.waitForSelector('#exercisePickerOverlay.show');
  await page.click('[data-pick-lib]');
  await page.fill('.set-weight', '60');
  await page.fill('.set-reps', '10');

  await page.click('#saveAsTemplateBtn');
  await expect(page.locator('#sessionFormError')).not.toBeEmpty();
  expect(await page.evaluate(() => window.__fbCalls.add.length)).toBe(0);
});

test('у вже записаному тренуванні чипів шаблонів немає', async ({ page }) => {
  const seed = {
    ...SEED,
    workouts: [{ id: 'w1', date: '2026-08-20', name: 'Старе', notes: '', exercises: SEED.workoutTemplates[0].exercises }],
  };
  await openModule(page, 'workout/index.html', { seed });
  await page.click('.session-card, [data-open-session]');
  await page.waitForSelector('#sessionFormOverlay.show');
  await expect(page.locator('#sessionTemplateRow [data-template]'),
    'підмінювати вправи в історії — не те, чого чекають від кнопки').toHaveCount(0);
});

test('шаблон видаляється зі списку керування', async ({ page }) => {
  await openModule(page, 'workout/index.html', { seed: SEED });
  await page.click('#newSessionBtn');
  await page.waitForSelector('#sessionFormOverlay.show');
  await page.click('#manageTemplatesBtn');
  await page.waitForSelector('#templatesOverlay.show');
  await expect(page.locator('.template-item')).toHaveCount(1);

  await page.click('[data-del-template="tpl-1"]');
  await expect.poll(() => page.evaluate(() => window.__fbCalls.delete.length)).toBe(1);
  const [call] = await page.evaluate(() => window.__fbCalls.delete);
  expect(call).toEqual({ col: 'workoutTemplates', id: 'tpl-1' });
});
