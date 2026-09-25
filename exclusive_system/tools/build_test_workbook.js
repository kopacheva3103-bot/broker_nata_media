// Собирает книгу: все листы системы с формулами + тестовые данные (тем же loadTestData_),
// чтобы проверить её в настоящем Google Sheets. Выход: tools/out/test_book.json
const fs = require('fs');
const path = require('path');
const { loadGs } = require('./load_gs.js');

const book = {}; const names = {}; let X;
function col(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function coln(l) { let n = 0; for (const ch of l) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
function sheetObj(name) {
  if (!book[name]) book[name] = { cells: {}, maxRows: name.startsWith('05') ? 1000 : 2000 };
  const S = book[name];
  const k = (r, c) => col(c) + r;
  const rng = (r, c, nr, nc) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const v = S.cells[k(r + i, c + j)]; return v && 'v' in v ? v.v : ''; })),
    getValue: () => { const v = S.cells[k(r, c)]; return v && 'v' in v ? v.v : ''; },
    setValues: vals => vals.forEach((row, i) => row.forEach((v, j) => { S.cells[k(r + i, c + j)] = { v }; })),
    setValue: v => { S.cells[k(r, c)] = { v }; },
    setFormula: f => { S.cells[k(r, c)] = { f }; },
  });
  return {
    getName: () => name, getMaxRows: () => S.maxRows, getMaxColumns: () => 80,
    insertRowsAfter: (_, n) => { S.maxRows += n; },
    getLastRow: () => Math.max(0, ...Object.keys(S.cells).map(a => +a.replace(/^[A-Z]+/, ''))),
    getRange: (r, c, nr, nc) => {
      if (typeof r === 'string') { const m = /^([A-Z]+)(\d+)$/.exec(r.replace(/\$/g, '')); return rng(+m[2], coln(m[1]), 1, 1); }
      return rng(r, c, nr || 1, nc || 1);
    },
  };
}
const ss = { getSheetByName: sheetObj, getRangeByName: n => names[n] ? sheetObj(names[n].sheet).getRange(names[n].a1) : null, getSpreadsheetTimeZone: () => 'Europe/Moscow' };
X = loadGs({
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
  Utilities: { formatDate: (d, tz, p) => { const pad = n => String(n).padStart(2, '0'); return p.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate())).replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())); } },
  Session: { getActiveUser: () => ({ getEmail: () => 'test@example.com' }), getEffectiveUser: () => ({ getEmail: () => '' }) },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
});
const N = X.SHEET_NAMES;
const put = (sheet, a1, cell) => { sheetObj(sheet); book[sheet].cells[a1] = cell; };

// 10_НАСТРОЙКИ + именованные диапазоны
let r = 2;
X.cfgDefs_().forEach(d => {
  if (d.group) { r++; return; }
  let v = d.value; if (d.date) v = new Date(v + 'T00:00:00');
  put(N.CFG, 'A' + r, { v: d.key }); put(N.CFG, 'C' + r, { v });
  names['CFG_' + d.key] = { sheet: N.CFG, a1: 'C' + r }; r++;
});
// 08_СПРАВОЧНИКИ
const L = X.dictLayout_(); const gen = X.dictGeneratedFormulas_();
X.dictDefs_().forEach(d => {
  const c = L[d.key].col;
  d.cols.forEach((t, i) => put(N.DICT, col(c + i) + 1, { v: t }));
  if (d.generated) put(N.DICT, col(c) + 2, { f: X.resolveF_(gen[d.key]) });
  else d.values.forEach((row, i) => row.forEach((v, j) => put(N.DICT, col(c + j) + (i + 2), { v })));
});
// журналы: заголовки и формулы
['OBJ', 'STR', 'ACT', 'PF', 'HIST', 'ARCH'].forEach(code => {
  const spec = X.sheetSpecs_()[code];
  spec.fields.forEach((f, i) => put(spec.name, col(i + 1) + 1, f.kind === 'f' ? { f: X.headerFormula_(spec, f) } : { v: f.title }));
});
// тестовые данные — тем же кодом, что в Apps Script
const ids = X.loadTestData_();
// расчётные блоки
const today = new Date(); const M = X.mondayOf_(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
const P = X.addDays_(M, -7); const wkP = X.isoWeekKey_(P);
const lbl = X.objLabel_(ids.OSTROV, 'Остров');
const weekLabel = wkP + ' · ' + X.fmtDate_(P, 'dd.MM') + '–' + X.fmtDate_(X.addDays_(P, 6), 'dd.MM.yyyy');
const apply = (sheet, cells, sel) => cells.forEach(c => put(sheet, c.a1, c.f ? { f: X.resolveF_(c.f) } : { v: sel && sel[c.a1] !== undefined ? sel[c.a1] : (c.v === undefined ? '' : c.v) }));
const FB = X.funnelLayout_(); apply(N.FUN, FB.cells, { B2: lbl, B3: weekLabel });
const PB = X.pfBlockLayout_(); apply(N.PF, PB.cells, { [PB.selObj]: lbl, [PB.selWeek]: weekLabel });
apply(N.STAT, X.statsLayout_(0).cells, { B2: 'Все' });
apply(N.REP, X.reportLayout_().cells, { B3: lbl, B4: weekLabel, B5: 'Тестовый комментарий' });
apply(N.CTRL, X.ctrlLayout_().cells);
apply(N.DASH, X.dashLayout_().cells, { C2: '' });

const out = { sheets: {}, names, ids, wkP, weekLabel, meta: { FB: { at: FB.at, conv: FB.conv }, PB: { at: PB.at, kpiRows: PB.kpiRows, cols: PB.cols }, rowOf: X.reportLayout_().rowOf } };
const ser = v => Object.prototype.toString.call(v) === '[object Date]' ? { d: [v.getFullYear(), v.getMonth() + 1, v.getDate(), v.getHours(), v.getMinutes()] } : { v };
Object.keys(book).forEach(s => { out.sheets[s] = {}; Object.entries(book[s].cells).forEach(([a, c]) => { out.sheets[s][a] = c.f ? { f: c.f } : ser(c.v); }); });
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', 'test_book.json'), JSON.stringify(out));
console.log('sheets', Object.keys(out.sheets).length, 'ids', JSON.stringify(ids), wkP);
