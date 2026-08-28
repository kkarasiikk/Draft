// Довга петля цілей: темп, пауза й огляд тижня.
//
// Модуль називається «довгострокові цілі», а вся механіка працювала з одним
// днем: серія, вечірнє «чи був крок». Ціль із дедлайном через вісім місяців
// отримувала щовечора «так/ні» — і попередження за три дні до кінця.
// Перевіряємо саме те, що заповнює цю прогалину.
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

  test('порожній екран питає різне на різних вкладках', async ({ page }) => {
    await openGoals(page, [yearly]);
    await expect(page.locator('.empty-state .title')).toContainText(/місяць/i);
    await page.click('#bnYear');
    await expect(page.locator('.empty-state')).toHaveCount(0);
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

  test('вечірня картка питає про всі цілі, а не лише про видиму вкладку', async ({ page }) => {
    // Серія тримається на тому, що людина не забула: рватись мовчки, поки
    // відкрито інший горизонт, вона не має.
    await page.clock.install({ time: new Date(new Date().setHours(20, 0, 0, 0)) });
    await openGoals(page, [monthly, yearly]);
    await expect(page.locator('.evening-goal')).toHaveCount(2);
  });
});

test.describe('Огляд тижня', () => {
  test('банер зʼявляється, коли ціль ще не оглядали', async ({ page }) => {
    await openGoals(page, [goal()]);
    await expect(page.locator('#reviewBanner .review-banner-text')).toBeVisible();
  });

  test('оглянуту цього тижня ціль банер не показує', async ({ page }) => {
    await openGoals(page, [goal({ reviewedAt: shift(-2) })]);
    await page.waitForTimeout(300);
    await expect(page.locator('#reviewBanner .review-banner-text')).toHaveCount(0);
  });

  test('«Пізніше» ховає банер до кінця дня', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#reviewLaterBtn');
    await expect(page.locator('#reviewBanner .review-banner-text')).toHaveCount(0);
  });

  test('банер веде на екран, де ціль треба вирішити', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#reviewBannerBtn');
    await expect(page.locator('#reviewScreen')).toBeVisible();
    await expect(page.locator('.review-item')).toHaveCount(1);
    // Чотири рішення, як у «розборі минулих днів»: нічого не вирішується само.
    // Саме в рядку дій — у прихованому рядку зсуву дедлайну є ще своя кнопка.
    await expect(page.locator('.review-item .review-actions .review-btn')).toHaveCount(4);
  });

  test('«нічого не зрушило» кажеться чесно', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#reviewBannerBtn');
    await expect(page.locator('.review-moved')).toContainText(/нічого/i);
  });

  test('«Веду далі» пише дату огляду й прибирає ціль із черги', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#reviewBannerBtn');
    await page.click('[data-keep="g1"]');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update[0]);
    expect(upd.col).toBe('goals');
    expect(upd.payload.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(page.locator('.review-item')).toHaveCount(0);
  });

  test('«На паузу» — це один запис, а не два: і статус, і огляд', async ({ page }) => {
    await openGoals(page, [goal()]);
    await page.click('#reviewBannerBtn');
    await page.click('[data-pause="g1"]');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.update.length)).toBeGreaterThan(0);
    const upd = await page.evaluate(() => window.__fbCalls.update[0]);
    expect(upd.payload.status).toBe('paused');
    expect(upd.payload.reviewedAt).toBeTruthy();
  });

  test('«навіщо» показується на огляді — його читають саме тут', async ({ page }) => {
    await openGoals(page, [goal({ why: 'щоб пробігти півмарафон' })]);
    await page.click('#reviewBannerBtn');
    await expect(page.locator('.review-why')).toContainText('півмарафон');
  });
});

test.describe('Темп на екрані цілі', () => {
  test('поки історії мало — чесне «даних замало», а не вигаданий прогноз', async ({ page }) => {
    await openGoals(page, [goal({ targetValue: 100, currentValue: 3, progressLog: [{ date: shift(-1), delta: 3 }] })]);
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('#detailPaceBlock .pace')).toBeVisible();
    // Без достатньої історії прогнозної дати бути не повинно.
    await expect(page.locator('#detailPaceBlock')).not.toContainText(/Таким темпом/);
  });

  test('повільний темп читається як «не встигаєш»', async ({ page }) => {
    const log = [];
    for (let i = 60; i >= 0; i -= 3) log.push({ date: shift(-i), delta: 0.1 });
    await openGoals(page, [goal({ targetValue: 100, currentValue: 2, progressLog: log })]);
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('#detailPaceBlock .pace.behind')).toBeVisible();
  });

  test('без дедлайну темп не показуємо — його нема з чим порівняти', async ({ page }) => {
    await openGoals(page, [goal({ targetDate: null, targetValue: 100, currentValue: 10 })]);
    await page.click('[data-open-goal="g1"]');
    await expect(page.locator('#detailPaceBlock .pace')).toHaveCount(0);
  });
});

test.describe('Драбина: місяць → рік', () => {
  const year = goal({ id: 'gy', title: 'Пробігти 200 км', horizon: 'year' });
  const month = goal({ id: 'gm', title: 'Цього місяця 20 км', horizon: 'month',
    parentGoalId: 'gy', targetValue: 20, currentValue: 5 });

  test('річна ціль показує, що на неї працює', async ({ page }) => {
    await openGoals(page, [year, month]);
    await page.click('#bnYear');
    await page.click('[data-open-goal="gy"]');
    await expect(page.locator('#detailChildrenBlock .child-row')).toHaveCount(1);
    await expect(page.locator('.child-title')).toContainText('20 км');
    await expect(page.locator('.child-pct')).toContainText('25%');
  });

  test('місячна показує, кому служить, і веде до неї', async ({ page }) => {
    await openGoals(page, [year, month]);
    await page.click('[data-open-goal="gm"]');
    await expect(page.locator('#parentLinkBtn')).toContainText('Пробігти 200 км');
    // Звʼязок без переходу — це напис, а не звʼязок.
    await page.click('#parentLinkBtn');
    await expect(page.locator('#detailTitleLabel')).toContainText('Пробігти 200 км');
  });

  test('річній цілі пікера батька не показуємо — рік нікому не служить', async ({ page }) => {
    await openGoals(page, [year]);
    await page.click('#bnYear');
    await page.click('#openNewGoalBtn');
    await expect(page.locator('#parentBlock')).toBeHidden();
  });

  test('на місячній пікер є, і в ньому лише річні цілі', async ({ page }) => {
    await openGoals(page, [year, month]);
    await page.click('#openNewGoalBtn');
    await expect(page.locator('#parentBlock')).toBeVisible();
    // «Сама по собі» + одна річна; місячної в списку бути не може.
    await expect(page.locator('#parentPicker .choice')).toHaveCount(2);
    await expect(page.locator('#parentPicker')).toContainText('Пробігти 200 км');
    await expect(page.locator('#parentPicker')).not.toContainText('Цього місяця');
  });

  test('звʼязок зберігається в записі', async ({ page }) => {
    await openGoals(page, [year]);
    await page.click('#openNewGoalBtn');
    await page.fill('#goalTitleInput', 'Нова місячна');
    await page.click('#parentPicker [data-parent="gy"]');
    await page.click('#goalSubmitBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
    const [add] = await page.evaluate(() => window.__fbCalls.add);
    expect(add.payload.parentGoalId).toBe('gy');
    expect(add.payload.horizon).toBe('month');
  });

  test('перемикання на «Річна» знімає звʼязок, а не ховає його', async ({ page }) => {
    await openGoals(page, [year]);
    await page.click('#openNewGoalBtn');
    await page.fill('#goalTitleInput', 'Перемикач');
    await page.click('#parentPicker [data-parent="gy"]');
    await page.click('#horizonPicker [data-horizon="year"]');
    await page.click('#goalSubmitBtn');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBe(1);
    const [add] = await page.evaluate(() => window.__fbCalls.add);
    expect(add.payload.parentGoalId).toBeNull();
  });

  test('без річних цілей пікер пояснює, чому він порожній', async ({ page }) => {
    await openGoals(page, [month]);
    await page.click('#openNewGoalBtn');
    await expect(page.locator('#parentHint')).toContainText(/ще немає/i);
    await expect(page.locator('#parentPicker .choice')).toHaveCount(0);
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

  test('причини підказують відповідь і в огляді тижня', async ({ page }) => {
    await openGoals(page, [withBlockers]);
    await page.click('#reviewBannerBtn');
    await expect(page.locator('.review-blockers')).toContainText('Не було часу');
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
    await openGoals(page, [goal({
      milestones: [{ id: 'm1', title: 'єдиний крок', done: true, doneAt: shift(-1) }],
    })]);
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

test.describe('Віха стає завданням', () => {
  const withMilestones = (over = {}) => goal({
    milestones: [
      { id: 'm1', title: 'Пробігти перші 10 км', done: false, date: shift(14) },
      { id: 'm2', title: 'Пробігти 50 км', done: false },
      { id: 'm0', title: 'Купити кросівки', done: true, doneAt: shift(-3) },
    ],
    ...over,
  });

  const openDetail = async (page, goals = [withMilestones()], tasks = []) => {
    await openGoals(page, goals, { seed: { goals, tasks } });
    await page.click('[data-open-goal="g1"]');
  };

  test('у невиконаної віхи є кнопка, у пройденої — немає', async ({ page }) => {
    await openDetail(page);
    await expect(page.locator('[data-milestone-task="m1"]')).toBeVisible();
    await expect(page.locator('[data-milestone-task="m0"]')).toHaveCount(0);
  });

  test('кнопка створює завдання з назвою віхи і привʼязкою до цілі', async ({ page }) => {
    await openDetail(page);
    await page.click('[data-milestone-task="m1"]');

    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBeGreaterThan(0);
    const added = await page.evaluate(() => window.__fbCalls.add.at(-1));
    expect(added.payload.title).toBe('Пробігти перші 10 км');
    expect(added.payload.goalId).toBe('g1');
    expect(added.payload.done).toBe(false);
  });

  test('завдання стає на дату віхи — це її план, а не «колись»', async ({ page }) => {
    await openDetail(page);
    await page.click('[data-milestone-task="m1"]');
    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBeGreaterThan(0);
    const added = await page.evaluate(() => window.__fbCalls.add.at(-1));
    expect(added.payload.dueDate).toBe(shift(14));
  });

  test('віха без дати йде на сьогодні — завдання без дати нікуди не спливе', async ({ page }) => {
    await openDetail(page);
    await page.click('[data-milestone-task="m2"]');
    await expect.poll(() => page.evaluate(() => window.__fbCalls.add.length)).toBeGreaterThan(0);
    const added = await page.evaluate(() => window.__fbCalls.add.at(-1));
    expect(added.payload.dueDate).toBe(iso(TODAY));
  });

  test('коли завдання вже є, кнопки немає — другого такого ж не заводимо', async ({ page }) => {
    await openDetail(page, [withMilestones()], [
      { id: 't1', title: 'Пробігти перші 10 км', done: false, goalId: 'g1', dueDate: shift(14) },
    ]);
    await expect(page.locator('[data-milestone-task="m1"]')).toHaveCount(0);
    await expect(page.locator('.journey-task-mark')).toBeVisible();
    // Друга віха свою кнопку зберігає: збіг назв — це про одну справу, не про всі.
    await expect(page.locator('[data-milestone-task="m2"]')).toBeVisible();
  });

  test('виконане завдання кнопку повертає — крок можна поставити знову', async ({ page }) => {
    await openDetail(page, [withMilestones()], [
      { id: 't1', title: 'Пробігти перші 10 км', done: true, goalId: 'g1', dueDate: shift(-1) },
    ]);
    await expect(page.locator('[data-milestone-task="m1"]')).toBeVisible();
  });
});

test.describe('Графік прогресу', () => {
  const measured = (over = {}) => goal({
    targetValue: 100, currentValue: 9, unit: 'км',
    progressLog: [
      { date: shift(-20), delta: 2 },
      { date: shift(-12), delta: 3 },
      { date: shift(-4), delta: 4 },
    ],
    ...over,
  });

  const openDetail = async (page, goals) => {
    await openGoals(page, goals);
    await page.click(`[data-open-goal="${goals[0].id}"]`);
  };

  test('на екрані цілі видно лінію пройденого', async ({ page }) => {
    await openDetail(page, [measured()]);
    await expect(page.locator('.chart')).toBeVisible();
    await expect(page.locator('.chart-line')).toBeVisible();
  });

  test('поруч стоїть, де ти зараз', async ({ page }) => {
    await openDetail(page, [measured()]);
    await expect(page.locator('.chart-now')).toHaveText('9 / 100 км');
  });

  test('є дедлайн — є пунктир «щоб устигнути»', async ({ page }) => {
    await openDetail(page, [measured({ targetDate: shift(100) })]);
    await expect(page.locator('.chart-required')).toBeVisible();
  });

  test('без дедлайну пунктира немає — рівного темпу нізвідки взяти', async ({ page }) => {
    await openDetail(page, [measured({ targetDate: null })]);
    await expect(page.locator('.chart-line')).toBeVisible();
    await expect(page.locator('.chart-required')).toHaveCount(0);
  });

  test('без історії графіка немає — одна крапка це не лінія', async ({ page }) => {
    await openDetail(page, [goal({ targetValue: 100, currentValue: 0, progressLog: [] })]);
    await expect(page.locator('.chart')).toHaveCount(0);
  });

  test('лінія росте, а не стрибає: крапки йдуть вгору', async ({ page }) => {
    await openDetail(page, [measured()]);
    const pts = await page.locator('.chart-line').getAttribute('points');
    const ys = pts.trim().split(/\s+/).map((p) => Number(p.split(',')[1]));
    // Вісь Y у SVG росте вниз, тож накопичений прогрес має спадати за y.
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]);
  });

  test('ціль на віхах теж отримує лінію — без жодного числа', async ({ page }) => {
    await openDetail(page, [goal({
      id: 'gm', targetValue: null,
      milestones: [
        { id: 'm1', title: 'a', done: true, doneAt: shift(-20) },
        { id: 'm2', title: 'b', done: true, doneAt: shift(-5) },
        { id: 'm3', title: 'c', done: false },
      ],
    })]);
    await expect(page.locator('.chart-now')).toHaveText('2 / 3');
  });
});
