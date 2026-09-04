// Три вкладки в завданнях: День, Тиждень, Календар.
//
// Було дві — «Тиждень» (яка насправді показувала день) і «Календар», плюс
// «Головна». Тепер перша чесно зветься «День», зʼявилась справжня вкладка
// тижня, а «Головна» пішла: на хаб веде напис Life у шапці, той самий, що й у
// решті модулів.
//
// Вкладка тижня — про те, що треба зробити ЦЬОГО ТИЖНЯ, але не конкретного
// дня: ідея, намір, справа без години. У базі це те саме завдання, лише з
// полем weekStart замість dueDate — тож галочка, підзадачі й форма
// редагування працюють ті самі.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const iso = (shift = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (base) => {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const THIS_WEEK = mondayOf(iso());
const PREV_WEEK = mondayOf(iso(-7));

const task = (over) => ({ done: false, subtasks: [], tags: [], ...over });
const SEED = {
  profile: {},
  tasks: [
    task({ id: 'd1', title: 'Денне завдання', dueDate: iso() }),
    task({ id: 'n1', title: 'Зовсім без дати' }),
    task({ id: 'w1', title: 'Ідея на тиждень', weekStart: THIS_WEEK }),
    task({ id: 'w2', title: 'Борг з минулого', weekStart: PREV_WEEK }),
    task({ id: 'w3', title: 'Закрите минулого', weekStart: PREV_WEEK, done: true }),
    task({ id: 'note1', title: 'Телефон майстра 555', weekStart: THIS_WEEK, kind: 'note' }),
    task({ id: 'note2', title: 'Думка минулого тижня', weekStart: PREV_WEEK, kind: 'note' }),
  ],
};

async function openTasks(page, seed = SEED) {
  await openModule(page, 'tasks/index.html', { seed });
}

const titles = (page) => page.locator('#planList .task-title').allTextContents();

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Нижня панель', () => {
  test('три вкладки: День, Тиждень, Календар — і жодної «Головної»', async ({ page }) => {
    await openTasks(page);
    await expect(page.locator('#bottomNav .bn-item')).toHaveCount(3);
    expect(await page.locator('#bottomNav .bn-item span').allTextContents())
      .toEqual(['День', 'Тиждень', 'Календар']);
    await expect(page.locator('#bnHome')).toHaveCount(0);
  });

  test('відкривається на дні — там, де завдання на сьогодні', async ({ page }) => {
    await openTasks(page);
    await expect(page.locator('#dayScreen')).toBeVisible();
    await expect(page.locator('#bnDay')).toHaveClass(/active/);
    await expect(page.locator('#dayList')).toContainText('Денне завдання');
  });

  test('кожна вкладка показує свій екран і гасить чужі', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await expect(page.locator('#weekPlanScreen')).toBeVisible();
    await expect(page.locator('#dayScreen')).toBeHidden();
    await expect(page.locator('#monthScreen')).toBeHidden();

    await page.click('#bnMonth');
    await expect(page.locator('#monthScreen')).toBeVisible();
    await expect(page.locator('#weekPlanScreen')).toBeHidden();

    await page.click('#bnDay');
    await expect(page.locator('#dayScreen')).toBeVisible();
    await expect(page.locator('#monthScreen')).toBeHidden();
  });

  test('на хаб веде напис Life у шапці — вихід нікуди не подівся', async ({ page }) => {
    await openTasks(page);
    await expect(page.locator('#topbarHomeLink')).toHaveAttribute('href', '../index.html');
  });
});

test.describe('Вкладка тижня', () => {
  test('показує пункти свого тижня, а денні завдання — ні', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    const list = await titles(page);
    expect(list).toContain('Ідея на тиждень');
    expect(list).not.toContain('Денне завдання');
    expect(list, 'завдання зовсім без дати живе на дні, а не тут').not.toContain('Зовсім без дати');
  });

  test('незакритий пункт минулого тижня переїжджає сюди — з позначкою', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    expect(await titles(page)).toContain('Борг з минулого');
    await expect(page.locator('.plan-carried')).toHaveCount(1);
    await expect(page.locator('.plan-carried')).toHaveText('з минулого тижня');
  });

  test('виконане минулого тижня сюди не тягнеться — це вже історія', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    expect(await titles(page)).not.toContain('Закрите минулого');
  });

  test('назад — той тиждень, який був, а не звалище незробленого', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.click('#planPrevBtn');
    const list = await titles(page);
    expect(list).toContain('Борг з минулого');
    expect(list, 'закрите лишилось у своєму тижні').toContain('Закрите минулого');
    expect(list).not.toContain('Ідея на тиждень');
  });

  test('назва тижня вертає в поточний', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await expect(page.locator('#planLabel')).toHaveText('Цей тиждень');
    await expect(page.locator('#planLabel')).toHaveClass(/current/);
    await page.click('#planPrevBtn');
    await expect(page.locator('#planLabel')).not.toHaveClass(/current/);
    await page.click('#planLabel');
    await expect(page.locator('#planLabel')).toHaveText('Цей тиждень');
  });
});

test.describe('Запис на тиждень', () => {
  const lastAdd = (page) => page.evaluate(() => window.__fbCalls.add.slice(-1)[0]);

  test('пункт пишеться з тижнем і БЕЗ дня — у цьому вся суть вкладки', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.fill('#planInput', 'Розібрати шафу');
    await page.click('#planAddBtn');
    await expect.poll(async () => (await lastAdd(page)).payload.title).toBe('Розібрати шафу');
    const add = await lastAdd(page);
    expect(add.col).toBe('tasks');
    expect(add.payload).toMatchObject({
      title: 'Розібрати шафу', dueDate: null, dueTime: null,
      weekStart: THIS_WEEK, done: false, tags: [], subtasks: [],
    });
  });

  test('пишеться в ТОЙ тиждень, який на екрані', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.click('#planNextBtn');
    await page.fill('#planInput', 'Наступного тижня');
    await page.click('#planAddBtn');
    await expect.poll(async () => (await lastAdd(page)).payload.weekStart)
      .toBe(mondayOf(iso(7)));
  });

  test('Enter у полі — те саме, що кнопка', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.fill('#planInput', 'З клавіатури');
    await page.press('#planInput', 'Enter');
    await expect.poll(async () => (await lastAdd(page)).payload.title).toBe('З клавіатури');
  });

  test('порожній рядок не зберігається, а каже чому', async ({ page }) => {
    await openTasks(page, { profile: {}, tasks: [] });
    await page.click('#bnWeek');
    await page.click('#planAddBtn');
    await expect(page.locator('#planError')).toHaveText('Напиши хоча б назву');
    expect(await page.evaluate(() => window.__fbCalls.add.length)).toBe(0);
  });

  test('поле очищається після запису — щоб одразу писати наступне', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.fill('#planInput', 'Перше');
    await page.click('#planAddBtn');
    await expect(page.locator('#planInput')).toHaveValue('');
  });

  test('плаваючий «+» тут схований — він створює завдання НА ДЕНЬ', async ({ page }) => {
    await openTasks(page);
    await expect(page.locator('#openQuickAdd')).toBeVisible();
    await page.click('#bnWeek');
    await expect(page.locator('#openQuickAdd')).toBeHidden();
    await page.click('#bnDay');
    await expect(page.locator('#openQuickAdd')).toBeVisible();
  });
});

test.describe('Нотатки на тижні', () => {
  const notes = (page) => page.locator('.plan-note').allTextContents();

  test('нотатки стоять окремо від планів — і без галочки', async ({ page }) => {
    // Галочка на нотатці не означала б нічого: її не виконують, а читають.
    await openTasks(page);
    await page.click('#bnWeek');
    expect(await notes(page)).toEqual(['Телефон майстра 555']);
    await expect(page.locator('.plan-note .task-check')).toHaveCount(0);
    expect(await titles(page), 'нотатка не лізе у список планів')
      .not.toContain('Телефон майстра 555');
  });

  test('нотатка НЕ переїжджає в новий тиждень', async ({ page }) => {
    // Незроблений план — борг, а незабута думка — запис на своєму місці.
    await openTasks(page);
    await page.click('#bnWeek');
    expect(await notes(page)).not.toContain('Думка минулого тижня');
    await page.click('#planPrevBtn');
    expect(await notes(page)).toEqual(['Думка минулого тижня']);
  });

  test('перемикач каже, що саме записуєш, і міняє підказку в полі', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await expect(page.locator('#planKindPlan')).toHaveClass(/active/);
    await expect(page.locator('#planInput')).toHaveAttribute('placeholder', 'Що зробити цього тижня?');
    await page.click('#planKindNote');
    await expect(page.locator('#planKindNote')).toHaveClass(/active/);
    await expect(page.locator('#planKindPlan')).not.toHaveClass(/active/);
    await expect(page.locator('#planInput')).toHaveAttribute('placeholder', 'Що записати на памʼять?');
  });

  test('нотатка пишеться з kind, план — без нього', async ({ page }) => {
    const lastAdd = (page_) => page_.evaluate(() => window.__fbCalls.add.slice(-1)[0]);
    await openTasks(page);
    await page.click('#bnWeek');

    await page.click('#planKindNote');
    await page.fill('#planInput', 'Записати думку');
    await page.click('#planAddBtn');
    await expect.poll(async () => (await lastAdd(page)).payload.title).toBe('Записати думку');
    expect((await lastAdd(page)).payload).toMatchObject({ kind: 'note', weekStart: THIS_WEEK, dueDate: null });

    await page.click('#planKindPlan');
    await page.fill('#planInput', 'Зробити діло');
    await page.click('#planAddBtn');
    await expect.poll(async () => (await lastAdd(page)).payload.title).toBe('Зробити діло');
    expect((await lastAdd(page)).payload.kind, 'план нотаткою не стає').toBe(null);
  });

  test('тиждень із самими нотатками — не порожній тиждень', async ({ page }) => {
    await openTasks(page, {
      profile: {},
      tasks: [task({ id: 'n', title: 'Сама лише думка', weekStart: THIS_WEEK, kind: 'note' })],
    });
    await page.click('#bnWeek');
    await expect(page.locator('#planList .empty-state')).toHaveCount(0);
    expect(await notes(page)).toEqual(['Сама лише думка']);
  });

  test('коли немає нічого — порожній екран на місці', async ({ page }) => {
    await openTasks(page, { profile: {}, tasks: [] });
    await page.click('#bnWeek');
    await expect(page.locator('#planList .empty-state')).toHaveCount(1);
    expect(await notes(page)).toEqual([]);
  });

  test('тап по нотатці відкриває ту саму форму — є де виправити й видалити', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.click('.plan-note');
    await expect(page.locator('#taskFormOverlay')).toHaveClass(/show/);
    await expect(page.locator('#taskTitleInput')).toHaveValue('Телефон майстра 555');
  });
});

test.describe('Під завданням немає нічого зайвого', () => {
  // Тут була справжня помилка: taskRowHtml отримав другий аргумент (позначка
  // «з минулого тижня»), а викликався через .map(taskRowHtml) — і map віддавав
  // туди ІНДЕКС. Під кожним завданням дня зʼявлялась його порядкова цифра,
  // крім першого: нуль хибний, тож саме він і виглядав нормально.
  const rowExtras = (page, selector) => page.locator(selector).evaluateAll((rows) =>
    rows.map((row) => {
      const meta = row.querySelector('.task-meta');
      return meta ? meta.textContent.trim() : '';
    }));

  test('у списку дня під назвами не зʼявляються номери', async ({ page }) => {
    await openTasks(page, {
      profile: {},
      tasks: [1, 2, 3, 4].map((n) => task({
        id: 'd' + n, title: 'Завдання ' + n, dueDate: iso(),
      })),
    });
    const extras = await rowExtras(page, '#dayList .task-row');
    expect(extras, 'жодних порядкових цифр під назвами').toEqual(['', '', '', '']);
  });

  test('у списку тижня — теж, крім чесної позначки про переїзд', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    const extras = await rowExtras(page, '#planList .task-row');
    extras.forEach((text) => {
      expect(text === '' || text === 'з минулого тижня',
        `зайвий підпис під рядком: "${text}"`).toBe(true);
    });
  });
});

test.describe('Пункт тижня — звичайне завдання', () => {
  test('на екрані дня в «без дати» він не дублюється', async ({ page }) => {
    await openTasks(page);
    await expect(page.locator('#noDateSection')).toContainText('Зовсім без дати');
    await expect(page.locator('#noDateSection')).not.toContainText('Ідея на тиждень');
  });

  test('галочка працює та сама', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.click('#planList [data-toggle="w1"]');
    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.slice(-1)[0]);
    expect(upd.id).toBe('w1');
    expect(upd.payload.done).toBe(true);
  });

  test('тап відкриває ту саму повну форму', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.click('#planList [data-open="w1"]');
    await expect(page.locator('#taskFormOverlay')).toHaveClass(/show/);
    await expect(page.locator('#taskTitleInput')).toHaveValue('Ідея на тиждень');
  });
});
