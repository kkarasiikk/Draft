// Екран входу головної сторінки.
//
// Він був однією сірою карткою посеред білого — знак, заголовок і поля в
// одному стовпчику, однаково на телефоні й на комп'ютері, де половина вікна
// лишалась порожньою. Тепер на широкому екрані це дві половини: зліва знак
// і рядок, справа сам вхід; на телефоні — той самий один стовпчик.
//
// Стережеться передусім те, що легко зламати наосліп: порядок половин
// (знак саме ЗЛІВА), відсутність картки, тло з теми сторінки, а не білим
// навпростець, і рядок мов — єдине місце, де мову можна змінити ДО входу.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const openAuth = (page, opts = {}) =>
  openModule(page, 'index.html', { ready: '#authScreen', noUser: true, ...opts });

test.describe('Широкий екран: дві половини', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('знак зліва, вхід справа — і вони на одній висоті', async ({ page }) => {
    await openAuth(page);
    const brand = await page.locator('.auth-brand').boundingBox();
    const box = await page.locator('.auth-box').boundingBox();
    // Саме зліва: half праворуч від знака — це вже інший екран.
    expect(brand.x + brand.width).toBeLessThanOrEqual(box.x + 1);
    // На одній висоті: центри половин розходяться не більш ніж на 40px.
    const brandMid = brand.y + brand.height / 2;
    const boxMid = box.y + box.height / 2;
    expect(Math.abs(brandMid - boxMid)).toBeLessThan(40);
  });

  test('між половинами стоїть риска', async ({ page }) => {
    await openAuth(page);
    const border = await page.locator('.auth-box').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.borderLeftWidth, style: cs.borderLeftStyle };
    });
    expect(border.style).toBe('solid');
    expect(parseFloat(border.width)).toBeGreaterThan(0);
  });

  test('рядок під знаком — саме той, і він не перекладається', async ({ page }) => {
    await openAuth(page, { lang: 'pl' });
    // Без крапки: це підпис-девіз, а не речення — крапка робила з нього
    // обірвану фразу.
    await expect(page.locator('.auth-tagline')).toHaveText('Only you create your life');
    // Решта екрана при цьому польською — тобто рядок лишився англійським
    // навмисно, а не тому, що переклад не доїхав.
    await expect(page.locator('#authTitle')).toHaveText('Logowanie');
  });
});

test.describe('Телефон: один стовпчик', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('знак стоїть НАД входом, а не збоку', async ({ page }) => {
    await openAuth(page);
    const brand = await page.locator('.auth-brand').boundingBox();
    const box = await page.locator('.auth-box').boundingBox();
    expect(brand.y + brand.height).toBeLessThanOrEqual(box.y + 1);
    // Половини однакової ширини — тобто розкладка справді в один стовпчик.
    expect(Math.abs(brand.x - box.x)).toBeLessThan(box.width);
  });

  test('риски між половинами немає — ділити нема чого', async ({ page }) => {
    await openAuth(page);
    const width = await page.locator('.auth-box').evaluate(
      (el) => parseFloat(getComputedStyle(el).borderLeftWidth));
    expect(width).toBe(0);
  });
});

test.describe('Тло і картка', () => {
  test('картки навколо форми більше немає', async ({ page }) => {
    await openAuth(page);
    const box = await page.locator('.auth-box').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, radius: parseFloat(cs.borderTopLeftRadius) };
    });
    // Прозоре тло — форма стоїть просто на полотні сторінки.
    expect(box.bg).toBe('rgba(0, 0, 0, 0)');
    expect(box.radius).toBe(0);
  });

  // Тло взяте зі змінної теми, а не задане білим навпростець: інакше людина
  // з темною темою бачила б на вході спалах білого й темний застосунок
  // одразу за ним.
  test('світла тема — чисте біле полотно', async ({ page }) => {
    await openAuth(page, { theme: 'light' });
    expect(await page.locator('#authScreen').evaluate(
      (el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  });

  test('темна тема лишається темною', async ({ page }) => {
    await openAuth(page, { theme: 'dark' });
    const bg = await page.locator('#authScreen').evaluate(
      (el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgb(255, 255, 255)');
    const [r, g, b] = bg.match(/\d+/g).map(Number);
    expect(r + g + b).toBeLessThan(120);
  });
});

// Вікно налаштувань, де живе вибір мови, відкривається лише ПІСЛЯ входу.
// Без цього рядка людина, яка не читає поточної мови, до нього не дійшла б.
test.describe('Мова до входу', () => {
  test('рядок мов є, і вибір міняє екран', async ({ page }) => {
    await openAuth(page);
    await expect(page.locator('#authLangRow .lang-chip')).toHaveCount(4);
    await expect(page.locator('#authTitle')).toHaveText('Вхід');

    await page.click('#authLangRow .lang-chip[data-lang="en"]');
    await expect(page.locator('#authTitle')).toHaveText('Log in');
    await expect(page.locator('#authLangRow .lang-chip.selected')).toHaveText('EN');
  });
});

// Курсор одразу в пошті — але тільки там, де це не піднімає клавіатуру.
test.describe('Фокус у полі пошти', () => {
  test('на комп’ютері курсор одразу в пошті', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openAuth(page);
    await expect(page.locator('#authEmail')).toBeFocused();
  });

  test('на телефоні фокуса немає — клавіатура зʼїла б екран', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAuth(page);
    await expect(page.locator('#authEmail')).not.toBeFocused();
  });
});
