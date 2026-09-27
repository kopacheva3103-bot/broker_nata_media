/**
 * 24_AnalogTemplate — шаблон «Анализ аналогов (конкуренты)» в 02_ШАБЛОНЫ.
 * Файл берётся из репозитория (templates/analogs_template.xlsx) и загружается как Google Таблица.
 * Новая версия шаблона заменяет старую (старая — в корзину). Копии в папках объектов не трогаются.
 */

const ANALOG_TEMPLATE_VERSION = '2';
const ANALOG_TEMPLATE_NAME = 'Шаблон — Анализ аналогов (конкуренты)';
const ANALOG_TEMPLATE_URL = 'https://raw.githubusercontent.com/kopacheva3103-bot/broker_nata_media/claude/gallant-gauss-krudky/exclusive_system/templates/analogs_template.xlsx';

/** Установка / меню: создать или обновить шаблон. Возвращает текст для журнала установки или ''. */
function ensureAnalogTemplate_(force) {
  const folder = folderById_(cfgGet_('FOLDER_TEMPLATES_ID'));
  if (!folder) return '';
  const mark = 'analogs v' + ANALOG_TEMPLATE_VERSION;
  const old = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(ANALOG_TEMPLATE_NAME) !== 0) continue;
    if (!force && f.getDescription() === mark && f.getMimeType() === MimeType.GOOGLE_SHEETS) return '';
    old.push(f);
  }
  const res = UrlFetchApp.fetch(ANALOG_TEMPLATE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('не скачался шаблон (' + res.getResponseCode() + ')');
  const id = uploadAsSheet_(res.getBlob(), ANALOG_TEMPLATE_NAME, folder.getId(), mark);
  old.forEach(f => { try { f.setTrashed(true); } catch (e) { /* чужой файл — оставляем */ } });
  return 'Шаблон «' + ANALOG_TEMPLATE_NAME + '» в 02_ШАБЛОНЫ ' + (old.length ? 'обновлён' : 'создан') + ': https://docs.google.com/spreadsheets/d/' + id;
}

/** Excel → Google Таблица через Drive API (multipart upload с конвертацией). */
function uploadAsSheet_(blob, name, folderId, description) {
  const boundary = 'b' + Utilities.getUuid();
  const meta = { name: name, mimeType: MimeType.GOOGLE_SHEETS, parents: [folderId], description: description };
  const head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--' + boundary + '\r\nContent-Type: ' + MimeType.MICROSOFT_EXCEL + '\r\n\r\n';
  const tail = '\r\n--' + boundary + '--';
  const body = Utilities.newBlob(head).getBytes().concat(blob.getBytes()).concat(Utilities.newBlob(tail).getBytes());
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: body,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('Drive: ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText()).id;
}

/** Меню: обновить шаблон анализа аналогов принудительно. */
function updateAnalogTemplate() {
  const msg = ensureAnalogTemplate_(true);
  SpreadsheetApp.getUi().alert(msg || 'Папка 02_ШАБЛОНЫ не найдена — запустите «Установить / обновить систему».');
}
