/**
 * 03_Setup — установка и обновление системы.
 *
 * «Установить / обновить систему» можно запускать повторно:
 *  - данные журналов (01–04, 06, 09, 10), вкладок объектов, значения настроек и справочников сохраняются;
 *  - заголовки, формулы, списки, форматирование и защита пересоздаются по схеме;
 *  - дэшборд и лист отчёта пересобираются (выбранные фильтры сохраняются).
 */

function setupSystem() {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { /* запуск из редактора Apps Script — без диалогов */ }
  if (!ui) {
    const log = [];
    runSetup_(log);
    try { ensureDrive_(); } catch (err) { log.push('Drive: ' + err.message); }
    installTriggers_();
    Logger.log('Установка завершена: ' + log.join(', '));
    return;
  }
  const ok = ui.alert(
    'Установка / обновление системы',
    'Будут созданы или обновлены все листы, формулы, выпадающие списки, папки Google Drive, шаблон отчёта и триггер.\n\n' +
    'Данные в журналах и во вкладках объектов не удаляются. Продолжить?',
    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  const log = [];
  runSetup_(log);
  let warn = '';
  try {
    ensureDrive_();
    log.push('Google Drive: папки и шаблон отчёта готовы');
  } catch (err) {
    warn = '\n\n⚠ Drive: ' + err.message + '\nПапки можно создать позже повторным запуском установки.';
  }
  try {
    installTriggers_();
    log.push('Триггер «при изменении» установлен');
  } catch (err) {
    warn += '\n\n⚠ Триггер: ' + err.message;
  }
  const tabs = objectTabs_().length;
  if (tabs) {
    try { rebuildObjectTabs_(); log.push('Вкладки объектов обновлены: ' + tabs); } catch (err) { warn += '\n\n⚠ Вкладки объектов: ' + err.message + '\nЗапустите «Сервис → Обновить все вкладки объектов».'; }
  }
  ui.alert('Готово', log.join('\n') + warn +
    (tabs ? '' :
      '\n\nДальше: внесите объекты в 01_ОБЪЕКТЫ (ID из CRM + название) — вкладка объекта создастся сама. Для примера: «Сервис → Загрузить пример (Лермонтовский)».'),
    ui.ButtonSet.OK);
}

/** Строит листы (без Drive и триггеров). */
function runSetup_(log) {
  const ss = ss_();
  ss.setSpreadsheetTimeZone(SYS.TZ);
  try { ss.setSpreadsheetLocale(SYS.LOCALE); } catch (e) { /* локаль может быть недоступна — не критично */ }
  if (ss.getName().indexOf(SYS.TITLE) < 0) ss.rename(SYS.TITLE);
  dictLayout_.cache = null;
  sheetSpecs_.cache = null;

  SHEET_ORDER.forEach(code => ensureSheet_(code));
  buildSettings_(); log.push(SHEET_NAMES.CFG);
  buildDict_(); log.push(SHEET_NAMES.DICT);
  ['OBJ', 'TASK', 'BASE', 'CONT', 'LIB', 'HIST', 'ARCH'].forEach(code => { buildDataSheet_(code); log.push(SHEET_NAMES[code]); });
  SpreadsheetApp.flush();
  seedLibrary_();
  buildReportSheet_(); log.push(SHEET_NAMES.REP);
  buildDash_(); log.push(SHEET_NAMES.DASH);
  orderSheets_();
  removeDefaultSheet_();
  SpreadsheetApp.flush();
}

function ensureSheet_(code) {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_NAMES[code]);
  if (!sh) sh = ss.insertSheet(SHEET_NAMES[code]);
  sh.setTabColor(TAB_COLORS[code]);
  return sh;
}

/** Порядок: 00_ДЭШБОРД, 01_ОБЪЕКТЫ, вкладки объектов, затем журналы и служебные листы. */
function orderSheets_() {
  const ss = ss_();
  const order = [ss.getSheetByName(SHEET_NAMES.DASH), ss.getSheetByName(SHEET_NAMES.OBJ)]
    .concat(objectTabs_())
    .concat(SHEET_ORDER.slice(2).map(code => ss.getSheetByName(SHEET_NAMES[code])));
  order.forEach((sh, i) => {
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  ss.setActiveSheet(ss.getSheetByName(SHEET_NAMES.DASH));
}

function removeDefaultSheet_() {
  const ss = ss_();
  const ours = Object.keys(SHEET_NAMES).map(k => SHEET_NAMES[k]);
  ss.getSheets().forEach(sh => {
    if (ours.indexOf(sh.getName()) < 0 && !isObjectTab_(sh) && sh.getLastRow() === 0 && sh.getLastColumn() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
}

function ensureSize_(sh, rows, cols) {
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
}

function removeSysProtections_(sh) {
  [SpreadsheetApp.ProtectionType.RANGE, SpreadsheetApp.ProtectionType.SHEET].forEach(t => {
    sh.getProtections(t).forEach(p => {
      if ((p.getDescription() || '').indexOf(SYS.PROTECT_PREFIX) === 0) p.remove();
    });
  });
}

function protectWarn_(range, what) {
  range.protect().setDescription(SYS.PROTECT_PREFIX + what).setWarningOnly(true);
}

// ───────────────────────── 08_НАСТРОЙКИ ─────────────────────────

const CFG_TASKS_COL = 6;   // F: задачи недели по умолчанию (Блок, Задача, Единица, План)
const CFG_TASKS_ROWS = 15;

function buildSettings_() {
  const sh = sheet_('CFG');
  const existing = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(1, 1, sh.getLastRow(), 3).getValues().forEach(r => { if (r[0]) existing[r[0]] = r[2]; });
  }
  let tasksExisting = [];
  if (sh.getLastRow() > 1 && sh.getMaxColumns() >= CFG_TASKS_COL + 3 && sh.getRange(1, CFG_TASKS_COL).getValue() === 'Блок стратегии') {
    tasksExisting = sh.getRange(2, CFG_TASKS_COL, CFG_TASKS_ROWS, 4).getValues().filter(r => r[1] !== '');
  }
  removeSysProtections_(sh);
  sh.clear();
  sh.clearConditionalFormatRules();
  ensureSize_(sh, 60, CFG_TASKS_COL + 4);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();

  const defs = cfgDefs_();
  const rows = [['Ключ', 'Параметр', 'Значение', 'Описание']];
  defs.forEach(d => {
    if (d.group) { rows.push(['', d.group, '', '']); return; }
    let v = (d.key in existing && existing[d.key] !== '' && d.key !== 'SYSTEM_VERSION') ? existing[d.key] : d.value;
    if (d.date && typeof v === 'string' && v) v = new Date(v + 'T00:00:00');
    rows.push([d.key, d.label, v, d.sys ? 'заполняет скрипт' : '']);
  });
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  styleHeaderRow_(sh.getRange(1, 1, 1, 4), 'input');
  let r = 2;
  defs.forEach(d => {
    if (d.group) {
      sh.getRange(r, 1, 1, 4).setBackground(COLORS.SUBHEADER_BG).setFontWeight('bold');
    } else {
      const cell = sh.getRange(r, 3);
      ss_().setNamedRange('CFG_' + d.key, cell);
      if (d.fmt) cell.setNumberFormat(d.fmt);
      if (d.sys) sh.getRange(r, 1, 1, 4).setFontColor(COLORS.GREY_FG);
      else cell.setBackground(COLORS.SELECT_BG).setWrap(true);
    }
    r++;
  });
  sh.getRange(1, 1, r, 1).setFontColor(COLORS.GREY_FG).setFontSize(9);
  sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 360); sh.setColumnWidth(3, 260); sh.setColumnWidth(4, 120);

  // задачи недели по умолчанию («Создать план недели»)
  const c = CFG_TASKS_COL;
  sh.getRange(1, c, 1, 4).setValues([['Блок стратегии', 'Задача недели по умолчанию', 'Единица', 'План на объект']]);
  styleHeaderRow_(sh.getRange(1, c, 1, 4), 'input');
  const tasks = tasksExisting.length ? tasksExisting : DEFAULT_WEEK_TASKS;
  sh.getRange(2, c, tasks.length, 4).setValues(tasks);
  const DV = SpreadsheetApp.newDataValidation;
  sh.getRange(2, c, CFG_TASKS_ROWS, 1).setDataValidation(DV().requireValueInRange(rangeFromToken_('D.task_blocks'), true).build());
  sh.getRange(2, c + 2, CFG_TASKS_ROWS, 1).setDataValidation(DV().requireValueInRange(rangeFromToken_('D.units'), true).build());
  sh.getRange(2, c, CFG_TASKS_ROWS, 4).setBackground(COLORS.SELECT_BG);
  ss_().setNamedRange('CFG_DEFAULT_TASKS', sh.getRange(2, c, CFG_TASKS_ROWS, 4));
  sh.getRange(1, c).setNote('Эти задачи «Создать план недели» ставит каждому объекту в работе. Факт по звонкам / КП / ответам / публикациям считается сам.');
  sh.setColumnWidth(c - 1, 24); sh.setColumnWidth(c, 160); sh.setColumnWidth(c + 1, 260); sh.setColumnWidth(c + 2, 110); sh.setColumnWidth(c + 3, 110);
  sh.setFrozenRows(1);
  sh.hideColumns(1);
}

// ───────────────────────── 07_СПРАВОЧНИКИ ─────────────────────────

function buildDict_() {
  const sh = sheet_('DICT');
  const L = dictLayout_();
  const defs = dictDefs_();
  const lastCol = Math.max.apply(null, defs.map(d => L[d.key].col + d.cols.length));
  ensureSize_(sh, 1000, lastCol); // недели: ~52 строки в год
  removeSysProtections_(sh);
  const gen = dictGeneratedFormulas_();
  defs.forEach(d => {
    const c = L[d.key].col;
    const hdr = sh.getRange(1, c, 1, d.cols.length);
    const current = hdr.getValues()[0];
    hdr.setValues([d.cols]);
    if (d.generated) {
      sh.getRange(2, c, sh.getMaxRows() - 1, d.cols.length).clearContent();
      sh.getRange(2, c).setFormula(toLocaleF_(resolveF_(gen[d.key])));
      styleHeaderRow_(hdr, 'formula');
      sh.getRange(2, c, sh.getMaxRows() - 1, d.cols.length).setBackground(COLORS.FORMULA_CELL_BG);
      protectWarn_(sh.getRange(1, c, sh.getMaxRows(), d.cols.length), 'Вычисляемый список ' + d.cols[0]);
      if (d.key === 'weeks') {
        sh.getRange(2, c + 1, sh.getMaxRows() - 1, 2).setNumberFormat('dd.mm.yyyy');
      }
    } else {
      const firstVal = sh.getRange(2, c).getValue();
      if (current[0] !== d.cols[0] || firstVal === '') {
        sh.getRange(2, c, d.values.length, d.cols.length).setValues(d.values);
      }
      styleHeaderRow_(hdr, 'input');
      if (d.cols.length > 1) sh.getRange(1, c + 1, 1, d.cols.length - 1).setBackground(COLORS.HDR_FORMULA_BG).setFontColor(COLORS.HDR_FORMULA_FG);
    }
    for (let i = 0; i < d.cols.length; i++) sh.setColumnWidth(c + i, d.generated && d.key !== 'weeks' ? 190 : 150);
  });
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, lastCol).setWrap(true);
  sh.setRowHeight(1, 40);
  const note = 'Значения можно добавлять и переименовывать. Столбец «Класс» — системный смысл значения (OPEN/DONE/…): его не меняйте, по нему считаются формулы.';
  sh.getRange(1, 1).setNote(note);
}

// ───────────────────────── листы-журналы ─────────────────────────

function buildDataSheet_(code) {
  const spec = sheetSpecs_()[code];
  const sh = sheet_(code);
  const n = spec.fields.length;
  ensureSize_(sh, SYS.DATA_ROWS, n);
  checkHeaders_(sh, spec);
  removeSysProtections_(sh);
  const maxRows = sh.getMaxRows();

  // заголовки: значения + формулы одним вызовом
  sh.getRange(1, 1, 1, n).setValues([spec.fields.map(f => f.kind === 'f' ? '' : f.title)]);
  spec.fields.forEach((f, i) => { if (f.kind === 'f') sh.getRange(1, i + 1).setFormula(toLocaleF_(headerFormula_(spec, f))); });
  const bg = [], fg = [], notes = [];
  spec.fields.forEach(f => {
    const kind = f.kind === 'f' ? (f.helper ? 'helper' : 'formula') : (f.kind === 'sys' || f.kind === 'id') ? (f.helper ? 'helper' : 'auto') : 'input';
    const c = headerColors_(kind);
    bg.push(c[0]); fg.push(c[1]);
    notes.push(fieldNote_(f));
  });
  sh.getRange(1, 1, 1, n).setBackgrounds([bg]).setFontColors([fg]).setNotes([notes])
    .setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
  sh.setRowHeight(1, 48);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(spec.frozenCols || 1);

  spec.fields.forEach((f, i) => {
    const col = i + 1;
    const body = sh.getRange(2, col, maxRows - 1, 1);
    sh.setColumnWidth(col, f.w || (f.kind === 'cb' ? 90 : 115));
    const fmt = f.fmt || ({ date: 'date', money: 'money' })[f.kind];
    if (fmt) body.setNumberFormat(nf_(fmt));
    else if (f.kind === 'text' || f.kind === 'link') body.setNumberFormat('@');
    body.clearDataValidations();
    const v = validationFor_(f);
    if (v) body.setDataValidation(v);
    if (f.kind === 'f') {
      body.setBackground(COLORS.FORMULA_CELL_BG);
      protectWarn_(sh.getRange(1, col, maxRows, 1), 'Формула «' + f.title + '» — считается автоматически');
    } else if (f.kind === 'id') {
      protectWarn_(sh.getRange(2, col, maxRows - 1, 1), 'ID ставит скрипт — не менять');
    }
    if (f.kind === 'text') body.setWrap(false);
  });
  sh.showColumns(1, n);
  spec.fields.forEach((f, i) => { if (f.helper) sh.hideColumns(i + 1); });
  if (spec.readonly) protectWarn_(sh.getRange(1, 1, maxRows, n), 'Журнал заполняет скрипт');
  applyDataCF_(code, sh);
  if (!sh.getFilter()) sh.getRange(1, 1, maxRows, n).createFilter();
}

function checkHeaders_(sh, spec) {
  if (sh.getLastRow() < 1) return;
  const cur = sh.getRange(1, 1, 1, spec.fields.length).getDisplayValues()[0];
  const bad = [];
  spec.fields.forEach((f, i) => {
    if (f.kind === 'f') return;
    if (cur[i] !== '' && cur[i] !== f.title) bad.push(colLetter_(i + 1) + ': «' + cur[i] + '» вместо «' + f.title + '»');
  });
  if (bad.length) {
    throw new Error('Лист ' + spec.name + ': столбцы переставлены или переименованы вручную. Верните порядок столбцов:\n' + bad.slice(0, 5).join('\n'));
  }
}

function fieldNote_(f) {
  const how = {
    id: 'Заполняет скрипт автоматически.', sys: 'Заполняет скрипт автоматически.', f: 'Считается формулой автоматически — не вводить вручную.',
    dd: 'Выбор из списка.', cb: 'Галочка.', date: 'Дата (двойной клик — календарь).', num: 'Число.', money: 'Сумма, ₽.',
    text: 'Вводится вручную.', link: 'Ссылка, вводится вручную.',
  }[f.kind];
  const flags = [];
  if (f.client) flags.push('может попасть в отчёт клиенту');
  if (f.internal) flags.push('ВНУТРЕННЕЕ — клиенту не показывается');
  if (f.track) flags.push('изменения пишутся в 09_ИСТОРИЯ');
  return [how, f.d || '', flags.length ? '(' + flags.join('; ') + ')' : ''].filter(Boolean).join('\n');
}

function headerColors_(kind) {
  return {
    input: [COLORS.HDR_INPUT_BG, COLORS.HDR_INPUT_FG],
    formula: [COLORS.HDR_FORMULA_BG, COLORS.HDR_FORMULA_FG],
    auto: [COLORS.HDR_AUTO_BG, COLORS.HDR_AUTO_FG],
    helper: [COLORS.HDR_HELPER_BG, COLORS.HDR_HELPER_FG],
  }[kind];
}

function styleHeaderRow_(range, kind) {
  const c = headerColors_(kind);
  range.setBackground(c[0]).setFontColor(c[1]).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
}

function validationFor_(f) {
  const DV = SpreadsheetApp.newDataValidation;
  if (f.kind === 'dd') {
    const src = f.dict ? 'D.' + f.dict : f.list;
    return DV().requireValueInRange(rangeFromToken_(src), true).setAllowInvalid(false).build();
  }
  if (f.kind === 'cb') return DV().requireCheckbox().build();
  if (f.kind === 'date') return DV().requireDate().setAllowInvalid(false).setHelpText('Введите дату').build();
  if (f.kind === 'num' || f.kind === 'money') return DV().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).setHelpText('Введите число ≥ 0').build();
  return null;
}

function rangeFromToken_(token) {
  const a1 = resolveF_('[[' + token + ']]').replace(/\$/g, '');
  return ss_().getRange(a1);
}

function nf_(fmt) {
  return ({
    date: 'dd.mm.yyyy', datetime: 'dd.mm.yyyy HH:mm', money: '#,##0" ₽"', money_short: '#,##0" ₽"', pct: '0%',
  })[fmt] || fmt;
}

// ───────────────────────── условное форматирование журналов ─────────────────────────
// Формулы без запятых (только * и сравнения) — не зависят от локали таблицы.

function cfRule_(formula, range, bg, fg) {
  const b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(toLocaleF_(formula)).setRanges([range]);
  if (bg) b.setBackground(bg);
  if (fg) b.setFontColor(fg);
  return b.build();
}

function applyDataCF_(code, sh) {
  const spec = sheetSpecs_()[code];
  const n = spec.fields.length;
  const max = sh.getMaxRows();
  const col = k => colLetter_(fieldIndex_(code, k));
  const colRange = k => sh.getRange(2, fieldIndex_(code, k), max - 1, 1);
  const row = sh.getRange(2, 1, max - 1, n);
  const R = [];
  const red = [COLORS.RED_BG, COLORS.RED_FG], yel = [COLORS.YELLOW_BG, COLORS.YELLOW_FG], grn = [COLORS.GREEN_BG, COLORS.GREEN_FG], grey = [null, COLORS.GREY_FG];
  const add = (f, rng, c) => R.push(cfRule_(f, rng, c[0], c[1]));
  if (code === 'OBJ') {
    add('=$' + col('id_check') + '2<>""', colRange('id'), red);
    add('=$' + col('in_work') + '2="НЕТ"', row, grey);
    add('=($' + col('strategy_pct') + '2<>"")*($' + col('strategy_pct') + '2>=1)', colRange('strategy_pct'), grn);
    add('=($' + col('strategy_pct') + '2<>"")*($' + col('strategy_pct') + '2<0.5)', colRange('strategy_pct'), red);
    add('=($' + col('strategy_pct') + '2<>"")*($' + col('strategy_pct') + '2<1)', colRange('strategy_pct'), yel);
  }
  if (code === 'TASK') {
    add('=$' + col('overdue') + '2="ПРОСРОЧЕНО"', row, red);
    add('=$' + col('status_class') + '2="DONE"', colRange('status'), grn);
    add('=$' + col('status_class') + '2="FAIL"', colRange('status'), red);
    add('=($' + col('status_class') + '2="MOVED")+($' + col('status_class') + '2="CANCEL")', row, grey);
    add('=($' + col('pct') + '2<>"")*($' + col('pct') + '2>=1)', colRange('pct'), grn);
    add('=($' + col('pct') + '2<>"")*($' + col('pct') + '2<1)', colRange('pct'), yel);
    add('=($' + col('obj_id') + '2<>"")*($' + col('owner') + '2="")', colRange('owner'), yel);
  }
  if (code === 'BASE') {
    add('=$' + col('resp_class') + '2="YES"', colRange('response'), grn);
    add('=$' + col('resp_class') + '2="NO"', row, grey);
    add('=$' + col('to_crm') + '2=TRUE', colRange('company'), grn);
    add('=$' + col('fit') + '2="Не подходит"', colRange('fit'), red);
    add('=($' + col('next_date') + '2<>"")*($' + col('next_date') + '2<TODAY())*($' + col('to_crm') + '2=FALSE)', colRange('next_date'), red);
  }
  if (code === 'CONT') {
    add('=$' + col('status_class') + '2="DONE"', colRange('status'), grn);
    add('=$' + col('status_class') + '2="CANCEL"', row, grey);
    add('=($' + col('status_class') + '2="DONE")*($' + col('link') + '2="")', colRange('link'), yel);
  }
  sh.setConditionalFormatRules(R);
}

// ───────────────────────── общие блоки из layout ─────────────────────────

function applyCells_(sh, cells) {
  cells.forEach(c => {
    const r = sh.getRange(c.a1);
    if (c.f) r.setFormula(toLocaleF_(resolveF_(c.f)));
    else if (c.v !== undefined) r.setValue(c.v);
    if (c.fmt) r.setNumberFormat(nf_(c.fmt));
    if (c.note) r.setNote(c.note);
    if (c.validation) {
      r.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(rangeFromToken_(c.validation.list), true).setAllowInvalid(false).build());
    }
    styleCell_(sh, r, c);
  });
}

function styleCell_(sh, r, c) {
  const span = c.spanCols ? sh.getRange(r.getRow(), r.getColumn(), 1, c.spanCols) : r;
  switch (c.style) {
    case 'title': r.setFontSize(14).setFontWeight('bold').setFontColor('#263238'); break;
    case 'section': span.setBackground(COLORS.SECTION_BG).setFontColor(COLORS.SECTION_FG).setFontWeight('bold'); break;
    case 'header': r.setBackground(COLORS.HDR_FORMULA_BG).setFontColor(COLORS.HDR_FORMULA_FG).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle'); break;
    case 'label': r.setFontWeight('bold').setHorizontalAlignment('right'); break;
    case 'select': r.setBackground(COLORS.SELECT_BG).setBorder(true, true, true, true, false, false, '#B0BEC5', SpreadsheetApp.BorderStyle.SOLID); break;
    case 'muted': r.setFontColor(COLORS.GREY_FG).setFontSize(9); break;
    case 'bold': r.setFontWeight('bold'); break;
    case 'wrap': r.setWrap(true).setVerticalAlignment('top'); break;
    case 'link': r.setFontColor('#1565C0'); break;
    case 'tileLabel': r.setFontSize(9).setFontColor(COLORS.GREY_FG).setWrap(true).setVerticalAlignment('bottom'); break;
    case 'tileValue': r.setFontSize(18).setFontWeight('bold').setHorizontalAlignment('left'); break;
    case 'delta': r.setFontColor(COLORS.GREY_FG); break;
    default: break;
  }
}

function safeGet_(sh, a1) { try { return sh.getRange(a1).getValue(); } catch (e) { return ''; } }
function restoreSel_(sh, a1, v) { if (v !== '' && v !== null && v !== undefined) { try { sh.getRange(a1).setValue(v); } catch (e) { /* значение больше не допустимо */ } } }

function resetSheet_(sh) {
  removeSysProtections_(sh);
  sh.getCharts().forEach(c => sh.removeChart(c));
  sh.clear();
  sh.clearNotes();
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.showColumns(1, sh.getMaxColumns());
  sh.setFrozenRows(0); sh.setFrozenColumns(0);
}

// ───────────────────────── 05_ОТЧЁТ_КЛИЕНТУ ─────────────────────────

function buildReportSheet_() {
  const sh = sheet_('REP');
  const keep = ['B3', 'B4', 'B5'].map(a => safeGet_(sh, a));
  resetSheet_(sh);
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (e) { /* нечего разъединять */ }
  const L = reportLayout_();
  ensureSize_(sh, L.lastRow + 5, 6);
  applyCells_(sh, L.cells);
  ['B3', 'B4', 'B5'].forEach((a, i) => restoreSel_(sh, a, keep[i]));
  if (!keep[1]) {
    SpreadsheetApp.flush();
    const label = weekLabelByKey_(isoWeekKey_(addDays_(today_(), -7)));
    if (label) sh.getRange('B4').setValue(label);
  }
  for (let i = 0; i < L.kvRows; i++) sh.getRange(REP_FIRST_ROW + i, 2, 1, 2).merge();
  Object.keys(L.tables).forEach(k => {
    const t = L.tables[k];
    sh.getRange(t.first, 1, t.rows, 3).setWrap(true).setVerticalAlignment('top');
    sh.getRange(t.first, 1, t.rows, 1).setHorizontalAlignment('center');
  });
  sh.setColumnWidth(1, 210); sh.setColumnWidth(2, 520); sh.setColumnWidth(3, 190); sh.setColumnWidth(4, 130); sh.setColumnWidth(5, 110);
  sh.getRange('B5:C5').merge().setWrap(true);
  sh.setRowHeight(5, 48);
  protectWarn_(sh.getRange(REP_FIRST_ROW, 1, L.lastRow - REP_FIRST_ROW + 1, 5), 'Отчёт собирается автоматически');
  protectWarn_(sh.getRange('D2:E8'), 'Служебные параметры отчёта');
}

// ───────────────────────── 00_ДЭШБОРД ─────────────────────────

function buildDash_() {
  const sh = sheet_('DASH');
  const keep = safeGet_(sh, 'B2');
  resetSheet_(sh);
  ensureSize_(sh, DASH.OVERDUE_FIRST + 150, 26);
  const L = dashLayout_();
  applyCells_(sh, L.cells);
  restoreSel_(sh, 'B2', keep);
  sh.setColumnWidth(1, 210);
  for (let c = 2; c <= 17; c++) sh.setColumnWidth(c, 100);
  sh.setColumnWidth(2, 150);
  sh.setRowHeight(5, 36); sh.setRowHeight(6, 34);
  sh.setRowHeight(DASH.OBJ_HDR, 40); sh.setRowHeight(DASH.PEOPLE_HDR, 40);
  sh.setFrozenRows(2);
  sh.hideColumns(25, 2); // Y:Z — параметры

  const oc = L.objLetter;
  const oF = DASH.OBJ_FIRST, oL = DASH.OBJ_LAST;
  const idle = oc['Дней без работы'], pct = oc['% плана'], str = oc['Стратегия'], od = oc['Просрочено'];
  const rowR = sh.getRange('A' + oF + ':Q' + oL);
  const colR = L => sh.getRange(L + oF + ':' + L + oL);
  const pF = DASH.PEOPLE_FIRST, pL = DASH.PEOPLE_LAST;
  const rules = [
    cfRule_('=($' + idle + oF + '<>"")*($' + idle + oF + '>$Z$2)', rowR, COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=($' + pct + oF + '<>"")*($' + pct + oF + '>=1)', colR(pct), COLORS.GREEN_BG, COLORS.GREEN_FG),
    cfRule_('=($' + pct + oF + '<>"")*($' + pct + oF + '<0.7)', colR(pct), COLORS.YELLOW_BG, COLORS.YELLOW_FG),
    cfRule_('=($' + str + oF + '<>"")*($' + str + oF + '<0.5)', colR(str), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=($' + str + oF + '<>"")*($' + str + oF + '>=1)', colR(str), COLORS.GREEN_BG, COLORS.GREEN_FG),
    cfRule_('=$' + od + oF + '>0', colR(od), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=($D' + pF + '<>"")*($D' + pF + '<0.7)', sh.getRange('A' + pF + ':I' + pL), COLORS.YELLOW_BG, COLORS.YELLOW_FG),
    cfRule_('=$E' + pF + '>0', sh.getRange('E' + pF + ':E' + pL), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=E6>0', sh.getRange('E6'), COLORS.RED_BG, COLORS.RED_FG),
  ];
  sh.setConditionalFormatRules(rules);
  protectWarn_(sh.getRange(3, 1, sh.getMaxRows() - 2, sh.getMaxColumns()), 'Дэшборд считается автоматически');
}

// ───────────────────────── Google Drive ─────────────────────────

function ensureDrive_() {
  const ss = ss_();
  let root = folderById_(cfgGet_('FOLDER_ROOT_ID'));
  if (!root) {
    const it = DriveApp.getFoldersByName(SYS.ROOT_FOLDER);
    root = it.hasNext() ? it.next() : DriveApp.createFolder(SYS.ROOT_FOLDER);
    cfgSet_('FOLDER_ROOT_ID', root.getId());
  }
  const sub = {};
  [['MASTER', 'FOLDER_MASTER_ID'], ['OBJECTS', 'FOLDER_OBJECTS_ID'], ['TEMPLATES', 'FOLDER_TEMPLATES_ID']].forEach(p => {
    let f = folderById_(cfgGet_(p[1]));
    if (!f) {
      f = childFolder_(root, SYS.FOLDERS[p[0]]);
      cfgSet_(p[1], f.getId());
    }
    sub[p[0]] = f;
  });
  const file = DriveApp.getFileById(ss.getId());
  const parents = file.getParents();
  let inMaster = false;
  while (parents.hasNext()) if (parents.next().getId() === sub.MASTER.getId()) inMaster = true;
  if (!inMaster) file.moveTo(sub.MASTER);
  ensureReportTemplate_();
  // доступ сотрудникам из справочника (email): таблица + папка системы
  dictRows_('people').forEach(p => {
    const email = String(p[2] || '').trim();
    if (!email) return;
    try { root.addEditor(email); ss.addEditor(email); } catch (e) { /* email может быть недоступен для шаринга */ }
  });
  return sub;
}

function folderById_(id) {
  if (!id) return null;
  try {
    const f = DriveApp.getFolderById(String(id));
    return f.isTrashed() ? null : f;
  } catch (e) { return null; }
}

function childFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ───────────────────────── триггеры ─────────────────────────

function installTriggers_() {
  const ss = ss_();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onEditHandler') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditHandler').forSpreadsheet(ss).onEdit().create();
}
