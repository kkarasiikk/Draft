// ---- Експорт даних ----
// Раніше кнопка мовчки віддавала одну книгу .xlsx, і в ній був самий лише
// бюджет: цілі, завдання й тренування не експортувались зовсім. Тепер
// людина обирає, ЩО зберегти (чотири розділи) і В ЯКОМУ вигляді.
//
// Три формати — це три різні задачі, а не три кнопки заради вибору:
//   xlsx — подивитись і порахувати в Excel, один файл із вкладками;
//   csv  — закинути в будь-що інше, по файлу на розділ;
//   json — справжня резервна копія: документи як є, без втрат.
// PDF свідомо немає: таблицю на сорок стовпців у нього не покладеш, а для
// «просто подивитись» вистачає xlsx.
//
// Підписи приходять ззовні (labels) — головний екран має власні переклади,
// і другий їх набір тут розсинхронився б з першою ж правкою формулювання.
(function (root) {
  'use strict';

  var SECTION_KEYS = ['budget', 'goals', 'tasks', 'workout'];
  var FORMATS = ['xlsx', 'csv', 'json'];

  function timestampText(value) {
    if (!value) return '';
    if (typeof value.toDate === 'function') value = value.toDate();
    if (typeof value === 'string') {
      var d = new Date(value);
      return isNaN(d) ? value : d.toLocaleString();
    }
    if (value instanceof Date) return value.toLocaleString();
    return String(value);
  }

  // Нотатки зберігаються як HTML, а в таблиці потрібен звичайний текст.
  // Через DOM — надійніше (сутності, вкладені теги), але в тестах DOM
  // немає, тож там лишається грубіший запасний варіант.
  function stripHtml(html) {
    if (!html) return '';
    if (typeof document !== 'undefined' && document.createElement) {
      var div = document.createElement('div');
      div.innerHTML = html;
      return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    }
    return String(html).replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function byDate(a, b) {
    return String(a.date || '').localeCompare(String(b.date || ''));
  }

  function labelOf(list, id) {
    var found = (list || []).find(function (c) { return c.id === id; });
    return found ? found.label : (id || '');
  }

  function yesNo(L, value) {
    return value ? L.yes : L.no;
  }

  // ---- Розділи ----
  // Кожен будівник повертає масив аркушів: [{ name, rows }]. Порожній
  // розділ теж дає аркуш — інакше людина відкриє файл і вирішить, що
  // експорт зламався, хоча просто ще немає даних.

  function budgetSheets(d, L) {
    var goalNameById = {};
    (d.savingsGoals || []).forEach(function (g) { goalNameById[g.id] = g.name || L.defaultGoalName; });

    return [
      { key: 'transactions', name: L.sheetTx, rows: (d.transactions || []).slice().sort(byDate).map(function (tx) {
        var row = {};
        row[L.colDate] = tx.date || '';
        row[L.colType] = tx.type === 'income' ? L.typeIncome : L.typeExpense;
        row[L.colCategory] = labelOf(tx.type === 'income' ? d.categoriesIncome : d.categoriesExpense, tx.category);
        row[L.colAmount] = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount) || 0;
        row[L.colNote] = tx.note || '';
        return row;
      }) },
      { key: 'savings', name: L.sheetSavings, rows: (d.savings || []).slice().sort(byDate).map(function (sv) {
        var row = {};
        row[L.colDate] = sv.date || '';
        row[L.colGoal] = goalNameById[sv.goalId] || '';
        row[L.colType] = sv.type === 'withdraw' ? L.typeWithdraw : L.typeDeposit;
        row[L.colAmount] = typeof sv.amount === 'number' ? sv.amount : Number(sv.amount) || 0;
        row[L.colCurrency] = sv.currency || '';
        row[L.colNote] = sv.note || '';
        return row;
      }) },
      { key: 'savings-goals', name: L.sheetSavingsGoals, rows: (d.savingsGoals || []).map(function (g) {
        var row = {};
        row[L.colName] = g.name || L.defaultGoalName;
        row[L.colCreated] = timestampText(g.createdAt);
        return row;
      }) },
      { key: 'notes', name: L.sheetNotes, rows: (d.notes || []).map(function (p) {
        var row = {};
        row[L.colTitle] = p.title || L.noTitle;
        row[L.colContent] = stripHtml(p.content);
        row[L.colCreated] = timestampText(p.createdAt);
        row[L.colUpdated] = timestampText(p.updatedAt);
        return row;
      }) },
      { key: 'categories', name: L.sheetCats, rows: (d.categoriesExpense || []).map(function (c) {
        var row = {};
        row[L.colType] = L.typeExpense;
        row[L.colName] = c.label;
        return row;
      }).concat((d.categoriesIncome || []).map(function (c) {
        var row = {};
        row[L.colType] = L.typeIncome;
        row[L.colName] = c.label;
        return row;
      })) },
    ];
  }

  function goalsSheets(d, L) {
    return [
      { key: 'goals', name: L.sheetLifeGoals, rows: (d.goals || []).map(function (g) {
        var row = {};
        row[L.colTitle] = g.title || '';
        row[L.colCategory] = g.category || '';
        row[L.colStatus] = L['status_' + g.status] || g.status || '';
        // Дедлайн ціль отримує з місяця, а не окремим полем: у місячної це
        // кінець її місяця, у річної його немає.
        row[L.colDeadline] = g.targetDate || '';
        row[L.colCheckins] = (g.checkins || []).length;
        row[L.colWhy] = g.why || '';
        return row;
      }) },
      // Щоденник — окремим аркушем: у клітинку його не запхати, а це
      // найцінніше, що є в цілях.
      { key: 'goal-journal', name: L.sheetJournal, rows: (d.goals || []).reduce(function (acc, g) {
        (g.journal || []).forEach(function (entry) {
          var row = {};
          row[L.colGoal] = g.title || '';
          row[L.colCreated] = timestampText(entry.createdAt);
          row[L.colContent] = entry.text || '';
          acc.push(row);
        });
        return acc;
      }, []) },
    ];
  }

  function tasksSheets(d, L) {
    var goalTitleById = {};
    (d.goals || []).forEach(function (g) { goalTitleById[g.id] = g.title || ''; });

    return [
      { key: 'tasks', name: L.sheetTasks, rows: (d.tasks || []).slice().sort(function (a, b) {
        return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
      }).map(function (task) {
        var subtasks = task.subtasks || [];
        var row = {};
        row[L.colTitle] = task.title || '';
        row[L.colDone] = yesNo(L, task.done);
        row[L.colDate] = task.dueDate || '';
        row[L.colTime] = task.dueTime || '';
        row[L.colPriority] = task.priority ? (L['prio_' + task.priority] || task.priority) : '';
        row[L.colTags] = (task.tags || []).join(', ');
        row[L.colEstimate] = task.estimateMin || '';
        row[L.colRepeat] = task.recurrence ? (task.recurrence.type || '') : '';
        row[L.colGoal] = task.goalId ? (goalTitleById[task.goalId] || '') : '';
        row[L.colSubtasks] = subtasks.map(function (sub) {
          return (sub.title || '') + (sub.done ? ' ✓' : '');
        }).join('; ');
        row[L.colCompleted] = timestampText(task.completedAt);
        row[L.colNote] = task.notes || '';
        return row;
      }) },
    ];
  }

  function workoutSheets(d, L) {
    var rows = [];
    (d.workouts || []).slice().sort(byDate).forEach(function (session) {
      (session.exercises || []).forEach(function (ex) {
        var sets = (ex.sets || []).filter(function (set) { return Number(set.reps) > 0; });
        var row = {};
        row[L.colDate] = session.date || '';
        row[L.colName] = session.name || '';
        row[L.colExercise] = ex.name || ex.libId || '';
        row[L.colMuscle] = ex.muscle || '';
        row[L.colSets] = sets.length;
        // Підходи одним рядком: «80×8, 80×8, 85×5». Розкладати кожен
        // окремим рядком означало б таблицю, у якій нічого не видно.
        row[L.colDetails] = sets.map(function (set) {
          var w = Number(set.weight) || 0;
          return w ? (w + '×' + set.reps) : (set.reps + ' ×');
        }).join(', ');
        row[L.colVolume] = sets.reduce(function (sum, set) {
          return sum + (Number(set.weight) || 0) * (Number(set.reps) || 0);
        }, 0);
        row[L.colNote] = session.notes || '';
        rows.push(row);
      });
    });
    return [{ key: 'workouts', name: L.sheetWorkouts, rows: rows }];
  }

  var BUILDERS = { budget: budgetSheets, goals: goalsSheets, tasks: tasksSheets, workout: workoutSheets };

  /** Аркуші для обраних розділів, у сталому порядку. */
  function buildSheets(keys, data, L) {
    var picked = SECTION_KEYS.filter(function (k) { return (keys || []).indexOf(k) >= 0; });
    var sheets = [];
    picked.forEach(function (key) {
      BUILDERS[key](data || {}, L).forEach(function (sheet) { sheets.push(sheet); });
    });
    return sheets;
  }

  // ---- Формати ----

  /** CSV за RFC 4180: лапки подвоюються, поле в лапках, якщо містить
   *  роздільник, лапку або перенос рядка. */
  function csvCell(value) {
    if (value === null || value === undefined) return '';
    var text = String(value);
    if (/[",\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function toCsv(rows) {
    var list = rows || [];
    if (!list.length) return '';
    var headers = [];
    list.forEach(function (row) {
      Object.keys(row).forEach(function (key) {
        if (headers.indexOf(key) < 0) headers.push(key);
      });
    });
    var lines = [headers.map(csvCell).join(',')];
    list.forEach(function (row) {
      lines.push(headers.map(function (key) { return csvCell(row[key]); }).join(','));
    });
    return lines.join('\r\n');
  }

  /** Сирі документи обраних розділів — це і є справжня резервна копія:
   *  таблиця втрачає вкладеність, JSON не втрачає нічого. */
  function toJson(keys, data) {
    var d = data || {};
    var out = { exportedAt: new Date().toISOString(), sections: {} };
    if ((keys || []).indexOf('budget') >= 0) {
      out.sections.budget = {
        transactions: d.transactions || [], savings: d.savings || [],
        savingsGoals: d.savingsGoals || [], notes: d.notes || [],
        categoriesExpense: d.categoriesExpense || [], categoriesIncome: d.categoriesIncome || [],
      };
    }
    if ((keys || []).indexOf('goals') >= 0) out.sections.goals = d.goals || [];
    if ((keys || []).indexOf('tasks') >= 0) out.sections.tasks = d.tasks || [];
    if ((keys || []).indexOf('workout') >= 0) out.sections.workout = d.workouts || [];
    return out;
  }

  // Ім'я файлу: розділ у назві, щоб у теці «Завантаження» через місяць
  // було видно, що це і за коли.
  function fileBase(keys, today) {
    var picked = SECTION_KEYS.filter(function (k) { return (keys || []).indexOf(k) >= 0; });
    var what = picked.length === SECTION_KEYS.length || picked.length !== 1 ? 'life' : 'life-' + picked[0];
    return what + '-' + today;
  }

  // Ім'я CSV-файлу береться з латинського ключа аркуша, а не з його
  // перекладеної назви: Chromium мовчки втрачає кириличне ім'я в атрибуті
  // download — файл падає в теку як «download», без розширення й натяку,
  // що це. Заразом імена не міняються від зміни мови інтерфейсу.
  function slug(name) {
    return String(name || 'sheet').trim().toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sheet';
  }

  function saveBlob(text, filename, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Відкликаємо не одразу: Safari встигає почати завантаження вже після
    // того, як обробник завершився.
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /**
   * Збирає й віддає файл(и).
   * @returns { files } — скільки файлів збережено; кидає помилку, якщо
   *   формат недоступний.
   */
  function exportData(keys, format, data, L) {
    var fmt = FORMATS.indexOf(format) >= 0 ? format : 'xlsx';
    var picked = SECTION_KEYS.filter(function (k) { return (keys || []).indexOf(k) >= 0; });
    if (!picked.length) return { files: 0 };

    var today = new Date().toISOString().slice(0, 10);
    var base = fileBase(picked, today);

    if (fmt === 'json') {
      saveBlob(JSON.stringify(toJson(picked, data), null, 2), base + '.json', 'application/json');
      return { files: 1 };
    }

    var sheets = buildSheets(picked, data, L);

    if (fmt === 'csv') {
      // CSV не має вкладок — на кожен аркуш свій файл. Це чесніше, ніж
      // склеювати різні таблиці в одну й ламати будь-який імпорт.
      sheets.forEach(function (sheet) {
        // BOM — щоб Excel не показував кирилицю кракозябрами.
        saveBlob('﻿' + toCsv(sheet.rows), base + '-' + slug(sheet.key) + '.csv', 'text/csv;charset=utf-8');
      });
      return { files: sheets.length };
    }

    if (typeof XLSX === 'undefined') throw new Error('XLSX unavailable');
    var wb = XLSX.utils.book_new();
    sheets.forEach(function (sheet) {
      // 31 символ — межа Excel на назву аркуша.
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet.rows), String(sheet.name).slice(0, 31));
    });
    XLSX.writeFile(wb, base + '.xlsx');
    return { files: 1 };
  }

  var api = {
    SECTION_KEYS: SECTION_KEYS,
    FORMATS: FORMATS,
    buildSheets: buildSheets,
    toCsv: toCsv,
    toJson: toJson,
    fileBase: fileBase,
    slug: slug,
    stripHtml: stripHtml,
    timestampText: timestampText,
    exportData: exportData,
  };

  root.LifeExport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
