// Незбережені зміни у формах усіх чотирьох модулів.
//
// Приводом був реальний випадок: людина набирала план тренування, промахнулась
// повз вікно — і все зникло без жодного питання. Форми закриваються тапом по
// підкладці в кожному модулі, тож перевіряємо кожен: там, де є що втрачати,
// вихід має перепитати.
const { test, expect } = require('@playwright/test');
const { openModule, isShown, tapBackdrop, dialog, checksOutUnsavedGuard } = require('./helpers');

test.describe('Тренування', () => {
  const open = (page) => async () => {
    await page.click('#newSessionBtn');
    await page.waitForSelector('#sessionFormOverlay.show');
  };

  test('форма тренування не втрачає набране', async ({ page }) => {
    await openModule(page, 'workout/index.html');
    await checksOutUnsavedGuard({
      page,
      overlay: 'sessionFormOverlay',
      closeBtn: '#closeSessionForm',
      open: open(page),
      dirty: () => page.fill('#sessionNameInput', 'Ноги'),
    });
  });

  test('«продовжити редагування» лишає введене на місці', async ({ page }) => {
    await openModule(page, 'workout/index.html');
    await open(page)();
    await page.fill('#sessionNameInput', 'Спина');
    await tapBackdrop(page, 'sessionFormOverlay');
    await dialog.keep(page);
    expect(await page.inputValue('#sessionNameInput')).toBe('Спина');
  });

  test('невдале збереження лишає форму з помилкою, а не закриває її', async ({ page }) => {
    await openModule(page, 'workout/index.html');
    await open(page)();
    // Тренування без жодної вправи не зберігається — саме той випадок, коли
    // закрити форму «бо натиснули зберегти» означало б втратити набране.
    await page.fill('#sessionNameInput', 'Порожнє');
    await tapBackdrop(page, 'sessionFormOverlay');
    await dialog.save(page);
    await expect(page.locator('#sessionFormError')).not.toBeEmpty();
    expect(await isShown(page, '#sessionFormOverlay')).toBe(true);
  });

  test('«зберегти» справді пише тренування й закриває форму', async ({ page }) => {
    await openModule(page, 'workout/index.html');
    await open(page)();
    await page.fill('#sessionNameInput', 'Груди');
    await page.click('#addExerciseBtn');
    await page.waitForSelector('#exercisePickerOverlay.show');
    await page.click('[data-pick-lib]');
    await page.waitForSelector('.ex-block');
    await page.fill('.set-weight', '80');
    await page.fill('.set-reps', '8');

    await tapBackdrop(page, 'sessionFormOverlay');
    expect(await dialog.shown(page), 'зміна підходів теж має рахуватись').toBe(true);
    await dialog.save(page);

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
    const [call] = await page.evaluate(() => window.__fbCalls.add);
    expect(call.payload.name).toBe('Груди');
    expect(call.payload.exercises[0].sets).toEqual([{ weight: 80, reps: 8 }]);
    expect(await isShown(page, '#sessionFormOverlay')).toBe(false);
  });
});

test.describe('Завдання', () => {
  // Повна форма відкривається з швидкого додавання кнопкою «Деталі…».
  const open = (page) => async () => {
    await page.click('#openQuickAdd');
    await page.waitForSelector('#quickAddOverlay.show');
    await page.click('#quickAddDetailsBtn');
    await page.waitForSelector('#taskFormOverlay.show');
  };

  test('форма завдання не втрачає набране', async ({ page }) => {
    await openModule(page, 'tasks/index.html');
    await checksOutUnsavedGuard({
      page,
      overlay: 'taskFormOverlay',
      closeBtn: '#closeTaskForm',
      open: open(page),
      dirty: () => page.fill('#taskTitleInput', 'Купити молоко'),
    });
  });

  test('підзадачі теж рахуються за зміни', async ({ page }) => {
    await openModule(page, 'tasks/index.html');
    await open(page)();
    await page.fill('#taskTitleInput', 'Прибирання');
    await page.click('#addSubtaskBtn');
    await page.fill('[data-sub-title]', 'Помити вікна');
    await tapBackdrop(page, 'taskFormOverlay');
    expect(await dialog.shown(page)).toBe(true);
  });
});

test.describe('Цілі', () => {
  const open = (page) => async () => {
    await page.click('#openNewGoalBtn');
    await page.waitForSelector('#goalFormOverlay.show');
  };

  test('форма цілі не втрачає набране', async ({ page }) => {
    await openModule(page, 'goals/index.html');
    await checksOutUnsavedGuard({
      page,
      overlay: 'goalFormOverlay',
      closeBtn: '#closeGoalForm',
      open: open(page),
      dirty: () => page.fill('#goalTitleInput', 'Вивчити польську'),
    });
  });
});

test.describe('Бюджет', () => {
  test('форма транзакції не втрачає набране', async ({ page }) => {
    await openModule(page, 'budget/index.html');
    await checksOutUnsavedGuard({
      page,
      overlay: 'formOverlay',
      closeBtn: '#closeForm',
      open: async () => {
        await page.click('#bnAddBtn');
        await page.waitForSelector('#formOverlay.show');
      },
      dirty: () => page.fill('#amountInput', '250'),
    });
  });

  test('нотатка не втрачає набраний текст', async ({ page }) => {
    await openModule(page, 'budget/index.html');
    const open = async () => {
      await page.click('.bn-item[data-tab="notes"]');
      await page.click('#addNoteBtn');
      await page.waitForSelector('#pageOverlay.show');
    };
    await checksOutUnsavedGuard({
      page,
      overlay: 'pageOverlay',
      closeBtn: '#closePage',
      open,
      dirty: () => page.fill('#pageTitleInput', 'Ідеї'),
    });
  });

  test('порожній редактор нотатки не вважається зміненим від самого дотику', async ({ page }) => {
    await openModule(page, 'budget/index.html');
    await page.click('.bn-item[data-tab="notes"]');
    await page.click('#addNoteBtn');
    await page.waitForSelector('#pageOverlay.show');
    // Клік у contenteditable: браузер сам добудовує порожнє поле тегом <br>,
    // і без нормалізації нотатка «змінювалась» би від самого лише дотику.
    await page.click('#pageContentInput');
    await tapBackdrop(page, 'pageOverlay');
    expect(await dialog.shown(page), 'нічого ж не написали').toBe(false);
    expect(await isShown(page, '#pageOverlay')).toBe(false);
  });

  test('текст нотатки рахується за зміну', async ({ page }) => {
    await openModule(page, 'budget/index.html');
    await page.click('.bn-item[data-tab="notes"]');
    await page.click('#addNoteBtn');
    await page.waitForSelector('#pageOverlay.show');
    await page.click('#pageContentInput');
    await page.keyboard.type('Купити квитки до Львова');
    await tapBackdrop(page, 'pageOverlay');
    expect(await dialog.shown(page)).toBe(true);
    await dialog.keep(page);
    await expect(page.locator('#pageContentInput')).toContainText('Купити квитки до Львова');
  });
});
