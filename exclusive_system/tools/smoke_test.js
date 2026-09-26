// Прогон установки, примера и плана недели на заглушке SpreadsheetApp — ловит ошибки выполнения JS до Apps Script.
const { loadGs } = require('./load_gs.js');
const { makeSS } = require('./mock_ss.js');
const M = makeSS();
const EV = {}; let evN = 0;
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
  Utilities: { formatDate: (d, tz, p) => p.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate())).replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())) },
  Session: { getActiveUser: () => ({ getEmail: () => 'test@example.com' }), getEffectiveUser: () => ({ getEmail: () => 'boss@example.com' }) },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
  UrlFetchApp: { fetch: (u) => ({ getContentText: () => u.indexOf('/77?') > 0 ? '<span class="tgme_widget_message_views">1.2K</span>' : '<span class="tgme_widget_message_views">845</span>' }) },
  CalendarApp: { getDefaultCalendar: () => CAL },
});
const log = [];
X.runSetup_(log);
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
