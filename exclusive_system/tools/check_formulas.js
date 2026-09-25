// Генерирует все формулы системы и проверяет их структуру.
const { loadGs } = require('./load_gs.js');
const x = loadGs();

const KNOWN = new Set(('ARRAYFORMULA IF IFERROR LEN VLOOKUP SORT FILTER TEXT LEFT TODAY WEEKDAY ROUND YEAR ISOWEEKNUM MONTH ' +
  'SUMIF COUNTIF SUMIFS COUNTIFS LET SEQUENCE MAX ROUNDUP UNIQUE REGEXEXTRACT OR HYPERLINK INDEX TEXTJOIN QUERY ISNUMBER MATCH ' +
  'MIN N AVERAGEIFS SUMPRODUCT ROWS ROW SUM CHAR MAP LAMBDA LOWER').split(' '));

function allFormulas() {
  const out = [];
  const S = x.sheetSpecs_();
  Object.keys(S).forEach(code => S[code].fields.forEach(f => {
    if (f.kind === 'f') out.push({ where: `${S[code].name}!${x.colLetter_(x.fieldIndex_(code, f.key))}1 «${f.title}»`, f: x.headerFormula_(S[code], f) });
  }));
  const gen = x.dictGeneratedFormulas_();
  Object.keys(gen).forEach(k => out.push({ where: `08_СПРАВОЧНИКИ ${k}`, f: x.resolveF_(gen[k]) }));
  const blocks = [
    ['05_СТАТИСТИКА', x.statsLayout_(0).cells], ['04_ВОРОНКА', x.funnelLayout_().cells], ['06 блок', x.pfBlockLayout_().cells],
    ['07_ОТЧЕТ', x.reportLayout_().cells], ['11_КОНТРОЛЬ', x.ctrlLayout_().cells], ['09_ДЭШБОРД', x.dashLayout_().cells],
  ];
  blocks.forEach(([name, cells]) => cells.forEach(c => { if (c.f) out.push({ where: `${name}!${c.a1}`, f: x.resolveF_(c.f) }); }));
  return out;
}

function check(f) {
  const errs = [];
  if (f.includes('[[')) errs.push('неразвёрнутый токен');
  if (!f.startsWith('=')) errs.push('нет =');
  let depthP = 0, depthB = 0, inStr = false;
  for (let i = 0; i < f.length; i++) {
    const ch = f[i];
    if (ch === '"') { if (inStr && f[i + 1] === '"') { i++; continue; } inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '(') depthP++; if (ch === ')') depthP--;
    if (ch === '{') depthB++; if (ch === '}') depthB--;
    if (depthP < 0 || depthB < 0) { errs.push('лишняя закрывающая скобка на ' + i); break; }
  }
  if (inStr) errs.push('незакрытая кавычка');
  if (depthP) errs.push('скобки () не сбалансированы: ' + depthP);
  if (depthB) errs.push('скобки {} не сбалансированы: ' + depthB);
  const noStr = f.replace(/"(?:[^"]|"")*"/g, '""');
  for (const m of noStr.matchAll(/([A-Z][A-Z0-9_.]*)\(/g)) {
    if (!KNOWN.has(m[1])) errs.push('неизвестная функция ' + m[1]);
  }
  // LET: имена переменных не должны выглядеть как ссылки на ячейки
  for (const m of noStr.matchAll(/LET\(([^()]*)/g)) {
    const names = m[1].split(',').filter((_, i) => i % 2 === 0);
    names.forEach(n => { if (/^[A-Za-z]{1,3}\d+$/.test(n.trim())) errs.push('LET-имя похоже на ячейку: ' + n); });
  }
  if (f.length > 40000) errs.push('слишком длинная: ' + f.length);
  return errs;
}

if (require.main === module) {
  const all = allFormulas();
  let bad = 0;
  all.forEach(o => { const e = check(o.f); if (e.length) { bad++; console.log('✗', o.where, e.join('; ')); } });
  const maxLen = Math.max(...all.map(o => o.f.length));
  console.log(`Формул: ${all.length}, с ошибками: ${bad}, самая длинная: ${maxLen} символов`);
  process.exit(bad ? 1 : 0);
}
module.exports = { allFormulas, check };
