// Календар на головній гортається.
//
// Він показував рівно один період — цей тиждень (на компʼютері цей місяць) —
// і подивитись, що там далі, було ніде. Тепер пальцем це свайп по самій
// сітці, мишею — дві стрілки, а тап по назві місяця вертає в сьогодні (той
// самий жест, що в календарі цілей і тренувань).
//
// Головне тут — що гортання НЕ підмінює сьогодні: якір, який вирішує, який
// період малювати, окремий від справжньої дати. Інакше в сусідньому тижні
// виділеним виявився б не той день, а плитки почали б рахувати чужий.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

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
const firstDay = (page) => page.locator('.cal-day .cal-num').first();
const todayCells = (page) => page.locator('.cal-day.today');

/** Свайп по сітці справжніми touch-подіями: Playwright уміє лише tap. */
async function swipe(page, dir) {
  const box = await page.locator('#calWeek').boundingBox();
  const y = box.y + box.height / 2;
  const from = dir === 'left' ? box.x + box.width - 30 : box.x + 30;
  const to = dir === 'left' ? box.x + 30 : box.x + box.width - 30;
  await page.evaluate(([x1, x2, yy]) => {
    const el = document.getElementById('calWeek');
    const t = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: yy });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(x1)], changedTouches: [t(x1)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(x2)], bubbles: true }));
  }, [from, to, y]);
}

test.describe('Телефон: тиждень гортається пальцем', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('свайп ліворуч показує наступний тиждень — рівно на сім днів далі', async ({ page }) => {
    await openHub(page);
    const before = await page.locator('.cal-day').first().getAttribute('href');
    await swipe(page, 'left');
    const after = await page.locator('.cal-day').first().getAttribute('href');
    const dayOf = (href) => href.split('#day=')[1];
    const diff = (new Date(dayOf(after)) - new Date(dayOf(before))) / 86400000;
    expect(diff, 'крок гортання — рівно тиждень, а не довільний зсув').toBe(7);
    // Тиждень лишається календарним: перший день — понеділок.
    expect(new Date(dayOf(after) + 'T00:00:00').getDay()).toBe(1);
  });

  test('свайп праворуч вертає назад — те саме, звідки прийшли', async ({ page }) => {
    await openHub(page);
    const start = await firstDay(page).textContent();
    await swipe(page, 'left');
    await swipe(page, 'right');
    await expect(firstDay(page)).toHaveText(start);
  });

  test('гортання не підмінює сьогодні — в чужому тижні виділяти нема чого', async ({ page }) => {
    await openHub(page);
    await expect(todayCells(page)).toHaveCount(1);
    await swipe(page, 'left');
    await expect(todayCells(page)).toHaveCount(0);
    // І день під датою лишається справжнім: рядок про сьогодні не змінився.
    await expect(page.locator('#todayLine')).toContainText(/сьогодні/i);
  });

  test('свайп по клітинці не відкриває розділ завдань', async ({ page }) => {
    await openHub(page);
    const url = page.url();
    await swipe(page, 'left');
    await page.waitForTimeout(150);
    expect(page.url(), 'жест — це гортання, а не тап по дню').toBe(url);
  });

  test('вертикальний рух лишається прокруткою сторінки, а не гортанням', async ({ page }) => {
    await openHub(page);
    const start = await firstDay(page).textContent();
    const box = await page.locator('#calWeek').boundingBox();
    await page.evaluate(([x, y1, y2]) => {
      const el = document.getElementById('calWeek');
      const t = (yy) => new Touch({ identifier: 1, target: el, clientX: x, clientY: yy });
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(y1)], changedTouches: [t(y1)], bubbles: true }));
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(y2)], bubbles: true }));
    }, [box.x + box.width / 2, box.y + 5, box.y + 120]);
    await expect(firstDay(page)).toHaveText(start);
  });
});

test.describe('Стрілки й назва місяця', () => {
  test.use({ viewport: PHONE });

  test('стрілки гортають тиждень і без пальця', async ({ page }) => {
    await openHub(page);
    const start = await firstDay(page).textContent();
    await page.click('#calNext');
    await expect(firstDay(page)).not.toHaveText(start);
    await page.click('#calPrev');
    await expect(firstDay(page)).toHaveText(start);
  });

  test('назва місяця вертає в сьогодні', async ({ page }) => {
    await openHub(page);
    await expect(label(page)).toHaveClass(/current/);
    await page.click('#calNext');
    await page.click('#calNext');
    await expect(label(page)).not.toHaveClass(/current/);
    await page.click('#calMonth');
    await expect(label(page)).toHaveClass(/current/);
    await expect(todayCells(page)).toHaveCount(1);
  });

  test('підпис іде за тим, що намальовано, а не стоїть на сьогодні', async ({ page }) => {
    await openHub(page);
    const start = await label(page).textContent();
    // Півроку вперед — місяць точно інший, хай коли б тест не запустили.
    for (let i = 0; i < 26; i++) await page.click('#calNext');
    await expect(label(page)).not.toHaveText(start);
  });
});

test.describe('Компʼютер: крок — місяць', () => {
  test.use({ viewport: DESKTOP });

  test('стрілка гортає цілий місяць, а не тиждень', async ({ page }) => {
    await openHub(page);
    const start = await label(page).textContent();
    await page.click('#calNext');
    await expect(label(page)).not.toHaveText(start);
    // Місяць повними тижнями: сітка лишається кратною семи.
    const count = await page.locator('.cal-day').count();
    expect(count % 7).toBe(0);
    await page.click('#calMonth');
    await expect(label(page)).toHaveText(start);
  });
});

test.describe('Завдання для погортаного періоду', () => {
  test.use({ viewport: PHONE });

  const tasksReads = (page) => page.evaluate(() =>
    window.__fbCalls.get.filter((c) => c.col === 'tasks').length);

  test('гортання за межі прочитаного дочитує завдання з бази', async ({ page }) => {
    // Без цього крапки в сусідніх тижнях взялися б нізвідки: день із трьома
    // справами виглядав би порожнім, тобто сторінка тихо брехала б.
    await openHub(page);
    await expect.poll(() => tasksReads(page)).toBe(1);
    for (let i = 0; i < 8; i++) await page.click('#calNext');
    await expect.poll(() => tasksReads(page), { timeout: 5000 }).toBeGreaterThan(1);

    const last = await page.evaluate(() => {
      const reads = window.__fbCalls.get.filter((c) => c.col === 'tasks');
      return reads[reads.length - 1].where;
    });
    // Запит саме по діапазону дат, а не «прочитати все».
    expect(last.map((w) => [w[0], w[1]])).toEqual([['dueDate', '>='], ['dueDate', '<=']]);
  });

  test('гортання туди-сюди не перечитує вже прочитане', async ({ page }) => {
    await openHub(page);
    for (let i = 0; i < 8; i++) await page.click('#calNext');
    await expect.poll(() => tasksReads(page), { timeout: 5000 }).toBeGreaterThan(1);
    const after = await tasksReads(page);
    for (let i = 0; i < 8; i++) await page.click('#calPrev');
    await page.waitForTimeout(300);
    expect(await tasksReads(page), 'назад — уже прочитане, звертатись до бази нема за чим').toBe(after);
  });
});
