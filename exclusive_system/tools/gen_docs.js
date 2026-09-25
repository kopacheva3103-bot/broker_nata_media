// Генерирует docs/02_ПОЛЯ.md и docs/03_ФОРМУЛЫ.md из схемы — документация всегда совпадает с кодом.
const fs = require('fs');
const path = require('path');
const { loadGs } = require('./load_gs.js');
const { allFormulas } = require('./check_formulas.js');
const x = loadGs();
const S = x.sheetSpecs_();
const kindRu = { id: 'авто (скрипт, ID)', sys: 'авто (скрипт)', f: 'формула', text: 'вручную', dd: 'вручную, список', date: 'вручную, дата', num: 'вручную, число', money: 'вручную, сумма', cb: 'вручную, галочка', link: 'вручную, ссылка' };
const esc = s => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = '# D–F. Все поля: что вводится вручную, что считается, что заполняет скрипт\n\n' +
  '> Файл сгенерирован `node tools/gen_docs.js` из `apps_script/01_Schema.gs`. Не редактируйте вручную.\n\n' +
  'Обозначения: **Клиент** — поле может попасть в отчёт клиенту; **Внутр.** — никогда не попадает к клиенту; **История** — изменения пишутся в 12_ИСТОРИЯ; **Скрыт** — служебный столбец (скрыт на листе).\n\n';
const summary = { manual: 0, formula: 0, auto: 0 };
Object.keys(S).forEach(code => {
  const sp = S[code];
  md += `## ${sp.name}\n\n${sp.about}\n\n| Столбец | Поле | Как заполняется | Источник / список | Флаги | Пояснение |\n|---|---|---|---|---|---|\n`;
  sp.fields.forEach((f, i) => {
    const kind = kindRu[f.kind];
    if (f.kind === 'f') summary.formula++; else if (f.kind === 'id' || f.kind === 'sys') summary.auto++; else summary.manual++;
    const src = f.dict ? '08: ' + x.dictDefs_().find(d => d.key === f.dict).cols[0] : f.list ? (f.list === 'D.weeks' ? '08: Недели' : '01: ID объекта') : '';
    const flags = [f.client && 'Клиент', f.internal && 'Внутр.', f.track && 'История', f.helper && 'Скрыт'].filter(Boolean).join(', ');
    md += `| ${x.colLetter_(i + 1)} | ${esc(f.title)} | ${kind} | ${esc(src)} | ${flags} | ${esc(f.d)} |\n`;
  });
  md += '\n';
});
md += `## Итого по журналам\n\n- вводится вручную: **${summary.manual}** полей\n- считается формулами: **${summary.formula}**\n- заполняет скрипт: **${summary.auto}**\n\n` +
  'Листы 05_СТАТИСТИКА, 07_ОТЧЕТ, 09_ДЭШБОРД, 11_КОНТРОЛЬ полностью расчётные — вручную там выбираются только фильтры (жёлтые ячейки) и комментарий руководителя в 07.\n';
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
