/**
 * 03_Setup — установка и обновление системы.
 *
 * «Установить / обновить систему» можно запускать повторно:
 *  - данные в журналах (01–04, 06, 12, 13) и значения настроек/справочников сохраняются;
 *  - заголовки, формулы, списки, форматирование и защита пересоздаются по схеме;
 *  - расчётные листы (05, 07, 09, 11) пересобираются, выбранные фильтры сохраняются.
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
    'Будут созданы или обновлены все листы, формулы, выпадающие списки, папки Google Drive, шаблоны документов и триггеры.\n\n' +
    'Данные в журналах не удаляются. Продолжить?',
    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  const log = [];
  runSetup_(log);
  let driveMsg = '';
  try {
    ensureDrive_();
    log.push('Google Drive: папки и шаблоны готовы');
  } catch (err) {
    driveMsg = '\n\n⚠ Drive: ' + err.message + '\nПапки можно создать позже повторным запуском установки.';
  }
  try {
    installTriggers_();
    log.push('Триггер onEdit установлен');
  } catch (err) {
    driveMsg += '\n\n⚠ Триггер: ' + err.message;
  }
  ui.alert('Готово', log.join('\n') + driveMsg + '\n\nДальше: «Загрузить тестовые данные» → «Самопроверка», либо сразу добавляйте реальные объекты в 01_ОБЪЕКТЫ.', ui.ButtonSet.OK);
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
  buildSettings_(); log.push('10_НАСТРОЙКИ');
  buildDict_(); log.push('08_СПРАВОЧНИКИ');
  ['OBJ', 'STR', 'ACT', 'LEAD', 'PF', 'HIST', 'ARCH'].forEach(code => { buildDataSheet_(code); log.push(SHEET_NAMES[code]); });
  buildLeadBlock_();
  buildPfBlock_();
  SpreadsheetApp.flush();
  buildStats_(); log.push(SHEET_NAMES.STAT);
  buildReportSheet_(); log.push(SHEET_NAMES.REP);
  buildCtrl_(); log.push(SHEET_NAMES.CTRL);
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

function orderSheets_() {
  const ss = ss_();
  SHEET_ORDER.forEach((code, i) => {
    const sh = ss.getSheetByName(SHEET_NAMES[code]);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  ss.setActiveSheet(ss.getSheetByName(SHEET_NAMES.DASH));
}

function removeDefaultSheet_() {
  const ss = ss_();
  const ours = Object.keys(SHEET_NAMES).map(k => SHEET_NAMES[k]);
  ss.getSheets().forEach(sh => {
    if (ours.indexOf(sh.getName()) < 0 && sh.getLastRow() === 0 && sh.getLastColumn() === 0 && ss.getSheets().length > 1) {
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

// ───────────────────────── 10_НАСТРОЙКИ ─────────────────────────

function buildSettings_() {
  const sh = sheet_('CFG');
  const existing = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(1, 1, sh.getLastRow(), 3).getValues().forEach(r => { if (r[0]) existing[r[0]] = r[2]; });
  }
  const kpiExisting = [];
  if (sh.getLastRow() > 1 && sh.getMaxColumns() >= 7) {
    sh.getRange(2, 6, 20, 2).getValues().forEach(r => { if (r[0] !== '') kpiExisting.push(r); });
  }
  removeSysProtections_(sh);
  sh.clear();
  sh.clearConditionalFormatRules();
  ensureSize_(sh, 60, 8);
  sh.getRange('A:H').clearDataValidations();

  const defs = cfgDefs_();
  const rows = [['Ключ', 'Параметр', 'Значение', 'Описание']];
  defs.forEach(d => {
    if (d.group) { rows.push(['', d.group, '', '']); return; }
    let v = (d.key in existing && existing[d.key] !== '' && !(d.key === 'SYSTEM_VERSION')) ? existing[d.key] : d.value;
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
      else cell.setBackground(COLORS.SELECT_BG);
    }
    r++;
  });
  sh.getRange(1, 1, r, 1).setFontColor(COLORS.GREY_FG).setFontSize(9);
  sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 420); sh.setColumnWidth(3, 200); sh.setColumnWidth(4, 140);

  // KPI по умолчанию для «Создать план недели»
  sh.getRange('F1:G1').setValues([['KPI по умолчанию', 'План на объект в неделю']]);
  styleHeaderRow_(sh.getRange('F1:G1'), 'input');
  const kpi = kpiExisting.length ? kpiExisting : DEFAULT_WEEK_KPI;
  sh.getRange(2, 6, kpi.length, 2).setValues(kpi);
  sh.getRange('F2:F21').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(rangeFromToken_('D.kpi_metrics'), true).setAllowInvalid(false).build());
  sh.getRange('F2:G21').setBackground(COLORS.SELECT_BG);
  ss_().setNamedRange('CFG_DEFAULT_KPI', sh.getRange('F2:G21'));
  sh.setColumnWidth(6, 170); sh.setColumnWidth(7, 170);
  sh.setFrozenRows(1);
  sh.hideColumns(1);
}

// ───────────────────────── 08_СПРАВОЧНИКИ ─────────────────────────

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
      sh.getRange(2, c).setFormula(resolveF_(gen[d.key]));
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
  const extraCols = code === 'LEAD' ? 4 : code === 'PF' ? 5 : 0;
  ensureSize_(sh, SYS.DATA_ROWS, n + extraCols);
  checkHeaders_(sh, spec);
  removeSysProtections_(sh);
  const maxRows = sh.getMaxRows();

  // заголовки: значения + формулы одним вызовом
  sh.getRange(1, 1, 1, n).setValues([spec.fields.map(f => f.kind === 'f' ? '' : f.title)]);
  spec.fields.forEach((f, i) => { if (f.kind === 'f') sh.getRange(1, i + 1).setFormula(headerFormula_(spec, f)); });
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
  if (f.track) flags.push('изменения пишутся в 12_ИСТОРИЯ');
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
  const b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setRanges([range]);
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
  const red = [COLORS.RED_BG, COLORS.RED_FG], yel = [COLORS.YELLOW_BG, COLORS.YELLOW_FG], grn = [COLORS.GREEN_BG, COLORS.GREEN_FG];
  const add = (f, rng, c) => R.push(cfRule_(f, rng, c[0], c[1]));
  if (code === 'OBJ') {
    add('=$' + col('risk_flag') + '2="RISK"', row, red);
    add('=$' + col('risk_flag') + '2="ВНИМАНИЕ"', row, yel);
    add('=($' + col('status_class') + '2="SOLD")+($' + col('status_class') + '2="DEAL")', colRange('status'), grn);
    add('=($' + col('status_class') + '2="PAUSED")+($' + col('status_class') + '2="REMOVED")', row, [null, COLORS.GREY_FG]);
    add('=$' + col('temperature') + '2="HOT"', colRange('temperature'), grn);
    add('=$' + col('temperature') + '2="WARM"', colRange('temperature'), yel);
    add('=$' + col('temperature') + '2="RISK"', colRange('temperature'), red);
    add('=($' + col('next_action_deadline') + '2<>"")*($' + col('next_action_deadline') + '2<TODAY())', colRange('next_action_deadline'), red);
    add('=($' + col('next_report') + '2<>"")*($' + col('next_report') + '2<=TODAY())*($' + col('in_work') + '2="ДА")', colRange('next_report'), yel);
    add('=($' + col('date_end') + '2<>"")*($' + col('date_end') + '2-TODAY()<=INDIRECT("CFG_EXCL_END_WARN_DAYS"))', colRange('date_end'), red);
  }
  if (code === 'STR') {
    add('=$' + col('need_change') + '2=TRUE', colRange('need_change'), red);
    add('=($' + col('obj_id') + '2<>"")*($' + col('review_date') + '2="")', colRange('review_date'), yel);
    add('=($' + col('days_since_review') + '2<>"")*($' + col('days_since_review') + '2>INDIRECT("CFG_STRATEGY_REVIEW_DAYS"))', colRange('days_since_review'), yel);
    add('=$' + col('strategy_status') + '2="Утверждена"', colRange('strategy_status'), grn);
  }
  if (code === 'ACT') {
    add('=($' + col('status_class') + '2="OPEN")*($' + col('date') + '2<>"")*($' + col('date') + '2<TODAY())', row, red);
    add('=$' + col('status_class') + '2="DONE"', colRange('status'), grn);
    add('=($' + col('id') + '2<>"")*($' + col('to_report') + '2=FALSE)', colRange('to_report'), [null, COLORS.GREY_FG]);
  }
  if (code === 'LEAD') {
    add('=$' + col('status_class') + '2="WON"', row, grn);
    add('=$' + col('status_class') + '2="LOST"', row, [null, COLORS.GREY_FG]);
    add('=($' + col('next_contact') + '2<>"")*($' + col('next_contact') + '2<TODAY())*(($' + col('status_class') + '2="OPEN")+($' + col('status_class') + '2="PAUSED"))', colRange('next_contact'), red);
    add('=($' + col('id') + '2<>"")*($' + col('next_contact') + '2="")*(($' + col('status_class') + '2="OPEN")+($' + col('status_class') + '2="PAUSED"))', colRange('next_contact'), yel);
  }
  if (code === 'PF') {
    add('=$' + col('overdue') + '2="ПРОСРОЧЕНО"', row, red);
    add('=$' + col('status_class') + '2="DONE"', colRange('status'), grn);
    add('=$' + col('status_class') + '2="FAIL"', colRange('status'), red);
    add('=$' + col('status_class') + '2="MOVED"', row, [null, COLORS.GREY_FG]);
    add('=($' + col('kpi_pct') + '2<>"")*($' + col('kpi_pct') + '2>=1)', colRange('kpi_pct'), grn);
    add('=($' + col('kpi_pct') + '2<>"")*($' + col('kpi_pct') + '2<1)', colRange('kpi_pct'), yel);
    add('=($' + col('obj_id') + '2<>"")*($' + col('owner') + '2="")', colRange('owner'), yel);
  }
  sh.setConditionalFormatRules(R);
}

// ───────────────────────── общие блоки из layout ─────────────────────────

function applyCells_(sh, cells) {
  cells.forEach(c => {
    const r = sh.getRange(c.a1);
    if (c.f) r.setFormula(resolveF_(c.f));
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

/** Блок «Воронка и конверсии» справа от журнала лидов. */
function buildLeadBlock_() {
  const sh = sheet_('LEAD');
  const L = leadBlockLayout_();
  const keepObj = safeGet_(sh, L.selObj), keepWeek = safeGet_(sh, L.selWeek);
  const rng = sh.getRange(1, L.startCol, 40, 3);
  rng.clear(); rng.clearDataValidations();
  applyCells_(sh, L.cells);
  restoreSel_(sh, L.selObj, keepObj);
  restoreSel_(sh, L.selWeek, keepWeek);
  sh.setColumnWidth(L.startCol - 1, 24);
  sh.setColumnWidth(L.startCol, 220); sh.setColumnWidth(L.startCol + 1, 150); sh.setColumnWidth(L.startCol + 2, 150);
  protectWarn_(sh.getRange(4, L.startCol, 37, 3), 'Расчёт воронки');
}

/** Блок «План-факт недели» справа от журнала задач. */
function buildPfBlock_() {
  const sh = sheet_('PF');
  const L = pfBlockLayout_();
  const keepW = safeGet_(sh, L.selWeek), keepO = safeGet_(sh, L.selObj);
  const rng = sh.getRange(1, L.startCol, 40, 4);
  rng.clear(); rng.clearDataValidations();
  applyCells_(sh, L.cells);
  restoreSel_(sh, L.selWeek, keepW);
  restoreSel_(sh, L.selObj, keepO);
  sh.setColumnWidth(L.startCol - 1, 24);
  sh.setColumnWidth(L.startCol, 230);
  for (let i = 1; i < 4; i++) sh.setColumnWidth(L.startCol + i, 110);
  const pctCell = sh.getRange(L.at.pct);
  const rules = sh.getConditionalFormatRules();
  rules.push(cfRule_('=(' + L.at.pct + '<>"")*(' + L.at.pct + '>=1)', pctCell, COLORS.GREEN_BG, COLORS.GREEN_FG));
  rules.push(cfRule_('=(' + L.at.pct + '<>"")*(' + L.at.pct + '<1)', pctCell, COLORS.YELLOW_BG, COLORS.YELLOW_FG));
  sh.setConditionalFormatRules(rules);
  protectWarn_(sh.getRange(4, L.startCol, 37, 4), 'Расчёт план-факта');
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

// ───────────────────────── 05_СТАТИСТИКА ─────────────────────────

function buildStats_() {
  const sh = sheet_('STAT');
  const keep = safeGet_(sh, 'B2');
  resetSheet_(sh);
  ensureSize_(sh, SYS.STAT_ROWS, 50);
  const L = statsLayout_(sh.getSheetId());
  applyCells_(sh, L.cells);
  L.formats.forEach(f => sh.getRange(f.range).setNumberFormat(nf_(f.fmt)));
  restoreSel_(sh, 'B2', keep);
  Object.keys(STAT_SECTIONS).forEach(k => sh.setRowHeight(STAT_SECTIONS[k].header, 44));
  sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 170);
  for (let c = 3; c <= 50; c++) sh.setColumnWidth(c, 96);
  sh.setFrozenColumns(2);
  protectWarn_(sh.getRange(3, 1, sh.getMaxRows() - 2, sh.getMaxColumns()), 'Статистика считается автоматически');
}

// ───────────────────────── 07_ОТЧЕТ ─────────────────────────

function buildReportSheet_() {
  const sh = sheet_('REP');
  const keep = ['B3', 'B4', 'B5'].map(a => safeGet_(sh, a));
  resetSheet_(sh);
  ensureSize_(sh, 60, 6);
  const L = reportLayout_();
  applyCells_(sh, L.cells);
  ['B3', 'B4', 'B5'].forEach((a, i) => restoreSel_(sh, a, keep[i]));
  if (!keep[1]) {
    // по умолчанию — текущая неделя
    SpreadsheetApp.flush();
    const label = weekLabelByKey_(isoWeekKey_(new Date()));
    if (label) sh.getRange('B4').setValue(label);
  }
  sh.setColumnWidth(1, 250); sh.setColumnWidth(2, 620); sh.setColumnWidth(3, 170); sh.setColumnWidth(4, 130); sh.setColumnWidth(5, 110);
  sh.getRange('B5').setWrap(true);
  sh.setFrozenRows(0);
  protectWarn_(sh.getRange(REP_FIRST_ROW, 1, L.lastRow - REP_FIRST_ROW + 1, 5), 'Отчёт собирается автоматически');
  protectWarn_(sh.getRange('D2:E8'), 'Служебные параметры отчёта');
}

// ───────────────────────── 11_КОНТРОЛЬ ─────────────────────────

function buildCtrl_() {
  const sh = sheet_('CTRL');
  resetSheet_(sh);
  ensureSize_(sh, SYS.DATA_ROWS, CTRL_MON_START + ctrlMonitorCols_().length + 1);
  const L = ctrlLayout_();
  applyCells_(sh, L.cells);
  sh.setFrozenRows(2);
  const widths = [110, 190, 90, 150, 380, 130, 95, 130];
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setColumnWidth(9, 24); sh.setColumnWidth(10, 24);
  for (let c = CTRL_MON_START; c < CTRL_MON_START + ctrlMonitorCols_().length; c++) sh.setColumnWidth(c, 105);
  sh.setRowHeight(2, 44);
  const body = sh.getRange(CTRL_FIRST, 1, sh.getMaxRows() - CTRL_FIRST + 1, 8);
  sh.setConditionalFormatRules([
    cfRule_('=LEFT($A' + CTRL_FIRST + ')="1"', body, COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=LEFT($A' + CTRL_FIRST + ')="2"', body, COLORS.YELLOW_BG, COLORS.YELLOW_FG),
  ]);
  protectWarn_(sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()), 'Контроль считается автоматически');
}

// ───────────────────────── 09_ДЭШБОРД ─────────────────────────

function buildDash_() {
  const sh = sheet_('DASH');
  const keep = safeGet_(sh, 'C2');
  resetSheet_(sh);
  ensureSize_(sh, 300, DASH_CHART_COL + 8);
  const L = dashLayout_();
  applyCells_(sh, L.cells);
  restoreSel_(sh, 'C2', keep);
  sh.setColumnWidth(1, 200); sh.setColumnWidth(2, 170);
  for (let c = 3; c <= 17; c++) sh.setColumnWidth(c, 105);
  sh.setColumnWidth(13, 230); sh.setColumnWidth(14, 230);
  sh.setRowHeight(5, 36); sh.setRowHeight(6, 34);
  sh.setFrozenRows(2);
  sh.hideColumns(25, 2); // Y:Z — параметры
  sh.hideColumns(DASH_CHART_COL, 6); // данные графика

  const oc = L.objCol;
  const first = DASH_OBJ_FIRST;
  const max = sh.getMaxRows();
  const colR = L => sh.getRange(L + first + ':' + L + max);
  const idle = oc['Дней без активности'], dl = oc['Дедлайн'], tmp = oc['Темп.'];
  const row = sh.getRange('A' + first + ':Q' + max);
  const rules = [
    cfRule_('=($' + idle + first + '<>"")*($' + idle + first + '>$Z$3)', row, COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=($' + idle + first + '<>"")*($' + idle + first + '>$Z$4)', row, COLORS.YELLOW_BG, COLORS.YELLOW_FG),
    cfRule_('=($' + dl + first + '<>"")*($' + dl + first + '<TODAY())', colR(dl), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=$' + tmp + first + '="HOT"', colR(tmp), COLORS.GREEN_BG, COLORS.GREEN_FG),
    cfRule_('=$' + tmp + first + '="RISK"', colR(tmp), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=B6>0', sh.getRange('B6:C6'), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=H6>0', sh.getRange('H6'), COLORS.YELLOW_BG, COLORS.YELLOW_FG),
    cfRule_('=B12>0', sh.getRange('B12:I12'), null, COLORS.GREEN_FG),
    cfRule_('=B12<0', sh.getRange('B12:I12'), null, COLORS.RED_FG),
  ];
  sh.setConditionalFormatRules(rules);

  const chart = sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(L.chartRange))
    .setNumHeaders(1)
    .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH)
    .setPosition(4, 11, 0, 0)
    .setOption('title', 'Динамика за 12 недель')
    .setOption('legend', { position: 'bottom' })
    .setOption('colors', ['#90A4AE', '#546E7A', '#26A69A', '#1565C0'])
    .setOption('width', 620).setOption('height', 300)
    .build();
  sh.insertChart(chart);
  protectWarn_(sh.getRange(3, 1, max - 2, sh.getMaxColumns()), 'Дэшборд считается автоматически');
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
  [['MASTER', 'FOLDER_MASTER_ID'], ['STRATEGIES', 'FOLDER_STRATEGIES_ID'], ['REPORTS', 'FOLDER_REPORTS_ID'], ['TEMPLATES', 'FOLDER_TEMPLATES_ID']].forEach(p => {
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
  ensureStrategyTemplate_();
  const email = String(cfgGet_('ASSISTANT_EMAIL') || '').trim();
  if (email) {
    try { root.addEditor(email); ss.addEditor(email); } catch (e) { /* email может быть недоступен для шаринга */ }
  }
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
