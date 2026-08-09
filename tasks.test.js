// tasks.js require()-ить firebase-admin/firebase-functions на верхньому рівні,
// тож для чистого юніт-тесту computeReminderAt (яка сама по собі не чіпає
// жодного з них) мокаємо обидва мінімально, як і в ai.test.js.
jest.mock("firebase-admin", () => ({
  firestore: () => ({}),
}));
jest.mock("firebase-functions", () => ({
  pubsub: { schedule: () => ({ onRun: () => null }) },
}));

const { computeReminderAt } = require("./tasks");

describe("computeReminderAt", () => {
  test("повертає null, якщо немає дедлайну", () => {
    expect(computeReminderAt(null, null, 10)).toBeNull();
  });

  test("повертає null, якщо нагадування вимкнено", () => {
    expect(computeReminderAt("2026-08-10", "09:00", null)).toBeNull();
  });

  test("рахує момент нагадування з датою і часом", () => {
    const result = computeReminderAt("2026-08-10", "14:00", 30);
    expect(result.toISOString()).toBe(new Date("2026-08-10T13:30:00").toISOString());
  });

  test("за відсутності часу підставляє 9:00 як дефолт для задач 'на весь день'", () => {
    const result = computeReminderAt("2026-08-10", null, 0);
    expect(result.toISOString()).toBe(new Date("2026-08-10T09:00:00").toISOString());
  });

  test("нагадування 'у момент дедлайну' (0 хвилин) не плутається з 'вимкнено' (null)", () => {
    const result = computeReminderAt("2026-08-10", "18:00", 0);
    expect(result.toISOString()).toBe(new Date("2026-08-10T18:00:00").toISOString());
  });
});
