/**
 * 11_SelfTest — автоматическая проверка системы на тестовых данных (раздел 24 ТЗ).
 * Результат — лист 99_САМОПРОВЕРКА и диалог со сводкой. Фильтры, изменённые тестом, возвращаются.
 */

function runSelfTest() {
  const ui = SpreadsheetApp.getUi();
  if (!readTable_('OBJ').rows.some(o => o.name === TEST_NAMES.OSTROV)) {
    ui.alert('Сначала загрузите тестовые данные (меню → Сервис → Загрузить тестовые данные).');
    return;
  }
  const withDrive = ui.alert('Самопроверка',
    'Проверить также создание отчёта (Google Doc + PDF + ссылка) и документа стратегии?\nБудут созданы файлы для объекта «Остров».',
    ui.ButtonSet.YES_NO) === ui.Button.YES;
  const results = selfTest_(withDrive);
  const failed = results.filter(r => !r.ok);
  writeTestSheet_(results);
  ui.alert('Самопроверка: ' + (results.length - failed.length) + ' из ' + results.length + ' проверок пройдено',
    failed.length ? 'Не прошли:\n' + failed.slice(0, 15).map(r => '✗ ' + r.name + ' — ожидалось ' + r.expected + ', получено ' + r.actual).join('\n') + '\n\nПодробно — лист 99_САМОПРОВЕРКА.'
      : 'Все проверки пройдены ✓ Подробно — лист 99_САМОПРОВЕРКА.', ui.ButtonSet.OK);
}

function selfTest_(withDrive) {
  const R = [];
  const eq = (name, actual, expected, tol) => {
    let ok;
    if (typeof expected === 'number') ok = Math.abs(Number(actual) - expected) <= (tol || 0.0001);
    else ok = String(actual) === String(expected);
    R.push({ name: name, ok: ok, expected: expected, actual: actual });
  };
  const has = (name, text, part, negate) => {
    const ok = negate ? String(text).indexOf(part) < 0 : String(text).indexOf(part) >= 0;
    R.push({ name: name, ok: ok, expected: (negate ? 'не содержит ' : 'содержит ') + '«' + part + '»', actual: String(text).slice(0, 120) });
  };
  const truthy = (name, cond, actual) => R.push({ name: name, ok: !!cond, expected: 'да', actual: actual === undefined ? String(!!cond) : actual });

  SpreadsheetApp.flush();
  const M = mondayOf_(today_());
  const P = addDays_(M, -7);
  const wkP = isoWeekKey_(P);
  const objs = readTable_('OBJ').rows;
  const byName = n => objs.find(o => o.name === n);
  const ost = byName(TEST_NAMES.OSTROV), ano = byName(TEST_NAMES.ANOSINO), pav = byName(TEST_NAMES.PAVLOVY);
  const days = (a, b) => Math.round((a - b) / 86400000);

  // 1. Реестр объектов: формулы строки
  eq('01: цена за м² (Остров)', ost.price_m2, Math.round(185000000 / 450));
  eq('01: дней в продаже (Остров)', ost.days_on_market, days(today_(), addDays_(M, -60)));
  eq('01: дней без активности (Павловы)', pav.days_idle, days(today_(), addDays_(M, -21)));
  eq('01: флаг RISK (Павловы)', pav.risk_flag, 'RISK');
  has('01: последнее действие (Остров)', ost.last_action, 'Рассылка');
  truthy('01: следующее действие заполнено (Остров)', ost.next_action && ost.next_action !== '—', ost.next_action);

  // 2. Неделя действия считается из даты
  const acts = readTable_('ACT').rows;
  const a3 = acts.find(a => a.obj_id === ost.id && a.fact.indexOf('премиум-сегмента') > 0 && a.type === 'Рассылка');
  eq('03: неделя из даты', a3 ? a3.week : '', wkP);

  // 3. Воронка 04 с фильтром по объекту и неделе
  const lead = sheet_('LEAD');
  const LB = leadBlockLayout_();
  const keepLB = [lead.getRange(LB.selObj).getValue(), lead.getRange(LB.selWeek).getValue()];
  lead.getRange(LB.selObj).setValue(objLabel_(ost.id, ost.name));
  lead.getRange(LB.selWeek).setValue(weekLabelByKey_(wkP));
  SpreadsheetApp.flush();
  const lv = a1 => lead.getRange(a1).getValue();
  eq('04: контакты (Остров, неделя P)', lv(LB.at.contacts), 50);
  eq('04: ответы', lv(LB.at.responses), 8);
  eq('04: лиды', lv(LB.at.leads), 3);
  eq('04: квалифицированы', lv(LB.at.qual), 2);
  eq('04: конверсия контакт → ответ', lv(LB.conv['Контакт → ответ']), 0.16);
  eq('04: конверсия ответ → квалифицирован', lv(LB.conv['Ответ → квалифицирован']), 0.25);
  eq('04: стоимость лида', lv(LB.conv['Стоимость лида']), 5000);
  lead.getRange(LB.selObj).setValue('Все');
  lead.getRange(LB.selWeek).setValue('Все время');
  SpreadsheetApp.flush();
  eq('04: все объекты, всё время — лиды', lv(LB.at.leads), 11);
  lead.getRange(LB.selObj).setValue(keepLB[0] || 'Все');
  lead.getRange(LB.selWeek).setValue(keepLB[1] || 'Все время');

  // 4. План-факт
  const pf = sheet_('PF');
  const PB = pfBlockLayout_();
  const keepPB = [pf.getRange(PB.selWeek).getValue(), pf.getRange(PB.selObj).getValue()];
  pf.getRange(PB.selWeek).setValue(weekLabelByKey_(wkP));
  pf.getRange(PB.selObj).setValue(objLabel_(ost.id, ost.name));
  SpreadsheetApp.flush();
  const pv = a1 => pf.getRange(a1).getValue();
  eq('06: задач в плане (Остров, P)', pv(PB.at.total), 5);
  eq('06: выполнено', pv(PB.at.done), 2);
  eq('06: % выполнения плана', pv(PB.at.pct), 0.4);
  eq('06: просрочено', pv(PB.at.overdue), 2);
  const kr = t => PB.kpiRows[t];
  eq('06: план контактов', pv(PB.cols.B + kr('Контакты')), 50);
  eq('06: факт контактов', pv(PB.cols.C + kr('Контакты')), 50);
  eq('06: план показов', pv(PB.cols.B + kr('Показы')), 2);
  eq('06: факт показов', pv(PB.cols.C + kr('Показы')), 1);
  eq('06: факт лидов', pv(PB.cols.C + kr('Лиды')), 3);
  pf.getRange(PB.selObj).setValue('Все');
  SpreadsheetApp.flush();
  eq('06: все объекты — факт контактов', pv(PB.cols.C + kr('Контакты')), 65);
  pf.getRange(PB.selWeek).setValue(keepPB[0]);
  pf.getRange(PB.selObj).setValue(keepPB[1] || 'Все');
  const tasks = readTable_('PF').rows;
  const t2 = tasks.find(t => t.obj_id === ost.id && t.week === wkP && t.kpi_metric === 'Показы');
  eq('06: фактический KPI в строке задачи', t2 ? t2.kpi_fact : '', 1);
  eq('06: % KPI в строке задачи', t2 ? t2.kpi_pct : '', 0.5);

  // 5. Статистика
  const st = sheet_('STAT');
  const keepSt = st.getRange('B2').getValue();
  st.getRange('B2').setValue('Все');
  SpreadsheetApp.flush();
  const sec = (dim, key) => statRow_(st, dim, key);
  const so = sec('object', ost.id);
  eq('05: объект — действия', so['Действия'], 9);
  eq('05: объект — контакты', so['Контакты'], 100);
  eq('05: объект — ответы', so['Ответы'], 14);
  eq('05: объект — лиды', so['Лиды'], 4);
  eq('05: объект — квал. лиды', so['Квал. лиды'], 3);
  eq('05: объект — показы', so['Показы'], 2);
  eq('05: объект — первая цена', so['Первая цена'], 195000000);
  eq('05: объект — изменение цены', so['Изменение цены, ₽'], -10000000);
  eq('05: объект — изменений цены', so['Изменений цены'], 1);
  const sc = sec('channel', 'ЦИАН');
  eq('05: канал ЦИАН — просмотры', sc['Просмотры объявлений'], 850);
  eq('05: канал ЦИАН — контакты', sc['Контакты'], 8);
  eq('05: канал ЦИАН — лиды', sc['Лиды'], 2);
  eq('05: канал ЦИАН — объявление → контакт', sc['Объявление → контакт'], 8 / 850);
  const sw = sec('week', wkP);
  eq('05: неделя P — контакты (все объекты)', sw['Контакты'], 65);
  eq('05: неделя P — лиды', sw['Лиды'], 5);
  const stt = sec('total', 'Итого');
  eq('05: итого — контакты', stt['Контакты'], 118);
  st.getRange('B2').setValue(objLabel_(ost.id, ost.name));
  SpreadsheetApp.flush();
  eq('05: фильтр по объекту — итого контакты', sec('total', 'Итого')['Контакты'], 100);
  eq('05: фильтр по объекту — число недель', statKeys_(st, 'week').length, 3);
  st.getRange('B2').setValue(keepSt || 'Все');

  // 6. Отчёт
  const rep = sheet_('REP');
  const keepRep = ['B3', 'B4', 'B5'].map(a => rep.getRange(a).getValue());
  rep.getRange('B3').setValue(objLabel_(ost.id, ost.name));
  rep.getRange('B4').setValue(weekLabelByKey_(wkP));
  rep.getRange('B5').setValue('Тестовый комментарий');
  SpreadsheetApp.flush();
  const v = readReportValues_();
  eq('07: период', v.PERIOD, fmtDate_(P, 'dd.MM') + '–' + fmtDate_(addDays_(P, 6), 'dd.MM.yyyy'));
  eq('07: действий', v.ACTIONS, '5');
  eq('07: контакты', v.CONTACTS, '50');
  eq('07: ответы', v.RESPONSES, '8');
  eq('07: лиды', v.LEADS, '3');
  eq('07: показы', v.SHOWINGS, '1');
  eq('07: переговоры', v.NEGOTIATIONS, '1');
  eq('07: предложения', v.OFFERS, '0');
  eq('07: дней в экспозиции', v.DAYS_ON_MARKET, String(days(addDays_(P, 6), addDays_(M, -60))));
  eq('07: строк «что сделано»', v.DONE.split('\n').length, 5);
  has('07: внутреннее действие скрыто', v.DONE, 'Внутренняя чистка', true);
  has('07: воронка', v.CONVERSIONS, 'Воронка недели: контакты 50 → ответы 8 → заинтересовались 3');
  has('07: конверсия контакт → ответ', v.CONVERSIONS, 'Контакт → ответ: 16%');
  has('07: обратная связь рынка', v.MARKET_FEEDBACK, 'планировка');
  has('07: возражения с подсчётом', v.OBJECTIONS, 'Цена — 2');
  has('07: изменения стратегии', v.STRATEGY_CHANGES, 'Каналы продвижения');
  has('07: изменение цены', v.STRATEGY_CHANGES, 'Цена скорректирована');
  has('07: план следующей недели', v.NEXT_WEEK, 'повторный показ');
  has('07: KPI следующей недели', v.NEXT_WEEK_KPI, 'Контакты: 40');
  eq('07: комментарий руководителя', v.MANAGER_COMMENT, 'Тестовый комментарий');
  const allClient = Object.keys(v).map(k => v[k]).join('\n');
  has('07: нет внутренних комментариев', allClient, 'ВНУТР', true);
  has('07: нет «что нельзя публиковать»', allClient, 'торгу до 5%', true);

  // 7. Предупреждения
  const alerts = readAlerts_();
  const hasAlert = (type, id) => alerts.some(a => a[1] === type && a[2] === id);
  truthy('11: нет активности — Павловы', hasAlert(ALERT.IDLE_HIGH, pav.id));
  truthy('11: много отказов — Павловы', hasAlert(ALERT.MANY_LOST, pav.id));
  truthy('11: нет новых лидов — Павловы', hasAlert(ALERT.NO_LEADS, pav.id));
  truthy('11: стратегия не пересматривалась — Павловы', hasAlert(ALERT.STRATEGY_OLD, pav.id));
  truthy('11: эксклюзив заканчивается — Павловы', hasAlert(ALERT.EXCL_END, pav.id));
  truthy('11: просроченная задача — Остров', hasAlert(ALERT.TASK_OVERDUE, ost.id));
  truthy('11: просроченное действие — Остров', hasAlert(ALERT.ACTION_OVERDUE, ost.id));
  truthy('11: лид без следующего контакта — Остров', hasAlert(ALERT.LEAD_NO_NEXT, ost.id));
  truthy('11: задача без ответственного — Остров', hasAlert(ALERT.NO_OWNER, ost.id));
  truthy('11: нет ложной тревоги «нет активности» — Остров', !hasAlert(ALERT.IDLE_HIGH, ost.id));

  // 8. Дэшборд
  const dashIds = dashIds_();
  truthy('09: все тестовые объекты в таблице дэшборда', [ost.id, ano.id, pav.id].every(id => dashIds.indexOf(id) >= 0), dashIds.join(', '));

  // 9. Масштабирование: новый объект подхватывается без правки формул
  const objSh = sheet_('OBJ');
  const newId = nextId_('OBJ');
  const row = appendRow_('OBJ', { id: newId, name: 'Тест масштабирования', price: 1000000, area: 50, status: 'Новый', date_sign: addDays_(today_(), -1) });
  SpreadsheetApp.flush();
  const nObj = readTable_('OBJ').rows.find(o => o.id === newId);
  eq('Масштаб: цена за м² нового объекта', nObj ? nObj.price_m2 : '', 20000);
  truthy('Масштаб: объект в списке выбора', dictValues_('obj_labels').indexOf(objLabel_(newId, 'Тест масштабирования')) >= 0);
  truthy('Масштаб: объект в статистике', statKeys_(sheet_('STAT'), 'object').indexOf(newId) >= 0 || sheet_('STAT').getRange('B2').getValue() !== 'Все');
  truthy('Масштаб: объект на дэшборде', dashIds_().indexOf(newId) >= 0);
  const ctrlIds = sheet_('CTRL').getRange(CTRL_FIRST, CTRL_MON_START, sheet_('CTRL').getMaxRows() - CTRL_FIRST + 1, 1).getValues().map(r => r[0]);
  truthy('Масштаб: объект в мониторинге 11_КОНТРОЛЬ', ctrlIds.indexOf(newId) >= 0);
  objSh.deleteRow(row);
  SpreadsheetApp.flush();

  // 10. Отчёт в Google Docs + PDF + ссылка (по желанию)
  if (withDrive) {
    try {
      const res = generateReport_(ost.id, wkP, { interactive: false });
      truthy('Drive: Google Doc создан', !!DriveApp.getFileById(res.docId), res.docUrl);
      truthy('Drive: PDF создан', DriveApp.getFileById(res.pdfId).getMimeType() === MimeType.PDF, res.pdfUrl);
      eq('Drive: имя отчёта', res.name, TEST_NAMES.OSTROV + ' — Отчёт — ' + v.PERIOD);
      const doc = DocumentApp.openById(res.docId).getBody().getText();
      has('Drive: в документе нет незаполненных {{...}}', doc, '{{', true);
      has('Drive: в документе нет внутренних комментариев', doc, 'ВНУТР', true);
      const ostNow = readTable_('OBJ').rows.find(o => o.id === ost.id);
      eq('Drive: ссылка на отчёт записана в 01', ostNow.last_report_link, res.pdfUrl);
      const arch = readTable_('ARCH').rows;
      truthy('Drive: запись в архиве отчётов', arch.some(a => a.obj_id === ost.id && a.week === wkP && a.pdf_link === res.pdfUrl && a.status === REPORT_STATUS.ACTUAL));
      const sd = ensureStrategyDoc_(ost.id);
      truthy('Drive: документ стратегии создан и связан', !!sd.url && readTable_('OBJ').rows.find(o => o.id === ost.id).strategy_link === sd.url, sd.url);
    } catch (err) {
      R.push({ name: 'Drive: создание отчёта', ok: false, expected: 'без ошибок', actual: err.message });
    }
  }
  ['B3', 'B4', 'B5'].forEach((a, i) => rep.getRange(a).setValue(keepRep[i]));
  return R;
}

/** Значения строки таблицы статистики по ключу (объект/канал/неделя/…) как {заголовок: значение}. */
function statRow_(sh, dim, key) {
  const s = STAT_SECTIONS[dim];
  const width = sh.getLastColumn();
  const hdr = sh.getRange(s.header, 1, 1, width).getValues()[0];
  const last = s.last || sh.getMaxRows();
  const vals = sh.getRange(s.first, 1, last - s.first + 1, width).getValues();
  const row = vals.find(r => r[0] === key) || [];
  const out = {};
  hdr.forEach((h, i) => { if (h) out[h] = row[i]; });
  return out;
}

function statKeys_(sh, dim) {
  const s = STAT_SECTIONS[dim];
  const last = s.last || sh.getMaxRows();
  return sh.getRange(s.first, 1, last - s.first + 1, 1).getValues().map(r => r[0]).filter(Boolean);
}

function dashIds_() {
  const sh = sheet_('DASH');
  return sh.getRange(DASH_OBJ_FIRST, 1, sh.getMaxRows() - DASH_OBJ_FIRST + 1, 1).getValues().map(r => r[0]).filter(Boolean);
}

function writeTestSheet_(results) {
  const ss = ss_();
  let sh = ss.getSheetByName('99_САМОПРОВЕРКА');
  if (!sh) sh = ss.insertSheet('99_САМОПРОВЕРКА');
  sh.clear();
  const rows = [['Результат', 'Проверка', 'Ожидалось', 'Получено']].concat(results.map(r => [r.ok ? '✓' : '✗', r.name, String(r.expected), String(r.actual)]));
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground(COLORS.HDR_FORMULA_BG);
  results.forEach((r, i) => sh.getRange(i + 2, 1, 1, 4).setBackground(r.ok ? COLORS.GREEN_BG : COLORS.RED_BG));
  sh.getRange(rows.length + 2, 1).setValue('Запуск: ' + fmtDate_(new Date(), 'dd.MM.yyyy HH:mm'));
  sh.setColumnWidth(1, 80); sh.setColumnWidth(2, 380); sh.setColumnWidth(3, 260); sh.setColumnWidth(4, 360);
  sh.activate();
}
