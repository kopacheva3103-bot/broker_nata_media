/**
 * 16_Social — просмотры публикаций по ссылкам из 04_КОНТЕНТ.
 *
 *  - Telegram (публичный канал, ссылка вида t.me/канал/123): просмотры берутся со страницы поста — без ключей и настроек.
 *  - YouTube / Shorts: нужен встроенный сервис «YouTube Data API» (редактор Apps Script → «Сервисы» ＋ → YouTube Data API v3 → Добавить).
 *  - Instagram (профессиональный аккаунт): просмотры, охват, сохранения — Instagram API (graph.instagram.com).
 *  - Threads: просмотры — Threads API (graph.threads.net).
 *    Ключи доступа (токены) вводятся в «Сервис → Подключить Instagram / Threads» и хранятся в свойствах скрипта,
 *    не в таблице. Токены живут 60 дней — скрипт продлевает их сам раз в неделю (при обновлении статистики).
 * Заявки SMM вносит вручную; охват и сохранения Telegram / YouTube публично недоступны.
 */

const IG_API = 'https://graph.instagram.com/v25.0';
const TH_API = 'https://graph.threads.net/v1.0';

function refreshSocialStats() {
  const r = refreshSocialStats_();
  toast_('Обновлено: Instagram ' + r.ig + ', Threads ' + r.th + ', Telegram ' + r.tg + ', YouTube ' + r.yt +
    (r.igOff && r.igLinks ? '. Instagram не подключён (Сервис → Подключить Instagram / Threads)' : '') +
    (r.thOff && r.thLinks ? '. Threads не подключён' : '') +
    (r.notFound ? '. Не найдены в аккаунте: ' + r.notFound + ' ссылок' : '') +
    (r.ytOff ? '. YouTube не подключён: редактор Apps Script → Сервисы ＋ → YouTube Data API v3' : '') +
    (r.failed ? '. Не удалось: ' + r.failed : ''), 'Статистика контента', 10);
}

function refreshSocialStats_() {
  const t = readTable_('CONT');
  const res = { tg: 0, yt: 0, ig: 0, th: 0, failed: 0, notFound: 0, ytOff: false, igOff: false, thOff: false, igLinks: 0, thLinks: 0 };
  const yt = [], ig = [], th = [];
  t.rows.forEach(o => {
    const link = String(o.link || '').trim();
    if (!link) return;
    const igCode = instagramCode_(link);
    if (igCode) { ig.push({ o: o, code: igCode }); return; }
    const thCode = threadsCode_(link);
    if (thCode) { th.push({ o: o, code: thCode }); return; }
    const tg = /t\.me\/(?:s\/)?([A-Za-z0-9_]{4,})\/(\d+)/.exec(link);
    if (tg) {
      const n = telegramViews_(tg[1], tg[2]);
      if (n === null) { res.failed++; return; }
      if (n !== o.views) { writeFields_(t.sh, 'CONT', o._row, { views: n }); res.tg++; }
      return;
    }
    const id = youtubeId_(link);
    if (id) yt.push({ row: o._row, id: id, views: o.views });
  });
  res.igLinks = ig.length; res.thLinks = th.length;
  if (ig.length) updateInstagram_(t, ig, res);
  if (th.length) updateThreads_(t, th, res);
  if (yt.length) {
    if (typeof YouTube === 'undefined') { res.ytOff = true; return res; }
    for (let i = 0; i < yt.length; i += 50) {
      const part = yt.slice(i, i + 50);
      try {
        const resp = YouTube.Videos.list('statistics', { id: part.map(x => x.id).join(',') });
        const map = {};
        (resp.items || []).forEach(it => { map[it.id] = Number(it.statistics.viewCount || 0); });
        part.forEach(x => {
          if (!(x.id in map)) { res.failed++; return; }
          if (map[x.id] !== x.views) { writeFields_(t.sh, 'CONT', x.row, { views: map[x.id] }); res.yt++; }
        });
      } catch (e) { res.failed += part.length; }
    }
  }
  return res;
}

/** Просмотры поста публичного канала: страница t.me/<канал>/<id>?embed=1 содержит «1.2K» в tgme_widget_message_views. */
function telegramViews_(channel, post) {
  try {
    const html = UrlFetchApp.fetch('https://t.me/' + channel + '/' + post + '?embed=1&mode=tme', { muteHttpExceptions: true, followRedirects: true }).getContentText();
    const m = /tgme_widget_message_views[^>]*>([\d.,]+)\s*([KMkm]?)</.exec(html);
    return m ? parseCount_(m[1], m[2]) : null;
  } catch (e) { return null; }
}

function parseCount_(num, suffix) {
  const n = Number(String(num).replace(',', '.'));
  const k = { k: 1e3, m: 1e6 }[String(suffix || '').toLowerCase()] || 1;
  return Math.round(n * k);
}

function youtubeId_(link) {
  const m = /(?:youtube\.com\/(?:shorts\/|watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(link);
  return m ? m[1] : '';
}

// ───────────────────────── Instagram и Threads ─────────────────────────

function instagramCode_(link) {
  const m = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(link);
  return m ? m[1] : '';
}

function threadsCode_(link) {
  const m = /threads\.(?:net|com)\/@?[A-Za-z0-9_.]+\/post\/([A-Za-z0-9_-]+)/.exec(link);
  return m ? m[1] : '';
}

function socialProps_() { return PropertiesService.getScriptProperties(); }

/** Токен сети: 'IG' | 'TH'. Раз в неделю продлевается (живёт 60 дней с последнего продления). */
function socialToken_(net) {
  const p = socialProps_();
  const tok = p.getProperty(net + '_TOKEN');
  if (!tok) return '';
  const ts = Number(p.getProperty(net + '_TOKEN_TS') || 0);
  if (Date.now() - ts > 7 * 86400000) {
    const url = net === 'IG'
      ? 'https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=' + encodeURIComponent(tok)
      : 'https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=' + encodeURIComponent(tok);
    const r = metaGet_(url);
    if (r && r.access_token) {
      p.setProperty(net + '_TOKEN', r.access_token);
      p.setProperty(net + '_TOKEN_TS', String(Date.now()));
      return r.access_token;
    }
  }
  return tok;
}

/** GET к Graph API → объект JSON; ошибка API → {error: {...}}. */
function metaGet_(url) {
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  try { return JSON.parse(resp.getContentText()); } catch (e) { return { error: { message: 'HTTP ' + resp.getResponseCode() } }; }
}

/** Все публикации аккаунта (до 500 последних): shortcode из permalink → id. */
function metaMediaMap_(firstUrl, codeOf) {
  const map = {};
  let url = firstUrl, pages = 0;
  while (url && pages++ < 5) {
    const r = metaGet_(url);
    if (r.error) throw new Error(r.error.message || 'ошибка API');
    (r.data || []).forEach(m => { const c = codeOf(String(m.permalink || '')); if (c) map[c] = m.id; });
    url = r.paging && r.paging.next ? r.paging.next : '';
  }
  return map;
}

function insightValues_(r) {
  const out = {};
  (r.data || []).forEach(d => {
    const v = d.total_value && d.total_value.value !== undefined ? d.total_value.value : (d.values && d.values[0] ? d.values[0].value : undefined);
    if (typeof v === 'number') out[d.name] = v;
  });
  return out;
}

function updateInstagram_(t, items, res) {
  const tok = socialToken_('IG');
  if (!tok) { res.igOff = true; return; }
  let map;
  try { map = metaMediaMap_(IG_API + '/me/media?fields=id,permalink&limit=100&access_token=' + encodeURIComponent(tok), instagramCode_); }
  catch (e) { res.failed += items.length; Logger.log('Instagram: ' + e.message); return; }
  items.forEach(x => {
    const id = map[x.code];
    if (!id) { res.notFound++; return; }
    let r = metaGet_(IG_API + '/' + id + '/insights?metric=views,reach,saved&access_token=' + encodeURIComponent(tok));
    if (r.error) r = metaGet_(IG_API + '/' + id + '/insights?metric=reach,saved&access_token=' + encodeURIComponent(tok));
    if (r.error) { res.failed++; return; }
    const v = insightValues_(r);
    const upd = {};
    if (v.views !== undefined && v.views !== x.o.views) upd.views = v.views;
    if (v.reach !== undefined && v.reach !== x.o.reach) upd.reach = v.reach;
    if (v.saved !== undefined && v.saved !== x.o.saves) upd.saves = v.saved;
    if (Object.keys(upd).length) { writeFields_(t.sh, 'CONT', x.o._row, upd); res.ig++; }
  });
}

function updateThreads_(t, items, res) {
  const tok = socialToken_('TH');
  if (!tok) { res.thOff = true; return; }
  let map;
  try { map = metaMediaMap_(TH_API + '/me/threads?fields=id,permalink&limit=100&access_token=' + encodeURIComponent(tok), threadsCode_); }
  catch (e) { res.failed += items.length; Logger.log('Threads: ' + e.message); return; }
  items.forEach(x => {
    const id = map[x.code];
    if (!id) { res.notFound++; return; }
    const r = metaGet_(TH_API + '/' + id + '/insights?metric=views&access_token=' + encodeURIComponent(tok));
    if (r.error) { res.failed++; return; }
    const v = insightValues_(r);
    if (v.views !== undefined && v.views !== x.o.views) { writeFields_(t.sh, 'CONT', x.o._row, { views: v.views }); res.th++; }
  });
}

// ───────────────────────── подключение аккаунтов ─────────────────────────

function connectSocial() {
  const st = socialStatus();
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<p>Вставьте ключи доступа (токены) из приложения Meta — как их получить, описано в инструкции «06 — Подключение Instagram и Threads». ' +
    'Ключи хранятся в свойствах скрипта, в таблице их не видно. Пустое поле — оставить как есть.</p>' +
    '<p><b>Instagram</b>: <span id="si">' + htmlEscape_(st.ig) + '</span><br><input id="ig" style="width:100%" placeholder="IGAA…"></p>' +
    '<p><b>Threads</b>: <span id="st">' + htmlEscape_(st.th) + '</span><br><input id="th" style="width:100%" placeholder="THAA…"></p>' +
    '<button onclick="save()">Проверить и сохранить</button> <button onclick="off()">Отключить оба</button>' +
    '<div id="r" style="margin-top:10px"></div></div><script>' +
    'function show(x){document.getElementById("si").textContent=x.ig;document.getElementById("st").textContent=x.th;document.getElementById("r").textContent=x.msg||"";}' +
    'function save(){document.getElementById("r").textContent="Проверяю…";google.script.run.withSuccessHandler(show).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).saveSocialTokens(document.getElementById("ig").value,document.getElementById("th").value);}' +
    'function off(){google.script.run.withSuccessHandler(show).removeSocialTokens();}' +
    '</script>').setWidth(560).setHeight(380);
  SpreadsheetApp.getUi().showModalDialog(html, 'Подключить Instagram / Threads');
}

function socialStatus() {
  const p = socialProps_();
  const f = net => p.getProperty(net + '_TOKEN') ? 'подключён' + (p.getProperty(net + '_USER') ? ' (@' + p.getProperty(net + '_USER') + ')' : '') +
    ', ключ продлён ' + fmtDate_(new Date(Number(p.getProperty(net + '_TOKEN_TS') || 0))) : 'не подключён';
  return { ig: f('IG'), th: f('TH') };
}

function saveSocialTokens(ig, th) {
  const p = socialProps_();
  const msg = [];
  const check = (net, tok, url) => {
    tok = String(tok || '').trim();
    if (!tok) return;
    const r = metaGet_(url + encodeURIComponent(tok));
    if (r.error || !r.username) { msg.push((net === 'IG' ? 'Instagram' : 'Threads') + ': ключ не подошёл — ' + (r.error ? r.error.message : 'нет доступа')); return; }
    p.setProperty(net + '_TOKEN', tok);
    p.setProperty(net + '_TOKEN_TS', String(Date.now()));
    p.setProperty(net + '_USER', r.username);
    msg.push((net === 'IG' ? 'Instagram' : 'Threads') + ': подключён @' + r.username);
    logHistory_([{ sheet: 'Соцсети', record_id: net, field: 'Подключение', old: '', new: '@' + r.username, kind: HIST_KIND.CHANGE }], userEmail_());
  };
  check('IG', ig, IG_API + '/me?fields=username&access_token=');
  check('TH', th, TH_API + '/me?fields=username&access_token=');
  const st = socialStatus();
  st.msg = msg.join('. ') || 'Ничего не введено.';
  return st;
}

function removeSocialTokens() {
  const p = socialProps_();
  ['IG', 'TH'].forEach(n => ['_TOKEN', '_TOKEN_TS', '_USER'].forEach(k => p.deleteProperty(n + k)));
  const st = socialStatus();
  st.msg = 'Отключено.';
  return st;
}
