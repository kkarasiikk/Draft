const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");

// admin.initializeApp() уже викликано в index.js — тут просто перевикористовуємо
// той самий інстанс. У тестах цей рядок працює з jest.mock("firebase-admin", ...)
// (див. functions/test/ai.test.js) — admin.firestore() повертає фейкову БД.
const db = admin.firestore();

// Модель обирає сам користувач у налаштуваннях — від неї залежить і ціна, і
// те, наскільки надійно модель розбирає складені запити («запиши три
// завдання…»). Дешевша чудово справляється з простим «кава 80 грн», але
// частіше відповідає загальними словами замість того, щоб спершу подивитись
// у дані, тож перемикач лишається за людиною.
const MODELS = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
};
const DEFAULT_MODEL_KEY = "haiku";

const MAX_MESSAGE_LEN = 1000;
const MAX_HISTORY_MESSAGES = 16; // скільки попередніх реплік (user+assistant) береться в контекст
// Складений запит («запиши три завдання і скажи, скільки лишилось грошей»)
// це кілька викликів інструментів поспіль, тож раундів треба більше, ніж на
// одну дію. Лишається запобіжником від нескінченного циклу.
const MAX_TOOL_ROUNDS = 8;
const MAX_OUTPUT_TOKENS = 2048;

function modelIdFor(profile) {
  const key = profile && typeof profile.aiModel === "string" ? profile.aiModel : DEFAULT_MODEL_KEY;
  return MODELS[key] || MODELS[DEFAULT_MODEL_KEY];
}

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
// Символи валют — лише для підпису виконаної дії в чаті («Записано: Їжа ·
// 80 ₴»). Самі суми ніде більше тут не форматуються.
const CURRENCY_SYMBOLS = { UAH: "\u20B4", USD: "$", EUR: "\u20AC", PLN: "z\u0142" };

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
    name: "month_summary",
    description:
      "Підсумок місяця з розбивкою по категоріях: скільки витрачено й отримано, які категорії найбільші. Викликай перед будь-якою порадою про економію — без цих цифр порада буде загальною і марною.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Місяць у форматі YYYY-MM" },
      },
      required: ["month"],
    },
  },
  {
    name: "savings_summary",
    description: "Скільки відкладено, по яких цілях заощаджень і скільки знято.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_task",
    description:
      "Створити завдання в списку справ. Дату став лише тоді, коли людина її назвала або мала на увазі ('завтра', 'у п\'ятницю').",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Назва завдання" },
        dueDate: { type: "string", description: "Дата YYYY-MM-DD, якщо названа" },
        dueTime: { type: "string", description: "Час HH:MM, якщо названий" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        estimateMin: { type: "number", description: "Скільки хвилин займе, якщо сказано" },
        tags: { type: "array", items: { type: "string" }, description: "Теги без решітки" },
        notes: { type: "string", description: "Деталі, якщо є" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_tasks",
    description:
      "Список завдань за період. Повертає id, тож саме звідси бери id для complete_task. Без дат повертає найближчі невиконані.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Дата від, YYYY-MM-DD" },
        to: { type: "string", description: "Дата до, YYYY-MM-DD" },
        status: { type: "string", enum: ["open", "done", "all"], description: "За замовчуванням open" },
        limit: { type: "number", description: "Максимум записів, за замовчуванням 50" },
      },
    },
  },
  {
    name: "complete_task",
    description: "Позначити завдання виконаним. id бери з list_tasks, не вигадуй.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "id завдання зі списку" } },
      required: ["id"],
    },
  },
  {
    name: "workout_history",
    description:
      "Останні тренування з вправами, вагами й підходами. Викликай перед будь-якою порадою про тренування — без історії не видно, що вже навантажене, а що відпочило.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number", description: "Скільки останніх тренувань, за замовчуванням 8" } },
    },
  },
  {
    name: "personal_records",
    description: "Особисті рекорди по вправах: найбільша вага й найкращий підхід.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "goals_progress",
    description: "Довгострокові цілі: статус, виконані віхи, дата дедлайну.",
    input_schema: { type: "object", properties: {} },
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
    // Підпис дії збирається тут, а не на клієнті: спільний чат живе в усіх
    // модулях і не має доступу до списку категорій конкретної сторінки.
    const catList = result.value.type === "income" ? ctx.categoriesIncome : ctx.categoriesExpense;
    const cat = catList.find((c) => c.id === result.value.category);
    return {
      output: { ok: true, id: docRef.id, ...result.value },
      action: {
        kind: "transaction_added",
        ...result.value,
        categoryLabel: cat ? cat.label : result.value.category,
        currency: CURRENCY_SYMBOLS[ctx.currency] || ctx.currency,
      },
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

  if (name === "month_summary") return monthSummary(uid, input, ctx);
  if (name === "savings_summary") return savingsSummary(uid, ctx);
  if (name === "add_task") return addTask(uid, input, ctx);
  if (name === "list_tasks") return listTasks(uid, input, ctx);
  if (name === "complete_task") return completeTask(uid, input);
  if (name === "workout_history") return workoutHistory(uid, input);
  if (name === "personal_records") return personalRecords(uid);
  if (name === "goals_progress") return goalsProgress(uid);

  return { output: { ok: false, error: "unknown tool" }, isError: true };
}

// ---- Читання: гроші ----
function userCol(uid, name) {
  return db.collection("users").doc(uid).collection(name);
}

// Останній день місяця: пам'ятаємо про 28/29/30/31 і не тягнемо бібліотек.
function monthBounds(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  const lastDay = new Date(year, mon, 0).getDate();
  return { from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${String(lastDay).padStart(2, "0")}` };
}

async function monthSummary(uid, input, ctx) {
  const bounds = monthBounds(input.month);
  if (!bounds) return { output: { ok: false, error: "month має бути у форматі YYYY-MM" }, isError: true };

  const snap = await userCol(uid, "transactions")
    .where("date", ">=", bounds.from)
    .where("date", "<=", bounds.to)
    .get();
  const docs = snap.docs.map((d) => d.data());

  const labelOf = (type, id) => {
    const list = type === "income" ? ctx.categoriesIncome : ctx.categoriesExpense;
    const found = list.find((c) => c.id === id);
    return found ? found.label : id || "?";
  };
  // Групуємо по категорії й одразу сортуємо за сумою: найбільша стаття
  // витрат — це перше, про що питають, і перше, що варто показати моделі.
  const byCategory = (type) => {
    const sums = new Map();
    docs.filter((d) => d.type === type).forEach((d) => {
      const key = d.category || "other";
      sums.set(key, (sums.get(key) || 0) + (Number(d.amount) || 0));
    });
    const total = [...sums.values()].reduce((a, b) => a + b, 0);
    return [...sums.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, sum]) => ({
        category: labelOf(type, id),
        sum: Math.round(sum * 100) / 100,
        share: total ? Math.round((sum / total) * 100) : 0,
      }));
  };

  const expense = byCategory("expense");
  const income = byCategory("income");
  const sum = (list) => Math.round(list.reduce((a, b) => a + b.sum, 0) * 100) / 100;
  return {
    output: {
      month: input.month,
      currency: ctx.currency,
      count: docs.length,
      totalExpense: sum(expense),
      totalIncome: sum(income),
      expenseByCategory: expense,
      incomeByCategory: income,
    },
  };
}

async function savingsSummary(uid, ctx) {
  const [savingsSnap, goalsSnap] = await Promise.all([
    userCol(uid, "savings").get(),
    userCol(uid, "savingsGoals").get(),
  ]);
  const goalName = new Map(goalsSnap.docs.map((d) => [d.id, (d.data() || {}).name || "Заощадження"]));
  const perGoal = new Map();
  savingsSnap.docs.forEach((d) => {
    const sv = d.data() || {};
    const amount = Number(sv.amount) || 0;
    // Зняття зменшує накопичене, інакше сума показувала б оборот, а не залишок.
    const delta = sv.type === "withdraw" ? -amount : amount;
    const key = sv.goalId || "";
    perGoal.set(key, (perGoal.get(key) || 0) + delta);
  });
  const goals = [...perGoal.entries()].map(([id, total]) => ({
    goal: goalName.get(id) || "Без цілі",
    saved: Math.round(total * 100) / 100,
  }));
  return {
    output: {
      currency: ctx.currency,
      total: Math.round(goals.reduce((a, g) => a + g.saved, 0) * 100) / 100,
      goals,
    },
  };
}

// ---- Завдання ----
// Дзеркалить firestore.rules (isValidTask) — Admin SDK правила не перевіряє,
// тож форму документа треба гарантувати тут, інакше клієнт отримає запис,
// який не вміє показати.
function sanitizeTaskInput(input) {
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
  if (!title) return { error: "title обов'язковий" };

  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const isTime = (v) => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
  const estimate = Number(input.estimateMin);

  return {
    value: {
      title,
      notes: typeof input.notes === "string" ? input.notes.slice(0, 5000) : "",
      done: false,
      completedAt: null,
      priority: ["low", "medium", "high"].includes(input.priority) ? input.priority : null,
      tags: Array.isArray(input.tags)
        ? input.tags.filter((t) => typeof t === "string" && t.trim()).slice(0, 20).map((t) => t.trim().slice(0, 30))
        : [],
      dueDate: isDate(input.dueDate) ? input.dueDate : null,
      // Час без дати нікуди не приткнути — клієнт показує його в рядку дня.
      dueTime: isDate(input.dueDate) && isTime(input.dueTime) ? input.dueTime : null,
      estimateMin: Number.isFinite(estimate) && estimate > 0 ? Math.min(Math.round(estimate), 1440) : null,
      recurrence: null,
      reminderAt: null,
      notifiedAt: null,
      subtasks: [],
    },
  };
}

async function addTask(uid, input) {
  const result = sanitizeTaskInput(input);
  if (result.error) return { output: { ok: false, error: result.error }, isError: true };
  const ref = await userCol(uid, "tasks").add({
    ...result.value,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {
    output: { ok: true, id: ref.id, ...result.value },
    action: { kind: "task_added", title: result.value.title, dueDate: result.value.dueDate },
  };
}

async function listTasks(uid, input) {
  const snap = await userCol(uid, "tasks").get();
  const status = ["open", "done", "all"].includes(input.status) ? input.status : "open";
  const limit = Math.min(Math.max(parseInt(input.limit, 10) || 50, 1), 200);
  let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (status === "open") docs = docs.filter((t) => !t.done);
  if (status === "done") docs = docs.filter((t) => t.done);
  if (typeof input.from === "string") docs = docs.filter((t) => t.dueDate && t.dueDate >= input.from);
  if (typeof input.to === "string") docs = docs.filter((t) => t.dueDate && t.dueDate <= input.to);

  // Без дати — в кінець: спершу те, що прив'язане до конкретного дня.
  docs.sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
  return {
    output: {
      count: docs.length,
      items: docs.slice(0, limit).map((t) => ({
        id: t.id, title: t.title, done: !!t.done, dueDate: t.dueDate || null,
        dueTime: t.dueTime || null, priority: t.priority || null, estimateMin: t.estimateMin || null,
      })),
    },
  };
}

async function completeTask(uid, input) {
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) return { output: { ok: false, error: "id обов'язковий" }, isError: true };
  const ref = userCol(uid, "tasks").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { output: { ok: false, error: "завдання не знайдено" }, isError: true };
  await ref.update({
    done: true,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const title = (doc.data() || {}).title || "";
  return { output: { ok: true, id, title }, action: { kind: "task_completed", title } };
}

// ---- Тренування ----
async function workoutHistory(uid, input) {
  const snap = await userCol(uid, "workouts").get();
  const limit = Math.min(Math.max(parseInt(input.limit, 10) || 8, 1), 30);
  const docs = snap.docs
    .map((d) => d.data() || {})
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, limit);
  return {
    output: {
      count: docs.length,
      sessions: docs.map((w) => ({
        date: w.date || null,
        name: w.name || "",
        exercises: (w.exercises || []).map((ex) => ({
          name: ex.name || "",
          muscle: ex.muscle || null,
          sets: (ex.sets || []).map((st) => ({ weight: st.weight, reps: st.reps })),
        })),
      })),
    },
  };
}

async function personalRecords(uid) {
  const snap = await userCol(uid, "workouts").get();
  const best = new Map();
  snap.docs.forEach((d) => {
    const w = d.data() || {};
    (w.exercises || []).forEach((ex) => {
      (ex.sets || []).forEach((st) => {
        const weight = Number(st.weight) || 0;
        const reps = Number(st.reps) || 0;
        if (!weight && !reps) return;
        const prev = best.get(ex.name);
        // Рекорд — за вагою; за однакової ваги виграє більше повторень.
        if (!prev || weight > prev.weight || (weight === prev.weight && reps > prev.reps)) {
          best.set(ex.name, { exercise: ex.name, weight, reps, date: w.date || null });
        }
      });
    });
  });
  return { output: { count: best.size, records: [...best.values()] } };
}

// ---- Цілі ----
async function goalsProgress(uid) {
  const snap = await userCol(uid, "goals").get();
  return {
    output: {
      count: snap.docs.length,
      goals: snap.docs.map((d) => {
        const g = d.data() || {};
        const milestones = g.milestones || [];
        return {
          title: g.title || "",
          status: g.status || "active",
          targetDate: g.targetDate || null,
          milestonesDone: milestones.filter((m) => m.done).length,
          milestonesTotal: milestones.length,
          checkins: (g.checkins || []).length,
        };
      }),
    },
  };
}

function buildSystemPrompt(ctx) {
  const catList = (list) => list.map((c) => `${c.id} (${c.label})`).join(", ");
  return [
    "Ти — помічник у особистому застосунку 'Life'. У ньому чотири розділи: гроші (доходи/витрати, заощадження), щоденні завдання, довгострокові цілі й тренування.",
    `Сьогодні: ${ctx.today}. Мова відповіді: ${ctx.lang}. Валюта: ${ctx.currency}.`,
    `Категорії витрат: ${catList(ctx.categoriesExpense)}.`,
    `Категорії доходів: ${catList(ctx.categoriesIncome)}.`,
    "",
    "ЗАПИСУВАТИ. 'кава 80 грн' -> add_transaction (expense, 80, category 'food'). 'запиши подзвонити мамі завтра о 18' -> add_task. Не питай уточнень, якщо сенс зрозумілий; якщо в одному повідомленні кілька справ — створи кожну окремим викликом.",
    "",
    "РАДИТИ. Це головне правило: спершу подивись у дані, потім говори. Порада без цифр — марна, людина і так знає, що треба менше витрачати й більше рухатись.",
    "- порада про економію -> спершу month_summary за потрібний місяць, і говори про конкретні категорії й суми;",
    "- порада про тренування -> спершу workout_history, подивись, які групи мʼязів давно не навантажувались і з якими вагами людина працює;",
    "- питання про прогрес -> personal_records або goals_progress;",
    "- питання про завантаженість -> list_tasks.",
    "Якщо даних мало (наприклад, тренувань ще немає) — так і скажи, і дай загальну пораду, чесно позначивши, що вона не спирається на історію.",
    "",
    "НІКОЛИ не вигадуй цифри, дати чи id. Якщо потрібне число — візьми його інструментом.",
    "Ти не лікар і не тренер: якщо йдеться про біль, травму чи здоровʼя — порадь звернутись до фахівця, а не став діагноз.",
    "Відповідай коротко й по суті, без канцеляриту й зайвого форматування. Суми округлюй до 2 знаків.",
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
  const model = modelIdFor(profile);
  // Системний проміпт і список інструментів однакові від запиту до запиту —
  // кешуємо їх, інакше кожне повідомлення платить за ті самі ~1.5 тис. токенів.
  const system = [{ type: "text", text: buildSystemPrompt(ctx), cache_control: { type: "ephemeral" } }];

  const anthropic = deps.anthropicClient || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let messages = [...history, { role: "user", content: userMessage }];
  const actions = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const resp = await anthropic.messages.create({
      model,
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
module.exports.sanitizeTaskInput = sanitizeTaskInput;
module.exports.modelIdFor = modelIdFor;
module.exports.MODELS = MODELS;
module.exports.RATE_LIMIT_MAX_MESSAGES = RATE_LIMIT_MAX_MESSAGES;
