const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");

// admin.initializeApp() уже викликано в index.js — тут просто перевикористовуємо
// той самий інстанс. У тестах цей рядок працює з jest.mock("firebase-admin", ...)
// (див. functions/test/ai.test.js) — admin.firestore() повертає фейкову БД.
const db = admin.firestore();

const MODEL = "claude-sonnet-5";
const MAX_MESSAGE_LEN = 1000;
const MAX_HISTORY_MESSAGES = 16; // скільки попередніх реплік (user+assistant) береться в контекст
const MAX_TOOL_ROUNDS = 4; // запобіжник від нескінченного циклу викликів інструментів
const MAX_OUTPUT_TOKENS = 1024;

// ---- Абузостійкість / контроль вартості ----
// На відміну від walletSync (публічний ключ), сюди можна достукатись лише
// з валідним Firebase Auth токеном, тож ліміт тут — не проти брутфорсу,
// а проти випадкового зациклення на клієнті й неконтрольованих витрат на API.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 хв
const RATE_LIMIT_MAX_MESSAGES = 30;

async function enforceRateLimit(uid) {
  const ref = db.collection("aiChatRateLimits").doc(uid);
  const now = Date.now();
  const limited = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.exists ? doc.data() : null;
    if (!data || now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      tx.set(ref, { windowStart: now, count: 1 });
      return false;
    }
    if (data.count >= RATE_LIMIT_MAX_MESSAGES) return true;
    tx.update(ref, { count: admin.firestore.FieldValue.increment(1) });
    return false;
  });
  if (limited) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Забагато повідомлень. Спробуй трохи пізніше."
    );
  }
}

// ---- Валідація полів транзакції ----
// Дзеркалить firestore.rules (isValidTx) — Admin SDK ці правила не перевіряє
// автоматично, тож той самий контракт даних треба гарантувати тут вручну.
function sanitizeTransactionInput(input, categoriesExpense, categoriesIncome) {
  const type = input.type === "income" ? "income" : input.type === "expense" ? "expense" : null;
  if (!type) return { error: "type має бути 'income' або 'expense'" };

  const amount = Math.round(parseFloat(input.amount) * 100) / 100;
  if (!amount || isNaN(amount) || amount <= 0 || amount >= 1000000000) {
    return { error: "amount має бути додатним числом" };
  }

  const list = type === "income" ? categoriesIncome : categoriesExpense;
  let category = list.find((c) => c.id === input.category);
  if (!category) {
    // AI іноді підбирає найближчу існуючу категорію за змістом, але про всяк
    // випадок підстраховуємось — якщо id не існує, не відкидаємо запит,
    // а мапимо на "інше"/першу доступну категорію користувача.
    category = list.find((c) => c.id === "other") || list[0];
  }
  if (!category) return { error: "у користувача немає жодної категорії цього типу" };

  const note = typeof input.note === "string" ? input.note.slice(0, 200) : "";
  const dateStr =
    typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
      ? input.date
      : new Date().toISOString().slice(0, 10);

  return {
    value: { type, amount, category: category.id, note, date: dateStr, source: "ai" },
  };
}

const tools = [
  {
    name: "add_transaction",
    description:
      "Записати новий дохід або витрату користувача. Використовуй ID категорії зі списку в контексті (не вигадуй нові).",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense"] },
        amount: { type: "number", description: "Сума, додатне число" },
        category: { type: "string", description: "ID категорії зі списку в системному контексті" },
        note: { type: "string", description: "Короткий опис, напр. назва магазину" },
        date: { type: "string", description: "Дата у форматі YYYY-MM-DD, якщо не сьогодні" },
      },
      required: ["type", "amount", "category"],
    },
  },
  {
    name: "query_transactions",
    description:
      "Отримати список і суму транзакцій користувача за період/фільтром. Використовуй, щоб відповісти на питання про витрати, доходи чи баланс — не вигадуй цифри.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Початкова дата YYYY-MM-DD (включно)" },
        to: { type: "string", description: "Кінцева дата YYYY-MM-DD (включно)" },
        type: { type: "string", enum: ["income", "expense"], description: "Фільтр за типом (необов'язково)" },
        category: { type: "string", description: "Фільтр за ID категорії (необов'язково)" },
        limit: { type: "number", description: "Максимум записів у відповіді, за замовчуванням 50" },
      },
      required: ["from", "to"],
    },
  },
];

async function executeTool(uid, name, input, ctx) {
  if (name === "add_transaction") {
    const result = sanitizeTransactionInput(input, ctx.categoriesExpense, ctx.categoriesIncome);
    if (result.error) return { output: { ok: false, error: result.error }, isError: true };
    const docRef = await db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .add({ ...result.value, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return {
      output: { ok: true, id: docRef.id, ...result.value },
      action: { kind: "transaction_added", ...result.value },
    };
  }

  if (name === "query_transactions") {
    const from = typeof input.from === "string" ? input.from : "0000-01-01";
    const to = typeof input.to === "string" ? input.to : "9999-12-31";
    const limit = Math.min(Math.max(parseInt(input.limit, 10) || 50, 1), 200);
    let q = db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .where("date", ">=", from)
      .where("date", "<=", to);
    if (input.type === "income" || input.type === "expense") q = q.where("type", "==", input.type);
    const snap = await q.get();
    let docs = snap.docs.map((d) => d.data());
    if (input.category) docs = docs.filter((d) => d.category === input.category);
    const sumIncome = docs.filter((d) => d.type === "income").reduce((s, d) => s + d.amount, 0);
    const sumExpense = docs.filter((d) => d.type === "expense").reduce((s, d) => s + d.amount, 0);
    const items = docs
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit)
      .map((d) => ({ type: d.type, amount: d.amount, category: d.category, note: d.note, date: d.date }));
    return {
      output: { count: docs.length, sumIncome, sumExpense, currency: ctx.currency, items },
    };
  }

  return { output: { ok: false, error: "unknown tool" }, isError: true };
}

function buildSystemPrompt(ctx) {
  const catList = (list) => list.map((c) => `${c.id} (${c.label})`).join(", ");
  return [
    "Ти — фінансовий помічник у застосунку 'Life' (особистий облік доходів/витрат).",
    `Сьогодні: ${ctx.today}. Мова відповіді: ${ctx.lang}. Валюта користувача за замовчуванням: ${ctx.currency}.`,
    `Категорії витрат: ${catList(ctx.categoriesExpense)}.`,
    `Категорії доходів: ${catList(ctx.categoriesIncome)}.`,
    "Коли користувач просить записати витрату/дохід — визнач суму, найбільш підходящу існуючу категорію (за id) і виклич add_transaction. Не питай зайвих уточнень, якщо сенс і так зрозумілий (напр. 'кава 80 грн' -> expense, amount 80, category 'food').",
    "Якщо користувач питає про свої фінанси (скільки витратив, баланс, за категоріями) — обов'язково виклич query_transactions, а не вигадуй цифри.",
    "Відповідай коротко, по суті, без зайвого формату. Суми округлюй до 2 знаків.",
  ].join("\n");
}

// deps.anthropicClient дозволяє підмінити Anthropic SDK у тестах фейком —
// у проді завжди створюється справжній клієнт з секрету оточення.
async function handleAiChat(data, context, deps = {}) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Потрібно увійти в акаунт.");
  }
  const uid = context.auth.uid;

  const userMessage = typeof data.message === "string" ? data.message.trim().slice(0, MAX_MESSAGE_LEN) : "";
  if (!userMessage) {
    throw new functions.https.HttpsError("invalid-argument", "Порожнє повідомлення.");
  }
  const historyIn = Array.isArray(data.history) ? data.history : [];
  const history = historyIn
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.text.slice(0, MAX_MESSAGE_LEN) }));

  await enforceRateLimit(uid);

  const profileSnap = await db.collection("users").doc(uid).get();
  const profile = profileSnap.data() || {};
  const categoriesExpense = Array.isArray(profile.categoriesExpense) && profile.categoriesExpense.length
    ? profile.categoriesExpense
    : [{ id: "other", label: "Інше" }];
  const categoriesIncome = Array.isArray(profile.categoriesIncome) && profile.categoriesIncome.length
    ? profile.categoriesIncome
    : [{ id: "other", label: "Інше" }];
  const lang = typeof profile.lang === "string" ? profile.lang : "uk";
  const currency = typeof profile.currency === "string" ? profile.currency : "UAH";

  const ctx = { today: new Date().toISOString().slice(0, 10), lang, currency, categoriesExpense, categoriesIncome };
  const system = buildSystemPrompt(ctx);

  const anthropic = deps.anthropicClient || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let messages = [...history, { role: "user", content: userMessage }];
  const actions = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages,
      tools,
    });

    const toolUses = resp.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      const text = resp.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: text || "…", actions };
    }

    messages.push({ role: "assistant", content: resp.content });
    const toolResults = [];
    for (const tu of toolUses) {
      let result;
      try {
        result = await executeTool(uid, tu.name, tu.input || {}, ctx);
      } catch (err) {
        console.error("aiChat tool error:", tu.name, err);
        result = { output: { ok: false, error: "internal error" }, isError: true };
      }
      if (result.action) actions.push(result.action);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result.output),
        is_error: !!result.isError,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { reply: "Забагато кроків для цього запиту — спробуй сформулювати простіше.", actions };
}

exports.aiChat = functions
  .runWith({ secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 60 })
  .https.onCall((data, context) => handleAiChat(data, context));

// Іменовані експорти — лише для unit-тестів (functions/test/ai.test.js).
// На деплой не впливає: Cloud Functions бере на облік тільки те, що визначено
// як `exports.<name> = onCall(...)` — інші поля module.exports ігноруються.
module.exports.handleAiChat = handleAiChat;
module.exports.sanitizeTransactionInput = sanitizeTransactionInput;
module.exports.executeTool = executeTool;
module.exports.buildSystemPrompt = buildSystemPrompt;
module.exports.enforceRateLimit = enforceRateLimit;
module.exports.RATE_LIMIT_MAX_MESSAGES = RATE_LIMIT_MAX_MESSAGES;
