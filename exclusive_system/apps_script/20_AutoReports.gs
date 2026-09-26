/**
 * 20_AutoReports — еженедельные отчёты автоматически: каждую пятницу в 20:00 (МСК).
 *
 * По каждому объекту «в работе» за текущую неделю: Google Doc + PDF в папке объекта и комментарий
 * в карточку TopenLab (как «Создать отчёт клиенту»). Если отчёт за эту неделю уже создан вручную, новый не создаётся,
 * но если он ещё не попал в CRM — отправляется. Клиенту система ничего не отправляет — ссылки на PDF приходят письмом руководителю.
 * Поля «Комментарий для клиента / для себя» (05_ОТЧЁТ_КЛИЕНТУ) в автоотчёт не попадают — они общие для всех объектов.
 * Если за один запуск (лимит Google — 6 минут) не успели все объекты, продолжает сам через минуту.
 */

const AUTO_REP = { DAY: 'FRIDAY', HOUR: 20, BUDGET_MS: 4.5 * 60000 };

function enableAutoReports() {
  disableAutoReports_();
  ScriptApp.newTrigger('autoReportsJob').timeBased().onWeekDay(ScriptApp.WeekDay[AUTO_REP.DAY])
    .atHour(AUTO_REP.HOUR).nearMinute(0).inTimezone(SYS.TZ).create();
  let mail = true;
  try { MailApp.getRemainingDailyQuota(); } catch (e) { mail = false; }
  SpreadsheetApp.getUi().alert('Автоотчёты включены',
    'Каждую пятницу в 20:00 (МСК) по всем объектам «в работе»: отчёт (Google Doc + PDF в папке объекта) и комментарий в карточку TopenLab.\n' +
    'Клиентам ничего не отправляется — ссылки на PDF придут вам письмом.' +
    (mail ? '' : '\n\n⚠ Нет разрешения на отправку писем: в Apps Script → ⚙ Настройки проекта включите показ appsscript.json и замените его содержимым dist/appsscript.json, затем включите автоотчёты ещё раз. Отчёты и комментарии в CRM работают и без письма.'),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function disableAutoReports() {
  disableAutoReports_();
  toast_('Автоотчёты по пятницам выключены.', 'Автоотчёты', 5);
}

function disableAutoReports_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const h = t.getHandlerFunction();
    if (h === 'autoReportsJob' || h === 'autoReportsContinue') ScriptApp.deleteTrigger(t);
  });
}

/** Триггер пятницы: новая партия за текущую неделю. */
function autoReportsJob() {
  const wk = isoWeekKey_(today_());
  PropertiesService.getDocumentProperties().setProperty('AUTO_REP_STATE', JSON.stringify({ wk: wk, done: [] }));
  autoReportsRun_();
}

/** Продолжение партии (если не уложились в лимит времени). */
function autoReportsContinue() { autoReportsRun_(); }

function autoReportsRun_() {
  const props = PropertiesService.getDocumentProperties();
  let state;
  try { state = JSON.parse(props.getProperty('AUTO_REP_STATE') || ''); } catch (e) { state = null; }
  if (!state || !state.wk) return;
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) { scheduleAutoReportsContinue_(true); return; }
  const start = Date.now();
  const rep = sheet_('REP');
  const keep = ['B3', 'B4', 'B5', 'B6'].map(a => rep.getRange(a).getValue());
  let left = 0;
  try {
    const label = weekLabelByKey_(state.wk);
    if (!label) throw new Error('недели ' + state.wk + ' нет в 07_СПРАВОЧНИКИ — запустите «Установить / обновить систему»');
    const arch = readTable_('ARCH').rows;
    const inWork = {};
    dictRows_('obj_status').forEach(r => { inWork[r[0]] = String(r[1]).toUpperCase() !== 'НЕТ'; });
    const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && inWork[o.status] !== false);
    state.results = state.results || [];
    rep.getRange('B5').setValue('');
    rep.getRange('B6').setValue('');
    objs.forEach(o => {
      const id = String(o.id);
      if (state.done.indexOf(id) >= 0) return;
      if (Date.now() - start > AUTO_REP.BUDGET_MS) { left++; return; }
      const manual = arch.filter(r => String(r.obj_id) === id && r.week === state.wk && r.status === REPORT_STATUS.ACTUAL).pop();
      if (manual) { // отчёт за неделю уже сделан вручную: новый не создаём, но в CRM он должен быть
        let note = 'отчёт создан вручную' + (String(manual.crm).indexOf('✓') === 0 ? ', в CRM уже отправлен' : '');
        if (String(manual.crm).indexOf('✓') !== 0) {
          try {
            rep.getRange('B3').setValue(id + ' · ' + o.name);
            rep.getRange('B4').setValue(label);
            SpreadsheetApp.flush();
            const st = sendReportToCrm_(o, readReportValues_(), manual.pdf_link, '', state.wk);
            const a = readTable_('ARCH');
            const row = a.rows.find(r => r._row === manual._row);
            if (row && st) writeFields_(a.sh, 'ARCH', row._row, { crm: st });
            note += st ? ' · ' + st : '';
          } catch (e) { note += ' · ⚠ CRM: ' + e.message; }
        }
        state.done.push(id);
        state.results.push({ name: o.name, pdf: manual.pdf_link, note: note });
        props.setProperty('AUTO_REP_STATE', JSON.stringify(state));
        return;
      }
      try {
        rep.getRange('B3').setValue(id + ' · ' + o.name);
        rep.getRange('B4').setValue(label);
        SpreadsheetApp.flush();
        const res = (autoReportsRun_.generate || generateReport_)(id, state.wk, {}); // .generate — подмена в тестах
        state.results.push({ name: o.name, pdf: res ? res.pdfUrl : '', note: res ? (res.crm || 'CRM не подключена') : 'не создан' });
      } catch (e) {
        state.results.push({ name: o.name, note: '⚠ ошибка: ' + e.message });
      }
      state.done.push(id);
      props.setProperty('AUTO_REP_STATE', JSON.stringify(state));
    });
  } catch (e) {
    state.results = (state.results || []).concat([{ name: 'Автоотчёты', note: '⚠ ' + e.message }]);
  } finally {
    ['B3', 'B4', 'B5', 'B6'].forEach((a, i) => { try { rep.getRange(a).setValue(keep[i]); } catch (e) { /* выбор можно вернуть вручную */ } });
    props.setProperty('AUTO_REP_STATE', JSON.stringify(state));
    lock.releaseLock();
  }
  scheduleAutoReportsContinue_(left > 0);
  if (!left) {
    autoReportsMail_(state);
    props.deleteProperty('AUTO_REP_STATE');
  }
}

function scheduleAutoReportsContinue_(on) {
  if (typeof ScriptApp.getProjectTriggers !== 'function') return;
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'autoReportsContinue') ScriptApp.deleteTrigger(t); });
  if (on) ScriptApp.newTrigger('autoReportsContinue').timeBased().after(60 * 1000).create();
}

/** Письмо руководителю: объект → PDF → статус CRM. */
function autoReportsMail_(state) {
  const to = String(Session.getEffectiveUser().getEmail() || '');
  const rows = state.results || [];
  logHistory_([{ sheet: SHEET_NAMES.ARCH, record_id: state.wk, field: 'Автоотчёты', old: '', new: 'объектов: ' + rows.length, kind: HIST_KIND.CREATE }], 'автоотчёты');
  if (!to || !rows.length) return;
  const html = '<p>Еженедельные отчёты за ' + htmlEscape_(state.wk) + ' созданы. Проверьте PDF и отправьте клиентам.</p><ol>' +
    rows.map(r => '<li><b>' + htmlEscape_(r.name) + '</b>' + (r.pdf ? ' — <a href="' + r.pdf + '">PDF</a>' : '') + '<br><span style="color:#5f6368">' + htmlEscape_(r.note || '') + '</span></li>').join('') +
    '</ol><p>Поправить: откройте Google Doc отчёта (папка объекта → Отчёты), затем «Обновить PDF отчёта» и при необходимости «Отправить отчёт клиенту в CRM».</p>' +
    '<p><a href="' + ss_().getUrl() + '">Открыть систему</a></p>';
  try { MailApp.sendEmail({ to: to, subject: 'Отчёты клиентам за ' + state.wk + ' готовы (' + rows.length + ')', htmlBody: html }); } catch (e) { Logger.log('Письмо: ' + e.message); }
}
