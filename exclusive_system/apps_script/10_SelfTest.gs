/**
 * 10_SelfTest — самопроверка: листы, именованные диапазоны, ошибки в формулах,
 * а при загруженном примере — цифры план-факта, отчёта и заполненности стратегии.
 * Результат — лист 99_САМОПРОВЕРКА (зелёный ✓ / красный ✗).
 */

const SELFTEST_SHEET = '99_САМОПРОВЕРКА';

function runSelfTest() {
  const ui = SpreadsheetApp.getUi();
  const withDoc = ui.alert('Самопроверка', 'Проверить также создание отчёта (Google Doc + PDF) по примеру? Будет создан тестовый отчёт в папке примера.', ui.ButtonSet.YES_NO) === ui.Button.YES;
  const res = selfTest_({ withDoc: withDoc });
  const bad = res.filter(r => !r[1]).length;
  ui.alert('Самопроверка', bad ? '✗ Ошибок: ' + bad + '. Подробности — лист ' + SELFTEST_SHEET + '.' : '✓ Все проверки пройдены (' + res.length + ').', ui.ButtonSet.OK);
}

function selfTest_(opts) {
  opts = opts || {};
  const out = [];
  const check = (name, ok, info) => out.push([name, !!ok, info === undefined ? '' : String(info)]);
  const ss = ss_();
  SpreadsheetApp.flush();

  try { inboxFolder_(); } catch (e) { /* проверится ниже */ }
  Object.keys(SHEET_NAMES).forEach(k => check('Лист ' + SHEET_NAMES[k], ss.getSheetByName(SHEET_NAMES[k])));
  cfgDefs_().filter(d => d.key).forEach(d => check('Настройка CFG_' + d.key, ss.getRangeByName('CFG_' + d.key), ss.getRangeByName('CFG_' + d.key) ? '' : 'если ✗ — «Установить / обновить систему»'));
  check('Задачи недели по умолчанию', ss.getRangeByName('CFG_DEFAULT_TASKS'));
  check('Триггер onEdit', ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'onEditHandler'), 'если ✗ — «Установить / обновить систему»');

  const errRe = /^#(REF|ERROR|NAME|VALUE|DIV\/0|NUM)[!?]?/;
  const scan = (sh, rows, cols) => {
    const n = Math.min(rows, sh.getMaxRows()), m = Math.min(cols, sh.getMaxColumns());
    const vals = sh.getRange(1, 1, n, m).getDisplayValues();
    const bad = [];
    vals.forEach((r, i) => r.forEach((v, j) => { if (errRe.test(v)) bad.push(colLetter_(j + 1) + (i + 1) + ' ' + v); }));
    return bad;
  };
  ['OBJ', 'TASK', 'BASE', 'CONT'].forEach(code => {
    const b = scan(sheet_(code), 300, sheetSpecs_()[code].fields.length);
    check('Нет ошибок в формулах ' + SHEET_NAMES[code], !b.length, b.slice(0, 5).join('; '));
  });
  [['DASH', 200, 26], ['REP', 120, 5], ['DICT', 60, 80]].forEach(p => {
    const b = scan(sheet_(p[0]), p[1], p[2]);
    check('Нет ошибок в формулах ' + SHEET_NAMES[p[0]], !b.length, b.slice(0, 5).join('; '));
  });
  objectTabs_().forEach(sh => {
    const b = scan(sh, sh.getMaxRows(), TAB.LAST_COL);
    check('Нет ошибок во вкладке ' + sh.getName(), !b.length, b.slice(0, 5).join('; '));
  });
  check('Недели в справочнике', dictRows_('weeks').length > 0, dictRows_('weeks').length + ' недель');
  check('Библиотека заполнена', readTable_('LIB').rows.length >= 10, readTable_('LIB').rows.length + ' записей');

  // проверки на примере
  const ex = objectById_(EXAMPLE_ID);
  if (ex) {
    const tab = findObjectTab_(ex);
    check('Пример: вкладка объекта', tab, tab ? tab.getName() : '');
    if (tab) check('Пример: стратегия заполнена на 100%', Number(tab.getRange(TAB.PCT).getValue()) === 1, tab.getRange(TAB.PCT).getDisplayValue());
    check('Пример: ссылка на вкладку и % в 01', String(ex.tab_url).indexOf('#gid=') === 0 && ex.strategy_pct !== '', ex.tab_url + ' / ' + ex.strategy_pct);
    const tasks = readTable_('TASK').rows.filter(t => t.obj_id === EXAMPLE_ID);
    const factOf = (wk, unit) => { const t = tasks.find(x => x.week === wk && x.unit === unit); return t ? t.fact_auto : 'нет задачи'; };
    check('Пример: звонков за 2026-W38 = 8 (авто)', factOf('2026-W38', 'звонков') === 8, factOf('2026-W38', 'звонков'));
    check('Пример: КП за 2026-W38 = 2 (авто)', factOf('2026-W38', 'КП') === 2, factOf('2026-W38', 'КП'));
    check('Пример: КП за 2026-W39 = 9 (авто)', factOf('2026-W39', 'КП') === 9, factOf('2026-W39', 'КП'));

    const rep = sheet_('REP');
    const keep = ['B3', 'B4'].map(a => rep.getRange(a).getValue());
    rep.getRange('B3').setValue(objLabel_(EXAMPLE_ID, ex.name));
    rep.getRange('B4').setValue(weekLabelByKey_('2026-W38'));
    SpreadsheetApp.flush();
    const v = readReportValues_();
    check('Отчёт: период 14.09.2026 – 18.09.2026', v.kv.PERIOD === '14.09.2026 – 18.09.2026', v.kv.PERIOD);
    check('Отчёт: заказчик из 01_ОБЪЕКТЫ', !!v.kv.CUSTOMER, v.kv.CUSTOMER);
    check('Отчёт: 5 пунктов в «Выполнение плана»', v.tables.PLAN_ROWS.length === 5, v.tables.PLAN_ROWS.length);
    check('Отчёт: 3 пункта в «План работы»', v.tables.NEXT_ROWS.length === 3, v.tables.NEXT_ROWS.length);
    check('Отчёт: в тексте нет контактов из обзвона', JSON.stringify(v).indexOf('+7') < 0);
    if (opts.withDoc) {
      try {
        const r = generateReport_(EXAMPLE_ID, '2026-W38', { interactive: false });
        const text = DocumentApp.openById(r.docId).getBody().getText();
        check('Отчёт: Google Doc и PDF созданы', r.pdfUrl, r.docUrl);
        check('Отчёт: в документе не осталось меток {{…}}', !/\{\{[A-Z_]+\}\}/.test(text));
        check('Отчёт: в документе «Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА»', text.indexOf('Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА') >= 0);
      } catch (e) {
        check('Отчёт: Google Doc и PDF созданы', false, e.message);
      }
    }
    restoreSel_(rep, 'B3', keep[0]);
    restoreSel_(rep, 'B4', keep[1]);
  } else {
    check('Пример не загружен — расчётные проверки пропущены', true, 'Сервис → Загрузить пример');
  }

  let sh = ss.getSheetByName(SELFTEST_SHEET);
  if (!sh) sh = ss.insertSheet(SELFTEST_SHEET);
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([['Проверка', 'Результат', 'Детали']]).setFontWeight('bold');
  sh.getRange(1, 4).setValue('Запуск: ' + fmtDate_(new Date(), 'dd.MM.yyyy HH:mm'));
  const rows = out.map(r => [r[0], r[1] ? '✓' : '✗', r[2]]);
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
  sh.getRange(2, 2, rows.length, 1).setBackgrounds(out.map(r => [r[1] ? COLORS.GREEN_BG : COLORS.RED_BG]));
  sh.setColumnWidth(1, 380); sh.setColumnWidth(2, 90); sh.setColumnWidth(3, 480);
  sh.activate();
  return out;
}
