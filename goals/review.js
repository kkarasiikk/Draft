// ---- Темп цілі та щотижневий огляд ----
//
// Модуль називається «довгострокові цілі», а вся його механіка досі працювала
// з одним днем: серія, вечірнє «чи був крок», причини пропуску. Ціль із
// дедлайном через вісім місяців отримувала щовечора «так/ні» — і попередження
// за три дні до кінця. Між ними не було нічого: застосунок знав і дедлайн, і
// прогрес, але ніде не рахував звʼязок між ними.
//
// Тут — саме цей звʼязок:
//   pace()         чи встигаєш до дедлайну таким темпом;
//   weekMovement() що зрушило за тиждень;
//   reviewQueue()  про які цілі час спитати «ти досі цього хочеш».
//
// Ні DOM, ні Firestore — тільки чисті функції від даних і поточної дати
// (див. goals/review.test.js). Той самий модуль читає й AI-помічник: інакше
// в чаті звучала б одна оцінка темпу, а на екрані стояла інша.
(function (root) {
  'use strict';

  // Раз на тиждень. Частіше — це вже не огляд, а те саме вечірнє питання;
  // рідше — і ціль встигає протухнути непоміченою.
  var REVIEW_PERIOD_DAYS = 7;

  // Скільки днів історії треба, щоб узагалі говорити про темп. Два записи за
  // три дні — це не темп, це збіг; прогноз на них збрехав би впевненим тоном.
  var MIN_HISTORY_DAYS = 7;

  // Скільки днів мовчання роблять паузу «перервою», а не звичайним
  // пропуском. Два тижні: тиждень без кроку буває в кожної живої цілі, а от
  // три — це вже не збій ритму, це вихід із нього.
  var LAPSE_DAYS = 14;

  // Скільки днів ціль має право побути безформною. Питати одразу — це
  // допит на порозі; не питати ніколи — лишити список бажань замість цілей.
  var MEASURE_GRACE_DAYS = 7;

  // Наскільки прогрес може відставати від часу, і це ще «в графіку». Рівно
  // нуль означав би, що будь-який день відпочинку робить людину боржником.
  var BEHIND_GAP_PCT = 15;
  var AHEAD_GAP_PCT = 10;

  // Арифметика дат живе в streak.js — другої копії «що таке локальний день»
  // у проєкті бути не повинно. У браузері модуль уже в window, у Jest
  // підтягуємо через require.
  function streak() {
    var api = root.GoalStreak;
    if (!api && typeof require !== 'undefined') {
      try { api = require('./streak.js'); } catch (err) { api = null; }
    }
    return api;
  }

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function clampPct(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  /**
   * Дедлайн місячної цілі — останній день її місяця.
   *
   * Окремого поля «до якого числа» більше немає, і не тому, що дедлайн
   * перестав існувати, а тому, що для місячної цілі він і так уже сказаний:
   * «зробити в серпні» означає «до 31 серпня». Питати про це вдруге означало б
   * просити людину повторити те, що вона щойно ввела вибором місяця.
   *
   * Річна ціль місяця не має, тож і дедлайну не отримує: рік — це напрямок,
   * а не строк, і вигадувати їй 31 грудня було б припущенням, а не фактом.
   *
   * @param {string} monthKey 'YYYY-MM'
   * @returns {string|null} 'YYYY-MM-DD' або null, якщо місяць не заданий
   */
  function deadlineForMonth(monthKey) {
    if (typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
    var year = Number(monthKey.slice(0, 4));
    var month = Number(monthKey.slice(5, 7));
    if (!year || month < 1 || month > 12) return null;
    // Нульовий день наступного місяця — це останній день цього, і рахувати
    // високосні роки вручну не доводиться.
    var last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return monthKey + '-' + (last < 10 ? '0' + last : String(last));
  }

  /** Найраніший слід життя цілі в самих даних — коли createdAt не передали.
   *
   *  progressLog тут читається як спадщина: числової мети більше немає й нових
   *  записів не буває, але в цілей, заведених раніше, вони лежать — і це такі
   *  самі справжні дати життя цілі, як чекіни. Викинути їх означало б
   *  «омолодити» стару ціль на кілька місяців. Те саме нижче в latestSignal
   *  і в lapse. */
  function earliestSignal(goal) {
    var dates = [];
    ((goal && goal.progressLog) || []).forEach(function (e) {
      if (e && typeof e.date === 'string') dates.push(e.date);
    });
    ((goal && goal.checkins) || []).forEach(function (d) {
      if (typeof d === 'string') dates.push(d);
    });
    dates.sort();
    return dates.length ? dates[0] : null;
  }

  /** Найпізніший слід життя цілі — коли дати закриття в записі немає. */
  function latestSignal(goal) {
    var dates = [];
    ((goal && goal.progressLog) || []).forEach(function (e) {
      if (e && typeof e.date === 'string') dates.push(e.date);
    });
    ((goal && goal.checkins) || []).forEach(function (d) {
      if (typeof d === 'string') dates.push(d);
    });
    ((goal && goal.milestones) || []).forEach(function (m) {
      if (m && m.done && typeof m.doneAt === 'string') dates.push(m.doneAt);
    });
    dates.sort();
    return dates.length ? dates[dates.length - 1] : null;
  }

  /** Прогрес цілі у відсотках плюс сирі числа. Дзеркалить progressOf зі
   *  сторінки. Міряється віхами: числової мети в застосунку більше немає —
   *  число, якщо воно комусь потрібне, живе в самій назві цілі. */
  function progressPct(goal) {
    var milestones = (goal && goal.milestones) || [];
    if (!milestones.length) return null;
    var done = milestones.filter(function (m) { return m && m.done; }).length;
    return {
      pct: clampPct((done / milestones.length) * 100),
      done: done,
      total: milestones.length,
      remaining: milestones.length - done,
    };
  }

  /**
   * Чи встигаєш до дедлайну.
   *
   * Повертає null, коли говорити нема про що: немає дедлайну (тоді темп ні з
   * чим порівнювати), ціль уже закрита або в архіві, або в ній немає жодного
   * способу міряти прогрес.
   *
   * `verdict` навмисно окремо від чисел: сторінці треба слово, а помічнику —
   * цифри, і хай обидва беруть їх звідси, а не рахують самі.
   *
   * @param {Object} goal
   * @param {string} todayIso
   * @param {{startIso?: string}} [opts] коли ціль заведено (createdAt); без
   *   нього беремо найраніший слід у самих даних
   */
  function pace(goal, todayIso, opts) {
    if (!goal || !goal.targetDate) return null;
    if (goal.status === 'done' || goal.status === 'archived') return null;

    var S = streak();
    if (!S) return null;

    var prog = progressPct(goal);
    if (!prog) return null;

    var daysLeft = S.daysBetween(todayIso, goal.targetDate);
    var startIso = (opts && opts.startIso) || earliestSignal(goal) || todayIso;
    // Дедлайн у минулому або старт пізніше за дедлайн — ділити нема на що.
    var totalDays = Math.max(1, S.daysBetween(startIso, goal.targetDate));
    var elapsed = Math.max(0, S.daysBetween(startIso, todayIso));
    var timePct = clampPct((elapsed / totalDays) * 100);

    var out = {
      pct: prog.pct,
      timePct: timePct,
      daysLeft: daysLeft,
      overdue: daysLeft < 0,
      // «Є прогноз із конкретною датою». Такий прогноз давала лише числова
      // мета — по журналу «скільки на день»; без неї дати взяти нізвідки, тож
      // поле лишається завжди false, а висновок несе verdict.
      enough: false,
      projectedDate: null,
      diffDays: null,
      verdict: 'unknown',
    };

    // Прострочене — це вже не прогноз, а факт. Прогнозувати тут означало б
    // ховати головне за арифметикою.
    if (daysLeft < 0 && prog.pct < 100) {
      out.verdict = 'overdue';
      return out;
    }
    if (prog.pct >= 100) {
      out.verdict = 'ahead';
      return out;
    }

    // Порівнюємо частку пройденого шляху з часткою витраченого часу. Раніше
    // поруч жив другий, точніший шлях — по журналу числового прогресу, з
    // прогнозом конкретної дати. Числової мети більше немає, а з нею пішов і
    // він: лишився цей, який не потребує ЖОДНИХ додаткових даних.
    //
    // Але не з першого дня: у щойно заведеної цілі часу минуло 0%, і будь-яка
    // закрита віха читалась би як «випереджаєш графік». Це той самий поріг, що
    // й для числового темпу, — поки історії мало, застосунок мовчить.
    if (elapsed < MIN_HISTORY_DAYS) return out;

    // enough лишається false: воно означає рівно «є прогноз із датою», а
    // запасний шлях дати не дає — він порівнює частки. Висновок несе verdict.
    var gap = timePct - prog.pct;
    if (gap > BEHIND_GAP_PCT) out.verdict = 'behind';
    else if (gap < -AHEAD_GAP_PCT) out.verdict = 'ahead';
    else out.verdict = 'onTrack';
    return out;
  }

  /**
   * Що зрушило за останні `days` днів. Саме це показує екран огляду: не «як
   * справи», а перелік того, що реально сталося, — і чесне «нічого», коли
   * нічого.
   */
  function weekMovement(goal, todayIso, days) {
    var S = streak();
    if (!S) return null;
    var span = days || REVIEW_PERIOD_DAYS;
    var from = S.shift(todayIso, -(span - 1));

    var checkins = ((goal && goal.checkins) || []).filter(function (d) {
      return typeof d === 'string' && d >= from && d <= todayIso;
    }).length;

    var milestonesDone = ((goal && goal.milestones) || []).filter(function (m) {
      return m && m.done && typeof m.doneAt === 'string' && m.doneAt >= from && m.doneAt <= todayIso;
    }).length;

    // Записи щоденника мають createdAt у мілісекундах (serverTimestamp
    // усередині елемента масиву Firestore заборонений), тож день доводиться
    // діставати з Date, а не порівнювати рядки.
    var journal = ((goal && goal.journal) || []).filter(function (e) {
      if (!e || typeof e.createdAt !== 'number') return false;
      var day = S.isoOf(new Date(e.createdAt));
      return day >= from && day <= todayIso;
    }).length;

    return {
      from: from,
      checkins: checkins,
      milestonesDone: milestonesDone,
      journal: journal,
      moved: checkins > 0 || milestonesDone > 0,
    };
  }

  /** Скільки днів минуло від останнього огляду. null — не оглядали жодного разу. */
  function daysSinceReview(goal, todayIso) {
    var S = streak();
    if (!S) return null;
    var last = goal && goal.reviewedAt;
    if (typeof last !== 'string' || last.length !== 10) return null;
    return S.daysBetween(last, todayIso);
  }

  /**
   * Про які цілі час спитати. Той самий підхід, що й «розбір минулих днів» у
   * завданнях і «регулярні операції» в бюджеті: застосунок КАЖЕ, що настало,
   * але нічого не вирішує сам.
   *
   * Закриті й архівні не питаємо — там нема чого вирішувати. Паузу питаємо:
   * саме її й треба колись зняти, інакше пауза тихо стає архівом.
   */
  function reviewQueue(goals, todayIso, opts) {
    var period = (opts && opts.periodDays) || REVIEW_PERIOD_DAYS;
    return (goals || []).filter(function (g) {
      if (!g || (g.status !== 'active' && g.status !== 'paused')) return false;
      var since = daysSinceReview(g, todayIso);
      return since === null || since >= period;
    });
  }

  /**
   * Один рядок огляду: ціль, що зрушило, як із темпом. Зібрано тут, а не на
   * сторінці, щоб те саме міг показати помічник.
   */
  function reviewItem(goal, todayIso, opts) {
    return {
      id: goal && goal.id,
      title: (goal && goal.title) || '',
      why: (goal && goal.why) || '',
      status: goal && goal.status,
      movement: weekMovement(goal, todayIso, opts && opts.periodDays),
      pace: pace(goal, todayIso, opts),
    };
  }

  /** Чи є про що показувати банер, і скільки там пунктів. */
  function reviewDigest(goals, todayIso, opts) {
    var queue = reviewQueue(goals, todayIso, opts);
    var stalled = 0;
    queue.forEach(function (g) {
      var m = weekMovement(g, todayIso, opts && opts.periodDays);
      if (m && !m.moved) stalled += 1;
    });
    return { pending: queue.length, stalled: stalled };
  }

  /**
   * Місяць, до якого належить місячна ціль, як 'YYYY-MM'.
   *
   * Вкладка «Місяць» довго була просто другим списком: горизонт казав, що
   * ціль місячна, але не казав ЯКОГО місяця, тож березнева ціль лежала поруч
   * із серпневою й «цілі на місяць» означало «цілі на будь-який місяць».
   *
   * Старі документи поля не мають — беремо місяць, коли ціль завели. Це не
   * здогадка: місячну ціль заводять на той місяць, у якому заводять.
   */
  function monthKeyOf(goal, opts) {
    var m = goal && goal.month;
    if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) return m;
    var startIso = (opts && opts.startIso) || null;
    return startIso && startIso.length >= 7 ? startIso.slice(0, 7) : null;
  }

  /**
   * Цілі місяця, який зараз дивляться.
   *
   * У ПОТОЧНОМУ місяці показуємо ще й незакриті цілі з минулих: інакше
   * липнева ціль, яку не встигли, першого серпня тихо зникла б з очей — а це
   * рівно та ціль, про яку треба памʼятати найбільше. У минулих місяцях
   * такого перенесення немає: там показуємо, що було саме тоді.
   *
   * @param {Array} goals
   * @param {string} monthKey 'YYYY-MM', який дивляться
   * @param {{currentMonth?: string, startIsoOf?: function}} [opts]
   */
  function goalsOfMonth(goals, monthKey, opts) {
    var isCurrent = !!(opts && opts.currentMonth === monthKey);
    var startIsoOf = (opts && opts.startIsoOf) || function () { return null; };
    return (goals || []).filter(function (g) {
      if (!g || g.horizon !== 'month') return false;
      var m = monthKeyOf(g, { startIso: startIsoOf(g) });
      // Місяць невідомий узагалі — краще в поточному, ніж ніде.
      if (!m) return isCurrent;
      if (m === monthKey) return true;
      return isCurrent && m < monthKey && (g.status === 'active' || g.status === 'paused');
    });
  }

  /**
   * Довга перерва — і момент повернення.
   *
   * Типовий кінець довгої цілі виглядає так: тиждень руху, пропуск, провина,
   * і застосунок більше не відкривають. Різниця між тимчасовим збоєм і
   * повним крахом — у тому, чи є куди повернутись. Досі ціль після трьох
   * тижнів мовчання зустрічала обірваною серією й вердиктом «не встигаєш» —
   * тобто рівно тим, від чого й тікають.
   *
   * Рахуємо від останнього СЛІДУ будь-якого роду: відмітка, прогрес, закрита
   * віха. Слідом вважається й запис про те, що завадило: людина приходила й
   * чесно сказала «не вийшло», і це не мовчання.
   *
   * Повертає null, коли перерви немає або говорити про неї не час: ціль на
   * паузі (про неї свідомо не питають), закрита чи архівна.
   */
  function lapse(goal, todayIso, opts) {
    if (!goal || goal.status !== 'active') return null;
    var S = streak();
    if (!S) return null;

    var marks = [];
    (goal.checkins || []).forEach(function (d) {
      if (typeof d === 'string') marks.push(d);
    });
    (goal.progressLog || []).forEach(function (e) {
      if (e && typeof e.date === 'string') marks.push(e.date);
    });
    (goal.milestones || []).forEach(function (m) {
      if (m && m.done && typeof m.doneAt === 'string') marks.push(m.doneAt);
    });
    (goal.blockers || []).forEach(function (b) {
      if (b && typeof b.date === 'string') marks.push(b.date);
    });

    var last = null;
    marks.forEach(function (d) {
      if (d <= todayIso && (last === null || d > last)) last = d;
    });

    // Точка відліку — ПІЗНІШЕ з двох: останній слід і початок цілі. Початок
    // тут не лише «коли завели»: після перезапуску (restartedAt) він
    // зсувається на день повернення, а сам перезапуск — це вже дія, тож
    // мовчання від нього й рахується. Брати просто останній слід означало б,
    // що ціль, до якої людина щойно повернулась, назавжди лишається
    // покинутою через торішню відмітку.
    var startIso = (opts && opts.startIso) || null;
    var from = last;
    if (!from || (startIso && startIso > from)) from = startIso;
    if (!from) return null;

    var days = S.daysBetween(from, todayIso);
    if (days < LAPSE_DAYS) return null;
    return { days: days, lastIso: last, everMoved: last !== null };
  }

  /**
   * Ціль, у якій немає жодного способу зрозуміти, що ти дійшов.
   *
   * «Вивчити польську» без числа, без віх і без дати можна завести — і вона
   * висітиме роками, бо перевірити її нічим: progressPct поверне null, темп
   * теж, і застосунок промовчить назавжди. Це рівно та межа, що відділяє
   * список бажань від цілей.
   *
   * Мовчимо перші MEASURE_GRACE_DAYS днів: ціль має право побути безформною,
   * поки думка не вляглась. Мовчимо й про паузу — пауза саме тим і є, що про
   * ціль свідомо не питають.
   *
   * @param {Object} goal
   * @param {string} todayIso
   * @param {{startIso?: string}} [opts] день заведення цілі (createdAt)
   */
  function needsMeasure(goal, todayIso, opts) {
    if (!goal || goal.status !== 'active') return null;
    // Є число або є віхи — міряти вже є чим, питання зняте.
    if (progressPct(goal)) return null;
    var S = streak();
    if (!S) return null;
    var startIso = (opts && opts.startIso) || earliestSignal(goal);
    // Невідомо, коли ціль завели, — тоді невідомо й чи настав час питати.
    if (!startIso) return null;
    var age = S.daysBetween(startIso, todayIso);
    if (age < MEASURE_GRACE_DAYS) return null;
    return { daysOld: age, hasDeadline: !!goal.targetDate };
  }


  /**
   * Ряд накопиченого прогресу — щоб шлях було ВИДНО, а не лише названо.
   *
   * Темп уже каже «не встигаєш», але не каже, ЯКИЙ шлях був: де ривок, де три
   * тижні пусто, чи прискорився я саме зараз. Усе це вже лежить у
   * датах закритих віх — бракувало тільки того, хто складе це в лінію.
   *
   * `required` — де прогрес мав би бути, щоб устигнути рівним темпом. Це не
   * докір, а система координат: без неї сама по собі зростаюча крива нічого
   * не каже.
   *
   * Повертає null, коли малювати нема чого: менше двох різних днів у
   * історії — це не лінія, а крапка, і графік із неї збрехав би формою.
   *
   * @param {Object} goal
   * @param {string} todayIso
   * @param {{startIso?: string}} [opts] день заведення цілі (createdAt)
   */
  function progressSeries(goal, todayIso, opts) {
    var S = streak();
    if (!S) return null;
    var prog = progressPct(goal);
    if (!prog) return null;

    var startIso = (opts && opts.startIso) || earliestSignal(goal);
    var byDay = {};

    ((goal && goal.milestones) || []).forEach(function (m) {
      if (!m || !m.done || typeof m.doneAt !== 'string' || m.doneAt > todayIso) return;
      byDay[m.doneAt] = (byDay[m.doneAt] || 0) + 1;
    });

    var days = Object.keys(byDay).sort();
    if (!days.length) return null;

    // Віхи рахуються від нуля: закрита віха — це подія з датою, і нічого
    // «набраного до журналу» тут не буває.
    var baseline = 0;

    var from = startIso && startIso < days[0] ? startIso : days[0];
    var points = [{ date: from, value: baseline }];
    var running = baseline;
    days.forEach(function (d) {
      running = Math.round((running + byDay[d]) * 100) / 100;
      points.push({ date: d, value: running });
    });
    // Сьогоднішня крапка, якщо останній рух був раніше: інакше лінія
    // обривається на минулому тижні й мовчить про паузу, яка триває.
    if (points[points.length - 1].date < todayIso) {
      points.push({ date: todayIso, value: running });
    }

    // Одна крапка — це не лінія. Двічі той самий день теж: форми немає.
    var distinct = {};
    points.forEach(function (pt) { distinct[pt.date] = true; });
    if (Object.keys(distinct).length < 2) return null;

    var max = prog.total;
    var to = goal.targetDate && goal.targetDate > todayIso ? goal.targetDate : todayIso;
    if (to < points[points.length - 1].date) to = points[points.length - 1].date;

    // Лінія «щоб устигнути» має сенс лише коли є куди встигати: без дедлайну
    // рівного темпу нізвідки взяти.
    var required = null;
    if (goal.targetDate && goal.targetDate > from) {
      required = [{ date: from, value: baseline }, { date: goal.targetDate, value: max }];
    }

    return {
      from: from,
      to: to,
      max: max,
      current: running,
      points: points,
      required: required,
    };
  }

  /**
   * День, коли ціль закрили. `completedAt` пишеться при переході в 'done'
   * (setGoalStatus у goals/app.js); цілі, закриті до появи поля, дати не
   * мають — для них беремо останній слід у самих даних, і це чесніше за
   * «невідомо», бо саме тоді ціллю й займались востаннє.
   */
  function closedOn(goal) {
    if (!goal || goal.status !== 'done') return null;
    if (typeof goal.completedAt === 'string' && goal.completedAt.length === 10) {
      return goal.completedAt;
    }
    return latestSignal(goal);
  }

  /**
   * Скільки ціль прожила: від заведення до закриття.
   *
   * `days` — саме різниця в днях, без «+1 за сьогодні»: ціль, заведена і
   * закрита того самого дня, зайняла нуль днів, і хай сторінка сама вирішує,
   * як це назвати. null означає, що одного з кінців відрізка немає, — тоді
   * ціль у ретроспективі лишається, але без тривалості.
   */
  function goalSpan(goal, opts) {
    var S = streak();
    if (!S) return null;
    var doneIso = closedOn(goal);
    if (!doneIso) return null;
    var startIso = (opts && opts.startIso) || earliestSignal(goal);
    if (!startIso) return { startIso: null, doneIso: doneIso, days: null };
    // Дата закриття раніша за заведення трапляється лише на зіпсованих даних
    // (або коли startIso — це вже слід із середини шляху). Відʼємну тривалість
    // показувати нема сенсу.
    var days = Math.max(0, S.daysBetween(startIso, doneIso));
    return { startIso: startIso, doneIso: doneIso, days: days };
  }

  /**
   * Ретроспектива: що закрито за період і скільки кожна ціль зайняла.
   *
   * Сенс не в статистиці, а в озиранні назад: закрита ціль зникає зі списку,
   * і рік роботи лишається без жодного сліду на екрані. Тут — той слід.
   *
   * @param {Array} goals
   * @param {string} todayIso
   * @param {{days?: number|null, startIsoOf?: function}} [opts]
   *   days: довжина вікна; null або 0 — за весь час.
   *   startIsoOf: звідки взяти день заведення цілі (createdAt лежить у
   *     Firestore Timestamp, а модуль про Firestore нічого не знає).
   */
  function retrospective(goals, todayIso, opts) {
    var S = streak();
    if (!S) return null;
    var span = opts && opts.days;
    var from = span ? S.shift(todayIso, -(span - 1)) : null;
    var startIsoOf = (opts && opts.startIsoOf) || function () { return null; };

    var items = [];
    (goals || []).forEach(function (g) {
      var doneIso = closedOn(g);
      if (!doneIso) return;
      if (from && doneIso < from) return;
      // Дата з майбутнього — це збій годинника, а не досягнення.
      if (doneIso > todayIso) return;
      var sp = goalSpan(g, { startIso: startIsoOf(g) });
      items.push({
        id: g.id,
        title: g.title || '',
        category: g.category || '',
        horizon: g.horizon === 'month' ? 'month' : 'year',
        doneIso: doneIso,
        startIso: sp ? sp.startIso : null,
        days: sp ? sp.days : null,
        progress: progressPct(g),
      });
    });

    // Найсвіжіше зверху: ретроспективу читають від «що я щойно закрив».
    items.sort(function (a, b) {
      if (a.doneIso !== b.doneIso) return a.doneIso < b.doneIso ? 1 : -1;
      return a.title.localeCompare(b.title);
    });

    var spans = items
      .map(function (i) { return i.days; })
      .filter(function (d) { return typeof d === 'number'; })
      .sort(function (a, b) { return a - b; });

    // Медіана, а не середнє: одна ціль на два роки не має робити вигляд,
    // ніби всі інші тривали по пів року.
    var median = null;
    if (spans.length) {
      var mid = Math.floor(spans.length / 2);
      median = spans.length % 2 ? spans[mid] : Math.round((spans[mid - 1] + spans[mid]) / 2);
    }

    return {
      from: from,
      to: todayIso,
      count: items.length,
      items: items,
      medianDays: median,
      fastestDays: spans.length ? spans[0] : null,
      slowestDays: spans.length ? spans[spans.length - 1] : null,
    };
  }

  var api = {
    REVIEW_PERIOD_DAYS: REVIEW_PERIOD_DAYS,
    MIN_HISTORY_DAYS: MIN_HISTORY_DAYS,
    MEASURE_GRACE_DAYS: MEASURE_GRACE_DAYS,
    LAPSE_DAYS: LAPSE_DAYS,
    deadlineForMonth: deadlineForMonth,
    progressPct: progressPct,
    pace: pace,
    weekMovement: weekMovement,
    daysSinceReview: daysSinceReview,
    reviewQueue: reviewQueue,
    reviewItem: reviewItem,
    reviewDigest: reviewDigest,
    progressSeries: progressSeries,
    needsMeasure: needsMeasure,
    lapse: lapse,
    monthKeyOf: monthKeyOf,
    goalsOfMonth: goalsOfMonth,
    closedOn: closedOn,
    goalSpan: goalSpan,
    retrospective: retrospective,
  };

  root.GoalReview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
