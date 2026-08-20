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
    // Те саме, що підставляє handleAiChat: інструменти беруть звідси
    // «сьогодні» — і для дати операції, і для серії по цілі.
    today: new Date().toISOString().slice(0, 10),
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

  // Підпис для чату збирає сервер: спільний чат живе на п'яти сторінках і
  // назв категорій конкретного модуля не знає.
  test("add_transaction віддає готовий підпис дії — назву категорії й символ валюти", async () => {
    const result = await ai.executeTool("uid1", "add_transaction", { type: "expense", amount: 80, category: "food" }, ctx);
    expect(result.action.categoryLabel).toBe("Їжа");
    expect(result.action.currency).toBe("\u20B4");
  });

  test("невідома валюта лишається кодом, а не зникає з підпису", async () => {
    const result = await ai.executeTool("uid1", "add_transaction",
      { type: "expense", amount: 10, category: "food" }, { ...ctx, currency: "GBP" });
    expect(result.action.currency).toBe("GBP");
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

  // ---- Запис тренувань ----
  describe("запис тренувань", () => {
    test("вправа з бібліотеки отримує libId, групу мʼязів і назву мовою користувача", async () => {
      const r = await ai.executeTool("uid1", "add_workout", {
        name: "Груди",
        exercises: [{ libId: "benchPress", sets: [{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }] }],
      }, ctx);
      expect(r.output.ok).toBe(true);

      const snap = await mockCurrent.collection("users").doc("uid1").collection("workouts").get();
      const ex = snap.docs[0].data().exercises[0];
      expect(ex).toMatchObject({ libId: "benchPress", muscle: "chest", name: "Жим лежачи" });
      expect(ex.sets).toEqual([{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }]);
    });

    test("дата за замовчуванням — сьогоднішня з контексту", async () => {
      const r = await ai.executeTool("uid1", "add_workout",
        { exercises: [{ libId: "squat", sets: [{ weight: 80, reps: 5 }] }] },
        { ...ctx, today: "2026-08-19" });
      expect(r.output.date).toBe("2026-08-19");
      expect(r.action).toMatchObject({ kind: "workout_added", exercises: ["Присідання зі штангою"] });
    });

    test("вправа з власною вагою: нульова вага не робить підхід порожнім", async () => {
      await ai.executeTool("uid1", "add_workout",
        { exercises: [{ libId: "plank", sets: [{ weight: 0, reps: 60 }] }] }, ctx);
      const snap = await mockCurrent.collection("users").doc("uid1").collection("workouts").get();
      expect(snap.docs[0].data().exercises[0].sets).toEqual([{ weight: 0, reps: 60 }]);
    });

    test("вигаданий libId не приймається — інакше рекорди рахувались би по неіснуючій вправі", async () => {
      const r = await ai.executeTool("uid1", "add_workout",
        { exercises: [{ libId: "megaPress", name: "Мега-жим", sets: [{ weight: 50, reps: 5 }] }] }, ctx);
      const snap = await mockCurrent.collection("users").doc("uid1").collection("workouts").get();
      const ex = snap.docs[0].data().exercises[0];
      expect(ex.libId).toBe(null);
      expect(ex.name).toBe("Мега-жим");
      expect(r.output.ok).toBe(true);
    });

    test("вправа без жодного підходу відкидається, як і у формі", async () => {
      const r = await ai.executeTool("uid1", "add_workout", {
        exercises: [
          { libId: "benchPress", sets: [] },
          { libId: "squat", sets: [{ weight: 80, reps: 5 }] },
        ],
      }, ctx);
      const snap = await mockCurrent.collection("users").doc("uid1").collection("workouts").get();
      expect(snap.docs[0].data().exercises.map((e) => e.libId)).toEqual(["squat"]);
      expect(r.output.exercises).toBe(1);
      expect(r.output.sets).toBe(1);
    });

    test("тренування зовсім без вправ не створює документа", async () => {
      const r = await ai.executeTool("uid1", "add_workout", { exercises: [] }, ctx);
      expect(r.isError).toBe(true);
      const snap = await mockCurrent.collection("users").doc("uid1").collection("workouts").get();
      expect(snap.docs.length).toBe(0);
    });

    test("записане тренування одразу видно у workout_history", async () => {
      await ai.executeTool("uid1", "add_workout",
        { date: "2026-08-19", exercises: [{ libId: "deadlift", sets: [{ weight: 100, reps: 3 }] }] }, ctx);
      const r = await ai.executeTool("uid1", "workout_history", {}, ctx);
      expect(r.output.sessions[0].exercises[0]).toMatchObject({ name: "Станова тяга", muscle: "back" });
    });
  });

  // ---- Дії з цілями ----
  describe("дії з цілями", () => {
    async function seedGoal(extra) {
      return mockCurrent.collection("users").doc("uid1").collection("goals").add({
        title: "Марафон", status: "active", checkins: [],
        milestones: [{ id: "m1", title: "10 км", done: false }, { id: "m2", title: "21 км", done: false }],
        ...extra,
      });
    }
    const today = () => new Date().toISOString().slice(0, 10);

    test("add_goal створює ціль із віхами й типовими полями", async () => {
      const r = await ai.executeTool("uid1", "add_goal", {
        title: "Пробігти марафон", category: "health", why: "хочу дожити до 90",
        targetDate: "2027-04-18", milestones: ["10 км", "21 км"],
      }, ctx);
      expect(r.output).toMatchObject({ ok: true, milestones: 2 });

      const doc = await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get();
      const g = doc.data();
      expect(g).toMatchObject({
        title: "Пробігти марафон", category: "health", why: "хочу дожити до 90",
        targetDate: "2027-04-18", status: "active", checkins: [], journal: [],
      });
      expect(g.milestones.map((m) => [m.title, m.done])).toEqual([["10 км", false], ["21 км", false]]);
      expect(new Set(g.milestones.map((m) => m.id)).size).toBe(2);
    });

    // Правила Firestore вимагають ці поля незалежно від того, що сказала
    // людина, — без них запис просто не пройде.
    test("ціль без деталей усе одно отримує повний набір полів", async () => {
      const r = await ai.executeTool("uid1", "add_goal", { title: "Вивчити польську" }, ctx);
      const doc = await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get();
      expect(doc.data()).toMatchObject({
        category: "other", why: "", targetDate: null, status: "active",
        milestones: [], checkins: [], journal: [],
      });
    });

    test("вигадана категорія й крива дата не потрапляють у документ", async () => {
      const r = await ai.executeTool("uid1", "add_goal",
        { title: "Ціль", category: "космос", targetDate: "колись навесні" }, ctx);
      const doc = await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get();
      expect(doc.data()).toMatchObject({ category: "other", targetDate: null });
    });

    test("ціль без назви не створюється", async () => {
      const r = await ai.executeTool("uid1", "add_goal", { title: "   " }, ctx);
      expect(r.isError).toBe(true);
      const snap = await mockCurrent.collection("users").doc("uid1").collection("goals").get();
      expect(snap.docs.length).toBe(0);
    });

    // id повертається одразу, щоб чекін по щойно створеній цілі не вимагав
    // окремого походу в goals_progress.
    test("щойно створену ціль одразу можна відзначити чекіном", async () => {
      const created = await ai.executeTool("uid1", "add_goal", { title: "Марафон" }, ctx);
      const r = await ai.executeTool("uid1", "goal_checkin", { id: created.output.id }, ctx);
      expect(r.output.ok).toBe(true);
      expect(r.output.totalCheckins).toBe(1);
    });

    test("goal_checkin додає сьогоднішній день", async () => {
      const ref = await seedGoal();
      const r = await ai.executeTool("uid1", "goal_checkin", { id: ref.id }, ctx);
      expect(r.output).toMatchObject({ ok: true, alreadyDone: false, totalCheckins: 1 });
      const doc = await mockCurrent.collection("users").doc("uid1").collection("goals").doc(ref.id).get();
      expect(doc.data().checkins).toEqual([today()]);
    });

    // Модель може викликати інструмент двічі — від цього не має ні
    // задвоїтись, ні зникнути вже поставлений чекін.
    test("повторний goal_checkin нічого не змінює", async () => {
      const ref = await seedGoal({ checkins: [today()] });
      const r = await ai.executeTool("uid1", "goal_checkin", { id: ref.id }, ctx);
      expect(r.output.alreadyDone).toBe(true);
      const doc = await mockCurrent.collection("users").doc("uid1").collection("goals").doc(ref.id).get();
      expect(doc.data().checkins).toEqual([today()]);
    });

    test("complete_milestone закриває саме вказану віху", async () => {
      const ref = await seedGoal();
      const r = await ai.executeTool("uid1", "complete_milestone", { goalId: ref.id, milestoneId: "m2" }, ctx);
      expect(r.output).toMatchObject({ ok: true, milestonesDone: 1, milestonesTotal: 2 });
      const doc = await mockCurrent.collection("users").doc("uid1").collection("goals").doc(ref.id).get();
      expect(doc.data().milestones).toEqual([
        { id: "m1", title: "10 км", done: false },
        { id: "m2", title: "21 км", done: true },
      ]);
    });

    // ---- Числова мета ----
    test("add_goal записує числову мету й починає з нуля", async () => {
      const r = await ai.executeTool("uid1", "add_goal",
        { title: "Пробігти 10 км", targetValue: 10, unit: "км" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get()).data();
      expect(g).toMatchObject({ targetValue: 10, unit: "км", currentValue: 0 });
    });

    // Одиниця без числа — це підпис ні до чого: смужки прогресу не буде,
    // а «км» у картці лише збиватиме з пантелику.
    test("одиниця без числової мети не зберігається", async () => {
      const r = await ai.executeTool("uid1", "add_goal", { title: "Ціль", unit: "км" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get()).data();
      expect(g).toMatchObject({ targetValue: null, unit: "", currentValue: 0 });
    });

    test("нуль і відʼємна мета — те саме, що її немає", async () => {
      const zero = await ai.executeTool("uid1", "add_goal", { title: "А", targetValue: 0 }, ctx);
      const minus = await ai.executeTool("uid1", "add_goal", { title: "Б", targetValue: -5 }, ctx);
      const col = mockCurrent.collection("users").doc("uid1").collection("goals");
      expect((await col.doc(zero.output.id).get()).data().targetValue).toBe(null);
      expect((await col.doc(minus.output.id).get()).data().targetValue).toBe(null);
    });

    // «Пробіг ще три кілометри» — це додати три, а не поставити три.
    test("goal_progress додає до пройденого, а не замінює його", async () => {
      const add = await ai.executeTool("uid1", "add_goal",
        { title: "Марафон", targetValue: 10, unit: "км" }, ctx);
      await ai.executeTool("uid1", "goal_progress", { id: add.output.id, add: 6.4 }, ctx);
      const r = await ai.executeTool("uid1", "goal_progress", { id: add.output.id, add: 2.1 }, ctx);
      expect(r.output).toMatchObject({ ok: true, current: 8.5, target: 10, unit: "км", pct: 85 });
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g.currentValue).toBe(8.5);
    });

    test("відʼємне add зменшує, але нижче нуля не опускає", async () => {
      const add = await ai.executeTool("uid1", "add_goal", { title: "Марафон", targetValue: 10 }, ctx);
      await ai.executeTool("uid1", "goal_progress", { id: add.output.id, add: 3 }, ctx);
      const r = await ai.executeTool("uid1", "goal_progress", { id: add.output.id, add: -8 }, ctx);
      expect(r.output.current).toBe(0);
    });

    // Смужка не буває довшою за саму себе, навіть коли мету перевиконано.
    test("перевиконана мета лишається сотнею відсотків", async () => {
      const add = await ai.executeTool("uid1", "add_goal", { title: "Марафон", targetValue: 10 }, ctx);
      const r = await ai.executeTool("uid1", "goal_progress", { id: add.output.id, add: 50 }, ctx);
      expect(r.output).toMatchObject({ current: 50, pct: 100 });
    });

    test("goal_progress не працює без числової мети й без числа", async () => {
      const plain = await ai.executeTool("uid1", "add_goal", { title: "Вивчити польську" }, ctx);
      expect((await ai.executeTool("uid1", "goal_progress", { id: plain.output.id, add: 3 }, ctx)).isError).toBe(true);

      const num = await ai.executeTool("uid1", "add_goal", { title: "Марафон", targetValue: 10 }, ctx);
      expect((await ai.executeTool("uid1", "goal_progress", { id: num.output.id, add: 0 }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "goal_progress", { id: num.output.id, add: "трохи" }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "goal_progress", { id: "вигаданий", add: 3 }, ctx)).isError).toBe(true);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(num.output.id).get()).data();
      expect(g.currentValue).toBe(0);
    });

    test("goals_progress віддає числову мету разом із пройденим", async () => {
      const add = await ai.executeTool("uid1", "add_goal",
        { title: "Марафон", targetValue: 10, unit: "км" }, ctx);
      await ai.executeTool("uid1", "goal_progress", { id: add.output.id, add: 6.4 }, ctx);
      const r = await ai.executeTool("uid1", "goals_progress", {}, ctx);
      expect(r.output.goals[0]).toMatchObject({ targetValue: 10, currentValue: 6.4, unit: "км" });
    });

    // ---- Серія: рятунок і причини пропусків ----
    // Правила рятунку перевіряє goals/streak.test.js — тут важливо, що
    // інструмент справді пише в документ і не пише, коли не можна.
    const back = (n) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };

    test("rescue_streak дописує вчорашній день і лишає слід", async () => {
      const ref = await seedGoal({ checkins: [back(4), back(3), back(2)] });
      const r = await ai.executeTool("uid1", "rescue_streak", { id: ref.id }, ctx);
      expect(r.output).toMatchObject({ ok: true, day: back(1), streak: 4 });
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(ref.id).get()).data();
      expect(g.checkins).toContain(back(1));
      expect(g.rescues).toEqual([back(1)]);
    });

    test("rescue_streak не рятує, коли вчора й так відмічено", async () => {
      const ref = await seedGoal({ checkins: [back(2), back(1)] });
      const r = await ai.executeTool("uid1", "rescue_streak", { id: ref.id }, ctx);
      expect(r.isError).toBe(true);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(ref.id).get()).data();
      expect(g.rescues).toBeUndefined();
    });

    // Раз на тиждень — інакше «серія» перестає щось означати, і модель має
    // отримати не мовчазний успіх, а відмову з датою.
    test("свіжий рятунок повертає, скільки лишилось чекати", async () => {
      const ref = await seedGoal({ checkins: [back(4), back(3), back(2)], rescues: [back(3)] });
      const r = await ai.executeTool("uid1", "rescue_streak", { id: ref.id }, ctx);
      expect(r.isError).toBe(true);
      expect(r.output.cooldownLeft).toBe(4);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(ref.id).get()).data();
      expect(g.checkins).not.toContain(back(1));
    });

    test("log_blocker пише причину сьогоднішнім днем", async () => {
      const ref = await seedGoal();
      const r = await ai.executeTool("uid1", "log_blocker", { id: ref.id, reason: "не було часу" }, ctx);
      expect(r.output).toMatchObject({ ok: true, date: today(), reason: "не було часу" });
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(ref.id).get()).data();
      expect(g.blockers).toEqual([{ date: today(), reason: "не було часу" }]);
    });

    test("повторний log_blocker замінює сьогоднішню причину", async () => {
      const ref = await seedGoal({ blockers: [{ date: today(), reason: "забув" }] });
      await ai.executeTool("uid1", "log_blocker", { id: ref.id, reason: "втома" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(ref.id).get()).data();
      expect(g.blockers).toEqual([{ date: today(), reason: "втома" }]);
    });

    test("порожня причина й вигаданий id нічого не пишуть", async () => {
      const ref = await seedGoal();
      expect((await ai.executeTool("uid1", "log_blocker", { id: ref.id, reason: "  " }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "log_blocker", { id: "вигаданий", reason: "втома" }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "rescue_streak", { id: "вигаданий" }, ctx)).isError).toBe(true);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(ref.id).get()).data();
      expect(g.blockers).toBeUndefined();
    });

    // Модель має бачити стан серії готовим числом, а не вираховувати його
    // з чотирьохсот дат — інакше рятунок пропонувався б навмання.
    test("goals_progress показує серію, рятунок і що заважає найчастіше", async () => {
      await seedGoal({
        checkins: [back(4), back(3), back(2)],
        blockers: [{ date: back(2), reason: "не було часу" }, { date: back(3), reason: "не було часу" },
          { date: back(5), reason: "втома" }],
      });
      const g = (await ai.executeTool("uid1", "goals_progress", {}, ctx)).output.goals[0];
      expect(g.streak).toBe(0);
      expect(g.rescue).toMatchObject({ day: back(1), lost: 3, available: true });
      expect(g.blockers).toEqual([{ reason: "не було часу", count: 2 }, { reason: "втома", count: 1 }]);
    });

    test("без розриву поле rescue порожнє", async () => {
      await seedGoal({ checkins: [back(1), today()] });
      const g = (await ai.executeTool("uid1", "goals_progress", {}, ctx)).output.goals[0];
      expect(g.streak).toBe(2);
      expect(g.rescue).toBe(null);
    });

    // ---- Щоденні дії з цілі ----
    // Завдання й ціль живуть у різних розділах, і людина не має робити одну
    // й ту саму дію двічі: галочка в завданнях — це й крок до цілі.
    test("add_goal + add_task з goalId звʼязує завдання з ціллю", async () => {
      const goal = await seedGoal();
      const r = await ai.executeTool("uid1", "add_task", { title: "Пробігти 3 км", goalId: goal.id }, ctx);
      const task = (await mockCurrent.collection("users").doc("uid1").collection("tasks").doc(r.output.id).get()).data();
      expect(task.goalId).toBe(goal.id);
    });

    test("завдання без цілі має goalId null, а не порожній рядок", async () => {
      const plain = await ai.executeTool("uid1", "add_task", { title: "Купити молоко" }, ctx);
      const blank = await ai.executeTool("uid1", "add_task", { title: "Ще щось", goalId: "  " }, ctx);
      const col = mockCurrent.collection("users").doc("uid1").collection("tasks");
      expect((await col.doc(plain.output.id).get()).data().goalId).toBe(null);
      expect((await col.doc(blank.output.id).get()).data().goalId).toBe(null);
    });

    test("complete_task відмічає день у серії цілі", async () => {
      const goal = await seedGoal();
      const task = await ai.executeTool("uid1", "add_task", { title: "Пробігти 3 км", goalId: goal.id }, ctx);
      const r = await ai.executeTool("uid1", "complete_task", { id: task.output.id }, ctx);
      expect(r.output.goalCheckin).toBe("Марафон");
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(goal.id).get()).data();
      expect(g.checkins).toEqual([today()]);
    });

    test("день, уже відмічений, не дублюється", async () => {
      const goal = await seedGoal({ checkins: [today()] });
      const task = await ai.executeTool("uid1", "add_task", { title: "Пробігти 3 км", goalId: goal.id }, ctx);
      const r = await ai.executeTool("uid1", "complete_task", { id: task.output.id }, ctx);
      expect(r.output.goalCheckin).toBe(null);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(goal.id).get()).data();
      expect(g.checkins).toEqual([today()]);
    });

    test("завдання без цілі нічого не відмічає", async () => {
      const goal = await seedGoal();
      const task = await ai.executeTool("uid1", "add_task", { title: "Купити молоко" }, ctx);
      const r = await ai.executeTool("uid1", "complete_task", { id: task.output.id }, ctx);
      expect(r.output.goalCheckin).toBe(null);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(goal.id).get()).data();
      expect(g.checkins).toEqual([]);
    });

    // Ціль могли видалити, а завдання лишилось: це не привід падати.
    test("завдання з мертвим goalId просто закривається", async () => {
      const task = await ai.executeTool("uid1", "add_task", { title: "Крок", goalId: "вигаданий" }, ctx);
      const r = await ai.executeTool("uid1", "complete_task", { id: task.output.id }, ctx);
      expect(r.output).toMatchObject({ ok: true, goalCheckin: null });
    });

    test("правка завдання не рве звʼязок із ціллю", async () => {
      const goal = await seedGoal();
      const task = await ai.executeTool("uid1", "add_task", { title: "Пробігти 3 км", goalId: goal.id }, ctx);
      await ai.executeTool("uid1", "edit_task", { id: task.output.id, title: "Пробігти 5 км" }, ctx);
      const doc = (await mockCurrent.collection("users").doc("uid1").collection("tasks").doc(task.output.id).get()).data();
      expect(doc).toMatchObject({ title: "Пробігти 5 км", goalId: goal.id });
    });

    test("list_tasks показує, з якої цілі завдання", async () => {
      const goal = await seedGoal();
      await ai.executeTool("uid1", "add_task", { title: "Пробігти 3 км", goalId: goal.id }, ctx);
      const r = await ai.executeTool("uid1", "list_tasks", {}, ctx);
      expect(r.output.items[0].goalId).toBe(goal.id);
    });

    test("неіснуючі id цілі чи віхи повертають помилку, а не мовчазний успіх", async () => {
      const ref = await seedGoal();
      expect((await ai.executeTool("uid1", "goal_checkin", { id: "вигаданий" }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "complete_milestone",
        { goalId: ref.id, milestoneId: "вигадана" }, ctx)).isError).toBe(true);
    });
  });

  // ---- Заощадження ----
  describe("заощадження", () => {
    async function pot(name) {
      const r = await ai.executeTool("uid1", "add_savings_goal", { name }, ctx);
      return r.output.id;
    }

    test("скарбничка створюється й одразу видна в savings_summary", async () => {
      const id = await pot("На відпустку");
      const r = await ai.executeTool("uid1", "savings_summary", {}, ctx);
      expect(r.output.goals).toContainEqual({ id, goal: "На відпустку", saved: 0 });
    });

    test("поповнення додає, зняття віднімає", async () => {
      const id = await pot("На ноутбук");
      await ai.executeTool("uid1", "add_savings_entry", { goalId: id, type: "deposit", amount: 1000 }, ctx);
      await ai.executeTool("uid1", "add_savings_entry", { goalId: id, type: "withdraw", amount: 250 }, ctx);
      const r = await ai.executeTool("uid1", "savings_summary", {}, ctx);
      expect(r.output.goals.find((g) => g.id === id).saved).toBe(750);
      expect(r.output.total).toBe(750);
    });

    test("операція записується у форматі сторінки заощаджень", async () => {
      const id = await pot("Подушка");
      const r = await ai.executeTool("uid1", "add_savings_entry",
        { goalId: id, type: "deposit", amount: 500.555, note: "з премії", date: "2026-08-19" }, ctx);
      const snap = await mockCurrent.collection("users").doc("uid1").collection("savings").get();
      expect(snap.docs[0].data()).toEqual({
        type: "deposit", amount: 500.56, currency: "UAH", note: "з премії", date: "2026-08-19", goalId: id,
      });
      expect(r.action).toMatchObject({ kind: "savings_entry", type: "deposit", currency: "\u20B4" });
    });

    // Операція без існуючої цілі осиротіла б: на сторінці все згруповано
    // за цілями, і такий запис ніде не показався б.
    test("гроші не кладуться у неіснуючу скарбничку", async () => {
      const r = await ai.executeTool("uid1", "add_savings_entry",
        { goalId: "вигаданий", type: "deposit", amount: 100 }, ctx);
      expect(r.isError).toBe(true);
      const snap = await mockCurrent.collection("users").doc("uid1").collection("savings").get();
      expect(snap.docs.length).toBe(0);
    });

    test("недодатна сума не приймається", async () => {
      const id = await pot("Подушка");
      expect((await ai.executeTool("uid1", "add_savings_entry",
        { goalId: id, type: "deposit", amount: 0 }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "add_savings_entry",
        { goalId: id, type: "deposit", amount: -50 }, ctx)).isError).toBe(true);
    });

    test("перейменування зберігає накопичене", async () => {
      const id = await pot("Стара назва");
      await ai.executeTool("uid1", "add_savings_entry", { goalId: id, type: "deposit", amount: 300 }, ctx);
      const r = await ai.executeTool("uid1", "rename_savings_goal", { id, name: "Нова назва" }, ctx);
      expect(r.output).toMatchObject({ from: "Стара назва", to: "Нова назва" });
      const sum = await ai.executeTool("uid1", "savings_summary", {}, ctx);
      expect(sum.output.goals.find((g) => g.id === id)).toMatchObject({ goal: "Нова назва", saved: 300 });
    });
  });

  // ---- Правки вже записаного ----
  describe("правки", () => {
    test("edit_transaction міняє тільки надіслані поля", async () => {
      const add = await ai.executeTool("uid1", "add_transaction",
        { type: "expense", amount: 80, category: "food", note: "кава", date: "2026-08-10" }, ctx);
      const r = await ai.executeTool("uid1", "edit_transaction", { id: add.output.id, amount: 95 }, ctx);
      expect(r.output).toMatchObject({ amount: 95, category: "food", note: "кава", date: "2026-08-10" });
    });

    test("edit_transaction знаходить операцію через query_transactions", async () => {
      await ai.executeTool("uid1", "add_transaction",
        { type: "expense", amount: 80, category: "food", date: "2026-08-10" }, ctx);
      const list = await ai.executeTool("uid1", "query_transactions",
        { from: "2026-08-01", to: "2026-08-31" }, ctx);
      const id = list.output.items[0].id;
      expect(typeof id).toBe("string");
      const r = await ai.executeTool("uid1", "edit_transaction", { id, category: "other" }, ctx);
      expect(r.output.category).toBe("other");
    });

    test("edit_task не скидає виконаність, підзадачі й нагадування", async () => {
      const ref = await mockCurrent.collection("users").doc("uid1").collection("tasks").add({
        title: "Стара назва", notes: "", done: true, completedAt: "колись", priority: "high", tags: ["дім"],
        dueDate: "2026-08-20", dueTime: "18:00", estimateMin: 30, recurrence: { type: "weekly" },
        reminderAt: "нагадування", notifiedAt: null, subtasks: [{ id: "s1", title: "крок", done: true }],
      });
      await ai.executeTool("uid1", "edit_task", { id: ref.id, title: "Нова назва" }, ctx);
      const doc = await mockCurrent.collection("users").doc("uid1").collection("tasks").doc(ref.id).get();
      expect(doc.data()).toMatchObject({
        title: "Нова назва", done: true, completedAt: "колись", priority: "high",
        dueDate: "2026-08-20", dueTime: "18:00", recurrence: { type: "weekly" }, reminderAt: "нагадування",
      });
      expect(doc.data().subtasks).toEqual([{ id: "s1", title: "крок", done: true }]);
    });

    test("прибрана дата забирає й час — інакше час нікуди приткнути", async () => {
      const add = await ai.executeTool("uid1", "add_task",
        { title: "Справа", dueDate: "2026-08-20", dueTime: "18:00" }, ctx);
      await ai.executeTool("uid1", "edit_task", { id: add.output.id, dueDate: null }, ctx);
      const doc = await mockCurrent.collection("users").doc("uid1").collection("tasks").doc(add.output.id).get();
      expect(doc.data()).toMatchObject({ dueDate: null, dueTime: null });
    });

    test("edit_workout без exercises лишає вправи недоторканими", async () => {
      const add = await ai.executeTool("uid1", "add_workout",
        { date: "2026-08-18", exercises: [{ libId: "squat", sets: [{ weight: 80, reps: 5 }] }] }, ctx);
      const before = (await mockCurrent.collection("users").doc("uid1")
        .collection("workouts").doc(add.output.id).get()).data().exercises;
      await ai.executeTool("uid1", "edit_workout", { id: add.output.id, name: "Ноги" }, ctx);
      const after = (await mockCurrent.collection("users").doc("uid1")
        .collection("workouts").doc(add.output.id).get()).data();
      expect(after.name).toBe("Ноги");
      expect(after.exercises).toEqual(before);
    });

    test("edit_workout з exercises замінює список цілком", async () => {
      const add = await ai.executeTool("uid1", "add_workout",
        { exercises: [{ libId: "squat", sets: [{ weight: 80, reps: 5 }] }] }, ctx);
      await ai.executeTool("uid1", "edit_workout", {
        id: add.output.id,
        exercises: [{ libId: "squat", sets: [{ weight: 85, reps: 5 }] }, { libId: "lunge", sets: [{ weight: 20, reps: 10 }] }],
      }, ctx);
      const doc = await mockCurrent.collection("users").doc("uid1").collection("workouts").doc(add.output.id).get();
      expect(doc.data().exercises.map((e) => e.libId)).toEqual(["squat", "lunge"]);
      expect(doc.data().exercises[0].sets).toEqual([{ weight: 85, reps: 5 }]);
    });

    test("edit_goal зберігає чекіни, журнал і пройдені віхи", async () => {
      const add = await ai.executeTool("uid1", "add_goal",
        { title: "Марафон", milestones: ["10 км", "21 км"] }, ctx);
      const col = mockCurrent.collection("users").doc("uid1").collection("goals");
      const created = (await col.doc(add.output.id).get()).data();
      await col.doc(add.output.id).update({
        checkins: ["2026-08-18"], journal: [{ id: "j1", text: "перший забіг" }],
        milestones: created.milestones.map((m) => (m.title === "10 км" ? { ...m, done: true } : m)),
      });

      await ai.executeTool("uid1", "edit_goal",
        { id: add.output.id, title: "Марафон за 4 години", milestones: ["10 км", "21 км", "30 км"] }, ctx);
      const g = (await col.doc(add.output.id).get()).data();
      expect(g.title).toBe("Марафон за 4 години");
      expect(g.checkins).toEqual(["2026-08-18"]);
      expect(g.journal).toEqual([{ id: "j1", text: "перший забіг" }]);
      expect(g.milestones.map((m) => [m.title, m.done]))
        .toEqual([["10 км", true], ["21 км", false], ["30 км", false]]);
    });

    // Пройдені кілометри — така сама історія, як чекіни: правка формулювання
    // мети не має її обнуляти.
    test("edit_goal зберігає пройдене й уміє змінити саму мету", async () => {
      const add = await ai.executeTool("uid1", "add_goal",
        { title: "Марафон", targetValue: 10, unit: "км" }, ctx);
      await ai.executeTool("uid1", "goal_progress", { id: add.output.id, add: 6.4 }, ctx);

      await ai.executeTool("uid1", "edit_goal", { id: add.output.id, title: "Півмарафон" }, ctx);
      const col = mockCurrent.collection("users").doc("uid1").collection("goals");
      expect((await col.doc(add.output.id).get()).data())
        .toMatchObject({ title: "Півмарафон", targetValue: 10, unit: "км", currentValue: 6.4 });

      await ai.executeTool("uid1", "edit_goal", { id: add.output.id, targetValue: 21, unit: "км" }, ctx);
      expect((await col.doc(add.output.id).get()).data())
        .toMatchObject({ targetValue: 21, currentValue: 6.4 });
    });

    test("edit_goal прибирає числову мету разом із одиницею", async () => {
      const add = await ai.executeTool("uid1", "add_goal",
        { title: "Марафон", targetValue: 10, unit: "км" }, ctx);
      await ai.executeTool("uid1", "edit_goal", { id: add.output.id, targetValue: null }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g).toMatchObject({ targetValue: null, unit: "" });
    });

    test("edit_goal міняє статус, не чіпаючи решти", async () => {
      const add = await ai.executeTool("uid1", "add_goal", { title: "Ціль", category: "career" }, ctx);
      await ai.executeTool("uid1", "edit_goal", { id: add.output.id, status: "done" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g).toMatchObject({ status: "done", title: "Ціль", category: "career" });
    });

    test("порожня правка й неіснуючий id повертають помилку", async () => {
      const add = await ai.executeTool("uid1", "add_task", { title: "Справа" }, ctx);
      expect((await ai.executeTool("uid1", "edit_task", { id: add.output.id }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "edit_task", { id: "вигаданий", title: "X" }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "edit_transaction", { id: "вигаданий", amount: 5 }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "edit_goal", { id: "вигаданий", title: "X" }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "edit_workout", { id: "вигаданий", name: "X" }, ctx)).isError).toBe(true);
    });

    test("видалення немає серед інструментів — це свідомо", () => {
      const names = ai.toolNames ? ai.toolNames() : [];
      expect(names.some((n) => /delete|remove/i.test(n))).toBe(false);
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
      expect(r.output.goals[0]).toMatchObject({
        title: "Вивчити польську", status: "active", targetDate: "2026-12-31",
        milestonesDone: 1, milestonesTotal: 2, checkins: 2, checkedInToday: false,
      });
    });

    // Без id адресувати goal_checkin і complete_milestone нічим — модель
    // могла б хіба вгадувати, а вгадані id мовчки нічого не зроблять.
    test("goals_progress віддає id цілі та id віх", async () => {
      const ref = await mockCurrent.collection("users").doc("uid1").collection("goals").add({
        title: "Марафон", status: "active", milestones: [{ id: "m1", title: "10 км", done: false }], checkins: [],
      });
      const r = await ai.executeTool("uid1", "goals_progress", {}, ctx);
      expect(r.output.goals[0].id).toBe(ref.id);
      expect(r.output.goals[0].milestones).toEqual([{ id: "m1", title: "10 км", done: false }]);
    });

    test("savings_summary віднімає зняття, а не додає", async () => {
      const goals = mockCurrent.collection("users").doc("uid1").collection("savingsGoals");
      const goal = await goals.add({ name: "На відпустку" });
      const col = mockCurrent.collection("users").doc("uid1").collection("savings");
      await col.add({ goalId: goal.id, type: "deposit", amount: 500, date: "2026-08-01" });
      await col.add({ goalId: goal.id, type: "withdraw", amount: 200, date: "2026-08-10" });

      const r = await ai.executeTool("uid1", "savings_summary", {}, ctx);
      expect(r.output.total).toBe(300);
      expect(r.output.goals[0]).toMatchObject({ goal: "На відпустку", saved: 300 });
    });

    // Щойно створена ціль ще порожня. Якби вона не потрапляла в перелік,
    // покласти в неї гроші не вийшло б — модель не дізналася б її id.
    test("savings_summary показує й цілі без жодної операції", async () => {
      const ref = await mockCurrent.collection("users").doc("uid1").collection("savingsGoals")
        .add({ name: "На ноутбук", createdAt: new Date() });
      const r = await ai.executeTool("uid1", "savings_summary", {}, ctx);
      expect(r.output.goals).toContainEqual({ id: ref.id, goal: "На ноутбук", saved: 0 });
    });
  });
});

// Доки людина не редагувала категорії, у профілі їх немає — сторінки просто
// показують стандартний список. Помічник має бачити той самий, інакше все,
// що він записує з чату, лягає в «Інше».
describe("категорії за замовчуванням", () => {
  const defaults = require("./categories-default");

  test("порожній профіль дає той самий список, що й сторінка бюджету", () => {
    const expected = defaults.defaultCategoryList("expense", "uk").map((c) => c.id);
    expect(expected).toContain("food");
    expect(expected.length).toBeGreaterThan(1);
  });

  test("витрата з чату потрапляє у справжню категорію, а не в «Інше»", async () => {
    const ctx = {
      currency: "UAH",
      categoriesExpense: defaults.defaultCategoryList("expense", "uk"),
      categoriesIncome: defaults.defaultCategoryList("income", "uk"),
    };
    const r = await ai.executeTool("uid1", "add_transaction",
      { type: "expense", amount: 80, category: "food" }, ctx);
    expect(r.action).toMatchObject({ category: "food", categoryLabel: "Їжа" });
  });

  test("список потрапляє в системний промпт назвами, а не id", () => {
    const prompt = ai.buildSystemPrompt({
      today: "2026-08-20", lang: "uk", currency: "UAH",
      categoriesExpense: defaults.defaultCategoryList("expense", "uk"),
      categoriesIncome: defaults.defaultCategoryList("income", "uk"),
    });
    expect(prompt).toContain("food (Їжа)");
    expect(prompt).toContain("salary (Зарплата)");
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

// ---- Розбиття цілі на віхи ----
describe("handleGoalBreakdown", () => {
  const authedCtx = { auth: { uid: "uid1" } };
  const reply = (input) => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: "tool_use", name: "propose_milestones", id: "t1", input }],
      }),
    },
  });

  test("кидає unauthenticated без auth", async () => {
    await expect(ai.handleGoalBreakdown({ title: "Марафон" }, {})).rejects.toThrow(/вхід/);
  });

  test("кидає invalid-argument без назви цілі", async () => {
    await expect(ai.handleGoalBreakdown({ title: "   " }, authedCtx)).rejects.toThrow(/назви/);
  });

  test("повертає віхи назвами, придатними для форми", async () => {
    resetDb({ "users/uid1": { lang: "uk" } });
    const fake = reply({
      milestones: [{ title: "Пробігти 5 км" }, { title: "Пробігти 10 км" }, { title: "Пробігти 21 км" }],
      note: "Дистанція росте поступово.",
    });
    const res = await ai.handleGoalBreakdown({ title: "Пробігти марафон" }, authedCtx, { anthropicClient: fake });
    expect(res.milestones).toEqual(["Пробігти 5 км", "Пробігти 10 км", "Пробігти 21 км"]);
    expect(res.note).toBe("Дистанція росте поступово.");
  });

  // Форма приймає лише список назв, тож інструмент має бути ПРИМУСОВИЙ:
  // без цього модель час від часу відповідала б звичайним текстом.
  test("інструмент викликається примусово й одним запитом", async () => {
    resetDb({ "users/uid1": { lang: "uk" } });
    const fake = reply({ milestones: [{ title: "A" }, { title: "Б" }, { title: "В" }] });
    await ai.handleGoalBreakdown({ title: "Ціль" }, authedCtx, { anthropicClient: fake });
    expect(fake.messages.create).toHaveBeenCalledTimes(1);
    const args = fake.messages.create.mock.calls[0][0];
    expect(args.tool_choice).toEqual({ type: "tool", name: "propose_milestones" });
    expect(args.tools.map((t) => t.name)).toEqual(["propose_milestones"]);
  });

  test("контекст цілі потрапляє в запит, а мова — у системний промпт", async () => {
    resetDb({ "users/uid1": { lang: "pl" } });
    const fake = reply({ milestones: [{ title: "A" }, { title: "Б" }, { title: "В" }] });
    await ai.handleGoalBreakdown({
      title: "Пробігти марафон", category: "health", why: "хочу дожити до 90",
      targetDate: "2027-04-18", targetValue: 42.2, unit: "км",
    }, authedCtx, { anthropicClient: fake });
    const args = fake.messages.create.mock.calls[0][0];
    const prompt = args.messages[0].content;
    expect(prompt).toContain("Пробігти марафон");
    expect(prompt).toContain("хочу дожити до 90");
    expect(prompt).toContain("2027-04-18");
    expect(prompt).toContain("42.2 км");
    expect(args.system).toContain("польською");
  });

  // Куца відповідь — це не привід підсунути «Крок 1, Крок 2» власного
  // виробництва: краще сказати, що не вийшло.
  test("менше трьох віх — чесна помилка, а не вигадані кроки", async () => {
    resetDb({ "users/uid1": { lang: "uk" } });
    const fake = reply({ milestones: [{ title: "Єдиний крок" }] });
    await expect(ai.handleGoalBreakdown({ title: "Ціль" }, authedCtx, { anthropicClient: fake }))
      .rejects.toThrow(/Не вийшло розбити/);
  });

  test("відповідь без виклику інструмента теж помилка", async () => {
    resetDb({ "users/uid1": { lang: "uk" } });
    const fake = { messages: { create: jest.fn().mockResolvedValue({ content: [{ type: "text", text: "ось план" }] }) } };
    await expect(ai.handleGoalBreakdown({ title: "Ціль" }, authedCtx, { anthropicClient: fake }))
      .rejects.toThrow(/Не вийшло розбити/);
  });

  test("модель береться з профілю", async () => {
    resetDb({ "users/uid1": { lang: "uk", aiModel: "opus" } });
    const fake = reply({ milestones: [{ title: "A" }, { title: "Б" }, { title: "В" }] });
    await ai.handleGoalBreakdown({ title: "Ціль" }, authedCtx, { anthropicClient: fake });
    expect(fake.messages.create.mock.calls[0][0].model).toBe(ai.MODELS.opus);
  });
});

describe("sanitizeBreakdown", () => {
  test("обрізає нумерацію, пробіли й довгі назви", () => {
    const r = ai.sanitizeBreakdown({ milestones: [
      { title: "1. Перший крок" }, { title: "  2) Другий крок  " }, { title: "я".repeat(300) },
    ] });
    expect(r.milestones[0]).toBe("Перший крок");
    expect(r.milestones[1]).toBe("Другий крок");
    expect(r.milestones[2].length).toBe(200);
  });

  test("викидає порожні й повторені", () => {
    const r = ai.sanitizeBreakdown({ milestones: [
      { title: "Крок" }, { title: "  " }, { title: "КРОК" }, { title: null }, "Крок другий",
    ] });
    expect(r.milestones).toEqual(["Крок", "Крок другий"]);
  });

  test("більше семи віх не пропускає", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ title: `Крок ${i + 1}` }));
    expect(ai.sanitizeBreakdown({ milestones: many }).milestones.length).toBe(7);
  });

  test("сміття замість відповіді дає порожній список, а не падіння", () => {
    expect(ai.sanitizeBreakdown(undefined).milestones).toEqual([]);
    expect(ai.sanitizeBreakdown({ milestones: "ні" }).milestones).toEqual([]);
    expect(ai.sanitizeBreakdown({ milestones: [] }).note).toBe("");
  });
});
