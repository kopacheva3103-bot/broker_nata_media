// Личные кабинеты: роли и права, чтение, создание и правка записей через автоматику системы.
const { loadGs } = require('./load_gs.js');
const { makeSS } = require('./mock_ss.js');
const M = makeSS();
const PSTORE = {};
const PROPS = { getProperty: k => (k in PSTORE ? PSTORE[k] : null), setProperty: (k, v) => { PSTORE[k] = v; }, deleteProperty: k => { delete PSTORE[k]; } };
let ME = 'boss@example.com';
const X = loadGs({
  SpreadsheetApp: M.SpreadsheetApp,
  Utilities: { sleep: () => {}, formatDate: (d, tz, p) => { const z = n => String(n).padStart(2, '0'); return (p || 'dd.MM.yyyy').replace('yyyy', d.getFullYear()).replace('MM', z(d.getMonth() + 1)).replace('dd', z(d.getDate())).replace('HH', z(d.getHours())).replace('mm', z(d.getMinutes())); } },
  Session: { getActiveUser: () => ({ getEmail: () => ME }), getEffectiveUser: () => ({ getEmail: () => ME }) },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
  PropertiesService: { getScriptProperties: () => PROPS, getDocumentProperties: () => PROPS },
  Logger: { log: () => {} },
});
let fails = 0;
const ok = (n, c, i) => { console.log((c ? '✓ ' : '✗ ') + n + (i !== undefined ? ' — ' + i : '')); if (!c) fails++; };
X.runSetup_([]);
// команда
const pc = X.dictLayout_().people.col;
X.sheet_('DICT').getRange(2, pc, 5, 3).setValues([['Наталья', 'Руководитель', 'boss@example.com'], ['Ассистент', 'Ассистент', 'asst@example.com'], ['SMM', 'SMM-специалист', 'smm@example.com'], ['Иван', 'Агент', 'agent@example.com'], ['', '', '']]);
// объекты: два директора, один агента
X.appendRow_('OBJ', { id: '1001', name: 'Объект директора', manager: 'Наталья', assistant: 'Ассистент', status: 'В работе' });
X.appendRow_('OBJ', { id: '1002', name: 'Объект без ответственного', status: 'В работе' });
X.appendRow_('OBJ', { id: '2001', name: 'Объект агента', manager: 'Иван', status: 'В работе' });
const ids = u => { ME = u; return X.webBootstrap().objects.map(o => o.id).sort().join(','); };
ok('директор видит всё', ids('boss@example.com') === '1001,1002,2001', ids('boss@example.com'));
ok('ассистент — объекты директора', ids('asst@example.com') === '1001,1002', ids('asst@example.com'));
ok('агент — только свои', ids('agent@example.com') === '2001', ids('agent@example.com'));
ok('SMM — все объекты', ids('smm@example.com') === '1001,1002,2001');
ME = 'stranger@example.com'; let err = ''; try { X.webBootstrap(); } catch (e) { err = e.message; }
ok('чужой — нет доступа', /Нет доступа/.test(err), err.slice(0, 60));
// ассистент создаёт задачу и компанию
ME = 'asst@example.com';
const t = X.webCreate('TASK', { obj_id: '1001', task: 'Обзвонить 10 компаний', deadline: '2026-10-07', plan: '10', unit: '' });
ok('ассистент создал задачу с ID', /^TASK-/.test(String(t.id)), t.id);
const tr = X.readTable_('TASK').rows.find(r => r.id === t.id);
ok('задача: исполнитель = ассистент, неделя по сроку, статус по умолчанию', tr.owner === 'Ассистент' && tr.week === '2026-W41' && tr.status === 'Запланировано', [tr.owner, tr.week, tr.status].join(' / '));
err = ''; try { X.webCreate('TASK', { obj_id: '2001', task: 'чужое' }); } catch (e) { err = e.message; }
ok('ассистент не может создать задачу на объект агента', /Нет прав/.test(err));
const b = X.webCreate('BASE', { obj_id: '1001', company: 'ООО Тест', contact: 'директор, +7 000', audience: 'Сети' });
X.webUpdate('BASE', b.id, { call_date: '2026-10-05', call_result: 'Попросили КП', kp_date: '2026-10-05', kp_type: 'КП клиенту', response: 'Интересно', next_step: 'Показ', next_date: '2026-10-08' });
const br = X.readTable_('BASE').rows.find(r => r.id === b.id);
ok('база: звонок, КП, ответ (+дата ответа сама), следующий шаг', br.call_result === 'Попросили КП' && br.kp_type === 'КП клиенту' && br.response === 'Интересно' && br.response_date instanceof X.today_().constructor && br.next_step === 'Показ', [br.response, X.fmtDate_(br.response_date)].join(' '));
ok('история пишется', X.readTable_('HIST').rows.some(h => h.record_id === b.id && /Ответ/.test(h.field)));
// перенос задачи из кабинета → копия на следующую неделю
X.webUpdate('TASK', t.id, { status: 'Перенесено', result: 'Не успели' });
const moved = X.readTable_('TASK').rows.filter(r => r.task === 'Обзвонить 10 компаний');
ok('«Перенесено» создаёт копию на следующую неделю', moved.length === 2 && moved.some(r => r.week === '2026-W42'), moved.map(r => r.week + ':' + r.status).join(', '));
// агент не видит базу директора, SMM — базу вообще
ME = 'agent@example.com'; ok('агент не видит базу директора', X.webBase('').length === 0);
err = ''; try { X.webUpdate('BASE', b.id, { next_step: 'взлом' }); } catch (e) { err = e.message; }
ok('агент не может править чужую базу', /Нет прав/.test(err));
ME = 'smm@example.com'; ok('SMM не видит базу', X.webBase('').length === 0);
const c = X.webCreate('CONT', { obj_id: '2001', topic: 'Рилс про объект', platform: 'Instagram', format: 'Рилс' });
X.webUpdate('CONT', c.id, { status: 'Опубликовано', link: 'https://example.com/p/1', views: '1500' });
const cr = X.readTable_('CONT').rows.find(r => r.id === c.id);
ok('SMM: контент по любому объекту, дата публикации ставится сама', cr.views === 1500 && cr.link && (cr.pub_date instanceof X.today_().constructor || cr.status !== 'Опубликовано'), [cr.status, cr.views, X.fmtDate_(cr.pub_date)].join(' / '));
err = ''; try { X.webCreate('TASK', { obj_id: '1001', task: 'x' }); } catch (e) { err = e.message; }
ok('SMM не создаёт задачи по чужим объектам', /Нет прав/.test(err));
ok('SMM: в задачах только свои', X.webTasks().every(x => x.owner === 'SMM'));
// директор: команда и карточка объекта
ME = 'boss@example.com';
const team = X.webTeam();
ok('директор: сводка по команде и объектам', team.team.length >= 4 && team.objects.length === 3, team.team.map(p => p.name + ':' + p.open).join(', '));
ok('карточка объекта читается', !!X.webObject('1001').strategy);
ME = 'asst@example.com'; err = ''; try { X.webTeam(); } catch (e) { err = e.message; }
ok('«Команда» только директору', /только директору/.test(err));
ok('ассистент видит задачи по объектам директора', X.webTasks().some(x => x.obj_id === '1001'));
console.log(fails ? 'FAILED: ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
