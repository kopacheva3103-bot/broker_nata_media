/**
 * 02_Formulas — генерация формул.
 *
 * Все формулы собираются из схемы (01_Schema), поэтому столбцы можно добавлять
 * в схему без ручной правки буквенных адресов. Все диапазоны открытые ($B$2:$B),
 * поэтому новые строки/объекты подхватываются автоматически.
 *
 * Формулы пишутся на английском синтаксисе (запятые, английские имена функций) —
 * так требует Apps Script; в интерфейсе они отобразятся в локали таблицы.
 */

// ───────────────────────── адресация ─────────────────────────

function colLetter_(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colNumber_(letters) {
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n;
}

function quoteSheet_(name) { return "'" + name + "'"; }

/** Открытый диапазон столбца поля: 'Лист'!$C$2:$C (own=true — без имени листа). */
function colRef_(code, key, own, mod) {
  const L = colLetter_(fieldIndex_(code, key));
  if (mod === 'col') return L;
  const prefix = own ? '' : quoteSheet_(sheetName_(code)) + '!';
  return prefix + '$' + L + '$2:$' + L;
}

function dictLayout_() {
  if (dictLayout_.cache) return dictLayout_.cache;
  const L = {};
  let col = 1;
  dictDefs_().forEach(d => {
    L[d.key] = { col: col, width: d.cols.length, def: d };
    col += d.cols.length + 1;
  });
  dictLayout_.cache = L;
  return L;
}

/** Справочник: [[D.key]] — 1-й столбец, :tbl — вся таблица, :cN — N-й столбец, :N — N-я ячейка значений. */
function dictRef_(rest) {
  const parts = rest.split(':');
  const d = dictLayout_()[parts[0]];
  if (!d) throw new Error('Нет справочника ' + parts[0]);
  const sh = quoteSheet_(SHEET_NAMES.DICT) + '!';
  const first = colLetter_(d.col);
  const mod = parts[1];
  if (!mod) return sh + '$' + first + '$2:$' + first;
  if (mod === 'tbl') {
    const last = colLetter_(d.col + d.width - 1);
    return sh + '$' + first + '$2:$' + last;
  }
  if (mod === 'col') return first;
  let m = /^c(\d+)$/.exec(mod);
  if (m) {
    const L = colLetter_(d.col + Number(m[1]) - 1);
    return sh + '$' + L + '$2:$' + L;
  }
  m = /^(\d+)$/.exec(mod);
  if (m) return sh + '$' + first + '$' + (Number(m[1]) + 1);
  throw new Error('Неизвестный модификатор справочника: ' + rest);
}

/** Разворачивает токены [[...]] в адреса. */
function resolveF_(formula, ctx) {
  ctx = ctx || {};
  return formula.replace(/\[\[([^\]]+)\]\]/g, (m, tok) => resolveToken_(tok.trim(), ctx));
}

function resolveToken_(tok, ctx) {
  if (tok[0] === '@') {
    const p = tok.slice(1).split(':');
    if (!ctx.own) throw new Error('Токен ' + tok + ' без контекста листа');
    return colRef_(ctx.own, p[0], true, p[1]);
  }
  const dot = tok.indexOf('.');
  const ns = tok.slice(0, dot);
  const rest = tok.slice(dot + 1);
  if (ns === 'CFG') return 'CFG_' + rest;
  if (ns === 'NAME') return sheetName_(rest);
  if (ns === 'TITLE') { const p = rest.split('.'); return fieldTitle_(p[0], p[1]); }
  if (ns === 'D') return dictRef_(rest);
  if (ns === 'X') {
    if (!ctx.extra || !(rest in ctx.extra)) throw new Error('Нет параметра ' + tok);
    return ctx.extra[rest];
  }
  if (SHEET_NAMES[ns]) { const p = rest.split(':'); return colRef_(ns, p[0], false, p[1]); }
  throw new Error('Неизвестный токен ' + tok);
}

/** Формула заголовка столбца: заголовок + ARRAYFORMULA на весь столбец. */
function headerFormula_(spec, field) {
  const guardKey = field.guard || spec.guard;
  const expr = field.f === '__KPI_FACT__' ? kpiFactExpr_() : field.f === '__HYP_FACT__' ? hypFactExpr_() : field.f;
  const g = colRef_(spec.code, guardKey, true);
  return '={"' + field.title + '";ARRAYFORMULA(IF(LEN(' + g + ')=0,"",' + resolveF_(expr, { own: spec.code }) + '))}';
}

/** Фактический KPI задачи: сумма нужного показателя по объекту и неделе (и типу действия, если указан). */
function kpiFactExpr_() {
  let expr = '""';
  for (let i = KPI_SOURCES.length - 1; i >= 0; i--) {
    const k = KPI_SOURCES[i];
    let val;
    if (k.count) val = 'IF(t_="",COUNTIF(k_ow&"|"&[[ACT.status_class]],c_ow&"|DONE"),COUNTIF(k_owt&"|"&[[ACT.status_class]],c_owt&"|DONE"))';
    else val = 'IF(t_="",SUMIF(k_ow,c_ow,[[ACT.' + k.act + ']]),SUMIF(k_owt,c_owt,[[ACT.' + k.act + ']]))';
    expr = 'IF(m_=[[D.kpi_metrics:' + (i + 1) + ']],' + val + ',' + expr + ')';
  }
  return 'LET(k_ow,[[ACT.obj_id]]&"|"&[[ACT.week]],k_owt,[[ACT.obj_id]]&"|"&[[ACT.week]]&"|"&[[ACT.type]],' +
    'c_ow,[[@obj_id]]&"|"&[[@week]],c_owt,[[@obj_id]]&"|"&[[@week]]&"|"&[[@type]],' +
    'm_,[[@kpi_metric]],t_,[[@type]],' + expr + ')';
}

/** Факт гипотезы: метрика из 03 по объекту (+каналу) между датой начала и сроком (или сегодня). */
function hypFactExpr_() {
  const conds = ',[[ACT.obj_id]],h_o,[[ACT.date]],">="&h_s,[[ACT.date]],"<="&h_to';
  const withCh = v => 'IF(h_c="",' + v('') + ',' + v(',[[ACT.channel]],h_c') + ')';
  let expr = '""';
  for (let i = KPI_SOURCES.length - 1; i >= 0; i--) {
    const k = KPI_SOURCES[i];
    const val = k.count
      ? withCh(ch => 'COUNTIFS([[ACT.status_class]],"DONE"' + conds + ch + ')')
      : withCh(ch => 'SUMIFS([[ACT.' + k.act + ']]' + conds + ch + ')');
    expr = 'IF(h_m=[[D.kpi_metrics:' + (i + 1) + ']],' + val + ',' + expr + ')';
  }
  return 'MAP([[@obj_id]],[[@channel]],[[@metric]],[[@date_start]],[[@date_end]],LAMBDA(h_o,h_c,h_m,h_s,h_e,' +
    'IF(OR(h_o="",h_m="",h_s=""),"",LET(h_to,IF(h_e="",TODAY(),h_e),' + expr + '))))';
}

const CURRENT_WEEK_F_ = 'YEAR(TODAY()-WEEKDAY(TODAY(),2)+4)&"-W"&TEXT(ISOWEEKNUM(TODAY()),"00")';

// ───────────────────────── справочники: вычисляемые списки ─────────────────────────

function dictGeneratedFormulas_() {
  return {
    weeks: '=ARRAYFORMULA(LET(w_start,[[CFG.WEEKS_START]]-WEEKDAY([[CFG.WEEKS_START]],2)+1,' +
      'w_count,MAX(1,ROUNDUP((TODAY()+7*[[CFG.FUTURE_WEEKS]]-w_start)/7)),' +
      'w_mon,w_start+7*SEQUENCE(w_count,1,w_count-1,-1),' +
      '{YEAR(w_mon+3)&"-W"&TEXT(ISOWEEKNUM(w_mon),"00"),w_mon,w_mon+6,' +
      'YEAR(w_mon+3)&"-W"&TEXT(ISOWEEKNUM(w_mon),"00")&" · "&TEXT(w_mon,"dd.mm")&"–"&TEXT(w_mon+6,"dd.mm.yyyy")}))',
    obj_labels: '=ARRAYFORMULA(IFERROR(FILTER([[OBJ.id]]&" · "&[[OBJ.name]],[[OBJ.id]]<>""),""))',
    obj_filter: '=ARRAYFORMULA({"Все";IFERROR(FILTER([[OBJ.id]]&" · "&[[OBJ.name]],[[OBJ.id]]<>""),"")})',
    week_filter: '=ARRAYFORMULA({"Все время";IFERROR(FILTER([[D.weeks:c4]],[[D.weeks:c4]]<>""),"")})',
  };
}

// ───────────────────────── 05_СТАТИСТИКА ─────────────────────────

const STAT_SECTIONS = {
  total: { title: 6, header: 7, first: 8, last: 8, label: 'ИТОГО ЗА ВЕСЬ ПЕРИОД' },
  channel: { title: 10, header: 11, first: 12, last: 71, label: 'ПО КАНАЛАМ — весь период (до 60 каналов)' },
  object: { title: 73, header: 74, first: 75, last: 274, label: 'ПО ОБЪЕКТАМ — весь период (до 200 объектов)' },
  month: { title: 276, header: 277, first: 278, last: 397, label: 'ПО МЕСЯЦАМ' },
  week: { title: 399, header: 400, first: 401, last: null, label: 'ПО НЕДЕЛЯМ — динамика (новые недели сверху)' },
};

function statCommonCols_() {
  return [
    { t: 'Действия', m: 'done', d: 'Выполненные действия (статус класса DONE)' },
    { t: 'Контакты', m: 'sum', f: 'contacts' },
    { t: 'Ответы', m: 'sum', f: 'responses' },
    { t: 'Лиды', m: 'sum', f: 'interested', d: 'Лиды = «Количество заинтересованных» в 03_ДЕЙСТВИЯ' },
    { t: 'Презентации', m: 'sum', f: 'presentations' },
    { t: 'Показы', m: 'sum', f: 'showings' },
    { t: 'Повторные контакты', m: 'sum', f: 'repeat_contacts' },
    { t: 'Переговоры', m: 'sum', f: 'negotiations' },
    { t: 'Предложения', m: 'sum', f: 'offers' },
    { t: 'Брони', m: 'sum', f: 'bookings' },
    { t: 'Сделки', m: 'sum', f: 'deals' },
    { t: 'Отказы', m: 'refusals', d: 'Действия с указанной причиной отказа' },
    { t: 'Расходы, ₽', m: 'sum', f: 'cost', fmt: 'money' },
    { t: 'Просмотры объявлений', m: 'listing', f: 'views', fmt: '#,##0' },
    { t: 'Контакты по объявлениям', m: 'listing', f: 'contacts' },
    { t: 'Ответ / контакт', m: 'ratio', a: 'Ответы', b: 'Контакты', fmt: 'pct' },
    { t: 'Лид / контакт', m: 'ratio', a: 'Лиды', b: 'Контакты', fmt: 'pct' },
    { t: 'Лид / ответ', m: 'ratio', a: 'Лиды', b: 'Ответы', fmt: 'pct' },
    { t: 'Показ / лид', m: 'ratio', a: 'Показы', b: 'Лиды', fmt: 'pct' },
    { t: 'Переговоры / показ', m: 'ratio', a: 'Переговоры', b: 'Показы', fmt: 'pct' },
    { t: 'Предложение / переговоры', m: 'ratio', a: 'Предложения', b: 'Переговоры', fmt: 'pct' },
    { t: 'Бронь / предложение', m: 'ratio', a: 'Брони', b: 'Предложения', fmt: 'pct' },
    { t: 'Сделка / бронь', m: 'ratio', a: 'Сделки', b: 'Брони', fmt: 'pct' },
    { t: 'Сделка / лид', m: 'ratio', a: 'Сделки', b: 'Лиды', fmt: 'pct' },
    { t: 'Объявление → контакт', m: 'ratio', a: 'Контакты по объявлениям', b: 'Просмотры объявлений', fmt: 'pct' },
    { t: 'Стоимость лида, ₽', m: 'ratio', a: 'Расходы, ₽', b: 'Лиды', fmt: 'money' },
    { t: 'Действий на 1 лид', m: 'ratio', a: 'Действия', b: 'Лиды', fmt: '0.0' },
    { t: 'Контактов до показа', m: 'ratio', a: 'Контакты', b: 'Показы', fmt: '0.0' },
    { t: 'Показов до переговоров', m: 'ratio', a: 'Показы', b: 'Переговоры', fmt: '0.0' },
  ];
}

function statObjectExtraCols_() {
  return [
    { t: 'Статус', m: 'obj', f: 'status' },
    { t: 'Цена', m: 'obj', f: 'price', fmt: 'money' },
    { t: 'Цена за м²', m: 'obj', f: 'price_m2', fmt: 'money' },
    { t: 'Дней на рынке', m: 'obj', f: 'days_on_market', fmt: '0' },
    { t: 'Дней без активности', m: 'obj', f: 'days_idle', fmt: '0' },
    { t: 'Первая цена', m: 'firstprice', fmt: 'money' },
    { t: 'Изменение цены, ₽', m: 'pricediff', fmt: 'money' },
    { t: 'Изменение цены, %', m: 'pricepct', fmt: 'pct' },
    { t: 'Изменений цены', m: 'pricechanges', fmt: '0' },
  ];
}

function statTotalExtraCols_() {
  return [
    { t: 'Объектов в работе', m: 'objcount', fmt: '0' },
    { t: 'Средн. дней на рынке (в работе)', m: 'objavg', f: 'days_on_market', fmt: '0' },
    { t: 'Средн. дней без активности (в работе)', m: 'objavg', f: 'days_idle', fmt: '0' },
  ];
}

function statsLayout_(gid) {
  const cells = [];
  cells.push({ a1: 'A1', v: 'СТАТИСТИКА — все показатели считаются автоматически', style: 'title' });
  cells.push({ a1: 'A2', v: 'Фильтр по объекту:', style: 'label' });
  cells.push({ a1: 'B2', v: 'Все', style: 'select', validation: { list: 'D.obj_filter' } });
  cells.push({ a1: 'A3', v: 'критерий (служебное)', style: 'muted' });
  cells.push({ a1: 'B3', f: '=IF(OR(B2="",B2="Все"),"*",REGEXEXTRACT(B2,"^(.*?) · "))', style: 'muted' });
  const nav = [['channel', 'C4'], ['object', 'D4'], ['month', 'E4'], ['week', 'F4']];
  cells.push({ a1: 'A4', v: 'Перейти:', style: 'label' });
  nav.forEach(n => {
    const s = STAT_SECTIONS[n[0]];
    cells.push({ a1: n[1], f: '=HYPERLINK("#gid=' + gid + '&range=A' + s.title + '","→ ' + s.label.split(' —')[0] + '")', style: 'link' });
  });

  const formats = [];
  Object.keys(STAT_SECTIONS).forEach(dim => {
    const s = STAT_SECTIONS[dim];
    const cols = statCommonCols_().concat(dim === 'object' ? statObjectExtraCols_() : dim === 'total' ? statTotalExtraCols_() : []);
    cells.push({ a1: 'A' + s.title, v: s.label, style: 'section', spanCols: 3 + cols.length - 1 });
    const keyTitles = {
      total: ['', 'Объект'], channel: ['Канал', 'Группа'], object: ['ID объекта', 'Объект'],
      month: ['Месяц', ''], week: ['Неделя', 'Период'],
    }[dim];
    cells.push({ a1: 'A' + s.header, v: keyTitles[0], style: 'header' });
    cells.push({ a1: 'B' + s.header, v: keyTitles[1], style: 'header' });

    const rng = L => '$' + L + '$' + s.first + ':$' + L + (s.last ? '$' + s.last : '');
    const keys = rng('A');
    const crit = '$B$3';
    const dimMap = {
      total: { ak: '[[ACT.obj_id]]', c: crit },
      object: { ak: '[[ACT.obj_id]]', c: keys },
      channel: { ak: '[[ACT.obj_id]]&"|"&[[ACT.channel]]', c: crit + '&"|"&' + keys },
      week: { ak: '[[ACT.obj_id]]&"|"&[[ACT.week]]', c: crit + '&"|"&' + keys },
      month: { ak: '[[ACT.obj_id]]&"|"&[[ACT.month]]', c: crit + '&"|"&' + keys },
    }[dim];

    // ключи строк
    const keyF = {
      total: null,
      object: '=ARRAYFORMULA(IFERROR(FILTER({[[OBJ.id]],[[OBJ.name]]},[[OBJ.name]]<>"",[[OBJ.id]]<>"",([[OBJ.id]]=$B$3)+($B$3="*")),""))',
      channel: '=ARRAYFORMULA(IFERROR(LET(ch_all,[[ACT.channel]],ob_all,[[ACT.obj_id]],' +
        'ch_u,SORT(UNIQUE(FILTER(ch_all,ch_all<>"",(ob_all=$B$3)+($B$3="*")))),{ch_u,IFERROR(VLOOKUP(ch_u,[[D.channels:tbl]],2,FALSE),"")}),""))',
      week: '=ARRAYFORMULA(IFERROR(LET(wk_all,[[ACT.week]],ob_all,[[ACT.obj_id]],' +
        'wk_u,SORT(UNIQUE(FILTER(wk_all,wk_all<>"",(ob_all=$B$3)+($B$3="*"))),1,FALSE),' +
        '{wk_u,IFERROR(TEXT(VLOOKUP(wk_u,[[D.weeks:tbl]],2,FALSE),"dd.mm")&"–"&TEXT(VLOOKUP(wk_u,[[D.weeks:tbl]],3,FALSE),"dd.mm.yy"),"")}),""))',
      month: '=ARRAYFORMULA(IFERROR(LET(mo_all,[[ACT.month]],ob_all,[[ACT.obj_id]],' +
        'SORT(UNIQUE(FILTER(mo_all,mo_all<>"",(ob_all=$B$3)+($B$3="*"))),1,FALSE)),""))',
    }[dim];
    if (dim === 'total') {
      cells.push({ a1: 'A' + s.first, v: 'Итого', style: 'bold' });
      cells.push({ a1: 'B' + s.first, f: '=IF($B$3="*","Все объекты",IFERROR(VLOOKUP($B$3,{[[OBJ.id]],[[OBJ.name]]},2,FALSE),$B$3))' });
    } else {
      cells.push({ a1: 'A' + s.first, f: keyF });
    }

    const letterOf = {};
    cols.forEach((c, i) => { letterOf[c.t] = colLetter_(3 + i); });
    cols.forEach((c, i) => {
      const L = colLetter_(3 + i);
      cells.push({ a1: L + s.header, v: c.t, style: 'header', note: c.d });
      let e;
      const ak = dimMap.ak, cr = dimMap.c;
      switch (c.m) {
        case 'done': e = 'COUNTIF(' + ak + '&"|"&[[ACT.status_class]],' + cr + '&"|DONE")'; break;
        case 'sum': e = 'SUMIF(' + ak + ',' + cr + ',[[ACT.' + c.f + ']])'; break;
        case 'refusals': e = 'COUNTIF(' + ak + '&"|"&IF([[ACT.refusal]]="","0","1"),' + cr + '&"|1")'; break;
        case 'listing': e = 'SUMIF(' + ak + '&"|"&[[ACT.is_listing]],' + cr + '&"|ДА",[[ACT.' + c.f + ']])'; break;
        case 'ratio': e = 'IFERROR(' + rng(letterOf[c.a]) + '/' + rng(letterOf[c.b]) + ',"")'; break;
        case 'obj': e = 'IFERROR(VLOOKUP(' + keys + ',{[[OBJ.id]],[[OBJ.' + c.f + ']]},2,FALSE),"")'; break;
        case 'firstprice':
          e = 'IFERROR(VLOOKUP(' + keys + '&"|[[TITLE.OBJ.price]]",{[[HIST.obj_id]]&"|"&[[HIST.field]],[[HIST.new]]},2,FALSE),"")';
          break;
        case 'pricediff': e = 'IF(' + rng(letterOf['Первая цена']) + '="","",' + rng(letterOf['Цена']) + '-' + rng(letterOf['Первая цена']) + ')'; break;
        case 'pricepct': e = 'IFERROR(' + rng(letterOf['Изменение цены, ₽']) + '/' + rng(letterOf['Первая цена']) + ',"")'; break;
        case 'pricechanges':
          e = 'COUNTIF([[HIST.obj_id]]&"|"&[[HIST.field]]&"|"&[[HIST.kind]],' + keys + '&"|[[TITLE.OBJ.price]]|' + HIST_KIND.CHANGE + '")';
          break;
        case 'objcount': e = 'COUNTIFS([[OBJ.in_work]],"ДА",[[OBJ.id]],IF($B$3="*","?*",$B$3))'; break;
        case 'objavg': e = 'IFERROR(AVERAGEIFS([[OBJ.' + c.f + ']],[[OBJ.in_work]],"ДА",[[OBJ.id]],IF($B$3="*","?*",$B$3)),"")'; break;
        default: throw new Error('metric ' + c.m);
      }
      cells.push({ a1: L + s.first, f: '=ARRAYFORMULA(IF(' + keys + '="","",' + e + '))' });
      formats.push({ range: rng(L).replace(/\$/g, ''), fmt: c.fmt || '0' });
    });
  });
  return { cells: cells, formats: formats };
}

// ───────────────────────── 04_ВОРОНКА ─────────────────────────
// Воронка и конверсии считаются только из журнала действий 03 (карточек покупателей в системе нет — они в CRM).

const FUN_CH_COL = 5; // E — таблица по каналам

function funnelLayout_() {
  const cells = [];
  cells.push({ a1: 'A1', v: 'ВОРОНКА И КОНВЕРСИИ — считается из 03_ДЕЙСТВИЯ', style: 'title' });
  cells.push({ a1: 'A2', v: 'Объект:', style: 'label' });
  cells.push({ a1: 'B2', v: 'Все', style: 'select', validation: { list: 'D.obj_filter' } });
  cells.push({ a1: 'A3', v: 'Неделя:', style: 'label' });
  cells.push({ a1: 'B3', v: 'Все время', style: 'select', validation: { list: 'D.week_filter' } });
  cells.push({ a1: 'A4', v: 'критерий объекта', style: 'muted' });
  cells.push({ a1: 'B4', f: '=IF(OR(B2="",B2="Все"),"*",REGEXEXTRACT(B2,"^(.*?) · "))', style: 'muted' });
  cells.push({ a1: 'A5', v: 'критерий недели', style: 'muted' });
  cells.push({ a1: 'B5', f: '=IF(OR(B3="",B3="Все время"),"*",REGEXEXTRACT(B3,"^[^ ]+"))', style: 'muted' });
  const oc = '$B$4', wc = '$B$5';
  const act = f => '=SUMIFS([[ACT.' + f + ']],[[ACT.obj_id]],' + oc + ',[[ACT.week]],' + wc + ')';
  const rows = [
    ['actions', 'Действий выполнено', '=COUNTIFS([[ACT.obj_id]],' + oc + ',[[ACT.week]],' + wc + ',[[ACT.status_class]],"DONE")'],
    ['contacts', 'Контакты', act('contacts')],
    ['responses', 'Ответы', act('responses')],
    ['leads', 'Лиды (заинтересовались)', act('interested')],
    ['pres', 'Презентации', act('presentations')],
    ['show', 'Показы', act('showings')],
    ['repeat', 'Повторные контакты', act('repeat_contacts')],
    ['neg', 'Переговоры', act('negotiations')],
    ['offer', 'Предложения', act('offers')],
    ['book', 'Брони', act('bookings')],
    ['deal', 'Сделки', act('deals')],
    ['refusals', 'Отказы (действий с причиной отказа)', '=COUNTIFS([[ACT.obj_id]],' + oc + ',[[ACT.week]],' + wc + ',[[ACT.refusal]],"?*")'],
    ['cost', 'Расходы, ₽', act('cost')],
  ];
  cells.push({ a1: 'A7', v: 'Этап', style: 'header' });
  cells.push({ a1: 'B7', v: 'Количество', style: 'header' });
  const at = {};
  rows.forEach((r, i) => {
    const row = 8 + i;
    at[r[0]] = 'B' + row;
    cells.push({ a1: 'A' + row, v: r[1] });
    cells.push({ a1: 'B' + row, f: r[2], fmt: r[0] === 'cost' ? 'money' : '0' });
  });
  let row = 8 + rows.length + 1;
  cells.push({ a1: 'A' + row, v: 'Конверсия', style: 'header' });
  cells.push({ a1: 'B' + row, v: '%', style: 'header' });
  cells.push({ a1: 'C' + row, v: 'Расчёт', style: 'header' });
  const conv = [
    ['Контакт → ответ', 'responses', 'contacts'],
    ['Ответ → интерес (лид)', 'leads', 'responses'],
    ['Контакт → лид', 'leads', 'contacts'],
    ['Лид → презентация', 'pres', 'leads'],
    ['Презентация → показ', 'show', 'pres'],
    ['Лид → показ', 'show', 'leads'],
    ['Показ → переговоры', 'neg', 'show'],
    ['Переговоры → предложение', 'offer', 'neg'],
    ['Предложение → бронь', 'book', 'offer'],
    ['Бронь → сделка', 'deal', 'book'],
    ['Общая конверсия лид → сделка', 'deal', 'leads'],
  ];
  const convCells = {};
  conv.forEach(c => {
    row++;
    cells.push({ a1: 'A' + row, v: c[0] });
    cells.push({ a1: 'B' + row, f: '=IFERROR(' + at[c[1]] + '/' + at[c[2]] + ',"")', fmt: 'pct' });
    cells.push({ a1: 'C' + row, f: '=' + at[c[1]] + '&" из "&' + at[c[2]], style: 'muted' });
    convCells[c[0]] = 'B' + row;
  });
  row++;
  cells.push({ a1: 'A' + row, v: 'Стоимость лида, ₽' });
  cells.push({ a1: 'B' + row, f: '=IFERROR(' + at.cost + '/' + at.leads + ',"")', fmt: 'money' });
  convCells['Стоимость лида'] = 'B' + row;

  // причины отказов
  row += 2;
  const refRow = row;
  cells.push({ a1: 'A' + row, v: 'ПРИЧИНЫ ОТКАЗОВ (возражения рынка)', style: 'section', spanCols: 3 });
  cells.push({ a1: 'A' + (row + 1), f: '=IFERROR(QUERY(FILTER([[ACT.refusal]],[[ACT.refusal]]<>"",([[ACT.obj_id]]=' + oc + ')+(' + oc + '="*"),([[ACT.week]]=' + wc + ')+(' + wc + '="*")),' +
    '"select Col1, count(Col1) group by Col1 order by count(Col1) desc label Col1 \'Причина\', count(Col1) \'Раз\'",0),"Отказов не зафиксировано")' });

  // по каналам
  const chCols = [
    ['Канал', null],
    ['Действия', k => 'COUNTIF(KEYA_&"|"&[[ACT.status_class]],KEYC_&"|DONE")', '0'],
    ['Контакты', k => 'SUMIF(KEYA_,KEYC_,[[ACT.contacts]])', '0'],
    ['Ответы', k => 'SUMIF(KEYA_,KEYC_,[[ACT.responses]])', '0'],
    ['Лиды', k => 'SUMIF(KEYA_,KEYC_,[[ACT.interested]])', '0'],
    ['Показы', k => 'SUMIF(KEYA_,KEYC_,[[ACT.showings]])', '0'],
    ['Переговоры', k => 'SUMIF(KEYA_,KEYC_,[[ACT.negotiations]])', '0'],
    ['Сделки', k => 'SUMIF(KEYA_,KEYC_,[[ACT.deals]])', '0'],
    ['Отказы', k => 'COUNTIF(KEYA_&"|"&IF([[ACT.refusal]]="","0","1"),KEYC_&"|1")', '0'],
    ['Расходы, ₽', k => 'SUMIF(KEYA_,KEYC_,[[ACT.cost]])', 'money'],
    ['Контакт → лид', 'ratio', 'pct', 'Лиды', 'Контакты'],
    ['Лид → показ', 'ratio', 'pct', 'Показы', 'Лиды'],
    ['Стоимость лида, ₽', 'ratio', 'money', 'Расходы, ₽', 'Лиды'],
  ];
  const E = colLetter_(FUN_CH_COL);
  cells.push({ a1: E + '6', v: 'ПО КАНАЛАМ — какой канал даёт результат (тот же фильтр)', style: 'section', spanCols: chCols.length });
  const keys = '$' + E + '$8:$' + E;
  const keyA = '[[ACT.obj_id]]&"|"&[[ACT.week]]&"|"&[[ACT.channel]]';
  const keyC = oc + '&"|"&' + wc + '&"|"&' + keys;
  const letter = {};
  chCols.forEach((c, i) => { letter[c[0]] = colLetter_(FUN_CH_COL + i); });
  const formats = [];
  chCols.forEach((c, i) => {
    const L = colLetter_(FUN_CH_COL + i);
    cells.push({ a1: L + '7', v: c[0], style: 'header' });
    let f;
    if (i === 0) {
      f = '=ARRAYFORMULA(IFERROR(SORT(UNIQUE(FILTER([[ACT.channel]],[[ACT.channel]]<>"",([[ACT.obj_id]]=' + oc + ')+(' + oc + '="*"),([[ACT.week]]=' + wc + ')+(' + wc + '="*")))),""))';
    } else if (c[1] === 'ratio') {
      const r = x => '$' + letter[x] + '$8:$' + letter[x];
      f = '=ARRAYFORMULA(IF(' + keys + '="","",IFERROR(' + r(c[3]) + '/' + r(c[4]) + ',"")))';
    } else {
      f = '=ARRAYFORMULA(IF(' + keys + '="","",' + c[1]().replace(/KEYA_/g, keyA).replace(/KEYC_/g, keyC) + '))';
    }
    cells.push({ a1: L + '8', f: f });
    const fmt = c[1] === 'ratio' ? c[2] : c[2];
    if (fmt) formats.push({ range: L + '8:' + L, fmt: fmt });
  });
  return { cells: cells, at: at, conv: convCells, formats: formats, refRow: refRow, chLetter: letter, selObj: 'B2', selWeek: 'B3' };
}

// ───────────────────────── блок итогов в 06_ПЛАН_ФАКТ ─────────────────────────

function pfBlockLayout_() {
  const start = sheetSpecs_().PF.fields.length + 2;
  const A = colLetter_(start), B = colLetter_(start + 1), C = colLetter_(start + 2), D = colLetter_(start + 3);
  const cells = [];
  cells.push({ a1: A + '1', v: 'ПЛАН-ФАКТ НЕДЕЛИ', style: 'section', spanCols: 4 });
  cells.push({ a1: A + '2', v: 'Неделя (пусто = текущая):', style: 'label' });
  cells.push({ a1: B + '2', v: '', style: 'select', validation: { list: 'D.weeks:c4' } });
  cells.push({ a1: A + '3', v: 'Объект:', style: 'label' });
  cells.push({ a1: B + '3', v: 'Все', style: 'select', validation: { list: 'D.obj_filter' } });
  cells.push({ a1: A + '4', v: 'ключ недели', style: 'muted' });
  cells.push({ a1: B + '4', f: '=IF(' + B + '2="",' + CURRENT_WEEK_F_ + ',REGEXEXTRACT(' + B + '2,"^[^ ]+"))', style: 'muted' });
  cells.push({ a1: A + '5', v: 'критерий объекта', style: 'muted' });
  cells.push({ a1: B + '5', f: '=IF(OR(' + B + '3="",' + B + '3="Все"),"*",REGEXEXTRACT(' + B + '3,"^(.*?) · "))', style: 'muted' });
  const wk = '$' + B + '$4', oc = '$' + B + '$5';
  const pfc = extra => '=COUNTIFS([[PF.week]],' + wk + ',[[PF.obj_id]],' + oc + ',' + extra + ')';
  cells.push({ a1: A + '7', v: 'Задачи недели', style: 'header' });
  cells.push({ a1: B + '7', v: 'Значение', style: 'header' });
  const rows = [
    ['total', 'Задач в плане (без отменённых)', pfc('[[PF.status_class]],"<>CANCEL"'), '0'],
    ['done', 'Выполнено', pfc('[[PF.status_class]],"DONE"'), '0'],
    ['pct', '% выполнения плана', null, 'pct'],
    ['moved', 'Перенесено', pfc('[[PF.status_class]],"MOVED"'), '0'],
    ['fail', 'Не выполнено', pfc('[[PF.status_class]],"FAIL"'), '0'],
    ['open', 'Открыто (запланировано / в работе)', pfc('[[PF.status_class]],"OPEN"'), '0'],
    ['overdue', 'Просрочено', pfc('[[PF.overdue]],"ПРОСРОЧЕНО"'), '0'],
  ];
  const at = {};
  rows.forEach((r, i) => { at[r[0]] = B + (8 + i); });
  rows.forEach((r, i) => {
    const row = 8 + i;
    cells.push({ a1: A + row, v: r[1], style: r[0] === 'pct' ? 'bold' : null });
    const f = r[0] === 'pct' ? '=IFERROR(' + at.done + '/' + at.total + ',"")' : r[2];
    cells.push({ a1: B + row, f: f, fmt: r[3], style: r[0] === 'pct' ? 'bold' : null });
  });
  let row = 8 + rows.length + 1;
  cells.push({ a1: A + row, v: 'KPI', style: 'header' });
  cells.push({ a1: B + row, v: 'План', style: 'header' });
  cells.push({ a1: C + row, v: 'Факт', style: 'header' });
  cells.push({ a1: D + row, v: '% выполнения', style: 'header' });
  const kpiRows = {};
  KPI_SOURCES.forEach((k, i) => {
    row++;
    const lbl = A + row;
    cells.push({ a1: lbl, f: '=[[D.kpi_metrics:' + (i + 1) + ']]' });
    cells.push({ a1: B + row, f: '=SUMIFS([[PF.kpi_plan]],[[PF.kpi_metric]],' + lbl + ',[[PF.week]],' + wk + ',[[PF.obj_id]],' + oc + ')', fmt: '0' });
    let fact;
    if (k.count) fact = '=COUNTIFS([[ACT.week]],' + wk + ',[[ACT.obj_id]],' + oc + ',[[ACT.status_class]],"DONE")';
    else fact = '=SUMIFS([[ACT.' + k.act + ']],[[ACT.week]],' + wk + ',[[ACT.obj_id]],' + oc + ')';
    cells.push({ a1: C + row, f: fact, fmt: '0' });
    cells.push({ a1: D + row, f: '=IF(' + B + row + '=0,"",IFERROR(' + C + row + '/' + B + row + ',""))', fmt: 'pct' });
    kpiRows[k.title] = row;
  });
  return { cells: cells, startCol: start, at: at, kpiRows: kpiRows, cols: { A: A, B: B, C: C, D: D }, selWeek: B + '2', selObj: B + '3' };
}

// ───────────────────────── 07_ОТЧЕТ ─────────────────────────

const REP_PARAMS = { id: '$E$3', wk: '$E$4', start: '$E$5', end: '$E$6', next: '$E$7' };

function reportRows_() {
  const P = REP_PARAMS;
  const actCond = '[[ACT.obj_id]]=' + P.id + ',[[ACT.week]]=' + P.wk;
  const rep = '[[ACT.to_report]]=TRUE';
  const sumAct = f => '=IF(' + P.id + '="","",SUMIFS([[ACT.' + f + ']],[[ACT.obj_id]],' + P.id + ',[[ACT.week]],' + P.wk + '))';
  const conv = (label, num, den) => 'IF(N([[R.' + den + ']])>0,"' + label + ': "&TEXT([[R.' + num + ']]/[[R.' + den + ']],"0%")&" ("&[[R.' + num + ']]&" из "&[[R.' + den + ']]&")","")';
  return [
    { ph: 'OBJECT', label: 'Объект', f: '=IFERROR(VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.name]]},2,FALSE),"")' },
    { ph: 'ADDRESS', label: 'Адрес', f: '=IFERROR(VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.address]]},2,FALSE),"")' },
    { ph: 'PERIOD', label: 'Период отчёта', f: '=IF(' + P.start + '="","",TEXT(' + P.start + ',"dd.mm")&"–"&TEXT(' + P.end + ',"dd.mm.yyyy"))' },
    { ph: 'PRICE', label: 'Цена', f: '=IFERROR(TEXT(VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.price]]},2,FALSE),"#,##0")&" ₽","")' },
    { ph: 'DAYS_ON_MARKET', label: 'Дней в экспозиции', f: '=IFERROR(MIN(TODAY(),' + P.end + ',IFERROR(1/(1/VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.close_date]]},2,FALSE)),TODAY()))-VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.date_sign]]},2,FALSE),"")' },
    { ph: 'ACTIONS', label: 'Количество действий', f: '=IF(' + P.id + '="","",COUNTIFS([[ACT.obj_id]],' + P.id + ',[[ACT.week]],' + P.wk + ',[[ACT.status_class]],"DONE",[[ACT.to_report]],TRUE))' },
    { ph: 'CHANNELS', label: 'Основные каналы', f: '=IFERROR(ARRAYFORMULA(TEXTJOIN(", ",TRUE,UNIQUE(FILTER([[ACT.channel]],' + actCond + ',[[ACT.status_class]]="DONE",' + rep + ',[[ACT.channel]]<>"")))),"—")' },
    {
      ph: 'DONE', label: 'Что было сделано', list: true,
      f: '=IF(' + P.id + '="","Выберите объект и неделю",IFERROR(ARRAYFORMULA(LET(sel_,FILTER({[[ACT.date]],TEXT([[ACT.date]],"dd.mm")&" — "&[[ACT.type]]&": "&IF([[ACT.fact]]="",[[ACT.goal]],[[ACT.fact]])},' +
        actCond + ',[[ACT.status_class]]="DONE",' + rep + '),TEXTJOIN(CHAR(10),TRUE,INDEX(SORT(sel_,1,TRUE),0,2)))),"На этой неделе действий не зафиксировано."))',
    },
    { ph: 'CONTACTS', label: 'Контакты', f: sumAct('contacts') },
    { ph: 'RESPONSES', label: 'Ответы', f: sumAct('responses') },
    { ph: 'INTERESTED', label: 'Заинтересовались (лиды)', f: sumAct('interested') },
    { ph: 'PRESENTATIONS', label: 'Презентации', f: sumAct('presentations') },
    { ph: 'SHOWINGS', label: 'Показы', f: sumAct('showings') },
    { ph: 'NEGOTIATIONS', label: 'Переговоры', f: sumAct('negotiations') },
    { ph: 'OFFERS', label: 'Предложения', f: sumAct('offers') },
    { ph: 'BOOKINGS', label: 'Брони', f: sumAct('bookings') },
    { ph: 'DEALS', label: 'Сделки', f: sumAct('deals') },
    {
      ph: 'CONVERSIONS', label: 'Конверсии', list: true,
      f: '=IF(' + P.id + '="","",TEXTJOIN(CHAR(10),TRUE,' +
        '"Воронка недели: контакты "&[[R.CONTACTS]]&" → ответы "&[[R.RESPONSES]]&" → заинтересовались "&[[R.INTERESTED]]&" → презентации "&[[R.PRESENTATIONS]]&" → показы "&[[R.SHOWINGS]]&" → переговоры "&[[R.NEGOTIATIONS]],' +
        conv('Контакт → ответ', 'RESPONSES', 'CONTACTS') + ',' +
        conv('Ответ → интерес', 'INTERESTED', 'RESPONSES') + ',' +
        conv('Интерес → презентация', 'PRESENTATIONS', 'INTERESTED') + ',' +
        conv('Презентация → показ', 'SHOWINGS', 'PRESENTATIONS') + ',' +
        conv('Показ → переговоры', 'NEGOTIATIONS', 'SHOWINGS') + ',' +
        conv('Переговоры → предложение', 'OFFERS', 'NEGOTIATIONS') + ',' +
        conv('Предложение → бронь', 'BOOKINGS', 'OFFERS') + ',' +
        conv('Бронь → сделка', 'DEALS', 'BOOKINGS') + '))',
    },
    {
      ph: 'MARKET_FEEDBACK', label: 'Что показал рынок', list: true,
      f: '=IFERROR(ARRAYFORMULA(TEXTJOIN(CHAR(10),TRUE,UNIQUE(FILTER([[ACT.feedback]],' + actCond + ',' + rep + ',[[ACT.feedback]]<>"")))),"Существенной обратной связи от рынка за неделю не получено.")',
    },
    {
      ph: 'TESTS', label: 'Что протестировали на рынке', list: true,
      f: '=IFERROR(ARRAYFORMULA(TEXTJOIN(CHAR(10),TRUE,FILTER([[HYP.hypothesis]]&" — "&IF([[HYP.channel]]="","",[[HYP.channel]]&", ")&LOWER([[HYP.metric]])&": "&[[HYP.fact]]&" при цели "&[[HYP.target]]&" ("&IF([[HYP.status]]="","в проверке",LOWER([[HYP.status]]))&")"&IF([[HYP.conclusion]]="","",". "&[[HYP.conclusion]]),' +
        '[[HYP.obj_id]]=' + P.id + ',[[HYP.to_report]]=TRUE,[[HYP.hypothesis]]<>"",[[HYP.date_start]]<=' + P.end + ',([[HYP.date_end]]="")+([[HYP.date_end]]>=' + P.start + '),[[HYP.status_class]]<>"CANCEL"))),"На этой неделе новые гипотезы не проверялись.")',
    },
    {
      ph: 'OBJECTIONS', label: 'Какие возражения получили', list: true,
      f: '=IFERROR(ARRAYFORMULA(LET(r_nb,FILTER([[ACT.refusal]],' + actCond + ',' + rep + ',[[ACT.refusal]]<>""),' +
        'r_q,QUERY(r_nb,"select Col1, count(Col1) group by Col1 order by count(Col1) desc label count(Col1) \'\'",0),' +
        'TEXTJOIN(CHAR(10),TRUE,INDEX(r_q,0,1)&" — "&INDEX(r_q,0,2)))),"Возражений не зафиксировано.")',
    },
    {
      ph: 'CONCLUSIONS', label: 'Какие выводы сделали', list: true,
      f: '=IFERROR(ARRAYFORMULA(LET(c_act,IFERROR(FILTER([[ACT.conclusion]],' + actCond + ',' + rep + ',[[ACT.conclusion]]<>""),""),' +
        'c_pf,IFERROR(FILTER([[PF.conclusion]],[[PF.obj_id]]=' + P.id + ',[[PF.week]]=' + P.wk + ',[[PF.to_report]]=TRUE,[[PF.conclusion]]<>""),""),' +
        'c_all,{c_act;c_pf},TEXTJOIN(CHAR(10),TRUE,UNIQUE(FILTER(c_all,c_all<>""))))),"Выводы будут сформированы по итогам следующих действий.")',
    },
    {
      ph: 'STRATEGY_CHANGES', label: 'Что изменили в стратегии', list: true,
      f: '=IFERROR(ARRAYFORMULA(LET(h_str,IFERROR(FILTER([[HIST.field]]&": "&[[HIST.new]],[[HIST.obj_id]]=' + P.id + ',[[HIST.sheet]]="[[NAME.STR]]",' +
        '[[HIST.ts]]>=' + P.start + ',[[HIST.ts]]<' + P.end + '+1,ISNUMBER(MATCH([[HIST.field]],[[D.strategy_client_fields]],0))),""),' +
        'h_price,IFERROR(FILTER("Цена скорректирована: "&TEXT([[HIST.old]],"#,##0")&" → "&TEXT([[HIST.new]],"#,##0")&" ₽",[[HIST.obj_id]]=' + P.id + ',' +
        '[[HIST.field]]="[[TITLE.OBJ.price]]",[[HIST.kind]]="' + HIST_KIND.CHANGE + '",[[HIST.ts]]>=' + P.start + ',[[HIST.ts]]<' + P.end + '+1),""),' +
        'h_all,{h_price;h_str},TEXTJOIN(CHAR(10),TRUE,UNIQUE(FILTER(h_all,h_all<>""))))),"Стратегия без изменений — продолжаем работу по утверждённому плану.")',
    },
    {
      ph: 'NEXT_WEEK', label: 'Что планируем на следующую неделю', list: true,
      f: '=IFERROR(ARRAYFORMULA(TEXTJOIN(CHAR(10),TRUE,UNIQUE(FILTER(IF([[PF.task]]="",[[PF.week_goal]],[[PF.task]]),[[PF.obj_id]]=' + P.id + ',[[PF.week]]=' + P.next + ',' +
        '[[PF.status_class]]<>"CANCEL",[[PF.to_report]]=TRUE,([[PF.task]]<>"")+([[PF.week_goal]]<>""))))),' +
        'IFERROR(ARRAYFORMULA(TEXTJOIN(CHAR(10),TRUE,UNIQUE(FILTER([[ACT.next_step]],' + actCond + ',' + rep + ',[[ACT.next_step]]<>"")))),"План следующей недели в работе."))',
    },
    {
      ph: 'NEXT_WEEK_KPI', label: 'KPI следующей недели', list: true,
      f: '=IFERROR(ARRAYFORMULA(LET(k_q,QUERY(FILTER({[[PF.kpi_metric]],[[PF.kpi_plan]]},[[PF.obj_id]]=' + P.id + ',[[PF.week]]=' + P.next + ',[[PF.kpi_metric]]<>"",[[PF.status_class]]<>"CANCEL"),' +
        '"select Col1, sum(Col2) group by Col1 label sum(Col2) \'\'",0),TEXTJOIN(CHAR(10),TRUE,INDEX(k_q,0,1)&": "&INDEX(k_q,0,2)))),"Целевые показатели будут согласованы в начале недели.")',
    },
    { ph: 'MANAGER_COMMENT', label: 'Комментарий руководителя', f: '=IF($B$5="","—",$B$5)' },
  ];
}

function reportInternalRows_() {
  const P = REP_PARAMS;
  return [
    { label: '% выполнения плана недели', f: '=IFERROR(COUNTIFS([[PF.obj_id]],' + P.id + ',[[PF.week]],' + P.wk + ',[[PF.status_class]],"DONE")/COUNTIFS([[PF.obj_id]],' + P.id + ',[[PF.week]],' + P.wk + ',[[PF.status_class]],"<>CANCEL"),"")', fmt: 'pct' },
    { label: 'Действий, скрытых из отчёта', f: '=IF(' + P.id + '="","",COUNTIFS([[ACT.obj_id]],' + P.id + ',[[ACT.week]],' + P.wk + ',[[ACT.to_report]],FALSE,[[ACT.date]],"<>"))' },
    { label: 'Внутренние комментарии к действиям', f: '=IFERROR(ARRAYFORMULA(TEXTJOIN(CHAR(10),TRUE,FILTER([[ACT.id]]&": "&[[ACT.comment]],[[ACT.obj_id]]=' + P.id + ',[[ACT.week]]=' + P.wk + ',[[ACT.comment]]<>""))),"—")' },
    { label: 'Комментарий руководителя в реестре', f: '=IFERROR(VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.manager_comment]]},2,FALSE),"")' },
    { label: 'Причины невыполнения задач', f: '=IFERROR(ARRAYFORMULA(TEXTJOIN(CHAR(10),TRUE,FILTER([[PF.task]]&": "&[[PF.fail_reason]],[[PF.obj_id]]=' + P.id + ',[[PF.week]]=' + P.wk + ',[[PF.fail_reason]]<>""))),"—")' },
  ];
}

const REP_FIRST_ROW = 11;

function reportLayout_() {
  const P = REP_PARAMS;
  const cells = [];
  cells.push({ a1: 'A1', v: 'ОТЧЁТ КЛИЕНТУ — выберите объект и неделю, проверьте текст и нажмите «Создать отчёт»', style: 'title' });
  cells.push({ a1: 'A3', v: 'Объект:', style: 'label' });
  cells.push({ a1: 'B3', v: '', style: 'select', validation: { list: 'D.obj_labels' } });
  cells.push({ a1: 'A4', v: 'Неделя:', style: 'label' });
  cells.push({ a1: 'B4', v: '', style: 'select', validation: { list: 'D.weeks:c4' } });
  cells.push({ a1: 'A5', v: 'Комментарий руководителя для клиента:', style: 'label' });
  cells.push({ a1: 'B5', v: '', style: 'select', note: 'Вводится вручную перед созданием отчёта. Сохраняется в 13_АРХИВ_ОТЧЕТОВ.' });
  cells.push({ a1: 'D2', v: 'Служебное', style: 'muted' });
  const params = [
    ['D3', 'ID объекта', 'E3', '=IFERROR(REGEXEXTRACT(B3,"^(.*?) · "),"")'],
    ['D4', 'Ключ недели', 'E4', '=IFERROR(REGEXEXTRACT(B4,"^[^ ]+"),"")'],
    ['D5', 'Начало', 'E5', '=IFERROR(VLOOKUP(E4,[[D.weeks:tbl]],2,FALSE),"")'],
    ['D6', 'Конец', 'E6', '=IF(E5="","",E5+6)'],
    ['D7', 'Следующая неделя', 'E7', '=IF(E5="","",YEAR(E5+10)&"-W"&TEXT(ISOWEEKNUM(E5+7),"00"))'],
  ];
  params.forEach(p => {
    cells.push({ a1: p[0], v: p[1], style: 'muted' });
    cells.push({ a1: p[2], f: p[3], style: 'muted', fmt: (p[2] === 'E5' || p[2] === 'E6') ? 'date' : null });
  });
  cells.push({ a1: 'A9', v: 'ПРЕДПРОСМОТР — только то, что увидит клиент', style: 'section', spanCols: 3 });
  cells.push({ a1: 'A10', v: 'Раздел', style: 'header' });
  cells.push({ a1: 'B10', v: 'Содержание', style: 'header' });
  cells.push({ a1: 'C10', v: 'Placeholder', style: 'header' });
  const rows = reportRows_();
  const rowOf = {};
  rows.forEach((r, i) => { rowOf[r.ph] = REP_FIRST_ROW + i; });
  const extra = {};
  Object.keys(rowOf).forEach(ph => { extra[ph] = '$B$' + rowOf[ph]; });
  rows.forEach(r => {
    const row = rowOf[r.ph];
    const f = r.f.replace(/\[\[R\.([A-Z_]+)\]\]/g, (m, ph) => extra[ph]);
    cells.push({ a1: 'A' + row, v: r.label, style: 'bold' });
    cells.push({ a1: 'B' + row, f: f, style: 'wrap' });
    cells.push({ a1: 'C' + row, v: '{{' + r.ph + '}}', style: 'muted' });
  });
  let row = REP_FIRST_ROW + rows.length + 1;
  cells.push({ a1: 'A' + row, v: 'ВНУТРЕННЕЕ — в отчёт НЕ попадает', style: 'section', spanCols: 3 });
  reportInternalRows_().forEach(r => {
    row++;
    cells.push({ a1: 'A' + row, v: r.label, style: 'bold' });
    cells.push({ a1: 'B' + row, f: r.f, style: 'wrap', fmt: r.fmt || null });
  });
  return { cells: cells, rowOf: rowOf, params: P, lastRow: row };
}

// ───────────────────────── 11_КОНТРОЛЬ ─────────────────────────

const CTRL_FIRST = 3; // первая строка данных (1 — заголовок блока, 2 — шапка)
const CTRL_MON_START = 11; // столбец K — начало таблицы мониторинга по объектам

function ctrlMonitorCols_() {
  const K = '[[X.K]]';
  const col = t => '[[X.' + t + ']]';
  return [
    { k: 'id', t: 'ID объекта', key: true, f: '=IFERROR(FILTER([[OBJ.id]],[[OBJ.id]]<>"",[[OBJ.in_work]]="ДА"),"")' },
    { k: 'name', t: 'Объект', e: 'IFERROR(VLOOKUP(' + K + ',{[[OBJ.id]],[[OBJ.name]]},2,FALSE),"")' },
    { k: 'owner', t: 'Ответственный', e: 'IFERROR(VLOOKUP(' + K + ',{[[OBJ.id]],[[OBJ.manager]]},2,FALSE),"")' },
    { k: 'idle', t: 'Дней без активности', e: 'IFERROR(VLOOKUP(' + K + ',{[[OBJ.id]],[[OBJ.days_idle]]},2,FALSE),"")', fmt: '0' },
    { k: 'last_lead', t: 'Последний интерес (лид)', e: 'IFERROR(VLOOKUP(' + K + ',SORT(FILTER({[[ACT.obj_id]],[[ACT.date]]},[[ACT.interested]]>0),2,FALSE),2,FALSE),"")', fmt: 'date' },
    { k: 'no_leads', t: 'Дней без новых лидов', e: 'IF(' + col('last_lead') + '="",IFERROR(TODAY()-VLOOKUP(' + K + ',{[[OBJ.id]],[[OBJ.date_sign]]},2,FALSE),""),TODAY()-' + col('last_lead') + ')', fmt: '0' },
    { k: 'c_r', t: 'Контакты (посл. период)', e: 'SUMIF([[ACT.obj_id]]&"|"&[[ACT.window]],' + K + '&"|R",[[ACT.contacts]])', fmt: '0' },
    { k: 'l_r', t: 'Лиды (посл. период)', e: 'SUMIF([[ACT.obj_id]]&"|"&[[ACT.window]],' + K + '&"|R",[[ACT.interested]])', fmt: '0' },
    { k: 'cv_r', t: 'Конв. контакт→лид (посл.)', e: 'IFERROR(' + col('l_r') + '/' + col('c_r') + ',0)', fmt: 'pct' },
    { k: 'c_p', t: 'Контакты (пред. период)', e: 'SUMIF([[ACT.obj_id]]&"|"&[[ACT.window]],' + K + '&"|P",[[ACT.contacts]])', fmt: '0' },
    { k: 'l_p', t: 'Лиды (пред. период)', e: 'SUMIF([[ACT.obj_id]]&"|"&[[ACT.window]],' + K + '&"|P",[[ACT.interested]])', fmt: '0' },
    { k: 'cv_p', t: 'Конв. контакт→лид (пред.)', e: 'IFERROR(' + col('l_p') + '/' + col('c_p') + ',0)', fmt: 'pct' },
    {
      k: 'drop', t: 'Падение конверсии',
      e: 'IF((' + col('c_r') + '>=[[CFG.MIN_CONTACTS]])*(' + col('c_p') + '>=[[CFG.MIN_CONTACTS]])*(' + col('cv_p') + '>0)*(' + col('cv_r') + '<' + col('cv_p') + '*(1-[[CFG.CONV_DROP]])),"ДА","")',
    },
    { k: 'refusals', t: 'Отказов за окно сравнения', e: 'COUNTIF([[ACT.obj_id]]&"|"&[[ACT.window]]&"|"&IF([[ACT.refusal]]="","0","1"),' + K + '&"|R|1")+COUNTIF([[ACT.obj_id]]&"|"&[[ACT.window]]&"|"&IF([[ACT.refusal]]="","0","1"),' + K + '&"|P|1")', fmt: '0' },
    { k: 'review', t: 'Дата пересмотра стратегии', e: 'IFERROR(VLOOKUP(' + K + ',{[[STR.obj_id]],[[STR.review_date]]},2,FALSE),"")', fmt: 'date' },
    { k: 'next_report', t: 'Следующий отчёт', e: 'IFERROR(VLOOKUP(' + K + ',{[[OBJ.id]],[[OBJ.next_report]]},2,FALSE),"")', fmt: 'date' },
    { k: 'to_end', t: 'Дней до конца эксклюзива', e: 'LET(e_d,IFERROR(VLOOKUP(' + K + ',{[[OBJ.id]],[[OBJ.date_end]]},2,FALSE),""),IF(e_d="","",e_d-TODAY()))', fmt: '0' },
    { k: 'need_change', t: 'Флаг «изменить стратегию»', e: 'IFERROR(VLOOKUP(' + K + ',{[[STR.obj_id]],[[STR.need_change]]},2,FALSE),FALSE)' },
  ];
}

function ctrlLayout_() {
  const cells = [];
  const mon = ctrlMonitorCols_();
  const letter = {};
  mon.forEach((c, i) => { letter[c.k] = colLetter_(CTRL_MON_START + i); });
  const rngOf = k => '$' + letter[k] + '$' + CTRL_FIRST + ':$' + letter[k];
  const extra = {};
  mon.forEach(c => { extra[c.k] = rngOf(c.k); });
  extra.K = rngOf('id');

  cells.push({ a1: 'A1', v: 'ПРЕДУПРЕЖДЕНИЯ — обновляются автоматически', style: 'section', spanCols: 8 });
  ['Критичность', 'Тип', 'ID объекта', 'Объект', 'Что случилось', 'Ответственный', 'Срок / дата', 'Где исправить'].forEach((t, i) => {
    cells.push({ a1: colLetter_(1 + i) + '2', v: t, style: 'header' });
  });
  cells.push({ a1: colLetter_(CTRL_MON_START) + '1', v: 'МОНИТОРИНГ ОБЪЕКТОВ В РАБОТЕ (основа для предупреждений)', style: 'section', spanCols: mon.length });
  mon.forEach(c => {
    cells.push({ a1: letter[c.k] + '2', v: c.t, style: 'header' });
    const f = c.key ? c.f : '=ARRAYFORMULA(IF(' + extra.K + '="","",' + c.e + '))';
    cells.push({ a1: letter[c.k] + CTRL_FIRST, f: resolveF_(f, { extra: extra }), fmt: c.fmt || null });
  });
  cells.push({ a1: 'A' + CTRL_FIRST, f: alertsFormula_(extra) });
  return { cells: cells, monLetter: letter };
}

/** Одна формула собирает все предупреждения в общий список, сортирует по критичности. */
function alertsFormula_(m) {
  const blocks = [];
  const t = s => '"' + s + '"';
  const on = (rng, s) => 'IF(ROW(' + rng + '),' + t(s) + ')'; // растянуть строку-константу на весь столбец
  const K = m.K;
  const fmtD = x => 'IFERROR(TEXT(' + x + ',"dd.mm.yyyy"),"")';
  const monBlock = (sev, type, what, when, where, cond) =>
    'IFERROR(FILTER({' + on(K, sev) + ',' + on(K, type) + ',' + K + ',' + m.name + ',' + what + ',' + m.owner + ',' + when + ',' + on(K, where) + '},' + K + '<>"",' + cond + '),E_)';

  blocks.push(monBlock(SEVERITY.HIGH, ALERT.IDLE_HIGH, '"Нет действий "&' + m.idle + '&" дн. (порог "&CFG_NO_ACTIVITY_DAYS&")"', on(K, ''), SHEET_NAMES.ACT, m.idle + '>CFG_NO_ACTIVITY_DAYS'));
  blocks.push(monBlock(SEVERITY.MID, ALERT.IDLE_WARN, '"Нет действий "&' + m.idle + '&" дн."', on(K, ''), SHEET_NAMES.ACT, '(' + m.idle + '>CFG_WARN_ACTIVITY_DAYS)*(' + m.idle + '<=CFG_NO_ACTIVITY_DAYS)'));
  blocks.push(monBlock(SEVERITY.HIGH, ALERT.EXCL_END, 'IF(' + m.to_end + '<0,"Эксклюзив истёк "&-' + m.to_end + '&" дн. назад","До окончания эксклюзива "&' + m.to_end + '&" дн.")', 'IFERROR(TEXT(TODAY()+' + m.to_end + ',"dd.mm.yyyy"),"")', SHEET_NAMES.OBJ, '(' + m.to_end + '<>"")*(' + m.to_end + '<=CFG_EXCL_END_WARN_DAYS)'));
  blocks.push(monBlock(SEVERITY.MID, ALERT.REPORT_DUE, '"Отчёт клиенту должен быть готов"', fmtD(m.next_report), SHEET_NAMES.REP, '(' + m.next_report + '<>"")*(' + m.next_report + '<=TODAY())'));
  blocks.push(monBlock(SEVERITY.MID, ALERT.NO_LEADS, '"Нет новых заинтересованных "&' + m.no_leads + '&" дн."', fmtD(m.last_lead), SHEET_NAMES.ACT, '(' + m.no_leads + '<>"")*(' + m.no_leads + '>CFG_NO_LEADS_DAYS)'));
  blocks.push(monBlock(SEVERITY.MID, ALERT.CONV_DROP, '"Контакт→интерес: было "&TEXT(' + m.cv_p + ',"0%")&", стало "&TEXT(' + m.cv_r + ',"0%")', on(K, ''), SHEET_NAMES.STAT, m.drop + '="ДА"'));
  blocks.push(monBlock(SEVERITY.MID, ALERT.MANY_LOST, '"Отказов за последние "&(CFG_RECENT_DAYS+CFG_COMPARE_DAYS)&" дн.: "&' + m.refusals, on(K, ''), SHEET_NAMES.FUN, m.refusals + '>=CFG_MANY_REFUSALS'));
  blocks.push(monBlock(SEVERITY.MID, ALERT.STRATEGY_OLD, 'IF(' + m.review + '="","Дата пересмотра стратегии не указана","Пересмотр был "&TEXT(' + m.review + ',"dd.mm.yyyy"))', fmtD(m.review), SHEET_NAMES.STR, 'IF(' + m.review + '="",TRUE,TODAY()-' + m.review + '>CFG_STRATEGY_REVIEW_DAYS)'));
  blocks.push(monBlock(SEVERITY.MID, ALERT.STRATEGY_FLAG, '"Отмечено вручную в 02_СТРАТЕГИЯ"', on(K, ''), SHEET_NAMES.STR, m.need_change + '=TRUE'));

  // гипотезы, по которым пора подвести итог
  const HYo = '[[HYP.obj_id]]';
  blocks.push('IFERROR(FILTER({' + on(HYo, SEVERITY.MID) + ',' + on(HYo, ALERT.HYP_DUE) + ',' + HYo + ',[[HYP.obj_name]],[[HYP.id]]&" «"&LEFT([[HYP.hypothesis]],80)&"» — факт "&[[HYP.fact]]&" из "&[[HYP.target]],' + on(HYo, '') + ',' + fmtD('[[HYP.date_end]]') + ',' + on(HYo, SHEET_NAMES.HYP) + '},[[HYP.due]]="ДА"),E_)');

  // объекты без ID / с повторяющимся ID
  const OBn = '[[OBJ.name]]';
  blocks.push('IFERROR(FILTER({' + on(OBn, SEVERITY.HIGH) + ',' + on(OBn, ALERT.ID_PROBLEM) + ',[[OBJ.id]],' + OBn + ',IF([[OBJ.id_check]]="ДУБЛЬ ID","ID "&[[OBJ.id]]&" повторяется — проверьте по CRM","ID не указан — объект не участвует в расчётах"),[[OBJ.manager]],' + on(OBn, '') + ',' + on(OBn, SHEET_NAMES.OBJ) + '},' + OBn + '<>"",[[OBJ.id_check]]<>""),E_)');

  // задачи и действия
  const PFo = '[[PF.obj_id]]';
  blocks.push('IFERROR(FILTER({' + on(PFo, SEVERITY.HIGH) + ',' + on(PFo, ALERT.TASK_OVERDUE) + ',' + PFo + ',[[PF.obj_name]],"Задача «"&IF([[PF.task]]="",[[PF.week_goal]]&[[PF.kpi_metric]],[[PF.task]])&"» ("&[[PF.task_id]]&")",[[PF.owner]],' + fmtD('[[PF.deadline]]') + ',' + on(PFo, SHEET_NAMES.PF) + '},[[PF.overdue]]="ПРОСРОЧЕНО"),E_)');
  const ACo = '[[ACT.obj_id]]';
  blocks.push('IFERROR(FILTER({' + on(ACo, SEVERITY.HIGH) + ',' + on(ACo, ALERT.ACTION_OVERDUE) + ',' + ACo + ',[[ACT.obj_name]],"Действие "&[[ACT.id]]&" «"&[[ACT.type]]&" "&[[ACT.goal]]&"» не отмечено выполненным",[[ACT.owner]],' + fmtD('[[ACT.date]]') + ',' + on(ACo, SHEET_NAMES.ACT) + '},[[ACT.status_class]]="OPEN",[[ACT.date]]<>"",[[ACT.date]]<TODAY()),E_)');
  blocks.push('IFERROR(FILTER({' + on(PFo, SEVERITY.LOW) + ',' + on(PFo, ALERT.NO_OWNER) + ',' + PFo + ',[[PF.obj_name]],"Задача «"&IF([[PF.task]]="",[[PF.kpi_metric]],[[PF.task]])&"» ("&[[PF.task_id]]&") без ответственного",' + on(PFo, '') + ',' + fmtD('[[PF.deadline]]') + ',' + on(PFo, SHEET_NAMES.PF) + '},' + PFo + '<>"",[[PF.owner]]="",([[PF.status_class]]="OPEN")+([[PF.status_class]]="FAIL")),E_)');
  blocks.push('IFERROR(FILTER({' + on(ACo, SEVERITY.LOW) + ',' + on(ACo, ALERT.NO_OWNER) + ',' + ACo + ',[[ACT.obj_name]],"Действие "&[[ACT.id]]&" без ответственного",' + on(ACo, '') + ',' + fmtD('[[ACT.date]]') + ',' + on(ACo, SHEET_NAMES.ACT) + '},' + ACo + '<>"",[[ACT.owner]]="",[[ACT.status_class]]="OPEN"),E_)');

  const body = 'LET(E_,{"","","","","","","",""},all_,{' + blocks.join(';') + '},res_,FILTER(all_,INDEX(all_,0,2)<>""),SORT(res_,1,TRUE,2,TRUE,3,TRUE))';
  return resolveF_('=IFERROR(ARRAYFORMULA(' + body + '),{"✓ Предупреждений нет","","","","","","",""})', { extra: m });
}

// ───────────────────────── 09_ДЭШБОРД ─────────────────────────

const DASH_OBJ_FIRST = 40; // первая строка таблицы объектов (выше — сводка предупреждений)
const DASH_CHART_COL = 27; // AA — данные графика

function dashLayout_() {
  const cells = [];
  const wk = '$Z$1', prev = '$Z$2';
  cells.push({ a1: 'A1', v: 'ДЭШБОРД — СИСТЕМА УПРАВЛЕНИЯ ЭКСКЛЮЗИВАМИ', style: 'title' });
  cells.push({ a1: 'A2', v: 'Неделя (пусто = текущая):', style: 'label' });
  cells.push({ a1: 'C2', v: '', style: 'select', validation: { list: 'D.weeks:c4' } });
  cells.push({ a1: 'E2', v: 'Сегодня:', style: 'label' });
  cells.push({ a1: 'F2', f: '=TODAY()', fmt: 'date' });
  // служебные параметры (Z) — нужны и для условного форматирования
  cells.push({ a1: 'Y1', v: 'неделя', style: 'muted' });
  cells.push({ a1: 'Z1', f: '=IF(C2="",' + CURRENT_WEEK_F_ + ',REGEXEXTRACT(C2,"^[^ ]+"))', style: 'muted' });
  cells.push({ a1: 'Y2', v: 'пред. неделя', style: 'muted' });
  cells.push({ a1: 'Z2', f: '=IFERROR(LET(p_m,VLOOKUP(Z1,[[D.weeks:tbl]],2,FALSE)-7,YEAR(p_m+3)&"-W"&TEXT(ISOWEEKNUM(p_m),"00")),"")', style: 'muted' });
  cells.push({ a1: 'Y3', v: 'порог риска', style: 'muted' });
  cells.push({ a1: 'Z3', f: '=CFG_NO_ACTIVITY_DAYS', style: 'muted' });
  cells.push({ a1: 'Y4', v: 'порог внимания', style: 'muted' });
  cells.push({ a1: 'Z4', f: '=CFG_WARN_ACTIVITY_DAYS', style: 'muted' });

  // ОБЩАЯ КАРТИНА
  cells.push({ a1: 'A4', v: 'ОБЩАЯ КАРТИНА', style: 'section', spanCols: 9 });
  const riskTemp = '[[D.temperature:4]]';
  const stratAlerts = ALERTS_STRATEGY.map(a => '(' + quoteSheet_(SHEET_NAMES.CTRL) + '!$B$' + CTRL_FIRST + ':$B="' + a + '")').join('+');
  const tiles = [
    ['Активных эксклюзивов', '=COUNTIF([[OBJ.in_work]],"ДА")', '0'],
    ['Без активности', '=COUNTIFS([[OBJ.in_work]],"ДА",[[OBJ.risk_flag]],"RISK")', '0'],
    ['С риском', '=SUMPRODUCT(([[OBJ.in_work]]="ДА")*((([[OBJ.risk_flag]]="RISK")+([[OBJ.temperature]]=' + riskTemp + '))>0))', '0'],
    ['В переговорах', '=COUNTIF([[OBJ.status_class]],"NEGOTIATION")', '0'],
    ['Брони', '=COUNTIF([[OBJ.status_class]],"BOOKING")', '0'],
    ['Сделки / проданы', '=COUNTIF([[OBJ.status_class]],"DEAL")+COUNTIF([[OBJ.status_class]],"SOLD")', '0'],
    ['Стоимость активного портфеля', '=SUMIFS([[OBJ.price]],[[OBJ.in_work]],"ДА")', 'money_short'],
    ['Нужно изменить стратегию', '=IFERROR(ROWS(UNIQUE(FILTER(' + quoteSheet_(SHEET_NAMES.CTRL) + '!$C$' + CTRL_FIRST + ':$C,' + stratAlerts + '))),0)', '0'],
    ['Гипотез в проверке', '=COUNTIFS([[HYP.status_class]],"OPEN",[[HYP.hypothesis]],"?*")', '0'],
  ];
  tiles.forEach((t, i) => {
    const L = colLetter_(1 + i);
    cells.push({ a1: L + '5', v: t[0], style: 'tileLabel' });
    cells.push({ a1: L + '6', f: t[1], style: 'tileValue', fmt: t[2] });
  });

  // НЕДЕЛЯ
  cells.push({ a1: 'A8', f: '="ЗА НЕДЕЛЮ "&Z1&IFERROR(" · "&TEXT(VLOOKUP(Z1,[[D.weeks:tbl]],2,FALSE),"dd.mm")&"–"&TEXT(VLOOKUP(Z1,[[D.weeks:tbl]],3,FALSE),"dd.mm.yyyy"),"")', style: 'section', spanCols: 9 });
  const wm = [
    ['Действия', w => 'COUNTIFS([[ACT.week]],' + w + ',[[ACT.status_class]],"DONE")'],
    ['Контакты', w => 'SUMIFS([[ACT.contacts]],[[ACT.week]],' + w + ')'],
    ['Лиды', w => 'SUMIFS([[ACT.interested]],[[ACT.week]],' + w + ')'],
    ['Показы', w => 'SUMIFS([[ACT.showings]],[[ACT.week]],' + w + ')'],
    ['Переговоры', w => 'SUMIFS([[ACT.negotiations]],[[ACT.week]],' + w + ')'],
    ['Предложения', w => 'SUMIFS([[ACT.offers]],[[ACT.week]],' + w + ')'],
    ['Брони', w => 'SUMIFS([[ACT.bookings]],[[ACT.week]],' + w + ')'],
    ['Сделки', w => 'SUMIFS([[ACT.deals]],[[ACT.week]],' + w + ')'],
  ];
  cells.push({ a1: 'A9', v: '', style: 'header' });
  cells.push({ a1: 'A10', v: 'Эта неделя', style: 'bold' });
  cells.push({ a1: 'A11', v: 'Прошлая неделя' });
  cells.push({ a1: 'A12', v: 'Изменение' });
  const weekCell = {};
  wm.forEach((m, i) => {
    const L = colLetter_(2 + i);
    weekCell[m[0]] = L + '10';
    cells.push({ a1: L + '9', v: m[0], style: 'header' });
    cells.push({ a1: L + '10', f: '=' + m[1](wk), fmt: '0', style: 'bold' });
    cells.push({ a1: L + '11', f: '=' + m[1](prev), fmt: '0' });
    cells.push({ a1: L + '12', f: '=' + L + '10-' + L + '11', fmt: '+0;-0;0', style: 'delta' });
  });

  // КОНВЕРСИИ
  cells.push({ a1: 'A14', v: 'КОНВЕРСИИ', style: 'section', spanCols: 9 });
  const conv = [
    ['Контакт → лид', 'Лиды', 'Контакты', 'SUM([[ACT.interested]])', 'SUM([[ACT.contacts]])'],
    ['Лид → показ', 'Показы', 'Лиды', 'SUM([[ACT.showings]])', 'SUM([[ACT.interested]])'],
    ['Показ → переговоры', 'Переговоры', 'Показы', 'SUM([[ACT.negotiations]])', 'SUM([[ACT.showings]])'],
    ['Переговоры → предложение', 'Предложения', 'Переговоры', 'SUM([[ACT.offers]])', 'SUM([[ACT.negotiations]])'],
    ['Предложение → бронь', 'Брони', 'Предложения', 'SUM([[ACT.bookings]])', 'SUM([[ACT.offers]])'],
    ['Бронь → сделка', 'Сделки', 'Брони', 'SUM([[ACT.deals]])', 'SUM([[ACT.bookings]])'],
  ];
  cells.push({ a1: 'A15', v: '', style: 'header' });
  cells.push({ a1: 'A16', v: 'Эта неделя', style: 'bold' });
  cells.push({ a1: 'A17', v: 'Весь период' });
  conv.forEach((c, i) => {
    const L = colLetter_(2 + i);
    cells.push({ a1: L + '15', v: c[0], style: 'header' });
    cells.push({ a1: L + '16', f: '=IFERROR(' + weekCell[c[1]] + '/' + weekCell[c[2]] + ',"—")', fmt: 'pct', style: 'bold' });
    cells.push({ a1: L + '17', f: '=IFERROR(' + c[3] + '/' + c[4] + ',"—")', fmt: 'pct' });
  });

  // ПРЕДУПРЕЖДЕНИЯ (сводка)
  cells.push({ a1: 'A19', v: 'ПРЕДУПРЕЖДЕНИЯ (подробно — лист 11_КОНТРОЛЬ)', style: 'section', spanCols: 9 });
  cells.push({ a1: 'A20', f: '=IFERROR(QUERY(' + quoteSheet_(SHEET_NAMES.CTRL) + '!$A$' + CTRL_FIRST + ':$H,"select B, count(B) where B<>\'\' group by B order by count(B) desc label B \'Тип\', count(B) \'Кол-во\'",0),"Нет предупреждений")' });

  // ПО ОБЪЕКТАМ
  const hdr = DASH_OBJ_FIRST - 1;
  cells.push({ a1: 'A' + (hdr - 1), v: 'ПО КАЖДОМУ ОБЪЕКТУ (в работе; сверху — дольше всего без активности)', style: 'section', spanCols: 17 });
  const K = '$A$' + DASH_OBJ_FIRST + ':$A';
  const look = f => 'IFERROR(VLOOKUP(' + K + ',{[[OBJ.id]],[[OBJ.' + f + ']]},2,FALSE),"")';
  const cols = [
    ['ID', null],
    ['Название', look('name')],
    ['Статус', look('status')],
    ['Темп.', look('temperature')],
    ['Цена', look('price'), 'money_short'],
    ['Цена за м²', look('price_m2'), 'money'],
    ['Дни на рынке', look('days_on_market'), '0'],
    ['Лиды', 'SUMIF([[ACT.obj_id]],' + K + ',[[ACT.interested]])', '0'],
    ['Показы', 'SUMIF([[ACT.obj_id]],' + K + ',[[ACT.showings]])', '0'],
    ['Переговоры', 'SUMIF([[ACT.obj_id]],' + K + ',[[ACT.negotiations]])', '0'],
    ['Брони', 'SUMIF([[ACT.obj_id]],' + K + ',[[ACT.bookings]])', '0'],
    ['Конверсия лид → показ', 'IFERROR(SUMIF([[ACT.obj_id]],' + K + ',[[ACT.showings]])/SUMIF([[ACT.obj_id]],' + K + ',[[ACT.interested]]),"")', 'pct'],
    ['Последнее действие', look('last_action')],
    ['Следующее действие', look('next_action')],
    ['Дедлайн', look('next_action_deadline'), 'date'],
    ['Дней без активности', look('days_idle'), '0'],
    ['Ответственный', look('manager')],
  ];
  const objCol = {};
  cols.forEach((c, i) => {
    const L = colLetter_(1 + i);
    objCol[c[0]] = L;
    cells.push({ a1: L + hdr, v: c[0], style: 'header' });
    if (i === 0) {
      cells.push({ a1: L + DASH_OBJ_FIRST, f: '=ARRAYFORMULA(IFERROR(INDEX(SORT(FILTER({[[OBJ.id]],IF([[OBJ.days_idle]]="",-1,[[OBJ.days_idle]])},[[OBJ.id]]<>"",[[OBJ.in_work]]="ДА"),2,FALSE),0,1),""))' });
    } else {
      cells.push({ a1: L + DASH_OBJ_FIRST, f: '=ARRAYFORMULA(IF(' + K + '="","",' + c[1] + '))', fmt: c[2] || null });
    }
  });

  // данные графика: последние 12 недель
  const A = colLetter_(DASH_CHART_COL);
  const chartCols = [
    ['Неделя', '=ARRAYFORMULA(TEXT(TODAY()-WEEKDAY(TODAY(),2)+1+7*SEQUENCE(12,1,-11,1),"dd.mm"))'],
    ['Действия', 'COUNTIF([[ACT.week]]&"|"&[[ACT.status_class]],KEYS_&"|DONE")'],
    ['Лиды', 'SUMIF([[ACT.week]],KEYS_,[[ACT.interested]])'],
    ['Показы', 'SUMIF([[ACT.week]],KEYS_,[[ACT.showings]])'],
    ['Переговоры', 'SUMIF([[ACT.week]],KEYS_,[[ACT.negotiations]])'],
  ];
  const keyCol = colLetter_(DASH_CHART_COL + chartCols.length);
  const keysRng = '$' + keyCol + '$3:$' + keyCol + '$14';
  cells.push({ a1: A + '1', v: 'Данные графика (последние 12 недель)', style: 'muted' });
  chartCols.forEach((c, i) => {
    const L = colLetter_(DASH_CHART_COL + i);
    cells.push({ a1: L + '2', v: c[0], style: 'header' });
    const f = i === 0 ? c[1] : '=ARRAYFORMULA(' + c[1].replace(/KEYS_/g, keysRng) + ')';
    cells.push({ a1: L + '3', f: f });
  });
  cells.push({ a1: keyCol + '2', v: 'ключ', style: 'muted' });
  cells.push({ a1: keyCol + '3', f: '=ARRAYFORMULA(LET(c_m,TODAY()-WEEKDAY(TODAY(),2)+1+7*SEQUENCE(12,1,-11,1),YEAR(c_m+3)&"-W"&TEXT(ISOWEEKNUM(c_m),"00")))', style: 'muted' });

  return { cells: cells, objCol: objCol, chartRange: A + '2:' + colLetter_(DASH_CHART_COL + chartCols.length - 1) + '14' };
}
