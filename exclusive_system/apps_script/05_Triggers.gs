/**
 * 05_Triggers — автоматика при редактировании (устанавливаемый триггер onEdit).
 *
 *  - ставит ID задачам, строкам обзвона, контенту, библиотеке; дату, статус и неделю по умолчанию; автора;
 *  - ID объекта вводится вручную (из CRM): скрипт проверяет его и при исправлении обновляет во всех листах;
 *  - новый объект (ID + название) сразу получает свою вкладку «▸ Название (ID)»;
 *  - пишет изменения в 09_ИСТОРИЯ: отслеживаемые поля журналов и все правки во вкладках объектов;
 *  - задача со статусом «Перенесено» копируется на следующую неделю, исходная остаётся;
 *  - галочка «Передан в CRM» в 03 → заметка в карточку клиента в TopenLab (если CRM подключена).
 */

function onEditHandler(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (isObjectTab_(sh)) {
    try { handleObjectTabEdit_(e, sh); } catch (err) { toast_('История не записана: ' + err.message, 'Внимание', 8); }
    return;
  }
  if (sh.getName() === SHEET_NAMES.DICT) {
    try { handleDictEdit_(e); } catch (err) { toast_('Справочник: ' + err.message, 'Внимание', 8); }
    return;
  }
  const spec = specBySheetName_(sh.getName());
  if (!spec || spec.readonly) return;
  const rLast = e.range.getLastRow();
  if (rLast < 2) return;
  const c0 = e.range.getColumn();
  if (c0 > spec.fields.length) return; // правки в боковых блоках-фильтрах
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return;
  try {
    processEditedRows_(sh, spec, Math.max(2, e.range.getRow()), rLast, c0, Math.min(e.range.getLastColumn(), spec.fields.length), e);
  } catch (err) {
    toast_('Ошибка автоматики: ' + err.message, 'Внимание', 10);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Команда по умолчанию для каждого объекта: руководитель и ассистент (по роли в 07_СПРАВОЧНИКИ).
 * Ассистент ведёт все объекты — ставится всем текущим и новым, если поле пустое.
 */
function teamDefaults_() {
  const res = {};
  dictRows_('people').forEach(p => {
    const name = String(p[0] || '').trim(), role = String(p[1] || '').toLowerCase();
    if (!name) return;
    if (!res.manager && /руководит/.test(role)) res.manager = name;
    if (!res.assistant && /ассистент/.test(role)) res.assistant = name;
  });
  return res;
}

/** Проставить команду по умолчанию объектам, у которых поля пустые. Возвращает число изменённых объектов. */
function fillTeamDefaults_() {
  const team = teamDefaults_();
  if (!Object.keys(team).length) return 0;
  const t = readTable_('OBJ');
  let n = 0;
  t.rows.forEach(o => {
    if (!o.id || !o.name) return;
    const upd = {};
    Object.keys(team).forEach(k => { if (!o[k] && team[k]) upd[k] = team[k]; });
    if (Object.keys(upd).length) { writeFields_(t.sh, 'OBJ', o._row, upd); n++; }
  });
  return n;
}

/** Переименовали сотрудника в 07_СПРАВОЧНИКИ («Ассистент» → «Мария») — имя меняется во всех журналах и объектах. */
function handleDictEdit_(e) {
  const d = dictLayout_().people;
  if (!d || e.range.getColumn() !== d.col || e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1 || e.range.getRow() < 2) return;
  const oldName = String(e.oldValue || '').trim(), newName = String(e.value || '').trim();
  if (!oldName || !newName || oldName === newName) return;
  const n = renamePerson_(oldName, newName);
  logHistory_([{ sheet: SHEET_NAMES.DICT, record_id: 'Сотрудник', field: 'Имя', old: oldName, new: newName, kind: HIST_KIND.CHANGE, note: 'заменено в журналах: ' + n }], userEmail_(e));
  if (n) toast_('«' + oldName + '» → «' + newName + '»: заменено ' + n + ' раз в объектах и журналах.', 'Сотрудник переименован', 8);
}

function renamePerson_(oldName, newName) {
  let n = 0;
  [['OBJ', ['manager', 'assistant', 'smm']], ['TASK', ['owner']], ['BASE', ['owner']], ['CONT', ['owner']]].forEach(p => {
    const sh = sheet_(p[0]);
    p[1].forEach(k => {
      const col = fieldIndex_(p[0], k);
      n += sh.getRange(2, col, sh.getMaxRows() - 1, 1).createTextFinder(oldName).matchEntireCell(true).replaceAllWith(newName) || 0;
    });
  });
  return n;
}

function processEditedRows_(sh, spec, r0, rLast, c0, cLast, e) {
  const code = spec.code;
  const n = rLast - r0 + 1;
  const vals = sh.getRange(r0, 1, n, spec.fields.length).getValues();
  const user = userEmail_(e);
  const single = n === 1 && c0 === cLast;
  const editedKeys = spec.fields.slice(c0 - 1, cLast).map(f => f.key);
  const hist = [];
  const idCache = {};
  const tabSync = [];
  const renamed = [];
  const crmRows = [];
  for (let i = 0; i < n; i++) {
    const row = r0 + i;
    const o = {};
    spec.fields.forEach((f, j) => { o[f.key] = vals[i][j]; });
    const hasInput = spec.fields.some(f => isInputKind_(f.kind) && f.kind !== 'cb' && o[f.key] !== '' && o[f.key] !== null);
    if (!hasInput) continue;
    const upd = {};
    let isNew = false;
    if (code === 'OBJ') {
      if (typeof o.id === 'number') { o.id = String(o.id); upd.id = o.id; }
      else if (typeof o.id === 'string' && o.id !== o.id.trim()) { o.id = o.id.trim(); upd.id = o.id; }
      isNew = !!o.id && !o.created_at;
      if (single && editedKeys[0] === 'id' && e.oldValue && o.id && String(e.oldValue).trim() !== o.id) renamed.push([String(e.oldValue).trim(), o.id]);
      if (!o.id && o.name) toast_('Укажите ID объекта из CRM для «' + o.name + '» — без ID объект не попадает в расчёты.', 'Нет ID', 8);
      if (o.id && editedKeys.indexOf('id') >= 0) {
        const all = sh.getRange(2, 1, sh.getMaxRows() - 1, 1).getDisplayValues().filter(v => v[0].trim() === o.id).length;
        if (all > 1) toast_('ID ' + o.id + ' уже есть в 01_ОБЪЕКТЫ. ID должен быть уникальным.', 'Дубль ID', 10);
      }
    }
    if (spec.idField && !o[spec.idField]) {
      upd[spec.idField] = nextId_(code, idCache);
      o[spec.idField] = upd[spec.idField];
      isNew = true;
    }
    applyDefaults_(code, o, upd, isNew, user, editedKeys);
    // история изменений отслеживаемых полей
    editedKeys.forEach(k => {
      const f = fieldOf_(code, k);
      if (!f.track) return;
      const nv = o[k];
      let ov;
      if (single) ov = normalizeOld_(f, e.oldValue);
      else ov = isNew ? '' : '(массовое изменение)';
      if (ov === '' && (nv === '' || nv === null)) return;
      if (single && sameValue_(ov, nv)) return;
      hist.push({
        sheet: spec.name, record_id: recordId_(code, o), obj_id: code === 'OBJ' ? o.id : o.obj_id,
        field: f.title, old: ov, new: nv, kind: ov === '' ? HIST_KIND.INITIAL : HIST_KIND.CHANGE,
      });
    });
    if (Object.keys(upd).length) writeFields_(sh, code, row, upd);
    if (code === 'OBJ' && o.id && o.name && (isNew || !o.tab_url || editedKeys.indexOf('id') >= 0 || editedKeys.indexOf('name') >= 0)) {
      o._row = row;
      tabSync.push(o);
    }
    if (code === 'BASE' && editedKeys.indexOf('to_crm') >= 0 && o.to_crm === true && String(o.crm_note).indexOf('✓') !== 0) { o._row = row; crmRows.push(o); }
    if (code === 'TASK' && !isNew && editedKeys.indexOf('status') >= 0 && dictClassOf_('task_status', o.status) === CLS.MOVED) {
      const newId = moveTask_(o, hist);
      if (newId) toast_('Задача ' + o.id + ' перенесена на следующую неделю как ' + newId + '. Исходная строка сохранена.');
    }
  }
  renamed.forEach(p => {
    renameObjectId_(p[0], p[1]);
    hist.push({ sheet: spec.name, record_id: p[1], obj_id: p[1], field: fieldTitle_('OBJ', 'id'), old: p[0], new: p[1], kind: HIST_KIND.CHANGE, note: 'ID обновлён во всех листах' });
    toast_('ID ' + p[0] + ' → ' + p[1] + ' обновлён во всех связанных листах.');
  });
  if (code === 'OBJ' && editedKeys.indexOf('status') >= 0) {
    try { applyTabVisibility_(); } catch (err) { /* не критично */ }
  }
  tabSync.slice(0, 5).forEach(o => {
    const r = syncObjectTab_(o, 'create');
    if (r && r.built) toast_('Создана вкладка «' + r.sheet.getName() + '» — там стратегия объекта.', 'Новый объект', 8);
  });
  logHistory_(hist, user);
  if (crmRows.length) {
    try { crmOnEdit_(sh, crmRows); } catch (err) { toast_('CRM: ' + err.message, 'Внимание', 8); }
  }
}

function applyDefaults_(code, o, upd, isNew, user, editedKeys) {
  const now = new Date();
  const today = today_();
  const set = (k, v) => { upd[k] = v; o[k] = v; };
  if (code === 'OBJ' && isNew) {
    set('created_at', today);
    if (!o.status) set('status', dictValues_('obj_status')[0] || '');
    const team = teamDefaults_();
    Object.keys(team).forEach(k => { if (!o[k] && team[k]) set(k, team[k]); });
  }
  if (code === 'TASK' && isNew) {
    if (!o.week) set('week', isoWeekKey_(today));
    if (!o.status) set('status', dictFirstByClass_('task_status', CLS.OPEN));
    if (!o.deadline) { const m = mondayOfWeekKey_(o.week); if (m) set('deadline', addDays_(m, 4)); }
    if (!o.owner) { const p = personByEmail_(user); if (p) set('owner', p); }
    if (!o.source) set('source', 'Вручную');
    set('to_report', true);
    set('created_at', now);
    set('author', user);
  }
  if ((code === 'BASE' || code === 'CONT') && isNew) {
    if (!o.owner) { const p = personByEmail_(user); if (p) set('owner', p); }
    if (code === 'CONT' && !o.status) set('status', dictValues_('content_status')[0] || '');
    set('created_at', now);
    set('author', user);
  }
  if (code === 'BASE' && editedKeys.indexOf('response') >= 0 && o.response && !o.response_date) set('response_date', today);
  if (code === 'CONT' && editedKeys.indexOf('status') >= 0 && dictClassOf_('content_status', o.status) === CLS.DONE && !o.pub_date) set('pub_date', today);
  if (code === 'LIB') {
    const content = editedKeys.some(k => ['kind', 'title', 'applies', 'text'].indexOf(k) >= 0);
    if (content) { set('updated_at', now); set('author', user); }
  }
}

function recordId_(code, o) {
  const spec = sheetSpecs_()[code];
  if (code === 'OBJ') return o.id;
  if (spec.idField) return o[spec.idField];
  return o.obj_id || '';
}

/** e.oldValue приходит строкой: даты — серийным числом, суммы — числом в строке. */
function normalizeOld_(f, v) {
  if (v === undefined || v === null || v === '') return '';
  if (f.kind === 'date' && /^\d+(\.\d+)?$/.test(String(v))) {
    const ms = Math.round(Number(v) * 86400000);
    const d = new Date(Date.UTC(1899, 11, 30) + ms);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  if ((f.kind === 'money' || f.kind === 'num') && !isNaN(Number(v))) return Number(v);
  return v;
}

function sameValue_(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return String(a) === String(b);
}

/** Исправили ID объекта в 01 → заменить старый ID в журналах, во вкладке объекта и в имени папки Drive. */
function renameObjectId_(oldId, newId) {
  ['TASK', 'BASE', 'CONT', 'ARCH', 'HIST'].forEach(code => {
    const sh = sheet_(code);
    const col = fieldIndex_(code, 'obj_id');
    sh.getRange(2, col, sh.getMaxRows() - 1, 1).createTextFinder(oldId).matchEntireCell(true).replaceAllWith(newId);
  });
  fixObjIdColumns_(); // «137073408» после замены Google превращает в число — возвращаем текст
  objectTabs_().forEach(t => {
    if (String(t.getRange(TAB.ID).getValue()) === oldId) t.getRange(TAB.ID).setNumberFormat('@').setValue(newId);
  });
  try {
    const parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID'));
    if (!parent) return;
    const it = parent.getFolders();
    const suffix = '(' + oldId + ')';
    while (it.hasNext()) {
      const f = it.next();
      if (f.getName().slice(-suffix.length) === suffix) f.setName(f.getName().slice(0, -suffix.length) + '(' + newId + ')');
    }
  } catch (err) { /* папку можно переименовать вручную */ }
}

/** Копия задачи на следующую неделю. Исходная строка остаётся со статусом «Перенесено». */
function moveTask_(o, hist, targetWeek) {
  const t = readTable_('TASK');
  if (t.rows.some(r => r.moved_from === o.id)) return null;
  const baseMon = mondayOfWeekKey_(o.week) || mondayOf_(today_());
  const nextKey = targetWeek || isoWeekKey_(addDays_(baseMon, 7));
  const nextMon = mondayOfWeekKey_(nextKey);
  const deadline = o.deadline instanceof Date ? addDays_(o.deadline, 7) : addDays_(nextMon, 4);
  const newId = nextId_('TASK');
  appendRow_('TASK', {
    id: newId, week: nextKey, obj_id: o.obj_id, block: o.block, task: o.task, owner: o.owner, unit: o.unit, plan: o.plan,
    status: dictFirstByClass_('task_status', CLS.OPEN), deadline: deadline, to_report: o.to_report === '' ? true : o.to_report,
    source: o.source, moved_from: o.id, created_at: new Date(), author: 'перенос',
  });
  hist.push({
    sheet: SHEET_NAMES.TASK, record_id: o.id, obj_id: o.obj_id, field: fieldTitle_('TASK', 'week'),
    old: o.week, new: nextKey, kind: HIST_KIND.MOVE, note: 'Создана копия ' + newId + ' (срок ' + fmtDate_(deadline) + ')',
  });
  return newId;
}

/** Пакетное добавление строк (одно чтение «последней строки» на все строки). */
function appendRows_(code, objs) {
  if (!objs.length) return [];
  const sh = sheet_(code);
  const spec = sheetSpecs_()[code];
  let row = lastDataRow_(sh, spec) + 1;
  if (row + objs.length > sh.getMaxRows()) extendSheet_(code, Math.max(500, objs.length + 100));
  const rows = [];
  objs.forEach(o => { writeFields_(sh, code, row, o); rows.push(row); row++; });
  return rows;
}
