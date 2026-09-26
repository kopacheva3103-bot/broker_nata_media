// Генерирует docs/02_ПОЛЯ.md и docs/03_ФОРМУЛЫ.md из схемы — документация всегда совпадает с кодом.
const fs = require('fs');
const path = require('path');
const { loadGs } = require('./load_gs.js');
const { allFormulas } = require('./check_formulas.js');
const { makeSS } = require('./mock_ss.js');
const x = loadGs({ SpreadsheetApp: makeSS().SpreadsheetApp });
const S = x.sheetSpecs_();
const kindRu = { id: 'авто (скрипт, ID)', sys: 'авто (скрипт)', f: 'формула', text: 'вручную', dd: 'вручную, список', date: 'вручную, дата', num: 'вручную, число', money: 'вручную, сумма', cb: 'вручную, галочка', link: 'вручную, ссылка' };
const esc = s => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = '# D–F. Все поля: что вводится вручную, что считается, что заполняет скрипт\n\n' +
  '> Файл сгенерирован `node tools/gen_docs.js` из `apps_script/01_Schema.gs`. Не редактируйте вручную.\n\n' +
  'Обозначения: **Клиент** — поле может попасть в отчёт клиенту; **Внутр.** — никогда не попадает к клиенту; **История** — изменения пишутся в 09_ИСТОРИЯ; **Скрыт** — служебный столбец (скрыт на листе).\n\n';
const summary = { manual: 0, formula: 0, auto: 0 };
Object.keys(S).forEach(code => {
  const sp = S[code];
  md += `## ${sp.name}\n\n${sp.about}\n\n| Столбец | Поле | Как заполняется | Источник / список | Флаги | Пояснение |\n|---|---|---|---|---|---|\n`;
  sp.fields.forEach((f, i) => {
    const kind = kindRu[f.kind];
    if (f.kind === 'f') summary.formula++; else if (f.kind === 'id' || f.kind === 'sys') summary.auto++; else summary.manual++;
    const src = f.dict ? '07: ' + x.dictDefs_().find(d => d.key === f.dict).cols[0] : f.list ? (f.list === 'D.weeks' ? '07: Недели' : '01: ID объекта') : '';
    const flags = [f.client && 'Клиент', f.internal && 'Внутр.', f.track && 'История', f.helper && 'Скрыт'].filter(Boolean).join(', ');
    md += `| ${x.colLetter_(i + 1)} | ${esc(f.title)} | ${kind} | ${esc(src)} | ${flags} | ${esc(f.d)} |\n`;
  });
  md += '\n';
});
md += `## Итого по журналам\n\n- вводится вручную: **${summary.manual}** полей\n- считается формулами: **${summary.formula}**\n- заполняет скрипт: **${summary.auto}**\n\n` +
  'Листы 00_ДЭШБОРД и 05_ОТЧЁТ_КЛИЕНТУ расчётные — вручную там выбираются только фильтры (жёлтые ячейки) и комментарий для клиента.\n\n';
// вкладка объекта
const kr = { text: 'текст', dd: 'список', date: 'дата', num: 'число', money: 'сумма', link: 'ссылка', f: '**формула**' };
md += '## Вкладка объекта «▸ Название (ID)»\n\nСоздаётся сама, когда в 01_ОБЪЕКТЫ заполнены ID и название. Разделы 1–7 заполняет команда, 8–10 собираются из журналов. Строки внутри табличного раздела можно вставлять — при обновлении системы они сохраняются.\n\n';
x.objTabSections_().forEach(s => {
  md += `### ${s.title}\n\n${s.hint}\n\n`;
  if (s.type === 'table') md += `Строк по умолчанию: ${s.rows}. Столбцы: ` + s.cols.map(c => `${c.t} (${kr[c.k]}${c.dict ? ': 07 ' + x.dictDefs_().find(d => d.key === c.dict).cols[0] : c.list ? ': чек-листы 06' : ''})`).join('; ') + '.\n\n';
  else if (s.type === 'kv') md += s.items.map(i => `- ${i.label} — ${kr[i.k]}`).join('\n') + '\n\n';
  else md += 'Только чтение. Столбцы: ' + s.cols.join('; ') + '.\n\n';
});
md += '«Стратегия заполнена» (H3 во вкладке, столбец в 01): ' + x.STRATEGY_PCT_NOTE + '\n';
fs.writeFileSync(path.join(__dirname, '..', 'docs', '02_ПОЛЯ.md'), md);

let fm = '# G. Все формулы системы\n\n> Сгенерировано `node tools/gen_docs.js`. Формулы записаны в английском синтаксисе (так их пишет Apps Script); в русской локали таблица покажет их с «;».\n\n' +
  'Каждый формульный столбец журнала — одна формула в заголовке (строка 1) вида `={"Заголовок";ARRAYFORMULA(IF(LEN(ключ)=0;"";…))}`: она сама растягивается на все строки, поэтому новые объекты/действия подхватываются без копирования формул. Все диапазоны открытые (`$B$2:$B`).\n\n';
let cur = '';
allFormulas().forEach(o => {
  const sec = o.where.split(/[!\s]/)[0];
  if (sec !== cur) { fm += `\n## ${sec}\n\n`; cur = sec; }
  fm += `**${o.where}**\n\n\`\`\`\n${o.f}\n\`\`\`\n\n`;
});
fs.writeFileSync(path.join(__dirname, '..', 'docs', '03_ФОРМУЛЫ.md'), fm);
console.log('ok', summary);
