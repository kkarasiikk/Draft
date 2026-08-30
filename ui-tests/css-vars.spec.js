// Кожна змінна, яку сторінка використовує, має бути визначена.
//
// Невизначена змінна не ламає нічого голосно: правило просто не застосується,
// і побачити це можна лише оком. Саме так затемнення під меню швидкого запису
// не малювалось зовсім — `--overlay` на головній ніколи не існувала, а перше
// звернення до неї зʼявилось разом із меню.
//
// Перевіряємо в браузері, а не регуляркою по файлу: getComputedStyle бачить
// підсумкове значення з урахуванням теми, успадкування й порядку правил.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const PAGES = [
  ['головна', 'index.html', '#homeScreen'],
  ['бюджет', 'budget/index.html', '#appScreen'],
  ['цілі', 'goals/index.html', '#appScreen'],
  ['завдання', 'tasks/index.html', '#appScreen'],
  ['тренування', 'workout/index.html', '#appScreen'],
];

for (const [name, path, ready] of PAGES) {
  for (const theme of ['light', 'dark']) {
    test(`${name} (${theme}): усі змінні, що використовуються, визначені`, async ({ page }) => {
      await openModule(page, path, { ready, theme });

      const undefinedVars = await page.evaluate(() => {
        // Не лише <style>: стилі бічної колонки живуть окремим файлом, і
        // якби ми дивились тільки у вбудовані, ціла спільна таблиця
        // лишилась би поза перевіркою. Чужі таблиці (шрифти з Google)
        // кидають на cssRules — їх пропускаємо, своїх змінних у них немає.
        const sheets = [...document.styleSheets].map((sheet) => {
          try {
            return [...sheet.cssRules].map((r) => r.cssText).join('\n');
          } catch (err) { return ''; }
        });
        const css = sheets.join('\n');
        // Звернення з власним запасним значенням — var(--x, щось) — не рахуємо:
        // там відсутність змінної передбачена автором.
        const used = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)].map((m) => m[1]));
        const root = getComputedStyle(document.documentElement);
        return [...used].filter((v) => root.getPropertyValue(v).trim() === '');
      });

      expect(undefinedVars, `невизначені змінні: ${undefinedVars.join(', ')}`).toEqual([]);
    });
  }
}
