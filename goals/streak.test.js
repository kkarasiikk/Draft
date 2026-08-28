const S = require('./streak');

// Дати беремо навколо однієї опорної: 2026-08-20 — четвер, без переходів
// на літній час поруч, тож арифметика днів нічим не ускладнена.
const TODAY = '2026-08-20';
const days = (n) => S.shift(TODAY, n);

describe('computeStreak', () => {
  test('порожній список — нуль', () => {
    expect(S.computeStreak([], TODAY)).toBe(0);
    expect(S.computeStreak(undefined, TODAY)).toBe(0);
  });

  test('рахує дні поспіль до сьогодні', () => {
    expect(S.computeStreak([days(-2), days(-1), days(0)], TODAY)).toBe(3);
  });

  // День іще не закінчився: людина може відмітитись увечері, і до того
  // моменту показувати нуль було б брехнею.
  test('грація: сьогодні ще не відмічено, але вчора було', () => {
    expect(S.computeStreak([days(-3), days(-2), days(-1)], TODAY)).toBe(3);
  });

  test('розрив і сьогодні, і вчора — серія мертва', () => {
    expect(S.computeStreak([days(-4), days(-3), days(-2)], TODAY)).toBe(0);
  });

  test('дірка всередині обриває рахунок на ній', () => {
    expect(S.computeStreak([days(-5), days(-3), days(-1), days(0)], TODAY)).toBe(2);
  });

  test('порядок у списку не має значення', () => {
    expect(S.computeStreak([days(0), days(-2), days(-1)], TODAY)).toBe(3);
  });
});

describe('rescueState', () => {
  test('вчора відмічено — рятувати нічого', () => {
    expect(S.rescueState({ checkins: [days(-1), days(0)] }, TODAY)).toBe(null);
  });

  // Рятунок зшиває порваний ланцюг, а не воскрешає давно померлий: якщо
  // перед вчорашнім теж порожньо, це просто новий початок.
  test('позавчора теж порожньо — це не рятунок, а новий старт', () => {
    expect(S.rescueState({ checkins: [days(-5), days(-4)] }, TODAY)).toBe(null);
    expect(S.rescueState({ checkins: [] }, TODAY)).toBe(null);
  });

  test('пропущено рівно вчора — пропонує врятувати саме той день', () => {
    const st = S.rescueState({ checkins: [days(-4), days(-3), days(-2)] }, TODAY);
    expect(st).toMatchObject({ day: days(-1), lost: 3, available: true, cooldownLeft: 0 });
  });

  test('сьогодні відмічено, а вчора пропущено — рятунок усе одно доречний', () => {
    const st = S.rescueState({ checkins: [days(-3), days(-2), days(0)] }, TODAY);
    expect(st).toMatchObject({ day: days(-1), lost: 2, available: true });
  });

  test('свіжий рятунок тримає паузу, поки не мине тиждень', () => {
    const goal = { checkins: [days(-4), days(-3), days(-2)], rescues: [days(-3)] };
    expect(S.rescueState(goal, TODAY)).toMatchObject({ available: false, cooldownLeft: 4 });
  });

  test('через сім днів рятунок знову доступний', () => {
    const goal = { checkins: [days(-4), days(-3), days(-2)], rescues: [days(-7)] };
    expect(S.rescueState(goal, TODAY)).toMatchObject({ available: true, cooldownLeft: 0 });
  });

  test('з кількох рятунків рахується найсвіжіший', () => {
    const goal = { checkins: [days(-4), days(-3), days(-2)], rescues: [days(-40), days(-2), days(-30)] };
    expect(S.rescueState(goal, TODAY)).toMatchObject({ available: false, cooldownLeft: 5 });
  });
});

describe('applyRescue', () => {
  test('дописує вчорашній день і зшиває серію', () => {
    const goal = { checkins: [days(-4), days(-3), days(-2)] };
    const r = S.applyRescue(goal, TODAY);
    expect(r.day).toBe(days(-1));
    expect(r.checkins).toEqual([days(-4), days(-3), days(-2), days(-1)]);
    expect(r.rescues).toEqual([days(-1)]);
    expect(r.streak).toBe(4);
  });

  test('не чіпає вихідний масив цілі', () => {
    const checkins = [days(-4), days(-3), days(-2)];
    S.applyRescue({ checkins }, TODAY);
    expect(checkins).toEqual([days(-4), days(-3), days(-2)]);
  });

  test('на паузі й без розриву не робить нічого', () => {
    expect(S.applyRescue({ checkins: [days(-4), days(-3), days(-2)], rescues: [days(-1)] }, TODAY)).toBe(null);
    expect(S.applyRescue({ checkins: [days(-1), days(0)] }, TODAY)).toBe(null);
  });

  test('історія чекінів не росте безмежно', () => {
    const long = [];
    for (let i = 500; i >= 2; i--) long.push(days(-i));
    const r = S.applyRescue({ checkins: long }, TODAY);
    expect(r.checkins.length).toBe(400);
    expect(r.checkins[r.checkins.length - 1]).toBe(days(-1));
  });
});

describe('applyCheckin', () => {
  test('дописує сьогодні й тримає порядок', () => {
    expect(S.applyCheckin({ checkins: [days(-2)] }, TODAY).checkins).toEqual([days(-2), TODAY]);
  });

  // Виконане завдання, привʼязане до цілі, теж ставить чекін — тож той
  // самий день міг би прилетіти двічі за вечір.
  test('уже відмічений день не дублюється', () => {
    expect(S.applyCheckin({ checkins: [days(-1), TODAY] }, TODAY)).toBe(null);
  });

  test('не чіпає вихідний масив', () => {
    const checkins = [days(-1)];
    S.applyCheckin({ checkins }, TODAY);
    expect(checkins).toEqual([days(-1)]);
  });

  test('історія не росте безмежно', () => {
    const long = [];
    for (let i = 500; i >= 1; i--) long.push(days(-i));
    expect(S.applyCheckin({ checkins: long }, TODAY).checkins.length).toBe(400);
  });
});

describe('applyBlocker', () => {
  test('записує причину сьогоднішнім днем', () => {
    const r = S.applyBlocker({}, 'не було часу', TODAY);
    expect(r.blockers).toEqual([{ date: TODAY, reason: 'не було часу' }]);
  });

  // Людина може передумати щодо причини, але «сьогодні не вийшло» —
  // один факт, а не два.
  test('повторна відповідь замінює сьогоднішню, не додає другу', () => {
    const goal = { blockers: [{ date: days(-1), reason: 'втома' }, { date: TODAY, reason: 'забув' }] };
    const r = S.applyBlocker(goal, 'не було часу', TODAY);
    expect(r.blockers).toEqual([
      { date: days(-1), reason: 'втома' },
      { date: TODAY, reason: 'не було часу' },
    ]);
  });

  test('порожня причина не записується', () => {
    expect(S.applyBlocker({}, '   ', TODAY)).toBe(null);
    expect(S.applyBlocker({}, null, TODAY)).toBe(null);
  });

  test('задовга причина обрізається', () => {
    const r = S.applyBlocker({}, 'я'.repeat(200), TODAY);
    expect(r.reason.length).toBe(80);
  });
});

describe('blockerStats', () => {
  test('найчастіші причини — попереду', () => {
    const goal = { blockers: [
      { date: days(-1), reason: 'втома' },
      { date: days(-2), reason: 'не було часу' },
      { date: days(-3), reason: 'не було часу' },
    ] };
    expect(S.blockerStats(goal)).toEqual([
      { reason: 'не було часу', count: 2 },
      { reason: 'втома', count: 1 },
    ]);
  });

  test('без причин — порожньо', () => {
    expect(S.blockerStats({})).toEqual([]);
  });
});

describe('eveningQueue', () => {
  const active = (extra) => Object.assign({ status: 'active', checkins: [] }, extra);

  test('питає лише про активні цілі', () => {
    const list = [active({ title: 'A' }), { status: 'done', title: 'B', checkins: [] },
      { status: 'archived', title: 'C', checkins: [] }];
    expect(S.eveningQueue(list, TODAY).map((g) => g.title)).toEqual(['A']);
  });

  test('відмічене сьогодні не питає', () => {
    const list = [active({ title: 'A', checkins: [TODAY] }), active({ title: 'B' })];
    expect(S.eveningQueue(list, TODAY).map((g) => g.title)).toEqual(['B']);
  });

  // Відповів «не вийшло» — питання на сьогодні закрите; повторювати його
  // до півночі означало б докоряти.
  test('сьогоднішня причина теж закриває питання', () => {
    const list = [active({ title: 'A', blockers: [{ date: TODAY, reason: 'втома' }] }),
      active({ title: 'B', blockers: [{ date: days(-1), reason: 'втома' }] })];
    expect(S.eveningQueue(list, TODAY).map((g) => g.title)).toEqual(['B']);
  });
});

describe('isEvening', () => {
  test('до вісімнадцятої — ще рано', () => {
    expect(S.isEvening(new Date(2026, 7, 20, 17, 59))).toBe(false);
  });
  test('з вісімнадцятої — можна підсумовувати', () => {
    expect(S.isEvening(new Date(2026, 7, 20, 18, 0))).toBe(true);
    expect(S.isEvening(new Date(2026, 7, 20, 23, 30))).toBe(true);
  });
});

describe('дати', () => {
  // `new Date('2026-08-20')` — це UTC-північ; на заході вона показує
  // 19 серпня. Тому парсимо вручну.
  test('shift не з’їжджає через пояси', () => {
    expect(S.shift('2026-03-01', -1)).toBe('2026-02-28');
    expect(S.shift('2026-12-31', 1)).toBe('2027-01-01');
  });
  test('daysBetween рахує повні доби', () => {
    expect(S.daysBetween('2026-08-13', '2026-08-20')).toBe(7);
  });
});

describe('goalsDigest: що сказати про цілі ввечері', () => {
  const goal = (title, checkins, over = {}) => ({
    title, status: 'active', checkins: checkins || [], blockers: [], ...over,
  });

  test('серія, що урветься сьогодні, — головне, що треба сказати', () => {
    const d = S.goalsDigest([
      goal('Біг', ['2026-08-23', '2026-08-24', '2026-08-25']),
      goal('Читання', ['2026-08-25']),
    ], '2026-08-26');
    expect(d.pending).toBe(2);
    // Беремо найдовшу з тих, що під загрозою: її втратити найдорожче.
    expect(d.streak).toBe(3);
    expect(d.streakTitle).toBe('Біг');
  });

  test('відмічена сьогодні ціль у чергу не потрапляє', () => {
    const d = S.goalsDigest([goal('Біг', ['2026-08-25', '2026-08-26'])], '2026-08-26');
    expect(d.pending).toBe(0);
    expect(d.streak).toBe(0);
  });

  test('названа сьогодні причина теж знімає питання', () => {
    const d = S.goalsDigest([
      goal('Біг', ['2026-08-25'], { blockers: [{ date: '2026-08-26', reason: 'Хворію' }] }),
    ], '2026-08-26');
    expect(d.pending).toBe(0);
  });

  test('завершена ціль не турбує', () => {
    const d = S.goalsDigest([goal('Біг', ['2026-08-25'], { status: 'done' })], '2026-08-26');
    expect(d.pending).toBe(0);
  });

  test('дедлайн за кілька днів попереджає, далекий — ні', () => {
    const soon = S.goalsDigest([goal('Звіт', [], { targetDate: '2026-08-28' })], '2026-08-26');
    expect(soon.deadline).toBe(2);
    expect(soon.deadlineTitle).toBe('Звіт');

    const far = S.goalsDigest([goal('Звіт', [], { targetDate: '2026-12-01' })], '2026-08-26');
    expect(far.deadline).toBeNull();
  });

  test('прострочений дедлайн — відʼємне число, і воно найважливіше', () => {
    const d = S.goalsDigest([
      goal('Звіт', [], { targetDate: '2026-08-20' }),
      goal('Курс', [], { targetDate: '2026-08-28' }),
    ], '2026-08-26');
    expect(d.deadline).toBe(-6);
    expect(d.deadlineTitle).toBe('Звіт');
  });

  test('порожній список нічого не вигадує', () => {
    expect(S.goalsDigest([], '2026-08-26')).toEqual({
      pending: 0, streak: 0, streakTitle: null, deadline: null, deadlineTitle: null,
      milestone: null,
    });
  });
});

describe('applyProgress — прогрес числової цілі', () => {
  const TODAY = '2026-08-27';

  test('додає до суми й лишає запис у журналі', () => {
    const r = S.applyProgress({ currentValue: 10, progressLog: [] }, 2.5, TODAY);
    expect(r.currentValue).toBe(12.5);
    expect(r.progressLog).toEqual([{ date: TODAY, delta: 2.5 }]);
  });

  test('додає, а не задає: людина думає «пробіг ще 2 км»', () => {
    const r = S.applyProgress({ currentValue: 40, progressLog: [{ date: '2026-01-01', delta: 40 }] }, 3, TODAY);
    expect(r.currentValue).toBe(43);
    expect(r.progressLog).toHaveLength(2);
  });

  test('відʼємне віднімає, але нижче нуля не пускає', () => {
    expect(S.applyProgress({ currentValue: 2 }, -5, TODAY).currentValue).toBe(0);
  });

  test('нуль і не-число нічого не міняють — це не прогрес', () => {
    expect(S.applyProgress({ currentValue: 1 }, 0, TODAY)).toBeNull();
    expect(S.applyProgress({ currentValue: 1 }, 'скільки', TODAY)).toBeNull();
  });

  test('дробові не накопичують хвіст із плаваючої коми', () => {
    const r = S.applyProgress({ currentValue: 0.1 }, 0.2, TODAY);
    expect(r.currentValue).toBe(0.3);
  });

  test('журнал не росте нескінченно — стеля 400 записів', () => {
    const log = Array.from({ length: 400 }, (_, i) => ({ date: '2026-01-01', delta: 1 }));
    const r = S.applyProgress({ currentValue: 400, progressLog: log }, 1, TODAY);
    expect(r.progressLog).toHaveLength(400);
    expect(r.progressLog.at(-1)).toEqual({ date: TODAY, delta: 1 });
  });

  test('вихідну ціль не чіпаємо — журнал копіюється, а не дописується на місці', () => {
    const goal = { currentValue: 1, progressLog: [] };
    S.applyProgress(goal, 5, TODAY);
    expect(goal.progressLog).toHaveLength(0);
    expect(goal.currentValue).toBe(1);
  });
});

describe('trainingGoals — куди зарахувати тренування', () => {
  const TODAY = '2026-08-27';
  const g = (over = {}) => ({
    id: 'g1', title: 'Пробігти 100 км', category: 'health', status: 'active',
    checkins: [], ...over,
  });

  test('активна ціль здоровʼя без сьогоднішньої відмітки — пропонуємо', () => {
    expect(S.trainingGoals([g()], TODAY)).toHaveLength(1);
  });

  test('ціль не про здоровʼя до тренування стосунку не має', () => {
    expect(S.trainingGoals([g({ category: 'learning' })], TODAY)).toHaveLength(0);
  });

  test('пауза й архів мовчать: про них свідомо не питають', () => {
    const list = [g({ status: 'paused' }), g({ status: 'archived' }), g({ status: 'done' })];
    expect(S.trainingGoals(list, TODAY)).toHaveLength(0);
  });

  test('уже відмічену ціль без числа вдруге не пропонуємо', () => {
    expect(S.trainingGoals([g({ checkins: [TODAY] })], TODAY)).toHaveLength(0);
  });

  test('числовій цілі є що додати навіть після відмітки — кілометри це не «був крок»', () => {
    expect(S.trainingGoals([g({ checkins: [TODAY], targetValue: 100 })], TODAY)).toHaveLength(1);
  });

  test('порожній список нікого не пропонує', () => {
    expect(S.trainingGoals([], TODAY)).toEqual([]);
    expect(S.trainingGoals(null, TODAY)).toEqual([]);
  });
});

describe('deadlineWarnDays — «ось-ось» у кожної цілі своє', () => {
  const TODAY = '2026-08-27';
  const g = (start, target) => ({
    status: 'active', targetDate: target, checkins: [], milestones: [],
    __start: start,
  });
  const opts = { startIsoOf: (x) => x.__start };

  test('коротка ціль: підлога в три дні, а не частка від двох тижнів', () => {
    // 14 днів × 0.1 = 1.4 — попереджати за півтора дня безглуздо.
    expect(S.deadlineWarnDays(g('2026-08-20', '2026-09-03'), TODAY, opts)).toBe(3);
  });

  test('ціль на квартал попереджає приблизно за тиждень-півтора', () => {
    // 92 дні × 0.1 ≈ 9.
    expect(S.deadlineWarnDays(g('2026-06-01', '2026-09-01'), TODAY, opts)).toBe(9);
  });

  test('ціль на вісім місяців — не три дні співчуття, а майже місяць', () => {
    expect(S.deadlineWarnDays(g('2026-01-01', '2026-09-01'), TODAY, opts)).toBe(24);
  });

  test('багаторічна не гуде чотири місяці — стеля 30 днів', () => {
    expect(S.deadlineWarnDays(g('2024-01-01', '2027-01-01'), TODAY, opts)).toBe(30);
  });

  test('без дедлайну попереджати нема про що', () => {
    expect(S.deadlineWarnDays(g('2026-01-01', null), TODAY, opts)).toBe(3);
  });

  test('коли початок невідомий, лишається обережна підлога', () => {
    expect(S.deadlineWarnDays(g(null, '2026-12-31'), TODAY, {})).toBe(3);
  });

  test('запасний початок — найраніша відмітка', () => {
    const goal = { status: 'active', targetDate: '2026-09-01', checkins: ['2026-06-01', '2026-07-01'] };
    expect(S.deadlineWarnDays(goal, TODAY, {})).toBe(9);
  });
});

describe('goalsDigest: поріг дедлайну масштабується', () => {
  const TODAY = '2026-08-27';
  const opts = { startIsoOf: (x) => x.start };

  test('довга ціль потрапляє у вечірній підсумок за 20 днів до кінця', () => {
    // Ціль на 8 місяців: поріг 24 дні, до дедлайну 20.
    const d = S.goalsDigest([{
      title: 'Вивчити польську', status: 'active', start: '2026-01-01',
      targetDate: '2026-09-16', checkins: [], milestones: [],
    }], TODAY, opts);
    expect(d.deadlineTitle).toBe('Вивчити польську');
    expect(d.deadline).toBe(20);
  });

  test('коротка ціль за 20 днів ще мовчить — там це не терміново', () => {
    const d = S.goalsDigest([{
      title: 'Здати звіт', status: 'active', start: '2026-08-20',
      targetDate: '2026-09-16', checkins: [], milestones: [],
    }], TODAY, opts);
    expect(d.deadline).toBeNull();
  });
});

describe('milestoneAlert — прострочена віха теж момент', () => {
  const TODAY = '2026-08-27';
  const goal = (milestones, over = {}) => ({
    title: 'Пробігти 100 км', status: 'active', checkins: [], milestones, ...over,
  });

  test('прострочена віха знаходиться, з назвою цілі', () => {
    const a = S.milestoneAlert([goal([{ id: 'm1', title: 'Перші 10 км', done: false, date: '2026-08-20' }])], TODAY);
    expect(a.title).toBe('Перші 10 км');
    expect(a.goalTitle).toBe('Пробігти 100 км');
    expect(a.days).toBe(-7);
  });

  test('віха на сьогодні теж сигнал', () => {
    const a = S.milestoneAlert([goal([{ id: 'm1', title: 'Сьогодні', done: false, date: TODAY }])], TODAY);
    expect(a.days).toBe(0);
  });

  test('віха попереду — це ще не сигнал, а шум', () => {
    expect(S.milestoneAlert([goal([{ id: 'm1', title: 'Потім', done: false, date: '2026-09-10' }])], TODAY)).toBeNull();
  });

  test('виконану віху не згадуємо', () => {
    expect(S.milestoneAlert([goal([{ id: 'm1', title: 'a', done: true, date: '2026-08-01' }])], TODAY)).toBeNull();
  });

  test('віха без дати сигналом бути не може — строку немає', () => {
    expect(S.milestoneAlert([goal([{ id: 'm1', title: 'a', done: false }])], TODAY)).toBeNull();
  });

  test('пауза й архів мовчать', () => {
    const ms = [{ id: 'm1', title: 'a', done: false, date: '2026-08-01' }];
    expect(S.milestoneAlert([goal(ms, { status: 'paused' })], TODAY)).toBeNull();
    expect(S.milestoneAlert([goal(ms, { status: 'archived' })], TODAY)).toBeNull();
  });

  test('з кількох береться найпростроченіша', () => {
    const a = S.milestoneAlert([goal([
      { id: 'm1', title: 'Пізніша', done: false, date: '2026-08-25' },
      { id: 'm2', title: 'Найдавніша', done: false, date: '2026-07-01' },
    ])], TODAY);
    expect(a.title).toBe('Найдавніша');
  });
});

describe('checkinGrid — сітка відміток', () => {
  // 2026-08-27 — четвер.
  const TODAY = '2026-08-27';
  const flat = (grid) => grid.reduce((a, w) => a.concat(w), []);

  test('тижні по рядках, сім днів у кожному', () => {
    const g = S.checkinGrid({ checkins: [] }, TODAY, 4);
    expect(g).toHaveLength(4);
    g.forEach((week) => expect(week).toHaveLength(7));
  });

  test('рядок починається з понеділка, останній містить сьогодні', () => {
    const g = S.checkinGrid({ checkins: [] }, TODAY, 4);
    expect(g[0][0].date).toBe('2026-08-03');   // понеділок за три тижні до поточного
    expect(g.at(-1).some((d) => d.today)).toBe(true);
  });

  test('сьогодні позначене рівно один раз', () => {
    const cells = flat(S.checkinGrid({ checkins: [] }, TODAY, 8));
    expect(cells.filter((c) => c.today)).toHaveLength(1);
    expect(cells.find((c) => c.today).date).toBe(TODAY);
  });

  test('відмічені дні видно, невідмічені — ні', () => {
    const cells = flat(S.checkinGrid({ checkins: ['2026-08-25', '2026-08-20'] }, TODAY, 4));
    expect(cells.find((c) => c.date === '2026-08-25').done).toBe(true);
    expect(cells.find((c) => c.date === '2026-08-24').done).toBe(false);
  });

  test('дні після сьогодні — не пропуск, а майбутнє', () => {
    const cells = flat(S.checkinGrid({ checkins: [] }, TODAY, 4));
    const sunday = cells.find((c) => c.date === '2026-08-30');
    expect(sunday.future).toBe(true);
    expect(sunday.done).toBe(false);
    // Усе до сьогодні включно майбутнім не є.
    expect(cells.filter((c) => c.future).every((c) => c.date > TODAY)).toBe(true);
  });

  test('день із названою причиною — не те саме, що мовчазний пропуск', () => {
    const cells = flat(S.checkinGrid({
      checkins: [], blockers: [{ date: '2026-08-24', reason: 'Втома' }],
    }, TODAY, 4));
    expect(cells.find((c) => c.date === '2026-08-24').blocked).toBe(true);
    expect(cells.find((c) => c.date === '2026-08-25').blocked).toBe(false);
  });

  test('відмітка важливіша за причину: якщо крок був, це не пропуск', () => {
    const cells = flat(S.checkinGrid({
      checkins: ['2026-08-24'], blockers: [{ date: '2026-08-24', reason: 'Втома' }],
    }, TODAY, 4));
    const cell = cells.find((c) => c.date === '2026-08-24');
    expect(cell.done).toBe(true);
    expect(cell.blocked).toBe(false);
  });

  test('ціль без жодної відмітки дає порожню, але цілу сітку', () => {
    const cells = flat(S.checkinGrid({}, TODAY, 8));
    expect(cells).toHaveLength(56);
    expect(cells.every((c) => !c.done)).toBe(true);
  });
});
