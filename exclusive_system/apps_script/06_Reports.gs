/**
 * 06_Reports — еженедельный отчёт клиенту: Google Документ (единственная актуальная версия, ссылка — клиенту) + архив.
 *
 * Формат — как в отчётах руководителя (шапка ИП, таблица реквизитов,
 * Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА, Раздел 2. ПОЛУЧЕННЫЕ ЗАЯВКИ, Раздел 3. ПЛАН РАБОТЫ, Раздел 4. РЕКЛАМА НА ПЛОЩАДКАХ).
 * Источник — лист 05_ОТЧЁТ_КЛИЕНТУ (предпросмотр): скрипт берёт оттуда только поля с метками {{…}},
 * поэтому внутренние данные (контакты, звонки, комментарии) в документ попасть не могут.
 * Клиент доступа к таблице не получает — только ссылку на Google Документ отчёта (просмотр; скачать в Word — Файл → Скачать).
 */

/** Меню «Создать отчёт клиенту»: окно выбора объекта и недели (по умолчанию — объект текущей вкладки / строки). */
function createReport() {
  const rep = sheet_('REP');
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && !isServiceObject_(o));
  const cur = String(selectedObjectId_() || rep.getRange('E3').getValue() || '');
  const weeks = dictRows_('weeks').map(r => String(r[3] || '')).filter(Boolean);
  const nowWk = isoWeekKey_(today_());
  const curWk = weeks.find(w => w.indexOf(nowWk) === 0) || String(rep.getRange('B4').getValue() || '');
  const opt = (v, t, sel) => '<option value="' + htmlEscape_(v) + '"' + (sel ? ' selected' : '') + '>' + htmlEscape_(t) + '</option>';
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div style="margin:6px 0">Объект:<br><select id="o" style="width:100%">' + objs.map(o => opt(o.id, o.name + ' (' + o.id + ')', String(o.id) === cur)).join('') + '</select></div>' +
    '<div style="margin:6px 0">Неделя:<br><select id="w" style="width:100%">' + weeks.map(w => opt(w, w, w === curWk)).join('') + '</select></div>' +
    '<div style="margin:6px 0">Комментарий для клиента (необязательно):<br><textarea id="c" style="width:100%;height:60px"></textarea></div>' +
    '<div style="margin:6px 0">Комментарий для себя — только в CRM (необязательно):<br><textarea id="i" style="width:100%;height:45px"></textarea></div>' +
    '<button id="b" onclick="go(false)">Создать отчёт</button> <span id="s" style="color:#80868B"></span>' +
    '<div id="r" style="margin-top:10px"></div></div>' +
    '<script>' +
    'function go(force){var b=document.getElementById("b");b.disabled=true;document.getElementById("s").textContent="Собираю отчёт… (до минуты)";document.getElementById("r").innerHTML="";' +
    'google.script.run.withSuccessHandler(function(x){b.disabled=false;document.getElementById("s").textContent="";' +
    'if(x.exists){if(confirm("Отчёт по этому объекту за эту неделю уже есть. Создать новую версию? Прежняя останется в архиве со статусом «Заменён».")){go(true);}return;}' +
    'document.getElementById("r").innerHTML="<b>Готово: "+x.name+"</b><br><a target=_blank href=\'"+x.docUrl+"\'>Отчёт (Google Документ) — эту ссылку клиенту</a> · <a target=_blank href=\'"+x.docxUrl+"\'>Скачать в Word</a> · <a target=_blank href=\'"+x.folderUrl+"\'>Папка отчётов</a>"+(x.crm?"<br>"+x.crm:"");})' +
    '.withFailureHandler(function(e){b.disabled=false;document.getElementById("s").textContent="";document.getElementById("r").textContent="Ошибка: "+e.message;})' +
    '.createReportFor(document.getElementById("o").value,document.getElementById("w").value,document.getElementById("c").value,document.getElementById("i").value,force);}' +
    '</script>').setWidth(520).setHeight(470);
  SpreadsheetApp.getUi().showModalDialog(html, 'Отчёт клиенту');
}

/** Вызывается из окна «Отчёт клиенту»: выставляет объект и неделю в 05_ОТЧЁТ_КЛИЕНТУ и собирает отчёт. */
function createReportFor(id, weekLabel, comment, internal, force) {
  const obj = objectById_(id);
  if (!obj) throw new Error('Объект ' + id + ' не найден');
  const wk = String(weekLabel || '').split(' ')[0];
  if (!wk) throw new Error('Не выбрана неделя');
  if (!force && readTable_('ARCH').rows.some(r => String(r.obj_id) === String(id) && r.week === wk && r.status === REPORT_STATUS.ACTUAL)) return { exists: true };
  const rep = sheet_('REP');
  rep.getRange('B3').setValue(obj.id + ' · ' + obj.name);
  rep.getRange('B4').setValue(weekLabel);
  rep.getRange('B5').setValue(comment || '');
  rep.getRange('B6').setValue(internal || '');
  SpreadsheetApp.flush();
  if (String(rep.getRange('E3').getValue()) !== String(obj.id) || String(rep.getRange('E4').getValue()) !== wk) {
    throw new Error('Лист ' + SHEET_NAMES.REP + ' не переключился на объект / неделю — попробуйте ещё раз');
  }
  const res = generateReport_(String(obj.id), wk, { interactive: false });
  return { name: res.name, docUrl: res.docUrl, docxUrl: res.docxUrl || '', folderUrl: res.folderUrl, crm: res.crm || '' };
}

/** Собирает отчёт. Лист 05_ОТЧЁТ_КЛИЕНТУ должен быть выставлен на этот объект и неделю. */
function generateReport_(id, wk, opts) {
  opts = opts || {};
  const obj = objectById_(id);
  if (!obj) throw new Error('Объект ' + id + ' не найден в ' + SHEET_NAMES.OBJ);
  const values = readReportValues_();
  try {
    const aud = audienceReportLines_(id, wk);
    if (aud.length) values.kv.SUMMARY = [String(values.kv.SUMMARY || '').trim(), aud.join('\n')].filter(Boolean).join('\n');
  } catch (e) { /* без цифр по аудиториям */ }
  addAdStats_(values, obj, wk);
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
  // PDF и копии не делаем: отчёт — один Google Документ, правки в нём сразу видны по ссылке
  try { copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { Logger.log('Доступ по ссылке: ' + e.message); }

  appendRow_('ARCH', {
    ts: new Date(), obj_id: id, obj_name: obj.name, report_no: values.kv.REPORT_NO, week: wk, period: values.kv.PERIOD,
    doc_link: copy.getUrl(), pdf_link: '', author: userEmail_(), status: REPORT_STATUS.ACTUAL,
  });
  writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { last_report_link: copy.getUrl(), last_report_date: today_() });
  let crm = '';
  try { crm = sendReportToCrm_(obj, values, copy.getUrl(), sheet_('REP').getRange('B6').getValue(), wk); } catch (e) { crm = '⚠ CRM: ' + e.message; }
  if (crm) { const a = readTable_('ARCH'); const last = a.rows[a.rows.length - 1]; if (last) writeFields_(a.sh, 'ARCH', last._row, { crm: crm }); }
  return { crm: crm, name: name, docId: copy.getId(), docUrl: copy.getUrl(), docxUrl: wordExportUrl_(copy.getId()), folderUrl: folder.getUrl() };
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
  keys.AD_STATS = true; // раздел «Реклама на площадках» — строки из отчёта по рекламе CRM
  return keys;
}

/** Подстановка: поля — replaceText, многострочные — абзацами, таблицы — строками таблицы. */
function fillReportDoc_(doc, values) {
  const body = doc.getBody();
  Object.keys(values.tables).forEach(ph => fillTableRows_(body, ph, values.tables[ph]));
  const lines = lineKeys_();
  Object.keys(values.kv).forEach(k => {
    const v = String(values.kv[k] || '').trim();
    if (!v && (k === 'COMMENT' || k === 'SUMMARY' || k === 'AD_STATS')) { removeBlock_(body, k); return; }
    if (lines[k]) replaceWithLines_(body, k, v.split(/\r?\n/).map(x => x.trim()).filter(Boolean));
  });
  [body, doc.getHeader(), doc.getFooter()].forEach(sec => {
    if (!sec) return;
    Object.keys(values.kv).forEach(k => {
      if (!lines[k]) sec.replaceText(phPattern_(k), escapeReplacement_(String(values.kv[k] || '—')));
    });
    sec.replaceText('\\{\\{[A-Z_]+\\}\\}', '—');
  });
  try { linkifyBody_(body); } catch (e) { /* без кликабельных ссылок */ }
}

/** Адреса в тексте отчёта (ссылка на ЦИАН, публикации) — кликабельные. */
function linkifyBody_(body) {
  let f = body.findText('https?://[^\\s]+');
  while (f) {
    const t = f.getElement().asText(), a = f.getStartOffset(), b = f.getEndOffsetInclusive();
    t.setLinkUrl(a, b, t.getText().slice(a, b + 1));
    f = body.findText('https?://[^\\s]+', f);
  }
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
const REPORT_TEMPLATE_VERSION = '5'; // 2: без строки «Приложение №1 к Договору № … от …»; 4: раздел 4 «Реклама на площадках»; 5: подпись без «Исполнитель: ____»

function ensureReportTemplate_() {
  const id = String(cfgGet_('TEMPLATE_REPORT_ID') || '');
  const props = PropertiesService.getDocumentProperties();
  const fresh = props.getProperty('TEMPLATE_VERSION') === REPORT_TEMPLATE_VERSION;
  if (id) {
    try {
      const f = DriveApp.getFileById(id);
      if (!f.isTrashed() && fresh) return id;
      if (!f.isTrashed()) f.setName(f.getName() + ' (старая версия)'); // шаблон изменился — старый остаётся в папке
    } catch (e) { /* создадим заново */ }
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
  props.setProperty('TEMPLATE_VERSION', REPORT_TEMPLATE_VERSION);
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
  b.appendParagraph('Раздел 4. РЕКЛАМА НА ПЛОЩАДКАХ').setHeading(H.HEADING3);
  b.appendParagraph('{{AD_STATS}}');
  b.appendParagraph('Комментарий').setHeading(H.HEADING4);
  b.appendParagraph('{{COMMENT}}');
  b.appendParagraph('');
  b.appendParagraph('{{SIGNATURE}}');
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

/**
 * Отчёты, отправленные клиенту до системы (по старой форме): PDF или документ кладут в папку объекта «Отчёты».
 * Файлы, которых нет в 10_АРХИВ_ОТЧЁТОВ, записываются туда со статусом «Старая форма» — отметка, что отчёт был.
 * На нумерацию и вид новых отчётов это не влияет. № и период берутся из имени файла («Отчет №06 … 21.09-25.09»).
 */
function registerOldReports_() {
  const arch = readTable_('ARCH');
  const known = {};
  arch.rows.forEach(r => [r.doc_link, r.pdf_link].forEach(l => { const id = idFromUrl_(l); if (id) known[id] = true; }));
  const rows = [];
  readTable_('OBJ').rows.forEach(o => {
    if (!o.id || !o.name || isServiceObject_(o) || !o.folder_link) return;
    let folder;
    try { folder = ensureObjectFolder_(o.id, 'REPORTS'); } catch (e) { return; }
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const mime = f.getMimeType();
      if (known[f.getId()] || (mime !== MimeType.PDF && mime !== MimeType.GOOGLE_DOCS)) continue;
      if (/\((устаревший|временно)\)/i.test(f.getName())) continue; // старые версии PDF системных отчётов
      if (mime === MimeType.GOOGLE_DOCS && folder.getFilesByName(f.getName() + '.pdf').hasNext()) continue; // док системного отчёта рядом с PDF
      const info = oldReportInfo_(f.getName(), f.getDateCreated());
      rows.push({
        ts: f.getDateCreated(), obj_id: String(o.id), obj_name: o.name, report_no: info.no, week: info.week, period: info.period,
        doc_link: mime === MimeType.GOOGLE_DOCS ? f.getUrl() : '', pdf_link: mime === MimeType.PDF ? f.getUrl() : '',
        author: 'старая форма', status: REPORT_STATUS.OLD,
      });
    }
  });
  if (!rows.length) return 0;
  rows.sort((a, b) => a.ts - b.ts);
  appendRows_('ARCH', rows);
  logHistory_(rows.map(r => ({ sheet: SHEET_NAMES.ARCH, record_id: r.report_no ? '№' + r.report_no : '', obj_id: r.obj_id, field: 'Отчёт',
    old: '', new: r.period || r.pdf_link || r.doc_link, kind: HIST_KIND.CREATE, note: 'Отчёт по старой форме добавлен в архив' })), 'система');
  return rows.length;
}

/** «Отчет №06 за период 21.09-25.09.pdf» → {no: 6, period: '21.09.2026 – 25.09.2026', week: '2026-W39'}. */
function oldReportInfo_(name, created) {
  const s = String(name || '');
  const n = /№\s*0*(\d{1,3})(?![\d.])/.exec(s) || /отч[её]т\D{0,12}?0*(\d{1,3})(?![\d.])/i.exec(s) || /(?:^|[^\d.])0*(\d{1,3})(?![\d.])/.exec(s);
  const p = /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s*[-–—_]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/.exec(s);
  const out = { no: n ? Number(n[1]) : '', period: '', week: '' };
  if (p) {
    const cy = (created instanceof Date ? created : new Date()).getFullYear();
    const yr = y => !y ? cy : (y.length === 2 ? 2000 + Number(y) : Number(y));
    const to = new Date(yr(p[6] || p[3]), Number(p[5]) - 1, Number(p[4]));
    const from = new Date(yr(p[3] || p[6]), Number(p[2]) - 1, Number(p[1]));
    if (!p[3] && !p[6] && to - (created instanceof Date ? created : new Date()) > 30 * 864e5) { // год не указан, а дата сильно в будущем — прошлый год
      to.setFullYear(to.getFullYear() - 1);
      from.setFullYear(from.getFullYear() - 1);
    }
    out.period = fmtDate_(from) + ' – ' + fmtDate_(to);
    out.week = isoWeekKey_(to);
  }
  return out;
}

/** Ссылка «скачать в Word» — всегда актуальная версия Google Документа отчёта. */
function wordExportUrl_(docId) { return 'https://docs.google.com/document/d/' + docId + '/export?format=docx'; }
