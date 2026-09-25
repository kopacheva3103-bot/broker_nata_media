/**
 * 06_Strategy — полная стратегия объекта в Google Doc.
 *
 * В 02_СТРАТЕГИЯ — короткая управленческая версия. Полный документ создаётся один раз
 * из шаблона (поля 02 подставляются как стартовый текст) и дальше ведётся в Google Docs.
 */

function openStrategy() {
  const ui = SpreadsheetApp.getUi();
  let id = selectedObjectId_();
  if (!id) {
    const r = ui.prompt('Открыть стратегию', 'Введите ID объекта (ID из CRM) или встаньте на строку объекта:', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    id = r.getResponseText().trim();
  }
  const obj = objectById_(id);
  if (!obj) { ui.alert('Объект ' + id + ' не найден.'); return; }
  const res = ensureStrategyDoc_(id);
  showLinks_('Стратегия: ' + obj.name, [{ label: res.name, url: res.url }], res.created ? 'Документ создан из шаблона и заполнен краткой версией из 02_СТРАТЕГИЯ.' : '');
}

function ensureStrategyDoc_(id) {
  const obj = objectById_(id);
  ensureStrategyRows_([id]);
  const t = readTable_('STR');
  const row = t.rows.find(r => r.obj_id === id);
  const existingId = idFromUrl_(row.strategy_doc) || idFromUrl_(obj.strategy_link);
  if (existingId) {
    try {
      const f = DriveApp.getFileById(existingId);
      if (!f.isTrashed()) {
        if (!row.strategy_doc) writeFields_(t.sh, 'STR', row._row, { strategy_doc: f.getUrl() });
        if (!obj.strategy_link) writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { strategy_link: f.getUrl() });
        return { url: f.getUrl(), name: f.getName(), created: false };
      }
    } catch (e) { /* документ удалён — создадим новый */ }
  }
  const folder = ensureObjectFolder_(id, 'STRATEGIES');
  const tpl = DriveApp.getFileById(ensureStrategyTemplate_());
  const name = obj.name + ' — Стратегия продажи';
  const copy = tpl.makeCopy(name, folder);
  const doc = DocumentApp.openById(copy.getId());
  const values = { OBJECT: obj.name, OBJ_ID: id, ADDRESS: obj.address || '—', DATE: fmtDate_(new Date()) };
  strategyDocFields_().forEach(f => {
    const v = row[f.key];
    values[f.key.toUpperCase()] = v instanceof Date ? fmtDate_(v) : (v === '' || v === null ? '—' : String(v));
  });
  fillDoc_(doc, values, {});
  doc.saveAndClose();
  writeFields_(t.sh, 'STR', row._row, { strategy_doc: copy.getUrl() });
  writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { strategy_link: copy.getUrl() });
  return { url: copy.getUrl(), name: name, created: true };
}

function strategyDocFields_() {
  return sheetSpecs_().STR.fields.filter(f => ['text', 'money', 'dd', 'date'].indexOf(f.kind) >= 0 && f.key !== 'obj_id');
}

function ensureStrategyTemplate_() {
  const id = String(cfgGet_('TEMPLATE_STRATEGY_ID') || '');
  if (id) {
    try { if (!DriveApp.getFileById(id).isTrashed()) return id; } catch (e) { /* создадим заново */ }
  }
  const doc = DocumentApp.create(SYS.STRATEGY_TEMPLATE_NAME);
  const b = doc.getBody();
  const base = {};
  base[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
  base[DocumentApp.Attribute.FONT_SIZE] = 11;
  base[DocumentApp.Attribute.FOREGROUND_COLOR] = '#263238';
  b.setAttributes(base);
  const H = DocumentApp.ParagraphHeading;
  b.getParagraphs()[0].setText('Стратегия продажи').setHeading(H.SUBTITLE);
  b.appendParagraph('{{OBJECT}}').setHeading(H.TITLE);
  b.appendParagraph('{{OBJ_ID}} · {{ADDRESS}} · документ создан {{DATE}}').editAsText().setFontSize(9).setForegroundColor('#80868B');
  b.appendParagraph('ВНУТРЕННИЙ ДОКУМЕНТ. Клиенту не передаётся. Краткая версия и дата пересмотра — в листе 02_СТРАТЕГИЯ.')
    .editAsText().setFontSize(9).setBold(true).setForegroundColor('#7F1D1D');
  const groups = [
    ['1. Цель и цена', ['strategy_status', 'goal', 'target_price', 'price_range']],
    ['2. Позиционирование и аргументы', ['positioning', 'key_argument', 'advantages', 'weaknesses', 'not_public']],
    ['3. Покупатель', ['ta1', 'ta2', 'ta3', 'motives', 'objections', 'answers']],
    ['4. Рынок и конкуренты', ['competitors']],
    ['5. Сценарий и каналы', ['scenario', 'channels', 'partner_channels', 'crm_base', 'content_strategy', 'outbound_strategy', 'promo_plan']],
    ['6. Гипотезы и выводы', ['hypotheses', 'conclusion', 'next_hypothesis', 'review_date']],
  ];
  groups.forEach(g => {
    b.appendParagraph(g[0]).setHeading(H.HEADING2);
    g[1].forEach(k => {
      b.appendParagraph(fieldTitle_('STR', k)).setHeading(H.HEADING3);
      b.appendParagraph('{{' + k.toUpperCase() + '}}');
    });
  });
  b.appendParagraph('7. Подробный анализ').setHeading(H.HEADING2);
  b.appendParagraph('Здесь — глубокая проработка: анализ аналогов, расчёты, сценарии переговоров, материалы для контента.');
  b.appendParagraph('8. Журнал решений').setHeading(H.HEADING2);
  b.appendParagraph('Дата — решение — почему — кто утвердил.');
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  const tplFolder = folderById_(cfgGet_('FOLDER_TEMPLATES_ID'));
  if (tplFolder) file.moveTo(tplFolder);
  cfgSet_('TEMPLATE_STRATEGY_ID', doc.getId());
  return doc.getId();
}

/** Меню: создать папки и документы стратегий для всех объектов, где их нет. */
function createFoldersForAll() {
  const objs = readTable_('OBJ').rows.filter(o => o.id);
  let n = 0;
  objs.forEach(o => {
    const f = ensureObjectFolder_(o.id, 'REPORTS');
    if (!o.folder_link) writeFields_(sheet_('OBJ'), 'OBJ', o._row, { folder_link: f.getUrl() });
    if (ensureStrategyDoc_(o.id).created) n++;
  });
  SpreadsheetApp.getUi().alert('Готово: папки проверены для ' + objs.length + ' объектов, создано документов стратегии: ' + n + '.');
}
