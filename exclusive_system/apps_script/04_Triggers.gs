/**
 * 04_Triggers — автоматика при редактировании (устанавливаемый триггер onEdit).
 *
 * Что делает при вводе данных:
 *  - ставит ID (OBJ-001, ACT-0001, LEAD-0001, TASK-0001), дату, статус по умолчанию, автора;
 *  - пишет изменения цены, статусов, стратегии, дедлайнов в 12_ИСТОРИЯ (старое значение не теряется);
 *  - у лида по статусу отмечает этапы воронки (чекбоксы) и дату сделки;
 *  - задача со статусом «Перенесено» копируется на следующую неделю, исходная остаётся в истории;
 *  - при создании объекта добавляет ему строку в 02_СТРАТЕГИЯ.
 */

function onEditHandler(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
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

function processEditedRows_(sh, spec, r0, rLast, c0, cLast, e) {
  const code = spec.code;
  const n = rLast - r0 + 1;
  const vals = sh.getRange(r0, 1, n, spec.fields.length).getValues();
  const user = userEmail_(e);
  const single = n === 1 && c0 === cLast;
  const editedKeys = spec.fields.slice(c0 - 1, cLast).map(f => f.key);
  const hist = [];
  const idCache = {};
  const newObjects = [];
  for (let i = 0; i < n; i++) {
    const row = r0 + i;
    const o = {};
    spec.fields.forEach((f, j) => { o[f.key] = vals[i][j]; });
    const hasInput = spec.fields.some(f => isInputKind_(f.kind) && f.kind !== 'cb' && o[f.key] !== '' && o[f.key] !== null);
    if (!hasInput) continue;
    const upd = {};
    let isNew = false;
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
    if (code === 'OBJ' && isNew) newObjects.push(o.id);
    if (code === 'PF' && !isNew && editedKeys.indexOf('status') >= 0 && dictClassOf_('task_status', o.status) === CLS.MOVED) {
      const newId = moveTask_(o, hist);
      if (newId) toast_('Задача ' + o.task_id + ' перенесена на следующую неделю как ' + newId + '. Исходная строка сохранена.');
    }
  }
  if (newObjects.length) ensureStrategyRows_(newObjects);
  logHistory_(hist, user);
}

function applyDefaults_(code, o, upd, isNew, user, editedKeys) {
  const now = new Date();
  const today = today_();
  const set = (k, v) => { upd[k] = v; o[k] = v; };
  if (code === 'OBJ' && isNew) {
    set('created_at', today);
    if (!o.status) set('status', dictValues_('obj_status')[0] || '');
  }
  if (code === 'STR') {
    const content = editedKeys.some(k => ['obj_id', 'obj_name', 'changed_at', 'changed_by', 'strategy_doc'].indexOf(k) < 0);
    if (content) { set('changed_at', now); set('changed_by', user); }
    if (!o.strategy_status) set('strategy_status', dictValues_('strategy_status')[0] || '');
  }
  if (code === 'ACT' && isNew) {
    if (!o.date) set('date', today);
    if (!o.status) set('status', dictFirstByClass_('task_status', CLS.DONE));
    if (!o.owner) { const p = personByEmail_(user); if (p) set('owner', p); }
    set('to_report', true);
    set('created_at', now);
    set('author', user);
  }
  if (code === 'LEAD') {
    if (isNew) {
      if (!o.first_date) set('first_date', today);
      if (!o.status) set('status', dictValues_('lead_status')[0] || '');
      if (!o.last_contact) set('last_contact', o.first_date);
      set('created_at', now);
      set('author', user);
    }
    if (editedKeys.indexOf('status') >= 0 && o.status) {
      const row = dictRows_('lead_status').find(r => r[0] === o.status);
      if (row) {
        String(row[2] || '').split(',').map(s => s.trim()).filter(Boolean).forEach(m => {
          const k = LEAD_MARK_FIELDS[m];
          if (k && o[k] !== true) set(k, true);
        });
        if (row[1] === CLS.WON && !o.deal_date) set('deal_date', today);
      }
      if (!isNew) set('last_contact', today);
    }
  }
  if (code === 'PF' && isNew) {
    if (!o.week) set('week', isoWeekKey_(today));
    if (!o.status) set('status', dictFirstByClass_('task_status', CLS.OPEN));
    if (!o.deadline) { const m = mondayOfWeekKey_(o.week); if (m) set('deadline', addDays_(m, 4)); }
    set('to_report', true);
    set('created_at', now);
  }
}

function recordId_(code, o) {
  const spec = sheetSpecs_()[code];
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

/** Строка в 02_СТРАТЕГИЯ для каждого нового объекта (если её ещё нет). */
function ensureStrategyRows_(ids) {
  const t = readTable_('STR');
  const have = {};
  t.rows.forEach(r => { have[r.obj_id] = true; });
  const toAdd = ids.filter(id => !have[id]).map(id => ({ obj_id: id, strategy_status: dictValues_('strategy_status')[0] || '' }));
  if (toAdd.length) appendRows_('STR', toAdd);
}

/** Копия задачи на следующую неделю. Исходная строка остаётся со статусом «Перенесено». */
function moveTask_(o, hist, targetWeek) {
  const pf = readTable_('PF');
  if (pf.rows.some(r => r.moved_from === o.task_id)) return null;
  const baseMon = mondayOfWeekKey_(o.week) || mondayOf_(today_());
  const nextKey = targetWeek || isoWeekKey_(addDays_(baseMon, 7));
  const nextMon = mondayOfWeekKey_(nextKey);
  const deadline = o.deadline instanceof Date ? addDays_(o.deadline, 7) : addDays_(nextMon, 4);
  const newId = nextId_('PF');
  appendRow_('PF', {
    week: nextKey, obj_id: o.obj_id, week_goal: o.week_goal, task: o.task, type: o.type, owner: o.owner,
    plan: o.plan, kpi_metric: o.kpi_metric, kpi_plan: o.kpi_plan,
    status: dictFirstByClass_('task_status', CLS.OPEN), deadline: deadline,
    to_report: o.to_report === '' ? true : o.to_report, task_id: newId, moved_from: o.task_id, created_at: new Date(),
  });
  hist.push({
    sheet: SHEET_NAMES.PF, record_id: o.task_id, obj_id: o.obj_id, field: fieldTitle_('PF', 'week'),
    old: o.week, new: nextKey, kind: HIST_KIND.MOVE, note: 'Создана копия ' + newId + ' (дедлайн ' + fmtDate_(deadline) + ')',
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
