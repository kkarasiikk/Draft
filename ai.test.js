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
