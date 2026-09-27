/**
 * 25_MediaTasks — фото и видео объектов хранятся на Яндекс Диске (папка «Объекты на ДОГОВОРЕ»), в Google Диск не переносятся.
 * Для каждого НОВОГО объекта ассистенту автоматически ставится задача проверить / создать его папку с фото и видео.
 * Объекты, которые были в системе при первом запуске, не трогаются (для них задачи ставятся вручную).
 */

const MEDIA_TASK_MARK = 'Яндекс Диск';
const MEDIA_TASK_TEXT = 'Проверить папку объекта на Яндекс Диске («Объекты на ДОГОВОРЕ»): есть ли фото и видео. Если нет — создать папку с названием объекта и загрузить материалы';

/** Ставит задачу «фото и видео на Яндекс Диске» новым объектам. Возвращает число поставленных задач. */
function ensureMediaTasks_() {
  const props = PropertiesService.getScriptProperties();
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name);
  const raw = props.getProperty('MEDIA_TASK_KNOWN');
  if (raw === null) { // первый запуск: текущие объекты запоминаем, задачи не ставим
    props.setProperty('MEDIA_TASK_KNOWN', JSON.stringify(objs.map(o => String(o.id))));
    return 0;
  }
  const known = JSON.parse(raw);
  const fresh = objs.filter(o => known.indexOf(String(o.id)) < 0);
  if (!fresh.length) return 0;
  const tasks = readTable_('TASK').rows;
  const hasTask = id => tasks.some(t => String(t.obj_id) === String(id) && String(t.task).indexOf(MEDIA_TASK_MARK) >= 0);
  const owner = teamDefaults_().assistant || '';
  const source = dictValues_('task_sources').indexOf('Система') >= 0 ? 'Система' : 'Вручную';
  const deadline = workdayAfter_(today_(), 2);
  const cache = {};
  const rows = fresh.filter(o => !hasTask(o.id)).map(o => ({
    id: nextId_('TASK', cache), week: isoWeekKey_(deadline), obj_id: String(o.id), block: 'Фото и видео', task: MEDIA_TASK_TEXT,
    owner: owner, unit: '', plan: '', deadline: deadline, status: dictFirstByClass_('task_status', CLS.OPEN),
    to_report: false, source: source, created_at: new Date(), author: 'система',
  }));
  if (rows.length) {
    appendRows_('TASK', rows);
    logHistory_(rows.map(r => ({ sheet: SHEET_NAMES.TASK, record_id: r.id, obj_id: r.obj_id, field: 'Задача', old: '', new: 'Фото и видео на Яндекс Диске', kind: HIST_KIND.CREATE, note: 'Автозадача для нового объекта' })), 'система');
  }
  props.setProperty('MEDIA_TASK_KNOWN', JSON.stringify(known.concat(fresh.map(o => String(o.id)))));
  return rows.length;
}

/** Один раз: текущим объектам без такой задачи — задача ассистенту на следующий рабочий день. */
function backfillMediaTasks_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MEDIA_TASK_BACKFILL') === 'done') return 0;
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && o.in_work !== 'НЕТ');
  const tasks = readTable_('TASK').rows;
  const hasTask = id => tasks.some(t => String(t.obj_id) === String(id) && String(t.task).indexOf(MEDIA_TASK_MARK) >= 0);
  const owner = teamDefaults_().assistant || '';
  const source = dictValues_('task_sources').indexOf('Система') >= 0 ? 'Система' : 'Вручную';
  const deadline = workdayAfter_(today_(), 1);
  const cache = {};
  const rows = objs.filter(o => !hasTask(o.id)).map(o => ({
    id: nextId_('TASK', cache), week: isoWeekKey_(deadline), obj_id: String(o.id), block: 'Фото и видео', task: MEDIA_TASK_TEXT,
    owner: owner, unit: '', plan: '', deadline: deadline, status: dictFirstByClass_('task_status', CLS.OPEN),
    to_report: false, source: source, created_at: new Date(), author: 'система',
  }));
  if (rows.length) appendRows_('TASK', rows);
  props.setProperty('MEDIA_TASK_BACKFILL', 'done');
  const known = JSON.parse(props.getProperty('MEDIA_TASK_KNOWN') || '[]');
  props.setProperty('MEDIA_TASK_KNOWN', JSON.stringify(known.concat(objs.map(o => String(o.id)).filter(id => known.indexOf(id) < 0))));
  return rows.length;
}

/** Дата через n рабочих дней (сб и вс пропускаются). */
function workdayAfter_(d, n) {
  let x = d;
  while (n > 0) { x = addDays_(x, 1); if (x.getDay() !== 0 && x.getDay() !== 6) n--; }
  return x;
}
