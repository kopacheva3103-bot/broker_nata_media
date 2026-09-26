/**
 * 06_Reports — еженедельный отчёт клиенту: Google Doc + PDF + архив.
 *
 * Формат — как в отчётах руководителя (шапка ИП, «Приложение №1 к Договору», таблица реквизитов,
 * Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА, Раздел 2. ПОЛУЧЕННЫЕ ЗАЯВКИ, Раздел 3. ПЛАН РАБОТЫ).
 * Источник — лист 05_ОТЧЁТ_КЛИЕНТУ (предпросмотр): скрипт берёт оттуда только поля с метками {{…}},
 * поэтому внутренние данные (контакты, звонки, комментарии) в документ попасть не могут.
 * Клиент доступа к таблице не получает — только PDF.
 */

function createReport() {
  const ui = SpreadsheetApp.getUi();
  SpreadsheetApp.flush();
  const rep = sheet_('REP');
  const id = String(rep.getRange('E3').getValue() || '');
  const wk = String(rep.getRange('E4').getValue() || '');
  if (!id || !wk) {
    rep.activate();
    ui.alert('Выберите объект и неделю в листе ' + SHEET_NAMES.REP + ' (ячейки B3 и B4), затем повторите.');
    return;
  }
  const res = generateReport_(id, wk, { interactive: true });
  if (!res) return;
  showLinks_('Отчёт готов', [
    { label: 'Google Doc: ' + res.name, url: res.docUrl },
    { label: 'PDF для клиента', url: res.pdfUrl },
    { label: 'Папка отчётов объекта', url: res.folderUrl },
  ], 'Проверьте документ. Если поправите текст в Google Doc — нажмите «Обновить PDF отчёта».');
}

/** Собирает отчёт. Лист 05_ОТЧЁТ_КЛИЕНТУ должен быть выставлен на этот объект и неделю. */
function generateReport_(id, wk, opts) {
  opts = opts || {};
  const obj = objectById_(id);
  if (!obj) throw new Error('Объект ' + id + ' не найден в ' + SHEET_NAMES.OBJ);
  const values = readReportValues_();
  const arch = readTable_('ARCH');
  const existing = arch.rows.filter(r => r.obj_id === id && r.week === wk && r.status === REPORT_STATUS.ACTUAL);
  if (existing.length && opts.interactive) {
    const ui = SpreadsheetApp.getUi();
    const b = ui.alert('Отчёт за эту неделю уже есть',
      'Создать новую версию? Предыдущая останется в архиве со статусом «' + REPORT_STATUS.REPLACED + '».', ui.ButtonSet.YES_NO);
    if (b !== ui.Button.YES) return null;
  }
  existing.forEach(r => writeFields_(arch.sh, 'ARCH', r._row, { status: REPORT_STATUS.REPLACED }));

  const folder = ensureObjectFolder_(id, 'REPORTS');
  const tpl = DriveApp.getFileById(ensureReportTemplate_());
  const no = String(values.kv.REPORT_NO || '');
  const name = 'Отчёт ' + (no.length < 2 ? '0' : '') + no + ' — ' + obj.name + ' — ' + values.kv.PERIOD;
  const copy = tpl.makeCopy(name, folder);
  const doc = DocumentApp.openById(copy.getId());
  fillReportDoc_(doc, values);
  doc.saveAndClose();
  const pdf = folder.createFile(copy.getAs(MimeType.PDF)).setName(name + '.pdf');

  appendRow_('ARCH', {
    ts: new Date(), obj_id: id, obj_name: obj.name, report_no: values.kv.REPORT_NO, week: wk, period: values.kv.PERIOD,
    doc_link: copy.getUrl(), pdf_link: pdf.getUrl(), author: userEmail_(), status: REPORT_STATUS.ACTUAL,
  });
  writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { last_report_link: pdf.getUrl(), last_report_date: today_() });
  return { name: name, docId: copy.getId(), docUrl: copy.getUrl(), pdfId: pdf.getId(), pdfUrl: pdf.getUrl(), folderUrl: folder.getUrl() };
}

/** Пересоздаёт PDF из (возможно отредактированного) Google Doc последнего отчёта. */
function createPdf() {
  const ui = SpreadsheetApp.getUi();
  SpreadsheetApp.flush();
  const rep = sheet_('REP');
  const id = String(rep.getRange('E3').getValue() || '');
  const wk = String(rep.getRange('E4').getValue() || '');
  const arch = readTable_('ARCH');
  const rows = arch.rows.filter(r => r.obj_id === id && r.week === wk && r.status === REPORT_STATUS.ACTUAL);
  if (!id || !wk || !rows.length) {
    ui.alert('Для выбранного в ' + SHEET_NAMES.REP + ' объекта и недели ещё нет отчёта. Сначала «Создать отчёт клиенту».');
    return;
  }
  const r = rows[rows.length - 1];
  const docFile = DriveApp.getFileById(idFromUrl_(r.doc_link));
  const folder = docFile.getParents().hasNext() ? docFile.getParents().next() : ensureObjectFolder_(id, 'REPORTS');
  try {
    const old = DriveApp.getFileById(idFromUrl_(r.pdf_link));
    old.setName(old.getName().replace(/\.pdf$/i, '') + ' (устаревший).pdf');
  } catch (e) { /* старый PDF мог быть удалён вручную */ }
  const pdf = folder.createFile(docFile.getAs(MimeType.PDF)).setName(docFile.getName() + '.pdf');
  writeFields_(arch.sh, 'ARCH', r._row, { pdf_link: pdf.getUrl() });
  const obj = objectById_(id);
  if (obj) writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { last_report_link: pdf.getUrl() });
  showLinks_('PDF обновлён', [{ label: pdf.getName(), url: pdf.getUrl() }], 'Старый PDF переименован с пометкой «устаревший» и остался в папке.');
}

/** Значения из 05_ОТЧЁТ_КЛИЕНТУ: {kv: {PH: текст}, tables: {PH: [[№, текст, текст]]}}. */
function readReportValues_() {
  const sh = sheet_('REP');
  const L = reportLayout_();
  const kv = {};
  const vals = sh.getRange(REP_FIRST_ROW, 1, L.kvRows, 4).getDisplayValues();
  vals.forEach(v => {
    const m = /^\{\{([A-Z_]+)\}\}$/.exec(v[3]);
    if (m) kv[m[1]] = v[1];
  });
  const tables = {};
  Object.keys(L.tables).forEach(ph => {
    const t = L.tables[ph];
    tables[ph] = sh.getRange(t.first, 1, t.rows, 3).getDisplayValues().filter(r => r[0] !== '' || r[1] !== '');
  });
  return { kv: kv, tables: tables };
}

function lineKeys_() {
  const keys = {};
  reportRows_().forEach(r => { if (r.lines) keys[r.ph] = true; });
  return keys;
}

/** Подстановка: поля — replaceText, многострочные — абзацами, таблицы — строками таблицы. */
function fillReportDoc_(doc, values) {
  const body = doc.getBody();
  Object.keys(values.tables).forEach(ph => fillTableRows_(body, ph, values.tables[ph]));
  const lines = lineKeys_();
  Object.keys(values.kv).forEach(k => {
    const v = String(values.kv[k] || '').trim();
    if (!v && (k === 'COMMENT' || k === 'SUMMARY')) { removeBlock_(body, k); return; }
    if (lines[k]) replaceWithLines_(body, k, v.split(/\r?\n/).map(x => x.trim()).filter(Boolean));
  });
  [body, doc.getHeader(), doc.getFooter()].forEach(sec => {
    if (!sec) return;
    Object.keys(values.kv).forEach(k => {
      if (!lines[k]) sec.replaceText(phPattern_(k), escapeReplacement_(String(values.kv[k] || '—')));
    });
    sec.replaceText('\\{\\{[A-Z_]+\\}\\}', '—');
  });
}

function phPattern_(key) { return '\\{\\{' + key + '\\}\\}'; }
function escapeReplacement_(s) { return s.replace(/\\/g, '\\\\').replace(/\$/g, '\\$'); }

/** Абзац с {{KEY}} → по абзацу на строку (формат абзаца сохраняется). */
function replaceWithLines_(body, key, lines) {
  const found = body.findText(phPattern_(key));
  if (!found) return;
  const para = found.getElement().getParent();
  if (para.getType() !== DocumentApp.ElementType.PARAGRAPH && para.getType() !== DocumentApp.ElementType.LIST_ITEM) {
    found.getElement().asText().replaceText(phPattern_(key), escapeReplacement_(lines.join('; ')));
    return;
  }
  if (!lines.length) lines = ['—'];
  para.asText().setText(lines[0]);
  const parent = para.getParent();
  let idx = parent.getChildIndex(para);
  lines.slice(1).forEach(ln => {
    const copy = para.copy();
    copy.asText().setText(ln);
    idx++;
    if (copy.getType() === DocumentApp.ElementType.LIST_ITEM) parent.insertListItem(idx, copy);
    else parent.insertParagraph(idx, copy);
  });
}

/** Пустой раздел (комментарий, цифры): удалить абзац с меткой и заголовок над ним. */
function removeBlock_(body, key) {
  const found = body.findText(phPattern_(key));
  if (!found) return;
  const para = found.getElement().getParent();
  const prev = para.getPreviousSibling();
  para.removeFromParent();
  if (prev && prev.getType() === DocumentApp.ElementType.PARAGRAPH && prev.asParagraph().getHeading() !== DocumentApp.ParagraphHeading.NORMAL) prev.removeFromParent();
}

/** Строка таблицы с {{KEY}} — образец: на каждую строку данных делается копия. */
function fillTableRows_(body, key, rows) {
  const found = body.findText(phPattern_(key));
  if (!found) return;
  let el = found.getElement();
  while (el && el.getType() !== DocumentApp.ElementType.TABLE_ROW) el = el.getParent();
  if (!el) return;
  const tplRow = el.asTableRow();
  const table = tplRow.getParentTable();
  const idx = table.getChildIndex(tplRow);
  if (!rows.length) rows = [['—', '—', '']];
  rows.forEach((r, i) => {
    const nr = table.insertTableRow(idx + 1 + i, tplRow.copy());
    for (let c = 0; c < nr.getNumCells() && c < r.length; c++) nr.getCell(c).editAsText().setText(String(r[c]));
  });
  tplRow.removeFromParent();
}

/**
 * Одна папка на объект: 01_ОБЪЕКТЫ/«Название (ID из CRM)»/{Аналитика, КП и презентации, Отчёты, Фото и видео}.
 * kind: 'ROOT' — сама папка объекта, 'ANALYTICS' / 'MATERIALS' / 'REPORTS' / 'MEDIA' — подпапка.
 * Ссылка на папку объекта записывается в 01_ОБЪЕКТЫ.
 */
function ensureObjectFolder_(id, kind) {
  let parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID'));
  if (!parent) { ensureDrive_(); parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID')); }
  const obj = objectById_(id);
  const suffix = '(' + id + ')';
  let root = null;
  const linked = obj ? idFromUrl_(obj.folder_link) : '';
  if (linked) root = folderById_(linked); // своя папка объекта, указанная вручную в 01_ОБЪЕКТЫ
  if (!root) {
    // папка «Название (ID)» или уже существующая папка объекта с похожим названием («ЖК Время» для «ЖК Время · Лермонтовская 1»)
    const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/\s*\([^)]*\)\s*$/, '').replace(/[«»"]/g, '').trim();
    const oname = norm(obj ? obj.name : id);
    let byName = null;
    const it = parent.getFolders();
    while (it.hasNext() && !root) {
      const f = it.next();
      if (f.getName().slice(-suffix.length) === suffix) { root = f; break; }
      const fn = norm(f.getName());
      if (!byName && fn.length >= 4 && (oname === fn || oname.indexOf(fn) === 0 || fn.indexOf(oname) === 0)) byName = f;
    }
    if (!root) root = byName;
  }
  if (!root) {
    root = parent.createFolder((obj ? obj.name : id) + ' ' + suffix);
    Object.keys(SYS.OBJECT_SUBFOLDERS).forEach(k => childFolder_(root, SYS.OBJECT_SUBFOLDERS[k]));
  }
  if (obj && idFromUrl_(obj.folder_link) !== root.getId()) writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { folder_link: root.getUrl() });
  if (!kind || kind === 'ROOT') return root;
  return childFolder_(root, SYS.OBJECT_SUBFOLDERS[kind]);
}

/**
 * Шаблон отчёта в формате руководителя. Создаётся один раз в 02_ШАБЛОНЫ; дальше вёрстку (шрифты, логотип,
 * отступы) можно менять прямо в Google Docs — метки {{…}} не удаляйте.
 */
function ensureReportTemplate_() {
  const id = String(cfgGet_('TEMPLATE_REPORT_ID') || '');
  if (id) {
    try { if (!DriveApp.getFileById(id).isTrashed()) return id; } catch (e) { /* создадим заново */ }
  }
  const doc = DocumentApp.create(SYS.REPORT_TEMPLATE_NAME);
  try {
    buildReportTemplate_(doc);
  } catch (e) {
    try { DriveApp.getFileById(doc.getId()).setTrashed(true); } catch (err) { /* не удалось убрать черновик */ }
    throw new Error('Шаблон отчёта не создан: ' + e.message);
  }
  const file = DriveApp.getFileById(doc.getId());
  const tplFolder = folderById_(cfgGet_('FOLDER_TEMPLATES_ID'));
  if (tplFolder) file.moveTo(tplFolder);
  cfgSet_('TEMPLATE_REPORT_ID', doc.getId());
  return doc.getId();
}

function buildReportTemplate_(doc) {
  const b = doc.getBody();
  b.setMarginTop(42).setMarginBottom(42).setMarginLeft(56).setMarginRight(42);
  const base = {};
  base[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  base[DocumentApp.Attribute.FONT_SIZE] = 12;
  b.setAttributes(base);
  const H = DocumentApp.ParagraphHeading;
  const A = DocumentApp.HorizontalAlignment;
  const p0 = b.getParagraphs()[0];
  p0.setText('{{EXEC_HEADER}}');
  p0.setAlignment(A.RIGHT);
  p0.editAsText().setFontSize(10);
  b.appendParagraph('');
  b.appendParagraph('Приложение №1 к Договору № {{CONTRACT_NO}} от {{CONTRACT_DATE}}').setAlignment(A.RIGHT).editAsText().setFontSize(11);
  b.appendParagraph('Еженедельный отчёт').setHeading(H.HEADING2).setAlignment(A.CENTER);
  const info = b.appendTable([
    ['Наименование', 'Значение'], ['Отчет №', '{{REPORT_NO}}'], ['Период', '{{PERIOD}}'],
    ['Объект', '{{OBJECT}}'], ['Заказчик', '{{CUSTOMER}}'], ['Исполнитель', '{{EXECUTOR}}'],
  ]);
  styleReportTable_(info, [170, 320]);
  b.appendParagraph('Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА').setHeading(H.HEADING3);
  styleReportTable_(b.appendTable([['№', 'Действие по плану на эту неделю', 'Статус (выполнено / нет)'], ['{{PLAN_ROWS}}', '', '']]), [40, 330, 120]);
  b.appendParagraph('Итоги недели в цифрах').setHeading(H.HEADING4);
  b.appendParagraph('{{SUMMARY}}');
  b.appendParagraph('Раздел 2. ПОЛУЧЕННЫЕ ЗАЯВКИ').setHeading(H.HEADING3);
  styleReportTable_(b.appendTable([['№', 'Заявка', 'Следующий шаг'], ['{{LEADS_ROWS}}', '', '']]), [40, 280, 170]);
  b.appendParagraph('Раздел 3. ПЛАН РАБОТЫ').setHeading(H.HEADING3);
  styleReportTable_(b.appendTable([['№', 'Действие', 'Дата выполнения'], ['{{NEXT_ROWS}}', '', '']]), [40, 300, 150]);
  b.appendParagraph('Комментарий').setHeading(H.HEADING4);
  b.appendParagraph('{{COMMENT}}');
  b.appendParagraph('');
  b.appendParagraph('Исполнитель: ______________________ {{SIGNATURE}}');
  doc.saveAndClose();
}

function styleReportTable_(t, widths) {
  t.setBorderColor('#000000');
  for (let r = 0; r < t.getNumRows(); r++) {
    const row = t.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      if (widths[c]) cell.setWidth(widths[c]);
      cell.setPaddingTop(3).setPaddingBottom(3);
      cell.editAsText().setFontSize(11).setBold(r === 0);
      const para = cell.getChild(0);
      if (para && para.getType() === DocumentApp.ElementType.PARAGRAPH) para.asParagraph().setAlignment(c === 0 || r === 0 ? DocumentApp.HorizontalAlignment.CENTER : DocumentApp.HorizontalAlignment.LEFT);
    }
  }
}
