/**
 * 28_AdReport — раздел отчёта клиенту «Реклама на площадках» из отчёта по рекламе TopenLab.
 * Ссылка на отчёт (crm.topnlab.ru/lk/report/…) вставляется в 01_ОБЪЕКТЫ → «Отчёт по рекламе CRM (ссылка)».
 * Система сама берёт оттуда площадки, просмотры, избранное, показы и ссылку на ЦИАН. Саму ссылку клиенту не отправляем.
 * Цифры в CRM — накопительные с начала рекламы; «за неделю» считается по снимку прошлой недели.
 */

const AD_REPORT_API = 'https://ad-p.topnlab.ru/public/report';
const AD_SITE_NAMES = { CIAN: 'ЦИАН', AVITO: 'Авито', YANDEX: 'Яндекс Недвижимость', BANK: 'Домклик' };

function adReportHash_(url) {
  const m = /\/report\/([A-Za-z0-9=_%-]+)/.exec(String(url || ''));
  return m ? decodeURIComponent(m[1]) : '';
}

/** Данные отчёта по рекламе. Из ответа берём только цифры и площадки (там есть и лишние данные — не сохраняем). */
function fetchAdReport_(url) {
  const hash = adReportHash_(url);
  if (!hash) return null;
  const r = UrlFetchApp.fetch(AD_REPORT_API, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ active_only: true, paid_sites: true, partner_sites: true, hash: hash, period: -1 }),
  });
  if (r.getResponseCode() !== 200) throw new Error('отчёт по рекламе CRM: код ' + r.getResponseCode());
  const j = JSON.parse(r.getContentText());
  if (j.status !== 'success' || !j.data || !j.data.stats) throw new Error('отчёт по рекламе CRM: нет данных');
  return adStatsFrom_(j.data);
}

function adStatsFrom_(d) {
  const st = d.stats || {}, cfg = d.config || {};
  const num = x => Number(x) || 0;
  const sum = o => Object.keys(o || {}).reduce((s, k) => s + num(o[k]), 0);
  const order = ['CIAN', 'AVITO', 'YANDEX', 'BANK'];
  const sites = (d.sites || []).filter(s => s.is_active && num(s.ads_count) > 0)
    .sort((a, b) => {
      const ia = order.indexOf(a.uid), ib = order.indexOf(b.uid);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a.name).localeCompare(String(b.name));
    })
    .map(s => AD_SITE_NAMES[s.uid] || (String(s.name).indexOf('.') > 0 ? s.name : String(s.url_base || s.name).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')))
    .filter((x, i, a) => x && a.indexOf(x) === i);
  const cianSite = (d.sites || []).find(s => s.uid === 'CIAN' && s.url);
  const since = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(st.in_ad_from || ''));
  return {
    entity: String(st.entity_id || ''),
    since: since ? new Date(Number(since[1]), Number(since[2]) - 1, Number(since[3])) : null,
    views: 'manual_total_views' in cfg ? num(cfg.manual_total_views) : num(st.views_total),
    fav: 'manual_total_favorites' in cfg ? num(cfg.manual_total_favorites) : sum(st.favorites),
    shows: 'manual_successful_showing_count' in cfg ? num(cfg.manual_successful_showing_count) : num(st.successful_showing_count),
    sites: sites,
    cian: st.cian_url || (cianSite ? cianSite.url : ''),
    spend: num(st.price_total),
  };
}

/** Строки раздела для клиента + строка для руководителя. Снимок цифр недели сохраняется для расчёта «за неделю». */
function adReportPart_(obj, wk) {
  if (!obj || !obj.crm_report_link) return null;
  const a = fetchAdReport_(obj.crm_report_link);
  if (!a) return null;
  if (a.entity && isCrmId_(obj.id) && a.entity !== String(obj.id)) {
    throw new Error('ссылка на отчёт по рекламе от другого объекта CRM (' + a.entity + '), а у объекта ID ' + obj.id);
  }
  const props = PropertiesService.getDocumentProperties();
  const key = 'AD_SNAP_' + obj.id;
  let snaps = {};
  try { snaps = JSON.parse(props.getProperty(key) || '{}'); } catch (e) { snaps = {}; }
  const prevWk = Object.keys(snaps).filter(k => k < wk).sort().pop();
  const prev = prevWk ? snaps[prevWk] : null;
  snaps[wk] = { v: a.views, f: a.fav, s: a.shows };
  Object.keys(snaps).sort().slice(0, -26).forEach(k => delete snaps[k]);
  props.setProperty(key, JSON.stringify(snaps));
  const fmt = n => Number(n).toLocaleString('ru-RU');
  const plus = (cur, k) => prev ? ' (за неделю +' + fmt(Math.max(0, cur - (prev[k] || 0))) + ')' : '';
  const client = [
    a.sites.length ? 'Объявление размещено' + (a.since ? ' с ' + fmtDate_(a.since) : '') + ' на площадках (' + a.sites.length + '): ' + a.sites.join(', ') : '',
    'Просмотры объявлений: ' + fmt(a.views) + plus(a.views, 'v'),
    'Добавили в избранное: ' + fmt(a.fav) + plus(a.fav, 'f'),
    'Показы объекта: ' + fmt(a.shows) + plus(a.shows, 's'),
    a.cian ? 'Объявление на ЦИАН: ' + a.cian : '',
  ].filter(Boolean);
  return { lines: client, inner: 'Реклама: просмотры ' + fmt(a.views) + ', избранное ' + fmt(a.fav) + ', показы ' + fmt(a.shows) + (a.spend ? ', расходы на площадки ' + fmt(a.spend) + ' ₽' : '') };
}

/** Раздел «Реклама на площадках» в значения отчёта (ошибка — раздел просто не выводится). */
function addAdStats_(values, obj, wk) {
  values.kv.AD_STATS = '';
  try {
    const p = adReportPart_(obj, wk);
    if (p) { values.kv.AD_STATS = p.lines.join('\n'); values.adInner = p.inner; }
  } catch (e) {
    values.adInner = '⚠ ' + e.message;
    Logger.log('Реклама ' + (obj && obj.id) + ': ' + e.message);
  }
  return values;
}

/** Меню: проверить ссылки на отчёты по рекламе у всех объектов. */
function checkAdReports() {
  const out = [];
  readTable_('OBJ').rows.filter(o => o.id && o.name && !isServiceObject_(o)).forEach(o => {
    if (!o.crm_report_link) { out.push('— ' + o.name + ': ссылки нет'); return; }
    try {
      const a = fetchAdReport_(o.crm_report_link);
      if (a.entity && isCrmId_(o.id) && a.entity !== String(o.id)) out.push('⚠ ' + o.name + ': ссылка от другого объекта CRM (' + a.entity + ')');
      else out.push('✓ ' + o.name + ': площадок ' + a.sites.length + ', просмотры ' + a.views + ', избранное ' + a.fav + ', показы ' + a.shows + (a.cian ? ', ЦИАН есть' : ', ЦИАН нет'));
    } catch (e) { out.push('⚠ ' + o.name + ': ' + e.message); }
  });
  SpreadsheetApp.getUi().alert('Отчёты по рекламе CRM', out.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}
