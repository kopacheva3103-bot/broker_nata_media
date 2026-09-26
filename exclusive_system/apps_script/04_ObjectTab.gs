/**
 * 04_ObjectTab — вкладка объекта «▸ Название (ID)»: маркетинговая стратегия по одному объекту.
 *
 * Разделы 1–7 заполняет команда (белые ячейки), разделы 8–10 собираются сами из журналов.
 * Вкладка строится по описанию objTabSections_(): при обновлении системы она пересобирается,
 * а всё, что внесла команда, сохраняется (в т.ч. строки, вставленные внутрь раздела).
 * Столбец A — служебные метки разделов (скрыт), по ним скрипт находит разделы.
 * Все правки во вкладке пишутся в 09_ИСТОРИЯ.
 */

const TAB = { ID: '$I$1', PCT: '$H$3', LAST_COL: 9, FIRST_ROW: 7 };

/** kind: text | dd | date | num | money | link | f (формула; [[C:n]] — n-й столбец этого раздела) */
function C_(title, kind, opts) { return Object.assign({ t: title, k: kind }, opts || {}); }

function objTabSections_() {
  return [
    {
      key: 'FILES', type: 'files', rows: 12, title: 'ДОКУМЕНТЫ ОБЪЕКТА — из папки на Google Диске',
      hint: 'Кладите файлы в папку объекта (Word, PDF, презентации, таблицы, фото) — список и ссылки появляются сами: каждое утро или меню «Обновить документы объектов». Вставлять ссылки вручную не нужно.',
      cols: ['Документ (ссылка)', 'Раздел папки', 'Тип', 'Обновлён'],
    },
    {
      key: 'ANALOG', type: 'table', rows: 8, title: '1. АНАЛИТИКА: АНАЛОГИ',
      hint: 'Аналоги вносим вручную (ЦИАН, Авито, BestPlace). Цена за м² считается сама. Минимум 3 аналога.',
      cols: [
        C_('Аналог (адрес, ЖК)', 'text'), C_('Назначение / тип', 'text'), C_('Площадь, м²', 'num'), C_('Цена, ₽', 'money'),
        C_('Цена за м²', 'f', { f: 'IFERROR(ROUND([[C:4]]/[[C:3]],0),"")', fmt: 'money' }),
        C_('Источник / ссылка', 'link'), C_('Комментарий', 'text'),
      ],
    },
    {
      key: 'PRICE', type: 'kv', title: '2. ЦЕНА И ПОЗИЦИОНИРОВАНИЕ',
      hint: 'Сравнение с аналогами считается само. Вывод по цене можно вставить из разбора Claude.',
      items: [
        { key: 'median', label: 'Медиана цены за м² по аналогам', k: 'f', f: 'IFERROR(MEDIAN([[S:ANALOG:5]]),"")', fmt: 'money' },
        { key: 'our_m2', label: 'Наша цена за м² (из 01_ОБЪЕКТЫ)', k: 'f', f: 'IFERROR(VLOOKUP([[ID]],{[[OBJ.id]],[[OBJ.price_m2]]},2,FALSE),"")', fmt: 'money' },
        { key: 'diff', label: 'Отклонение от медианы', k: 'f', f: 'IFERROR([[K:our_m2]]/[[K:median]]-1,"")', fmt: '+0%;-0%;0%' },
        { key: 'rec_price', label: 'Рекомендуемая цена, ₽', k: 'money' },
        { key: 'min_price', label: 'Минимальная цена для торга, ₽', k: 'money' },
        { key: 'positioning', label: 'Позиционирование (1–2 предложения)', k: 'text' },
        { key: 'price_note', label: 'Вывод по цене', k: 'text' },
        { key: 'analysis_link', label: 'Полный анализ (ссылка)', k: 'link' },
      ],
    },
    {
      key: 'SCEN', type: 'table', rows: 6, title: '3. СЦЕНАРИИ ИСПОЛЬЗОВАНИЯ',
      hint: 'Под какой бизнес можно продать / сдать. Для каждого: чек-лист из 06_БИБЛИОТЕКА, что запросить у УК и собственника, кого привлечь (консультанты, подрядчики, их КП), вывод.',
      cols: [
        C_('Сценарий', 'text'), C_('Чек-лист', 'dd', { list: 'D.lib_checklists' }), C_('Что проверить / документы от УК', 'text'),
        C_('Консультанты, подрядчики, КП', 'text'), C_('Вывод', 'text'), C_('Статус', 'dd', { dict: 'scenario_status' }), C_('Ссылки', 'link'),
      ],
    },
    {
      key: 'AUD', type: 'table', rows: 8, title: '4. ЦЕЛЕВЫЕ АУДИТОРИИ',
      hint: 'Кому предлагаем. Пишите аудиторию так же, как в 03_ОБЗВОН_И_КП, — тогда цифры справа посчитаются сами. Неочевидные идеи (посольства, аэропорт…) — тоже сюда.',
      cols: [
        C_('Аудитория', 'text'), C_('Кто', 'dd', { dict: 'audience_types' }), C_('Портрет: зачем им объект', 'text'), C_('Где искать', 'text'),
        C_('Приоритет', 'dd', { dict: 'priorities' }),
        C_('В базе', 'f', { f: 'COUNTIF([[BASE.obj_id]]&"|"&[[BASE.audience]],[[ID]]&"|"&[[C:1]])', fmt: '0' }),
        C_('КП отправлено', 'f', { f: 'COUNTIF([[BASE.obj_id]]&"|"&[[BASE.audience]]&"|"&([[BASE.kp_date]]<>""),[[ID]]&"|"&[[C:1]]&"|TRUE")', fmt: '0' }),
        C_('Интересно', 'f', { f: 'COUNTIF([[BASE.obj_id]]&"|"&[[BASE.audience]]&"|"&[[BASE.resp_class]],[[ID]]&"|"&[[C:1]]&"|YES")', fmt: '0' }),
      ],
    },
    {
      key: 'KP', type: 'table', rows: 6, title: '5. КП И МАТЕРИАЛЫ',
      hint: 'КП клиенту — с контактами агентства; КП партнёру — без контактов (для пересылки). Файлы — в папке объекта «КП и презентации».',
      cols: [
        C_('Материал', 'text'), C_('Какое', 'dd', { dict: 'kp_types' }), C_('Для аудитории / сценария', 'text'), C_('Ссылка', 'link'),
        C_('Готовность', 'dd', { dict: 'work_status' }), C_('Комментарий', 'text'),
      ],
    },
    {
      key: 'CHAN', type: 'table', rows: 8, title: '6. КАНАЛЫ И ПАРТНЁРЫ',
      hint: 'Где и через кого продвигаем: площадки, соцсети, брокеры, УК, консультанты, ассоциации, рассылки.',
      cols: [
        C_('Канал / партнёр', 'text'), C_('Что делаем', 'text'), C_('Ответственный', 'dd', { dict: 'people' }),
        C_('Статус', 'dd', { dict: 'work_status' }), C_('Результат', 'text'), C_('Ссылка', 'link'),
      ],
    },
    {
      key: 'DEC', type: 'table', rows: 6, title: '7. ВЫВОДЫ И РЕШЕНИЯ ПО СТРАТЕГИИ',
      hint: 'Что поняли и что меняем (в т.ч. итоги оперативок по объекту). Старые записи не удаляйте — это история стратегии.',
      cols: [C_('Дата', 'date'), C_('Вывод / решение', 'text'), C_('Кто', 'dd', { dict: 'people' }), C_('Что делаем дальше', 'text')],
    },
    {
      key: 'PF', type: 'auto', rows: 15, title: '8. ПЛАН-ФАКТ: ТЕКУЩАЯ НЕДЕЛЯ И НЕЗАКРЫТЫЕ ЗАДАЧИ',
      hint: 'Собирается из 02_ЗАДАЧИ. Задачи добавляются там (или меню «Создать план недели»).',
      cols: ['Неделя', 'Задача', 'Исполнитель', 'План', 'Факт', '%', 'Срок', 'Статус'],
      fmts: [null, null, null, '0', '0', 'pct', 'date', null],
      f: '=IFERROR(ARRAY_CONSTRAIN(ARRAYFORMULA(SORT(FILTER({[[TASK.week]],[[TASK.task]],[[TASK.owner]],[[TASK.plan]],IF([[TASK.fact]]="",[[TASK.fact_auto]],[[TASK.fact]]),[[TASK.pct]],[[TASK.deadline]],IF([[TASK.overdue]]="",[[TASK.status]],[[TASK.overdue]])},' +
        '[[TASK.obj_id]]=[[ID]],([[TASK.week]]=[[CW]])+(([[TASK.status_class]]="OPEN")*([[TASK.week]]<[[CW]])*([[TASK.week]]<>""))),1,TRUE,7,TRUE)),15,8),"Задач на эту неделю нет — меню «Создать план недели» или 02_ЗАДАЧИ")',
    },
    {
      key: 'WORK', type: 'grid', title: '9. РАБОТА С БАЗОЙ И КОНТЕНТ',
      hint: 'Из 03_ОБЗВОН_И_КП и 04_КОНТЕНТ. Подробности — в журналах (фильтр по ID объекта).',
      cols: ['Период', 'Компаний в базе', 'Звонков', 'КП', 'Ответов', 'Интересно', 'Передано в CRM', 'Публикаций'],
      grid: [
        ['="Эта неделя"', '=COUNTIF([[BASE.obj_id]]&"|"&' + WEEK_OF_('[[BASE.created_at]]') + ',[[ID]]&"|"&[[CW]])',
          '=COUNTIF([[BASE.obj_id]]&"|"&[[BASE.call_week]],[[ID]]&"|"&[[CW]])', '=COUNTIF([[BASE.obj_id]]&"|"&[[BASE.kp_week]],[[ID]]&"|"&[[CW]])',
          '=COUNTIF([[BASE.obj_id]]&"|"&[[BASE.resp_week]],[[ID]]&"|"&[[CW]])-COUNTIF([[BASE.obj_id]]&"|"&[[BASE.resp_week]]&"|"&[[BASE.resp_class]],[[ID]]&"|"&[[CW]]&"|NONE")',
          '=COUNTIF([[BASE.obj_id]]&"|"&[[BASE.resp_week]]&"|"&[[BASE.resp_class]],[[ID]]&"|"&[[CW]]&"|YES")', '',
          '=COUNTIF([[CONT.obj_id]]&"|"&[[CONT.pub_week]]&"|"&[[CONT.status_class]],[[ID]]&"|"&[[CW]]&"|DONE")'],
        ['="Всего"', '=COUNTIF([[BASE.obj_id]],[[ID]])', '=COUNTIFS([[BASE.obj_id]],[[ID]],[[BASE.call_date]],"<>")', '=COUNTIFS([[BASE.obj_id]],[[ID]],[[BASE.kp_date]],"<>")',
          '=COUNTIFS([[BASE.obj_id]],[[ID]],[[BASE.resp_class]],"<>",[[BASE.resp_class]],"<>NONE")', '=COUNTIFS([[BASE.obj_id]],[[ID]],[[BASE.resp_class]],"YES")',
          '=COUNTIFS([[BASE.obj_id]],[[ID]],[[BASE.to_crm]],TRUE)', '=COUNTIFS([[CONT.obj_id]],[[ID]],[[CONT.status_class]],"DONE")'],
      ],
    },
    {
      key: 'CONT', type: 'auto', rows: 15, title: '10. КОНТЕНТ ОБ ОБЪЕКТЕ',
      hint: 'Из 04_КОНТЕНТ: последние публикации и то, что в работе. Цифры вносит SMM.',
      cols: ['Дата', 'Площадка', 'Формат', 'Тема', 'Статус', 'Просмотры', 'Охват', 'Ссылка'],
      fmts: ['date', null, null, null, null, '#,##0', '#,##0', null],
      f: '=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({[[CONT.pub_date]],[[CONT.platform]],[[CONT.format]],[[CONT.topic]],[[CONT.status]],[[CONT.views]],[[CONT.reach]],[[CONT.link]]},' +
        '[[CONT.obj_id]]=[[ID]]),1,FALSE),15,8),"Контента по объекту пока нет — 04_КОНТЕНТ")',
    },
  ];
}

/** Критерии «Стратегия заполнена» (доля выполненных). */
function strategyPctFormula_(L) {
  const r = (key, n) => L.colRange(key, n);
  return '=(' + [
    '(COUNTA(' + r('ANALOG', 1) + ')>=3)',
    '(' + L.kvCell('rec_price') + '<>"")',
    '(COUNTA(' + r('SCEN', 1) + ')>=1)',
    '(COUNTA(' + r('AUD', 1) + ')>=3)',
    '(COUNTA(' + r('KP', 4) + ')>=1)',
    '(COUNTA(' + r('CHAN', 1) + ')>=2)',
  ].join('+') + ')/6';
}

const STRATEGY_PCT_NOTE = 'Заполнено из 6: ≥3 аналога; рекомендуемая цена; ≥1 сценарий; ≥3 аудитории; ≥1 КП со ссылкой; ≥2 канала.';

// ───────────────────────── раскладка ─────────────────────────

/** Раскладка вкладки по строкам. counts — сколько строк данных в табличных разделах (по умолчанию rows). */
function objTabLayout_(counts) {
  counts = counts || {};
  const secs = objTabSections_();
  let row = TAB.FIRST_ROW;
  const pos = {};
  secs.forEach(s => {
    const p = { title: row, hint: row + 1 };
    row += 2;
    if (s.type === 'kv') {
      p.items = {};
      s.items.forEach(it => { p.items[it.key] = row++; });
    } else {
      p.header = row++;
      const n = s.type === 'table' ? Math.max(s.rows, counts[s.key] || 0) : (s.type === 'grid' ? s.grid.length : s.rows);
      p.first = row;
      p.last = row + n - 1;
      row += n;
    }
    p.sep = row++;
    pos[s.key] = p;
  });
  const L = {
    secs: secs, pos: pos, lastRow: row,
    colRange: (key, n) => { const p = pos[key]; const c = colLetter_(1 + n); return '$' + c + '$' + p.first + ':$' + c + '$' + p.last; },
    kvCell: key => { const s = secs.find(x => x.type === 'kv' && x.items.some(i => i.key === key)); return '$C$' + pos[s.key].items[key]; },
  };
  return L;
}

/** Токены вкладки: [[ID]], [[CW]], [[C:n]], [[S:РАЗДЕЛ:n]], [[K:поле]]; остальные — общие (resolveF_). */
function resolveTabF_(f, L, secKey) {
  const own = f.replace(/\[\[(ID|CW|C:\d+|S:[A-Z]+:\d+|K:[a-z_0-9]+)\]\]/g, (m, t) => {
    if (t === 'ID') return TAB.ID;
    if (t === 'CW') return '(' + CURRENT_WEEK_F_ + ')';
    const p = t.split(':');
    if (p[0] === 'C') return L.colRange(secKey, Number(p[1]));
    if (p[0] === 'S') return L.colRange(p[1], Number(p[2]));
    return L.kvCell(p[1]);
  });
  return resolveF_(own);
}

// ───────────────────────── чтение / построение ─────────────────────────

/** Читает всё, что внесла команда: {tables: {KEY: [[...]]}, kv: {key: value}}. */
function readObjectTab_(sh) {
  const out = { tables: {}, kv: {} };
  const max = sh.getLastRow();
  if (max < TAB.FIRST_ROW) return out;
  const vals = sh.getRange(1, 1, max, TAB.LAST_COL).getValues();
  const secs = {};
  objTabSections_().forEach(s => { secs[s.key] = s; });
  let cur = null, inData = false;
  for (let r = 0; r < vals.length; r++) {
    const m = String(vals[r][0] || '');
    if (m.indexOf('§') === 0) { cur = secs[m.slice(1)] || null; inData = false; continue; }
    if (!cur) continue;
    if (m === 'H') { inData = true; continue; }
    if (m === '·') { inData = false; continue; }
    if (cur.type === 'kv' && m.indexOf('K:') === 0) { out.kv[m.slice(2)] = vals[r][2]; continue; }
    if (cur.type === 'table' && inData) {
      const row = cur.cols.map((c, i) => c.k === 'f' ? '' : vals[r][1 + i]);
      if (row.some(v => v !== '' && v !== null)) (out.tables[cur.key] = out.tables[cur.key] || []).push(row);
    }
  }
  return out;
}

/** Полностью строит вкладку (sh уже существует), затем возвращает сохранённые данные. */
function buildObjectTab_(sh, objId, data) {
  data = data || { tables: {}, kv: {} };
  const counts = {};
  Object.keys(data.tables).forEach(k => { counts[k] = data.tables[k].length + 1; });
  const L = objTabLayout_(counts);
  resetSheet_(sh);
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (e) { /* нечего разъединять */ }
  ensureSize_(sh, L.lastRow + 5, TAB.LAST_COL);
  if (sh.getMaxColumns() > TAB.LAST_COL + 1) sh.deleteColumns(TAB.LAST_COL + 2, sh.getMaxColumns() - TAB.LAST_COL - 1);
  sh.setTabColor(TAB_COLORS.OBJTAB);
  const markers = [];
  for (let r = 1; r <= L.lastRow; r++) markers.push(['']);

  // ── шапка ──
  sh.getRange('I1').setNumberFormat('@').setValue(String(objId));
  sh.getRange('H1').setValue('ID объекта:');
  const look = f => 'IFERROR(VLOOKUP([[ID]],{[[OBJ.id]],[[OBJ.' + f + ']]},2,FALSE),"")';
  const tf = f => resolveTabF_(f, L, null);
  sh.getRange('B1').setFormula(toLocaleF_(tf('=IFERROR(VLOOKUP([[ID]],{[[OBJ.id]],[[OBJ.name]]},2,FALSE),"⚠ объекта с этим ID нет в 01_ОБЪЕКТЫ")')));
  sh.getRange('B1:G1').merge();
  const head = [
    ['Адрес', '=' + look('address')], ['Тип · сделка', '=' + look('kind') + '&IF(' + look('deal') + '="",""," · "&' + look('deal') + ')'],
    ['Площадь, м²', '=' + look('area')], ['Цена', '=' + look('price')], ['Цена за м²', '=' + look('price_m2')], ['Статус', '=' + look('status')],
    ['Стратегия заполнена', null],
    ['Команда', '=TEXTJOIN(" · ",TRUE,' + look('manager') + ',' + look('assistant') + ',' + look('smm') + ')'],
  ];
  head.forEach((h, i) => {
    sh.getRange(2, 2 + i).setValue(h[0]);
    if (h[1]) sh.getRange(3, 2 + i).setFormula(toLocaleF_(tf(h[1])));
  });
  sh.getRange(TAB.PCT.replace(/\$/g, '')).setFormula(toLocaleF_(strategyPctFormula_(L))).setNote(STRATEGY_PCT_NOTE);
  const gid = code => { try { return sheet_(code).getSheetId(); } catch (e) { return 0; } };
  const links = [
    ['=IF(' + look('crm_link') + '="","",HYPERLINK(' + look('crm_link') + ',"Объект в CRM"))'],
    ['=IF(' + look('folder_link') + '="","",HYPERLINK(' + look('folder_link') + ',"Папка объекта"))'],
    ['=IF(' + look('last_report_link') + '="","",HYPERLINK(' + look('last_report_link') + ',"Последний отчёт"))'],
    ['=HYPERLINK("#gid=' + gid('TASK') + '","→ 02 Задачи")'],
    ['=HYPERLINK("#gid=' + gid('BASE') + '","→ 03 Обзвон и КП")'],
    ['=HYPERLINK("#gid=' + gid('CONT') + '","→ 04 Контент")'],
    ['=HYPERLINK("#gid=' + gid('DASH') + '","→ Дэшборд")'],
  ];
  links.forEach((l, i) => sh.getRange(4, 2 + i).setFormula(toLocaleF_(tf(l[0]))));
  sh.getRange('B5').setValue('Белые ячейки заполняет команда, серые считаются сами. Строки внутри раздела можно добавлять (вставить строку). Все изменения пишутся в 09_ИСТОРИЯ.');
  sh.getRange('B1').setFontSize(16).setFontWeight('bold');
  sh.getRange('H1').setFontColor(COLORS.GREY_FG).setFontSize(9).setHorizontalAlignment('right');
  sh.getRange('I1').setFontColor(COLORS.GREY_FG).setFontWeight('bold');
  sh.getRange('B2:I2').setFontColor(COLORS.GREY_FG).setFontSize(9);
  sh.getRange('B3:I3').setFontWeight('bold').setBackground(COLORS.FORMULA_CELL_BG).setWrap(true).setVerticalAlignment('top');
  sh.getRange('D3').setNumberFormat(nf_('#,##0.0'));
  sh.getRange('E3:F3').setNumberFormat(nf_('money'));
  sh.getRange(TAB.PCT.replace(/\$/g, '')).setNumberFormat('0%').setFontSize(14);
  sh.getRange('B4:H4').setFontColor('#1565C0');
  sh.getRange('B5').setFontColor(COLORS.GREY_FG).setFontSize(9).setFontStyle('italic');
  protectWarn_(sh.getRange(1, 1, 5, TAB.LAST_COL), 'Шапка вкладки объекта — считается автоматически');

  const DV = SpreadsheetApp.newDataValidation;
  const cfRules = [];
  const pctCell = sh.getRange(TAB.PCT.replace(/\$/g, ''));
  cfRules.push(cfRule_('=' + TAB.PCT + '>=1', pctCell, COLORS.GREEN_BG, COLORS.GREEN_FG));
  cfRules.push(cfRule_('=' + TAB.PCT + '<0.5', pctCell, COLORS.RED_BG, COLORS.RED_FG));
  cfRules.push(cfRule_('=' + TAB.PCT + '<1', pctCell, COLORS.YELLOW_BG, COLORS.YELLOW_FG));

  // ── разделы ──
  L.secs.forEach(s => {
    const p = L.pos[s.key];
    markers[p.title - 1] = ['§' + s.key];
    markers[p.hint - 1] = ['~'];
    markers[p.sep - 1] = ['·'];
    sh.getRange(p.title, 2).setValue(s.title);
    sh.getRange(p.title, 2, 1, TAB.LAST_COL - 1).setBackground(COLORS.SECTION_BG).setFontColor(COLORS.SECTION_FG).setFontWeight('bold');
    sh.getRange(p.hint, 2).setValue(s.hint).setFontColor(COLORS.GREY_FG).setFontSize(9).setFontStyle('italic');
    sh.getRange(p.hint, 2, 1, TAB.LAST_COL - 1).merge().setWrap(true);

    if (s.type === 'kv') {
      s.items.forEach(it => {
        const r = p.items[it.key];
        markers[r - 1] = ['K:' + it.key];
        sh.getRange(r, 2).setValue(it.label).setFontWeight('bold').setVerticalAlignment('top');
        const val = sh.getRange(r, 3, 1, TAB.LAST_COL - 2).merge();
        const cell = sh.getRange(r, 3);
        if (it.k === 'f') {
          cell.setFormula(toLocaleF_(resolveTabF_('=' + it.f, L, s.key)));
          val.setBackground(COLORS.FORMULA_CELL_BG);
          protectWarn_(val, 'Считается автоматически');
        } else {
          val.setBorder(true, true, true, true, false, false, COLORS.INPUT_BORDER, SpreadsheetApp.BorderStyle.SOLID).setWrap(true).setVerticalAlignment('top');
          if (it.key in data.kv && data.kv[it.key] !== '') cell.setValue(data.kv[it.key]);
          const v = tabValidation_(it.k);
          if (v) cell.setDataValidation(v);
        }
        const fmt = it.fmt || ({ money: 'money', date: 'date' })[it.k];
        if (fmt) cell.setNumberFormat(nf_(fmt));
        cell.setHorizontalAlignment('left');
      });
      return;
    }

    markers[p.header - 1] = ['H'];
    const n = p.last - p.first + 1;
    const titles = s.type === 'table' ? s.cols.map(c => c.t) : s.cols;
    const hdr = sh.getRange(p.header, 2, 1, titles.length);
    hdr.setValues([titles]).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');

    if (s.type === 'table') {
      const rows = (data.tables[s.key] || []);
      s.cols.forEach((c, i) => {
        const col = 2 + i;
        const body = sh.getRange(p.first, col, n, 1);
        const hcell = sh.getRange(p.header, col);
        if (c.k === 'f') {
          hcell.setFormula(toLocaleF_('={"' + c.t + '";ARRAYFORMULA(IF(LEN(' + L.colRange(s.key, 1) + ')=0,"",' + resolveTabF_(c.f, L, s.key) + '))}'));
          hcell.setBackground(COLORS.HDR_FORMULA_BG).setFontColor(COLORS.HDR_FORMULA_FG);
          body.setBackground(COLORS.FORMULA_CELL_BG);
          protectWarn_(sh.getRange(p.header, col, n + 1, 1), 'Формула «' + c.t + '» — считается автоматически');
        } else {
          hcell.setBackground(COLORS.HDR_INPUT_BG).setFontColor(COLORS.HDR_INPUT_FG);
          body.setBorder(true, true, true, true, true, true, COLORS.INPUT_BORDER, SpreadsheetApp.BorderStyle.SOLID);
          const v = tabValidation_(c.k, c);
          if (v) body.setDataValidation(v);
          if (c.k === 'text' || c.k === 'link') body.setNumberFormat('@');
        }
        const fmt = c.fmt || ({ money: 'money', date: 'date', num: '#,##0.0' })[c.k];
        if (fmt) body.setNumberFormat(nf_(fmt));
        body.setWrap(c.k === 'text').setVerticalAlignment('top');
      });
      if (rows.length) {
        s.cols.forEach((c, i) => {
          if (c.k === 'f') return;
          sh.getRange(p.first, 2 + i, rows.length, 1).setValues(rows.map(r => [r[i] === null ? '' : r[i]]));
        });
      }
      for (let r = p.first; r <= p.last; r++) markers[r - 1] = [''];
    } else if (s.type === 'files') {
      hdr.setBackground(COLORS.HDR_AUTO_BG).setFontColor(COLORS.HDR_AUTO_FG);
      sh.getRange(p.first, 2, n, titles.length).setBackground(COLORS.FORMULA_CELL_BG).setVerticalAlignment('top');
      sh.getRange(p.first, 5, n, 1).setNumberFormat('dd.mm.yyyy');
      sh.getRange(p.first, 2, 1, 1).setValue('Список появится после «Обновить документы объектов» (или завтра утром).').setFontColor(COLORS.GREY_FG);
      protectWarn_(sh.getRange(p.header, 1, n + 1, TAB.LAST_COL), 'Список документов заполняет скрипт из папки объекта');
    } else {
      // auto / grid — только чтение
      hdr.setBackground(COLORS.HDR_FORMULA_BG).setFontColor(COLORS.HDR_FORMULA_FG);
      const body = sh.getRange(p.first, 2, n, titles.length);
      body.setBackground(COLORS.FORMULA_CELL_BG).setVerticalAlignment('top');
      if (s.type === 'auto') {
        sh.getRange(p.first, 2).setFormula(toLocaleF_(resolveTabF_(s.f, L, s.key)));
        (s.fmts || []).forEach((f, i) => { if (f) sh.getRange(p.first, 2 + i, n, 1).setNumberFormat(nf_(f)); });
        sh.getRange(p.first, 3, n, 1).setWrap(true);
        if (s.key === 'PF') {
          const stat = sh.getRange(p.first, 9, n, 1);
          cfRules.push(cfRule_('=$I' + p.first + '="ПРОСРОЧЕНО"', sh.getRange(p.first, 2, n, 8), COLORS.RED_BG, COLORS.RED_FG));
          cfRules.push(cfRule_('=$I' + p.first + '="' + (dictFirstByClassSafe_('task_status', CLS.DONE) || 'Выполнено') + '"', stat, COLORS.GREEN_BG, COLORS.GREEN_FG));
        }
      } else {
        s.grid.forEach((gr, ri) => gr.forEach((f, ci) => {
          if (f) sh.getRange(p.first + ri, 2 + ci).setFormula(toLocaleF_('=ARRAYFORMULA(' + resolveTabF_(f, L, s.key).slice(1) + ')'));
        }));
        sh.getRange(p.first, 2, n, 1).setFontWeight('bold');
      }
      protectWarn_(sh.getRange(p.header, 1, n + 1, TAB.LAST_COL), 'Раздел «' + s.title + '» собирается автоматически');
    }
  });

  markers[0] = [tabToken_() || '#']; // A1: вкладка собрана до конца (при обрыве по лимиту времени метки не пишутся)
  sh.getRange(1, 1, markers.length, 1).setValues(markers).setFontColor('#B0BEC5').setFontSize(8);
  protectWarn_(sh.getRange(1, 1, sh.getMaxRows(), 1), 'Служебные метки разделов — не менять');
  sh.setConditionalFormatRules(cfRules);
  [22, 230, 150, 150, 170, 170, 130, 110, 120].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(3);
  sh.hideColumns(1);
  return L;
}

function tabValidation_(kind, c) {
  const DV = SpreadsheetApp.newDataValidation;
  if (kind === 'dd') {
    const src = c.dict ? 'D.' + c.dict : c.list;
    return DV().requireValueInRange(rangeFromToken_(src), true).setAllowInvalid(true).build();
  }
  if (kind === 'date') return DV().requireDate().setAllowInvalid(false).setHelpText('Введите дату').build();
  if (kind === 'num' || kind === 'money') return DV().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).setHelpText('Введите число').build();
  return null;
}

function dictFirstByClassSafe_(key, cls) { try { return dictFirstByClass_(key, cls); } catch (e) { return ''; } }

// ───────────────────────── связь с 01_ОБЪЕКТЫ ─────────────────────────

function objTabName_(obj) {
  const clean = String(obj.name || '').replace(/[\[\]\*\?\/\\:']/g, ' ').replace(/\s+/g, ' ').trim();
  return (SYS.TAB_PREFIX + clean).slice(0, 80) + ' (' + obj.id + ')';
}

function isObjectTab_(sh) { return sh.getName().indexOf(SYS.TAB_PREFIX) === 0; }

function objectTabs_() { return ss_().getSheets().filter(isObjectTab_); }

/** Вкладка объекта: по сохранённому gid, по ID в I1, по имени. */
function findObjectTab_(obj) {
  const ss = ss_();
  const m = /#gid=(\d+)/.exec(String(obj.tab_url || ''));
  const tabs = objectTabs_();
  if (m) { const s = tabs.find(x => String(x.getSheetId()) === m[1]); if (s) return s; }
  const byId = tabs.find(x => String(x.getRange(TAB.ID).getValue()) === String(obj.id));
  if (byId) return byId;
  return ss.getSheetByName(objTabName_(obj));
}

/**
 * Создаёт вкладку объекта или обновляет существующую.
 * mode: 'create' — только если вкладки нет; 'rebuild' — пересобрать с сохранением данных; 'rename' — имя и ID.
 */
function syncObjectTab_(obj, mode) {
  if (!obj || !obj.id || !obj.name) return null;
  const ss = ss_();
  let sh = findObjectTab_(obj);
  const name = objTabName_(obj);
  let built = false;
  if (!sh) {
    sh = ss.insertSheet(name, objTabInsertIndex_());
    const saved = tabBackup_(obj.id); // вкладку удалили — восстанавливаем данные из 98_КОПИИ_ВКЛАДОК
    buildObjectTab_(sh, obj.id, saved);
    if (saved) logHistory_([{ sheet: name, record_id: obj.id, obj_id: obj.id, field: 'Вкладка', old: '', new: 'восстановлена из копии', kind: HIST_KIND.CREATE }], userEmail_());
    built = true;
  } else {
    if (sh.getName() !== name && !ss.getSheetByName(name)) sh.setName(name);
    if (String(sh.getRange(TAB.ID).getValue()) !== String(obj.id)) sh.getRange(TAB.ID).setNumberFormat('@').setValue(String(obj.id));
    if (mode === 'rebuild') {
      let data = null;
      try { data = readObjectTab_(sh); } catch (e) { data = null; } // недособранная вкладка — данных в ней нет
      buildObjectTab_(sh, obj.id, data);
      built = true;
    }
  }
  if (built) { try { protectObjectTab_(sh); } catch (e) { /* защиту поставит «Обновить» владельца */ } }
  if (built || mode === 'files') {
    try { fillObjectFiles_(sh, obj); } catch (e) { /* Drive недоступен — список обновится позже */ }
  }
  const url = '#gid=' + sh.getSheetId();
  const quoted = "'" + sh.getName().replace(/'/g, "''") + "'";
  writeFields_(sheet_('OBJ'), 'OBJ', obj._row, {
    tab_link: '=HYPERLINK("' + url + '","открыть")',
    strategy_pct: '=IFERROR(' + quoted + '!' + TAB.PCT + ',"")',
    tab_name: sh.getName(), tab_url: url,
  });
  return { sheet: sh, built: built };
}

/** Новые вкладки встают после последней вкладки объекта (сразу за 01_ОБЪЕКТЫ). */
function objTabInsertIndex_() {
  const sheets = ss_().getSheets();
  let idx = 0;
  sheets.forEach((s, i) => {
    if (s.getName() === SHEET_NAMES.OBJ || isObjectTab_(s)) idx = i + 1;
  });
  return idx;
}

// ───────────── создание / пересборка вкладок с учётом лимита Google (6 минут на запуск) ─────────────

const TAB_BUDGET_MS = 4.5 * 60000;

function tabToken_() { return PropertiesService.getDocumentProperties().getProperty('TAB_TOKEN') || ''; }

/** Вкладка собрана до конца: служебные метки разделов записаны. */
function tabIsComplete_(sh) {
  const n = Math.min(sh.getMaxRows(), 80);
  return sh.getRange(1, 1, n, 1).getValues().some(r => String(r[0]).indexOf('§') === 0);
}

/** Пометить все вкладки к пересборке (после обновления системы). */
function startTabRebuild_() {
  const p = PropertiesService.getDocumentProperties();
  p.setProperty('TAB_TOKEN', '#' + Date.now());
  p.setProperty('TAB_REBUILD', '1');
}

/**
 * Создаёт недостающие вкладки, досоздаёт оборванные и (если запущена пересборка) пересобирает старые —
 * пока хватает времени. Остальное доделывает сам через минуту (триггер tabsJob), пока всё не будет готово.
 */
function tabsWork_(start) {
  start = start || Date.now();
  const props = PropertiesService.getDocumentProperties();
  const pending = props.getProperty('TAB_REBUILD') === '1';
  const token = tabToken_();
  const res = { created: 0, rebuilt: 0, left: 0 };
  readTable_('OBJ').rows.forEach(o => {
    if (!o.id || !o.name) return;
    const sh = findObjectTab_(o);
    const mode = !sh ? 'create' : (!tabIsComplete_(sh) || (pending && String(sh.getRange('A1').getValue()) !== token)) ? 'rebuild' : '';
    if (!mode) return;
    if (Date.now() - start > TAB_BUDGET_MS) { res.left++; return; }
    syncObjectTab_(o, mode);
    SpreadsheetApp.flush();
    if (mode === 'create') res.created++; else res.rebuilt++;
  });
  if (!res.left) props.deleteProperty('TAB_REBUILD');
  scheduleTabsJob_(res.left > 0);
  return res;
}

function tabsWorkText_(r) {
  return 'создано вкладок: ' + r.created + ', обновлено: ' + r.rebuilt +
    (r.left ? '. Ещё ' + r.left + ' — доделаются автоматически в ближайшие минуты (лимит Google — 6 минут на запуск)' : '');
}

function scheduleTabsJob_(on) {
  try {
    ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'tabsJob') ScriptApp.deleteTrigger(t); });
    if (on) ScriptApp.newTrigger('tabsJob').timeBased().after(60 * 1000).create();
  } catch (e) { /* без триггера — доделается через «Обновить» */ }
}

/** Триггер: продолжить создание / пересборку вкладок. */
function tabsJob() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) { scheduleTabsJob_(true); return; }
  try {
    tabsWork_();
    orderSheets_();
    applyTabVisibility_();
  } finally {
    lock.releaseLock();
  }
}

/** Меню: создать вкладки для объектов, у которых их ещё нет. */
function createObjectTabs() {
  const r = tabsWork_();
  orderSheets_();
  toast_(tabsWorkText_(r), 'Вкладки объектов', 10);
}

/** Сервис: пересобрать все вкладки (после обновления системы). Данные команды сохраняются. */
function rebuildObjectTabs() {
  startTabRebuild_();
  const r = tabsWork_();
  applyTabVisibility_();
  toast_(tabsWorkText_(r), 'Вкладки объектов', 10);
}

/** Меню: перейти во вкладку выбранного объекта. */
function openObjectTab() {
  const id = selectedObjectId_();
  const obj = id ? objectById_(id) : null;
  if (!obj) {
    SpreadsheetApp.getUi().alert('Встаньте на строку объекта (01_ОБЪЕКТЫ, дэшборд или любой журнал) и повторите.');
    return;
  }
  const r = syncObjectTab_(obj, 'create');
  if (r) { if (r.sheet.isSheetHidden()) r.sheet.showSheet(); r.sheet.activate(); }
}

/** onEdit во вкладке объекта: история изменений (раздел · столбец, было → стало). */
function handleObjectTabEdit_(e, sh) {
  const rng = e.range;
  if (rng.getLastRow() < TAB.FIRST_ROW) return;
  const objId = String(sh.getRange(TAB.ID).getValue() || '');
  const lastRow = rng.getLastRow();
  const markers = sh.getRange(1, 1, lastRow, TAB.LAST_COL).getValues();
  const secs = {};
  objTabSections_().forEach(s => { secs[s.key] = s; });
  const single = rng.getNumRows() === 1 && rng.getNumColumns() === 1;
  const newVals = rng.getValues();
  const hist = [];
  let cur = null, headerRow = null;
  const ctx = [];
  for (let r = 0; r < lastRow; r++) {
    const m = String(markers[r][0] || '');
    if (m.indexOf('§') === 0) { cur = secs[m.slice(1)] || null; headerRow = null; }
    else if (m === 'H') headerRow = markers[r];
    ctx.push({ sec: cur, header: headerRow, marker: m });
  }
  for (let i = 0; i < newVals.length && hist.length < 60; i++) {
    const row = rng.getRow() + i;
    const c = ctx[row - 1];
    if (!c || !c.sec || c.sec.type === 'auto' || c.sec.type === 'grid' || c.sec.type === 'files') continue;
    if (c.marker === '§' + c.sec.key || c.marker === '~' || c.marker === 'H' || c.marker === '·') continue;
    for (let j = 0; j < newVals[i].length; j++) {
      const col = rng.getColumn() + j;
      if (col < 2) continue;
      let field;
      if (c.sec.type === 'kv') field = c.sec.title + ' · ' + markers[row - 1][1];
      else field = c.sec.title + ' · ' + (c.header ? c.header[col - 1] : '');
      const nv = newVals[i][j];
      const ov = single ? (e.oldValue === undefined ? '' : e.oldValue) : '(массовое изменение)';
      if (single && String(ov) === String(nv)) continue;
      hist.push({
        sheet: sh.getName(), record_id: colLetter_(col) + row, obj_id: objId, field: field,
        old: ov, new: nv, kind: ov === '' ? HIST_KIND.INITIAL : HIST_KIND.CHANGE,
      });
    }
  }
  logHistory_(hist, userEmail_(e));
}

// ───────────────────────── документы объекта (папка на Google Диске) ─────────────────────────

const FILE_TYPES_ = [
  [/wordprocessingml|msword|google-apps\.document/, 'Документ'], [/pdf/, 'PDF'],
  [/presentation|powerpoint/, 'Презентация'], [/spreadsheet|excel|csv/, 'Таблица'],
  [/^image\//, 'Фото'], [/^video\//, 'Видео'],
];

function fileTypeLabel_(mime) {
  const t = FILE_TYPES_.find(x => x[0].test(String(mime)));
  return t ? t[1] : 'Файл';
}

/** Все файлы папки объекта (с подпапками до 2 уровней), новые сверху. */
function listObjectFiles_(folder) {
  const out = [];
  const walk = (f, path, depth) => {
    const files = f.getFiles();
    while (files.hasNext()) {
      const x = files.next();
      if (x.isTrashed()) continue;
      out.push({ name: x.getName(), sub: path || '(корень папки)', type: fileTypeLabel_(x.getMimeType()), updated: x.getLastUpdated(), url: x.getUrl() });
    }
    if (depth >= 2) return;
    const subs = f.getFolders();
    while (subs.hasNext()) { const d = subs.next(); walk(d, path ? path + ' / ' + d.getName() : d.getName(), depth + 1); }
  };
  walk(folder, '', 0);
  out.sort((a, b) => b.updated - a.updated);
  return out;
}

/** Заполняет раздел «Документы объекта»; пустое «Полный анализ (ссылка)» — самым новым файлом с «анализ» в названии. */
function fillObjectFiles_(sh, obj) {
  const folder = ensureObjectFolder_(obj.id, 'ROOT');
  const files = listObjectFiles_(folder);
  const L = objTabLayout_({});
  const p = L.pos.FILES;
  const n = p.last - p.first + 1;
  const rng = sh.getRange(p.first, 2, n, 4);
  rng.clearContent();
  const shown = files.slice(0, files.length > n ? n - 1 : n);
  const rich = [], rest = [];
  shown.forEach(f => {
    rich.push([SpreadsheetApp.newRichTextValue().setText(f.name).setLinkUrl(f.url).build()]);
    rest.push([f.sub, f.type, f.updated]);
  });
  if (files.length > shown.length) {
    rich.push([SpreadsheetApp.newRichTextValue().setText('… ещё ' + (files.length - shown.length) + ' — открыть папку объекта').setLinkUrl(folder.getUrl()).build()]);
    rest.push(['', '', '']);
  }
  if (!files.length) {
    rich.push([SpreadsheetApp.newRichTextValue().setText('Папка пока пустая — открыть папку объекта').setLinkUrl(folder.getUrl()).build()]);
    rest.push(['', '', '']);
  }
  sh.getRange(p.first, 2, rich.length, 1).setRichTextValues(rich);
  sh.getRange(p.first, 3, rest.length, 3).setValues(rest);
  // ссылка на анализ, если её не вставили вручную
  const kvRow = L.pos.PRICE.items.analysis_link;
  const cur = sh.getRange(kvRow, 3).getValue();
  const an = files.find(f => /анализ|аналитик/i.test(f.name));
  if (an && (cur === '' || String(cur).indexOf('Google Диск:') === 0)) sh.getRange(kvRow, 3).setValue(an.url);
  return files.length;
}

/** Меню: обновить списки документов во всех вкладках объектов. */
function refreshObjectFiles() {
  const n = refreshObjectFiles_();
  toast_('Обновлено вкладок: ' + n, 'Документы объектов', 6);
}

function refreshObjectFiles_() {
  let n = 0;
  readTable_('OBJ').rows.forEach(o => {
    if (!o.id || !o.name) return;
    const sh = findObjectTab_(o);
    if (!sh) return;
    try { fillObjectFiles_(sh, o); n++; } catch (e) { Logger.log('Документы ' + o.id + ': ' + e.message); }
  });
  return n;
}

// ───────────────────────── видимость вкладок ─────────────────────────

/** Вкладки объектов не в работе (продан, сдан, пауза, договор расторгнут) скрываются; вернули в работу — показываются. */
function applyTabVisibility_() {
  const notWorking = {};
  dictRows_('obj_status').forEach(r => { if (String(r[1]).toUpperCase() === 'НЕТ') notWorking[r[0]] = true; });
  let hidden = 0;
  readTable_('OBJ').rows.forEach(o => {
    if (!o.id || !o.name) return;
    const sh = findObjectTab_(o);
    if (!sh) return;
    if (notWorking[o.status]) { if (!sh.isSheetHidden()) { sh.hideSheet(); } hidden++; }
    else if (sh.isSheetHidden()) sh.showSheet();
  });
  return hidden;
}

function showAllObjectTabs() {
  objectTabs_().forEach(sh => { if (sh.isSheetHidden()) sh.showSheet(); });
  toast_('Показаны все вкладки объектов. Вкладки закрытых объектов снова скроются при «Обновить».', 'Вкладки', 6);
}
