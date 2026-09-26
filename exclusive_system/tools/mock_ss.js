// Мини-заглушка SpreadsheetApp: хранит значения и формулы, любые «оформительские» методы — no-op с цепочкой.
function col(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function coln(l) { let n = 0; for (const ch of l) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
const chain = () => new Proxy(function () {}, { get: (t, p) => p === 'build' ? () => ({}) : (() => chain()), apply: () => chain() });

function props(store) {
  return { getProperty: k => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = v; }, deleteProperty: k => { delete store[k]; } };
}
function makeSS() {
  const book = {}; const names = {}; const order = []; let gid = 100;
  function sheetObj(name) {
    if (!book[name]) { book[name] = { cells: {}, maxRows: 2000, maxCols: 80, id: gid++, name }; order.push(name); }
    const S = book[name];
    const k = (r, c) => col(c) + r;
    const rng = (r, c, nr, nc) => {
      const base = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const v = S.cells[k(r + i, c + j)]; return v && 'v' in v ? v.v : ''; })),
        getDisplayValues: () => base.getValues().map(r => r.map(v => String(v))),
        getValue: () => { const v = S.cells[k(r, c)]; return v && 'v' in v ? v.v : ''; },
        getDisplayValue: () => { const v = S.cells[k(r, c)]; if (v && v.f === '=SUM(1,2)') return globalThis.__EN_FORMULAS === false ? '#ERROR!' : '3'; return String(base.getValue()); },
        setValues: vals => { vals.forEach((row, i) => row.forEach((v, j) => { S.cells[k(r + i, c + j)] = (typeof v === 'string' && v[0] === '=') ? { f: v } : { v }; })); return p; },
        setValue: v => { S.cells[k(r, c)] = (typeof v === 'string' && v[0] === '=') ? { f: v } : { v }; return p; },
        setFormula: f => { S.cells[k(r, c)] = { f }; return p; },
        getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc, getLastRow: () => r + nr - 1, getLastColumn: () => c + nc - 1,
        getSheet: () => sh,
      };
      const p = new Proxy(base, { get: (t, prop) => prop in t ? t[prop] : (() => p) });
      return p;
    };
    const sh = new Proxy({
      getName: () => S.name, setName: n => { book[n] = S; delete book[S.name]; order[order.indexOf(S.name)] = n; S.name = n; return sh; },
      getSheetId: () => S.id, getMaxRows: () => S.maxRows, getMaxColumns: () => S.maxCols,
      insertRowsAfter: (_, n) => { S.maxRows += n; }, insertColumnsAfter: (_, n) => { S.maxCols += n; }, deleteColumns: (a, n) => { S.maxCols -= n; },
      getLastRow: () => Math.max(0, ...Object.keys(S.cells).map(a => +a.replace(/^[A-Z]+/, ''))),
      getProtections: () => [], getCharts: () => [], getConditionalFormatRules: () => [], getFilter: () => null,
      getRange: (r, c, nr, nc) => {
        if (typeof r === 'string') {
          const a = r.replace(/\$/g, '').split(':');
          const m = /^([A-Z]+)(\d+)$/.exec(a[0]);
          if (a.length === 1) return rng(+m[2], coln(m[1]), 1, 1);
          const m2 = /^([A-Z]+)(\d*)$/.exec(a[1]);
          return rng(+m[2], coln(m[1]), (m2[2] ? +m2[2] : S.maxRows) - m[2] + 1, coln(m2[1]) - coln(m[1]) + 1);
        }
        return rng(r, c, nr || 1, nc || 1);
      },
    }, { get: (t, prop) => prop in t ? t[prop] : (() => chain()) });
    S.sh = sh;
    return sh;
  }
  const ss = {
    getSheetByName: n => book[n] ? book[n].sh : null,
    insertSheet: (n) => sheetObj(n),
    getSheets: () => order.map(n => book[n].sh),
    getRangeByName: n => { if (!names[n]) return null; const m = /^([A-Z]+)(\d+)$/.exec(names[n].a1); return sheetObj(names[n].sheet).getRange(+m[2], coln(m[1]), names[n].nr || 1, names[n].nc || 1); },
    setNamedRange: (n, r) => { names[n] = { sheet: r.getSheet().getName(), a1: col(r.getColumn()) + r.getRow(), nr: r.getNumRows(), nc: r.getNumColumns() }; },
    getName: () => 'Test', rename: () => {}, setSpreadsheetTimeZone: () => {}, setSpreadsheetLocale: () => {}, setActiveSheet: () => {}, moveActiveSheet: () => {}, deleteSheet: (sh) => { const n = sh.getName(); delete book[n]; order.splice(order.indexOf(n), 1); },
    getRange: a1 => { const m = /^'?(.+?)'?!(.+)$/.exec(a1); return sheetObj(m[1]).getRange(m[2]); },
    getSpreadsheetTimeZone: () => 'Europe/Moscow', getUrl: () => 'https://docs.google.com/x', toast: (m) => { if (/Ошибка/.test(m)) console.log('TOAST', m); }, getId: () => 'x', getSpreadsheetLocale: () => 'ru_RU',
  };
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => ss, flush: () => {}, newDataValidation: chain, newConditionalFormatRule: chain,
    BorderStyle: {}, ProtectionType: {}, getActiveSheet: () => null,
  };
  const store = {};
  const PropertiesService = { getDocumentProperties: () => props(store), getScriptProperties: () => props(store) };
  return { book, names, ss, sheetObj, SpreadsheetApp, PropertiesService, col, coln };
}
module.exports = { makeSS };
