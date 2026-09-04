// Довга петля цілей: темп, пауза, архів.
//
// Модуль називається «довгострокові цілі», а вся механіка працювала з одним
// днем: серія й вечірнє «чи був крок». Ціль із дедлайном через вісім місяців
// отримувала щовечора «так/ні» — і попередження за три дні до кінця.
// Перевіряємо те, що заповнює цю прогалину, і те, що щоденних допитів
// (вечірня картка, щотижневий огляд) більше немає.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const TODAY = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const shift = (days) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return iso(d);
};

// horizon: 'month' за замовчуванням — це вкладка, на якій розділ
// відкривається, тож ціль одразу видно. Тести про самі вкладки задають його
// явно, а тест про старі документи поле прибирає.
const goal = (over = {}) => ({
  id: 'g1', title: 'Пробігти 100 км', category: 'health', why: '',
  status: 'active', targetDate: shift(120), horizon: 'month',
  milestones: [], checkins: [], journal: [],
  ...over,
});
/** Ціль без поля horizon — такою її бачить застосунок у старих документах. */
const legacyGoal = (over = {}) => {
  const g = goal(over);
  delete g.horizon;
  return g;
};

async function openGoals(page, goals, opts = {}) {
  await openModule(page, 'goals/index.html', { seed: { goals }, ...opts });
}

test.describe('Дві вкладки: місяць і рік', () => {
  const monthly = goal({ id: 'gm', title: 'Прочитати дві книжки', horizon: 'month' });
  const yearly = goal({ id: 'gy', title: 'Вивчити польську', horizon: 'year' });

  test('вкладка «Місяць» показує лише місячні цілі', async ({ page }) => {
    await openGoals(page, [monthly, yearly]);
    await expect(page.locator('[data-open-goal="gm"]')).toBeVisible();
    await expect(page.locator('[data-open-goal="gy"]')).toHaveCount(0);
  });

  test('вкладка «Рік» показує лише річні', async ({ page }) => {
    await openGoals(page, [monthly, yearly]);
    await page.click('#bnYear');
    await expect(page.locator('[data-open-goal="gy"]')).toBeVisible();
    await expect(page.locator('[data-open-goal="gm"]')).toHaveCount(0);
  });

  test('стара ціль без поля horizon вважається річною', async ({ page }) => {
    await openGoals(page, [legacyGoal({ id: 'old', title: 'Стара ціль' })]);
    await expect(page.locator('[data-open-goal="old"]')).toHaveCount(0);
    await page.click('#bnYear');
    await expect(page.locator('[data-open-goal="old"]')).toBeVisible();
  });

  test('вкладки «Головна» більше немає, але вихід на хаб лишився в шапці', async ({ page }) => {
    await openGoals(page, [monthly]);
    await expect(page.locator('#bnHome')).toHaveCount(0);
    await expect(page.locator('#topbarHomeLink')).toHaveAttribute('href', '../index.html');
  });

  // Селектор саме `#goalsList .empty-state`, а не будь-який на сторінці:
  // у двох колонках (типовий екран тестів — 1280px) праворуч стоять деталі
  // цілі, і в них є свій порожній стан — «ще нема нотаток».
  test('порожній екран питає різне на різних вкладках', async ({ page }) => {
    await openGoals(page, [yearly]);
    await expect(page.locator('#goalsList .empty-state .title')).toContainText(/немає цілей на/i);
    await page.click('#bnYear');
    await expect(page.locator('#goalsList .empty-state')).toHaveCount(0);
  });

  test('вкладка показує рівно свої цілі, скільки б їх не було', async ({ page }) => {
    // Плитки з підсумками згори прибрані, але сам рахунок за вкладкою лишився
    // сенсом: у списку має бути тільки те, що належить видимому горизонту.
    await openGoals(page, [monthly, yearly, goal({ id: 'gy2', title: 'Ще річна', horizon: 'year' })]);
    await expect(page.locator('[data-open-goal]')).toHaveCount(1);
    await page.click('#bnYear');
    await expect(page.locator('[data-open-goal]')).toHaveCount(2);
  });

  test('смужки з підсумками згори більше немає', async ({ page }) => {
    await openGoals(page, [monthly]);
    await expect(page.locator('#summaryStrip')).toHaveCount(0);
    await expect(page.locator('.summary-tile')).toHaveCount(0);
  });

  test('нова ціль успадковує вкладку, з якої її заводять', async ({ page }) => {
    await openGoals(page, [yearly]);
    await page.click('#openNewGoalBtn');
    await expect(page.locator('#horizonPicker [data-horizon="month"]')).toHaveClass(/selected/);
    await page.click('#closeGoalForm');

    await page.click('#bnYear');
    await page.click('#openNewGoalBtn');
    await expect(page.locator('#horizonPicker [data-horizon="year"]')).toHaveClass(/selected/);
  });

  test('горизонт зберігається в записі', async ({ page }) => {
    await openGoals(page, [yearly]);
    await page.click('#openNewGoalBtn');
    await page.fill('#goalTitleInput', 'Місячна ціль');
    await page.click('#goalSubmitBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
    const [add] = await page.evaluate(() => window.__fbCalls.add);
    expect(add.col).toBe('goals');
    expect(add.payload.horizon).toBe('month');
  });
});

// Банер «N цілей чекають на огляд» і окремий екран огляду прибрані на
// прохання: щотижневий ритуал перетворював список на чергу питань. Разом із
// ними пішла й вечірня картка «Як пройшов день?» з тими самими «Було / Не
// вийшло» — відмічати крок можна там, де ціль і живе.
test.describe('Огляду тижня й вечірніх питань немає', () => {
  test('банера огляду немає навіть на цілі, яку жодного разу не переглядали', async ({ page }) => {
    await openGoals(page, [goal()]);
    await expect(page.locator('#reviewBanner')).toHaveCount(0);
    await expect(page.locator('.review-banner')).toHaveCount(0);
    await expect(page.locator('#dashboardScreen')).not.toContainText('на огляд');
  });

  test('окремого екрана огляду немає в розмітці', async ({ page }) => {
    await openGoals(page, [goal()]);
    await expect(page.locator('#reviewScreen')).toHaveCount(0);
    await expect(page.locator('.review-item')).toHaveCount(0);
  });

  test('вечірньої картки «Як пройшов день?» немає', async ({ page }) => {
    await openGoals(page, [goal()]);
    await expect(page.locator('#eveningCard')).toHaveCount(0);
    await expect(page.locator('.evening-card')).toHaveCount(0);
    await expect(page.locator('#dashboardScreen')).not.toContainText('Як пройшов день');
  });

  test('відмітити день усе одно є де — на самій цілі', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#streakToggleBtn');
    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.col).toBe('goals');
    expect(upd.payload.checkins).toBeTruthy();
  });
});

test.describe('Що заважає найчастіше', () => {
  const withBlockers = goal({
    id: 'gb', title: 'Біг',
    blockers: [
      { date: shift(-1), reason: 'noTime' },
      { date: shift(-2), reason: 'noTime' },
      { date: shift(-3), reason: 'tired' },
    ],
  });

  test('причини видно на екрані цілі, за спаданням частоти', async ({ page }) => {
    await openGoals(page, [withBlockers]);
    await page.click('[data-open-goal="gb"]');
    const chips = page.locator('#detailBlockersBlock .blocker-chip');
    await expect(chips).toHaveCount(2);
    // Найчастіша попереду: людина мусить побачити головну перешкоду першою.
    await expect(chips.first()).toContainText('Не було часу');
    await expect(chips.first()).toContainText('2');
  });

  test('без пропусків блок не показуємо — докоряти нема за що', async ({ page }) => {
    await openGoals(page, [goal({ id: 'gc', title: 'Чиста' })]);
    await page.click('[data-open-goal="gc"]');
    await expect(page.locator('#detailBlockersBlock .blockers')).toHaveCount(0);
  });
});

test.describe('Пауза', () => {
  test('кнопка ставить ціль на паузу', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#pauseToggleBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.status).toBe('paused');
  });

  test('у закритої цілі кнопки паузи немає — там нема чого паузити', async ({ page }) => {
    await openGoals(page, [goal({ status: 'done' })]);
    await page.click('.tag-filter-chip:has-text("Завершені")');
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('#pauseToggleBtn')).toHaveCount(0);
  });

  // Архів жив лише в екрані огляду; разом з ним він би зник зовсім, хоч
  // фільтр «Архів» лишився. Тому кнопка тепер стоїть поруч із паузою.
  test('ціль можна перенести в архів прямо з її екрана', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#archiveGoalBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.status).toBe('archived');
  });

  test('у вже архівної цілі кнопок паузи й архіву немає', async ({ page }) => {
    await openGoals(page, [goal({ status: 'archived' })]);
    await page.click('.tag-filter-chip:has-text("Архів")');
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('#archiveGoalBtn')).toHaveCount(0);
    await expect(page.locator('#pauseToggleBtn')).toHaveCount(0);
  });

  test('у фільтрі зʼявився стан «На паузі»', async ({ page }) => {
    await openGoals(page, [goal({ status: 'paused' })]);
    await expect(page.locator('.tag-filter-chip:has-text("На паузі")')).toBeVisible();
  });
});

test.describe('Ретроспектива завершених', () => {
  // Ціль, закрита `daysAgo` днів тому, що прожила `lived` днів.
  const closed = (id, title, daysAgo, lived) => goal({
    id, title, status: 'done',
    completedAt: shift(-daysAgo),
    createdAt: { __ts: shift(-(daysAgo + lived)) },
  });

  const openDone = async (page, goals) => {
    await openGoals(page, goals);
    await page.click('.tag-filter-chip:has-text("Завершені")');
  };

  test('на активному списку ретроспективи немає — вона про озирання назад', async ({ page }) => {
    await openGoals(page, [goal(), closed('d1', 'Закрита', 10, 40)]);
    await expect(page.locator('#retroBlock .retro')).toHaveCount(0);
  });

  test('фільтр «Завершені» показує, скільки цілей закрито', async ({ page }) => {
    await openDone(page, [closed('d1', 'Перша', 10, 40), closed('d2', 'Друга', 30, 12)]);
    await expect(page.locator('.retro-count')).toHaveText('Закрито цілей: 2');
  });

  test('картка завершеної цілі каже, скільки та зайняла', async ({ page }) => {
    await openDone(page, [closed('d1', 'Перша', 10, 40)]);
    await expect(page.locator('[data-open-goal="d1"] .goal-card-days')).toHaveText('40 дн.');
  });

  test('ціль, закрита того ж дня, не показує «0 дн.»', async ({ page }) => {
    await openDone(page, [closed('d1', 'Швидка', 5, 0)]);
    await expect(page.locator('[data-open-goal="d1"] .goal-card-days')).toHaveText('того ж дня');
  });

  test('типова тривалість і розкид стоять поруч із кількістю', async ({ page }) => {
    await openDone(page, [
      closed('d1', 'Перша', 10, 40), closed('d2', 'Друга', 30, 12), closed('d3', 'Третя', 50, 20),
    ]);
    await expect(page.locator('.retro-span')).toHaveText('типово 20 дн. · від 12 до 40 дн.');
  });

  test('одна ціль — розкиду немає, і «від 40 до 40» не пишемо', async ({ page }) => {
    await openDone(page, [closed('d1', 'Перша', 10, 40)]);
    await expect(page.locator('.retro-span')).toHaveText('типово 40 дн.');
  });

  test('«За весь час» дістає те, що не влізло в рік', async ({ page }) => {
    await openDone(page, [closed('d1', 'Свіжа', 10, 40), closed('old', 'Позаторішня', 500, 30)]);
    await expect(page.locator('.retro-count')).toHaveText('Закрито цілей: 1');
    await expect(page.locator('[data-open-goal="old"]')).toBeVisible();

    await page.click('[data-retro=""]');
    await expect(page.locator('.retro-count')).toHaveText('Закрито цілей: 2');
  });

  test('за рік нічого — блок каже про це, а не зникає разом із перемикачем', async ({ page }) => {
    await openDone(page, [closed('old', 'Позаторішня', 500, 30)]);
    await expect(page.locator('.retro-count')).toHaveText('За цей період нічого не закрито');
    await expect(page.locator('[data-retro=""]')).toBeVisible();
  });

  test('не закрито жодної цілі — блока немає взагалі', async ({ page }) => {
    await openDone(page, [goal({ id: 'a1', status: 'active' })]);
    await expect(page.locator('#retroBlock .retro')).toHaveCount(0);
  });

  test('ретроспектива рахує лише свою вкладку', async ({ page }) => {
    await openDone(page, [
      closed('dm', 'Місячна', 10, 40),
      goal({ id: 'dy', title: 'Річна', status: 'done', horizon: 'year', completedAt: shift(-20), createdAt: { __ts: shift(-60) } }),
    ]);
    await expect(page.locator('.retro-count')).toHaveText('Закрито цілей: 1');
  });

  test('закриття цілі проставляє дату — інакше тривалість нема з чого рахувати', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#markDoneBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.status).toBe('done');
    expect(upd.payload.completedAt).toBe(iso(TODAY));
  });

  test('будь-який інший статус дати закриття по собі не лишає', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#pauseToggleBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.status).toBe('paused');
    expect(upd.payload.completedAt).toBeNull();
  });
});

test.describe('Поля форми ростуть під текст', () => {
  const LONG = 'Написати собі чіткий план тренувань до кінця року і не злити його на другому тижні';
  const LONG_WHY = 'який буде досить таки ефективним для мене та просто буду його дотримуватись, '
    + 'а не думати кожен тиждень, а як мені тренуватись і чи взагалі варто це робити саме сьогодні';

  const height = (page, id = 'goalTitleInput') => page.evaluate((i) =>
    document.getElementById(i).getBoundingClientRect().height, id);
  /** scrollHeight понад clientHeight означає, що частину тексту сховано. */
  const clipped = (page, id) => page.evaluate((i) => {
    const el = document.getElementById(i);
    return el.scrollHeight > el.clientHeight + 1;
  }, id);

  test('довга назва переноситься, а поле стає вищим', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#openNewGoalBtn');
    const before = await height(page);
    await page.fill('#goalTitleInput', LONG);
    expect(await height(page)).toBeGreaterThan(before);
  });

  test('нічого не лишається за краєм — гортати поле не доводиться', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#openNewGoalBtn');
    await page.fill('#goalTitleInput', LONG);
    expect(await clipped(page, 'goalTitleInput')).toBe(false);
  });

  test('коротка назва лишається в один рядок', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#openNewGoalBtn');
    const empty = await height(page);
    await page.fill('#goalTitleInput', 'Бігати');
    expect(await height(page)).toBe(empty);
  });

  // Вікно відкривається з уже набраною назвою, і висота має бути правильною
  // одразу: рахувати її можна лише після показу вікна — у схованому
  // scrollHeight дорівнює нулю.
  test('уже збережена довга назва відкривається розгорнутою', async ({ page }) => {
    await openGoals(page, [goal({ title: LONG })]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#detailEditBtn');
    expect(await clipped(page, 'goalTitleInput')).toBe(false);
  });

  // «Навіщо» — те саме, тільки поле від початку багаторядкове: воно крутилось
  // усередині віконця на три рядки, хоч перечитати написане цілком і є те,
  // заради чого воно існує.
  test('довге «навіщо» розгортається, а не крутиться всередині', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#openNewGoalBtn');
    const before = await height(page, 'goalWhyInput');
    await page.fill('#goalWhyInput', LONG_WHY);
    expect(await height(page, 'goalWhyInput')).toBeGreaterThan(before);
    expect(await clipped(page, 'goalWhyInput')).toBe(false);
  });

  // Поле мусить і зменшуватись: інакше текст можна було б лише додавати, а
  // стерши половину, лишитись із порожнім місцем на пів екрана.
  test('стерте «навіщо» повертає полю висоту, а не лишає діру', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#openNewGoalBtn');
    const empty = await height(page, 'goalWhyInput');
    await page.fill('#goalWhyInput', LONG_WHY);
    await page.fill('#goalWhyInput', 'коротко');
    expect(await height(page, 'goalWhyInput')).toBe(empty);
  });

  test('уже збережене довге «навіщо» відкривається розгорнутим', async ({ page }) => {
    await openGoals(page, [goal({ why: LONG_WHY })]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#detailEditBtn');
    expect(await clipped(page, 'goalWhyInput')).toBe(false);
  });

  // Протилежність назві: тут абзаци, і зберігати ціль на пів слові було б
  // несподіванкою.
  test('Enter у «навіщо» додає рядок, а не зберігає ціль', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#openNewGoalBtn');
    await page.fill('#goalTitleInput', 'Ціль');
    await page.click('#goalWhyInput');
    await page.keyboard.type('перший');
    await page.keyboard.press('Enter');
    await page.keyboard.type('другий');

    await expect(page.locator('#goalFormOverlay')).toHaveClass(/show/);
    expect(await page.inputValue('#goalWhyInput')).toBe('перший\nдругий');
    const added = await page.evaluate(() => window.__fbCalls.add.filter((c) => c.col === 'goals').length);
    expect(added).toBe(0);
  });

  // Поле стало багаторядковим, але назва — ні: Enter у ньому робить те саме,
  // що робив в однорядковому input.
  test('Enter зберігає ціль, а не додає рядок', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#openNewGoalBtn');
    await page.fill('#goalTitleInput', 'Нова ціль');
    await page.press('#goalTitleInput', 'Enter');

    await expect.poll(() => page.evaluate(() =>
      window.__fbCalls.add.filter((c) => c.col === 'goals').length)).toBeGreaterThan(0);
    const added = await page.evaluate(() =>
      window.__fbCalls.add.filter((c) => c.col === 'goals').at(-1));
    expect(added.payload.title).toBe('Нова ціль');
  });

  test('переноси, що приїхали вставкою, склеюються пробілом', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#openNewGoalBtn');
    await page.evaluate(() => {
      const el = document.getElementById('goalTitleInput');
      el.value = 'Пробігти\n100 км';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#goalSubmitBtn');

    await expect.poll(() => page.evaluate(() =>
      window.__fbCalls.add.filter((c) => c.col === 'goals').length)).toBeGreaterThan(0);
    const added = await page.evaluate(() =>
      window.__fbCalls.add.filter((c) => c.col === 'goals').at(-1));
    expect(added.payload.title).toBe('Пробігти 100 км');
  });
});

test.describe('Автофокус, який не перебиває', () => {
  test('форма не забирає фокус із поля, яке вже заповнюють', async ({ page }) => {
    // Автофокус на назві спрацьовував через 50 мс — і якщо в цей момент уже
    // заповнювали інше поле, набране летіло в назву, а поле лишалось порожнім.
    await openGoals(page, [goal()]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#detailEditBtn');
    await page.focus('#goalWhyInput');
    // Довше за саму затримку автофокуса: якщо він спрацює попри зайняте
    // поле, фокус до цього моменту вже поїде на назву.
    await page.waitForTimeout(250);
    const active = await page.evaluate(() => document.activeElement.id);
    expect(active).toBe('goalWhyInput');
  });
});

test.describe('Повернення після перерви', () => {
  const abandoned = (over = {}) => goal({
    checkins: [shift(-30)], createdAt: { __ts: shift(-90) }, ...over,
  });

  test('після трьох тижнів мовчання ціль зустрічає поверненням, а не докором', async ({ page }) => {
    await openGoals(page, [abandoned()]);
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('.lapse-title')).toHaveText('Тебе не було 30 дн.');
  });

  test('живу ціль ніхто не турбує', async ({ page }) => {
    await openGoals(page, [abandoned({ checkins: [shift(-2)] })]);
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('.lapse')).toHaveCount(0);
  });

  test('є три виходи, і жоден не спрацьовує сам', async ({ page }) => {
    await openGoals(page, [abandoned()]);
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('#lapseRestartBtn')).toBeVisible();
    await expect(page.locator('#lapseEditBtn')).toBeVisible();
    await expect(page.locator('#lapsePauseBtn')).toBeVisible();
    expect(await page.evaluate(() => window.__fbCalls.update.length)).toBe(0);
  });

  test('«почати заново» ставить нову точку відліку', async ({ page }) => {
    await openGoals(page, [abandoned()]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#lapseRestartBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.restartedAt).toBe(iso(TODAY));
    // Історію не чіпаємо: пройдене лишається пройденим.
    expect(upd.payload.checkins).toBeUndefined();
    expect(upd.payload.milestones).toBeUndefined();
  });

  test('після перезапуску ціль перестає виглядати покинутою', async ({ page }) => {
    await openGoals(page, [abandoned({ restartedAt: shift(-1) })]);
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('.lapse')).toHaveCount(0);
  });

  test('«на паузу» лишається одним із виходів', async ({ page }) => {
    await openGoals(page, [abandoned()]);
    await page.click('[data-open-goal="g1"]');
    await page.click('#lapsePauseBtn');
    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.status).toBe('paused');
  });

  test('ціль, у якій не було жодного кроку, говорить про це прямо', async ({ page }) => {
    await openGoals(page, [goal({ checkins: [], createdAt: { __ts: shift(-40) } })]);
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('.lapse-title')).toContainText('без жодного кроку');
  });
});

test.describe('Сітка відміток', () => {
  const withCheckins = (over = {}) => goal({
    checkins: [shift(-1), shift(-3), shift(-10)], ...over,
  });

  const openDetail = async (page, goals) => {
    await openGoals(page, goals);
    await page.click('[data-open-goal="g1"]');
  };

  test('вісім тижнів по сім днів', async ({ page }) => {
    await openDetail(page, [withCheckins()]);
    await expect(page.locator('.grid-cell')).toHaveCount(56);
  });

  test('відмічені дні пофарбовані', async ({ page }) => {
    await openDetail(page, [withCheckins()]);
    await expect(page.locator('.grid-cell.done')).toHaveCount(3);
  });

  test('сьогодні виділене рівно один раз', async ({ page }) => {
    await openDetail(page, [withCheckins()]);
    await expect(page.locator('.grid-cell.today')).toHaveCount(1);
  });

  test('день із названою причиною виглядає інакше за мовчазний пропуск', async ({ page }) => {
    await openDetail(page, [withCheckins({
      blockers: [{ date: shift(-2), reason: 'Втома' }],
    })]);
    await expect(page.locator('.grid-cell.blocked')).toHaveCount(1);
  });

  test('без жодної відмітки сітки немає — порожня нічого не каже', async ({ page }) => {
    await openDetail(page, [goal({ checkins: [] })]);
    await expect(page.locator('.grid')).toHaveCount(0);
  });

  test('майбутні дні не пофарбовані як пропуск', async ({ page }) => {
    await openDetail(page, [withCheckins()]);
    // Останній рядок сітки — поточний тиждень (пн—нд), тож майбутніх клітинок
    // рівно стільки, скільки днів лишилось до неділі. Раніше тут стояло
    // «більше нуля» — і в неділю, коли їх законно нуль, тест падав. Точне
    // число і перевіряє більше, і не залежить від дня тижня.
    const dow = (TODAY.getDay() + 6) % 7;
    await expect(page.locator('.grid-cell.future')).toHaveCount(6 - dow);
    await expect(page.locator('.grid-cell.future.done')).toHaveCount(0);
  });
});

test.describe('Який зараз місяць', () => {
  const curMonth = iso(TODAY).slice(0, 7);
  const prevMonthKey = () => {
    const d = new Date(TODAY);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthly = (id, month, over = {}) =>
    goal({ id, horizon: 'month', month, ...over });

  test('вкладка «Місяць» називає місяць, а не просто «місяць»', async ({ page }) => {
    await openGoals(page, [monthly('a', curMonth)]);
    await expect(page.locator('.month-name')).toBeVisible();
    await expect(page.locator('.month-name')).not.toHaveText('');
  });

  test('на вкладці «Рік» заголовка місяця немає — там він ні до чого', async ({ page }) => {
    await openGoals(page, [goal({ horizon: 'year' })]);
    await page.click('#bnYear');
    await expect(page.locator('.month-header')).toHaveCount(0);
  });

  test('видно цілі саме цього місяця', async ({ page }) => {
    await openGoals(page, [
      monthly('now', curMonth),
      monthly('old', prevMonthKey(), { status: 'done' }),
    ]);
    await expect(page.locator('[data-open-goal="now"]')).toBeVisible();
    await expect(page.locator('[data-open-goal="old"]')).toHaveCount(0);
  });

  test('незакрита ціль з минулого місяця не зникає, і видно, звідки вона', async ({ page }) => {
    await openGoals(page, [monthly('old', prevMonthKey(), { status: 'active' })]);
    await expect(page.locator('[data-open-goal="old"]')).toBeVisible();
    await expect(page.locator('.goal-carried')).toBeVisible();
  });

  test('стрілка гортає місяці', async ({ page }) => {
    await openGoals(page, [monthly('now', curMonth)]);
    const start = await page.locator('.month-name').textContent();
    await page.click('#monthPrev');
    await expect(page.locator('.month-name')).not.toHaveText(start);
    await expect(page.locator('[data-open-goal="now"]')).toHaveCount(0);
  });

  test('тап по назві вертає в поточний місяць', async ({ page }) => {
    await openGoals(page, [monthly('now', curMonth)]);
    const start = await page.locator('.month-name').textContent();
    await page.click('#monthPrev');
    await page.click('#monthNow');
    await expect(page.locator('.month-name')).toHaveText(start);
    await expect(page.locator('[data-open-goal="now"]')).toBeVisible();
  });

  test('у минулому місяці перенесення немає — там показано, що було тоді', async ({ page }) => {
    await openGoals(page, [monthly('now', curMonth, { status: 'active' })]);
    await page.click('#monthPrev');
    await expect(page.locator('[data-open-goal="now"]')).toHaveCount(0);
  });

  test('форма каже, в який місяць піде ціль', async ({ page }) => {
    await openGoals(page, [monthly('now', curMonth)]);
    await page.click('#openNewGoalBtn');
    await expect(page.locator('#horizonHint')).toContainText('піде в');
  });

  test('нова ціль зберігається з видимим місяцем', async ({ page }) => {
    await openGoals(page, [monthly('now', curMonth)]);
    await page.click('#monthPrev');
    await page.click('#openNewGoalBtn');
    await page.fill('#goalTitleInput', 'Ціль минулого місяця');
    await page.click('#goalSubmitBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBeGreaterThan(0);
    const added = await page.evaluate(() => window.__fbCalls.add.at(-1));
    expect(added.payload.horizon).toBe('month');
    expect(added.payload.month).toBe(prevMonthKey());
  });

  test('річна ціль місяця не отримує', async ({ page }) => {
    await openGoals(page, [goal({ horizon: 'year' })]);
    await page.click('#bnYear');
    await page.click('#openNewGoalBtn');
    await page.fill('#goalTitleInput', 'Річна');
    await page.click('#goalSubmitBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBeGreaterThan(0);
    const added = await page.evaluate(() => window.__fbCalls.add.at(-1));
    expect(added.payload.month).toBeNull();
  });

  test('правка місячної цілі не переносить її в видимий місяць', async ({ page }) => {
    const own = prevMonthKey();
    await openGoals(page, [monthly('old', own, { status: 'active' })]);
    await page.click('[data-open-goal="old"]');
    await page.click('#detailEditBtn');
    await page.click('#goalSubmitBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update.at(-1));
    expect(upd.payload.month).toBe(own);
  });

  test('порожній місяць називає себе на імʼя', async ({ page }) => {
    await openGoals(page, [monthly('now', curMonth)]);
    await page.click('#monthPrev');
    await expect(page.locator('.empty-state .title')).toContainText('Немає цілей на');
  });
});
