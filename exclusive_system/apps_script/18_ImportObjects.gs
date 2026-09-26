/**
 * 18_ImportObjects — «Загрузить объекты списком»: вставить таблицу (из CRM, Excel, Google Таблицы)
 * и разом добавить объекты в 01_ОБЪЕКТЫ. Формульные столбцы не затрагиваются, вкладки создаются сами.
 * Объекты с уже существующим ID не дублируются — у них дополняются пустые поля.
 * С ID из CRM, а объект уже заведён с временным ID (НОВ-001, ВРЕМЯ-1) и то же название / адрес — ID заменяется везде.
 * Без ID: объект ищется по названию (дополняются пустые поля), не найден — получает временный ID «НОВ-001».
 */

const IMPORT_COLS = [
  ['id', 'ID из CRM'], ['name', 'Название'], ['kind', 'Тип'], ['deal', 'Сделка'], ['address', 'Адрес'],
  ['area', 'Площадь, м²'], ['price', 'Цена'], ['status', 'Статус'], ['manager', 'Ответственный'],
  ['customer', 'Заказчик'], ['contract_no', '№ договора'], ['contract_date', 'Дата договора'], ['crm_link', 'Ссылка на CRM'],
];

function importObjects() {
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div>Скопируйте строки из CRM / Excel / Google Таблицы и вставьте сюда. Столбцы по порядку (лишние справа можно не заполнять):</div>' +
    '<div style="color:#37474F;font-size:12px;margin:6px 0"><b>' + IMPORT_COLS.map(c => c[1]).join(' | ') + '</b></div>' +
    '<div style="color:#80868B;font-size:12px">Обязательно только название. Без ID из CRM объект получит временный ID «' + INBOX_TEMP_PREFIX + '001» (замените потом в 01_ОБЪЕКТЫ). Строка заголовков, если есть, пропустится сама.</div>' +
    '<textarea id="t" style="width:100%;height:230px;font:12px monospace;margin-top:6px"></textarea>' +
    '<div style="margin-top:8px"><button onclick="prev()">Проверить</button> <button id="go" onclick="go()" disabled>Загрузить</button></div>' +
    '<div id="r" style="margin-top:8px;font-size:12px;max-height:150px;overflow:auto"></div></div><script>' +
    'function esc(s){return String(s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}' +
    'function prev(){google.script.run.withSuccessHandler(function(x){var h="Новых: <b>"+x.add+"</b>, уже есть (дополнятся пустые поля): <b>"+x.upd+"</b>";' +
    'if(x.names.length)h+="<ul>"+x.names.map(function(n){return "<li>"+esc(n)+"</li>";}).join("")+"</ul>";' +
    'if(x.errors.length)h+="<div style=\\"color:#B71C1C\\">"+x.errors.map(esc).join("<br>")+"</div>";document.getElementById("r").innerHTML=h;document.getElementById("go").disabled=!(x.add+x.upd);})' +
    '.withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).previewObjectsImport(document.getElementById("t").value);}' +
    'function go(){document.getElementById("go").disabled=true;document.getElementById("r").textContent="Загружаю и создаю вкладки… (до минуты)";google.script.run.withSuccessHandler(function(m){document.getElementById("r").innerHTML="<b>"+esc(m)+"</b>";})' +
    '.withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).runObjectsImport(document.getElementById("t").value);}' +
    '</script>').setWidth(760).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Загрузить объекты списком');
}

function previewObjectsImport(text) {
  const r = parseObjectsImport_(text);
  return { add: r.add.length, upd: r.upd.length, names: r.add.concat(r.upd).map(o => (o._from ? o._from + ' → ' : '') + o.id + ' — ' + o.name), errors: r.errors };
}

function runObjectsImport(text) {
  const r = parseObjectsImport_(text);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  const start = Date.now();
  let tabRes = { created: 0, rebuilt: 0, left: 0 };
  try {
    const now = today_();
    const firstStatus = dictValues_('obj_status')[0] || '';
    appendRows_('OBJ', r.add.map(o => Object.assign({}, o, { status: o.status || firstStatus, created_at: now })));
    const t = readTable_('OBJ');
    const hist = [];
    r.upd.forEach(o => {
      const row = t.rows.find(x => String(x.id) === (o._from || o.id));
      if (!row) return;
      const upd = {};
      Object.keys(o).forEach(k => { if (k !== 'id' && k !== '_from' && k !== 'name' && o[k] !== '' && (row[k] === '' || row[k] === null)) upd[k] = o[k]; });
      if (o._from) {
        upd.id = o.id;
        renameObjectId_(o._from, o.id);
        hist.push({ sheet: SHEET_NAMES.OBJ, record_id: o.id, obj_id: o.id, field: fieldTitle_('OBJ', 'id'), old: o._from, new: o.id, kind: HIST_KIND.CHANGE, note: 'Загрузка списком: ID из CRM' });
      }
      if (Object.keys(upd).length) writeFields_(t.sh, 'OBJ', row._row, upd);
    });
    SpreadsheetApp.flush();
    hist.push.apply(hist, r.add.map(o => ({ sheet: SHEET_NAMES.OBJ, record_id: o.id, obj_id: o.id, field: 'Объект', old: '', new: o.name, kind: HIST_KIND.CREATE, note: 'Загрузка списком' })));
    logHistory_(hist, userEmail_());
    fixObjIdColumns_();
    r.upd.filter(o => o._from).forEach(o => { const obj = objectById_(o.id); if (obj) syncObjectTab_(obj, 'rename'); });
    tabRes = tabsWork_(start);
    orderSheets_();
  } finally {
    lock.releaseLock();
  }
  return 'Добавлено объектов: ' + r.add.length + ', дополнено: ' + r.upd.length + ', ' + tabsWorkText_(tabRes) +
    (r.errors.length ? '. Замечаний: ' + r.errors.length + ' (см. «Проверить»)' : '') + '. Проверьте 01_ОБЪЕКТЫ.';
}

/** ID из CRM — число; «НОВ-001», «ВРЕМЯ-1» и т.п. — временные, их можно заменить при загрузке списка. */
function isCrmId_(id) { return /^\d{4,}$/.test(String(id || '').trim()); }

function parseObjectsImport_(text) {
  const existing = {};
  readTable_('OBJ').rows.forEach(o => { if (o.id) existing[String(o.id)] = true; });
  const pick = (key, v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    const vals = key === 'kind' ? dictValues_('obj_kinds') : key === 'deal' ? dictValues_('deal_types') : key === 'status' ? dictValues_('obj_status') : key === 'manager' ? dictValues_('people') : null;
    if (vals) return vals.find(x => x.toLowerCase() === s.toLowerCase()) || '';
    if (key === 'area' || key === 'price') { const n = Number(s.replace(/[\s ₽руб.]/gi, '').replace(',', '.')); return isNaN(n) ? '' : n; }
    if (key === 'contract_date') return parseRuDate_(s) || '';
    return s;
  };
  const add = [], upd = [], errors = [], seen = {};
  let tempN = Number(String(nextTempObjectId_()).slice(INBOX_TEMP_PREFIX.length)) - 1;
  String(text || '').split(/\r?\n/).forEach((line, n) => {
    if (!line.trim()) return;
    let cells = line.indexOf('\t') >= 0 ? line.split('\t') : line.split(/;|\|/);
    cells = cells.map(c => c.trim());
    if (/^id|^№ ?объекта|^номер/i.test(cells[0]) && /назван|объект/i.test(cells[1] || '')) return; // заголовок
    const o = {};
    IMPORT_COLS.forEach((c, i) => { o[c[0]] = c[0] === 'id' || c[0] === 'name' ? String(cells[i] || '').trim() : pick(c[0], cells[i]); });
    if (!o.name) { errors.push('Строка ' + (n + 1) + ': нет названия'); return; }
    if (!o.id) {
      const same = findObjectByName_(o.name);
      if (same) o.id = String(same.id);
      else { const k = String(++tempN); o.id = INBOX_TEMP_PREFIX + (k.length < 3 ? '00'.slice(k.length - 1) : '') + k; }
    }
    if (seen[o.id]) { errors.push('Строка ' + (n + 1) + ': ID ' + o.id + ' повторяется в списке'); return; }
    seen[o.id] = true;
    if (!existing[o.id]) { // объект уже заведён с временным ID (НОВ-001, ВРЕМЯ-1) — присваиваем ID из CRM
      const same = findObjectByName_(o.name) || (o.address ? findObjectByAddress_(o.address) : null);
      if (same && !isCrmId_(same.id) && !seen[String(same.id)]) { o._from = String(same.id); seen[o._from] = true; }
    }
    ['kind', 'deal', 'status', 'manager'].forEach((k, j) => {
      const raw = String(cells[IMPORT_COLS.findIndex(c => c[0] === k)] || '').trim();
      if (raw && !o[k]) errors.push('Строка ' + (n + 1) + ': «' + raw + '» нет в списке «' + IMPORT_COLS.find(c => c[0] === k)[1] + '» (07_СПРАВОЧНИКИ) — поле оставлено пустым');
    });
    Object.keys(o).forEach(k => { if (o[k] === '') delete o[k]; });
    (existing[o.id] || o._from ? upd : add).push(o);
  });
  return { add: add, upd: upd, errors: errors };
}
