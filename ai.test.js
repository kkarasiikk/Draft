const { createFakeFirestore } = require("./fakeFirestore");

// ---- Мок firebase-admin ----
// ai.js робить `const db = admin.firestore();` РІВНО ОДИН РАЗ при require.
// Щоб мати чистий стан у кожному тесті без re-require модуля (jest.resetModules
// + повторний require ламає посилання на mockAnthropic-и), даємо firestore()
// завжди повертати той самий проксі-об'єкт, а сам стан підміняємо через reset().
let mockCurrent = createFakeFirestore();
jest.mock("firebase-admin", () => {
  const firestoreFn = () => ({
    collection: (...a) => mockCurrent.collection(...a),
    runTransaction: (...a) => mockCurrent.runTransaction(...a),
  });
  firestoreFn.FieldValue = {
    serverTimestamp: () => "__SERVER_TIMESTAMP__",
    increment: (n) => ({ __op: "increment", n }),
  };
  return { initializeApp: jest.fn(), firestore: firestoreFn };
});

function resetDb(seed) {
  mockCurrent = createFakeFirestore(seed);
}

const ai = require("./ai");

beforeEach(() => {
  resetDb();
});

// ---- sanitizeTransactionInput ----
describe("sanitizeTransactionInput", () => {
  const catsExpense = [{ id: "food", label: "Їжа" }, { id: "other", label: "Інше" }];
  const catsIncome = [{ id: "salary", label: "Зарплата" }, { id: "other", label: "Інше" }];

  test("приймає коректну витрату", () => {
    const res = ai.sanitizeTransactionInput(
      { type: "expense", amount: 80, category: "food", note: "кава" },
      catsExpense,
      catsIncome
    );
    expect(res.error).toBeUndefined();
    expect(res.value).toMatchObject({ type: "expense", amount: 80, category: "food", note: "кава", source: "ai" });
    expect(res.value.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("відхиляє некоректний type", () => {
    const res = ai.sanitizeTransactionInput({ type: "transfer", amount: 10, category: "food" }, catsExpense, catsIncome);
    expect(res.error).toBeTruthy();
  });

  test.each([0, -5, NaN, undefined])("відхиляє некоректну суму: %p", (amount) => {
    const res = ai.sanitizeTransactionInput({ type: "expense", amount, category: "food" }, catsExpense, catsIncome);
    expect(res.error).toBeTruthy();
  });

  test("невідому категорію мапить на 'other', а не відхиляє запит", () => {
    const res = ai.sanitizeTransactionInput(
      { type: "expense", amount: 50, category: "does_not_exist" },
      catsExpense,
      catsIncome
    );
    expect(res.error).toBeUndefined();
    expect(res.value.category).toBe("other");
  });

  test("обрізає note до 200 символів", () => {
    const res = ai.sanitizeTransactionInput(
      { type: "expense", amount: 1, category: "food", note: "x".repeat(500) },
      catsExpense,
      catsIncome
    );
    expect(res.value.note.length).toBe(200);
  });

  test("некоректну дату замінює сьогоднішньою", () => {
    const res = ai.sanitizeTransactionInput(
      { type: "expense", amount: 1, category: "food", date: "not-a-date" },
      catsExpense,
      catsIncome
    );
    expect(res.value.date).toBe(new Date().toISOString().slice(0, 10));
  });
});

// ---- executeTool ----
describe("executeTool", () => {
  const ctx = {
    currency: "UAH",
    categoriesExpense: [{ id: "food", label: "Їжа" }, { id: "other", label: "Інше" }],
    categoriesIncome: [{ id: "salary", label: "Зарплата" }],
  };

  test("add_transaction реально записує документ у Firestore-мок", async () => {
    const result = await ai.executeTool("uid1", "add_transaction", { type: "expense", amount: 80, category: "food" }, ctx);
    expect(result.output.ok).toBe(true);
    expect(result.action).toMatchObject({ kind: "transaction_added", type: "expense", amount: 80, category: "food" });

    const snap = await mockCurrent.collection("users").doc("uid1").collection("transactions").get();
    expect(snap.docs.length).toBe(1);
    expect(snap.docs[0].data().amount).toBe(80);
  });

  test("query_transactions рахує суми і фільтрує за типом/періодом", async () => {
    const col = mockCurrent.collection("users").doc("uid1").collection("transactions");
    await col.add({ type: "expense", amount: 100, category: "food", date: "2026-07-01", note: "" });
    await col.add({ type: "expense", amount: 50, category: "food", date: "2026-06-01", note: "" }); // поза періодом
    await col.add({ type: "income", amount: 5000, category: "salary", date: "2026-07-05", note: "" });

    const result = await ai.executeTool(
      "uid1",
      "query_transactions",
      { from: "2026-07-01", to: "2026-07-31" },
      ctx
    );
    expect(result.output.count).toBe(2);
    expect(result.output.sumExpense).toBe(100);
    expect(result.output.sumIncome).toBe(5000);
  });

  test("невідомий інструмент повертає isError", async () => {
    const result = await ai.executeTool("uid1", "delete_everything", {}, ctx);
    expect(result.isError).toBe(true);
  });

  // ---- Гроші: підсумок місяця ----
  describe("month_summary", () => {
    async function seedJuly() {
      const col = mockCurrent.collection("users").doc("uid1").collection("transactions");
      await col.add({ type: "expense", amount: 300, category: "food", date: "2026-07-03", note: "" });
      await col.add({ type: "expense", amount: 100, category: "food", date: "2026-07-20", note: "" });
      await col.add({ type: "expense", amount: 100, category: "other", date: "2026-07-25", note: "" });
      await col.add({ type: "income", amount: 5000, category: "salary", date: "2026-07-01", note: "" });
      await col.add({ type: "expense", amount: 999, category: "food", date: "2026-08-01", note: "" }); // інший місяць
    }

    test("рахує підсумки й розбивку по категоріях, найбільша стаття перша", async () => {
      await seedJuly();
      const r = await ai.executeTool("uid1", "month_summary", { month: "2026-07" }, ctx);
      expect(r.output.totalExpense).toBe(500);
      expect(r.output.totalIncome).toBe(5000);
      expect(r.output.expenseByCategory[0]).toEqual({ category: "Їжа", sum: 400, share: 80 });
      expect(r.output.expenseByCategory[1]).toEqual({ category: "Інше", sum: 100, share: 20 });
    });

    test("останній день місяця не губиться", async () => {
      const col = mockCurrent.collection("users").doc("uid1").collection("transactions");
      await col.add({ type: "expense", amount: 10, category: "food", date: "2026-02-28", note: "" });
      const r = await ai.executeTool("uid1", "month_summary", { month: "2026-02" }, ctx);
      expect(r.output.totalExpense).toBe(10);
    });

    test("некоректний місяць -> помилка, а не порожній підсумок", async () => {
      const r = await ai.executeTool("uid1", "month_summary", { month: "липень" }, ctx);
      expect(r.isError).toBe(true);
    });
  });

  // ---- Завдання ----
  describe("завдання", () => {
    test("add_task записує коректний документ", async () => {
      const r = await ai.executeTool("uid1", "add_task", {
        title: "Подзвонити мамі", dueDate: "2026-08-20", dueTime: "18:00", priority: "high", tags: ["дім"],
      }, ctx);
      expect(r.output.ok).toBe(true);
      expect(r.action).toMatchObject({ kind: "task_added", title: "Подзвонити мамі" });

      const snap = await mockCurrent.collection("users").doc("uid1").collection("tasks").get();
      const doc = snap.docs[0].data();
      expect(doc).toMatchObject({ title: "Подзвонити мамі", done: false, dueDate: "2026-08-20", dueTime: "18:00", priority: "high" });
      expect(doc.subtasks).toEqual([]);
      expect(doc.completedAt).toBeNull();
    });

    test("час без дати не зберігається — його нікуди показати", async () => {
      const r = await ai.executeTool("uid1", "add_task", { title: "Колись", dueTime: "18:00" }, ctx);
      expect(r.output.dueDate).toBeNull();
      expect(r.output.dueTime).toBeNull();
    });

    test("сміттєві поля відкидаються, а не пишуться в базу", async () => {
      const r = await ai.executeTool("uid1", "add_task", {
        title: "Тест", dueDate: "завтра", priority: "дуже високий", estimateMin: -5, tags: "не список",
      }, ctx);
      expect(r.output.dueDate).toBeNull();
      expect(r.output.priority).toBeNull();
      expect(r.output.estimateMin).toBeNull();
      expect(r.output.tags).toEqual([]);
    });

    test("без назви — помилка", async () => {
      const r = await ai.executeTool("uid1", "add_task", { dueDate: "2026-08-20" }, ctx);
      expect(r.isError).toBe(true);
    });

    test("list_tasks за замовчуванням віддає лише невиконані, датовані спершу", async () => {
      const col = mockCurrent.collection("users").doc("uid1").collection("tasks");
      await col.add({ title: "Без дати", done: false, dueDate: null });
      await col.add({ title: "Завтра", done: false, dueDate: "2026-08-20" });
      await col.add({ title: "Зроблене", done: true, dueDate: "2026-08-19" });

      const r = await ai.executeTool("uid1", "list_tasks", {}, ctx);
      expect(r.output.items.map((t) => t.title)).toEqual(["Завтра", "Без дати"]);
    });

    test("list_tasks фільтрує за періодом і статусом", async () => {
      const col = mockCurrent.collection("users").doc("uid1").collection("tasks");
      await col.add({ title: "У межах", done: false, dueDate: "2026-08-20" });
      await col.add({ title: "Пізніше", done: false, dueDate: "2026-09-01" });
      await col.add({ title: "Зроблене", done: true, dueDate: "2026-08-21" });

      const inRange = await ai.executeTool("uid1", "list_tasks", { from: "2026-08-01", to: "2026-08-31" }, ctx);
      expect(inRange.output.items.map((t) => t.title)).toEqual(["У межах"]);

      const done = await ai.executeTool("uid1", "list_tasks", { status: "done" }, ctx);
      expect(done.output.items.map((t) => t.title)).toEqual(["Зроблене"]);
    });

    test("complete_task позначає виконаним", async () => {
      const ref = await mockCurrent.collection("users").doc("uid1").collection("tasks")
        .add({ title: "Звіт", done: false, dueDate: null });
      const r = await ai.executeTool("uid1", "complete_task", { id: ref.id }, ctx);
      expect(r.output.ok).toBe(true);
      expect(r.action).toMatchObject({ kind: "task_completed", title: "Звіт" });
      const doc = await mockCurrent.collection("users").doc("uid1").collection("tasks").doc(ref.id).get();
      expect(doc.data().done).toBe(true);
      expect(doc.data().completedAt).toBeInstanceOf(Date);
    });

    test("complete_task на вигаданий id не мовчить", async () => {
      const r = await ai.executeTool("uid1", "complete_task", { id: "вигаданий" }, ctx);
      expect(r.isError).toBe(true);
    });
  });

  // ---- Тренування ----
  describe("тренування", () => {
    async function seedWorkouts() {
      const col = mockCurrent.collection("users").doc("uid1").collection("workouts");
      await col.add({ date: "2026-08-10", name: "Груди", exercises: [
        { name: "Жим лежачи", muscle: "chest", sets: [{ weight: 60, reps: 8 }, { weight: 65, reps: 5 }] },
      ] });
      await col.add({ date: "2026-08-17", name: "Спина", exercises: [
        { name: "Тяга", muscle: "back", sets: [{ weight: 70, reps: 10 }] },
        { name: "Жим лежачи", muscle: "chest", sets: [{ weight: 65, reps: 8 }] },
      ] });
    }

    test("workout_history віддає найсвіжіші першими", async () => {
      await seedWorkouts();
      const r = await ai.executeTool("uid1", "workout_history", {}, ctx);
      expect(r.output.sessions.map((s) => s.date)).toEqual(["2026-08-17", "2026-08-10"]);
      expect(r.output.sessions[0].exercises[0]).toEqual({ name: "Тяга", muscle: "back", sets: [{ weight: 70, reps: 10 }] });
    });

    test("workout_history поважає ліміт", async () => {
      await seedWorkouts();
      const r = await ai.executeTool("uid1", "workout_history", { limit: 1 }, ctx);
      expect(r.output.sessions).toHaveLength(1);
    });

    test("personal_records: за однакової ваги виграє більше повторень", async () => {
      await seedWorkouts();
      const r = await ai.executeTool("uid1", "personal_records", {}, ctx);
      const bench = r.output.records.find((x) => x.exercise === "Жим лежачи");
      expect(bench).toMatchObject({ weight: 65, reps: 8 });
    });

    test("порожня історія не ламає розрахунок", async () => {
      const r = await ai.executeTool("uid1", "personal_records", {}, ctx);
      expect(r.output).toEqual({ count: 0, records: [] });
    });
  });

  // ---- Цілі й заощадження ----
  describe("цілі й заощадження", () => {
    test("goals_progress рахує виконані віхи", async () => {
      await mockCurrent.collection("users").doc("uid1").collection("goals").add({
        title: "Вивчити польську", status: "active", targetDate: "2026-12-31",
        milestones: [{ id: "a", title: "A1", done: true }, { id: "b", title: "A2", done: false }],
        checkins: ["2026-08-01", "2026-08-02"],
      });
      const r = await ai.executeTool("uid1", "goals_progress", {}, ctx);
      expect(r.output.goals[0]).toEqual({
        title: "Вивчити польську", status: "active", targetDate: "2026-12-31",
        milestonesDone: 1, milestonesTotal: 2, checkins: 2,
      });
    });

    test("savings_summary віднімає зняття, а не додає", async () => {
      const goals = mockCurrent.collection("users").doc("uid1").collection("savingsGoals");
      const goal = await goals.add({ name: "На відпустку" });
      const col = mockCurrent.collection("users").doc("uid1").collection("savings");
      await col.add({ goalId: goal.id, type: "deposit", amount: 500, date: "2026-08-01" });
      await col.add({ goalId: goal.id, type: "withdraw", amount: 200, date: "2026-08-10" });

      const r = await ai.executeTool("uid1", "savings_summary", {}, ctx);
      expect(r.output.total).toBe(300);
      expect(r.output.goals[0]).toEqual({ goal: "На відпустку", saved: 300 });
    });
  });
});

describe("вибір моделі", () => {
  test("за замовчуванням — найдешевша", () => {
    expect(ai.modelIdFor({})).toBe(ai.MODELS.haiku);
    expect(ai.modelIdFor(null)).toBe(ai.MODELS.haiku);
  });

  test("бере модель із профілю", () => {
    expect(ai.modelIdFor({ aiModel: "sonnet" })).toBe(ai.MODELS.sonnet);
    expect(ai.modelIdFor({ aiModel: "opus" })).toBe(ai.MODELS.opus);
  });

  test("невідома назва не ламає виклик", () => {
    expect(ai.modelIdFor({ aiModel: "gpt-9" })).toBe(ai.MODELS.haiku);
  });
});

// ---- enforceRateLimit ----
describe("enforceRateLimit", () => {
  test("пропускає перші N повідомлень і блокує далі", async () => {
    for (let i = 0; i < ai.RATE_LIMIT_MAX_MESSAGES; i++) {
      await expect(ai.enforceRateLimit("uidRL")).resolves.toBeUndefined();
    }
    await expect(ai.enforceRateLimit("uidRL")).rejects.toThrow(/Забагато/);
  });

  test("різні користувачі мають незалежні ліміти", async () => {
    await ai.enforceRateLimit("uidA");
    await expect(ai.enforceRateLimit("uidB")).resolves.toBeUndefined();
  });
});

// ---- handleAiChat (повний цикл з фейковим Anthropic-клієнтом) ----
describe("handleAiChat", () => {
  const authedCtx = { auth: { uid: "uid1" } };

  test("кидає unauthenticated без auth", async () => {
    await expect(ai.handleAiChat({ message: "привіт" }, {})).rejects.toThrow(/увійти/);
  });

  test("кидає invalid-argument на порожнє повідомлення", async () => {
    await expect(ai.handleAiChat({ message: "   " }, authedCtx)).rejects.toThrow();
  });

  test("проста відповідь без інструментів", async () => {
    resetDb({ "users/uid1": { lang: "uk", currency: "UAH" } });
    const fakeAnthropic = {
      messages: {
        create: jest.fn().mockResolvedValue({ content: [{ type: "text", text: "Привіт! Чим допомогти?" }] }),
      },
    };
    const res = await ai.handleAiChat({ message: "привіт" }, authedCtx, { anthropicClient: fakeAnthropic });
    expect(res.reply).toBe("Привіт! Чим допомогти?");
    expect(res.actions).toEqual([]);
    expect(fakeAnthropic.messages.create).toHaveBeenCalledTimes(1);
  });

  test("'кава 80 грн' викликає add_transaction і повертає action", async () => {
    resetDb({
      "users/uid1": {
        lang: "uk",
        currency: "UAH",
        categoriesExpense: [{ id: "food", label: "Їжа" }],
        categoriesIncome: [{ id: "salary", label: "Зарплата" }],
      },
    });

    const fakeAnthropic = {
      messages: {
        create: jest
          .fn()
          // 1-й раунд: модель вирішує викликати add_transaction
          .mockResolvedValueOnce({
            content: [
              {
                type: "tool_use",
                id: "tu_1",
                name: "add_transaction",
                input: { type: "expense", amount: 80, category: "food", note: "кава" },
              },
            ],
          })
          // 2-й раунд: після tool_result модель відповідає текстом
          .mockResolvedValueOnce({
            content: [{ type: "text", text: "Записав 80 грн на каву." }],
          }),
      },
    };

    const res = await ai.handleAiChat(
      { message: "кава 80 грн" },
      authedCtx,
      { anthropicClient: fakeAnthropic }
    );

    expect(res.reply).toBe("Записав 80 грн на каву.");
    expect(res.actions).toHaveLength(1);
    expect(res.actions[0]).toMatchObject({ kind: "transaction_added", type: "expense", amount: 80, category: "food" });
    expect(fakeAnthropic.messages.create).toHaveBeenCalledTimes(2);

    const snap = await mockCurrent.collection("users").doc("uid1").collection("transactions").get();
    expect(snap.docs).toHaveLength(1);
  });

  test("зупиняється після MAX_TOOL_ROUNDS, якщо модель нескінченно викликає інструменти", async () => {
    resetDb({ "users/uid1": { lang: "uk", currency: "UAH" } });
    const fakeAnthropic = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: "tool_use", id: "tu_x", name: "query_transactions", input: { from: "2026-01-01", to: "2026-12-31" } }],
        }),
      },
    };
    const res = await ai.handleAiChat({ message: "?" }, authedCtx, { anthropicClient: fakeAnthropic });
    expect(res.reply).toMatch(/Забагато кроків/);
  });
});
