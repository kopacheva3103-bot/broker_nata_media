/**
 * 17_Crm — связь с CRM TopenLab (публичный API agencies-p.topnlab.ru/public).
 *
 * Когда ассистент ставит в 03_ОБЗВОН_И_КП галочку «Передан в CRM», скрипт ищет карточку в TopenLab
 * по телефону из «Контакт» (сначала среди заявок, потом среди объектов) и добавляет в неё заметку:
 * объект, компания, аудитория, звонок, КП, ответ, следующий шаг, кто ведёт.
 * API TopenLab не умеет создавать карточки — поэтому сначала заводим клиента в CRM (с этим телефоном),
 * потом ставим галочку. Результат пишется в столбец «CRM».
 * Ключ API и ID пользователя-автора заметок хранятся в свойствах скрипта («Сервис → Подключить CRM TopenLab»).
 * Ограничение API: поиск не чаще 1 раза в 6 секунд — при массовой отметке используйте «Отправить отмеченные в CRM».
 *
 * Отчёт клиенту: при «Создать отчёт клиенту» в карточку объекта (ID объекта = ID карточки в CRM) добавляются
 * комментарий с текстом отчёта и ссылкой на PDF и — если есть — комментарий «для себя» (05_ОТЧЁТ_КЛИЕНТУ, B6)
 * и список просроченных задач. Клиенту в PDF «для себя» не попадает.
 */

const CRM_BASE_DEFAULT = 'https://agencies-p.topnlab.ru/public';
const CRM_TYPES = [['order', 'заявка'], ['realty', 'объект']];
const CRM_ONEDIT_LIMIT = 2; // сколько строк отправлять сразу при правке (остальные — через меню)

function crmConfig_() {
  const p = PropertiesService.getScriptProperties();
  return { key: p.getProperty('TOPNLAB_KEY') || '', user: p.getProperty('TOPNLAB_USER_ID') || '', base: p.getProperty('TOPNLAB_BASE') || CRM_BASE_DEFAULT };
}

/** Телефон из свободного текста → 7XXXXXXXXXX (первый найденный российский номер). */
function phoneFromText_(text) {
  const m = /(?:\+7|8|7)[\s\-(]*\d{3}[\s\-)]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/.exec(String(text || ''));
  if (!m) return '';
  const d = m[0].replace(/\D/g, '');
  return d.length === 11 ? '7' + d.slice(1) : '';
}

function crmNoteText_(o) {
  const d = x => x instanceof Date ? fmtDate_(x) : '';
  const obj = objectById_(o.obj_id);
  return [
    'Система маркетинга эксклюзивов: интерес по объекту ' + (obj ? obj.name + ' (' + obj.id + ')' : o.obj_id) + '.',
    'Компания: ' + o.company + (o.audience ? ' (' + o.audience + ')' : '') + (o.site ? ', ' + o.site : '') + '.',
    o.call_date ? 'Звонок ' + d(o.call_date) + (o.call_result ? ': ' + o.call_result : '') + '.' : '',
    o.kp_date ? 'КП ' + d(o.kp_date) + (o.kp_type ? ' (' + o.kp_type + ')' : '') + '.' : '',
    o.response ? 'Ответ: ' + o.response + (o.response_date ? ' ' + d(o.response_date) : '') + '.' : '',
    o.next_step ? 'Следующий шаг: ' + o.next_step + (o.next_date ? ' до ' + d(o.next_date) : '') + '.' : '',
    o.owner ? 'Вёл: ' + o.owner + '.' : '',
  ].filter(Boolean).join('\n');
}

/** Отправка одной строки 03. Возвращает текст для столбца «CRM». */
function crmSendRow_(o, cfg) {
  const phone = phoneFromText_(o.contact);
  if (!phone) return '⚠ нет телефона в «Контакт»';
  for (let i = 0; i < CRM_TYPES.length; i++) {
    const type = CRM_TYPES[i][0];
    crmThrottle_();
    const r = UrlFetchApp.fetch(cfg.base + '/get-entities?phone=' + phone + '&type=' + type + '&key=' + encodeURIComponent(cfg.key), { muteHttpExceptions: true });
    const code = r.getResponseCode();
    if (code === 404) continue;
    if (code >= 400) return '⚠ ошибка CRM ' + code;
    let data;
    try { data = JSON.parse(r.getContentText()); } catch (e) { return '⚠ ответ CRM не распознан'; }
    const ent = data && typeof data === 'object' ? data[Object.keys(data)[0]] : null;
    if (!ent || !ent.id) continue;
    if (!cfg.user) return '✓ найдена ' + CRM_TYPES[i][1] + ' ' + ent.id + ' (заметки выключены: нет ID автора)';
    const w = crmPostNote_(cfg, type, ent.id, crmNoteText_(o));
    return w.ok ? '✓ заметка ' + fmtDate_(new Date()) + ' · ' + CRM_TYPES[i][1] + ' ' + ent.id : '⚠ заметка не добавлена (' + w.code + ')';
  }
  return '⚠ карточки с телефоном ' + phone + ' нет — заведите в CRM';
}

/**
 * Заметка (комментарий) в карточку TopenLab. Дополнительные параметры заметки (например, признак
 * «публичный комментарий» — имя параметра смотрите в документации API TopenLab) задаются в «Подключить CRM»
 * и добавляются к каждому запросу.
 */
function crmPostNote_(cfg, type, id, note) {
  let extra = {};
  try { extra = JSON.parse(PropertiesService.getScriptProperties().getProperty('TOPNLAB_NOTE_EXTRA') || '{}') || {}; } catch (e) { extra = {}; }
  const payload = Object.assign({}, extra, {
    key: cfg.key, id: /^\d+$/.test(String(id)) ? Number(id) : id, type: type,
    note: String(note).slice(0, 8000), user_id: Number(cfg.user) || cfg.user,
  });
  const w = UrlFetchApp.fetch(cfg.base + '/set-note', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(payload) });
  let ok = false, msg = '';
  try { const j = JSON.parse(w.getContentText()); ok = w.getResponseCode() < 400 && (j.status === 'success' || j.status === 'ok'); msg = j.message || j.error || ''; } catch (e) { ok = false; }
  return { ok: ok, code: w.getResponseCode(), msg: msg };
}

// ───────────────────────── отчёт клиенту → карточка объекта ─────────────────────────

/** Текст комментария «отчёт клиенту» и внутреннего комментария для руководителя. */
function reportCrmNotes_(obj, values, pdfUrl, internal) {
  const kv = values.kv, t = values.tables;
  const rows = (ph, empty) => {
    const r = (t[ph] || []).filter(x => x[1] && x[0] !== '—');
    return r.length ? r.map(x => x[0] + '. ' + x[1] + (x[2] ? ' — ' + x[2] : '')).join('\n') : empty;
  };
  const client = [
    'ОТЧЁТ КЛИЕНТУ №' + (kv.REPORT_NO || '') + ' за ' + (kv.PERIOD || '') + ' — ' + obj.name,
    kv.SUMMARY ? '\nИтоги недели:\n' + kv.SUMMARY : '',
    '\nВыполнение плана:\n' + rows('PLAN_ROWS', 'задачи на неделю не внесены'),
    '\nПолученные заявки:\n' + rows('LEADS_ROWS', 'новых заявок нет'),
    '\nПлан работы на следующую неделю:\n' + rows('NEXT_ROWS', 'план не внесён'),
    kv.COMMENT ? '\nКомментарий для клиента:\n' + kv.COMMENT : '',
    pdfUrl ? '\nPDF отчёта: ' + pdfUrl : '',
  ].filter(Boolean).join('\n');
  const overdue = readTable_('TASK').rows.filter(x => String(x.obj_id) === String(obj.id) && x.overdue === 'ПРОСРОЧЕНО');
  const own = String(internal || '').trim();
  const inner = own || overdue.length ? [
    'ДЛЯ РУКОВОДИТЕЛЯ (клиенту не отправляется) — отчёт №' + (kv.REPORT_NO || '') + ' за ' + (kv.PERIOD || ''),
    own ? '\n' + own : '',
    overdue.length ? '\nПросрочено задач: ' + overdue.length + '\n' + overdue.slice(0, 10).map(x => '• ' + x.task + ' (' + (x.owner || '—') + ', срок ' + fmtDate_(x.deadline) + ')').join('\n') : '',
  ].filter(Boolean).join('\n') : '';
  return { client: client, inner: inner };
}

/** Отправляет отчёт в карточку объекта (ID объекта = ID карточки в CRM). Возвращает текст статуса. */
function sendReportToCrm_(obj, values, pdfUrl, internal) {
  const cfg = crmConfig_();
  if (!cfg.key) return '';
  if (!cfg.user) return '⚠ не задан ID автора заметок (Сервис → Подключить CRM TopenLab)';
  if (!isCrmId_(obj.id)) return '⚠ у объекта нет ID из CRM (сейчас «' + obj.id + '»)';
  const n = reportCrmNotes_(obj, values, pdfUrl, internal);
  const a = crmPostNote_(cfg, 'realty', obj.id, n.client);
  if (!a.ok) return '⚠ CRM: отчёт не добавлен (' + a.code + (a.msg ? ', ' + a.msg : '') + ')';
  let st = '✓ в CRM ' + fmtDate_(new Date()) + ': отчёт';
  if (n.inner) {
    const b = crmPostNote_(cfg, 'realty', obj.id, n.inner);
    st += b.ok ? ' + комментарий для себя' : ', ⚠ комментарий для себя не добавлен (' + b.code + ')';
  }
  return st;
}

/** Меню: отправить в CRM отчёт, выбранный в 05_ОТЧЁТ_КЛИЕНТУ (например, после правок или если CRM подключили позже). */
function crmSendReport() {
  const ui = SpreadsheetApp.getUi();
  if (!crmConfig_().key) { ui.alert('CRM не подключена: Сервис → Подключить CRM TopenLab.'); return; }
  SpreadsheetApp.flush();
  const rep = sheet_('REP');
  const id = String(rep.getRange('E3').getValue() || ''), wk = String(rep.getRange('E4').getValue() || '');
  const obj = objectById_(id);
  if (!obj || !wk) { ui.alert('Выберите объект и неделю в ' + SHEET_NAMES.REP + '.'); return; }
  const arch = readTable_('ARCH');
  const rows = arch.rows.filter(r => String(r.obj_id) === id && r.week === wk && r.status === REPORT_STATUS.ACTUAL);
  const last = rows[rows.length - 1];
  const st = sendReportToCrm_(obj, readReportValues_(), last ? last.pdf_link : '', rep.getRange('B6').getValue());
  if (last) writeFields_(arch.sh, 'ARCH', last._row, { crm: st });
  ui.alert('Отчёт → CRM', st || 'CRM не подключена', ui.ButtonSet.OK);
}

/** Меню: тестовый комментарий в карточку объекта — проверить ключ, автора и где комментарий виден в TopenLab. */
function crmTestNote() {
  const ui = SpreadsheetApp.getUi();
  const cfg = crmConfig_();
  if (!cfg.key || !cfg.user) { ui.alert('Сначала: Сервис → Подключить CRM TopenLab (ключ API и ID пользователя-автора).'); return; }
  const r = ui.prompt('Тестовый комментарий в CRM', 'ID объекта (карточки в TopenLab), например 137073408:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const id = String(r.getResponseText() || '').trim();
  if (!isCrmId_(id)) { ui.alert('ID карточки — только цифры (как в CRM).'); return; }
  const obj = objectById_(id);
  const res = crmPostNote_(cfg, 'realty', id, 'Тестовый комментарий из системы маркетинга эксклюзивов' + (obj ? ' (' + obj.name + ')' : '') +
    ', ' + fmtDate_(new Date(), 'dd.MM.yyyy HH:mm') + '. Можно удалить.');
  logHistory_([{ sheet: 'CRM', record_id: id, obj_id: obj ? id : '', field: 'Тестовый комментарий', old: '', new: res.ok ? 'добавлен' : 'ошибка ' + res.code, kind: HIST_KIND.CHANGE }], userEmail_());
  ui.alert('Тестовый комментарий', res.ok
    ? '✓ Комментарий добавлен в карточку ' + id + '. Откройте её в TopenLab и посмотрите, где он виден.'
    : '⚠ Не добавлен: ответ CRM ' + res.code + (res.msg ? ' — ' + res.msg : '') + '. Проверьте ID карточки, ключ API и ID пользователя.', ui.ButtonSet.OK);
}

/** API: поиск не чаще 1 раза в 6 секунд. */
function crmThrottle_() {
  const p = PropertiesService.getScriptProperties();
  const last = Number(p.getProperty('TOPNLAB_LAST') || 0);
  const wait = last + 6100 - Date.now();
  if (wait > 0) Utilities.sleep(wait);
  p.setProperty('TOPNLAB_LAST', String(Date.now()));
}

/** Из onEdit: строки с только что поставленной галочкой (не больше CRM_ONEDIT_LIMIT). */
function crmOnEdit_(sh, rows) {
  const cfg = crmConfig_();
  if (!cfg.key || !rows.length) return;
  rows.slice(0, CRM_ONEDIT_LIMIT).forEach(o => writeFields_(sh, 'BASE', o._row, { crm_note: crmSendRow_(o, cfg) }));
  if (rows.length > CRM_ONEDIT_LIMIT) {
    rows.slice(CRM_ONEDIT_LIMIT).forEach(o => writeFields_(sh, 'BASE', o._row, { crm_note: '… ждёт: меню «Отправить отмеченные в CRM»' }));
  }
}

/** Меню: все строки с галочкой, по которым заметка ещё не добавлена. */
function crmSendPending() {
  const cfg = crmConfig_();
  if (!cfg.key) { SpreadsheetApp.getUi().alert('CRM не подключена: Сервис → Подключить CRM TopenLab.'); return; }
  const t = readTable_('BASE');
  const rows = t.rows.filter(o => o.to_crm === true && String(o.crm_note).indexOf('✓') !== 0);
  if (!rows.length) { toast_('Нет отмеченных строк без заметки.', 'CRM'); return; }
  const start = Date.now();
  let n = 0;
  for (let i = 0; i < rows.length; i++) {
    if (Date.now() - start > 4.5 * 60000) break; // лимит выполнения скрипта — остальное следующим запуском
    writeFields_(t.sh, 'BASE', rows[i]._row, { crm_note: crmSendRow_(rows[i], cfg) });
    n++;
  }
  toast_('Обработано: ' + n + ' из ' + rows.length + (n < rows.length ? '. Запустите ещё раз для остальных.' : ''), 'CRM', 8);
}

function connectCrm() {
  const c = crmConfig_();
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<p>Ключ API TopenLab и ID пользователя, от имени которого публикуются заметки (Настройки системы → Пользователи). ' +
    'Хранятся в свойствах скрипта, в таблице не видны. Пустое поле — оставить как есть.</p>' +
    '<p>Статус: <b id="s">' + (c.key ? 'подключена' + (c.user ? ', автор заметок ' + htmlEscape_(c.user) : ', без автора заметок') : 'не подключена') + '</b></p>' +
    '<p>Ключ API:<br><input id="k" style="width:100%"></p>' +
    '<p>ID пользователя-автора заметок:<br><input id="u" style="width:100%" value="' + htmlEscape_(c.user) + '"></p>' +
    '<p>Доп. параметры заметки (JSON, необязательно) — например признак «публичный комментарий» из документации API TopenLab (Настройки → API):<br><input id="x" style="width:100%" placeholder=\'{"is_public": 1}\' value="' + htmlEscape_(PropertiesService.getScriptProperties().getProperty('TOPNLAB_NOTE_EXTRA') || '') + '"></p>' +
    '<p>Телефон существующей карточки для проверки (необязательно):<br><input id="p" style="width:100%" placeholder="+7 925 …"></p>' +
    '<button onclick="save()">Сохранить и проверить</button> <button onclick="off()">Отключить</button><div id="r" style="margin-top:10px"></div></div><script>' +
    'function done(x){document.getElementById("r").textContent=x.msg;document.getElementById("s").textContent=x.status;}' +
    'function save(){document.getElementById("r").textContent="Проверяю… (до 15 секунд)";google.script.run.withSuccessHandler(done).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).saveCrmSettings(document.getElementById("k").value,document.getElementById("u").value,document.getElementById("p").value,document.getElementById("x").value);}' +
    'function off(){google.script.run.withSuccessHandler(done).removeCrmSettings();}' +
    '</script>').setWidth(540).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Подключить CRM TopenLab');
}

function saveCrmSettings(key, user, testPhone, extra) {
  const p = PropertiesService.getScriptProperties();
  const ex = String(extra || '').trim();
  if (ex) {
    try { JSON.parse(ex); } catch (e) { return { status: 'не сохранено', msg: 'Доп. параметры — не JSON. Пример: {"is_public": 1}' }; }
    p.setProperty('TOPNLAB_NOTE_EXTRA', ex);
  } else p.deleteProperty('TOPNLAB_NOTE_EXTRA');
  if (String(key || '').trim()) p.setProperty('TOPNLAB_KEY', String(key).trim());
  if (String(user || '').trim()) p.setProperty('TOPNLAB_USER_ID', String(user).trim());
  const c = crmConfig_();
  const status = c.key ? 'подключена' + (c.user ? ', автор заметок ' + c.user : ', без автора заметок') : 'не подключена';
  if (!c.key) return { status: status, msg: 'Введите ключ API.' };
  let msg = 'Сохранено.';
  const phone = phoneFromText_(testPhone);
  if (phone) {
    const found = [];
    for (let i = 0; i < CRM_TYPES.length; i++) {
      crmThrottle_();
      const r = UrlFetchApp.fetch(c.base + '/get-entities?phone=' + phone + '&type=' + CRM_TYPES[i][0] + '&key=' + encodeURIComponent(c.key), { muteHttpExceptions: true });
      const code = r.getResponseCode();
      if (code === 401 || code === 403) return { status: status, msg: 'Ключ API не принят CRM (' + code + ').' };
      if (code < 400) { try { const d = JSON.parse(r.getContentText()); const k = Object.keys(d || {}); if (k.length) found.push(CRM_TYPES[i][1] + ' ' + (d[k[0]].id || k[0])); } catch (e) { /* пусто */ } }
    }
    msg += found.length ? ' Проверка: найдено — ' + found.join(', ') + '.' : ' Проверка: связь есть, карточек с этим телефоном не найдено.';
  }
  logHistory_([{ sheet: 'CRM', record_id: 'TopenLab', field: 'Подключение', old: '', new: status, kind: HIST_KIND.CHANGE }], userEmail_());
  return { status: status, msg: msg };
}

function removeCrmSettings() {
  const p = PropertiesService.getScriptProperties();
  ['TOPNLAB_KEY', 'TOPNLAB_USER_ID', 'TOPNLAB_LAST', 'TOPNLAB_NOTE_EXTRA'].forEach(k => p.deleteProperty(k));
  return { status: 'не подключена', msg: 'Отключено.' };
}
