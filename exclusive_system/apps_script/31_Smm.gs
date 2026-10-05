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

/** Норма рубрики в публикациях за неделю — по тексту «Частота» из 07_СПРАВОЧНИКИ. «По поводу» и пусто — без нормы. */
function rubricPerWeek_(freq) {
  const t = String(freq || '').toLowerCase().replace(/ё/g, 'е');
  if (!t || /повод|по мере|реже/.test(t)) return 0;
  const n = (/(\d+)\s*раз/.exec(t) || [])[1];
  const k = n ? Number(n) : 1;
  if (/недел/.test(t)) { const per = (/раз\s+в\s+(\d+)\s*недел/.exec(t) || [])[1]; return per ? 1 / Number(per) : k; }
  if (/месяц/.test(t)) return k * 12 / 52;
  if (/день|ежедневно/.test(t)) return 7 * k;
  return 0;
}

/** Рубрики с нормами: [{name, freq, perWeek, about, where}]. */
function smmRubrics_() {
  try {
    return dictRows_('content_rubrics').map(r => ({ name: String(r[0]), freq: String(r[1] || ''), perWeek: rubricPerWeek_(r[1]), about: String(r[2] || ''), where: String(r[3] || ''), funnel: String(r[4] || '') }));
  } catch (e) { return []; }
}

function smmFunnel_() {
  try { return dictRows_('content_funnel').map(r => ({ name: String(r[0]), target: Number(r[1]) || 0 })); } catch (e) { return []; }
}

/**
 * Нормы рубрик и баланс воронки за период. Считаются темы, а не строки: одна тема на нескольких площадках (кросспостинг) — одна публикация.
 * onlyDone: только опубликованное (для отчёта), иначе — весь план без отменённых.
 */
function smmNorms_(from, to, onlyDone) {
  const R = smmRange_(from, to);
  const cls = r => { try { return dictClassOf_('content_status', r.status); } catch (e) { return ''; } };
  const rows = readTable_('CONT').rows.filter(r => r.id && r.pub_date instanceof Date && r.pub_date >= R.from && r.pub_date <= R.to &&
    (onlyDone ? cls(r) === CLS.DONE : cls(r) !== CLS.CANCEL));
  const topics = {};
  rows.forEach(r => {
    const k = [String(r.topic || r.id).trim().toLowerCase(), r.rubric || '', fmtDate_(r.pub_date, 'yyyy-MM-dd')].join('|');
    if (!topics[k]) topics[k] = { rubric: r.rubric || '', funnel: r.funnel || '', platforms: {} };
    topics[k].platforms[r.platform] = true;
    if (!topics[k].funnel && r.funnel) topics[k].funnel = r.funnel;
  });
  const list = Object.keys(topics).map(k => topics[k]);
  const weeks = Math.max(1, Math.round(((R.to - R.from) / 864e5 + 1) / 7 * 10) / 10);
  const rubrics = smmRubrics_().map(x => {
    const fact = list.filter(t => t.rubric === x.name).length;
    const need = !x.perWeek ? 0 : x.perWeek >= 1 ? Math.floor(x.perWeek * weeks + 1e-9) : Math.max(0, Math.round(x.perWeek * weeks - 0.01));
    return { name: x.name, freq: x.freq, where: x.where, about: x.about, need: need, fact: fact, gap: Math.max(0, need - fact) };
  });
  const known = {};
  rubrics.forEach(x => { known[x.name] = true; });
  const other = list.filter(t => t.rubric && !known[t.rubric]).length;
  const noRubric = list.filter(t => !t.rubric).length;
  const total = list.length;
  const staged = list.filter(t => t.funnel).length;
  const funnel = smmFunnel_().map(f => {
    const n = list.filter(t => t.funnel === f.name).length;
    const pct = staged ? Math.round(n / staged * 100) : 0;
    return { name: f.name, target: f.target, count: n, pct: pct, diff: staged ? pct - f.target : 0 };
  });
  const tips = [];
  const miss = rubrics.filter(x => x.gap > 0);
  if (miss.length) tips.push('Ниже нормы: ' + miss.map(x => x.name + ' (' + x.fact + ' из ' + x.need + ')').join(', ') + '.');
  if (staged >= 3) funnel.filter(f => Math.abs(f.diff) >= 10).forEach(f => tips.push('Воронка: «' + f.name + '» — ' + f.pct + '% при цели ' + f.target + '%' + (f.diff < 0 ? ', добавьте такие публикации.' : ', перекос — разбавьте другими этапами.')));
  if (total - staged > 0) tips.push('У ' + (total - staged) + ' тем не указан этап воронки.');
  if (noRubric) tips.push('У ' + noRubric + ' тем не указана рубрика.');
  return { from: fmtDate_(R.from, 'yyyy-MM-dd'), to: fmtDate_(R.to, 'yyyy-MM-dd'), weeks: weeks, topics: total, rubrics: rubrics, other: other, noRubric: noRubric, funnel: funnel, staged: staged, tips: tips };
}

/** Основная площадка рубрики: закрытый канал — для рубрик «ЗК», иначе Telegram (с него раньше дублировали в остальные сети). */
function rubricBasePlatform_(rub) {
  const plats = dictValues_('platforms');
  const closed = plats.filter(p => /закрыт/i.test(p))[0];
  if (rub && /закрыт/i.test(rub.where) && closed) return closed;
  return plats.indexOf('Telegram') >= 0 ? 'Telegram' : plats[0];
}

/**
 * «Заполнить по нормам»: на период (обычно 2 недели вперёд) ставит заготовки тем по рубрикам, которых не хватает до нормы.
 * Заготовка = статус «Идея», основная площадка, этап воронки из рубрики; дни — с меньшей загрузкой, прошедшие дни не трогаются.
 */
function webPlanFill(from, to) {
  const u = webSmmUser_();
  const R = smmRange_(from, to);
  const N = smmNorms_(from, to, false);
  const rubs = {};
  smmRubrics_().forEach(x => { rubs[x.name] = x; });
  const agency = objectById_(AGENCY_ID);
  if (!agency) throw new Error('Нет служебного объекта «' + AGENCY_NAME + '» — запустите «Установить / обновить систему»');
  const start = R.from < today_() ? today_() : R.from;
  const days = [];
  for (let dt = new Date(start); dt <= R.to; dt = addDays_(dt, 1)) if (dt.getDay() !== 0) days.push(new Date(dt)); // без воскресений
  if (!days.length) throw new Error('В выбранном периоде не осталось будущих дней');
  const key = dt => fmtDate_(dt, 'yyyy-MM-dd');
  const load = {}, rubWeek = {};
  readTable_('CONT').rows.forEach(r => {
    if (!(r.pub_date instanceof Date) || r.pub_date < R.from || r.pub_date > R.to) return;
    load[key(r.pub_date)] = (load[key(r.pub_date)] || 0) + 1;
    const wk = r.rubric + '|' + isoWeekKey_(r.pub_date);
    rubWeek[wk] = (rubWeek[wk] || 0) + 1;
  });
  const weeks = [];
  days.forEach(dt => { const w = isoWeekKey_(dt); if (weeks.indexOf(w) < 0) weeks.push(w); });
  const status = (dictRows_('content_status').find(x => x[0] === 'Идея') || dictRows_('content_status')[0] || [''])[0];
  let made = 0;
  N.rubrics.filter(x => x.gap > 0).forEach(x => {
    const rub = rubs[x.name] || { name: x.name };
    for (let i = 0; i < x.gap; i++) {
      const wk = weeks.slice().sort((a, b) => (rubWeek[x.name + '|' + a] || 0) - (rubWeek[x.name + '|' + b] || 0) || (a < b ? -1 : 1))[0];
      const day = days.filter(dt => isoWeekKey_(dt) === wk).sort((a, b) => (load[key(a)] || 0) - (load[key(b)] || 0) || a - b)[0];
      if (!day) break;
      webCreate('CONT', { obj_id: AGENCY_ID, rubric: x.name, topic: '✎ ' + (rub.about || x.name), platform: rubricBasePlatform_(rub), status: status,
        funnel: rub.funnel || '', pub_date: key(day), owner: u.name });
      load[key(day)] = (load[key(day)] || 0) + 1;
      rubWeek[x.name + '|' + wk] = (rubWeek[x.name + '|' + wk] || 0) + 1;
      made++;
    }
  });
  return { ok: true, made: made };
}

/** Перенос публикаций (вся тема со всеми площадками) на другую дату. */
function webMoveContent(ids, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('Неверная дата');
  (ids || []).forEach(id => webUpdate('CONT', id, { pub_date: date }));
  return { ok: true };
}

/** Дублировать публикацию на другие площадки (кросспостинг): копия с теми же темой, рубрикой, датой, текстами. */
function webCrosspost(id, platforms) {
  webUser_();
  const r = readTable_('CONT').rows.find(x => String(x.id) === String(id));
  if (!r) throw new Error('Публикация не найдена');
  const have = readTable_('CONT').rows.filter(x => x.topic === r.topic && String(x.obj_id) === String(r.obj_id) && x.pub_date instanceof Date && r.pub_date instanceof Date &&
    isoWeekKey_(x.pub_date) === isoWeekKey_(r.pub_date)).map(x => x.platform);
  const ids = [];
  (platforms || []).filter(p => have.indexOf(p) < 0).forEach(p => {
    const o = {};
    WEB_CREATE.CONT.forEach(k => { const v = r[k]; o[k] = v instanceof Date ? fmtDate_(v, 'yyyy-MM-dd') : v; });
    o.platform = p;
    ids.push(webCreate('CONT', o).id);
  });
  return { ok: true, ids: ids };
}

/** Кабинет: нормы рубрик и воронка по контент-плану периода. */
function webSmmNorms(from, to) {
  webUser_();
  return smmNorms_(from, to, false);
}

/** Несколько публикаций за раз — одна тема на несколько площадок (кросспостинг). */
function webCreateContent(data) {
  const plats = (data && data.platforms && data.platforms.length ? data.platforms : [data && data.platform]).filter(Boolean);
  if (!plats.length) throw new Error('Выберите площадку');
  if (data && !data.funnel && data.rubric) { const rb = smmRubrics_().find(x => x.name === data.rubric); if (rb && rb.funnel) data.funnel = rb.funnel; } // этап воронки по умолчанию — из рубрики
  const ids = plats.map(p => webCreate('CONT', Object.assign({}, data, { platform: p, platforms: undefined })).id);
  return { ok: true, ids: ids };
}

/** Статистика аккаунтов: последние 26 недель. */
function webSocial() {
  webSmmUser_();
  const from = isoWeekKey_(addDays_(today_(), -7 * 26));
  return readTable_('SOC').rows.filter(r => r.id && r.platform && String(r.week) >= from)
    .map(r => webRow_(r, ['id', 'week', 'platform', 'account', 'followers', 'reach', 'views', 'profile_visits', 'leads', 'note', 'unfollows', 'shares']));
}

/** Сохранить неделю по площадке: есть строка (неделя + площадка) — обновить, нет — создать. */
function webSocialSave(rec) {
  const u = webSmmUser_();
  if (!rec || !rec.platform) throw new Error('Выберите площадку');
  const wk = rec.week || isoWeekKey_(today_());
  const keys = ['account', 'followers', 'reach', 'views', 'profile_visits', 'leads', 'note', 'unfollows', 'shares'];
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
  const group = (keyFn, none) => {
    const g = {};
    posts.forEach(r => { const k = keyFn(r) || none || '— без рубрики'; (g[k] = g[k] || []).push(r); });
    return Object.keys(g).map(k => Object.assign({ name: k }, sum(g[k]))).sort((a, b) => b.avgReach - a.avgReach || b.avgViews - a.avgViews);
  };
  const objName = id => isServiceObject_(objs[String(id)] || {}) ? 'Общий контент агентства' : ((objs[String(id)] || {}).name || String(id));
  const totals = sum(posts);
  const byPlatform = group(r => r.platform);
  const byRubric = group(r => r.rubric);
  const byFormat = group(r => r.format);
  const byObject = group(r => objName(r.obj_id));
  const byFunnel = group(r => r.funnel, '— этап не указан');
  const norms = smmNorms_(from, to, true);
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
      unfollows: inP.reduce((a, r) => a + smmNum_(r.unfollows), 0), shares: inP.reduce((a, r) => a + smmNum_(r.shares), 0),
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
  const fun = byFunnel.filter(x => x.name !== '— этап не указан' && x.posts >= 2);
  if (fun.length > 1) ins.push('Этап воронки с лучшим охватом: «' + fun[0].name + '» (' + fun[0].avgReach.toLocaleString('ru-RU') + ' в среднем).');
  norms.tips.forEach(x => ins.push(x));
  const noStat = posts.filter(r => !smmNum_(r.views) && !smmNum_(r.reach)).length;
  if (noStat) ins.push('У ' + noStat + ' публикаций нет просмотров и охвата — внесите цифры (Instagram, Threads, Telegram, YouTube подтягиваются по ссылке сами).');
  const allPlats = dictValues_('platforms').filter(p => !/другое|циан/i.test(p));
  const silent = allPlats.filter(p => !byPlatform.some(x => x.name === p) && followers.some(f => f.platform === p));
  if (silent.length) ins.push('Не было публикаций за период: ' + silent.join(', ') + '.');
  return {
    from: fmtDate_(R.from, 'yyyy-MM-dd'), to: fmtDate_(R.to, 'yyyy-MM-dd'),
    totals: totals, byPlatform: byPlatform, byRubric: byRubric, byFormat: byFormat, byObject: byObject, byFunnel: byFunnel, norms: norms, top: top, followers: followers, insights: ins,
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
  smmTable_(b, ['Площадка', 'Аккаунт', 'Было', 'Стало', 'Рост', 'Отписки', 'Охват', 'Просмотры', 'Пересылки', 'Переходы', 'Заявки'],
    A.followers.map(x => [x.platform, x.account, x.start, x.end, x.growth === null ? '—' : (x.growth >= 0 ? '+' : '') + x.growth, f(x.unfollows), f(x.reach), f(x.views), f(x.shares), f(x.visits), x.leads]));
  smmNormsDoc_(b, A.norms);
  const g = (title, list) => {
    b.appendParagraph(title).setHeading(H.HEADING1);
    smmTable_(b, ['', 'Публ.', 'Охват ср.', 'Просм. ср.', 'Охват', 'Просмотры', 'ER, %', 'Заявки'],
      list.map(x => [x.name, x.posts, f(x.avgReach), f(x.avgViews), f(x.reach), f(x.views), x.er === null ? '—' : x.er, x.leads]));
  };
  g('Рубрики (по среднему охвату)', A.byRubric);
  g('Площадки', A.byPlatform);
  g('Форматы', A.byFormat);
  g('Этапы воронки', A.byFunnel);
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
    smmTable_(b, ['Дата', 'Площадка', 'Формат', 'Рубрика', 'Воронка', 'Объект', 'Тема и крючок', 'CTA', 'Статус', 'Кто'],
      weeks[k].map(r => [fmtDate_(r.pub_date, 'dd.MM'), r.platform, r.format, r.rubric || '', r.funnel || '', isServiceObject_(objs[String(r.obj_id)] || {}) ? 'Общий' : ((objs[String(r.obj_id)] || {}).name || r.obj_id),
        r.topic + (r.hook ? '\nКрючок: ' + r.hook : ''), r.cta || '', r.status, r.owner]));
  });
  smmNormsDoc_(b, smmNorms_(from, to, false));
  doc.saveAndClose();
  return { url: doc.getUrl(), word: wordExportUrl_(doc.getId()) };
}

/** Блок «Нормы рубрик и воронка» в документе. */
function smmNormsDoc_(b, N) {
  if (!N) return;
  const H = DocumentApp.ParagraphHeading;
  b.appendParagraph('Нормы рубрик (' + N.topics + ' тем за ' + N.weeks + ' нед.)').setHeading(H.HEADING1);
  smmTable_(b, ['Рубрика', 'Частота', 'Где', 'Норма', 'Факт', 'Не хватает'],
    N.rubrics.filter(x => x.need || x.fact).map(x => [x.name, x.freq, x.where, x.need || '—', x.fact, x.gap ? x.gap : '✓']));
  b.appendParagraph('Воронка контента').setHeading(H.HEADING1);
  smmTable_(b, ['Этап', 'Цель, %', 'Факт, %', 'Тем'], N.funnel.map(x => [x.name, x.target, N.staged ? x.pct : '—', x.count]));
  N.tips.forEach(x => b.appendListItem(x));
}
