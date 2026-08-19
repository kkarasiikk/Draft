// ---- Експорт усіх даних у .xlsx ----
// Раніше жив усередині бюджету, бо звідти читав дані «з-під руки». Тепер
// кнопка експорту стоїть на головному екрані — це резервна копія всього
// застосунку, а не однієї вкладки, — тож функція винесена окремо і приймає
// дані параметром, не заглядаючи в чужі глобальні змінні.
//
// Підписи теж приходять ззовні (labels): головний екран і бюджет мають свої
// набори перекладів, і дублювати їх тут означало б розсинхрон при першій же
// зміні формулювання.
(function (root) {
  'use strict';

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
  function stripHtml(html) {
    if (!html) return '';
    var div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function byDate(a, b) {
    return String(a.date || '').localeCompare(String(b.date || ''));
  }

  function labelOf(list, id) {
    var found = (list || []).find(function (c) { return c.id === id; });
    return found ? found.label : (id || '');
  }

  /**
   * Збирає книгу й одразу віддає файл на завантаження.
   * data — { transactions, savings, savingsGoals, notes, categoriesExpense, categoriesIncome }
   * L — словник підписів (див. виклик у home.js).
   * Повертає true, якщо файл сформовано.
   */
  function exportAllXlsx(data, L) {
    if (typeof XLSX === 'undefined') return false;
    var d = data || {};
    var wb = XLSX.utils.book_new();

    var txRows = (d.transactions || []).slice().sort(byDate).map(function (tx) {
      var row = {};
      row[L.colDate] = tx.date || '';
      row[L.colType] = tx.type === 'income' ? L.typeIncome : L.typeExpense;
      row[L.colCategory] = labelOf(tx.type === 'income' ? d.categoriesIncome : d.categoriesExpense, tx.category);
      row[L.colAmount] = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount) || 0;
      row[L.colNote] = tx.note || '';
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows), L.sheetTx);

    var goalNameById = {};
    (d.savingsGoals || []).forEach(function (g) { goalNameById[g.id] = g.name || L.defaultGoalName; });
    var savingsRows = (d.savings || []).slice().sort(byDate).map(function (sv) {
      var row = {};
      row[L.colDate] = sv.date || '';
      row[L.colGoal] = goalNameById[sv.goalId] || '';
      row[L.colType] = sv.type === 'withdraw' ? L.typeWithdraw : L.typeDeposit;
      row[L.colAmount] = typeof sv.amount === 'number' ? sv.amount : Number(sv.amount) || 0;
      row[L.colCurrency] = sv.currency || '';
      row[L.colNote] = sv.note || '';
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savingsRows), L.sheetSavings);

    var goalsRows = (d.savingsGoals || []).map(function (g) {
      var row = {};
      row[L.colName] = g.name || L.defaultGoalName;
      row[L.colCreated] = timestampText(g.createdAt);
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalsRows), L.sheetGoals);

    var notesRows = (d.notes || []).map(function (p) {
      var row = {};
      row[L.colTitle] = p.title || L.noTitle;
      row[L.colContent] = stripHtml(p.content);
      row[L.colCreated] = timestampText(p.createdAt);
      row[L.colUpdated] = timestampText(p.updatedAt);
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notesRows), L.sheetNotes);

    var catRows = (d.categoriesExpense || []).map(function (c) {
      var row = {};
      row[L.colType] = L.typeExpense;
      row[L.colName] = c.label;
      return row;
    }).concat((d.categoriesIncome || []).map(function (c) {
      var row = {};
      row[L.colType] = L.typeIncome;
      row[L.colName] = c.label;
      return row;
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), L.sheetCats);

    XLSX.writeFile(wb, 'life-backup-' + new Date().toISOString().slice(0, 10) + '.xlsx');
    return true;
  }

  root.exportAllXlsx = exportAllXlsx;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { exportAllXlsx: exportAllXlsx, stripHtml: stripHtml, timestampText: timestampText };
  }
})(typeof window !== 'undefined' ? window : globalThis);
