// Прогон установки, примера и плана недели на заглушке SpreadsheetApp — ловит ошибки выполнения JS до Apps Script.
const { loadGs } = require('./load_gs.js');
const { makeSS } = require('./mock_ss.js');
const M = makeSS();
const pad = n => String(n).padStart(2, '0');
const X = loadGs({
  SpreadsheetApp: M.SpreadsheetApp,
  Utilities: { formatDate: (d, tz, p) => p.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate())).replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())) },
  Session: { getActiveUser: () => ({ getEmail: () => 'test@example.com' }), getEffectiveUser: () => ({ getEmail: () => '' }) },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
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
