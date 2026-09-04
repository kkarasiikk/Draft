// ---- Cloud Function: нагадування про завдання ----
// Браузер закритий саме тоді, коли нагадування потрібне найбільше, тож
// розсилає сервер. Планувальник бігає раз на 5 хвилин і робить дві речі:
//
// 1) точкові нагадування — завдання, у яких reminderAt уже настав;
// 2) щоденні дайджести — ранковий план і вечірній підсумок, кожен у свою
//    годину ЗА МІСЦЕВИМ часом користувача (сервер живе в UTC).
//
// Арифметика часу винесена в tasks/reminders.js і покрита тестами: помилку
// в ній не видно очима — нагадування просто не прийде або прийде вночі.
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { digestDue, isoInZone } = require("./tasks/reminders");
const goalStreak = require("./goals/streak");

const db = admin.firestore();

// Крок планувальника. Допуск такий самий: краще надіслати за три хвилини до
// строку, ніж запізнитись на п'ять.
const TICK_MINUTES = 5;
// Скільки завдань обробляємо за один запуск — запобіжник від нескінченної
// черги, якщо щось піде не так.
const MAX_TASKS_PER_RUN = 100;

const TEXTS = {
  uk: {
    due: (title) => ({ title: "Час: " + title, body: "Нагадування про завдання" }),
    morning: (n, first) => ({
      title: n ? `Сьогодні ${n} ${plural(n, "справа", "справи", "справ")}` : "Сьогодні вільно",
      body: first ? "Перше: " + first : "На сьогодні нічого не заплановано.",
    }),
    // Вечірній підсумок — єдине сповіщення за вечір, тож цілі живуть у ньому,
    // а не окремим пушем: два повідомлення поспіль читаються як спам.
    // Серія попереду завдань свідомо: незакрите завдання перенесеться на
    // завтра, а обірвана серія не відновиться ніколи.
    evening: (left, goals) => {
      const g = goals || { pending: 0, streak: 0, deadline: null };
      let title;
      if (g.streak > 0) {
        title = `Серія ${g.streak} ${plural(g.streak, "день", "дні", "днів")} урветься`;
      } else if (left) {
        title = `Не закрито: ${left}`;
      } else if (g.pending) {
        title = `Цілі: ${g.pending} без кроку`;
      } else {
        title = "День закрито 🎉";
      }

      const parts = [];
      if (g.streak > 0 && g.streakTitle) parts.push(g.streakTitle);
      if (left) parts.push(`${left} ${plural(left, "справа", "справи", "справ")} на завтра`);
      if (g.deadline !== null && g.deadlineTitle) {
        parts.push(g.deadline < 0
          ? `«${g.deadlineTitle}» прострочено`
          : `«${g.deadlineTitle}» через ${g.deadline} ${plural(g.deadline, "день", "дні", "днів")}`);
      }
      return { title, body: parts.length ? parts.join(" · ") : "Усе заплановане зроблено." };
    },
  },
};

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * Надсилає повідомлення на всі пристрої користувача.
 * Мертві токени (видалений застосунок, відкликаний дозвіл) прибираємо одразу:
 * інакше вони накопичуються й кожна розсилка витрачає квоту на порожнечу.
 */
async function sendToUser(uid, payload) {
  const snap = await db.collection("users").doc(uid).collection("fcmTokens").get();
  const tokens = snap.docs.map((d) => d.id);
  if (!tokens.length) return { sent: 0, removed: 0 };

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    // Тільки data, без notification: інакше браузер показав би своє
    // сповіщення ПОВЕРХ нашого, і людина отримала б два однакові.
    data: {
      title: String(payload.title || "Life"),
      body: String(payload.body || ""),
      tag: String(payload.tag || "life-tasks"),
      url: String(payload.url || "/tasks/index.html"),
    },
    webpush: { headers: { Urgency: "high", TTL: "3600" } },
  });

  const dead = [];
  response.responses.forEach((res, i) => {
    if (res.success) return;
    const code = res.error && res.error.code;
    if (code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument") {
      dead.push(tokens[i]);
    } else {
      console.warn("push failed", code, res.error && res.error.message);
    }
  });
  await Promise.all(dead.map((token) =>
    db.collection("users").doc(uid).collection("fcmTokens").doc(token).delete().catch(() => {})
  ));
  return { sent: response.successCount, removed: dead.length };
}

/** uid із шляху документа users/{uid}/tasks/{id}. */
function uidOfTask(doc) {
  const parts = doc.ref.path.split("/");
  return parts.length >= 2 ? parts[1] : null;
}

/** Точкові нагадування: reminderAt настав, а notifiedAt ще порожній. */
async function sendDueReminders(now) {
  const deadline = new Date(now.getTime() + TICK_MINUTES * 60000);
  const snap = await db.collectionGroup("tasks")
    .where("notifiedAt", "==", null)
    .where("reminderAt", "<=", admin.firestore.Timestamp.fromDate(deadline))
    .limit(MAX_TASKS_PER_RUN)
    .get();

  let sent = 0;
  for (const doc of snap.docs) {
    const task = doc.data();
    const uid = uidOfTask(doc);
    if (!uid) continue;
    // Виконане завдання нагадувати не треба, але позначку ставимо — інакше
    // воно щоразу потраплятиме у вибірку й займатиме ліміт.
    if (!task.done) {
      const text = TEXTS.uk.due(task.title || "");
      await sendToUser(uid, { ...text, tag: "task-" + doc.id });
      sent++;
    }
    await doc.ref.update({ notifiedAt: admin.firestore.FieldValue.serverTimestamp() }).catch((err) => {
      console.error("notifiedAt update failed", doc.ref.path, err);
    });
  }
  return sent;
}

/** Щоденні дайджести — кожному в його годину за його таймзоною. */
async function sendDigests(now) {
  const users = await db.collection("users").get();
  let sent = 0;

  for (const userDoc of users.docs) {
    const settings = (userDoc.data() || {}).taskReminders;
    const due = digestDue(settings, now);
    if (!due) continue;

    const uid = userDoc.id;
    const today = isoInZone(now, settings.tz);
    const tasksSnap = await db.collection("users").doc(uid).collection("tasks")
      .where("dueDate", "==", today).get();
    const all = tasksSnap.docs.map((d) => d.data());
    const open = all.filter((task) => !task.done);

    let text;
    if (due.kind === "morning") {
      const first = open
        .slice()
        .sort((a, b) => (a.dueTime || "99:99") < (b.dueTime || "99:99") ? -1 : 1)[0];
      text = TEXTS.uk.morning(open.length, first ? first.title : null);
    } else {
      // Цілі читаємо лише для вечірнього дайджесту: вранці корисніший план
      // на день, а не докір за вчорашнє.
      let goalsPart = null;
      try {
        const goalsSnap = await db.collection("users").doc(uid).collection("goals").get();
        // Довжину цілі бере з createdAt: без неї поріг попередження про
        // дедлайн лишився б однаковим для справи на два тижні й для цілі на
        // вісім місяців.
        goalsPart = goalStreak.goalsDigest(goalsSnap.docs.map((d) => d.data()), today, {
          startIsoOf: (g) => (g && g.createdAt && typeof g.createdAt.toDate === "function"
            ? goalStreak.isoOf(g.createdAt.toDate()) : null),
        });
      } catch (err) {
        // Цілі не прочитались — підсумок по завданнях однаково має піти.
        console.error("goalsDigest:", err);
      }
      text = TEXTS.uk.evening(open.length, goalsPart);
    }

    const result = await sendToUser(uid, { ...text, tag: "digest-" + due.kind });
    sent += result.sent;
    // Позначку ставимо навіть коли надіслати не вдалося: інакше наступний
    // запуск через 5 хвилин спробує знову, і так цілу годину поспіль.
    await userDoc.ref.set({
      taskReminders: {
        ...settings,
        [due.kind === "morning" ? "lastMorning" : "lastEvening"]: due.date,
      },
    }, { merge: true });
  }
  return sent;
}

exports.taskReminders = functions
  // Планувальник і так запускає функцію раз на кілька хвилин; стеля в 2
  // інстанси лише страхує від накладання повільного запуску на наступний.
  .runWith({ maxInstances: 2 })
  .pubsub
  .schedule(`every ${TICK_MINUTES} minutes`)
  .timeZone("UTC")
  .onRun(async () => {
    const now = new Date();
    try {
      const due = await sendDueReminders(now);
      const digests = await sendDigests(now);
      if (due || digests) console.log(`нагадувань: ${due}, дайджестів: ${digests}`);
    } catch (err) {
      console.error("taskReminders:", err);
    }
    return null;
  });

// Експортуємо внутрішні функції для тестів — вони роблять реальні запити,
// тож у тестах підміняється саме db/messaging, а не ці обгортки.
exports._internal = { sendToUser, sendDueReminders, sendDigests, plural };
