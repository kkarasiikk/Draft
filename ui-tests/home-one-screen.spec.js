// Головна тримається в одному екрані.
//
// Це вже робила широка розкладка, а телефонна — ні: сторінка гойдалась
// угору-вниз від будь-якої дрібниці. Найчастіше її розганяв підпис плитки
// цілей: там стоїть назва, написана людиною, і на трьох рядках плитка тягла
// за собою всю сторінку.
//
// Тому тут дві перевірки, і обидві на РЕЗУЛЬТАТІ, а не на CSS: чи вміщається
// сторінка й чи справді обрізаний довгий підпис. Правило `-webkit-line-clamp`
// можна поставити й помилитись у решті — висота покаже правду.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const iso = () => new Date().toISOString().slice(0, 10);

// Дев'ять справ на сьогодні й довга назва цілі — те, з чим сторінка й
// перестала вміщатись.
const NAMES = ['Відкрити угоду', 'Зробити аналіз торгового тижня, записати висновки',
  'Приділити час для роботи над проєктом', 'Провести 30 хвилин на самоті. З блокнотом',
  'Пʼяте', 'Шосте', 'Сьоме', 'Восьме', 'Девʼяте'];

const LONG_GOAL = 'Зробити донат на допомогу діткам та тваринкам, і робити це щомісяця без пропусків';

const SEED = {
  profile: {},
  goals: [{
    id: 'g1', title: LONG_GOAL, status: 'active', category: 'other',
    horizon: 'month', month: iso().slice(0, 7), milestones: [], checkins: [], journal: [],
  }],
  tasks: NAMES.map((title, i) => ({
    id: 't' + i, title, dueDate: iso(), done: false, subtasks: [], tags: [],
  })),
};

const open = (page) => openModule(page, 'index.html', { seed: SEED, ready: '#homeScreen' });

// 664 — компактний телефон, на якому сторінка й вилазила за край на півтори
// сотні пікселів. 844 — звичайний: там вона вміщалась і має вміщатись далі.
for (const [w, h, name] of [[390, 664, 'компактний телефон'], [390, 844, 'звичайний телефон']]) {
  test(`${name}: сторінка не гортається`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const m = await page.evaluate(() => ({
      doc: document.documentElement.scrollHeight,
      vp: window.innerHeight,
    }));
    expect(m.doc).toBeLessThanOrEqual(m.vp);
  });

  test(`${name}: плитки видно цілком, не за краєм екрана`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const fits = await page.evaluate(() =>
      document.querySelector('.sections').getBoundingClientRect().bottom <= window.innerHeight);
    expect(fits).toBe(true);
  });
}

test('довгий підпис плитки обрізається, а не розганяє її', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const cap = await page.locator('#goalsSub').evaluate((el) => ({
    видима: Math.round(el.getBoundingClientRect().height),
    повна: el.scrollHeight,
    рядок: parseFloat(getComputedStyle(el).lineHeight),
    текст: el.textContent,
  }));
  // Текст справді довший за два рядки — інакше перевірка нічого не варта.
  expect(cap.повна).toBeGreaterThan(cap.видима);
  expect(cap.видима).toBeLessThanOrEqual(Math.ceil(cap.рядок * 2) + 2);
  // Обрізаємо показ, а не самі дані: у розділі текст має лишитись цілим.
  expect(cap.текст).toBe(LONG_GOAL);
});

test('обрізаний підпис веде в розділ — прочитати ціле є де', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  // Плитка — посилання цілком, тож тап по самому обрізаному тексту (у тому
  // числі по трьох крапках) відкриває розділ, а не нікуди.
  await expect(page.locator('#goalsCard')).toHaveAttribute('href', 'goals/index.html');
  await page.locator('#goalsSub').click();
  await expect(page).toHaveURL(/goals\/index\.html$/);
});

test('«ще N у завданнях» лишається видним, коли список гортається всередині', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await open(page);
  const more = page.locator('.today-more');
  await expect(more).toBeVisible();
  // Поза списком: усередині нього рядок поїхав би з очей разом зі справами.
  const inside = await page.evaluate(() =>
    document.getElementById('todayList').contains(document.querySelector('.today-more')));
  expect(inside).toBe(false);
  const seen = await more.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  });
  expect(seen).toBe(true);
});
