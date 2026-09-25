/**
 * 12_Utils — общие функции: доступ к листам, настройкам, чтение/запись строк, даты и недели.
 */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(code) {
  const sh = ss_().getSheetByName(SHEET_NAMES[code]);
  if (!sh) throw new Error('Нет листа ' + SHEET_NAMES[code] + '. Запустите меню «⚙ Установить / обновить систему».');
  return sh;
}

function cfgGet_(key) {
  const r = ss_().getRangeByName('CFG_' + key);
  return r ? r.getValue() : '';
}

function cfgSet_(key, v) {
  const r = ss_().getRangeByName('CFG_' + key);
  if (r) r.setValue(v);
}

function tz_() { return ss_().getSpreadsheetTimeZone() || SYS.TZ; }

function fmtDate_(d, pattern) {
  if (!(d instanceof Date)) return String(d || '');
  return Utilities.formatDate(d, tz_(), pattern || 'dd.MM.yyyy');
}

function today_() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function addDays_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

/** ISO-неделя вида 2026-W39 (та же логика, что в формулах). */
function isoWeekKey_(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return y + '-W' + (w < 10 ? '0' : '') + w;
}

function mondayOfWeekKey_(key) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(key || '').trim());
  if (!m) return null;
  const y = Number(m[1]), w = Number(m[2]);
  const jan4 = new Date(y, 0, 4);
  const dow = jan4.getDay() || 7;
  return new Date(y, 0, 4 - dow + 1 + (w - 1) * 7);
}

function mondayOf_(d) { const dow = d.getDay() || 7; return addDays_(d, 1 - dow); }

function weekPeriodLabel_(key) {
  const m = mondayOfWeekKey_(key);
  if (!m) return '';
  return fmtDate_(m, 'dd.MM') + '–' + fmtDate_(addDays_(m, 6), 'dd.MM.yyyy');
}

/** Подпись недели из справочника (как в выпадающем списке): «2026-W39 · 21.09–27.09.2026». */
function weekLabelByKey_(key) {
  const col = dictLayout_().weeks.col;
  const sh = sheet_('DICT');
  const n = sh.getLastRow();
  if (n < 2) return '';
  const vals = sh.getRange(2, col, n - 1, 4).getValues();
  const row = vals.find(r => r[0] === key);
  return row ? row[3] : '';
}

function objLabel_(id, name) { return id + ' · ' + name; }

function userEmail_(e) {
  try { if (e && e.user && e.user.getEmail) { const m = e.user.getEmail(); if (m) return m; } } catch (err) { /* нет доступа */ }
  try { const m = Session.getActiveUser().getEmail(); if (m) return m; } catch (err) { /* нет доступа */ }
  try { return Session.getEffectiveUser().getEmail() || ''; } catch (err) { return ''; }
}

/** Ответственный по email (справочник «Ответственные»), иначе пусто. */
function personByEmail_(email) {
  if (!email) return '';
  const row = dictRows_('people').find(r => String(r[2]).trim().toLowerCase() === email.toLowerCase());
  return row ? row[0] : '';
}

/** Строки справочника (только заполненные). */
function dictRows_(key) {
  const d = dictLayout_()[key];
  const sh = sheet_('DICT');
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, d.col, n - 1, d.width).getValues().filter(r => r[0] !== '');
}

function dictValues_(key) { return dictRows_(key).map(r => r[0]); }

function dictFirstByClass_(key, cls) {
  const r = dictRows_(key).find(x => x[1] === cls);
  return r ? r[0] : '';
}

function dictClassOf_(key, value) {
  const r = dictRows_(key).find(x => x[0] === value);
  return r ? r[1] : '';
}

/** Последняя строка с данными в журнале: по ручным и скриптовым столбцам (формулы не считаются). */
function lastDataRow_(sh, spec) {
  const max = sh.getMaxRows();
  const lastCol = spec.fields.length;
  const vals = sh.getRange(2, 1, max - 1, lastCol).getValues();
  const cols = [];
  spec.fields.forEach((f, i) => { if (f.kind !== 'f' && f.kind !== 'cb') cols.push(i); });
  for (let r = vals.length - 1; r >= 0; r--) {
    for (let k = 0; k < cols.length; k++) if (vals[r][cols[k]] !== '') return r + 2;
  }
  return 1;
}

/** Читает журнал в массив объектов {_row, key: value}. */
function readTable_(code) {
  const spec = sheetSpecs_()[code];
  const sh = sheet_(code);
  const last = lastDataRow_(sh, spec);
  const rows = [];
  if (last < 2) return { sh: sh, spec: spec, rows: rows };
  const vals = sh.getRange(2, 1, last - 1, spec.fields.length).getValues();
  vals.forEach((v, i) => {
    const o = { _row: i + 2 };
    spec.fields.forEach((f, j) => { o[f.key] = v[j]; });
    rows.push(o);
  });
  return { sh: sh, spec: spec, rows: rows };
}

/** Пишет значения полей строки. Формульные столбцы не трогает (иначе сломается ARRAYFORMULA). */
function writeFields_(sh, code, row, obj) {
  const spec = sheetSpecs_()[code];
  const cols = Object.keys(obj).map(k => {
    const f = fieldOf_(code, k);
    if (f.kind === 'f') throw new Error('Нельзя писать в формульный столбец ' + f.title);
    return { col: fieldIndex_(code, k), v: obj[k] };
  }).sort((a, b) => a.col - b.col);
  // группируем соседние столбцы в один вызов
  let i = 0;
  while (i < cols.length) {
    let j = i;
    while (j + 1 < cols.length && cols[j + 1].col === cols[j].col + 1) j++;
    sh.getRange(row, cols[i].col, 1, j - i + 1).setValues([cols.slice(i, j + 1).map(c => c.v)]);
    i = j + 1;
  }
  return spec;
}

/** Добавляет строку в конец журнала, возвращает номер строки. */
function appendRow_(code, obj) {
  const sh = sheet_(code);
  const spec = sheetSpecs_()[code];
  const row = lastDataRow_(sh, spec) + 1;
  if (row > sh.getMaxRows()) extendSheet_(code, 500);
  writeFields_(sh, code, row, obj);
  return row;
}

/** Следующий ID: ACT-0012, LEAD-0005, TASK-0031 … (максимум существующих + 1). */
function nextId_(code, cache) {
  const spec = sheetSpecs_()[code];
  if (cache && cache[code] !== undefined) { cache[code]++; return formatId_(spec, cache[code]); }
  const sh = sheet_(code);
  const col = fieldIndex_(code, spec.idField);
  const max = sh.getMaxRows();
  const vals = sh.getRange(2, col, max - 1, 1).getValues();
  let n = 0;
  vals.forEach(r => {
    const m = new RegExp('^' + spec.idPrefix + '(\\d+)$').exec(String(r[0]));
    if (m) n = Math.max(n, Number(m[1]));
  });
  n++;
  if (cache) cache[code] = n;
  return formatId_(spec, n);
}

function formatId_(spec, n) {
  const s = String(n);
  return spec.idPrefix + (s.length < spec.idPad ? '0'.repeat(spec.idPad - s.length) : '') + s;
}

/** Добавляет строки в журнал и растягивает на них списки/чекбоксы/форматы. */
function extendSheet_(code, n) {
  const sh = sheet_(code);
  const spec = sheetSpecs_()[code];
  const before = sh.getMaxRows();
  sh.insertRowsAfter(before, n);
  applyColumnRules_(sh, spec, before + 1, n);
}

/** Повторно применяет проверки и форматы к диапазону строк (после добавления строк). */
function applyColumnRules_(sh, spec, fromRow, n) {
  spec.fields.forEach((f, i) => {
    const r = sh.getRange(fromRow, i + 1, n, 1);
    const fmt = f.fmt || ({ date: 'date', money: 'money' })[f.kind];
    if (fmt) r.setNumberFormat(nf_(fmt));
    const v = validationFor_(f);
    if (v) r.setDataValidation(v);
    if (f.kind === 'f') r.setBackground(COLORS.FORMULA_CELL_BG);
  });
}

/** Запись в 12_ИСТОРИЯ. entries: [{sheet, record_id, obj_id, field, old, new, kind, note}] */
function logHistory_(entries, user) {
  if (!entries.length) return;
  const sh = sheet_('HIST');
  const spec = sheetSpecs_().HIST;
  let row = lastDataRow_(sh, spec) + 1;
  if (row + entries.length > sh.getMaxRows()) extendSheet_('HIST', Math.max(500, entries.length));
  const now = new Date();
  const values = entries.map(e => [now, user || '', e.sheet, e.record_id || '', e.obj_id || '', e.field, e.old === undefined ? '' : e.old, e.new === undefined ? '' : e.new, e.kind, e.note || '']);
  sh.getRange(row, 1, values.length, values[0].length).setValues(values);
}

/** URL → ID файла/папки Google Drive. */
function idFromUrl_(url) {
  const m = /[-\w]{25,}/.exec(String(url || ''));
  return m ? m[0] : '';
}

/** Выбранный объект: активная строка листа с ID объекта, иначе выбор в 07_ОТЧЕТ. */
function selectedObjectId_() {
  const sh = SpreadsheetApp.getActiveSheet();
  const spec = specBySheetName_(sh.getName());
  const row = sh.getActiveRange() ? sh.getActiveRange().getRow() : 0;
  if (spec && row >= 2) {
    const key = spec.code === 'OBJ' ? 'id' : (spec.fields.some(f => f.key === 'obj_id') ? 'obj_id' : null);
    if (key) {
      const v = sh.getRange(row, fieldIndex_(spec.code, key)).getValue();
      if (v) return String(v);
    }
  }
  if (sh.getName() === SHEET_NAMES.DASH && row >= DASH_OBJ_FIRST) {
    const v = sh.getRange(row, 1).getValue();
    if (v) return String(v);
  }
  const rep = sheet_('REP').getRange('E3').getValue();
  return rep ? String(rep) : '';
}

function objectById_(id) {
  const t = readTable_('OBJ');
  return t.rows.find(r => r.id === id) || null;
}

function toast_(msg, title, sec) { ss_().toast(msg, title || SYS.MENU, sec || 5); }

function htmlEscape_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Диалог со ссылками (Apps Script не умеет сам открыть вкладку — пробуем window.open и даём ссылку). */
function showLinks_(title, links, text) {
  const items = links.map(l => '<li><a href="' + htmlEscape_(l.url) + '" target="_blank">' + htmlEscape_(l.label) + '</a></li>').join('');
  const auto = links.length === 1 ? '<script>window.open(' + JSON.stringify(links[0].url) + ',"_blank");</script>' : '';
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
    (text ? '<p>' + htmlEscape_(text).replace(/\n/g, '<br>') + '</p>' : '') +
    '<ul>' + items + '</ul></div>' + auto).setWidth(520).setHeight(120 + 30 * links.length + (text ? 60 : 0));
  SpreadsheetApp.getUi().showModalDialog(html, title);
}
