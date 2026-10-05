/**
 * 29_WebApp — личные кабинеты: веб-приложение (сайт) поверх таблицы.
 * Таблица остаётся базой данных; сотрудники работают в кабинете, а не в листах.
 *
 * Кто есть кто — по Google-аккаунту и 07_СПРАВОЧНИКИ «Сотрудник / Роль / Email»:
 *   Директор (роль «Руководитель» / «Директор» или владелец таблицы) — видит и меняет всё;
 *   Ассистент — объекты директора (Ответственный пустой или директор) и объекты, где он указан ассистентом;
 *   Агент — объекты, где он «Ответственный»;
 *   SMM — все объекты (маркетинг компании): контент меняет, задачи — только свои, базу обзвона не видит.
 * Правки из кабинета проходят через ту же автоматику, что и правки в таблице (ID, история, перенос задач, даты).
 */

const WEB_ROLE_TITLES = { director: 'Директор', assistant: 'Ассистент', agent: 'Агент', smm: 'SMM' };

function doGet() {
  return HtmlService.createHtmlOutput(WEB_HTML)
    .setTitle('Кабинет — ' + SYS.TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function webRoleOf_(text) {
  const t = String(text || '').toLowerCase();
  if (/руковод|директор/.test(t)) return 'director';
  if (/ассист/.test(t)) return 'assistant';
  if (/smm|смм|маркет/.test(t)) return 'smm';
  if (/агент|брокер|риэлт|риелт/.test(t)) return 'agent';
  return '';
}

/** Текущий сотрудник: {email, name, role, roleTitle, directors}. Нет в справочнике — ошибка «нет доступа». */
function webUser_() {
  const email = String(userEmail_() || '').trim().toLowerCase();
  if (!email) throw new Error('Не удалось определить ваш Google-аккаунт. Войдите в Google и откройте ссылку снова.');
  const people = dictRows_('people');
  const directors = people.filter(r => webRoleOf_(r[1]) === 'director').map(r => String(r[0]));
  let owner = '';
  try { owner = String(ss_().getOwner().getEmail() || '').toLowerCase(); } catch (e) { /* общий диск */ }
  const row = people.find(r => String(r[2] || '').trim().toLowerCase() === email);
  if (!row && email !== owner) {
    throw new Error('Нет доступа для ' + email + '. Руководитель добавляет сотрудника в 07_СПРАВОЧНИКИ: имя, роль (Директор / Ассистент / Агент / SMM) и этот email.');
  }
  const role = email === owner ? 'director' : webRoleOf_(row[1]);
  if (!role) throw new Error('У сотрудника ' + row[0] + ' в 07_СПРАВОЧНИКИ не указана роль: Директор, Ассистент, Агент или SMM.');
  const name = row ? String(row[0]) : (directors[0] || 'Директор');
  return { email: email, name: name, role: role, roleTitle: WEB_ROLE_TITLES[role], directors: directors };
}

function webCanSee_(u, o) {
  if (!o) return false;
  if (u.role === 'director' || u.role === 'smm') return true;
  if (isServiceObject_(o)) return false;
  const mgr = String(o.manager || '');
  if (u.role === 'agent') return mgr === u.name;
  if (u.role === 'assistant') return !mgr || u.directors.indexOf(mgr) >= 0 || String(o.assistant || '') === u.name;
  return false;
}

/** Может ли менять записи листа code по объекту o. SMM — только контент. */
function webCanEdit_(u, o, code) {
  if (!webCanSee_(u, o)) return false;
  if (u.role === 'smm') return code === 'CONT';
  return true;
}

function webVal_(v) {
  if (v instanceof Date) return fmtDate_(v, 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : v;
}

function webRow_(o, keys) {
  const r = {};
  keys.forEach(k => { r[k] = webVal_(o[k]); });
  return r;
}

const WEB_OBJ_KEYS = ['id', 'name', 'kind', 'deal', 'address', 'area', 'price', 'status', 'manager', 'assistant', 'smm', 'strategy_pct',
  'folder_link', 'crm_link', 'last_report_link', 'last_report_date', 'tab_url', 'in_work', 'idle_aud'];
const WEB_TASK_KEYS = ['id', 'week', 'obj_id', 'block', 'task', 'owner', 'unit', 'plan', 'fact', 'fact_auto', 'deadline', 'status', 'result', 'source'];
const WEB_BASE_KEYS = ['id', 'obj_id', 'audience', 'company', 'site', 'contact', 'fit', 'fit_note', 'call_date', 'call_result', 'kp_date', 'kp_type',
  'response', 'response_date', 'next_step', 'next_date', 'to_crm', 'owner'];
const WEB_CONT_KEYS = ['id', 'obj_id', 'topic', 'platform', 'format', 'goal', 'script', 'status', 'pub_date', 'link', 'views', 'reach', 'saves', 'leads', 'owner'];

/** Что можно менять из кабинета и что можно указывать при создании записи. */
const WEB_EDITABLE = {
  TASK: ['status', 'result', 'fact', 'deadline', 'owner', 'task', 'plan'],
  BASE: ['call_date', 'call_result', 'kp_date', 'kp_type', 'response', 'next_step', 'next_date', 'fit', 'fit_note', 'contact', 'site', 'audience', 'company', 'to_crm'],
  CONT: ['topic', 'platform', 'format', 'goal', 'script', 'status', 'pub_date', 'link', 'views', 'reach', 'saves', 'leads', 'owner'],
};
const WEB_CREATE = {
  TASK: ['obj_id', 'block', 'task', 'owner', 'unit', 'plan', 'deadline'],
  BASE: ['obj_id', 'audience', 'company', 'site', 'contact', 'fit_note', 'next_step', 'next_date'],
  CONT: ['obj_id', 'topic', 'platform', 'format', 'goal', 'script', 'pub_date', 'owner'],
};

function webObjects_(u) {
  return readTable_('OBJ').rows.filter(o => o.id && o.name && webCanSee_(u, o));
}

function webClassOf_(dict, v) {
  try { return v ? dictClassOf_(dict, v) : CLS.OPEN; } catch (e) { return ''; }
}

/** Стартовые данные кабинета. */
function webBootstrap() {
  const u = webUser_();
  const objs = webObjects_(u).map(o => {
    const r = webRow_(o, WEB_OBJ_KEYS);
    r.service = isServiceObject_(o);
    r.has_ad = !!o.crm_report_link;
    if (u.role !== 'director') { delete r.crm_link; }
    return r;
  });
  const dict = k => { try { return dictValues_(k); } catch (e) { return []; } };
  const statusRows = k => { try { return dictRows_(k).map(r => [r[0], r[1]]); } catch (e) { return []; } };
  const wk = isoWeekKey_(today_());
  return {
    me: { name: u.name, role: u.role, roleTitle: u.roleTitle, email: u.email },
    today: fmtDate_(today_(), 'yyyy-MM-dd'), week: wk,
    objects: objs,
    dicts: {
      people: dict('people'), task_blocks: dict('task_blocks'), units: dict('units'), task_status: statusRows('task_status'),
      responses: dict('responses'), kp_types: dict('kp_types'), fit: dict('fit'),
      platforms: dict('platforms'), content_formats: dict('content_formats'), content_goals: dict('content_goals'), content_status: statusRows('content_status'),
    },
    sheetUrl: u.role === 'director' ? ss_().getUrl() : '',
  };
}

/** Задачи: по видимым объектам + свои по любому объекту. Открытые любой недели и все за эту и прошлую неделю. */
function webTasks() {
  const u = webUser_();
  const vis = {};
  webObjects_(u).forEach(o => { vis[String(o.id)] = o; });
  const wk = isoWeekKey_(today_()), prev = isoWeekKey_(addDays_(today_(), -7));
  return readTable_('TASK').rows.filter(t => t.id && t.task).filter(t => {
    const mine = String(t.owner) === u.name;
    const see = u.role === 'smm' ? mine : (mine || !!vis[String(t.obj_id)]);
    if (!see) return false;
    const cls = webClassOf_('task_status', t.status);
    return cls === CLS.OPEN || t.week === wk || t.week === prev;
  }).map(t => {
    const r = webRow_(t, WEB_TASK_KEYS);
    r.cls = webClassOf_('task_status', t.status);
    r.mine = String(t.owner) === u.name;
    r.can = u.role === 'director' || r.mine || webCanEdit_(u, vis[String(t.obj_id)], 'TASK');
    return r;
  });
}

/** База обзвона по видимым объектам (SMM — нет доступа). */
function webBase(objId) {
  const u = webUser_();
  if (u.role === 'smm') return [];
  const vis = {};
  webObjects_(u).forEach(o => { vis[String(o.id)] = o; });
  return readTable_('BASE').rows.filter(r => r.id && r.company && vis[String(r.obj_id)] && (!objId || String(r.obj_id) === String(objId)))
    .map(r => { const x = webRow_(r, WEB_BASE_KEYS); x.resp_cls = webClassOf_('responses', r.response); return x; });
}

/** Контент по видимым объектам. */
function webContent(objId) {
  const u = webUser_();
  const vis = {};
  webObjects_(u).forEach(o => { vis[String(o.id)] = o; });
  return readTable_('CONT').rows.filter(r => r.id && vis[String(r.obj_id)] && (!objId || String(r.obj_id) === String(objId)))
    .map(r => { const x = webRow_(r, WEB_CONT_KEYS); x.cls = webClassOf_('content_status', r.status); return x; });
}

/** Карточка объекта: стратегия из вкладки и отчёты. */
function webObject(objId) {
  const u = webUser_();
  const o = objectById_(objId);
  if (!webCanSee_(u, o)) throw new Error('Нет доступа к объекту');
  const out = { strategy: { kv: {}, aud: [], dec: [], chan: [], scen: [], kp: [] }, reports: [] };
  try {
    const tab = findObjectTab_(o);
    if (tab) {
      const d = readObjectTab_(tab);
      const kv = d.kv || {};
      ['rec_price', 'min_price', 'positioning', 'price_note', 'analysis_link', 'median', 'our_m2'].forEach(k => { out.strategy.kv[k] = webVal_(kv[k]); });
      const t = (k, n) => (d.tables[k] || []).map(r => r.slice(0, n).map(webVal_));
      out.strategy.aud = t('AUD', 5); out.strategy.dec = t('DEC', 4); out.strategy.chan = t('CHAN', 5); out.strategy.scen = t('SCEN', 6); out.strategy.kp = t('KP', 6);
    }
  } catch (e) { out.strategyError = e.message; }
  out.reports = readTable_('ARCH').rows.filter(r => String(r.obj_id) === String(objId) && r.status !== REPORT_STATUS.REPLACED)
    .map(r => ({ no: webVal_(r.report_no), week: r.week, period: r.period, link: r.doc_link || r.pdf_link, status: r.status })).reverse().slice(0, 12);
  return out;
}

/** Реклама по объекту (из отчёта CRM). Расходы — только директору. */
function webAd(objId) {
  const u = webUser_();
  const o = objectById_(objId);
  if (!webCanSee_(u, o) || !o.crm_report_link) return null;
  const a = fetchAdReport_(o.crm_report_link);
  if (!a) return null;
  return { since: a.since ? fmtDate_(a.since, 'yyyy-MM-dd') : '', sites: a.sites, views: a.views, fav: a.fav, appeals: a.appeals, shows: a.shows,
    cian: a.cian, spend: u.role === 'director' ? a.spend : null };
}

/** Директор: команда и объекты за неделю. */
function webTeam() {
  const u = webUser_();
  if (u.role !== 'director') throw new Error('Раздел доступен только директору');
  const wk = isoWeekKey_(today_()), today = today_();
  const tasks = readTable_('TASK').rows.filter(t => t.id && t.task);
  const cls = t => webClassOf_('task_status', t.status);
  const people = dictRows_('people').map(r => ({ name: String(r[0]), role: String(r[1] || '') }));
  const team = people.map(p => {
    const my = tasks.filter(t => String(t.owner) === p.name);
    return {
      name: p.name, role: p.role,
      open: my.filter(t => cls(t) === CLS.OPEN).length,
      overdue: my.filter(t => cls(t) === CLS.OPEN && t.deadline instanceof Date && t.deadline < today).length,
      doneWeek: my.filter(t => t.week === wk && cls(t) === CLS.DONE).length,
      week: my.filter(t => t.week === wk && cls(t) !== CLS.CANCEL).length,
    };
  });
  const base = readTable_('BASE').rows;
  const inWk = d => d instanceof Date && isoWeekKey_(d) === wk;
  const objs = webObjects_(u).filter(o => !isServiceObject_(o)).map(o => {
    const id = String(o.id);
    const wt = tasks.filter(t => String(t.obj_id) === id && t.week === wk && cls(t) !== CLS.CANCEL);
    const b = base.filter(r => String(r.obj_id) === id && r.company);
    return {
      id: id, name: o.name, manager: o.manager || '',
      tasksWeek: wt.length, doneWeek: wt.filter(t => cls(t) === CLS.DONE).length,
      callsWeek: b.filter(r => inWk(r.call_date)).length, kpWeek: b.filter(r => inWk(r.kp_date)).length,
      baseTotal: b.length, interested: b.filter(r => webClassOf_('responses', r.response) === 'YES').length,
      lastReport: webVal_(o.last_report_date), strategy: webVal_(o.strategy_pct),
    };
  });
  return { team: team, objects: objs, week: wk };
}

function webParse_(code, key, v) {
  const f = fieldOf_(code, key);
  if (v === null || v === undefined) return '';
  if (f.kind === 'date') {
    if (!v) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : (parseRuDate_(String(v)) || '');
  }
  if (f.kind === 'num' || f.kind === 'money') { const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return v === '' || isNaN(n) ? '' : n; }
  if (f.kind === 'cb') return v === true || v === 'true';
  return String(v).trim();
}

/** Правка записи (TASK / BASE / CONT) из кабинета. Каждое поле — как правка одной ячейки в таблице. */
function webUpdate(code, id, changes) {
  const u = webUser_();
  if (!WEB_EDITABLE[code]) throw new Error('Нельзя менять ' + code);
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const t = readTable_(code);
    const r = t.rows.find(x => String(x.id) === String(id));
    if (!r) throw new Error('Запись ' + id + ' не найдена — обновите страницу');
    const o = objectById_(r.obj_id);
    const ownTask = code === 'TASK' && String(r.owner) === u.name;
    if (!(u.role === 'director' || ownTask || webCanEdit_(u, o, code))) throw new Error('Нет прав менять эту запись');
    Object.keys(changes || {}).forEach(k => {
      if (WEB_EDITABLE[code].indexOf(k) < 0) return;
      if (code === 'TASK' && k === 'owner' && u.role !== 'director') return;
      const nv = webParse_(code, k, changes[k]);
      const old = r[k];
      if (sameValue_(old, nv)) return;
      const col = fieldIndex_(code, k);
      writeFields_(t.sh, code, r._row, { [k]: nv });
      r[k] = nv;
      processEditedRows_(t.sh, t.spec, r._row, r._row, col, col, { oldValue: old instanceof Date ? fmtDate_(old) : old });
    });
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Новая запись из кабинета. */
function webCreate(code, data) {
  const u = webUser_();
  if (!WEB_CREATE[code]) throw new Error('Нельзя создавать ' + code);
  const o = objectById_(data && data.obj_id);
  if (!(webCanEdit_(u, o, code) || (u.role === 'director' && o))) throw new Error('Нет прав на этот объект');
  const rec = {};
  WEB_CREATE[code].forEach(k => { if (data[k] !== undefined && data[k] !== '') rec[k] = webParse_(code, k, data[k]); });
  rec.obj_id = String(o.id);
  if (code === 'TASK' && !rec.task) throw new Error('Напишите задачу');
  if (code === 'BASE' && !rec.company) throw new Error('Укажите компанию');
  if (code === 'CONT' && !rec.topic) throw new Error('Укажите тему');
  if (!rec.owner && (code !== 'TASK' || u.role !== 'director')) rec.owner = u.name;
  if (code === 'TASK' && rec.deadline instanceof Date) rec.week = isoWeekKey_(rec.deadline);
  if (code === 'TASK') rec.source = 'Вручную';
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const t = readTable_(code);
    const row = appendRow_(code, rec);
    processEditedRows_(t.sh, t.spec, row, row, 1, t.spec.fields.length, {});
    const id = t.sh.getRange(row, fieldIndex_(code, 'id')).getValue();
    if (code === 'BASE') { try { refreshBaseAudienceLists_([rec.obj_id]); } catch (e) { /* утром */ } }
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/** Меню: ссылка на личные кабинеты (или как их включить). */
function webAppLink() {
  const ui = SpreadsheetApp.getUi();
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { /* не развёрнуто */ }
  if (url) {
    showLinks_('Личные кабинеты', [{ label: 'Открыть кабинет', url: url }],
      'Эту ссылку отправьте сотрудникам. Каждый входит своим Google-аккаунтом и видит свой кабинет. ' +
      'Сотрудник должен быть в 07_СПРАВОЧНИКИ (имя, роль, email) и иметь доступ к таблице.');
    return;
  }
  ui.alert('Личные кабинеты ещё не опубликованы',
    'Один раз (делает руководитель):\n' +
    '1) Расширения → Apps Script → кнопка «Начать развертывание» → «Новое развертывание».\n' +
    '2) Тип (шестерёнка) — «Веб-приложение».\n' +
    '3) «Запуск от имени» — «Пользователь, у которого есть доступ к веб-приложению».\n' +
    '4) «У кого есть доступ» — «Все, у кого есть аккаунт Google».\n' +
    '5) «Развернуть» → скопируйте ссылку «Веб-приложение» — это адрес кабинетов.\n\n' +
    'После каждого обновления кода: «Начать развертывание» → «Управление развертываниями» → карандаш → «Версия: новая версия» → «Развернуть». Ссылка не меняется.',
    ui.ButtonSet.OK);
}
