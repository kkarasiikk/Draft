// Дробова вага в підходах — і з комою.
//
// Поле ваги було type="number", а такий інпут КОМИ не приймає: браузер вважає
// «12,5» недійсним і віддає порожній рядок. Виходив розрив — список вправ
// пише «12,5 кг» українською (fmtNum працює за локаллю), а набрати те саме в
// полі не дає, і половина ваги мовчки зникала при збереженні.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const openForm = async (page) => {
  await openModule(page, 'workout/index.html');
  await page.click('#newSessionBtn');
  await page.waitForSelector('#sessionFormOverlay.show');
  await page.fill('#sessionNameInput', 'Груди');
  await page.click('#addExerciseBtn');
  await page.waitForSelector('.picker-item');
  await page.click('.picker-item');
  await page.waitForSelector('.set-weight');
};

const savedSets = (page) => page.evaluate(() => {
  const call = (window.__fbCalls.add || []).filter((c) => c.col === 'workouts').pop();
  return call.payload.exercises[0].sets;
});

test('вага з комою доходить до збереження', async ({ page }) => {
  await openForm(page);
  await page.fill('.set-weight', '12,5');
  await page.fill('.set-reps', '8');
  await page.click('#sessionSubmitBtn');
  await page.waitForFunction(() =>
    (window.__fbCalls.add || []).some((c) => c.col === 'workouts'));

  expect(await savedSets(page)).toEqual([{ weight: 12.5, reps: 8 }]);
});

test('крапка працює так само — на випадок іншої клавіатури', async ({ page }) => {
  await openForm(page);
  await page.fill('.set-weight', '127.5');
  await page.fill('.set-reps', '5');
  await page.click('#sessionSubmitBtn');
  await page.waitForFunction(() =>
    (window.__fbCalls.add || []).some((c) => c.col === 'workouts'));

  expect(await savedSets(page)).toEqual([{ weight: 127.5, reps: 5 }]);
});

test('ціла вага лишається цілою', async ({ page }) => {
  await openForm(page);
  await page.fill('.set-weight', '25');
  await page.fill('.set-reps', '10');
  await page.click('#sessionSubmitBtn');
  await page.waitForFunction(() =>
    (window.__fbCalls.add || []).some((c) => c.col === 'workouts'));

  expect(await savedSets(page)).toEqual([{ weight: 25, reps: 10 }]);
});

test('поле прибирає за собою, коли з нього йдуть', async ({ page }) => {
  await openForm(page);
  await page.fill('.set-weight', '12.5');
  await page.locator('.set-reps').click();
  // Українською вага показується з комою — і в полі теж, щоб набране
  // збігалося з написаним у списку вправ.
  await expect(page.locator('.set-weight')).toHaveValue('12,5');
});

test('поки набирають — поле не переписують під пальцем', async ({ page }) => {
  await openForm(page);
  await page.locator('.set-weight').click();
  await page.keyboard.type('12,');
  // Розбір на «12,» дасть 12, і якби поле переписувалось одразу, кома зникала
  // б разом із наміром дописати половину.
  await expect(page.locator('.set-weight')).toHaveValue('12,');
  await page.keyboard.type('5');
  await expect(page.locator('.set-weight')).toHaveValue('12,5');
});

test('сміття не стає вагою', async ({ page }) => {
  await openForm(page);
  await page.fill('.set-weight', 'абв');
  await page.fill('.set-reps', '8');
  await page.click('#sessionSubmitBtn');
  await page.waitForFunction(() =>
    (window.__fbCalls.add || []).some((c) => c.col === 'workouts'));

  expect(await savedSets(page)).toEqual([{ weight: 0, reps: 8 }]);
});
