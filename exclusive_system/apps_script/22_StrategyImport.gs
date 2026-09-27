/**
 * 22_StrategyImport — «Вставить стратегию из Claude»: ответ Claude по промпту «Стратегия объекта — для вставки во вкладку»
 * разносится по разделам вкладки объекта: аналоги, цена, сценарии, аудитории, каналы, выводы.
 * Формат ответа — блоки «## Раздел» и строки через «|» (как в промпте). Уже внесённые строки (то же первое поле) не дублируются.
 * Раздел «## Задачи на 2 недели» уходит в 02_ЗАДАЧИ (как «Внести задачи с оперативки», источник «Стратегия»).
 */

const STRAT_SECTIONS = [
  { re: /аналог/i, key: 'ANALOG', idx: [0, 1, 2, 3, 5, 6], name: 'Аналоги' },          // Аналог | Назначение | Площадь | Цена | Ссылка | Комментарий
  { re: /(^|[\s«])цен|позиционир/i, key: 'PRICE', kv: true, name: 'Цена и позиционирование' },
  { re: /сценари/i, key: 'SCEN', idx: [0, 1, 2, 3, 4], name: 'Сценарии' },           // Сценарий | Чек-лист | Что проверить | Консультанты | Вывод
  { re: /аудитор/i, key: 'AUD', idx: [0, 1, 2, 3, 4], name: 'Аудитории' },           // Аудитория | Кто | Портрет | Где искать | Приоритет
  { re: /канал|партн[её]р/i, key: 'CHAN', idx: [0, 1], name: 'Каналы и партнёры' },   // Канал | Что делаем
  { re: /материал|презентац|^кп\b|кп и/i, key: 'KP', idx: [0, 1, 2, 5], name: 'КП и материалы' },  // Материал | Какое | Для аудитории | Комментарий
  { re: /вывод|решени/i, key: 'DEC', idx: [1, 3], name: 'Выводы и решения' },         // Вывод | Что делаем дальше
];

function importStrategy() {
  const sel = selectedObjectId_();
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name);
  const options = objs.map(o => '<option value="' + htmlEscape_(o.id) + '"' + (String(o.id) === String(sel) ? ' selected' : '') + '>' + htmlEscape_(o.name + ' (' + o.id + ')') + '</option>').join('');
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div>Объект: <select id="o" style="max-width:520px">' + options + '</select></div>' +
    '<div style="color:#5f6368;font-size:12px;margin:6px 0">1) «Промпт для Claude по объекту» → «Стратегия объекта — для вставки во вкладку» → в Claude (можно приложить презентацию). 2) Скопируйте ответ Claude целиком и вставьте сюда.</div>' +
    '<textarea id="t" style="width:100%;height:280px;font:12px monospace"></textarea>' +
    '<div style="margin-top:8px"><button onclick="prev()">Проверить</button> <button id="go" onclick="go()" disabled>Вставить во вкладку</button></div>' +
    '<div id="r" style="margin-top:8px;font-size:13px"></div></div><script>' +
    'function v(){return [document.getElementById("o").value,document.getElementById("t").value];}' +
    'function prev(){var a=v();google.script.run.withSuccessHandler(function(x){document.getElementById("r").innerHTML=x.html;document.getElementById("go").disabled=!x.total;}).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).previewStrategy(a[0],a[1]);}' +
    'function go(){var a=v();document.getElementById("go").disabled=true;document.getElementById("r").textContent="Вставляю…";google.script.run.withSuccessHandler(function(m){document.getElementById("r").textContent=m;}).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).runStrategyImport(a[0],a[1]);}' +
    '</script>').setWidth(640).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'Вставить стратегию из Claude');
}

/** Текст ответа → {sections: {KEY: [[...]]}, kv: {key: value}}. */
function parseStrategy_(text) {
  const out = { tables: {}, kv: {}, taskLines: [] };
  let cur = null;
  String(text || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    const h = /^#{1,4}\s*(.+)$/.exec(line) || /^\*\*(.+?)\*\*:?$/.exec(line);
    if (h) { cur = /^задач/i.test(h[1].trim()) ? { tasks: true } : STRAT_SECTIONS.find(s => s.re.test(h[1])) || null; return; }
    if (!cur) return;
    if (cur.tasks) { out.taskLines.push(line); return; }
    if (cur.kv) {
      const m = /^[-•*\s]*(.+?)\s*[:—|]\s*(.+)$/.exec(line);
      if (!m) return;
      const k = m[1].toLowerCase(), val = m[2].replace(/\|\s*$/, '').trim();
      if (/рекоменд/.test(k)) out.kv.rec_price = moneyOf_(val);
      else if (/миним/.test(k)) out.kv.min_price = moneyOf_(val);
      else if (/позицион/.test(k)) out.kv.positioning = val;
      else if (/вывод/.test(k)) out.kv.price_note = val;
      return;
    }
    if (line.indexOf('|') < 0 || /^\|?\s*:?-{2,}/.test(line)) return;
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim().replace(/^\*\*|\*\*$/g, ''));
    const isHeader = /^(аналог|адрес|сценари|аудитори|канал|вывод|материал)/i.test(cells[0]) && cells[0].length < 30 &&
      /назначен|чек-лист|кто|что делаем|что проверить|портрет|площадь/i.test(cells.slice(1).join(' '));
    if (!cells[0] || isHeader) return; // строка заголовка таблицы
    (out.tables[cur.key] = out.tables[cur.key] || []).push(cells);
  });
  return out;
}

function moneyOf_(s) {
  const t = String(s).toLowerCase().replace(/\s| /g, '').replace(',', '.');
  const m = /(\d+(?:\.\d+)?)(млрд|млн|тыс)?/.exec(t);
  if (!m) return '';
  let v = Number(m[1]);
  if (m[2] === 'млрд') v *= 1e9; else if (m[2] === 'млн') v *= 1e6; else if (m[2] === 'тыс') v *= 1e3;
  return Math.round(v);
}

function numOf_(s) {
  const n = Number(String(s).replace(/\s| /g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return isNaN(n) || String(s).trim() === '' ? '' : n;
}

/** Значения строки раздела по столбцам вкладки (формулы пропускаются, списки — к значениям справочника). */
function strategyRow_(sec, cells) {
  const cols = objTabSections_().find(s => s.key === sec.key).cols;
  const row = {};
  sec.idx.forEach((ci, i) => {
    const c = cols[ci];
    let v = String(cells[i] === undefined ? '' : cells[i]).trim();
    if (!v || v === '—' || v === '-') return;
    if (c.k === 'num') v = numOf_(v);
    else if (c.k === 'money') v = /млн|млрд|тыс/i.test(v) ? moneyOf_(v) : numOf_(v);
    else if (c.k === 'dd') {
      const vals = c.dict ? dictValues_(c.dict) : (c.list === 'D.lib_checklists' ? readTable_('LIB').rows.filter(r => r.kind === 'Чек-лист').map(r => r.title) : []);
      const stars = (v.match(/★|\*/g) || []).length;
      v = vals.find(x => x.toLowerCase() === v.toLowerCase()) || vals.find(x => v.toLowerCase().indexOf(x.toLowerCase()) === 0) ||
        (c.dict === 'priorities' && stars ? vals.find(x => x.length === Math.min(3, stars)) : '') || '';
    }
    if (v !== '') row[ci] = v;
  });
  if (sec.key === 'SCEN' && row[5] === undefined) row[5] = dictValues_('scenario_status')[0] || '';
  if (sec.key === 'CHAN' && row[3] === undefined) row[3] = dictValues_('work_status')[0] || '';
  if (sec.key === 'KP' && row[4] === undefined) row[4] = dictValues_('work_status')[0] || '';
  if (sec.key === 'DEC') { row[0] = today_(); const p = personByEmail_(userEmail_()); if (p) row[2] = p; }
  return row;
}

function strategyPlan_(objId, text) {
  const obj = objectById_(objId);
  if (!obj) throw new Error('Объект не найден');
  const tab = findObjectTab_(obj);
  if (!tab) throw new Error('У объекта нет вкладки — «Обновить (ID, вкладки, строки)»');
  const parsed = parseStrategy_(text);
  const have = readObjectTab_(tab);
  const kv = {};
  Object.keys(parsed.kv).forEach(k => { if (parsed.kv[k] !== '' && (have.kv[k] === '' || have.kv[k] === undefined || have.kv[k] === null)) kv[k] = parsed.kv[k]; });
  const plan = { obj: obj, tab: tab, rows: {}, kv: kv, skipped: 0, tasks: [], taskErrors: [] };
  if (parsed.taskLines.length) {
    const t = parseMeetingTasks_(parsed.taskLines.join('\n'), obj.id);
    const norm = x => String(x || '').trim().toLowerCase();
    const haveTasks = readTable_('TASK').rows.filter(r => String(r.obj_id) === String(obj.id)).map(r => norm(r.task));
    t.ok.filter(o => o.task).forEach(o => {
      if (haveTasks.indexOf(norm(o.task)) >= 0) { plan.skipped++; return; }
      haveTasks.push(norm(o.task));
      plan.tasks.push(o);
    });
    plan.taskErrors = t.errors;
  }
  STRAT_SECTIONS.filter(s => !s.kv).forEach(s => {
    const exist = (have.tables[s.key] || []).map(r => String(r[s.idx[0]] || '').trim().toLowerCase());
    (parsed.tables[s.key] || []).forEach(cells => {
      const row = strategyRow_(s, cells);
      const first = String(row[s.idx[0]] || '').trim().toLowerCase();
      if (!first) return;
      if (exist.indexOf(first) >= 0) { plan.skipped++; return; }
      exist.push(first);
      (plan.rows[s.key] = plan.rows[s.key] || []).push(row);
    });
  });
  return plan;
}

function previewStrategy(objId, text) {
  const p = strategyPlan_(objId, text);
  const parts = STRAT_SECTIONS.map(s => {
    if (s.kv) { const n = Object.keys(p.kv).filter(k => p.kv[k] !== '').length; return n ? s.name + ': ' + n + ' поля' : ''; }
    const n = (p.rows[s.key] || []).length;
    return n ? s.name + ': ' + n + ' строк' : '';
  }).filter(Boolean);
  if (p.tasks.length) parts.push('Задачи в 02_ЗАДАЧИ: ' + p.tasks.length);
  const total = parts.length;
  const errs = p.taskErrors.length ? '<br><span style="color:#B71C1C">' + p.taskErrors.map(htmlEscape_).join('<br>') + '</span>' : '';
  return {
    total: total,
    html: total ? 'Будет добавлено во вкладку «' + htmlEscape_(p.obj.name) + '»:<br>• ' + parts.map(htmlEscape_).join('<br>• ') + (p.skipped ? '<br><span style="color:#80868B">Уже есть во вкладке, пропущено: ' + p.skipped + '</span>' : '') + errs
      : p.skipped ? '<span style="color:#2E7D32">✓ Всё из этого текста уже есть во вкладке «' + htmlEscape_(p.obj.name) + '» (строк: ' + p.skipped + ') — повторно вставлять не нужно.</span>'
      : '<span style="color:#B71C1C">Не нашла разделов. Нужен ответ по промпту «Стратегия объекта — для вставки во вкладку»: заголовки «## Аналоги», «## Сценарии»… и строки через «|».</span>',
  };
}

function runStrategyImport(objId, text) {
  const lock = userLock_();
  try {
    const p = strategyPlan_(objId, text);
    const sh = p.tab;
    let n = 0;
    STRAT_SECTIONS.filter(s => !s.kv).forEach(s => {
      (p.rows[s.key] || []).forEach(row => {
        const keys = Object.keys(row).map(Number).sort((a, b) => a - b);
        const r = appendTabRow_(sh, s.key, [row[keys[0]]]);
        keys.forEach(ci => sh.getRange(r, 2 + ci).setValue(row[ci]));
        n++;
      });
    });
    const kvKeys = Object.keys(p.kv).filter(k => p.kv[k] !== '');
    if (kvKeys.length) {
      const marks = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
      kvKeys.forEach(k => {
        const i = marks.findIndex(m => String(m[0]) === 'K:' + k);
        if (i >= 0 && sh.getRange(i + 1, 3).getValue() === '') { sh.getRange(i + 1, 3).setValue(p.kv[k]); n++; }
      });
    }
    let tasks = 0;
    if (p.tasks.length) tasks = addMeetingTasks_({ ok: p.tasks, errors: [] }, 'Стратегия').tasks;
    let docNote = '';
    try { if (n || tasks) { appendStrategyDoc_(p.obj, 'стратегия из Claude', strategyThesis_(p)); docNote = ' Документ «' + strategyDocName_(p.obj) + '» в папке объекта пополнен.'; } }
    catch (e) { docNote = ' ⚠ Документ стратегии не пополнен: ' + e.message; }
    logHistory_([{ sheet: sh.getName(), record_id: p.obj.id, obj_id: p.obj.id, field: 'Стратегия', old: '', new: 'вставлено из Claude: ' + n + (tasks ? ', задач: ' + tasks : ''), kind: HIST_KIND.CHANGE }], userEmail_());
    return 'Готово: добавлено ' + n + ' строк / полей во вкладку «' + p.obj.name + '»' + (tasks ? ', задач в 02_ЗАДАЧИ: ' + tasks : '') + (p.skipped ? ', пропущено как уже внесённые: ' + p.skipped : '') + '.' + docNote + ' Проверьте вкладку.';
  } finally {
    lock.releaseLock();
  }
}
