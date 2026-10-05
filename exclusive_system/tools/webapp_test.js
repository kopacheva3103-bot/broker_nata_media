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
  DocumentApp: { ParagraphHeading: { TITLE: 'T', HEADING1: 'H1', HEADING2: 'H2' }, create: name => { const paras = []; const P = t => { const p = { t, setText: x => { p.t = x; return p; }, setHeading: () => p }; paras.push(p); return p; };
    const body = { getParagraphs: () => [paras[0] || P('')], appendParagraph: t => P(t), appendListItem: t => P('• ' + t), appendTable: rows => { paras.push({ t: 'TABLE ' + rows.length }); return { getRow: () => ({ getNumCells: () => 1, getCell: () => ({ editAsText: () => ({ setBold: () => {} }) }) }) }; }, findText: () => null };
    DOCS.push({ name, paras }); return { getId: () => 'DOC' + DOCS.length, getBody: () => body, getUrl: () => 'https://docs/' + DOCS.length, saveAndClose: () => {} }; }, openById: () => ({ getBody: () => ({ findText: () => null }) }) },
});
const DOCS = [];
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
// SMM: общий контент по рубрикам, кросспостинг, статистика аккаунтов, аналитика, выгрузка
ME = 'smm@example.com';
X.ensureAgencyObject_ && X.ensureAgencyObject_();
const ag = X.webBootstrap().objects.find(o => o.service);
ok('SMM видит «Общий контент агентства»', !!ag);
const cc = X.webCreateContent({ obj_id: ag.id, topic: 'Как выбрать район', rubric: '#Полезное', platforms: ['Instagram', 'Telegram'], format: 'Рилс', pub_date: '2026-10-02' });
ok('одна тема на 2 площадки — 2 публикации', cc.ids.length === 2);
cc.ids.forEach((id, i) => X.webUpdate('CONT', id, { status: 'Опубликовано', views: String(1000 * (i + 1)), reach: String(800 * (i + 1)), likes: '50', saves: '10' }));
const c2 = X.webCreateContent({ obj_id: '2001', topic: 'Обзор объекта', rubric: '#Эксклюзив', platforms: ['ВКонтакте'], format: 'Пост', pub_date: '2026-10-03' });
X.webUpdate('CONT', c2.ids[0], { status: 'Опубликовано', views: '300', reach: '200', leads: '2' });
X.webSocialSave({ week: '2026-W38', platform: 'Telegram', account: '@channel', followers: '1000' });
X.webSocialSave({ week: '2026-W40', platform: 'Telegram', followers: '1150', reach: '5000' });
X.webSocialSave({ week: '2026-W40', platform: 'Telegram', followers: '1200' });
ok('статистика недели: повторный ввод обновляет строку, а не дублирует', X.webSocial().filter(r => r.week === '2026-W40').length === 1);
const A = X.webSmmAnalytics('2026-09-21', '2026-10-05');
ok('аналитика: публикации и охват', A.totals.posts === 4 && A.totals.reach === 2600, A.totals.posts + ' / ' + A.totals.reach);
ok('аналитика: рубрики по охвату', A.byRubric[0].name === '#Полезное' && A.byRubric[0].avgReach === 1200, A.byRubric.map(x => x.name + ':' + x.avgReach).join(', '));
ok('аналитика: рост подписчиков', A.followers.find(f => f.platform === 'Telegram').growth === 200 && A.followers.find(f => f.platform === 'Telegram').account === '@channel', JSON.stringify(A.followers[0]));
ok('аналитика: общий контент отдельно', A.byObject.some(x => x.name === 'Общий контент агентства'));
ok('выводы сформулированы', A.insights.length >= 2, A.insights[0]);
const rep = X.webSmmReport('2026-09-21', '2026-10-05'), plan = X.webContentPlanDoc('2026-09-28', '2026-10-12');
ok('отчёт SMM и контент-план выгружаются в документ', /docs/.test(rep.url) && /export\?format=docx/.test(rep.word) && /docs/.test(plan.url), DOCS.map(d => d.name).join(' | '));
// привязка общего поста к объекту
ME = 'smm@example.com';
X.webUpdate('CONT', cc.ids[0], { obj_id: '2001' });
ok('SMM привязала пост к объекту — он в карточке объекта', X.webContent('2001').some(x => x.id === cc.ids[0]));
ok('общий пост без привязки остался общим', X.webContent(ag.id).some(x => x.id === cc.ids[1]));
ok('история: смена объекта записана', X.readTable_('CONT').rows.find(r => r.id === cc.ids[0]).obj_id === '2001');
ME = 'asst@example.com'; err = ''; try { X.webUpdate('CONT', X.webContent('1001')[0] ? X.webContent('1001')[0].id : cc.ids[1], { obj_id: '2001' }); } catch (e) { err = e.message; }
ok('ассистент не может перепривязать контент на объект агента', /Нет прав/.test(err), err);
ME = 'boss@example.com';
const T2 = X.webTeam();
ok('директор: блок SMM за неделю (по объектам и общий)', T2.smm && typeof T2.smm.general === 'number', JSON.stringify(T2.smm).slice(0, 120));
ok('письмо руководителю: блок SMM', /SMM за неделю/.test(X.smmMailBlock_('2026-W40')), X.smmMailBlock_('2026-W40').slice(0, 120));
// рубрики-хэштеги, нормы частоты, воронка, план на 2 недели: заполнение по нормам, перенос, дублирование
ok('норма: «Раз в 2 недели» = 0.5 в неделю, «2 раза в неделю» = 2, «По поводу» — без нормы',
  X.rubricPerWeek_('Раз в 2 недели') === 0.5 && X.rubricPerWeek_('2 раза в неделю') === 2 && X.rubricPerWeek_('По поводу') === 0 && X.rubricPerWeek_('Каждую неделю') === 1);
ME = 'smm@example.com';
ok('воронка по умолчанию из рубрики', X.readTable_('CONT').rows.find(r => r.id === c2.ids[0]).funnel === 'Продажа / заявки', X.readTable_('CONT').rows.find(r => r.id === c2.ids[0]).funnel);
const N0 = X.webSmmNorms('2026-10-05', '2026-10-18');
ok('нормы на 2 недели: еженедельная рубрика = 2, раз в 2 недели = 1', N0.rubrics.find(x => x.name === '#Отзывы').need === 2 && N0.rubrics.find(x => x.name === '#Кейсы').need === 1, JSON.stringify(N0.rubrics.slice(0, 3)));
const fill = X.webPlanFill('2026-10-05', '2026-10-18');
const N1 = X.webSmmNorms('2026-10-05', '2026-10-18');
ok('«Заполнить по нормам» закрывает все нормы', fill.made > 0 && N1.rubrics.every(x => x.gap === 0), fill.made + ' / ' + JSON.stringify(N1.rubrics.filter(x => x.gap)));
ok('повторное заполнение ничего не дублирует', X.webPlanFill('2026-10-05', '2026-10-18').made === 0);
const isD = v => Object.prototype.toString.call(v) === '[object Date]';
const ideas = X.readTable_('CONT').rows.filter(r => /^✎/.test(r.topic) && isD(r.pub_date));
ok('заготовки без воскресений и с этапом воронки', ideas.length === fill.made && ideas.every(r => r.pub_date.getDay() !== 0 && r.funnel), ideas.map(r => r.pub_date.getDay() + ':' + r.funnel).slice(0, 5).join(','));
ok('закрытый канал — своя площадка', ideas.filter(r => /^ЗК/.test(r.rubric)).every(r => r.platform === 'Telegram (закрытый канал)'));
const p0 = ideas[0];
const xp = X.webCrosspost(p0.id, ['Instagram', 'ВКонтакте', 'Telegram']);
ok('дублирование на площадки (без повтора уже имеющейся)', xp.ids.length === (p0.platform === 'Telegram' ? 2 : 3), xp.ids.length + ' ' + p0.platform);
const grp = [p0.id].concat(xp.ids);
X.webMoveContent(grp, '2026-10-16');
ok('перенос темы со всеми площадками', X.readTable_('CONT').rows.filter(r => grp.indexOf(r.id) >= 0).every(r => X.fmtDate_(r.pub_date, 'yyyy-MM-dd') === '2026-10-16'));
ok('нормы: одна тема на 3 площадках = 1 тема', X.webSmmNorms('2026-10-05', '2026-10-18').topics === N1.topics);
const A2 = X.webSmmAnalytics('2026-09-21', '2026-10-05');
ok('аналитика: этапы воронки и нормы', Array.isArray(A2.byFunnel) && A2.norms && A2.norms.rubrics.length > 10);
X.webSocialSave({ week: '2026-W40', platform: 'Telegram', unfollows: '12', shares: '40' });
ok('соцсети: отписки и пересылки', X.webSocial().find(r => r.week === '2026-W40' && r.platform === 'Telegram').unfollows === 12);
X.webSmmReport('2026-09-21', '2026-10-05'); X.webContentPlanDoc('2026-10-05', '2026-10-18');
ME = 'asst@example.com'; err = ''; try { X.webPlanFill('2026-10-05', '2026-10-18'); } catch (e) { err = e.message; }
ok('заполнение по нормам — только SMM и директор', /SMM и директору/.test(err));
ME = 'asst@example.com'; err = ''; try { X.webSmmAnalytics(); } catch (e) { err = e.message; }
ok('аналитика SMM недоступна ассистенту', /SMM и директору/.test(err));
console.log(fails ? 'FAILED: ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
