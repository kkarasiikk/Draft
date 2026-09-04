// Іконки, які обіцяють маніфести й сторінки, мусять існувати.
//
// Переліки service worker-ів уже перевіряє `sw-core.test.js` — і робить це
// краще, піднімаючи сам воркер. Але маніфест і теги `<link>` він не бачить, а
// саме вони кажуть системі, що́ малювати на робочому столі. Приводом стала
// заміна логотипа: чотири файли переїхали з `budget/` у `icons/`, і шлях до
// них довелось переписати у пʼятьох маніфестах і пʼятьох сторінках — заміною
// по тексту, з різною глибиною вкладеності в кожному.
//
// Помилку тут не видно: сторінка відкриється, застосунок працюватиме, просто
// на телефоні лишиться порожній квадрат замість іконки.
const fs = require('fs');
const path = require('path');

const MODULES = ['', 'budget', 'tasks', 'goals', 'workout'];
const resolveFrom = (file, ref) => path.resolve(path.dirname(path.join(__dirname, file)), ref);

describe('маніфести', () => {
  MODULES.forEach((mod) => {
    const file = path.join(mod, 'manifest.json');
    const manifest = () => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));

    test(`${file}: кожна іконка існує`, () => {
      const missing = manifest().icons
        .filter((icon) => !fs.existsSync(resolveFrom(file, icon.src)))
        .map((icon) => icon.src);
      expect(missing).toEqual([]);
    });

    // Без maskable Android малює знак усередині білого кола — на темній
    // плитці це виглядає як чужа іконка в чужій рамці.
    test(`${file}: є і звичайні іконки, і maskable`, () => {
      const purposes = manifest().icons.map((icon) => icon.purpose);
      expect(purposes).toContain('any');
      expect(purposes).toContain('maskable');
    });
  });
});

describe('сторінки', () => {
  MODULES.forEach((mod) => {
    const file = path.join(mod, 'index.html');
    test(`${file}: іконка вкладки й apple-touch-icon існують`, () => {
      const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
      const refs = [...html.matchAll(/<link[^>]+rel="(?:apple-touch-)?icon"[^>]+href="([^"]+)"/g)]
        .map((m) => m[1]);
      // Обидва теги обовʼязкові: apple-touch-icon для іконки на телефоні,
      // rel="icon" — для вкладки браузера.
      expect(refs.length).toBe(2);
      expect(refs.filter((ref) => !fs.existsSync(resolveFrom(file, ref)))).toEqual([]);
    });
  });
});
