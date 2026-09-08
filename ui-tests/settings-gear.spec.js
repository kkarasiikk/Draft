// Шестерня в шапці — одна й та сама на всіх пʼяти сторінках.
//
// Було три різні іконки для однієї дії: гамбургер на головній, «⋮» у бюджеті
// й завданнях, шестерня в цілях і тренуваннях. Усі п'ять відкривали
// налаштування, але сказати це могла лише шестерня — решту треба було
// натиснути, щоб дізнатись.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const PAGES = [
  ['головна', 'index.html', '#homeScreen'],
  ['бюджет', 'budget/index.html', '#appScreen'],
  ['цілі', 'goals/index.html', '#appScreen'],
  ['завдання', 'tasks/index.html', '#appScreen'],
  ['тренування', 'workout/index.html', '#appScreen'],
];

test.describe('Телефон: шестерня скрізь однакова', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [name, path, ready] of PAGES) {
    test(`${name}: у шапці стоїть шестерня, і вона одна`, async ({ page }) => {
      await openModule(page, path, { ready });
      const btn = page.locator('#pageSettingsBtn');
      await expect(btn).toBeVisible();
      // Саме шестерня, а не три крапки й не три смужки: у кола посередині
      // й у зубчастого контуру навколо нього іншого прочитання немає.
      const svg = btn.locator('svg');
      await expect(svg.locator('circle')).toHaveCount(1);
      await expect(svg.locator('path')).toHaveCount(1);
      // Слідів гамбургера не лишилось.
      await expect(btn.locator('span')).toHaveCount(0);
    });

    test(`${name}: шестерня відкриває налаштування`, async ({ page }) => {
      await openModule(page, path, { ready });
      await page.click('#pageSettingsBtn');
      await expect(page.locator('#settingsOverlay')).toHaveClass(/show/);
    });

    // Підпис читає зчитувач екрана, і він має казати те саме, що малюнок.
    test(`${name}: підпис кнопки — «Налаштування»`, async ({ page }) => {
      await openModule(page, path, { ready });
      await expect(page.locator('#pageSettingsBtn')).toHaveAttribute('aria-label', 'Налаштування');
    });

    test(`${name}: іншою мовою підпис теж перекладається`, async ({ page }) => {
      await openModule(page, path, { ready, lang: 'en' });
      await expect(page.locator('#pageSettingsBtn')).toHaveAttribute('aria-label', 'Settings');
    });
  }

  // Слово «Налаштування» живе в settings.js, у всіх чотирьох мовах. Сторінки
  // його не дублюють — інакше це чотири нагоди розійтись.
  test('перемикання мови на льоту переписує підпис', async ({ page }) => {
    await openModule(page, 'index.html', { ready: '#homeScreen' });
    await page.click('#pageSettingsBtn');
    await page.click('[data-tab="general"]');
    await page.click('[data-lang-choice="pl"]');
    await expect(page.locator('#pageSettingsBtn')).toHaveAttribute('aria-label', 'Ustawienia');
  });
});
