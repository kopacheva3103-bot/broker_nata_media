/**
 * 08_Control — просрочки, обновление статистики, ежедневная сводка.
 * Сами предупреждения считаются формулами в 11_КОНТРОЛЬ; здесь — показ и обслуживание.
 */

function readAlerts_() {
  SpreadsheetApp.flush();
  const sh = sheet_('CTRL');
  const n = sh.getMaxRows() - CTRL_FIRST + 1;
  return sh.getRange(CTRL_FIRST, 1, n, 8).getDisplayValues().filter(r => r[1] !== '');
}

function checkOverdue() {
  const alerts = readAlerts_();
  sheet_('CTRL').activate();
  if (!alerts.length) {
    SpreadsheetApp.getUi().alert('Просрочек и предупреждений нет ✓');
    return;
  }
  const byType = {};
  alerts.forEach(a => { byType[a[1]] = (byType[a[1]] || 0) + 1; });
  const high = alerts.filter(a => a[0].charAt(0) === '1').length;
  const summary = Object.keys(byType).sort((a, b) => byType[b] - byType[a]).map(k => '<li>' + htmlEscape_(k) + ': <b>' + byType[k] + '</b></li>').join('');
  const rows = alerts.slice(0, 40).map(a => {
    const color = a[0].charAt(0) === '1' ? '#F4CCCC' : a[0].charAt(0) === '2' ? '#FFF2CC' : '#FFFFFF';
    return '<tr style="background:' + color + '"><td>' + htmlEscape_(a[1]) + '</td><td>' + htmlEscape_(a[3]) + '</td><td>' +
      htmlEscape_(a[4]) + '</td><td>' + htmlEscape_(a[5]) + '</td><td>' + htmlEscape_(a[6]) + '</td></tr>';
  }).join('');
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:13px">' +
    '<p>Всего предупреждений: <b>' + alerts.length + '</b>, из них высокой критичности: <b>' + high + '</b></p>' +
    '<ul>' + summary + '</ul>' +
    '<table style="border-collapse:collapse;width:100%" border="1" cellpadding="4">' +
    '<tr style="background:#ECEFF1"><th>Тип</th><th>Объект</th><th>Что случилось</th><th>Ответственный</th><th>Срок</th></tr>' + rows + '</table>' +
    (alerts.length > 40 ? '<p>… полный список — лист 11_КОНТРОЛЬ</p>' : '') + '</div>').setWidth(900).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'Проверка просрочек');
}

function openDashboard() { sheet_('DASH').activate(); }

/**
 * «Обновить статистику»: формулы пересчитываются сами, но эта команда
 * 1) проставляет недостающие ID/значения по умолчанию (если данные вставляли, а триггер не сработал);
 * 2) создаёт строки стратегии для новых объектов;
 * 3) добавляет строки в журналы, если они заканчиваются, и растягивает на них списки/чекбоксы;
 * 4) пересчитывает таблицу.
 */
function refreshStats() {
  const fixed = fillMissing_();
  ['OBJ', 'STR', 'ACT', 'PF', 'HIST', 'ARCH'].forEach(code => {
    const sh = sheet_(code);
    const last = lastDataRow_(sh, sheetSpecs_()[code]);
    if (sh.getMaxRows() - last < 200) extendSheet_(code, 1000);
  });
  SpreadsheetApp.flush();
  toast_('Статистика пересчитана. Исправлено строк без ID/значений по умолчанию: ' + fixed + '.');
}

function fillMissing_() {
  let fixed = 0;
  const user = userEmail_();
  ['ACT', 'PF'].forEach(code => {
    const t = readTable_(code);
    const cache = {};
    t.rows.forEach(o => {
      const hasInput = t.spec.fields.some(f => isInputKind_(f.kind) && f.kind !== 'cb' && o[f.key] !== '');
      if (!hasInput || o[t.spec.idField]) return;
      const upd = {};
      upd[t.spec.idField] = nextId_(code, cache);
      o[t.spec.idField] = upd[t.spec.idField];
      applyDefaults_(code, o, upd, true, user, []);
      writeFields_(t.sh, code, o._row, upd);
      fixed++;
    });
  });
  const ids = readTable_('OBJ').rows.map(o => o.id).filter(Boolean);
  ensureStrategyRows_(ids);
  return fixed;
}

// ───────────── ежедневная сводка на email ─────────────

function installDailyCheck() {
  const ui = SpreadsheetApp.getUi();
  const email = String(cfgGet_('DAILY_EMAIL') || '').trim();
  if (!email) { ui.alert('Укажите email в 10_НАСТРОЙКИ → «Email для ежедневной сводки предупреждений».'); return; }
  removeDailyCheck_();
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(9).create();
  ui.alert('Ежедневная сводка включена: около 9:00 на ' + email + '.');
}

function uninstallDailyCheck() {
  removeDailyCheck_();
  SpreadsheetApp.getUi().alert('Ежедневная сводка выключена.');
}

function removeDailyCheck_() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'dailyCheck') ScriptApp.deleteTrigger(t); });
}

function dailyCheck() {
  const email = String(cfgGet_('DAILY_EMAIL') || '').trim();
  if (!email) return;
  const alerts = readAlerts_();
  if (!alerts.length) return;
  const lines = alerts.slice(0, 60).map(a => '• [' + a[0] + '] ' + a[1] + ' — ' + a[3] + ': ' + a[4] + (a[5] ? ' (' + a[5] + ')' : ''));
  MailApp.sendEmail(email, 'Эксклюзивы: ' + alerts.length + ' предупреждений на ' + fmtDate_(new Date()),
    lines.join('\n') + '\n\nТаблица: ' + ss_().getUrl());
}
