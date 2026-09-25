/**
 * 07_Planning — недельный цикл: план недели (понедельник) и перенос незакрытых задач.
 */

function createWeekPlan() {
  const ui = SpreadsheetApp.getUi();
  const t = today_();
  const dow = t.getDay() || 7;
  const def = isoWeekKey_(dow >= 5 ? addDays_(t, 7) : t); // с пятницы планируем следующую неделю
  const r = ui.prompt('Создать план недели',
    'Неделя в формате 2026-W40.\nПусто = ' + def + ' (' + weekPeriodLabel_(def) + ').\n\n' +
    'Для каждого объекта в работе будут добавлены KPI по умолчанию (10_НАСТРОЙКИ), а незакрытые задачи прошлой недели можно перенести.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const key = r.getResponseText().trim() || def;
  if (!mondayOfWeekKey_(key)) { ui.alert('Неверный формат недели: ' + key + '. Нужно, например, 2026-W40.'); return; }
  const res = buildWeekPlan_(key, { interactive: true });
  sheet_('PF').activate();
  ui.alert('План недели ' + key,
    'Перенесено незакрытых задач: ' + res.moved + '\nДобавлено строк KPI: ' + res.created +
    '\n\nДополните задачи недели (столбец «Задача»), ответственных и цели. Итоги — в блоке справа на листе 06_ПЛАН_ФАКТ.',
    ui.ButtonSet.OK);
}

function buildWeekPlan_(key, opts) {
  opts = opts || {};
  const mon = mondayOfWeekKey_(key);
  const prevKey = isoWeekKey_(addDays_(mon, -7));
  const user = userEmail_();
  const hist = [];
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.in_work === 'ДА');
  const active = {};
  objs.forEach(o => { active[o.id] = o; });

  // 1. незакрытые задачи прошлой недели
  const pf = readTable_('PF');
  const openPrev = pf.rows.filter(r => r.week === prevKey && r.status_class === CLS.OPEN && active[r.obj_id]);
  let moved = 0;
  if (openPrev.length) {
    let go = true;
    if (opts.interactive) {
      const ui = SpreadsheetApp.getUi();
      go = ui.alert('Незакрытые задачи', 'На неделе ' + prevKey + ' осталось незакрытых задач: ' + openPrev.length +
        '.\nПеренести их на ' + key + '? Старые строки получат статус «Перенесено» и останутся в истории.', ui.ButtonSet.YES_NO) === ui.Button.YES;
    }
    if (go) {
      const movedStatus = dictFirstByClass_('task_status', CLS.MOVED);
      openPrev.forEach(r => {
        writeFields_(pf.sh, 'PF', r._row, { status: movedStatus });
        hist.push({ sheet: SHEET_NAMES.PF, record_id: r.task_id, obj_id: r.obj_id, field: fieldTitle_('PF', 'status'), old: r.status, new: movedStatus, kind: HIST_KIND.CHANGE, note: 'План недели ' + key });
        if (moveTask_(r, hist, key)) moved++;
      });
    }
  }

  // 2. KPI по умолчанию для объектов, у которых на эту неделю KPI ещё нет
  const kpis = defaultKpi_();
  const now = readTable_('PF');
  const openStatus = dictFirstByClass_('task_status', CLS.OPEN);
  const idCache = {};
  const rows = [];
  objs.forEach(o => {
    const has = now.rows.some(r => r.week === key && r.obj_id === o.id && r.kpi_metric);
    if (has) return;
    kpis.forEach(k => {
      rows.push({
        week: key, obj_id: o.id, owner: o.assistant || o.manager || '', plan: 'KPI недели', kpi_metric: k[0], kpi_plan: k[1],
        status: openStatus, deadline: addDays_(mon, 4), to_report: true, task_id: nextId_('PF', idCache), created_at: new Date(),
      });
    });
  });
  appendRows_('PF', rows);
  logHistory_(hist, user);
  try {
    const label = weekLabelByKey_(key);
    if (label) sheet_('PF').getRange(pfBlockLayout_().selWeek).setValue(label);
  } catch (e) { /* неделя вне справочника — фильтр не меняем */ }
  return { key: key, moved: moved, created: rows.length };
}

function defaultKpi_() {
  const r = ss_().getRangeByName('CFG_DEFAULT_KPI');
  if (!r) return DEFAULT_WEEK_KPI;
  return r.getValues().filter(v => v[0] !== '' && v[1] !== '' && !isNaN(Number(v[1]))).map(v => [v[0], Number(v[1])]);
}
