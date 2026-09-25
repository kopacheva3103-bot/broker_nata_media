/**
 * 05_Reports — еженедельный отчёт клиенту: Google Doc + PDF + архив.
 *
 * Источник текста — лист 07_ОТЧЕТ (предпросмотр). Скрипт берёт оттуда только строки
 * с placeholder'ами, поэтому внутренние поля физически не могут попасть в документ.
 */

function createReport() {
  const ui = SpreadsheetApp.getUi();
  SpreadsheetApp.flush();
  const rep = sheet_('REP');
  const id = String(rep.getRange('E3').getValue() || '');
  const wk = String(rep.getRange('E4').getValue() || '');
  if (!id || !wk) {
    rep.activate();
    ui.alert('Выберите объект и неделю в листе 07_ОТЧЕТ (ячейки B3 и B4), затем повторите.');
    return;
  }
  const res = generateReport_(id, wk, { interactive: true });
  if (!res) return;
  showLinks_('Отчёт готов', [
    { label: 'Google Doc: ' + res.name, url: res.docUrl },
    { label: 'PDF для клиента', url: res.pdfUrl },
    { label: 'Папка отчётов объекта', url: res.folderUrl },
  ], 'Проверьте документ. Если поправите текст в Google Doc — нажмите «Создать PDF», чтобы обновить PDF.');
}

/** Собирает отчёт для объекта/недели. Лист 07_ОТЧЕТ должен быть выставлен на этот объект и неделю. */
function generateReport_(id, wk, opts) {
  opts = opts || {};
  const obj = objectById_(id);
  if (!obj) throw new Error('Объект ' + id + ' не найден в 01_ОБЪЕКТЫ');
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
  const period = values.PERIOD || weekPeriodLabel_(wk);
  const name = obj.name + ' — Отчёт — ' + period;
  const copy = tpl.makeCopy(name, folder);
  const doc = DocumentApp.openById(copy.getId());
  fillDoc_(doc, values, reportListKeys_());
  doc.saveAndClose();
  const pdf = folder.createFile(copy.getAs(MimeType.PDF)).setName(name + '.pdf');

  appendRow_('ARCH', {
    ts: new Date(), obj_id: id, obj_name: obj.name, week: wk, period: period,
    doc_link: copy.getUrl(), pdf_link: pdf.getUrl(), author: userEmail_(), status: REPORT_STATUS.ACTUAL,
    manager_comment: values.MANAGER_COMMENT === '—' ? '' : values.MANAGER_COMMENT,
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
    ui.alert('Для выбранного в 07_ОТЧЕТ объекта и недели ещё нет отчёта. Сначала нажмите «Создать отчёт».');
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

function reportListKeys_() {
  const keys = {};
  reportRows_().forEach(r => { if (r.list) keys[r.ph] = true; });
  return keys;
}

/** Значения placeholder'ов из 07_ОТЧЕТ (отображаемый текст) + подпись из настроек. */
function readReportValues_() {
  const sh = sheet_('REP');
  const rows = reportRows_();
  const vals = sh.getRange(REP_FIRST_ROW, 2, rows.length, 2).getDisplayValues();
  const out = {};
  vals.forEach(v => {
    const m = /^\{\{([A-Z_]+)\}\}$/.exec(v[1]);
    if (m) out[m[1]] = v[0] === '' ? '—' : v[0];
  });
  out.AGENCY = String(cfgGet_('AGENCY_NAME') || '');
  out.MANAGER_NAME = String(cfgGet_('MANAGER_NAME') || '');
  out.MANAGER_CONTACT = String(cfgGet_('MANAGER_CONTACT') || '');
  out.REPORT_DATE = fmtDate_(new Date());
  return out;
}

/** Подстановка значений: обычные — replaceText, списочные — маркированный список. */
function fillDoc_(doc, values, listKeys) {
  const sections = [doc.getBody()];
  if (doc.getHeader()) sections.push(doc.getHeader());
  if (doc.getFooter()) sections.push(doc.getFooter());
  sections.forEach(sec => {
    Object.keys(values).forEach(k => {
      if (listKeys[k]) {
        const lines = String(values[k]).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        replaceWithList_(sec, k, lines.length ? lines : ['—']);
      }
    });
    Object.keys(values).forEach(k => {
      if (!listKeys[k]) sec.replaceText(phPattern_(k), escapeReplacement_(String(values[k])));
    });
    sec.replaceText('\\{\\{[A-Z_]+\\}\\}', '—');
  });
}

function phPattern_(key) { return '\\{\\{' + key + '\\}\\}'; }
function escapeReplacement_(s) { return s.replace(/\\/g, '\\\\').replace(/\$/g, '\\$'); }

function replaceWithList_(container, key, lines) {
  const pat = phPattern_(key);
  let found = container.findText(pat);
  let guard = 0;
  while (found && guard++ < 30) {
    const textEl = found.getElement().asText();
    const para = textEl.getParent();
    const parent = para.getParent();
    const whole = para.asText().getText().trim() === '{{' + key + '}}';
    if (!whole || typeof parent.insertListItem !== 'function') {
      textEl.replaceText(pat, escapeReplacement_(lines.join('; ')));
    } else {
      const idx = parent.getChildIndex(para);
      lines.forEach((ln, i) => {
        const li = parent.insertListItem(idx + 1 + i, ln);
        li.setGlyphType(DocumentApp.GlyphType.BULLET);
        li.editAsText().setFontSize(11).setBold(false);
        li.setSpacingAfter(2);
      });
      para.removeFromParent();
    }
    found = container.findText(pat);
  }
}

/**
 * Одна папка на объект: 01_OBJECTS/«Название (ID из CRM)»/{Стратегия, Отчёты, Материалы}.
 * kind: 'ROOT' — сама папка объекта, 'STRATEGIES' / 'REPORTS' / 'MATERIALS' — подпапка.
 * Ссылка на папку объекта записывается в 01_ОБЪЕКТЫ.
 */
function ensureObjectFolder_(id, kind) {
  let parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID'));
  if (!parent) { ensureDrive_(); parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID')); }
  const obj = objectById_(id);
  const suffix = '(' + id + ')';
  let root = null;
  const it = parent.getFolders();
  while (it.hasNext() && !root) {
    const f = it.next();
    if (f.getName().slice(-suffix.length) === suffix) root = f;
  }
  if (!root) {
    root = parent.createFolder((obj ? obj.name : id) + ' ' + suffix);
    Object.keys(SYS.OBJECT_SUBFOLDERS).forEach(k => childFolder_(root, SYS.OBJECT_SUBFOLDERS[k]));
  }
  if (obj && obj.folder_link !== root.getUrl()) writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { folder_link: root.getUrl() });
  if (!kind || kind === 'ROOT') return root;
  return childFolder_(root, SYS.OBJECT_SUBFOLDERS[kind]);
}

/** Шаблон «Еженедельный отчёт по продаже объекта» (создаётся один раз, дальше можно менять вёрстку в Google Docs). */
function ensureReportTemplate_() {
  const id = String(cfgGet_('TEMPLATE_REPORT_ID') || '');
  if (id) {
    try { if (!DriveApp.getFileById(id).isTrashed()) return id; } catch (e) { /* создадим заново */ }
  }
  const doc = DocumentApp.create(SYS.REPORT_TEMPLATE_NAME);
  const b = doc.getBody();
  b.setMarginTop(48).setMarginBottom(48).setMarginLeft(56).setMarginRight(56);
  const base = {};
  base[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
  base[DocumentApp.Attribute.FONT_SIZE] = 11;
  base[DocumentApp.Attribute.FOREGROUND_COLOR] = '#263238';
  b.setAttributes(base);
  const H = DocumentApp.ParagraphHeading;
  b.getParagraphs()[0].setText('Еженедельный отчёт о продаже объекта').setHeading(H.SUBTITLE);
  b.appendParagraph('{{OBJECT}}').setHeading(H.TITLE);
  const info = b.appendTable([
    ['Адрес', '{{ADDRESS}}'], ['Период', '{{PERIOD}}'], ['Цена', '{{PRICE}}'], ['Дней в экспозиции', '{{DAYS_ON_MARKET}}'],
  ]);
  styleTable_(info, false);
  const sec = (title, level) => b.appendParagraph(title).setHeading(level || H.HEADING2);
  sec('1. Что сделано за неделю');
  b.appendParagraph('Выполнено действий: {{ACTIONS}}. Основные каналы: {{CHANNELS}}.');
  b.appendParagraph('{{DONE}}');
  sec('2. Результаты недели');
  const res = b.appendTable([
    ['Показатель', 'Значение'],
    ['Контакты с потенциальными покупателями', '{{CONTACTS}}'], ['Получили ответ', '{{RESPONSES}}'],
    ['Проявили интерес (лиды)', '{{INTERESTED}}'], ['Презентации', '{{PRESENTATIONS}}'],
    ['Показы', '{{SHOWINGS}}'], ['Переговоры', '{{NEGOTIATIONS}}'], ['Предложения', '{{OFFERS}}'],
    ['Брони', '{{BOOKINGS}}'], ['Сделки', '{{DEALS}}'],
  ]);
  styleTable_(res, true);
  sec('3. Воронка и конверсии');
  b.appendParagraph('{{CONVERSIONS}}');
  sec('4. Что показал рынок');
  b.appendParagraph('{{MARKET_FEEDBACK}}');
  sec('Возражения покупателей', H.HEADING3);
  b.appendParagraph('{{OBJECTIONS}}');
  sec('Что протестировали на рынке', H.HEADING3);
  b.appendParagraph('{{TESTS}}');
  sec('5. Выводы');
  b.appendParagraph('{{CONCLUSIONS}}');
  sec('Что изменили в стратегии', H.HEADING3);
  b.appendParagraph('{{STRATEGY_CHANGES}}');
  sec('6. План на следующую неделю');
  b.appendParagraph('{{NEXT_WEEK}}');
  sec('Целевые показатели следующей недели', H.HEADING3);
  b.appendParagraph('{{NEXT_WEEK_KPI}}');
  sec('7. Комментарий руководителя');
  b.appendParagraph('{{MANAGER_COMMENT}}');
  b.appendParagraph('');
  b.appendParagraph('{{MANAGER_NAME}} {{MANAGER_CONTACT}} {{AGENCY}} · отчёт сформирован {{REPORT_DATE}}')
    .editAsText().setFontSize(9).setForegroundColor('#80868B');
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  const tplFolder = folderById_(cfgGet_('FOLDER_TEMPLATES_ID'));
  if (tplFolder) file.moveTo(tplFolder);
  cfgSet_('TEMPLATE_REPORT_ID', doc.getId());
  return doc.getId();
}

function styleTable_(t, withHeader) {
  t.setBorderColor('#CFD8DC');
  for (let r = 0; r < t.getNumRows(); r++) {
    const row = t.getRow(r);
    row.getCell(0).setWidth(250);
    for (let c = 0; c < row.getNumCells(); c++) {
      row.getCell(c).setPaddingTop(3).setPaddingBottom(3);
      row.getCell(c).editAsText().setFontSize(10);
    }
    if (withHeader && r === 0) {
      for (let c = 0; c < row.getNumCells(); c++) row.getCell(c).setBackgroundColor('#ECEFF1').editAsText().setBold(true);
    } else if (!withHeader) {
      row.getCell(0).editAsText().setForegroundColor('#80868B');
    }
  }
}
