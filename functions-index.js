const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Мінімальна довжина синхронізаційного ключа. Ендпоінт публічний (викликається
// з Apple Shortcuts без автентифікації), тож короткий/передбачуваний ключ
// реально можна підібрати перебором — вимагаємо достатньої ентропії.
const MIN_KEY_LENGTH = 20;
// Проста абузостійкість: не більше N невдалих спроб з одного IP за вікно часу.
// Це не замінює App Check, але суттєво ускладнює брутфорс ключа й береже
// квоту Firestore-читань від сканера, що перебирає випадкові ключі.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 хв
const RATE_LIMIT_MAX_ATTEMPTS = 20;

async function isRateLimited(ip) {
  const ref = db.collection("walletSyncRateLimits").doc(ip || "unknown");
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.exists ? doc.data() : null;
    if (!data || now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      tx.set(ref, { windowStart: now, count: 1 });
      return false;
    }
    if (data.count >= RATE_LIMIT_MAX_ATTEMPTS) {
      return true;
    }
    tx.update(ref, { count: admin.firestore.FieldValue.increment(1) });
    return false;
  });
}

// Приймає POST від Shortcut на iPhone (тригер "Транзакція" / Apple Pay)
// Очікує JSON: { key: "особистий ключ", amount: 123.45, merchant: "назва магазину", date: "YYYY-MM-DD" (необов'язково) }
exports.walletSync = functions.https.onRequest(async (req, res) => {
  // CORS — про всяк випадок, якщо колись знадобиться викликати не тільки з Shortcuts
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const ip = (req.headers["x-forwarded-for"] || req.ip || "").toString().split(",")[0].trim();
  try {
    if (await isRateLimited(ip)) {
      res.status(429).json({ error: "Too many attempts, try again later" });
      return;
    }
  } catch (err) {
    console.error("walletSync rate limit check failed:", err);
    // Якщо перевірка лімітів не спрацювала (наприклад, немає прав на нову
    // колекцію) — не блокуємо легітимний запит через це, просто продовжуємо.
  }

  const body = req.body || {};
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const amountNum = parseFloat(body.amount);
  const merchant = typeof body.merchant === "string" ? body.merchant : "";
  const note = typeof body.note === "string" ? body.note : "";
  const dateStr = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;

  if (!key || key.length < MIN_KEY_LENGTH) {
    res.status(400).json({ error: "Missing or too weak sync key" });
    return;
  }
  if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Missing or invalid amount" });
    return;
  }

  try {
    const usersSnap = await db.collection("users").where("walletSyncKey", "==", key).limit(1).get();
    if (usersSnap.empty) {
      res.status(401).json({ error: "Invalid sync key" });
      return;
    }
    const uid = usersSnap.docs[0].id;
    const userData = usersSnap.docs[0].data() || {};
    const today = new Date().toISOString().slice(0, 10);
    // Раніше категорія була захардкоджена як "other" — якщо користувач
    // перейменував/видалив цю категорію, транзакція лишалася б із "сирітським"
    // id. Тепер підбираємо реальну наявну категорію витрат користувача.
    const expenseCats = Array.isArray(userData.categoriesExpense) ? userData.categoriesExpense : null;
    const fallbackCategory = (expenseCats && (expenseCats.find((c) => c.id === "other") || expenseCats[0]))
      ? (expenseCats.find((c) => c.id === "other") || expenseCats[0]).id
      : "other";

    await db.collection("users").doc(uid).collection("transactions").add({
      type: "expense",
      amount: Math.round(amountNum * 100) / 100,
      category: fallbackCategory,
      note: (merchant || note || "").toString().slice(0, 200),
      date: dateStr || today,
      source: "wallet",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("walletSync error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});
