// Що буде видно, коли Firebase SDK не доїде з gstatic.
//
// Раніше відповідь була «нічого»: спінер крутився вічно, бо власний таймер
// сторінки лежить у тому ж файлі, що й firebase.initializeApp(), і після
// винятку на першому рядку просто не реєструвався. Тут перевіряємо, що
// людина бачить повідомлення й кнопку, а не білий екран.
const { test, expect } = require('@playwright/test');

const PAGES = [
  ['домашній хаб', 'index.html'],
  ['бюджет', 'budget/index.html'],
  ['цілі', 'goals/index.html'],
  ['завдання', 'tasks/index.html'],
  ['тренування', 'workout/index.html'],
];

/** Відкриває сторінку так, ніби gstatic недоступний. */
async function openWithoutSdk(page, modulePath, lang) {
  await page.route('**/firebasejs/**', (route) => route.abort());
  await page.route('**/cdnjs.cloudflare.com/**', (route) => route.fulfill({ status: 200, body: '' }));
  await page.route('**/fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (lang) {
    await page.addInitScript((l) => {
      try { localStorage.setItem('financeAppLang', l); } catch (err) { /* приватний режим */ }
    }, lang);
  }
  await page.goto(`/${modulePath}`);
}

for (const [name, modulePath] of PAGES) {
  test(`${name}: без SDK показує помилку замість вічного спінера`, async ({ page }) => {
    await openWithoutSdk(page, modulePath);

    await expect(page.locator('#bootError')).toBeVisible();
    await expect(page.locator('#bootError .auth-title')).toHaveText('Не вдалося завантажити');
    await expect(page.locator('#bootRetryBtn')).toBeVisible();
    // Спінер саме зникає, а не ховається під повідомленням.
    await expect(page.locator('#authLoading .spinner')).toHaveCount(0);
    // Екран помилки має бути доступним для читалок — на відміну від
    // декоративного спінера, який лишався aria-hidden.
    await expect(page.locator('#authLoading')).toHaveAttribute('aria-hidden', 'false');
  });
}

test('повідомлення йде мовою, вибраною в застосунку', async ({ page }) => {
  await openWithoutSdk(page, 'index.html', 'en');
  await expect(page.locator('#bootError .auth-title')).toHaveText('Could not load');
  await expect(page.locator('#bootRetryBtn')).toHaveText('Try again');
});

test('кнопка справді перезавантажує сторінку', async ({ page }) => {
  let loads = 0;
  page.on('load', () => { loads += 1; });
  await openWithoutSdk(page, 'index.html');
  await expect(page.locator('#bootRetryBtn')).toBeVisible();

  const before = loads;
  await page.click('#bootRetryBtn');
  await expect.poll(() => loads).toBeGreaterThan(before);
  // Мережа все ще лежить — після перезавантаження знову те саме повідомлення.
  await expect(page.locator('#bootError')).toBeVisible();
});

test('коли SDK на місці — запобіжник мовчить', async ({ page }) => {
  const { openModule } = require('./helpers');
  await openModule(page, 'index.html', { ready: '#homeScreen' });
  await expect(page.locator('#bootError')).toHaveCount(0);
  await expect(page.locator('#authLoading')).toBeHidden();
});
