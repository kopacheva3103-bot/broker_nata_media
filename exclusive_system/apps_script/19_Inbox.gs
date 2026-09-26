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
      if (!obj && parsed.id && isCrmId_(parsed.id)) { // «144890621 12 месяцев.pdf», а объект заведён как НОВ-001 — присваиваем ID из CRM
        const same = findObjectByName_(parsed.name);
        if (same && !isCrmId_(same.id)) {
          writeFields_(sheet_('OBJ'), 'OBJ', same._row, { id: parsed.id });
          renameObjectId_(String(same.id), parsed.id);
          hist.push({ sheet: SHEET_NAMES.OBJ, record_id: parsed.id, obj_id: parsed.id, field: fieldTitle_('OBJ', 'id'), old: same.id, new: parsed.id, kind: HIST_KIND.CHANGE, note: 'ID из имени файла ' + fname });
          SpreadsheetApp.flush();
          obj = objectById_(parsed.id);
        }
      }
      let note = '';
      const info = obj ? null : guessObjectInfo_(extractFileText_(file));
      if (!obj && info.address) obj = findObjectByAddress_(info.address);
      if (!obj && !parsed.id && !matchWords_(parsed.name, false).length && !info.address) {
        res.errors.push('• ' + fname + ': не понятно, какой это объект — переименуйте файл («ID Название.pdf») и разберите папку ещё раз');
        continue;
      }
      if (!obj) {
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
  base = base.replace(/^(продавцы|арендодатели)\s*,?\s*мои объекты\s*/i, ''); // имя выгрузки из ЦИАН
  let name = (' ' + base + ' ').replace(/(^|[\s,.;()«»"-])(презентация|презентации|коммерческое предложение|кп|pdf|финал|final|new|новая|версия|v\d+)(?=[\s,.;()«»"-]|$)/gi, '$1 ')
    .replace(/\(\d+\)/g, ' ').replace(/[\s\-—–_.,]+$/g, '').replace(/^[\s\-—–_.,]+/g, '').replace(/\s{2,}/g, ' ').trim();
  if (name && name === name.toLowerCase()) name = name.replace(/(^|\s)([а-яёa-z])/g, (x, sp, c) => sp + c.toUpperCase()); // «сосновый бор» → «Сосновый Бор»
  return { id: id, name: name };
}

const MATCH_STOP_ = ['жк', 'кп', 'дом', 'пос', 'ул', 'г', 'д', 'стр', 'корп', 'мои', 'объекты', 'продавцы', 'арендодатели', 'новый', 'объект',
  'москва', 'московская', 'обл', 'область', 'район', 'улица', 'город', 'деревня', 'поселок', 'территория', 'тер', 'вао', 'цао', 'зао', 'сао', 'юао', 'свао', 'сзао', 'юзао', 'ювао'];

/** Значимые слова: «ЖК Время · Лермонтовская 1» → ['время', 'лермонтовская'] (+ номера, если withNums). */
function matchWords_(s, withNums) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/)
    .filter(w => w && MATCH_STOP_.indexOf(w) < 0 && (/^\d+$/.test(w) ? withNums : w.length >= 3));
}

/** Слово запроса совпадает со словом объекта по основе: «лермонтовский» ↔ «лермонтовская», «озера» ↔ «озёра». */
function wordMatch_(q, w) {
  if (/^\d+$/.test(q) || /^\d+$/.test(w)) return q === w;
  const stem = x => x.slice(0, x.length <= 5 ? x.length : Math.max(5, x.length - 3));
  return w.indexOf(stem(q)) === 0 || q.indexOf(stem(w)) === 0;
}

/** Объект по названию из имени файла: все значимые слова должны найтись в названии или адресе объекта. */
function findObjectByName_(name) {
  const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ').trim();
  const n = norm(name);
  if (n.length < 3) return null;
  const rows = readTable_('OBJ').rows.filter(o => o.id && o.name);
  const exact = rows.find(o => norm(o.name) === n);
  if (exact) return exact;
  const q = matchWords_(n, false);
  if (!q.length) return null;
  let best = null, bestScore = -1e9, tie = false;
  rows.forEach(o => {
    const words = matchWords_(o.name + ' ' + (o.address || ''), false);
    if (!q.every(x => words.some(w => wordMatch_(x, w)))) return;
    const nameWords = matchWords_(o.name, false);
    const score = nameWords.filter(w => q.some(x => wordMatch_(x, w))).length * 10 - nameWords.length; // точнее совпало название — выше
    if (!best || score > bestScore) { best = o; bestScore = score; tie = false; } else if (score === bestScore) tie = true;
  });
  return tie ? null : best;
}

/** Объект по адресу из презентации: улица / населённый пункт и номер дома объекта есть в адресе. */
function findObjectByAddress_(address) {
  const a = matchWords_(address, true);
  if (a.length < 2) return null;
  const found = readTable_('OBJ').rows.filter(o => {
    if (!o.id || !o.address) return false;
    const w = matchWords_(String(o.address).split('(')[0], true); // «д.1 (помещение 1Н, …)» — уточнение в скобках не сравниваем
    const words = w.filter(x => !/^\d+$/.test(x)), house = w.find(x => /^\d+$/.test(x));
    return words.length >= 1 && (house || words.length >= 2) && words.every(x => a.some(y => wordMatch_(x, y))) && (!house || a.indexOf(house) >= 0);
  });
  return found.length === 1 ? found[0] : null;
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

/** Адрес, площадь, цена, тип, сделка — из текста презентации (эвристика, проверяйте). Понимает выгрузку объекта из ЦИАН. */
function guessObjectInfo_(text) {
  const t = String(text || '').replace(/\u00a0/g, ' ').replace(/\*\*/g, '').replace(/\\~/g, '~');
  const info = {};
  if (!t.trim()) return info;
  const lines = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const num = s => Number(String(s).replace(/\s/g, '').replace(',', '.'));
  // ЦИАН: «Продается помещ.своб.назнач-я | 756.2 м²», «Сдается коттедж | 1200 м² | 30 соток»
  const hdr = /(?:^|\n)\s*(Прода[её]тся|Сда[её]тся)\s+([^|\n]+?)\s*\|\s*(\d[\d ]*(?:[.,]\d+)?)\s*(?:м²|м2)/i.exec(t);
  if (hdr) { info.deal = /^сда/i.test(hdr[1]) ? 'Аренда' : 'Продажа'; info.area = num(hdr[3]); }
  const strong = /(г\.\s*Москва|Москва,|Московская обл|обл\.|МО,|ул\.|улица|проспект|пр-т|шоссе|переулок|пер\.|бульвар|наб\.|р-н|район)/i;
  const weak = /(пос\.|посёлок|поселок|КП\s|ЖК\s)/i;
  const addrOk = l => l.length <= 160 && !/мои объекты|^\|/i.test(l);
  const addr = lines.find(l => strong.test(l) && addrOk(l)) || lines.find(l => weak.test(l) && addrOk(l));
  if (addr) info.address = addr.replace(/^(адрес|расположение)\s*[:—-]\s*/i, '').replace(/,(?=\S)/g, ', ');
  if (!info.area) {
    const am = /(\d{1,3}(?:[ ]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(?:м²|м2|кв\.?\s?м)/i.exec(t);
    if (am && num(am[1]) > 5) info.area = num(am[1]);
  }
  // ЦИАН: «₽ 225 500 000 298 202 ₽/м²» (цена и цена за м² подряд) или «₽ 1 490 000»
  const cp = /(?:^|\n)[ \t]*₽[ \t]*(\d{1,3}(?:[ ]\d{3})*)([ \t]*₽[ \t]*\/[ \t]*м)?/.exec(t);
  if (cp) {
    const g = cp[1].split(' ');
    let v = num(cp[1]);
    if (cp[2] && g.length > 2) {
      v = 0;
      for (let k = g.length - 1; k >= 1 && !v; k--) { // делим на «цену» и «за м²»: цена / площадь ≈ цена за м²
        const left = num(g.slice(0, k).join('')), right = num(g.slice(k).join(''));
        if (info.area && Math.abs(left / info.area - right) <= Math.max(2, right * 0.02)) v = left;
      }
      if (!v) v = num(g.slice(0, Math.max(1, g.length - 2)).join(''));
    }
    if (v >= 10000) info.price = v;
  }
  if (!info.price) {
    let best = 0;
    const priceRe = /(\d{1,3}(?:[ ]\d{3})+|\d+(?:[.,]\d+)?)\s*(млрд|млн)?\.?\s*(?:₽|руб|р\.)/gi;
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
  }
  const low = t.toLowerCase();
  if (!info.deal) info.deal = /аренд|в месяц|\/мес|ставка/.test(low) && !/продаж|продаётся|продается/.test(low) ? 'Аренда' : (/продаж|продаётся|продается|стоимость/.test(low) ? 'Продажа' : '');
  const kindOf = x => /особняк|усадьб/.test(x) ? 'Особняк' : /(загородн|коттедж|таунхаус|кп\s|посёлок|поселок|дом\b|дом\s)/.test(x) ? 'Загородный дом'
    : /(псн|помещ|своб|коммерч|офис|ритейл|габ|торгов|склад)/.test(x) ? 'Коммерция' : /(квартир|апартамент|\d-комн|жк\s)/.test(x) ? 'Жильё'
    : /(участок|земл)/.test(x) ? 'Земля' : '';
  const k = (hdr && kindOf(hdr[2].toLowerCase() + ' ')) || kindOf(low);
  if (k && dictValues_('obj_kinds').indexOf(k) >= 0) info.kind = k;
  if (hdr) { // название: «Коттедж 1200 м² · д. Примерово»
    const place = (info.address || '').split(/,\s*/).filter(x => x && !/москва|обл\.|область|р-н|район|^[СЮЗВЦ]{1,2}АО$/i.test(x)).slice(0, 2).join(', ');
    const what = hdr[2].replace(/помещ\.?\s*своб\.?\s*назнач-?я/i, 'ПСН').trim();
    info.name = what.charAt(0).toUpperCase() + what.slice(1) + ' ' + String(info.area).replace('.', ',') + ' м²' + (place ? ' · ' + place : '');
  } else {
    const title = lines.find(l => l.length >= 4 && l.length <= 60 && !/^\d/.test(l) && !/мои объекты|^\|/i.test(l));
    if (title) info.name = title;
  }
  Object.keys(info).forEach(x => { if (info[x] === '' || info[x] === undefined) delete info[x]; });
  return info;
}
