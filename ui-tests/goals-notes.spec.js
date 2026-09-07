// Нотатки цілі й рядок категорій.
//
// На екрані цілі був щоденник — стрічка окремих записів із датами, — а над
// списком стояли два рядки: бейджі досягнень і фільтр станів. Перше не давало
// написати про ціль звʼязного тексту (дописати рядок до вчорашньої думки не
// виходило), друге хвалило за те, що й так видно, третє дублює те, що тепер
// написано над кожною групою списку.
//
// Стережеться передусім те, що легко зламати наосліп: що поле зберігається
// САМЕ (кнопки немає, і текст не має губитись), що знімок із бази не вибиває
// з-під пальців те, що зараз пишуть, і що старий щоденник із кількох записів
// не зник, а читається одним текстом.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const MONTH = new Date().toISOString().slice(0, 7);
const goal = (over = {}) => ({
  id: 'g1', title: 'Пробігти 100 км', category: 'health', why: '',
  status: 'active', targetDate: null, horizon: 'month', month: MONTH,
  milestones: [], checkins: [], journal: [],
  ...over,
});

const openGoals = (page, goals = [goal()]) =>
  openModule(page, 'goals/index.html', { seed: { profile: {}, goals } });

const openDetail = async (page, goals = [goal()]) => {
  await openGoals(page, goals);
  await page.click(`[data-open-goal="${goals[0].id}"]`);
};

const lastUpdate = async (page) => {
  await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
  return page.evaluate(() => window.__fbCalls.update.at(-1));
};

test.describe('Нотатки замість щоденника', () => {
  test('стрічки записів більше немає — є одне поле', async ({ page }) => {
    await openDetail(page);
    await expect(page.locator('#goalNotes')).toBeVisible();
    await expect(page.locator('#journalInput')).toHaveCount(0);
    await expect(page.locator('#journalAddBtn')).toHaveCount(0);
    await expect(page.locator('.journal-entry')).toHaveCount(0);
  });

  // Кнопки «зберегти» тут немає свідомо: текст, який треба підтверджувати,
  // губиться щоразу, коли сторінку закривають на півдумці.
  test('текст зберігається сам, без жодної кнопки', async ({ page }) => {
    await openDetail(page);
    await page.fill('#goalNotes', 'Тиждень 1: три пробіжки по 5 км');
    const upd = await lastUpdate(page);
    expect(upd.col).toBe('goals');
    expect(upd.payload.journal.map((e) => e.text)).toEqual(['Тиждень 1: три пробіжки по 5 км']);
  });

  // Мовчазне автозбереження лишало б людину гадати, чи текст десь є.
  test('після запису поле каже «Збережено»', async ({ page }) => {
    await openDetail(page);
    await page.fill('#goalNotes', 'щось');
    await expect(page.locator('#notesState')).toHaveText('Збережено');
  });

  test('порожня нотатка стирає поле, а не лишає порожній запис', async ({ page }) => {
    await openDetail(page, [goal({ journal: [{ id: 'j1', text: 'було', createdAt: 1 }] })]);
    await page.fill('#goalNotes', '   ');
    const upd = await lastUpdate(page);
    expect(upd.payload.journal).toEqual([]);
  });

  // Старий щоденник нікуди не подівся: записи зливаються в один текст у
  // хронологічному порядку, і перше ж збереження згортає їх в один елемент.
  test('старий щоденник із кількох записів читається одним текстом', async ({ page }) => {
    await openDetail(page, [goal({ journal: [
      { id: 'j2', text: 'друге', createdAt: 2 },
      { id: 'j1', text: 'перше', createdAt: 1 },
    ] })]);
    await expect(page.locator('#goalNotes')).toHaveValue('перше\n\nдруге');
  });

  // Знімок із бази приїжджає й на власний запис. Якби рендер щоразу ставив
  // значення з бази, текст стрибав би під пальцями.
  test('перемальовка не вибиває з-під пальців те, що зараз пишуть', async ({ page }) => {
    await openDetail(page);
    await page.click('#goalNotes');
    await page.keyboard.type('недописана думка');
    // Перемальовуємо список так само, як це робить будь-який знімок.
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(100);
    await expect(page.locator('#goalNotes')).toHaveValue('недописана думка');
  });

  // Перехід на іншу ціль — найлегший спосіб загубити останню фразу: пауза
  // перед записом ще не минула, а поле вже показує чужий текст.
  test('перехід на іншу ціль дописує те, що не встигло зберегтись', async ({ page }) => {
    await openDetail(page, [goal(), goal({ id: 'g2', title: 'Друга' })]);
    await page.click('#goalNotes');
    await page.keyboard.type('останнє слово');
    await page.click('[data-open-goal="g2"]');
    const upd = await lastUpdate(page);
    expect(upd.id).toBe('g1');
    expect(upd.payload.journal[0].text).toBe('останнє слово');
    await expect(page.locator('#goalNotes')).toHaveValue('');
  });

  test('поле росте під текст, а не крутиться всередині', async ({ page }) => {
    await openDetail(page);
    const before = await page.locator('#goalNotes').evaluate((el) => el.clientHeight);
    await page.fill('#goalNotes', Array.from({ length: 20 }, (_, i) => `рядок ${i}`).join('\n'));
    const el = page.locator('#goalNotes');
    expect(await el.evaluate((n) => n.clientHeight)).toBeGreaterThan(before);
    expect(await el.evaluate((n) => n.scrollHeight - n.clientHeight)).toBeLessThanOrEqual(1);
  });
});

test.describe('Категорії замість бейджів і фільтра станів', () => {
  const two = [
    goal({ id: 'g1', title: 'Пробігти 100 км', category: 'health' }),
    goal({ id: 'g2', title: 'Вивчити польську', category: 'learning' }),
  ];

  test('бейджів і фільтра станів більше немає', async ({ page }) => {
    await openGoals(page, two);
    await expect(page.locator('#badgesRow')).toHaveCount(0);
    await expect(page.locator('#statusFilterRow')).toHaveCount(0);
    await expect(page.locator('.badge-chip')).toHaveCount(0);
  });

  test('рядок називає категорії, які на вкладці справді є', async ({ page }) => {
    await openGoals(page, two);
    const chips = page.locator('#categoryFilterRow .tag-filter-chip');
    await expect(chips).toHaveText([/Усі/, /Здоров/i, /Навчанн/i]);
    await expect(page.locator('#categoryFilterRow .tag-filter-chip.selected')).toHaveText(/Усі/);
  });

  test('вибір категорії лишає в списку тільки її цілі', async ({ page }) => {
    await openGoals(page, two);
    await page.click('#categoryFilterRow .tag-filter-chip:has-text("Здоров")');
    await expect(page.locator('[data-open-goal="g1"]')).toBeVisible();
    await expect(page.locator('[data-open-goal="g2"]')).toHaveCount(0);
  });

  // Рядок із двох чипів, один з яких «Усі», нічого не фільтрує.
  test('одна категорія на вкладці — рядка немає взагалі', async ({ page }) => {
    await openGoals(page, [two[0]]);
    await expect(page.locator('#categoryFilterRow .tag-filter-chip')).toHaveCount(0);
  });

  test('фільтр категорії не ховає стани — вони лишаються групами', async ({ page }) => {
    await openGoals(page, [
      goal({ id: 'g1', title: 'Жива', category: 'health' }),
      goal({ id: 'g2', title: 'Закрита', category: 'health', status: 'done' }),
      goal({ id: 'g3', title: 'Інша сфера', category: 'learning' }),
    ]);
    await page.click('#categoryFilterRow .tag-filter-chip:has-text("Здоров")');
    await expect(page.locator('.goal-group-label')).toHaveText(['В роботі', 'Виконано']);
  });
});
