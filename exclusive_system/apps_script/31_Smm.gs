/**
 * 31_Smm — кабинет SMM: контент-план по рубрикам (объекты на эксклюзиве и общий контент агентства),
 * статистика аккаунтов по неделям (11_СОЦСЕТИ), аналитика за период и выгрузка отчёта / контент-плана в Google Документ.
 * Общий контент компании ведётся на служебном объекте «Агентство» (АГЕНТСТВО) с рубрикой.
 * Доступ: SMM и директор.
 */

function webSmmUser_() {
  const u = webUser_();
  if (u.role !== 'smm' && u.role !== 'director') throw new Error('Раздел доступен SMM и директору');
  return u;
}

function smmNum_(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function smmRange_(from, to) {
  const p = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null; };
  const t = p(to) || today_();
  const f = p(from) || addDays_(t, -29);
  return { from: f, to: t, fromWk: isoWeekKey_(f), toWk: isoWeekKey_(t) };
}

/** Несколько публикаций за раз — одна тема на несколько площадок (кросспостинг). */
function webCreateContent(data) {
  const plats = (data && data.platforms && data.platforms.length ? data.platforms : [data && data.platform]).filter(Boolean);
  if (!plats.length) throw new Error('Выберите площадку');
  const ids = plats.map(p => webCreate('CONT', Object.assign({}, data, { platform: p, platforms: undefined })).id);
  return { ok: true, ids: ids };
}

/** Статистика аккаунтов: последние 26 недель. */
function webSocial() {
  webSmmUser_();
  const from = isoWeekKey_(addDays_(today_(), -7 * 26));
  return readTable_('SOC').rows.filter(r => r.id && r.platform && String(r.week) >= from)
    .map(r => webRow_(r, ['id', 'week', 'platform', 'account', 'followers', 'reach', 'views', 'profile_visits', 'leads', 'note']));
}

/** Сохранить неделю по площадке: есть строка (неделя + площадка) — обновить, нет — создать. */
function webSocialSave(rec) {
  const u = webSmmUser_();
  if (!rec || !rec.platform) throw new Error('Выберите площадку');
  const wk = rec.week || isoWeekKey_(today_());
  const keys = ['account', 'followers', 'reach', 'views', 'profile_visits', 'leads', 'note'];
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const t = readTable_('SOC');
    const r = t.rows.find(x => x.week === wk && x.platform === rec.platform);
    if (r) {
      const upd = {};
      keys.forEach(k => { if (rec[k] !== undefined) upd[k] = webParse_('SOC', k, rec[k]); });
      writeFields_(t.sh, 'SOC', r._row, upd);
      return { ok: true, id: r.id };
    }
    const o = { week: wk, platform: rec.platform };
    keys.forEach(k => { if (rec[k] !== undefined && rec[k] !== '') o[k] = webParse_('SOC', k, rec[k]); });
    const row = appendRow_('SOC', o);
    processEditedRows_(t.sh, t.spec, row, row, 1, t.spec.fields.length, { user: null });
    logHistory_([{ sheet: SHEET_NAMES.SOC, record_id: wk, obj_id: '', field: rec.platform, old: '', new: 'подписчики ' + (o.followers || ''), kind: HIST_KIND.CREATE }], u.email);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Аналитика SMM за период: итоги, площадки, рубрики, объекты, топ публикаций, подписчики, выводы. */
function webSmmAnalytics(from, to) {
  webSmmUser_();
  return smmAnalytics_(from, to);
}

function smmAnalytics_(from, to) {
  const R = smmRange_(from, to);
  const objs = {};
  readTable_('OBJ').rows.forEach(o => { if (o.id) objs[String(o.id)] = o; });
  const done = r => { try { return dictClassOf_('content_status', r.status) === CLS.DONE; } catch (e) { return false; } };
  const posts = readTable_('CONT').rows.filter(r => r.id && r.pub_date instanceof Date && r.pub_date >= R.from && r.pub_date <= R.to && done(r));
  const metric = ['views', 'reach', 'likes', 'comments', 'saves', 'shares', 'leads', 'followers_gained'];
  const sum = list => {
    const s = { posts: list.length };
    metric.forEach(k => { s[k] = list.reduce((a, r) => a + smmNum_(r[k]), 0); });
    const withReach = list.filter(r => smmNum_(r.reach) > 0);
    const eng = withReach.reduce((a, r) => a + smmNum_(r.likes) + smmNum_(r.comments) + smmNum_(r.saves) + smmNum_(r.shares), 0);
    const rch = withReach.reduce((a, r) => a + smmNum_(r.reach), 0);
    s.avgViews = list.length ? Math.round(s.views / list.length) : 0;
    s.avgReach = list.length ? Math.round(s.reach / list.length) : 0;
    s.er = rch ? Math.round(eng / rch * 1000) / 10 : null; // вовлечённость, % от охвата
    return s;
  };
  const group = keyFn => {
    const g = {};
    posts.forEach(r => { const k = keyFn(r) || '— без рубрики'; (g[k] = g[k] || []).push(r); });
    return Object.keys(g).map(k => Object.assign({ name: k }, sum(g[k]))).sort((a, b) => b.avgReach - a.avgReach || b.avgViews - a.avgViews);
  };
  const objName = id => isServiceObject_(objs[String(id)] || {}) ? 'Общий контент агентства' : ((objs[String(id)] || {}).name || String(id));
  const totals = sum(posts);
  const byPlatform = group(r => r.platform);
  const byRubric = group(r => r.rubric);
  const byFormat = group(r => r.format);
  const byObject = group(r => objName(r.obj_id));
  const top = posts.slice().sort((a, b) => smmNum_(b.views) - smmNum_(a.views) || smmNum_(b.reach) - smmNum_(a.reach)).slice(0, 10)
    .map(r => ({ date: fmtDate_(r.pub_date, 'yyyy-MM-dd'), topic: r.topic, platform: r.platform, rubric: r.rubric || '', object: objName(r.obj_id),
      views: smmNum_(r.views), reach: smmNum_(r.reach), link: r.link || '' }));
  // подписчики и недельная статистика аккаунтов
  const soc = readTable_('SOC').rows.filter(r => r.platform && r.week);
  const plats = {};
  soc.forEach(r => { plats[r.platform] = true; });
  const followers = Object.keys(plats).map(p => {
    const rows = soc.filter(r => r.platform === p).sort((a, b) => String(a.week) < String(b.week) ? -1 : 1);
    const end = rows.filter(r => String(r.week) <= R.toWk && smmNum_(r.followers) > 0).pop();
    const start = rows.filter(r => String(r.week) < R.fromWk && smmNum_(r.followers) > 0).pop() || rows.filter(r => String(r.week) >= R.fromWk && smmNum_(r.followers) > 0)[0];
    const inP = rows.filter(r => String(r.week) >= R.fromWk && String(r.week) <= R.toWk);
    return {
      platform: p, account: (rows.filter(r => r.account).pop() || {}).account || '',
      start: start ? smmNum_(start.followers) : null, end: end ? smmNum_(end.followers) : null,
      growth: start && end ? smmNum_(end.followers) - smmNum_(start.followers) : null,
      reach: inP.reduce((a, r) => a + smmNum_(r.reach), 0), views: inP.reduce((a, r) => a + smmNum_(r.views), 0),
      visits: inP.reduce((a, r) => a + smmNum_(r.profile_visits), 0), leads: inP.reduce((a, r) => a + smmNum_(r.leads), 0),
    };
  }).sort((a, b) => (b.end || 0) - (a.end || 0));
  // выводы
  const ins = [];
  const rub = byRubric.filter(x => x.name !== '— без рубрики' && x.posts >= 2);
  if (rub.length) ins.push('Лучшая рубрика по охвату (среди рубрик от 2 публикаций): «' + rub[0].name + '» — в среднем ' + rub[0].avgReach.toLocaleString('ru-RU') + ' охвата на публикацию (' + rub[0].posts + ' публ.).');
  if (rub.length > 1) ins.push('Слабее всего по охвату: «' + rub[rub.length - 1].name + '» — ' + rub[rub.length - 1].avgReach.toLocaleString('ru-RU') + ' в среднем.');
  const lead = byRubric.filter(x => x.leads > 0).sort((a, b) => b.leads - a.leads)[0];
  if (lead) ins.push('Больше всего заявок принесла рубрика «' + lead.name + '»: ' + lead.leads + '.');
  const pl = byPlatform.filter(x => x.posts >= 2);
  if (pl.length) ins.push('Самая сильная площадка по охвату на публикацию: ' + pl[0].name + ' (' + pl[0].avgReach.toLocaleString('ru-RU') + ').');
  const fm = byFormat.filter(x => x.posts >= 2);
  if (fm.length) ins.push('Лучший формат: ' + fm[0].name + ' (' + fm[0].avgReach.toLocaleString('ru-RU') + ' охвата в среднем).');
  const gr = followers.filter(f => f.growth !== null).sort((a, b) => b.growth - a.growth);
  if (gr.length) ins.push('Рост подписчиков: ' + gr.map(f => f.platform + ' ' + (f.growth >= 0 ? '+' : '') + f.growth).join(', ') + '.');
  const noRub = posts.filter(r => !r.rubric).length;
  if (noRub) ins.push('У ' + noRub + ' публикаций не указана рубрика — проставьте, чтобы аналитика по рубрикам была точной.');
  const noStat = posts.filter(r => !smmNum_(r.views) && !smmNum_(r.reach)).length;
  if (noStat) ins.push('У ' + noStat + ' публикаций нет просмотров и охвата — внесите цифры (Instagram, Threads, Telegram, YouTube подтягиваются по ссылке сами).');
  const allPlats = dictValues_('platforms').filter(p => !/другое|циан/i.test(p));
  const silent = allPlats.filter(p => !byPlatform.some(x => x.name === p) && followers.some(f => f.platform === p));
  if (silent.length) ins.push('Не было публикаций за период: ' + silent.join(', ') + '.');
  return {
    from: fmtDate_(R.from, 'yyyy-MM-dd'), to: fmtDate_(R.to, 'yyyy-MM-dd'),
    totals: totals, byPlatform: byPlatform, byRubric: byRubric, byFormat: byFormat, byObject: byObject, top: top, followers: followers, insights: ins,
  };
}

/** Папка для отчётов SMM: «05_СММ» в корневой папке системы (если нет доступа — Мой диск автора). */
function smmFolder_() {
  try {
    const root = folderById_(cfgGet_('FOLDER_ROOT_ID'));
    if (root) return childFolder_(root, '05_СММ');
  } catch (e) { /* нет доступа к папке системы */ }
  return null;
}

function smmDoc_(title) {
  const doc = DocumentApp.create(title);
  try { const f = smmFolder_(); if (f) DriveApp.getFileById(doc.getId()).moveTo(f); } catch (e) { /* останется в Моём диске */ }
  return doc;
}

function smmTable_(body, header, rows) {
  if (!rows.length) { body.appendParagraph('Нет данных за период.'); return; }
  const t = body.appendTable([header].concat(rows.map(r => r.map(v => v === null || v === undefined ? '—' : String(v)))));
  const hr = t.getRow(0);
  for (let i = 0; i < hr.getNumCells(); i++) hr.getCell(i).editAsText().setBold(true);
}

/** Отчёт SMM за период — Google Документ (ссылка + «Скачать в Word»). */
function webSmmReport(from, to) {
  webSmmUser_();
  const A = smmAnalytics_(from, to);
  const per2 = A.from.split('-').reverse().join('.') + ' – ' + A.to.split('-').reverse().join('.');
  const doc = smmDoc_('Отчёт SMM — ' + per2);
  const b = doc.getBody();
  const H = DocumentApp.ParagraphHeading;
  b.getParagraphs()[0].setText('Отчёт SMM за ' + per2).setHeading(H.TITLE);
  const f = n => Number(n || 0).toLocaleString('ru-RU');
  const t = A.totals;
  b.appendParagraph('Итоги').setHeading(H.HEADING1);
  b.appendParagraph('Публикаций: ' + t.posts + ' · просмотры: ' + f(t.views) + ' · охват: ' + f(t.reach) + ' · лайки: ' + f(t.likes) + ' · комментарии: ' + f(t.comments) +
    ' · сохранения: ' + f(t.saves) + ' · репосты: ' + f(t.shares) + ' · заявки: ' + f(t.leads) + ' · подписки с публикаций: ' + f(t.followers_gained) +
    (t.er !== null ? ' · вовлечённость: ' + t.er + '%' : ''));
  if (A.insights.length) {
    b.appendParagraph('Выводы').setHeading(H.HEADING1);
    A.insights.forEach(x => b.appendListItem(x));
  }
  b.appendParagraph('Подписчики и аккаунты').setHeading(H.HEADING1);
  smmTable_(b, ['Площадка', 'Аккаунт', 'Было', 'Стало', 'Рост', 'Охват', 'Просмотры', 'Переходы', 'Заявки'],
    A.followers.map(x => [x.platform, x.account, x.start, x.end, x.growth === null ? '—' : (x.growth >= 0 ? '+' : '') + x.growth, f(x.reach), f(x.views), f(x.visits), x.leads]));
  const g = (title, list) => {
    b.appendParagraph(title).setHeading(H.HEADING1);
    smmTable_(b, ['', 'Публ.', 'Охват ср.', 'Просм. ср.', 'Охват', 'Просмотры', 'ER, %', 'Заявки'],
      list.map(x => [x.name, x.posts, f(x.avgReach), f(x.avgViews), f(x.reach), f(x.views), x.er === null ? '—' : x.er, x.leads]));
  };
  g('Рубрики (по среднему охвату)', A.byRubric);
  g('Площадки', A.byPlatform);
  g('Форматы', A.byFormat);
  g('Объекты и общий контент', A.byObject);
  b.appendParagraph('Топ-10 публикаций').setHeading(H.HEADING1);
  smmTable_(b, ['Дата', 'Тема', 'Площадка', 'Рубрика', 'Просмотры', 'Охват', 'Ссылка'],
    A.top.map(x => [x.date.split('-').reverse().join('.'), x.topic, x.platform, x.rubric, f(x.views), f(x.reach), x.link]));
  doc.saveAndClose();
  try { linkifyBody_(DocumentApp.openById(doc.getId()).getBody()); } catch (e) { /* без кликабельных ссылок */ }
  return { url: doc.getUrl(), word: wordExportUrl_(doc.getId()) };
}

/** Контент-план на период — Google Документ. */
function webContentPlanDoc(from, to) {
  webSmmUser_();
  const R = smmRange_(from, to);
  const objs = {};
  readTable_('OBJ').rows.forEach(o => { if (o.id) objs[String(o.id)] = o; });
  const rows = readTable_('CONT').rows.filter(r => r.id && r.pub_date instanceof Date && r.pub_date >= R.from && r.pub_date <= R.to)
    .sort((a, b) => a.pub_date - b.pub_date);
  const per2 = fmtDate_(R.from) + ' – ' + fmtDate_(R.to);
  const doc = smmDoc_('Контент-план — ' + per2);
  const b = doc.getBody();
  b.getParagraphs()[0].setText('Контент-план на ' + per2).setHeading(DocumentApp.ParagraphHeading.TITLE);
  const weeks = {};
  rows.forEach(r => { const k = isoWeekKey_(r.pub_date); (weeks[k] = weeks[k] || []).push(r); });
  if (!rows.length) b.appendParagraph('В плане на этот период публикаций нет.');
  Object.keys(weeks).sort().forEach(k => {
    b.appendParagraph(weekPeriodLabel_(k) || k).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    smmTable_(b, ['Дата', 'Площадка', 'Формат', 'Рубрика', 'Объект', 'Тема', 'Статус', 'Кто'],
      weeks[k].map(r => [fmtDate_(r.pub_date, 'dd.MM'), r.platform, r.format, r.rubric || '', isServiceObject_(objs[String(r.obj_id)] || {}) ? 'Общий' : ((objs[String(r.obj_id)] || {}).name || r.obj_id), r.topic, r.status, r.owner]));
  });
  doc.saveAndClose();
  return { url: doc.getUrl(), word: wordExportUrl_(doc.getId()) };
}
