// ---- AI-помічник: спільний чат ----
// Тонка обгортка над Cloud Function `aiChat` (див. ai.js). Функція сама
// говорить з моделлю й сама пише в Firestore, тож усе, що вона записала,
// з'являється на екрані тим самим onSnapshot, що й будь-яка інша зміна —
// перемальовувати сторінку звідси не треба.
//
// Файл підключається на всіх п'яти сторінках, тож він не покладається ні на
// які їхні функції: власна розмітка, власний escape, власні переклади.
// Потрібні лише глобальні `firebase` і `auth`, які є скрізь.
(function () {
  'use strict';

  const HISTORY_LIMIT = 16; // стільки ж реплік, скільки бере на вхід сама функція
  const MODELS = ['haiku', 'sonnet', 'opus'];

  const T = {
    uk: {
      title: 'Помічник', open: 'AI-помічник',
      placeholder: 'Напиши або спитай…',
      empty: 'Запиши витрату, додай завдання або спитай поради — «на чому мені зекономити цього місяця?», «яке тренування зробити сьогодні?». Перед відповіддю помічник дивиться у твої дані.',
      modelLabel: 'Модель:',
      modelHint: 'Дешевша відповідає швидше, дорожча краще розбирає складені запити («запиши три завдання…») і рідше відповідає загальниками замість цифр.',
      settings: 'Налаштування помічника',
      clear: 'Очистити розмову',
      ageHint: 'Розмова сама зникає через добу — стирати вручну треба лише щоб почати спочатку раніше.',
      added: (a) => `Записано: ${a.categoryLabel} · ${a.amount} ${a.currency || ''}`.trim(),
      taskAdded: (a) => `Завдання: ${a.title}${a.dueDate ? ' · ' + a.dueDate : ''}`,
      taskDone: (a) => `Виконано: ${a.title}`,
      error: 'Не вдалося отримати відповідь. Спробуй ще раз.',
      limit: 'Забагато повідомлень поспіль. Спробуй трохи пізніше.',
      unavailable: 'Помічник ще не підключений: треба задеплоїти Cloud Functions і додати ключ Anthropic.',
    },
    ru: {
      title: 'Помощник', open: 'AI-помощник',
      placeholder: 'Напиши или спроси…',
      empty: 'Запиши расход, добавь задачу или спроси совета — «на чём сэкономить в этом месяце?», «какую тренировку сделать сегодня?». Перед ответом помощник смотрит в твои данные.',
      modelLabel: 'Модель:',
      modelHint: 'Дешёвая отвечает быстрее, дорогая лучше разбирает составные запросы («запиши три задачи…») и реже отвечает общими словами вместо цифр.',
      settings: 'Настройки помощника',
      clear: 'Очистить разговор',
      ageHint: 'Разговор сам исчезает через сутки — стирать вручную нужно лишь чтобы начать заново раньше.',
      added: (a) => `Записано: ${a.categoryLabel} · ${a.amount} ${a.currency || ''}`.trim(),
      taskAdded: (a) => `Задача: ${a.title}${a.dueDate ? ' · ' + a.dueDate : ''}`,
      taskDone: (a) => `Выполнено: ${a.title}`,
      error: 'Не удалось получить ответ. Попробуй ещё раз.',
      limit: 'Слишком много сообщений подряд. Попробуй чуть позже.',
      unavailable: 'Помощник ещё не подключён: нужно задеплоить Cloud Functions и добавить ключ Anthropic.',
    },
    pl: {
      title: 'Asystent', open: 'Asystent AI',
      placeholder: 'Napisz albo zapytaj…',
      empty: 'Zapisz wydatek, dodaj zadanie albo poproś o radę — „na czym oszczędzić w tym miesiącu?", „jaki trening dziś zrobić?". Przed odpowiedzią asystent zagląda w twoje dane.',
      modelLabel: 'Model:',
      modelHint: 'Tańszy jest szybszy, droższy lepiej rozumie złożone polecenia („zapisz trzy zadania…") i rzadziej odpowiada ogólnikami zamiast liczbami.',
      settings: 'Ustawienia asystenta',
      clear: 'Wyczyść rozmowę',
      ageHint: 'Rozmowa znika sama po dobie — ręczne czyszczenie przydaje się tylko, gdy chcesz zacząć od nowa wcześniej.',
      added: (a) => `Zapisano: ${a.categoryLabel} · ${a.amount} ${a.currency || ''}`.trim(),
      taskAdded: (a) => `Zadanie: ${a.title}${a.dueDate ? ' · ' + a.dueDate : ''}`,
      taskDone: (a) => `Zrobione: ${a.title}`,
      error: 'Nie udało się uzyskać odpowiedzi. Spróbuj ponownie.',
      limit: 'Zbyt wiele wiadomości pod rząd. Spróbuj później.',
      unavailable: 'Asystent nie jest jeszcze podłączony: trzeba wdrożyć Cloud Functions i dodać klucz Anthropic.',
    },
    en: {
      title: 'Assistant', open: 'AI assistant',
      placeholder: 'Write or ask…',
      empty: 'Log an expense, add a task, or ask for advice — "what can I cut back on this month?", "what workout should I do today?". The assistant reads your own data before answering.',
      modelLabel: 'Model:',
      modelHint: 'The cheaper one is faster; the pricier one handles compound requests better ("add three tasks…") and less often answers in generalities instead of numbers.',
      settings: 'Assistant settings',
      clear: 'Clear conversation',
      ageHint: 'The conversation clears itself after a day — wiping it by hand only helps if you want a fresh start sooner.',
      added: (a) => `Logged: ${a.categoryLabel} · ${a.amount} ${a.currency || ''}`.trim(),
      taskAdded: (a) => `Task: ${a.title}${a.dueDate ? ' · ' + a.dueDate : ''}`,
      taskDone: (a) => `Done: ${a.title}`,
      error: 'Could not get an answer. Try again.',
      limit: 'Too many messages in a row. Try again a bit later.',
      unavailable: 'The assistant is not connected yet: deploy Cloud Functions and add an Anthropic key.',
    },
  };

  function lang() {
    const l = localStorage.getItem('financeAppLang') || 'uk';
    return T[l] ? l : 'uk';
  }
  function t(key) {
    return T[lang()][key];
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let history = [];   // [{ role: 'user' | 'assistant' | 'action', text, error? }]
  let pending = false;
  let loaded = false; // історію з Firestore тягнемо один раз за сеанс
  let model = localStorage.getItem('financeAppAiModel') || 'haiku';
  let built = false;

  function el(id) { return document.getElementById(id); }

  function build() {
    if (built) return;
    const wrap = document.createElement('div');
    wrap.className = 'aic-overlay';
    wrap.id = 'aicOverlay';
    wrap.innerHTML = `
      <div class="aic-modal" role="dialog" aria-modal="true">
        <div class="aic-head">
          <div class="aic-title" id="aicTitle"></div>
          <button type="button" class="aic-icon-btn" id="aicSettingsBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button type="button" class="aic-icon-btn" id="aicClose" aria-label="×">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="aic-settings" id="aicSettings"></div>
        <div class="aic-log" id="aicLog" role="log" aria-live="polite"></div>
        <form class="aic-form" id="aicForm">
          <textarea id="aicInput" rows="1" maxlength="1000"></textarea>
          <button class="aic-send" id="aicSend" type="submit" aria-label="→">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7Z"/></svg>
          </button>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    built = true;

    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    el('aicClose').addEventListener('click', close);
    el('aicSettingsBtn').addEventListener('click', () => {
      el('aicSettings').classList.toggle('show');
      renderSettings();
    });
    el('aicForm').addEventListener('submit', (e) => { e.preventDefault(); send(); });
    el('aicInput').addEventListener('input', autoGrow);
    // Enter надсилає, Shift+Enter — новий рядок (звична поведінка чату).
    el('aicInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wrap.classList.contains('show')) close();
    });
  }

  function renderSettings() {
    const box = el('aicSettings');
    if (!box.classList.contains('show')) { box.innerHTML = ''; return; }
    box.innerHTML = `<span class="aic-settings-label">${esc(t('modelLabel'))}</span>` +
      MODELS.map((m) =>
        `<button type="button" class="aic-model${m === model ? ' selected' : ''}" data-model="${m}">${m}</button>`
      ).join('') +
      `<span class="aic-model-hint">${esc(t('modelHint'))}</span>` +
      `<button type="button" class="aic-clear" id="aicClear">${esc(t('clear'))}</button>` +
      `<span class="aic-model-hint">${esc(t('ageHint'))}</span>`;
    box.querySelectorAll('[data-model]').forEach((btn) => {
      btn.addEventListener('click', () => setModel(btn.dataset.model));
    });
    el('aicClear').addEventListener('click', clearHistory);
  }

  // Модель зберігається у профілі, бо читає її сервер; localStorage — лише
  // щоб кнопка була підсвічена одразу, не чекаючи відповіді Firestore.
  function setModel(next) {
    if (MODELS.indexOf(next) === -1) return;
    model = next;
    localStorage.setItem('financeAppAiModel', next);
    renderSettings();
    // `auth` на сторінках оголошено через const — це глобальна лексична
    // змінна, і на window її немає, тож перевіряємо саме через typeof.
    const user = typeof auth !== 'undefined' && auth.currentUser;
    if (user) {
      firebase.firestore().collection('users').doc(user.uid)
        .set({ aiModel: next }, { merge: true })
        .catch((err) => console.error('aiModel:', err));
    }
  }


  // ---- Історія розмови ----
  // Живе у Firestore, а не в пам'яті сторінки: інакше вона зникала б при
  // кожному переході між вкладками застосунку — а вкладок п'ять.
  // Порядок задає власне поле `at` (мілісекунди): serverTimestamp дав би
  // однаковий момент кільком реплікам однієї відповіді.
  //
  // Розмова живе добу. Прибирання робиться при відкритті чату, а не за
  // розкладом на сервері: побачити прострочене можна тільки відкривши чат,
  // тож саме там воно і зникає — без Cloud Function і без деплою.
  const STORE_LIMIT = 120;                    // скільки реплік читаємо за раз
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;     // розмова живе добу, далі згасає

  function messagesCol() {
    const user = typeof auth !== 'undefined' && auth.currentUser;
    if (!user || typeof firebase === 'undefined') return null;
    return firebase.firestore().collection('users').doc(user.uid).collection('aiMessages');
  }

  function persist(entry, at) {
    // Помилки — стан цієї спроби, а не частина розмови: не зберігаємо.
    if (entry.error) return;
    const col = messagesCol();
    if (!col) return;
    col.add({ role: entry.role, text: entry.text, at: at })
      .catch((err) => console.error('aiMessages:', err));
  }

  async function load() {
    if (loaded) return;
    const col = messagesCol();
    if (!col) return;
    loaded = true;
    const cutoff = Date.now() - MAX_AGE_MS;
    try {
      // Читаємо тільки те, що ще в добі. Обмеження за кількістю лишається
      // запобіжником на випадок дуже балакучого дня — за добу 120 реплік
      // набрати можна, і тягнути їх усі в пам'ять ні до чого.
      const snap = await col.where('at', '>=', cutoff)
        .orderBy('at', 'desc').limit(STORE_LIMIT).get();
      history = snap.docs.slice().reverse().map((d) => {
        const m = d.data();
        return { role: m.role, text: m.text };
      });
      render();
      expire(col, cutoff);
    } catch (err) {
      console.error('aiMessages load:', err);
      loaded = false; // наступне відкриття спробує ще раз
    }
  }

  // Прибирання прострочених — окремим запитом і без await: те, що вже не
  // показується, чекати на екрані немає сенсу. Якщо не вдалось — не біда,
  // наступне відкриття чату спробує знову.
  function expire(col, cutoff) {
    col.where('at', '<', cutoff).get()
      .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())))
      .catch((err) => console.error('aiMessages expire:', err));
  }

  async function clearHistory() {
    history = [];
    render();
    const col = messagesCol();
    if (!col) return;
    try {
      const snap = await col.get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    } catch (err) {
      console.error('aiMessages clear:', err);
    }
  }

  function actionText(a) {
    if (a.kind === 'transaction_added') return t('added')(a);
    if (a.kind === 'task_added') return t('taskAdded')(a);
    if (a.kind === 'task_completed') return t('taskDone')(a);
    return '';
  }

  function render() {
    const log = el('aicLog');
    if (!log) return;
    if (!history.length && !pending) {
      log.innerHTML = `<div class="aic-empty">${esc(t('empty'))}</div>`;
      return;
    }
    log.innerHTML = history.map((m) => {
      if (m.role === 'action') return `<div class="aic-action">✓ ${esc(m.text)}</div>`;
      const cls = m.role === 'user' ? 'user' : m.error ? 'error' : 'assistant';
      return `<div class="aic-msg ${cls}">${esc(m.text)}</div>`;
    }).join('') + (pending ? '<div class="aic-typing"><span></span><span></span><span></span></div>' : '');
    log.scrollTop = log.scrollHeight;
  }

  function autoGrow() {
    const input = el('aicInput');
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  async function send() {
    const input = el('aicInput');
    const text = input.value.trim();
    if (!text || pending) return;
    input.value = '';
    autoGrow();
    const entry = { role: 'user', text };
    history.push(entry);
    persist(entry, Date.now());
    pending = true;
    el('aicSend').disabled = true;
    render();
    try {
      // Віддаємо лише справжні репліки діалогу — без службових рядків про
      // виконані дії та без помилок — і без щойно доданого повідомлення:
      // воно йде окремим полем message.
      const past = history
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.error)
        .slice(0, -1)
        .slice(-HISTORY_LIMIT)
        .map((m) => ({ role: m.role, text: m.text }));
      const res = await firebase.functions().httpsCallable('aiChat')({ message: text, history: past });
      const data = res.data || {};
      // Спільний момент часу з кроком у мілісекунду: службові рядки про дії
      // мають лишитись перед відповіддю, у якій про них розказано.
      let at = Date.now();
      (data.actions || []).forEach((a) => {
        const label = actionText(a);
        if (!label) return;
        const done = { role: 'action', text: label };
        history.push(done);
        persist(done, at++);
      });
      const reply = { role: 'assistant', text: data.reply || '…' };
      history.push(reply);
      persist(reply, at);
    } catch (err) {
      console.error('aiChat:', err);
      // firebase-functions віддає код у форматі "functions/resource-exhausted".
      const code = err && err.code ? String(err.code).replace('functions/', '') : '';
      const msg = code === 'resource-exhausted' ? t('limit')
        : (code === 'not-found' || code === 'unimplemented' || code === 'internal') ? t('unavailable')
        : t('error');
      history.push({ role: 'assistant', text: msg, error: true });
    } finally {
      pending = false;
      el('aicSend').disabled = false;
      render();
    }
  }

  function open() {
    build();
    el('aicTitle').textContent = t('title');
    el('aicInput').placeholder = t('placeholder');
    el('aicSettingsBtn').setAttribute('aria-label', t('settings'));
    render();
    el('aicOverlay').classList.add('show');
    load();
    setTimeout(() => el('aicInput').focus(), 50);
  }

  function close() {
    if (built) el('aicOverlay').classList.remove('show');
  }

  // Кнопка може бути в шапці будь-якої сторінки — прив'язуємось, якщо вона є.
  function init() {
    const btn = document.getElementById('aiChatBtn');
    if (btn) {
      btn.addEventListener('click', open);
      btn.setAttribute('aria-label', T[lang()].open);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.openAiChat = open;
  window.aiChatSetModel = setModel;
})();
