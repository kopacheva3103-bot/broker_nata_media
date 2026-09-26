// Прогон установки, примера и плана недели на заглушке SpreadsheetApp — ловит ошибки выполнения JS до Apps Script.
const { loadGs } = require('./load_gs.js');
const { makeSS } = require('./mock_ss.js');
const M = makeSS();
const EV = {}; let evN = 0;
const PSTORE = {};
// Google Диск: 01_ОБЪЕКТЫ с уже существующей папкой «ЖК Время»
const it = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
const mkFile = (name, mime, d) => ({ getName: () => name, getMimeType: () => mime, getLastUpdated: () => new Date(d), getUrl: () => 'https://drive/' + encodeURIComponent(name), isTrashed: () => false });
const mkFolder = (id, name, files, subs) => { const f = { id, name, files: files || [], subs: subs || [],
  getId: () => id, getName: () => name, getUrl: () => 'https://drive.google.com/drive/folders/' + id, isTrashed: () => false,
  getFiles: () => it(f.files), getFolders: () => it(f.subs), getFoldersByName: n => it(f.subs.filter(x => x.name === n)),
  createFolder: n => { const c = mkFolder(id + '_' + f.subs.length, n); f.subs.push(c); FOLDERS[c.id] = c; return c; } }; FOLDERS[id] = f; return f; };
const FOLDERS = {}; const TRASHED = [];
const inFile = (id, name, mime) => { const f = { getId: () => id, getName: () => name, getMimeType: () => mime, moveTo: d => { INBOX.files = INBOX.files.filter(x => x !== f); d.files.push(f); f.where = d.name; }, getLastUpdated: () => new Date(), getUrl: () => 'u', isTrashed: () => false }; return f; };
const ANALYTICS = mkFolder('FAN', 'Аналитика', [mkFile('Маркетинговый_анализ_Лермонтовская_1.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '2026-09-10')]);
const TIME = mkFolder('FTIME', 'ЖК Время', [mkFile('КП_ЖК_Время.pdf', 'application/pdf', '2026-09-20'), mkFile('Медцентры.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '2026-09-21')], [ANALYTICS]);
const OBJROOT = mkFolder('FOBJ', '01_ОБЪЕКТЫ', [], [mkFolder('FOTHER', 'Остров'), TIME]);
const INBOX = mkFolder('FINBOX', '04_ВХОДЯЩИЕ');
const F1 = inFile('F_OSTROV', 'Презентация КП Остров.pdf', 'application/pdf');
const F2 = inFile('F_TIME', 'ВРЕМЯ-1 Новая презентация под медцентр.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
const F3 = inFile('F_RENT', 'Тверская 15 — аренда.pdf', 'application/pdf');
INBOX.files.push(F1, F2, F3);
const PROPS = { getProperty: k => (k in PSTORE ? PSTORE[k] : null), setProperty: (k, v) => { PSTORE[k] = v; }, deleteProperty: k => { delete PSTORE[k]; } };
const FETCHED = []; const NOTES = [];
function FETCH(u) {
  FETCHED.push(u);
  const J = o => ({ getContentText: () => JSON.stringify(o), getResponseCode: () => 200 });
  if (u.indexOf('t.me/') >= 0) return { getContentText: () => u.indexOf('/77?') > 0 ? '<span class="tgme_widget_message_views">1.2K</span>' : '<span class="tgme_widget_message_views">845</span>' };
  if (/graph\.instagram\.com\/v25\.0\/me\?/.test(u)) return u.indexOf('BAD') >= 0 ? J({ error: { message: 'Invalid OAuth access token' } }) : J({ username: 'sdelka77' });
  if (/graph\.threads\.net\/v1\.0\/me\?/.test(u)) return J({ username: 'nata.broker' });
  if (/instagram\.com\/v25\.0\/me\/media/.test(u)) return u.indexOf('after=') >= 0 ? J({ data: [{ id: '17900002', permalink: 'https://www.instagram.com/p/POST2/' }] }) :
    J({ data: [{ id: '17900001', permalink: 'https://www.instagram.com/reel/REEL1abc/' }], paging: { next: 'https://graph.instagram.com/v25.0/me/media?after=x' } });
  if (/17900001\/insights/.test(u)) return J({ data: [{ name: 'views', values: [{ value: 5400 }] }, { name: 'reach', values: [{ value: 3100 }] }, { name: 'saved', values: [{ value: 42 }] }] });
  if (/17900002\/insights/.test(u)) return u.indexOf('views') >= 0 ? J({ error: { message: 'metric not supported' } }) : J({ data: [{ name: 'reach', total_value: { value: 900 } }, { name: 'saved', values: [{ value: 3 }] }] });
  if (/threads\.net\/v1\.0\/me\/threads/.test(u)) return J({ data: [
    { id: '555', permalink: 'https://www.threads.net/@nata.broker/post/THR1', text: 'Помещение 756 м² в ЖК «Время» — под клинику', timestamp: '2026-09-25T06:30:00+0000', media_type: 'IMAGE' },
    { id: '556', permalink: 'https://www.threads.net/@nata.broker/post/THR2', text: 'Лермонтовская, 1: потолки 4,5 м', timestamp: '2026-09-24T06:30:00+0000', media_type: 'TEXT_POST' },
    { id: '557', permalink: 'https://www.threads.net/@nata.broker/post/THR3', text: 'Как выбрать риелтора', timestamp: '2026-09-23T06:30:00+0000', media_type: 'TEXT_POST' },
    { id: '558', permalink: 'https://www.threads.net/@nata.broker/post/THR4', text: 'ЖК Время продолжение', timestamp: '2026-09-23T06:31:00+0000', is_reply: true },
    { id: '559', permalink: 'https://www.threads.net/@nata.broker/post/OLD', text: 'ЖК Время старый', timestamp: '2026-05-01T06:30:00+0000' } ] });
  if (/googleapis\.com\/drive\/v3\/files\/(.+)\/copy/.test(u)) return J({ id: 'TMP_' + /files\/([^/]+)\/copy/.exec(u)[1] });
  if (/googleapis\.com\/drive\/v3\/files\/TMP_F_OSTROV\/export/.test(u)) return { getResponseCode: () => 200, getContentText: () => 'КП «Остров»\nМосковская обл., Истринский р-н, КП Остров, уч. 12\nДом 450,5 м² на участке 25 соток\nСтоимость: 185 000 000 ₽\nЦена за м²: 410 000 ₽\nПродажа' };
  if (/googleapis\.com\/drive\/v3\/files\/TMP_F_RENT\/export/.test(u)) return { getResponseCode: () => 200, getContentText: () => 'Помещение ПСН 320 м2, аренда 1,2 млн руб. в месяц\nг. Москва, ул. Тверская, 15' };
  if (/topnlab\.ru\/public\/get-entities/.test(u)) return (u.indexOf('79251112233') >= 0 && u.indexOf('type=order') >= 0) ? J({ '123': { id: 123 } }) : { getContentText: () => '', getResponseCode: () => 404 };
  if (/topnlab\.ru\/public\/set-note/.test(u)) { NOTES.push(u); return J({ status: 'success' }); }
  if (/555\/insights/.test(u)) return J({ data: [{ name: 'views', values: [{ value: 777 }] }] });
  if (/refresh_access_token/.test(u)) return J({ access_token: 'REFRESHED', expires_in: 5184000 });
  return J({ error: { message: 'unknown ' + u } });
}
const CAL = {
  createAllDayEvent: (title, d, o) => { const id = 'ev' + (++evN); const e = { id, title, d, desc: o.description, guests: o.guests ? [o.guests] : [],
    getId: () => id, getTitle: () => e.title, setTitle: t => { e.title = t; }, getDescription: () => e.desc, setDescription: x => { e.desc = x; },
    getAllDayStartDate: () => e.d, setAllDayDate: x => { e.d = x; }, getGuestList: () => e.guests.map(g => ({ getEmail: () => g })),
    removeGuest: g => { e.guests = e.guests.filter(x => x !== g); }, addGuest: g => { e.guests.push(g); }, deleteEvent: () => { delete EV[id]; } }; EV[id] = e; return e; },
  getEventById: id => EV[id] || null,
};
const pad = n => String(n).padStart(2, '0');
const X = loadGs({
  SpreadsheetApp: M.SpreadsheetApp,
  Utilities: { sleep: () => {}, formatDate: (d, tz, p) => p.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate())).replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())) },
  Session: { getActiveUser: () => ({ getEmail: () => 'test@example.com' }), getEffectiveUser: () => ({ getEmail: () => 'boss@example.com' }) },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
  UrlFetchApp: { fetch: (u) => FETCH(u) },
  PropertiesService: { getScriptProperties: () => PROPS, getDocumentProperties: () => PROPS },
  CalendarApp: { getDefaultCalendar: () => CAL },
  DriveApp: { getFolderById: id => { if (!FOLDERS[id]) throw new Error('no folder'); return FOLDERS[id]; }, getFileById: id => ({ setTrashed: () => { TRASHED.push(id); } }) },
  ScriptApp: { getOAuthToken: () => 'tok' },
  Utilities2: null,
});
const log = [];
X.runSetup_(log);
X.cfgSet_('FOLDER_OBJECTS_ID', 'FOBJ');
X.cfgSet_('FOLDER_INBOX_ID', 'FINBOX');
// имитация посчитанного списка недель (в Google его считает формула)
{ const wc = X.dictLayout_().weeks.col; const d0 = new Date(2026, 7, 3); const rows = [];
  for (let i = 0; i < 20; i++) { const m = X.addDays_(d0, 7 * i); const k = X.isoWeekKey_(m); rows.push([k, m, X.addDays_(m, 6), k + ' · label']); }
  X.sheet_('DICT').getRange(2, wc, rows.length, 4).setValues(rows); }
console.log('setup:', log.join(', '));
const tab = X.loadExample_();
console.log('tab:', tab.getName());
const obj = X.objectById_(X.EXAMPLE_ID);
console.log('obj fields:', obj.tab_url, obj.strategy_pct, obj.tab_link);
const data = X.readObjectTab_(tab);
console.log('read back:', Object.keys(data.tables).map(k => k + '=' + data.tables[k].length).join(' '), Object.keys(data.kv).join(','));
X.buildObjectTab_(tab, X.EXAMPLE_ID, data);
const data2 = X.readObjectTab_(tab);
console.log('rebuild keeps data:', JSON.stringify(data2) === JSON.stringify(data));
console.log('tasks', X.readTable_('TASK').rows.length, 'base', X.readTable_('BASE').rows.length, 'cont', X.readTable_('CONT').rows.length, 'lib', X.readTable_('LIB').rows.length);
const res = X.buildWeekPlan_('2026-W40', { carry: false });
console.log('week plan:', JSON.stringify(res));
const res2 = X.buildWeekPlan_('2026-W40', { carry: false });
console.log('week plan again (no dups):', res2.added === 0);
// история по правке во вкладке
const L = X.objTabLayout_({});
const r = tab.getRange(L.pos.AUD.first, 2);
X.handleObjectTabEdit_({ range: r, oldValue: 'Медцентры', user: null }, tab);
const h = X.readTable_('HIST').rows.slice(-1)[0];
console.log('history:', h.field, '|', h.old, '→', h.new, '|', h.record_id);
const res3 = X.buildWeekPlan_('2026-W40', { carry: true });
console.log('carry:', JSON.stringify(res3));
// новый объект через onEdit → вкладка создаётся сама
const objSh = X.sheet_('OBJ');
const row = X.lastDataRow_(objSh, X.sheetSpecs_().OBJ) + 1;
objSh.getRange(row, 1, 1, 2).setValues([['4777', 'Особняк на Остоженке']]);
X.onEditHandler({ range: objSh.getRange(row, 1, 1, 2), user: null });
console.log('tabs:', M.ss.getSheets().filter(X.isObjectTab_).map(s => s.getName()).join(' | '));
const o2 = X.objectById_('4777');
console.log('new obj status/created:', o2.status, !!o2.created_at, o2.tab_name);
// задача → ID, неделя, срок
const tSh = X.sheet_('TASK');
const tr = X.lastDataRow_(tSh, X.sheetSpecs_().TASK) + 1;
tSh.getRange(tr, 3).setValue('4777'); tSh.getRange(tr, 6).setValue('Подготовить презентацию');
X.onEditHandler({ range: tSh.getRange(tr, 3, 1, 4), user: null });
const t = X.readTable_('TASK').rows.slice(-1)[0];
console.log('task:', t.id, t.week, t.status, t.deadline instanceof Date, t.source);

// промпт по объекту
const lib = X.readTable_('LIB').rows.find(r => r.title === 'Анализ цены по аналогам');
const pt = X.getPromptText(X.EXAMPLE_ID, lib.id);
console.log('prompt:', pt.length, 'chars;', /Первомайская 42к4/.test(pt), /Сети медцентров/.test(pt), !/\{[^}]*аналог[^}]*\}/.test(pt));
const libOp = X.readTable_('LIB').rows.find(r => r.title === 'Оперативка → задачи');
const op = X.getPromptText('', libOp.id);
console.log('meeting prompt has objects:', /ВРЕМЯ-1 — ЖК Время/.test(op), /Наталья, Ассистент, SMM/.test(op));
// оперативка
const txt = [
  '| ID объекта | Блок стратегии | Задача | Исполнитель | Единица | План | Срок | Решение |',
  '|---|---|---|---|---|---|---|---|',
  '| ВРЕМЯ-1 | База и рассылки | Обзвонить сети стоматологий | Ассистент | звонков | 12 | 02.10.2026 | Добавляем стоматологии как аудиторию |',
  '| Остоженке | Контент | Снять рилс | SMM | публикаций | 1 | 01.10 | |',
  '| 9999 | Другое | Непонятно что | Кто-то | | | | |',
].join('\n');
const pv = X.previewMeetingTasks(txt);
console.log('preview ok', pv.ok.length, 'errors', pv.errors.length, pv.ok.map(o => o.obj_id + '/' + o.deadlineText).join(', '));
console.log(X.addMeetingTasks(txt));
const dec = X.readObjectTab_(tab).tables.DEC;
console.log('decisions:', dec.length, dec[dec.length - 1][1]);
// календарь
X.sheet_('DICT').getRange(3, X.dictLayout_().people.col + 2).setValue('assistant@example.com');
const c1 = X.syncCalendar_();
console.log('calendar 1:', JSON.stringify(c1));
const c2 = X.syncCalendar_();
console.log('calendar 2 (no changes):', JSON.stringify(c2));
// соцсети
const cSh = X.sheet_('CONT');
const cr = X.lastDataRow_(cSh, X.sheetSpecs_().CONT) + 1;
cSh.getRange(cr, 2).setValue(X.EXAMPLE_ID); cSh.getRange(cr, 11).setValue('https://t.me/sdelka77/77');
cSh.getRange(cr + 1, 2).setValue(X.EXAMPLE_ID); cSh.getRange(cr + 1, 11).setValue('https://t.me/sdelka77/78');
cSh.getRange(cr + 2, 2).setValue(X.EXAMPLE_ID); cSh.getRange(cr + 2, 11).setValue('https://youtube.com/shorts/abcdefghijk');
const s1 = X.refreshSocialStats_();
console.log('social:', JSON.stringify(s1), X.readTable_('CONT').rows.slice(-3).map(r => r.views).join(','));
const tk = X.readTable_('TASK').rows.find(r => r.cal_event);
const tkSh = X.sheet_('TASK');
tkSh.getRange(tk._row, X.fieldIndex_('TASK', 'status')).setValue('Выполнено');
const tk2 = X.readTable_('TASK').rows.filter(r => r.cal_event)[1];
tkSh.getRange(tk2._row, X.fieldIndex_('TASK', 'status')).setValue('Отменено');
const c3 = X.syncCalendar_();
console.log('calendar 3:', JSON.stringify(c3), EV[tk.cal_event].title.slice(0, 2), !EV[tk2.cal_event]);

// Instagram / Threads
console.log('not connected:', JSON.stringify(X.socialStatus()));
console.log('bad token:', X.saveSocialTokens('IGBAD', '').msg);
console.log('save:', X.saveSocialTokens('IGAAtoken', 'THAAtoken').msg);
const r0 = X.lastDataRow_(cSh, X.sheetSpecs_().CONT) + 1;
[['https://www.instagram.com/reel/REEL1abc/?igsh=xx'], ['https://instagram.com/p/POST2/'], ['https://www.instagram.com/reel/NOTMINE1/'], ['https://www.threads.com/@nata.broker/post/THR1']].forEach((l, i) => {
  cSh.getRange(r0 + i, 2).setValue(X.EXAMPLE_ID); cSh.getRange(r0 + i, 11).setValue(l[0]);
});
const s2 = X.refreshSocialStats_();
const last4 = X.readTable_('CONT').rows.slice(-4).map(r => [r.views, r.reach, r.saves].join('/'));
console.log('social2:', JSON.stringify({ ig: s2.ig, th: s2.th, notFound: s2.notFound, failed: s2.failed }), last4.join(' | '));
PSTORE.IG_TOKEN_TS = String(Date.now() - 8 * 86400000);
X.refreshSocialStats_();
console.log('token refreshed:', PSTORE.IG_TOKEN === 'REFRESHED', FETCHED.some(u => u.indexOf('ig_refresh_token') > 0));
const before = X.readTable_('CONT').rows.length;
const s3 = X.refreshSocialStats_();
const newRows = X.readTable_('CONT').rows.slice(before);
console.log('threads import:', s3.imported, 'unmatched', s3.unmatched, newRows.map(r => r.obj_id + ':' + r.topic.slice(0, 20) + ':' + r.status).join(' | '));
const s4 = X.refreshSocialStats_();
console.log('threads import again (no dups):', s4.imported === 0);
console.log('removed:', JSON.stringify(X.removeSocialTokens()));
// CRM
console.log('phones:', X.phoneFromText_('ЛПР Анна +7 (925) 111-22-33, info@x.ru'), X.phoneFromText_('8 925 111 22 33'), X.phoneFromText_('нет'));
console.log('crm save:', JSON.stringify(X.saveCrmSettings('KEY123', '42', '+7 925 111-22-33')));
const bSh = X.sheet_('BASE');
const bRows = X.readTable_('BASE').rows;
const b1 = bRows[0], b2 = bRows[1], b3 = bRows[2];
bSh.getRange(b1._row, X.fieldIndex_('BASE', 'contact')).setValue('ЛПР: +7 925 111-22-33');
bSh.getRange(b2._row, X.fieldIndex_('BASE', 'contact')).setValue('8 (999) 000-00-01');
[b1, b2, b3].forEach(b => bSh.getRange(b._row, X.fieldIndex_('BASE', 'to_crm')).setValue(true));
X.onEditHandler({ range: bSh.getRange(b1._row, X.fieldIndex_('BASE', 'to_crm'), 3, 1), user: null });
const after = X.readTable_('BASE').rows.slice(0, 3).map(r => r.crm_note);
console.log('crm notes:', after.join(' | '));
console.log('note text ok:', NOTES.length === 1 && /Лермонтовская|ЖК Время/.test(NOTES[0] || '') || NOTES.length);
X.crmSendPending();
console.log('after pending:', X.readTable_('BASE').rows.slice(2, 3).map(r => r.crm_note).join(''));
console.log('imported rows:', X.readTable_('CONT').rows.filter(r => r.author === 'Threads (автоимпорт)').map(r => [r.obj_id, r.platform, r.status, r.link.slice(-4), r.owner, r.topic].join(' / ')).join(' || '));
// пример дозагружается без дублей
const cnt = () => ['TASK', 'BASE', 'CONT'].map(c => X.readTable_(c).rows.filter(r => r.obj_id === X.EXAMPLE_ID).length).join('/');
const c0 = cnt(); X.loadExample_(); console.log('example resume no dups:', c0 === cnt(), c0);

// документы объекта из папки на Диске
const exObj = X.objectById_(X.EXAMPLE_ID);
const nFiles = X.fillObjectFiles_(tab, exObj);
const LL = X.objTabLayout_({});
const fr = tab.getRange(LL.pos.FILES.first, 3, 3, 3).getValues().map(r => r.join(' | '));
console.log('files:', nFiles, fr.join(' || '), '| folder:', X.objectById_(X.EXAMPLE_ID).folder_link, '| analysis:', tab.getRange(LL.pos.PRICE.items.analysis_link, 3).getValue());
console.log('subfolders not added to existing folder:', TIME.subs.length === 1);
// видимость: продан → скрыта
X.sheet_('OBJ').getRange(exObj._row, X.fieldIndex_('OBJ', 'status')).setValue('Продан');
console.log('hidden:', X.applyTabVisibility_());

// оборванная строка (ID без данных) удаляется
const tSh2 = X.sheet_('TASK'); const orow = X.lastDataRow_(tSh2, X.sheetSpecs_().TASK) + 1;
tSh2.getRange(orow, 1).setValue('TASK-9999');
console.log('orphan removed:', X.removeOrphanRows_('TASK') === 1, !X.readTable_('TASK').rows.some(r => r.id === 'TASK-9999'));
// загрузка объектов списком
const imp = [
  'ID\tНазвание\tТип\tСделка\tАдрес\tПлощадь\tЦена\tСтатус',
  '4801\tКП Остров, дом 450\tЗагородный дом\tПродажа\tМО, КП Остров, уч. 12\t450,5\t185 000 000\tВ работе',
  '4802\tОсобняк Остоженка\tОсобняк\tАренда\tМосква, Остоженка 7\t900\t3500000\tПодготовка',
  '4777\tОсобняк на Остоженке\t\t\tМосква, Остоженка 5',
  '\tБез ID',
  '4803\tСтранный тип\tЯхта',
].join('\n');
const pv2 = X.previewObjectsImport(imp);
console.log('import preview:', pv2.add, pv2.upd, pv2.errors.length, pv2.errors.join(' / '));
console.log(X.runObjectsImport(imp));
const o4801 = X.objectById_('4801');
console.log('4801:', o4801.area, o4801.price, o4801.kind, o4801.status, !!o4801.tab_url, '| 4777 address:', X.objectById_('4777').address);

// папка «Входящие»
console.log('names:', JSON.stringify(X.parseInboxName_('4801 — Остров, дом 450.pdf')), JSON.stringify(X.parseInboxName_('Презентация ЖК Время (1).pptx')));
const ib = X.processInbox_();
console.log('inbox:', ib.done.join(' | '), '| errors:', ib.errors.join(';'), '| created:', ib.created);
['НОВ-001', 'НОВ-002'].forEach(id => { const o = X.objectById_(id); console.log(id, o && [o.name, o.kind, o.deal, o.address, o.area, o.price, o.status, !!o.tab_url].join(' / ')); });
console.log('files moved:', F1.where, F2.where, F3.where, 'inbox left:', INBOX.files.length, 'tmp trashed:', TRASHED.length);
console.log('guess:', JSON.stringify(X.guessObjectInfo_('КП «Остров»\nМосковская обл., Истринский р-н, КП Остров, уч. 12\nДом 450,5 м² на участке 25 соток\nСтоимость: 185 000 000 ₽\nЦена за м²: 410 000 ₽\nПродажа')));
console.log('guess2:', JSON.stringify(X.guessObjectInfo_('ЖК Время\nг. Москва, ул. Лермонтовская, д.1\nПомещение 756,2 кв.м\n225,5 млн ₽\n298 000 ₽/м²')));
