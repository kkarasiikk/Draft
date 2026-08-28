const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");
// Той самий список, що й у формі тренувань — див. коментар у файлі про те,
// чому копія має бути одна.
const { EXERCISE_LIB, exerciseLabel, exerciseMuscle } = require("./workout/exercises");
// Ті самі підрахунки, що показує вкладка «Рекорди», і те саме правило
// прогресії, що підказує вагу у формі. Помічник має бачити ті самі числа,
// що й людина: інакше в чаті звучало б одне, а на екрані стояло інше.
const workoutProgress = require("./workout/progress");
const { suggestNext } = require("./workout/progression");
const { suggestSession, adjustForReadiness, READINESS } = require("./workout/plan");
// Ті самі категорії, що показує бюджет, доки людина їх не редагувала —
// у профілі їх у цей момент ще немає (див. коментар у файлі).
const { defaultCategoryList } = require("./categories-default");
// Серія, рятунок і причини пропусків — той самий модуль, що й на сторінці
// цілей. Правило «коли рятунок доступний» мусить бути одне.
const goalStreak = require("./goals/streak");
// Темп («чи встигаєш до дедлайну») і черга щотижневого огляду. Той самий
// модуль, що читає сторінка цілей: інакше в чаті звучала б одна оцінка, а на
// екрані стояла інша — рівно те, чого уникає спільний streak.js.
const goalReview = require("./goals/review");

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

// Той самий перелік, що й у формі цілей (CATEGORIES у goals/app.js). Правила
// Firestore перевіряють його жорстко, тож ціль із категорією поза списком
// просто не запишеться.
const GOAL_CATEGORIES = ["health", "finance", "learning", "career",
  "relationships", "travel", "creativity", "other"];

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
    description:
      "Скільки відкладено, по яких цілях заощаджень і скільки знято — загальний залишок з початку. " +
      "Якщо питають про конкретний місяць («скільки я зберіг за липень», «скільки поклав цього місяця») — " +
      "передай month (YYYY-MM): у відповіді додасться period із приростом чи відтоком САМЕ за той місяць по кожній цілі.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Місяць YYYY-MM, якщо питають про конкретний період" },
      },
    },
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
        goalId: {
          type: "string",
          description: "id довгострокової цілі, якщо це щоденна дія з неї (бери з goals_progress). " +
            "Виконання такого завдання само відмічає день у серії цілі",
        },
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
    name: "training_analysis",
    description:
      "Готовий розбір тренувань: чи росте сила (оцінка 1ПМ за Еплі, останні 28 днів проти попередніх 28), " +
      "обсяг по групах мʼязів, скільки днів кожна група відпочивала і яку вагу правило прогресії пропонує далі. " +
      "Тут же todaySuggestion — готова пропозиція на сьогодні (яку групу тренувати і з якими вагами), та сама, що на екрані. Викликай ЗАМІСТЬ того, щоб рахувати тренди самому з workout_history: тут ті самі числа, що бачить людина. " +
      "workout_history потрібен лише тоді, коли треба глянути на конкретні підходи.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "personal_records",
    description: "Особисті рекорди по вправах: найбільша вага й найкращий підхід.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "goals_progress",
    description: "Довгострокові цілі: статус, виконані віхи, дата дедлайну, темп. " +
      "Плюс retrospective — що закрито за останній рік і скільки кожна ціль зайняла.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "log_readiness",
    description:
      "Записати самопочуття на сьогодні перед тренуванням: «сьогодні розбитий» -> low, «так собі» -> ok, " +
      "«повний сил» -> ready. Це єдине джерело даних про відновлення — сну й пульсу застосунок не знає. " +
      "Після цього план на сьогодні (todaySuggestion) враховує відповідь: менший обсяг і менша вага.",
    input_schema: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["ready", "ok", "low"], description: "ready — сил повно, ok — так собі, low — розбитий" },
      },
      required: ["level"],
    },
  },
  {
    name: "add_workout",
    description:
      "Записати проведене тренування. Кожна вправа — окремий запис з підходами (вага в кг і кількість повторень). " +
      "Для вправ із бібліотеки обов'язково передавай libId: саме за ним рахуються рекорди, і без нього вправа не " +
      "склеїться з попередніми. Якщо вправи в бібліотеці немає — лиши libId порожнім і задай name.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Дата YYYY-MM-DD; за замовчуванням сьогодні" },
        name: { type: "string", description: "Назва тренування, напр. «Груди й трицепс» (необов'язково)" },
        notes: { type: "string", description: "Нотатка до тренування (необов'язково)" },
        exercises: {
          type: "array",
          description: "Вправи тренування, хоча б одна",
          items: {
            type: "object",
            properties: {
              libId: { type: "string", enum: EXERCISE_LIB.map((e) => e.id), description: "Вправа з бібліотеки" },
              name: { type: "string", description: "Назва власної вправи — тільки якщо libId не підходить" },
              sets: {
                type: "array",
                description: "Підходи. «4 по 8 на 60 кг» — це чотири однакові підходи, а не один.",
                items: {
                  type: "object",
                  properties: {
                    weight: { type: "number", description: "Вага в кг; 0 для вправ з власною вагою" },
                    reps: { type: "number", description: "Кількість повторень" },
                  },
                  required: ["reps"],
                },
              },
            },
            required: ["sets"],
          },
        },
      },
      required: ["exercises"],
    },
  },
  {
    name: "add_goal",
    description:
      "Створити довгострокову ціль. Віхи (milestones) — це проміжні кроки на шляху до неї; якщо людина їх назвала, " +
      "перелічи, якщо ні — лиши список порожнім, додати можна й потім. Це саме довгострокова ціль, а не завдання " +
      "на день: «купити молоко» -> add_task, «пробігти марафон до весни» -> add_goal.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Формулювання цілі" },
        category: {
          type: "string",
          enum: GOAL_CATEGORIES,
          description: "Сфера життя; якщо не зрозуміло — other",
        },
        why: { type: "string", description: "Навіщо це людині — її ж словами (необов'язково)" },
        targetDate: { type: "string", description: "Дедлайн YYYY-MM-DD (необов'язково)" },
        horizon: { type: "string", enum: ["month", "year"],
          description: "Горизонт: month — що людина робить цього місяця, year — куди йде загалом. " +
            "За замовчуванням year" },
        parentGoalId: { type: "string",
          description: "id РІЧНОЇ цілі, якій служить ця місячна (з goals_progress). Лише для horizon month" },
        targetValue: { type: "number", description: "Числова мета, якщо ціль вимірювана: 10 для «пробігти 10 км»" },
        unit: { type: "string", description: "Одиниця до targetValue: км, книг, €. Без targetValue не має сенсу" },
        milestones: {
          type: "array",
          description: "Проміжні кроки, по порядку (необов'язково)",
          items: { type: "string" },
        },
      },
      required: ["title"],
    },
  },
  {
    name: "goal_progress",
    description:
      "Додати прогрес до вимірюваної цілі: «пробіг ще 3 км» -> add 3. Число ДОДАЄТЬСЯ до вже пройденого, " +
      "а не замінює його. id бери з goals_progress; працює лише для цілей, у яких задана числова мета.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "id цілі з goals_progress" },
        add: { type: "number", description: "Скільки додати; відʼємне число зменшує" },
      },
      required: ["id", "add"],
    },
  },
  {
    name: "goal_checkin",
    description:
      "Відзначити сьогоднішній чекін по довгостроковій цілі — це те, що тримає серію (streak). " +
      "Спершу виклич goals_progress, щоб узяти id потрібної цілі.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "id цілі зі списку goals_progress" } },
      required: ["id"],
    },
  },
  {
    name: "rescue_streak",
    description:
      "Врятувати серію: дописати ВЧОРАШНІЙ пропущений день, щоб ланцюг не обірвався. " +
      "Працює лише коли пропущено рівно вчора, а до того серія тривала, і лише раз на тиждень — " +
      "goals_progress показує в полі rescue, чи доступно. Не використовуй, щоб просто відзначити сьогодні: для цього goal_checkin.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "id цілі зі списку goals_progress" } },
      required: ["id"],
    },
  },
  {
    name: "log_blocker",
    description:
      "Записати, що завадило сьогодні попрацювати над ціллю: «не встиг, не було часу» -> reason «не було часу». " +
      "Один запис на день — повторний виклик замінює попередній. Не вигадуй причину сам: пиши те, що сказала людина.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "id цілі зі списку goals_progress" },
        reason: { type: "string", description: "Коротко, кількома словами: «не було часу», «втома», «забув»" },
      },
      required: ["id", "reason"],
    },
  },
  {
    name: "complete_milestone",
    description:
      "Позначити віху цілі виконаною. id цілі й id віхи бери з goals_progress.",
    input_schema: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "id цілі" },
        milestoneId: { type: "string", description: "id віхи" },
      },
      required: ["goalId", "milestoneId"],
    },
  },
  {
    name: "add_savings_goal",
    description:
      "Створити накопичувальну ціль — скарбничку, в яку далі складають гроші (напр. «На відпустку»). " +
      "Це не витрата й не довгострокова ціль: гроші сюди кладуть і звідси знімають через add_savings_entry.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Назва скарбнички" } },
      required: ["name"],
    },
  },
  {
    name: "add_savings_entry",
    description:
      "Покласти гроші в накопичувальну ціль або зняти звідти. Спершу виклич savings_summary і візьми id потрібної цілі — " +
      "id вгадувати не можна. Зняття (withdraw) зменшує накопичене.",
    input_schema: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "id накопичувальної цілі з savings_summary" },
        type: { type: "string", enum: ["deposit", "withdraw"], description: "Покласти чи зняти" },
        amount: { type: "number", description: "Сума, більша за нуль" },
        note: { type: "string", description: "Нотатка (необов'язково)" },
        date: { type: "string", description: "Дата YYYY-MM-DD; за замовчуванням сьогодні" },
      },
      required: ["goalId", "type", "amount"],
    },
  },
  {
    name: "rename_savings_goal",
    description: "Перейменувати накопичувальну ціль. id бери з savings_summary.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "id накопичувальної цілі" },
        name: { type: "string", description: "Нова назва" },
      },
      required: ["id", "name"],
    },
  },
  {
    name: "edit_transaction",
    description:
      "Виправити вже записану операцію: суму, категорію, дату, нотатку чи тип. Передавай ТІЛЬКИ ті поля, які треба " +
      "змінити — решта лишиться як була. id бери з query_transactions.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "id операції з query_transactions" },
        type: { type: "string", enum: ["income", "expense"] },
        amount: { type: "number" },
        category: { type: "string", description: "ID категорії зі списку в контексті" },
        note: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["id"],
    },
  },
  {
    name: "edit_task",
    description:
      "Змінити вже створене завдання: назву, дату, час, пріоритет, оцінку тривалості, теги чи нотатки. " +
      "Передавай тільки те, що змінюється. Щоб позначити виконаним — complete_task. id бери з list_tasks.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "id завдання з list_tasks" },
        title: { type: "string" },
        notes: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        tags: { type: "array", items: { type: "string" } },
        dueDate: { type: "string", description: "YYYY-MM-DD; null щоб прибрати дату" },
        dueTime: { type: "string", description: "HH:MM; тримається лише разом з датою" },
        estimateMin: { type: "number", description: "Оцінка в хвилинах" },
      },
      required: ["id"],
    },
  },
  {
    name: "edit_workout",
    description:
      "Виправити записане тренування: дату, назву, нотатку або склад вправ. Увага: якщо передаєш exercises, вони " +
      "замінюють увесь список — спершу виклич workout_history, візьми наявні вправи й надішли повний виправлений набір. " +
      "id бери звідти ж.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "id тренування з workout_history" },
        date: { type: "string", description: "YYYY-MM-DD" },
        name: { type: "string" },
        notes: { type: "string" },
        exercises: {
          type: "array",
          description: "ПОВНИЙ новий список вправ — не лише змінена",
          items: {
            type: "object",
            properties: {
              libId: { type: "string", enum: EXERCISE_LIB.map((e) => e.id) },
              name: { type: "string" },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: { weight: { type: "number" }, reps: { type: "number" } },
                  required: ["reps"],
                },
              },
            },
            required: ["sets"],
          },
        },
      },
      required: ["id"],
    },
  },
  {
    name: "edit_goal",
    description:
      "Змінити довгострокову ціль: формулювання, сферу, дедлайн, статус або список віх. Якщо передаєш milestones — " +
      "це повний новий список, уже виконані віхи лишаться виконаними за збігом назви. Щоб закрити одну віху, " +
      "краще complete_milestone. id бери з goals_progress.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "id цілі з goals_progress" },
        title: { type: "string" },
        category: { type: "string", enum: GOAL_CATEGORIES },
        why: { type: "string" },
        targetDate: { type: "string", description: "YYYY-MM-DD" },
        targetValue: { type: "number", description: "Числова мета; null прибирає її" },
        unit: { type: "string", description: "Одиниця до targetValue" },
        horizon: { type: "string", enum: ["month", "year"], description: "Перенести ціль між вкладками «Місяць» і «Рік»" },
        parentGoalId: { type: "string", description: "Привʼязати місячну ціль до річної; null відвʼязує" },
        status: { type: "string", enum: ["active", "done", "archived", "paused"],
          description: "paused — ціль жива, але про неї свідомо не питають (відпустка, зміна обставин): " +
            "вечірні питання вимикаються, серія не рветься" },
        milestones: { type: "array", items: { type: "string" }, description: "Повний новий список віх" },
      },
      required: ["id"],
    },
  },
  {
    name: "render_chart",
    description:
      "Намалювати діаграму просто в чаті: pie (частки категорій), bar (порівняння сум чи періодів) або line (зміна в часі). " +
      "Використовуй ТІЛЬКИ реальні числа, які вже отримав в цій-таки розмові іншим інструментом (month_summary, query_transactions, " +
      "training_analysis, list_tasks, goals_progress) — цифри для діаграми вигадувати так само не можна, як і в тексті.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["pie", "bar", "line"] },
        title: { type: "string", description: "Короткий підпис над діаграмою" },
        labels: { type: "array", items: { type: "string" }, description: "Підписи секторів/стовпців/точок" },
        datasets: {
          type: "array",
          description: "Один набір значень для pie; один чи кілька — для bar/line (напр. дохід і витрати окремими рядами)",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Назва ряду, якщо їх кілька" },
              values: { type: "array", items: { type: "number" }, description: "По одному числу на кожен label" },
            },
            required: ["values"],
          },
        },
      },
      required: ["type", "labels", "datasets"],
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

// ---- Діаграма в чаті ----
// Просто передаємо клієнту вже підготовлені моделлю числа — тут немає
// звернень до Firestore, лише санітизація форми. Довіра до самих чисел та
// сама, що й до тексту відповіді: модель бере їх із результату іншого
// інструмента цього ж раунду, а не вигадує.
const CHART_TYPES = ["pie", "bar", "line"];
const CHART_MAX_POINTS = 24;
const CHART_MAX_DATASETS = 6;

function renderChart(input) {
  const type = CHART_TYPES.includes(input.type) ? input.type : null;
  if (!type) return { output: { ok: false, error: "type має бути pie, bar або line" }, isError: true };

  const labels = (Array.isArray(input.labels) ? input.labels : [])
    .map((l) => String(l).slice(0, 60))
    .slice(0, CHART_MAX_POINTS);
  if (!labels.length) return { output: { ok: false, error: "потрібен хоча б один label" }, isError: true };

  let datasets = (Array.isArray(input.datasets) ? input.datasets : [])
    .slice(0, CHART_MAX_DATASETS)
    .map((d) => ({
      label: typeof (d && d.label) === "string" ? d.label.slice(0, 40) : "",
      values: (Array.isArray(d && d.values) ? d.values : [])
        .slice(0, labels.length)
        .map((v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0)),
    }))
    .filter((d) => d.values.length);
  if (!datasets.length) return { output: { ok: false, error: "потрібен хоча б один набір значень" }, isError: true };
  // Кругова діаграма показує частки одного цілого — другий ряд тут нема куди подіти.
  if (type === "pie") datasets = datasets.slice(0, 1);

  const title = typeof input.title === "string" ? input.title.slice(0, 100) : "";
  return { output: { ok: true }, action: { kind: "chart", chart: { type, title, labels, datasets } } };
}

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
    let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (input.category) docs = docs.filter((d) => d.category === input.category);
    const sumIncome = docs.filter((d) => d.type === "income").reduce((s, d) => s + d.amount, 0);
    const sumExpense = docs.filter((d) => d.type === "expense").reduce((s, d) => s + d.amount, 0);
    const items = docs
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit)
      .map((d) => ({ id: d.id, type: d.type, amount: d.amount, category: d.category, note: d.note, date: d.date }));
    return {
      output: { count: docs.length, sumIncome, sumExpense, currency: ctx.currency, items },
    };
  }

  if (name === "render_chart") return renderChart(input);
  if (name === "month_summary") return monthSummary(uid, input, ctx);
  if (name === "savings_summary") return savingsSummary(uid, ctx, input);
  if (name === "add_task") return addTask(uid, input, ctx);
  if (name === "list_tasks") return listTasks(uid, input, ctx);
  if (name === "complete_task") return completeTask(uid, input, ctx);
  if (name === "workout_history") return workoutHistory(uid, input);
  if (name === "training_analysis") return trainingAnalysis(uid, ctx);
  if (name === "personal_records") return personalRecords(uid, ctx);
  if (name === "goals_progress") return goalsProgress(uid);
  if (name === "log_readiness") return logReadiness(uid, input, ctx);
  if (name === "add_workout") return addWorkout(uid, input, ctx);
  if (name === "add_goal") return addGoal(uid, input);
  if (name === "add_savings_goal") return addSavingsGoal(uid, input);
  if (name === "add_savings_entry") return addSavingsEntry(uid, input, ctx);
  if (name === "rename_savings_goal") return renameSavingsGoal(uid, input);
  if (name === "edit_transaction") return editTransaction(uid, input, ctx);
  if (name === "edit_task") return editTask(uid, input);
  if (name === "edit_workout") return editWorkout(uid, input, ctx);
  if (name === "edit_goal") return editGoal(uid, input);
  if (name === "goal_progress") return goalProgress(uid, input);
  if (name === "goal_checkin") return goalCheckin(uid, input);
  if (name === "rescue_streak") return rescueStreak(uid, input, ctx);
  if (name === "log_blocker") return logBlocker(uid, input, ctx);
  if (name === "complete_milestone") return completeMilestone(uid, input);

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

async function savingsSummary(uid, ctx, input) {
  const [savingsSnap, goalsSnap] = await Promise.all([
    userCol(uid, "savings").get(),
    userCol(uid, "savingsGoals").get(),
  ]);
  const entries = savingsSnap.docs.map((d) => d.data() || {});
  // Зняття зменшує накопичене, інакше сума показувала б оборот, а не залишок.
  const delta = (sv) => (sv.type === "withdraw" ? -1 : 1) * (Number(sv.amount) || 0);

  const perGoal = new Map();
  entries.forEach((sv) => {
    const key = sv.goalId || "";
    perGoal.set(key, (perGoal.get(key) || 0) + delta(sv));
  });
  const goalName = new Map(goalsSnap.docs.map((d) => [d.id, (d.data() || {}).name || "Заощадження"]));
  // Перелік будується з самих цілей, а не з операцій: щойно створена ціль ще
  // порожня, і якби її тут не було, покласти в неї гроші не вийшло б —
  // модель не дізналася б її id.
  const goals = goalsSnap.docs.map((d) => ({
    id: d.id,
    goal: goalName.get(d.id) || "Заощадження",
    saved: Math.round((perGoal.get(d.id) || 0) * 100) / 100,
  }));
  const orphan = perGoal.get("") || 0;
  if (orphan) goals.push({ id: null, goal: "Без цілі", saved: Math.round(orphan * 100) / 100 });

  const output = {
    currency: ctx.currency,
    total: Math.round(goals.reduce((a, g) => a + g.saved, 0) * 100) / 100,
    goals,
  };

  // «Скільки я зберіг за липень» — це не залишок, а приріст/відтік САМЕ за
  // місяць: без цього блоку модель бачила б лише накопичене з початку і не
  // мала б чим відповісти на питання про конкретний період.
  const bounds = monthBounds(input && input.month);
  if (bounds) {
    const perGoalPeriod = new Map();
    entries
      .filter((sv) => typeof sv.date === "string" && sv.date >= bounds.from && sv.date <= bounds.to)
      .forEach((sv) => {
        const key = sv.goalId || "";
        perGoalPeriod.set(key, (perGoalPeriod.get(key) || 0) + delta(sv));
      });
    const periodGoals = [...perGoalPeriod.entries()].map(([id, net]) => ({
      id: id || null,
      goal: id ? (goalName.get(id) || "Заощадження") : "Без цілі",
      net: Math.round(net * 100) / 100,
    }));
    output.period = {
      month: input.month,
      net: Math.round(periodGoals.reduce((a, g) => a + g.net, 0) * 100) / 100,
      goals: periodGoals,
    };
  }

  return { output };
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
      // Завдання може бути щоденною дією з цілі. Порожній рядок — це «нема
      // цілі», а не ціль з порожнім id, тож нормалізуємо в null.
      goalId: typeof input.goalId === "string" && input.goalId.trim() ? input.goalId.trim().slice(0, 64) : null,
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
        goalId: t.goalId || null,
      })),
    },
  };
}

async function completeTask(uid, input, ctx) {
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
  const task = doc.data() || {};
  const title = task.title || "";
  // Завдання з цілі само відмічає її день у серії — так само, як на сторінці.
  // Інакше людина, що просить «познач, що пробіжку зробив», отримала б
  // галочку в завданнях і мертву серію в цілях.
  const checkedIn = task.goalId ? await checkinFromTask(uid, task.goalId, ctx) : null;
  return {
    output: { ok: true, id, title, goalCheckin: checkedIn },
    action: { kind: "task_completed", title, goal: checkedIn || undefined },
  };
}

/** Ставить чекін цілі, до якої привʼязане завдання. Повертає назву цілі,
 *  якщо день справді відмічено, і null, якщо він уже був або цілі немає. */
async function checkinFromTask(uid, goalId, ctx) {
  const ref = userCol(uid, "goals").doc(goalId);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const goal = doc.data() || {};
  const result = goalStreak.applyCheckin(goal, ctx.today);
  if (!result) return null;
  await ref.update({ checkins: result.checkins, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return goal.title || "";
}

// ---- Тренування ----
async function workoutHistory(uid, input) {
  const snap = await userCol(uid, "workouts").get();
  const limit = Math.min(Math.max(parseInt(input.limit, 10) || 8, 1), 30);
  const docs = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, limit);
  return {
    output: {
      count: docs.length,
      sessions: docs.map((w) => ({
        id: w.id,
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

async function personalRecords(uid, ctx) {
  const snap = await userCol(uid, "workouts").get();
  const best = new Map();
  snap.docs.forEach((d) => {
    const w = d.data() || {};
    (w.exercises || []).forEach((ex) => {
      // Групуємо за стабільним ключем, а не за назвою: сторінка зберігає
      // назву вже перекладеною, тож після зміни мови інтерфейсу та сама
      // вправа розʼїжджалась на два різні рекорди.
      const key = workoutProgress.exerciseKey(ex);
      if (!key) return;
      (ex.sets || []).forEach((st) => {
        const weight = Number(st.weight) || 0;
        const reps = Number(st.reps) || 0;
        if (!weight && !reps) return;
        const prev = best.get(key);
        // Рекорд — за вагою; за однакової ваги виграє більше повторень.
        if (!prev || weight > prev.weight || (weight === prev.weight && reps > prev.reps)) {
          best.set(key, {
            exercise: ex.libId ? exerciseLabel(ex.libId, ctx.lang) : (ex.name || ""),
            weight, reps, date: w.date || null,
          });
        }
      });
    });
  });
  return { output: { count: best.size, records: [...best.values()] } };
}

// Один документ на добу, id — сама дата: перезапис замість накопичення.
async function logReadiness(uid, input, ctx) {
  const level = READINESS.includes(input.level) ? input.level : "";
  if (!level) return { output: { ok: false, error: "level має бути ready, ok або low" }, isError: true };

  await userCol(uid, "readiness").doc(ctx.today).set({
    level, date: ctx.today, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {
    output: { ok: true, date: ctx.today, level },
    action: { kind: "readiness_logged", level },
  };
}

// ---- Розбір тренувань ----
// Модель погано рахує тренди з сирих підходів: тридцять рядків «вага ×
// повторення» вона радше перекаже, ніж підсумує. Тому підрахунки робить
// той самий код, що малює вкладку «Рекорди», а сюди приходять уже готові
// числа — і в чаті звучить рівно те, що людина бачить на екрані.
async function trainingAnalysis(uid, ctx) {
  const snap = await userCol(uid, "workouts").get();
  const sessions = snap.docs.map((d) => d.data() || {});
  const data = workoutProgress.analyze(sessions, ctx.today);
  const rest = workoutProgress.restByMuscle(sessions, ctx.today);
  const restDays = {};
  rest.forEach((r) => { restDays[r.muscle] = r.daysAgo; });

  // Історія кожної вправи, найновіше першим — саме в такому вигляді її
  // читає правило прогресії.
  const byKey = new Map();
  sessions
    .filter((w) => typeof w.date === "string")
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        const key = workoutProgress.exerciseKey(ex);
        if (!key) return;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push({ date: w.date, sets: ex.sets || [] });
      });
    });

  const exercises = data.exercises.slice(0, 12).map((e) => {
    const next = suggestNext(byKey.get(e.key) || [], e.libId || "");
    return {
      exercise: e.libId ? exerciseLabel(e.libId, ctx.lang) : e.name,
      muscle: e.muscle,
      e1rm: e.e1rm,
      e1rmMonthAgo: e.prevE1rm,
      changePct: e.pct,
      tonnage: e.tonnage,
      reps: e.reps,
      // Те саме, що показує кнопка «Підставити» у формі, — щоб порада в
      // чаті не розходилась із підказкою на екрані.
      nextSuggestion: next
        ? { weight: next.weight, reps: next.reps, direction: next.verdict, why: next.reason }
        : null,
    };
  });

  // Те саме, що показує картка «План на сьогодні» на сторінці: питання
  // «що мені сьогодні робити» приходить і в чат теж, і відповідь має бути
  // однією, а не двома різними.
  const readySnap = await userCol(uid, "readiness").doc(ctx.today).get();
  const readiness = readySnap.exists ? (readySnap.data() || {}).level || null : null;

  const plan = suggestSession(sessions, ctx.today);
  const todaySuggestion = !plan ? null : (plan.rest
    ? { rest: true, muscle: plan.muscle, daysAgo: plan.daysAgo }
    : {
      rest: false,
      readiness,
      muscles: plan.muscles.map((m) => ({ muscle: m.muscle, daysAgo: m.daysAgo })),
      exercises: adjustForReadiness(plan.exercises, readiness).map((e) => ({
        exercise: e.libId ? exerciseLabel(e.libId, ctx.lang) : e.name,
        muscle: e.muscle, sets: e.sets, weight: e.weight, reps: e.reps, direction: e.direction,
      })),
    });

  return {
    output: {
      enough: data.enough,
      needSessions: data.needSessions,
      readinessToday: readiness,
      todaySuggestion,
      windowDays: data.windowDays,
      sessions: { last28: data.sessionsNow, previous28: data.sessionsPrev },
      strengthChangePct: data.strengthPct,
      comparedExercises: data.comparedCount,
      verdict: data.verdict,
      exercises,
      muscles: data.muscles.map((m) => ({
        muscle: m.muscle,
        volumeUnit: m.unit,
        volume: m.now,
        volumeMonthAgo: m.prev,
        changePct: m.pct,
        daysSinceTrained: restDays[m.muscle] != null ? restDays[m.muscle] : null,
      })),
    },
  };
}

// ---- Цілі ----
// ---- Запис: тренування ----
// Форма тренувань складає документ так само (див. submit-handler у
// workout/app.js): вправа без жодного підходу з вагою чи повтореннями туди
// не потрапляє, бо в історії від неї немає користі. Повторюємо ту саму
// вибагливість — інакше з чату можна було б записати порожню вправу, якої
// руками не створити.
function sanitizeWorkoutInput(input, ctx) {
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const raw = Array.isArray(input.exercises) ? input.exercises.slice(0, 30) : [];

  const exercises = raw.map((ex, i) => {
    const libId = typeof ex.libId === "string" && EXERCISE_LIB.some((e) => e.id === ex.libId) ? ex.libId : null;
    // Назва з бібліотеки береться мовою користувача, а не з тексту моделі:
    // так запис із чату виглядає в списку рівно як створений руками.
    const name = libId
      ? exerciseLabel(libId, ctx.lang)
      : (typeof ex.name === "string" ? ex.name.trim().slice(0, 120) : "");
    const sets = (Array.isArray(ex.sets) ? ex.sets : []).slice(0, 30).map((st) => {
      const weight = Number(st && st.weight);
      const reps = Number(st && st.reps);
      return {
        weight: Number.isFinite(weight) && weight > 0 ? Math.round(weight * 100) / 100 : 0,
        reps: Number.isFinite(reps) && reps > 0 ? Math.min(Math.round(reps), 1000) : 0,
      };
    }).filter((st) => st.weight > 0 || st.reps > 0);

    return {
      id: `ai${Date.now().toString(36)}${i}`,
      libId,
      muscle: libId ? exerciseMuscle(libId) : null,
      name,
      sets,
    };
  }).filter((ex) => ex.name && ex.sets.length);

  if (!exercises.length) return { error: "потрібна хоча б одна вправа з підходами" };

  return {
    value: {
      date: isDate(input.date) ? input.date : ctx.today,
      name: typeof input.name === "string" ? input.name.trim().slice(0, 120) : "",
      notes: typeof input.notes === "string" ? input.notes.slice(0, 3000) : "",
      exercises,
    },
  };
}

async function addWorkout(uid, input, ctx) {
  const result = sanitizeWorkoutInput(input, ctx);
  if (result.error) return { output: { ok: false, error: result.error }, isError: true };

  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = await userCol(uid, "workouts").add({ ...result.value, createdAt: now, updatedAt: now });
  const setCount = result.value.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  return {
    output: { ok: true, id: ref.id, date: result.value.date, exercises: result.value.exercises.length, sets: setCount },
    action: {
      kind: "workout_added",
      date: result.value.date,
      name: result.value.name,
      exercises: result.value.exercises.map((ex) => ex.name),
    },
  };
}

// ---- Заощадження ----
async function addSavingsGoal(uid, input) {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 200) : "";
  if (!name) return { output: { ok: false, error: "name обов'язковий" }, isError: true };
  const ref = await userCol(uid, "savingsGoals").add({
    name,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { output: { ok: true, id: ref.id }, action: { kind: "savings_goal_added", name } };
}

async function addSavingsEntry(uid, input, ctx) {
  const goalId = typeof input.goalId === "string" ? input.goalId.trim() : "";
  if (!goalId) return { output: { ok: false, error: "goalId обов'язковий" }, isError: true };
  // Операція без існуючої цілі осиротіла б: на сторінці заощаджень усе
  // згруповано за цілями, і такий запис ніде не показався б.
  const goalDoc = await userCol(uid, "savingsGoals").doc(goalId).get();
  if (!goalDoc.exists) return { output: { ok: false, error: "накопичувальна ціль не знайдена" }, isError: true };

  const type = input.type === "withdraw" ? "withdraw" : "deposit";
  const amount = Math.round(parseFloat(input.amount) * 100) / 100;
  if (!amount || isNaN(amount) || amount <= 0 || amount >= 1000000000) {
    return { output: { ok: false, error: "amount має бути додатним числом" }, isError: true };
  }
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

  await userCol(uid, "savings").add({
    type,
    amount,
    currency: ctx.currency,
    note: typeof input.note === "string" ? input.note.slice(0, 2000) : "",
    date: isDate(input.date) ? input.date : ctx.today,
    goalId,
  });
  const name = (goalDoc.data() || {}).name || "";
  return {
    output: { ok: true, type, amount, goal: name },
    action: { kind: "savings_entry", type, amount, currency: CURRENCY_SYMBOLS[ctx.currency] || ctx.currency, goal: name },
  };
}

async function renameSavingsGoal(uid, input) {
  const id = typeof input.id === "string" ? input.id : "";
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 200) : "";
  if (!name) return { output: { ok: false, error: "name обов'язковий" }, isError: true };
  const ref = userCol(uid, "savingsGoals").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { output: { ok: false, error: "накопичувальна ціль не знайдена" }, isError: true };
  const before = (doc.data() || {}).name || "";
  await ref.update({ name });
  return { output: { ok: true, from: before, to: name }, action: { kind: "renamed", from: before, to: name } };
}

// ---- Правки вже записаного ----
// Спільний кістяк для всіх edit_*. Ключове тут — читати документ і
// перевіряти вже ЗЛИТИЙ результат, а не саму правку: правила Firestore
// дивляться на документ цілком, тож патч, коректний сам по собі, легко дає
// на виході неприпустимий документ (скажімо, час без дати в завданні).
//
// `patch` бере лише ті ключі, які модель справді надіслала: undefined означає
// «не чіпати», і відрізнити його від свідомого null тут принципово.
function pickPatch(input, keys) {
  const out = {};
  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(input, k) && input[k] !== undefined) out[k] = input[k];
  });
  return out;
}

async function loadForEdit(uid, colName, id, notFound) {
  const ref = userCol(uid, colName).doc(typeof id === "string" ? id : "");
  const doc = await ref.get();
  if (!doc.exists) return { error: { output: { ok: false, error: notFound }, isError: true } };
  return { ref, data: doc.data() || {} };
}

async function editTransaction(uid, input, ctx) {
  const found = await loadForEdit(uid, "transactions", input.id, "операція не знайдена");
  if (found.error) return found.error;

  const patch = pickPatch(input, ["type", "amount", "category", "note", "date"]);
  if (!Object.keys(patch).length) return { output: { ok: false, error: "нічого міняти" }, isError: true };

  const merged = { ...found.data, ...patch };
  const result = sanitizeTransactionInput(merged, ctx.categoriesExpense, ctx.categoriesIncome);
  if (result.error) return { output: { ok: false, error: result.error }, isError: true };

  // source лишаємо як був: помітка «створено помічником» стосується
  // походження запису, а не того, хто його потім правив.
  const value = { ...result.value, source: found.data.source || result.value.source };
  await found.ref.update(value);
  const list = value.type === "income" ? ctx.categoriesIncome : ctx.categoriesExpense;
  const cat = list.find((c) => c.id === value.category);
  return {
    output: { ok: true, ...value },
    action: {
      kind: "transaction_edited",
      categoryLabel: cat ? cat.label : value.category,
      amount: value.amount,
      currency: CURRENCY_SYMBOLS[ctx.currency] || ctx.currency,
    },
  };
}

async function editTask(uid, input) {
  const found = await loadForEdit(uid, "tasks", input.id, "завдання не знайдене");
  if (found.error) return found.error;

  const patch = pickPatch(input, ["title", "notes", "priority", "tags", "dueDate", "dueTime", "estimateMin", "goalId"]);
  if (!Object.keys(patch).length) return { output: { ok: false, error: "нічого міняти" }, isError: true };

  const merged = { ...found.data, ...patch };
  const result = sanitizeTaskInput(merged);
  if (result.error) return { output: { ok: false, error: result.error }, isError: true };

  // sanitizeTaskInput складає документ як для НОВОГО завдання, тож повертаємо
  // те, що воно обнуляє: виконаність, повторення й нагадування правкою
  // тексту зачіпати не можна.
  const value = {
    ...result.value,
    done: !!found.data.done,
    completedAt: found.data.completedAt || null,
    recurrence: found.data.recurrence || null,
    reminderAt: found.data.reminderAt || null,
    notifiedAt: found.data.notifiedAt || null,
    subtasks: found.data.subtasks || [],
    goalId: "goalId" in patch ? result.value.goalId : (found.data.goalId || null),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await found.ref.update(value);
  return {
    output: { ok: true, title: value.title, dueDate: value.dueDate, dueTime: value.dueTime, priority: value.priority },
    action: { kind: "task_edited", title: value.title, dueDate: value.dueDate },
  };
}

async function editWorkout(uid, input, ctx) {
  const found = await loadForEdit(uid, "workouts", input.id, "тренування не знайдене");
  if (found.error) return found.error;

  const patch = pickPatch(input, ["date", "name", "notes", "exercises"]);
  if (!Object.keys(patch).length) return { output: { ok: false, error: "нічого міняти" }, isError: true };

  const merged = { ...found.data, ...patch };
  const result = sanitizeWorkoutInput(merged, ctx);
  if (result.error) return { output: { ok: false, error: result.error }, isError: true };

  // Якщо вправи не міняли — лишаємо наявні як є, разом з їхніми id: інакше
  // перепрогін через sanitize перевидав би id і зайво переписав документ.
  const value = patch.exercises
    ? result.value
    : { ...result.value, exercises: found.data.exercises || [] };
  await found.ref.update({ ...value, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return {
    output: { ok: true, date: value.date, exercises: value.exercises.length },
    action: { kind: "workout_edited", date: value.date, name: value.name },
  };
}

async function editGoal(uid, input) {
  const found = await loadForEdit(uid, "goals", input.id, "ціль не знайдена");
  if (found.error) return found.error;

  const patch = pickPatch(input, ["title", "category", "why", "targetDate", "targetValue", "unit", "status", "milestones", "horizon", "parentGoalId"]);
  if (!Object.keys(patch).length) return { output: { ok: false, error: "нічого міняти" }, isError: true };

  const merged = { ...found.data, ...patch };
  const result = sanitizeGoalInput(merged);
  if (result.error) return { output: { ok: false, error: result.error }, isError: true };

  // Віхи приходять новим списком, і sanitize позначає їх усі невиконаними.
  // Повертаємо галочки тим, чия назва збіглася: інакше правка формулювання
  // цілі мовчки скидала б уже пройдений шлях.
  const doneTitles = new Set((found.data.milestones || []).filter((m) => m.done).map((m) => m.title));
  const milestones = patch.milestones
    ? result.value.milestones.map((m) => (doneTitles.has(m.title) ? { ...m, done: true } : m))
    : (found.data.milestones || []);

  const value = {
    ...result.value,
    status: ["active", "done", "archived", "paused"].includes(patch.status) ? patch.status : (found.data.status || "active"),
    // Пройдене — це факт, а не налаштування: правка формулювання чи дедлайну
    // не має обнуляти те, що людина вже зробила.
    currentValue: Number(found.data.currentValue) || 0,
    milestones,
    checkins: found.data.checkins || [],
    journal: found.data.journal || [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await found.ref.update(value);
  return {
    output: { ok: true, title: value.title, status: value.status, milestones: milestones.length },
    action: { kind: "goal_edited", title: value.title },
  };
}

// ---- Запис: цілі ----
// Порожні поля тут не «необов'язкові дрібниці», а обов'язкова частина
// документа: правила Firestore вимагають why, milestones, checkins і journal
// незалежно від того, чи людина щось про них сказала. Форма на сторінці
// підставляє те саме.
function sanitizeGoalInput(input) {
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
  if (!title) return { error: "title обов'язковий" };

  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const rawTarget = Number(input.targetValue);
  const targetValue = Number.isFinite(rawTarget) && rawTarget > 0 ? Math.round(rawTarget * 100) / 100 : null;
  const milestones = (Array.isArray(input.milestones) ? input.milestones : [])
    .map((m) => (typeof m === "string" ? m : (m && m.title)))
    .map((titleText) => (typeof titleText === "string" ? titleText.trim().slice(0, 200) : ""))
    .filter(Boolean)
    .slice(0, 50)
    .map((titleText, i) => ({ id: `ai${Date.now().toString(36)}${i}`, title: titleText, done: false }));

  return {
    value: {
      title,
      category: GOAL_CATEGORIES.includes(input.category) ? input.category : "other",
      why: typeof input.why === "string" ? input.why.trim().slice(0, 1000) : "",
      targetDate: isDate(input.targetDate) ? input.targetDate : null,
      // Горизонт вирішує, на якій із двох вкладок ціль зʼявиться. За
      // замовчуванням річна: розділ і задумувався як довгостроковий, а
      // місячну людина назве місячною явно.
      horizon: input.horizon === "month" ? "month" : "year",
      // Річна ціль нікому не служить: драбина йде лише знизу вгору.
      parentGoalId: input.horizon === "month" && typeof input.parentGoalId === "string"
        ? input.parentGoalId : null,
      targetValue: targetValue,
      // Одиниця без числової мети ні про що не каже, тож живе тільки з нею.
      unit: targetValue ? (typeof input.unit === "string" ? input.unit.trim().slice(0, 20) : "") : "",
      currentValue: Number.isFinite(Number(input.currentValue)) ? Math.max(0, Number(input.currentValue)) : 0,
      status: "active",
      milestones,
      checkins: [],
      journal: [],
    },
  };
}

async function addGoal(uid, input) {
  const result = sanitizeGoalInput(input);
  if (result.error) return { output: { ok: false, error: result.error }, isError: true };

  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = await userCol(uid, "goals").add({ ...result.value, createdAt: now, updatedAt: now });
  return {
    // id повертаємо в тому ж раунді: інакше, щоб одразу відзначити чекін по
    // щойно створеній цілі, моделі довелося б окремо ходити в goals_progress.
    output: { ok: true, id: ref.id, milestones: result.value.milestones.length },
    action: {
      kind: "goal_added",
      title: result.value.title,
      targetDate: result.value.targetDate,
      milestones: result.value.milestones.length,
    },
  };
}


// Обидві дії ідемпотентні: повторний виклик нічого не псує. Модель може
// викликати інструмент двічі (наприклад, не розпізнавши, що вже зробила це
// в попередньому раунді), і чекін від цього не має задвоїтись чи зникнути —
// тому тут саме «поставити», а не «перемкнути», як у кнопці на сторінці.
// Додаємо, а не задаємо: людина каже «пробіг ще три кілометри», а не «тепер
// у мене 9». Нижче нуля не опускаємось.
async function goalProgress(uid, input) {
  const found = await loadForEdit(uid, "goals", input.id, "ціль не знайдена");
  if (found.error) return found.error;

  const target = Number(found.data.targetValue);
  if (!Number.isFinite(target) || target <= 0) {
    return { output: { ok: false, error: "у цієї цілі немає числової мети" }, isError: true };
  }
  const delta = Number(input.add);
  if (!Number.isFinite(delta) || delta === 0) {
    return { output: { ok: false, error: "add має бути числом, відмінним від нуля" }, isError: true };
  }
  const current = Math.max(0, Math.round(((Number(found.data.currentValue) || 0) + delta) * 100) / 100);
  await found.ref.update({ currentValue: current, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return {
    output: { ok: true, current, target, unit: found.data.unit || "", pct: Math.min(100, Math.round((current / target) * 100)) },
    action: { kind: "goal_progress", title: found.data.title || "", current, target, unit: found.data.unit || "" },
  };
}

async function goalCheckin(uid, input) {
  const id = typeof input.id === "string" ? input.id : "";
  const ref = userCol(uid, "goals").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { output: { ok: false, error: "ціль не знайдена" }, isError: true };

  const goal = doc.data() || {};
  const today = new Date().toISOString().slice(0, 10);
  const had = (goal.checkins || []).includes(today);
  let checkins = had ? goal.checkins : [...new Set([...(goal.checkins || []), today])].sort();
  // ISO-рядки сортуються хронологічно, тож зайве відрізається з початку.
  if (checkins.length > 400) checkins = checkins.slice(checkins.length - 400);

  if (!had) {
    await ref.update({ checkins, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  return {
    output: { ok: true, date: today, alreadyDone: had, totalCheckins: checkins.length },
    action: { kind: "goal_checkin", title: goal.title || "", date: today },
  };
}

// Рятунок і причина пропуску рахуються тим самим модулем, що й на сторінці
// (goals/streak.js), тож у чаті та в застосунку правила збігаються до дня.
async function rescueStreak(uid, input, ctx) {
  const found = await loadForEdit(uid, "goals", input.id, "ціль не знайдена");
  if (found.error) return found.error;

  const state = goalStreak.rescueState(found.data, ctx.today);
  if (!state) {
    return { output: { ok: false, error: "рятувати нічого: вчора або відмічено, або серії до того не було" }, isError: true };
  }
  if (!state.available) {
    return {
      output: { ok: false, error: `рятунок буде доступний через ${state.cooldownLeft} дн.`, cooldownLeft: state.cooldownLeft },
      isError: true,
    };
  }
  const result = goalStreak.applyRescue(found.data, ctx.today);
  await found.ref.update({
    checkins: result.checkins, rescues: result.rescues,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {
    output: { ok: true, day: result.day, streak: result.streak },
    action: { kind: "streak_rescued", title: found.data.title || "", day: result.day, streak: result.streak },
  };
}

async function logBlocker(uid, input, ctx) {
  const found = await loadForEdit(uid, "goals", input.id, "ціль не знайдена");
  if (found.error) return found.error;

  const result = goalStreak.applyBlocker(found.data, input.reason, ctx.today);
  if (!result) return { output: { ok: false, error: "потрібна причина" }, isError: true };

  await found.ref.update({ blockers: result.blockers, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return {
    output: { ok: true, date: ctx.today, reason: result.reason, top: goalStreak.blockerStats({ blockers: result.blockers }) },
    action: { kind: "blocker_logged", title: found.data.title || "", reason: result.reason },
  };
}

async function completeMilestone(uid, input) {
  const goalId = typeof input.goalId === "string" ? input.goalId : "";
  const milestoneId = typeof input.milestoneId === "string" ? input.milestoneId : "";
  const ref = userCol(uid, "goals").doc(goalId);
  const doc = await ref.get();
  if (!doc.exists) return { output: { ok: false, error: "ціль не знайдена" }, isError: true };

  const goal = doc.data() || {};
  const milestones = goal.milestones || [];
  const target = milestones.find((m) => m.id === milestoneId);
  if (!target) return { output: { ok: false, error: "віха не знайдена" }, isError: true };

  if (!target.done) {
    await ref.update({
      milestones: milestones.map((m) => (m.id === milestoneId ? { ...m, done: true } : m)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  const doneCount = milestones.filter((m) => m.done || m.id === milestoneId).length;
  return {
    output: { ok: true, alreadyDone: !!target.done, milestonesDone: doneCount, milestonesTotal: milestones.length },
    action: { kind: "milestone_done", goal: goal.title || "", title: target.title || "" },
  };
}

async function goalsProgress(uid) {
  const snap = await userCol(uid, "goals").get();
  const todayIso = new Date().toISOString().slice(0, 10);
  // Той самий startIso, що й для темпу: день заведення цілі лежить у
  // createdAt як Timestamp, а review.js про Firestore нічого не знає.
  const startIsoOf = (g) => (g && g.createdAt && typeof g.createdAt.toDate === "function"
    ? goalStreak.isoOf(g.createdAt.toDate()) : null);
  const allGoals = snap.docs.map((d) => ({ ...(d.data() || {}), id: d.id }));
  return {
    output: {
      count: snap.docs.length,
      // Що закрито за рік і скільки кожна ціль зайняла — рахує той самий
      // модуль, що й екран «Завершені»: інакше в чаті прозвучало б одне
      // число, а на екрані стояло інше.
      retrospective: goalReview.retrospective(allGoals, todayIso, { days: 365, startIsoOf }),
      goals: snap.docs.map((d) => {
        const g = d.data() || {};
        const milestones = g.milestones || [];
        const today = new Date().toISOString().slice(0, 10);
        return {
          // id потрібні, щоб було чим адресувати goal_checkin і
          // complete_milestone — без них модель могла б хіба вгадувати.
          id: d.id,
          title: g.title || "",
          status: g.status || "active",
          // Старі цілі поля не мають: вони заводились як довгострокові.
          horizon: g.horizon === "month" ? "month" : "year",
          parentGoalId: g.parentGoalId || null,
          targetDate: g.targetDate || null,
          milestones: milestones.map((m) => ({ id: m.id, title: m.title || "", done: !!m.done })),
          milestonesDone: milestones.filter((m) => m.done).length,
          milestonesTotal: milestones.length,
          targetValue: g.targetValue != null ? g.targetValue : null,
          currentValue: Number(g.currentValue) || 0,
          unit: g.unit || "",
          checkins: (g.checkins || []).length,
          checkedInToday: (g.checkins || []).includes(today),
          // Серію рахуємо тут, а не залишаємо моделі рахувати з дат:
          // від неї залежить, чи взагалі пропонувати рятунок.
          streak: goalStreak.computeStreak(g.checkins, today),
          rescue: goalStreak.rescueState(g, today),
          blockers: goalStreak.blockerStats(g),
          // Темп рахуємо тут, а не лишаємо моделі ділити дати в голові:
          // саме на ньому тримається відповідь «чи встигаю», і вона мусить
          // збігатися з тим, що людина бачить на екрані цілі.
          pace: goalReview.pace({ ...g, id: d.id }, today,
            { startIso: g.createdAt && typeof g.createdAt.toDate === "function"
              ? goalStreak.isoOf(g.createdAt.toDate()) : null }),
          weekMovement: goalReview.weekMovement({ ...g, id: d.id }, today),
          // Скільки днів ціль не переглядали. Порожньо — не переглядали жодного разу.
          daysSinceReview: goalReview.daysSinceReview(g, today),
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
    "ЗАПИСУВАТИ. 'кава 80 грн' -> add_transaction (expense, 80, category 'food'). 'запиши подзвонити мамі завтра о 18' -> add_task. 'записав тренування: жим лежачи 4 по 8 на 60' -> add_workout. Не питай уточнень, якщо сенс зрозумілий; якщо в одному повідомленні кілька справ — створи кожну окремим викликом.",
    "",
    "ТРЕНУВАННЯ. '4 по 8 на 60 кг' означає чотири однакові підходи по 8 повторень з вагою 60 — перелічи їх усі, а не один. Вправу з бібліотеки завжди передавай через libId (жим лежачи -> benchPress, присідання -> squat, станова -> deadlift і так далі): рекорди рахуються саме за ним, і без libId запис не склеїться з попередніми тренуваннями тієї ж вправи. Для планки й інших вправ з власною вагою став weight 0. Якщо людина каже 'запиши тренування' без жодної вправи — спитай, які саме вправи були.",
    "ТРЕНЕР. Про прогрес говори числами з training_analysis, а не враженнями: «жим виріс зі 101 до 114, це +13% за місяць». nextSuggestion — це та сама вага, яку застосунок уже показує людині у формі, тож не пропонуй іншу, не пояснивши, чому. Формулюй обережно: «схоже, що…», «схоже, варто…», а не «тобі потрібно» — ти бачиш цифри, але не бачиш, як людина почувається, скільки спала і що в неї в житті. Не вигадуй даних, яких у застосунку немає: сну, пульсу, калорій, техніки виконання — їх ніхто не записує, і будувати на них висновки не можна. Єдине джерело про відновлення — readinessToday, яке людина ставить сама; якщо вона в розмові каже, що розбита чи навпаки повна сил, запиши це через log_readiness, і план на сьогодні підлаштується. Якщо enough=false — так і скажи, що для висновку ще замало тренувань, і не видавай тренд за наявними двома записами. Пропуски й просідання не коментуй докірливо: просів обсяг — це привід запитати, що заважало, а не дорікнути.",
    "",
    "ТЕМП ЦІЛЕЙ. У goals_progress кожна ціль має pace — це вже порахований застосунком прогноз, той самий, що людина бачить на екрані. verdict: onTrack (у графіку), ahead (випереджає), behind (таким темпом не встигне), overdue (дедлайн минув), unknown. Якщо enough=false — історії ще замало, так і скажи, а не вигадуй прогноз; projectedDate й diffDays у цьому разі порожні. Свою арифметику з дат не вигадуй: інакше в чаті прозвучить одне, а на екрані стоятиме інше. Про відставання говори як про факт із числами («за місяць пройдено 12 з 100 км»), а не докором. Якщо ціль явно не встигає, доречно запропонувати одне з двох: зсунути дедлайн (edit_goal targetDate) або поставити на паузу — і те, й те чесніше за мовчазне накопичення провини. weekMovement каже, що зрушило за тиждень; коли moved=false, це привід спитати, що заважає, і записати через log_blocker.",
    "ГОРИЗОНТ ЦІЛЕЙ. Розділ поділений на дві вкладки: «Місяць» (що людина робить саме цього місяця) і «Рік» (куди йде загалом). У add_goal це поле horizon; за замовчуванням year. Якщо з формулювання видно масштаб — «цього місяця прочитати дві книжки» це month, «вивчити польську» це year — став його сам, не перепитуючи. Перенести ціль між вкладками можна через edit_goal horizon.",
    "ДРАБИНА ЦІЛЕЙ. Місячна ціль може служити річній (parentGoalId): рік — напрямок, місяці — кроки до нього. Коли людина заводить місячну ціль, а серед річних є та, якій ця місячна очевидно служить («цього місяця пробігти 20 км» при річній «пробігти 200 км»), — привʼязуй сам, не перепитуючи; id бери з goals_progress. Річна ціль нікому не служить, тож parentGoalId у неї завжди порожній.",
    "РЕТРОСПЕКТИВА. У goals_progress є retrospective: що закрито за останній рік, скільки кожна ціль зайняла (days), типова тривалість (medianDays), найшвидша й найдовша. Питають «що я зробив цього року», «скільки цілей закрив» — бери числа звідти, а не рахуй дати сам: те саме людина бачить на екрані у фільтрі «Завершені». Ціль, закрита до появи поля completedAt, датується останнім слідом у даних — тоді days може бути приблизним, і краще сказати «близько», ніж вдавати точність. Коли days порожній, дня заведення цілі просто немає — так і скажи, а не вигадуй тривалість. Це привід похвалити: закрита довга ціль — рідкість, і озирнутись на неї важливіше, ніж одразу питати про наступну.",
    "ПАУЗА. Коли людина каже, що зараз не до цілі — їде, хворіє, змінились обставини — це edit_goal зі status 'paused', а НЕ архів. На паузі вечірні питання про ціль вимикаються й серія не рветься, а ціль лишається живою. Архів — це для того, чого людина більше не хоче. daysSinceReview показує, скільки днів ціль не переглядали; порожньо — не переглядали жодного разу.",
    "",
    "ЦІЛІ. Вимірювану ціль задавай числом: «пробігти 10 км» -> targetValue 10, unit «км»; тоді відсоток рахується від пройденого, а не від кількості віх, і поповнюється через goal_progress. Невимірювану («вивчити польську») лишай без числа — там працюють віхи. add_goal створює довгострокову ціль — не плутай із завданням: «купити молоко» це add_task, «вивчити польську до літа» це add_goal. goal_checkin відзначає сьогоднішній день у серії, complete_milestone закриває віху. Якщо людина каже, що вчора пропустила, — подивись поле rescue: коли available true, запропонуй rescue_streak (дописує вчорашній день, доступно раз на тиждень). Коли каже, що сьогодні не вийшло, — спитай, що завадило, і запиши через log_blocker її словами. Не докоряй за пропуски: у полі blockers видно, що заважає найчастіше, і корисніше запропонувати, як це обійти. Обидва беруть id, тож спершу виклич goals_progress і візьми id звідти — вгадувати id не можна. Якщо назва цілі збігається з кількома — перепитай, з якою саме. Щоденну дію з цілі («щодня бігати по 3 км») створюй через add_task із goalId — це звичайне завдання, просто привʼязане: коли його виконають, день у серії цілі відмітиться сам, окремий goal_checkin не потрібен. Так само й з віхою: коли людина каже, що береться за конкретний крок цілі, заведи add_task із назвою віхи, її goalId і dueDate на дату віхи — на екрані цілі та сама кнопка стоїть біля кожної невиконаної віхи.",
    "",
    "ВИПРАВЛЯТИ. Помічник уміє міняти вже записане, але не вміє нічого видаляти — так і кажи, якщо просять видалити, і поясни, що це робиться в самому розділі. Перед будь-якою правкою знайди запис інструментом читання (query_transactions, list_tasks, workout_history, goals_progress, savings_summary) і візьми звідти id — вгадувати id не можна. У edit_* передавай ТІЛЬКИ ті поля, які змінюються. Виняток — exercises у edit_workout і milestones у edit_goal: там треба надіслати повний новий список, тож спершу прочитай наявний. Якщо під опис підходить кілька записів — перепитай, який саме.",
    "",
    "ЗАОЩАДЖЕННЯ. Це скарбнички, окремі від витрат: add_savings_goal створює, add_savings_entry кладе (deposit) або знімає (withdraw). Гроші, відкладені у скарбничку, — не витрата, тож add_transaction тут ні до чого. id цілі бери з savings_summary. Питають «скільки я зберіг за липень» чи «скільки поклав цього місяця» — це не загальний залишок (total), а зміна САМЕ за той місяць: передай month у savings_summary і бери число з period, а не з total.",
    "",
    "РАДИТИ. Це головне правило: спершу подивись у дані, потім говори. Порада без цифр — марна, людина і так знає, що треба менше витрачати й більше рухатись.",
    "- порада про економію -> спершу month_summary за потрібний місяць, і говори про конкретні категорії й суми;",
    "- порада про тренування -> спершу training_analysis: там уже пораховано, чи росте сила, який обсяг по групах і скільки днів кожна відпочивала;",
    "- питання про прогрес -> personal_records або goals_progress;",
    "- питання про завантаженість -> list_tasks.",
    "Якщо даних мало (наприклад, тренувань ще немає) — так і скажи, і дай загальну пораду, чесно позначивши, що вона не спирається на історію.",
    "",
    "ГРАФІКИ. Ти вмієш малювати діаграму просто в чаті інструментом render_chart: pie — частки категорій, bar — порівняти суми чи періоди, line — показати зміну в часі. Спершу візьми реальні числа іншим інструментом (month_summary, query_transactions, training_analysis, goals_progress, list_tasks), тоді передай у render_chart ТІ САМІ значення — цифр для діаграми не вигадуй, як і в тексті. НЕ пропонуй натомість зводити цифри в Excel/Google Sheets/chart.js — це вже не потрібно. Для витрат і завдань у застосунку є ще й готова вкладка «Статистика» (кругова діаграма й графік за місяцями в 'Гроші', активність за дні в 'Завдання') — можеш згадати про неї як про постійне місце для цього ж, але спершу все одно намалюй те, що попросили, прямо в чаті. Поверх діаграми додай суть словами: яка категорія найбільша, на скільки змінилось.",
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
  const lang = typeof profile.lang === "string" ? profile.lang : "uk";
  // Порожньо в профілі означає не «категорій немає», а «людина їх ще не
  // чіпала» — сторінки в цей момент показують стандартний список. Раніше тут
  // стояла заглушка з єдиним «Інше», і помічник чесно повідомляв, що більше
  // нічого не має: усі витрати з чату лягали в «Інше».
  const categoriesExpense = Array.isArray(profile.categoriesExpense) && profile.categoriesExpense.length
    ? profile.categoriesExpense
    : defaultCategoryList("expense", lang);
  const categoriesIncome = Array.isArray(profile.categoriesIncome) && profile.categoriesIncome.length
    ? profile.categoriesIncome
    : defaultCategoryList("income", lang);
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

// ---- Розбиття цілі на віхи ----
// Окремий виклик, а не інструмент чату: тут не потрібна ні розмова, ні
// доступ до даних — лише один прохід «текст цілі -> список кроків». Так
// дешевше (кілька сотень токенів замість усього системного промпта) і
// відповідь приходить у гарантованій формі.
//
// Форму гарантує ПРИМУСОВИЙ виклик інструмента (tool_choice), а не
// output_config: у версії SDK, на якій живе проєкт (0.32), структурованих
// відповідей ще немає, а примусовий інструмент працює скрізь однаково.
const BREAKDOWN_TOOL = {
  name: "propose_milestones",
  description: "Повернути віхи — послідовні перевіряються кроки до цілі.",
  input_schema: {
    type: "object",
    properties: {
      milestones: {
        type: "array",
        description: "Від 3 до 7 віх у порядку виконання",
        items: {
          type: "object",
          properties: { title: { type: "string", description: "Один крок, коротко: «Пройти перші 10 уроків»" } },
          required: ["title"],
        },
      },
      note: { type: "string", description: "Одне речення про логіку розбиття; можна лишити порожнім" },
    },
    required: ["milestones"],
  },
};

const MIN_MILESTONES = 3;
const MAX_MILESTONES = 7;

function buildBreakdownPrompt(goal, ctx) {
  const lines = [`Ціль: ${goal.title}`];
  if (goal.category) lines.push(`Категорія: ${goal.category}`);
  if (goal.why) lines.push(`Навіщо це людині: ${goal.why}`);
  if (goal.targetDate) lines.push(`Дедлайн: ${goal.targetDate} (сьогодні ${ctx.today})`);
  if (goal.targetValue) lines.push(`Числова мета: ${goal.targetValue}${goal.unit ? " " + goal.unit : ""}`);
  lines.push("", `Розклади цю ціль на ${MIN_MILESTONES}–${MAX_MILESTONES} віх.`);
  return lines.join("\n");
}

const BREAKDOWN_SYSTEM =
  "Ти допомагаєш розкласти довгострокову ціль на віхи в особистому застосунку.\n" +
  "Віха — це перевіряний рубіж, про який можна сказати «пройдено» або «ні»: «Пробігти 10 км без зупинки», " +
  "а не «Більше бігати». Віхи йдуть у порядку виконання, від найближчої до останньої, і разом покривають шлях до цілі.\n" +
  "Не вигадуй обставин, яких тобі не сказали: ні поточного рівня людини, ні її розкладу, ні бюджету. " +
  "Якщо ціль сформульована надто загально — все одно дай кроки, але найзагальніші й безпечні.\n" +
  "Дати став лише тоді, коли названо дедлайн, і лише як орієнтир у назві віхи.\n" +
  "Пиши мовою, яку задано нижче. Кожна віха — до 80 символів, без нумерації на початку.";

const LANG_NAMES_FOR_MODEL = { uk: "українською", ru: "російською", pl: "польською", en: "англійською" };

/** Витягує віхи з примусового виклику інструмента й доводить їх до того
 *  вигляду, який приймають правила Firestore і форма цілі. */
function sanitizeBreakdown(input) {
  const seen = new Set();
  const milestones = (Array.isArray(input && input.milestones) ? input.milestones : [])
    .map((m) => (typeof m === "string" ? m : (m && m.title)))
    .map((title) => (typeof title === "string" ? title.trim().replace(/^\d+[.)]\s*/, "").slice(0, 200) : ""))
    .filter((title) => {
      if (!title) return false;
      const key = title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_MILESTONES);
  const note = typeof (input && input.note) === "string" ? input.note.trim().slice(0, 300) : "";
  return { milestones, note };
}

async function handleGoalBreakdown(data, context, deps = {}) {
  const uid = context.auth && context.auth.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Потрібен вхід.");

  const title = typeof data.title === "string" ? data.title.trim().slice(0, 200) : "";
  if (!title) throw new functions.https.HttpsError("invalid-argument", "Спершу назви ціль.");

  await enforceRateLimit(uid);

  const profileSnap = await db.collection("users").doc(uid).get();
  const profile = profileSnap.data() || {};
  const lang = typeof profile.lang === "string" ? profile.lang : "uk";
  const ctx = { today: new Date().toISOString().slice(0, 10) };

  const goal = {
    title,
    category: GOAL_CATEGORIES.includes(data.category) ? data.category : "",
    why: typeof data.why === "string" ? data.why.trim().slice(0, 1000) : "",
    targetDate: typeof data.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.targetDate) ? data.targetDate : "",
    targetValue: Number.isFinite(Number(data.targetValue)) && Number(data.targetValue) > 0 ? Number(data.targetValue) : 0,
    unit: typeof data.unit === "string" ? data.unit.trim().slice(0, 20) : "",
  };

  const anthropic = deps.anthropicClient || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await anthropic.messages.create({
    // Модель — та сама, яку людина обрала для помічника: платить за неї вона,
    // тож і вибір її.
    model: modelIdFor(profile),
    max_tokens: 1024,
    system: `${BREAKDOWN_SYSTEM}\nМова відповіді: ${LANG_NAMES_FOR_MODEL[lang] || LANG_NAMES_FOR_MODEL.uk}.`,
    messages: [{ role: "user", content: buildBreakdownPrompt(goal, ctx) }],
    tools: [BREAKDOWN_TOOL],
    tool_choice: { type: "tool", name: BREAKDOWN_TOOL.name },
  });

  const call = (resp.content || []).find((b) => b.type === "tool_use" && b.name === BREAKDOWN_TOOL.name);
  const result = sanitizeBreakdown(call && call.input);
  if (result.milestones.length < MIN_MILESTONES) {
    // Порожня або куца відповідь — краще чесно сказати, ніж підсунути
    // «Крок 1, Крок 2» власного виробництва.
    throw new functions.https.HttpsError("unavailable", "Не вийшло розбити цю ціль. Спробуй сформулювати її конкретніше.");
  }
  return result;
}

// AI-функції платні за викликом (токени Anthropic), тож стеля інстансів тут
// важливіша за все. Разом із лімітом 30 повідомлень / 10 хв на юзера й
// обовʼязковою автентифікацією кількох інстансів вистачає з головою, а
// зациклений клієнт чи витік токена не зможе розкрутити рахунок на API.
const AI_MAX_INSTANCES = 5;

exports.goalBreakdown = functions
  .runWith({ secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 60, maxInstances: AI_MAX_INSTANCES })
  .https.onCall((data, context) => handleGoalBreakdown(data, context));

exports.aiChat = functions
  .runWith({ secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 60, maxInstances: AI_MAX_INSTANCES })
  .https.onCall((data, context) => handleAiChat(data, context));

// Іменовані експорти — лише для unit-тестів (functions/test/ai.test.js).
// На деплой не впливає: Cloud Functions бере на облік тільки те, що визначено
// як `exports.<name> = onCall(...)` — інші поля module.exports ігноруються.
module.exports.handleAiChat = handleAiChat;
module.exports.handleGoalBreakdown = handleGoalBreakdown;
module.exports.sanitizeBreakdown = sanitizeBreakdown;
module.exports.buildBreakdownPrompt = buildBreakdownPrompt;
module.exports.sanitizeTransactionInput = sanitizeTransactionInput;
module.exports.executeTool = executeTool;
module.exports.buildSystemPrompt = buildSystemPrompt;
module.exports.enforceRateLimit = enforceRateLimit;
module.exports.sanitizeTaskInput = sanitizeTaskInput;
module.exports.sanitizeWorkoutInput = sanitizeWorkoutInput;
module.exports.sanitizeGoalInput = sanitizeGoalInput;
module.exports.pickPatch = pickPatch;
// Для тесту, який стежить, щоб серед інструментів не завелося видалення.
module.exports.toolNames = () => tools.map((t) => t.name);
module.exports.modelIdFor = modelIdFor;
module.exports.MODELS = MODELS;
module.exports.RATE_LIMIT_MAX_MESSAGES = RATE_LIMIT_MAX_MESSAGES;
