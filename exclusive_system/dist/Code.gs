/** СИСТЕМА МАРКЕТИНГА ЭКСКЛЮЗИВОВ — весь код одним файлом. Собрано из apps_script/*.gs (tools/build_dist.sh). */

// ═════════════ 00_Config.gs ═════════════
/**
 * СИСТЕМА МАРКЕТИНГА ЭКСКЛЮЗИВОВ — v2
 * 00_Config — константы, справочники, настройки.
 *
 * Идея: по каждому объекту — своя вкладка с маркетинговой стратегией
 * (аналитика и цена → сценарии использования → аудитории → офферы и материалы → каналы и партнёры → выводы).
 * Работа команды пишется в общие журналы (задачи, обзвон и КП, контент) и оттуда сама собирается
 * во вкладку объекта, в дэшборд и в еженедельный отчёт клиенту.
 * Клиентов, сделки и показы система не ведёт — это CRM.
 */

const SYS = {
  VERSION: '2.0.0',
  TITLE: 'СИСТЕМА МАРКЕТИНГА ЭКСКЛЮЗИВОВ',
  MENU: 'МАРКЕТИНГ ОБЪЕКТОВ',
  ROOT_FOLDER: 'СИСТЕМА ЭКСКЛЮЗИВОВ',
  FOLDERS: {
    MASTER: '00_ТАБЛИЦА',
    OBJECTS: '01_ОБЪЕКТЫ',
    TEMPLATES: '02_ШАБЛОНЫ',
  },
  /** Подпапки внутри папки объекта «Название (ID)». */
  OBJECT_SUBFOLDERS: {
    ANALYTICS: 'Аналитика',
    MATERIALS: 'КП и презентации',
    REPORTS: 'Отчёты',
    MEDIA: 'Фото и видео',
  },
  REPORT_TEMPLATE_NAME: 'Шаблон еженедельного отчёта',
  DATA_ROWS: 2000,
  TZ: 'Europe/Moscow',
  LOCALE: 'ru_RU',
  PROTECT_PREFIX: 'SYS: ',
  TAB_PREFIX: '▸ ',          // вкладки объектов: «▸ Лермонтовский 1 (4501)»
};

const SHEET_NAMES = {
  DASH: '00_ДЭШБОРД',
  OBJ: '01_ОБЪЕКТЫ',
  TASK: '02_ЗАДАЧИ',
  BASE: '03_ОБЗВОН_И_КП',
  CONT: '04_КОНТЕНТ',
  REP: '05_ОТЧЁТ_КЛИЕНТУ',
  LIB: '06_БИБЛИОТЕКА',
  DICT: '07_СПРАВОЧНИКИ',
  CFG: '08_НАСТРОЙКИ',
  HIST: '09_ИСТОРИЯ',
  ARCH: '10_АРХИВ_ОТЧЁТОВ',
};

const SHEET_ORDER = ['DASH', 'OBJ', 'TASK', 'BASE', 'CONT', 'REP', 'LIB', 'DICT', 'CFG', 'HIST', 'ARCH'];

const TAB_COLORS = {
  DASH: '#1565C0', OBJ: '#37474F', TASK: '#2E7D32', BASE: '#2E7D32', CONT: '#2E7D32', REP: '#6A1B9A',
  LIB: '#EF6C00', DICT: '#9E9E9E', CFG: '#9E9E9E', HIST: '#9E9E9E', ARCH: '#6A1B9A', OBJTAB: '#00897B',
};

const COLORS = {
  HDR_INPUT_BG: '#263238', HDR_INPUT_FG: '#FFFFFF',
  HDR_FORMULA_BG: '#CFD8DC', HDR_FORMULA_FG: '#263238',
  HDR_AUTO_BG: '#E3E7EA', HDR_AUTO_FG: '#37474F',
  HDR_HELPER_BG: '#F1F3F4', HDR_HELPER_FG: '#80868B',
  FORMULA_CELL_BG: '#F8F9FA',
  SECTION_BG: '#263238', SECTION_FG: '#FFFFFF',
  SUBHEADER_BG: '#ECEFF1',
  INPUT_BG: '#FFFFFF', INPUT_BORDER: '#CFD8DC',
  RED_BG: '#F4CCCC', RED_FG: '#7F1D1D',
  YELLOW_BG: '#FFF2CC', YELLOW_FG: '#6B4E00',
  GREEN_BG: '#D9EAD3', GREEN_FG: '#1E4620',
  GREY_FG: '#80868B',
  SELECT_BG: '#FFF8E1',
};

/** Системные классы значений справочников (сами названия можно переименовывать). */
const CLS = { OPEN: 'OPEN', DONE: 'DONE', MOVED: 'MOVED', FAIL: 'FAIL', CANCEL: 'CANCEL' };

const HIST_KIND = { INITIAL: 'Первичное значение', CHANGE: 'Изменение', MOVE: 'Перенос', CREATE: 'Создание' };
const REPORT_STATUS = { ACTUAL: 'Актуальный', REPLACED: 'Заменён' };

/**
 * Единицы плана задач и откуда берётся факт автоматически:
 *   CALLS — звонки из 03_ОБЗВОН_И_КП (дата звонка на неделе),
 *   KP    — отправленные КП (дата КП на неделе),
 *   RESP  — полученные ответы (дата ответа на неделе),
 *   PUB   — опубликованный контент из 04_КОНТЕНТ,
 *   ''    — факт вносится вручную.
 */
function unitDefs_() {
  return [
    ['звонков', 'CALLS'], ['КП', 'KP'], ['ответов', 'RESP'], ['публикаций', 'PUB'],
    ['писем', ''], ['встреч', ''], ['документов', ''], ['шт', ''],
  ];
}

/** Настройки (лист 08_НАСТРОЙКИ) → именованные диапазоны CFG_<KEY>. */
function cfgDefs_() {
  return [
    { group: 'Контроль' },
    { key: 'IDLE_DAYS', label: 'Объект без активности дольше, дней — красный на дэшборде', value: 7 },
    { key: 'WEEKS_START', label: 'Начало учёта недель (любая дата)', value: '2026-08-03', fmt: 'dd.mm.yyyy', date: true },
    { key: 'FUTURE_WEEKS', label: 'Сколько будущих недель показывать в списках', value: 8 },
    { group: 'Шапка отчёта клиенту (исполнитель)' },
    { key: 'EXEC_NAME', label: 'Исполнитель (как в договоре)', value: 'ИП Копачева Н.А.' },
    { key: 'EXEC_HEADER', label: 'Шапка отчёта (реквизиты, строки через « | »)', value: 'Индивидуальный предприниматель Копачева Наталья Анатольевна | Свидетельство № 312744805300028 | тел.: 8(925)5617004 | sdelka77.ru' },
    { key: 'MANAGER_NAME', label: 'Подпись под отчётом', value: 'Наталья Копачева' },
    { group: 'Служебное — заполняет скрипт' },
    { key: 'FOLDER_ROOT_ID', label: 'ID папки «СИСТЕМА ЭКСКЛЮЗИВОВ»', value: '', sys: true },
    { key: 'FOLDER_MASTER_ID', label: 'ID папки 00_ТАБЛИЦА', value: '', sys: true },
    { key: 'FOLDER_OBJECTS_ID', label: 'ID папки 01_ОБЪЕКТЫ', value: '', sys: true },
    { key: 'FOLDER_TEMPLATES_ID', label: 'ID папки 02_ШАБЛОНЫ', value: '', sys: true },
    { key: 'TEMPLATE_REPORT_ID', label: 'ID шаблона отчёта (Google Doc)', value: '', sys: true },
    { key: 'SYSTEM_VERSION', label: 'Версия системы', value: SYS.VERSION, sys: true },
  ];
}

/** Задачи, которые «Создать план недели» ставит каждому объекту в работе (меняются в 08_НАСТРОЙКИ). */
const DEFAULT_WEEK_TASKS = [
  ['База и рассылки', 'Обзвон компаний по базе', 'звонков', 10],
  ['База и рассылки', 'Отправить КП', 'КП', 8],
  ['Контент', 'Публикации об объекте', 'публикаций', 2],
];

/** Справочники (лист 07_СПРАВОЧНИКИ). Колонка «Класс» — системный смысл значения. */
function dictDefs_() {
  return [
    { key: 'obj_kinds', cols: ['Тип объекта'], values: [['Коммерция'], ['Жильё'], ['Загородный дом'], ['Особняк'], ['Земля'], ['Другое']] },
    { key: 'deal_types', cols: ['Сделка'], values: [['Продажа'], ['Аренда']] },
    {
      key: 'obj_status', cols: ['Статус объекта', 'В работе'], values: [
        ['В работе', 'ДА'], ['Подготовка', 'ДА'], ['Пауза', 'НЕТ'], ['Продан', 'НЕТ'], ['Сдан', 'НЕТ'], ['Договор расторгнут', 'НЕТ'],
      ],
    },
    { key: 'people', cols: ['Сотрудник', 'Роль', 'Email'], values: [['Наталья', 'Руководитель', ''], ['Ассистент', 'Ассистент', ''], ['SMM', 'SMM-специалист', '']] },
    {
      key: 'task_blocks', cols: ['Блок стратегии'], values: [
        ['Аналитика и цена'], ['Сценарии использования'], ['Целевые аудитории'], ['КП и материалы'], ['База и рассылки'],
        ['Каналы и партнёры'], ['Контент'], ['Фото и видео'], ['Объявления'], ['Отчётность'], ['Другое'],
      ],
    },
    { key: 'units', cols: ['Единица', 'Факт из журнала'], values: unitDefs_() },
    {
      key: 'task_status', cols: ['Статус задачи', 'Класс'], values: [
        ['Запланировано', 'OPEN'], ['В работе', 'OPEN'], ['Выполнено', 'DONE'], ['Перенесено', 'MOVED'], ['Не выполнено', 'FAIL'], ['Отменено', 'CANCEL'],
      ],
    },
    { key: 'task_sources', cols: ['Откуда задача'], values: [['План недели'], ['Оперативка'], ['Стратегия'], ['Claude'], ['Вручную']] },
    { key: 'fit', cols: ['Соответствие'], values: [['Подходит'], ['Уточнить'], ['Не подходит']] },
    { key: 'kp_types', cols: ['Какое КП'], values: [['КП клиенту'], ['КП партнёру'], ['Презентация под аудиторию'], ['Письмо без вложения']] },
    {
      key: 'responses', cols: ['Ответ', 'Класс'], values: [
        ['Нет ответа', 'NONE'], ['Интересно', 'YES'], ['Просят позже', 'LATER'], ['Не интересно', 'NO'], ['Переслали ЛПР', 'LATER'],
      ],
    },
    { key: 'platforms', cols: ['Площадка'], values: [['Instagram'], ['Telegram'], ['Threads'], ['YouTube Shorts'], ['ЦИАН / Авито (видео)'], ['Другое']] },
    { key: 'content_formats', cols: ['Формат'], values: [['Рилс'], ['Пост'], ['Сторис'], ['Шортс'], ['Карусель'], ['Статья']] },
    { key: 'content_goals', cols: ['Цель контента'], values: [['Найти покупателя / арендатора'], ['Показать работу собственнику'], ['Бренд агентства'], ['Все три']] },
    {
      key: 'content_status', cols: ['Статус контента', 'Класс'], values: [
        ['Идея', 'OPEN'], ['Сценарий', 'OPEN'], ['Снято', 'OPEN'], ['Опубликовано', 'DONE'], ['Отменено', 'CANCEL'],
      ],
    },
    { key: 'scenario_status', cols: ['Статус сценария'], values: [['Идея'], ['Проверяем'], ['Подтверждён'], ['Отклонён']] },
    { key: 'audience_types', cols: ['Кто'], values: [['Компании'], ['Физлица'], ['Инвесторы'], ['Партнёры-посредники']] },
    { key: 'priorities', cols: ['Приоритет'], values: [['★★★'], ['★★'], ['★']] },
    { key: 'work_status', cols: ['Статус работы'], values: [['Не начато'], ['В работе'], ['Сделано'], ['Регулярно'], ['Отказались']] },
    { key: 'lib_kinds', cols: ['Раздел библиотеки'], values: [['Чек-лист'], ['Промпт'], ['Регламент'], ['Скрипт'], ['Шаблон КП']] },
    // вычисляемые списки
    { key: 'weeks', cols: ['Неделя', 'Понедельник', 'Воскресенье', 'Неделя (подпись)'], generated: true },
    { key: 'obj_labels', cols: ['Объект (выбор)'], generated: true },
    { key: 'lib_checklists', cols: ['Чек-листы (выбор)'], generated: true },
  ];
}

// ═════════════ 01_Schema.gs ═════════════
/**
 * 01_Schema — структура общих журналов.
 *
 * Каждое поле описано один раз; из описания строятся заголовки, формулы, списки, форматы,
 * защита, onEdit-логика и документация.
 * kind: id | text | dd | date | num | money | cb | link | sys (заполняет скрипт) | f (формула)
 * Флаги: helper — служебный (скрыт), track — изменения в 09_ИСТОРИЯ, client — может попасть в отчёт клиенту.
 * Токены в формулах: [[@поле]] — столбец этого листа, [[BASE.поле]] — другого, [[D.справочник]], [[CFG.КЛЮЧ]].
 */

function F(key, title, kind, opts) {
  return Object.assign({ key: key, title: title, kind: kind }, opts || {});
}

const WEEK_OF_ = d => `YEAR(${d}-WEEKDAY(${d},2)+4)&"-W"&TEXT(ISOWEEKNUM(${d}),"00")`;
const OBJ_NAME_F_ = key => `IFERROR(VLOOKUP([[@${key}]],{[[OBJ.id]],[[OBJ.name]]},2,FALSE),"⚠ нет объекта")`;

function sheetSpecs_() {
  if (sheetSpecs_.cache) return sheetSpecs_.cache;
  const S = {};

  // ───────────────────────── 01_ОБЪЕКТЫ ─────────────────────────
  S.OBJ = {
    code: 'OBJ', guard: 'name', frozenCols: 2,
    about: 'Реестр эксклюзивов. Одна строка = один объект. Из строки создаётся вкладка объекта со стратегией.',
    fields: [
      F('id', 'ID объекта (CRM)', 'text', { w: 95, d: 'Номер объекта из CRM — вводится вручную, должен быть уникальным.' }),
      F('name', 'Объект', 'text', { w: 180, client: true, d: 'Короткое название — так будет называться вкладка объекта.' }),
      F('tab_link', 'Вкладка', 'sys', { w: 90, d: 'Ссылка на вкладку объекта. Создаётся меню «Создать вкладки объектов».' }),
      F('kind', 'Тип', 'dd', { dict: 'obj_kinds' }),
      F('deal', 'Сделка', 'dd', { dict: 'deal_types' }),
      F('address', 'Адрес', 'text', { w: 220, client: true }),
      F('area', 'Площадь, м²', 'num', { fmt: '#,##0.0' }),
      F('price', 'Цена', 'money', { track: true, d: 'Цена продажи или аренды в месяц. Изменения сохраняются в истории.' }),
      F('price_m2', 'Цена за м²', 'f', { fmt: 'money', f: 'IFERROR(ROUND([[@price]]/[[@area]],0),"")' }),
      F('status', 'Статус', 'dd', { dict: 'obj_status', track: true }),
      F('manager', 'Ответственный', 'dd', { dict: 'people' }),
      F('assistant', 'Ассистент', 'dd', { dict: 'people' }),
      F('smm', 'SMM', 'dd', { dict: 'people' }),
      F('customer', 'Заказчик (для отчёта)', 'text', { w: 170, d: 'Как в договоре: например, ООО «Ромашка».' }),
      F('contract_no', '№ договора', 'text', { w: 110 }),
      F('contract_date', 'Дата договора', 'date'),
      F('date_sign', 'Начало работы', 'date', { d: 'Дата начала эксклюзива / работы по объекту.' }),
      F('crm_link', 'Ссылка на CRM', 'link', { w: 110 }),
      F('folder_link', 'Папка объекта', 'link', { w: 110, d: 'Можно вставить ссылку на уже существующую папку объекта на Google Диске. Если пусто — папка «Название (ID)» создастся в 01_ОБЪЕКТЫ при первом отчёте.' }),
      F('strategy_pct', 'Стратегия заполнена', 'sys', { fmt: 'pct', d: 'Считается по вкладке объекта: аналоги, цена, сценарии, аудитории, КП, каналы.' }),
      F('last_report_link', 'Последний отчёт', 'sys', { w: 110 }),
      F('last_report_date', 'Дата отчёта', 'sys', { fmt: 'date' }),
      F('id_check', 'Проверка ID', 'f', { f: 'IF([[@id]]="","НЕТ ID",IF(COUNTIF([[@id]],[[@id]])>1,"ДУБЛЬ ID",""))' }),
      F('in_work', 'В работе', 'f', { helper: true, f: 'IFERROR(VLOOKUP([[@status]],[[D.obj_status:tbl]],2,FALSE),"ДА")' }),
      F('tab_name', 'Имя вкладки', 'sys', { helper: true }),
      F('tab_url', 'Адрес вкладки', 'sys', { helper: true, d: '#gid=… — внутренняя ссылка на вкладку объекта.' }),
      F('created_at', 'Создан', 'sys', { helper: true, fmt: 'date' }),
    ],
  };

  // ───────────────────────── 02_ЗАДАЧИ ─────────────────────────
  S.TASK = {
    code: 'TASK', guard: 'obj_id', frozenCols: 4, idField: 'id', idPrefix: 'TASK-', idPad: 4,
    about: 'План-факт. Одна строка = одна задача по объекту на неделю. Факт по звонкам, КП, ответам и публикациям считается сам.',
    fields: [
      F('id', 'ID', 'id', { w: 85 }),
      F('week', 'Неделя', 'dd', { list: 'D.weeks', d: 'Если не указать — текущая.' }),
      F('obj_id', 'ID объекта', 'dd', { list: 'OBJ.id' }),
      F('obj_name', 'Объект', 'f', { w: 150, f: OBJ_NAME_F_('obj_id') }),
      F('block', 'Блок стратегии', 'dd', { dict: 'task_blocks' }),
      F('task', 'Задача', 'text', { w: 260, client: true, d: 'Пишется так, чтобы можно было показать клиенту: «Обзвон медицинских центров».' }),
      F('owner', 'Исполнитель', 'dd', { dict: 'people' }),
      F('unit', 'Единица', 'dd', { dict: 'units', d: 'звонков / КП / ответов / публикаций — факт посчитается сам из журналов.' }),
      F('plan', 'План', 'num', { fmt: '0', client: true, track: true }),
      F('fact', 'Факт (вручную)', 'num', { fmt: '0', d: 'Заполняйте только если факт не считается автоматически.' }),
      F('fact_auto', 'Факт (авто)', 'f', { guard: 'unit', fmt: '0', f: '__FACT_AUTO__', d: 'Из 03_ОБЗВОН_И_КП и 04_КОНТЕНТ по объекту и неделе.' }),
      F('pct', '% выполнения', 'f', { guard: 'plan', fmt: 'pct', f: 'IFERROR(IF([[@fact]]="",IF([[@fact_auto]]="",0,[[@fact_auto]]),[[@fact]])/[[@plan]],"")' }),
      F('deadline', 'Срок', 'date', { track: true, d: 'Если не указать — пятница недели.' }),
      F('status', 'Статус', 'dd', { dict: 'task_status', track: true, d: '«Перенесено» создаёт копию на следующую неделю; старая строка остаётся.' }),
      F('result', 'Результат / комментарий', 'text', { w: 240, client: true }),
      F('to_report', 'В отчёт', 'cb', { d: 'Показывать задачу в отчёте клиенту.' }),
      F('source', 'Откуда', 'dd', { dict: 'task_sources' }),
      F('overdue', 'Просрочка', 'f', { f: 'IF(([[@status_class]]="OPEN")*([[@deadline]]<>"")*([[@deadline]]<TODAY()),"ПРОСРОЧЕНО","")' }),
      F('status_class', 'Класс статуса', 'f', { helper: true, f: 'IF([[@status]]="","OPEN",IFERROR(VLOOKUP([[@status]],[[D.task_status:tbl]],2,FALSE),"OPEN"))' }),
      F('moved_from', 'Перенесено из', 'sys', { helper: true }),
      F('created_at', 'Создано', 'sys', { helper: true, fmt: 'datetime' }),
      F('author', 'Автор', 'sys', { helper: true }),
      F('cal_event', 'Событие календаря', 'sys', { helper: true, d: 'ID события Google Календаря — ставит «Синхронизировать с календарём».' }),
    ],
  };

  // ───────────────────────── 03_ОБЗВОН_И_КП ─────────────────────────
  S.BASE = {
    code: 'BASE', guard: 'obj_id', frozenCols: 5, idField: 'id', idPrefix: 'BASE-', idPad: 4,
    about: 'Работа с базой: одна строка = одна компания / контакт, которому звоним и отправляем КП. В CRM переносим только реально заинтересованных.',
    fields: [
      F('id', 'ID', 'id', { w: 85 }),
      F('obj_id', 'ID объекта', 'dd', { list: 'OBJ.id' }),
      F('obj_name', 'Объект', 'f', { w: 140, f: OBJ_NAME_F_('obj_id') }),
      F('audience', 'Аудитория', 'text', { w: 150, d: 'Как во вкладке объекта: «Сети медцентров», «Аптечные сети»… По ней считаются цифры по аудиториям.' }),
      F('company', 'Компания', 'text', { w: 170, client: true }),
      F('site', 'Сайт', 'link', { w: 110 }),
      F('contact', 'Контакт (ЛПР, телефон, email)', 'text', { w: 220 }),
      F('fit', 'Соответствие объекту', 'dd', { dict: 'fit' }),
      F('fit_note', 'Почему подходит / нет', 'text', { w: 200 }),
      F('call_date', 'Дата звонка', 'date'),
      F('call_result', 'Итог звонка', 'text', { w: 240 }),
      F('kp_date', 'Дата КП', 'date'),
      F('kp_type', 'Какое КП', 'dd', { dict: 'kp_types' }),
      F('response', 'Ответ', 'dd', { dict: 'responses', track: true }),
      F('response_date', 'Дата ответа', 'date'),
      F('next_step', 'Следующий шаг', 'text', { w: 180 }),
      F('next_date', 'Когда', 'date'),
      F('to_crm', 'Передан в CRM', 'cb', { d: 'Отметьте, когда контакт стал реальным интересом и заведён в CRM. Если CRM подключена — в карточку клиента (поиск по телефону из «Контакт») добавится заметка с историей работы.' }),
      F('crm_note', 'CRM', 'sys', { w: 150, d: 'Результат отправки в CRM TopenLab: заметка добавлена / карточка не найдена (заведите вручную и снимите-поставьте галочку).' }),
      F('owner', 'Кто ведёт', 'dd', { dict: 'people' }),
      F('call_week', 'Неделя звонка', 'f', { helper: true, guard: 'call_date', f: WEEK_OF_('[[@call_date]]') }),
      F('kp_week', 'Неделя КП', 'f', { helper: true, guard: 'kp_date', f: WEEK_OF_('[[@kp_date]]') }),
      F('resp_week', 'Неделя ответа', 'f', { helper: true, guard: 'response_date', f: WEEK_OF_('[[@response_date]]') }),
      F('resp_class', 'Класс ответа', 'f', { helper: true, guard: 'response', f: 'IFERROR(VLOOKUP([[@response]],[[D.responses:tbl]],2,FALSE),"")' }),
      F('last_date', 'Последнее касание', 'f', { helper: true, fmt: 'date', f: 'LET(d_a,IF([[@call_date]]="",0,[[@call_date]]),d_b,IF([[@kp_date]]="",0,[[@kp_date]]),d_c,IF([[@response_date]]="",0,[[@response_date]]),d_m,IF(d_a>d_b,d_a,d_b),d_x,IF(d_m>d_c,d_m,d_c),IF(d_x=0,"",d_x))' }),
      F('created_at', 'Создано', 'sys', { helper: true, fmt: 'datetime' }),
      F('author', 'Автор', 'sys', { helper: true }),
    ],
  };

  // ───────────────────────── 04_КОНТЕНТ ─────────────────────────
  S.CONT = {
    code: 'CONT', guard: 'obj_id', frozenCols: 4, idField: 'id', idPrefix: 'CNT-', idPad: 4,
    about: 'Контент об объектах: одна строка = одна публикация (рилс, пост, шортс…). Цифры вносит SMM (пока вручную).',
    fields: [
      F('id', 'ID', 'id', { w: 80 }),
      F('obj_id', 'ID объекта', 'dd', { list: 'OBJ.id' }),
      F('obj_name', 'Объект', 'f', { w: 140, f: OBJ_NAME_F_('obj_id') }),
      F('topic', 'Тема', 'text', { w: 220, client: true }),
      F('platform', 'Площадка', 'dd', { dict: 'platforms' }),
      F('format', 'Формат', 'dd', { dict: 'content_formats' }),
      F('goal', 'Цель', 'dd', { dict: 'content_goals' }),
      F('script', 'Сценарий (текст или ссылка)', 'text', { w: 260 }),
      F('status', 'Статус', 'dd', { dict: 'content_status', track: true }),
      F('pub_date', 'Дата публикации', 'date'),
      F('link', 'Ссылка', 'link', { w: 120, client: true }),
      F('views', 'Просмотры', 'num', { fmt: '#,##0', client: true, d: 'Telegram и YouTube обновляются автоматически по ссылке (меню «Обновить статистику Telegram / YouTube»), остальные — вручную.' }),
      F('reach', 'Охват', 'num', { fmt: '#,##0', client: true, d: 'Instagram — автоматически; остальные площадки — из статистики канала.' }),
      F('saves', 'Сохранения', 'num', { fmt: '#,##0', d: 'Instagram — автоматически.' }),
      F('leads', 'Заявки', 'num', { fmt: '0' }),
      F('owner', 'Кто делает', 'dd', { dict: 'people' }),
      F('pub_week', 'Неделя публикации', 'f', { helper: true, guard: 'pub_date', f: WEEK_OF_('[[@pub_date]]') }),
      F('status_class', 'Класс статуса', 'f', { helper: true, guard: 'status', f: 'IFERROR(VLOOKUP([[@status]],[[D.content_status:tbl]],2,FALSE),"")' }),
      F('created_at', 'Создано', 'sys', { helper: true, fmt: 'datetime' }),
      F('author', 'Автор', 'sys', { helper: true }),
    ],
  };

  // ───────────────────────── 06_БИБЛИОТЕКА ─────────────────────────
  S.LIB = {
    code: 'LIB', guard: 'title', frozenCols: 3, idField: 'id', idPrefix: 'LIB-', idPad: 3,
    about: 'Чек-листы, промпты, регламенты, скрипты. Пополняется командой; все правки сохраняются в истории.',
    fields: [
      F('id', 'ID', 'id', { w: 70 }),
      F('kind', 'Раздел', 'dd', { dict: 'lib_kinds' }),
      F('title', 'Название', 'text', { w: 240 }),
      F('applies', 'Для чего / каких объектов', 'text', { w: 220 }),
      F('text', 'Содержание', 'text', { w: 620, track: true }),
      F('updated_at', 'Обновлено', 'sys', { fmt: 'datetime' }),
      F('author', 'Кто обновил', 'sys', { w: 160 }),
    ],
  };

  // ───────────────────────── 09_ИСТОРИЯ ─────────────────────────
  S.HIST = {
    code: 'HIST', guard: 'ts', frozenCols: 1, readonly: true,
    about: 'Кто, когда и что изменил — во всех журналах и во вкладках объектов. Заполняет только скрипт.',
    fields: [
      F('ts', 'Дата и время', 'sys', { fmt: 'datetime', w: 130 }),
      F('user', 'Пользователь', 'sys', { w: 170 }),
      F('sheet', 'Лист', 'sys', { w: 170 }),
      F('record_id', 'Запись / ячейка', 'sys', { w: 110 }),
      F('obj_id', 'ID объекта', 'sys'),
      F('field', 'Поле', 'sys', { w: 200 }),
      F('old', 'Было', 'sys', { w: 240 }),
      F('new', 'Стало', 'sys', { w: 240 }),
      F('kind', 'Тип', 'sys', { w: 120 }),
      F('note', 'Комментарий', 'sys', { w: 200 }),
    ],
  };

  // ───────────────────────── 10_АРХИВ_ОТЧЁТОВ ─────────────────────────
  S.ARCH = {
    code: 'ARCH', guard: 'ts', frozenCols: 1, readonly: true,
    about: 'Все отчёты клиентам: номер, период, ссылки на Google Doc и PDF.',
    fields: [
      F('ts', 'Создан', 'sys', { fmt: 'datetime', w: 130 }),
      F('obj_id', 'ID объекта', 'sys'),
      F('obj_name', 'Объект', 'sys', { w: 150 }),
      F('report_no', '№ отчёта', 'sys'),
      F('week', 'Неделя', 'sys'),
      F('period', 'Период', 'sys', { w: 150 }),
      F('doc_link', 'Google Doc', 'sys', { w: 130 }),
      F('pdf_link', 'PDF', 'sys', { w: 130 }),
      F('author', 'Создал', 'sys', { w: 160 }),
      F('status', 'Статус', 'sys'),
    ],
  };

  Object.keys(S).forEach(code => { S[code].name = SHEET_NAMES[code]; });
  sheetSpecs_.cache = S;
  return S;
}

function sheetName_(code) { return SHEET_NAMES[code]; }

function fieldOf_(code, key) {
  const f = sheetSpecs_()[code].fields.find(x => x.key === key);
  if (!f) throw new Error('Нет поля ' + code + '.' + key);
  return f;
}

function fieldIndex_(code, key) {
  const i = sheetSpecs_()[code].fields.findIndex(x => x.key === key);
  if (i < 0) throw new Error('Нет поля ' + code + '.' + key);
  return i + 1;
}

function fieldTitle_(code, key) { return fieldOf_(code, key).title; }

function isInputKind_(kind) { return ['text', 'dd', 'date', 'num', 'money', 'cb', 'link'].indexOf(kind) >= 0; }

function specBySheetName_(name) {
  const S = sheetSpecs_();
  const code = Object.keys(S).find(c => S[c].name === name);
  return code ? S[code] : null;
}

// ═════════════ 02_Formulas.gs ═════════════
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
      f: numbered(25, 'FILTER({[[TASK.task]]&IF([[TASK.plan]]="",""," — "&' + factOf + '&" из "&[[TASK.plan]]&IF([[TASK.unit]]="",""," "&[[TASK.unit]]))&IF([[TASK.result]]="","",". "&[[TASK.result]]),' +
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
      f: numbered(20, 'FILTER({[[TASK.task]]&IF([[TASK.plan]]="",""," — "&[[TASK.plan]]&IF([[TASK.unit]]="",""," "&[[TASK.unit]])),' +
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

// ═════════════ 03_Setup.gs ═════════════
/**
 * 03_Setup — установка и обновление системы.
 *
 * «Установить / обновить систему» можно запускать повторно:
 *  - данные журналов (01–04, 06, 09, 10), вкладок объектов, значения настроек и справочников сохраняются;
 *  - заголовки, формулы, списки, форматирование и защита пересоздаются по схеме;
 *  - дэшборд и лист отчёта пересобираются (выбранные фильтры сохраняются).
 */

function setupSystem() {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { /* запуск из редактора Apps Script — без диалогов */ }
  if (!ui) {
    const log = [];
    runSetup_(log);
    try { ensureDrive_(); } catch (err) { log.push('Drive: ' + err.message); }
    installTriggers_();
    Logger.log('Установка завершена: ' + log.join(', '));
    return;
  }
  const ok = ui.alert(
    'Установка / обновление системы',
    'Будут созданы или обновлены все листы, формулы, выпадающие списки, папки Google Drive, шаблон отчёта и триггер.\n\n' +
    'Данные в журналах и во вкладках объектов не удаляются. Продолжить?',
    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  const log = [];
  runSetup_(log);
  let warn = '';
  try {
    ensureDrive_();
    log.push('Google Drive: папки и шаблон отчёта готовы');
  } catch (err) {
    warn = '\n\n⚠ Drive: ' + err.message + '\nПапки можно создать позже повторным запуском установки.';
  }
  try {
    installTriggers_();
    log.push('Триггер «при изменении» установлен');
  } catch (err) {
    warn += '\n\n⚠ Триггер: ' + err.message;
  }
  const tabs = objectTabs_().length;
  ui.alert('Готово', log.join('\n') + warn +
    (tabs ? '\n\nВкладок объектов: ' + tabs + '. Чтобы применить к ним новую версию — «Сервис → Обновить все вкладки объектов».' :
      '\n\nДальше: внесите объекты в 01_ОБЪЕКТЫ (ID из CRM + название) — вкладка объекта создастся сама. Для примера: «Сервис → Загрузить пример (Лермонтовский)».'),
    ui.ButtonSet.OK);
}

/** Строит листы (без Drive и триггеров). */
function runSetup_(log) {
  const ss = ss_();
  ss.setSpreadsheetTimeZone(SYS.TZ);
  try { ss.setSpreadsheetLocale(SYS.LOCALE); } catch (e) { /* локаль может быть недоступна — не критично */ }
  if (ss.getName().indexOf(SYS.TITLE) < 0) ss.rename(SYS.TITLE);
  dictLayout_.cache = null;
  sheetSpecs_.cache = null;

  SHEET_ORDER.forEach(code => ensureSheet_(code));
  buildSettings_(); log.push(SHEET_NAMES.CFG);
  buildDict_(); log.push(SHEET_NAMES.DICT);
  ['OBJ', 'TASK', 'BASE', 'CONT', 'LIB', 'HIST', 'ARCH'].forEach(code => { buildDataSheet_(code); log.push(SHEET_NAMES[code]); });
  SpreadsheetApp.flush();
  seedLibrary_();
  buildReportSheet_(); log.push(SHEET_NAMES.REP);
  buildDash_(); log.push(SHEET_NAMES.DASH);
  orderSheets_();
  removeDefaultSheet_();
  SpreadsheetApp.flush();
}

function ensureSheet_(code) {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_NAMES[code]);
  if (!sh) sh = ss.insertSheet(SHEET_NAMES[code]);
  sh.setTabColor(TAB_COLORS[code]);
  return sh;
}

/** Порядок: 00_ДЭШБОРД, 01_ОБЪЕКТЫ, вкладки объектов, затем журналы и служебные листы. */
function orderSheets_() {
  const ss = ss_();
  const order = [ss.getSheetByName(SHEET_NAMES.DASH), ss.getSheetByName(SHEET_NAMES.OBJ)]
    .concat(objectTabs_())
    .concat(SHEET_ORDER.slice(2).map(code => ss.getSheetByName(SHEET_NAMES[code])));
  order.forEach((sh, i) => {
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  ss.setActiveSheet(ss.getSheetByName(SHEET_NAMES.DASH));
}

function removeDefaultSheet_() {
  const ss = ss_();
  const ours = Object.keys(SHEET_NAMES).map(k => SHEET_NAMES[k]);
  ss.getSheets().forEach(sh => {
    if (ours.indexOf(sh.getName()) < 0 && !isObjectTab_(sh) && sh.getLastRow() === 0 && sh.getLastColumn() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
}

function ensureSize_(sh, rows, cols) {
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
}

function removeSysProtections_(sh) {
  [SpreadsheetApp.ProtectionType.RANGE, SpreadsheetApp.ProtectionType.SHEET].forEach(t => {
    sh.getProtections(t).forEach(p => {
      if ((p.getDescription() || '').indexOf(SYS.PROTECT_PREFIX) === 0) p.remove();
    });
  });
}

function protectWarn_(range, what) {
  range.protect().setDescription(SYS.PROTECT_PREFIX + what).setWarningOnly(true);
}

// ───────────────────────── 08_НАСТРОЙКИ ─────────────────────────

const CFG_TASKS_COL = 6;   // F: задачи недели по умолчанию (Блок, Задача, Единица, План)
const CFG_TASKS_ROWS = 15;

function buildSettings_() {
  const sh = sheet_('CFG');
  const existing = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(1, 1, sh.getLastRow(), 3).getValues().forEach(r => { if (r[0]) existing[r[0]] = r[2]; });
  }
  let tasksExisting = [];
  if (sh.getLastRow() > 1 && sh.getMaxColumns() >= CFG_TASKS_COL + 3 && sh.getRange(1, CFG_TASKS_COL).getValue() === 'Блок стратегии') {
    tasksExisting = sh.getRange(2, CFG_TASKS_COL, CFG_TASKS_ROWS, 4).getValues().filter(r => r[1] !== '');
  }
  removeSysProtections_(sh);
  sh.clear();
  sh.clearConditionalFormatRules();
  ensureSize_(sh, 60, CFG_TASKS_COL + 4);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();

  const defs = cfgDefs_();
  const rows = [['Ключ', 'Параметр', 'Значение', 'Описание']];
  defs.forEach(d => {
    if (d.group) { rows.push(['', d.group, '', '']); return; }
    let v = (d.key in existing && existing[d.key] !== '' && d.key !== 'SYSTEM_VERSION') ? existing[d.key] : d.value;
    if (d.date && typeof v === 'string' && v) v = new Date(v + 'T00:00:00');
    rows.push([d.key, d.label, v, d.sys ? 'заполняет скрипт' : '']);
  });
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  styleHeaderRow_(sh.getRange(1, 1, 1, 4), 'input');
  let r = 2;
  defs.forEach(d => {
    if (d.group) {
      sh.getRange(r, 1, 1, 4).setBackground(COLORS.SUBHEADER_BG).setFontWeight('bold');
    } else {
      const cell = sh.getRange(r, 3);
      ss_().setNamedRange('CFG_' + d.key, cell);
      if (d.fmt) cell.setNumberFormat(d.fmt);
      if (d.sys) sh.getRange(r, 1, 1, 4).setFontColor(COLORS.GREY_FG);
      else cell.setBackground(COLORS.SELECT_BG).setWrap(true);
    }
    r++;
  });
  sh.getRange(1, 1, r, 1).setFontColor(COLORS.GREY_FG).setFontSize(9);
  sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 360); sh.setColumnWidth(3, 260); sh.setColumnWidth(4, 120);

  // задачи недели по умолчанию («Создать план недели»)
  const c = CFG_TASKS_COL;
  sh.getRange(1, c, 1, 4).setValues([['Блок стратегии', 'Задача недели по умолчанию', 'Единица', 'План на объект']]);
  styleHeaderRow_(sh.getRange(1, c, 1, 4), 'input');
  const tasks = tasksExisting.length ? tasksExisting : DEFAULT_WEEK_TASKS;
  sh.getRange(2, c, tasks.length, 4).setValues(tasks);
  const DV = SpreadsheetApp.newDataValidation;
  sh.getRange(2, c, CFG_TASKS_ROWS, 1).setDataValidation(DV().requireValueInRange(rangeFromToken_('D.task_blocks'), true).build());
  sh.getRange(2, c + 2, CFG_TASKS_ROWS, 1).setDataValidation(DV().requireValueInRange(rangeFromToken_('D.units'), true).build());
  sh.getRange(2, c, CFG_TASKS_ROWS, 4).setBackground(COLORS.SELECT_BG);
  ss_().setNamedRange('CFG_DEFAULT_TASKS', sh.getRange(2, c, CFG_TASKS_ROWS, 4));
  sh.getRange(1, c).setNote('Эти задачи «Создать план недели» ставит каждому объекту в работе. Факт по звонкам / КП / ответам / публикациям считается сам.');
  sh.setColumnWidth(c - 1, 24); sh.setColumnWidth(c, 160); sh.setColumnWidth(c + 1, 260); sh.setColumnWidth(c + 2, 110); sh.setColumnWidth(c + 3, 110);
  sh.setFrozenRows(1);
  sh.hideColumns(1);
}

// ───────────────────────── 07_СПРАВОЧНИКИ ─────────────────────────

function buildDict_() {
  const sh = sheet_('DICT');
  const L = dictLayout_();
  const defs = dictDefs_();
  const lastCol = Math.max.apply(null, defs.map(d => L[d.key].col + d.cols.length));
  ensureSize_(sh, 1000, lastCol); // недели: ~52 строки в год
  removeSysProtections_(sh);
  const gen = dictGeneratedFormulas_();
  defs.forEach(d => {
    const c = L[d.key].col;
    const hdr = sh.getRange(1, c, 1, d.cols.length);
    const current = hdr.getValues()[0];
    hdr.setValues([d.cols]);
    if (d.generated) {
      sh.getRange(2, c, sh.getMaxRows() - 1, d.cols.length).clearContent();
      sh.getRange(2, c).setFormula(resolveF_(gen[d.key]));
      styleHeaderRow_(hdr, 'formula');
      sh.getRange(2, c, sh.getMaxRows() - 1, d.cols.length).setBackground(COLORS.FORMULA_CELL_BG);
      protectWarn_(sh.getRange(1, c, sh.getMaxRows(), d.cols.length), 'Вычисляемый список ' + d.cols[0]);
      if (d.key === 'weeks') {
        sh.getRange(2, c + 1, sh.getMaxRows() - 1, 2).setNumberFormat('dd.mm.yyyy');
      }
    } else {
      const firstVal = sh.getRange(2, c).getValue();
      if (current[0] !== d.cols[0] || firstVal === '') {
        sh.getRange(2, c, d.values.length, d.cols.length).setValues(d.values);
      }
      styleHeaderRow_(hdr, 'input');
      if (d.cols.length > 1) sh.getRange(1, c + 1, 1, d.cols.length - 1).setBackground(COLORS.HDR_FORMULA_BG).setFontColor(COLORS.HDR_FORMULA_FG);
    }
    for (let i = 0; i < d.cols.length; i++) sh.setColumnWidth(c + i, d.generated && d.key !== 'weeks' ? 190 : 150);
  });
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, lastCol).setWrap(true);
  sh.setRowHeight(1, 40);
  const note = 'Значения можно добавлять и переименовывать. Столбец «Класс» — системный смысл значения (OPEN/DONE/…): его не меняйте, по нему считаются формулы.';
  sh.getRange(1, 1).setNote(note);
}

// ───────────────────────── листы-журналы ─────────────────────────

function buildDataSheet_(code) {
  const spec = sheetSpecs_()[code];
  const sh = sheet_(code);
  const n = spec.fields.length;
  ensureSize_(sh, SYS.DATA_ROWS, n);
  checkHeaders_(sh, spec);
  removeSysProtections_(sh);
  const maxRows = sh.getMaxRows();

  // заголовки: значения + формулы одним вызовом
  sh.getRange(1, 1, 1, n).setValues([spec.fields.map(f => f.kind === 'f' ? '' : f.title)]);
  spec.fields.forEach((f, i) => { if (f.kind === 'f') sh.getRange(1, i + 1).setFormula(headerFormula_(spec, f)); });
  const bg = [], fg = [], notes = [];
  spec.fields.forEach(f => {
    const kind = f.kind === 'f' ? (f.helper ? 'helper' : 'formula') : (f.kind === 'sys' || f.kind === 'id') ? (f.helper ? 'helper' : 'auto') : 'input';
    const c = headerColors_(kind);
    bg.push(c[0]); fg.push(c[1]);
    notes.push(fieldNote_(f));
  });
  sh.getRange(1, 1, 1, n).setBackgrounds([bg]).setFontColors([fg]).setNotes([notes])
    .setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
  sh.setRowHeight(1, 48);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(spec.frozenCols || 1);

  spec.fields.forEach((f, i) => {
    const col = i + 1;
    const body = sh.getRange(2, col, maxRows - 1, 1);
    sh.setColumnWidth(col, f.w || (f.kind === 'cb' ? 90 : 115));
    const fmt = f.fmt || ({ date: 'date', money: 'money' })[f.kind];
    if (fmt) body.setNumberFormat(nf_(fmt));
    else if (f.kind === 'text' || f.kind === 'link') body.setNumberFormat('@');
    body.clearDataValidations();
    const v = validationFor_(f);
    if (v) body.setDataValidation(v);
    if (f.kind === 'f') {
      body.setBackground(COLORS.FORMULA_CELL_BG);
      protectWarn_(sh.getRange(1, col, maxRows, 1), 'Формула «' + f.title + '» — считается автоматически');
    } else if (f.kind === 'id') {
      protectWarn_(sh.getRange(2, col, maxRows - 1, 1), 'ID ставит скрипт — не менять');
    }
    if (f.kind === 'text') body.setWrap(false);
  });
  sh.showColumns(1, n);
  spec.fields.forEach((f, i) => { if (f.helper) sh.hideColumns(i + 1); });
  if (spec.readonly) protectWarn_(sh.getRange(1, 1, maxRows, n), 'Журнал заполняет скрипт');
  applyDataCF_(code, sh);
  if (!sh.getFilter()) sh.getRange(1, 1, maxRows, n).createFilter();
}

function checkHeaders_(sh, spec) {
  if (sh.getLastRow() < 1) return;
  const cur = sh.getRange(1, 1, 1, spec.fields.length).getDisplayValues()[0];
  const bad = [];
  spec.fields.forEach((f, i) => {
    if (f.kind === 'f') return;
    if (cur[i] !== '' && cur[i] !== f.title) bad.push(colLetter_(i + 1) + ': «' + cur[i] + '» вместо «' + f.title + '»');
  });
  if (bad.length) {
    throw new Error('Лист ' + spec.name + ': столбцы переставлены или переименованы вручную. Верните порядок столбцов:\n' + bad.slice(0, 5).join('\n'));
  }
}

function fieldNote_(f) {
  const how = {
    id: 'Заполняет скрипт автоматически.', sys: 'Заполняет скрипт автоматически.', f: 'Считается формулой автоматически — не вводить вручную.',
    dd: 'Выбор из списка.', cb: 'Галочка.', date: 'Дата (двойной клик — календарь).', num: 'Число.', money: 'Сумма, ₽.',
    text: 'Вводится вручную.', link: 'Ссылка, вводится вручную.',
  }[f.kind];
  const flags = [];
  if (f.client) flags.push('может попасть в отчёт клиенту');
  if (f.internal) flags.push('ВНУТРЕННЕЕ — клиенту не показывается');
  if (f.track) flags.push('изменения пишутся в 09_ИСТОРИЯ');
  return [how, f.d || '', flags.length ? '(' + flags.join('; ') + ')' : ''].filter(Boolean).join('\n');
}

function headerColors_(kind) {
  return {
    input: [COLORS.HDR_INPUT_BG, COLORS.HDR_INPUT_FG],
    formula: [COLORS.HDR_FORMULA_BG, COLORS.HDR_FORMULA_FG],
    auto: [COLORS.HDR_AUTO_BG, COLORS.HDR_AUTO_FG],
    helper: [COLORS.HDR_HELPER_BG, COLORS.HDR_HELPER_FG],
  }[kind];
}

function styleHeaderRow_(range, kind) {
  const c = headerColors_(kind);
  range.setBackground(c[0]).setFontColor(c[1]).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
}

function validationFor_(f) {
  const DV = SpreadsheetApp.newDataValidation;
  if (f.kind === 'dd') {
    const src = f.dict ? 'D.' + f.dict : f.list;
    return DV().requireValueInRange(rangeFromToken_(src), true).setAllowInvalid(false).build();
  }
  if (f.kind === 'cb') return DV().requireCheckbox().build();
  if (f.kind === 'date') return DV().requireDate().setAllowInvalid(false).setHelpText('Введите дату').build();
  if (f.kind === 'num' || f.kind === 'money') return DV().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).setHelpText('Введите число ≥ 0').build();
  return null;
}

function rangeFromToken_(token) {
  const a1 = resolveF_('[[' + token + ']]').replace(/\$/g, '');
  return ss_().getRange(a1);
}

function nf_(fmt) {
  return ({
    date: 'dd.mm.yyyy', datetime: 'dd.mm.yyyy HH:mm', money: '#,##0" ₽"', money_short: '#,##0" ₽"', pct: '0%',
  })[fmt] || fmt;
}

// ───────────────────────── условное форматирование журналов ─────────────────────────
// Формулы без запятых (только * и сравнения) — не зависят от локали таблицы.

function cfRule_(formula, range, bg, fg) {
  const b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setRanges([range]);
  if (bg) b.setBackground(bg);
  if (fg) b.setFontColor(fg);
  return b.build();
}

function applyDataCF_(code, sh) {
  const spec = sheetSpecs_()[code];
  const n = spec.fields.length;
  const max = sh.getMaxRows();
  const col = k => colLetter_(fieldIndex_(code, k));
  const colRange = k => sh.getRange(2, fieldIndex_(code, k), max - 1, 1);
  const row = sh.getRange(2, 1, max - 1, n);
  const R = [];
  const red = [COLORS.RED_BG, COLORS.RED_FG], yel = [COLORS.YELLOW_BG, COLORS.YELLOW_FG], grn = [COLORS.GREEN_BG, COLORS.GREEN_FG], grey = [null, COLORS.GREY_FG];
  const add = (f, rng, c) => R.push(cfRule_(f, rng, c[0], c[1]));
  if (code === 'OBJ') {
    add('=$' + col('id_check') + '2<>""', colRange('id'), red);
    add('=$' + col('in_work') + '2="НЕТ"', row, grey);
    add('=($' + col('strategy_pct') + '2<>"")*($' + col('strategy_pct') + '2>=1)', colRange('strategy_pct'), grn);
    add('=($' + col('strategy_pct') + '2<>"")*($' + col('strategy_pct') + '2<0.5)', colRange('strategy_pct'), red);
    add('=($' + col('strategy_pct') + '2<>"")*($' + col('strategy_pct') + '2<1)', colRange('strategy_pct'), yel);
  }
  if (code === 'TASK') {
    add('=$' + col('overdue') + '2="ПРОСРОЧЕНО"', row, red);
    add('=$' + col('status_class') + '2="DONE"', colRange('status'), grn);
    add('=$' + col('status_class') + '2="FAIL"', colRange('status'), red);
    add('=($' + col('status_class') + '2="MOVED")+($' + col('status_class') + '2="CANCEL")', row, grey);
    add('=($' + col('pct') + '2<>"")*($' + col('pct') + '2>=1)', colRange('pct'), grn);
    add('=($' + col('pct') + '2<>"")*($' + col('pct') + '2<1)', colRange('pct'), yel);
    add('=($' + col('obj_id') + '2<>"")*($' + col('owner') + '2="")', colRange('owner'), yel);
  }
  if (code === 'BASE') {
    add('=$' + col('resp_class') + '2="YES"', colRange('response'), grn);
    add('=$' + col('resp_class') + '2="NO"', row, grey);
    add('=$' + col('to_crm') + '2=TRUE', colRange('company'), grn);
    add('=$' + col('fit') + '2="Не подходит"', colRange('fit'), red);
    add('=($' + col('next_date') + '2<>"")*($' + col('next_date') + '2<TODAY())*($' + col('to_crm') + '2=FALSE)', colRange('next_date'), red);
  }
  if (code === 'CONT') {
    add('=$' + col('status_class') + '2="DONE"', colRange('status'), grn);
    add('=$' + col('status_class') + '2="CANCEL"', row, grey);
    add('=($' + col('status_class') + '2="DONE")*($' + col('link') + '2="")', colRange('link'), yel);
  }
  sh.setConditionalFormatRules(R);
}

// ───────────────────────── общие блоки из layout ─────────────────────────

function applyCells_(sh, cells) {
  cells.forEach(c => {
    const r = sh.getRange(c.a1);
    if (c.f) r.setFormula(resolveF_(c.f));
    else if (c.v !== undefined) r.setValue(c.v);
    if (c.fmt) r.setNumberFormat(nf_(c.fmt));
    if (c.note) r.setNote(c.note);
    if (c.validation) {
      r.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(rangeFromToken_(c.validation.list), true).setAllowInvalid(false).build());
    }
    styleCell_(sh, r, c);
  });
}

function styleCell_(sh, r, c) {
  const span = c.spanCols ? sh.getRange(r.getRow(), r.getColumn(), 1, c.spanCols) : r;
  switch (c.style) {
    case 'title': r.setFontSize(14).setFontWeight('bold').setFontColor('#263238'); break;
    case 'section': span.setBackground(COLORS.SECTION_BG).setFontColor(COLORS.SECTION_FG).setFontWeight('bold'); break;
    case 'header': r.setBackground(COLORS.HDR_FORMULA_BG).setFontColor(COLORS.HDR_FORMULA_FG).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle'); break;
    case 'label': r.setFontWeight('bold').setHorizontalAlignment('right'); break;
    case 'select': r.setBackground(COLORS.SELECT_BG).setBorder(true, true, true, true, false, false, '#B0BEC5', SpreadsheetApp.BorderStyle.SOLID); break;
    case 'muted': r.setFontColor(COLORS.GREY_FG).setFontSize(9); break;
    case 'bold': r.setFontWeight('bold'); break;
    case 'wrap': r.setWrap(true).setVerticalAlignment('top'); break;
    case 'link': r.setFontColor('#1565C0'); break;
    case 'tileLabel': r.setFontSize(9).setFontColor(COLORS.GREY_FG).setWrap(true).setVerticalAlignment('bottom'); break;
    case 'tileValue': r.setFontSize(18).setFontWeight('bold').setHorizontalAlignment('left'); break;
    case 'delta': r.setFontColor(COLORS.GREY_FG); break;
    default: break;
  }
}

function safeGet_(sh, a1) { try { return sh.getRange(a1).getValue(); } catch (e) { return ''; } }
function restoreSel_(sh, a1, v) { if (v !== '' && v !== null && v !== undefined) { try { sh.getRange(a1).setValue(v); } catch (e) { /* значение больше не допустимо */ } } }

function resetSheet_(sh) {
  removeSysProtections_(sh);
  sh.getCharts().forEach(c => sh.removeChart(c));
  sh.clear();
  sh.clearNotes();
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.showColumns(1, sh.getMaxColumns());
  sh.setFrozenRows(0); sh.setFrozenColumns(0);
}

// ───────────────────────── 05_ОТЧЁТ_КЛИЕНТУ ─────────────────────────

function buildReportSheet_() {
  const sh = sheet_('REP');
  const keep = ['B3', 'B4', 'B5'].map(a => safeGet_(sh, a));
  resetSheet_(sh);
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (e) { /* нечего разъединять */ }
  const L = reportLayout_();
  ensureSize_(sh, L.lastRow + 5, 6);
  applyCells_(sh, L.cells);
  ['B3', 'B4', 'B5'].forEach((a, i) => restoreSel_(sh, a, keep[i]));
  if (!keep[1]) {
    SpreadsheetApp.flush();
    const label = weekLabelByKey_(isoWeekKey_(addDays_(today_(), -7)));
    if (label) sh.getRange('B4').setValue(label);
  }
  for (let i = 0; i < L.kvRows; i++) sh.getRange(REP_FIRST_ROW + i, 2, 1, 2).merge();
  Object.keys(L.tables).forEach(k => {
    const t = L.tables[k];
    sh.getRange(t.first, 1, t.rows, 3).setWrap(true).setVerticalAlignment('top');
    sh.getRange(t.first, 1, t.rows, 1).setHorizontalAlignment('center');
  });
  sh.setColumnWidth(1, 210); sh.setColumnWidth(2, 520); sh.setColumnWidth(3, 190); sh.setColumnWidth(4, 130); sh.setColumnWidth(5, 110);
  sh.getRange('B5:C5').merge().setWrap(true);
  sh.setRowHeight(5, 48);
  protectWarn_(sh.getRange(REP_FIRST_ROW, 1, L.lastRow - REP_FIRST_ROW + 1, 5), 'Отчёт собирается автоматически');
  protectWarn_(sh.getRange('D2:E8'), 'Служебные параметры отчёта');
}

// ───────────────────────── 00_ДЭШБОРД ─────────────────────────

function buildDash_() {
  const sh = sheet_('DASH');
  const keep = safeGet_(sh, 'B2');
  resetSheet_(sh);
  ensureSize_(sh, DASH.OVERDUE_FIRST + 150, 26);
  const L = dashLayout_();
  applyCells_(sh, L.cells);
  restoreSel_(sh, 'B2', keep);
  sh.setColumnWidth(1, 210);
  for (let c = 2; c <= 17; c++) sh.setColumnWidth(c, 100);
  sh.setColumnWidth(2, 150);
  sh.setRowHeight(5, 36); sh.setRowHeight(6, 34);
  sh.setRowHeight(DASH.OBJ_HDR, 40); sh.setRowHeight(DASH.PEOPLE_HDR, 40);
  sh.setFrozenRows(2);
  sh.hideColumns(25, 2); // Y:Z — параметры

  const oc = L.objLetter;
  const oF = DASH.OBJ_FIRST, oL = DASH.OBJ_LAST;
  const idle = oc['Дней без работы'], pct = oc['% плана'], str = oc['Стратегия'], od = oc['Просрочено'];
  const rowR = sh.getRange('A' + oF + ':Q' + oL);
  const colR = L => sh.getRange(L + oF + ':' + L + oL);
  const pF = DASH.PEOPLE_FIRST, pL = DASH.PEOPLE_LAST;
  const rules = [
    cfRule_('=($' + idle + oF + '<>"")*($' + idle + oF + '>$Z$2)', rowR, COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=($' + pct + oF + '<>"")*($' + pct + oF + '>=1)', colR(pct), COLORS.GREEN_BG, COLORS.GREEN_FG),
    cfRule_('=($' + pct + oF + '<>"")*($' + pct + oF + '<0.7)', colR(pct), COLORS.YELLOW_BG, COLORS.YELLOW_FG),
    cfRule_('=($' + str + oF + '<>"")*($' + str + oF + '<0.5)', colR(str), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=($' + str + oF + '<>"")*($' + str + oF + '>=1)', colR(str), COLORS.GREEN_BG, COLORS.GREEN_FG),
    cfRule_('=$' + od + oF + '>0', colR(od), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=($D' + pF + '<>"")*($D' + pF + '<0.7)', sh.getRange('A' + pF + ':I' + pL), COLORS.YELLOW_BG, COLORS.YELLOW_FG),
    cfRule_('=$E' + pF + '>0', sh.getRange('E' + pF + ':E' + pL), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=E6>0', sh.getRange('E6'), COLORS.RED_BG, COLORS.RED_FG),
  ];
  sh.setConditionalFormatRules(rules);
  protectWarn_(sh.getRange(3, 1, sh.getMaxRows() - 2, sh.getMaxColumns()), 'Дэшборд считается автоматически');
}

// ───────────────────────── Google Drive ─────────────────────────

function ensureDrive_() {
  const ss = ss_();
  let root = folderById_(cfgGet_('FOLDER_ROOT_ID'));
  if (!root) {
    const it = DriveApp.getFoldersByName(SYS.ROOT_FOLDER);
    root = it.hasNext() ? it.next() : DriveApp.createFolder(SYS.ROOT_FOLDER);
    cfgSet_('FOLDER_ROOT_ID', root.getId());
  }
  const sub = {};
  [['MASTER', 'FOLDER_MASTER_ID'], ['OBJECTS', 'FOLDER_OBJECTS_ID'], ['TEMPLATES', 'FOLDER_TEMPLATES_ID']].forEach(p => {
    let f = folderById_(cfgGet_(p[1]));
    if (!f) {
      f = childFolder_(root, SYS.FOLDERS[p[0]]);
      cfgSet_(p[1], f.getId());
    }
    sub[p[0]] = f;
  });
  const file = DriveApp.getFileById(ss.getId());
  const parents = file.getParents();
  let inMaster = false;
  while (parents.hasNext()) if (parents.next().getId() === sub.MASTER.getId()) inMaster = true;
  if (!inMaster) file.moveTo(sub.MASTER);
  ensureReportTemplate_();
  // доступ сотрудникам из справочника (email): таблица + папка системы
  dictRows_('people').forEach(p => {
    const email = String(p[2] || '').trim();
    if (!email) return;
    try { root.addEditor(email); ss.addEditor(email); } catch (e) { /* email может быть недоступен для шаринга */ }
  });
  return sub;
}

function folderById_(id) {
  if (!id) return null;
  try {
    const f = DriveApp.getFolderById(String(id));
    return f.isTrashed() ? null : f;
  } catch (e) { return null; }
}

function childFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ───────────────────────── триггеры ─────────────────────────

function installTriggers_() {
  const ss = ss_();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onEditHandler') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditHandler').forSpreadsheet(ss).onEdit().create();
}

// ═════════════ 04_ObjectTab.gs ═════════════
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
  sh.getRange('B1').setFormula(tf('=IFERROR(VLOOKUP([[ID]],{[[OBJ.id]],[[OBJ.name]]},2,FALSE),"⚠ объекта с этим ID нет в 01_ОБЪЕКТЫ")'));
  sh.getRange('B1:G1').merge();
  const head = [
    ['Адрес', '=' + look('address')], ['Тип · сделка', '=' + look('kind') + '&IF(' + look('deal') + '="",""," · "&' + look('deal') + ')'],
    ['Площадь, м²', '=' + look('area')], ['Цена', '=' + look('price')], ['Цена за м²', '=' + look('price_m2')], ['Статус', '=' + look('status')],
    ['Стратегия заполнена', null],
    ['Команда', '=TEXTJOIN(" · ",TRUE,' + look('manager') + ',' + look('assistant') + ',' + look('smm') + ')'],
  ];
  head.forEach((h, i) => {
    sh.getRange(2, 2 + i).setValue(h[0]);
    if (h[1]) sh.getRange(3, 2 + i).setFormula(tf(h[1]));
  });
  sh.getRange(TAB.PCT.replace(/\$/g, '')).setFormula(strategyPctFormula_(L)).setNote(STRATEGY_PCT_NOTE);
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
  links.forEach((l, i) => sh.getRange(4, 2 + i).setFormula(tf(l[0])));
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
          cell.setFormula(resolveTabF_('=' + it.f, L, s.key));
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
          hcell.setFormula('={"' + c.t + '";ARRAYFORMULA(IF(LEN(' + L.colRange(s.key, 1) + ')=0,"",' + resolveTabF_(c.f, L, s.key) + '))}');
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
    } else {
      // auto / grid — только чтение
      hdr.setBackground(COLORS.HDR_FORMULA_BG).setFontColor(COLORS.HDR_FORMULA_FG);
      const body = sh.getRange(p.first, 2, n, titles.length);
      body.setBackground(COLORS.FORMULA_CELL_BG).setVerticalAlignment('top');
      if (s.type === 'auto') {
        sh.getRange(p.first, 2).setFormula(resolveTabF_(s.f, L, s.key));
        (s.fmts || []).forEach((f, i) => { if (f) sh.getRange(p.first, 2 + i, n, 1).setNumberFormat(nf_(f)); });
        sh.getRange(p.first, 3, n, 1).setWrap(true);
        if (s.key === 'PF') {
          const stat = sh.getRange(p.first, 9, n, 1);
          cfRules.push(cfRule_('=$I' + p.first + '="ПРОСРОЧЕНО"', sh.getRange(p.first, 2, n, 8), COLORS.RED_BG, COLORS.RED_FG));
          cfRules.push(cfRule_('=$I' + p.first + '="' + (dictFirstByClassSafe_('task_status', CLS.DONE) || 'Выполнено') + '"', stat, COLORS.GREEN_BG, COLORS.GREEN_FG));
        }
      } else {
        s.grid.forEach((gr, ri) => gr.forEach((f, ci) => {
          if (f) sh.getRange(p.first + ri, 2 + ci).setFormula('=ARRAYFORMULA(' + resolveTabF_(f, L, s.key).slice(1) + ')');
        }));
        sh.getRange(p.first, 2, n, 1).setFontWeight('bold');
      }
      protectWarn_(sh.getRange(p.header, 1, n + 1, TAB.LAST_COL), 'Раздел «' + s.title + '» собирается автоматически');
    }
  });

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
    buildObjectTab_(sh, obj.id, null);
    built = true;
  } else {
    if (sh.getName() !== name && !ss.getSheetByName(name)) sh.setName(name);
    if (String(sh.getRange(TAB.ID).getValue()) !== String(obj.id)) sh.getRange(TAB.ID).setNumberFormat('@').setValue(String(obj.id));
    if (mode === 'rebuild') { buildObjectTab_(sh, obj.id, readObjectTab_(sh)); built = true; }
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

/** Меню: создать вкладки для объектов, у которых их ещё нет. */
function createObjectTabs() {
  const t = readTable_('OBJ');
  let created = 0;
  const missing = [];
  t.rows.forEach(o => {
    if (!o.id || !o.name) { if (o.name || o.id) missing.push(o.name || o.id); return; }
    const r = syncObjectTab_(o, 'create');
    if (r && r.built) created++;
  });
  SpreadsheetApp.flush();
  toast_('Создано вкладок: ' + created + (missing.length ? '. Без ID или названия: ' + missing.join(', ') : ''), 'Вкладки объектов', 8);
}

/** Сервис: пересобрать все вкладки (после обновления системы). Данные команды сохраняются. */
function rebuildObjectTabs() {
  const t = readTable_('OBJ');
  let n = 0;
  t.rows.forEach(o => { if (o.id && o.name) { syncObjectTab_(o, 'rebuild'); n++; } });
  SpreadsheetApp.flush();
  toast_('Обновлено вкладок: ' + n, 'Вкладки объектов', 6);
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
  if (r) r.sheet.activate();
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
    if (!c || !c.sec || c.sec.type === 'auto' || c.sec.type === 'grid') continue;
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

// ═════════════ 05_Triggers.gs ═════════════
/**
 * 05_Triggers — автоматика при редактировании (устанавливаемый триггер onEdit).
 *
 *  - ставит ID задачам, строкам обзвона, контенту, библиотеке; дату, статус и неделю по умолчанию; автора;
 *  - ID объекта вводится вручную (из CRM): скрипт проверяет его и при исправлении обновляет во всех листах;
 *  - новый объект (ID + название) сразу получает свою вкладку «▸ Название (ID)»;
 *  - пишет изменения в 09_ИСТОРИЯ: отслеживаемые поля журналов и все правки во вкладках объектов;
 *  - задача со статусом «Перенесено» копируется на следующую неделю, исходная остаётся;
 *  - галочка «Передан в CRM» в 03 → заметка в карточку клиента в TopenLab (если CRM подключена).
 */

function onEditHandler(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (isObjectTab_(sh)) {
    try { handleObjectTabEdit_(e, sh); } catch (err) { toast_('История не записана: ' + err.message, 'Внимание', 8); }
    return;
  }
  const spec = specBySheetName_(sh.getName());
  if (!spec || spec.readonly) return;
  const rLast = e.range.getLastRow();
  if (rLast < 2) return;
  const c0 = e.range.getColumn();
  if (c0 > spec.fields.length) return; // правки в боковых блоках-фильтрах
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return;
  try {
    processEditedRows_(sh, spec, Math.max(2, e.range.getRow()), rLast, c0, Math.min(e.range.getLastColumn(), spec.fields.length), e);
  } catch (err) {
    toast_('Ошибка автоматики: ' + err.message, 'Внимание', 10);
  } finally {
    lock.releaseLock();
  }
}

function processEditedRows_(sh, spec, r0, rLast, c0, cLast, e) {
  const code = spec.code;
  const n = rLast - r0 + 1;
  const vals = sh.getRange(r0, 1, n, spec.fields.length).getValues();
  const user = userEmail_(e);
  const single = n === 1 && c0 === cLast;
  const editedKeys = spec.fields.slice(c0 - 1, cLast).map(f => f.key);
  const hist = [];
  const idCache = {};
  const tabSync = [];
  const renamed = [];
  const crmRows = [];
  for (let i = 0; i < n; i++) {
    const row = r0 + i;
    const o = {};
    spec.fields.forEach((f, j) => { o[f.key] = vals[i][j]; });
    const hasInput = spec.fields.some(f => isInputKind_(f.kind) && f.kind !== 'cb' && o[f.key] !== '' && o[f.key] !== null);
    if (!hasInput) continue;
    const upd = {};
    let isNew = false;
    if (code === 'OBJ') {
      if (typeof o.id === 'number') { o.id = String(o.id); upd.id = o.id; }
      else if (typeof o.id === 'string' && o.id !== o.id.trim()) { o.id = o.id.trim(); upd.id = o.id; }
      isNew = !!o.id && !o.created_at;
      if (single && editedKeys[0] === 'id' && e.oldValue && o.id && String(e.oldValue).trim() !== o.id) renamed.push([String(e.oldValue).trim(), o.id]);
      if (!o.id && o.name) toast_('Укажите ID объекта из CRM для «' + o.name + '» — без ID объект не попадает в расчёты.', 'Нет ID', 8);
      if (o.id && editedKeys.indexOf('id') >= 0) {
        const all = sh.getRange(2, 1, sh.getMaxRows() - 1, 1).getDisplayValues().filter(v => v[0].trim() === o.id).length;
        if (all > 1) toast_('ID ' + o.id + ' уже есть в 01_ОБЪЕКТЫ. ID должен быть уникальным.', 'Дубль ID', 10);
      }
    }
    if (spec.idField && !o[spec.idField]) {
      upd[spec.idField] = nextId_(code, idCache);
      o[spec.idField] = upd[spec.idField];
      isNew = true;
    }
    applyDefaults_(code, o, upd, isNew, user, editedKeys);
    // история изменений отслеживаемых полей
    editedKeys.forEach(k => {
      const f = fieldOf_(code, k);
      if (!f.track) return;
      const nv = o[k];
      let ov;
      if (single) ov = normalizeOld_(f, e.oldValue);
      else ov = isNew ? '' : '(массовое изменение)';
      if (ov === '' && (nv === '' || nv === null)) return;
      if (single && sameValue_(ov, nv)) return;
      hist.push({
        sheet: spec.name, record_id: recordId_(code, o), obj_id: code === 'OBJ' ? o.id : o.obj_id,
        field: f.title, old: ov, new: nv, kind: ov === '' ? HIST_KIND.INITIAL : HIST_KIND.CHANGE,
      });
    });
    if (Object.keys(upd).length) writeFields_(sh, code, row, upd);
    if (code === 'OBJ' && o.id && o.name && (isNew || !o.tab_url || editedKeys.indexOf('id') >= 0 || editedKeys.indexOf('name') >= 0)) {
      o._row = row;
      tabSync.push(o);
    }
    if (code === 'BASE' && editedKeys.indexOf('to_crm') >= 0 && o.to_crm === true && String(o.crm_note).indexOf('✓') !== 0) { o._row = row; crmRows.push(o); }
    if (code === 'TASK' && !isNew && editedKeys.indexOf('status') >= 0 && dictClassOf_('task_status', o.status) === CLS.MOVED) {
      const newId = moveTask_(o, hist);
      if (newId) toast_('Задача ' + o.id + ' перенесена на следующую неделю как ' + newId + '. Исходная строка сохранена.');
    }
  }
  renamed.forEach(p => {
    renameObjectId_(p[0], p[1]);
    hist.push({ sheet: spec.name, record_id: p[1], obj_id: p[1], field: fieldTitle_('OBJ', 'id'), old: p[0], new: p[1], kind: HIST_KIND.CHANGE, note: 'ID обновлён во всех листах' });
    toast_('ID ' + p[0] + ' → ' + p[1] + ' обновлён во всех связанных листах.');
  });
  tabSync.slice(0, 5).forEach(o => {
    const r = syncObjectTab_(o, 'create');
    if (r && r.built) toast_('Создана вкладка «' + r.sheet.getName() + '» — там стратегия объекта.', 'Новый объект', 8);
  });
  logHistory_(hist, user);
  if (crmRows.length) {
    try { crmOnEdit_(sh, crmRows); } catch (err) { toast_('CRM: ' + err.message, 'Внимание', 8); }
  }
}

function applyDefaults_(code, o, upd, isNew, user, editedKeys) {
  const now = new Date();
  const today = today_();
  const set = (k, v) => { upd[k] = v; o[k] = v; };
  if (code === 'OBJ' && isNew) {
    set('created_at', today);
    if (!o.status) set('status', dictValues_('obj_status')[0] || '');
  }
  if (code === 'TASK' && isNew) {
    if (!o.week) set('week', isoWeekKey_(today));
    if (!o.status) set('status', dictFirstByClass_('task_status', CLS.OPEN));
    if (!o.deadline) { const m = mondayOfWeekKey_(o.week); if (m) set('deadline', addDays_(m, 4)); }
    if (!o.owner) { const p = personByEmail_(user); if (p) set('owner', p); }
    if (!o.source) set('source', 'Вручную');
    set('to_report', true);
    set('created_at', now);
    set('author', user);
  }
  if ((code === 'BASE' || code === 'CONT') && isNew) {
    if (!o.owner) { const p = personByEmail_(user); if (p) set('owner', p); }
    if (code === 'CONT' && !o.status) set('status', dictValues_('content_status')[0] || '');
    set('created_at', now);
    set('author', user);
  }
  if (code === 'BASE' && editedKeys.indexOf('response') >= 0 && o.response && !o.response_date) set('response_date', today);
  if (code === 'CONT' && editedKeys.indexOf('status') >= 0 && dictClassOf_('content_status', o.status) === CLS.DONE && !o.pub_date) set('pub_date', today);
  if (code === 'LIB') {
    const content = editedKeys.some(k => ['kind', 'title', 'applies', 'text'].indexOf(k) >= 0);
    if (content) { set('updated_at', now); set('author', user); }
  }
}

function recordId_(code, o) {
  const spec = sheetSpecs_()[code];
  if (code === 'OBJ') return o.id;
  if (spec.idField) return o[spec.idField];
  return o.obj_id || '';
}

/** e.oldValue приходит строкой: даты — серийным числом, суммы — числом в строке. */
function normalizeOld_(f, v) {
  if (v === undefined || v === null || v === '') return '';
  if (f.kind === 'date' && /^\d+(\.\d+)?$/.test(String(v))) {
    const ms = Math.round(Number(v) * 86400000);
    const d = new Date(Date.UTC(1899, 11, 30) + ms);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  if ((f.kind === 'money' || f.kind === 'num') && !isNaN(Number(v))) return Number(v);
  return v;
}

function sameValue_(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return String(a) === String(b);
}

/** Исправили ID объекта в 01 → заменить старый ID в журналах, во вкладке объекта и в имени папки Drive. */
function renameObjectId_(oldId, newId) {
  ['TASK', 'BASE', 'CONT', 'ARCH', 'HIST'].forEach(code => {
    const sh = sheet_(code);
    const col = fieldIndex_(code, 'obj_id');
    sh.getRange(2, col, sh.getMaxRows() - 1, 1).createTextFinder(oldId).matchEntireCell(true).replaceAllWith(newId);
  });
  objectTabs_().forEach(t => {
    if (String(t.getRange(TAB.ID).getValue()) === oldId) t.getRange(TAB.ID).setNumberFormat('@').setValue(newId);
  });
  try {
    const parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID'));
    if (!parent) return;
    const it = parent.getFolders();
    const suffix = '(' + oldId + ')';
    while (it.hasNext()) {
      const f = it.next();
      if (f.getName().slice(-suffix.length) === suffix) f.setName(f.getName().slice(0, -suffix.length) + '(' + newId + ')');
    }
  } catch (err) { /* папку можно переименовать вручную */ }
}

/** Копия задачи на следующую неделю. Исходная строка остаётся со статусом «Перенесено». */
function moveTask_(o, hist, targetWeek) {
  const t = readTable_('TASK');
  if (t.rows.some(r => r.moved_from === o.id)) return null;
  const baseMon = mondayOfWeekKey_(o.week) || mondayOf_(today_());
  const nextKey = targetWeek || isoWeekKey_(addDays_(baseMon, 7));
  const nextMon = mondayOfWeekKey_(nextKey);
  const deadline = o.deadline instanceof Date ? addDays_(o.deadline, 7) : addDays_(nextMon, 4);
  const newId = nextId_('TASK');
  appendRow_('TASK', {
    id: newId, week: nextKey, obj_id: o.obj_id, block: o.block, task: o.task, owner: o.owner, unit: o.unit, plan: o.plan,
    status: dictFirstByClass_('task_status', CLS.OPEN), deadline: deadline, to_report: o.to_report === '' ? true : o.to_report,
    source: o.source, moved_from: o.id, created_at: new Date(), author: 'перенос',
  });
  hist.push({
    sheet: SHEET_NAMES.TASK, record_id: o.id, obj_id: o.obj_id, field: fieldTitle_('TASK', 'week'),
    old: o.week, new: nextKey, kind: HIST_KIND.MOVE, note: 'Создана копия ' + newId + ' (срок ' + fmtDate_(deadline) + ')',
  });
  return newId;
}

/** Пакетное добавление строк (одно чтение «последней строки» на все строки). */
function appendRows_(code, objs) {
  if (!objs.length) return [];
  const sh = sheet_(code);
  const spec = sheetSpecs_()[code];
  let row = lastDataRow_(sh, spec) + 1;
  if (row + objs.length > sh.getMaxRows()) extendSheet_(code, Math.max(500, objs.length + 100));
  const rows = [];
  objs.forEach(o => { writeFields_(sh, code, row, o); rows.push(row); row++; });
  return rows;
}

// ═════════════ 06_Reports.gs ═════════════
/**
 * 06_Reports — еженедельный отчёт клиенту: Google Doc + PDF + архив.
 *
 * Формат — как в отчётах руководителя (шапка ИП, «Приложение №1 к Договору», таблица реквизитов,
 * Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА, Раздел 2. ПОЛУЧЕННЫЕ ЗАЯВКИ, Раздел 3. ПЛАН РАБОТЫ).
 * Источник — лист 05_ОТЧЁТ_КЛИЕНТУ (предпросмотр): скрипт берёт оттуда только поля с метками {{…}},
 * поэтому внутренние данные (контакты, звонки, комментарии) в документ попасть не могут.
 * Клиент доступа к таблице не получает — только PDF.
 */

function createReport() {
  const ui = SpreadsheetApp.getUi();
  SpreadsheetApp.flush();
  const rep = sheet_('REP');
  const id = String(rep.getRange('E3').getValue() || '');
  const wk = String(rep.getRange('E4').getValue() || '');
  if (!id || !wk) {
    rep.activate();
    ui.alert('Выберите объект и неделю в листе ' + SHEET_NAMES.REP + ' (ячейки B3 и B4), затем повторите.');
    return;
  }
  const res = generateReport_(id, wk, { interactive: true });
  if (!res) return;
  showLinks_('Отчёт готов', [
    { label: 'Google Doc: ' + res.name, url: res.docUrl },
    { label: 'PDF для клиента', url: res.pdfUrl },
    { label: 'Папка отчётов объекта', url: res.folderUrl },
  ], 'Проверьте документ. Если поправите текст в Google Doc — нажмите «Обновить PDF отчёта».');
}

/** Собирает отчёт. Лист 05_ОТЧЁТ_КЛИЕНТУ должен быть выставлен на этот объект и неделю. */
function generateReport_(id, wk, opts) {
  opts = opts || {};
  const obj = objectById_(id);
  if (!obj) throw new Error('Объект ' + id + ' не найден в ' + SHEET_NAMES.OBJ);
  const values = readReportValues_();
  const arch = readTable_('ARCH');
  const existing = arch.rows.filter(r => r.obj_id === id && r.week === wk && r.status === REPORT_STATUS.ACTUAL);
  if (existing.length && opts.interactive) {
    const ui = SpreadsheetApp.getUi();
    const b = ui.alert('Отчёт за эту неделю уже есть',
      'Создать новую версию? Предыдущая останется в архиве со статусом «' + REPORT_STATUS.REPLACED + '».', ui.ButtonSet.YES_NO);
    if (b !== ui.Button.YES) return null;
  }
  existing.forEach(r => writeFields_(arch.sh, 'ARCH', r._row, { status: REPORT_STATUS.REPLACED }));

  const folder = ensureObjectFolder_(id, 'REPORTS');
  const tpl = DriveApp.getFileById(ensureReportTemplate_());
  const no = String(values.kv.REPORT_NO || '');
  const name = 'Отчёт ' + (no.length < 2 ? '0' : '') + no + ' — ' + obj.name + ' — ' + values.kv.PERIOD;
  const copy = tpl.makeCopy(name, folder);
  const doc = DocumentApp.openById(copy.getId());
  fillReportDoc_(doc, values);
  doc.saveAndClose();
  const pdf = folder.createFile(copy.getAs(MimeType.PDF)).setName(name + '.pdf');

  appendRow_('ARCH', {
    ts: new Date(), obj_id: id, obj_name: obj.name, report_no: values.kv.REPORT_NO, week: wk, period: values.kv.PERIOD,
    doc_link: copy.getUrl(), pdf_link: pdf.getUrl(), author: userEmail_(), status: REPORT_STATUS.ACTUAL,
  });
  writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { last_report_link: pdf.getUrl(), last_report_date: today_() });
  return { name: name, docId: copy.getId(), docUrl: copy.getUrl(), pdfId: pdf.getId(), pdfUrl: pdf.getUrl(), folderUrl: folder.getUrl() };
}

/** Пересоздаёт PDF из (возможно отредактированного) Google Doc последнего отчёта. */
function createPdf() {
  const ui = SpreadsheetApp.getUi();
  SpreadsheetApp.flush();
  const rep = sheet_('REP');
  const id = String(rep.getRange('E3').getValue() || '');
  const wk = String(rep.getRange('E4').getValue() || '');
  const arch = readTable_('ARCH');
  const rows = arch.rows.filter(r => r.obj_id === id && r.week === wk && r.status === REPORT_STATUS.ACTUAL);
  if (!id || !wk || !rows.length) {
    ui.alert('Для выбранного в ' + SHEET_NAMES.REP + ' объекта и недели ещё нет отчёта. Сначала «Создать отчёт клиенту».');
    return;
  }
  const r = rows[rows.length - 1];
  const docFile = DriveApp.getFileById(idFromUrl_(r.doc_link));
  const folder = docFile.getParents().hasNext() ? docFile.getParents().next() : ensureObjectFolder_(id, 'REPORTS');
  try {
    const old = DriveApp.getFileById(idFromUrl_(r.pdf_link));
    old.setName(old.getName().replace(/\.pdf$/i, '') + ' (устаревший).pdf');
  } catch (e) { /* старый PDF мог быть удалён вручную */ }
  const pdf = folder.createFile(docFile.getAs(MimeType.PDF)).setName(docFile.getName() + '.pdf');
  writeFields_(arch.sh, 'ARCH', r._row, { pdf_link: pdf.getUrl() });
  const obj = objectById_(id);
  if (obj) writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { last_report_link: pdf.getUrl() });
  showLinks_('PDF обновлён', [{ label: pdf.getName(), url: pdf.getUrl() }], 'Старый PDF переименован с пометкой «устаревший» и остался в папке.');
}

/** Значения из 05_ОТЧЁТ_КЛИЕНТУ: {kv: {PH: текст}, tables: {PH: [[№, текст, текст]]}}. */
function readReportValues_() {
  const sh = sheet_('REP');
  const L = reportLayout_();
  const kv = {};
  const vals = sh.getRange(REP_FIRST_ROW, 1, L.kvRows, 4).getDisplayValues();
  vals.forEach(v => {
    const m = /^\{\{([A-Z_]+)\}\}$/.exec(v[3]);
    if (m) kv[m[1]] = v[1];
  });
  const tables = {};
  Object.keys(L.tables).forEach(ph => {
    const t = L.tables[ph];
    tables[ph] = sh.getRange(t.first, 1, t.rows, 3).getDisplayValues().filter(r => r[0] !== '' || r[1] !== '');
  });
  return { kv: kv, tables: tables };
}

function lineKeys_() {
  const keys = {};
  reportRows_().forEach(r => { if (r.lines) keys[r.ph] = true; });
  return keys;
}

/** Подстановка: поля — replaceText, многострочные — абзацами, таблицы — строками таблицы. */
function fillReportDoc_(doc, values) {
  const body = doc.getBody();
  Object.keys(values.tables).forEach(ph => fillTableRows_(body, ph, values.tables[ph]));
  const lines = lineKeys_();
  Object.keys(values.kv).forEach(k => {
    const v = String(values.kv[k] || '').trim();
    if (!v && (k === 'COMMENT' || k === 'SUMMARY')) { removeBlock_(body, k); return; }
    if (lines[k]) replaceWithLines_(body, k, v.split(/\r?\n/).map(x => x.trim()).filter(Boolean));
  });
  [body, doc.getHeader(), doc.getFooter()].forEach(sec => {
    if (!sec) return;
    Object.keys(values.kv).forEach(k => {
      if (!lines[k]) sec.replaceText(phPattern_(k), escapeReplacement_(String(values.kv[k] || '—')));
    });
    sec.replaceText('\\{\\{[A-Z_]+\\}\\}', '—');
  });
}

function phPattern_(key) { return '\\{\\{' + key + '\\}\\}'; }
function escapeReplacement_(s) { return s.replace(/\\/g, '\\\\').replace(/\$/g, '\\$'); }

/** Абзац с {{KEY}} → по абзацу на строку (формат абзаца сохраняется). */
function replaceWithLines_(body, key, lines) {
  const found = body.findText(phPattern_(key));
  if (!found) return;
  const para = found.getElement().getParent();
  if (para.getType() !== DocumentApp.ElementType.PARAGRAPH && para.getType() !== DocumentApp.ElementType.LIST_ITEM) {
    found.getElement().asText().replaceText(phPattern_(key), escapeReplacement_(lines.join('; ')));
    return;
  }
  if (!lines.length) lines = ['—'];
  para.asText().setText(lines[0]);
  const parent = para.getParent();
  let idx = parent.getChildIndex(para);
  lines.slice(1).forEach(ln => {
    const copy = para.copy();
    copy.asText().setText(ln);
    idx++;
    if (copy.getType() === DocumentApp.ElementType.LIST_ITEM) parent.insertListItem(idx, copy);
    else parent.insertParagraph(idx, copy);
  });
}

/** Пустой раздел (комментарий, цифры): удалить абзац с меткой и заголовок над ним. */
function removeBlock_(body, key) {
  const found = body.findText(phPattern_(key));
  if (!found) return;
  const para = found.getElement().getParent();
  const prev = para.getPreviousSibling();
  para.removeFromParent();
  if (prev && prev.getType() === DocumentApp.ElementType.PARAGRAPH && prev.asParagraph().getHeading() !== DocumentApp.ParagraphHeading.NORMAL) prev.removeFromParent();
}

/** Строка таблицы с {{KEY}} — образец: на каждую строку данных делается копия. */
function fillTableRows_(body, key, rows) {
  const found = body.findText(phPattern_(key));
  if (!found) return;
  let el = found.getElement();
  while (el && el.getType() !== DocumentApp.ElementType.TABLE_ROW) el = el.getParent();
  if (!el) return;
  const tplRow = el.asTableRow();
  const table = tplRow.getParentTable();
  const idx = table.getChildIndex(tplRow);
  if (!rows.length) rows = [['—', '—', '']];
  rows.forEach((r, i) => {
    const nr = table.insertTableRow(idx + 1 + i, tplRow.copy());
    for (let c = 0; c < nr.getNumCells() && c < r.length; c++) nr.getCell(c).editAsText().setText(String(r[c]));
  });
  tplRow.removeFromParent();
}

/**
 * Одна папка на объект: 01_ОБЪЕКТЫ/«Название (ID из CRM)»/{Аналитика, КП и презентации, Отчёты, Фото и видео}.
 * kind: 'ROOT' — сама папка объекта, 'ANALYTICS' / 'MATERIALS' / 'REPORTS' / 'MEDIA' — подпапка.
 * Ссылка на папку объекта записывается в 01_ОБЪЕКТЫ.
 */
function ensureObjectFolder_(id, kind) {
  let parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID'));
  if (!parent) { ensureDrive_(); parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID')); }
  const obj = objectById_(id);
  const suffix = '(' + id + ')';
  let root = null;
  const linked = obj ? idFromUrl_(obj.folder_link) : '';
  if (linked) root = folderById_(linked); // своя папка объекта, указанная вручную в 01_ОБЪЕКТЫ
  const it = parent.getFolders();
  while (it.hasNext() && !root) {
    const f = it.next();
    if (f.getName().slice(-suffix.length) === suffix) root = f;
  }
  if (!root) root = parent.createFolder((obj ? obj.name : id) + ' ' + suffix);
  Object.keys(SYS.OBJECT_SUBFOLDERS).forEach(k => childFolder_(root, SYS.OBJECT_SUBFOLDERS[k]));
  if (obj && obj.folder_link !== root.getUrl()) writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { folder_link: root.getUrl() });
  if (!kind || kind === 'ROOT') return root;
  return childFolder_(root, SYS.OBJECT_SUBFOLDERS[kind]);
}

/**
 * Шаблон отчёта в формате руководителя. Создаётся один раз в 02_ШАБЛОНЫ; дальше вёрстку (шрифты, логотип,
 * отступы) можно менять прямо в Google Docs — метки {{…}} не удаляйте.
 */
function ensureReportTemplate_() {
  const id = String(cfgGet_('TEMPLATE_REPORT_ID') || '');
  if (id) {
    try { if (!DriveApp.getFileById(id).isTrashed()) return id; } catch (e) { /* создадим заново */ }
  }
  const doc = DocumentApp.create(SYS.REPORT_TEMPLATE_NAME);
  const b = doc.getBody();
  b.setMarginTop(42).setMarginBottom(42).setMarginLeft(56).setMarginRight(42);
  const base = {};
  base[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  base[DocumentApp.Attribute.FONT_SIZE] = 12;
  b.setAttributes(base);
  const H = DocumentApp.ParagraphHeading;
  const A = DocumentApp.HorizontalAlignment;
  const p0 = b.getParagraphs()[0];
  p0.setText('{{EXEC_HEADER}}').setAlignment(A.RIGHT).editAsText().setFontSize(10);
  b.appendParagraph('');
  b.appendParagraph('Приложение №1 к Договору № {{CONTRACT_NO}} от {{CONTRACT_DATE}}').setAlignment(A.RIGHT).editAsText().setFontSize(11);
  b.appendParagraph('Еженедельный отчёт').setHeading(H.HEADING2).setAlignment(A.CENTER);
  const info = b.appendTable([
    ['Наименование', 'Значение'], ['Отчет №', '{{REPORT_NO}}'], ['Период', '{{PERIOD}}'],
    ['Объект', '{{OBJECT}}'], ['Заказчик', '{{CUSTOMER}}'], ['Исполнитель', '{{EXECUTOR}}'],
  ]);
  styleReportTable_(info, [170, 320]);
  b.appendParagraph('Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА').setHeading(H.HEADING3);
  styleReportTable_(b.appendTable([['№', 'Действие по плану на эту неделю', 'Статус (выполнено / нет)'], ['{{PLAN_ROWS}}', '', '']]), [40, 330, 120]);
  b.appendParagraph('Итоги недели в цифрах').setHeading(H.HEADING4);
  b.appendParagraph('{{SUMMARY}}');
  b.appendParagraph('Раздел 2. ПОЛУЧЕННЫЕ ЗАЯВКИ').setHeading(H.HEADING3);
  styleReportTable_(b.appendTable([['№', 'Заявка', 'Следующий шаг'], ['{{LEADS_ROWS}}', '', '']]), [40, 280, 170]);
  b.appendParagraph('Раздел 3. ПЛАН РАБОТЫ').setHeading(H.HEADING3);
  styleReportTable_(b.appendTable([['№', 'Действие', 'Дата выполнения'], ['{{NEXT_ROWS}}', '', '']]), [40, 300, 150]);
  b.appendParagraph('Комментарий').setHeading(H.HEADING4);
  b.appendParagraph('{{COMMENT}}');
  b.appendParagraph('');
  b.appendParagraph('Исполнитель: ______________________ {{SIGNATURE}}');
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  const tplFolder = folderById_(cfgGet_('FOLDER_TEMPLATES_ID'));
  if (tplFolder) file.moveTo(tplFolder);
  cfgSet_('TEMPLATE_REPORT_ID', doc.getId());
  return doc.getId();
}

function styleReportTable_(t, widths) {
  t.setBorderColor('#000000');
  for (let r = 0; r < t.getNumRows(); r++) {
    const row = t.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      if (widths[c]) cell.setWidth(widths[c]);
      cell.setPaddingTop(3).setPaddingBottom(3);
      cell.editAsText().setFontSize(11).setBold(r === 0);
      const para = cell.getChild(0);
      if (para && para.getType() === DocumentApp.ElementType.PARAGRAPH) para.asParagraph().setAlignment(c === 0 || r === 0 ? DocumentApp.HorizontalAlignment.CENTER : DocumentApp.HorizontalAlignment.LEFT);
    }
  }
}

// ═════════════ 07_Planning.gs ═════════════
/**
 * 07_Planning — «Создать план недели».
 *
 * Для каждого объекта в работе:
 *  1) незакрытые задачи прошлых недель (по желанию) переносятся на выбранную неделю — исходные строки
 *     получают статус «Перенесено» и остаются в истории;
 *  2) добавляются задачи недели по умолчанию из 08_НАСТРОЙКИ (если такой задачи на эту неделю ещё нет).
 * Исполнитель: звонки и КП — ассистент объекта, публикации — SMM объекта, остальное — ответственный.
 */

function createWeekPlan() {
  const ui = SpreadsheetApp.getUi();
  const today = today_();
  const dow = today.getDay() || 7;
  const defKey = isoWeekKey_(dow >= 5 ? addDays_(today, 7) : today);
  const resp = ui.prompt('План недели',
    'Неделя (формат 2026-W40). По умолчанию — ' + defKey + ' (' + weekPeriodLabel_(defKey) + ').', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const wk = (resp.getResponseText() || '').trim() || defKey;
  if (!mondayOfWeekKey_(wk)) { ui.alert('Неделя должна быть в формате 2026-W40.'); return; }
  const carry = ui.alert('Перенос задач', 'Перенести незакрытые задачи прошлых недель на ' + wk + '?', ui.ButtonSet.YES_NO) === ui.Button.YES;
  const res = buildWeekPlan_(wk, { carry: carry });
  ui.alert('План недели ' + wk, 'Добавлено задач: ' + res.added + '\nПеренесено: ' + res.moved +
    (res.skipped.length ? '\nБез ID / не в работе: ' + res.skipped.join(', ') : '') +
    '\n\nДопишите в 02_ЗАДАЧИ задачи по стратегии (сценарии, аудитории, КП) — они попадут в отчёт клиенту.', ui.ButtonSet.OK);
}

function buildWeekPlan_(wk, opts) {
  opts = opts || {};
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && o.in_work !== 'НЕТ');
  const tasks = readTable_('TASK');
  const hist = [];
  let moved = 0;
  if (opts.carry) {
    const movedName = dictFirstByClass_('task_status', CLS.MOVED);
    tasks.rows.forEach(t => {
      const cls = t.status ? dictClassOf_('task_status', t.status) : CLS.OPEN;
      if (!t.obj_id || cls !== CLS.OPEN || !t.week || String(t.week) >= wk) return;
      if (!objs.some(o => o.id === t.obj_id)) return;
      const newId = moveTask_(t, hist, wk);
      if (newId) {
        writeFields_(tasks.sh, 'TASK', t._row, { status: movedName });
        moved++;
      }
    });
  }
  const fresh = readTable_('TASK').rows;
  const have = {};
  fresh.forEach(t => { have[t.obj_id + '|' + t.week + '|' + String(t.task).trim()] = true; });
  const defaults = defaultWeekTasks_();
  const mon = mondayOfWeekKey_(wk);
  const openName = dictFirstByClass_('task_status', CLS.OPEN);
  const add = [];
  const cache = {};
  objs.forEach(o => {
    defaults.forEach(d => {
      if (have[o.id + '|' + wk + '|' + d.task]) return;
      const unitCode = (unitDefs_().find(u => u[0] === d.unit) || [])[1] || '';
      const owner = (unitCode === 'CALLS' || unitCode === 'KP' || unitCode === 'RESP') ? (o.assistant || o.manager) :
        unitCode === 'PUB' ? (o.smm || o.manager) : o.manager;
      add.push({
        id: nextId_('TASK', cache), week: wk, obj_id: o.id, block: d.block, task: d.task, owner: owner || '', unit: d.unit, plan: d.plan,
        deadline: addDays_(mon, 4), status: openName, to_report: true, source: 'План недели', created_at: new Date(), author: userEmail_(),
      });
    });
  });
  appendRows_('TASK', add);
  logHistory_(hist, userEmail_());
  const skipped = readTable_('OBJ').rows.filter(o => (o.name && !o.id)).map(o => o.name);
  return { added: add.length, moved: moved, skipped: skipped };
}

function defaultWeekTasks_() {
  const r = ss_().getRangeByName('CFG_DEFAULT_TASKS');
  const rows = r ? r.getValues().filter(x => String(x[1]).trim() !== '') : DEFAULT_WEEK_TASKS;
  return rows.map(x => ({ block: x[0], task: String(x[1]).trim(), unit: x[2], plan: x[3] === '' ? '' : Number(x[3]) }));
}

// ═════════════ 08_Control.gs ═════════════
/**
 * 08_Control — контроль и обслуживание: просрочки, обновление, дэшборд.
 */

/** Просроченные задачи по исполнителям (то же, что внизу дэшборда, но списком). */
function checkOverdue() {
  SpreadsheetApp.flush();
  const rows = readTable_('TASK').rows.filter(t => t.overdue === 'ПРОСРОЧЕНО');
  const ui = SpreadsheetApp.getUi();
  if (!rows.length) { ui.alert('Просрочек нет', 'Все задачи с прошедшим сроком закрыты.', ui.ButtonSet.OK); return; }
  const by = {};
  rows.forEach(t => { const k = t.owner || '(без исполнителя)'; (by[k] = by[k] || []).push(t); });
  const text = Object.keys(by).map(k => k + ' — ' + by[k].length + ':\n' + by[k].slice(0, 12).map(t =>
    '   • ' + t.obj_name + ': ' + t.task + ' (срок ' + fmtDate_(t.deadline) + ', ' + t.id + ')').join('\n') +
    (by[k].length > 12 ? '\n   …' : '')).join('\n\n');
  ui.alert('Просроченные задачи: ' + rows.length, text + '\n\nЗакройте, перенесите («Перенесено») или отмените задачу в 02_ЗАДАЧИ.', ui.ButtonSet.OK);
}

/**
 * «Обновить»: проставляет ID и значения по умолчанию строкам, вставленным без триггера (копипаст большого блока),
 * создаёт недостающие вкладки объектов, добавляет строки в журналы, если они заканчиваются.
 */
function refreshAll() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) { toast_('Система занята, повторите через минуту.'); return; }
  let fixed = 0;
  try {
    ['TASK', 'BASE', 'CONT', 'LIB'].forEach(code => {
      const t = readTable_(code);
      const cache = {};
      t.rows.forEach(o => {
        const hasInput = t.spec.fields.some(f => isInputKind_(f.kind) && f.kind !== 'cb' && o[f.key] !== '');
        if (!hasInput || o[t.spec.idField]) return;
        const upd = {};
        upd[t.spec.idField] = nextId_(code, cache);
        applyDefaults_(code, o, upd, true, userEmail_(), []);
        writeFields_(t.sh, code, o._row, upd);
        fixed++;
      });
      const last = lastDataRow_(t.sh, t.spec);
      if (t.sh.getMaxRows() - last < 200) extendSheet_(code, 1000);
    });
    const objs = readTable_('OBJ');
    objs.rows.forEach(o => {
      if (o.id && o.name && !findObjectTab_(o)) { syncObjectTab_(o, 'create'); fixed++; }
    });
    orderSheets_();
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.flush();
  toast_('Готово. Исправлено / создано: ' + fixed, 'Обновление', 6);
}

function openDashboard() { sheet_('DASH').activate(); }

// ═════════════ 09_ExampleData.gs ═════════════
/**
 * 09_ExampleData — пример «ЖК Время · Лермонтовская 1» по реальным материалам руководителя
 * (маркетинговый анализ, отчёт № 5, таблица медцентров, КП и презентации на Google Диске).
 * ID объекта, заказчик и договор в примере условные — замените в 01_ОБЪЕКТЫ, всё обновится само.
 * Контакты компаний и итоги звонков обобщены; ссылки на файлы — вставьте свои.
 */

const EXAMPLE_ID = 'ВРЕМЯ-1';
// Ссылки на файлы и данные заказчика в пример не включены (репозиторий публичный) — вносятся в таблице.
const EXAMPLE_FILES = {
  analysis: 'Google Диск: Аналитика / Маркетинговый анализ', consult: 'Google Диск: консультация по лицензии',
  measurers: 'Google Диск: Замерщики и проектировщики', medTable: 'Google Диск: Медцентры для ЖК Время',
  kpPartner: 'Google Диск: КП партнёру', kpClient: 'Google Диск: КП ЖК Время', presMed: 'Google Диск: презентация под медцентр',
  presVet: 'Google Диск: презентация под ветклинику', analyticsPdf: 'Google Диск: Аналитика (PDF)', mailScript: 'Google Диск: текст рассылки',
};

function loadExampleData() {
  const ui = SpreadsheetApp.getUi();
  if (objectById_(EXAMPLE_ID)) { ui.alert('Пример уже загружен (объект ' + EXAMPLE_ID + ').'); return; }
  const b = ui.alert('Пример «ЖК Время»', 'Добавить пример объекта с вкладкой стратегии, задачами, обзвоном медцентров и контентом? Реальные данные не затрагиваются.', ui.ButtonSet.OK_CANCEL);
  if (b !== ui.Button.OK) return;
  const sh = loadExample_();
  sh.activate();
  ui.alert('Готово', 'Откройте вкладку «' + sh.getName() + '», затем 05_ОТЧЁТ_КЛИЕНТУ: выберите объект и неделю 2026-W38 (14.09–18.09) — это отчёт за 14–18.09 в вашем формате (как отчёт № 5).', ui.ButtonSet.OK);
}

function d_(s) { return s ? new Date(s + 'T00:00:00') : ''; }

function loadExample_() {
  const F = EXAMPLE_FILES;
  appendRow_('OBJ', {
    id: EXAMPLE_ID, name: 'ЖК Время · Лермонтовская 1', kind: 'Коммерция', deal: 'Продажа',
    address: 'г. Москва, ул. Лермонтовская, д.1 (помещение 1Н, 756,2 кв.м)', area: 756.2, price: 225500000,
    status: 'В работе', manager: 'Наталья', assistant: 'Ассистент', smm: 'SMM', customer: 'ООО «Заказчик»',
    contract_no: '000-000', contract_date: d_('2026-08-14'), date_sign: d_('2026-08-14'), created_at: today_(),
  });
  SpreadsheetApp.flush();
  const obj = objectById_(EXAMPLE_ID);
  const res = syncObjectTab_(obj, 'create');
  const data = {
    tables: {
      ANALOG: [
        ['Первомайская 42к4', 'ПСН', 848, 139000000, '', 'ЦИАН', 'Ближайший по площади'],
        ['Никитинская 10', 'ПСН', 684.3, 239505000, '', 'ЦИАН', ''],
        ['Никитинская 10', 'ГАБ (Пятёрочка)', 875.8, 227708000, '', 'ЦИАН', 'Арендный бизнес — не прямой аналог'],
        ['BestPlace, район: ПСН 1 этаж', 'медиана района', '', '', '', 'BestPlace', 'Медиана ~295 000 ₽/м²; офисы 2+ этаж ~122 000 ₽/м²'],
      ],
      SCEN: [
        ['Медицинский центр (в т.ч. стационар)', 'Медицина: помещение под лицензию', 'Отдельные входы, вентиляция, мокрые точки, мощность; техпаспорт и поэтажный план от УК', 'Консультанты по медицинскому лицензированию', 'Лицензия возможна, включая стационар — предлагаем сетям медцентров', 'Подтверждён', F.consult],
        ['Апарт-отель', 'Апарт-комплекс', 'ВРИ, мокрые точки под юниты, пожарные требования; документы от УК', 'Замерщики и проектировщики — таблица исполнителей, запрошены КП', 'Ждём КП проектировщиков на концепцию', 'Проверяем', F.measurers],
        ['Ветеринарная клиника', 'Ветклиника', 'Отдельный вход, вентиляция, правила УК', '', 'Подготовлена презентация под ветклиники', 'Проверяем', F.presVet],
        ['Частная школа / детский центр', 'Образование / детский центр', 'Лицензия, СанПиН, естественный свет, эвакуация', '', 'Приоритет ★★★ по анализу', 'Идея', ''],
        ['Фитнес / ГАБ (сетевой ритейл)', 'ГАБ / ритейл', 'Нагрузки на перекрытия, шум, режим работы', '', 'Приоритет ★★', 'Идея', ''],
      ],
      AUD: [
        ['Сети медцентров', 'Компании', 'Ищут 500–1000 м² под многопрофильный филиал или стационар в новых районах', '2ГИС, Rusprofile, сайты сетей, франшизы', '★★★'],
        ['Ветеринарные клиники', 'Компании', 'Жители ЖК — владельцы животных; лицензия не нужна', 'Сети ветклиник, 2ГИС', '★★'],
        ['Частные школы и детские центры', 'Компании', 'Семейная аудитория ЖК, дефицит мест рядом', 'Реестр лицензий, франшизы, 2ГИС', '★★★'],
        ['Красота и эстетика', 'Компании', 'Косметология / эстетическая медицина рядом с метро', 'Сайты клиник, агрегаторы', '★'],
        ['Инвесторы в арендный бизнес', 'Инвесторы', 'Купить помещение под арендатора-медцентр ради доходности', 'Брокеры коммерции, клубы инвесторов', '★★'],
        ['Операторы апарт-отелей', 'Компании', 'Апарт-формат у метро Преображенская площадь', 'Отраслевые каналы, УК апарт-отелей', '★'],
      ],
      KP: [
        ['КП «ЖК Время, Лермонтовская 1»', 'КП клиенту', 'Все аудитории', F.kpClient, 'Сделано', ''],
        ['КП для партнёров (без контактов)', 'КП партнёру', 'Брокеры, консультанты', F.kpPartner, 'Сделано', 'Для пересылки'],
        ['Презентация: помещение под медцентр', 'Презентация под аудиторию', 'Сети медцентров', F.presMed, 'Сделано', ''],
        ['Презентация: помещение под ветклинику', 'Презентация под аудиторию', 'Ветеринарные клиники', F.presVet, 'Сделано', ''],
        ['Аналитика (PDF)', 'КП клиенту', 'Собственник', F.analyticsPdf, 'Сделано', 'Для разговора о цене'],
        ['Текст рассылки по медцентрам', 'Письмо без вложения', 'Сети медцентров', F.mailScript, 'Сделано', ''],
      ],
      CHAN: [
        ['Прямой обзвон и рассылка по сетям медцентров', 'Звонки, КП на почту, формы на сайтах', 'Ассистент', 'Регулярно', 'См. 03_ОБЗВОН_И_КП', F.medTable],
        ['ЦИАН / Авито', 'Объявление, продвижение', 'Наталья', 'Регулярно', '', ''],
        ['Консультанты по медицинскому лицензированию', 'Проверка сценария «стационар»', 'Наталья', 'Сделано', 'Лицензия возможна', F.consult],
        ['Замерщики и проектировщики (апарт-формат)', 'Запрос КП', 'Ассистент', 'В работе', 'Запрошены КП', F.measurers],
        ['Instagram / Telegram / YouTube Shorts / Threads', 'Рилс об объекте (3 цели)', 'SMM', 'В работе', '', ''],
      ],
      DEC: [
        [d_('2026-09-10'), 'Приоритет: медицина и образование ★★★, фитнес / ГАБ ★★, офис ★ (маркетинговый анализ)', 'Наталья', 'Обзвон сетей медцентров, презентации под каждую аудиторию'],
        [d_('2026-09-18'), 'Консультация: медицинская лицензия возможна, включая стационар', 'Наталья', 'КП по 8 целевым контактам, расширить базу медцентров'],
        [d_('2026-09-21'), 'Лаборатории и аптеки — филиалы слишком малы (50–150 м²), не направляем', 'Ассистент', 'Фокус на сетях с филиалами 500–1000 м²'],
      ],
    },
    kv: {
      rec_price: 190000000, min_price: 170000000,
      positioning: 'Двухуровневое помещение 756 м² в новом ЖК «Время» у метро Преображенская площадь: потолки 4,5 м, 152 кВт, 4 входа, 8 мокрых точек — готово под медицину и образование без переделки.',
      price_note: 'Рекомендуемая цена 185–195 млн ₽, консервативно 165–170 млн, минимальная цена сделки 170–175 млн. Текущая цена 225,5 млн выше рынка — обсудить с собственником после первой волны откликов.',
      analysis_link: F.analysis,
    },
  };
  buildObjectTab_(res.sheet, EXAMPLE_ID, data);

  const cache = {};
  const T = (week, block, task, owner, unit, plan, status, result, deadline) => ({
    id: nextId_('TASK', cache), week: week, obj_id: EXAMPLE_ID, block: block, task: task, owner: owner, unit: unit, plan: plan,
    status: status, result: result || '', deadline: d_(deadline), to_report: true, source: 'План недели', created_at: new Date(), author: 'пример',
  });
  appendRows_('TASK', [
    T('2026-W38', 'База и рассылки', 'Произведён обзвон медицинских центров с предложением объекта', 'Ассистент', 'звонков', 8, 'Выполнено', '', '2026-09-18'),
    T('2026-W38', 'База и рассылки', 'Направлены коммерческие предложения по медцентрам', 'Ассистент', 'КП', 2, 'Выполнено', 'Срок получения обратной связи — в течение недели, до 25.09', '2026-09-18'),
    T('2026-W38', 'КП и материалы', 'Разработаны презентации под каждый вид бизнеса и целевую аудиторию', 'Наталья', '', '', 'Выполнено', 'Прикрепляем к отчёту', '2026-09-18'),
    T('2026-W38', 'Сценарии использования', 'Выполнен поиск замерщиков под вид деятельности «апартаменты», по каждому исполнителю внесены данные в таблицу', 'Ассистент', '', '', 'Выполнено', '', '2026-09-18'),
    T('2026-W38', 'Сценарии использования', 'Выполнен поиск проектировщиков под вид деятельности «апартаменты», запрошены коммерческие предложения', 'Ассистент', '', '', 'Выполнено', '', '2026-09-18'),
    T('2026-W39', 'База и рассылки', 'Направить коммерческие предложения по медцентрам по 8 целевым контактам', 'Ассистент', 'КП', 8, 'В работе', '', '2026-09-25'),
    T('2026-W39', 'База и рассылки', 'Прозвонить 10 медицинских центров с предложением объекта', 'Ассистент', 'звонков', 10, 'В работе', '', '2026-09-25'),
    T('2026-W39', 'Контент', 'Рилс об объекте: помещение под медцентр у метро', 'SMM', 'публикаций', 1, 'В работе', '', '2026-09-25'),
  ]);

  const base = [
    {
      "audience": "Сети медцентров",
      "company": "Открытая клиника",
      "site": "openclinics.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Не подходит",
      "fit_note": "Ниже официальной нижней границы сети (у них от 1000 м², у вас 756,2 м²) — включено по вашему запросу, но по действующим условиям франшизы требует отдельных пере",
      "call_date": "2026-09-15",
      "call_result": "КП отправлено на общую почту / форму сайта",
      "kp_date": "2026-09-21",
      "kp_type": "КП клиенту",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "Позвонить по общей линии, если не соединят — письмо на общую почту",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Чайка",
      "site": "chaika.com / city.chaika.com",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо по метражу — единственная крупная сеть, чей типовой филиал (700–1500 м²) прямо перекрывает площадь объекта, но нетипичное для сети расположение нужно обс",
      "call_date": "2026-09-15",
      "call_result": "Звонок: предложение передано",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Ниармедик",
      "site": "nrmed.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо, но обязательно уточнить актуальный минимальный метраж напрямую — три источника дают три разные цифры (150 / 300 / 500 м²)",
      "call_date": "2026-09-16",
      "call_result": "Колл-центр не соединяет с ЛПР — отправить КП на почту",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Ветеринарные клиники",
      "company": "Vetcity Clinic",
      "site": "vet.city",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо, но требует уточнения сразу по двум пунктам — тип здания и верхняя граница площади",
      "call_date": "2026-09-16",
      "call_result": "Колл-центр не соединяет с ЛПР — отправить КП на почту",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Медси",
      "site": "medsi.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Отлично — подтверждено по всем параметрам: метраж, встроенность в жилой дом, отсутствие стационара",
      "call_date": "2026-09-17",
      "call_result": "Колл-центр не соединяет с ЛПР — отправить КП на почту",
      "kp_date": "2026-09-17",
      "kp_type": "Презентация под аудиторию",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "Написать на общую почту + форма франчайзинга",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Интан",
      "site": "intan.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо, но ниже нижней границы целевого диапазона и есть требование «первая линия» — уточнить обе позиции перед показом",
      "call_date": "2026-09-17",
      "call_result": "Дозвонились до отдела франчайзинга: не интересно",
      "kp_date": "",
      "kp_type": "",
      "response": "Не интересно",
      "response_date": "2026-09-17",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Доктор рядом",
      "site": "drclinics.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Отлично — метраж и профиль почти дословно совпадают с параметрами объекта, ближайший по духу аналог к «Свой Доктор» и «Медси Смарт 300»",
      "call_date": "2026-09-18",
      "call_result": "Звонок: предложение передано",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Ветеринарные клиники",
      "company": "Свой Доктор",
      "site": "svoydoctor.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Отлично — лучшее совокупное совпадение по всем 4 параметрам объекта (жилой дом, закрытый двор, 2-я линия, паркинг)",
      "call_date": "2026-09-18",
      "call_result": "Соединили с управляющей, предложение озвучено — ждёт презентацию",
      "kp_date": "2026-09-17",
      "kp_type": "Презентация под аудиторию",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "Перезвонить управляющей после изучения презентации",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Клиника Фомина. Рядом",
      "site": "fomin-clinic.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо — компактный формат ложится в блок, встроенность в жилой дом высоковероятна по профилю локаций сети",
      "call_date": "",
      "call_result": "КП отправлено на общую почту / форму сайта",
      "kp_date": "2026-09-21",
      "kp_type": "КП клиенту",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "WeClinic",
      "site": "franshizaweclinic.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Уточнить",
      "fit_note": "Средне — метраж формально подходит, но сеть небольшая и слабо подтверждена публичными кейсами в Москве; проверить актуальность франшизы перед контактом",
      "call_date": "",
      "call_result": "Сайт не открывается — не отправляли",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "KDL (Медскан)",
      "site": "kdl.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо — метраж и профиль подходят, встроенность в жилой дом уточнить напрямую",
      "call_date": "",
      "call_result": "КП отправлено на общую почту / форму сайта",
      "kp_date": "2026-09-21",
      "kp_type": "КП клиенту",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "LabQuest",
      "site": "labquest.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо — метраж подходит, встроенность в жилой дом уточнить напрямую",
      "call_date": "",
      "call_result": "Сайт не открывается — не отправляли",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Гемотест",
      "site": "gemotest.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо — компактный блок-спутник, все параметры объекта совместимы",
      "call_date": "",
      "call_result": "Филиалы сети слишком малы для объекта — не направляли",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Красота и эстетика",
      "company": "Точка Красоты (MONE)",
      "site": "tochkafamily.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо, но есть противоречие в источниках по трафику — уточнить актуальные условия перед показом",
      "call_date": "",
      "call_result": "Филиалы сети слишком малы для объекта — не направляли",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Инвитро",
      "site": "invitro.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо, но уточнить требование «первая линия» — единственная явная нестыковка с параметрами объекта у этой компании",
      "call_date": "",
      "call_result": "Филиалы сети слишком малы для объекта — не направляли",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Ветеринарные клиники",
      "company": "Зайцев+",
      "site": "vetlabplus.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Подходит",
      "fit_note": "Хорошо — самый компактный формат, встроенность в жилой дом уточнить напрямую",
      "call_date": "",
      "call_result": "Филиалы сети слишком малы для объекта — не направляли",
      "kp_date": "",
      "kp_type": "",
      "response": "",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Major Clinic",
      "site": "major-clinic.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Уточнить",
      "fit_note": "Площадь не подтверждена — требуется прямой запрос в компанию",
      "call_date": "",
      "call_result": "КП отправлено на общую почту / форму сайта",
      "kp_date": "2026-09-21",
      "kp_type": "КП клиенту",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Медок",
      "site": "mcmedok.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Уточнить",
      "fit_note": "Площадь не подтверждена — требуется прямой запрос в компанию",
      "call_date": "",
      "call_result": "КП отправлено на общую почту / форму сайта",
      "kp_date": "2026-09-21",
      "kp_type": "КП клиенту",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "Семейная",
      "site": "semeynaya.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Уточнить",
      "fit_note": "Площадь не подтверждена — требуется прямой запрос в компанию",
      "call_date": "",
      "call_result": "КП отправлено на общую почту / форму сайта",
      "kp_date": "2026-09-21",
      "kp_type": "КП клиенту",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Сети медцентров",
      "company": "СМ-Стоматология",
      "site": "sm-stomatology.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Уточнить",
      "fit_note": "Площадь не подтверждена — требуется прямой запрос в компанию",
      "call_date": "",
      "call_result": "КП отправлено на общую почту / форму сайта",
      "kp_date": "2026-09-21",
      "kp_type": "КП клиенту",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Красота и эстетика",
      "company": "Estee Clinic / КИЭМ / МедЭстет / CodeBeautyMedicine",
      "site": "msk.estee-clinic.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Уточнить",
      "fit_note": "Площадь не подтверждена — требуется прямой запрос в компанию",
      "call_date": "",
      "call_result": "КП отправлено на общую почту / форму сайта",
      "kp_date": "2026-09-21",
      "kp_type": "КП клиенту",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    },
    {
      "audience": "Ветеринарные клиники",
      "company": "Белый Клык / Зоовет / Беланта / Биоконтроль",
      "site": "bkvet.ru",
      "contact": "общая линия / форма на сайте",
      "fit": "Уточнить",
      "fit_note": "Площадь не подтверждена — требуется прямой запрос в компанию",
      "call_date": "",
      "call_result": "КП отправлено на общую почту / форму сайта",
      "kp_date": "2026-09-21",
      "kp_type": "КП клиенту",
      "response": "Нет ответа",
      "response_date": "",
      "next_step": "",
      "owner": "Ассистент"
    }
  ];
  appendRows_('BASE', base.map(b => ({
    id: nextId_('BASE', cache), obj_id: EXAMPLE_ID, audience: b.audience, company: b.company, site: b.site, contact: b.contact,
    fit: b.fit, fit_note: b.fit_note, call_date: d_(b.call_date), call_result: b.call_result, kp_date: d_(b.kp_date), kp_type: b.kp_type,
    response: b.response, response_date: d_(b.response_date), next_step: b.next_step, owner: b.owner, created_at: d_(b.call_date || b.kp_date || '2026-09-14'), author: 'пример',
  })));

  appendRows_('CONT', [
    { id: nextId_('CONT', cache), obj_id: EXAMPLE_ID, topic: 'Помещение 756 м² под медцентр: 4,5 м, 152 кВт, 4 входа', platform: 'Instagram', format: 'Рилс', goal: 'Все три', script: 'Хук: «Где открыть клинику без переделки?» → проход по этажам → цифры на экране → призыв написать', status: 'Сценарий', owner: 'SMM', created_at: new Date(), author: 'пример' },
    { id: nextId_('CONT', cache), obj_id: EXAMPLE_ID, topic: 'Как мы ищем арендатора-медцентр: 23 сети за 2 недели', platform: 'Telegram', format: 'Пост', goal: 'Бренд агентства', status: 'Идея', owner: 'SMM', created_at: new Date(), author: 'пример' },
  ]);
  logHistory_([{ sheet: SHEET_NAMES.OBJ, record_id: EXAMPLE_ID, obj_id: EXAMPLE_ID, field: 'Пример', old: '', new: 'Загружен пример ЖК Время', kind: HIST_KIND.CREATE }], userEmail_());
  SpreadsheetApp.flush();
  return res.sheet;
}

// ═════════════ 10_SelfTest.gs ═════════════
/**
 * 10_SelfTest — самопроверка: листы, именованные диапазоны, ошибки в формулах,
 * а при загруженном примере — цифры план-факта, отчёта и заполненности стратегии.
 * Результат — лист 99_САМОПРОВЕРКА (зелёный ✓ / красный ✗).
 */

const SELFTEST_SHEET = '99_САМОПРОВЕРКА';

function runSelfTest() {
  const ui = SpreadsheetApp.getUi();
  const withDoc = ui.alert('Самопроверка', 'Проверить также создание отчёта (Google Doc + PDF) по примеру? Будет создан тестовый отчёт в папке примера.', ui.ButtonSet.YES_NO) === ui.Button.YES;
  const res = selfTest_({ withDoc: withDoc });
  const bad = res.filter(r => !r[1]).length;
  ui.alert('Самопроверка', bad ? '✗ Ошибок: ' + bad + '. Подробности — лист ' + SELFTEST_SHEET + '.' : '✓ Все проверки пройдены (' + res.length + ').', ui.ButtonSet.OK);
}

function selfTest_(opts) {
  opts = opts || {};
  const out = [];
  const check = (name, ok, info) => out.push([name, !!ok, info === undefined ? '' : String(info)]);
  const ss = ss_();
  SpreadsheetApp.flush();

  Object.keys(SHEET_NAMES).forEach(k => check('Лист ' + SHEET_NAMES[k], ss.getSheetByName(SHEET_NAMES[k])));
  cfgDefs_().filter(d => d.key).forEach(d => check('Настройка CFG_' + d.key, ss.getRangeByName('CFG_' + d.key)));
  check('Задачи недели по умолчанию', ss.getRangeByName('CFG_DEFAULT_TASKS'));
  check('Триггер onEdit', ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'onEditHandler'), 'если ✗ — «Установить / обновить систему»');

  const errRe = /^#(REF|ERROR|NAME|VALUE|DIV\/0|NUM)[!?]?/;
  const scan = (sh, rows, cols) => {
    const n = Math.min(rows, sh.getMaxRows()), m = Math.min(cols, sh.getMaxColumns());
    const vals = sh.getRange(1, 1, n, m).getDisplayValues();
    const bad = [];
    vals.forEach((r, i) => r.forEach((v, j) => { if (errRe.test(v)) bad.push(colLetter_(j + 1) + (i + 1) + ' ' + v); }));
    return bad;
  };
  ['OBJ', 'TASK', 'BASE', 'CONT'].forEach(code => {
    const b = scan(sheet_(code), 300, sheetSpecs_()[code].fields.length);
    check('Нет ошибок в формулах ' + SHEET_NAMES[code], !b.length, b.slice(0, 5).join('; '));
  });
  [['DASH', 200, 26], ['REP', 120, 5], ['DICT', 60, 80]].forEach(p => {
    const b = scan(sheet_(p[0]), p[1], p[2]);
    check('Нет ошибок в формулах ' + SHEET_NAMES[p[0]], !b.length, b.slice(0, 5).join('; '));
  });
  objectTabs_().forEach(sh => {
    const b = scan(sh, sh.getMaxRows(), TAB.LAST_COL);
    check('Нет ошибок во вкладке ' + sh.getName(), !b.length, b.slice(0, 5).join('; '));
  });
  check('Недели в справочнике', dictRows_('weeks').length > 0, dictRows_('weeks').length + ' недель');
  check('Библиотека заполнена', readTable_('LIB').rows.length >= 10, readTable_('LIB').rows.length + ' записей');

  // проверки на примере
  const ex = objectById_(EXAMPLE_ID);
  if (ex) {
    const tab = findObjectTab_(ex);
    check('Пример: вкладка объекта', tab, tab ? tab.getName() : '');
    if (tab) check('Пример: стратегия заполнена на 100%', Number(tab.getRange(TAB.PCT).getValue()) === 1, tab.getRange(TAB.PCT).getDisplayValue());
    check('Пример: ссылка на вкладку и % в 01', String(ex.tab_url).indexOf('#gid=') === 0 && ex.strategy_pct !== '', ex.tab_url + ' / ' + ex.strategy_pct);
    const tasks = readTable_('TASK').rows.filter(t => t.obj_id === EXAMPLE_ID);
    const factOf = (wk, unit) => { const t = tasks.find(x => x.week === wk && x.unit === unit); return t ? t.fact_auto : 'нет задачи'; };
    check('Пример: звонков за 2026-W38 = 8 (авто)', factOf('2026-W38', 'звонков') === 8, factOf('2026-W38', 'звонков'));
    check('Пример: КП за 2026-W38 = 2 (авто)', factOf('2026-W38', 'КП') === 2, factOf('2026-W38', 'КП'));
    check('Пример: КП за 2026-W39 = 9 (авто)', factOf('2026-W39', 'КП') === 9, factOf('2026-W39', 'КП'));

    const rep = sheet_('REP');
    const keep = ['B3', 'B4'].map(a => rep.getRange(a).getValue());
    rep.getRange('B3').setValue(objLabel_(EXAMPLE_ID, ex.name));
    rep.getRange('B4').setValue(weekLabelByKey_('2026-W38'));
    SpreadsheetApp.flush();
    const v = readReportValues_();
    check('Отчёт: период 14.09.2026 – 18.09.2026', v.kv.PERIOD === '14.09.2026 – 18.09.2026', v.kv.PERIOD);
    check('Отчёт: № договора из 01_ОБЪЕКТЫ', v.kv.CONTRACT_NO === '000-000', v.kv.CONTRACT_NO);
    check('Отчёт: 5 пунктов в «Выполнение плана»', v.tables.PLAN_ROWS.length === 5, v.tables.PLAN_ROWS.length);
    check('Отчёт: 3 пункта в «План работы»', v.tables.NEXT_ROWS.length === 3, v.tables.NEXT_ROWS.length);
    check('Отчёт: в тексте нет контактов из обзвона', JSON.stringify(v).indexOf('+7') < 0);
    if (opts.withDoc) {
      try {
        const r = generateReport_(EXAMPLE_ID, '2026-W38', { interactive: false });
        const text = DocumentApp.openById(r.docId).getBody().getText();
        check('Отчёт: Google Doc и PDF созданы', r.pdfUrl, r.docUrl);
        check('Отчёт: в документе не осталось меток {{…}}', !/\{\{[A-Z_]+\}\}/.test(text));
        check('Отчёт: в документе «Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА»', text.indexOf('Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА') >= 0);
      } catch (e) {
        check('Отчёт: Google Doc и PDF созданы', false, e.message);
      }
    }
    restoreSel_(rep, 'B3', keep[0]);
    restoreSel_(rep, 'B4', keep[1]);
  } else {
    check('Пример не загружен — расчётные проверки пропущены', true, 'Сервис → Загрузить пример');
  }

  let sh = ss.getSheetByName(SELFTEST_SHEET);
  if (!sh) sh = ss.insertSheet(SELFTEST_SHEET);
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([['Проверка', 'Результат', 'Детали']]).setFontWeight('bold');
  sh.getRange(1, 4).setValue('Запуск: ' + fmtDate_(new Date(), 'dd.MM.yyyy HH:mm'));
  const rows = out.map(r => [r[0], r[1] ? '✓' : '✗', r[2]]);
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
  sh.getRange(2, 2, rows.length, 1).setBackgrounds(out.map(r => [r[1] ? COLORS.GREEN_BG : COLORS.RED_BG]));
  sh.setColumnWidth(1, 380); sh.setColumnWidth(2, 90); sh.setColumnWidth(3, 480);
  sh.activate();
  return out;
}

// ═════════════ 11_Library.gs ═════════════
/**
 * 11_Library — стартовое наполнение 06_БИБЛИОТЕКА: чек-листы сценариев, промпты для Claude, регламенты, скрипты.
 * Добавляются только записи, которых ещё нет (по названию), — правки команды не перезаписываются.
 * Названия чек-листов появляются в выпадающем списке раздела «Сценарии использования» во вкладке объекта.
 */

function libraryDefaults_() {
  const CL = 'Чек-лист', PR = 'Промпт', RG = 'Регламент', SC = 'Скрипт';
  return [
    [CL, 'Медицина: помещение под лицензию', 'Коммерция: медцентр, клиника, стационар, стоматология, лаборатория',
      '1) Назначение помещения и ВРИ участка допускают медицину; нет запрета в договоре с УК / ТСЖ.\n2) Отдельный вход (желательно 2: пациенты и служебный), путь эвакуации, пандус / доступность МГН.\n3) Высота потолков, вентиляция (приток-вытяжка отдельно от жилого дома), возможность шахты.\n4) Мокрые точки: количество и где стоят; канализация; нагрузки на перекрытия под оборудование (КТ/МРТ).\n5) Электромощность (кВт), категория надёжности, резерв.\n6) СанПиН 2.1.3678-20: площади кабинетов, естественный свет, инсоляция квартир над помещением.\n7) Стационар: отдельно — требования к палатам, пищеблоку, дезинфекции; подтвердить у консультанта по лицензированию.\n8) Документы от УК / собственника: техпаспорт БТИ, поэтажный план и экспликация, выписка ЕГРН, ТУ на мощность, схема вентиляции, акт ввода дома.\n9) Консультант по лицензированию: письменный вывод «лицензия возможна / при каких условиях».\n10) Вывод для КП: какие виды медицинской деятельности подтверждены — писать в КП только подтверждённое.'],
    [CL, 'Апарт-комплекс', 'Коммерция под апартаменты / апарт-отель, перевод в жильё',
      '1) ВРИ и назначение: можно ли апарт-формат / гостиница; ограничения жилого дома.\n2) Нагрузки и мокрые точки под санузлы в каждом юните; стояки, уклоны канализации.\n3) Окна и инсоляция, высота потолков (антресоли при 4,5 м).\n4) Пожарные требования, эвакуация, отдельные входы.\n5) Электромощность на количество юнитов.\n6) Документы от УК: техпаспорт, планы, ТУ, согласие ТСЖ при необходимости.\n7) Замерщики: обмер, фиксация по каждому исполнителю (цена, срок, контакты).\n8) Проектировщики: КП на концепцию нарезки (кол-во юнитов, площади, бюджет), срок.\n9) Экономика: стоимость реконструкции, доходность аренды юнитов, срок окупаемости — для КП инвестору.'],
    [CL, 'Ветклиника', 'Коммерция под ветеринарную клинику',
      '1) Отдельный вход, желательно с улицы / не через двор ЖК.\n2) Вентиляция, шумоизоляция, мокрые точки, стационар для животных — согласовать с УК.\n3) Лицензия на ветдеятельность не требуется (кроме фармдеятельности) — проверить актуальность.\n4) Отношение жителей ЖК / правила УК о животных.\n5) Трафик владельцев животных: количество квартир, наличие конкурентов в радиусе 1 км.'],
    [CL, 'Образование / детский центр', 'Коммерция под частную школу, детсад, кружки',
      '1) Лицензия на образовательную деятельность: требования к помещению, СанПиН 2.4.3648-20.\n2) Естественное освещение, площадь на ребёнка, санузлы по количеству детей.\n3) Отдельный вход, безопасная зона высадки, прогулочная площадка (для детсада).\n4) Эвакуация, пожарная сигнализация.\n5) Аудитория: количество семей с детьми в ЖК и районе, конкуренты.'],
    [CL, 'Общепит', 'Коммерция под кафе / ресторан',
      '1) Разрешено ли в жилом доме (вытяжка через кровлю, запахи, шум).\n2) Мощность, газ / электроплиты, жироуловитель, мокрые точки.\n3) Вход, витрина, летняя веранда.\n4) Документы УК, согласие на вытяжку.\n5) Трафик: пешеходный поток, офисы рядом.'],
    [CL, 'ГАБ / ритейл', 'Готовый арендный бизнес, сетевой ритейл',
      '1) Действующий арендатор, срок и условия договора, индексация, гарантийный платёж.\n2) Ставка аренды к рынку, окупаемость, доходность.\n3) Требования сетей: площадь, погрузка, парковка, первая линия.\n4) Документы: договор аренды, акты, ЕГРН, выписка по платежам.'],
    [CL, 'Жильё для семьи', 'Квартиры: семейная аудитория',
      '1) Школы, детсады, поликлиника, парки рядом — фото и расстояния.\n2) Планировка: детские, кладовые, санузлы.\n3) Ипотека / семейная ипотека: подходит ли объект, аккредитация банков.\n4) Документы собственника: основание, обременения, согласия.'],
    [CL, 'Загородный дом', 'Загородные дома и особняки',
      '1) Коммуникации: газ, электричество (кВт), вода, канализация — документы.\n2) Земля: категория, ВРИ, межевание, обременения.\n3) Дорога круглый год, охрана, инфраструктура посёлка, УК и платежи.\n4) Состояние дома: кровля, фундамент, отопление; отчёт осмотра.\n5) Съёмка: сезонность, дрон, вечерние фото.'],
    [PR, 'Анализ цены по аналогам', 'Раздел «Аналитика и цена» вкладки объекта',
      'Ты — аналитик коммерческой / жилой недвижимости Москвы. Объект: {адрес, площадь, этаж, назначение, особенности}. Текущая цена: {цена}. Аналоги с ЦИАН: {таблица аналогов из вкладки}.\nСделай: 1) медиану и разброс цены за м² по сопоставимым аналогам (отдельно отбрось несопоставимые и объясни почему); 2) поправки на этаж, вход, высоту, мощность, готовность под бизнес; 3) рекомендованный диапазон цены, консервативную цену и минимальную цену сделки; 4) 3 аргумента для собственника, если цена выше рынка. Ответ — таблица + короткий вывод.'],
    [PR, 'Сценарии использования и неочевидные аудитории', 'Разделы «Сценарии» и «Аудитории»',
      'Объект: {описание, площадь, этажи, потолки, мощность, входы, мокрые точки, окружение: метро, бизнес-центры, школы, посольства, вокзалы, аэропорт}. Предложи 8–10 сценариев использования (продажа / аренда), включая неочевидные. Для каждого: кому (конкретные типы компаний или людей), почему объект им подходит, что проверить до предложения (документы, лицензии, технические требования), риски, приоритет ★–★★★. Отдельно — 3 идеи, которые обычный брокер не заметит.'],
    [PR, 'Портрет целевой аудитории', 'Раздел «Аудитории»',
      'Аудитория: {например, сети медцентров}. Объект: {кратко}. Опиши: кто принимает решение (должность), чего он боится и что ему важно в помещении, какие цифры он захочет увидеть в КП, где искать контакты (реестры, 2ГИС, сайты, ассоциации, Telegram-каналы), как лучше выйти на ЛПР. Дай список из 20 конкретных компаний Москвы с сайтами, если уверен в них (помечай, что проверить).'],
    [PR, 'КП клиенту и партнёру', 'Раздел «КП и материалы»',
      'Подготовь текст КП для {аудитория} по объекту {описание}. Структура: заголовок-выгода, 5 ключевых фактов (цифры), почему подходит именно под их бизнес, экономика (ставка / цена / окупаемость), следующий шаг. Версия 1 — клиенту (с контактами агентства). Версия 2 — партнёру для пересылки: без контактов агентства и собственника, нейтральный тон.'],
    [PR, 'Скрипт звонка и письма', 'Работа с базой (03_ОБЗВОН_И_КП)',
      'Составь для ассистента: 1) скрипт звонка в колл-центр / приёмную сети {аудитория} с целью выйти на отдел развития (3 варианта обхода «секретаря»); 2) короткое письмо с КП (до 700 знаков) с просьбой переслать ЛПР; 3) текст для формы обратной связи на сайте; 4) ответы на 5 типовых возражений. Объект: {кратко}.'],
    [PR, 'Сценарий рилс', 'Контент (04_КОНТЕНТ)',
      'Сценарий вертикального видео 30–45 сек по объекту {описание}. Три цели: найти покупателя / арендатора ({аудитория}), показать собственнику работу, бренд агентства. Дай: хук на 2 секунды, раскадровку по 5–7 планам (что снимать, текст на экране, закадровый текст), призыв к действию, подпись к посту и 10 хэштегов. Варианты для Instagram, Telegram, YouTube Shorts, Threads.'],
    [PR, 'Оперативка → задачи', 'Расшифровка Zoom / заметки встречи → меню «Внести задачи с оперативки»',
      'Вот расшифровка оперативки агентства недвижимости: {текст}.\nСписок объектов (ID — название): {объекты}. Сотрудники: {сотрудники}.\nВыдели все поручения и решения. Ответ — ТОЛЬКО таблица без пояснений, 8 столбцов через символ «|»:\nID объекта | Блок стратегии | Задача | Исполнитель | Единица | План | Срок | Решение\nПравила: ID объекта — строго из списка; Блок — одно из: Аналитика и цена, Сценарии использования, Целевые аудитории, КП и материалы, База и рассылки, Каналы и партнёры, Контент, Фото и видео, Объявления, Отчётность, Другое; Исполнитель — строго из списка сотрудников; Единица — звонков / КП / ответов / публикаций / писем / встреч / документов / шт или пусто; План — число или пусто; Срок — дд.мм.гггг; Решение — вывод или решение по стратегии объекта, если прозвучал (иначе пусто). Задачу формулируй так, чтобы её можно было показать собственнику объекта.'],
    [RG, 'Регламент недели', 'Вся команда',
      'Пн — оперативка (Zoom), «Создать план недели», задачи по объектам в 02_ЗАДАЧИ.\nЕжедневно — ассистент ведёт 03_ОБЗВОН_И_КП (каждый звонок и КП — строкой, в тот же день); SMM — 04_КОНТЕНТ.\nПт — закрыть статусы задач, внести ручной факт; проверить просрочки.\nПн утром — «Отчёт клиенту» по каждому объекту → проверить → PDF клиенту.\nВ CRM переносим только реально заинтересованных (галочка «Передан в CRM»).'],
    [RG, 'Правила заполнения', 'Вся команда',
      'Один объект — одна вкладка, ID как в CRM. Аудитория в 03_ОБЗВОН_И_КП пишется так же, как во вкладке объекта. Задачи формулируем для клиента. КП партнёру — без наших контактов. Ничего не удаляем: неактуальное — статус «Отменено» / «Отказались». Формульные (серые) столбцы не трогаем.'],
    [SC, 'Письмо-рассылка по медцентрам (образец)', 'ЖК «Время», сети медцентров',
      'Здравствуйте! Предлагаю помещение для нового филиала клиники: 756 м², два этажа, метро Преображенская площадь — потолки 4,5 м, 152 кВт, 8 мокрых точек, 4 входа — соответствует требованиям СанПиН, переделка не требуется — 4000+ потенциальных пациентов в радиусе 500 м. Отправляю презентацию с планировками и расчётами. Если предложение интересно, напишите контактное лицо и телефон. Если вопрос не в вашей компетенции, перешлите письмо руководителю или директору по развитию.'],
  ];
}

function seedLibrary_() {
  const t = readTable_('LIB');
  const have = {};
  t.rows.forEach(r => { have[String(r.title).trim()] = true; });
  const cache = {};
  const add = libraryDefaults_().filter(d => !have[d[1]]).map(d => ({
    id: nextId_('LIB', cache), kind: d[0], title: d[1], applies: d[2], text: d[3], updated_at: new Date(), author: 'система',
  }));
  appendRows_('LIB', add);
  return add.length;
}

// ═════════════ 12_Utils.gs ═════════════
/**
 * 12_Utils — общие функции: доступ к листам, настройкам, чтение/запись строк, даты и недели.
 */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(code) {
  const sh = ss_().getSheetByName(SHEET_NAMES[code]);
  if (!sh) throw new Error('Нет листа ' + SHEET_NAMES[code] + '. Запустите меню «⚙ Установить / обновить систему».');
  return sh;
}

function cfgGet_(key) {
  const r = ss_().getRangeByName('CFG_' + key);
  return r ? r.getValue() : '';
}

function cfgSet_(key, v) {
  const r = ss_().getRangeByName('CFG_' + key);
  if (r) r.setValue(v);
}

function tz_() { return ss_().getSpreadsheetTimeZone() || SYS.TZ; }

function fmtDate_(d, pattern) {
  if (!(d instanceof Date)) return String(d || '');
  return Utilities.formatDate(d, tz_(), pattern || 'dd.MM.yyyy');
}

function today_() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function addDays_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

/** ISO-неделя вида 2026-W39 (та же логика, что в формулах). */
function isoWeekKey_(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return y + '-W' + (w < 10 ? '0' : '') + w;
}

function mondayOfWeekKey_(key) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(key || '').trim());
  if (!m) return null;
  const y = Number(m[1]), w = Number(m[2]);
  const jan4 = new Date(y, 0, 4);
  const dow = jan4.getDay() || 7;
  return new Date(y, 0, 4 - dow + 1 + (w - 1) * 7);
}

function mondayOf_(d) { const dow = d.getDay() || 7; return addDays_(d, 1 - dow); }

function weekPeriodLabel_(key) {
  const m = mondayOfWeekKey_(key);
  if (!m) return '';
  return fmtDate_(m, 'dd.MM') + '–' + fmtDate_(addDays_(m, 6), 'dd.MM.yyyy');
}

/** Подпись недели из справочника (как в выпадающем списке): «2026-W39 · 21.09–27.09.2026». */
function weekLabelByKey_(key) {
  const col = dictLayout_().weeks.col;
  const sh = sheet_('DICT');
  const n = sh.getLastRow();
  if (n < 2) return '';
  const vals = sh.getRange(2, col, n - 1, 4).getValues();
  const row = vals.find(r => r[0] === key);
  return row ? row[3] : '';
}

function objLabel_(id, name) { return id + ' · ' + name; }

function userEmail_(e) {
  try { if (e && e.user && e.user.getEmail) { const m = e.user.getEmail(); if (m) return m; } } catch (err) { /* нет доступа */ }
  try { const m = Session.getActiveUser().getEmail(); if (m) return m; } catch (err) { /* нет доступа */ }
  try { return Session.getEffectiveUser().getEmail() || ''; } catch (err) { return ''; }
}

/** Ответственный по email (справочник «Ответственные»), иначе пусто. */
function personByEmail_(email) {
  if (!email) return '';
  const row = dictRows_('people').find(r => String(r[2]).trim().toLowerCase() === email.toLowerCase());
  return row ? row[0] : '';
}

/** Строки справочника (только заполненные). */
function dictRows_(key) {
  const d = dictLayout_()[key];
  const sh = sheet_('DICT');
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, d.col, n - 1, d.width).getValues().filter(r => r[0] !== '');
}

function dictValues_(key) { return dictRows_(key).map(r => r[0]); }

function dictFirstByClass_(key, cls) {
  const r = dictRows_(key).find(x => x[1] === cls);
  return r ? r[0] : '';
}

function dictClassOf_(key, value) {
  const r = dictRows_(key).find(x => x[0] === value);
  return r ? r[1] : '';
}

/** Последняя строка с данными в журнале: по ручным и скриптовым столбцам (формулы не считаются). */
function lastDataRow_(sh, spec) {
  const max = sh.getMaxRows();
  const lastCol = spec.fields.length;
  const vals = sh.getRange(2, 1, max - 1, lastCol).getValues();
  const cols = [];
  spec.fields.forEach((f, i) => { if (f.kind !== 'f' && f.kind !== 'cb') cols.push(i); });
  for (let r = vals.length - 1; r >= 0; r--) {
    for (let k = 0; k < cols.length; k++) if (vals[r][cols[k]] !== '') return r + 2;
  }
  return 1;
}

/** Читает журнал в массив объектов {_row, key: value}. */
function readTable_(code) {
  const spec = sheetSpecs_()[code];
  const sh = sheet_(code);
  const last = lastDataRow_(sh, spec);
  const rows = [];
  if (last < 2) return { sh: sh, spec: spec, rows: rows };
  const vals = sh.getRange(2, 1, last - 1, spec.fields.length).getValues();
  vals.forEach((v, i) => {
    const o = { _row: i + 2 };
    spec.fields.forEach((f, j) => { o[f.key] = v[j]; });
    rows.push(o);
  });
  return { sh: sh, spec: spec, rows: rows };
}

/** Пишет значения полей строки. Формульные столбцы не трогает (иначе сломается ARRAYFORMULA). */
function writeFields_(sh, code, row, obj) {
  const spec = sheetSpecs_()[code];
  const cols = Object.keys(obj).map(k => {
    const f = fieldOf_(code, k);
    if (f.kind === 'f') throw new Error('Нельзя писать в формульный столбец ' + f.title);
    return { col: fieldIndex_(code, k), v: obj[k] };
  }).sort((a, b) => a.col - b.col);
  // группируем соседние столбцы в один вызов
  let i = 0;
  while (i < cols.length) {
    let j = i;
    while (j + 1 < cols.length && cols[j + 1].col === cols[j].col + 1) j++;
    sh.getRange(row, cols[i].col, 1, j - i + 1).setValues([cols.slice(i, j + 1).map(c => c.v)]);
    i = j + 1;
  }
  return spec;
}

/** Добавляет строку в конец журнала, возвращает номер строки. */
function appendRow_(code, obj) {
  const sh = sheet_(code);
  const spec = sheetSpecs_()[code];
  const row = lastDataRow_(sh, spec) + 1;
  if (row > sh.getMaxRows()) extendSheet_(code, 500);
  writeFields_(sh, code, row, obj);
  return row;
}

/** Следующий ID: TASK-0031, BASE-0012 … (максимум существующих + 1). */
function nextId_(code, cache) {
  const spec = sheetSpecs_()[code];
  if (cache && cache[code] !== undefined) { cache[code]++; return formatId_(spec, cache[code]); }
  const sh = sheet_(code);
  const col = fieldIndex_(code, spec.idField);
  const max = sh.getMaxRows();
  const vals = sh.getRange(2, col, max - 1, 1).getValues();
  let n = 0;
  vals.forEach(r => {
    const m = new RegExp('^' + spec.idPrefix + '(\\d+)$').exec(String(r[0]));
    if (m) n = Math.max(n, Number(m[1]));
  });
  n++;
  if (cache) cache[code] = n;
  return formatId_(spec, n);
}

function formatId_(spec, n) {
  const s = String(n);
  return spec.idPrefix + (s.length < spec.idPad ? '0'.repeat(spec.idPad - s.length) : '') + s;
}

/** Добавляет строки в журнал и растягивает на них списки/чекбоксы/форматы. */
function extendSheet_(code, n) {
  const sh = sheet_(code);
  const spec = sheetSpecs_()[code];
  const before = sh.getMaxRows();
  sh.insertRowsAfter(before, n);
  applyColumnRules_(sh, spec, before + 1, n);
}

/** Повторно применяет проверки и форматы к диапазону строк (после добавления строк). */
function applyColumnRules_(sh, spec, fromRow, n) {
  spec.fields.forEach((f, i) => {
    const r = sh.getRange(fromRow, i + 1, n, 1);
    const fmt = f.fmt || ({ date: 'date', money: 'money' })[f.kind];
    if (fmt) r.setNumberFormat(nf_(fmt));
    const v = validationFor_(f);
    if (v) r.setDataValidation(v);
    if (f.kind === 'f') r.setBackground(COLORS.FORMULA_CELL_BG);
  });
}

/** Запись в 09_ИСТОРИЯ. entries: [{sheet, record_id, obj_id, field, old, new, kind, note}] */
function logHistory_(entries, user) {
  if (!entries.length) return;
  const sh = sheet_('HIST');
  const spec = sheetSpecs_().HIST;
  let row = lastDataRow_(sh, spec) + 1;
  if (row + entries.length > sh.getMaxRows()) extendSheet_('HIST', Math.max(500, entries.length));
  const now = new Date();
  const values = entries.map(e => [now, user || '', e.sheet, e.record_id || '', e.obj_id || '', e.field, e.old === undefined ? '' : e.old, e.new === undefined ? '' : e.new, e.kind, e.note || '']);
  sh.getRange(row, 1, values.length, values[0].length).setValues(values);
}

/** URL → ID файла/папки Google Drive. */
function idFromUrl_(url) {
  const m = /[-\w]{25,}/.exec(String(url || ''));
  return m ? m[0] : '';
}

/** Выбранный объект: вкладка объекта, строка листа с ID объекта, строка дэшборда, иначе выбор в 05_ОТЧЁТ_КЛИЕНТУ. */
function selectedObjectId_() {
  const sh = SpreadsheetApp.getActiveSheet();
  const spec = specBySheetName_(sh.getName());
  const row = sh.getActiveRange() ? sh.getActiveRange().getRow() : 0;
  if (spec && row >= 2) {
    const key = spec.code === 'OBJ' ? 'id' : (spec.fields.some(f => f.key === 'obj_id') ? 'obj_id' : null);
    if (key) {
      const v = sh.getRange(row, fieldIndex_(spec.code, key)).getValue();
      if (v) return String(v);
    }
  }
  if (sh.getName() === SHEET_NAMES.DASH && row >= DASH.OBJ_FIRST && row <= DASH.OBJ_LAST) {
    const v = sh.getRange(row, 2).getValue();
    if (v) return String(v);
  }
  if (isObjectTab_(sh)) {
    const v = sh.getRange(TAB.ID).getValue();
    if (v) return String(v);
  }
  const rep = sheet_('REP').getRange('E3').getValue();
  return rep ? String(rep) : '';
}

function objectById_(id) {
  const t = readTable_('OBJ');
  return t.rows.find(r => r.id === id) || null;
}

function toast_(msg, title, sec) { ss_().toast(msg, title || SYS.MENU, sec || 5); }

function htmlEscape_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Диалог со ссылками (Apps Script не умеет сам открыть вкладку — пробуем window.open и даём ссылку). */
function showLinks_(title, links, text) {
  const items = links.map(l => '<li><a href="' + htmlEscape_(l.url) + '" target="_blank">' + htmlEscape_(l.label) + '</a></li>').join('');
  const auto = links.length === 1 ? '<script>window.open(' + JSON.stringify(links[0].url) + ',"_blank");</script>' : '';
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
    (text ? '<p>' + htmlEscape_(text).replace(/\n/g, '<br>') + '</p>' : '') +
    '<ul>' + items + '</ul></div>' + auto).setWidth(520).setHeight(120 + 30 * links.length + (text ? 60 : 0));
  SpreadsheetApp.getUi().showModalDialog(html, title);
}

// ═════════════ 13_Menu.gs ═════════════
/**
 * 13_Menu — меню «МАРКЕТИНГ ОБЪЕКТОВ».
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(SYS.MENU)
    .addItem('➜ Открыть вкладку объекта', 'openObjectTab')
    .addItem('➜ Создать вкладки для новых объектов', 'createObjectTabs')
    .addSeparator()
    .addItem('➜ Создать план недели', 'createWeekPlan')
    .addItem('➜ Внести задачи с оперативки', 'importMeetingTasks')
    .addItem('➜ Проверить просрочки', 'checkOverdue')
    .addItem('➜ Синхронизировать задачи с календарём', 'syncCalendar')
    .addSeparator()
    .addItem('➜ Промпт для Claude по объекту', 'promptForObject')
    .addItem('➜ Обновить статистику соцсетей', 'refreshSocialStats')
    .addItem('➜ Отправить отмеченные в CRM', 'crmSendPending')
    .addSeparator()
    .addItem('➜ Создать отчёт клиенту', 'createReport')
    .addItem('➜ Обновить PDF отчёта', 'createPdf')
    .addSeparator()
    .addItem('➜ Дэшборд', 'openDashboard')
    .addItem('➜ Обновить (ID, вкладки, строки)', 'refreshAll')
    .addSeparator()
    .addSubMenu(ui.createMenu('Сервис')
      .addItem('⚙ Установить / обновить систему', 'setupSystem')
      .addItem('Обновить все вкладки объектов', 'rebuildObjectTabs')
      .addItem('Подключить Instagram / Threads', 'connectSocial')
      .addItem('Подключить CRM TopenLab', 'connectCrm')
      .addItem('Включить ежедневное обновление (календарь, соцсети)', 'enableDailyJobs')
      .addItem('Выключить ежедневное обновление', 'disableDailyJobs')
      .addSeparator()
      .addItem('Загрузить пример (ЖК Время · Лермонтовская 1)', 'loadExampleData')
      .addItem('Запустить самопроверку', 'runSelfTest')
      .addItem('О системе', 'aboutSystem'))
    .addToUi();
}

function aboutSystem() {
  SpreadsheetApp.getUi().alert(SYS.TITLE + ' v' + SYS.VERSION,
    'Не CRM: клиенты, показы и сделки — в CRM. Здесь — маркетинговая стратегия и работа команды по каждому эксклюзиву.\n\n' +
    '• 01_ОБЪЕКТЫ — реестр; у каждого объекта своя вкладка «▸ Название (ID)» со стратегией: аналитика и цена → сценарии → аудитории → КП → каналы → решения.\n' +
    '• 02_ЗАДАЧИ — план-факт по неделям; 03_ОБЗВОН_И_КП — работа ассистента с базой; 04_КОНТЕНТ — публикации SMM.\n' +
    '• 00_ДЭШБОРД, 05_ОТЧЁТ_КЛИЕНТУ и разделы 8–9 вкладок считаются сами.\n' +
    '• 06_БИБЛИОТЕКА — чек-листы, промпты, регламенты. 09_ИСТОРИЯ — кто что изменил.\n\n' +
    'Цвет заголовка: тёмный — вводится вручную; серо-голубой — формула; светло-серый — заполняет скрипт.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ═════════════ 14_Prompts.gs ═════════════
/**
 * 14_Prompts — работа с Claude через подписку (без API и без доплат):
 *  - «Промпт для Claude по объекту»: промпт из 06_БИБЛИОТЕКА + данные вкладки объекта одним текстом → скопировать в claude.ai;
 *  - «Внести задачи с оперативки»: таблица задач (из Claude или из протокола) → строки 02_ЗАДАЧИ + решения во вкладки объектов.
 * Кнопка «Спросить Claude» с API-ключом — отдельный этап (отложен).
 */

const MEETING_COLS = ['ID объекта', 'Блок стратегии', 'Задача', 'Исполнитель', 'Единица', 'План', 'Срок', 'Решение'];

// ───────────────────────── промпт по объекту ─────────────────────────

function promptForObject() {
  const id = selectedObjectId_();
  const obj = id ? objectById_(id) : null;
  const prompts = readTable_('LIB').rows.filter(r => r.kind === 'Промпт' && r.title);
  if (!prompts.length) { SpreadsheetApp.getUi().alert('В 06_БИБЛИОТЕКА нет промптов (раздел «Промпт»).'); return; }
  const options = prompts.map(p => '<option value="' + htmlEscape_(p.id) + '">' + htmlEscape_(p.title) + '</option>').join('');
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div>Объект: <b>' + htmlEscape_(obj ? obj.name + ' (' + obj.id + ')' : 'не выбран — промпт без данных объекта') + '</b></div>' +
    '<div style="margin:8px 0">Промпт: <select id="p" style="max-width:420px">' + options + '</select></div>' +
    '<textarea id="t" style="width:100%;height:330px;font:12px monospace"></textarea>' +
    '<div style="margin-top:8px"><button onclick="copyIt()">Скопировать</button> ' +
    '<a href="https://claude.ai/new" target="_blank">Открыть Claude</a> <span id="s" style="color:#2E7D32"></span></div>' +
    '<div style="color:#80868B;font-size:12px;margin-top:6px">Вставьте текст в Claude (ваша подписка). Ответ перенесите в нужный раздел вкладки объекта. Использование промпта записывается в 09_ИСТОРИЯ.</div></div>' +
    '<script>' +
    'const objId=' + JSON.stringify(obj ? obj.id : '') + ';' +
    'function load(){document.getElementById("t").value="Собираю…";google.script.run.withSuccessHandler(function(x){document.getElementById("t").value=x;}).withFailureHandler(function(e){document.getElementById("t").value="Ошибка: "+e.message;}).getPromptText(objId,document.getElementById("p").value);}' +
    'function copyIt(){const t=document.getElementById("t");t.select();try{navigator.clipboard.writeText(t.value);}catch(e){document.execCommand("copy");}document.getElementById("s").textContent="Скопировано";}' +
    'document.getElementById("p").onchange=load;load();' +
    '</script>').setWidth(620).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Промпт для Claude');
}

/** Вызывается из диалога: текст промпта с данными объекта. */
function getPromptText(objId, libId) {
  const p = readTable_('LIB').rows.find(r => r.id === libId);
  if (!p) throw new Error('Промпт не найден');
  const obj = objId ? objectById_(objId) : null;
  let text = String(p.text || '');
  text = text.replace(/\{объекты\}/g, readTable_('OBJ').rows.filter(o => o.id && o.name && o.in_work !== 'НЕТ').map(o => o.id + ' — ' + o.name).join('; '));
  text = text.replace(/\{сотрудники\}/g, dictValues_('people').join(', '));
  if (obj) text = text.replace(/\{(?!текст\})[^{}]{2,80}\}/g, '(см. «Данные объекта» ниже)');
  const out = text + (obj ? '\n\n' + objectContext_(obj) : '');
  logHistory_([{ sheet: 'Claude (подписка)', record_id: p.id, obj_id: obj ? obj.id : '', field: 'Промпт: ' + p.title, old: '', new: 'сформирован для копирования', kind: 'Промпт' }], userEmail_());
  return out;
}

/** Данные объекта текстом: реестр + то, что внесено во вкладку. */
function objectContext_(obj) {
  const L = [];
  const v = x => (x instanceof Date ? fmtDate_(x) : String(x === null || x === undefined ? '' : x)).trim();
  L.push('=== ДАННЫЕ ОБЪЕКТА ===');
  [['Объект', obj.name], ['Адрес', obj.address], ['Тип', obj.kind], ['Сделка', obj.deal], ['Площадь, м²', obj.area],
    ['Цена, ₽', obj.price], ['Цена за м², ₽', obj.price_m2], ['Статус', obj.status]].forEach(p => { if (v(p[1])) L.push(p[0] + ': ' + v(p[1])); });
  const tab = findObjectTab_(obj);
  if (tab) {
    const d = readObjectTab_(tab);
    const secs = objTabSections_();
    secs.forEach(s => {
      if (s.type === 'kv') {
        const lines = s.items.filter(i => i.k !== 'f' && i.k !== 'link' && v(d.kv[i.key])).map(i => i.label + ': ' + v(d.kv[i.key]));
        if (lines.length) { L.push('', s.title); L.push.apply(L, lines); }
      }
      if (s.type === 'table' && d.tables[s.key] && d.tables[s.key].length) {
        const idx = s.cols.map((c, i) => (c.k === 'f' || c.k === 'link') ? -1 : i).filter(i => i >= 0);
        L.push('', s.title, idx.map(i => s.cols[i].t).join(' | '));
        d.tables[s.key].forEach(r => L.push(idx.map(i => v(r[i])).join(' | ')));
      }
    });
  }
  return L.join('\n');
}

// ───────────────────────── оперативка → задачи ─────────────────────────

function importMeetingTasks() {
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div>Вставьте таблицу задач — ответ Claude по промпту «Оперативка → задачи» или строки из протокола (столбцы через «|» или табуляцию):</div>' +
    '<div style="color:#80868B;font-size:12px;margin:4px 0">' + MEETING_COLS.join(' | ') + '</div>' +
    '<textarea id="t" style="width:100%;height:250px;font:12px monospace"></textarea>' +
    '<div style="margin-top:8px"><button onclick="prev()">Проверить</button> <button id="go" onclick="go()" disabled>Внести задачи</button></div>' +
    '<div id="r" style="margin-top:8px;font-size:12px;max-height:150px;overflow:auto"></div></div>' +
    '<script>' +
    'function esc(s){return String(s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}' +
    'function prev(){google.script.run.withSuccessHandler(function(x){var h="Задач: <b>"+x.ok.length+"</b>"+(x.ok.length?"<ul>"+x.ok.map(function(o){return "<li>"+esc(o.obj_id+": "+o.task+" — "+(o.owner||"без исполнителя")+", срок "+o.deadlineText+(o.decision?" · решение":""))+"</li>";}).join("")+"</ul>":"");' +
    'if(x.errors.length)h+="<div style=\\"color:#B71C1C\\">Пропущено:<br>"+x.errors.map(esc).join("<br>")+"</div>";document.getElementById("r").innerHTML=h;document.getElementById("go").disabled=!x.ok.length;}).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).previewMeetingTasks(document.getElementById("t").value);}' +
    'function go(){document.getElementById("go").disabled=true;google.script.run.withSuccessHandler(function(m){document.getElementById("r").innerHTML="<b>"+esc(m)+"</b>";}).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).addMeetingTasks(document.getElementById("t").value);}' +
    '</script>').setWidth(680).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Задачи с оперативки');
}

function previewMeetingTasks(text) {
  const r = parseMeetingTasks_(text);
  return { ok: r.ok.map(o => ({ obj_id: o.obj_id, task: o.task, owner: o.owner, deadlineText: o.deadline ? fmtDate_(o.deadline) : 'пятница текущей недели', decision: !!o.decision })), errors: r.errors };
}

function addMeetingTasks(text) {
  const r = parseMeetingTasks_(text);
  if (!r.ok.length) return 'Нет задач для внесения.';
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const cache = {};
    const openName = dictFirstByClass_('task_status', CLS.OPEN);
    const user = userEmail_();
    const today = today_();
    const rows = r.ok.filter(o => o.task).map(o => {
      const deadline = o.deadline || addDays_(mondayOf_(today), 4);
      return {
        id: nextId_('TASK', cache), week: isoWeekKey_(deadline), obj_id: o.obj_id, block: o.block, task: o.task, owner: o.owner,
        unit: o.unit, plan: o.plan, deadline: deadline, status: openName, to_report: true, source: 'Оперативка', created_at: new Date(), author: user,
      };
    });
    appendRows_('TASK', rows);
    let dec = 0;
    const hist = [];
    r.ok.filter(o => o.decision).forEach(o => {
      const obj = objectById_(o.obj_id);
      const tab = obj ? findObjectTab_(obj) : null;
      if (!tab) return;
      appendTabRow_(tab, 'DEC', [today, o.decision, o.owner || '', o.task || '']);
      hist.push({ sheet: tab.getName(), record_id: 'раздел 7', obj_id: o.obj_id, field: '7. ВЫВОДЫ И РЕШЕНИЯ · с оперативки', old: '', new: o.decision, kind: HIST_KIND.CREATE });
      dec++;
    });
    logHistory_(hist, user);
    return 'Внесено задач: ' + rows.length + (dec ? ', решений во вкладки объектов: ' + dec : '') + (r.errors.length ? '. Пропущено строк: ' + r.errors.length : '') + '.';
  } finally {
    lock.releaseLock();
  }
}

/** Разбор таблицы: «|»-таблица (markdown) или строки через табуляцию. */
function parseMeetingTasks_(text) {
  const objs = readTable_('OBJ').rows.filter(o => o.id);
  const people = dictValues_('people');
  const blocks = dictValues_('task_blocks');
  const units = dictValues_('units');
  const ok = [], errors = [];
  const norm = s => String(s || '').trim().toLowerCase();
  String(text || '').split(/\r?\n/).forEach((line, n) => {
    if (!line.trim() || /^\s*\|?\s*:?-{2,}/.test(line)) return;
    let cells = line.indexOf('\t') >= 0 ? line.split('\t') : line.split('|');
    if (line.indexOf('\t') < 0 && line.trim()[0] === '|') cells = cells.slice(1, line.trim().slice(-1) === '|' ? -1 : undefined);
    cells = cells.map(c => c.trim());
    if (cells.length < 3) return;
    if (/id объекта|^задача$/i.test(cells[0]) || norm(cells[2]) === 'задача') return; // заголовок
    const [rawObj, rawBlock, task, rawOwner, rawUnit, rawPlan, rawDate, decision] = cells.concat(['', '', '', '', '', '', '', '']);
    const obj = objs.find(o => norm(o.id) === norm(rawObj)) || objs.find(o => norm(o.name) === norm(rawObj)) ||
      objs.find(o => norm(rawObj) && norm(o.name).indexOf(norm(rawObj)) >= 0);
    if (!obj) { errors.push('Строка ' + (n + 1) + ': объект «' + rawObj + '» не найден в 01_ОБЪЕКТЫ'); return; }
    if (!task && !decision) { errors.push('Строка ' + (n + 1) + ': нет задачи'); return; }
    const owner = people.find(p => norm(p) === norm(rawOwner)) || '';
    if (rawOwner && !owner) errors.push('Строка ' + (n + 1) + ': исполнитель «' + rawOwner + '» не из 07_СПРАВОЧНИКИ — задача внесена без исполнителя');
    const plan = rawPlan && !isNaN(Number(String(rawPlan).replace(',', '.'))) ? Number(String(rawPlan).replace(',', '.')) : '';
    ok.push({
      obj_id: obj.id, task: task, owner: owner, plan: plan, decision: decision || '',
      block: blocks.find(b => norm(b) === norm(rawBlock)) || (blocks.indexOf('Другое') >= 0 ? 'Другое' : ''),
      unit: units.find(u => norm(u) === norm(rawUnit)) || '',
      deadline: parseRuDate_(rawDate),
    });
  });
  return { ok: ok, errors: errors };
}

/** «25.09.2026», «25.09.26», «25.09» → дата. */
function parseRuDate_(s) {
  const m = /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/.exec(String(s || ''));
  if (!m) return null;
  const t = today_();
  let y = m[3] ? Number(m[3]) : t.getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

/** Добавляет строку в табличный раздел вкладки: в первую пустую строку, иначе вставляет новую в конец раздела. */
function appendTabRow_(sh, secKey, values) {
  const max = sh.getLastRow();
  const marks = sh.getRange(1, 1, max, 2).getValues();
  let inSec = false, inData = false, firstEmpty = 0, lastData = 0;
  for (let r = 0; r < marks.length; r++) {
    const m = String(marks[r][0] || '');
    if (m.indexOf('§') === 0) { if (inSec) break; inSec = m === '§' + secKey; inData = false; continue; }
    if (!inSec) continue;
    if (m === 'H') { inData = true; continue; }
    if (m === '·') break;
    if (inData) {
      lastData = r + 1;
      if (!firstEmpty && String(marks[r][1]) === '') firstEmpty = r + 1;
    }
  }
  if (!lastData) throw new Error('Раздел ' + secKey + ' не найден во вкладке ' + sh.getName());
  let row = firstEmpty;
  if (!row) { sh.insertRowAfter(lastData); row = lastData + 1; }
  sh.getRange(row, 2, 1, values.length).setValues([values]);
  return row;
}

// ═════════════ 15_Calendar.gs ═════════════
/**
 * 15_Calendar — задачи 02_ЗАДАЧИ в Google Календаре.
 *
 * Событие на весь день в дату «Срок» создаётся в календаре того, кто запускает синхронизацию
 * (руководителя), исполнитель получает приглашение на свой email из 07_СПРАВОЧНИКИ.
 * Выполнено → в названии «✓»; Отменено / Перенесено → событие удаляется (у копии-переноса — своё событие).
 * Изменили срок или исполнителя → событие обновляется. Обрабатываются задачи со сроком не старше 14 дней.
 */

function syncCalendar() {
  const r = syncCalendar_();
  toast_('Календарь: создано ' + r.created + ', обновлено ' + r.updated + ', удалено ' + r.deleted +
    (r.noEmail.length ? '. Нет email у: ' + r.noEmail.join(', ') + ' (07_СПРАВОЧНИКИ)' : ''), 'Google Календарь', 10);
}

function syncCalendar_() {
  const t = readTable_('TASK');
  const cal = CalendarApp.getDefaultCalendar();
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const emails = {};
  dictRows_('people').forEach(p => { emails[p[0]] = String(p[2] || '').trim(); });
  const url = ss_().getUrl();
  const from = addDays_(today_(), -14);
  const res = { created: 0, updated: 0, deleted: 0, noEmail: [] };
  t.rows.forEach(o => {
    if (!o.obj_id || !o.task) return;
    const cls = o.status ? dictClassOf_('task_status', o.status) : CLS.OPEN;
    let ev = null;
    if (o.cal_event) { try { ev = cal.getEventById(o.cal_event); } catch (e) { ev = null; } }
    if (cls === CLS.CANCEL || cls === CLS.MOVED) {
      if (ev) { ev.deleteEvent(); res.deleted++; }
      if (o.cal_event) writeFields_(t.sh, 'TASK', o._row, { cal_event: '' });
      return;
    }
    if (!(o.deadline instanceof Date) || o.deadline < from) return;
    const email = emails[o.owner] || '';
    if (o.owner && !email && res.noEmail.indexOf(o.owner) < 0) res.noEmail.push(o.owner);
    const title = (cls === CLS.DONE ? '✓ ' : '') + o.obj_name + ': ' + o.task + (o.plan !== '' ? ' (' + o.plan + (o.unit ? ' ' + o.unit : '') + ')' : '');
    const desc = 'Задача ' + o.id + ' · исполнитель: ' + (o.owner || '—') + '\nСтатус: ' + (o.status || '—') + '\nТаблица: ' + url;
    const guest = email && email.toLowerCase() !== me ? email : '';
    if (!ev) {
      if (cls === CLS.DONE) return; // уже выполненные в календарь не добавляем
      ev = cal.createAllDayEvent(title, o.deadline, { description: desc, guests: guest, sendInvites: !!guest });
      writeFields_(t.sh, 'TASK', o._row, { cal_event: ev.getId() });
      res.created++;
      return;
    }
    let changed = false;
    if (ev.getTitle() !== title) { ev.setTitle(title); changed = true; }
    if (ev.getDescription() !== desc) { ev.setDescription(desc); changed = true; }
    const start = ev.getAllDayStartDate();
    if (!start || start.getTime() !== o.deadline.getTime()) { ev.setAllDayDate(o.deadline); changed = true; }
    const guests = ev.getGuestList().map(g => g.getEmail().toLowerCase());
    guests.forEach(g => { if (g !== (guest || '').toLowerCase()) { ev.removeGuest(g); changed = true; } });
    if (guest && guests.indexOf(guest.toLowerCase()) < 0) { ev.addGuest(guest); changed = true; }
    if (changed) res.updated++;
  });
  return res;
}

// ───────────────────────── ежедневное обновление ─────────────────────────

/** Каждое утро: календарь + статистика Instagram / Threads / Telegram / YouTube. */
function dailyJobs() {
  try { syncCalendar_(); } catch (e) { Logger.log('Календарь: ' + e.message); }
  try { refreshSocialStats_(); } catch (e) { Logger.log('Статистика: ' + e.message); }
}

function enableDailyJobs() {
  disableDailyJobs_();
  ScriptApp.newTrigger('dailyJobs').timeBased().everyDays(1).atHour(7).create();
  toast_('Каждое утро (около 7:00) задачи синхронизируются с календарём, статистика соцсетей обновляется.', 'Ежедневное обновление', 8);
}

function disableDailyJobs() {
  disableDailyJobs_();
  toast_('Ежедневное обновление выключено.', 'Ежедневное обновление', 5);
}

function disableDailyJobs_() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'dailyJobs') ScriptApp.deleteTrigger(t); });
}

// ═════════════ 16_Social.gs ═════════════
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
  toast_((r.imported ? 'Новых постов Threads в 04_КОНТЕНТ: ' + r.imported + '. ' : '') +
    (r.unmatched ? 'Постов Threads без объекта (не добавлены): ' + r.unmatched + '. ' : '') +
    'Обновлено: Instagram ' + r.ig + ', Threads ' + r.th + ', Telegram ' + r.tg + ', YouTube ' + r.yt +
    (r.igOff && r.igLinks ? '. Instagram не подключён (Сервис → Подключить Instagram / Threads)' : '') +
    (r.thOff && r.thLinks ? '. Threads не подключён' : '') +
    (r.notFound ? '. Не найдены в аккаунте: ' + r.notFound + ' ссылок' : '') +
    (r.ytOff ? '. YouTube не подключён: редактор Apps Script → Сервисы ＋ → YouTube Data API v3' : '') +
    (r.failed ? '. Не удалось: ' + r.failed : ''), 'Статистика контента', 10);
}

function refreshSocialStats_() {
  let imported = null;
  try { imported = importThreadsPosts_(); } catch (e) { Logger.log('Импорт Threads: ' + e.message); }
  const t = readTable_('CONT');
  const res = { imported: imported ? imported.added : 0, unmatched: imported ? imported.unmatched : 0, tg: 0, yt: 0, ig: 0, th: 0, failed: 0, notFound: 0, ytOff: false, igOff: false, thOff: false, igLinks: 0, thLinks: 0 };
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

// ───────────────────────── посты Threads-бота → 04_КОНТЕНТ ─────────────────────────

/**
 * Новые посты аккаунта Threads (за 60 дней, без ответов и продолжений цепочек) добавляются в 04_КОНТЕНТ,
 * если в тексте узнаётся объект: название (или часть до «·»), улица из адреса, ID. Посты без объекта не добавляются.
 * Уже внесённые ссылки не дублируются. Объект у строки можно поправить вручную.
 */
function importThreadsPosts_() {
  const tok = socialToken_('TH');
  if (!tok) return null;
  const since = Date.now() - 60 * 86400000;
  const have = {};
  const t = readTable_('CONT');
  t.rows.forEach(o => { const c = threadsCode_(String(o.link || '')); if (c) have[c] = true; });
  const match = objectMatcher_();
  const add = [];
  let unmatched = 0;
  let url = TH_API + '/me/threads?fields=id,permalink,text,timestamp,media_type,is_reply&limit=100&access_token=' + encodeURIComponent(tok);
  let pages = 0;
  while (url && pages++ < 3) {
    const r = metaGet_(url);
    if (r.error) throw new Error(r.error.message || 'ошибка Threads API');
    let old = false;
    (r.data || []).forEach(m => {
      const ts = parseMetaTime_(m.timestamp);
      if (ts && ts.getTime() < since) { old = true; return; }
      if (m.is_reply) return;
      const code = threadsCode_(String(m.permalink || ''));
      if (!code || have[code]) return;
      const obj = match(String(m.text || ''));
      if (!obj) { unmatched++; return; }
      have[code] = true;
      const text = String(m.text || '').trim();
      add.push({
        obj_id: obj.id, topic: text.split(/\n/)[0].slice(0, 120), platform: 'Threads',
        format: m.media_type === 'CAROUSEL_ALBUM' ? 'Карусель' : 'Пост', goal: 'Найти покупателя / арендатора',
        script: text.slice(0, 1500), status: dictFirstByClass_('content_status', CLS.DONE) || 'Опубликовано',
        pub_date: ts ? new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()) : '', link: m.permalink, owner: obj.smm || '',
        created_at: new Date(), author: 'Threads (автоимпорт)',
      });
    });
    url = !old && r.paging && r.paging.next ? r.paging.next : '';
  }
  if (add.length) {
    const cache = {};
    add.forEach(a => { a.id = nextId_('CONT', cache); });
    appendRows_('CONT', add);
  }
  return { added: add.length, unmatched: unmatched };
}

/** «2026-09-26T05:30:00+0000» → Date. */
function parseMetaTime_(s) {
  if (!s) return null;
  const d = new Date(String(s).replace(/([+-]\d\d)(\d\d)$/, '$1:$2'));
  return isNaN(d.getTime()) ? null : d;
}

/** Функция «текст → объект» по названию, частям названия, улице из адреса и ID. Неоднозначно — null. */
function objectMatcher_() {
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”]/g, '');
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && o.in_work !== 'НЕТ').map(o => {
    const keys = [];
    const name = norm(o.name);
    keys.push(name);
    name.split(/[·|,()\/]/).map(x => x.trim()).filter(x => x.length >= 5).forEach(x => keys.push(x));
    const street = /(?:ул\.?|улица|пр-т|проспект|шоссе|пер\.?|переулок|бульвар|б-р|наб\.?)\s*([а-яa-z\-]{5,})/i.exec(norm(o.address));
    if (street) keys.push(street[1]);
    if (String(o.id).length >= 4) keys.push(norm(o.id));
    return { o: o, keys: keys.filter((k, i, a) => k && a.indexOf(k) === i) };
  });
  return text => {
    const tx = norm(text);
    let best = null, bestScore = 0, tie = false;
    objs.forEach(x => {
      const score = x.keys.filter(k => tx.indexOf(k) >= 0).length;
      if (score > bestScore) { best = x.o; bestScore = score; tie = false; } else if (score && score === bestScore) tie = true;
    });
    return bestScore && !tie ? best : null;
  };
}

// ═════════════ 17_Crm.gs ═════════════
/**
 * 17_Crm — связь с CRM TopenLab (публичный API agencies-p.topnlab.ru/public).
 *
 * Когда ассистент ставит в 03_ОБЗВОН_И_КП галочку «Передан в CRM», скрипт ищет карточку в TopenLab
 * по телефону из «Контакт» (сначала среди заявок, потом среди объектов) и добавляет в неё заметку:
 * объект, компания, аудитория, звонок, КП, ответ, следующий шаг, кто ведёт.
 * API TopenLab не умеет создавать карточки — поэтому сначала заводим клиента в CRM (с этим телефоном),
 * потом ставим галочку. Результат пишется в столбец «CRM».
 * Ключ API и ID пользователя-автора заметок хранятся в свойствах скрипта («Сервис → Подключить CRM TopenLab»).
 * Ограничение API: поиск не чаще 1 раза в 6 секунд — при массовой отметке используйте «Отправить отмеченные в CRM».
 */

const CRM_BASE_DEFAULT = 'https://agencies-p.topnlab.ru/public';
const CRM_TYPES = [['order', 'заявка'], ['realty', 'объект']];
const CRM_ONEDIT_LIMIT = 2; // сколько строк отправлять сразу при правке (остальные — через меню)

function crmConfig_() {
  const p = PropertiesService.getScriptProperties();
  return { key: p.getProperty('TOPNLAB_KEY') || '', user: p.getProperty('TOPNLAB_USER_ID') || '', base: p.getProperty('TOPNLAB_BASE') || CRM_BASE_DEFAULT };
}

/** Телефон из свободного текста → 7XXXXXXXXXX (первый найденный российский номер). */
function phoneFromText_(text) {
  const m = /(?:\+7|8|7)[\s\-(]*\d{3}[\s\-)]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/.exec(String(text || ''));
  if (!m) return '';
  const d = m[0].replace(/\D/g, '');
  return d.length === 11 ? '7' + d.slice(1) : '';
}

function crmNoteText_(o) {
  const d = x => x instanceof Date ? fmtDate_(x) : '';
  const obj = objectById_(o.obj_id);
  return [
    'Система маркетинга эксклюзивов: интерес по объекту ' + (obj ? obj.name + ' (' + obj.id + ')' : o.obj_id) + '.',
    'Компания: ' + o.company + (o.audience ? ' (' + o.audience + ')' : '') + (o.site ? ', ' + o.site : '') + '.',
    o.call_date ? 'Звонок ' + d(o.call_date) + (o.call_result ? ': ' + o.call_result : '') + '.' : '',
    o.kp_date ? 'КП ' + d(o.kp_date) + (o.kp_type ? ' (' + o.kp_type + ')' : '') + '.' : '',
    o.response ? 'Ответ: ' + o.response + (o.response_date ? ' ' + d(o.response_date) : '') + '.' : '',
    o.next_step ? 'Следующий шаг: ' + o.next_step + (o.next_date ? ' до ' + d(o.next_date) : '') + '.' : '',
    o.owner ? 'Вёл: ' + o.owner + '.' : '',
  ].filter(Boolean).join('\n');
}

/** Отправка одной строки 03. Возвращает текст для столбца «CRM». */
function crmSendRow_(o, cfg) {
  const phone = phoneFromText_(o.contact);
  if (!phone) return '⚠ нет телефона в «Контакт»';
  for (let i = 0; i < CRM_TYPES.length; i++) {
    const type = CRM_TYPES[i][0];
    crmThrottle_();
    const r = UrlFetchApp.fetch(cfg.base + '/get-entities?phone=' + phone + '&type=' + type + '&key=' + encodeURIComponent(cfg.key), { muteHttpExceptions: true });
    const code = r.getResponseCode();
    if (code === 404) continue;
    if (code >= 400) return '⚠ ошибка CRM ' + code;
    let data;
    try { data = JSON.parse(r.getContentText()); } catch (e) { return '⚠ ответ CRM не распознан'; }
    const ent = data && typeof data === 'object' ? data[Object.keys(data)[0]] : null;
    if (!ent || !ent.id) continue;
    if (!cfg.user) return '✓ найдена ' + CRM_TYPES[i][1] + ' ' + ent.id + ' (заметки выключены: нет ID автора)';
    const w = UrlFetchApp.fetch(cfg.base + '/set-note', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ key: cfg.key, id: ent.id, type: type, note: crmNoteText_(o), user_id: Number(cfg.user) || cfg.user }),
    });
    let ok = false;
    try { const j = JSON.parse(w.getContentText()); ok = w.getResponseCode() < 400 && (j.status === 'success' || j.status === 'ok'); } catch (e) { ok = false; }
    return ok ? '✓ заметка ' + fmtDate_(new Date()) + ' · ' + CRM_TYPES[i][1] + ' ' + ent.id : '⚠ заметка не добавлена (' + w.getResponseCode() + ')';
  }
  return '⚠ карточки с телефоном ' + phone + ' нет — заведите в CRM';
}

/** API: поиск не чаще 1 раза в 6 секунд. */
function crmThrottle_() {
  const p = PropertiesService.getScriptProperties();
  const last = Number(p.getProperty('TOPNLAB_LAST') || 0);
  const wait = last + 6100 - Date.now();
  if (wait > 0) Utilities.sleep(wait);
  p.setProperty('TOPNLAB_LAST', String(Date.now()));
}

/** Из onEdit: строки с только что поставленной галочкой (не больше CRM_ONEDIT_LIMIT). */
function crmOnEdit_(sh, rows) {
  const cfg = crmConfig_();
  if (!cfg.key || !rows.length) return;
  rows.slice(0, CRM_ONEDIT_LIMIT).forEach(o => writeFields_(sh, 'BASE', o._row, { crm_note: crmSendRow_(o, cfg) }));
  if (rows.length > CRM_ONEDIT_LIMIT) {
    rows.slice(CRM_ONEDIT_LIMIT).forEach(o => writeFields_(sh, 'BASE', o._row, { crm_note: '… ждёт: меню «Отправить отмеченные в CRM»' }));
  }
}

/** Меню: все строки с галочкой, по которым заметка ещё не добавлена. */
function crmSendPending() {
  const cfg = crmConfig_();
  if (!cfg.key) { SpreadsheetApp.getUi().alert('CRM не подключена: Сервис → Подключить CRM TopenLab.'); return; }
  const t = readTable_('BASE');
  const rows = t.rows.filter(o => o.to_crm === true && String(o.crm_note).indexOf('✓') !== 0);
  if (!rows.length) { toast_('Нет отмеченных строк без заметки.', 'CRM'); return; }
  const start = Date.now();
  let n = 0;
  for (let i = 0; i < rows.length; i++) {
    if (Date.now() - start > 4.5 * 60000) break; // лимит выполнения скрипта — остальное следующим запуском
    writeFields_(t.sh, 'BASE', rows[i]._row, { crm_note: crmSendRow_(rows[i], cfg) });
    n++;
  }
  toast_('Обработано: ' + n + ' из ' + rows.length + (n < rows.length ? '. Запустите ещё раз для остальных.' : ''), 'CRM', 8);
}

function connectCrm() {
  const c = crmConfig_();
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<p>Ключ API TopenLab и ID пользователя, от имени которого публикуются заметки (Настройки системы → Пользователи). ' +
    'Хранятся в свойствах скрипта, в таблице не видны. Пустое поле — оставить как есть.</p>' +
    '<p>Статус: <b id="s">' + (c.key ? 'подключена' + (c.user ? ', автор заметок ' + htmlEscape_(c.user) : ', без автора заметок') : 'не подключена') + '</b></p>' +
    '<p>Ключ API:<br><input id="k" style="width:100%"></p>' +
    '<p>ID пользователя-автора заметок:<br><input id="u" style="width:100%" value="' + htmlEscape_(c.user) + '"></p>' +
    '<p>Телефон существующей карточки для проверки (необязательно):<br><input id="p" style="width:100%" placeholder="+7 925 …"></p>' +
    '<button onclick="save()">Сохранить и проверить</button> <button onclick="off()">Отключить</button><div id="r" style="margin-top:10px"></div></div><script>' +
    'function done(x){document.getElementById("r").textContent=x.msg;document.getElementById("s").textContent=x.status;}' +
    'function save(){document.getElementById("r").textContent="Проверяю… (до 15 секунд)";google.script.run.withSuccessHandler(done).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).saveCrmSettings(document.getElementById("k").value,document.getElementById("u").value,document.getElementById("p").value);}' +
    'function off(){google.script.run.withSuccessHandler(done).removeCrmSettings();}' +
    '</script>').setWidth(520).setHeight(430);
  SpreadsheetApp.getUi().showModalDialog(html, 'Подключить CRM TopenLab');
}

function saveCrmSettings(key, user, testPhone) {
  const p = PropertiesService.getScriptProperties();
  if (String(key || '').trim()) p.setProperty('TOPNLAB_KEY', String(key).trim());
  if (String(user || '').trim()) p.setProperty('TOPNLAB_USER_ID', String(user).trim());
  const c = crmConfig_();
  const status = c.key ? 'подключена' + (c.user ? ', автор заметок ' + c.user : ', без автора заметок') : 'не подключена';
  if (!c.key) return { status: status, msg: 'Введите ключ API.' };
  let msg = 'Сохранено.';
  const phone = phoneFromText_(testPhone);
  if (phone) {
    const found = [];
    for (let i = 0; i < CRM_TYPES.length; i++) {
      crmThrottle_();
      const r = UrlFetchApp.fetch(c.base + '/get-entities?phone=' + phone + '&type=' + CRM_TYPES[i][0] + '&key=' + encodeURIComponent(c.key), { muteHttpExceptions: true });
      const code = r.getResponseCode();
      if (code === 401 || code === 403) return { status: status, msg: 'Ключ API не принят CRM (' + code + ').' };
      if (code < 400) { try { const d = JSON.parse(r.getContentText()); const k = Object.keys(d || {}); if (k.length) found.push(CRM_TYPES[i][1] + ' ' + (d[k[0]].id || k[0])); } catch (e) { /* пусто */ } }
    }
    msg += found.length ? ' Проверка: найдено — ' + found.join(', ') + '.' : ' Проверка: связь есть, карточек с этим телефоном не найдено.';
  }
  logHistory_([{ sheet: 'CRM', record_id: 'TopenLab', field: 'Подключение', old: '', new: status, kind: HIST_KIND.CHANGE }], userEmail_());
  return { status: status, msg: msg };
}

function removeCrmSettings() {
  const p = PropertiesService.getScriptProperties();
  ['TOPNLAB_KEY', 'TOPNLAB_USER_ID', 'TOPNLAB_LAST'].forEach(k => p.deleteProperty(k));
  return { status: 'не подключена', msg: 'Отключено.' };
}
