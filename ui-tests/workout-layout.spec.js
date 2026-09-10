// Нова розкладка вкладки «Тренування»: наступне тренування згори на всю
// ширину, під ним журнал зліва й календар-міточки справа.
//
// Було: стрічка однакових карток («6 вправ · 19 підходів» на кожній), над
// нею календар на пів вікна, у плані навпроти кожної вправи «—», і права
// половина екрана порожня.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const ex = (libId, name, muscle, sets) => ({ id: libId, libId, name, muscle, sets });
const plan = (libId, name, muscle, n) => ex(libId, name, muscle, Array.from({ length: n }, () => ({ weight: 0, reps: 0 })));

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shift = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

// Один план назавтра і три зроблені тренування позаду.
const SEED = {
  workouts: [
    { id: 'plan', date: shift(1), name: 'Fullbody ВТ', notes: '', exercises: [
      plan('benchPress', 'Жим лежачи', 'chest', 4),
      plan('squat', 'Присідання', 'legs', 3),
      plan('pullUp', 'Підтягування', 'back', 3),
    ] },
    { id: 'a', date: shift(-2), name: 'Fullbody СБ', notes: '', exercises: [
      ex('benchPress', 'Жим лежачи', 'chest', [{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }]),
      ex('squat', 'Присідання', 'legs', [{ weight: 80, reps: 6 }]),
    ] },
    { id: 'b', date: shift(-5), name: 'Fullbody ЧТ', notes: '', exercises: [
      ex('benchPress', 'Жим лежачи', 'chest', [{ weight: 57.5, reps: 8 }]),
    ] },
    { id: 'c', date: shift(-9), name: 'Ноги', notes: '', exercises: [
      ex('squat', 'Присідання', 'legs', [{ weight: 75, reps: 8 }]),
    ] },
  ],
};

const wide = async (page) => page.setViewportSize({ width: 1280, height: 900 });

test.describe('Наступне тренування згори', () => {
  test('відкривається блоком плану, а не списком зробленого', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await expect(page.locator('.next-card .next-name')).toHaveText('Fullbody ВТ');
    // Блок стоїть ПЕРЕД журналом — саме він відповідає на «що мені робити».
    const order = await page.locator('#sessionsTab').evaluate((root) => {
      const next = root.querySelector('.next-card');
      const past = root.querySelector('.past-card');
      return next.compareDocumentPosition(past) & Node.DOCUMENT_POSITION_FOLLOWING ? 'план вище' : 'журнал вище';
    });
    expect(order).toBe('план вище');
  });

  test('навпроти кожної вправи стоїть вага минулого разу, а не «—»', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    const cells = await page.locator('.next-td.last').allTextContents();
    // Жим 60×8 два дні тому, присідання 80×6 — і підтягувань не було ніколи.
    expect(cells).toEqual(['60×8', '80×6', 'уперше']);
  });

  test('показує групи мʼязів і кількість підходів', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await expect(page.locator('.next-card .muscle-chip')).toHaveText(['Груди', 'Ноги', 'Спина']);
    expect(await page.locator('.next-td.num').allTextContents()).toEqual(['4', '3', '3']);
  });

  test('«завтра» пишеться словом, і поруч — сама дата', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    const when = await page.textContent('.next-when');
    expect(when).toContain('Завтра');
    expect(when).toContain('·');
  });

  test('«Почати» відкриває саме цей план, а не порожню форму', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await page.click('.next-start');
    await page.waitForSelector('#sessionFormOverlay.show');
    expect(await page.inputValue('#sessionNameInput')).toBe('Fullbody ВТ');
    expect(await page.inputValue('#sessionDateInput')).toBe(shift(1));
  });

  // Кнопка лежить усередині картки, і обидві відкривають форму. Без
  // stopPropagation вона відкривалась би двічі поспіль.
  test('один тап по «Почати» — одне відкриття форми', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await page.click('.next-start');
    await expect(page.locator('#sessionFormOverlay.show')).toHaveCount(1);
    await page.click('#closeSessionForm');
    await expect(page.locator('#sessionFormOverlay.show')).toHaveCount(0);
  });

  test('зроблене сьогодні наступним не стає', async ({ page }) => {
    const seed = { workouts: [
      { id: 'done', date: iso(new Date()), name: 'Сьогоднішнє', notes: '',
        exercises: [ex('squat', 'Присідання', 'legs', [{ weight: 80, reps: 8 }])] },
    ] };
    await openModule(page, 'workout/index.html', { seed });
    await expect(page.locator('.next-card')).toHaveCount(0);
    await expect(page.locator('.next-empty')).toHaveCount(1);
    await expect(page.locator('.past-card')).toHaveCount(1);
  });

  test('без плану пропонує його завести', async ({ page }) => {
    const seed = { workouts: [SEED.workouts[1]] };
    await openModule(page, 'workout/index.html', { seed });
    await page.click('#planSessionBtn');
    await page.waitForSelector('#sessionFormOverlay.show');
    expect(await page.inputValue('#sessionNameInput')).toBe('');
  });

  // План, до якого не дійшли руки, нікуди не подівся — ховати його мовчки
  // було б гірше, ніж показати з датою.
  test('прострочений план не зникає, а каже, що прострочений', async ({ page }) => {
    const seed = { workouts: [
      { id: 'old', date: shift(-3), name: 'Забутий', notes: '', exercises: [plan('squat', 'Присідання', 'legs', 3)] },
    ] };
    await openModule(page, 'workout/index.html', { seed });
    await expect(page.locator('.next-name')).toHaveText('Забутий');
    await expect(page.locator('.next-when')).toContainText('Було заплановано');
  });
});

test.describe('Журнал зліва', () => {
  test('у журналі лише зроблене — плану там немає', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await expect(page.locator('.past-card')).toHaveCount(3);
    await expect(page.locator('.past-name')).toHaveText(['Fullbody СБ', 'Fullbody ЧТ', 'Ноги']);
  });

  test('чип приросту стоїть там, де вага виросла', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    // Два дні тому жим виріс 57,5 → 60 (+2,5), присідання 75 → 80 (+5).
    // На чипі — більший приріст: він і є новина.
    await expect(page.locator('.past-card').nth(0).locator('.gain-chip')).toContainText('+5 кг');
    await expect(page.locator('.past-card').nth(0).locator('.gain-chip')).toContainText('Присідання');
    // У найстарішого порівнювати нема з чим — чипа немає.
    await expect(page.locator('.past-card').nth(2).locator('.gain-chip')).toHaveCount(0);
  });

  test('дата пишеться словами в називному відмінку', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    const meta = await page.locator('.past-meta').first().textContent();
    // ICU на «weekday + day + month» разом уміє віддати знахідний
    // («суботу, 5 вересня») — у підписі це помилка.
    //
    // У переліку лише ті дні, у яких знахідний ВІДРІЗНЯЄТЬСЯ від називного,
    // тобто жіночого роду. Чоловічі — понеділок, вівторок, четвер — в обох
    // відмінках однакові, і ловити їх тут нема сенсу: раніше в переліку
    // стояв «вівторок», і тест падав щоразу, коли дата припадала на вівторок,
    // хоча підпис був правильний.
    expect(meta).not.toMatch(/середу|п.ятницю|суботу|неділю/);
  });

  test('довгий журнал згортається, і «весь журнал» його розгортає', async ({ page }) => {
    const many = { workouts: Array.from({ length: 8 }, (_, i) => ({
      id: 'm' + i, date: shift(-(i + 1)), name: 'Тренування ' + i, notes: '',
      exercises: [ex('squat', 'Присідання', 'legs', [{ weight: 80, reps: 5 }])],
    })) };
    await openModule(page, 'workout/index.html', { seed: many });
    await expect(page.locator('.past-card')).toHaveCount(5);
    await page.click('#pastToggleBtn');
    await expect(page.locator('.past-card')).toHaveCount(8);
    await page.click('#pastToggleBtn');
    await expect(page.locator('.past-card')).toHaveCount(5);
  });

  test('коротким журналом ніхто не гортає — кнопки немає', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await expect(page.locator('#pastToggleBtn')).toHaveCount(0);
  });
});

test.describe('Календар справа — самі міточки', () => {
  test('зроблене й заплановане позначені по-різному', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    const planned = page.locator(`[data-cal-day="${shift(1)}"] .wcal-dot`);
    const done = page.locator(`[data-cal-day="${shift(-2)}"] .wcal-dot`);
    await expect(planned).toHaveClass(/planned/);
    await expect(done).not.toHaveClass(/planned/);
  });

  test('у клітинках немає ні назв, ні цифр тренування', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await expect(page.locator('.wcal-grid')).not.toContainText('Fullbody');
    await expect(page.locator('.wcal-grid')).not.toContainText('підход');
  });

  test('легенда пояснює обидві крапки', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    await expect(page.locator('.wcal-legend')).toContainText('було');
    await expect(page.locator('.wcal-legend')).toContainText('заплановано');
  });

  test('назва місяця без «р.», поки рік цей', async ({ page }) => {
    await openModule(page, 'workout/index.html', { seed: SEED });
    expect(await page.textContent('#wcalTitle')).not.toContain('р.');
    // А в іншому році рік таки дописується — інакше не зрозуміти, де ти.
    await page.click('[data-cal-shift="-1"]');
    for (let i = 0; i < 12; i++) await page.click('[data-cal-shift="-1"]');
    expect(await page.textContent('#wcalTitle')).toMatch(/\d{4}/);
  });
});

test.describe('Розкладка', () => {
  test('на компʼютері журнал і календар стоять поруч', async ({ page }) => {
    await wide(page);
    await openModule(page, 'workout/index.html', { seed: SEED });
    const past = await page.locator('.past-card').first().boundingBox();
    const cal = await page.locator('.wcal').boundingBox();
    expect(cal.x, 'календар праворуч від журналу').toBeGreaterThan(past.x + past.width - 1);
    // Календар стає врівень із підписом «Минулі тренування», тобто трохи
    // вище за першу картку — але це та сама смуга, а не наступна.
    expect(cal.y).toBeLessThanOrEqual(past.y);
    expect(past.y - cal.y, 'і в тій самій смузі').toBeLessThan(60);
  });

  test('наступне тренування займає всю ширину над ними', async ({ page }) => {
    await wide(page);
    await openModule(page, 'workout/index.html', { seed: SEED });
    const next = await page.locator('.next-card').boundingBox();
    const cal = await page.locator('.wcal').boundingBox();
    expect(next.width, 'ширший за колонку журналу').toBeGreaterThan(cal.width * 2);
    expect(next.y + next.height, 'і стоїть над обома').toBeLessThanOrEqual(cal.y + 1);
  });

  test('на телефоні все одне під одним, і сторінка не їде вбік', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openModule(page, 'workout/index.html', { seed: SEED });
    const past = await page.locator('.past-card').first().boundingBox();
    const cal = await page.locator('.wcal').boundingBox();
    expect(cal.y, 'календар під журналом').toBeGreaterThan(past.y);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
