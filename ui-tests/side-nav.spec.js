// Бічна колонка розділів — одна на всі пʼять сторінок.
//
// До неї навігація жила в плитках головної: щоб із Бюджету потрапити в
// Завдання, треба було вийти на головну й зайти вдруге. Тут стережемо те,
// що в спільному модулі ламається мовчки: колонка є на кожній сторінці,
// знає, на якій із них стоїть, і не залазить під модалку.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const PAGES = [
  ['головна', 'index.html', '#homeScreen', 'Головна', 'index.html'],
  ['бюджет', 'budget/index.html', '#appScreen', 'Бюджет', '../index.html'],
  ['цілі', 'goals/index.html', '#appScreen', 'Цілі', '../index.html'],
  ['завдання', 'tasks/index.html', '#appScreen', 'Завдання', '../index.html'],
  ['тренування', 'workout/index.html', '#appScreen', 'Тренування', '../index.html'],
];

test.describe('Комп’ютер', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const [name, path, ready, current, homeHref] of PAGES) {
    test(`${name}: колонка стоїть і знає, де ти`, async ({ page }) => {
      await openModule(page, path, { ready });
      await expect(page.locator('.side-nav')).toBeVisible();
      // Рівно пʼять розділів, і поточний — не посилання.
      await expect(page.locator('.side-nav .side-link')).toHaveCount(
        path === 'index.html' ? 7 : 5); // на головній ще експорт і налаштування
      await expect(page.locator('.side-link.current')).toHaveText(current);
      await expect(page.locator('a.side-link.current')).toHaveCount(0);
    });

    test(`${name}: вміст не залазить під колонку`, async ({ page }) => {
      await openModule(page, path, { ready });
      const nav = await page.locator('.side-nav').boundingBox();
      const inner = await page.evaluate(() => {
        const el = document.getElementById('wrap') || document.querySelector('.wrap');
        const cs = getComputedStyle(el);
        return el.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
      });
      expect(inner).toBeGreaterThanOrEqual(nav.x + nav.width);
    });

    if (path !== 'index.html') {
      test(`${name}: логотип у шапці сховано — він уже в колонці`, async ({ page }) => {
        await openModule(page, path, { ready });
        await expect(page.locator('.app-topbar-brand')).toBeHidden();
        await expect(page.locator('.side-brand')).toHaveText('Life');
      });
    }
  }

  test('мова колонки йде за мовою сторінки', async ({ page }) => {
    await openModule(page, 'goals/index.html', { ready: '#appScreen', lang: 'pl' });
    await expect(page.locator('#sideLabel-workout')).toHaveText('Treningi');
    await expect(page.locator('.side-link.current')).toHaveText('Cele');
  });

  // Клас .wrap задає ширину колонки вмісту. Другий елемент із тим самим
  // класом мовчки успадкував би її поля — саме це й було з вибором
  // нагадувань у формі завдання, поки він звався `priority-picker wrap`.
  for (const [name, path, ready] of PAGES) {
    test(`${name}: клас .wrap ні з чим більше не збігається`, async ({ page }) => {
      await openModule(page, path, { ready });
      await expect(page.locator('.wrap')).toHaveCount(1);
    });
  }

  test('колонка лежить під шарами, а не над ними', async ({ page }) => {
    await openModule(page, 'goals/index.html', { ready: '#appScreen' });
    const z = await page.evaluate(() =>
      Number(getComputedStyle(document.querySelector('.side-nav')).zIndex));
    // Оверлеї в застосунку починаються з 55; колонка мусить бути нижче.
    expect(z).toBeLessThan(55);
  });
});

// На телефоні колонки немає: розділи відкриваються з плиток головної та
// нижньої панелі модуля, а постійне меню зʼїло б третину екрана.
test.describe('Телефон', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [name, path, ready] of PAGES) {
    test(`${name}: колонки немає, вміст займає всю ширину`, async ({ page }) => {
      await openModule(page, path, { ready });
      await expect(page.locator('.side-nav')).toBeHidden();
      const pad = await page.evaluate(() => {
        const el = document.getElementById('wrap') || document.querySelector('.wrap');
        return parseFloat(getComputedStyle(el).paddingLeft);
      });
      expect(pad).toBeLessThan(40);
    });
  }

  test('«Головна» в нижній панелі завдань лишається', async ({ page }) => {
    await openModule(page, 'tasks/index.html', { ready: '#appScreen' });
    await expect(page.locator('#bnHome')).toBeVisible();
  });
});
