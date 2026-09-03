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
   * Справи на сьогодні — і тільки на сьогодні. Невиконане з минулих днів
   * лишається у своєму дні: воно не стає справою на сьогодні від того, що
   * день минув, і додавати його сюди означало б показувати борг замість дня.
   */
  function tasksSummary(tasks, todayIso) {
    var open = 0;
    var done = 0;
    (tasks || []).forEach(function (task) {
      if (!task || task.dueDate !== todayIso) return;
      if (task.done) done += 1; else open += 1;
    });
    return { open: open, done: done };
  }

  /**
   * Скільки днів минуло від останнього тренування.
   *
   * Записи МАЙБУТНІМ днем сюди не рахуються: у розділі тренувань план на
   * наступний тиждень записують тими самими документами, що й зроблене, і
   * «найсвіжіший запис» ставав планом. На плитці від цього стояло «-4 дні
   * тому», а рядок стану замовкав зовсім. План — це ще не тренування, тож
   * «останнє» шукається серед сьогоднішнього й минулого.
   *
   * @returns {{daysAgo:number|null, lastDate:string|null}} null — тренувань ще не було
   */
  function workoutSummary(workouts, todayIso) {
    var last = null;
    (workouts || []).forEach(function (w) {
      if (!w || typeof w.date !== 'string') return;
      if (w.date > todayIso) return;
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
   * Одна ціль для підпису плитки — випадкова, а не «найтерміновіша».
   *
   * Плитка показує одну ціль із багатьох, і колись це була найближча за
   * дедлайном. Виходило, що з десятка цілей на очі місяцями потрапляла та
   * сама. Тепер вибір випадковий: щоразу, коли головна відкривається,
   * нагадує про іншу — саме заради цього плитка ціль і показує.
   *
   * @param {Array} goals
   * @param {number} [rnd] число [0,1) — параметром, щоб тест не залежав
   *   від Math.random
   */
  function pickGoal(goals, rnd) {
    var list = (goals || []).filter(function (g) { return g && g.title; });
    if (!list.length) return null;
    var r = typeof rnd === 'number' ? rnd : Math.random();
    var i = Math.floor(r * list.length);
    // r === 1 не буває в Math.random(), але параметром прийти може.
    if (i >= list.length) i = list.length - 1;
    if (i < 0) i = 0;
    return list[i];
  }

  /**
   * Найближче заплановане тренування — найраніше з тих, що ПІСЛЯ сьогодні.
   *
   * Запит уже звужений (`date > today`, за зростанням, один документ), але
   * вибір робиться ще раз тут: межа має триматись і тоді, коли записи
   * прийшли іншим шляхом. Те саме правило, що й у workoutSummary з
   * протилежного боку — план не тренування, а тренування не план.
   */
  function nextWorkout(workouts, todayIso) {
    var best = null;
    (workouts || []).forEach(function (w) {
      if (!w || typeof w.date !== 'string' || w.date <= todayIso) return;
      if (!best || w.date < best.date) best = w;
    });
    return best;
  }

  /**
   * Як назвати день наступного тренування: «завтра», «післязавтра» чи датою.
   *
   * Словами — лише два найближчі дні: далі вони перестають щось означати
   * («через сім днів» треба перерахувати в голові), і дата коротша.
   *
   * @returns {'tomorrow'|'dayAfter'|'date'|null} null — дата не в майбутньому
   */
  function nextDayKind(dateIso, todayIso) {
    if (typeof dateIso !== 'string' || dateIso <= todayIso) return null;
    var a = new Date(todayIso + 'T00:00:00');
    var b = new Date(dateIso + 'T00:00:00');
    var days = Math.round((b - a) / 86400000);
    if (days === 1) return 'tomorrow';
    if (days === 2) return 'dayAfter';
    return 'date';
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
   * Календарний тиждень, у якому лежить сьогодні: понеділок — неділя.
   *
   * Саме календарний, а не «останні сім днів»: це календар, і субота в ньому
   * має стояти там, де вона стоїть у місяці, а не там, куди її зсунув
   * сьогоднішній день. Через це тиждень містить і МАЙБУТНІ дні — сторінка
   * мусить прочитати завдання наперед, інакше крапки на них не буде.
   *
   * Кожен день несе свої завдання — не лише те, що вони є. Назву видно
   * коротко, як у календарі телефона: пʼять-шість літер вистачає, щоб
   * упізнати своє, а «є щось» не каже нічого.
   *
   * Невиконані йдуть першими: якщо в колонці вміщається один рядок, це має
   * бути те, що ще треба зробити, а не закреслене.
   */
  /** Скільки завдань на кожен день: { 'YYYY-MM-DD': {open, done} }. */
  function tasksByDay(tasks) {
    var byDay = {};
    (tasks || []).forEach(function (task) {
      if (!task || typeof task.dueDate !== 'string') return;
      var slot = byDay[task.dueDate] || (byDay[task.dueDate] = { open: 0, done: 0 });
      if (task.done) slot.done += 1; else slot.open += 1;
    });
    return byDay;
  }

  /** Понеділок того тижня, у якому лежить дата. */
  function mondayOf(date) {
    // getDay(): 0 — неділя. Тиждень починається з понеділка, як у календарі
    // цілей і в решті проєкту.
    var dow = (date.getDay() + 6) % 7;
    var out = new Date(date);
    out.setDate(out.getDate() - dow);
    return out;
  }

  /** Один день сітки. Спільний для тижня й місяця, щоб крапка означала те
   *  саме в обох. */
  function calendarDay(date, byDay, todayIso, monthNum) {
    var iso = isoOf(date);
    var slot = byDay[iso] || { open: 0, done: 0 };
    return {
      date: iso,
      dayNum: date.getDate(),
      today: iso === todayIso,
      past: iso < todayIso,
      open: slot.open,
      done: slot.done,
      // Назви справ звідси пішли разом із чипами в смузі тижня: під числом
      // тепер крапка, а їй досить знати, чи є щось і чи все закрито.
      hasTasks: slot.open + slot.done > 0,
      // День, де все закрито, — не те саме, що день, де ще є що робити.
      allDone: slot.done > 0 && slot.open === 0,
      // Хвіст сусіднього місяця в сітці місяця. У тижні його не буває.
      otherMonth: monthNum != null && date.getMonth() !== monthNum,
    };
  }

  function weekCalendar(tasks, todayIso) {
    var byDay = tasksByDay(tasks);
    var monday = mondayOf(new Date(todayIso + 'T00:00:00'));

    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(d.getDate() + i);
      days.push(calendarDay(d, byDay, todayIso, null));
    }
    return { from: days[0].date, to: days[6].date, days: days };
  }

  /**
   * Той самий календар, але цілим місяцем: повні тижні пн—нд, які його
   * накривають. Дні сусідніх місяців у сітці лишаються (`otherMonth`) — без
   * них перший тиждень починався б із дірки, і число стояло б не під своїм
   * днем тижня.
   *
   * Потрібен широкому екрану: там смуга з семи днів лишала півсторінки
   * порожньою, а місяць відповідає на те саме питання («на які дні щось
   * є») і заразом показує, що попереду.
   */
  function monthCalendar(tasks, todayIso) {
    var byDay = tasksByDay(tasks);
    var today = new Date(todayIso + 'T00:00:00');
    var monthNum = today.getMonth();
    var first = new Date(today.getFullYear(), monthNum, 1);
    var last = new Date(today.getFullYear(), monthNum + 1, 0);

    var cursor = mondayOf(first);
    var days = [];
    // Доки не пройшли останній день місяця й не дійшли до кінця тижня.
    while (cursor <= last || days.length % 7 !== 0) {
      days.push(calendarDay(cursor, byDay, todayIso, monthNum));
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
    return { from: days[0].date, to: days[days.length - 1].date, days: days };
  }

  var api = {
    isoOf: isoOf,
    weekDays: weekDays,
    weekCalendar: weekCalendar,
    pickGoal: pickGoal,
    nextWorkout: nextWorkout,
    nextDayKind: nextDayKind,
    monthCalendar: monthCalendar,
    workoutToday: workoutToday,
    monthStart: monthStart,
    budgetSummary: budgetSummary,
    tasksSummary: tasksSummary,
    workoutSummary: workoutSummary,
    goalsSummary: goalsSummary,
  };
  root.HomeSummary = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
