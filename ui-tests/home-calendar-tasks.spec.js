// Назви завдань у клітинці місяця на головній.
//
// Під числом стояла крапка — вона казала «на цей день щось є» і лишала все
// місце порожнім. У сітці місяця на широкому екрані місця під числом
// вистачає, тож там тепер стоїть назва: та сама ідея, що в календарі
// розділу завдань.
//
// У смузі днів на телефоні крапка лишилась: клітинка там завширшки з палець,
// і назві в ній немає де стати. Саме цю межу тут і стережемо — разом із тим,
// що довга назва не розсовує клітинку, а обрізається.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const iso = (shift = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};

// Дні беремо в межах цього ж місяця, інакше на межі місяця вони поїхали б у
// «хвіст сусіднього» й тесту довелось би гортати календар.
const dayInMonth = (n) => iso().slice(0, 8) + String(n).padStart(2, '0');
const D1 = dayInMonth(10);
const D2 = dayInMonth(11);

const SEED = {
  profile: { currency: 'PLN' },
  workouts: [],
  tasks: [
    { id: 'a', title: 'Ранкова пробіжка', dueDate: D1, dueTime: '07:30', done: false },
    { id: 'b', title: 'Прочитати 20 сторінок', dueDate: D1, done: false },
    { id: 'c', title: 'Зробити ще одне', dueDate: D1, done: false },
    { id: 'd', title: 'Футбол', dueDate: D2, done: true },
  ],
};

const openHub = (page, seed = SEED) =>
  openModule(page, 'index.html', { seed, ready: '#homeScreen' });

const cellOf = (page, date) => page.locator(`.cal-grid .cal-day[href$="#day=${date}"]`);

test.describe('Широкий екран: у клітинці стоїть назва', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('назва замість крапки, і саме та, що першою в списку дня', async ({ page }) => {
    await openHub(page);
    // Найраніше за часом і невиконане — воно й видно, коли рядок один.
    await expect(cellOf(page, D1).locator('.cal-chip')).toHaveText('Ранкова пробіжка');
    // Крапка лишається в розмітці — на низькому вікні вона повертається, —
    // але тут її не видно: два способи сказати те саме в одній клітинці.
    await expect(cellOf(page, D1).locator('.cal-dot')).toBeHidden();
  });

  test('решта дня чесно рахується в «+N»', async ({ page }) => {
    await openHub(page);
    await expect(cellOf(page, D1).locator('.cal-more')).toHaveText('+2');
    // Один пункт на день — рахувати нема чого.
    await expect(cellOf(page, D2).locator('.cal-more')).toHaveCount(0);
  });

  test('виконане видно, але приглушено й закреслено', async ({ page }) => {
    await openHub(page);
    const chip = cellOf(page, D2).locator('.cal-chip');
    await expect(chip).toHaveText('Футбол');
    await expect(chip).toHaveClass(/done/);
    expect(await chip.evaluate((el) => getComputedStyle(el).textDecorationLine))
      .toContain('line-through');
  });

  test('порожній день лишається порожнім — рядка «нічого» немає', async ({ page }) => {
    await openHub(page);
    await expect(cellOf(page, dayInMonth(20)).locator('.cal-chip')).toHaveCount(0);
    await expect(cellOf(page, dayInMonth(20)).locator('.cal-more')).toHaveCount(0);
  });

  // Найлегше зламати саме це: довга назва або розсуває стовпчик, або
  // витягує клітинку в стовпчик тексту.
  test('довга назва не розсуває клітинку і не тягне її вниз', async ({ page }) => {
    const long = 'Розписати власну торгову стратегію для її подальшого бектесту';
    await openHub(page, {
      ...SEED,
      tasks: [{ id: 'x', title: long, dueDate: D1, done: false }],
    });
    const chip = cellOf(page, D1).locator('.cal-chip');
    // Текст на місці цілком — обрізає його CSS, а не JS: інакше пошук по
    // сторінці й читалка бачили б обрубок.
    await expect(chip).toHaveText(long);
    const box = await chip.boundingBox();
    const cell = await cellOf(page, D1).boundingBox();
    expect(box.width).toBeLessThanOrEqual(cell.width);
    // Два рядки тексту — не більше: третій перетворив би сітку на абзаци.
    expect(box.height).toBeLessThan(32);
  });

  // Заливка була доречна, доки в клітинці стояло саме число. Тепер вона
  // з'їдала б назви разом із їхнім тлом, тож позначено ЧИСЛО.
  test('сьогодні позначене кружечком під числом, а не залитою клітинкою', async ({ page }) => {
    await openHub(page);
    const cell = cellOf(page, iso());
    await expect(cell).toHaveClass(/today/);
    const cellBg = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(cellBg).toBe('rgba(0, 0, 0, 0)');
    const num = await cell.locator('.cal-num').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, radius: cs.borderRadius };
    });
    expect(num.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(num.radius).toBe('50%');
  });
});

// Головна мусить триматись в один екран. Шість рядків із назвами додають
// по ~15px кожен, і на вікні 1366x640 сторінка вилазила за край рівно на
// смугу прокрутки — тому там назви поступаються місцем крапці.
test.describe('Низьке вікно: назви поступаються крапці', () => {
  test.use({ viewport: { width: 1366, height: 640 } });

  test('назв немає, крапка на місці, сторінка не гортається', async ({ page }) => {
    await openHub(page);
    await expect(cellOf(page, D1).locator('.cal-chip')).toBeHidden();
    await expect(cellOf(page, D1).locator('.cal-dot')).toBeVisible();
    const over = await page.evaluate(() =>
      document.documentElement.scrollHeight - window.innerHeight);
    expect(over).toBeLessThanOrEqual(0);
  });
});

test.describe('Телефон: під числом лишається крапка', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('назв у смузі немає — там для них немає місця', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('.cal-week .cal-chip')).toHaveCount(0);
    await expect(page.locator('.cal-week .cal-dot')).toHaveCount(
      await page.locator('.cal-week .cal-day').count());
  });
});
