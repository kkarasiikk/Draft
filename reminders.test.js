// Тести Cloud Function нагадувань. Firestore і FCM підмінені мінімальним
// моком просто тут: reminders.js робить `admin.firestore()` один раз при
// require, тож стан підмінюється через resetState(), а не re-require.
const state = {
  tasks: [],          // документи колекційної групи tasks
  users: [],          // { id, data }
  tokens: {},         // uid -> [token]
  sent: [],           // виклики sendEachForMulticast
  updates: [],        // { path, data }
  userSets: [],       // { id, data }
  deletedTokens: [],  // { uid, token }
  sendResults: null,  // підміна відповіді FCM (для мертвих токенів)
};

function resetState(patch) {
  state.tasks = []; state.users = []; state.tokens = {};
  state.sent = []; state.updates = []; state.userSets = []; state.deletedTokens = [];
  state.sendResults = null;
  Object.assign(state, patch || {});
}

const taskDoc = (task) => ({
  id: task.id,
  data: () => task,
  ref: {
    path: `users/${task.uid}/tasks/${task.id}`,
    update: async (data) => { state.updates.push({ path: `users/${task.uid}/tasks/${task.id}`, data }); },
  },
});

jest.mock("firebase-admin", () => {
  const tokensCol = (uid) => ({
    get: async () => ({ docs: (state.tokens[uid] || []).map((tk) => ({ id: tk })) }),
    doc: (token) => ({ delete: async () => { state.deletedTokens.push({ uid, token }); } }),
  });
  const userTasksCol = (uid) => {
    const filters = [];
    const api = {
      where: (field, op, value) => { filters.push({ field, op, value }); return api; },
      get: async () => ({
        docs: state.tasks
          .filter((task) => task.uid === uid)
          .filter((task) => filters.every((f) => f.op === "==" ? task[f.field] === f.value : true))
          .map((task) => ({ id: task.id, data: () => task })),
      }),
    };
    return api;
  };
  const firestoreFn = () => ({
    collectionGroup: (name) => {
      const filters = [];
      const api = {
        where: (field, op, value) => { filters.push({ field, op, value }); return api; },
        limit: () => api,
        get: async () => ({
          docs: state.tasks.filter((task) => filters.every((f) => {
            if (f.field === "notifiedAt" && f.op === "==") return (task.notifiedAt || null) === f.value;
            if (f.field === "reminderAt" && f.op === "<=") return task.reminderAt && task.reminderAt <= f.value;
            return true;
          })).map(taskDoc),
        }),
      };
      return api;
    },
    collection: (name) => ({
      get: async () => ({
        docs: state.users.map((u) => ({
          id: u.id,
          data: () => u.data,
          ref: { set: async (data) => { state.userSets.push({ id: u.id, data }); } },
        })),
      }),
      doc: (uid) => ({
        collection: (sub) => (sub === "fcmTokens" ? tokensCol(uid) : userTasksCol(uid)),
      }),
    }),
  });
  firestoreFn.FieldValue = { serverTimestamp: () => "__TS__" };
  firestoreFn.Timestamp = { fromDate: (d) => d };
  return {
    initializeApp: jest.fn(),
    firestore: firestoreFn,
    messaging: () => ({
      sendEachForMulticast: async (msg) => {
        state.sent.push(msg);
        const responses = state.sendResults ||
          msg.tokens.map(() => ({ success: true }));
        return { responses, successCount: responses.filter((r) => r.success).length };
      },
    }),
  };
});

const { _internal } = require("./reminders");

beforeEach(() => resetState());

describe("sendToUser", () => {
  test("шле на всі токени користувача", async () => {
    resetState({ tokens: { u1: ["a", "b"] } });
    const res = await _internal.sendToUser("u1", { title: "Привіт", body: "Тіло" });
    expect(res.sent).toBe(2);
    expect(state.sent[0].tokens).toEqual(["a", "b"]);
    expect(state.sent[0].data).toMatchObject({ title: "Привіт", body: "Тіло" });
  });

  test("шле тільки data, без notification — інакше браузер показав би друге сповіщення", async () => {
    resetState({ tokens: { u1: ["a"] } });
    await _internal.sendToUser("u1", { title: "t", body: "b" });
    expect(state.sent[0].notification).toBeUndefined();
  });

  test("мертві токени прибираються", async () => {
    resetState({
      tokens: { u1: ["живий", "мертвий"] },
      sendResults: [
        { success: true },
        { success: false, error: { code: "messaging/registration-token-not-registered" } },
      ],
    });
    const res = await _internal.sendToUser("u1", { title: "t" });
    expect(res.removed).toBe(1);
    expect(state.deletedTokens).toEqual([{ uid: "u1", token: "мертвий" }]);
  });

  test("тимчасова помилка не видаляє токен", async () => {
    resetState({
      tokens: { u1: ["a"] },
      sendResults: [{ success: false, error: { code: "messaging/server-unavailable" } }],
    });
    const res = await _internal.sendToUser("u1", { title: "t" });
    expect(res.removed).toBe(0);
    expect(state.deletedTokens).toEqual([]);
  });

  test("без жодного пристрою нічого не шлемо", async () => {
    const res = await _internal.sendToUser("u1", { title: "t" });
    expect(res).toEqual({ sent: 0, removed: 0 });
    expect(state.sent).toEqual([]);
  });
});

describe("sendDueReminders", () => {
  const now = new Date(2026, 7, 18, 15, 0, 0);
  const past = new Date(2026, 7, 18, 14, 55, 0);
  const soon = new Date(2026, 7, 18, 15, 3, 0);
  const later = new Date(2026, 7, 18, 16, 0, 0);

  test("надсилає те, чий час настав, і ставить позначку", async () => {
    resetState({
      tokens: { u1: ["tk"] },
      tasks: [{ id: "t1", uid: "u1", title: "Подзвонити", done: false, reminderAt: past, notifiedAt: null }],
    });
    const sent = await _internal.sendDueReminders(now);
    expect(sent).toBe(1);
    expect(state.sent[0].data.title).toContain("Подзвонити");
    expect(state.updates).toEqual([{ path: "users/u1/tasks/t1", data: { notifiedAt: "__TS__" } }]);
  });

  test("захоплює те, що настане до наступного запуску", async () => {
    resetState({
      tokens: { u1: ["tk"] },
      tasks: [{ id: "t1", uid: "u1", title: "Скоро", done: false, reminderAt: soon, notifiedAt: null }],
    });
    expect(await _internal.sendDueReminders(now)).toBe(1);
  });

  test("майбутнє не чіпає", async () => {
    resetState({
      tokens: { u1: ["tk"] },
      tasks: [{ id: "t1", uid: "u1", title: "Пізніше", done: false, reminderAt: later, notifiedAt: null }],
    });
    expect(await _internal.sendDueReminders(now)).toBe(0);
    expect(state.updates).toEqual([]);
  });

  test("виконане не нагадуємо, але позначку ставимо — інакше воно вічно у вибірці", async () => {
    resetState({
      tokens: { u1: ["tk"] },
      tasks: [{ id: "t1", uid: "u1", title: "Готове", done: true, reminderAt: past, notifiedAt: null }],
    });
    expect(await _internal.sendDueReminders(now)).toBe(0);
    expect(state.sent).toEqual([]);
    expect(state.updates).toHaveLength(1);
  });

  test("вже надіслане вдруге не шлеться", async () => {
    resetState({
      tokens: { u1: ["tk"] },
      tasks: [{ id: "t1", uid: "u1", title: "Старе", done: false, reminderAt: past, notifiedAt: past }],
    });
    expect(await _internal.sendDueReminders(now)).toBe(0);
  });

  test("нагадування різних користувачів ідуть кожне своєму", async () => {
    resetState({
      tokens: { u1: ["tk1"], u2: ["tk2"] },
      tasks: [
        { id: "a", uid: "u1", title: "Перше", done: false, reminderAt: past, notifiedAt: null },
        { id: "b", uid: "u2", title: "Друге", done: false, reminderAt: past, notifiedAt: null },
      ],
    });
    expect(await _internal.sendDueReminders(now)).toBe(2);
    expect(state.sent.map((m) => m.tokens[0])).toEqual(["tk1", "tk2"]);
  });
});

describe("sendDigests", () => {
  // 08:30 у Києві.
  const morning = new Date(Date.UTC(2026, 7, 18, 5, 30));
  const settings = { enabled: true, morningHour: 8, eveningHour: 20, tz: "Europe/Kyiv" };

  test("ранковий дайджест називає кількість і найближчу справу", async () => {
    resetState({
      tokens: { u1: ["tk"] },
      users: [{ id: "u1", data: { taskReminders: settings } }],
      tasks: [
        { id: "a", uid: "u1", title: "Пізня", done: false, dueDate: "2026-08-18", dueTime: "17:00" },
        { id: "b", uid: "u1", title: "Рання", done: false, dueDate: "2026-08-18", dueTime: "09:00" },
        { id: "c", uid: "u1", title: "Зроблена", done: true, dueDate: "2026-08-18", dueTime: "08:00" },
      ],
    });
    await _internal.sendDigests(morning);
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].data.title).toBe("Сьогодні 2 справи");
    expect(state.sent[0].data.body).toBe("Перше: Рання");
  });

  test("порожній день", async () => {
    resetState({
      tokens: { u1: ["tk"] },
      users: [{ id: "u1", data: { taskReminders: settings } }],
    });
    await _internal.sendDigests(morning);
    expect(state.sent[0].data.title).toBe("Сьогодні вільно");
  });

  test("позначка про надіслане не дає слати повторно наступного тику", async () => {
    resetState({
      tokens: { u1: ["tk"] },
      users: [{ id: "u1", data: { taskReminders: settings } }],
    });
    await _internal.sendDigests(morning);
    expect(state.userSets[0].data.taskReminders.lastMorning).toBe("2026-08-18");

    // Наступний запуск — уже з позначкою.
    resetState({
      tokens: { u1: ["tk"] },
      users: [{ id: "u1", data: { taskReminders: { ...settings, lastMorning: "2026-08-18" } } }],
    });
    await _internal.sendDigests(morning);
    expect(state.sent).toEqual([]);
  });

  test("вимкнені нагадування ігноруються", async () => {
    resetState({
      tokens: { u1: ["tk"] },
      users: [{ id: "u1", data: { taskReminders: { ...settings, enabled: false } } }],
    });
    await _internal.sendDigests(morning);
    expect(state.sent).toEqual([]);
  });

  test("користувач без налаштувань не ламає розсилку іншим", async () => {
    resetState({
      tokens: { u1: ["tk1"], u2: ["tk2"] },
      users: [
        { id: "u1", data: {} },
        { id: "u2", data: { taskReminders: settings } },
      ],
    });
    await _internal.sendDigests(morning);
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].tokens).toEqual(["tk2"]);
  });

  test("вечірній дайджест рахує незакрите", async () => {
    const evening = new Date(Date.UTC(2026, 7, 18, 17, 30)); // 20:30 у Києві
    resetState({
      tokens: { u1: ["tk"] },
      users: [{ id: "u1", data: { taskReminders: settings } }],
      tasks: [
        { id: "a", uid: "u1", title: "Лишилось", done: false, dueDate: "2026-08-18" },
        { id: "b", uid: "u1", title: "Зроблено", done: true, dueDate: "2026-08-18" },
      ],
    });
    await _internal.sendDigests(evening);
    expect(state.sent[0].data.title).toBe("Не закрито: 1");
  });
});

describe("plural", () => {
  test("українські форми", () => {
    expect(_internal.plural(1, "справа", "справи", "справ")).toBe("справа");
    expect(_internal.plural(2, "справа", "справи", "справ")).toBe("справи");
    expect(_internal.plural(5, "справа", "справи", "справ")).toBe("справ");
    expect(_internal.plural(11, "справа", "справи", "справ")).toBe("справ");
    expect(_internal.plural(21, "справа", "справи", "справ")).toBe("справа");
    expect(_internal.plural(22, "справа", "справи", "справ")).toBe("справи");
  });
});
