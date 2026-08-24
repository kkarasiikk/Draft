// ---- Навантажувальний тест walletSync ----
//
// Б'є по публічному ендпоінту walletSync паралельними хвилями запитів і
// показує: скільки витримує, коли вмикається захист від зловживань (429),
// яка затримка під навантаженням. walletSync обрано навмисно — це єдина
// функція без зовнішніх викликів (aiChat смикав би платний Anthropic API),
// тож тут вимірюється саме інфраструктура, а не рахунок за токени.
//
// ЗА ЗАМОВЧУВАННЯМ ЦІЛЬ — ЛОКАЛЬНИЙ ЕМУЛЯТОР. Емулятор безкоштовний і не
// чіпає прод-проєкт. Бити по бойовому URL можна лише свідомо, передавши
// його явно (--url) і розуміючи, що кожен запит коштує грошей і може
// підняти автозахист Google. Скрипт про це попереджає й вимагає підтвердження.
//
// Запуск:
//   node load-test/hammer.mjs                          # емулятор, розумний профіль
//   node load-test/hammer.mjs --rps 200 --seconds 30   # свій профіль
//   node load-test/hammer.mjs --url https://... --i-understand-the-cost
//
// Без залежностей: лише вбудований fetch (Node 18+).

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) => {
    if (!a.startsWith('--')) return [];
    const key = a.slice(2);
    const next = arr[i + 1];
    return [[key, next && !next.startsWith('--') ? next : true]];
  }),
);

const EMULATOR_DEFAULT = 'http://127.0.0.1:5001/demo-life/us-central1/walletSync';
const url = args.url || EMULATOR_DEFAULT;
const rps = Number(args.rps) || 100;          // цільова кількість запитів на секунду
const seconds = Number(args.seconds) || 20;   // скільки триває тест
const key = args.key || 'load-test-key-0000000000';  // валідна довжина (≥20), але це не чийсь справжній ключ

const isProd = !/127\.0\.0\.1|localhost|:5001/.test(url);
if (isProd && !args['i-understand-the-cost']) {
  console.error(`
  ⛔ Ціль не схожа на емулятор:
     ${url}

  Бити по бойовому Firebase — це реальні гроші (виклики функцій, читання/
  записи Firestore) і ризик, що Google призупинить проєкт за схожість на DoS.

  Якщо ти справді цього хочеш і розумієш наслідки, додай:
     --i-understand-the-cost

  Безпечна альтернатива — емулятор: спершу \`firebase emulators:start\`,
  тоді запусти цей скрипт без --url.
  `);
  process.exit(1);
}

// Один запит. Тіло валідне за формою, але ключ несправжній — walletSync
// відповість 401 (ключ не знайдено) або 429 (спрацював ліміт). Обидва
// відповіді нам і потрібні: ми міряємо, як тримається СЛОЙ ЗАХИСТУ, а не
// створюємо чужі транзакції.
async function oneShot() {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, amount: 1, merchant: 'loadtest' }),
    });
    return { status: res.status, ms: performance.now() - started };
  } catch (err) {
    return { status: 0, ms: performance.now() - started, err: err.code || err.message };
  }
}

const buckets = new Map();  // status -> count
const latencies = [];
let sent = 0, done = 0;

function record(r) {
  buckets.set(r.status, (buckets.get(r.status) || 0) + 1);
  if (r.status) latencies.push(r.ms);
  done++;
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

console.log(`\n  Ціль:    ${url}`);
console.log(`  Профіль: ~${rps} rps × ${seconds}s (≈${rps * seconds} запитів)`);
console.log(`  Режим:   ${isProd ? '⚠️  БОЙОВИЙ' : 'емулятор'}\n`);

const startWall = Date.now();
const timer = setInterval(() => {
  // Кожну секунду випускаємо нову хвилю по rps запитів. Хвилі не чекають
  // одна одну — так відтворюється паралельне навантаження, а не черга.
  for (let i = 0; i < rps; i++) { sent++; oneShot().then(record); }
  const elapsed = (Date.now() - startWall) / 1000;
  process.stdout.write(`\r  ${elapsed.toFixed(0)}s  надіслано ${sent}  відповіли ${done}   `);
  if (elapsed >= seconds) {
    clearInterval(timer);
    setTimeout(report, 2000);  // добираємо хвости у польоті
  }
}, 1000);

function report() {
  const wall = (Date.now() - startWall) / 1000;
  console.log('\n\n  ── Результат ─────────────────────────────');
  console.log(`  Усього надіслано:   ${sent}`);
  console.log(`  Отримано відповідей: ${done}`);
  console.log(`  Реальний throughput: ${(done / wall).toFixed(0)} відп/с`);
  console.log('\n  Коди відповідей:');
  const labels = { 200: 'записано', 400: 'відхилено (форма)', 401: 'невалідний ключ',
                   429: 'спрацював ліміт 🛡️', 500: 'помилка сервера', 0: 'мережа/таймаут' };
  [...buckets.entries()].sort((a, b) => b[1] - a[1]).forEach(([status, n]) => {
    console.log(`    ${String(status).padStart(3)} ${(labels[status] || '').padEnd(22)} ${n}  (${(100 * n / done).toFixed(1)}%)`);
  });
  console.log('\n  Затримка (успішні відповіді):');
  console.log(`    p50 ${pct(latencies, 50).toFixed(0)}ms   p95 ${pct(latencies, 95).toFixed(0)}ms   p99 ${pct(latencies, 99).toFixed(0)}ms   max ${Math.max(0, ...latencies).toFixed(0)}ms`);
  console.log('\n  Як читати:');
  console.log('    • багато 429 → захист від зловживань тримає: саме так і має бути;');
  console.log('    • ростуть 500 / таймаути → знайдено стелю (функції або Firestore);');
  console.log('    • затримка p99 злітає, кодів помилок немає → впираємось у пропускну здатність.\n');
  process.exit(0);
}
