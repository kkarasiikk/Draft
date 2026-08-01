const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

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

  const body = req.body || {};
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const amountNum = parseFloat(body.amount);
  const merchant = typeof body.merchant === "string" ? body.merchant : "";
  const note = typeof body.note === "string" ? body.note : "";
  const dateStr = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;

  if (!key) {
    res.status(400).json({ error: "Missing sync key" });
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
    const today = new Date().toISOString().slice(0, 10);

    await db.collection("users").doc(uid).collection("transactions").add({
      type: "expense",
      amount: Math.round(amountNum * 100) / 100,
      category: "other",
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
