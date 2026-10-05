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
  const out = { tables: {}, kv: {}, taskLines: [], baseLines: [], contLines: [] };
  let cur = null;
  String(text || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    const h = /^#{1,4}\s*(.+)$/.exec(line) || /^\*\*(.+?)\*\*:?$/.exec(line);
    if (h) {
      const t = h[1].trim();
      cur = /^задач/i.test(t) ? { tasks: true } : /^база/i.test(t) ? { base: true } : /^контент/i.test(t) ? { cont: true } : STRAT_SECTIONS.find(s => s.re.test(t)) || null;
      return;
    }
    if (!cur) return;
    if (cur.tasks) { out.taskLines.push(line); return; }
    if (cur.base) { out.baseLines.push(line); return; }
    if (cur.cont) { out.contLines.push(line); return; }
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

/** «Аудитория | Компания | Сайт | Кому звонить | Почему подходит» → строки 03_ОБЗВОН_И_КП (без дублей по компании у объекта). */
function strategyBaseRows_(obj, lines, plan) {
  const norm = x => String(x || '').trim().toLowerCase().replace(/[«»"']/g, '');
  const have = readTable_('BASE').rows.filter(r => String(r.obj_id) === String(obj.id)).map(r => norm(r.company));
  const owner = teamDefaults_().assistant || '';
  const out = [];
  lines.forEach(line => {
    if (line.indexOf('|') < 0 || /^\|?\s*:?-{2,}/.test(line)) return;
    const c = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim().replace(/^\*\*|\*\*$/g, ''));
    if (c.length < 2 || !c[1] || /^компания$/i.test(c[1]) || /^аудитори/i.test(c[0]) && /компани/i.test(c[1])) return;
    if (have.indexOf(norm(c[1])) >= 0) { plan.skipped++; return; }
    have.push(norm(c[1]));
    const site = /^(https?:\/\/|www\.|[\w-]+\.[a-zа-я]{2,})/i.test(c[2] || '') ? c[2] : '';
    const row = { obj_id: String(obj.id), audience: c[0], company: c[1], site: site, contact: c[3] || '', fit_note: c[4] || '', owner: owner };
    // необязательно: 6-я колонка — дата КП (перенос уже сделанной работы), 7-я — ответ / комментарий
    const kpDate = parseRuDate_(c[5]);
    if (kpDate) { row.kp_date = kpDate; row.kp_type = dictValues_('kp_types')[0] || ''; }
    if (c[6]) {
      const resp = dictValues_('responses').find(x => x.toLowerCase() === c[6].toLowerCase());
      if (resp) { row.response = resp; row.response_date = kpDate || today_(); } else row.call_result = c[6];
    }
    if (c[7]) { row.next_step = c[7]; row.next_date = parseRuDate_(c[7]) || today_(); } // 8-я колонка — следующий шаг (дата внутри текста или сегодня)
    out.push(row);
    const other = companyElsewhere_(c[1], obj.id);
    if (other.length) (plan.baseDup = plan.baseDup || []).push(c[1] + ' — уже по объекту ' + other.map(x => (objectById_(x.obj_id) || {}).name || x.obj_id).join(', '));
  });
  return out;
}

/**
 * «Тема | Площадка | Формат | Цель | Дата | Кто делает | Сценарий» → строки 04_КОНТЕНТ (без дублей: объект + тема + площадка).
 * Необязательно дальше: Рубрика | Этап воронки | Крючок | CTA | ТЗ на съёмку | Статус. Площадок можно несколько через запятую.
 */
function strategyContentRows_(obj, lines, plan) {
  const norm = x => String(x || '').trim().toLowerCase();
  const pick = (dict, v, fallback) => {
    const vals = dictValues_(dict), n = norm(v);
    if (!n) return fallback;
    return vals.find(x => norm(x) === n) || vals.find(x => n.indexOf(norm(x).split(' ')[0]) >= 0 || norm(x).indexOf(n) >= 0) ||
      (dict === 'platforms' && /vk|вк/.test(n) ? vals.find(x => /vk/i.test(x)) : '') || (dict === 'platforms' && /youtube|ютуб|shorts/.test(n) ? vals.find(x => /youtube/i.test(x)) : '') || fallback;
  };
  const people = dictRows_('people');
  const smm = (people.find(p => /smm/i.test(String(p[1]))) || [])[0] || '';
  const have = readTable_('CONT').rows.filter(r => String(r.obj_id) === String(obj.id)).map(r => norm(r.topic) + '|' + norm(r.platform));
  const out = [];
  lines.forEach(line => {
    if (line.indexOf('|') < 0 || /^\|?\s*:?-{2,}/.test(line)) return;
    const c = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim().replace(/^\*\*|\*\*$/g, ''));
    if (!c[0] || /^(ролик|тема)$/i.test(c[0]) || /площадк/i.test(c[1] || '') && /^(ролик|тема)/i.test(c[0])) return;
    const plats = String(c[1] || '').split(/\s*[,;+]\s*/).filter(Boolean);
    (plats.length ? plats : ['']).forEach(pl => {
      const platform = pick('platforms', pl, dictValues_('platforms').indexOf('Другое') >= 0 ? 'Другое' : '');
      const key = norm(c[0]) + '|' + norm(platform);
      if (have.indexOf(key) >= 0) { plan.skipped++; return; }
      have.push(key);
      const owner = people.map(p => p[0]).find(p => norm(p) === norm(c[5])) || smm;
      const row = { obj_id: String(obj.id), topic: c[0], platform: platform, format: pick('content_formats', c[2], 'Рилс'), goal: pick('content_goals', c[3], ''),
        pub_date: parseRuDate_(c[4]) || '', owner: owner, script: c[6] || '', status: dictValues_('content_status')[0] || '' };
      const exact = (dict, v) => { const n = norm(v); return n ? (dictValues_(dict).find(x => norm(x) === n) || dictValues_(dict).find(x => norm(x).indexOf(n) >= 0 || n.indexOf(norm(x)) >= 0) || '') : ''; };
      row.rubric = exact('content_rubrics', c[7]);
      row.funnel = exact('content_funnel', c[8]) || ((smmRubrics_().find(x => x.name === row.rubric) || {}).funnel || '');
      if (c[9]) row.hook = c[9];
      if (c[10]) row.cta = c[10];
      if (c[11]) row.brief = c[11];
      if (c[12]) row.status = exact('content_status', c[12]) || row.status;
      out.push(row);
    });
  });
  return out;
}

/** Добавляет компании в 03_ОБЗВОН_И_КП и ставит в строках список аудиторий объекта. */
function addBaseRows_(rows) {
  const cache = {};
  const now = new Date(), user = userEmail_();
  appendRows_('BASE', rows.map(r => Object.assign({ id: nextId_('BASE', cache), created_at: now, author: user }, r)));
  try { refreshBaseAudienceLists_(rows.map(r => r.obj_id)); } catch (e) { /* списки обновятся утром */ }
}

const KV_LABELS = { rec_price: 'Рекомендуемая цена', min_price: 'Минимальная цена', positioning: 'Позиционирование', price_note: 'Вывод по цене' };
function kvLabel_(k) { return KV_LABELS[k] || k; }
function fmtKv_(v) { return typeof v === 'number' ? v.toLocaleString('ru-RU') : String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v); }

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
  // цена и позиционирование: пустое заполняется, изменившееся — обновляется (прежнее значение уходит в 09_ИСТОРИЯ)
  const kv = {}, kvOld = {};
  Object.keys(parsed.kv).forEach(k => {
    const v = parsed.kv[k], old = have.kv[k];
    if (v === '' || v === undefined) return;
    const empty = old === '' || old === undefined || old === null;
    if (!empty && String(old).trim() === String(v).trim()) return;
    kv[k] = v;
    if (!empty) kvOld[k] = old;
  });
  const plan = { obj: obj, tab: tab, rows: {}, kv: kv, kvOld: kvOld, skipped: 0, tasks: [], taskErrors: [], base: [] };
  if (parsed.baseLines.length) plan.base = strategyBaseRows_(obj, parsed.baseLines, plan);
  plan.cont = parsed.contLines.length ? strategyContentRows_(obj, parsed.contLines, plan) : [];
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
    if (s.kv) {
      const n = Object.keys(p.kv).length, upd = Object.keys(p.kvOld).length;
      return n ? s.name + ': ' + n + ' поля' + (upd ? ' (обновится ' + upd + ': ' + Object.keys(p.kvOld).map(k => kvLabel_(k) + ' ' + fmtKv_(p.kvOld[k]) + ' → ' + fmtKv_(p.kv[k])).join('; ') + ')' : '') : '';
    }
    const n = (p.rows[s.key] || []).length;
    return n ? s.name + ': ' + n + ' строк' : '';
  }).filter(Boolean);
  if (p.tasks.length) parts.push('Задачи в 02_ЗАДАЧИ: ' + p.tasks.length);
  if (p.base.length) parts.push('Компании в 03_ОБЗВОН_И_КП: ' + p.base.length);
  if (p.cont.length) parts.push('Публикации в 04_КОНТЕНТ: ' + p.cont.length);
  const dupNote = p.baseDup && p.baseDup.length ? '<br><span style="color:#E65100">Уже в работе по другим объектам (согласуйте, чтобы не звонить дважды):<br>' + p.baseDup.map(htmlEscape_).join('<br>') + '</span>' : '';
  const total = parts.length;
  const errs = p.taskErrors.length ? '<br><span style="color:#B71C1C">' + p.taskErrors.map(htmlEscape_).join('<br>') + '</span>' : '';
  return {
    total: total,
    html: total ? 'Будет добавлено во вкладку «' + htmlEscape_(p.obj.name) + '»:<br>• ' + parts.map(htmlEscape_).join('<br>• ') + (p.skipped ? '<br><span style="color:#80868B">Уже есть во вкладке, пропущено: ' + p.skipped + '</span>' : '') + errs + dupNote
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
    const kvKeys = Object.keys(p.kv);
    const kvHist = [];
    if (kvKeys.length) {
      const marks = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
      kvKeys.forEach(k => {
        const i = marks.findIndex(m => String(m[0]) === 'K:' + k);
        if (i < 0) return;
        sh.getRange(i + 1, 3).setValue(p.kv[k]); n++;
        if (k in p.kvOld) kvHist.push({ sheet: sh.getName(), record_id: p.obj.id, obj_id: p.obj.id, field: '2. ' + kvLabel_(k), old: p.kvOld[k], new: p.kv[k], kind: HIST_KIND.CHANGE });
      });
    }
    let tasks = 0;
    if (p.tasks.length) tasks = addMeetingTasks_({ ok: p.tasks, errors: [] }, 'Стратегия').tasks;
    if (p.base.length) addBaseRows_(p.base);
    if (p.cont.length) { const cc = {}; appendRows_('CONT', p.cont.map(r => Object.assign({ id: nextId_('CONT', cc), created_at: new Date(), author: userEmail_() }, r))); }
    try { refreshIdleAudiences_(); } catch (e) { /* обновится утром */ }
    let docNote = '';
    try { if (n || tasks) { appendStrategyDoc_(p.obj, 'стратегия из Claude', strategyThesis_(p)); docNote = ' Документ «' + strategyDocName_(p.obj) + '» в папке объекта пополнен.'; } }
    catch (e) { docNote = ' ⚠ Документ стратегии не пополнен: ' + e.message; }
    logHistory_(kvHist.concat([{ sheet: sh.getName(), record_id: p.obj.id, obj_id: p.obj.id, field: 'Стратегия', old: '', new: 'вставлено из Claude: ' + n + (tasks ? ', задач: ' + tasks : '') + (p.base.length ? ', компаний в базу: ' + p.base.length : '') + (p.cont.length ? ', публикаций: ' + p.cont.length : ''), kind: HIST_KIND.CHANGE }]), userEmail_());
    return 'Готово: добавлено ' + n + ' строк / полей во вкладку «' + p.obj.name + '»' + (tasks ? ', задач в 02_ЗАДАЧИ: ' + tasks : '') + (p.base.length ? ', компаний в 03_ОБЗВОН_И_КП: ' + p.base.length : '') + (p.cont.length ? ', публикаций в 04_КОНТЕНТ: ' + p.cont.length : '') + (p.skipped ? ', пропущено как уже внесённые: ' + p.skipped : '') + '.' + docNote + ' Проверьте вкладку.';
  } finally {
    lock.releaseLock();
  }
}
