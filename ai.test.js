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
    // Категорії цілей людина редагує сама, тож вони теж їдуть контекстом —
    // так само, як категорії витрат. Беремо повний стандартний список: саме
    // його бачить той, хто категорій ще не чіпав.
    categoriesGoals: require("./categories-default").defaultGoalCategoryList("uk"),
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

    // Сторінка зберігає назву вже перекладеною, тож після зміни мови
    // інтерфейсу та сама вправа розʼїжджалась на два різні рекорди.
    test("рекорд не двоїться, коли ту саму вправу записано різними мовами", async () => {
      const col = mockCurrent.collection("users").doc("uid1").collection("workouts");
      await col.add({ date: "2026-08-10", exercises: [
        { libId: "benchPress", name: "Жим лежачи", muscle: "chest", sets: [{ weight: 60, reps: 8 }] },
      ] });
      await col.add({ date: "2026-08-17", exercises: [
        { libId: "benchPress", name: "Bench Press", muscle: "chest", sets: [{ weight: 70, reps: 5 }] },
      ] });
      const r = await ai.executeTool("uid1", "personal_records", {}, ctx);
      expect(r.output.count).toBe(1);
      expect(r.output.records[0]).toMatchObject({ exercise: "Жим лежачи", weight: 70, reps: 5 });
    });

    // ---- Розбір для тренера ----
    const day = (n) => {
      const d = new Date(2026, 7, 20);
      d.setDate(d.getDate() - n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const coachCtx = { ...ctx, today: "2026-08-20" };
    async function seedTrend() {
      const col = mockCurrent.collection("users").doc("uid1").collection("workouts");
      const bench = (w, r) => ({ libId: "benchPress", name: "Жим лежачи", muscle: "chest", sets: [{ weight: w, reps: r }] });
      const squat = (w, r) => ({ libId: "squat", name: "Присідання", muscle: "legs", sets: [{ weight: w, reps: r }] });
      await col.add({ date: day(2), exercises: [bench(90, 8)] });
      await col.add({ date: day(9), exercises: [bench(88, 8)] });
      await col.add({ date: day(35), exercises: [bench(80, 8), squat(100, 5)] });
      await col.add({ date: day(42), exercises: [bench(80, 8)] });
    }

    test("training_analysis віддає готові тренди, а не сирі підходи", async () => {
      await seedTrend();
      const r = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      expect(r.output).toMatchObject({
        enough: true, verdict: "up", strengthChangePct: 13, comparedExercises: 1,
        sessions: { last28: 2, previous28: 2 },
      });
      expect(r.output.exercises[0]).toMatchObject({
        exercise: "Жим лежачи", e1rm: 114, e1rmMonthAgo: 101.3, changePct: 13,
      });
    });

    // Порада в чаті не має розходитись із кнопкою «Підставити» у формі:
    // це той самий розрахунок.
    test("до кожної вправи додається та сама наступна вага, що й у формі", async () => {
      await seedTrend();
      const r = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      const bench = r.output.exercises.find((e) => e.exercise === "Жим лежачи");
      expect(bench.nextSuggestion).toMatchObject({ weight: 92.5, reps: 5, direction: "up", why: "hitTop" });
    });

    // Питання «що мені сьогодні робити» приходить і в чат, і на екран —
    // відповідь має бути однією.
    test("віддає ту саму пропозицію на сьогодні, що й картка на сторінці", async () => {
      await seedTrend();
      const r = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      expect(r.output.todaySuggestion).toMatchObject({ rest: false });
      expect(r.output.todaySuggestion.muscles[0]).toMatchObject({ muscle: "legs", daysAgo: 35 });
      // Назва береться з бібліотеки мовою користувача, а не з того, що
      // колись записали в документ.
      expect(r.output.todaySuggestion.exercises[0]).toMatchObject({ exercise: "Присідання зі штангою", muscle: "legs" });
    });

    test("порожня історія не дає пропозиції на сьогодні", async () => {
      const r = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      expect(r.output.todaySuggestion).toBe(null);
    });

    // Сну й пульсу застосунок не знає — єдине джерело про відновлення це
    // сама людина, і воно має доїжджати до плану.
    test("log_readiness пише один запис на добу й перезаписує його", async () => {
      const r = await ai.executeTool("uid1", "log_readiness", { level: "low" }, coachCtx);
      expect(r.output).toMatchObject({ ok: true, level: "low", date: "2026-08-20" });
      await ai.executeTool("uid1", "log_readiness", { level: "ok" }, coachCtx);
      const snap = await mockCurrent.collection("users").doc("uid1").collection("readiness").get();
      expect(snap.docs.length).toBe(1);
      expect(snap.docs[0].data()).toMatchObject({ level: "ok", date: "2026-08-20" });
    });

    test("вигаданий рівень самопочуття не приймається", async () => {
      const r = await ai.executeTool("uid1", "log_readiness", { level: "мертвий" }, coachCtx);
      expect(r.isError).toBe(true);
      const snap = await mockCurrent.collection("users").doc("uid1").collection("readiness").get();
      expect(snap.docs.length).toBe(0);
    });

    test("самопочуття зсуває план на сьогодні", async () => {
      await seedTrend();
      const full = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      const before = full.output.todaySuggestion.exercises[0];

      await ai.executeTool("uid1", "log_readiness", { level: "low" }, coachCtx);
      const after = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      expect(after.output.readinessToday).toBe("low");
      expect(after.output.todaySuggestion.readiness).toBe("low");
      const eased = after.output.todaySuggestion.exercises[0];
      expect(eased.sets).toBeLessThanOrEqual(before.sets);
      expect(eased.weight).toBeLessThan(before.weight);
      expect(eased.direction).toBe("down");
    });

    test("без запису самопочуття план лишається повним", async () => {
      await seedTrend();
      const r = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      expect(r.output.readinessToday).toBe(null);
      expect(r.output.todaySuggestion.readiness).toBe(null);
    });

    test("промпт веде записувати самопочуття, а не вигадувати відновлення", () => {
      expect(ai.buildSystemPrompt(coachCtx)).toContain("log_readiness");
    });

    test("показує, скільки днів група мʼязів відпочивала", async () => {
      await seedTrend();
      const r = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      const legs = r.output.muscles.find((m) => m.muscle === "legs");
      const chest = r.output.muscles.find((m) => m.muscle === "chest");
      expect(legs.daysSinceTrained).toBe(35);
      expect(chest.daysSinceTrained).toBe(2);
    });

    // Два записи — це не тренд. Модель має отримати чесне «замало», а не
    // цифру, з якої вона зробить впевнений висновок.
    test("на куцій історії чесно каже, що даних мало", async () => {
      const col = mockCurrent.collection("users").doc("uid1").collection("workouts");
      await col.add({ date: day(2), exercises: [{ libId: "benchPress", name: "Жим", muscle: "chest", sets: [{ weight: 80, reps: 8 }] }] });
      const r = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      expect(r.output).toMatchObject({ enough: false, needSessions: 1, strengthChangePct: null });
    });

    test("порожня історія не ламає розбір", async () => {
      const r = await ai.executeTool("uid1", "training_analysis", {}, coachCtx);
      expect(r.output).toMatchObject({ enough: false, exercises: [], muscles: [] });
    });

    test("промпт веде до training_analysis і забороняє вигадувати сон і калорії", () => {
      const prompt = ai.buildSystemPrompt(coachCtx);
      expect(prompt).toContain("training_analysis");
      expect(prompt).toMatch(/сну, пульсу, калорій/);
      expect(prompt).toMatch(/схоже, що/);
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
        title: "Марафон", status: "active", checkins: [], milestones: [],
        ...extra,
      });
    }
    const today = () => new Date().toISOString().slice(0, 10);

    test("add_goal створює ціль із типовими полями", async () => {
      const r = await ai.executeTool("uid1", "add_goal", {
        title: "Пробігти марафон", category: "health", why: "хочу дожити до 90",
      }, ctx);
      expect(r.output).toMatchObject({ ok: true });

      const doc = await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get();
      expect(doc.data()).toMatchObject({
        title: "Пробігти марафон", category: "health", why: "хочу дожити до 90",
        status: "active", checkins: [], journal: [],
      });
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

    // ---- Дедлайн, виведений із місяця ----
    // Окремого поля дедлайну немає ні у формі, ні в інструменті: для місячної
    // цілі він уже сказаний місяцем, а річна лишається без нього.
    test("місячна ціль отримує дедлайном кінець свого місяця", async () => {
      const r = await ai.executeTool("uid1", "add_goal",
        { title: "Прочитати дві книжки", horizon: "month", month: "2026-02" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get()).data();
      expect(g).toMatchObject({ horizon: "month", month: "2026-02", targetDate: "2026-02-28" });
    });

    test("річна ціль лишається без дедлайну — рік це напрямок, а не строк", async () => {
      const r = await ai.executeTool("uid1", "add_goal", { title: "Вивчити польську" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get()).data();
      expect(g).toMatchObject({ horizon: "year", month: null, targetDate: null });
    });

    test("дата, надіслана моделлю, дедлайну не задає — його вирішує місяць", async () => {
      const r = await ai.executeTool("uid1", "add_goal",
        { title: "Ціль", horizon: "month", month: "2026-08", targetDate: "2027-04-18" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get()).data();
      expect(g.targetDate).toBe("2026-08-31");
    });

    test("перенесення цілі на інший місяць пересуває й дедлайн", async () => {
      const add = await ai.executeTool("uid1", "add_goal",
        { title: "Ціль", horizon: "month", month: "2026-08" }, ctx);
      await ai.executeTool("uid1", "edit_goal", { id: add.output.id, month: "2026-09" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g).toMatchObject({ month: "2026-09", targetDate: "2026-09-30" });
    });

    test("переїзд на річну вкладку знімає дедлайн разом із місяцем", async () => {
      const add = await ai.executeTool("uid1", "add_goal",
        { title: "Ціль", horizon: "month", month: "2026-08" }, ctx);
      await ai.executeTool("uid1", "edit_goal", { id: add.output.id, horizon: "year" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g).toMatchObject({ horizon: "year", month: null, targetDate: null });
    });

    // Числової мети більше немає: якщо число важливе, воно стоїть у назві.
    test("число, надіслане моделлю, в документ не потрапляє", async () => {
      const r = await ai.executeTool("uid1", "add_goal",
        { title: "Пробігти 10 км", targetValue: 10, unit: "км" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(r.output.id).get()).data();
      expect(g.targetValue).toBeUndefined();
      expect(g.unit).toBeUndefined();
      expect(g.currentValue).toBeUndefined();
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

    // Спадщина в документі — це чужі дані, і правка назви не має права їх
    // зачепити: віх у застосунку більше немає, але записане колись лишається.
    test("edit_goal зберігає чекіни, журнал і спадщину", async () => {
      const add = await ai.executeTool("uid1", "add_goal", { title: "Марафон" }, ctx);
      const col = mockCurrent.collection("users").doc("uid1").collection("goals");
      await col.doc(add.output.id).update({
        checkins: ["2026-08-18"], journal: [{ id: "j1", text: "перший забіг" }],
        milestones: [{ id: "m1", title: "10 км", done: true }],
      });

      await ai.executeTool("uid1", "edit_goal",
        { id: add.output.id, title: "Марафон за 4 години" }, ctx);
      const g = (await col.doc(add.output.id).get()).data();
      expect(g.title).toBe("Марафон за 4 години");
      expect(g.checkins).toEqual(["2026-08-18"]);
      expect(g.journal).toEqual([{ id: "j1", text: "перший забіг" }]);
      expect(g.milestones).toEqual([{ id: "m1", title: "10 км", done: true }]);
    });

    // Числа в старому документі правка не воскрешає й не чіпає: застосунок
    // їх не читає, а стерти чуже поле мовчки — гірше, ніж лишити.
    test("edit_goal числову мету не заводить, скільки б її не надсилали", async () => {
      const add = await ai.executeTool("uid1", "add_goal", { title: "Марафон" }, ctx);
      await ai.executeTool("uid1", "edit_goal",
        { id: add.output.id, title: "Півмарафон", targetValue: 21, unit: "км" }, ctx);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g.title).toBe("Півмарафон");
      expect(g.targetValue).toBeUndefined();
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

  describe("render_chart", () => {
    test("кругова діаграма повертає action з даними, без запису в Firestore", async () => {
      const r = await ai.executeTool("uid1", "render_chart", {
        type: "pie", title: "Витрати за липень",
        labels: ["Їжа", "Транспорт"], datasets: [{ values: [1200, 300] }],
      }, ctx);
      expect(r.isError).toBeFalsy();
      expect(r.action).toMatchObject({
        kind: "chart",
        chart: { type: "pie", title: "Витрати за липень", labels: ["Їжа", "Транспорт"] },
      });
      expect(r.action.chart.datasets).toEqual([{ label: "", values: [1200, 300] }]);
    });

    test("другий ряд у pie відкидається — частки одного цілого, другому нема куди подітись", async () => {
      const r = await ai.executeTool("uid1", "render_chart", {
        type: "pie", labels: ["A", "B"],
        datasets: [{ values: [1, 2] }, { label: "зайвий", values: [3, 4] }],
      }, ctx);
      expect(r.action.chart.datasets).toHaveLength(1);
    });

    test("bar з кількома рядами (дохід і витрати) лишає обидва", async () => {
      const r = await ai.executeTool("uid1", "render_chart", {
        type: "bar", labels: ["Черв", "Лип"],
        datasets: [{ label: "Дохід", values: [20000, 21000] }, { label: "Витрати", values: [15000, 16000] }],
      }, ctx);
      expect(r.action.chart.datasets).toHaveLength(2);
      expect(r.action.chart.datasets[1].label).toBe("Витрати");
    });

    test("невідомий тип, без labels чи без значень — чесна помилка, а не порожня діаграма", async () => {
      expect((await ai.executeTool("uid1", "render_chart", { type: "donut", labels: ["A"], datasets: [{ values: [1] }] }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "render_chart", { type: "bar", labels: [], datasets: [{ values: [1] }] }, ctx)).isError).toBe(true);
      expect((await ai.executeTool("uid1", "render_chart", { type: "bar", labels: ["A"], datasets: [] }, ctx)).isError).toBe(true);
    });

    test("нечислові значення в datasets — нуль, а не крах", async () => {
      const r = await ai.executeTool("uid1", "render_chart", {
        type: "line", labels: ["A", "B"], datasets: [{ values: ["не число", 5] }],
      }, ctx);
      expect(r.action.chart.datasets[0].values).toEqual([0, 5]);
    });
  });

  // ---- Цілі й заощадження ----
  describe("цілі й заощадження", () => {
    test("goals_progress рахує відмітки", async () => {
      await mockCurrent.collection("users").doc("uid1").collection("goals").add({
        title: "Вивчити польську", status: "active", targetDate: "2026-12-31",
        milestones: [], checkins: ["2026-08-01", "2026-08-02"],
      });
      const r = await ai.executeTool("uid1", "goals_progress", {}, ctx);
      expect(r.output.goals[0]).toMatchObject({
        title: "Вивчити польську", status: "active", targetDate: "2026-12-31",
        checkins: 2, checkedInToday: false,
      });
    });

    // Без id адресувати goal_checkin нічим — модель могла б хіба вгадувати,
    // а вгадані id мовчки нічого не зроблять.
    test("goals_progress віддає id цілі", async () => {
      const ref = await mockCurrent.collection("users").doc("uid1").collection("goals").add({
        title: "Марафон", status: "active", milestones: [], checkins: [],
      });
      const r = await ai.executeTool("uid1", "goals_progress", {}, ctx);
      expect(r.output.goals[0].id).toBe(ref.id);
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

    // «Скільки я зберіг за липень» — це приріст САМЕ за місяць, а не
    // загальний залишок з початку: без цього тесту регресія (знову лише
    // total) пройшла б непоміченою.
    test("savings_summary з month рахує приріст за конкретний місяць окремо від total", async () => {
      const goals = mockCurrent.collection("users").doc("uid1").collection("savingsGoals");
      const goal = await goals.add({ name: "На відпустку" });
      const col = mockCurrent.collection("users").doc("uid1").collection("savings");
      await col.add({ goalId: goal.id, type: "deposit", amount: 1000, date: "2026-07-05" });
      await col.add({ goalId: goal.id, type: "deposit", amount: 500, date: "2026-08-01" });
      await col.add({ goalId: goal.id, type: "withdraw", amount: 200, date: "2026-08-10" });

      const r = await ai.executeTool("uid1", "savings_summary", { month: "2026-08" }, ctx);
      expect(r.output.total).toBe(1300); // весь час: 1000 + 500 - 200
      expect(r.output.period).toMatchObject({ month: "2026-08", net: 300 }); // лише серпень: 500 - 200
      expect(r.output.period.goals[0]).toMatchObject({ goal: "На відпустку", net: 300 });
    });

    test("savings_summary без month period не додає, а невалідний місяць period не ламає", async () => {
      const noMonth = await ai.executeTool("uid1", "savings_summary", {}, ctx);
      expect(noMonth.output.period).toBeUndefined();
      const bad = await ai.executeTool("uid1", "savings_summary", { month: "не дата" }, ctx);
      expect(bad.output.period).toBeUndefined();
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
      categoriesGoals: defaults.defaultGoalCategoryList("uk"),
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
      categoriesGoals: defaults.defaultGoalCategoryList("uk"),
    });
    expect(prompt).toContain("food (Їжа)");
    expect(prompt).toContain("salary (Зарплата)");
  });

  // Модель раніше на «зроби діаграму» вибачалась і пропонувала зводити
  // цифри в Excel/Google Sheets — марна порада в телефоні, коли в
  // застосунку вже є готова кругова діаграма й графік по місяцях.
  // ---- Категорії цілей ----
  // Їх людина редагує сама (goals/app.js -> профіль categoriesGoals). Помічник
  // мусить брати той самий список: інакше він у чаті пропонував би категорії,
  // яких на екрані вже немає, а власну «Хобі» щоразу зводив би до «Іншого».
  describe("категорії цілей", () => {
    test("порожній профіль дає той самий список, що й форма цілі", () => {
      const ids = defaults.defaultGoalCategoryList("uk").map((c) => c.id);
      // Ids ті самі, що були захардкоджені в goals/app.js: інакше кожна вже
      // заведена ціль осиротіла б на своєму 'health'.
      expect(ids).toEqual(["health", "finance", "learning", "career",
        "relationships", "travel", "creativity", "other"]);
    });

    test("стандартний список іде за мовою, а кольори за порядком", () => {
      expect(defaults.defaultGoalCategoryList("en")[0]).toEqual({ id: "health", label: "Health", colorIndex: 0 });
      expect(defaults.defaultGoalCategoryList("pl")[7]).toEqual({ id: "other", label: "Inne", colorIndex: 7 });
      // Невідома мова не має валити список — просто лишається українська.
      expect(defaults.defaultGoalCategoryList("de")[0].label).toBe("Здоров’я");
    });

    test("список цілей потрапляє в системний промпт назвами, а не id", () => {
      const prompt = ai.buildSystemPrompt({
        today: "2026-08-20", lang: "uk", currency: "UAH",
        categoriesExpense: defaults.defaultCategoryList("expense", "uk"),
        categoriesIncome: defaults.defaultCategoryList("income", "uk"),
        categoriesGoals: [{ id: "gcat_x1", label: "Хобі" }, { id: "other", label: "Інше" }],
      });
      expect(prompt).toContain("Категорії цілей: gcat_x1 (Хобі), other (Інше).");
    });

    test("власна категорія доживає до документа, а не зводиться до «Іншого»", async () => {
      const own = {
        today: "2026-08-20", currency: "UAH",
        categoriesExpense: [{ id: "other", label: "Інше" }],
        categoriesIncome: [{ id: "other", label: "Інше" }],
        categoriesGoals: [{ id: "gcat_x1", label: "Хобі" }, { id: "other", label: "Інше" }],
      };
      const add = await ai.executeTool("uid1", "add_goal", { title: "Зібрати модель", category: "gcat_x1" }, own);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g.category).toBe("gcat_x1");
    });

    test("категорія поза списком стає «Іншим», а не потрапляє в документ як є", async () => {
      const own = {
        today: "2026-08-20", currency: "UAH",
        categoriesExpense: [{ id: "other", label: "Інше" }],
        categoriesIncome: [{ id: "other", label: "Інше" }],
        categoriesGoals: [{ id: "gcat_x1", label: "Хобі" }, { id: "other", label: "Інше" }],
      };
      const add = await ai.executeTool("uid1", "add_goal", { title: "Ціль", category: "career" }, own);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g.category).toBe("other");
    });

    test("без «Іншого» в списку запасною стає перша категорія, а не вигаданий id", async () => {
      const own = {
        today: "2026-08-20", currency: "UAH",
        categoriesExpense: [{ id: "other", label: "Інше" }],
        categoriesIncome: [{ id: "other", label: "Інше" }],
        categoriesGoals: [{ id: "gcat_work", label: "Робота" }, { id: "gcat_body", label: "Тіло" }],
      };
      const add = await ai.executeTool("uid1", "add_goal", { title: "Ціль", category: "вигадане" }, own);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g.category).toBe("gcat_work");
    });

    // Раніше список був однаковий для всіх, і категорія переживала будь-яку
    // правку сама собою. Відколи він у кожного свій, ціль може носити
    // категорію, видалену на іншому пристрої, — і зміна статусу не має
    // ставати мовчазним переїздом цієї цілі в «Інше».
    test("правка, яка не торкається категорії, лишає її як була", async () => {
      const own = {
        today: "2026-08-20", currency: "UAH",
        categoriesExpense: [{ id: "other", label: "Інше" }],
        categoriesIncome: [{ id: "other", label: "Інше" }],
        categoriesGoals: [{ id: "gcat_x1", label: "Хобі" }, { id: "other", label: "Інше" }],
      };
      const add = await ai.executeTool("uid1", "add_goal", { title: "Ціль", category: "gcat_x1" }, own);
      // Категорію тим часом видалили на іншому пристрої.
      const narrowed = { ...own, categoriesGoals: [{ id: "other", label: "Інше" }] };
      await ai.executeTool("uid1", "edit_goal", { id: add.output.id, status: "paused" }, narrowed);
      const g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g.status).toBe("paused");
      expect(g.category).toBe("gcat_x1");
    });

    test("а правка, яка торкається, — міняє й звіряє зі списком", async () => {
      const own = {
        today: "2026-08-20", currency: "UAH",
        categoriesExpense: [{ id: "other", label: "Інше" }],
        categoriesIncome: [{ id: "other", label: "Інше" }],
        categoriesGoals: [{ id: "gcat_x1", label: "Хобі" }, { id: "other", label: "Інше" }],
      };
      const add = await ai.executeTool("uid1", "add_goal", { title: "Ціль", category: "other" }, own);
      await ai.executeTool("uid1", "edit_goal", { id: add.output.id, category: "gcat_x1" }, own);
      let g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g.category).toBe("gcat_x1");

      await ai.executeTool("uid1", "edit_goal", { id: add.output.id, category: "вигадане" }, own);
      g = (await mockCurrent.collection("users").doc("uid1").collection("goals").doc(add.output.id).get()).data();
      expect(g.category).toBe("other");
    });
  });

  test("на прохання про графік промпт веде до вкладки «Статистика», а не Excel", () => {
    const prompt = ai.buildSystemPrompt({
      today: "2026-08-20", lang: "uk", currency: "UAH",
      categoriesExpense: defaults.defaultCategoryList("expense", "uk"),
      categoriesIncome: defaults.defaultCategoryList("income", "uk"),
      categoriesGoals: defaults.defaultGoalCategoryList("uk"),
    });
    expect(prompt).toContain("Статистика");
    expect(prompt).toMatch(/НЕ пропонуй.*Excel/);
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
