// Нотатки: вміст із редактора не має показуватись тегами.
//
// Приводом був підпис у списку: «Міша винен за серпень -&nbsp;<br>Діма винен
// -&nbsp;». Причина — розпізнавання HTML за першим символом вмісту:
// contenteditable не загортає перший рядок у тег, тільки наступні, тож майже
// кожна нотатка з редактора починається зі слова, а теги стоять усередині.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

// Саме такий вміст і пише редактор: текст, а вже потім теги.
const FROM_EDITOR = 'Міша винен за серпень -&nbsp;<br>Діма винен -&nbsp;';

const openNotes = async (page, pages) => {
  await openModule(page, 'budget/index.html', { seed: { pages } });
  await page.click('[data-tab="notes"]');
  await page.waitForSelector('.note-card');
};

test('у підписі під назвою немає ні тегів, ні сутностей', async ({ page }) => {
  await openNotes(page, [{ id: 'p1', title: 'Борги', content: FROM_EDITOR }]);
  const snippet = page.locator('.note-card-snippet');
  await expect(snippet).not.toContainText('<br>');
  await expect(snippet).not.toContainText('&nbsp;');
  // Слова з різних рядків не злипаються: <br> — це проміжок.
  await expect(snippet).toContainText('серпень - Діма винен');
});

test('нотатка з редактора відкривається текстом, а не розміткою', async ({ page }) => {
  await openNotes(page, [{ id: 'p1', title: 'Борги', content: FROM_EDITOR }]);
  await page.click('.note-card');
  const view = page.locator('#pageViewContent');
  await expect(view).toContainText('Міша винен за серпень');
  await expect(view).not.toContainText('<br>');
  await expect(view).not.toContainText('&nbsp;');
  // Розрив рядка лишається розривом, а не зникає.
  await expect(view.locator('br')).toHaveCount(1);
});

test('стара текстова нотатка й далі читається як розмітка', async ({ page }) => {
  await openNotes(page, [{ id: 'p1', title: 'Список', content: '# Заголовок\n- перше\n- друге' }]);
  await page.click('.note-card');
  const view = page.locator('#pageViewContent');
  await expect(view.locator('h3')).toHaveText('Заголовок');
  await expect(view.locator('li')).toHaveCount(2);
});

test('«R&D» і «a < b» за розмітку не рахуються', async ({ page }) => {
  // Обидва рядки не мають ні тега, ні сутності — це звичайний текст, і
  // розпізнавач не повинен ловити їх на «&» чи «<».
  await openNotes(page, [{ id: 'p1', title: 'Текст', content: 'R&D: якщо a < b, то все гаразд' }]);
  await expect(page.locator('.note-card-snippet')).toHaveText('R&D: якщо a < b, то все гаразд');
  await page.click('.note-card');
  await expect(page.locator('#pageViewContent')).toContainText('R&D: якщо a < b, то все гаразд');
});
