// Заставка: перевіряємо не «гарно чи ні», а те, від чого залежить, чи
// відкриється застосунок узагалі — що вона гарантовано йде з екрана, не
// повторюється щопереходу й не заважає працювати.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const SPLASH = '#lifeSplash';

// helpers за замовчуванням вимикають заставку; splash:true вмикає її назад,
// щоб побачити те саме, що бачить людина при відкритті застосунку.
async function openFresh(page, path, opts = {}) {
  await openModule(page, path, Object.assign({ seed: {}, splash: true }, opts));
}

test('заставка зʼявляється при відкритті застосунку', async ({ page }) => {
  await openFresh(page, 'index.html', { ready: '#homeScreen' });
  await expect(page.locator(SPLASH)).toBeVisible();
  // Знак малюється тими самими шляхами, що й у шапці.
  await expect(page.locator(SPLASH + ' svg')).toHaveAttribute('aria-label', 'Life');
});

test('заставка сама йде з екрана й зникає з розмітки', async ({ page }) => {
  await openFresh(page, 'index.html', { ready: '#homeScreen' });
  await expect(page.locator(SPLASH)).toBeVisible();
  await expect(page.locator(SPLASH)).toHaveCount(0, { timeout: 6000 });
});

test('тап знімає заставку одразу, не чекаючи кінця', async ({ page }) => {
  await openFresh(page, 'index.html', { ready: '#homeScreen' });
  await expect(page.locator(SPLASH)).toBeVisible();
  const t0 = Date.now();
  await page.locator(SPLASH).click();
  await expect(page.locator(SPLASH)).toHaveCount(0, { timeout: 2000 });
  // Повна анімація триває ~1,9 с; тап має вкластися помітно швидше.
  expect(Date.now() - t0).toBeLessThan(1200);
});

test('за сеанс заставка показується один раз, а не на кожному розділі', async ({ page }) => {
  await openFresh(page, 'index.html', { ready: '#homeScreen' });
  await expect(page.locator(SPLASH)).toHaveCount(0, { timeout: 6000 });
  // Перехід у розділ — це повне перезавантаження сторінки.
  await openModule(page, 'budget/index.html', { seed: {} });
  await page.waitForTimeout(300);
  await expect(page.locator(SPLASH)).toHaveCount(0);
});

test('заставка є на всіх пʼятьох сторінках', async ({ page }) => {
  for (const [path, ready] of [['index.html', '#homeScreen'], ['budget/index.html', '#appScreen'],
    ['goals/index.html', '#appScreen'], ['tasks/index.html', '#appScreen'],
    ['workout/index.html', '#appScreen']]) {
    await openFresh(page, path, { ready });
    await expect(page.locator(SPLASH), path).toBeVisible();
    await page.locator(SPLASH).click();
    await expect(page.locator(SPLASH), path).toHaveCount(0, { timeout: 2000 });
  }
});

test('після заставки застосунок повністю робочий', async ({ page }) => {
  await openFresh(page, 'index.html', { ready: '#homeScreen' });
  await expect(page.locator(SPLASH)).toHaveCount(0, { timeout: 6000 });
  // Найпростіша перевірка, що екран знову приймає натискання: гортаємо
  // календар і дивимось, що місяць справді змінився.
  const month = await page.textContent('#calMonth');
  await page.click('#calNext');
  await expect(page.locator('#calMonth')).not.toHaveText(month);
});

test('коли система просить менше руху — знак без креслення', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFresh(page, 'index.html', { ready: '#homeScreen' });
  const box = page.locator(SPLASH);
  await expect(box).toHaveClass(/calm/);
  // Лінії намальовані одразу, а не тягнуться.
  const offset = await page.locator(SPLASH + ' path').first()
    .evaluate((el) => getComputedStyle(el).strokeDashoffset);
  expect(offset).toBe('0px');
  await expect(box).toHaveCount(0, { timeout: 4000 });
});
