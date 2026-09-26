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
  const expr = field.f === '__FACT_AUTO__' ? factAutoExpr_() : field.f;
  const g = colRef_(spec.code, guardKey, true);
  return '={"' + field.title + '";ARRAYFORMULA(IF(LEN(' + g + ')=0,"",' + resolveF_(expr, { own: spec.code }) + '))}';
}


/** Факт задачи из журналов: звонки / КП / ответы — из 03_ОБЗВОН_И_КП, публикации — из 04_КОНТЕНТ (по объекту и неделе). */
function factAutoExpr_() {
  const kBase = w => '[[BASE.obj_id]]&"|"&[[BASE.' + w + ']]';
  return 'LET(u_code,IFERROR(VLOOKUP([[@unit]],[[D.units:tbl]],2,FALSE),""),c_ow,[[@obj_id]]&"|"&[[@week]],' +
    'IF(u_code="CALLS",COUNTIF(' + kBase('call_week') + ',c_ow),' +
    'IF(u_code="KP",COUNTIF(' + kBase('kp_week') + ',c_ow),' +
    'IF(u_code="RESP",COUNTIF(' + kBase('resp_week') + ',c_ow)-COUNTIF(' + kBase('resp_week') + '&"|"&[[BASE.resp_class]],c_ow&"|NONE"),' +
    'IF(u_code="PUB",COUNTIF([[CONT.obj_id]]&"|"&[[CONT.pub_week]]&"|"&[[CONT.status_class]],c_ow&"|DONE"),"")))))';
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
    obj_labels: '=ARRAYFORMULA(IFERROR(FILTER([[OBJ.id]]&" · "&[[OBJ.name]],[[OBJ.id]]<>"",[[OBJ.name]]<>""),""))',
    lib_checklists: '=IFERROR(FILTER([[LIB.title]],[[LIB.kind]]=[[D.lib_kinds:1]],[[LIB.title]]<>""),"")',
  };
}

// ───────────────────────── 00_ДЭШБОРД ─────────────────────────

const DASH = {
  WEEK_KEY: '$Z$1', IDLE: '$Z$2',
  OBJ_HDR: 10, OBJ_FIRST: 11, OBJ_LAST: 70,
  PEOPLE_HDR: 74, PEOPLE_FIRST: 75, PEOPLE_LAST: 89,
  OVERDUE_HDR: 93, OVERDUE_FIRST: 94,
};

function dashLayout_() {
  const cells = [];
  const wk = DASH.WEEK_KEY;
  cells.push({ a1: 'A1', v: 'ДЭШБОРД — маркетинг эксклюзивов', style: 'title' });
  cells.push({ a1: 'A2', v: 'Неделя (пусто = текущая):', style: 'label' });
  cells.push({ a1: 'B2', v: '', style: 'select', validation: { list: 'D.weeks:c4' } });
  cells.push({ a1: 'D2', f: '="Сегодня: "&TEXT(TODAY(),"dd.mm.yyyy")', style: 'muted' });
  cells.push({ a1: 'Y1', v: 'неделя', style: 'muted' });
  cells.push({ a1: 'Z1', f: '=IF(B2="",' + CURRENT_WEEK_F_ + ',REGEXEXTRACT(B2,"^[^ ]+"))', style: 'muted' });
  cells.push({ a1: 'Y2', v: 'порог дней', style: 'muted' });
  cells.push({ a1: 'Z2', f: '=CFG_IDLE_DAYS', style: 'muted' });

  // плитки недели
  cells.push({ a1: 'A4', f: '="НЕДЕЛЯ "&Z1&IFERROR(" · "&TEXT(VLOOKUP(Z1,[[D.weeks:tbl]],2,FALSE),"dd.mm")&"–"&TEXT(VLOOKUP(Z1,[[D.weeks:tbl]],3,FALSE),"dd.mm.yyyy"),"")', style: 'section', spanCols: 12 });
  const tkW = '[[TASK.week]]&"|"&[[TASK.status_class]]';
  const tiles = [
    ['Объектов в работе', '=COUNTIFS([[OBJ.in_work]],"ДА",[[OBJ.id]],"?*")', '0'],
    ['Задач на неделе', '=COUNTIF([[TASK.week]],' + wk + ')-COUNTIF(' + tkW + ',' + wk + '&"|CANCEL")', '0'],
    ['Выполнено', '=COUNTIF(' + tkW + ',' + wk + '&"|DONE")', '0'],
    ['% плана', '=IFERROR(C6/B6,"—")', 'pct'],
    ['Просрочено (всего)', '=COUNTIF([[TASK.overdue]],"ПРОСРОЧЕНО")', '0'],
    ['Звонков', '=COUNTIF([[BASE.call_week]],' + wk + ')', '0'],
    ['КП отправлено', '=COUNTIF([[BASE.kp_week]],' + wk + ')', '0'],
    ['Ответов', '=COUNTIF([[BASE.resp_week]],' + wk + ')-COUNTIF([[BASE.resp_week]]&"|"&[[BASE.resp_class]],' + wk + '&"|NONE")', '0'],
    ['Интересно', '=COUNTIF([[BASE.resp_week]]&"|"&[[BASE.resp_class]],' + wk + '&"|YES")', '0'],
    ['Публикаций', '=COUNTIF([[CONT.pub_week]]&"|"&[[CONT.status_class]],' + wk + '&"|DONE")', '0'],
    ['Просмотры', '=SUMIF([[CONT.pub_week]],' + wk + ',[[CONT.views]])', '#,##0'],
    ['Охват', '=SUMIF([[CONT.pub_week]],' + wk + ',[[CONT.reach]])', '#,##0'],
  ];
  tiles.forEach((t, i) => {
    const L = colLetter_(1 + i);
    cells.push({ a1: L + '5', v: t[0], style: 'tileLabel' });
    cells.push({ a1: L + '6', f: t[1].indexOf('&') > 0 ? '=ARRAYFORMULA(' + t[1].slice(1) + ')' : t[1], style: 'tileValue', fmt: t[2] });
  });

  // по объектам
  const oF = DASH.OBJ_FIRST, oL = DASH.OBJ_LAST;
  cells.push({ a1: 'A' + (DASH.OBJ_HDR - 1), v: 'ПО ОБЪЕКТАМ (в работе) — неделя из фильтра выше', style: 'section', spanCols: 17 });
  const K = '$B$' + oF + ':$B$' + oL;
  const c = K + '&"|"&' + wk;
  const look = f => 'IFERROR(VLOOKUP(' + K + ',{[[OBJ.id]],[[OBJ.' + f + ']]},2,FALSE),"")';
  const objCols = [
    ['Объект', 'IF(' + look('tab_url') + '="",' + look('name') + ',HYPERLINK(' + look('tab_url') + ',' + look('name') + '))'],
    ['ID', null],
    ['Ответственный', look('manager')],
    ['Стратегия', look('strategy_pct'), 'pct'],
    ['Задач', 'COUNTIF([[TASK.obj_id]]&"|"&[[TASK.week]],' + c + ')-COUNTIF([[TASK.obj_id]]&"|"&' + tkW + ',' + c + '&"|CANCEL")', '0'],
    ['Выполнено', 'COUNTIF([[TASK.obj_id]]&"|"&' + tkW + ',' + c + '&"|DONE")', '0'],
    ['% плана', 'IFERROR($F$' + oF + ':$F$' + oL + '/$E$' + oF + ':$E$' + oL + ',"")', 'pct'],
    ['Просрочено', 'COUNTIF([[TASK.obj_id]]&"|"&[[TASK.overdue]],' + K + '&"|ПРОСРОЧЕНО")', '0'],
    ['Звонков', 'COUNTIF([[BASE.obj_id]]&"|"&[[BASE.call_week]],' + c + ')', '0'],
    ['КП', 'COUNTIF([[BASE.obj_id]]&"|"&[[BASE.kp_week]],' + c + ')', '0'],
    ['Ответов', 'COUNTIF([[BASE.obj_id]]&"|"&[[BASE.resp_week]],' + c + ')-COUNTIF([[BASE.obj_id]]&"|"&[[BASE.resp_week]]&"|"&[[BASE.resp_class]],' + c + '&"|NONE")', '0'],
    ['Интересно', 'COUNTIF([[BASE.obj_id]]&"|"&[[BASE.resp_week]]&"|"&[[BASE.resp_class]],' + c + '&"|YES")', '0'],
    ['В CRM (всего)', 'COUNTIF([[BASE.obj_id]]&"|"&IF([[BASE.to_crm]],"1","0"),' + K + '&"|1")', '0'],
    ['Публикаций', 'COUNTIF([[CONT.obj_id]]&"|"&[[CONT.pub_week]]&"|"&[[CONT.status_class]],' + c + '&"|DONE")', '0'],
    ['Охват', 'SUMIF([[CONT.obj_id]]&"|"&[[CONT.pub_week]],' + c + ',[[CONT.reach]])', '#,##0'],
    ['Последнее изменение', 'IFERROR(VLOOKUP(' + K + ',SORT(FILTER({[[HIST.obj_id]],[[HIST.ts]]},[[HIST.obj_id]]<>""),2,FALSE),2,FALSE),"")', 'datetime'],
    ['Дней без работы', 'IF($P$' + oF + ':$P$' + oL + '="",IFERROR(TODAY()-VLOOKUP(' + K + ',{[[OBJ.id]],[[OBJ.date_sign]]},2,FALSE),""),INT(TODAY()-$P$' + oF + ':$P$' + oL + '))', '0'],
  ];
  const objLetter = {};
  objCols.forEach((col, i) => {
    const L = colLetter_(1 + i);
    objLetter[col[0]] = L;
    cells.push({ a1: L + DASH.OBJ_HDR, v: col[0], style: 'header' });
    if (col[0] === 'ID') cells.push({ a1: L + oF, f: '=IFERROR(FILTER([[OBJ.id]],[[OBJ.id]]<>"",[[OBJ.name]]<>"",[[OBJ.in_work]]="ДА"),"")' });
    else cells.push({ a1: L + oF, f: '=ARRAYFORMULA(IF(' + K + '="","",' + col[1] + '))', fmt: col[2] || null });
  });

  // по сотрудникам
  const pF = DASH.PEOPLE_FIRST, pL = DASH.PEOPLE_LAST;
  cells.push({ a1: 'A' + (DASH.PEOPLE_HDR - 1), v: 'ПО СОТРУДНИКАМ — неделя из фильтра выше', style: 'section', spanCols: 9 });
  const P = '$A$' + pF + ':$A$' + pL;
  const cp = P + '&"|"&' + wk;
  const peopleCols = [
    ['Сотрудник', null],
    ['Задач', 'COUNTIF([[TASK.owner]]&"|"&[[TASK.week]],' + cp + ')-COUNTIF([[TASK.owner]]&"|"&' + tkW + ',' + cp + '&"|CANCEL")', '0'],
    ['Выполнено', 'COUNTIF([[TASK.owner]]&"|"&' + tkW + ',' + cp + '&"|DONE")', '0'],
    ['% плана', 'IFERROR($C$' + pF + ':$C$' + pL + '/$B$' + pF + ':$B$' + pL + ',"")', 'pct'],
    ['Просрочено', 'COUNTIF([[TASK.owner]]&"|"&[[TASK.overdue]],' + P + '&"|ПРОСРОЧЕНО")', '0'],
    ['Звонков', 'COUNTIF([[BASE.owner]]&"|"&[[BASE.call_week]],' + cp + ')', '0'],
    ['КП', 'COUNTIF([[BASE.owner]]&"|"&[[BASE.kp_week]],' + cp + ')', '0'],
    ['Публикаций', 'COUNTIF([[CONT.owner]]&"|"&[[CONT.pub_week]]&"|"&[[CONT.status_class]],' + cp + '&"|DONE")', '0'],
    ['Контент в работе', 'COUNTIF([[CONT.owner]]&"|"&[[CONT.status_class]],' + P + '&"|OPEN")', '0'],
  ];
  peopleCols.forEach((col, i) => {
    const L = colLetter_(1 + i);
    cells.push({ a1: L + DASH.PEOPLE_HDR, v: col[0], style: 'header' });
    if (i === 0) cells.push({ a1: L + pF, f: '=IFERROR(FILTER([[D.people]],[[D.people]]<>""),"")' });
    else cells.push({ a1: L + pF, f: '=ARRAYFORMULA(IF(' + P + '="","",' + col[1] + '))', fmt: col[2] || null });
  });

  // просроченные задачи
  cells.push({ a1: 'A' + (DASH.OVERDUE_HDR - 1), v: 'ПРОСРОЧЕННЫЕ ЗАДАЧИ', style: 'section', spanCols: 6 });
  ['Объект', 'Задача', 'Исполнитель', 'Срок', 'Неделя', 'ID'].forEach((t, i) => cells.push({ a1: colLetter_(1 + i) + DASH.OVERDUE_HDR, v: t, style: 'header' }));
  cells.push({
    a1: 'A' + DASH.OVERDUE_FIRST,
    f: '=IFERROR(ARRAYFORMULA(INDEX(SORT(FILTER({[[TASK.obj_name]],[[TASK.task]],[[TASK.owner]],TEXT([[TASK.deadline]],"dd.mm.yyyy"),[[TASK.week]],[[TASK.id]],[[TASK.deadline]]},[[TASK.overdue]]="ПРОСРОЧЕНО"),7,TRUE),0,{1,2,3,4,5,6})),"✓ Просроченных задач нет")',
  });
  return { cells: cells, objLetter: objLetter };
}

// ───────────────────────── 05_ОТЧЁТ_КЛИЕНТУ ─────────────────────────
// Формат — как в отчётах руководителя: шапка ИП, «Приложение №1 к Договору», таблица реквизитов,
// Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА, Раздел 2. ПОЛУЧЕННЫЕ ЗАЯВКИ, Раздел 3. ПЛАН РАБОТЫ.
// Период отчёта — рабочая неделя пн–пт.

const REP_P = { id: '$E$3', wk: '$E$4', start: '$E$5', end: '$E$6', next: '$E$7', no: '$E$8' };
const REP_FIRST_ROW = 11;

/** Значения-«поля» отчёта (одна ячейка = один placeholder). */
function reportRows_() {
  const P = REP_P;
  const look = f => '=IFERROR(VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.' + f + ']]},2,FALSE),"")';
  const bKey = w => '[[BASE.obj_id]]&"|"&[[BASE.' + w + ']]';
  const cw = P.id + '&"|"&' + P.wk;
  return [
    { ph: 'EXEC_HEADER', label: 'Шапка исполнителя', f: '=SUBSTITUTE(CFG_EXEC_HEADER," | ",CHAR(10))', lines: true },
    { ph: 'CONTRACT_NO', label: '№ договора', f: look('contract_no') },
    { ph: 'CONTRACT_DATE', label: 'Дата договора', f: '=IFERROR(TEXT(VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.contract_date]]},2,FALSE),"dd.mm.yyyy")&"г.","")' },
    { ph: 'REPORT_NO', label: 'Отчёт №', f: '=' + P.no },
    { ph: 'PERIOD', label: 'Период', f: '=IF(' + P.start + '="","",TEXT(' + P.start + ',"dd.mm.yyyy")&" – "&TEXT(' + P.start + '+4,"dd.mm.yyyy"))' },
    { ph: 'OBJECT', label: 'Объект', f: look('address') },
    { ph: 'CUSTOMER', label: 'Заказчик', f: look('customer') },
    { ph: 'EXECUTOR', label: 'Исполнитель', f: '=CFG_EXEC_NAME' },
    {
      ph: 'SUMMARY', label: 'Итоги недели в цифрах', lines: true,
      f: '=ARRAYFORMULA(IF(' + P.id + '="","",LET(n_call,COUNTIF(' + bKey('call_week') + ',' + cw + '),n_kp,COUNTIF(' + bKey('kp_week') + ',' + cw + '),' +
        'n_resp,COUNTIF(' + bKey('resp_week') + ',' + cw + ')-COUNTIF(' + bKey('resp_week') + '&"|"&[[BASE.resp_class]],' + cw + '&"|NONE"),' +
        'n_yes,COUNTIF(' + bKey('resp_week') + '&"|"&[[BASE.resp_class]],' + cw + '&"|YES"),' +
        'n_pub,COUNTIF([[CONT.obj_id]]&"|"&[[CONT.pub_week]]&"|"&[[CONT.status_class]],' + cw + '&"|DONE"),' +
        'n_views,SUMIF([[CONT.obj_id]]&"|"&[[CONT.pub_week]],' + cw + ',[[CONT.views]]),n_reach,SUMIF([[CONT.obj_id]]&"|"&[[CONT.pub_week]],' + cw + ',[[CONT.reach]]),' +
        'n_txt,TEXTJOIN(CHAR(10),TRUE,IF(n_call>0,"Обзвонено компаний: "&n_call,""),IF(n_kp>0,"Направлено коммерческих предложений: "&n_kp,""),' +
        'IF(n_resp>0,"Получено ответов: "&n_resp&IF(n_yes>0,", из них заинтересованы: "&n_yes,""),""),' +
        'IF(n_pub>0,"Опубликовано материалов об объекте: "&n_pub&IF(n_views>0,", просмотры: "&TEXT(n_views,"#,##0"),"")&IF(n_reach>0,", охват: "&TEXT(n_reach,"#,##0"),""),"")),' +
        'n_txt)))',
    },
    { ph: 'COMMENT', label: 'Комментарий для клиента', f: '=$B$5' },
    { ph: 'SIGNATURE', label: 'Подпись', f: '=CFG_MANAGER_NAME' },
  ];
}

/** Таблицы отчёта: строки собираются формулой, в Google Doc вставляются строками таблицы. */
function reportTables_() {
  const P = REP_P;
  const tCond = '[[TASK.obj_id]]=' + P.id + ',[[TASK.status_class]]<>"CANCEL",[[TASK.to_report]]=TRUE';
  const factOf = 'IF([[TASK.fact]]="",[[TASK.fact_auto]],[[TASK.fact]])';
  const numbered = (n, filter, empty) => '=IFERROR(ARRAY_CONSTRAIN(ARRAYFORMULA(LET(t_rows,' + filter + ',{SEQUENCE(ROWS(t_rows)),t_rows})),' + n + ',3),' + (empty ? '{"—","' + empty + '",""}' : '""') + ')';
  return [
    {
      ph: 'PLAN_ROWS', title: 'Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА', rows: 25,
      cols: ['№', 'Действие по плану на эту неделю', 'Статус (выполнено / нет)'],
      f: numbered(25, 'FILTER({[[TASK.task]]&IF([[TASK.plan]]="",""," — "&IF([[TASK.unit]]="","",[[TASK.unit]]&": ")&' + factOf + '&" из "&[[TASK.plan]])&IF([[TASK.result]]="","",". "&[[TASK.result]]),' +
        'IF([[TASK.status]]="","Запланировано",[[TASK.status]])},[[TASK.week]]=' + P.wk + ',' + tCond + ')', 'Задачи на неделю не внесены'),
    },
    {
      ph: 'LEADS_ROWS', title: 'Раздел 2. ПОЛУЧЕННЫЕ ЗАЯВКИ', rows: 15,
      cols: ['№', 'Заявка', 'Следующий шаг'],
      f: numbered(15, 'FILTER({[[BASE.company]]&IF([[BASE.audience]]="",""," ("&[[BASE.audience]]&")"),[[BASE.next_step]]&IF([[BASE.next_date]]="",""," — "&TEXT([[BASE.next_date]],"dd.mm.yyyy"))},' +
        '[[BASE.obj_id]]=' + P.id + ',[[BASE.resp_week]]=' + P.wk + ',[[BASE.resp_class]]="YES")', 'Новых заявок за неделю нет'),
    },
    {
      ph: 'NEXT_ROWS', title: 'Раздел 3. ПЛАН РАБОТЫ', rows: 20,
      cols: ['№', 'Действие', 'Дата выполнения'],
      f: numbered(20, 'FILTER({[[TASK.task]]&IF([[TASK.plan]]="",""," — "&IF([[TASK.unit]]="","",[[TASK.unit]]&": ")&[[TASK.plan]]),' +
        'IF(([[TASK.deadline]]="")+([[TASK.deadline]]=' + P.start + '+11),TEXT(' + P.start + '+7,"dd.mm.yyyy")&" – "&TEXT(' + P.start + '+11,"dd.mm.yyyy"),"до "&TEXT([[TASK.deadline]],"dd.mm.yyyy"))},' +
        '[[TASK.week]]=' + P.next + ',' + tCond + ')', 'План на следующую неделю формируется'),
    },
  ];
}

function reportLayout_() {
  const cells = [];
  cells.push({ a1: 'A1', v: 'ОТЧЁТ КЛИЕНТУ — выберите объект и неделю, проверьте текст, затем меню «Создать отчёт клиенту»', style: 'title' });
  cells.push({ a1: 'A3', v: 'Объект:', style: 'label' });
  cells.push({ a1: 'B3', v: '', style: 'select', validation: { list: 'D.obj_labels' } });
  cells.push({ a1: 'A4', v: 'Неделя:', style: 'label' });
  cells.push({ a1: 'B4', v: '', style: 'select', validation: { list: 'D.weeks:c4' } });
  cells.push({ a1: 'A5', v: 'Комментарий для клиента:', style: 'label' });
  cells.push({ a1: 'B5', v: '', style: 'select', note: 'Необязательно. Если пусто — раздела «Комментарий» в отчёте не будет.' });
  cells.push({ a1: 'D2', v: 'Служебное', style: 'muted' });
  [
    ['D3', 'ID объекта', 'E3', '=IFERROR(REGEXEXTRACT(B3,"^(.*?) · "),"")'],
    ['D4', 'Ключ недели', 'E4', '=IFERROR(REGEXEXTRACT(B4,"^[^ ]+"),"")'],
    ['D5', 'Понедельник', 'E5', '=IFERROR(VLOOKUP(E4,[[D.weeks:tbl]],2,FALSE),"")'],
    ['D6', 'Пятница', 'E6', '=IF(E5="","",E5+4)'],
    ['D7', 'Следующая неделя', 'E7', '=IF(E5="","",YEAR(E5+10)&"-W"&TEXT(ISOWEEKNUM(E5+7),"00"))'],
    ['D8', '№ отчёта', 'E8', '=IF(E3="","",COUNTIFS([[ARCH.obj_id]],E3,[[ARCH.status]],"' + REPORT_STATUS.ACTUAL + '",[[ARCH.week]],"<>"&E4)+1)'],
  ].forEach(p => {
    cells.push({ a1: p[0], v: p[1], style: 'muted' });
    cells.push({ a1: p[2], f: p[3], style: 'muted', fmt: (p[2] === 'E5' || p[2] === 'E6') ? 'date' : null });
  });
  cells.push({ a1: 'A9', v: 'ПРЕДПРОСМОТР ОТЧЁТА', style: 'section', spanCols: 4 });
  cells.push({ a1: 'A10', v: 'Поле', style: 'header' });
  cells.push({ a1: 'B10', v: 'Значение', style: 'header' });
  cells.push({ a1: 'D10', v: 'Метка в шаблоне', style: 'header' });
  const rows = reportRows_();
  rows.forEach((r, i) => {
    const row = REP_FIRST_ROW + i;
    cells.push({ a1: 'A' + row, v: r.label, style: 'bold' });
    cells.push({ a1: 'B' + row, f: r.f, style: 'wrap', spanCols: 2 });
    cells.push({ a1: 'D' + row, v: '{{' + r.ph + '}}', style: 'muted' });
  });
  let row = REP_FIRST_ROW + rows.length + 1;
  const tables = {};
  reportTables_().forEach(t => {
    cells.push({ a1: 'A' + row, v: t.title, style: 'section', spanCols: 4 });
    cells.push({ a1: 'D' + row, v: '{{' + t.ph + '}}', style: 'muted' });
    row++;
    t.cols.forEach((c, i) => cells.push({ a1: colLetter_(1 + i) + row, v: c, style: 'header' }));
    row++;
    cells.push({ a1: 'A' + row, f: t.f });
    tables[t.ph] = { first: row, rows: t.rows };
    row += t.rows + 1;
  });
  return { cells: cells, lastRow: row, tables: tables, kvRows: rows.length };
}
