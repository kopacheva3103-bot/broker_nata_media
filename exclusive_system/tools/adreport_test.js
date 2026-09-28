// Отчёт по рекламе CRM: старая раскладка 01_ОБЪЕКТЫ → установка (столбец в конце, починка сдвига) → вставка ссылок → раздел 4 отчёта.
const { loadGs } = require('./load_gs.js');
const { makeSS } = require('./mock_ss.js');
const M = makeSS();
const PSTORE = {};
const PROPS = { getProperty: k => (k in PSTORE ? PSTORE[k] : null), setProperty: (k, v) => { PSTORE[k] = v; }, deleteProperty: k => { delete PSTORE[k]; } };
const AD = { status: 'success', data: {
  stats: { entity_id: 144890621, in_ad_from: '2026-09-24 22:42:45', views_total: 101, favorites: { AVITO: 1, CIAN: 0 }, successful_showing_count: 0, price_total: 510, cian_url: 'https://cian.ru/sale/flat/334249801' },
  sites: [{ uid: 'CIAN', name: 'cian.ru', is_active: true, ads_count: 1, url: 'https://cian.ru/sale/flat/334249801' }, { uid: 'AVITO', name: 'avito.ru', is_active: true, ads_count: 1 },
    { uid: 'ZIPAL', name: 'Zipal', is_active: false, ads_count: 1 }, { uid: 'NOVOSEL', name: 'novosel.ru', is_active: true, ads_count: 1 }],
  config: {}, realty: { owner_phone: [{ phone: 'секрет' }] } } };
const LINK = 'https://crm.topnlab.ru/lk/report/RVk5aUYvTEST0';
const X = loadGs({
  SpreadsheetApp: M.SpreadsheetApp,
  Utilities: { sleep: () => {}, formatDate: d => [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('.') },
  Session: { getActiveUser: () => ({ getEmail: () => 't@e' }), getEffectiveUser: () => ({ getEmail: () => 't@e' }) },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
  UrlFetchApp: { fetch: (u, o) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(u.indexOf('ad-p.topnlab.ru/public/report') >= 0 && JSON.parse(o.payload).hash === 'RVk5aUYvTEST0' ? AD : { status: 'error' }) }) },
  PropertiesService: { getScriptProperties: () => PROPS, getDocumentProperties: () => PROPS },
  Logger: { log: () => {} },
});
let fails = 0;
const ok = (name, cond, info) => { console.log((cond ? '✓ ' : '✗ ') + name + (info !== undefined ? ' — ' + info : '')); if (!cond) fails++; };
X.runSetup_([]);
const sh = X.sheet_('OBJ');
const n = X.sheetSpecs_().OBJ.fields.length;
ok('столбец рекламы — последний в 01_ОБЪЕКТЫ', X.fieldIndex_('OBJ', 'crm_report_link') === n);
X.appendRow_('OBJ', { id: '144890621', name: '12 месяцев' });
X.appendRow_('OBJ', { id: '137073408', name: 'ЖК Время' });
// «старая» таблица: без последнего столбца + строка, испорченная сдвигом
sh.getRange(1, n).setValue('');
const row = 2;
sh.getRange(row, X.fieldIndex_('OBJ', 'last_report_date')).setValue('https://drive.google.com/file/d/PDF1/view');
sh.getRange(row, X.fieldIndex_('OBJ', 'id_check')).setValue(new (X.today_().constructor)(2026, 8, 28));
sh.getRange(row, X.fieldIndex_('OBJ', 'strategy_pct')).setValue('https://drive.google.com/drive/folders/F1');
X.headerGuard_.ok = {};
const log = []; X.runSetup_(log);
ok('установка прошла, заголовок появился', sh.getRange(1, n).getValue() === 'Отчёт по рекламе CRM (ссылка)');
ok('починка сдвига в логе', log.some(x => /сдвига столбцов: 1/.test(x)), log.find(x => /сдвиг/.test(x)));
const o = X.objectById_('144890621');
ok('ссылка на отчёт вернулась в «Последний отчёт»', o.last_report_link === 'https://drive.google.com/file/d/PDF1/view');
ok('дата вернулась в «Дата отчёта»', Object.prototype.toString.call(o.last_report_date) === '[object Date]' && o.last_report_date.getDate() === 28);
ok('«Проверка ID» очищена от даты', !(sh.getRange(row, X.fieldIndex_('OBJ', 'id_check')).getValue() instanceof Date));
ok('«Стратегия заполнена» без ссылки', o.strategy_pct === '');
const res = X.saveAdReportLinks_('вот ' + LINK + ' и мусор https://crm.topnlab.ru/lk/report/BAD1');
ok('вставка ссылок: объект определён сам', /✓ 12 месяцев/.test(res[0]), res.join(' | '));
ok('вставка ссылок: чужая/битая ссылка — предупреждение', /⚠/.test(res[1] || ''), res[1]);
ok('ссылка записана в свой столбец', X.objectById_('144890621').crm_report_link === LINK);
ok('папка объекта не тронута', X.objectById_('144890621').folder_link === '' || !/lk\/report/.test(X.objectById_('144890621').folder_link));
const v = X.addAdStats_({ kv: {} }, X.objectById_('144890621'), '2026-W40');
ok('раздел 4: площадки без неактивных', /площадках \(3\): ЦИАН, Авито, novosel\.ru/.test(v.kv.AD_STATS), v.kv.AD_STATS.split('\n')[0]);
ok('раздел 4: просмотры/избранное/показы/ЦИАН', /Просмотры объявлений: 101/.test(v.kv.AD_STATS) && /избранное: 1/.test(v.kv.AD_STATS) && /Показы объекта: 0/.test(v.kv.AD_STATS) && /cian\.ru/.test(v.kv.AD_STATS));
ok('раздел 4: без телефона собственника и расходов', !/секрет|510/.test(v.kv.AD_STATS));
ok('руководителю — расходы', /510/.test(v.adInner), v.adInner);
AD.data.stats.views_total = 150;
const v2 = X.addAdStats_({ kv: {} }, X.objectById_('144890621'), '2026-W41');
ok('следующая неделя: прирост', /101|150 \(за неделю \+49\)/.test(v2.kv.AD_STATS) && /\+49/.test(v2.kv.AD_STATS), v2.kv.AD_STATS.split('\n')[1]);
X.writeFields_(sh, 'OBJ', 3, { crm_report_link: LINK });
const v3 = X.addAdStats_({ kv: {} }, X.objectById_('137073408'), '2026-W40');
ok('ссылка от другого объекта — раздела нет, руководителю ⚠', v3.kv.AD_STATS === '' && /другого объекта/.test(v3.adInner));
ok('шаблон отчёта содержит раздел 4', /AD_STATS/.test(X.buildReportTemplate_.toString()));
// защита от сдвига: заголовок не совпадает → понятная ошибка вместо записи в чужой столбец
sh.getRange(1, X.fieldIndex_('OBJ', 'folder_link')).setValue('Что-то другое');
X.headerGuard_.ok = {};
let err = ''; try { X.readTable_('OBJ'); } catch (e) { err = e.message; }
ok('защита: при несовпадении столбцов — просьба запустить установку', /Установить \/ обновить систему/.test(err), err);
console.log(fails ? 'FAILED: ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
