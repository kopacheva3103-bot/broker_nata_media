/**
 * 19_Inbox — папка «04_ВХОДЯЩИЕ — новые объекты» на Google Диске.
 *
 * Кладёте туда презентацию / КП объекта (PDF, PowerPoint, Word, Google Slides / Docs) — система:
 *  1) определяет объект: по ID в начале имени файла («4801 Остров.pdf»), иначе по названию;
 *  2) если объекта нет — заводит его в 01_ОБЪЕКТЫ: название из имени файла, адрес, площадь, цена, тип, сделка
 *     распознаются из текста презентации (проверьте их); без ID из CRM объект получает временный ID «НОВ-001» —
 *     замените его на ID из CRM в 01_ОБЪЕКТЫ, он обновится везде (и в имени папки);
 *  3) создаёт вкладку объекта и папку объекта на Диске, переносит файл в «КП и презентации».
 * Разбор: меню «➜ Разобрать папку «Входящие»» или автоматически каждые 10 минут (Сервис → Включить автообновление).
 */

const INBOX_TEMP_PREFIX = 'НОВ-';

function inboxFolder_() {
  let f = folderById_(cfgGet_('FOLDER_INBOX_ID'));
  if (f) return f;
  let root = folderById_(cfgGet_('FOLDER_ROOT_ID'));
  if (!root) { ensureDrive_(); root = folderById_(cfgGet_('FOLDER_ROOT_ID')); }
  f = childFolder_(root, SYS.FOLDERS.INBOX);
  cfgSet_('FOLDER_INBOX_ID', f.getId());
  return f;
}

function processInbox() {
  const r = processInbox_();
  const ui = SpreadsheetApp.getUi();
  if (!r.done.length && !r.errors.length) { ui.alert('Входящие', 'Папка «' + SYS.FOLDERS.INBOX + '» пуста.', ui.ButtonSet.OK); return; }
  ui.alert('Входящие разобраны', r.done.join('\n') + (r.errors.length ? '\n\nНе удалось:\n' + r.errors.join('\n') : '') +
    (r.created ? '\n\nПроверьте новые объекты в 01_ОБЪЕКТЫ: поля из презентации заполнены автоматически. Временный ID «' + INBOX_TEMP_PREFIX + '…» замените на ID из CRM.' : ''), ui.ButtonSet.OK);
}

/** Автоматический разбор (триггер каждые 10 минут). */
function inboxJob() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;
  try { processInbox_(); } catch (e) { Logger.log('Входящие: ' + e.message); } finally { lock.releaseLock(); }
}

function processInbox_() {
  const inbox = inboxFolder_();
  const res = { done: [], errors: [], created: 0 };
  const start = Date.now();
  const it = inbox.getFiles();
  const hist = [];
  while (it.hasNext()) {
    if (Date.now() - start > 4 * 60000) break; // остальное — следующим запуском
    const file = it.next();
    const fname = file.getName();
    if (fname.indexOf('__tmp') === 0) continue;
    try {
      const parsed = parseInboxName_(fname);
      let obj = parsed.id ? objectById_(parsed.id) : findObjectByName_(parsed.name);
      let note = '';
      if (!obj) {
        const info = guessObjectInfo_(extractFileText_(file));
        const id = parsed.id || nextTempObjectId_();
        const name = parsed.name || info.name || 'Новый объект ' + id;
        const row = { id: id, name: name, status: dictValues_('obj_status').indexOf('Подготовка') >= 0 ? 'Подготовка' : (dictValues_('obj_status')[0] || ''), created_at: today_() };
        ['kind', 'deal', 'address', 'area', 'price'].forEach(k => { if (info[k] !== undefined && info[k] !== '') row[k] = info[k]; });
        appendRow_('OBJ', row);
        SpreadsheetApp.flush();
        obj = objectById_(id);
        syncObjectTab_(obj, 'create');
        res.created++;
        const got = ['address', 'area', 'price', 'kind', 'deal'].filter(k => row[k] !== undefined);
        note = 'новый объект ' + id + (got.length ? ' (из презентации: ' + got.map(k => fieldTitle_('OBJ', k)).join(', ') + ')' : '');
        hist.push({ sheet: SHEET_NAMES.OBJ, record_id: id, obj_id: id, field: 'Объект', old: '', new: name, kind: HIST_KIND.CREATE, note: 'Из папки «Входящие»: ' + fname });
      }
      const folder = ensureObjectFolder_(obj.id, 'MATERIALS');
      file.moveTo(folder);
      hist.push({ sheet: 'Google Диск', record_id: fname, obj_id: obj.id, field: 'Файл объекта', old: SYS.FOLDERS.INBOX, new: 'КП и презентации', kind: HIST_KIND.MOVE });
      res.done.push('• ' + fname + ' → ' + obj.name + ' (' + obj.id + ')' + (note ? ' — ' + note : ''));
      const tab = findObjectTab_(obj);
      if (tab) { try { fillObjectFiles_(tab, objectById_(obj.id)); } catch (e) { /* список обновится утром */ } }
    } catch (e) {
      res.errors.push('• ' + fname + ': ' + e.message);
    }
  }
  logHistory_(hist, userEmail_());
  return res;
}

/** «4801 — Остров, дом 450.pdf» → {id:'4801', name:'Остров, дом 450'}; «Презентация ЖК Время.pptx» → {id:'', name:'ЖК Время'}. */
function parseInboxName_(fname) {
  let base = String(fname).replace(/\.[A-Za-z0-9]{2,5}$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  let id = '';
  const m = /^\s*(\d{3,}|[A-Za-zА-Яа-яЁё]{2,6}-\d{1,6})\s*[-—–.·:)]*\s+(.+)$/.exec(base);
  if (m) { id = m[1].toUpperCase(); base = m[2]; }
  const name = (' ' + base + ' ').replace(/(^|[\s,.;()«»"-])(презентация|презентации|коммерческое предложение|кп|pdf|финал|final|new|новая|версия|v\d+)(?=[\s,.;()«»"-]|$)/gi, '$1 ')
    .replace(/\(\d+\)/g, ' ').replace(/[\s\-—–_.]+$/g, '').replace(/^[\s\-—–_.]+/g, '').replace(/\s{2,}/g, ' ').trim();
  return { id: id, name: name };
}

function findObjectByName_(name) {
  const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ').trim();
  const n = norm(name);
  if (n.length < 4) return null;
  const rows = readTable_('OBJ').rows.filter(o => o.id && o.name);
  return rows.find(o => norm(o.name) === n) ||
    rows.find(o => { const on = norm(o.name); return on.length >= 4 && (on.indexOf(n) >= 0 || n.indexOf(on) >= 0); }) || null;
}

function nextTempObjectId_() {
  let n = 0;
  readTable_('OBJ').rows.forEach(o => { const m = new RegExp('^' + INBOX_TEMP_PREFIX + '(\\d+)$').exec(String(o.id)); if (m) n = Math.max(n, Number(m[1])); });
  const s = String(n + 1);
  return INBOX_TEMP_PREFIX + (s.length < 3 ? '00'.slice(s.length - 1) : '') + s;
}

/** Текст файла: PDF / Word → Google Документ (с распознаванием), PowerPoint → Google Презентация, затем выгрузка текстом. */
function extractFileText_(file) {
  const mime = String(file.getMimeType());
  const api = 'https://www.googleapis.com/drive/v3/files/';
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  let srcId = file.getId(), tmpId = '';
  try {
    if (!/google-apps\.(document|presentation)/.test(mime)) {
      const target = /presentation|powerpoint/.test(mime) ? 'application/vnd.google-apps.presentation'
        : /pdf|wordprocessingml|msword|text\/plain|rtf/.test(mime) ? 'application/vnd.google-apps.document' : '';
      if (!target) return '';
      const r = UrlFetchApp.fetch(api + srcId + '/copy?ocrLanguage=ru&fields=id', {
        method: 'post', contentType: 'application/json', headers: auth, muteHttpExceptions: true,
        payload: JSON.stringify({ name: '__tmp_text ' + file.getName(), mimeType: target }),
      });
      if (r.getResponseCode() >= 300) return '';
      tmpId = JSON.parse(r.getContentText()).id;
      srcId = tmpId;
    }
    const e = UrlFetchApp.fetch(api + srcId + '/export?mimeType=text/plain', { headers: auth, muteHttpExceptions: true });
    return e.getResponseCode() < 300 ? e.getContentText() : '';
  } catch (err) {
    return '';
  } finally {
    if (tmpId) { try { DriveApp.getFileById(tmpId).setTrashed(true); } catch (e) { /* черновик останется в корзине */ } }
  }
}

/** Адрес, площадь, цена, тип, сделка — из текста презентации (эвристика, проверяйте). */
function guessObjectInfo_(text) {
  const t = String(text || '').replace(/ /g, ' ');
  const info = {};
  if (!t.trim()) return info;
  const lines = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const strong = /(г\.\s*Москва|Москва,|Московская обл|обл\.|МО,|ул\.|улица|проспект|пр-т|шоссе|переулок|пер\.|бульвар|наб\.|р-н|район)/i;
  const weak = /(пос\.|посёлок|поселок|КП\s|ЖК\s)/i;
  const addr = lines.find(l => strong.test(l) && l.length <= 160) || lines.find(l => weak.test(l) && l.length <= 160);
  if (addr) info.address = addr.replace(/^(адрес|расположение)\s*[:—-]\s*/i, '');
  const num = s => Number(String(s).replace(/[\s ]/g, '').replace(',', '.'));
  const am = /(\d{1,3}(?:[\s ]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(?:м²|м2|кв\.?\s?м)/i.exec(t);
  if (am && num(am[1]) > 5) info.area = num(am[1]);
  let best = 0;
  const priceRe = /(\d{1,3}(?:[\s ]\d{3})+|\d+(?:[.,]\d+)?)\s*(млрд|млн)?\.?\s*(?:₽|руб|р\.)/gi;
  let pm;
  while ((pm = priceRe.exec(t)) !== null) {
    let v = num(pm[1]);
    if (/млрд/i.test(pm[2] || '')) v *= 1e9; else if (/млн/i.test(pm[2] || '')) v *= 1e6;
    const around = t.slice(Math.max(0, pm.index - 25), pm.index);
    const after = t.slice(pm.index + pm[0].length, pm.index + pm[0].length + 12).split(/\r?\n/)[0];
    const before = around.split(/\r?\n/).pop();
    if (/^\s*(за\s*(м²|м2|кв)|\/\s*м)/i.test(after) || /за\s*(м²|м2|кв)/i.test(before)) continue; // цена за м²
    if (v > best) best = v;
  }
  if (best >= 100000) info.price = Math.round(best);
  const low = t.toLowerCase();
  info.deal = /аренд|в месяц|\/мес|ставка/.test(low) && !/продаж|продаётся|продается/.test(low) ? 'Аренда' : (/продаж|продаётся|продается|стоимость/.test(low) ? 'Продажа' : '');
  const kinds = dictValues_('obj_kinds');
  const k = /особняк/.test(low) ? 'Особняк' : /(загородн|коттедж|участок|кп\s|посёлок|поселок|дом\s)/.test(low) ? 'Загородный дом'
    : /(псн|помещени|коммерч|офис|ритейл|габ|стрит-ритейл|торгов)/.test(low) ? 'Коммерция' : /(квартир|апартамент|жк\s)/.test(low) ? 'Жильё' : '';
  if (k && kinds.indexOf(k) >= 0) info.kind = k;
  const title = lines.find(l => l.length >= 4 && l.length <= 60 && !/^\d/.test(l));
  if (title) info.name = title;
  Object.keys(info).forEach(x => { if (info[x] === '') delete info[x]; });
  return info;
}
