/**
 * 08_Control — контроль и обслуживание: просрочки, обновление, дэшборд.
 */

/** Просроченные задачи по исполнителям (то же, что внизу дэшборда, но списком). */
function checkOverdue() {
  SpreadsheetApp.flush();
  const rows = readTable_('TASK').rows.filter(t => t.overdue === 'ПРОСРОЧЕНО');
  const ui = SpreadsheetApp.getUi();
  if (!rows.length) { ui.alert('Просрочек нет', 'Все задачи с прошедшим сроком закрыты.', ui.ButtonSet.OK); return; }
  const by = {};
  rows.forEach(t => { const k = t.owner || '(без исполнителя)'; (by[k] = by[k] || []).push(t); });
  const text = Object.keys(by).map(k => k + ' — ' + by[k].length + ':\n' + by[k].slice(0, 12).map(t =>
    '   • ' + t.obj_name + ': ' + t.task + ' (срок ' + fmtDate_(t.deadline) + ', ' + t.id + ')').join('\n') +
    (by[k].length > 12 ? '\n   …' : '')).join('\n\n');
  ui.alert('Просроченные задачи: ' + rows.length, text + '\n\nЗакройте, перенесите («Перенесено») или отмените задачу в 02_ЗАДАЧИ.', ui.ButtonSet.OK);
}

/**
 * «Обновить»: проставляет ID и значения по умолчанию строкам, вставленным без триггера (копипаст большого блока),
 * создаёт недостающие вкладки объектов, добавляет строки в журналы, если они заканчиваются.
 */
function refreshAll() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) { toast_('Система занята, повторите через минуту.'); return; }
  const start = Date.now();
  let fixed = 0, note = '';
  try {
    ['TASK', 'BASE', 'CONT', 'LIB'].forEach(code => {
      fixed += removeOrphanRows_(code);
      const t = readTable_(code);
      const cache = {};
      t.rows.forEach(o => {
        const hasInput = t.spec.fields.some(f => isInputKind_(f.kind) && f.kind !== 'cb' && o[f.key] !== '');
        if (!hasInput || o[t.spec.idField]) return;
        const upd = {};
        upd[t.spec.idField] = nextId_(code, cache);
        applyDefaults_(code, o, upd, true, userEmail_(), []);
        writeFields_(t.sh, code, o._row, upd);
        fixed++;
      });
      const last = lastDataRow_(t.sh, t.spec);
      if (t.sh.getMaxRows() - last < 200) extendSheet_(code, 1000);
    });
    fixObjIdColumns_();
    fixed += fillTeamDefaults_();
    const r = tabsWork_(start);
    fixed += r.created + r.rebuilt;
    if (r.left) note = '. ' + tabsWorkText_(r);
    orderSheets_();
    applyTabVisibility_();
    try { protectAll_(); } catch (e) { /* не критично */ }
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.flush();
  toast_('Готово. Исправлено / создано: ' + fixed + note, 'Обновление', 10);
}

function openDashboard() { sheet_('DASH').activate(); }
