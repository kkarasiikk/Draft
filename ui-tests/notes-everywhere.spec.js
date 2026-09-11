// Блокнот у трьох розділах: один компонент, три вкладки.
//
// Нотатки жили лише в бюджеті. Коли вони знадобились і в цілях, і в
// тренуваннях, реалізація переїхала в notes.js — а перевіряти після такого
// переїзду треба дві речі: що в кожному розділі блокнот справді працює і що
// розділи НЕ бачать нотаток одне одного. Друге тихіше й неприємніше: без
// фільтра за section у бюджеті просто з'явились би чужі записи.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const SECTIONS = [
  { name: 'Бюджет', path: 'budget/index.html', open: '[data-tab="notes"]', section: 'budget' },
  { name: 'Цілі', path: 'goals/index.html', open: '#bnNotes', section: 'goals' },
  { name: 'Тренування', path: 'workout/index.html', open: '[data-tab="notes"]', section: 'workout' },
];

// По одній нотатці в кожному розділі плюс одна без поля — саме такі лежать
// у людей, що користувались блокнотом до цієї зміни.
const SEED = [
  { id: 'b1', title: 'Борги', content: 'Міша винен 2160', section: 'budget' },
  { id: 'g1', title: 'Плани на рік', content: 'Вивчити польську', section: 'goals' },
  { id: 'w1', title: 'Техніка присіду', content: 'Спина рівна', section: 'workout' },
  { id: 'old', title: 'Стара нотатка', content: 'Без поля section' },
];

for (const s of SECTIONS) {
  test.describe(s.name, () => {
    test('блокнот відкривається й показує свої нотатки', async ({ page }) => {
      await openModule(page, s.path, { seed: { pages: SEED } });
      await page.click(s.open);
      await page.waitForSelector('.note-card');

      const titles = await page.locator('.note-card-title').allTextContents();
      const mine = SEED.filter((p) => (p.section || 'budget') === s.section).map((p) => p.title);
      expect(titles.sort()).toEqual(mine.sort());
    });

    test('чужих нотаток тут немає', async ({ page }) => {
      await openModule(page, s.path, { seed: { pages: SEED } });
      await page.click(s.open);
      await page.waitForSelector('.note-card');

      const foreign = SEED.filter((p) => (p.section || 'budget') !== s.section);
      for (const p of foreign) {
        await expect(page.locator('.note-card-title', { hasText: p.title })).toHaveCount(0);
      }
    });

    test('кнопка «нова нотатка» відкриває редактор', async ({ page }) => {
      await openModule(page, s.path, { seed: { pages: SEED } });
      await page.click(s.open);
      await page.click('#noteAddBtn');
      await expect(page.locator('#noteOverlay')).toHaveClass(/show/);
      await expect(page.locator('#noteTitleInput')).toBeVisible();
      await expect(page.locator('.note-tb-btn')).toHaveCount(5);
    });

    test('нова нотатка пишеться зі своїм розділом', async ({ page }) => {
      await openModule(page, s.path, { seed: { pages: SEED } });
      await page.click(s.open);
      await page.click('#noteAddBtn');
      await page.fill('#noteTitleInput', 'Свіжа');
      await page.click('#noteSaveBtn');
      await page.waitForFunction(() =>
        (window.__fbCalls.add || []).some((c) => c.col === 'pages'));

      const added = await page.evaluate(() =>
        window.__fbCalls.add.filter((c) => c.col === 'pages').pop());
      expect(added.payload.title).toBe('Свіжа');
      expect(added.payload.section).toBe(s.section);
    });

    test('нотатка відкривається на читання й вертається назад', async ({ page }) => {
      await openModule(page, s.path, { seed: { pages: SEED } });
      await page.click(s.open);
      await page.click('.note-card');
      await expect(page.locator('.note-view-content')).toBeVisible();
      await page.click('[data-note-back]');
      await expect(page.locator('#noteAddBtn')).toBeVisible();
    });

    test('порожній заголовок не зберігається', async ({ page }) => {
      await openModule(page, s.path, { seed: { pages: SEED } });
      await page.click(s.open);
      await page.click('#noteAddBtn');
      await page.click('#noteSaveBtn');
      await expect(page.locator('#noteError')).toBeVisible();
      await expect(page.locator('#noteOverlay')).toHaveClass(/show/);
    });
  });
}

test('у цілях пункт «Нотатки» стоїть поруч із «Місяць» і «Рік»', async ({ page }) => {
  await openModule(page, 'goals/index.html');
  const labels = await page.locator('#bottomNav .bn-item span').allTextContents();
  expect(labels).toEqual(['Місяць', 'Рік', 'Нотатки']);
});

test('у тренуваннях пункт «Нотатки» стоїть поруч із «Тренування» і «Рекорди»', async ({ page }) => {
  await openModule(page, 'workout/index.html');
  const labels = await page.locator('#bottomNav .bn-item span').allTextContents();
  expect(labels).toEqual(['Тренування', 'Рекорди', 'Нотатки']);
});

test('підпис пункту перекладається', async ({ page }) => {
  await openModule(page, 'goals/index.html', { lang: 'en' });
  await expect(page.locator('#bnNotesLabel')).toHaveText('Notes');
});
