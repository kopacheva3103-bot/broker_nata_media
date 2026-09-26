/**
 * 16_Social — просмотры публикаций по ссылкам из 04_КОНТЕНТ.
 *
 *  - Telegram (публичный канал, ссылка вида t.me/канал/123): просмотры берутся со страницы поста — без ключей и настроек.
 *  - YouTube / Shorts: нужен встроенный сервис «YouTube Data API» (редактор Apps Script → «Сервисы» ＋ → YouTube Data API v3 → Добавить).
 *  - Instagram, Threads: нужен доступ Meta Graph API (профессиональный аккаунт + приложение Meta) — следующий этап, пока вручную.
 * Охват, сохранения и заявки площадки публично не отдают — их вносит SMM.
 */

function refreshSocialStats() {
  const r = refreshSocialStats_();
  toast_('Обновлено просмотров: Telegram ' + r.tg + ', YouTube ' + r.yt +
    (r.ytOff ? '. YouTube не подключён: редактор Apps Script → Сервисы ＋ → YouTube Data API v3' : '') +
    (r.failed ? '. Не удалось: ' + r.failed : ''), 'Статистика контента', 10);
}

function refreshSocialStats_() {
  const t = readTable_('CONT');
  const res = { tg: 0, yt: 0, failed: 0, ytOff: false };
  const yt = [];
  t.rows.forEach(o => {
    const link = String(o.link || '').trim();
    if (!link) return;
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
