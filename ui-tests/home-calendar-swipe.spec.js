// Календар на головній гортається — по днях, а не стрибками через тиждень.
//
// Спершу він показував рівно один період і не гортався зовсім. Потім свайп
// перекидав цілий тиждень — і спинитись на потрібному дні було ніде. Тепер
// смуга днів гортається БРАУЗЕРНОЮ прокруткою зі snap на день: короткий рух
// дає день-два, довгий — тиждень і далі. Своя інерція тут не писалась би
// краще за системну.
//
// Календарний тиждень пн—нд лишився початковим станом, а не рамкою: перший
// видимий день може бути будь-яким, і кожна клітинка підписана своїм днем
// тижня, тож смуга чесна, з чого б не починалась.
//
// Головне, що тут перевіряється: гортання НЕ підмінює сьогодні. Якір, який
// вирішує, що малювати, окремий від справжньої дати.
const { test, expect } = require('@playwright/test');
const { openModule, calendarFrame } = require('./helpers');

const iso = (shift = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};

const SEED = {
  profile: { currency: 'PLN' },
  tasks: [{ id: 't1', title: 'Сьогодні', dueDate: iso(), done: false }],
  workouts: [],
};

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

async function openHub(page, seed = SEED) {
  await openModule(page, 'index.html', { seed, ready: '#homeScreen' });
}

const label = (page) => page.locator('#calMonth');
const todayCells = (page) => page.locator('.cal-day.today');

/** Дати семи днів, що зараз у кадрі. */
const visible = async (page) => (await calendarFrame(page)).days;

/** Гортання на n днів — саме прокруткою, як пальцем. */
async function scrollDays(page, n) {
  await page.evaluate((count) => {
    const el = document.getElementById('calWeek');
    const step = el.children[1].offsetLeft - el.children[0].offsetLeft;
    el.scrollLeft += count * step;
  }, n);
  // Позиція читається після зупинки (таймер спокою в home.js — 120мс).
  await page.waitForTimeout(260);
}

const dayDiff = (a, b) => (new Date(a) - new Date(b)) / 86400000;

test.describe('Телефон: смуга гортається по днях', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('крок гортання — один день, а не цілий тиждень', async ({ page }) => {
    await openHub(page);
    const before = await visible(page);
    await scrollDays(page, 1);
    const after = await visible(page);
    expect(dayDiff(after[0], before[0]), 'смуга мала поїхати рівно на день').toBe(1);
  });

  test('у кадрі сім днів поспіль, з якого б дня смуга не починалась', async ({ page }) => {
    await openHub(page);
    await scrollDays(page, 3);
    const days = await visible(page);
    expect(days).toHaveLength(7);
    days.forEach((d, i) => { if (i) expect(dayDiff(d, days[i - 1])).toBe(1); });
  });

  test('кожен день підписаний СВОЇМ днем тижня — смуга не бреше', async ({ page }) => {
    // Це те, що дозволяє смузі починатись не з понеділка: підпис їде разом
    // із числом, а не стоїть шапкою над стовпчиком.
    await openHub(page);
    await scrollDays(page, 2);
    const pairs = await page.evaluate(() => {
      const el = document.getElementById('calWeek');
      const cells = Array.from(el.children);
      const step = cells[1].offsetLeft - cells[0].offsetLeft;
      const i = Math.round(el.scrollLeft / step);
      return cells.slice(i, i + 7).map((c) => [
        c.getAttribute('href').split('#day=')[1],
        c.querySelector('.cal-dow').textContent.trim(),
      ]);
    });
    const short = new Intl.DateTimeFormat('uk-UA', { weekday: 'short' });
    pairs.forEach(([date, dow]) => {
      expect(dow).toBe(short.format(new Date(date + 'T00:00:00')));
    });
  });

  test('гортання не підмінює сьогодні', async ({ page }) => {
    await openHub(page);
    await expect(todayCells(page)).toHaveCount(1);
    await scrollDays(page, 10);
    // Сьогодні поїхало за кадр — виділяти в ньому нема чого. Але сама дата
    // лишилась справжньою: рядок під датою про неї не змінився.
    expect((await visible(page)).includes(iso())).toBe(false);
    await expect(page.locator('#todayLine')).toContainText(/сьогодні/i);
  });

  test('назад — те саме, звідки прийшли', async ({ page }) => {
    await openHub(page);
    const start = await visible(page);
    await scrollDays(page, 5);
    await scrollDays(page, -5);
    expect(await visible(page)).toEqual(start);
  });

  test('гортати можна далі, ніж намальовано: вікно пересувається саме', async ({ page }) => {
    // Смуга кінцева (запас у обидва боки), і без пересування вікна гортання
    // впиралось би в стіну за три тижні.
    await openHub(page);
    const start = await visible(page);
    await scrollDays(page, 20);
    expect(dayDiff((await visible(page))[0], start[0])).toBe(20);
    // Вікно пересунули, тож попереду знову є куди гортати — і так скільки
    // завгодно разів.
    await scrollDays(page, 20);
    expect(dayDiff((await visible(page))[0], start[0])).toBe(40);
    await scrollDays(page, -20);
    expect(dayDiff((await visible(page))[0], start[0])).toBe(20);
  });

  test('клік по дню після гортання не спрацьовує як тап', async ({ page }) => {
    await openHub(page);
    const url = page.url();
    await page.evaluate(() => {
      const el = document.getElementById('calWeek');
      const step = el.children[1].offsetLeft - el.children[0].offsetLeft;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      el.scrollLeft += step * 2;
      el.children[25].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(200);
    expect(page.url(), 'гортання — це гортання, а не тап по дню').toBe(url);
  });
});

test.describe('Стрілки й назва місяця', () => {
  test.use({ viewport: PHONE });

  test('стрілок тут немає — жест і так під рукою', async ({ page }) => {
    // Два значки в шапці лише повторювали б те, що вже робить палець. На
    // компʼютері вони лишаються: там намальовано місяць, і свайпнути мишею
    // нічим (див. describe нижче).
    await openHub(page);
    await expect(page.locator('#calNext')).toBeHidden();
    await expect(page.locator('#calPrev')).toBeHidden();
  });

  test('назва місяця вертає в сьогоднішній тиждень', async ({ page }) => {
    await openHub(page);
    const start = await visible(page);
    await expect(label(page)).toHaveClass(/current/);
    await scrollDays(page, 4);
    await expect(label(page)).not.toHaveClass(/current/);
    await page.click('#calMonth');
    await page.waitForTimeout(200);
    expect(await visible(page)).toEqual(start);
    await expect(label(page)).toHaveClass(/current/);
    await expect(todayCells(page)).toHaveCount(1);
  });

  const monthOf = (isoDate) =>
    new Intl.DateTimeFormat('uk-UA', { month: 'long' }).format(new Date(isoDate + 'T00:00:00'));

  test('поки сьогодні в кадрі, підпис — місяць СЬОГОДНІ', async ({ page }) => {
    // Підпис відповідає на «який зараз місяць». 31 серпня — це ще серпень,
    // хай навіть у смузі стоять шість вересневих чисел (окремо перевірено
    // на підмінному годиннику в home-fill.spec.js).
    await openHub(page);
    await expect(label(page)).toHaveText(new RegExp(monthOf(iso()), 'i'));
    // Один день гортання — сьогодні ще в кадрі, підпис не міняється.
    await scrollDays(page, 1);
    expect((await visible(page)).includes(iso())).toBe(true);
    await expect(label(page)).toHaveText(new RegExp(monthOf(iso()), 'i'));
  });

  test('коли сьогодні за кадром, підпис — місяць СЕРЕДИНИ кадру', async ({ page }) => {
    // Питання змінилось: тепер воно про те, що видно. Край однаково бреше —
    // у смузі 31 серпня — 6 вересня шість днів вересневі.
    await openHub(page);
    await scrollDays(page, 20);
    const days = await visible(page);
    expect(days.includes(iso())).toBe(false);
    await expect(label(page)).toHaveText(new RegExp(monthOf(days[3]), 'i'));
  });

  test('рік дописується, лише коли він не цей', async ({ page }) => {
    await openHub(page);
    await expect(label(page)).not.toHaveText(/\d{4}/);
    // Один жест не перестрибує через запас смуги, тож догортуємо частинами —
    // рівно так, як це робить рука.
    for (let i = 0; i < 20 && !/\d{4}/.test(await label(page).textContent()); i++) {
      await scrollDays(page, 20);
    }
    await expect(label(page)).toHaveText(/\d{4}/);
  });
});

test.describe('Компʼютер: намальовано місяць — крок місяць', () => {
  test.use({ viewport: DESKTOP });

  test('стрілка гортає цілий місяць', async ({ page }) => {
    await openHub(page);
    await expect(page.locator('#calNext')).toBeVisible();
    const start = await label(page).textContent();
    await page.click('#calNext');
    await expect(label(page)).not.toHaveText(start);
    // Місяць повними тижнями: сітка лишається кратною семи.
    expect(await page.locator('.cal-day').count() % 7).toBe(0);
    await page.click('#calMonth');
    await expect(label(page)).toHaveText(start);
  });
});

test.describe('Завдання для погортаного періоду', () => {
  test.use({ viewport: PHONE });

  const tasksReads = (page) => page.evaluate(() =>
    window.__fbCalls.get.filter((c) => c.col === 'tasks').length);

  test('гортання за межі прочитаного дочитує завдання з бази', async ({ page }) => {
    // Без цього крапки в далеких днях узялися б нізвідки: день із трьома
    // справами виглядав би порожнім, тобто сторінка тихо брехала б.
    await openHub(page);
    // Перше читання одразу покриває запас смуги — окремого запиту на нього
    // немає, інакше перший же рух пальцем показував би дні без крапок.
    await expect.poll(() => tasksReads(page)).toBe(1);
    await scrollDays(page, 25);
    await scrollDays(page, 25);
    await expect.poll(() => tasksReads(page), { timeout: 5000 }).toBeGreaterThan(1);

    const last = await page.evaluate(() => {
      const reads = window.__fbCalls.get.filter((c) => c.col === 'tasks');
      return reads[reads.length - 1].where;
    });
    // Запит саме по діапазону дат, а не «прочитати все».
    expect(last.map((w) => [w[0], w[1]])).toEqual([['dueDate', '>='], ['dueDate', '<=']]);
  });

  test('дорога назад до бази вже не звертається', async ({ page }) => {
    await openHub(page);
    await scrollDays(page, 25);
    await scrollDays(page, 25);
    await expect.poll(() => tasksReads(page), { timeout: 5000 }).toBeGreaterThan(1);
    const after = await tasksReads(page);
    await scrollDays(page, -25);
    await scrollDays(page, -25);
    await page.waitForTimeout(300);
    expect(await tasksReads(page), 'назад — уже прочитане').toBe(after);
  });
});
