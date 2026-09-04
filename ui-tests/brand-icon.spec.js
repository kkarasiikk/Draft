// Іконка застосунку: знак має стояти в плитці рівно по центру.
//
// Це та поломка, якої не видно ні в коді, ні в діффі — тільки на телефоні,
// і то як невиразне «щось не так». Так уже було: знак малювався по центру
// УМОВНОГО боксу, а бокс має запас згори під крапку над «i», тож насправді
// малюнок сидів на кілька пікселів нижче й правіше. Тепер генератор
// (`icons/build.html`) міряє межі самого малюнка на пікселях — і цей тест
// перевіряє результат тим самим способом, незалежно від генератора.
const { test, expect } = require('@playwright/test');

/** Межі білого знака всередині готового PNG. */
async function inkBox(page, src) {
  return page.evaluate((url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('не завантажилась: ' + url));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      // Знак білий на майже чорному, тож «фарба» — це явно світлі пікселі.
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          if (d[i] > 128 && d[i + 3] > 128) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      resolve({
        size: c.width,
        left: x0, right: c.width - 1 - x1,
        top: y0, bottom: c.height - 1 - y1,
        width: x1 - x0 + 1, height: y1 - y0 + 1,
      });
    };
    img.src = url;
  }), src);
}

const ICONS = [
  ['/icons/icon-192.png', 0.73],
  ['/icons/icon-512.png', 0.73],
  ['/icons/icon-192-maskable.png', 0.60],
  ['/icons/icon-512-maskable.png', 0.60],
];

// Сторінку беремо найдешевшу з можливих: тестам потрібне лише те саме
// походження, щоб canvas міг прочитати пікселі іконки. Піднімати заради
// цього застосунок — це Firebase, шрифти й кілька секунд на кожен тест.
test.beforeEach(async ({ page }) => { await page.goto('/manifest.json'); });

for (const [src, fill] of ICONS) {
  test(`${src}: знак по центру й потрібного розміру`, async ({ page }) => {
    const box = await inkBox(page, src);

    // Допуск — один відсоток сторони: рівно стільки дає округлення до пікселя
    // на 192, і рівно стільки ще не видно оком.
    const tol = Math.max(2, box.size * 0.01);
    expect(Math.abs(box.left - box.right)).toBeLessThanOrEqual(tol);
    expect(Math.abs(box.top - box.bottom)).toBeLessThanOrEqual(tol);

    // Завеликий знак упреться в край (а на Android — і в обрізку), замалий
    // загубиться серед сусідів на робочому столі.
    expect(box.width / box.size).toBeGreaterThan(fill - 0.06);
    expect(box.width / box.size).toBeLessThan(fill + 0.06);
  });
}

test('maskable-версія лишає запас під обрізку Android', async ({ page }) => {
  // Android обрізає іконку довільною формою й гарантує лише центральне коло
  // у 80% сторони. Знак має вміститись у нього цілком — інакше зріже «L» та
  // хвіст «e».
  const box = await inkBox(page, '/icons/icon-512-maskable.png');
  const radius = Math.hypot(box.width, box.height) / 2;
  expect(radius).toBeLessThan(box.size * 0.40);
});
