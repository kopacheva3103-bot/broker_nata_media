/**
 * 14_Prompts — работа с Claude через подписку (без API и без доплат):
 *  - «Промпт для Claude по объекту»: промпт из 06_БИБЛИОТЕКА + данные вкладки объекта одним текстом → скопировать в claude.ai;
 *  - «Внести задачи с оперативки»: таблица задач (из Claude или из протокола) → строки 02_ЗАДАЧИ + решения во вкладки объектов.
 * Кнопка «Спросить Claude» с API-ключом — отдельный этап (отложен).
 */

const MEETING_COLS = ['ID объекта', 'Блок стратегии', 'Задача', 'Исполнитель', 'Единица', 'План', 'Срок', 'Решение'];

// ───────────────────────── промпт по объекту ─────────────────────────

function promptForObject() {
  const id = selectedObjectId_();
  const obj = id ? objectById_(id) : null;
  const prompts = readTable_('LIB').rows.filter(r => r.kind === 'Промпт' && r.title);
  if (!prompts.length) { SpreadsheetApp.getUi().alert('В 06_БИБЛИОТЕКА нет промптов (раздел «Промпт»).'); return; }
  const options = prompts.map(p => '<option value="' + htmlEscape_(p.id) + '">' + htmlEscape_(p.title) + '</option>').join('');
  let auds = [];
  try { auds = obj ? objectAudienceRows_(obj.id).map(a => a.name) : []; } catch (e) { /* без вкладки — без списка */ }
  const audOptions = '<option value="">— все аудитории объекта —</option>' + auds.map(a => '<option>' + htmlEscape_(a) + '</option>').join('');
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div>Объект: <b>' + htmlEscape_(obj ? obj.name + ' (' + obj.id + ')' : 'не выбран — промпт без данных объекта') + '</b></div>' +
    '<div style="margin:8px 0">Промпт: <select id="p" style="max-width:420px">' + options + '</select></div>' +
    (auds.length ? '<div style="margin:8px 0">Аудитория: <select id="a" style="max-width:420px">' + audOptions + '</select> <span style="color:#80868B;font-size:12px">для скрипта, КП, портрета ЛПР</span></div>' : '<input type="hidden" id="a" value="">') +
    '<textarea id="t" style="width:100%;height:330px;font:12px monospace"></textarea>' +
    '<div style="margin-top:8px"><button onclick="copyIt()">Скопировать</button> ' +
    '<a href="https://claude.ai/new" target="_blank">Открыть Claude</a> <span id="s" style="color:#2E7D32"></span></div>' +
    '<div style="color:#80868B;font-size:12px;margin-top:6px">Вставьте текст в Claude (ваша подписка). Ответ перенесите в нужный раздел вкладки объекта. Использование промпта записывается в 09_ИСТОРИЯ.</div></div>' +
    '<script>' +
    'const objId=' + JSON.stringify(obj ? obj.id : '') + ';' +
    'function load(){document.getElementById("t").value="Собираю…";google.script.run.withSuccessHandler(function(x){document.getElementById("t").value=x;}).withFailureHandler(function(e){document.getElementById("t").value="Ошибка: "+e.message;}).getPromptText(objId,document.getElementById("p").value,document.getElementById("a").value);}' +
    'function copyIt(){const t=document.getElementById("t");t.select();try{navigator.clipboard.writeText(t.value);}catch(e){document.execCommand("copy");}document.getElementById("s").textContent="Скопировано";}' +
    'document.getElementById("p").onchange=load;document.getElementById("a").onchange=load;load();' +
    '</script>').setWidth(620).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Промпт для Claude');
}

/** Вызывается из диалога: текст промпта с данными объекта. */
function getPromptText(objId, libId, audience) {
  const p = readTable_('LIB').rows.find(r => r.id === libId);
  if (!p) throw new Error('Промпт не найден');
  const obj = objId ? objectById_(objId) : null;
  let text = String(p.text || '');
  text = text.replace(/\{объекты\}/g, readTable_('OBJ').rows.filter(o => o.id && o.name && o.in_work !== 'НЕТ').map(o => o.id + ' — ' + o.name).join('; '));
  text = text.replace(/\{сотрудники\}/g, dictValues_('people').join(', '));
  text = text.replace(/\{чек-листы\}/g, readTable_('LIB').rows.filter(r => r.kind === 'Чек-лист' && r.title).map(r => r.title).join('; '));
  if (text.indexOf('{финальный блок объявления}') >= 0) {
    let footer = String(cfgGet_('AD_FOOTER') || (cfgDefs_().find(d => d.key === 'AD_FOOTER') || {}).value || '').trim();
    if (obj && /аренд/i.test(String(obj.deal))) footer = footer.replace(/по продаже/g, 'по аренде');
    text = text.replace(/\{финальный блок объявления\}/g, footer);
  }
  if (obj) text = text.replace(/\{ID объекта\}/g, obj.id);
  if (obj && /\{аудитори[^}]*\}/i.test(text)) text = text.replace(/\{аудитори[^}]*\}/gi, audiencePromptText_(obj.id, audience));
  if (obj) text = text.replace(/\{(?!текст\})[^{}]{2,80}\}/g, '(см. «Данные объекта» ниже)');
  const out = text + (obj ? '\n\n' + objectContext_(obj) : '');
  logHistory_([{ sheet: 'Claude (подписка)', record_id: p.id, obj_id: obj ? obj.id : '', field: 'Промпт: ' + p.title, old: '', new: 'сформирован для копирования', kind: 'Промпт' }], userEmail_());
  return out;
}

/** Выбранная аудитория с портретом из вкладки (или все аудитории объекта). */
function audiencePromptText_(objId, audience) {
  const rows = objectAudienceRows_(objId);
  const one = audience ? rows.filter(a => a.name === audience) : rows;
  if (!one.length) return audience || '(аудитории — в разделе «Целевые аудитории» данных объекта ниже)';
  const st = audienceStats_(objId);
  return one.map(a => '«' + a.name + '»' + (a.who ? ' (' + a.who + ')' : '') + (a.portrait ? ' — ' + a.portrait : '') + (a.where ? '; где искать: ' + a.where : '') +
    (st[a.name] ? '; уже в работе: компаний ' + st[a.name].total + ', КП ' + st[a.name].kp + ', интерес ' + st[a.name].yes : '')).join('\n');
}

/** Данные объекта текстом: реестр + то, что внесено во вкладку. */
function objectContext_(obj) {
  const L = [];
  const v = x => (x instanceof Date ? fmtDate_(x) : String(x === null || x === undefined ? '' : x)).trim();
  L.push('=== ДАННЫЕ ОБЪЕКТА ===');
  [['Объект', obj.name], ['Адрес', obj.address], ['Тип', obj.kind], ['Сделка', obj.deal], ['Площадь, м²', obj.area],
    ['Цена, ₽', obj.price], ['Цена за м², ₽', obj.price_m2], ['Статус', obj.status]].forEach(p => { if (v(p[1])) L.push(p[0] + ': ' + v(p[1])); });
  const tab = findObjectTab_(obj);
  if (tab) {
    const d = readObjectTab_(tab);
    const secs = objTabSections_();
    secs.forEach(s => {
      if (s.type === 'kv') {
        const lines = s.items.filter(i => i.k !== 'f' && i.k !== 'link' && v(d.kv[i.key])).map(i => i.label + ': ' + v(d.kv[i.key]));
        if (lines.length) { L.push('', s.title); L.push.apply(L, lines); }
      }
      if (s.type === 'table' && d.tables[s.key] && d.tables[s.key].length) {
        const idx = s.cols.map((c, i) => (c.k === 'f' || c.k === 'link') ? -1 : i).filter(i => i >= 0);
        L.push('', s.title, idx.map(i => s.cols[i].t).join(' | '));
        d.tables[s.key].forEach(r => L.push(idx.map(i => v(r[i])).join(' | ')));
      }
    });
  }
  return L.join('\n');
}

// ───────────────────────── оперативка → задачи ─────────────────────────

function importMeetingTasks() {
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div>Вставьте таблицу задач — ответ Claude по промпту «Оперативка → задачи» или строки из протокола (столбцы через «|» или табуляцию):</div>' +
    '<div style="color:#80868B;font-size:12px;margin:4px 0">' + MEETING_COLS.join(' | ') + '</div>' +
    '<textarea id="t" style="width:100%;height:250px;font:12px monospace"></textarea>' +
    '<div style="margin-top:8px"><button onclick="prev()">Проверить</button> <button id="go" onclick="go()" disabled>Внести задачи</button></div>' +
    '<div id="r" style="margin-top:8px;font-size:12px;max-height:150px;overflow:auto"></div></div>' +
    '<script>' +
    'function esc(s){return String(s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}' +
    'function prev(){google.script.run.withSuccessHandler(function(x){var h="Задач: <b>"+x.ok.length+"</b>"+(x.ok.length?"<ul>"+x.ok.map(function(o){return "<li>"+esc(o.obj_id+": "+o.task+" — "+(o.owner||"без исполнителя")+", срок "+o.deadlineText+(o.decision?" · решение":""))+"</li>";}).join("")+"</ul>":"");' +
    'if(x.errors.length)h+="<div style=\\"color:#B71C1C\\">Пропущено:<br>"+x.errors.map(esc).join("<br>")+"</div>";document.getElementById("r").innerHTML=h;document.getElementById("go").disabled=!x.ok.length;}).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).previewMeetingTasks(document.getElementById("t").value);}' +
    'function go(){document.getElementById("go").disabled=true;google.script.run.withSuccessHandler(function(m){document.getElementById("r").innerHTML="<b>"+esc(m)+"</b>";}).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).addMeetingTasks(document.getElementById("t").value);}' +
    '</script>').setWidth(680).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Задачи с оперативки');
}

function previewMeetingTasks(text) {
  const r = parseMeetingTasks_(text);
  return { ok: r.ok.map(o => ({ obj_id: o.obj_id, task: o.task, owner: o.owner, deadlineText: o.deadline ? fmtDate_(o.deadline) : 'пятница текущей недели', decision: !!o.decision })), errors: r.errors };
}

function addMeetingTasks(text) {
  const r = parseMeetingTasks_(text);
  if (!r.ok.length) return 'Нет задач для внесения.';
  const lock = userLock_();
  try {
    const res = addMeetingTasks_(r);
    return 'Внесено задач: ' + res.tasks + (res.decisions ? ', решений во вкладки объектов: ' + res.decisions : '') + (r.errors.length ? '. Пропущено строк: ' + r.errors.length : '') + '.';
  } finally {
    lock.releaseLock();
  }
}

/** Разобранные строки → 02_ЗАДАЧИ (+ решения во вкладки и документ стратегии). Блокировку держит вызывающий. */
function addMeetingTasks_(r, source) {
  const cache = {};
  const openName = dictFirstByClass_('task_status', CLS.OPEN);
  const user = userEmail_();
  const today = today_();
  const rows = r.ok.filter(o => o.task).map(o => {
    const deadline = o.deadline || addDays_(mondayOf_(today), 4);
    return {
      id: nextId_('TASK', cache), week: isoWeekKey_(deadline), obj_id: o.obj_id, block: o.block, task: o.task, owner: o.owner,
      unit: o.unit, plan: o.plan, deadline: deadline, status: openName, to_report: true, source: source || 'Оперативка', created_at: new Date(), author: user,
    };
  });
  appendRows_('TASK', rows);
  let dec = 0;
  const hist = [];
  r.ok.filter(o => o.decision).forEach(o => {
    const obj = objectById_(o.obj_id);
    const tab = obj ? findObjectTab_(obj) : null;
    if (!tab) return;
    appendTabRow_(tab, 'DEC', [today, o.decision, o.owner || '', o.task || '']);
    hist.push({ sheet: tab.getName(), record_id: 'раздел 7', obj_id: o.obj_id, field: '7. ВЫВОДЫ И РЕШЕНИЯ · с оперативки', old: '', new: o.decision, kind: HIST_KIND.CREATE });
    dec++;
  });
  // решения с оперативки — в документ стратегии каждого объекта
  const byObj = {};
  r.ok.filter(o => o.decision).forEach(o => { (byObj[o.obj_id] = byObj[o.obj_id] || []).push(o.decision + (o.task ? ' → ' + o.task : '')); });
  Object.keys(byObj).forEach(id => { const obj = objectById_(id); if (obj) { try { appendStrategyDoc_(obj, 'решения с оперативки', [{ title: 'Решения', lines: byObj[id] }]); } catch (e) { /* документ пополнится вручную */ } } });
  logHistory_(hist, user);
  return { tasks: rows.length, decisions: dec };
}

/** Разбор таблицы: «|»-таблица (markdown) или строки через табуляцию. */
function parseMeetingTasks_(text, forceObjId) {
  const objs = readTable_('OBJ').rows.filter(o => o.id);
  const people = dictValues_('people');
  const blocks = dictValues_('task_blocks');
  const units = dictValues_('units');
  const ok = [], errors = [];
  const norm = s => String(s || '').trim().toLowerCase();
  String(text || '').split(/\r?\n/).forEach((line, n) => {
    if (!line.trim() || /^\s*\|?\s*:?-{2,}/.test(line)) return;
    let cells = line.indexOf('\t') >= 0 ? line.split('\t') : line.split('|');
    if (line.indexOf('\t') < 0 && line.trim()[0] === '|') cells = cells.slice(1, line.trim().slice(-1) === '|' ? -1 : undefined);
    cells = cells.map(c => c.trim());
    if (cells.length < 3) return;
    if (/id объекта|^задача$/i.test(cells[0]) || norm(cells[2]) === 'задача' || norm(cells[1]) === 'задача') return; // заголовок
    // задачи из стратегии одного объекта: объект известен; если столбец ID Claude пропустил — добавляем
    if (forceObjId) {
      const hasId = cells.length > 7 || objs.some(o => norm(o.id) === norm(cells[0]));
      cells = [String(forceObjId)].concat(hasId ? cells.slice(1) : cells);
    }
    const [rawObj, rawBlock, task, rawOwner, rawUnit, rawPlan, rawDate, decision] = cells.concat(['', '', '', '', '', '', '', '']);
    const obj = objs.find(o => norm(o.id) === norm(rawObj)) || objs.find(o => norm(o.name) === norm(rawObj)) ||
      objs.find(o => norm(rawObj) && norm(o.name).indexOf(norm(rawObj)) >= 0);
    if (!obj) { errors.push('Строка ' + (n + 1) + ': объект «' + rawObj + '» не найден в 01_ОБЪЕКТЫ'); return; }
    if (!task && !decision) { errors.push('Строка ' + (n + 1) + ': нет задачи'); return; }
    const owner = people.find(p => norm(p) === norm(rawOwner)) || '';
    if (rawOwner && !owner) errors.push('Строка ' + (n + 1) + ': исполнитель «' + rawOwner + '» не из 07_СПРАВОЧНИКИ — задача внесена без исполнителя');
    const plan = rawPlan && !isNaN(Number(String(rawPlan).replace(',', '.'))) ? Number(String(rawPlan).replace(',', '.')) : '';
    ok.push({
      obj_id: obj.id, task: task, owner: owner, plan: plan, decision: decision || '',
      block: blocks.find(b => norm(b) === norm(rawBlock)) || (blocks.indexOf('Другое') >= 0 ? 'Другое' : ''),
      unit: units.find(u => norm(u) === norm(rawUnit)) || '',
      deadline: parseRuDate_(rawDate),
    });
  });
  return { ok: ok, errors: errors };
}

/** «25.09.2026», «25.09.26», «25.09» → дата. */
function parseRuDate_(s) {
  const m = /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/.exec(String(s || ''));
  if (!m) return null;
  const t = today_();
  let y = m[3] ? Number(m[3]) : t.getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

/** Добавляет строку в табличный раздел вкладки: в первую пустую строку, иначе вставляет новую в конец раздела. */
function appendTabRow_(sh, secKey, values) {
  const max = sh.getLastRow();
  const marks = sh.getRange(1, 1, max, 2).getValues();
  let inSec = false, inData = false, firstEmpty = 0, lastData = 0;
  for (let r = 0; r < marks.length; r++) {
    const m = String(marks[r][0] || '');
    if (m.indexOf('§') === 0) { if (inSec) break; inSec = m === '§' + secKey; inData = false; continue; }
    if (!inSec) continue;
    if (m === 'H') { inData = true; continue; }
    if (m === '·') break;
    if (inData) {
      lastData = r + 1;
      if (!firstEmpty && String(marks[r][1]) === '') firstEmpty = r + 1;
    }
  }
  if (!lastData) throw new Error('Раздел ' + secKey + ' не найден во вкладке ' + sh.getName());
  let row = firstEmpty;
  if (!row) { sh.insertRowAfter(lastData); row = lastData + 1; }
  sh.getRange(row, 2, 1, values.length).setValues([values]);
  return row;
}
