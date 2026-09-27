/**
 * 26_BaseTools — помощь ассистенту в 03_ОБЗВОН_И_КП:
 *  - выпадающий список «Аудитория» в каждой строке — аудитории из вкладки объекта (цифры во вкладке считаются только при точном совпадении);
 *  - напоминание о повторном контакте: КП отправлено, ответа нет 3 рабочих дня, следующий шаг не назначен → шаг и дата ставятся сами;
 *  - утренняя сводка каждому сотруднику с email: просроченные задачи, звонки и повторные контакты на сегодня.
 */

const FOLLOWUP_DAYS = 3;
const FOLLOWUP_TEXT = 'Повторный контакт: получили ли КП, есть ли вопросы';

/** Аудитории объекта из раздела 4 его вкладки. */
function objectAudiences_(objId) {
  const obj = objectById_(objId);
  const tab = obj ? findObjectTab_(obj) : null;
  if (!tab) return [];
  const rows = readObjectTab_(tab).tables.AUD || [];
  const out = [];
  rows.forEach(r => { const a = String(r[0] || '').trim(); if (a && out.indexOf(a) < 0) out.push(a); });
  return out;
}

/** Ставит в столбце «Аудитория» 03_ОБЗВОН_И_КП список аудиторий объекта строки. objIds — только эти объекты (по умолчанию все). */
function refreshBaseAudienceLists_(objIds) {
  const t = readTable_('BASE');
  const col = sheetSpecs_().BASE.fields.findIndex(f => f.key === 'audience') + 1;
  const only = objIds ? objIds.map(String) : null;
  const lists = {};
  let n = 0;
  // соседние строки одного объекта — одним диапазоном
  let start = 0, prevId = '', prevRow = 0;
  const flush = (endRow) => {
    if (!start || !prevId) return;
    const list = lists[prevId];
    const rng = t.sh.getRange(start, col, endRow - start + 1, 1);
    if (list.length) {
      rng.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false)
        .setHelpText('Аудитории из вкладки объекта. Нужной нет — сначала добавьте её во вкладку (раздел 4).').build());
      n += endRow - start + 1;
    }
  };
  t.rows.forEach(r => {
    const id = String(r.obj_id || '');
    const use = id && (!only || only.indexOf(id) >= 0);
    if (use && !(id in lists)) lists[id] = objectAudiences_(id);
    if (use && id === prevId && r._row === prevRow + 1) { prevRow = r._row; return; }
    flush(prevRow);
    start = use ? r._row : 0; prevId = use ? id : ''; prevRow = r._row;
  });
  flush(prevRow);
  return n;
}

/** КП без ответа дольше FOLLOWUP_DAYS рабочих дней и без следующего шага → «Повторный контакт» на сегодня. */
function scheduleFollowUps_() {
  const t = readTable_('BASE');
  const today = today_();
  let n = 0;
  t.rows.forEach(r => {
    if (!(r.kp_date instanceof Date) || r.next_step || r.next_date) return;
    const cls = r.response ? dictClassOf_('responses', r.response) : 'NONE';
    if (cls && cls !== 'NONE') return;
    if (workdayAfter_(r.kp_date, FOLLOWUP_DAYS) > today) return;
    writeFields_(t.sh, 'BASE', r._row, { next_step: FOLLOWUP_TEXT, next_date: today });
    n++;
  });
  return n;
}

/** Утренняя сводка на почту каждому сотруднику, у кого указан email (08_НАСТРОЙКИ → «Утренняя сводка» = ДА). */
function sendDailyDigest_(now) {
  if (String(cfgGet_('DIGEST_ON') || 'ДА').trim().toUpperCase() !== 'ДА') return 0;
  const today = now || today_();
  if (today.getDay() === 0 || today.getDay() === 6) return 0;
  const people = dictRows_('people').filter(p => p[0] && /@/.test(String(p[2] || '')));
  if (!people.length) return 0;
  const objName = {};
  readTable_('OBJ').rows.forEach(o => { objName[String(o.id)] = o.name; });
  const tasks = readTable_('TASK').rows.filter(r => r.task && dictClassOf_('task_status', r.status) === CLS.OPEN && r.deadline instanceof Date && r.deadline <= today);
  const base = readTable_('BASE').rows.filter(r => r.company && r.next_date instanceof Date && r.next_date <= today);
  let idle = [];
  try { idle = idleAudiences_(); } catch (e) { /* без сигнала */ }
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const d = x => fmtDate_(x);
  let sent = 0;
  people.forEach(p => {
    const name = String(p[0]).trim(), email = String(p[2]).trim();
    const my = tasks.filter(r => r.owner === name);
    const calls = base.filter(r => r.owner === name);
    const myIdle = idle.filter(x => x.obj.assistant === name || x.obj.manager === name);
    if (!my.length && !calls.length && !myIdle.length) return;
    const li = arr => '<ul>' + arr.join('') + '</ul>';
    let html = '<p>Доброе утро! План на ' + d(today) + ':</p>';
    if (my.length) html += '<p><b>Задачи со сроком сегодня и просроченные (' + my.length + ')</b></p>' +
      li(my.map(r => '<li>' + esc(objName[String(r.obj_id)] || r.obj_id) + ': ' + esc(r.task) + ' — срок ' + d(r.deadline) + (r.deadline < today ? ' <b style="color:#B71C1C">просрочено</b>' : '') + '</li>'));
    if (calls.length) html += '<p><b>Звонки и повторные контакты (' + calls.length + ')</b></p>' +
      li(calls.map(r => '<li>' + esc(r.company) + ' (' + esc(objName[String(r.obj_id)] || r.obj_id) + ')' + (r.contact ? ', ' + esc(r.contact) : '') + ' — ' + esc(r.next_step || 'следующий шаг') + '</li>'));
    if (myIdle.length) html += '<p><b>Аудитории первой волны (★★★) без компаний в базе (' + myIdle.length + ')</b></p>' +
      li(myIdle.map(x => '<li>' + esc(x.obj.name) + ': «' + esc(x.name) + '» — промпт «Целевые аудитории объекта» даст базу для обзвона</li>'));
    html += '<p><a href="' + ss_().getUrl() + '">Открыть систему</a></p>';
    MailApp.sendEmail({ to: email, subject: 'План на ' + d(today) + ': задач ' + my.length + ', контактов ' + calls.length, htmlBody: html, name: 'Система эксклюзивов' });
    sent++;
  });
  return sent;
}

// ───────────────────────── аудитории объекта: приоритеты и цифры ─────────────────────────

/** Строки раздела 4 вкладки: [{name, who, portrait, where, prio (0–3)}]. */
function objectAudienceRows_(objId) {
  const obj = objectById_(objId);
  const tab = obj ? findObjectTab_(obj) : null;
  if (!tab) return [];
  return (readObjectTab_(tab).tables.AUD || []).filter(r => String(r[0] || '').trim()).map(r => ({
    name: String(r[0]).trim(), who: r[1], portrait: r[2], where: r[3], prio: (String(r[4] || '').match(/★/g) || []).length,
  }));
}

/** Цифры по аудиториям объекта из 03_ОБЗВОН_И_КП: {аудитория: {total, calls, kp, yes, kpWeek}}. */
function audienceStats_(objId, from, to) {
  const out = {};
  readTable_('BASE').rows.forEach(r => {
    if (String(r.obj_id) !== String(objId) || !r.company) return;
    const a = String(r.audience || '').trim() || 'Без аудитории';
    const s = out[a] = out[a] || { total: 0, calls: 0, kp: 0, yes: 0, kpWeek: 0 };
    s.total++;
    if (r.call_date instanceof Date) s.calls++;
    if (r.kp_date instanceof Date) { s.kp++; if (from && r.kp_date >= from && r.kp_date <= to) s.kpWeek++; }
    if (r.response && dictClassOf_('responses', r.response) === 'YES') s.yes++;
  });
  return out;
}

/** Строки «по аудиториям» для отчёта собственнику. */
function audienceReportLines_(objId, wk) {
  const mon = wk ? mondayOfWeekKey_(wk) : null;
  const st = audienceStats_(objId, mon, mon ? addDays_(mon, 6) : null);
  const names = Object.keys(st);
  if (!names.length) return [];
  const order = objectAudienceRows_(objId).map(a => a.name);
  names.sort((x, y) => (order.indexOf(x) < 0 ? 99 : order.indexOf(x)) - (order.indexOf(y) < 0 ? 99 : order.indexOf(y)));
  return ['Работа по целевым аудиториям (всего с начала работы):'].concat(names.map(n => {
    const s = st[n];
    return '• ' + n + ': в работе компаний — ' + s.total + ', звонков — ' + s.calls + ', отправлено КП — ' + s.kp +
      (s.kpWeek ? ' (за неделю — ' + s.kpWeek + ')' : '') + (s.yes ? ', проявили интерес — ' + s.yes : '');
  }));
}

/** Аудитории первой волны (★★★), по которым в базе нет ни одной компании: [{obj, name}]. */
function idleAudiences_() {
  const out = [];
  readTable_('OBJ').rows.filter(o => o.id && o.name && o.in_work !== 'НЕТ').forEach(o => {
    const top = objectAudienceRows_(o.id).filter(a => a.prio >= 3);
    if (!top.length) return;
    const st = audienceStats_(o.id);
    top.forEach(a => { if (!st[a.name]) out.push({ obj: o, name: a.name }); });
  });
  return out;
}

/** Записывает в 01_ОБЪЕКТЫ «Аудитории ★★★ без базы» (видно на дэшборде). */
function refreshIdleAudiences_() {
  const idle = idleAudiences_();
  const t = readTable_('OBJ');
  let n = 0;
  t.rows.filter(o => o.id).forEach(o => {
    const v = idle.filter(x => String(x.obj.id) === String(o.id)).map(x => x.name).join(', ');
    if (String(o.idle_aud || '') !== v) { writeFields_(t.sh, 'OBJ', o._row, { idle_aud: v }); n++; }
  });
  return idle.length;
}

/** Компания уже есть в базе по другому объекту: [{obj_id, audience, kp_date, response}]. */
function companyElsewhere_(company, objId) {
  const norm = x => String(x || '').trim().toLowerCase().replace(/[«»"'.,]/g, '').replace(/\s+/g, ' ');
  const key = norm(company);
  if (!key) return [];
  return readTable_('BASE').rows.filter(r => norm(r.company) === key && String(r.obj_id) !== String(objId));
}
