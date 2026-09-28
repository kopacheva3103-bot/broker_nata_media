/**
 * 15_Calendar — задачи 02_ЗАДАЧИ в Google Календаре: каждому — только его задачи.
 *
 * Событие на весь день в дату «Срок» ставится в календарь исполнителя:
 *  - свои задачи (исполнитель = тот, кто запускает систему) — в основной календарь;
 *  - задачи сотрудника — прямо в его календарь, если он открыл доступ «Внесение изменений в мероприятия»
 *    для владельца системы (Настройки Google Календаря → доступ для отдельных пользователей);
 *  - если доступа нет — в личный календарь «Задачи: Имя», который владелец системы создаёт и открывает сотруднику на просмотр
 *    (сотрудник один раз нажимает «Добавить календарь» в письме Google; у владельца этот календарь скрыт).
 * Выполнено → в названии «✓»; Отменено / Перенесено → событие удаляется. Изменили срок / исполнителя → событие обновляется или переезжает.
 * В «Событие календаря» хранится «ID календаря::ID события». Обрабатываются задачи со сроком не старше 14 дней.
 */

const PERSON_CALENDAR_PREFIX = 'Задачи: ';

function syncCalendar() {
  const r = syncCalendar_();
  toast_('Календарь: создано ' + r.created + ', обновлено ' + r.updated + ', удалено ' + r.deleted +
    (r.shared.length ? '. Напрямую в календарь: ' + r.shared.join(', ') : '') +
    (r.personal.length ? '. В личный календарь «Задачи: …»: ' + r.personal.join(', ') : '') +
    (r.shareErrors.length ? '. ⚠ Не удалось открыть календарь: ' + r.shareErrors.join('; ') : '') +
    (r.noEmail.length ? '. Нет email у: ' + r.noEmail.join(', ') + ' (07_СПРАВОЧНИКИ)' : ''), 'Google Календарь', 12);
}

function syncCalendar_() {
  const t = readTable_('TASK');
  const mine = CalendarApp.getDefaultCalendar();
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const emails = {};
  dictRows_('people').forEach(p => { emails[p[0]] = String(p[2] || '').trim().toLowerCase(); });
  const url = ss_().getUrl();
  const from = addDays_(today_(), -14);
  const res = { created: 0, updated: 0, deleted: 0, noEmail: [], shared: [], personal: [], shareErrors: [] };
  const cals = {}, personal = {};
  // календарь исполнителя: {cal, guest}
  const target = owner => {
    const email = emails[owner] || '';
    if (!email || email === me) return { cal: mine, guest: '' };
    if (!(email in cals)) cals[email] = writableCalendar_(email);
    if (cals[email]) { if (res.shared.indexOf(owner) < 0) res.shared.push(owner); return { cal: cals[email], guest: '' }; }
    if (!personal[email]) personal[email] = personalCalendar_(owner, email, res);
    if (res.personal.indexOf(owner) < 0) res.personal.push(owner);
    return { cal: personal[email], guest: '' };
  };
  const find = ref => {
    if (!ref) return null;
    const parts = String(ref).split('::');
    const calId = parts.length > 1 ? parts[0] : '', evId = parts.length > 1 ? parts[1] : parts[0];
    try {
      const c = calId ? (calId === mine.getId() ? mine : CalendarApp.getCalendarById(calId)) : mine;
      const ev = c ? c.getEventById(evId) : null;
      return ev ? { ev: ev, calId: c.getId() } : null;
    } catch (e) { return null; }
  };
  t.rows.forEach(o => {
    if (!o.obj_id || !o.task) return;
    const cls = o.status ? dictClassOf_('task_status', o.status) : CLS.OPEN;
    const cur = find(o.cal_event);
    if (cls === CLS.CANCEL || cls === CLS.MOVED) {
      if (cur) { cur.ev.deleteEvent(); res.deleted++; }
      if (o.cal_event) writeFields_(t.sh, 'TASK', o._row, { cal_event: '' });
      return;
    }
    if (!(o.deadline instanceof Date) || o.deadline < from) return;
    if (o.owner && !emails[o.owner] && res.noEmail.indexOf(o.owner) < 0) res.noEmail.push(o.owner);
    const tg = target(o.owner);
    const title = (cls === CLS.DONE ? '✓ ' : '') + o.obj_name + ': ' + o.task + (o.plan !== '' ? ' (' + o.plan + (o.unit ? ' ' + o.unit : '') + ')' : '');
    const desc = 'Задача ' + o.id + ' · исполнитель: ' + (o.owner || '—') + '\nСтатус: ' + (o.status || '—') + '\nТаблица: ' + url;
    let ev = cur && cur.calId === tg.cal.getId() ? cur.ev : null;
    if (cur && !ev) { cur.ev.deleteEvent(); res.deleted++; } // исполнитель сменился / появился доступ к его календарю — событие переезжает
    if (!ev) {
      if (cls === CLS.DONE) { if (o.cal_event) writeFields_(t.sh, 'TASK', o._row, { cal_event: '' }); return; } // выполненные заново не ставим
      ev = tg.cal.createAllDayEvent(title, o.deadline, { description: desc, guests: tg.guest, sendInvites: !!tg.guest });
      writeFields_(t.sh, 'TASK', o._row, { cal_event: tg.cal.getId() + '::' + ev.getId() });
      res.created++;
      return;
    }
    let changed = false;
    if (ev.getTitle() !== title) { ev.setTitle(title); changed = true; }
    if (ev.getDescription() !== desc) { ev.setDescription(desc); changed = true; }
    const start = ev.getAllDayStartDate();
    if (!start || start.getTime() !== o.deadline.getTime()) { ev.setAllDayDate(o.deadline); changed = true; }
    const guests = ev.getGuestList().map(g => g.getEmail().toLowerCase());
    guests.forEach(g => { if (g !== tg.guest) { ev.removeGuest(g); changed = true; } });
    if (tg.guest && guests.indexOf(tg.guest) < 0) { ev.addGuest(tg.guest); changed = true; }
    if (changed) res.updated++;
  });
  return res;
}

/** Личный календарь «Задачи: Имя» у владельца системы: скрыт у владельца, открыт сотруднику на просмотр (один раз). */
function personalCalendar_(name, email, res) {
  const title = PERSON_CALENDAR_PREFIX + name;
  let c = CalendarApp.getOwnedCalendarsByName(title)[0];
  if (!c) {
    c = CalendarApp.createCalendar(title, { summary: 'Задачи из системы эксклюзивов для: ' + name + '. Обновляется автоматически каждый час.' });
    try { c.setSelected(false); } catch (e) { /* видимость — вручную */ }
  }
  const props = PropertiesService.getScriptProperties();
  const key = 'CAL_SHARE_' + c.getId() + '_' + email;
  if (!props.getProperty(key)) {
    const r = UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(c.getId()) + '/acl?sendNotifications=true', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ role: 'reader', scope: { type: 'user', value: email } }),
    });
    if (r.getResponseCode() < 300) props.setProperty(key, fmtDate_(new Date()));
    else if (res) res.shareErrors.push(name + ': ' + r.getContentText().slice(0, 120) + ' — откройте календарь «' + title + '» для ' + email + ' вручную (Настройки календаря → Доступ)');
  }
  return c;
}

/** Письмо сотрудникам, чей календарь недоступен: как открыть доступ владельцу системы. Один раз на человека (force — повторить). */
function requestCalendarAccess_(force) {
  const props = PropertiesService.getScriptProperties();
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const boss = String(cfgGet_('MANAGER_NAME') || 'руководитель');
  const sent = [];
  dictRows_('people').forEach(p => {
    const name = String(p[0] || '').trim(), email = String(p[2] || '').trim().toLowerCase();
    if (!name || !/@/.test(email) || email === me) return;
    if (!force && props.getProperty('CAL_REQ_' + email)) return;
    if (writableCalendar_(email)) return;
    const html = '<p>Здравствуйте!</p>' +
      '<p>Чтобы задачи из системы эксклюзивов приходили <b>прямо в ваш Google Календарь</b> (а не приглашениями), откройте, пожалуйста, доступ к своему календарю — это 1 минута:</p>' +
      '<ol><li>Откройте <a href="https://calendar.google.com">calendar.google.com</a> на компьютере.</li>' +
      '<li>Слева в «Мои календари» наведите на календарь со своим именем → ⋮ → <b>«Настройки и общий доступ»</b>.</li>' +
      '<li>Раздел <b>«Доступ для отдельных пользователей и групп»</b> → «Добавить пользователей и группы».</li>' +
      '<li>Впишите <b>' + me + '</b>, права — <b>«Внесение изменений в мероприятия»</b> → «Отправить».</li></ol>' +
      '<p>В течение часа ваши задачи (со сроками) появятся в вашем календаре: выполнено — с «✓», перенос срока — событие переедет само. Пока доступа нет, ваши задачи — в календаре «Задачи: ваше имя»: откройте письмо Google о доступе к нему и нажмите «Добавить календарь».</p>' +
      '<p>' + boss + '</p>';
    MailApp.sendEmail({ to: email, subject: 'Задачи в ваш Google Календарь: откройте доступ (1 минута)', htmlBody: html, name: boss });
    props.setProperty('CAL_REQ_' + email, fmtDate_(new Date()));
    sent.push(name);
  });
  return sent;
}

/** Меню: повторно отправить сотрудникам просьбу открыть доступ к календарю. */
function requestCalendarAccess() {
  if (!requireAdmin_('Попросить сотрудников открыть доступ к календарю')) return;
  const s = requestCalendarAccess_(true);
  toast_(s.length ? 'Письмо с инструкцией отправлено: ' + s.join(', ') : 'Всем сотрудникам с email доступ к календарю уже открыт.', 'Google Календарь', 8);
}

/** Календарь сотрудника, если он открыл владельцу системы доступ на изменение событий; иначе null. Проверка кэшируется на 6 часов. */
function writableCalendar_(email) {
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  const key = 'calw_' + email;
  const known = cache ? cache.get(key) : null;
  if (known === '0') return null;
  let c = null;
  try { c = CalendarApp.getCalendarById(email); } catch (e) { c = null; }
  if (!c) { // доступ дан, но календарь ещё не добавлен в список — добавляем скрытым (в вашем календаре его события не видны)
    try { c = CalendarApp.subscribeToCalendar(email, { selected: false }); } catch (e) { c = null; }
  }
  let ok = !!c;
  if (c && known !== '1') {
    try { const ev = c.createAllDayEvent('проверка доступа', new Date(2000, 0, 1), {}); ev.deleteEvent(); } catch (e) { ok = false; }
  }
  if (cache) cache.put(key, ok ? '1' : '0', 21600);
  return ok ? c : null;
}

// ───────────────────────── ежедневное обновление ─────────────────────────

/** Каждое утро: календарь, статистика соцсетей, списки документов, копии вкладок, восстановление и защита объектов. */
function dailyJobs() {
  try { syncCalendar_(); } catch (e) { Logger.log('Календарь: ' + e.message); }
  try { refreshSocialStats_(); } catch (e) { Logger.log('Статистика: ' + e.message); }
  try { registerOldReports_(); } catch (e) { Logger.log('Старые отчёты: ' + e.message); }
  try { refreshObjectFiles_(); } catch (e) { Logger.log('Документы: ' + e.message); }
  try { backupObjectTabs_(); } catch (e) { Logger.log('Копии вкладок: ' + e.message); }
  try { tabsWork_(); protectAll_(); } catch (e) { Logger.log('Вкладки / защита: ' + e.message); }
  try { ensureMediaTasks_(); } catch (e) { Logger.log('Задачи фото и видео: ' + e.message); }
  try { ensureAdLinkTasks_(); } catch (e) { Logger.log('Задачи ссылок на отчёт по рекламе: ' + e.message); }
  try { scheduleFollowUps_(); } catch (e) { Logger.log('Повторные контакты: ' + e.message); }
  try { refreshIdleAudiences_(); } catch (e) { Logger.log('Аудитории без базы: ' + e.message); }
  try { refreshBaseAudienceLists_(); } catch (e) { Logger.log('Списки аудиторий: ' + e.message); }
}

/** Задачи → Google Календарь каждый час (в течение дня новые задачи и сроки появляются у исполнителей). */
function calendarJob() {
  try { syncCalendar_(); } catch (e) { Logger.log('Календарь: ' + e.message); }
}

/** Ставит недостающие автозапуски: утреннее обновление 7:00, входящие каждые 10 минут, календарь каждый час, сводка 9:00. */
function ensureJobTriggers_() {
  const have = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  const added = [];
  if (have.indexOf('dailyJobs') < 0) { ScriptApp.newTrigger('dailyJobs').timeBased().everyDays(1).atHour(7).inTimezone(SYS.TZ).create(); added.push('утреннее обновление 7:00'); }
  if (have.indexOf('inboxJob') < 0) { ScriptApp.newTrigger('inboxJob').timeBased().everyMinutes(10).create(); added.push('входящие каждые 10 минут'); }
  if (have.indexOf('calendarJob') < 0) { ScriptApp.newTrigger('calendarJob').timeBased().everyHours(1).create(); added.push('календарь каждый час'); }
  if (have.indexOf('digestJob') < 0) { ScriptApp.newTrigger('digestJob').timeBased().everyDays(1).atHour(9).inTimezone(SYS.TZ).create(); added.push('сводка 9:00'); }
  return added;
}

/** Утренняя сводка сотрудникам — отдельный запуск в 9:00 по Москве (после утреннего обновления в 7:00). */
function digestJob() {
  try { sendDailyDigest_(); } catch (e) { Logger.log('Утренняя сводка: ' + e.message); }
}

function enableDailyJobs() {
  if (!requireAdmin_('Включить автообновление')) return;
  disableDailyJobs_();
  ScriptApp.newTrigger('calendarJob').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('dailyJobs').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('inboxJob').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('digestJob').timeBased().everyDays(1).atHour(9).inTimezone(SYS.TZ).create();
  toast_('Каждое утро (около 7:00) — календарь, статистика соцсетей, документы, повторные контакты. В 9:00 — сводка сотрудникам на почту. Каждые 10 минут — разбор папки 04_ВХОДЯЩИЕ.', 'Автообновление', 8);
}

function disableDailyJobs() {
  if (!requireAdmin_('Выключить автообновление')) return;
  disableDailyJobs_();
  toast_('Ежедневное обновление выключено.', 'Ежедневное обновление', 5);
}

function disableDailyJobs_() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'dailyJobs' || t.getHandlerFunction() === 'inboxJob' || t.getHandlerFunction() === 'digestJob' || t.getHandlerFunction() === 'calendarJob') ScriptApp.deleteTrigger(t); });
}
