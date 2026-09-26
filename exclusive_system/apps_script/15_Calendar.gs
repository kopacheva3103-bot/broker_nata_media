/**
 * 15_Calendar — задачи 02_ЗАДАЧИ в Google Календаре.
 *
 * Событие на весь день в дату «Срок» создаётся в календаре того, кто запускает синхронизацию
 * (руководителя), исполнитель получает приглашение на свой email из 07_СПРАВОЧНИКИ.
 * Выполнено → в названии «✓»; Отменено / Перенесено → событие удаляется (у копии-переноса — своё событие).
 * Изменили срок или исполнителя → событие обновляется. Обрабатываются задачи со сроком не старше 14 дней.
 */

function syncCalendar() {
  const r = syncCalendar_();
  toast_('Календарь: создано ' + r.created + ', обновлено ' + r.updated + ', удалено ' + r.deleted +
    (r.noEmail.length ? '. Нет email у: ' + r.noEmail.join(', ') + ' (07_СПРАВОЧНИКИ)' : ''), 'Google Календарь', 10);
}

function syncCalendar_() {
  const t = readTable_('TASK');
  const cal = CalendarApp.getDefaultCalendar();
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const emails = {};
  dictRows_('people').forEach(p => { emails[p[0]] = String(p[2] || '').trim(); });
  const url = ss_().getUrl();
  const from = addDays_(today_(), -14);
  const res = { created: 0, updated: 0, deleted: 0, noEmail: [] };
  t.rows.forEach(o => {
    if (!o.obj_id || !o.task) return;
    const cls = o.status ? dictClassOf_('task_status', o.status) : CLS.OPEN;
    let ev = null;
    if (o.cal_event) { try { ev = cal.getEventById(o.cal_event); } catch (e) { ev = null; } }
    if (cls === CLS.CANCEL || cls === CLS.MOVED) {
      if (ev) { ev.deleteEvent(); res.deleted++; }
      if (o.cal_event) writeFields_(t.sh, 'TASK', o._row, { cal_event: '' });
      return;
    }
    if (!(o.deadline instanceof Date) || o.deadline < from) return;
    const email = emails[o.owner] || '';
    if (o.owner && !email && res.noEmail.indexOf(o.owner) < 0) res.noEmail.push(o.owner);
    const title = (cls === CLS.DONE ? '✓ ' : '') + o.obj_name + ': ' + o.task + (o.plan !== '' ? ' (' + o.plan + (o.unit ? ' ' + o.unit : '') + ')' : '');
    const desc = 'Задача ' + o.id + ' · исполнитель: ' + (o.owner || '—') + '\nСтатус: ' + (o.status || '—') + '\nТаблица: ' + url;
    const guest = email && email.toLowerCase() !== me ? email : '';
    if (!ev) {
      if (cls === CLS.DONE) return; // уже выполненные в календарь не добавляем
      ev = cal.createAllDayEvent(title, o.deadline, { description: desc, guests: guest, sendInvites: !!guest });
      writeFields_(t.sh, 'TASK', o._row, { cal_event: ev.getId() });
      res.created++;
      return;
    }
    let changed = false;
    if (ev.getTitle() !== title) { ev.setTitle(title); changed = true; }
    if (ev.getDescription() !== desc) { ev.setDescription(desc); changed = true; }
    const start = ev.getAllDayStartDate();
    if (!start || start.getTime() !== o.deadline.getTime()) { ev.setAllDayDate(o.deadline); changed = true; }
    const guests = ev.getGuestList().map(g => g.getEmail().toLowerCase());
    guests.forEach(g => { if (g !== (guest || '').toLowerCase()) { ev.removeGuest(g); changed = true; } });
    if (guest && guests.indexOf(guest.toLowerCase()) < 0) { ev.addGuest(guest); changed = true; }
    if (changed) res.updated++;
  });
  return res;
}

// ───────────────────────── ежедневное обновление ─────────────────────────

/** Каждое утро: календарь + просмотры Telegram / YouTube. */
function dailyJobs() {
  try { syncCalendar_(); } catch (e) { Logger.log('Календарь: ' + e.message); }
  try { refreshSocialStats_(); } catch (e) { Logger.log('Статистика: ' + e.message); }
}

function enableDailyJobs() {
  disableDailyJobs_();
  ScriptApp.newTrigger('dailyJobs').timeBased().everyDays(1).atHour(7).create();
  toast_('Каждое утро (около 7:00) задачи синхронизируются с календарём, просмотры Telegram / YouTube обновляются.', 'Ежедневное обновление', 8);
}

function disableDailyJobs() {
  disableDailyJobs_();
  toast_('Ежедневное обновление выключено.', 'Ежедневное обновление', 5);
}

function disableDailyJobs_() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'dailyJobs') ScriptApp.deleteTrigger(t); });
}
