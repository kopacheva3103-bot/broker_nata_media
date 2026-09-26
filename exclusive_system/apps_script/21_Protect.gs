/**
 * 21_Protect — команда дополняет и редактирует, но не удаляет объекты.
 *
 *  - 01_ОБЪЕКТЫ: ID и название заведённых объектов закрыты для всех, кроме владельца таблицы —
 *    строку объекта нельзя удалить (в ней защищённые ячейки), ID и название меняет только руководитель.
 *    Новые объекты команда добавляет в пустые строки как обычно — защита расширяется автоматически.
 *  - Вкладки объектов: служебные метки (столбец A) и шапка закрыты; поля стратегии команда заполняет свободно.
 *  - Страховка: раз в сутки данные каждой вкладки сохраняются в скрытый лист 98_КОПИИ_ВКЛАДОК; если вкладку
 *    удалят, «Обновить» / автообновление пересоздаст её с последними сохранёнными данными.
 * Защиту ставит только владелец таблицы (установка, «Обновить», автоматические задания владельца).
 */

const PROTECT = { OBJ: 'SYS: Объекты — ID и название (удалять и переименовывать может только руководитель)', TAB: 'SYS: Служебная часть вкладки объекта' };
const BACKUP_SHEET = '98_КОПИИ_ВКЛАДОК';

function isOwner_() {
  try {
    const owner = ss_().getOwner();
    return !!owner && owner.getEmail() === Session.getEffectiveUser().getEmail();
  } catch (e) { return false; }
}

function ownerOnly_(p) {
  const me = Session.getEffectiveUser();
  p.addEditor(me);
  p.removeEditors(p.getEditors().filter(u => u.getEmail() !== me.getEmail()));
  if (p.canDomainEdit()) p.setDomainEdit(false);
  return p;
}

/** ID и название заведённых объектов — только владелец. */
function protectObjectRows_() {
  if (!isOwner_()) return false;
  const sh = sheet_('OBJ');
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.getDescription() === PROTECT.OBJ) p.remove(); });
  const last = lastDataRow_(sh, sheetSpecs_().OBJ);
  if (last < 2) return true;
  const cols = [fieldIndex_('OBJ', 'id'), fieldIndex_('OBJ', 'name')].sort((a, b) => a - b);
  ownerOnly_(sh.getRange(2, cols[0], last - 1, cols[1] - cols[0] + 1).protect().setDescription(PROTECT.OBJ));
  return true;
}

/** Служебная часть вкладки: столбец меток и шапка (ID объекта). */
function protectObjectTab_(sh) {
  if (!isOwner_()) return;
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.getDescription() === PROTECT.TAB) p.remove(); });
  ownerOnly_(sh.getRange(1, 1, sh.getMaxRows(), 1).protect().setDescription(PROTECT.TAB));
  ownerOnly_(sh.getRange(1, 8, 1, 2).protect().setDescription(PROTECT.TAB));
}

function protectAll_() {
  if (!isOwner_()) return 0;
  protectObjectRows_();
  const tabs = objectTabs_();
  tabs.forEach(protectObjectTab_);
  return tabs.length;
}

// ───────────────────────── копии вкладок ─────────────────────────

function backupSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(BACKUP_SHEET);
  if (!sh) {
    sh = ss.insertSheet(BACKUP_SHEET, ss.getSheets().length);
    sh.getRange(1, 1, 1, 3).setValues([['ID объекта', 'Сохранено', 'Данные вкладки (для восстановления)']]).setFontWeight('bold');
    sh.hideSheet();
    if (isOwner_()) ownerOnly_(sh.protect().setDescription('SYS: Копии вкладок объектов'));
  }
  return sh;
}

/** Раз в сутки: данные всех вкладок объектов → 98_КОПИИ_ВКЛАДОК (одна строка на объект). */
function backupObjectTabs_() {
  const sh = backupSheet_();
  const now = new Date();
  const rows = [];
  objectTabs_().forEach(t => {
    const id = String(t.getRange(TAB.ID).getValue() || '');
    if (!id || !tabIsComplete_(t)) return;
    const json = JSON.stringify(readObjectTab_(t));
    if (json.length < 49000) rows.push([id, now, json]);
  });
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 3).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 3).setNumberFormat('@').setValues(rows.map(r => [r[0], fmtDate_(r[1], 'dd.MM.yyyy HH:mm'), r[2]]));
  return rows.length;
}

/** Сохранённые данные вкладки объекта (или null). */
function tabBackup_(id) {
  const sh = ss_().getSheetByName(BACKUP_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  const row = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().find(r => String(r[0]) === String(id));
  if (!row) return null;
  try { return JSON.parse(row[2]); } catch (e) { return null; }
}

// ───────────────────────── удаление объекта (только руководитель) ─────────────────────────

/**
 * Меню: удалить объект — строка в 01_ОБЪЕКТЫ и вкладка. Задачи, обзвон, контент и отчёты остаются в журналах
 * (история работы), папка на Диске не удаляется — к имени добавляется «(удалён)».
 */
function deleteObject() {
  const ui = SpreadsheetApp.getUi();
  if (!isOwner_()) { ui.alert('Удалять объекты может только владелец таблицы (руководитель).'); return; }
  const r = ui.prompt('Удалить объект', 'ID объекта (как в 01_ОБЪЕКТЫ), например НОВ-001:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const id = String(r.getResponseText() || '').trim();
  const obj = objectById_(id);
  if (!obj) { ui.alert('Объекта с ID «' + id + '» нет в ' + SHEET_NAMES.OBJ + '.'); return; }
  if (ui.alert('Удалить объект?', obj.name + ' (' + id + ')\n\nУдалятся строка в 01_ОБЪЕКТЫ и вкладка объекта. Задачи, обзвон, контент и отчёты останутся в журналах, папка на Диске останется с пометкой «(удалён)».\n\nЕсли объект просто закрыт — лучше поставить статус, а не удалять.',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  deleteObject_(obj);
  ui.alert('Объект удалён', obj.name + ' (' + id + ')', ui.ButtonSet.OK);
}

function deleteObject_(obj) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const tab = findObjectTab_(obj);
    if (tab) ss_().deleteSheet(tab);
    const sh = sheet_('OBJ');
    sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.getDescription() === PROTECT.OBJ) p.remove(); });
    sh.deleteRow(obj._row);
    try {
      const url = String(obj.folder_link || '');
      const m = /folders\/([\w-]+)/.exec(url);
      if (m) { const f = DriveApp.getFolderById(m[1]); if (f.getName().indexOf('(удалён)') < 0) f.setName(f.getName() + ' (удалён)'); }
    } catch (e) { /* папку можно переименовать вручную */ }
    logHistory_([{ sheet: SHEET_NAMES.OBJ, record_id: obj.id, obj_id: obj.id, field: 'Объект', old: obj.name, new: '', kind: HIST_KIND.CHANGE, note: 'Объект удалён' }], userEmail_());
    protectObjectRows_();
  } finally {
    lock.releaseLock();
  }
}
