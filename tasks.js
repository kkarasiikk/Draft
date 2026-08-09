const functions = require("firebase-functions");
const admin = require("firebase-admin");

// admin.initializeApp() вже викликано в index.js (як і в ai.js) — тут просто
// перевикористовуємо той самий інстанс.
const db = admin.firestore();

// Як часто перевіряти, чи не настав час якогось нагадування. Firestore не
// вміє "push-тригерів по даті" сам по собі, тому єдиний надійний спосіб —
// періодично опитувати колекцію задач по всіх користувачах (collectionGroup)
// і шукати ті, у яких reminderAt <= зараз, а сповіщення ще не надсилалось.
const SCHEDULE = "every 5 minutes";
// На скільки хвилин "углиб" минулого ще можна наздогнати нагадування, якщо
// функція з якоїсь причини не спрацювала вчасно (напр. деплой/холодний старт).
// Довше цього вікна прострочене нагадування вже краще не надсилати — сенсу
// пінгати "нагадування" про подію, що була годину тому, немає.
const CATCH_UP_WINDOW_MS = 30 * 60 * 1000;

/**
 * Чиста функція без побічних ефектів — виносимо окремо, щоб покрити тестом
 * (tasks.test.js) без піднімання реального Firestore/Messaging.
 * Обчислює момент, коли треба надіслати пуш, з дати/часу дедлайну і
 * налаштування "за скільки хвилин до".
 */
function computeReminderAt(dueDate, dueTime, reminderMinutesBefore) {
  if (!dueDate || reminderMinutesBefore == null) return null;
  // Якщо час не вказано — вважаємо дедлайн "на весь день" і нагадуємо
  // о 9:00 за локальним часом пристрою, на якому створювалась задача
  // (це робить клієнт: обчислює дату у власному часовому поясі й шле
  // сюди вже готовий UTC-момент). Тут, на бекенді, ми лише документуємо
  // контракт — саме обчислення відбувається в tasks/app.js, бо тільки
  // клієнт знає локальний часовий пояс користувача.
  const time = dueTime || "09:00";
  const base = new Date(`${dueDate}T${time}:00`);
  if (isNaN(base.getTime())) return null;
  return new Date(base.getTime() - reminderMinutesBefore * 60000);
}

/**
 * Прибирає з fcmTokens токени, які Messaging повернув як недійсні
 * (додаток видалили, дозвіл на сповіщення відкликали тощо) — інакше вони
 * назавжди лишаться в базі й функція марно намагатиметься слати на них.
 */
async function pruneInvalidTokens(uid, tokens, responses) {
  const batch = db.batch();
  let hasDeletes = false;
  responses.forEach((res, i) => {
    if (!res.success) {
      const code = res.error && res.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        batch.delete(db.collection("users").doc(uid).collection("fcmTokens").doc(tokens[i]));
        hasDeletes = true;
      }
    }
  });
  if (hasDeletes) await batch.commit();
}

async function sendRemindersForTask(taskDoc) {
  const uid = taskDoc.ref.parent.parent.id;
  const task = taskDoc.data();

  const tokensSnap = await db.collection("users").doc(uid).collection("fcmTokens").get();
  if (tokensSnap.empty) {
    // Немає жодного зареєстрованого пристрою — позначаємо як "надіслано",
    // щоб не перевіряти цю задачу знову й знову кожні 5 хвилин.
    await taskDoc.ref.update({ notifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    return;
  }
  const tokens = tokensSnap.docs.map((d) => d.id);

  const body = task.dueTime
    ? `Дедлайн о ${task.dueTime}${task.priority === "high" ? " · високий пріоритет" : ""}`
    : "На сьогодні заплановано це завдання";

  const message = {
    tokens,
    notification: { title: task.title, body },
    webpush: {
      notification: { icon: "/budget/icon-192.png" },
      fcmOptions: { link: "/tasks/index.html" },
    },
  };

  try {
    const resp = await admin.messaging().sendEachForMulticast(message);
    await pruneInvalidTokens(uid, tokens, resp.responses);
  } catch (err) {
    console.error("taskReminders: sendEachForMulticast failed for", uid, err);
    // Не позначаємо notifiedAt — спробуємо ще раз наступного циклу (в межах
    // CATCH_UP_WINDOW_MS), раптом це була тимчасова помилка мережі/квоти.
    return;
  }
  await taskDoc.ref.update({ notifiedAt: admin.firestore.FieldValue.serverTimestamp() });
}

const taskReminders = functions.pubsub.schedule(SCHEDULE).onRun(async () => {
  const now = admin.firestore.Timestamp.now();
  const windowStart = admin.firestore.Timestamp.fromMillis(now.toMillis() - CATCH_UP_WINDOW_MS);

  const snap = await db
    .collectionGroup("tasks")
    .where("done", "==", false)
    .where("notifiedAt", "==", null)
    .where("reminderAt", ">=", windowStart)
    .where("reminderAt", "<=", now)
    .get();

  if (snap.empty) return null;

  // Послідовно, а не Promise.all — щоб не влаштовувати сплеск паралельних
  // запитів до Messaging/Firestore, якщо в один момент "дозріло" багато
  // нагадувань одразу (напр. кілька людей поставили дедлайн на 9:00).
  for (const doc of snap.docs) {
    try {
      await sendRemindersForTask(doc);
    } catch (err) {
      console.error("taskReminders: failed for task", doc.ref.path, err);
    }
  }
  return null;
});

module.exports = { taskReminders, computeReminderAt };
