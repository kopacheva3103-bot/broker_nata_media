/**
 * 09_Dialogs — форма «Добавить действие» (быстрый ввод без поиска нужной колонки).
 */

function addAction() {
  const html = HtmlService.createHtmlOutputFromFile('AddActionDialog').setWidth(640).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html, 'Добавить действие');
}

/** Данные для выпадающих списков формы. */
function getActionFormData() {
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.in_work === 'ДА').map(o => ({ id: o.id, label: objLabel_(o.id, o.name) }));
  const preselect = selectedObjectId_();
  return {
    objects: objs,
    preselect: preselect,
    types: dictValues_('action_types'),
    channels: dictValues_('channels'),
    people: dictValues_('people'),
    statuses: dictValues_('task_status'),
    defaultStatus: dictFirstByClass_('task_status', CLS.DONE),
    refusals: dictValues_('refusal_reasons'),
    defaultOwner: personByEmail_(userEmail_()),
    today: fmtDate_(today_(), 'yyyy-MM-dd'),
    counters: sheetSpecs_().ACT.fields.filter(f => f.kind === 'num' && f.key !== 'views').map(f => ({ key: f.key, title: f.title.replace('Количество ', '') })),
  };
}

/** Сохраняет действие из формы. Возвращает ID. */
function submitActionForm(d) {
  if (!d.obj_id) throw new Error('Выберите объект');
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const parts = String(d.date || '').split('-').map(Number);
    const date = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : today_();
    const nsParts = String(d.next_step_date || '').split('-').map(Number);
    const obj = {
      id: nextId_('ACT'), date: date, obj_id: d.obj_id, owner: d.owner || '', type: d.type || '', channel: d.channel || '',
      goal: d.goal || '', plan: d.plan || '', fact: d.fact || '', status: d.status || dictFirstByClass_('task_status', CLS.DONE),
      result: d.result || '', refusal: d.refusal || '', feedback: d.feedback || '', conclusion: d.conclusion || '',
      next_step: d.next_step || '', next_step_date: nsParts.length === 3 ? new Date(nsParts[0], nsParts[1] - 1, nsParts[2]) : '',
      comment: d.comment || '', views: num_(d.views), cost: num_(d.cost), to_report: d.to_report !== false,
      created_at: new Date(), author: userEmail_(),
    };
    sheetSpecs_().ACT.fields.filter(f => f.kind === 'num' && f.key !== 'views').forEach(f => { obj[f.key] = num_(d[f.key]); });
    const row = appendRow_('ACT', obj);
    const hist = [{ sheet: SHEET_NAMES.ACT, record_id: obj.id, obj_id: obj.obj_id, field: fieldTitle_('ACT', 'status'), old: '', new: obj.status, kind: HIST_KIND.CREATE, note: 'Через форму' }];
    logHistory_(hist, obj.author);
    return { id: obj.id, row: row };
  } finally {
    lock.releaseLock();
  }
}

function num_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
  return isNaN(n) ? '' : n;
}
