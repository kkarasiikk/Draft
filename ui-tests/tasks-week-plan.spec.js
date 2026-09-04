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
    task({ id: 'w1', title: 'Ідея на тиждень', weekStart: THIS_WEEK, weekCat: 'ideas' }),
    task({ id: 'w2', title: 'Борг з минулого', weekStart: PREV_WEEK, weekCat: 'work' }),
    task({ id: 'w3', title: 'Закрите минулого', weekStart: PREV_WEEK, done: true }),
    task({ id: 'w4', title: 'Розібрати шафу', weekStart: THIS_WEEK, weekCat: 'home' }),
    task({ id: 'w5', title: 'Нічия справа', weekStart: THIS_WEEK }),
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

  test('підпис місяця вертає в поточний тиждень', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await expect(page.locator('#planLabel')).toHaveClass(/current/);
    const start = await titles(page);
    await page.click('#planPrevBtn');
    await expect(page.locator('#planLabel')).not.toHaveClass(/current/);
    await page.click('#planLabel');
    await expect(page.locator('#planLabel')).toHaveClass(/current/);
    expect(await titles(page)).toEqual(start);
  });
});

test.describe('Тижневик: тиждень, назва, групи', () => {
  test('зверху — сім днів тижня, а не рядок із датами', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await expect(page.locator('#planWeekStrip .week-day')).toHaveCount(7);
    // Виділений лише сьогоднішній: тут нічого не обирають, це підпис до
    // вкладки, а не смуга вибору дня.
    await expect(page.locator('#planWeekStrip .week-day.today')).toHaveCount(1);
    await expect(page.locator('#planWeekStrip .week-day.selected')).toHaveCount(0);
  });

  test('смуга та сама, що у вкладці «День» — ті самі класи, а не схожа копія', async ({ page }) => {
    // Спершу тут була своя, третя за рахунком смуга: трохи інші розміри, без
    // крапок. Виглядала майже так само — і саме це «майже» читалось як
    // недоробка.
    await openTasks(page);
    const dayCell = await page.locator('#weekTrack .week-strip:not(.adjacent) .week-day').first()
      .evaluate((el) => Array.from(el.querySelectorAll('span')).map((s) => s.className));
    await page.click('#bnWeek');
    const planCell = await page.locator('#planWeekStrip .week-day').first()
      .evaluate((el) => Array.from(el.querySelectorAll('span')).map((s) => s.className));
    expect(planCell).toEqual(dayCell);
  });

  test('крапка означає те саме, що скрізь: є справи / усе закрито', async ({ page }) => {
    await openTasks(page, {
      profile: {},
      tasks: [
        task({ id: 'a', title: 'Є що робити', dueDate: THIS_WEEK }),
        task({ id: 'b', title: 'Усе закрито', dueDate: iso(0), done: true }),
      ],
    });
    await page.click('#bnWeek');
    await expect(page.locator('#planWeekStrip .week-day-dot.has')).toHaveCount(1);
    await expect(page.locator('#planWeekStrip .week-day-dot.all-done')).toHaveCount(1);
  });

  test('тап по числу веде у вкладку «День» на цю дату', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.locator('#planWeekStrip .week-day').nth(2).click();
    await expect(page.locator('#dayScreen')).toBeVisible();
    await expect(page.locator('#bnDay')).toHaveClass(/active/);
  });

  test('велика назва вкладки на місці', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await expect(page.locator('#planTitle')).toHaveText('Тижневик');
  });

  test('підпис — місяць, і рік у ньому лише коли він не цей', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await expect(page.locator('#planLabel')).not.toHaveText(/\d{4}/);
    for (let i = 0; i < 60; i++) await page.click('#planNextBtn');
    await expect(page.locator('#planLabel')).toHaveText(/\d{4}/);
  });

  test('записи стоять групами за категоріями, порожніх груп немає', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    // Порядок — той, у якому складено категорії, а не алфавітний.
    expect(await page.locator('.plan-group-label').allTextContents())
      .toEqual(['Дім', 'Робота', 'Ідеї', 'Без категорії']);
  });

  test('запис без категорії не зникає — йде окремою групою в кінці', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    const last = page.locator('.plan-group').last();
    await expect(last).toContainText('Нічия справа');
  });
});

test.describe('Тижневик: запис через «+»', () => {
  const lastAdd = (page) => page.evaluate(() => window.__fbCalls.add.slice(-1)[0]);

  test('«+» у куті відкриває форму запису, а не завдання на день', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await expect(page.locator('#openQuickAdd'), 'кнопка та сама, що в решті вкладок').toBeVisible();
    await page.click('#openQuickAdd');
    await expect(page.locator('#planFormOverlay')).toHaveClass(/show/);
    await expect(page.locator('#quickAddOverlay')).not.toHaveClass(/show/);
  });

  test('на вкладці дня той самий «+» відкриває швидке додавання завдання', async ({ page }) => {
    await openTasks(page);
    await page.click('#openQuickAdd');
    await expect(page.locator('#quickAddOverlay')).toHaveClass(/show/);
    await expect(page.locator('#planFormOverlay')).not.toHaveClass(/show/);
  });

  test('запис пишеться з тижнем, категорією і БЕЗ дня', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.click('#openQuickAdd');
    await page.fill('#planText', 'Купити фарбу');
    await page.click('[data-plan-cat="home"]');
    await page.click('#planSaveBtn');
    await expect.poll(async () => (await lastAdd(page)).payload.title).toBe('Купити фарбу');
    expect((await lastAdd(page)).payload).toMatchObject({
      weekStart: THIS_WEEK, weekCat: 'home', dueDate: null, dueTime: null, done: false,
    });
  });

  test('порожній текст не зберігається, а каже чому', async ({ page }) => {
    await openTasks(page, { profile: {}, tasks: [] });
    await page.click('#bnWeek');
    await page.click('#openQuickAdd');
    await page.click('#planSaveBtn');
    await expect(page.locator('#planError')).toHaveText('Напиши хоча б слово');
    expect(await page.evaluate(() => window.__fbCalls.add.length)).toBe(0);
  });

  test('тап по запису відкриває його ж — із текстом і категорією', async ({ page }) => {
    await openTasks(page);
    await page.click('#bnWeek');
    await page.click('[data-open="w4"]');
    await expect(page.locator('#planFormOverlay')).toHaveClass(/show/);
    await expect(page.locator('#planText')).toHaveValue('Розібрати шафу');
    await expect(page.locator('[data-plan-cat="home"]')).toHaveClass(/selected/);
  });
});

test.describe('Тижневик: свої категорії', () => {
  const lastSet = (page) => page.evaluate(() => window.__fbCalls.set.slice(-1)[0]);

  async function openCats(page) {
    await page.click('#bnWeek');
    await page.click('#openQuickAdd');
    await page.click('[data-plan-cats-edit]');
  }

  test('останній чип — «Змінити», і він відкриває керування', async ({ page }) => {
    await openTasks(page);
    await openCats(page);
    await expect(page.locator('#planCatsOverlay')).toHaveClass(/show/);
    await expect(page.locator('.plan-cat-row')).toHaveCount(3);
  });

  test('нова категорія лягає в профіль і одразу зʼявляється чипом', async ({ page }) => {
    await openTasks(page);
    await openCats(page);
    await page.fill('#planCatInput', 'Проєкт');
    await page.click('#planCatAddBtn');
    await expect.poll(async () => {
      const set = await lastSet(page);
      return set && set.payload.categoriesWeek.map((c) => c.label);
    }).toEqual(['Дім', 'Робота', 'Ідеї', 'Проєкт']);
    await expect(page.locator('#planCatPicker')).toContainText('Проєкт');
  });

  test('категорія з тією ж назвою не заводиться двічі', async ({ page }) => {
    await openTasks(page);
    await openCats(page);
    await page.fill('#planCatInput', 'дім');
    await page.click('#planCatAddBtn');
    await expect(page.locator('#planCatsError')).toHaveText('Така категорія вже є');
    await expect(page.locator('.plan-cat-row')).toHaveCount(3);
  });

  test('порожня назва теж не заводиться', async ({ page }) => {
    await openTasks(page);
    await openCats(page);
    await page.click('#planCatAddBtn');
    await expect(page.locator('#planCatsError')).toHaveText('Напиши назву');
  });

  test('прибрана категорія нічого не стирає — її записи стають без категорії', async ({ page }) => {
    // Найгірше, що ця вкладка могла б зробити, — втратити написане через
    // прибрану категорію.
    await openTasks(page);
    await openCats(page);
    await page.locator('.plan-cat-row', { hasText: 'Дім' }).locator('.plan-cat-del').click();
    await expect.poll(async () => {
      const set = await lastSet(page);
      return set && set.payload.categoriesWeek.map((c) => c.label);
    }).toEqual(['Робота', 'Ідеї']);
    await page.click('#planCatsClose');
    await page.click('#planFormClose');
    await expect(page.locator('#planList')).toContainText('Розібрати шафу');
    expect(await page.locator('.plan-group-label').allTextContents())
      .not.toContain('Дім');
  });

  test('свої категорії з профілю витісняють стандартні', async ({ page }) => {
    await openTasks(page, {
      profile: { categoriesWeek: [{ id: 'proj', label: 'Проєкт' }] },
      tasks: [task({ id: 'p1', title: 'Запис', weekStart: THIS_WEEK, weekCat: 'proj' })],
    });
    await page.click('#bnWeek');
    await expect.poll(() => page.locator('.plan-group-label').allTextContents())
      .toEqual(['Проєкт']);
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

  test('тап відкриває форму тижневика, а не повну форму завдання', async ({ page }) => {
    // У запису тижня немає ні дати, ні часу, ні повторення — показувати їх
    // означало б питати про те, чого в нього не буває.
    await openTasks(page);
    await page.click('#bnWeek');
    await page.click('#planList [data-open="w1"]');
    await expect(page.locator('#planFormOverlay')).toHaveClass(/show/);
    await expect(page.locator('#taskFormOverlay')).not.toHaveClass(/show/);
    await expect(page.locator('#planText')).toHaveValue('Ідея на тиждень');
  });
});
