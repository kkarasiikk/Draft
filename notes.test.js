// Блокнот: чисті перетворення й розподіл за розділами.
//
// Тут перевіряється те, що вирішується ДО будь-якого рендера й помиляється
// тихо: якій вкладці належить нотатка, у якому порядку вони стоять і що
// показувати в підписі під назвою.
const AppNotes = require('./notes.js');

const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

describe('якому розділу належить нотатка', () => {
  test('поле section каже прямо', () => {
    expect(AppNotes.sectionOf({ section: 'goals' })).toBe('goals');
    expect(AppNotes.sectionOf({ section: 'workout' })).toBe('workout');
  });

  // Головне про сумісність: нотатки, записані до появи блокнота в цілях і
  // тренуваннях, поля не мають. Вони бюджетні — тоді блокнот був лише там.
  test('без поля — бюджетна, бо блокнот починався в бюджеті', () => {
    expect(AppNotes.sectionOf({ title: 'Борги' })).toBe('budget');
    expect(AppNotes.sectionOf({})).toBe('budget');
  });

  test('незнайоме значення не створює четвертого розділу', () => {
    expect(AppNotes.sectionOf({ section: 'ferma' })).toBe('budget');
    expect(AppNotes.sectionOf({ section: null })).toBe('budget');
  });
});

describe('розділи не бачать нотаток одне одного', () => {
  const all = [
    { id: 'b1', title: 'Борги', section: 'budget', updatedAt: ts(300) },
    { id: 'g1', title: 'Плани на рік', section: 'goals', updatedAt: ts(200) },
    { id: 'w1', title: 'Техніка присіду', section: 'workout', updatedAt: ts(100) },
    { id: 'old', title: 'Стара', updatedAt: ts(400) },
  ];

  test('бюджет бачить свої й ті, що без поля', () => {
    expect(AppNotes.visible(all, 'budget').map((p) => p.id)).toEqual(['old', 'b1']);
  });

  test('цілі бачать лише свої', () => {
    expect(AppNotes.visible(all, 'goals').map((p) => p.id)).toEqual(['g1']);
  });

  test('тренування бачать лише свої', () => {
    expect(AppNotes.visible(all, 'workout').map((p) => p.id)).toEqual(['w1']);
  });
});

describe('порядок списку', () => {
  const all = [
    { id: 'a', title: 'Яблуко', section: 'budget', updatedAt: ts(100), createdAt: ts(300) },
    { id: 'b', title: 'Банан', section: 'budget', updatedAt: ts(300), createdAt: ts(100) },
    { id: 'c', title: 'Вишня', section: 'budget', updatedAt: ts(200), createdAt: ts(200) },
  ];

  test('за замовчуванням — щойно змінені згори', () => {
    expect(AppNotes.visible(all, 'budget').map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  test('за створенням', () => {
    expect(AppNotes.visible(all, 'budget', 'created').map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });

  test('за назвою — за абеткою', () => {
    expect(AppNotes.visible(all, 'budget', 'title').map((p) => p.title))
      .toEqual(['Банан', 'Вишня', 'Яблуко']);
  });

  test('нотатка без дати не ламає сортування', () => {
    const list = AppNotes.visible([{ id: 'x', title: 'Без дати', section: 'budget' }], 'budget');
    expect(list.map((p) => p.id)).toEqual(['x']);
  });
});

describe('підпис під назвою', () => {
  test('розмітку з редактора прибирає, а не показує', () => {
    const out = AppNotes.snippetOf('Міша винен за серпень -&nbsp;<br>Діма винен -&nbsp;');
    expect(out).not.toContain('<br>');
    expect(out).not.toContain('&nbsp;');
    // Розрив рядка — це проміжок: без нього слова злиплись би.
    expect(out).toContain('серпень - Діма винен');
  });

  test('старий текстовий формат теж читається як текст', () => {
    expect(AppNotes.snippetOf('# Заголовок\n- перше\n- друге')).toBe('Заголовок перше друге');
  });

  test('довгий текст обрізається', () => {
    expect(AppNotes.snippetOf('я'.repeat(200))).toHaveLength(91);
  });

  test('«R&D» і «a < b» за розмітку не рахуються', () => {
    expect(AppNotes.looksLikeHtml('R&D: якщо a < b, то все гаразд')).toBe(false);
    expect(AppNotes.looksLikeHtml('текст<br>далі')).toBe(true);
    expect(AppNotes.looksLikeHtml('текст&nbsp;далі')).toBe(true);
  });
});

describe('старий текстовий формат', () => {
  test('заголовки, списки й чекбокси стають розміткою', () => {
    const html = AppNotes.legacyToHtml('# Плани\n- перше\n[ ] зробити\n[x] зроблено');
    expect(html).toContain('<h3>Плани</h3>');
    expect(html).toContain('<li>перше</li>');
    expect(html).toContain('note-check-row');
    expect(html).toContain('checked');
  });

  test('жирний із двох зірочок', () => {
    expect(AppNotes.legacyToHtml('дуже **важливо**')).toContain('<strong>важливо</strong>');
  });

  test('текст екранується — нотатка не може принести свій тег', () => {
    expect(AppNotes.legacyToHtml('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });
});
