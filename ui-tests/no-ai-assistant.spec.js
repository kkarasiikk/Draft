// AI-помічника в застосунку більше немає.
//
// Він умів записувати голосом («кава 80 грн»), читати підсумки й малювати
// діаграми просто в чаті. За весь час користування не знадобився жодного
// разу — прибрано на прохання.
//
// Головний аргумент був не в тому, що він щось коштував грошима (плата йде
// за використання, а використання не було), а в тому, що він мусив ЗНАТИ про
// кожне поле й кожен екран: `ai.js` доводилось правити при кожній зміні
// застосунку, інакше помічник починав розповідати про те, чого вже немає.
//
// Аналіз даних нікуди не подівся — він робиться експортом (вкладка «Дані»)
// і будь-яким зовнішнім AI, куди файл просто кидають.
//
// Тест лишається саме тому, що слідів було багато: кнопка в шапці чотирьох
// сторінок, два файли в кожному service worker, шар у scroll-lock, хмарна
// функція і ключ Anthropic. Якщо колись щось із цього повернеться, воно має
// повертатись свідомо.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const PAGES = [
  ['головна', 'index.html', '#homeScreen'],
  ['бюджет', 'budget/index.html', '#appScreen'],
  ['завдання', 'tasks/index.html', '#appScreen'],
  ['цілі', 'goals/index.html', '#appScreen'],
  ['тренування', 'workout/index.html', '#appScreen'],
];

for (const [name, path, ready] of PAGES) {
  test(`${name}: кнопки «AI» в шапці немає`, async ({ page }) => {
    await openModule(page, path, { ready });
    await expect(page.locator('#aiChatBtn')).toHaveCount(0);
    await expect(page.locator('.ai-topbar-btn')).toHaveCount(0);
  });

  test(`${name}: ні скрипт, ні стилі чату не підключені`, async ({ page }) => {
    await openModule(page, path, { ready });
    const linked = await page.evaluate(() => [
      ...[...document.scripts].map((s) => s.src),
      ...[...document.styleSheets].map((s) => s.href || ''),
    ].filter((u) => /ai-chat/.test(u)));
    expect(linked).toEqual([]);
    // І сам віджет не з'являється звідкись іще.
    await expect(page.locator('.aic-overlay')).toHaveCount(0);
  });
}

// Шапка від цього не має осиротіти: там лишається те, що справді потрібне.
test('бюджет: у шапці лишились логотип і «⋮», без діри на місці «AI»', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openModule(page, 'budget/index.html', { ready: '#appScreen' });
  await expect(page.locator('.app-topbar-brand')).toBeVisible();
  await expect(page.locator('#categoriesBtn')).toBeVisible();
  // Рівно одна кнопка в правій групі — та, що лишилась.
  await expect(page.locator('.topbar-actions > *')).toHaveCount(1);
});
