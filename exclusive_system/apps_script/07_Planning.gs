/**
 * 07_Planning — «Создать план недели».
 *
 * Для каждого объекта в работе:
 *  1) незакрытые задачи прошлых недель (по желанию) переносятся на выбранную неделю — исходные строки
 *     получают статус «Перенесено» и остаются в истории;
 *  2) добавляются задачи недели по умолчанию из 08_НАСТРОЙКИ (если такой задачи на эту неделю ещё нет).
 * Исполнитель: звонки и КП — ассистент объекта, публикации — SMM объекта, остальное — ответственный.
 */

function createWeekPlan() {
  const ui = SpreadsheetApp.getUi();
  const today = today_();
  const dow = today.getDay() || 7;
  const defKey = isoWeekKey_(dow >= 5 ? addDays_(today, 7) : today);
  const resp = ui.prompt('План недели',
    'Неделя (формат 2026-W40). По умолчанию — ' + defKey + ' (' + weekPeriodLabel_(defKey) + ').', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const wk = (resp.getResponseText() || '').trim() || defKey;
  if (!mondayOfWeekKey_(wk)) { ui.alert('Неделя должна быть в формате 2026-W40.'); return; }
  const carry = ui.alert('Перенос задач', 'Перенести незакрытые задачи прошлых недель на ' + wk + '?', ui.ButtonSet.YES_NO) === ui.Button.YES;
  const res = buildWeekPlan_(wk, { carry: carry });
  ui.alert('План недели ' + wk, 'Добавлено задач: ' + res.added + '\nПеренесено: ' + res.moved +
    (res.skipped.length ? '\nБез ID / не в работе: ' + res.skipped.join(', ') : '') +
    '\n\nДопишите в 02_ЗАДАЧИ задачи по стратегии (сценарии, аудитории, КП) — они попадут в отчёт клиенту.', ui.ButtonSet.OK);
}

function buildWeekPlan_(wk, opts) {
  opts = opts || {};
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && o.in_work !== 'НЕТ');
  const tasks = readTable_('TASK');
  const hist = [];
  let moved = 0;
  if (opts.carry) {
    const movedName = dictFirstByClass_('task_status', CLS.MOVED);
    tasks.rows.forEach(t => {
      const cls = t.status ? dictClassOf_('task_status', t.status) : CLS.OPEN;
      if (!t.obj_id || cls !== CLS.OPEN || !t.week || String(t.week) >= wk) return;
      if (!objs.some(o => o.id === t.obj_id)) return;
      const newId = moveTask_(t, hist, wk);
      if (newId) {
        writeFields_(tasks.sh, 'TASK', t._row, { status: movedName });
        moved++;
      }
    });
  }
  const fresh = readTable_('TASK').rows;
  const have = {};
  fresh.forEach(t => { have[t.obj_id + '|' + t.week + '|' + String(t.task).trim()] = true; });
  const defaults = defaultWeekTasks_();
  const mon = mondayOfWeekKey_(wk);
  const openName = dictFirstByClass_('task_status', CLS.OPEN);
  const add = [];
  const cache = {};
  objs.forEach(o => {
    defaults.forEach(d => {
      if (have[o.id + '|' + wk + '|' + d.task]) return;
      const unitCode = (unitDefs_().find(u => u[0] === d.unit) || [])[1] || '';
      const owner = (unitCode === 'CALLS' || unitCode === 'KP' || unitCode === 'RESP') ? (o.assistant || o.manager) :
        unitCode === 'PUB' ? (o.smm || o.manager) : o.manager;
      add.push({
        id: nextId_('TASK', cache), week: wk, obj_id: o.id, block: d.block, task: d.task, owner: owner || '', unit: d.unit, plan: d.plan,
        deadline: addDays_(mon, 4), status: openName, to_report: true, source: 'План недели', created_at: new Date(), author: userEmail_(),
      });
    });
  });
  appendRows_('TASK', add);
  logHistory_(hist, userEmail_());
  const skipped = readTable_('OBJ').rows.filter(o => (o.name && !o.id)).map(o => o.name);
  return { added: add.length, moved: moved, skipped: skipped };
}

function defaultWeekTasks_() {
  const r = ss_().getRangeByName('CFG_DEFAULT_TASKS');
  const rows = r ? r.getValues().filter(x => String(x[1]).trim() !== '') : DEFAULT_WEEK_TASKS;
  return rows.map(x => ({ block: x[0], task: String(x[1]).trim(), unit: x[2], plan: x[3] === '' ? '' : Number(x[3]) }));
}
