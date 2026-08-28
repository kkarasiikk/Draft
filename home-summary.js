// ---- Живі підсумки для плиток головного екрана ----
//
// Головна була просто меню з чотирьох кнопок — а це екран, з якого заходять
// щоразу. Чотири числа на ньому відповідають на питання, заради яких людина
// й відкриває розділ: скільки лишилось цього місяця, чи є справи на сьогодні,
// чи ціла серія, коли востаннє тренувався.
//
// Тут — лише арифметика над уже прочитаними даними. Самі запити робить
// home.js: кожен звужений (місяць / сьогодні / останній запис), щоб плитки не
// коштували вичитування всієї бази на кожне відкриття.
//
// Файл підключається і як <script> у браузері, і як CommonJS-модуль у Jest.
(function (root) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** Перше число місяця, до якого належить дата. */
  function monthStart(iso) {
    return String(iso || '').slice(0, 7) + '-01';
  }

  /**
   * Баланс поточного місяця: скільки прийшло, скільки пішло, що лишилось.
   * @param {Array} transactions транзакції (уже звужені до місяця)
   * @param {string} todayIso
   */
  function budgetSummary(transactions, todayIso) {
    var from = monthStart(todayIso);
    var income = 0;
    var expense = 0;
    (transactions || []).forEach(function (tx) {
      if (!tx || typeof tx.date !== 'string' || tx.date < from || tx.date > todayIso) return;
      if (tx.type === 'income') income += num(tx.amount);
      else if (tx.type === 'expense') expense += num(tx.amount);
    });
    return { income: income, expense: expense, balance: income - expense };
  }

  /**
   * Справи на сьогодні. Прострочене рахуємо окремо: воно так само вимагає
   * уваги, але це інша новина, ніж «на сьогодні заплановано три».
   */
  function tasksSummary(tasks, todayIso) {
    var open = 0;
    var done = 0;
    var overdue = 0;
    (tasks || []).forEach(function (task) {
      if (!task || typeof task.dueDate !== 'string') return;
      if (task.dueDate === todayIso) {
        if (task.done) done += 1; else open += 1;
      } else if (task.dueDate < todayIso && !task.done) {
        overdue += 1;
      }
    });
    return { open: open, done: done, overdue: overdue };
  }

  /**
   * Скільки днів минуло від останнього тренування.
   * @returns {{daysAgo:number|null, lastDate:string|null}} null — тренувань ще не було
   */
  function workoutSummary(workouts, todayIso) {
    var last = null;
    (workouts || []).forEach(function (w) {
      if (!w || typeof w.date !== 'string') return;
      if (!last || w.date > last) last = w.date;
    });
    if (!last) return { daysAgo: null, lastDate: null };
    var a = new Date(last + 'T00:00:00');
    var b = new Date(todayIso + 'T00:00:00');
    var days = Math.round((b - a) / 86400000);
    return { daysAgo: days, lastDate: last };
  }

  /**
   * Цілі: найдовша активна серія і скільки сьогодні без кроку.
   * Серію рахує GoalStreak — своя друга реалізація розійшлася б із першою.
   */
  function goalsSummary(goals, todayIso, streakApi) {
    var api = streakApi || root.GoalStreak;
    if (!api) return { pending: 0, streak: 0, active: 0 };
    var digest = api.goalsDigest(goals, todayIso);
    var active = (goals || []).filter(function (g) { return g && g.status === 'active'; }).length;

    // Найдовша серед УСІХ активних цілей, а не лише тих, що під загрозою:
    // відмічена сьогодні серія — це добра новина, її й показуємо.
    var best = 0;
    (goals || []).forEach(function (g) {
      if (!g || g.status !== 'active') return;
      var n = api.computeStreak(g.checkins, todayIso);
      if (n > best) best = n;
    });
    return { pending: digest.pending, streak: best, active: active };
  }

  /**
   * Кільце завдань: скільки з сьогоднішніх уже закрито.
   * Знаменник — усе заплановане на сьогодні, а не разом із боргами: борги
   * живуть окремим числом у підписі й не мають розбавляти сьогоднішній день.
   */
  function tasksRing(tasks, todayIso) {
    var s = tasksSummary(tasks, todayIso);
    var total = s.done + s.open;
    return {
      done: s.done,
      total: total,
      overdue: s.overdue,
      pct: total ? Math.round((s.done / total) * 100) : 0,
    };
  }

  /**
   * Тренування на сьогодні.
   *
   * Модуль тренувань дозволяє записати сесію наперед: вправи є, підходи
   * порожні. Нуль повторень усюди означає «ще не зроблено» — на цій самій
   * угоді тримається bestSet і progress.js, тож і тут рахуємо так само.
   *
   * @returns {{planned:boolean, name:string, exercises:number,
   *            setsDone:number, setsTotal:number, pct:number}|null}
   *   null — на сьогодні запису немає взагалі.
   */
  function workoutToday(workouts, todayIso) {
    var today = null;
    (workouts || []).forEach(function (w) {
      if (w && w.date === todayIso) today = w;
    });
    if (!today) return null;

    var setsDone = 0;
    var setsTotal = 0;
    (today.exercises || []).forEach(function (ex) {
      ((ex && ex.sets) || []).forEach(function (set) {
        setsTotal += 1;
        if (num(set && set.reps) > 0) setsDone += 1;
      });
    });
    return {
      planned: setsDone === 0,
      name: today.name || '',
      exercises: (today.exercises || []).length,
      setsDone: setsDone,
      setsTotal: setsTotal,
      pct: setsTotal ? Math.round((setsDone / setsTotal) * 100) : 0,
    };
  }

  /**
   * Яку ціль показати на плитці. Одну — бо плитка не список.
   *
   * Беремо найтерміновішу: серед активних ту, до дедлайну якої лишилось
   * найменше. Без дедлайну ціль не термінова за визначенням, тож такі йдуть
   * після — і серед них виграє та, у якій більший прогрес: показати майже
   * пройдений шлях корисніше, ніж щойно початий.
   */
  function featuredGoal(goals, todayIso, progressFn) {
    var active = (goals || []).filter(function (g) { return g && g.status === 'active'; });
    if (!active.length) return null;

    var pctOf = progressFn || goalPct;
    var best = null;
    active.forEach(function (g) {
      var left = typeof g.targetDate === 'string' && g.targetDate
        ? Math.round((new Date(g.targetDate + 'T00:00:00') - new Date(todayIso + 'T00:00:00')) / 86400000)
        : null;
      var cand = { goal: g, daysLeft: left, pct: pctOf(g) };
      if (!best) { best = cand; return; }
      var a = cand.daysLeft, b = best.daysLeft;
      if (a !== null && b === null) { best = cand; return; }
      if (a === null && b !== null) return;
      if (a !== null && b !== null) { if (a < b) best = cand; return; }
      if (cand.pct > best.pct) best = cand;
    });
    return best && { title: best.goal.title || '', pct: best.pct, daysLeft: best.daysLeft };
  }

  /** Прогрес цілі у відсотках — те саме правило, що й на сторінці цілей:
   *  числова мета важливіша за віхи. */
  function goalPct(goal) {
    var target = num(goal && goal.targetValue);
    if (target > 0) {
      return Math.max(0, Math.min(100, Math.round((num(goal.currentValue) / target) * 100)));
    }
    var milestones = (goal && goal.milestones) || [];
    if (!milestones.length) return 0;
    var done = milestones.filter(function (m) { return m && m.done; }).length;
    return Math.round((done / milestones.length) * 100);
  }

  /**
   * Кільце бюджету: скільки з місячного плану витрат уже витрачено.
   * null — плану немає, і вигадувати його не можна: кільце без знаменника
   * показувало б відсоток невідомо від чого.
   */
  function budgetRing(transactions, todayIso, plan) {
    var limit = num(plan);
    if (!(limit > 0)) return null;
    var sum = budgetSummary(transactions, todayIso);
    return {
      spent: sum.expense,
      plan: limit,
      left: limit - sum.expense,
      over: sum.expense > limit,
      // Понад 100% кільце не малює — повнішим за повне воно не буває, а
      // перевитрату видно і числом, і кольором.
      pct: Math.min(100, Math.round((sum.expense / limit) * 100)),
    };
  }

  /** Сім днів, що закінчуються сьогоднішнім: від найранішого до сьогодні. */
  function weekDays(todayIso, count) {
    var n = count || 7;
    var end = new Date(todayIso + 'T00:00:00');
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(end);
      d.setDate(d.getDate() - i);
      out.push(isoOf(d));
    }
    return out;
  }

  /**
   * Де за тиждень був рух, а де тиша — по всіх чотирьох розділах разом.
   *
   * Цього не показує жоден окремий модуль: бюджет знає свої операції, зал —
   * свої тренування, і ніде не видно життя цілком. А саме там і читається
   * головне: «гроші й цілі йдуть щодня, зал стоїть із понеділка».
   *
   * Рівень навмисно грубий — 0 / 1 / 2+. Це відповідь на «чи був день
   * живий», а не звіт: тонша шкала змушувала б порівнювати непорівнянне,
   * три транзакції проти трьох підходів.
   *
   * @param {{transactions?: Array, tasks?: Array, goals?: Array, workouts?: Array}} data
   * @param {string} todayIso
   * @param {{completedIso?: function}} [deps] як дістати день виконання
   *   завдання; за замовчуванням — та сама функція з tasks/stats.js, щоб
   *   другої реалізації «коли це зробили» в проєкті не завелось
   */
  function weekActivity(data, todayIso, deps) {
    var days = weekDays(todayIso, 7);
    var index = {};
    days.forEach(function (d, i) { index[d] = i; });
    var zeros = function () { return days.map(function () { return 0; }); };
    // Саме число, а не «щось не undefined»: день поза тижнем дає undefined, а
    // невиконане завдання — null, і обидва мусять просто не рахуватись.
    var bump = function (arr, iso) {
      var i = index[iso];
      if (typeof i === 'number') arr[i] += 1;
    };

    var budget = zeros();
    ((data && data.transactions) || []).forEach(function (t) {
      if (t) bump(budget, t.date);
    });

    // Ціль «рухалась» — це будь-який слід: відмітка, прогрес, закрита віха.
    // Рахуємо цілі, а не події: два кілометри й чекін в одній цілі — це один
    // рух, а не два.
    var goals = zeros();
    ((data && data.goals) || []).forEach(function (g) {
      var seen = {};
      ((g && g.checkins) || []).forEach(function (d) { seen[d] = true; });
      ((g && g.progressLog) || []).forEach(function (e) { if (e && e.date) seen[e.date] = true; });
      ((g && g.milestones) || []).forEach(function (m) {
        if (m && m.done && m.doneAt) seen[m.doneAt] = true;
      });
      Object.keys(seen).forEach(function (d) { bump(goals, d); });
    });

    var doneIso = (deps && deps.completedIso) || root.completedIso;
    var tasks = zeros();
    if (doneIso) {
      ((data && data.tasks) || []).forEach(function (task) {
        bump(tasks, doneIso(task));
      });
    }

    var workout = zeros();
    ((data && data.workouts) || []).forEach(function (w) {
      if (w) bump(workout, w.date);
    });

    var level = function (n) { return n === 0 ? 0 : (n === 1 ? 1 : 2); };
    var row = function (key, counts) {
      return { key: key, counts: counts, levels: counts.map(level) };
    };
    var rows = [row('budget', budget), row('goals', goals), row('tasks', tasks), row('workout', workout)];

    return {
      days: days,
      rows: rows,
      // Порожній тиждень — теж відповідь, але сітка з нього нічого не каже,
      // і сторінці варто знати про це, не перебираючи рядки самій.
      moved: rows.some(function (r) { return r.counts.some(function (n) { return n > 0; }); }),
    };
  }

  var api = {
    isoOf: isoOf,
    weekDays: weekDays,
    weekActivity: weekActivity,
    tasksRing: tasksRing,
    workoutToday: workoutToday,
    featuredGoal: featuredGoal,
    goalPct: goalPct,
    budgetRing: budgetRing,
    monthStart: monthStart,
    budgetSummary: budgetSummary,
    tasksSummary: tasksSummary,
    workoutSummary: workoutSummary,
    goalsSummary: goalsSummary,
  };
  root.HomeSummary = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
