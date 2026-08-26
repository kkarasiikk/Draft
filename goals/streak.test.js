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
    });
  });
});
