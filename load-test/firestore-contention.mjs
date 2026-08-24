// ---- Контеншн транзакцій Firestore ----
//
// Справжнє вузьке місце — не функції (вони масштабуються), а Firestore під
// конкурентними транзакціями на ОДИН документ. Саме так улаштований і
// рейт-лімітер (walletSyncRateLimits/{ip}), і будь-який лічильник.
//
// Тест ганяє N паралельних транзакцій двома способами:
//   • усі в ОДИН документ  — модель «один IP молотить» / гарячий лічильник;
//   • кожна в СВІЙ документ — модель «ботнет із багатьох IP».
// Різниця між ними і є відповідь на питання «скільки витримає».
//
// Працює проти Firestore-емулятора (FIRESTORE_EMULATOR_HOST), напряму через
// admin SDK — без функцій, бо міряємо саме базу.
import admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
admin.initializeApp({ projectId: 'demo-life' });
const db = admin.firestore();

const N = Number(process.argv[2]) || 50;  // скільки одночасних транзакцій
// Гарячий документ понад ~100 конкурентних транзакцій уже насичений: більшість
// аварійно завершується (ABORTED), а хвіст ретраїв тягнеться десятки секунд.
// Обмежуємо, щоб тест не висів даремно — стелю це вже показує.
if (N > 150) { console.error('N > 150 гарячий документ і так насичує; візьми менше.'); process.exit(1); }

// Точна копія логіки isRateLimited з index.js — читаємо-й-інкрементуємо
// лічильник у транзакції.
async function bump(ref) {
  const started = performance.now();
  try {
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.exists ? doc.data() : null;
      if (!data) tx.set(ref, { windowStart: Date.now(), count: 1 });
      else tx.update(ref, { count: admin.firestore.FieldValue.increment(1) });
    });
    return { ok: true, ms: performance.now() - started };
  } catch (err) {
    return { ok: false, ms: performance.now() - started, code: err.code || err.message };
  }
}

function stats(results, label) {
  const ok = results.filter((r) => r.ok);
  const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
  const p = (q) => ms.length ? ms[Math.min(ms.length - 1, Math.floor(q * ms.length))].toFixed(0) : '—';
  const aborts = results.filter((r) => !r.ok);
  console.log(`\n  ${label}`);
  console.log(`    успішних:      ${ok.length}/${results.length}`);
  if (aborts.length) {
    const byCode = {};
    aborts.forEach((a) => { byCode[a.code] = (byCode[a.code] || 0) + 1; });
    console.log(`    провалених:    ${aborts.length}  ${JSON.stringify(byCode)}`);
  }
  console.log(`    затримка:      p50 ${p(0.5)}ms   p95 ${p(0.95)}ms   max ${ms.length ? ms[ms.length-1].toFixed(0) : '—'}ms`);
}

console.log(`\n  ${N} одночасних транзакцій, два сценарії:`);

// 1. Один гарячий документ — усі б'ються за нього.
const hot = db.collection('loadtest_hot').doc('single');
await hot.delete().catch(() => {});
const hotStart = performance.now();
const hotRes = await Promise.all(Array.from({ length: N }, () => bump(hot)));
const hotWall = performance.now() - hotStart;
stats(hotRes, `Один документ (гарячий лічильник / один IP) — ${hotWall.toFixed(0)}ms на всю хвилю`);
const finalHot = (await hot.get()).data();
console.log(`    підсумковий count: ${finalHot ? finalHot.count : 0}  (має бути ${N}, якщо жодного втраченого)`);

// 2. Кожна транзакція в свій документ — конкуренції немає.
const coldStart = performance.now();
const coldRes = await Promise.all(Array.from({ length: N }, (_, i) => bump(db.collection('loadtest_cold').doc('ip' + i))));
const coldWall = performance.now() - coldStart;
stats(coldRes, `Різні документи (ботнет із ${N} IP) — ${coldWall.toFixed(0)}ms на всю хвилю`);

console.log(`\n  Висновок: гарячий документ серіалізується (${hotWall.toFixed(0)}ms), різні — паралельні (${coldWall.toFixed(0)}ms).`);
console.log(`  Прискорення від розподілу навантаження: ${(hotWall / coldWall).toFixed(1)}×\n`);
process.exit(0);
