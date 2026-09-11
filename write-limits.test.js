// Скільки дозволяє набрати поле — і скільки приймає сервер.
//
// Ці два числа живуть у різних файлах і ніщо їх не звʼязувало. Розійшлись
// вони тихо: textarea запису тижневика дозволяла 500 символів, а правило
// для того самого поля в Firestore — 200. Усе довше застосунок давав
// набрати, показував у полі, давав натиснути «Зберегти» — і сервер відхиляв
// запис. Причому новий короткий запис зберігався нормально, тож виглядало
// це як «створити можу, дописати не можу», а повідомлення про помилку вело
// зовсім не туди.
//
// Тест тримає інваріант: ЖОДНЕ поле введення не може дозволяти більше, ніж
// приймають правила. І другий, не менш важливий: кожне поле з maxlength має
// бути в таблиці нижче — щоб нове поле не можна було додати, не вирішивши,
// куди воно пише й чи сходяться межі.
const fs = require('fs');
const path = require('path');

const RULES = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');

// id поля -> куди воно пише. field: null означає «у правилах межі немає»
// (текст лягає всередину елемента списку, а списки міряються довжиною).
const FIELDS = [
  { id: 'planText', file: 'tasks/index.html', field: 'tasks.title' },
  { id: 'quickAddInput', file: 'tasks/index.html', field: 'tasks.title' },
  { id: 'taskTitleInput', file: 'tasks/index.html', field: 'tasks.title' },
  { id: 'taskNotesInput', file: 'tasks/index.html', field: 'tasks.notes' },
  { id: 'goalTitleInput', file: 'goals/index.html', field: 'goals.title' },
  { id: 'goalWhyInput', file: 'goals/index.html', field: 'goals.why' },
  { id: 'goalNotes', file: 'goals/index.html', field: null },
  { id: 'sessionNameInput', file: 'workout/index.html', field: 'workouts.name' },
  { id: 'sessionNotesInput', file: 'workout/index.html', field: 'workouts.notes' },
  { id: 'pickerCustomInput', file: 'workout/index.html', field: 'customExercises.name' },
];

/** Тіло блоку match /<collection>/{...} з правил. */
function ruleBlock(collection) {
  const start = RULES.indexOf('match /' + collection + '/{');
  if (start === -1) throw new Error('немає блоку правил для ' + collection);
  const next = RULES.indexOf('match /', start + 1);
  return RULES.slice(start, next === -1 ? RULES.length : next);
}

/** Межа довжини поля за правилами: isNonEmptyString(d.x, N) або d.x.size() <= N. */
function serverLimit(ref) {
  const [collection, field] = ref.split('.');
  const block = ruleBlock(collection);
  const named = block.match(new RegExp('isNonEmptyString\\(d\\.' + field + ',\\s*(\\d+)\\)'));
  if (named) return Number(named[1]);
  const sized = block.match(new RegExp('d\\.' + field + '\\.size\\(\\)\\s*<=\\s*(\\d+)'));
  if (sized) return Number(sized[1]);
  throw new Error('у правилах немає межі для ' + ref);
}

/** Усі maxlength сторінки: id -> число. */
function clientLimits(file) {
  const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const found = {};
  const tag = /<(?:input|textarea)\b[^>]*>/g;
  let m;
  while ((m = tag.exec(html))) {
    const id = m[0].match(/id="([^"]+)"/);
    const max = m[0].match(/maxlength="(\d+)"/);
    if (id && max) found[id[1]] = Number(max[1]);
  }
  return found;
}

const PAGES = ['index.html', 'budget/index.html', 'goals/index.html',
  'tasks/index.html', 'workout/index.html'];

describe('поле не дозволяє набрати більше, ніж прийме сервер', () => {
  FIELDS.forEach((f) => {
    if (!f.field) return;
    test(`${f.id} -> ${f.field}`, () => {
      const client = clientLimits(f.file)[f.id];
      expect(typeof client).toBe('number');
      expect(client).toBeLessThanOrEqual(serverLimit(f.field));
    });
  });

  // Саме цей випадок і був живою вадою: 500 у полі проти 200 у правилах.
  test('запис тижневика йде в tasks.title, і межі сходяться', () => {
    expect(clientLimits('tasks/index.html').planText).toBe(500);
    expect(serverLimit('tasks.title')).toBeGreaterThanOrEqual(500);
  });
});

describe('кожне поле з межею — у таблиці', () => {
  const listed = new Set(FIELDS.map((f) => f.id));
  PAGES.forEach((page) => {
    test(page, () => {
      const missing = Object.keys(clientLimits(page)).filter((id) => !listed.has(id));
      expect(missing).toEqual([]);
    });
  });
});
