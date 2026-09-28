/**
 * 23_StrategyDoc — документ «Маркетинговая стратегия — <объект>» в папке каждого объекта (Google Doc).
 * Один файл на объект, он только пополняется: каждая вставка стратегии из Claude и решения с оперативки
 * дописываются блоком «дата · кто добавил» → тезисы по разделам. Старое не удаляется — это история стратегии.
 * Аналитика (цены, аналоги, расчёты) — отдельные файлы в папке «Аналитика».
 */

const STRATEGY_DOC_PREFIX = 'Маркетинговая стратегия — ';

function strategyDocName_(obj) { return STRATEGY_DOC_PREFIX + obj.name; }

/** Документ стратегии объекта: найти в папке объекта (по началу названия) или создать. */
function ensureStrategyDoc_(obj) {
  const folder = ensureObjectFolder_(obj.id, 'ROOT');
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(STRATEGY_DOC_PREFIX) === 0 && !f.isTrashed() && String(f.getMimeType()).indexOf('document') >= 0) return f;
  }
  const doc = DocumentApp.create(strategyDocName_(obj));
  const b = doc.getBody();
  b.getParagraphs()[0].setText('Маркетинговая стратегия: ' + obj.name);
  b.getParagraphs()[0].setHeading(DocumentApp.ParagraphHeading.TITLE);
  b.appendParagraph([obj.address, obj.kind, obj.deal, obj.area ? obj.area + ' м²' : '', 'ID ' + obj.id].filter(Boolean).join(' · '));
  b.appendParagraph('Документ пополняется: новые записи добавляются ниже — сначала дата, затем тезисы. Старое не удаляем — это история стратегии. Аналитика — отдельные файлы в папке «Аналитика».')
    .editAsText().setItalic(true).setFontSize(10);
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(folder);
  return file;
}

/**
 * Дописать блок в документ стратегии.
 * sections: [{title: 'Сценарии', lines: ['…', '…']}, …]; пустые разделы пропускаются.
 */
function appendStrategyDoc_(obj, source, sections) {
  const secs = sections.filter(s => s.lines && s.lines.length);
  if (!secs.length) return '';
  const file = isServiceObject_(obj) ? ensureAgencyDecisionsDoc_() : ensureStrategyDoc_(obj);
  const doc = DocumentApp.openById(file.getId());
  const b = doc.getBody();
  const who = personByEmail_(userEmail_()) || userEmail_();
  b.appendParagraph(fmtDate_(new Date(), 'dd.MM.yyyy') + (source ? ' · ' + source : '') + (who ? ' · ' + who : ''))
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  secs.forEach(s => {
    b.appendParagraph(s.title).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    s.lines.forEach(l => b.appendListItem(String(l)).setGlyphType(DocumentApp.GlyphType.BULLET));
  });
  doc.saveAndClose();
  return file.getUrl();
}

/** Тезисы по разделам из вставленных строк вкладки (для документа стратегии). */
function strategyThesis_(plan) {
  const cols = {};
  objTabSections_().forEach(s => { if (s.cols) cols[s.key] = s.cols; });
  const money = v => typeof v === 'number' ? v.toLocaleString('ru-RU') + ' ₽' : v;
  const j = (row, map) => map.map(m => {
    const v = row[m[0]];
    if (v === undefined || v === '') return '';
    return (m[1] ? m[1] + ': ' : '') + (m[2] ? m[2](v) : v);
  }).filter(Boolean);
  const rows = key => plan.rows[key] || [];
  const out = [];
  const kv = plan.kv;
  const price = [];
  if (kv.positioning) price.push('Позиционирование: ' + kv.positioning);
  if (kv.rec_price) price.push('Рекомендуемая цена: ' + money(kv.rec_price));
  if (kv.min_price) price.push('Минимальная цена: ' + money(kv.min_price));
  if (kv.price_note) price.push('Вывод по цене: ' + kv.price_note);
  out.push({ title: 'Цена и позиционирование', lines: price });
  out.push({ title: 'Аналоги', lines: rows('ANALOG').map(r => { const p = j(r, [[1], [2, '', v => v + ' м²'], [3, '', money]]); return r[0] + (p.length ? ' — ' + p.join(', ') : '') + (r[6] ? '. ' + r[6] : ''); }) });
  out.push({ title: 'Сценарии использования', lines: rows('SCEN').map(r => r[0] + (r[4] ? ' — ' + r[4] : '') + (r[5] ? ' [' + r[5] + ']' : '') + (j(r, [[2, 'проверить'], [3, 'привлечь']]).length ? '. ' + j(r, [[2, 'проверить'], [3, 'привлечь']]).join('; ') : '')) });
  out.push({ title: 'Целевые аудитории', lines: rows('AUD').map(r => (r[4] ? r[4] + ' ' : '') + r[0] + (r[1] ? ' (' + r[1] + ')' : '') + (r[2] ? ' — ' + r[2] : '') + (r[3] ? '. Где искать: ' + r[3] : '')) });
  out.push({ title: 'Каналы и партнёры', lines: rows('CHAN').map(r => r[0] + (r[1] ? ' — ' + r[1] : '')) });
  out.push({ title: 'КП и материалы', lines: rows('KP').map(r => r[0] + (r[1] ? ' (' + r[1] + ')' : '') + (r[2] ? ' — для: ' + r[2] : '') + (r[5] ? '. ' + r[5] : '')) });
  out.push({ title: 'Выводы и решения', lines: rows('DEC').map(r => r[1] + (r[3] ? ' → ' + r[3] : '')) });
  out.push({ title: 'Задачи на 2 недели', lines: (plan.tasks || []).map(o => o.task + (o.owner ? ' — ' + o.owner : '') + (o.plan !== '' && o.plan !== undefined ? ', ' + o.plan + (o.unit ? ' ' + o.unit : '') : '') + (o.deadline ? ', до ' + fmtDate_(o.deadline) : '')) });
  return out;
}

/** Меню / установка: документ стратегии у каждого объекта. */
function ensureAllStrategyDocs_(start) {
  start = start || Date.now();
  let n = 0;
  readTable_('OBJ').rows.forEach(o => {
    if (!o.id || !o.name || isServiceObject_(o) || Date.now() - start > 4 * 60000) return;
    try { ensureStrategyDoc_(o); n++; } catch (e) { Logger.log('Стратегия ' + o.id + ': ' + e.message); }
  });
  return n;
}
