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

const goal = (over = {}) => ({
  id: 'g1', title: 'Пробігти 100 км', category: 'health', why: '',
  status: 'active', targetDate: shift(120),
  milestones: [], checkins: [], journal: [],
  ...over,
});

async function openGoals(page, goals, opts = {}) {
  await openModule(page, 'goals/index.html', { seed: { goals }, ...opts });
}

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
