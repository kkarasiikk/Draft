// У тренуваннях більше нічого не зараховується в ціль.
//
// Після сьогоднішнього тренування вгорі стояла картка з цілями категорії
// «здоровʼя», і «Зарахувати день» відмічав день у серії одним тапом. Серії
// немає — зараховувати нема куди, тож пішла й картка.
//
// Тест лишається саме тому, що місток був двобічним: разом із карткою
// зникли підписка розділу на цілі й підключення goals/streak.js. Якщо колись
// повернеться щось із цього, воно має повертатись свідомо, а не випадково.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');

const iso = (d) => d.toISOString().slice(0, 10);
const TODAY = iso(new Date());

const session = (date) => ({
  id: 'w1', date, name: 'Ранок', notes: '',
  exercises: [{ id: 'e1', libId: 'benchPress', name: 'Жим лежачи', sets: [{ weight: 60, reps: 8 }] }],
});

const goal = {
  id: 'g1', title: 'Пробігти 100 км', category: 'health', why: '',
  status: 'active', targetDate: null, horizon: 'year',
  milestones: [], checkins: [], journal: [],
};

const open = (page) => openModule(page, 'workout/index.html', {
  seed: { workouts: [session(TODAY)], goals: [goal] },
});

test('після сьогоднішнього тренування картки зарахування немає', async ({ page }) => {
  await open(page);
  await expect(page.locator('.goal-credit')).toHaveCount(0);
  await expect(page.locator('[data-credit-day]')).toHaveCount(0);
  await expect(page.locator('#appScreen')).not.toContainText('Пробігти 100 км');
});

test('модуль більше не тягне goals/streak.js', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => typeof window.GoalStreak)).toBe('undefined');
  expect(await page.evaluate(() =>
    Array.from(document.scripts).some((x) => x.src.includes('streak.js')))).toBe(false);
});
