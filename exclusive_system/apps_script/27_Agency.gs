/**
 * 27_Agency — «Агентство — общие задачи»: служебный объект для рутинных задач с оперативки, не привязанных к объекту
 * (CRM, соцсети агентства, регламенты, документы, найм, обучение). ID «АГЕНТСТВО», статус «Внутреннее» (не в работе):
 * без вкладки, папки, отчётов и дэшборда объектов; задачи — в 02_ЗАДАЧИ, календарях и утренней сводке как обычно.
 * Общие решения с оперативок — в документ «Решения оперативок — общие по агентству» в корневой папке системы.
 */

const AGENCY_ID = 'АГЕНТСТВО';
const AGENCY_NAME = 'Агентство — общие задачи';
const AGENCY_DOC_NAME = 'Решения оперативок — общие по агентству';

function isServiceObject_(o) { return !!o && String(o.id) === AGENCY_ID; }

/** Создаёт служебный объект, если его нет. */
function ensureAgencyObject_() {
  if (objectById_(AGENCY_ID)) return false;
  appendRow_('OBJ', Object.assign({}, teamDefaults_(), { id: AGENCY_ID, name: AGENCY_NAME, status: 'Внутреннее', created_at: today_() }));
  return true;
}

/** Документ для общих решений с оперативок (в корневой папке системы). */
function ensureAgencyDecisionsDoc_() {
  const root = folderById_(cfgGet_('FOLDER_ROOT_ID'));
  if (!root) throw new Error('Нет корневой папки системы — «Установить / обновить систему»');
  const it = root.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getName() === AGENCY_DOC_NAME && !f.isTrashed()) return f; }
  const doc = DocumentApp.create(AGENCY_DOC_NAME);
  const b = doc.getBody();
  b.getParagraphs()[0].setText(AGENCY_DOC_NAME);
  b.getParagraphs()[0].setHeading(DocumentApp.ParagraphHeading.TITLE);
  b.appendParagraph('Общие решения с оперативок (не по конкретному объекту). Новые записи добавляются ниже: сначала дата, затем решения.')
    .editAsText().setItalic(true).setFontSize(10);
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(root);
  return file;
}
