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
    INBOX: '04_ВХОДЯЩИЕ — новые объекты',
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
  SOC: '11_СОЦСЕТИ',
};

const SHEET_ORDER = ['DASH', 'OBJ', 'TASK', 'BASE', 'CONT', 'REP', 'LIB', 'DICT', 'CFG', 'HIST', 'ARCH', 'SOC'];

const TAB_COLORS = {
  DASH: '#1565C0', OBJ: '#37474F', TASK: '#2E7D32', BASE: '#2E7D32', CONT: '#2E7D32', REP: '#6A1B9A',
  LIB: '#EF6C00', DICT: '#9E9E9E', CFG: '#9E9E9E', HIST: '#9E9E9E', ARCH: '#6A1B9A', SOC: '#2E7D32', OBJTAB: '#00897B',
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
const REPORT_STATUS = { ACTUAL: 'Актуальный', REPLACED: 'Заменён', OLD: 'Старая форма' };

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
    { group: 'Команда' },
    { key: 'DIGEST_ON', label: 'Утренняя сводка сотрудникам на почту в будни в 9:00 по Москве (ДА / НЕТ): задачи на сегодня и просроченные, звонки и повторные контакты', value: 'ДА' },
    { group: 'Контент' },
    { key: 'REELS_PROMPT_DOC', label: 'Ссылка на Google Doc с промптом «Серия рилс на объект» (текст между «НАЧАЛО ПРОМПТА» и «КОНЕЦ ПРОМПТА»)', value: '' },
    { group: 'Объявления (ЦИАН, Авито)' },
    { key: 'AD_FOOTER', label: 'Финальный блок каждого объявления (для аренды «по продаже» заменяется на «по аренде»)', value: 'Рассматриваем все варианты расчетов. Документы готовы к сделке.\n\nКомментарий эксперта: Меня зовут Копачева Наталья, брокер по продаже данного лота.\n\nПредоставлю расширенную презентацию объекта. Организую индивидуальный показ.\n\nСвяжитесь со мной, чтобы получить полную информацию по объекту и согласовать удобное время просмотра.' },
    { group: 'Служебное — заполняет скрипт' },
    { key: 'FOLDER_ROOT_ID', label: 'ID папки «СИСТЕМА ЭКСКЛЮЗИВОВ»', value: '', sys: true },
    { key: 'FOLDER_MASTER_ID', label: 'ID папки 00_ТАБЛИЦА', value: '', sys: true },
    { key: 'FOLDER_OBJECTS_ID', label: 'ID папки 01_ОБЪЕКТЫ', value: '', sys: true },
    { key: 'FOLDER_TEMPLATES_ID', label: 'ID папки 02_ШАБЛОНЫ', value: '', sys: true },
    { key: 'FOLDER_INBOX_ID', label: 'ID папки 04_ВХОДЯЩИЕ', value: '', sys: true },
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
        ['В работе', 'ДА'], ['Подготовка', 'ДА'], ['Пауза', 'НЕТ'], ['Продан', 'НЕТ'], ['Сдан', 'НЕТ'], ['Договор расторгнут', 'НЕТ'], ['Внутреннее', 'НЕТ'],
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
    { key: 'task_sources', cols: ['Откуда задача'], values: [['План недели'], ['Оперативка'], ['Стратегия'], ['Claude'], ['Вручную'], ['Система']] },
    { key: 'fit', cols: ['Соответствие'], values: [['Подходит'], ['Уточнить'], ['Не подходит']] },
    { key: 'kp_types', cols: ['Какое КП'], values: [['КП клиенту'], ['КП партнёру'], ['Презентация под аудиторию'], ['Письмо без вложения']] },
    {
      key: 'responses', cols: ['Ответ', 'Класс'], values: [
        ['Нет ответа', 'NONE'], ['Интересно', 'YES'], ['Просят позже', 'LATER'], ['Не интересно', 'NO'], ['Переслали ЛПР', 'LATER'],
      ],
    },
    { key: 'platforms', cols: ['Площадка'], values: [['Instagram'], ['Telegram'], ['Threads'], ['YouTube Shorts'], ['VK Клипы'], ['ЦИАН / Авито (видео)'], ['Другое'], ['ВКонтакте'], ['Max'], ['YouTube']] },
    { key: 'content_formats', cols: ['Формат'], values: [['Рилс'], ['Пост'], ['Сторис'], ['Шортс'], ['Карусель'], ['Статья']] },
    { key: 'content_goals', cols: ['Цель контента'], values: [['Найти покупателя / арендатора'], ['Показать работу собственнику'], ['Бренд агентства'], ['Все три']] },
    {
      key: 'content_status', cols: ['Статус контента', 'Класс'], values: [
        ['Идея', 'OPEN'], ['Сценарий', 'OPEN'], ['Снято', 'OPEN'], ['Смонтировано', 'OPEN'], ['Опубликовано', 'DONE'], ['Отменено', 'CANCEL'],
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
    // новые справочники — только в конец (столбцы листа 07 не должны сдвигаться)
    {
      key: 'content_rubrics', cols: ['Рубрика'], values: [
        ['Объекты на эксклюзиве'], ['Экспертиза и советы'], ['Рынок и аналитика'], ['Кейсы и сделки'], ['Районы и локации'],
        ['Новостройки'], ['Загородная жизнь'], ['Коммерция и инвестиции'], ['Ипотека и финансы'], ['Отзывы клиентов'], ['Закулисье и личный бренд'],
      ],
    },
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
      F('customer', 'Заказчик', 'text', { was: ['Заказчик (для отчёта)'], w: 170, d: 'Как в договоре: например, ООО «Ромашка».' }),
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
      F('idle_aud', 'Аудитории ★★★ без базы', 'sys', { w: 200, d: 'Аудитории первой волны из вкладки объекта, по которым в 03_ОБЗВОН_И_КП нет ни одной компании. Обновляется каждое утро и после вставки из Claude.' }),
      F('crm_report_link', 'Отчёт по рекламе CRM (ссылка)', 'link', { was: ['Онлайн-отчёт CRM для клиента'], w: 110, d: 'Ссылка на отчёт по рекламе из TopenLab (crm.topnlab.ru/lk/report/…). Из неё система берёт площадки, просмотры, избранное, обращения и ссылку на ЦИАН для раздела 4 отчёта клиенту. Саму ссылку клиенту не отправляем.' }),
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
      // добавлено позже — только в конец листа
      F('rubric', 'Рубрика', 'dd', { dict: 'content_rubrics', d: 'Рубрика контент-плана: по ней SMM-аналитика показывает, что приносит охваты.' }),
      F('likes', 'Лайки', 'num', { fmt: '#,##0' }),
      F('comments', 'Комментарии', 'num', { fmt: '#,##0' }),
      F('shares', 'Репосты', 'num', { fmt: '#,##0' }),
      F('followers_gained', 'Подписки с публикации', 'num', { fmt: '#,##0' }),
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

  // ───────────────────────── 11_СОЦСЕТИ ─────────────────────────
  S.SOC = {
    code: 'SOC', guard: 'platform', frozenCols: 3, idField: 'id', idPrefix: 'SOC-', idPad: 4,
    about: 'Статистика аккаунтов по неделям: подписчики, охват, просмотры, переходы, заявки. Одна строка = площадка за неделю.',
    fields: [
      F('id', 'ID', 'id', { w: 80 }),
      F('week', 'Неделя', 'dd', { list: 'D.weeks' }),
      F('platform', 'Площадка', 'dd', { dict: 'platforms' }),
      F('account', 'Аккаунт / канал', 'text', { w: 160 }),
      F('followers', 'Подписчики (на конец недели)', 'num', { fmt: '#,##0' }),
      F('reach', 'Охват за неделю', 'num', { fmt: '#,##0' }),
      F('views', 'Просмотры за неделю', 'num', { fmt: '#,##0' }),
      F('profile_visits', 'Переходы в профиль', 'num', { fmt: '#,##0' }),
      F('leads', 'Заявки из соцсети', 'num', { fmt: '0' }),
      F('note', 'Комментарий', 'text', { w: 220 }),
      F('created_at', 'Создано', 'sys', { helper: true, fmt: 'datetime' }),
      F('author', 'Автор', 'sys', { helper: true }),
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
    about: 'Все отчёты клиентам: номер, период, ссылка на Google Документ (PDF — у старых отчётов).',
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
      F('crm', 'CRM', 'sys', { w: 220 }),
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
  cells.push({ a1: 'A' + (DASH.OBJ_HDR - 1), v: 'ПО ОБЪЕКТАМ (в работе) — неделя из фильтра выше', style: 'section', spanCols: 18 });
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
    ['Аудитории ★★★ без базы', look('idle_aud')],
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
    { ph: 'REPORT_NO', label: 'Отчёт №', f: '=' + P.no },
    { ph: 'PERIOD', label: 'Период', f: '=IF(' + P.start + '="","",TEXT(' + P.start + ',"dd.mm.yyyy")&" – "&TEXT(' + P.start + '+4,"dd.mm.yyyy"))' },
    { ph: 'OBJECT', label: 'Объект', f: look('address') },
    { ph: 'CUSTOMER', label: 'Заказчик', f: '=IFERROR(IF(VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.customer]]},2,FALSE)="","Заказчик",VLOOKUP(' + P.id + ',{[[OBJ.id]],[[OBJ.customer]]},2,FALSE)),"Заказчик")' }, // пусто → «Заказчик»
    { ph: 'EXECUTOR', label: 'Исполнитель', f: '=CFG_EXEC_NAME' },
    {
      ph: 'SUMMARY', label: 'Итоги недели в цифрах', lines: true,
      f: '=ARRAYFORMULA(IF(' + P.id + '="","",LET(n_call,COUNTIF(' + bKey('call_week') + ',' + cw + '),n_kp,COUNTIF(' + bKey('kp_week') + ',' + cw + '),' +
        'n_resp,COUNTIF(' + bKey('resp_week') + ',' + cw + ')-COUNTIF(' + bKey('resp_week') + '&"|"&[[BASE.resp_class]],' + cw + '&"|NONE"),' +
        'n_yes,COUNTIF(' + bKey('resp_week') + '&"|"&[[BASE.resp_class]],' + cw + '&"|YES"),' +
        'n_pub,COUNTIF([[CONT.obj_id]]&"|"&[[CONT.pub_week]]&"|"&[[CONT.status_class]],' + cw + '&"|DONE"),' +
        'n_list,IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER("• "&[[CONT.topic]]&" — "&[[CONT.platform]]&", "&TEXT([[CONT.pub_date]],"dd.mm.yyyy")&IF([[CONT.link]]="",""," — "&[[CONT.link]]),[[CONT.obj_id]]&"|"&[[CONT.pub_week]]&"|"&[[CONT.status_class]]=' + cw + '&"|DONE")),""),' +
        'n_txt,TEXTJOIN(CHAR(10),TRUE,IF(n_call>0,"Обзвонено компаний: "&n_call,""),IF(n_kp>0,"Направлено коммерческих предложений: "&n_kp,""),' +
        'IF(n_resp>0,"Получено ответов: "&n_resp&IF(n_yes>0,", из них заинтересованы: "&n_yes,""),""),' +
        'IF(n_pub>0,"Опубликовано материалов об объекте: "&n_pub&CHAR(10)&n_list,"")),' +
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
      f: numbered(15, 'FILTER({IF([[BASE.audience]]="","Заинтересованная компания","Заинтересованная компания — «"&[[BASE.audience]]&"»"),[[BASE.next_step]]&IF([[BASE.next_date]]="",""," — "&TEXT([[BASE.next_date]],"dd.mm.yyyy"))},' +
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
  cells.push({ a1: 'A6', v: 'Комментарий для себя (только в CRM):', style: 'label' });
  cells.push({ a1: 'B6', v: '', style: 'select', note: 'Необязательно. Уходит в карточку объекта в TopenLab вместе с отчётом. В отчёт для клиента не попадает.' });
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
  if (!requireAdmin_('Установить / обновить систему')) return;
  const start = Date.now();
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { /* запуск из редактора Apps Script — без диалогов */ }
  if (!ui) {
    const log = [];
    runSetup_(log);
    try { fixObjIdColumns_(); } catch (e) { /* не критично */ }
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
  try { fixObjIdColumns_(); const nt = fillTeamDefaults_(); if (nt) log.push('Команда (руководитель, ассистент) проставлена объектам: ' + nt); } catch (e) { /* не критично */ }
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
  try {
    const nt = protectAll_();
    if (isOwner_()) log.push('Защита: ID и названия объектов, служебная часть вкладок (' + nt + '), лист 08_НАСТРОЙКИ — удалять объекты, менять настройки, переустанавливать и обновлять систему может только руководитель');
    backupObjectTabs_();
  } catch (err) { warn += '\n\n⚠ Защита: ' + err.message; }
  try { const nd = ensureAllStrategyDocs_(start); if (nd) log.push('Документы «Маркетинговая стратегия» в папках объектов: ' + nd); } catch (err) { warn += '\n\n⚠ Документы стратегии: ' + err.message; }
  try { const mt = ensureMediaTasks_(); if (mt) log.push('Задачи «фото и видео на Яндекс Диске» новым объектам: ' + mt); } catch (err) { warn += '\n\n⚠ Задачи фото и видео: ' + err.message; }
  try { refreshIdleAudiences_(); } catch (err) { warn += '\n\n⚠ Аудитории без базы: ' + err.message; }
  try { const nb = refreshBaseAudienceLists_(); if (nb) log.push('03_ОБЗВОН_И_КП: списки аудиторий в строках: ' + nb); } catch (err) { warn += '\n\n⚠ Списки аудиторий: ' + err.message; }
  try { if (ensureAgencyObject_()) log.push('Служебный объект «' + AGENCY_NAME + '» (ID ' + AGENCY_ID + ') — для общих задач с оперативок'); } catch (err) { warn += '\n\n⚠ Общие задачи агентства: ' + err.message; }
  try { const tr = ensureJobTriggers_(); if (tr.length) log.push('Автозапуски включены: ' + tr.join(', ')); } catch (err) { warn += '\n\n⚠ Автозапуски: ' + err.message + ' — меню «Сервис» → «Включить автообновление».'; }
  try { const al = ensureAdLinkTasks_(); if (al) log.push('Задачи ассистенту «ссылка на отчёт по рекламе CRM»: ' + al); } catch (err) { warn += '\n\n⚠ Задачи ссылок на отчёт по рекламе: ' + err.message; }
  try { const mb = backfillMediaTasks_(); if (mb) log.push('Задачи ассистенту «фото и видео на Яндекс Диске» по текущим объектам: ' + mb); } catch (err) { warn += '\n\n⚠ Задачи фото и видео: ' + err.message; }
  try { const c = syncCalendar_(); log.push('Google Календарь: создано событий ' + c.created + ', обновлено ' + c.updated +
    (c.shared.length ? '; напрямую в календарь: ' + c.shared.join(', ') : '') +
    (c.personal.length ? '; в личный календарь «Задачи: …» (Google пришлёт сотруднику письмо «Добавить календарь»): ' + c.personal.join(', ') : '') +
    (c.shareErrors.length ? '; ⚠ ' + c.shareErrors.join('; ') : '') +
    (c.noEmail.length ? '; нет email у: ' + c.noEmail.join(', ') : ''));
    const rq = requestCalendarAccess_();
    if (rq.length) log.push('Письмо с просьбой открыть доступ к календарю отправлено: ' + rq.join(', ')); } catch (err) { warn += '\n\n⚠ Календарь: ' + err.message; }
  try { const ms = sendAssistantManual_(); if (ms.length) log.push('Инструкция ассистента отправлена на почту: ' + ms.join(', ')); } catch (err) { warn += '\n\n⚠ Инструкция ассистенту: ' + err.message; }
  try { if (!cfgGet_('REELS_PROMPT_DOC')) { const u = findReelsPromptDoc_(); log.push(u ? 'Промпт «Серия рилс на объект»: найден документ ' + u : '⚠ Промпт «Серия рилс на объект»: документ не найден — вставьте ссылку в 08_НАСТРОЙКИ'); } } catch (err) { warn += '\n\n⚠ Промпт серии рилс: ' + err.message; }
  try { const at = ensureAnalogTemplate_(); if (at) log.push(at); } catch (err) { warn += '\n\n⚠ Шаблон анализа аналогов: ' + err.message; }
  const tabs = objectTabs_().length;
  if (tabs) {
    try { startTabRebuild_(); const r = tabsWork_(start); applyTabVisibility_(); log.push('Вкладки объектов: ' + tabsWorkText_(r)); } catch (err) { warn += '\n\n⚠ Вкладки объектов: ' + err.message + '\nЗапустите «Сервис → Обновить все вкладки объектов».'; }
  }
  ui.alert('Готово', log.join('\n') + warn +
    (tabs ? '' :
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
  ['OBJ', 'TASK', 'BASE', 'CONT', 'LIB', 'HIST', 'ARCH', 'SOC'].forEach(code => { buildDataSheet_(code); log.push(SHEET_NAMES[code]); });
  headerGuard_.ok = {};
  try { const fx = repairObjShift_(); if (fx) log.push('Исправлено строк 01_ОБЪЕКТЫ после сдвига столбцов: ' + fx); } catch (e) { log.push('⚠ Проверка сдвига 01_ОБЪЕКТЫ: ' + e.message); }
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
      sh.getRange(2, c).setFormula(toLocaleF_(resolveF_(gen[d.key])));
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
      } else if (d.key !== 'people') { // новые значения из новой версии системы дописываются в конец списка; правки команды (и список сотрудников) не трогаются
        const have = sh.getRange(2, c, sh.getMaxRows() - 1, 1).getValues().map(v => String(v[0]).trim());
        let last = 0;
        have.forEach((v, i) => { if (v !== '') last = i + 1; });
        const add = d.values.filter(v => have.indexOf(String(v[0]).trim()) < 0);
        if (add.length) sh.getRange(2 + last, c, add.length, d.cols.length).setValues(add);
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
  spec.fields.forEach((f, i) => { if (f.kind === 'f') sh.getRange(1, i + 1).setFormula(toLocaleF_(headerFormula_(spec, f))); });
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
    else if (f.kind === 'text' || f.kind === 'link' || f.key === 'obj_id') body.setNumberFormat('@');
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
    if (cur[i] !== '' && cur[i] !== f.title && (f.was || []).indexOf(cur[i]) < 0) bad.push(colLetter_(i + 1) + ': «' + cur[i] + '» вместо «' + f.title + '»');
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
  const b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(toLocaleF_(formula)).setRanges([range]);
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
    if (c.f) r.setFormula(toLocaleF_(resolveF_(c.f)));
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
  const keep = ['B3', 'B4', 'B5', 'B6'].map(a => safeGet_(sh, a));
  resetSheet_(sh);
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (e) { /* нечего разъединять */ }
  const L = reportLayout_();
  ensureSize_(sh, L.lastRow + 5, 6);
  applyCells_(sh, L.cells);
  ['B3', 'B4', 'B5', 'B6'].forEach((a, i) => restoreSel_(sh, a, keep[i]));
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
  sh.getRange('B6:C6').merge().setWrap(true);
  sh.setRowHeight(5, 48); sh.setRowHeight(6, 48);
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
  [['MASTER', 'FOLDER_MASTER_ID'], ['OBJECTS', 'FOLDER_OBJECTS_ID'], ['TEMPLATES', 'FOLDER_TEMPLATES_ID'], ['INBOX', 'FOLDER_INBOX_ID']].forEach(p => {
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
  // открывать доступ другим людям может только владелец (не редакторы)
  try { if (isOwner_()) { file.setShareableByEditors(false); root.setShareableByEditors(false); } } catch (e) { /* не критично */ }
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

/**
 * Разовая починка: версия кода со столбцом рекламы в середине 01_ОБЪЕКТЫ (до «Установить / обновить систему»)
 * записала «Последний отчёт» → «Дата отчёта», «Дата отчёта» → «Проверка ID», папку → «Стратегия заполнена».
 */
function repairObjShift_() {
  const t = readTable_('OBJ');
  const cLink = fieldIndex_('OBJ', 'last_report_link'), cDate = fieldIndex_('OBJ', 'last_report_date');
  const cId = fieldIndex_('OBJ', 'id_check'), cPct = fieldIndex_('OBJ', 'strategy_pct');
  let n = 0;
  t.rows.forEach(o => {
    const r = o._row;
    const idCell = t.sh.getRange(r, cId);
    const stray = idCell.getFormula() ? '' : idCell.getValue();
    const shifted = typeof o.last_report_date === 'string' && /^https?:\/\//.test(o.last_report_date);
    if (!shifted && !(stray instanceof Date) && !(typeof o.strategy_pct === 'string' && /^https?:/.test(o.strategy_pct))) return;
    if (shifted) {
      if (!o.last_report_link) t.sh.getRange(r, cLink).setValue(o.last_report_date);
      t.sh.getRange(r, cDate).setValue(stray instanceof Date ? stray : '');
    }
    if (stray instanceof Date) idCell.clearContent(); // иначе формула «Проверка ID» выдаёт #REF!
    if (typeof o.strategy_pct === 'string' && /^https?:/.test(o.strategy_pct)) t.sh.getRange(r, cPct).setValue('');
    n++;
  });
  return n;
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
  if (built && mode === 'create') { try { ensureStrategyDoc_(obj); } catch (e) { /* создастся при первой вставке стратегии */ } }
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
const TAB_JOB_SLICE_MS = 60000; // фоновая пересборка — порциями по ~1 минуте, между ними таблица свободна

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
    if (!o.id || !o.name || isServiceObject_(o)) return;
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
    tabsWork_(Date.now() - TAB_BUDGET_MS + TAB_JOB_SLICE_MS); // короткая порция: не держим таблицу занятой надолго
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
  if (!requireAdmin_('Обновить все вкладки объектов')) return;
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
  let old = 0;
  try { old = registerOldReports_(); } catch (e) { Logger.log('Старые отчёты: ' + e.message); }
  const n = refreshObjectFiles_();
  toast_('Обновлено вкладок: ' + n + (old ? '. В архив отчётов добавлено отчётов по старой форме: ' + old : ''), 'Документы объектов', 6);
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
  if (sh.getName() === SHEET_NAMES.DICT) {
    try { handleDictEdit_(e); } catch (err) { toast_('Справочник: ' + err.message, 'Внимание', 8); }
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
    if (spec.code === 'OBJ') { try { protectObjectRows_(); } catch (err) { /* не критично */ } }
  } catch (err) {
    toast_('Ошибка автоматики: ' + err.message, 'Внимание', 10);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Команда по умолчанию для каждого объекта: руководитель и ассистент (по роли в 07_СПРАВОЧНИКИ).
 * Ассистент ведёт все объекты — ставится всем текущим и новым, если поле пустое.
 */
function teamDefaults_() {
  const res = {};
  dictRows_('people').forEach(p => {
    const name = String(p[0] || '').trim(), role = String(p[1] || '').toLowerCase();
    if (!name) return;
    if (!res.manager && /руководит/.test(role)) res.manager = name;
    if (!res.assistant && /ассистент/.test(role)) res.assistant = name;
  });
  return res;
}

/** Проставить команду по умолчанию объектам, у которых поля пустые. Возвращает число изменённых объектов. */
function fillTeamDefaults_() {
  const team = teamDefaults_();
  if (!Object.keys(team).length) return 0;
  const t = readTable_('OBJ');
  let n = 0;
  t.rows.forEach(o => {
    if (!o.id || !o.name) return;
    const upd = {};
    Object.keys(team).forEach(k => { if (!o[k] && team[k]) upd[k] = team[k]; });
    if (Object.keys(upd).length) { writeFields_(t.sh, 'OBJ', o._row, upd); n++; }
  });
  return n;
}

/** Переименовали сотрудника в 07_СПРАВОЧНИКИ («Ассистент» → «Мария») — имя меняется во всех журналах и объектах. */
function handleDictEdit_(e) {
  const d = dictLayout_().people;
  if (!d || e.range.getColumn() !== d.col || e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1 || e.range.getRow() < 2) return;
  const oldName = String(e.oldValue || '').trim(), newName = String(e.value || '').trim();
  if (!oldName || !newName || oldName === newName) return;
  const n = renamePerson_(oldName, newName);
  logHistory_([{ sheet: SHEET_NAMES.DICT, record_id: 'Сотрудник', field: 'Имя', old: oldName, new: newName, kind: HIST_KIND.CHANGE, note: 'заменено в журналах: ' + n }], userEmail_(e));
  if (n) toast_('«' + oldName + '» → «' + newName + '»: заменено ' + n + ' раз в объектах и журналах.', 'Сотрудник переименован', 8);
}

function renamePerson_(oldName, newName) {
  let n = 0;
  [['OBJ', ['manager', 'assistant', 'smm']], ['TASK', ['owner']], ['BASE', ['owner']], ['CONT', ['owner']]].forEach(p => {
    const sh = sheet_(p[0]);
    p[1].forEach(k => {
      const col = fieldIndex_(p[0], k);
      n += sh.getRange(2, col, sh.getMaxRows() - 1, 1).createTextFinder(oldName).matchEntireCell(true).replaceAllWith(newName) || 0;
    });
  });
  return n;
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
    if (code === 'OBJ' && o.id && o.name && !isServiceObject_(o) && (isNew || !o.tab_url || editedKeys.indexOf('id') >= 0 || editedKeys.indexOf('name') >= 0)) {
      o._row = row;
      tabSync.push(o);
    }
    if (code === 'BASE' && single && editedKeys[0] === 'company' && o.company) {
      try {
        const other = companyElsewhere_(o.company, o.obj_id);
        if (other.length) toast_('«' + o.company + '» уже в базе: ' + other.map(x => (objectById_(x.obj_id) || {}).name || x.obj_id).join(', ') +
          (other.some(x => x.kp_date) ? ' (КП уже отправляли)' : '') + '. Можно предложить и этот объект, но согласуйте, чтобы не звонить дважды.', 'Компания уже в работе', 10);
      } catch (err) { /* не критично */ }
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
  if (code === 'OBJ' && editedKeys.indexOf('status') >= 0) {
    try { applyTabVisibility_(); } catch (err) { /* не критично */ }
  }
  tabSync.slice(0, 5).forEach(o => {
    const r = syncObjectTab_(o, 'create');
    if (r && r.built) toast_('Создана вкладка «' + r.sheet.getName() + '» — там стратегия объекта.', 'Новый объект', 8);
  });
  if (code === 'BASE' && editedKeys.indexOf('obj_id') >= 0) {
    try { refreshBaseAudienceLists_(vals.map(v => String(v[spec.fields.findIndex(f => f.key === 'obj_id')] || '')).filter(Boolean)); } catch (err) { /* список поставится утром */ }
  }
  if (code === 'OBJ' && tabSync.length) {
    try { const nt = ensureMediaTasks_(); if (nt) toast_('Ассистенту поставлена задача: фото и видео объекта на Яндекс Диске.', 'Новый объект', 6); } catch (err) { /* поставится утром */ }
  }
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
    const team = teamDefaults_();
    Object.keys(team).forEach(k => { if (!o[k] && team[k]) set(k, team[k]); });
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
  if (code === 'SOC' && isNew) { set('created_at', now); set('author', user); }
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
  fixObjIdColumns_(); // «137073408» после замены Google превращает в число — возвращаем текст
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
 * 06_Reports — еженедельный отчёт клиенту: Google Документ (единственная актуальная версия, ссылка — клиенту) + архив.
 *
 * Формат — как в отчётах руководителя (шапка ИП, таблица реквизитов,
 * Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА, Раздел 2. ПОЛУЧЕННЫЕ ЗАЯВКИ, Раздел 3. ПЛАН РАБОТЫ, Раздел 4. РЕКЛАМА НА ПЛОЩАДКАХ).
 * Источник — лист 05_ОТЧЁТ_КЛИЕНТУ (предпросмотр): скрипт берёт оттуда только поля с метками {{…}},
 * поэтому внутренние данные (контакты, звонки, комментарии) в документ попасть не могут.
 * Клиент доступа к таблице не получает — только ссылку на Google Документ отчёта (просмотр; скачать в Word — Файл → Скачать).
 */

/** Меню «Создать отчёт клиенту»: окно выбора объекта и недели (по умолчанию — объект текущей вкладки / строки). */
function createReport() {
  const rep = sheet_('REP');
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && !isServiceObject_(o));
  const cur = String(selectedObjectId_() || rep.getRange('E3').getValue() || '');
  const weeks = dictRows_('weeks').map(r => String(r[3] || '')).filter(Boolean);
  const nowWk = isoWeekKey_(today_());
  const curWk = weeks.find(w => w.indexOf(nowWk) === 0) || String(rep.getRange('B4').getValue() || '');
  const opt = (v, t, sel) => '<option value="' + htmlEscape_(v) + '"' + (sel ? ' selected' : '') + '>' + htmlEscape_(t) + '</option>';
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div style="margin:6px 0">Объект:<br><select id="o" style="width:100%">' + objs.map(o => opt(o.id, o.name + ' (' + o.id + ')', String(o.id) === cur)).join('') + '</select></div>' +
    '<div style="margin:6px 0">Неделя:<br><select id="w" style="width:100%">' + weeks.map(w => opt(w, w, w === curWk)).join('') + '</select></div>' +
    '<div style="margin:6px 0">Комментарий для клиента (необязательно):<br><textarea id="c" style="width:100%;height:60px"></textarea></div>' +
    '<div style="margin:6px 0">Комментарий для себя — только в CRM (необязательно):<br><textarea id="i" style="width:100%;height:45px"></textarea></div>' +
    '<button id="b" onclick="go(false)">Создать отчёт</button> <span id="s" style="color:#80868B"></span>' +
    '<div id="r" style="margin-top:10px"></div></div>' +
    '<script>' +
    'function go(force){var b=document.getElementById("b");b.disabled=true;document.getElementById("s").textContent="Собираю отчёт… (до минуты)";document.getElementById("r").innerHTML="";' +
    'google.script.run.withSuccessHandler(function(x){b.disabled=false;document.getElementById("s").textContent="";' +
    'if(x.exists){if(confirm("Отчёт по этому объекту за эту неделю уже есть. Создать новую версию? Прежняя останется в архиве со статусом «Заменён».")){go(true);}return;}' +
    'document.getElementById("r").innerHTML="<b>Готово: "+x.name+"</b><br><a target=_blank href=\'"+x.docUrl+"\'>Отчёт (Google Документ) — эту ссылку клиенту</a> · <a target=_blank href=\'"+x.docxUrl+"\'>Скачать в Word</a> · <a target=_blank href=\'"+x.folderUrl+"\'>Папка отчётов</a>"+(x.crm?"<br>"+x.crm:"");})' +
    '.withFailureHandler(function(e){b.disabled=false;document.getElementById("s").textContent="";document.getElementById("r").textContent="Ошибка: "+e.message;})' +
    '.createReportFor(document.getElementById("o").value,document.getElementById("w").value,document.getElementById("c").value,document.getElementById("i").value,force);}' +
    '</script>').setWidth(520).setHeight(470);
  SpreadsheetApp.getUi().showModalDialog(html, 'Отчёт клиенту');
}

/** Вызывается из окна «Отчёт клиенту»: выставляет объект и неделю в 05_ОТЧЁТ_КЛИЕНТУ и собирает отчёт. */
function createReportFor(id, weekLabel, comment, internal, force) {
  const obj = objectById_(id);
  if (!obj) throw new Error('Объект ' + id + ' не найден');
  const wk = String(weekLabel || '').split(' ')[0];
  if (!wk) throw new Error('Не выбрана неделя');
  if (!force && readTable_('ARCH').rows.some(r => String(r.obj_id) === String(id) && r.week === wk && r.status === REPORT_STATUS.ACTUAL)) return { exists: true };
  const rep = sheet_('REP');
  rep.getRange('B3').setValue(obj.id + ' · ' + obj.name);
  rep.getRange('B4').setValue(weekLabel);
  rep.getRange('B5').setValue(comment || '');
  rep.getRange('B6').setValue(internal || '');
  SpreadsheetApp.flush();
  if (String(rep.getRange('E3').getValue()) !== String(obj.id) || String(rep.getRange('E4').getValue()) !== wk) {
    throw new Error('Лист ' + SHEET_NAMES.REP + ' не переключился на объект / неделю — попробуйте ещё раз');
  }
  const res = generateReport_(String(obj.id), wk, { interactive: false });
  return { name: res.name, docUrl: res.docUrl, docxUrl: res.docxUrl || '', folderUrl: res.folderUrl, crm: res.crm || '' };
}

/** Собирает отчёт. Лист 05_ОТЧЁТ_КЛИЕНТУ должен быть выставлен на этот объект и неделю. */
function generateReport_(id, wk, opts) {
  opts = opts || {};
  const obj = objectById_(id);
  if (!obj) throw new Error('Объект ' + id + ' не найден в ' + SHEET_NAMES.OBJ);
  const values = readReportValues_();
  try {
    const aud = audienceReportLines_(id, wk);
    if (aud.length) values.kv.SUMMARY = [String(values.kv.SUMMARY || '').trim(), aud.join('\n')].filter(Boolean).join('\n');
  } catch (e) { /* без цифр по аудиториям */ }
  addAdStats_(values, obj, wk);
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
  // PDF и копии не делаем: отчёт — один Google Документ, правки в нём сразу видны по ссылке
  try { copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { Logger.log('Доступ по ссылке: ' + e.message); }

  appendRow_('ARCH', {
    ts: new Date(), obj_id: id, obj_name: obj.name, report_no: values.kv.REPORT_NO, week: wk, period: values.kv.PERIOD,
    doc_link: copy.getUrl(), pdf_link: '', author: userEmail_(), status: REPORT_STATUS.ACTUAL,
  });
  writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { last_report_link: copy.getUrl(), last_report_date: today_() });
  let crm = '';
  try { crm = sendReportToCrm_(obj, values, copy.getUrl(), sheet_('REP').getRange('B6').getValue(), wk); } catch (e) { crm = '⚠ CRM: ' + e.message; }
  if (crm) { const a = readTable_('ARCH'); const last = a.rows[a.rows.length - 1]; if (last) writeFields_(a.sh, 'ARCH', last._row, { crm: crm }); }
  return { crm: crm, name: name, docId: copy.getId(), docUrl: copy.getUrl(), docxUrl: wordExportUrl_(copy.getId()), folderUrl: folder.getUrl() };
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
  keys.AD_STATS = true; // раздел «Реклама на площадках» — строки из отчёта по рекламе CRM
  return keys;
}

/** Подстановка: поля — replaceText, многострочные — абзацами, таблицы — строками таблицы. */
function fillReportDoc_(doc, values) {
  const body = doc.getBody();
  Object.keys(values.tables).forEach(ph => fillTableRows_(body, ph, values.tables[ph]));
  const lines = lineKeys_();
  Object.keys(values.kv).forEach(k => {
    const v = String(values.kv[k] || '').trim();
    if (!v && (k === 'COMMENT' || k === 'SUMMARY' || k === 'AD_STATS')) { removeBlock_(body, k); return; }
    if (lines[k]) replaceWithLines_(body, k, v.split(/\r?\n/).map(x => x.trim()).filter(Boolean));
  });
  [body, doc.getHeader(), doc.getFooter()].forEach(sec => {
    if (!sec) return;
    Object.keys(values.kv).forEach(k => {
      if (!lines[k]) sec.replaceText(phPattern_(k), escapeReplacement_(String(values.kv[k] || '—')));
    });
    sec.replaceText('\\{\\{[A-Z_]+\\}\\}', '—');
  });
  try { linkifyBody_(body); } catch (e) { /* без кликабельных ссылок */ }
}

/** Адреса в тексте отчёта (ссылка на ЦИАН, публикации) — кликабельные. */
function linkifyBody_(body) {
  let f = body.findText('https?://[^\\s]+');
  while (f) {
    const t = f.getElement().asText(), a = f.getStartOffset(), b = f.getEndOffsetInclusive();
    t.setLinkUrl(a, b, t.getText().slice(a, b + 1));
    f = body.findText('https?://[^\\s]+', f);
  }
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
  if (!root) {
    // папка «Название (ID)» или уже существующая папка объекта с похожим названием («ЖК Время» для «ЖК Время · Лермонтовская 1»)
    const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/\s*\([^)]*\)\s*$/, '').replace(/[«»"]/g, '').trim();
    const oname = norm(obj ? obj.name : id);
    let byName = null;
    const it = parent.getFolders();
    while (it.hasNext() && !root) {
      const f = it.next();
      if (f.getName().slice(-suffix.length) === suffix) { root = f; break; }
      const fn = norm(f.getName());
      if (!byName && fn.length >= 4 && (oname === fn || oname.indexOf(fn) === 0 || fn.indexOf(oname) === 0)) byName = f;
    }
    if (!root) root = byName;
  }
  if (!root) {
    root = parent.createFolder((obj ? obj.name : id) + ' ' + suffix);
    Object.keys(SYS.OBJECT_SUBFOLDERS).forEach(k => childFolder_(root, SYS.OBJECT_SUBFOLDERS[k]));
  }
  if (obj && idFromUrl_(obj.folder_link) !== root.getId()) writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { folder_link: root.getUrl() });
  if (!kind || kind === 'ROOT') return root;
  return childFolder_(root, SYS.OBJECT_SUBFOLDERS[kind]);
}

/**
 * Шаблон отчёта в формате руководителя. Создаётся один раз в 02_ШАБЛОНЫ; дальше вёрстку (шрифты, логотип,
 * отступы) можно менять прямо в Google Docs — метки {{…}} не удаляйте.
 */
const REPORT_TEMPLATE_VERSION = '5'; // 2: без строки «Приложение №1 к Договору № … от …»; 4: раздел 4 «Реклама на площадках»; 5: подпись без «Исполнитель: ____»

function ensureReportTemplate_() {
  const id = String(cfgGet_('TEMPLATE_REPORT_ID') || '');
  const props = PropertiesService.getDocumentProperties();
  const fresh = props.getProperty('TEMPLATE_VERSION') === REPORT_TEMPLATE_VERSION;
  if (id) {
    try {
      const f = DriveApp.getFileById(id);
      if (!f.isTrashed() && fresh) return id;
      if (!f.isTrashed()) f.setName(f.getName() + ' (старая версия)'); // шаблон изменился — старый остаётся в папке
    } catch (e) { /* создадим заново */ }
  }
  const doc = DocumentApp.create(SYS.REPORT_TEMPLATE_NAME);
  try {
    buildReportTemplate_(doc);
  } catch (e) {
    try { DriveApp.getFileById(doc.getId()).setTrashed(true); } catch (err) { /* не удалось убрать черновик */ }
    throw new Error('Шаблон отчёта не создан: ' + e.message);
  }
  const file = DriveApp.getFileById(doc.getId());
  const tplFolder = folderById_(cfgGet_('FOLDER_TEMPLATES_ID'));
  if (tplFolder) file.moveTo(tplFolder);
  cfgSet_('TEMPLATE_REPORT_ID', doc.getId());
  props.setProperty('TEMPLATE_VERSION', REPORT_TEMPLATE_VERSION);
  return doc.getId();
}

function buildReportTemplate_(doc) {
  const b = doc.getBody();
  b.setMarginTop(42).setMarginBottom(42).setMarginLeft(56).setMarginRight(42);
  const base = {};
  base[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  base[DocumentApp.Attribute.FONT_SIZE] = 12;
  b.setAttributes(base);
  const H = DocumentApp.ParagraphHeading;
  const A = DocumentApp.HorizontalAlignment;
  const p0 = b.getParagraphs()[0];
  p0.setText('{{EXEC_HEADER}}');
  p0.setAlignment(A.RIGHT);
  p0.editAsText().setFontSize(10);
  b.appendParagraph('');
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
  b.appendParagraph('Раздел 4. РЕКЛАМА НА ПЛОЩАДКАХ').setHeading(H.HEADING3);
  b.appendParagraph('{{AD_STATS}}');
  b.appendParagraph('Комментарий').setHeading(H.HEADING4);
  b.appendParagraph('{{COMMENT}}');
  b.appendParagraph('');
  b.appendParagraph('{{SIGNATURE}}');
  doc.saveAndClose();
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

/**
 * Отчёты, отправленные клиенту до системы (по старой форме): PDF или документ кладут в папку объекта «Отчёты».
 * Файлы, которых нет в 10_АРХИВ_ОТЧЁТОВ, записываются туда со статусом «Старая форма» — отметка, что отчёт был.
 * На нумерацию и вид новых отчётов это не влияет. № и период берутся из имени файла («Отчет №06 … 21.09-25.09»).
 */
function registerOldReports_() {
  const arch = readTable_('ARCH');
  const known = {};
  arch.rows.forEach(r => [r.doc_link, r.pdf_link].forEach(l => { const id = idFromUrl_(l); if (id) known[id] = true; }));
  const rows = [];
  readTable_('OBJ').rows.forEach(o => {
    if (!o.id || !o.name || isServiceObject_(o) || !o.folder_link) return;
    let folder;
    try { folder = ensureObjectFolder_(o.id, 'REPORTS'); } catch (e) { return; }
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const mime = f.getMimeType();
      if (known[f.getId()] || (mime !== MimeType.PDF && mime !== MimeType.GOOGLE_DOCS)) continue;
      if (/\((устаревший|временно)\)/i.test(f.getName())) continue; // старые версии PDF системных отчётов
      if (mime === MimeType.GOOGLE_DOCS && folder.getFilesByName(f.getName() + '.pdf').hasNext()) continue; // док системного отчёта рядом с PDF
      const info = oldReportInfo_(f.getName(), f.getDateCreated());
      rows.push({
        ts: f.getDateCreated(), obj_id: String(o.id), obj_name: o.name, report_no: info.no, week: info.week, period: info.period,
        doc_link: mime === MimeType.GOOGLE_DOCS ? f.getUrl() : '', pdf_link: mime === MimeType.PDF ? f.getUrl() : '',
        author: 'старая форма', status: REPORT_STATUS.OLD,
      });
    }
  });
  if (!rows.length) return 0;
  rows.sort((a, b) => a.ts - b.ts);
  appendRows_('ARCH', rows);
  logHistory_(rows.map(r => ({ sheet: SHEET_NAMES.ARCH, record_id: r.report_no ? '№' + r.report_no : '', obj_id: r.obj_id, field: 'Отчёт',
    old: '', new: r.period || r.pdf_link || r.doc_link, kind: HIST_KIND.CREATE, note: 'Отчёт по старой форме добавлен в архив' })), 'система');
  return rows.length;
}

/** «Отчет №06 за период 21.09-25.09.pdf» → {no: 6, period: '21.09.2026 – 25.09.2026', week: '2026-W39'}. */
function oldReportInfo_(name, created) {
  const s = String(name || '');
  const n = /№\s*0*(\d{1,3})(?![\d.])/.exec(s) || /отч[её]т\D{0,12}?0*(\d{1,3})(?![\d.])/i.exec(s) || /(?:^|[^\d.])0*(\d{1,3})(?![\d.])/.exec(s);
  const p = /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s*[-–—_]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/.exec(s);
  const out = { no: n ? Number(n[1]) : '', period: '', week: '' };
  if (p) {
    const cy = (created instanceof Date ? created : new Date()).getFullYear();
    const yr = y => !y ? cy : (y.length === 2 ? 2000 + Number(y) : Number(y));
    const to = new Date(yr(p[6] || p[3]), Number(p[5]) - 1, Number(p[4]));
    const from = new Date(yr(p[3] || p[6]), Number(p[2]) - 1, Number(p[1]));
    if (!p[3] && !p[6] && to - (created instanceof Date ? created : new Date()) > 30 * 864e5) { // год не указан, а дата сильно в будущем — прошлый год
      to.setFullYear(to.getFullYear() - 1);
      from.setFullYear(from.getFullYear() - 1);
    }
    out.period = fmtDate_(from) + ' – ' + fmtDate_(to);
    out.week = isoWeekKey_(to);
  }
  return out;
}

/** Ссылка «скачать в Word» — всегда актуальная версия Google Документа отчёта. */
function wordExportUrl_(docId) { return 'https://docs.google.com/document/d/' + docId + '/export?format=docx'; }

// ═════════════ 07_Planning.gs ═════════════
/**
 * 07_Planning — «Создать план недели».
 *
 * Для каждого объекта в работе:
 *  1) незакрытые задачи прошлых недель (по желанию) переносятся на выбранную неделю — исходные строки
 *     получают статус «Перенесено» и остаются в истории;
 *  2) добавляются задачи недели по умолчанию из 08_НАСТРОЙКИ (если такой задачи на эту неделю ещё нет).
 *  3) по аудиториям первой волны (★★★ во вкладке), где в 03_ОБЗВОН_И_КП меньше 10 компаний, — задача собрать базу.
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

const AUD_BASE_TARGET = 10; // сколько компаний в базе должно быть по каждой аудитории первой волны

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
  // первая волна (★★★): если по аудитории в базе меньше 10 компаний — задача собрать базу
  objs.forEach(o => {
    let aud = [];
    try { aud = objectAudienceRows_(o.id).filter(x => x.prio >= 3).slice(0, 3); } catch (e) { return; }
    if (!aud.length) return;
    const st = audienceStats_(o.id);
    aud.forEach(x => {
      const n = (st[x.name] || {}).total || 0;
      if (n >= AUD_BASE_TARGET) return;
      const task = 'База «' + x.name + '»: найти и внести в 03_ОБЗВОН_И_КП компании (ЛПР, контакт, сайт)';
      if (have[o.id + '|' + wk + '|' + task]) return;
      add.push({
        id: nextId_('TASK', cache), week: wk, obj_id: o.id, block: 'База и рассылки', task: task, owner: o.assistant || o.manager || '', unit: 'шт',
        plan: Math.max(5, AUD_BASE_TARGET - n), deadline: addDays_(mon, 4), status: openName, to_report: true, source: 'План недели', created_at: new Date(), author: userEmail_(),
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
  const start = Date.now();
  let fixed = 0, note = '';
  try {
    ['TASK', 'BASE', 'CONT', 'LIB'].forEach(code => {
      fixed += removeOrphanRows_(code);
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
    fixObjIdColumns_();
    fixed += fillTeamDefaults_();
    const r = tabsWork_(start);
    fixed += r.created + r.rebuilt;
    if (r.left) note = '. ' + tabsWorkText_(r);
    orderSheets_();
    applyTabVisibility_();
    try { protectAll_(); } catch (e) { /* не критично */ }
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.flush();
  toast_('Готово. Исправлено / создано: ' + fixed + note, 'Обновление', 10);
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
  if (!requireAdmin_('Загрузить пример')) return;
  const ui = SpreadsheetApp.getUi();
  const exists = !!objectById_(EXAMPLE_ID);
  const b = ui.alert('Пример «ЖК Время»', exists
    ? 'Пример уже есть. Дозагрузить то, чего не хватает (вкладка, задачи, обзвон, контент)? Уже внесённое не дублируется.'
    : 'Добавить пример объекта с вкладкой стратегии, задачами, обзвоном медцентров и контентом? Реальные данные не затрагиваются.', ui.ButtonSet.OK_CANCEL);
  if (b !== ui.Button.OK) return;
  let sh;
  try { sh = loadExample_(); } catch (e) { ui.alert('Пример не загружен', e.message, ui.ButtonSet.OK); return; }
  sh.activate();
  ui.alert('Готово', 'Откройте вкладку «' + sh.getName() + '», затем 05_ОТЧЁТ_КЛИЕНТУ: выберите объект и неделю 2026-W38 (14.09–18.09) — это отчёт за 14–18.09 в вашем формате (как отчёт № 5).', ui.ButtonSet.OK);
}

function d_(s) { return s ? new Date(s + 'T00:00:00') : ''; }

function loadExample_() {
  const F = EXAMPLE_FILES;
  SpreadsheetApp.flush();
  if (!dictRows_('weeks').some(r => /^\d{4}-W\d{2}$/.test(String(r[0])))) {
    throw new Error('Списки недель не посчитались. Сначала: Сервис → «Установить / обновить систему», затем снова «Загрузить пример».');
  }
  ['TASK', 'BASE', 'CONT'].forEach(removeOrphanRows_);
  // пример можно дозагрузить: каждая часть добавляется, только если её ещё нет
  const has = code => readTable_(code).rows.some(r => r.obj_id === EXAMPLE_ID);
  if (!objectById_(EXAMPLE_ID)) appendRow_('OBJ', {
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
  const current = readObjectTab_(res.sheet);
  if (!Object.keys(current.tables).length) buildObjectTab_(res.sheet, EXAMPLE_ID, data);
  else buildObjectTab_(res.sheet, EXAMPLE_ID, current);

  const cache = {};
  const T = (week, block, task, owner, unit, plan, status, result, deadline) => ({
    id: nextId_('TASK', cache), week: week, obj_id: EXAMPLE_ID, block: block, task: task, owner: owner, unit: unit, plan: plan,
    status: status, result: result || '', deadline: d_(deadline), to_report: true, source: 'План недели', created_at: new Date(), author: 'пример',
  });
  if (!has('TASK')) appendRows_('TASK', [
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
  if (!has('BASE')) appendRows_('BASE', base.map(b => ({
    id: nextId_('BASE', cache), obj_id: EXAMPLE_ID, audience: b.audience, company: b.company, site: b.site, contact: b.contact,
    fit: b.fit, fit_note: b.fit_note, call_date: d_(b.call_date), call_result: b.call_result, kp_date: d_(b.kp_date), kp_type: b.kp_type,
    response: b.response, response_date: d_(b.response_date), next_step: b.next_step, owner: b.owner, created_at: d_(b.call_date || b.kp_date || '2026-09-14'), author: 'пример',
  })));

  if (!has('CONT')) appendRows_('CONT', [
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
  if (!requireAdmin_('Запустить самопроверку')) return;
  const ui = SpreadsheetApp.getUi();
  const withDoc = ui.alert('Самопроверка', 'Проверить также создание отчёта (Google Документ) по примеру? Будет создан тестовый отчёт в папке примера.', ui.ButtonSet.YES_NO) === ui.Button.YES;
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

  try { inboxFolder_(); } catch (e) { /* проверится ниже */ }
  Object.keys(SHEET_NAMES).forEach(k => check('Лист ' + SHEET_NAMES[k], ss.getSheetByName(SHEET_NAMES[k])));
  cfgDefs_().filter(d => d.key).forEach(d => check('Настройка CFG_' + d.key, ss.getRangeByName('CFG_' + d.key), ss.getRangeByName('CFG_' + d.key) ? '' : 'если ✗ — «Установить / обновить систему»'));
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
    check('Отчёт: заказчик из 01_ОБЪЕКТЫ', !!v.kv.CUSTOMER, v.kv.CUSTOMER);
    check('Отчёт: 5 пунктов в «Выполнение плана»', v.tables.PLAN_ROWS.length === 5, v.tables.PLAN_ROWS.length);
    check('Отчёт: 3 пункта в «План работы»', v.tables.NEXT_ROWS.length === 3, v.tables.NEXT_ROWS.length);
    check('Отчёт: в тексте нет контактов из обзвона', JSON.stringify(v).indexOf('+7') < 0);
    if (opts.withDoc) {
      try {
        const r = generateReport_(EXAMPLE_ID, '2026-W38', { interactive: false });
        const text = DocumentApp.openById(r.docId).getBody().getText();
        check('Отчёт: Google Документ создан', r.docUrl, r.docUrl);
        check('Отчёт: в документе не осталось меток {{…}}', !/\{\{[A-Z_]+\}\}/.test(text));
        check('Отчёт: в документе «Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА»', text.indexOf('Раздел 1. ВЫПОЛНЕНИЕ ПЛАНА') >= 0);
      } catch (e) {
        check('Отчёт: Google Документ создан', false, e.message);
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
    [PR, 'Стратегия объекта — для вставки во вкладку', 'Вся вкладка объекта сразу → меню «Вставить стратегию из Claude» (разделы + задачи на 2 недели)',
      'Ты — маркетолог-стратег по элитной и коммерческой недвижимости Москвы и МО. Работаешь на брокера агентства недвижимости с ЭКСКЛЮЗИВНЫМ договором на объект.\n\n' +
      'КОНТЕКСТ РАБОТЫ\n' +
      '- Цель — сделка (продажа / аренда) в ближайшие 2–4 месяца по цене не ниже согласованной с собственником.\n' +
      '- Каждую пятницу собственник получает отчёт о проделанной работе: задачи должны быть такими, чтобы их было не стыдно показать клиенту.\n' +
      '- Команда: брокер (переговоры, показы, решения), ассистент (базы, обзвон, рассылки, КП; норма в неделю — 10 звонков, 8 КП), SMM (контент). Бюджета на платную рекламу нет, если не указано иное.\n' +
      '- Работаем через прямой выход на ЛПР и через партнёров-посредников (им платим вознаграждение, если указано).\n\n' +
      'ПРАВИЛА\n' +
      '1. Не выдумывай факты. Всё, что не подтверждено данными объекта или поиском, помечай «проверить».\n' +
      '2. Аналоги ищи через поиск в интернете (ЦИАН, Авито, Яндекс Недвижимость, сайты агентств). Ссылку давай только на реально открытое объявление. Нет поиска — пиши ориентир и «проверить на ЦИАН».\n' +
      '3. Цена: для аренды — ₽/мес, для продажи — ₽ за объект. Учитывай условия (депозит, комиссия, что включено).\n' +
      '4. Аудитории — не «бизнесмены», а конкретный тип компаний / людей + должность ЛПР + где найти контакт.\n' +
      '5. Учитывай ограничения собственника (например: только долгосрочно, без трафика, не публиковать адрес). Сценарии, которые им противоречат, не предлагай.\n' +
      '6. Разделяй первую волну (ближайшие 2 недели, 2–3 направления) и вторую волну.\n\n' +
      'ШАГ 1 — ВОПРОСЫ\n' +
      'Прочитай данные объекта (и презентацию, если приложена). Если не хватает важного для стратегии — задай мне до 7 коротких вопросов списком и ЖДИ ответа. Типичные: условия сделки (срок, депозит, торг), что входит в цену, ограничения собственника, вознаграждение партнёрам, что уже пробовали и что не сработало, кто был прошлым покупателем / арендатором, какие материалы уже есть.\n' +
      'Если всё ясно — сразу переходи к шагу 2.\n\n' +
      'ШАГ 2 — СТРАТЕГИЯ\n' +
      'Ответ СТРОГО в формате ниже, без вступлений. Заголовки разделов как есть. Строки — значения через «|», без строки заголовков таблицы.\n\n' +
      '## Аналоги\nАдрес / ЖК | Назначение / тип | Площадь, м² (число) | Цена, ₽ (число) | Ссылка (или пусто) | Чем лучше / хуже нашего\n(5–8 сопоставимых предложений)\n\n' +
      '## Цена\nРекомендуемая цена: число\nМинимальная цена: число\nПозиционирование: 1–2 предложения — почему этот объект стоит своих денег и для кого\nВывод по цене: 2–3 предложения с опорой на аналоги и условия\n\n' +
      '## Сценарии\nСценарий | Чек-лист (одно из: {чек-листы}; или пусто) | Что проверить / какие документы запросить | Кого привлечь | Вывод\n(4–8 сценариев, реалистичных для этого объекта; неочевидные — с пометкой «неочевидный»)\n\n' +
      '## Аудитории\nАудитория (коротко, как её будет писать ассистент в базе обзвона) | Кто (Компании / Физлица / Инвесторы / Партнёры-посредники) | Портрет: зачем им объект, кто ЛПР | Где искать (конкретные площадки, реестры, организации) | Приоритет (★★★ — первая волна / ★★ / ★ — вторая волна)\n\n' +
      '## Каналы\nКанал / партнёр (конкретные названия, если уверен) | Что делаем и что предлагаем\n\n' +
      '## Материалы\nМатериал | Какое (КП клиенту / КП партнёру / Презентация под аудиторию / Письмо без вложения) | Для аудитории / сценария | Что должно быть внутри\n\n' +
      '## Выводы\nВывод | Что делаем дальше\n(3–5 главных решений: позиционирование, первая волна, что не делаем и почему)\n\n' +
      '## Задачи на 2 недели\n{ID объекта} | Блок стратегии | Задача | Исполнитель | Единица | План (число или пусто) | Срок (дд.мм.гггг)\n' +
      '(8–12 задач, реалистично для команды; задачу формулируй так, чтобы её можно было показать собственнику. Блок — одно из: Аналитика и цена, Сценарии использования, Целевые аудитории, КП и материалы, База и рассылки, Каналы и партнёры, Контент, Фото и видео, Объявления, Отчётность, Другое. Исполнитель — из: {сотрудники}. Единица — звонков / КП / ответов / публикаций / писем / встреч / документов / шт или пусто)'],
    [PR, 'Объявление для ЦИАН / Авито', 'Раздел «Объявления»: текст для агрегаторов',
      'Ты — копирайтер по недвижимости, пишешь объявления для ЦИАН и Авито для брокера с эксклюзивом на объект. Покупатель / арендатор листает десятки похожих объявлений: в первых двух строках он должен понять, что это за объект, для кого он и чем лучше соседних.\n\n' +
      'ПРАВИЛА\n' +
      '1. Только факты из данных объекта и презентации. Чего нет — не придумывай: спроси (шаг 1) или не пиши.\n' +
      '2. Без телефонов, e-mail, ссылок и названия агентства в тексте — площадки блокируют такие объявления.\n' +
      '3. Без КАПСА, «!!!», эмодзи и пустых слов («уникальный», «лучший», «срочно», «элитный» без доказательства). Вместо эпитетов — цифры: метры, минуты, кВт, высота потолков.\n' +
      '4. Точный адрес, номер дома / участка и имя собственника — только если в данных нет запрета. Если есть ограничение — локация через район, посёлок, шоссе и расстояния.\n' +
      '5. Для аренды — ставка ₽/мес и условия (срок, депозит, что включено); для продажи — цена и формат сделки.\n' +
      '6. Обычный текст без markdown (звёздочки и решётки на площадках не работают). Списки — через «— » с новой строки.\n' +
      '7. Длина описания (без финального блока) — 2000–3500 знаков.\n\n' +
      'ШАГ 1 — ВОПРОСЫ\n' +
      'Если не хватает данных для технических характеристик или условий (этаж / этажность, потолки, мощность, отделка, коммуникации, парковка, состояние, срок аренды, что входит в цену, документы) — задай мне до 7 коротких вопросов и ЖДИ ответа. Иначе — сразу шаг 2.\n\n' +
      'ШАГ 2 — ОБЪЯВЛЕНИЕ\n' +
      'Ответ строго в таком виде:\n\n' +
      'ЗАГОЛОВОК\n(до 70 знаков: тип объекта + главная выгода + локация / площадь)\n\n' +
      'ЕЩЁ 3 ВАРИАНТА ЗАГОЛОВКА\n(под разные аудитории из стратегии объекта)\n\n' +
      'ОПИСАНИЕ\n' +
      '(1) Первый абзац, 2–3 предложения: что за объект, для кого, главное преимущество. Именно он виден в выдаче.\n' +
      '(2) Об объекте: планировка, состояние, отделка, чем он удобен в жизни / в работе.\n' +
      '(3) Технические характеристики: списком — площадь, этаж / этажность, потолки, комнаты / зоны, санузлы / мокрые точки, мощность, коммуникации, отопление, парковка, участок и т. п. (только то, что известно).\n' +
      '(4) Локация и инфраструктура: транспорт и время в пути (метро, шоссе, аэропорт, центр), что рядом (школы, магазины, парки, бизнес-центры, клиники) — с расстояниями, если они есть в данных или проверены поиском.\n' +
      '(5) Условия сделки: цена / ставка, что входит, срок, депозит, обременения, документы.\n' +
      '(6) Финальный блок — дословно, без изменений:\n' +
      '{финальный блок объявления}\n\n' +
      'ПОЛЯ ДЛЯ ФОРМЫ ПЛОЩАДКИ\n(списком «поле — значение»: всё, что вносится в поля ЦИАН / Авито отдельно от текста; неизвестное — «уточнить»)'],
    [PR, 'Анализ цены по аналогам', 'Файл «Анализ аналогов» из папки «Аналитика» → Claude → «Вставить стратегию из Claude» (аналоги + цена)',
      'Ты — аналитик-оценщик коммерческой и жилой недвижимости Москвы и МО (сравнительный подход). Работаешь на брокера с эксклюзивом: ему нужна обоснованная рыночная цена и аргументы для разговора с собственником.\n\n' +
      'Я прикладываю файл «Анализ аналогов» (таблица ассистента: аналоги с ЦИАН / Авито, корректировки на торг, площадь, ремонт, ручные корректировки, итог) и/или скриншоты объявлений. Данные нашего объекта — ниже.\n\n' +
      'ЧТО СДЕЛАТЬ\n' +
      '1. Проверь выборку: дубли одного объекта у разных агентов, аренду коммерции в ₽/м² в ГОД вместо ₽/мес, несопоставимые объекты (другой тип, площадь больше чем в 2 раза, доля, обременение), явные ошибки цены. Каждый исключённый аналог — одной строкой: почему.\n' +
      '2. Проверь корректировки: торг (жильё 3–5 %, коммерция 5–10 %, загород 7–12 %, аренда 3–5 %), площадь по формуле (S нашего / S аналога)^b (коммерция b = −0,15, квартиры −0,10, дома −0,20), ремонт при продаже — в ₽/м² без мебели (два уровня: без отделки 0 / с ремонтом — комфорт 100 000 ₽/м², премиум 250 000 ₽/м²; white box отдельно не выделяем; мебель — отдельная ручная корректировка); при аренде ставка в месяц берётся из объявлений ЦИАН, разница в ремонте — ручная корректировка в %, ручные — есть ли обоснование и не завышены ли. Общая корректировка аналога (торг + площадь + ручные, без ремонта) больше 30 % — аналог не учитываем; аналоги с другим уровнем отделки — с меньшим весом.\n' +
      '3. Пересчитай: средневзвешенная цена за м² (вес больше у аналогов с меньшими корректировками и уровнем 1), рыночная цена объекта, диапазон, однородность выборки (коэффициент вариации ≤ 20 %). Покажи расчёт коротко.\n' +
      '4. Если учтённых аналогов меньше 5 или выборка разнородная — скажи прямо, что вывод предварительный, и что искать дополнительно (конкретные фильтры ЦИАН).\n' +
      '5. Сравни с ценой собственника и сроком экспозиции конкурентов.\n' +
      'Не выдумывай аналоги и цены: работай только с тем, что в файле / на скриншотах. Если чего-то не хватает — спроси.\n\n' +
      'ОТВЕТ — СТРОГО в формате ниже, без вступлений; строки таблиц через «|», без строки заголовков:\n\n' +
      '## Аналоги\nАдрес / ЖК | Назначение / тип | Площадь, м² (число) | Цена, ₽ (число, как в объявлении) | Ссылка | Комментарий: скорректированная цена за м², общая корректировка %, чем лучше / хуже нашего\n(только учтённые аналоги)\n\n' +
      '## Цена\nРекомендуемая цена: число — цена выставления (рынок + разумный запас на торг)\nМинимальная цена: число — нижняя граница сделки по рынку\nПозиционирование: 1–2 предложения — за счёт чего объект стоит своих денег\nВывод по цене: 2–4 предложения — рыночная цена за м² и объекта, диапазон, сколько аналогов, цена собственника к рынку в %, надёжность вывода\n\n' +
      '## Выводы\nВывод | Что делаем дальше\n(2–4 строки: цена, что сказать собственнику, что досмотреть на рынке)\n\n' +
      '## Разговор с собственником\n(это во вкладку не вставляется — для брокера)\n3–5 аргументов простым языком с цифрами из анализа: где наша цена относительно рынка, сколько висят конкуренты по такой цене, что будет при текущей цене и при рекомендуемой. Если цена собственника в рынке — аргументы, почему её держим.\n\n' +
      '## Не учтено\n(для ассистента — во вкладку не вставляется) объявление — причина'],
    [PR, 'Целевые аудитории объекта — для вставки', 'Раздел 4 «Аудитории» + база обзвона в 03_ОБЗВОН_И_КП → меню «Вставить стратегию из Claude»',
      'Ты — маркетолог-аналитик по элитной и коммерческой недвижимости Москвы и МО. Работаешь на брокера с эксклюзивом.\n' +
      'Задача: определить, КОМУ продавать / сдавать объект, и дать ассистенту готовый план обзвона. Ассистент в неделю делает около 10 звонков и 8 КП — план должен быть реальным.\n\n' +
      'ПРАВИЛА\n' +
      '1. Аудитория — конкретный тип покупателя / арендатора, а не «бизнесмены». Название короткое (2–4 слова): по нему ассистент ведёт базу обзвона, пиши его одинаково во всех разделах.\n' +
      '2. Для каждой аудитории: кто ЛПР (должность), зачем им ИМЕННО этот объект (опираясь на его параметры: площадь, локация, планировка, условия), где найти контакты.\n' +
      '3. Отдельно — партнёры-посредники, которые могут привести клиента (УК, консьерж-сервисы, relocation, архитекторы, брокеры деловой авиации, банки private banking…). Если в данных объекта есть вознаграждение партнёрам — используй его.\n' +
      '4. Учитывай ограничения собственника и условия сделки. Аудитории, которым объект не подходит, не предлагай.\n' +
      '5. Компании — только реальные, которые можно проверить поиском. Сайт указывай, только если открыл его. Не уверен в компании — не пиши её. Если поиска нет — вместо компаний напиши, где ассистенту их искать (2ГИС-рубрика, реестр, ассоциация).\n' +
      '6. Приоритет: ★★★ — первая волна (2–3 аудитории на ближайшие 2 недели), ★★ — вторая, ★ — гипотеза.\n' +
      '7. Если во вкладке уже есть аудитории (см. данные объекта) — не повторяй их, а дополни или предложи, какие убрать.\n\n' +
      'ШАГ 1 — если не хватает данных о покупателе (кто уже интересовался, кто купил / снимал похожее, что говорит собственник о прошлых клиентах, есть ли вознаграждение партнёрам) — задай до 5 коротких вопросов и ЖДИ ответа. Иначе — шаг 2.\n\n' +
      'ШАГ 2 — ответ строго в формате ниже, без вступлений; строки через «|», без строки заголовков таблицы:\n\n' +
      '## Аудитории\nАудитория | Кто (Компании / Физлица / Инвесторы / Партнёры-посредники) | Портрет: ЛПР и зачем им объект | Где искать | Приоритет (★★★ / ★★ / ★)\n(5–8 аудиторий, из них 2–3 неочевидные — с пометкой «неочевидная» в портрете)\n\n' +
      '## База для обзвона\nАудитория (точно как в разделе выше) | Компания | Сайт (или пусто) | Кому звонить: должность / отдел | Почему подходит (1 фраза)\n(только аудитории ★★★, по 5–10 реальных компаний на аудиторию)\n\n' +
      '## Каналы\nКанал / партнёр | Что делаем и что предлагаем\n\n' +
      '## Выводы\nВывод | Что делаем дальше\n(2–4 строки: с каких аудиторий начинаем и почему; какие не берём и почему)'],
    [PR, 'Портрет ЛПР и выход на него', 'Одна аудитория подробно: для скрипта звонка и КП',
      'Ты — маркетолог B2B / B2C в недвижимости. Объект — в данных ниже. Аудитория: {аудитория — впишите название из вкладки}.\n\n' +
      'Опиши подробно, коротко и по делу:\n' +
      '1. Кто принимает решение и кто влияет (должности); кто «привратник» (секретарь, ресепшн, администратор) и как его пройти.\n' +
      '2. Что для ЛПР важно в объекте, чего он боится, какие цифры захочет увидеть в КП (с опорой на параметры нашего объекта).\n' +
      '3. 5 главных возражений и короткие ответы на них.\n' +
      '4. Лучший канал первого контакта (звонок / письмо / мессенджер / через партнёра / мероприятие) и почему.\n' +
      '5. Первая фраза звонка (до 20 слов) и тема письма (до 60 знаков).\n' +
      'Не выдумывай фактов об объекте: чего нет в данных — так и напиши «уточнить».'],
    [PR, 'Скрипт звонка и письма', 'Работа с базой (03_ОБЗВОН_И_КП): выберите аудиторию в окне промпта',
      'Ты — эксперт по холодным продажам в недвижимости. Готовишь для ассистента брокера материалы для звонков и писем по объекту (данные ниже).\n' +
      'Аудитория: {аудитория}\n\n' +
      'ПРАВИЛА: пиши простым живым языком, без канцелярита и без «уникальных предложений». Только факты из данных объекта — чего нет, не придумывай. Цель первого контакта — не продать, а выйти на ЛПР и получить согласие посмотреть презентацию. Точный адрес не называй, если в данных есть ограничение.\n\n' +
      'Ответ — строго по разделам:\n\n' +
      '## Звонок\n1) Первая фраза (до 20 слов). 2) Как пройти секретаря / администратора — 3 варианта. 3) Разговор с ЛПР: 3–4 реплики, вопрос о потребности, предложение прислать презентацию. 4) Как закрепить договорённость (куда отправить, когда перезвонить).\n\n' +
      '## Возражения\n5 типовых возражений этой аудитории → короткий ответ (1–2 предложения).\n\n' +
      '## Письмо с КП\nТема (до 60 знаков) + текст до 700 знаков: зачем пишем, 3 факта-выгоды с цифрами, призыв к действию, просьба переслать ЛПР, если не по адресу.\n\n' +
      '## Мессенджер\nСообщение до 300 знаков для WhatsApp / Telegram после звонка.\n\n' +
      '## Форма на сайте\nТекст до 500 знаков для формы обратной связи.\n\n' +
      '## Повторный контакт\nСообщение через 3 дня, если нет ответа (до 300 знаков).'],
    [PR, 'Серия рилс на объект', 'Контент: 5 роликов на объект → «Вставить стратегию из Claude» (контент-план в 04_КОНТЕНТ, задачи SMM в 02_ЗАДАЧИ)',
      '{промпт серии рилс из документа}\n\n' +
      '═══════════ ДОПОЛНЕНИЯ СИСТЕМЫ (где они расходятся с текстом выше — следуй дополнениям) ═══════════\n\n' +
      '1. ВВОДНЫЕ ПО ОБЪЕКТУ бери из раздела «ДАННЫЕ ОБЪЕКТА» в самом конце: адрес, тип, сделка, площадь, цена, позиционирование, ограничения собственника, аудитории ★★★ (для кого — в ролике 5). Чего там нет (кодовое слово, что уже снято, соцсети, доступ к закрытым продажам, название рубрики, дата старта серии) — спроси в шаге 1 одним списком.\n\n' +
      '2. СЕРИЯ ИЗ 5 РОЛИКОВ ДЕЛАЕМ ДЛЯ КАЖДОГО ОБЪЕКТА. Линия серии зависит от типа объекта и сделки («квартира» в тексте выше = наш объект):\n' +
      '• Исторический дом / усадьба — как в промпте выше.\n' +
      '• Новостройка / клубный дом: ролик 1 — история района и места (оставляем); ролик 2 — люди и деньги этого места ИЛИ архитектура, застройщик, как рождается квартал; ролик 3 — дом и район сегодня и завтра (точки роста, инфраструктура, цены); ролик 4 — атмосфера; ролик 5 — продажа.\n' +
      '• Загородный дом: ролик 1 — направление и локация: природа, реки, озёра, леса, время до Москвы, парки, торговые центры, школы, фишки территории и направления; ролик 2 — если у места есть сильные исторические факты, история (связанная с землёй и домами), иначе — жизнь на этом направлении: кто здесь живёт, сценарий выходных; ролик 3 — посёлок и дом сегодня; ролик 4 — атмосфера; ролик 5 — продажа.\n' +
      '• Коммерция: ролик 1 — исторические денежные дела этой локации (торговля, купцы, промыслы, ярмарки, доходные дома); ролик 2 — почему локация приносит деньги сегодня: трафик, окружение, кто рядом зарабатывает; ролик 3 — развитие территории (КРТ, стройки, метро, рост населения); ролик 4 — атмосфера помещения; ролик 5 — продажа / аренда: для какого бизнеса, цифры.\n' +
      '• Аренда (любой тип): ролик 5 — «жизнь здесь» и приглашение на просмотр; не «купить», а «арендовать»; кодовое слово — для аренды.\n\n' +
      '3. ХУК — до 10 слов (3–4 с).\n\n' +
      '4. ОБЛОЖКИ: сетка профиля Instagram теперь вертикальная 3:4 (1080×1440). Заголовок и номер выпуска — в безопасной зоне 3:4; сам ролик — 9:16.\n\n' +
      '5. ПОДАЧА КАЖДОГО РОЛИКА — укажи одну: «Наталья в кадре» / «закадровый голос (озвучка)» / «только надписи». Для озвучки — отдельный текст диктору с паузами (/) и ударными словами (КАПС), хронометраж по числу слов.\n\n' +
      '6. ШАГ 4 ДЕЛИТСЯ: 4а — материалы, архив, единый шот-лист серии, атмосферные кадры, промпты генерации; 4б — покадровое ТЗ монтажёру (по 1–2 ролика за ответ, если не помещается).\n\n' +
      '7. Маркировка рекламы в сценариях и подписях не нужна.\n\n' +
      '8. ШАГ 5: шаблон еженедельного отчёта собственнику НЕ нужен — отчёт формирует система. Вместо него в конце шага 5 выдай два раздела для вставки в систему (строки через «|», без строки заголовков):\n\n' +
      '## Контент-план\nТема (Ролик N/5: название) | Площадка (Instagram / VK Клипы / Telegram / YouTube Shorts) | Формат (Рилс) | Цель (Найти покупателя / арендатора, Бренд агентства или Все три) | Дата публикации (дд.мм.гггг) | Кто делает | Сценарий — одной фразой\n(строка на каждый ролик и каждую площадку; график — 4–5 публикаций в неделю, серия за 7–10 дней; если SMM несколько — распредели ролики между ними)\n\n' +
      '## Задачи\n{ID объекта} | Блок (Фото и видео или Контент) | Задача | Исполнитель | Единица | План | Срок (дд.мм.гггг)\n(съёмка по шот-листу — 1–2 выезда; озвучка, если есть; монтаж каждого ролика; согласование сценариев и готовых роликов с Натальей до публикации. Исполнитель — из: {сотрудники}; съёмка, монтаж, озвучка — SMM, согласование — Наталья)'],
    [PR, 'Оперативка → задачи', 'Расшифровка Телемоста / Zoom или заметки встречи → ответ целиком в меню «Внести задачи с оперативки»',
      'Ты — помощник руководителя агентства недвижимости. Ниже — расшифровка оперативки: в ней всё подряд — объекты, рутина агентства, идеи, обсуждения, отвлечения.\n' +
      'Задача: превратить её в чёткий список задач для системы — без хаоса, без дублей и без лишнего.\n\n' +
      'ПРАВИЛА\n' +
      '1. Задача = конкретное действие + исполнитель + срок. Мысли вслух, «надо бы подумать», обсуждения без решения — НЕ задачи (в раздел «На обсуждение»).\n' +
      '2. Объект — строго по списку (ID — название): {объекты}. Задачи не про конкретный объект (CRM, соцсети агентства, регламенты, документы, найм, обучение, финансы) — ID «АГЕНТСТВО».\n' +
      '3. Исполнитель — строго из списка: {сотрудники}. Если не прозвучал — поставь по смыслу (базы, звонки, КП, рассылки, документы — ассистент; съёмка, монтаж, публикации — SMM; переговоры, согласования, решения — Наталья) и отметь в разделе «Уточнить».\n' +
      '4. Срок — дата дд.мм.гггг. Сегодня {сегодня}. «Завтра», «к пятнице», «на этой неделе» переводи в даты. Не прозвучал — пятница этой недели.\n' +
      '5. Одна задача — одна строка. Похожие объединяй, мелочь не дроби (звонок и письмо одному человеку — одна задача). Если у задачи есть объём — укажи Единицу и План (например, звонков 10).\n' +
      '6. Не повторяй задачи, которые уже есть в системе (список ниже). Если по ним прозвучало новое (срок, исполнитель, отмена) — в раздел «Изменения по существующим».\n' +
      '7. Решение — только то, что решили (например, «снижаем цену до…», «первая волна — Внуково-3»). Пиши в столбец «Решение» строки задачи или отдельной строкой без задачи.\n' +
      '8. Задачи по объектам формулируй так, чтобы их можно было показать собственнику (результат, а не «разобраться»).\n\n' +
      'ОТВЕТ — строго в таком виде:\n\n' +
      '## Задачи\n' +
      'ID объекта | Блок стратегии | Задача | Исполнитель | Единица | План | Срок | Решение\n' +
      '(Блок — одно из: Аналитика и цена, Сценарии использования, Целевые аудитории, КП и материалы, База и рассылки, Каналы и партнёры, Контент, Фото и видео, Объявления, Отчётность, Другое. Единица — звонков / КП / ответов / публикаций / писем / встреч / документов / шт или пусто. Сначала задачи по объектам, потом АГЕНТСТВО.)\n\n' +
      '## Изменения по существующим\n(задача из списка ниже — что изменить; если нет — «нет»)\n\n' +
      '## На обсуждение\n(идеи и вопросы без решения — списком; если нет — «нет»)\n\n' +
      '## Уточнить\n(что неясно в расшифровке: кто исполнитель, какой объект, какой срок; если нет — «нет»)\n\n' +
      'УЖЕ ЕСТЬ В СИСТЕМЕ (открытые задачи — не дублировать):\n{открытые задачи}\n\n' +
      'РАСШИФРОВКА ОПЕРАТИВКИ (вставьте ниже целиком):\n'],
    [RG, 'Регламент недели', 'Вся команда',
      'Пн — оперативка (Zoom), «Создать план недели», задачи по объектам в 02_ЗАДАЧИ.\nЕжедневно — ассистент ведёт 03_ОБЗВОН_И_КП (каждый звонок и КП — строкой, в тот же день); SMM — 04_КОНТЕНТ.\nПт — закрыть статусы задач, внести ручной факт; проверить просрочки.\nПн утром — «Отчёт клиенту» по каждому объекту → проверить → ссылку на отчёт клиенту.\nВ CRM переносим только реально заинтересованных (галочка «Передан в CRM»).'],
    [RG, 'Правила заполнения', 'Вся команда',
      'Один объект — одна вкладка, ID как в CRM. Аудитория в 03_ОБЗВОН_И_КП пишется так же, как во вкладке объекта. Задачи формулируем для клиента. КП партнёру — без наших контактов. Ничего не удаляем: неактуальное — статус «Отменено» / «Отказались». Формульные (серые) столбцы не трогаем.'],
    [SC, 'Письмо-рассылка по медцентрам (образец)', 'ЖК «Время», сети медцентров',
      'Здравствуйте! Предлагаю помещение для нового филиала клиники: 756 м², два этажа, метро Преображенская площадь — потолки 4,5 м, 152 кВт, 8 мокрых точек, 4 входа — соответствует требованиям СанПиН, переделка не требуется — 4000+ потенциальных пациентов в радиусе 500 м. Отправляю презентацию с планировками и расчётами. Если предложение интересно, напишите контактное лицо и телефон. Если вопрос не в вашей компетенции, перешлите письмо руководителю или директору по развитию.'],
  ];
}

/** Системные записи, которые заменены новыми: удаляются из 06_БИБЛИОТЕКА, если их никто не правил (автор «система»). */
const LIB_RETIRED = ['Сценарии использования и неочевидные аудитории', 'Портрет целевой аудитории', 'Сценарий рилс'];

function seedLibrary_() {
  let t = readTable_('LIB');
  const retire = t.rows.filter(r => LIB_RETIRED.indexOf(String(r.title).trim()) >= 0 && r.author === 'система').map(r => r._row).sort((x, y) => y - x);
  retire.forEach(r => t.sh.deleteRow(r));
  if (retire.length) t = readTable_('LIB');
  const have = {};
  t.rows.forEach(r => { have[String(r.title).trim()] = true; });
  // записи, которые никто не правил (автор «система»), обновляются до новой версии текста
  const defs = {};
  libraryDefaults_().forEach(d => { defs[d[1]] = d; });
  t.rows.forEach(r => {
    const d = defs[String(r.title).trim()];
    if (d && r.author === 'система' && String(r.text) !== d[3]) writeFields_(t.sh, 'LIB', r._row, { applies: d[2], text: d[3], updated_at: new Date() });
  });
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
  let r = ss_().getRangeByName('CFG_' + key);
  if (!r) { // настройка появилась в новой версии, а 08_НАСТРОЙКИ собраны старой — дописываем строку
    const sh = ss_().getSheetByName(SHEET_NAMES.CFG);
    if (!sh) return;
    const colA = sh.getRange(1, 1, sh.getMaxRows(), 1).getValues();
    let last = 0;
    colA.forEach((x, i) => { if (x[0] !== '') last = i + 1; });
    const d = cfgDefs_().find(x => x.key === key) || { label: key };
    sh.getRange(last + 1, 1, 1, 4).setValues([[key, d.label, '', 'заполняет скрипт']]);
    r = sh.getRange(last + 1, 3);
    ss_().setNamedRange('CFG_' + key, r);
  }
  r.setValue(v);
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
/**
 * Столбцы листа должны идти в порядке схемы. Если код обновили, а «Установить / обновить систему» не запускали,
 * порядок может не совпасть — тогда не читаем и не пишем (иначе данные попадут в чужие столбцы).
 */
function headerGuard_(code, sh) {
  headerGuard_.ok = headerGuard_.ok || {};
  if (headerGuard_.ok[code]) return;
  const spec = sheetSpecs_()[code];
  const cur = sh.getRange(1, 1, 1, Math.min(spec.fields.length, sh.getMaxColumns())).getDisplayValues()[0];
  const bad = spec.fields.find((f, i) => f.kind !== 'f' && cur[i] && cur[i] !== f.title && (f.was || []).indexOf(cur[i]) < 0);
  if (bad) throw new Error('Лист ' + spec.name + ' не совпадает с обновлённым кодом (столбец «' + bad.title + '»). Запустите МАРКЕТИНГ ОБЪЕКТОВ → Сервис → ⚙ Установить / обновить систему.');
  headerGuard_.ok[code] = true;
}

function readTable_(code) {
  const spec = sheetSpecs_()[code];
  const sh = sheet_(code);
  headerGuard_(code, sh);
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
  headerGuard_(code, sh);
  const cols = Object.keys(obj).map(k => {
    const f = fieldOf_(code, k);
    if (f.kind === 'f') throw new Error('Нельзя писать в формульный столбец ' + f.title);
    const v = obj[k];
    return { col: fieldIndex_(code, k), v: typeof v === 'string' && v[0] === '=' ? toLocaleF_(v) : v };
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
  return t.rows.find(r => String(r.id) === String(id)) || null;
}

function toast_(msg, title, sec) { try { ss_().toast(msg, title || SYS.MENU, sec || 5); } catch (e) { /* кабинет (веб-приложение) — всплывающих сообщений нет */ } }

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

// ───────────────────────── формулы и локаль таблицы ─────────────────────────
// Формулы в коде записаны по-английски: «,» между аргументами, «{a,b}» в массивах, «0.5».
// Таблица с русской (и любой «десятичная запятая») локалью разбирает формулы из скрипта по своим
// правилам: «;» между аргументами, «\» между столбцами массива, «0,5». Скрипт один раз проверяет,
// как таблица понимает формулы, и при необходимости переводит их перед записью.

function formulaSemicolon_() {
  if (formulaSemicolon_.v !== undefined) return formulaSemicolon_.v;
  const ss = ss_();
  const props = PropertiesService.getDocumentProperties();
  const loc = String(ss.getSpreadsheetLocale ? ss.getSpreadsheetLocale() : '');
  const saved = props.getProperty('FORMULA_SEP');
  if (saved && saved.indexOf(loc + '|') === 0) { formulaSemicolon_.v = saved.slice(loc.length + 1) === ';'; return formulaSemicolon_.v; }
  const tmp = ss.insertSheet('__formula_probe_' + Date.now());
  let semi = false;
  try {
    const c = tmp.getRange(1, 1);
    c.setFormula('=SUM(1,2)');
    SpreadsheetApp.flush();
    semi = String(c.getDisplayValue()) !== '3';
  } finally {
    ss.deleteSheet(tmp);
  }
  props.setProperty('FORMULA_SEP', loc + '|' + (semi ? ';' : ','));
  formulaSemicolon_.v = semi;
  return semi;
}

/** Английская запись формулы → запись локали таблицы (строки в кавычках и имена листов не трогаются). */
function toLocaleF_(f) {
  f = String(f);
  if (f[0] !== '=' || !formulaSemicolon_()) return f;
  return enToSemicolonF_(f);
}

function enToSemicolonF_(f) {
  let out = '';
  const stack = [];
  for (let i = 0; i < f.length; i++) {
    const ch = f[i];
    if (ch === '"') {                       // строка: до закрывающей кавычки ("" — экранированная)
      let j = i + 1;
      while (j < f.length) { if (f[j] === '"') { if (f[j + 1] === '"') { j += 2; continue; } break; } j++; }
      out += f.slice(i, j + 1); i = j; continue;
    }
    if (ch === "'") {                       // имя листа в апострофах
      let j = i + 1;
      while (j < f.length) { if (f[j] === "'") { if (f[j + 1] === "'") { j += 2; continue; } break; } j++; }
      out += f.slice(i, j + 1); i = j; continue;
    }
    if (ch === '(' || ch === '{') { stack.push(ch); out += ch; continue; }
    if (ch === ')' || ch === '}') { stack.pop(); out += ch; continue; }
    if (ch === ',') { out += stack[stack.length - 1] === '{' ? '\\' : ';'; continue; }
    if (ch === '.' && /\d/.test(f[i - 1] || '') && /\d/.test(f[i + 1] || '') && !/[A-Za-z_$]/.test(prevToken_(f, i))) { out += ','; continue; }
    out += ch;
  }
  return out;
}

/** Первый символ числа перед точкой: если число — часть ссылки/имени (A1.5 не бывает, но R1C1, имена) — не трогаем. */
function prevToken_(f, i) {
  let j = i - 1;
  while (j >= 0 && /\d/.test(f[j])) j--;
  return j >= 0 ? f[j] : '';
}

/** Удаляет «оборванные» строки журнала: есть ID от скрипта, но не заполнено ни одного поля ввода. */
function removeOrphanRows_(code) {
  const t = readTable_(code);
  const idKey = t.spec.idField;
  const rows = t.rows.filter(o => o[idKey] && !t.spec.fields.some(f => isInputKind_(f.kind) && f.kind !== 'cb' && o[f.key] !== '' && o[f.key] !== null));
  rows.reverse().forEach(o => t.sh.deleteRow(o._row));
  return rows.length;
}

/**
 * ID объекта в журналах — всегда текст: ID из CRM состоит из цифр, и Google Таблицы превращают его в число,
 * а в 01_ОБЪЕКТЫ ID — текст; тогда формулы не находят объект («⚠ нет объекта»).
 */
function fixObjIdColumns_() {
  ['TASK', 'BASE', 'CONT', 'ARCH', 'HIST'].forEach(code => {
    let sh;
    try { sh = sheet_(code); } catch (e) { return; }
    if (!sh) return;
    const col = fieldIndex_(code, 'obj_id');
    const n = lastDataRow_(sh, sheetSpecs_()[code]) - 1;
    const rng = sh.getRange(2, col, Math.max(n, 1), 1);
    const vals = rng.getValues();
    const bad = vals.some(r => typeof r[0] === 'number');
    sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    if (bad && n > 0) rng.setValues(vals.map(r => [typeof r[0] === 'number' ? String(r[0]) : r[0]]));
  });
}

/**
 * Блокировка для действий пользователя: ждём до 2 минут (фоновые задания работают короткими порциями).
 * Не дождались — понятное сообщение вместо «Тайм-аут блокировки».
 */
function userLock_() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(120000)) throw new Error('Система сейчас занята фоновым обновлением (вкладки объектов, входящие или отчёты). Подождите 1–2 минуты и нажмите ещё раз — вставленный текст останется в окне.');
  return lock;
}

// ═════════════ 13_Menu.gs ═════════════
/**
 * 13_Menu — меню «МАРКЕТИНГ ОБЪЕКТОВ».
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(SYS.MENU)
    .addItem('➜ Личные кабинеты (сайт)', 'webAppLink')
    .addItem('➜ Открыть вкладку объекта', 'openObjectTab')
    .addItem('➜ Разобрать папку «Входящие»', 'processInbox')
    .addItem('➜ Загрузить объекты списком', 'importObjects')
    .addItem('➜ Создать вкладки для новых объектов', 'createObjectTabs')
    .addItem('➜ Обновить документы объектов', 'refreshObjectFiles')
    .addSeparator()
    .addItem('➜ Создать план недели', 'createWeekPlan')
    .addItem('➜ Внести задачи с оперативки', 'importMeetingTasks')
    .addItem('➜ Проверить просрочки', 'checkOverdue')
    .addItem('➜ Синхронизировать задачи с календарём', 'syncCalendar')
    .addItem('Попросить сотрудников открыть доступ к календарю', 'requestCalendarAccess')
    .addItem('Отправить ассистенту инструкцию на почту', 'sendAssistantManual')
    .addSeparator()
    .addItem('➜ Промпт для Claude по объекту', 'promptForObject')
    .addItem('➜ Вставить стратегию из Claude', 'importStrategy')
    .addItem('Обновить шаблон анализа аналогов', 'updateAnalogTemplate')
    .addItem('➜ Обновить статистику соцсетей', 'refreshSocialStats')
    .addItem('➜ Отправить отмеченные в CRM', 'crmSendPending')
    .addItem('➜ Отправить отчёт клиенту в CRM', 'crmSendReport')
    .addItem('➜ Вставить ссылки на отчёты по рекламе CRM', 'pasteAdReportLinks')
    .addItem('➜ Проверить отчёты по рекламе CRM', 'checkAdReports')
    .addSeparator()
    .addItem('➜ Создать отчёт клиенту', 'createReport')
    .addSeparator()
    .addItem('➜ Дэшборд', 'openDashboard')
    .addItem('➜ Обновить (ID, вкладки, строки)', 'refreshAll')
    .addSeparator()
    .addSubMenu(ui.createMenu('Сервис')
      .addItem('⚙ Установить / обновить систему', 'setupSystem')
      .addItem('Обновить все вкладки объектов', 'rebuildObjectTabs')
      .addItem('Показать все вкладки объектов (в т.ч. закрытых)', 'showAllObjectTabs')
      .addItem('Удалить объект (только руководитель)', 'deleteObject')
      .addItem('Подключить Instagram / Threads', 'connectSocial')
      .addItem('Подключить CRM TopenLab', 'connectCrm')
      .addItem('Тест: комментарий в карточку CRM', 'crmTestNote')
      .addItem('Включить автообновление (входящие, календарь, соцсети)', 'enableDailyJobs')
      .addItem('Выключить автообновление', 'disableDailyJobs')
      .addItem('Включить автоотчёты (пятница 20:00 МСК)', 'enableAutoReports')
      .addItem('Выключить автоотчёты', 'disableAutoReports')
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
  let auds = [];
  try { auds = obj ? objectAudienceRows_(obj.id).map(a => a.name) : []; } catch (e) { /* без вкладки — без списка */ }
  const audOptions = '<option value="">— все аудитории объекта —</option>' + auds.map(a => '<option>' + htmlEscape_(a) + '</option>').join('');
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div>Объект: <b>' + htmlEscape_(obj ? obj.name + ' (' + obj.id + ')' : 'не выбран — промпт без данных объекта') + '</b></div>' +
    '<div style="margin:8px 0">Промпт: <select id="p" style="max-width:420px">' + options + '</select></div>' +
    (auds.length ? '<div style="margin:8px 0">Аудитория: <select id="a" style="max-width:420px">' + audOptions + '</select> <span style="color:#80868B;font-size:12px">для скрипта, КП, портрета ЛПР</span></div>' : '<input type="hidden" id="a" value="">') +
    '<textarea id="t" style="width:100%;height:330px;font:12px monospace"></textarea>' +
    '<div style="margin-top:8px"><button onclick="copyIt()">Скопировать</button> ' +
    '<a href="https://claude.ai/new" target="_blank">Открыть Claude</a> <span id="s" style="color:#2E7D32"></span></div>' +
    '<div style="color:#80868B;font-size:12px;margin-top:6px">Вставьте текст в Claude (ваша подписка). Ответ перенесите в нужный раздел вкладки объекта. Использование промпта записывается в 09_ИСТОРИЯ.</div></div>' +
    '<script>' +
    'const objId=' + JSON.stringify(obj ? obj.id : '') + ';' +
    'function load(){document.getElementById("t").value="Собираю…";google.script.run.withSuccessHandler(function(x){document.getElementById("t").value=x;}).withFailureHandler(function(e){document.getElementById("t").value="Ошибка: "+e.message;}).getPromptText(objId,document.getElementById("p").value,document.getElementById("a").value);}' +
    'function copyIt(){const t=document.getElementById("t");t.select();try{navigator.clipboard.writeText(t.value);}catch(e){document.execCommand("copy");}document.getElementById("s").textContent="Скопировано";}' +
    'document.getElementById("p").onchange=load;document.getElementById("a").onchange=load;load();' +
    '</script>').setWidth(620).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Промпт для Claude');
}

/** Вызывается из диалога: текст промпта с данными объекта. */
function getPromptText(objId, libId, audience) {
  const p = readTable_('LIB').rows.find(r => r.id === libId);
  if (!p) throw new Error('Промпт не найден');
  const obj = objId ? objectById_(objId) : null;
  let text = String(p.text || '');
  text = text.replace(/\{объекты\}/g, readTable_('OBJ').rows.filter(o => o.id && o.name && o.in_work !== 'НЕТ').map(o => o.id + ' — ' + o.name).join('; '));
  text = text.replace(/\{сотрудники\}/g, dictValues_('people').join(', '));
  if (text.indexOf('{сегодня}') >= 0) text = text.replace(/\{сегодня\}/g, fmtDate_(today_()) + ' (' + ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'][today_().getDay()] + ')');
  if (text.indexOf('{открытые задачи}') >= 0) {
    const names = {};
    readTable_('OBJ').rows.forEach(o => { names[String(o.id)] = o.name; });
    const open = readTable_('TASK').rows.filter(t => t.task && (t.status ? dictClassOf_('task_status', t.status) : CLS.OPEN) === CLS.OPEN);
    text = text.replace(/\{открытые задачи\}/g, open.length ? open.map(t => '• ' + t.obj_id + ' (' + (names[String(t.obj_id)] || '') + '): ' + t.task + ' — ' + (t.owner || '—') + ', срок ' + fmtDate_(t.deadline)).join('\n') : '(нет)');
  }
  text = text.replace(/\{чек-листы\}/g, readTable_('LIB').rows.filter(r => r.kind === 'Чек-лист' && r.title).map(r => r.title).join('; '));
  if (text.indexOf('{промпт серии рилс из документа}') >= 0) { const doc = promptFromDoc_(cfgGet_('REELS_PROMPT_DOC') || findReelsPromptDoc_()); text = text.replace('{промпт серии рилс из документа}', () => doc); }
  if (text.indexOf('{финальный блок объявления}') >= 0) {
    let footer = String(cfgGet_('AD_FOOTER') || (cfgDefs_().find(d => d.key === 'AD_FOOTER') || {}).value || '').trim();
    if (obj && /аренд/i.test(String(obj.deal))) footer = footer.replace(/по продаже/g, 'по аренде');
    text = text.replace(/\{финальный блок объявления\}/g, footer);
  }
  if (obj) text = text.replace(/\{ID объекта\}/g, obj.id);
  if (obj && /\{аудитори[^}]*\}/i.test(text)) text = text.replace(/\{аудитори[^}]*\}/gi, audiencePromptText_(obj.id, audience));
  if (obj) text = text.replace(/\{(?!текст\})[^{}]{2,80}\}/g, '(см. «Данные объекта» ниже)');
  const out = text + (obj ? '\n\n' + objectContext_(obj) : '');
  logHistory_([{ sheet: 'Claude (подписка)', record_id: p.id, obj_id: obj ? obj.id : '', field: 'Промпт: ' + p.title, old: '', new: 'сформирован для копирования', kind: 'Промпт' }], userEmail_());
  return out;
}

/** Ищет на Диске документ с промптом серии рилс («ПРОМПТ-СЕРИЯ…» с меткой «НАЧАЛО ПРОМПТА»), запоминает ссылку в 08_НАСТРОЙКИ. */
function findReelsPromptDoc_() {
  const q = [
    'title contains "ПРОМПТ-СЕРИЯ" and mimeType = "application/vnd.google-apps.document" and trashed = false',
    'fullText contains "НАЧАЛО ПРОМПТА" and fullText contains "Reels" and mimeType = "application/vnd.google-apps.document" and trashed = false',
  ];
  for (let i = 0; i < q.length; i++) {
    const it = DriveApp.searchFiles(q[i]);
    let best = null;
    while (it.hasNext()) { const f = it.next(); if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f; }
    if (best) { const url = best.getUrl(); cfgSet_('REELS_PROMPT_DOC', url); return url; }
  }
  return '';
}

/** Текст промпта из Google Doc (между строками «НАЧАЛО ПРОМПТА» и «КОНЕЦ ПРОМПТА»; без меток — весь документ). */
function promptFromDoc_(link) {
  const id = (/\/d\/([\w-]{20,})/.exec(String(link || '')) || [])[1] || (/^[\w-]{20,}$/.test(String(link || '').trim()) ? String(link).trim() : '');
  if (!id) throw new Error('Не указана ссылка на документ с промптом: 08_НАСТРОЙКИ → «Ссылка на Google Doc с промптом «Серия рилс на объект»».');
  const text = DocumentApp.openById(id).getBody().getText();
  const lines = text.split(/\r?\n/);
  const a = lines.findIndex(l => /НАЧАЛО ПРОМПТА/.test(l)), b = lines.findIndex(l => /КОНЕЦ ПРОМПТА/.test(l));
  return (a >= 0 && b > a ? lines.slice(a + 1, b) : lines).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Выбранная аудитория с портретом из вкладки (или все аудитории объекта). */
function audiencePromptText_(objId, audience) {
  const rows = objectAudienceRows_(objId);
  const one = audience ? rows.filter(a => a.name === audience) : rows;
  if (!one.length) return audience || '(аудитории — в разделе «Целевые аудитории» данных объекта ниже)';
  const st = audienceStats_(objId);
  return one.map(a => '«' + a.name + '»' + (a.who ? ' (' + a.who + ')' : '') + (a.portrait ? ' — ' + a.portrait : '') + (a.where ? '; где искать: ' + a.where : '') +
    (st[a.name] ? '; уже в работе: компаний ' + st[a.name].total + ', КП ' + st[a.name].kp + ', интерес ' + st[a.name].yes : '')).join('\n');
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

/** Уже есть открытая задача с тем же текстом по этому объекту — не вносим повторно. */
function dropDuplicateTasks_(r) {
  const norm = x => String(x || '').trim().toLowerCase().replace(/[«»"'.,:;!?()]/g, '').replace(/\s+/g, ' ');
  const open = {};
  readTable_('TASK').rows.forEach(t => {
    const cls = t.status ? dictClassOf_('task_status', t.status) : CLS.OPEN;
    if (t.task && cls === CLS.OPEN) open[String(t.obj_id) + '|' + norm(t.task)] = true;
  });
  const dups = [];
  r.ok = r.ok.filter(o => {
    const k = String(o.obj_id) + '|' + norm(o.task);
    if (o.task && open[k]) { dups.push(o.task); return false; }
    open[k] = true;
    return true;
  });
  r.dups = dups;
  return r;
}

function previewMeetingTasks(text) {
  const r = dropDuplicateTasks_(parseMeetingTasks_(text));
  if (r.dups.length) r.errors = r.errors.concat(r.dups.map(t => 'Уже есть в системе, не вносится повторно: ' + t));
  return { ok: r.ok.map(o => ({ obj_id: o.obj_id, task: o.task, owner: o.owner, deadlineText: o.deadline ? fmtDate_(o.deadline) : 'пятница текущей недели', decision: !!o.decision })), errors: r.errors };
}

function addMeetingTasks(text) {
  const r = dropDuplicateTasks_(parseMeetingTasks_(text));
  if (!r.ok.length) return 'Нет задач для внесения.';
  const lock = userLock_();
  try {
    const res = addMeetingTasks_(r);
    return 'Внесено задач: ' + res.tasks + (res.decisions ? ', решений: ' + res.decisions : '') + (r.dups.length ? '. Уже были в системе (не внесены): ' + r.dups.length : '') + (r.errors.length ? '. Пропущено строк: ' + r.errors.length : '') + '.';
  } finally {
    lock.releaseLock();
  }
}

/** Разобранные строки → 02_ЗАДАЧИ (+ решения во вкладки и документ стратегии). Блокировку держит вызывающий. */
function addMeetingTasks_(r, source) {
  const cache = {};
  const openName = dictFirstByClass_('task_status', CLS.OPEN);
  const user = userEmail_();
  const today = today_();
  const rows = r.ok.filter(o => o.task).map(o => {
    const deadline = o.deadline || addDays_(mondayOf_(today), 4);
    return {
      id: nextId_('TASK', cache), week: isoWeekKey_(deadline), obj_id: o.obj_id, block: o.block, task: o.task, owner: o.owner,
      unit: o.unit, plan: o.plan, deadline: deadline, status: openName, to_report: true, source: source || 'Оперативка', created_at: new Date(), author: user,
    };
  });
  appendRows_('TASK', rows);
  let dec = 0;
  const hist = [];
  r.ok.filter(o => o.decision).forEach(o => {
    const obj = objectById_(o.obj_id);
    const tab = obj ? findObjectTab_(obj) : null;
    if (!tab) { if (isServiceObject_(obj)) dec++; return; }
    appendTabRow_(tab, 'DEC', [today, o.decision, o.owner || '', o.task || '']);
    hist.push({ sheet: tab.getName(), record_id: 'раздел 7', obj_id: o.obj_id, field: '7. ВЫВОДЫ И РЕШЕНИЯ · с оперативки', old: '', new: o.decision, kind: HIST_KIND.CREATE });
    dec++;
  });
  // решения с оперативки — в документ стратегии каждого объекта
  const byObj = {};
  r.ok.filter(o => o.decision).forEach(o => { (byObj[o.obj_id] = byObj[o.obj_id] || []).push(o.decision + (o.task ? ' → ' + o.task : '')); });
  Object.keys(byObj).forEach(id => { const obj = objectById_(id); if (obj) { try { appendStrategyDoc_(obj, 'решения с оперативки', [{ title: 'Решения', lines: byObj[id] }]); } catch (e) { /* документ пополнится вручную */ } } });
  logHistory_(hist, user);
  return { tasks: rows.length, decisions: dec };
}

/** Разбор таблицы: «|»-таблица (markdown) или строки через табуляцию. */
function parseMeetingTasks_(text, forceObjId) {
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
    if (/id объекта|^задача$/i.test(cells[0]) || norm(cells[2]) === 'задача' || norm(cells[1]) === 'задача') return; // заголовок
    // задачи из стратегии одного объекта: объект известен; если столбец ID Claude пропустил — добавляем
    if (forceObjId) {
      const hasId = cells.length > 7 || objs.some(o => norm(o.id) === norm(cells[0]));
      cells = [String(forceObjId)].concat(hasId ? cells.slice(1) : cells);
    }
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
 * 15_Calendar — задачи 02_ЗАДАЧИ в Google Календаре: каждому — только его задачи.
 *
 * Событие на весь день в дату «Срок» ставится в календарь исполнителя:
 *  - свои задачи (исполнитель = тот, кто запускает систему) — в основной календарь;
 *  - задачи сотрудника — прямо в его календарь, если он открыл доступ «Внесение изменений в мероприятия»
 *    для владельца системы (Настройки Google Календаря → доступ для отдельных пользователей);
 *  - если доступа нет — в личный календарь «Задачи: Имя», который владелец системы создаёт и открывает сотруднику на просмотр
 *    (сотрудник один раз нажимает «Добавить календарь» в письме Google; у владельца этот календарь скрыт).
 * Выполнено → в названии «✓»; Отменено / Перенесено → событие удаляется. Изменили срок / исполнителя → событие обновляется или переезжает.
 * В «Событие календаря» хранится «ID календаря::ID события». Обрабатываются задачи со сроком не старше 14 дней.
 */

const PERSON_CALENDAR_PREFIX = 'Задачи: ';

function syncCalendar() {
  const r = syncCalendar_();
  toast_('Календарь: создано ' + r.created + ', обновлено ' + r.updated + ', удалено ' + r.deleted +
    (r.shared.length ? '. Напрямую в календарь: ' + r.shared.join(', ') : '') +
    (r.personal.length ? '. В личный календарь «Задачи: …»: ' + r.personal.join(', ') : '') +
    (r.shareErrors.length ? '. ⚠ Не удалось открыть календарь: ' + r.shareErrors.join('; ') : '') +
    (r.noEmail.length ? '. Нет email у: ' + r.noEmail.join(', ') + ' (07_СПРАВОЧНИКИ)' : ''), 'Google Календарь', 12);
}

function syncCalendar_() {
  const t = readTable_('TASK');
  const mine = CalendarApp.getDefaultCalendar();
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const emails = {};
  dictRows_('people').forEach(p => { emails[p[0]] = String(p[2] || '').trim().toLowerCase(); });
  const url = ss_().getUrl();
  const from = addDays_(today_(), -14);
  const res = { created: 0, updated: 0, deleted: 0, noEmail: [], shared: [], personal: [], shareErrors: [] };
  const cals = {}, personal = {};
  // календарь исполнителя: {cal, guest}
  const target = owner => {
    const email = emails[owner] || '';
    if (!email || email === me) return { cal: mine, guest: '' };
    if (!(email in cals)) cals[email] = writableCalendar_(email);
    if (cals[email]) { if (res.shared.indexOf(owner) < 0) res.shared.push(owner); return { cal: cals[email], guest: '' }; }
    if (!personal[email]) personal[email] = personalCalendar_(owner, email, res);
    if (res.personal.indexOf(owner) < 0) res.personal.push(owner);
    return { cal: personal[email], guest: '' };
  };
  const find = ref => {
    if (!ref) return null;
    const parts = String(ref).split('::');
    const calId = parts.length > 1 ? parts[0] : '', evId = parts.length > 1 ? parts[1] : parts[0];
    try {
      const c = calId ? (calId === mine.getId() ? mine : CalendarApp.getCalendarById(calId)) : mine;
      const ev = c ? c.getEventById(evId) : null;
      return ev ? { ev: ev, calId: c.getId() } : null;
    } catch (e) { return null; }
  };
  t.rows.forEach(o => {
    if (!o.obj_id || !o.task) return;
    const cls = o.status ? dictClassOf_('task_status', o.status) : CLS.OPEN;
    const cur = find(o.cal_event);
    if (cls === CLS.CANCEL || cls === CLS.MOVED) {
      if (cur) { cur.ev.deleteEvent(); res.deleted++; }
      if (o.cal_event) writeFields_(t.sh, 'TASK', o._row, { cal_event: '' });
      return;
    }
    if (!(o.deadline instanceof Date) || o.deadline < from) return;
    if (o.owner && !emails[o.owner] && res.noEmail.indexOf(o.owner) < 0) res.noEmail.push(o.owner);
    const tg = target(o.owner);
    const title = (cls === CLS.DONE ? '✓ ' : '') + o.obj_name + ': ' + o.task + (o.plan !== '' ? ' (' + o.plan + (o.unit ? ' ' + o.unit : '') + ')' : '');
    const desc = 'Задача ' + o.id + ' · исполнитель: ' + (o.owner || '—') + '\nСтатус: ' + (o.status || '—') + '\nТаблица: ' + url;
    let ev = cur && cur.calId === tg.cal.getId() ? cur.ev : null;
    if (cur && !ev) { cur.ev.deleteEvent(); res.deleted++; } // исполнитель сменился / появился доступ к его календарю — событие переезжает
    if (!ev) {
      if (cls === CLS.DONE) { if (o.cal_event) writeFields_(t.sh, 'TASK', o._row, { cal_event: '' }); return; } // выполненные заново не ставим
      ev = tg.cal.createAllDayEvent(title, o.deadline, { description: desc, guests: tg.guest, sendInvites: !!tg.guest });
      writeFields_(t.sh, 'TASK', o._row, { cal_event: tg.cal.getId() + '::' + ev.getId() });
      res.created++;
      return;
    }
    let changed = false;
    if (ev.getTitle() !== title) { ev.setTitle(title); changed = true; }
    if (ev.getDescription() !== desc) { ev.setDescription(desc); changed = true; }
    const start = ev.getAllDayStartDate();
    if (!start || start.getTime() !== o.deadline.getTime()) { ev.setAllDayDate(o.deadline); changed = true; }
    const guests = ev.getGuestList().map(g => g.getEmail().toLowerCase());
    guests.forEach(g => { if (g !== tg.guest) { ev.removeGuest(g); changed = true; } });
    if (tg.guest && guests.indexOf(tg.guest) < 0) { ev.addGuest(tg.guest); changed = true; }
    if (changed) res.updated++;
  });
  return res;
}

/** Личный календарь «Задачи: Имя» у владельца системы: скрыт у владельца, открыт сотруднику на просмотр (один раз). */
function personalCalendar_(name, email, res) {
  const title = PERSON_CALENDAR_PREFIX + name;
  let c = CalendarApp.getOwnedCalendarsByName(title)[0];
  if (!c) {
    c = CalendarApp.createCalendar(title, { summary: 'Задачи из системы эксклюзивов для: ' + name + '. Обновляется автоматически каждый час.' });
    try { c.setSelected(false); } catch (e) { /* видимость — вручную */ }
  }
  const props = PropertiesService.getScriptProperties();
  const key = 'CAL_SHARE_' + c.getId() + '_' + email;
  if (!props.getProperty(key)) {
    const r = UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(c.getId()) + '/acl?sendNotifications=true', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ role: 'reader', scope: { type: 'user', value: email } }),
    });
    if (r.getResponseCode() < 300) props.setProperty(key, fmtDate_(new Date()));
    else if (res) res.shareErrors.push(name + ': ' + r.getContentText().slice(0, 120) + ' — откройте календарь «' + title + '» для ' + email + ' вручную (Настройки календаря → Доступ)');
  }
  return c;
}

/** Письмо сотрудникам, чей календарь недоступен: как открыть доступ владельцу системы. Один раз на человека (force — повторить). */
function requestCalendarAccess_(force) {
  const props = PropertiesService.getScriptProperties();
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const boss = String(cfgGet_('MANAGER_NAME') || 'руководитель');
  const sent = [];
  dictRows_('people').forEach(p => {
    const name = String(p[0] || '').trim(), email = String(p[2] || '').trim().toLowerCase();
    if (!name || !/@/.test(email) || email === me) return;
    if (!force && props.getProperty('CAL_REQ_' + email)) return;
    if (writableCalendar_(email)) return;
    const html = '<p>Здравствуйте!</p>' +
      '<p>Чтобы задачи из системы эксклюзивов приходили <b>прямо в ваш Google Календарь</b> (а не приглашениями), откройте, пожалуйста, доступ к своему календарю — это 1 минута:</p>' +
      '<ol><li>Откройте <a href="https://calendar.google.com">calendar.google.com</a> на компьютере.</li>' +
      '<li>Слева в «Мои календари» наведите на календарь со своим именем → ⋮ → <b>«Настройки и общий доступ»</b>.</li>' +
      '<li>Раздел <b>«Доступ для отдельных пользователей и групп»</b> → «Добавить пользователей и группы».</li>' +
      '<li>Впишите <b>' + me + '</b>, права — <b>«Внесение изменений в мероприятия»</b> → «Отправить».</li></ol>' +
      '<p>В течение часа ваши задачи (со сроками) появятся в вашем календаре: выполнено — с «✓», перенос срока — событие переедет само. Пока доступа нет, ваши задачи — в календаре «Задачи: ваше имя»: откройте письмо Google о доступе к нему и нажмите «Добавить календарь».</p>' +
      '<p>' + boss + '</p>';
    MailApp.sendEmail({ to: email, subject: 'Задачи в ваш Google Календарь: откройте доступ (1 минута)', htmlBody: html, name: boss });
    props.setProperty('CAL_REQ_' + email, fmtDate_(new Date()));
    sent.push(name);
  });
  return sent;
}

/** Меню: повторно отправить сотрудникам просьбу открыть доступ к календарю. */
function requestCalendarAccess() {
  if (!requireAdmin_('Попросить сотрудников открыть доступ к календарю')) return;
  const s = requestCalendarAccess_(true);
  toast_(s.length ? 'Письмо с инструкцией отправлено: ' + s.join(', ') : 'Всем сотрудникам с email доступ к календарю уже открыт.', 'Google Календарь', 8);
}

/** Календарь сотрудника, если он открыл владельцу системы доступ на изменение событий; иначе null. Проверка кэшируется на 6 часов. */
function writableCalendar_(email) {
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  const key = 'calw_' + email;
  const known = cache ? cache.get(key) : null;
  if (known === '0') return null;
  let c = null;
  try { c = CalendarApp.getCalendarById(email); } catch (e) { c = null; }
  if (!c) { // доступ дан, но календарь ещё не добавлен в список — добавляем скрытым (в вашем календаре его события не видны)
    try { c = CalendarApp.subscribeToCalendar(email, { selected: false }); } catch (e) { c = null; }
  }
  let ok = !!c;
  if (c && known !== '1') {
    try { const ev = c.createAllDayEvent('проверка доступа', new Date(2000, 0, 1), {}); ev.deleteEvent(); } catch (e) { ok = false; }
  }
  if (cache) cache.put(key, ok ? '1' : '0', 21600);
  return ok ? c : null;
}

// ───────────────────────── ежедневное обновление ─────────────────────────

/** Каждое утро: календарь, статистика соцсетей, списки документов, копии вкладок, восстановление и защита объектов. */
function dailyJobs() {
  try { syncCalendar_(); } catch (e) { Logger.log('Календарь: ' + e.message); }
  try { refreshSocialStats_(); } catch (e) { Logger.log('Статистика: ' + e.message); }
  try { registerOldReports_(); } catch (e) { Logger.log('Старые отчёты: ' + e.message); }
  try { refreshObjectFiles_(); } catch (e) { Logger.log('Документы: ' + e.message); }
  try { backupObjectTabs_(); } catch (e) { Logger.log('Копии вкладок: ' + e.message); }
  try { tabsWork_(); protectAll_(); } catch (e) { Logger.log('Вкладки / защита: ' + e.message); }
  try { ensureMediaTasks_(); } catch (e) { Logger.log('Задачи фото и видео: ' + e.message); }
  try { ensureAdLinkTasks_(); } catch (e) { Logger.log('Задачи ссылок на отчёт по рекламе: ' + e.message); }
  try { scheduleFollowUps_(); } catch (e) { Logger.log('Повторные контакты: ' + e.message); }
  try { refreshIdleAudiences_(); } catch (e) { Logger.log('Аудитории без базы: ' + e.message); }
  try { refreshBaseAudienceLists_(); } catch (e) { Logger.log('Списки аудиторий: ' + e.message); }
}

/** Задачи → Google Календарь каждый час (в течение дня новые задачи и сроки появляются у исполнителей). */
function calendarJob() {
  try { syncCalendar_(); } catch (e) { Logger.log('Календарь: ' + e.message); }
}

/** Ставит недостающие автозапуски: утреннее обновление 7:00, входящие каждые 10 минут, календарь каждый час, сводка 9:00. */
function ensureJobTriggers_() {
  const have = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  const added = [];
  if (have.indexOf('dailyJobs') < 0) { ScriptApp.newTrigger('dailyJobs').timeBased().everyDays(1).atHour(7).inTimezone(SYS.TZ).create(); added.push('утреннее обновление 7:00'); }
  if (have.indexOf('inboxJob') < 0) { ScriptApp.newTrigger('inboxJob').timeBased().everyMinutes(10).create(); added.push('входящие каждые 10 минут'); }
  if (have.indexOf('calendarJob') < 0) { ScriptApp.newTrigger('calendarJob').timeBased().everyHours(1).create(); added.push('календарь каждый час'); }
  if (have.indexOf('digestJob') < 0) { ScriptApp.newTrigger('digestJob').timeBased().everyDays(1).atHour(9).inTimezone(SYS.TZ).create(); added.push('сводка 9:00'); }
  return added;
}

/** Утренняя сводка сотрудникам — отдельный запуск в 9:00 по Москве (после утреннего обновления в 7:00). */
function digestJob() {
  try { sendDailyDigest_(); } catch (e) { Logger.log('Утренняя сводка: ' + e.message); }
}

function enableDailyJobs() {
  if (!requireAdmin_('Включить автообновление')) return;
  disableDailyJobs_();
  ScriptApp.newTrigger('calendarJob').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('dailyJobs').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('inboxJob').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('digestJob').timeBased().everyDays(1).atHour(9).inTimezone(SYS.TZ).create();
  toast_('Каждое утро (около 7:00) — календарь, статистика соцсетей, документы, повторные контакты. В 9:00 — сводка сотрудникам на почту. Каждые 10 минут — разбор папки 04_ВХОДЯЩИЕ.', 'Автообновление', 8);
}

function disableDailyJobs() {
  if (!requireAdmin_('Выключить автообновление')) return;
  disableDailyJobs_();
  toast_('Ежедневное обновление выключено.', 'Ежедневное обновление', 5);
}

function disableDailyJobs_() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'dailyJobs' || t.getHandlerFunction() === 'inboxJob' || t.getHandlerFunction() === 'digestJob' || t.getHandlerFunction() === 'calendarJob') ScriptApp.deleteTrigger(t); });
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
const IG_FB_API = 'https://graph.facebook.com/v23.0'; // ключи «EAA…» (вход через Facebook): аккаунт Instagram по его ID

/** Ключ Instagram через Facebook («EAA…») — другой адрес API и обращение по ID аккаунта, а не /me. */
function igIsFb_(tok) { return /^EAA/.test(String(tok || '')); }
function igBase_(tok) { return igIsFb_(tok) ? IG_FB_API : IG_API; }
function igNode_(tok) { return igIsFb_(tok) ? (socialProps_().getProperty('IG_ACCOUNT_ID') || 'me') : 'me'; }
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
  if (net === 'IG' && igIsFb_(tok)) return tok; // ключ Facebook продлевается в приложении Meta, не здесь
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
  const base = igBase_(tok);
  try { map = metaMediaMap_(base + '/' + igNode_(tok) + '/media?fields=id,permalink&limit=100&access_token=' + encodeURIComponent(tok), instagramCode_); }
  catch (e) { res.failed += items.length; Logger.log('Instagram: ' + e.message); return; }
  items.forEach(x => {
    const id = map[x.code];
    if (!id) { res.notFound++; return; }
    let r = metaGet_(base + '/' + id + '/insights?metric=views,reach,saved&access_token=' + encodeURIComponent(tok));
    if (r.error) r = metaGet_(base + '/' + id + '/insights?metric=reach,saved&access_token=' + encodeURIComponent(tok));
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
  if (!requireAdmin_('Подключить Instagram / Threads')) return;
  const st = socialStatus();
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<p>Вставьте ключи доступа (токены) из приложения Meta — как их получить, описано в инструкции «06 — Подключение Instagram и Threads». ' +
    'Ключи хранятся в свойствах скрипта, в таблице их не видно. Пустое поле — оставить как есть.</p>' +
    '<p><b>Instagram</b>: <span id="si">' + htmlEscape_(st.ig) + '</span><br><input id="ig" style="width:100%" placeholder="IGAA… или EAA…"></p>' +
    '<p style="font-size:12px;color:#5f6368">Для ключа «EAA…» (через Facebook) — ID аккаунта Instagram (IG_USER_ID, 1784…); пусто — система попробует найти сама:<br><input id="igid" style="width:100%" value="' + htmlEscape_(socialProps_().getProperty('IG_ACCOUNT_ID') || '') + '"></p>' +
    '<p><b>Threads</b>: <span id="st">' + htmlEscape_(st.th) + '</span><br><input id="th" style="width:100%" placeholder="THAA…"></p>' +
    '<button onclick="save()">Проверить и сохранить</button> <button onclick="off()">Отключить оба</button>' +
    '<div id="r" style="margin-top:10px"></div></div><script>' +
    'function show(x){document.getElementById("si").textContent=x.ig;document.getElementById("st").textContent=x.th;document.getElementById("r").textContent=x.msg||"";}' +
    'function save(){document.getElementById("r").textContent="Проверяю…";google.script.run.withSuccessHandler(show).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).saveSocialTokens(document.getElementById("ig").value,document.getElementById("th").value,document.getElementById("igid").value);}' +
    'function off(){google.script.run.withSuccessHandler(show).removeSocialTokens();}' +
    '</script>').setWidth(560).setHeight(440);
  SpreadsheetApp.getUi().showModalDialog(html, 'Подключить Instagram / Threads');
}

function socialStatus() {
  const p = socialProps_();
  const f = net => p.getProperty(net + '_TOKEN') ? 'подключён' + (p.getProperty(net + '_USER') ? ' (@' + p.getProperty(net + '_USER') + ')' : '') +
    (net === 'IG' && igIsFb_(p.getProperty('IG_TOKEN')) ? ', ключ Facebook сохранён ' + fmtDate_(new Date(Number(p.getProperty('IG_TOKEN_TS') || 0))) + ' (если перестанет работать — вставьте новый)'
      : ', ключ продлён ' + fmtDate_(new Date(Number(p.getProperty(net + '_TOKEN_TS') || 0)))) : 'не подключён';
  return { ig: f('IG'), th: f('TH') };
}

function saveSocialTokens(ig, th, igId) {
  const p = socialProps_();
  const msg = [];
  const check = (net, tok, url) => {
    tok = String(tok || '').trim();
    if (!tok) return;
    if (net === 'IG' && igIsFb_(tok)) {
      let id = String(igId || '').replace(/\D/g, '');
      if (!id) { // ищем Instagram-аккаунт, привязанный к странице Facebook
        const a = metaGet_(IG_FB_API + '/me/accounts?fields=instagram_business_account&access_token=' + encodeURIComponent(tok));
        const f = (a.data || []).find(x => x.instagram_business_account);
        id = f ? f.instagram_business_account.id : '';
      }
      if (!id) { msg.push('Instagram: не найден ID аккаунта — впишите IG_USER_ID (1784…) в поле ниже ключа'); return; }
      p.setProperty('IG_ACCOUNT_ID', id);
      url = IG_FB_API + '/' + id + '?fields=username&access_token=';
    } else if (net === 'IG') p.deleteProperty('IG_ACCOUNT_ID');
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
  p.deleteProperty('IG_ACCOUNT_ID');
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
 *
 * Отчёт клиенту: при «Создать отчёт клиенту» в карточку объекта (ID объекта = ID карточки в CRM) добавляются
 * всегда два комментария: отчёт для клиента (текст отчёта и ссылка на Google Документ) и для руководителя (выполнение задач недели,
 * невыполненные и просроченные задачи, «Комментарий для себя» из 05_ОТЧЁТ_КЛИЕНТУ, B6). В отчёт клиенту второе не попадает.
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
    const w = crmPostNote_(cfg, type, ent.id, crmNoteText_(o), crmAuthorId_(cfg, o.owner));
    return w.ok ? '✓ заметка ' + fmtDate_(new Date()) + ' · ' + CRM_TYPES[i][1] + ' ' + ent.id : '⚠ заметка не добавлена (' + w.code + ')';
  }
  return '⚠ карточки с телефоном ' + phone + ' нет — заведите в CRM';
}

/**
 * Заметка (комментарий) в карточку TopenLab. Дополнительные параметры заметки (например, признак
 * «публичный комментарий» — имя параметра смотрите в документации API TopenLab) задаются в «Подключить CRM»
 * и добавляются к каждому запросу.
 */
/** ID сотрудников в TopenLab: {«Ассистент»: "300271", …} — задаются в «Подключить CRM TopenLab». */
function crmPeople_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('TOPNLAB_PEOPLE') || '{}') || {}; } catch (e) { return {}; }
}

/** Автор заметки: сотрудник (если его ID в TopenLab задан), иначе автор по умолчанию. */
function crmAuthorId_(cfg, personName) {
  const id = personName ? crmPeople_()[String(personName).trim()] : '';
  return id || cfg.user;
}

function crmPostNote_(cfg, type, id, note, author) {
  let extra = {};
  try { extra = JSON.parse(PropertiesService.getScriptProperties().getProperty('TOPNLAB_NOTE_EXTRA') || '{}') || {}; } catch (e) { extra = {}; }
  const payload = Object.assign({}, extra, {
    key: cfg.key, id: /^\d+$/.test(String(id)) ? Number(id) : id, type: type,
    note: String(note).slice(0, 8000), user_id: Number(author || cfg.user) || author || cfg.user,
  });
  const w = UrlFetchApp.fetch(cfg.base + '/set-note', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(payload) });
  let ok = false, msg = '';
  try { const j = JSON.parse(w.getContentText()); ok = w.getResponseCode() < 400 && (j.status === 'success' || j.status === 'ok'); msg = j.message || j.error || ''; } catch (e) { ok = false; }
  return { ok: ok, code: w.getResponseCode(), msg: msg };
}

// ───────────────────────── отчёт клиенту → карточка объекта ─────────────────────────

/** Текст комментария «отчёт клиенту» и внутреннего комментария для руководителя. */
function reportCrmNotes_(obj, values, reportUrl, internal, wk) {
  const kv = values.kv, t = values.tables;
  const rows = (ph, empty) => {
    const r = (t[ph] || []).filter(x => x[1] && x[0] !== '—');
    return r.length ? r.map(x => x[0] + '. ' + x[1] + (x[2] ? ' — ' + x[2] : '')).join('\n') : empty;
  };
  const client = [
    'ОТЧЁТ КЛИЕНТУ №' + (kv.REPORT_NO || '') + ' за ' + (kv.PERIOD || '') + ' — ' + obj.name,
    kv.SUMMARY ? '\nИтоги недели:\n' + kv.SUMMARY : '',
    '\nВыполнение плана:\n' + rows('PLAN_ROWS', 'задачи на неделю не внесены'),
    '\nПолученные заявки:\n' + rows('LEADS_ROWS', 'новых заявок нет'),
    '\nПлан работы на следующую неделю:\n' + rows('NEXT_ROWS', 'план не внесён'),
    kv.COMMENT ? '\nКомментарий для клиента:\n' + kv.COMMENT : '',
    kv.AD_STATS ? '\nРеклама на площадках:\n' + kv.AD_STATS : '',
    reportUrl ? '\nОтчёт (Google Документ, актуальная версия): ' + reportUrl : '',
  ].filter(Boolean).join('\n');
  const tasks = readTable_('TASK').rows.filter(x => String(x.obj_id) === String(obj.id) && x.task);
  const cls = x => x.status ? dictClassOf_('task_status', x.status) : CLS.OPEN;
  const week = wk ? tasks.filter(x => x.week === wk && cls(x) !== CLS.CANCEL) : [];
  const done = week.filter(x => cls(x) === CLS.DONE);
  const notDone = week.filter(x => cls(x) !== CLS.DONE);
  const overdue = tasks.filter(x => cls(x) === CLS.OPEN && x.deadline instanceof Date && x.deadline < today_());
  const own = String(internal || '').trim();
  let content = '';
  if (wk) {
    const pubs = readTable_('CONT').rows.filter(x => String(x.obj_id) === String(obj.id) && x.pub_date instanceof Date && isoWeekKey_(x.pub_date) === wk && dictClassOf_('content_status', x.status) === CLS.DONE);
    const sum = k => pubs.reduce((a, x) => a + (Number(x[k]) || 0), 0);
    if (pubs.length) content = '\nКонтент за неделю: публикаций ' + pubs.length + ', просмотры ' + sum('views').toLocaleString('ru-RU') + ', охват ' + sum('reach').toLocaleString('ru-RU') +
      ', сохранения ' + sum('saves') + ', заявки ' + sum('leads') + '\n' + pubs.map(x => '• ' + x.topic + ' (' + x.platform + '): просмотры ' + (x.views || 0) + ', охват ' + (x.reach || 0)).join('\n');
  }
  const line = x => '• ' + x.task + ' (' + (x.owner || '—') + (x.status ? ', ' + x.status : '') + (x.deadline instanceof Date ? ', срок ' + fmtDate_(x.deadline) : '') + ')';
  const inner = [
    'ДЛЯ РУКОВОДИТЕЛЯ (клиенту не отправляется) — отчёт №' + (kv.REPORT_NO || '') + ' за ' + (kv.PERIOD || '') + ' — ' + obj.name,
    '\nВыполнение задач недели: ' + (week.length ? done.length + ' из ' + week.length + ' (' + Math.round(done.length / week.length * 100) + '%)' : 'задачи на неделю не внесены'),
    notDone.length ? '\nНе выполнено:\n' + notDone.slice(0, 15).map(line).join('\n') : '',
    '\nПросрочено задач: ' + overdue.length + (overdue.length ? '\n' + overdue.slice(0, 10).map(line).join('\n') : ''),
    baseWorkLines_(obj.id, wk),
    content,
    values.adInner ? '\n' + values.adInner : '',
    own ? '\nКомментарий руководителя:\n' + own : '',
  ].filter(Boolean).join('\n');
  return { client: client, inner: inner };
}

/** Отправляет отчёт в карточку объекта (ID объекта = ID карточки в CRM). Возвращает текст статуса. */
function sendReportToCrm_(obj, values, reportUrl, internal, wk) {
  const cfg = crmConfig_();
  if (!cfg.key) return '';
  if (!cfg.user) return '⚠ не задан ID автора заметок (Сервис → Подключить CRM TopenLab)';
  if (!isCrmId_(obj.id)) return '⚠ у объекта нет ID из CRM (сейчас «' + obj.id + '»)';
  const n = reportCrmNotes_(obj, values, reportUrl, internal, wk);
  const author = crmAuthorId_(cfg, personByEmail_(userEmail_())); // отчёт создал сотрудник — заметка от его имени
  const a = crmPostNote_(cfg, 'realty', obj.id, n.client, author);
  if (!a.ok) return '⚠ CRM: отчёт не добавлен (' + a.code + (a.msg ? ', ' + a.msg : '') + ')';
  const b = crmPostNote_(cfg, 'realty', obj.id, n.inner, author);
  return '✓ в CRM ' + fmtDate_(new Date()) + ': отчёт для клиента' + (b.ok ? ' + для руководителя' : ', ⚠ для руководителя не добавлен (' + b.code + ')');
}

/** Меню: отправить в CRM отчёт, выбранный в 05_ОТЧЁТ_КЛИЕНТУ (например, после правок или если CRM подключили позже). */
function crmSendReport() {
  const ui = SpreadsheetApp.getUi();
  if (!crmConfig_().key) { ui.alert('CRM не подключена: Сервис → Подключить CRM TopenLab.'); return; }
  SpreadsheetApp.flush();
  const rep = sheet_('REP');
  const id = String(rep.getRange('E3').getValue() || ''), wk = String(rep.getRange('E4').getValue() || '');
  const obj = objectById_(id);
  if (!obj || !wk) { ui.alert('Выберите объект и неделю в ' + SHEET_NAMES.REP + '.'); return; }
  const arch = readTable_('ARCH');
  const rows = arch.rows.filter(r => String(r.obj_id) === id && r.week === wk && r.status === REPORT_STATUS.ACTUAL);
  const last = rows[rows.length - 1];
  const st = sendReportToCrm_(obj, addAdStats_(readReportValues_(), obj, wk), last ? (last.doc_link || last.pdf_link) : '', rep.getRange('B6').getValue(), wk);
  if (last) writeFields_(arch.sh, 'ARCH', last._row, { crm: st });
  ui.alert('Отчёт → CRM', st || 'CRM не подключена', ui.ButtonSet.OK);
}

/** Меню: тестовый комментарий в карточку объекта — проверить ключ, автора и где комментарий виден в TopenLab. */
function crmTestNote() {
  if (!requireAdmin_('Тест: комментарий в карточку CRM')) return;
  const ui = SpreadsheetApp.getUi();
  const cfg = crmConfig_();
  if (!cfg.key || !cfg.user) { ui.alert('Сначала: Сервис → Подключить CRM TopenLab (ключ API и ID пользователя-автора).'); return; }
  const r = ui.prompt('Тестовый комментарий в CRM', 'ID объекта (карточки в TopenLab), например 137073408:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const id = String(r.getResponseText() || '').trim();
  if (!isCrmId_(id)) { ui.alert('ID карточки — только цифры (как в CRM).'); return; }
  const obj = objectById_(id);
  const res = crmPostNote_(cfg, 'realty', id, 'Тестовый комментарий из системы маркетинга эксклюзивов' + (obj ? ' (' + obj.name + ')' : '') +
    ', ' + fmtDate_(new Date(), 'dd.MM.yyyy HH:mm') + '. Можно удалить.');
  logHistory_([{ sheet: 'CRM', record_id: id, obj_id: obj ? id : '', field: 'Тестовый комментарий', old: '', new: res.ok ? 'добавлен' : 'ошибка ' + res.code, kind: HIST_KIND.CHANGE }], userEmail_());
  ui.alert('Тестовый комментарий', res.ok
    ? '✓ Комментарий добавлен в карточку ' + id + '. Откройте её в TopenLab и посмотрите, где он виден.'
    : '⚠ Не добавлен: ответ CRM ' + res.code + (res.msg ? ' — ' + res.msg : '') + '. Проверьте ID карточки, ключ API и ID пользователя.', ui.ButtonSet.OK);
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
  if (!requireAdmin_('Подключить CRM TopenLab')) return;
  const c = crmConfig_();
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<p>Ключ API TopenLab и ID пользователя, от имени которого публикуются заметки (Настройки системы → Пользователи). ' +
    'Хранятся в свойствах скрипта, в таблице не видны. Пустое поле — оставить как есть.</p>' +
    '<p>Статус: <b id="s">' + (c.key ? 'подключена' + (c.user ? ', автор заметок ' + htmlEscape_(c.user) : ', без автора заметок') : 'не подключена') + '</b></p>' +
    '<p>Ключ API:<br><input id="k" style="width:100%"></p>' +
    '<p>ID пользователя-автора заметок:<br><input id="u" style="width:100%" value="' + htmlEscape_(c.user) + '"></p>' +
    '<p><b>ID сотрудников в TopenLab</b> — заметки по их строкам обзвона и их отчётам будут публиковаться от их имени (пусто — от автора по умолчанию):</p>' +
    dictRows_('people').map((p, i) => '<p style="margin:4px 0">' + htmlEscape_(p[0]) + (p[1] ? ' <span style="color:#80868B">(' + htmlEscape_(p[1]) + ')</span>' : '') +
      ':<br><input class="pp" data-name="' + htmlEscape_(p[0]) + '" style="width:100%" value="' + htmlEscape_(crmPeople_()[p[0]] || '') + '"></p>').join('') +
    '<p>Доп. параметры заметки (JSON, необязательно) — например признак «публичный комментарий» из документации API TopenLab (Настройки → API):<br><input id="x" style="width:100%" placeholder=\'{"is_public": 1}\' value="' + htmlEscape_(PropertiesService.getScriptProperties().getProperty('TOPNLAB_NOTE_EXTRA') || '') + '"></p>' +
    '<p>Телефон существующей карточки для проверки (необязательно):<br><input id="p" style="width:100%" placeholder="+7 925 …"></p>' +
    '<button onclick="save()">Сохранить и проверить</button> <button onclick="off()">Отключить</button><div id="r" style="margin-top:10px"></div></div><script>' +
    'function done(x){document.getElementById("r").textContent=x.msg;document.getElementById("s").textContent=x.status;}' +
    'function save(){document.getElementById("r").textContent="Проверяю… (до 15 секунд)";google.script.run.withSuccessHandler(done).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).saveCrmSettings(document.getElementById("k").value,document.getElementById("u").value,document.getElementById("p").value,document.getElementById("x").value,JSON.stringify(Array.prototype.map.call(document.querySelectorAll(".pp"),function(i){return [i.getAttribute("data-name"),i.value];})));}' +
    'function off(){google.script.run.withSuccessHandler(done).removeCrmSettings();}' +
    '</script>').setWidth(560).setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Подключить CRM TopenLab');
}

function saveCrmSettings(key, user, testPhone, extra, people) {
  const p = PropertiesService.getScriptProperties();
  if (people) {
    const map = {};
    try { JSON.parse(people).forEach(x => { const v = String(x[1] || '').replace(/\D/g, ''); if (x[0] && v) map[x[0]] = v; }); } catch (e) { /* пропускаем */ }
    p.setProperty('TOPNLAB_PEOPLE', JSON.stringify(map));
  }
  const ex = String(extra || '').trim();
  if (ex) {
    try { JSON.parse(ex); } catch (e) { return { status: 'не сохранено', msg: 'Доп. параметры — не JSON. Пример: {"is_public": 1}' }; }
    p.setProperty('TOPNLAB_NOTE_EXTRA', ex);
  } else p.deleteProperty('TOPNLAB_NOTE_EXTRA');
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
  ['TOPNLAB_KEY', 'TOPNLAB_USER_ID', 'TOPNLAB_LAST', 'TOPNLAB_NOTE_EXTRA', 'TOPNLAB_PEOPLE'].forEach(k => p.deleteProperty(k));
  return { status: 'не подключена', msg: 'Отключено.' };
}

/** Для руководителя: работа с базой за неделю поимённо (клиенту — только цифры, без компаний и контактов). */
function baseWorkLines_(objId, wk) {
  if (!wk) return '';
  const inWk = d => d instanceof Date && isoWeekKey_(d) === wk;
  const rows = readTable_('BASE').rows.filter(r => String(r.obj_id) === String(objId) && r.company &&
    (inWk(r.call_date) || inWk(r.kp_date) || inWk(r.response_date)));
  if (!rows.length) return '';
  const line = r => {
    const act = [inWk(r.call_date) ? 'звонок ' + fmtDate_(r.call_date) + (r.call_result ? ' (' + r.call_result + ')' : '') : '',
      inWk(r.kp_date) ? (r.kp_type || 'КП') + ' ' + fmtDate_(r.kp_date) : '',
      inWk(r.response_date) && r.response ? 'ответ: ' + r.response : ''].filter(Boolean).join('; ');
    return '• ' + r.company + (r.audience ? ' [' + r.audience + ']' : '') + (r.contact ? ', ' + r.contact : '') + ' — ' + act +
      (r.next_step ? '. Дальше: ' + r.next_step + (r.next_date instanceof Date ? ' ' + fmtDate_(r.next_date) : '') : '');
  };
  return '\nРабота с базой за неделю (' + rows.length + '):\n' + rows.slice(0, 40).map(line).join('\n') + (rows.length > 40 ? '\n… и ещё ' + (rows.length - 40) : '');
}

// ═════════════ 18_ImportObjects.gs ═════════════
/**
 * 18_ImportObjects — «Загрузить объекты списком»: вставить таблицу (из CRM, Excel, Google Таблицы)
 * и разом добавить объекты в 01_ОБЪЕКТЫ. Формульные столбцы не затрагиваются, вкладки создаются сами.
 * Объекты с уже существующим ID не дублируются — у них дополняются пустые поля.
 * С ID из CRM, а объект уже заведён с временным ID (НОВ-001, ВРЕМЯ-1) и то же название / адрес — ID заменяется везде.
 * Без ID: объект ищется по названию (дополняются пустые поля), не найден — получает временный ID «НОВ-001».
 */

const IMPORT_COLS = [
  ['id', 'ID из CRM'], ['name', 'Название'], ['kind', 'Тип'], ['deal', 'Сделка'], ['address', 'Адрес'],
  ['area', 'Площадь, м²'], ['price', 'Цена'], ['status', 'Статус'], ['manager', 'Ответственный'],
  ['customer', 'Заказчик'], ['contract_no', '№ договора'], ['contract_date', 'Дата договора'], ['crm_link', 'Ссылка на CRM'],
];

function importObjects() {
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div>Скопируйте строки из CRM / Excel / Google Таблицы и вставьте сюда. Столбцы по порядку (лишние справа можно не заполнять):</div>' +
    '<div style="color:#37474F;font-size:12px;margin:6px 0"><b>' + IMPORT_COLS.map(c => c[1]).join(' | ') + '</b></div>' +
    '<div style="color:#80868B;font-size:12px">Обязательно только название. Без ID из CRM объект получит временный ID «' + INBOX_TEMP_PREFIX + '001» (замените потом в 01_ОБЪЕКТЫ). Строка заголовков, если есть, пропустится сама.</div>' +
    '<textarea id="t" style="width:100%;height:230px;font:12px monospace;margin-top:6px"></textarea>' +
    '<div style="margin-top:8px"><button onclick="prev()">Проверить</button> <button id="go" onclick="go()" disabled>Загрузить</button></div>' +
    '<div id="r" style="margin-top:8px;font-size:12px;max-height:150px;overflow:auto"></div></div><script>' +
    'function esc(s){return String(s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}' +
    'function prev(){google.script.run.withSuccessHandler(function(x){var h="Новых: <b>"+x.add+"</b>, уже есть (дополнятся пустые поля): <b>"+x.upd+"</b>";' +
    'if(x.names.length)h+="<ul>"+x.names.map(function(n){return "<li>"+esc(n)+"</li>";}).join("")+"</ul>";' +
    'if(x.errors.length)h+="<div style=\\"color:#B71C1C\\">"+x.errors.map(esc).join("<br>")+"</div>";document.getElementById("r").innerHTML=h;document.getElementById("go").disabled=!(x.add+x.upd);})' +
    '.withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).previewObjectsImport(document.getElementById("t").value);}' +
    'function go(){document.getElementById("go").disabled=true;document.getElementById("r").textContent="Загружаю и создаю вкладки… (до минуты)";google.script.run.withSuccessHandler(function(m){document.getElementById("r").innerHTML="<b>"+esc(m)+"</b>";})' +
    '.withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).runObjectsImport(document.getElementById("t").value);}' +
    '</script>').setWidth(760).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Загрузить объекты списком');
}

function previewObjectsImport(text) {
  const r = parseObjectsImport_(text);
  return { add: r.add.length, upd: r.upd.length, names: r.add.concat(r.upd).map(o => (o._from ? o._from + ' → ' : '') + o.id + ' — ' + o.name), errors: r.errors };
}

function runObjectsImport(text) {
  const r = parseObjectsImport_(text);
  const lock = userLock_();
  const start = Date.now();
  let tabRes = { created: 0, rebuilt: 0, left: 0 };
  try {
    const now = today_();
    const firstStatus = dictValues_('obj_status')[0] || '';
    const team = teamDefaults_();
    appendRows_('OBJ', r.add.map(o => Object.assign({}, team, o, { status: o.status || firstStatus, created_at: now })));
    const t = readTable_('OBJ');
    const hist = [];
    r.upd.forEach(o => {
      const row = t.rows.find(x => String(x.id) === (o._from || o.id));
      if (!row) return;
      const upd = {};
      Object.keys(o).forEach(k => { if (k !== 'id' && k !== '_from' && k !== 'name' && o[k] !== '' && (row[k] === '' || row[k] === null)) upd[k] = o[k]; });
      if (o._from) {
        upd.id = o.id;
        renameObjectId_(o._from, o.id);
        hist.push({ sheet: SHEET_NAMES.OBJ, record_id: o.id, obj_id: o.id, field: fieldTitle_('OBJ', 'id'), old: o._from, new: o.id, kind: HIST_KIND.CHANGE, note: 'Загрузка списком: ID из CRM' });
      }
      if (Object.keys(upd).length) writeFields_(t.sh, 'OBJ', row._row, upd);
    });
    SpreadsheetApp.flush();
    hist.push.apply(hist, r.add.map(o => ({ sheet: SHEET_NAMES.OBJ, record_id: o.id, obj_id: o.id, field: 'Объект', old: '', new: o.name, kind: HIST_KIND.CREATE, note: 'Загрузка списком' })));
    logHistory_(hist, userEmail_());
    try { ensureMediaTasks_(); } catch (e) { /* поставится утром */ }
    fixObjIdColumns_();
    r.upd.filter(o => o._from).forEach(o => { const obj = objectById_(o.id); if (obj) syncObjectTab_(obj, 'rename'); });
    tabRes = tabsWork_(start);
    orderSheets_();
  } finally {
    lock.releaseLock();
  }
  return 'Добавлено объектов: ' + r.add.length + ', дополнено: ' + r.upd.length + ', ' + tabsWorkText_(tabRes) +
    (r.errors.length ? '. Замечаний: ' + r.errors.length + ' (см. «Проверить»)' : '') + '. Проверьте 01_ОБЪЕКТЫ.';
}

/** ID из CRM — число; «НОВ-001», «ВРЕМЯ-1» и т.п. — временные, их можно заменить при загрузке списка. */
function isCrmId_(id) { return /^\d{4,}$/.test(String(id || '').trim()); }

function parseObjectsImport_(text) {
  const existing = {};
  readTable_('OBJ').rows.forEach(o => { if (o.id) existing[String(o.id)] = true; });
  const pick = (key, v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    const vals = key === 'kind' ? dictValues_('obj_kinds') : key === 'deal' ? dictValues_('deal_types') : key === 'status' ? dictValues_('obj_status') : key === 'manager' ? dictValues_('people') : null;
    if (vals) return vals.find(x => x.toLowerCase() === s.toLowerCase()) || '';
    if (key === 'area' || key === 'price') { const n = Number(s.replace(/[\s ₽руб.]/gi, '').replace(',', '.')); return isNaN(n) ? '' : n; }
    if (key === 'contract_date') return parseRuDate_(s) || '';
    return s;
  };
  const add = [], upd = [], errors = [], seen = {};
  let tempN = Number(String(nextTempObjectId_()).slice(INBOX_TEMP_PREFIX.length)) - 1;
  String(text || '').split(/\r?\n/).forEach((line, n) => {
    if (!line.trim()) return;
    let cells = line.indexOf('\t') >= 0 ? line.split('\t') : line.split(/;|\|/);
    cells = cells.map(c => c.trim());
    if (/^id|^№ ?объекта|^номер/i.test(cells[0]) && /назван|объект/i.test(cells[1] || '')) return; // заголовок
    const o = {};
    IMPORT_COLS.forEach((c, i) => { o[c[0]] = c[0] === 'id' || c[0] === 'name' ? String(cells[i] || '').trim() : pick(c[0], cells[i]); });
    if (!o.name) { errors.push('Строка ' + (n + 1) + ': нет названия'); return; }
    if (!o.id) {
      const same = findObjectByName_(o.name);
      if (same) o.id = String(same.id);
      else { const k = String(++tempN); o.id = INBOX_TEMP_PREFIX + (k.length < 3 ? '00'.slice(k.length - 1) : '') + k; }
    }
    if (seen[o.id]) { errors.push('Строка ' + (n + 1) + ': ID ' + o.id + ' повторяется в списке'); return; }
    seen[o.id] = true;
    if (!existing[o.id]) { // объект уже заведён с временным ID (НОВ-001, ВРЕМЯ-1) — присваиваем ID из CRM
      const same = findObjectByName_(o.name) || (o.address ? findObjectByAddress_(o.address) : null);
      if (same && !isCrmId_(same.id) && !seen[String(same.id)]) { o._from = String(same.id); seen[o._from] = true; }
    }
    ['kind', 'deal', 'status', 'manager'].forEach((k, j) => {
      const raw = String(cells[IMPORT_COLS.findIndex(c => c[0] === k)] || '').trim();
      if (raw && !o[k]) errors.push('Строка ' + (n + 1) + ': «' + raw + '» нет в списке «' + IMPORT_COLS.find(c => c[0] === k)[1] + '» (07_СПРАВОЧНИКИ) — поле оставлено пустым');
    });
    Object.keys(o).forEach(k => { if (o[k] === '') delete o[k]; });
    (existing[o.id] || o._from ? upd : add).push(o);
  });
  return { add: add, upd: upd, errors: errors };
}

// ═════════════ 19_Inbox.gs ═════════════
/**
 * 19_Inbox — папка «04_ВХОДЯЩИЕ — новые объекты» на Google Диске.
 *
 * Кладёте туда презентацию / КП объекта (PDF, PowerPoint, Word, Google Slides / Docs) — система:
 *  1) определяет объект: по ID в начале имени файла («4801 Остров.pdf»), иначе по названию;
 *  2) если объекта нет — заводит его в 01_ОБЪЕКТЫ: название из имени файла, адрес, площадь, цена, тип, сделка
 *     распознаются из текста презентации (проверьте их); без ID из CRM объект получает временный ID «НОВ-001» —
 *     замените его на ID из CRM в 01_ОБЪЕКТЫ, он обновится везде (и в имени папки);
 *  3) создаёт вкладку объекта и папку объекта на Диске, переносит файл в «КП и презентации».
 * Разбор: меню «➜ Разобрать папку «Входящие»» или автоматически каждые 10 минут (Сервис → Включить автообновление).
 */

const INBOX_TEMP_PREFIX = 'НОВ-';

function inboxFolder_() {
  let f = folderById_(cfgGet_('FOLDER_INBOX_ID'));
  if (f) return f;
  let root = folderById_(cfgGet_('FOLDER_ROOT_ID'));
  if (!root) { ensureDrive_(); root = folderById_(cfgGet_('FOLDER_ROOT_ID')); }
  f = childFolder_(root, SYS.FOLDERS.INBOX);
  cfgSet_('FOLDER_INBOX_ID', f.getId());
  return f;
}

function processInbox() {
  const r = processInbox_();
  const ui = SpreadsheetApp.getUi();
  if (!r.done.length && !r.errors.length) { ui.alert('Входящие', 'Папка «' + SYS.FOLDERS.INBOX + '» пуста.', ui.ButtonSet.OK); return; }
  ui.alert('Входящие разобраны', r.done.join('\n') + (r.errors.length ? '\n\nНе удалось:\n' + r.errors.join('\n') : '') +
    (r.created ? '\n\nПроверьте новые объекты в 01_ОБЪЕКТЫ: поля из презентации заполнены автоматически. Временный ID «' + INBOX_TEMP_PREFIX + '…» замените на ID из CRM.' : ''), ui.ButtonSet.OK);
}

/** Автоматический разбор (триггер каждые 10 минут). */
function inboxJob() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;
  try { processInbox_(); } catch (e) { Logger.log('Входящие: ' + e.message); } finally { lock.releaseLock(); }
}

function processInbox_() {
  const inbox = inboxFolder_();
  const res = { done: [], errors: [], created: 0 };
  const start = Date.now();
  const it = inbox.getFiles();
  const hist = [];
  while (it.hasNext()) {
    if (Date.now() - start > 4 * 60000) break; // остальное — следующим запуском
    const file = it.next();
    const fname = file.getName();
    if (fname.indexOf('__tmp') === 0) continue;
    try {
      const parsed = parseInboxName_(fname);
      let obj = parsed.id ? objectById_(parsed.id) : findObjectByName_(parsed.name);
      if (!obj && parsed.id && isCrmId_(parsed.id)) { // «144890621 12 месяцев.pdf», а объект заведён как НОВ-001 — присваиваем ID из CRM
        const same = findObjectByName_(parsed.name);
        if (same && !isCrmId_(same.id)) {
          writeFields_(sheet_('OBJ'), 'OBJ', same._row, { id: parsed.id });
          renameObjectId_(String(same.id), parsed.id);
          hist.push({ sheet: SHEET_NAMES.OBJ, record_id: parsed.id, obj_id: parsed.id, field: fieldTitle_('OBJ', 'id'), old: same.id, new: parsed.id, kind: HIST_KIND.CHANGE, note: 'ID из имени файла ' + fname });
          SpreadsheetApp.flush();
          obj = objectById_(parsed.id);
        }
      }
      let note = '';
      const info = obj ? null : guessObjectInfo_(extractFileText_(file));
      if (!obj && info.address) obj = findObjectByAddress_(info.address);
      if (!obj && !parsed.id && !matchWords_(parsed.name, false).length) { // «Продавцы, Мои объекты.pdf» — выгрузка списка, а не объект
        res.errors.push('• ' + fname + ': не понятно, какой это объект — переименуйте файл («ID Название.pdf») и разберите папку ещё раз');
        continue;
      }
      if (!obj) {
        const id = parsed.id || nextTempObjectId_();
        const name = parsed.name || info.name || 'Новый объект ' + id;
        const row = { ...teamDefaults_(), id: id, name: name, status: dictValues_('obj_status').indexOf('Подготовка') >= 0 ? 'Подготовка' : (dictValues_('obj_status')[0] || ''), created_at: today_() };
        ['kind', 'deal', 'address', 'area', 'price'].forEach(k => { if (info[k] !== undefined && info[k] !== '') row[k] = info[k]; });
        appendRow_('OBJ', row);
        SpreadsheetApp.flush();
        obj = objectById_(id);
        syncObjectTab_(obj, 'create');
        res.created++;
        const got = ['address', 'area', 'price', 'kind', 'deal'].filter(k => row[k] !== undefined);
        note = 'новый объект ' + id + (got.length ? ' (из презентации: ' + got.map(k => fieldTitle_('OBJ', k)).join(', ') + ')' : '');
        hist.push({ sheet: SHEET_NAMES.OBJ, record_id: id, obj_id: id, field: 'Объект', old: '', new: name, kind: HIST_KIND.CREATE, note: 'Из папки «Входящие»: ' + fname });
      }
      const folder = ensureObjectFolder_(obj.id, 'MATERIALS');
      file.moveTo(folder);
      hist.push({ sheet: 'Google Диск', record_id: fname, obj_id: obj.id, field: 'Файл объекта', old: SYS.FOLDERS.INBOX, new: 'КП и презентации', kind: HIST_KIND.MOVE });
      res.done.push('• ' + fname + ' → ' + obj.name + ' (' + obj.id + ')' + (note ? ' — ' + note : ''));
      const tab = findObjectTab_(obj);
      if (tab) { try { fillObjectFiles_(tab, objectById_(obj.id)); } catch (e) { /* список обновится утром */ } }
    } catch (e) {
      res.errors.push('• ' + fname + ': ' + e.message);
    }
  }
  logHistory_(hist, userEmail_());
  try { ensureMediaTasks_(); } catch (e) { /* поставится утром */ }
  return res;
}

/** «4801 — Остров, дом 450.pdf» → {id:'4801', name:'Остров, дом 450'}; «Презентация ЖК Время.pptx» → {id:'', name:'ЖК Время'}. */
function parseInboxName_(fname) {
  let base = String(fname).replace(/\.[A-Za-z0-9]{2,5}$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  let id = '';
  const m = /^\s*(\d{3,}|[A-Za-zА-Яа-яЁё]{2,6}-\d{1,6})\s*[-—–.·:)]*\s+(.+)$/.exec(base);
  if (m) { id = m[1].toUpperCase(); base = m[2]; }
  base = base.replace(/^(id\s+)?(продавцы|арендодатели)\s*,?\s*мои объекты\s*/i, ''); // имя выгрузки из ЦИАН
  let name = (' ' + base + ' ').replace(/(^|[\s,.;()«»"-])(презентация|презентации|коммерческое предложение|кп|pdf|финал|final|new|новая|версия|v\d+)(?=[\s,.;()«»"-]|$)/gi, '$1 ')
    .replace(/\(\d+\)/g, ' ').replace(/[\s\-—–_.,]+$/g, '').replace(/^[\s\-—–_.,]+/g, '').replace(/\s{2,}/g, ' ').trim();
  if (name && name === name.toLowerCase()) name = name.replace(/(^|\s)([а-яёa-z])/g, (x, sp, c) => sp + c.toUpperCase()); // «сосновый бор» → «Сосновый Бор»
  return { id: id, name: name };
}

const MATCH_STOP_ = ['жк', 'кп', 'дом', 'пос', 'ул', 'г', 'д', 'стр', 'корп', 'мои', 'объекты', 'продавцы', 'арендодатели', 'новый', 'объект',
  'москва', 'московская', 'обл', 'область', 'район', 'улица', 'город', 'деревня', 'поселок', 'территория', 'тер', 'вао', 'цао', 'зао', 'сао', 'юао', 'свао', 'сзао', 'юзао', 'ювао'];

/** Значимые слова: «ЖК Время · Лермонтовская 1» → ['время', 'лермонтовская'] (+ номера, если withNums). */
function matchWords_(s, withNums) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/)
    .filter(w => w && MATCH_STOP_.indexOf(w) < 0 && (/^\d+$/.test(w) ? withNums : w.length >= 3));
}

/** Слово запроса совпадает со словом объекта по основе: «лермонтовский» ↔ «лермонтовская», «озера» ↔ «озёра». */
function wordMatch_(q, w) {
  if (/^\d+$/.test(q) || /^\d+$/.test(w)) return q === w;
  const stem = x => x.slice(0, x.length <= 5 ? x.length : Math.max(5, x.length - 3));
  return w.indexOf(stem(q)) === 0 || q.indexOf(stem(w)) === 0;
}

/** Объект по названию из имени файла: все значимые слова должны найтись в названии или адресе объекта. */
function findObjectByName_(name) {
  const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ').trim();
  const n = norm(name);
  if (n.length < 3) return null;
  const rows = readTable_('OBJ').rows.filter(o => o.id && o.name);
  const exact = rows.find(o => norm(o.name) === n);
  if (exact) return exact;
  const q = matchWords_(n, false);
  if (!q.length) return null;
  let best = null, bestScore = -1e9, tie = false;
  rows.forEach(o => {
    const words = matchWords_(o.name + ' ' + (o.address || ''), false);
    if (!q.every(x => words.some(w => wordMatch_(x, w)))) return;
    const nameWords = matchWords_(o.name, false);
    const score = nameWords.filter(w => q.some(x => wordMatch_(x, w))).length * 10 - nameWords.length; // точнее совпало название — выше
    if (!best || score > bestScore) { best = o; bestScore = score; tie = false; } else if (score === bestScore) tie = true;
  });
  return tie ? null : best;
}

/** Объект по адресу из презентации: улица / населённый пункт и номер дома объекта есть в адресе. */
function findObjectByAddress_(address) {
  const a = matchWords_(address, true);
  if (a.length < 2) return null;
  const found = readTable_('OBJ').rows.filter(o => {
    if (!o.id || !o.address) return false;
    const w = matchWords_(String(o.address).split('(')[0], true); // «д.1 (помещение 1Н, …)» — уточнение в скобках не сравниваем
    const words = w.filter(x => !/^\d+$/.test(x)), house = w.find(x => /^\d+$/.test(x));
    return words.length >= 1 && (house || words.length >= 2) && words.every(x => a.some(y => wordMatch_(x, y))) && (!house || a.indexOf(house) >= 0);
  });
  return found.length === 1 ? found[0] : null;
}

function nextTempObjectId_() {
  let n = 0;
  readTable_('OBJ').rows.forEach(o => { const m = new RegExp('^' + INBOX_TEMP_PREFIX + '(\\d+)$').exec(String(o.id)); if (m) n = Math.max(n, Number(m[1])); });
  const s = String(n + 1);
  return INBOX_TEMP_PREFIX + (s.length < 3 ? '00'.slice(s.length - 1) : '') + s;
}

/** Текст файла: PDF / Word → Google Документ (с распознаванием), PowerPoint → Google Презентация, затем выгрузка текстом. */
function extractFileText_(file) {
  const mime = String(file.getMimeType());
  const api = 'https://www.googleapis.com/drive/v3/files/';
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  let srcId = file.getId(), tmpId = '';
  try {
    if (!/google-apps\.(document|presentation)/.test(mime)) {
      const target = /presentation|powerpoint/.test(mime) ? 'application/vnd.google-apps.presentation'
        : /pdf|wordprocessingml|msword|text\/plain|rtf/.test(mime) ? 'application/vnd.google-apps.document' : '';
      if (!target) return '';
      const r = UrlFetchApp.fetch(api + srcId + '/copy?ocrLanguage=ru&fields=id', {
        method: 'post', contentType: 'application/json', headers: auth, muteHttpExceptions: true,
        payload: JSON.stringify({ name: '__tmp_text ' + file.getName(), mimeType: target }),
      });
      if (r.getResponseCode() >= 300) return '';
      tmpId = JSON.parse(r.getContentText()).id;
      srcId = tmpId;
    }
    const e = UrlFetchApp.fetch(api + srcId + '/export?mimeType=text/plain', { headers: auth, muteHttpExceptions: true });
    return e.getResponseCode() < 300 ? e.getContentText() : '';
  } catch (err) {
    return '';
  } finally {
    if (tmpId) { try { DriveApp.getFileById(tmpId).setTrashed(true); } catch (e) { /* черновик останется в корзине */ } }
  }
}

/** Адрес, площадь, цена, тип, сделка — из текста презентации (эвристика, проверяйте). Понимает выгрузку объекта из ЦИАН. */
function guessObjectInfo_(text) {
  const t = String(text || '').replace(/\u00a0/g, ' ').replace(/\*\*/g, '').replace(/\\~/g, '~');
  const info = {};
  if (!t.trim()) return info;
  const lines = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const num = s => Number(String(s).replace(/\s/g, '').replace(',', '.'));
  // ЦИАН: «Продается помещ.своб.назнач-я | 756.2 м²», «Сдается коттедж | 1200 м² | 30 соток»
  const hdr = /(?:^|\n)\s*(Прода[её]тся|Сда[её]тся)\s+([^|\n]+?)\s*\|\s*(\d[\d ]*(?:[.,]\d+)?)\s*(?:м²|м2)/i.exec(t);
  if (hdr) { info.deal = /^сда/i.test(hdr[1]) ? 'Аренда' : 'Продажа'; info.area = num(hdr[3]); }
  const strong = /(г\.\s*Москва|Москва,|Московская обл|обл\.|МО,|ул\.|улица|проспект|пр-т|шоссе|переулок|пер\.|бульвар|наб\.|р-н|район)/i;
  const weak = /(пос\.|посёлок|поселок|КП\s|ЖК\s)/i;
  const addrOk = l => l.length <= 160 && !/мои объекты|^\|/i.test(l);
  const addr = lines.find(l => strong.test(l) && addrOk(l)) || lines.find(l => weak.test(l) && addrOk(l));
  if (addr) info.address = addr.replace(/^(адрес|расположение)\s*[:—-]\s*/i, '').replace(/,(?=\S)/g, ', ');
  if (!info.area) {
    const am = /(\d{1,3}(?:[ ]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(?:м²|м2|кв\.?\s?м)/i.exec(t);
    if (am && num(am[1]) > 5) info.area = num(am[1]);
  }
  // ЦИАН: «₽ 225 500 000 298 202 ₽/м²» (цена и цена за м² подряд) или «₽ 1 490 000»
  const cp = /(?:^|\n)[ \t]*₽[ \t]*(\d{1,3}(?:[ ]\d{3})*)([ \t]*₽[ \t]*\/[ \t]*м)?/.exec(t);
  if (cp) {
    const g = cp[1].split(' ');
    let v = num(cp[1]);
    if (cp[2] && g.length > 2) {
      v = 0;
      for (let k = g.length - 1; k >= 1 && !v; k--) { // делим на «цену» и «за м²»: цена / площадь ≈ цена за м²
        const left = num(g.slice(0, k).join('')), right = num(g.slice(k).join(''));
        if (info.area && Math.abs(left / info.area - right) <= Math.max(2, right * 0.02)) v = left;
      }
      if (!v) v = num(g.slice(0, Math.max(1, g.length - 2)).join(''));
    }
    if (v >= 10000) info.price = v;
  }
  if (!info.price) {
    let best = 0;
    const priceRe = /(\d{1,3}(?:[ ]\d{3})+|\d+(?:[.,]\d+)?)\s*(млрд|млн)?\.?\s*(?:₽|руб|р\.)/gi;
    let pm;
    while ((pm = priceRe.exec(t)) !== null) {
      let v = num(pm[1]);
      if (/млрд/i.test(pm[2] || '')) v *= 1e9; else if (/млн/i.test(pm[2] || '')) v *= 1e6;
      const around = t.slice(Math.max(0, pm.index - 25), pm.index);
      const after = t.slice(pm.index + pm[0].length, pm.index + pm[0].length + 12).split(/\r?\n/)[0];
      const before = around.split(/\r?\n/).pop();
      if (/^\s*(за\s*(м²|м2|кв)|\/\s*м)/i.test(after) || /за\s*(м²|м2|кв)/i.test(before)) continue; // цена за м²
      if (v > best) best = v;
    }
    if (best >= 100000) info.price = Math.round(best);
  }
  const low = t.toLowerCase();
  if (!info.deal) info.deal = /аренд|в месяц|\/мес|ставка/.test(low) && !/продаж|продаётся|продается/.test(low) ? 'Аренда' : (/продаж|продаётся|продается|стоимость/.test(low) ? 'Продажа' : '');
  const kindOf = x => /особняк|усадьб/.test(x) ? 'Особняк' : /(загородн|коттедж|таунхаус|кп\s|посёлок|поселок|дом\b|дом\s)/.test(x) ? 'Загородный дом'
    : /(псн|помещ|своб|коммерч|офис|ритейл|габ|торгов|склад)/.test(x) ? 'Коммерция' : /(квартир|апартамент|\d-комн|жк\s)/.test(x) ? 'Жильё'
    : /(участок|земл)/.test(x) ? 'Земля' : '';
  const k = (hdr && kindOf(hdr[2].toLowerCase() + ' ')) || kindOf(low);
  if (k && dictValues_('obj_kinds').indexOf(k) >= 0) info.kind = k;
  if (hdr) { // название: «Коттедж 1200 м² · д. Примерово»
    const place = (info.address || '').split(/,\s*/).filter(x => x && !/москва|обл\.|область|р-н|район|^[СЮЗВЦ]{1,2}АО$/i.test(x)).slice(0, 2).join(', ');
    const what = hdr[2].replace(/помещ\.?\s*своб\.?\s*назнач-?я/i, 'ПСН').trim();
    info.name = what.charAt(0).toUpperCase() + what.slice(1) + ' ' + String(info.area).replace('.', ',') + ' м²' + (place ? ' · ' + place : '');
  } else {
    const title = lines.find(l => l.length >= 4 && l.length <= 60 && !/^\d/.test(l) && !/мои объекты|^\|/i.test(l));
    if (title) info.name = title;
  }
  Object.keys(info).forEach(x => { if (info[x] === '' || info[x] === undefined) delete info[x]; });
  return info;
}

// ═════════════ 20_AutoReports.gs ═════════════
/**
 * 20_AutoReports — еженедельные отчёты автоматически: каждую пятницу в 20:00 (МСК).
 *
 * По каждому объекту «в работе» за текущую неделю: Google Документ в папке объекта и комментарий
 * в карточку TopenLab (как «Создать отчёт клиенту»). Если отчёт за эту неделю уже создан вручную, новый не создаётся,
 * но если он ещё не попал в CRM — отправляется. Клиенту система ничего не отправляет — ссылки на отчёты приходят письмом руководителю.
 * Поля «Комментарий для клиента / для себя» (05_ОТЧЁТ_КЛИЕНТУ) в автоотчёт не попадают — они общие для всех объектов.
 * Если за один запуск (лимит Google — 6 минут) не успели все объекты, продолжает сам через минуту.
 */

const AUTO_REP = { DAY: 'FRIDAY', HOUR: 20, BUDGET_MS: 4.5 * 60000 };

function enableAutoReports() {
  if (!requireAdmin_('Включить автоотчёты')) return;
  disableAutoReports_();
  ScriptApp.newTrigger('autoReportsJob').timeBased().onWeekDay(ScriptApp.WeekDay[AUTO_REP.DAY])
    .atHour(AUTO_REP.HOUR).nearMinute(0).inTimezone(SYS.TZ).create();
  let mail = true;
  try { MailApp.getRemainingDailyQuota(); } catch (e) { mail = false; }
  SpreadsheetApp.getUi().alert('Автоотчёты включены',
    'Каждую пятницу в 20:00 (МСК) по всем объектам «в работе»: отчёт (Google Документ в папке объекта) и комментарий в карточку TopenLab.\n' +
    'Клиентам ничего не отправляется — ссылки на отчёты придут вам письмом.' +
    (mail ? '' : '\n\n⚠ Нет разрешения на отправку писем: в Apps Script → ⚙ Настройки проекта включите показ appsscript.json и замените его содержимым dist/appsscript.json, затем включите автоотчёты ещё раз. Отчёты и комментарии в CRM работают и без письма.'),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function disableAutoReports() {
  if (!requireAdmin_('Выключить автоотчёты')) return;
  disableAutoReports_();
  toast_('Автоотчёты по пятницам выключены.', 'Автоотчёты', 5);
}

function disableAutoReports_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const h = t.getHandlerFunction();
    if (h === 'autoReportsJob' || h === 'autoReportsContinue') ScriptApp.deleteTrigger(t);
  });
}

/** Триггер пятницы: новая партия за текущую неделю. */
function autoReportsJob() {
  const wk = isoWeekKey_(today_());
  PropertiesService.getDocumentProperties().setProperty('AUTO_REP_STATE', JSON.stringify({ wk: wk, done: [] }));
  autoReportsRun_();
}

/** Продолжение партии (если не уложились в лимит времени). */
function autoReportsContinue() { autoReportsRun_(); }

function autoReportsRun_() {
  const props = PropertiesService.getDocumentProperties();
  let state;
  try { state = JSON.parse(props.getProperty('AUTO_REP_STATE') || ''); } catch (e) { state = null; }
  if (!state || !state.wk) return;
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) { scheduleAutoReportsContinue_(true); return; }
  const start = Date.now();
  const rep = sheet_('REP');
  const keep = ['B3', 'B4', 'B5', 'B6'].map(a => rep.getRange(a).getValue());
  let left = 0;
  try {
    const label = weekLabelByKey_(state.wk);
    if (!label) throw new Error('недели ' + state.wk + ' нет в 07_СПРАВОЧНИКИ — запустите «Установить / обновить систему»');
    const arch = readTable_('ARCH').rows;
    const inWork = {};
    dictRows_('obj_status').forEach(r => { inWork[r[0]] = String(r[1]).toUpperCase() !== 'НЕТ'; });
    const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && inWork[o.status] !== false);
    state.results = state.results || [];
    rep.getRange('B5').setValue('');
    rep.getRange('B6').setValue('');
    objs.forEach(o => {
      const id = String(o.id);
      if (state.done.indexOf(id) >= 0) return;
      if (Date.now() - start > AUTO_REP.BUDGET_MS) { left++; return; }
      const manual = arch.filter(r => String(r.obj_id) === id && r.week === state.wk && r.status === REPORT_STATUS.ACTUAL).pop();
      if (manual) { // отчёт за неделю уже сделан вручную: новый не создаём, но в CRM он должен быть
        let note = 'отчёт создан вручную' + (String(manual.crm).indexOf('✓') === 0 ? ', в CRM уже отправлен' : '');
        if (String(manual.crm).indexOf('✓') !== 0) {
          try {
            rep.getRange('B3').setValue(id + ' · ' + o.name);
            rep.getRange('B4').setValue(label);
            SpreadsheetApp.flush();
            const st = sendReportToCrm_(o, addAdStats_(readReportValues_(), o, state.wk), manual.doc_link || manual.pdf_link, '', state.wk);
            const a = readTable_('ARCH');
            const row = a.rows.find(r => r._row === manual._row);
            if (row && st) writeFields_(a.sh, 'ARCH', row._row, { crm: st });
            note += st ? ' · ' + st : '';
          } catch (e) { note += ' · ⚠ CRM: ' + e.message; }
        }
        state.done.push(id);
        state.results.push({ name: o.name, pdf: manual.doc_link || manual.pdf_link, note: note });
        props.setProperty('AUTO_REP_STATE', JSON.stringify(state));
        return;
      }
      try {
        rep.getRange('B3').setValue(id + ' · ' + o.name);
        rep.getRange('B4').setValue(label);
        SpreadsheetApp.flush();
        const res = (autoReportsRun_.generate || generateReport_)(id, state.wk, {}); // .generate — подмена в тестах
        state.results.push({ name: o.name, pdf: res ? res.docUrl : '', note: res ? (res.crm || 'CRM не подключена') : 'не создан' });
      } catch (e) {
        state.results.push({ name: o.name, note: '⚠ ошибка: ' + e.message });
      }
      state.done.push(id);
      props.setProperty('AUTO_REP_STATE', JSON.stringify(state));
    });
  } catch (e) {
    state.results = (state.results || []).concat([{ name: 'Автоотчёты', note: '⚠ ' + e.message }]);
  } finally {
    ['B3', 'B4', 'B5', 'B6'].forEach((a, i) => { try { rep.getRange(a).setValue(keep[i]); } catch (e) { /* выбор можно вернуть вручную */ } });
    props.setProperty('AUTO_REP_STATE', JSON.stringify(state));
    lock.releaseLock();
  }
  scheduleAutoReportsContinue_(left > 0);
  if (!left) {
    autoReportsMail_(state);
    props.deleteProperty('AUTO_REP_STATE');
  }
}

function scheduleAutoReportsContinue_(on) {
  if (typeof ScriptApp.getProjectTriggers !== 'function') return;
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'autoReportsContinue') ScriptApp.deleteTrigger(t); });
  if (on) ScriptApp.newTrigger('autoReportsContinue').timeBased().after(60 * 1000).create();
}

/** Письмо руководителю: объект → отчёт → статус CRM. */
function autoReportsMail_(state) {
  const to = String(Session.getEffectiveUser().getEmail() || '');
  const rows = state.results || [];
  logHistory_([{ sheet: SHEET_NAMES.ARCH, record_id: state.wk, field: 'Автоотчёты', old: '', new: 'объектов: ' + rows.length, kind: HIST_KIND.CREATE }], 'автоотчёты');
  if (!to || !rows.length) return;
  const html = '<p>Еженедельные отчёты за ' + htmlEscape_(state.wk) + ' созданы. Проверьте и отправьте клиентам ссылки на отчёты.</p><ol>' +
    rows.map(r => '<li><b>' + htmlEscape_(r.name) + '</b>' + (r.pdf ? ' — <a href="' + r.pdf + '">отчёт</a>' : '') + '<br><span style="color:#5f6368">' + htmlEscape_(r.note || '') + '</span></li>').join('') +
    '</ol><p>Поправить: откройте отчёт по ссылке и правьте прямо в нём — клиент по той же ссылке сразу видит исправленную версию.</p>' +
    '<p><a href="' + ss_().getUrl() + '">Открыть систему</a></p>';
  try { MailApp.sendEmail({ to: to, subject: 'Отчёты клиентам за ' + state.wk + ' готовы (' + rows.length + ')', htmlBody: html }); } catch (e) { Logger.log('Письмо: ' + e.message); }
}

// ═════════════ 21_Protect.gs ═════════════
/**
 * 21_Protect — команда дополняет и редактирует, но не удаляет объекты.
 *
 *  - 01_ОБЪЕКТЫ: ID и название заведённых объектов закрыты для всех, кроме владельца таблицы —
 *    строку объекта нельзя удалить (в ней защищённые ячейки), ID и название меняет только руководитель.
 *    Новые объекты команда добавляет в пустые строки как обычно — защита расширяется автоматически.
 *  - Вкладки объектов: служебные метки (столбец A) и шапка закрыты; поля стратегии команда заполняет свободно.
 *  - Страховка: раз в сутки данные каждой вкладки сохраняются в скрытый лист 98_КОПИИ_ВКЛАДОК; если вкладку
 *    удалят, «Обновить» / автообновление пересоздаст её с последними сохранёнными данными.
 * Защиту ставит только владелец таблицы (установка, «Обновить», автоматические задания владельца).
 */

const PROTECT = { OBJ: 'SYS: Объекты — ID и название (удалять и переименовывать может только руководитель)', TAB: 'SYS: Служебная часть вкладки объекта', CFG: 'SYS: Настройки системы — только руководитель' };
const BACKUP_SHEET = '98_КОПИИ_ВКЛАДОК';

function isOwner_() {
  try {
    const owner = ss_().getOwner();
    return !!owner && owner.getEmail() === Session.getEffectiveUser().getEmail();
  } catch (e) { return false; }
}

/** Кто управляет системой: владелец таблицы; если владельца нет (общий диск) — руководитель из 07_СПРАВОЧНИКИ. */
function adminEmail_() {
  try { const o = ss_().getOwner(); if (o && o.getEmail()) return o.getEmail(); } catch (e) { /* общий диск */ }
  try { const r = dictRows_('people').find(x => /руковод/i.test(String(x[1])) && x[2]); if (r) return String(r[2]); } catch (e) { /* нет справочника */ }
  return '';
}

/**
 * Установка, обновление, подключения и автоматизации — только руководитель.
 * Остальным — сообщение и выход (return false). Вызывать первой строкой в функциях меню «Сервис».
 */
function requireAdmin_(what) {
  const admin = adminEmail_();
  let me = '';
  try { me = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail(); } catch (e) { /* нет данных */ }
  if (!admin || (me && me.toLowerCase() === admin.toLowerCase())) return true;
  const msg = '«' + what + '» может запускать только руководитель (' + admin + '). Если нужно — напишите руководителю.';
  try { SpreadsheetApp.getUi().alert('Нет доступа', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(msg); }
  return false;
}

/** Лист 08_НАСТРОЙКИ — менять может только руководитель (остальные видят, но не правят). */
function protectSettings_() {
  if (!isOwner_()) return false;
  const sh = sheet_('CFG');
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => { if (p.getDescription() === PROTECT.CFG) p.remove(); });
  ownerOnly_(sh.protect().setDescription(PROTECT.CFG));
  return true;
}

function ownerOnly_(p) {
  const me = Session.getEffectiveUser();
  p.addEditor(me);
  p.removeEditors(p.getEditors().filter(u => u.getEmail() !== me.getEmail()));
  if (p.canDomainEdit()) p.setDomainEdit(false);
  return p;
}

/** ID и название заведённых объектов — только владелец. */
function protectObjectRows_() {
  if (!isOwner_()) return false;
  const sh = sheet_('OBJ');
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.getDescription() === PROTECT.OBJ) p.remove(); });
  const last = lastDataRow_(sh, sheetSpecs_().OBJ);
  if (last < 2) return true;
  const cols = [fieldIndex_('OBJ', 'id'), fieldIndex_('OBJ', 'name')].sort((a, b) => a - b);
  ownerOnly_(sh.getRange(2, cols[0], last - 1, cols[1] - cols[0] + 1).protect().setDescription(PROTECT.OBJ));
  return true;
}

/** Служебная часть вкладки: столбец меток и шапка (ID объекта). */
function protectObjectTab_(sh) {
  if (!isOwner_()) return;
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.getDescription() === PROTECT.TAB) p.remove(); });
  ownerOnly_(sh.getRange(1, 1, sh.getMaxRows(), 1).protect().setDescription(PROTECT.TAB));
  ownerOnly_(sh.getRange(1, 8, 1, 2).protect().setDescription(PROTECT.TAB));
}

function protectAll_() {
  if (!isOwner_()) return 0;
  protectObjectRows_();
  try { protectSettings_(); } catch (e) { Logger.log('Защита настроек: ' + e.message); }
  const tabs = objectTabs_();
  tabs.forEach(protectObjectTab_);
  return tabs.length;
}

// ───────────────────────── копии вкладок ─────────────────────────

function backupSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(BACKUP_SHEET);
  if (!sh) {
    sh = ss.insertSheet(BACKUP_SHEET, ss.getSheets().length);
    sh.getRange(1, 1, 1, 3).setValues([['ID объекта', 'Сохранено', 'Данные вкладки (для восстановления)']]).setFontWeight('bold');
    sh.hideSheet();
    if (isOwner_()) ownerOnly_(sh.protect().setDescription('SYS: Копии вкладок объектов'));
  }
  return sh;
}

/** Раз в сутки: данные всех вкладок объектов → 98_КОПИИ_ВКЛАДОК (одна строка на объект). */
function backupObjectTabs_() {
  const sh = backupSheet_();
  const now = new Date();
  const rows = [];
  objectTabs_().forEach(t => {
    const id = String(t.getRange(TAB.ID).getValue() || '');
    if (!id || !tabIsComplete_(t)) return;
    const json = JSON.stringify(readObjectTab_(t));
    if (json.length < 49000) rows.push([id, now, json]);
  });
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 3).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 3).setNumberFormat('@').setValues(rows.map(r => [r[0], fmtDate_(r[1], 'dd.MM.yyyy HH:mm'), r[2]]));
  return rows.length;
}

/** Сохранённые данные вкладки объекта (или null). */
function tabBackup_(id) {
  const sh = ss_().getSheetByName(BACKUP_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  const row = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().find(r => String(r[0]) === String(id));
  if (!row) return null;
  try { return JSON.parse(row[2]); } catch (e) { return null; }
}

// ───────────────────────── удаление объекта (только руководитель) ─────────────────────────

/**
 * Меню: удалить объект — строка в 01_ОБЪЕКТЫ и вкладка. Задачи, обзвон, контент и отчёты остаются в журналах
 * (история работы), папка на Диске не удаляется — к имени добавляется «(удалён)».
 */
function deleteObject() {
  const ui = SpreadsheetApp.getUi();
  if (!isOwner_()) { ui.alert('Удалять объекты может только владелец таблицы (руководитель).'); return; }
  const r = ui.prompt('Удалить объект', 'ID объекта (как в 01_ОБЪЕКТЫ), например НОВ-001:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const id = String(r.getResponseText() || '').trim();
  const obj = objectById_(id);
  if (!obj) { ui.alert('Объекта с ID «' + id + '» нет в ' + SHEET_NAMES.OBJ + '.'); return; }
  if (ui.alert('Удалить объект?', obj.name + ' (' + id + ')\n\nУдалятся строка в 01_ОБЪЕКТЫ и вкладка объекта. Задачи, обзвон, контент и отчёты останутся в журналах, папка на Диске останется с пометкой «(удалён)».\n\nЕсли объект просто закрыт — лучше поставить статус, а не удалять.',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  deleteObject_(obj);
  ui.alert('Объект удалён', obj.name + ' (' + id + ')', ui.ButtonSet.OK);
}

function deleteObject_(obj) {
  const lock = userLock_();
  try {
    const tab = findObjectTab_(obj);
    if (tab) ss_().deleteSheet(tab);
    const sh = sheet_('OBJ');
    sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.getDescription() === PROTECT.OBJ) p.remove(); });
    sh.deleteRow(obj._row);
    try {
      const url = String(obj.folder_link || '');
      const m = /folders\/([\w-]+)/.exec(url);
      if (m) { const f = DriveApp.getFolderById(m[1]); if (f.getName().indexOf('(удалён)') < 0) f.setName(f.getName() + ' (удалён)'); }
    } catch (e) { /* папку можно переименовать вручную */ }
    logHistory_([{ sheet: SHEET_NAMES.OBJ, record_id: obj.id, obj_id: obj.id, field: 'Объект', old: obj.name, new: '', kind: HIST_KIND.CHANGE, note: 'Объект удалён' }], userEmail_());
    protectObjectRows_();
  } finally {
    lock.releaseLock();
  }
}

// ═════════════ 22_StrategyImport.gs ═════════════
/**
 * 22_StrategyImport — «Вставить стратегию из Claude»: ответ Claude по промпту «Стратегия объекта — для вставки во вкладку»
 * разносится по разделам вкладки объекта: аналоги, цена, сценарии, аудитории, каналы, выводы.
 * Формат ответа — блоки «## Раздел» и строки через «|» (как в промпте). Уже внесённые строки (то же первое поле) не дублируются.
 * Раздел «## Задачи на 2 недели» уходит в 02_ЗАДАЧИ (как «Внести задачи с оперативки», источник «Стратегия»).
 */

const STRAT_SECTIONS = [
  { re: /аналог/i, key: 'ANALOG', idx: [0, 1, 2, 3, 5, 6], name: 'Аналоги' },          // Аналог | Назначение | Площадь | Цена | Ссылка | Комментарий
  { re: /(^|[\s«])цен|позиционир/i, key: 'PRICE', kv: true, name: 'Цена и позиционирование' },
  { re: /сценари/i, key: 'SCEN', idx: [0, 1, 2, 3, 4], name: 'Сценарии' },           // Сценарий | Чек-лист | Что проверить | Консультанты | Вывод
  { re: /аудитор/i, key: 'AUD', idx: [0, 1, 2, 3, 4], name: 'Аудитории' },           // Аудитория | Кто | Портрет | Где искать | Приоритет
  { re: /канал|партн[её]р/i, key: 'CHAN', idx: [0, 1], name: 'Каналы и партнёры' },   // Канал | Что делаем
  { re: /материал|презентац|^кп\b|кп и/i, key: 'KP', idx: [0, 1, 2, 5], name: 'КП и материалы' },  // Материал | Какое | Для аудитории | Комментарий
  { re: /вывод|решени/i, key: 'DEC', idx: [1, 3], name: 'Выводы и решения' },         // Вывод | Что делаем дальше
];

function importStrategy() {
  const sel = selectedObjectId_();
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name);
  const options = objs.map(o => '<option value="' + htmlEscape_(o.id) + '"' + (String(o.id) === String(sel) ? ' selected' : '') + '>' + htmlEscape_(o.name + ' (' + o.id + ')') + '</option>').join('');
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif">' +
    '<div>Объект: <select id="o" style="max-width:520px">' + options + '</select></div>' +
    '<div style="color:#5f6368;font-size:12px;margin:6px 0">1) «Промпт для Claude по объекту» → «Стратегия объекта — для вставки во вкладку» → в Claude (можно приложить презентацию). 2) Скопируйте ответ Claude целиком и вставьте сюда.</div>' +
    '<textarea id="t" style="width:100%;height:280px;font:12px monospace"></textarea>' +
    '<div style="margin-top:8px"><button onclick="prev()">Проверить</button> <button id="go" onclick="go()" disabled>Вставить во вкладку</button></div>' +
    '<div id="r" style="margin-top:8px;font-size:13px"></div></div><script>' +
    'function v(){return [document.getElementById("o").value,document.getElementById("t").value];}' +
    'function prev(){var a=v();google.script.run.withSuccessHandler(function(x){document.getElementById("r").innerHTML=x.html;document.getElementById("go").disabled=!x.total;}).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).previewStrategy(a[0],a[1]);}' +
    'function go(){var a=v();document.getElementById("go").disabled=true;document.getElementById("r").textContent="Вставляю…";google.script.run.withSuccessHandler(function(m){document.getElementById("r").textContent=m;}).withFailureHandler(function(e){document.getElementById("r").textContent="Ошибка: "+e.message;}).runStrategyImport(a[0],a[1]);}' +
    '</script>').setWidth(640).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'Вставить стратегию из Claude');
}

/** Текст ответа → {sections: {KEY: [[...]]}, kv: {key: value}}. */
function parseStrategy_(text) {
  const out = { tables: {}, kv: {}, taskLines: [], baseLines: [], contLines: [] };
  let cur = null;
  String(text || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    const h = /^#{1,4}\s*(.+)$/.exec(line) || /^\*\*(.+?)\*\*:?$/.exec(line);
    if (h) {
      const t = h[1].trim();
      cur = /^задач/i.test(t) ? { tasks: true } : /^база/i.test(t) ? { base: true } : /^контент/i.test(t) ? { cont: true } : STRAT_SECTIONS.find(s => s.re.test(t)) || null;
      return;
    }
    if (!cur) return;
    if (cur.tasks) { out.taskLines.push(line); return; }
    if (cur.base) { out.baseLines.push(line); return; }
    if (cur.cont) { out.contLines.push(line); return; }
    if (cur.kv) {
      const m = /^[-•*\s]*(.+?)\s*[:—|]\s*(.+)$/.exec(line);
      if (!m) return;
      const k = m[1].toLowerCase(), val = m[2].replace(/\|\s*$/, '').trim();
      if (/рекоменд/.test(k)) out.kv.rec_price = moneyOf_(val);
      else if (/миним/.test(k)) out.kv.min_price = moneyOf_(val);
      else if (/позицион/.test(k)) out.kv.positioning = val;
      else if (/вывод/.test(k)) out.kv.price_note = val;
      return;
    }
    if (line.indexOf('|') < 0 || /^\|?\s*:?-{2,}/.test(line)) return;
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim().replace(/^\*\*|\*\*$/g, ''));
    const isHeader = /^(аналог|адрес|сценари|аудитори|канал|вывод|материал)/i.test(cells[0]) && cells[0].length < 30 &&
      /назначен|чек-лист|кто|что делаем|что проверить|портрет|площадь/i.test(cells.slice(1).join(' '));
    if (!cells[0] || isHeader) return; // строка заголовка таблицы
    (out.tables[cur.key] = out.tables[cur.key] || []).push(cells);
  });
  return out;
}

/** «Аудитория | Компания | Сайт | Кому звонить | Почему подходит» → строки 03_ОБЗВОН_И_КП (без дублей по компании у объекта). */
function strategyBaseRows_(obj, lines, plan) {
  const norm = x => String(x || '').trim().toLowerCase().replace(/[«»"']/g, '');
  const have = readTable_('BASE').rows.filter(r => String(r.obj_id) === String(obj.id)).map(r => norm(r.company));
  const owner = teamDefaults_().assistant || '';
  const out = [];
  lines.forEach(line => {
    if (line.indexOf('|') < 0 || /^\|?\s*:?-{2,}/.test(line)) return;
    const c = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim().replace(/^\*\*|\*\*$/g, ''));
    if (c.length < 2 || !c[1] || /^компания$/i.test(c[1]) || /^аудитори/i.test(c[0]) && /компани/i.test(c[1])) return;
    if (have.indexOf(norm(c[1])) >= 0) { plan.skipped++; return; }
    have.push(norm(c[1]));
    const site = /^(https?:\/\/|www\.|[\w-]+\.[a-zа-я]{2,})/i.test(c[2] || '') ? c[2] : '';
    const row = { obj_id: String(obj.id), audience: c[0], company: c[1], site: site, contact: c[3] || '', fit_note: c[4] || '', owner: owner };
    // необязательно: 6-я колонка — дата КП (перенос уже сделанной работы), 7-я — ответ / комментарий
    const kpDate = parseRuDate_(c[5]);
    if (kpDate) { row.kp_date = kpDate; row.kp_type = dictValues_('kp_types')[0] || ''; }
    if (c[6]) {
      const resp = dictValues_('responses').find(x => x.toLowerCase() === c[6].toLowerCase());
      if (resp) { row.response = resp; row.response_date = kpDate || today_(); } else row.call_result = c[6];
    }
    if (c[7]) { row.next_step = c[7]; row.next_date = parseRuDate_(c[7]) || today_(); } // 8-я колонка — следующий шаг (дата внутри текста или сегодня)
    out.push(row);
    const other = companyElsewhere_(c[1], obj.id);
    if (other.length) (plan.baseDup = plan.baseDup || []).push(c[1] + ' — уже по объекту ' + other.map(x => (objectById_(x.obj_id) || {}).name || x.obj_id).join(', '));
  });
  return out;
}

/** «Тема | Площадка | Формат | Цель | Дата | Кто делает | Сценарий» → строки 04_КОНТЕНТ (без дублей: объект + тема + площадка). */
function strategyContentRows_(obj, lines, plan) {
  const norm = x => String(x || '').trim().toLowerCase();
  const pick = (dict, v, fallback) => {
    const vals = dictValues_(dict), n = norm(v);
    if (!n) return fallback;
    return vals.find(x => norm(x) === n) || vals.find(x => n.indexOf(norm(x).split(' ')[0]) >= 0 || norm(x).indexOf(n) >= 0) ||
      (dict === 'platforms' && /vk|вк/.test(n) ? vals.find(x => /vk/i.test(x)) : '') || (dict === 'platforms' && /youtube|ютуб|shorts/.test(n) ? vals.find(x => /youtube/i.test(x)) : '') || fallback;
  };
  const people = dictRows_('people');
  const smm = (people.find(p => /smm/i.test(String(p[1]))) || [])[0] || '';
  const have = readTable_('CONT').rows.filter(r => String(r.obj_id) === String(obj.id)).map(r => norm(r.topic) + '|' + norm(r.platform));
  const out = [];
  lines.forEach(line => {
    if (line.indexOf('|') < 0 || /^\|?\s*:?-{2,}/.test(line)) return;
    const c = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim().replace(/^\*\*|\*\*$/g, ''));
    if (!c[0] || /^(ролик|тема)$/i.test(c[0]) || /площадк/i.test(c[1] || '') && /^(ролик|тема)/i.test(c[0])) return;
    const platform = pick('platforms', c[1], dictValues_('platforms').indexOf('Другое') >= 0 ? 'Другое' : '');
    const key = norm(c[0]) + '|' + norm(platform);
    if (have.indexOf(key) >= 0) { plan.skipped++; return; }
    have.push(key);
    const owner = people.map(p => p[0]).find(p => norm(p) === norm(c[5])) || smm;
    out.push({ obj_id: String(obj.id), topic: c[0], platform: platform, format: pick('content_formats', c[2], 'Рилс'), goal: pick('content_goals', c[3], ''),
      pub_date: parseRuDate_(c[4]) || '', owner: owner, script: c[6] || '', status: dictValues_('content_status')[0] || '' });
  });
  return out;
}

/** Добавляет компании в 03_ОБЗВОН_И_КП и ставит в строках список аудиторий объекта. */
function addBaseRows_(rows) {
  const cache = {};
  const now = new Date(), user = userEmail_();
  appendRows_('BASE', rows.map(r => Object.assign({ id: nextId_('BASE', cache), created_at: now, author: user }, r)));
  try { refreshBaseAudienceLists_(rows.map(r => r.obj_id)); } catch (e) { /* списки обновятся утром */ }
}

const KV_LABELS = { rec_price: 'Рекомендуемая цена', min_price: 'Минимальная цена', positioning: 'Позиционирование', price_note: 'Вывод по цене' };
function kvLabel_(k) { return KV_LABELS[k] || k; }
function fmtKv_(v) { return typeof v === 'number' ? v.toLocaleString('ru-RU') : String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v); }

function moneyOf_(s) {
  const t = String(s).toLowerCase().replace(/\s| /g, '').replace(',', '.');
  const m = /(\d+(?:\.\d+)?)(млрд|млн|тыс)?/.exec(t);
  if (!m) return '';
  let v = Number(m[1]);
  if (m[2] === 'млрд') v *= 1e9; else if (m[2] === 'млн') v *= 1e6; else if (m[2] === 'тыс') v *= 1e3;
  return Math.round(v);
}

function numOf_(s) {
  const n = Number(String(s).replace(/\s| /g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return isNaN(n) || String(s).trim() === '' ? '' : n;
}

/** Значения строки раздела по столбцам вкладки (формулы пропускаются, списки — к значениям справочника). */
function strategyRow_(sec, cells) {
  const cols = objTabSections_().find(s => s.key === sec.key).cols;
  const row = {};
  sec.idx.forEach((ci, i) => {
    const c = cols[ci];
    let v = String(cells[i] === undefined ? '' : cells[i]).trim();
    if (!v || v === '—' || v === '-') return;
    if (c.k === 'num') v = numOf_(v);
    else if (c.k === 'money') v = /млн|млрд|тыс/i.test(v) ? moneyOf_(v) : numOf_(v);
    else if (c.k === 'dd') {
      const vals = c.dict ? dictValues_(c.dict) : (c.list === 'D.lib_checklists' ? readTable_('LIB').rows.filter(r => r.kind === 'Чек-лист').map(r => r.title) : []);
      const stars = (v.match(/★|\*/g) || []).length;
      v = vals.find(x => x.toLowerCase() === v.toLowerCase()) || vals.find(x => v.toLowerCase().indexOf(x.toLowerCase()) === 0) ||
        (c.dict === 'priorities' && stars ? vals.find(x => x.length === Math.min(3, stars)) : '') || '';
    }
    if (v !== '') row[ci] = v;
  });
  if (sec.key === 'SCEN' && row[5] === undefined) row[5] = dictValues_('scenario_status')[0] || '';
  if (sec.key === 'CHAN' && row[3] === undefined) row[3] = dictValues_('work_status')[0] || '';
  if (sec.key === 'KP' && row[4] === undefined) row[4] = dictValues_('work_status')[0] || '';
  if (sec.key === 'DEC') { row[0] = today_(); const p = personByEmail_(userEmail_()); if (p) row[2] = p; }
  return row;
}

function strategyPlan_(objId, text) {
  const obj = objectById_(objId);
  if (!obj) throw new Error('Объект не найден');
  const tab = findObjectTab_(obj);
  if (!tab) throw new Error('У объекта нет вкладки — «Обновить (ID, вкладки, строки)»');
  const parsed = parseStrategy_(text);
  const have = readObjectTab_(tab);
  // цена и позиционирование: пустое заполняется, изменившееся — обновляется (прежнее значение уходит в 09_ИСТОРИЯ)
  const kv = {}, kvOld = {};
  Object.keys(parsed.kv).forEach(k => {
    const v = parsed.kv[k], old = have.kv[k];
    if (v === '' || v === undefined) return;
    const empty = old === '' || old === undefined || old === null;
    if (!empty && String(old).trim() === String(v).trim()) return;
    kv[k] = v;
    if (!empty) kvOld[k] = old;
  });
  const plan = { obj: obj, tab: tab, rows: {}, kv: kv, kvOld: kvOld, skipped: 0, tasks: [], taskErrors: [], base: [] };
  if (parsed.baseLines.length) plan.base = strategyBaseRows_(obj, parsed.baseLines, plan);
  plan.cont = parsed.contLines.length ? strategyContentRows_(obj, parsed.contLines, plan) : [];
  if (parsed.taskLines.length) {
    const t = parseMeetingTasks_(parsed.taskLines.join('\n'), obj.id);
    const norm = x => String(x || '').trim().toLowerCase();
    const haveTasks = readTable_('TASK').rows.filter(r => String(r.obj_id) === String(obj.id)).map(r => norm(r.task));
    t.ok.filter(o => o.task).forEach(o => {
      if (haveTasks.indexOf(norm(o.task)) >= 0) { plan.skipped++; return; }
      haveTasks.push(norm(o.task));
      plan.tasks.push(o);
    });
    plan.taskErrors = t.errors;
  }
  STRAT_SECTIONS.filter(s => !s.kv).forEach(s => {
    const exist = (have.tables[s.key] || []).map(r => String(r[s.idx[0]] || '').trim().toLowerCase());
    (parsed.tables[s.key] || []).forEach(cells => {
      const row = strategyRow_(s, cells);
      const first = String(row[s.idx[0]] || '').trim().toLowerCase();
      if (!first) return;
      if (exist.indexOf(first) >= 0) { plan.skipped++; return; }
      exist.push(first);
      (plan.rows[s.key] = plan.rows[s.key] || []).push(row);
    });
  });
  return plan;
}

function previewStrategy(objId, text) {
  const p = strategyPlan_(objId, text);
  const parts = STRAT_SECTIONS.map(s => {
    if (s.kv) {
      const n = Object.keys(p.kv).length, upd = Object.keys(p.kvOld).length;
      return n ? s.name + ': ' + n + ' поля' + (upd ? ' (обновится ' + upd + ': ' + Object.keys(p.kvOld).map(k => kvLabel_(k) + ' ' + fmtKv_(p.kvOld[k]) + ' → ' + fmtKv_(p.kv[k])).join('; ') + ')' : '') : '';
    }
    const n = (p.rows[s.key] || []).length;
    return n ? s.name + ': ' + n + ' строк' : '';
  }).filter(Boolean);
  if (p.tasks.length) parts.push('Задачи в 02_ЗАДАЧИ: ' + p.tasks.length);
  if (p.base.length) parts.push('Компании в 03_ОБЗВОН_И_КП: ' + p.base.length);
  if (p.cont.length) parts.push('Публикации в 04_КОНТЕНТ: ' + p.cont.length);
  const dupNote = p.baseDup && p.baseDup.length ? '<br><span style="color:#E65100">Уже в работе по другим объектам (согласуйте, чтобы не звонить дважды):<br>' + p.baseDup.map(htmlEscape_).join('<br>') + '</span>' : '';
  const total = parts.length;
  const errs = p.taskErrors.length ? '<br><span style="color:#B71C1C">' + p.taskErrors.map(htmlEscape_).join('<br>') + '</span>' : '';
  return {
    total: total,
    html: total ? 'Будет добавлено во вкладку «' + htmlEscape_(p.obj.name) + '»:<br>• ' + parts.map(htmlEscape_).join('<br>• ') + (p.skipped ? '<br><span style="color:#80868B">Уже есть во вкладке, пропущено: ' + p.skipped + '</span>' : '') + errs + dupNote
      : p.skipped ? '<span style="color:#2E7D32">✓ Всё из этого текста уже есть во вкладке «' + htmlEscape_(p.obj.name) + '» (строк: ' + p.skipped + ') — повторно вставлять не нужно.</span>'
      : '<span style="color:#B71C1C">Не нашла разделов. Нужен ответ по промпту «Стратегия объекта — для вставки во вкладку»: заголовки «## Аналоги», «## Сценарии»… и строки через «|».</span>',
  };
}

function runStrategyImport(objId, text) {
  const lock = userLock_();
  try {
    const p = strategyPlan_(objId, text);
    const sh = p.tab;
    let n = 0;
    STRAT_SECTIONS.filter(s => !s.kv).forEach(s => {
      (p.rows[s.key] || []).forEach(row => {
        const keys = Object.keys(row).map(Number).sort((a, b) => a - b);
        const r = appendTabRow_(sh, s.key, [row[keys[0]]]);
        keys.forEach(ci => sh.getRange(r, 2 + ci).setValue(row[ci]));
        n++;
      });
    });
    const kvKeys = Object.keys(p.kv);
    const kvHist = [];
    if (kvKeys.length) {
      const marks = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
      kvKeys.forEach(k => {
        const i = marks.findIndex(m => String(m[0]) === 'K:' + k);
        if (i < 0) return;
        sh.getRange(i + 1, 3).setValue(p.kv[k]); n++;
        if (k in p.kvOld) kvHist.push({ sheet: sh.getName(), record_id: p.obj.id, obj_id: p.obj.id, field: '2. ' + kvLabel_(k), old: p.kvOld[k], new: p.kv[k], kind: HIST_KIND.CHANGE });
      });
    }
    let tasks = 0;
    if (p.tasks.length) tasks = addMeetingTasks_({ ok: p.tasks, errors: [] }, 'Стратегия').tasks;
    if (p.base.length) addBaseRows_(p.base);
    if (p.cont.length) { const cc = {}; appendRows_('CONT', p.cont.map(r => Object.assign({ id: nextId_('CONT', cc), created_at: new Date(), author: userEmail_() }, r))); }
    try { refreshIdleAudiences_(); } catch (e) { /* обновится утром */ }
    let docNote = '';
    try { if (n || tasks) { appendStrategyDoc_(p.obj, 'стратегия из Claude', strategyThesis_(p)); docNote = ' Документ «' + strategyDocName_(p.obj) + '» в папке объекта пополнен.'; } }
    catch (e) { docNote = ' ⚠ Документ стратегии не пополнен: ' + e.message; }
    logHistory_(kvHist.concat([{ sheet: sh.getName(), record_id: p.obj.id, obj_id: p.obj.id, field: 'Стратегия', old: '', new: 'вставлено из Claude: ' + n + (tasks ? ', задач: ' + tasks : '') + (p.base.length ? ', компаний в базу: ' + p.base.length : '') + (p.cont.length ? ', публикаций: ' + p.cont.length : ''), kind: HIST_KIND.CHANGE }]), userEmail_());
    return 'Готово: добавлено ' + n + ' строк / полей во вкладку «' + p.obj.name + '»' + (tasks ? ', задач в 02_ЗАДАЧИ: ' + tasks : '') + (p.base.length ? ', компаний в 03_ОБЗВОН_И_КП: ' + p.base.length : '') + (p.cont.length ? ', публикаций в 04_КОНТЕНТ: ' + p.cont.length : '') + (p.skipped ? ', пропущено как уже внесённые: ' + p.skipped : '') + '.' + docNote + ' Проверьте вкладку.';
  } finally {
    lock.releaseLock();
  }
}

// ═════════════ 23_StrategyDoc.gs ═════════════
/**
 * 23_StrategyDoc — документ «Маркетинговая стратегия — <объект>» в папке каждого объекта (Google Doc).
 * Один файл на объект, он только пополняется: каждая вставка стратегии из Claude и решения с оперативки
 * дописываются блоком «дата · кто добавил» → тезисы по разделам. Старое не удаляется — это история стратегии.
 * Аналитика (цены, аналоги, расчёты) — отдельные файлы в папке «Аналитика».
 */

const STRATEGY_DOC_PREFIX = 'Маркетинговая стратегия — ';

function strategyDocName_(obj) { return STRATEGY_DOC_PREFIX + obj.name; }

/** Документ стратегии объекта: найти в папке объекта (по началу названия) или создать. */
function ensureStrategyDoc_(obj) {
  const folder = ensureObjectFolder_(obj.id, 'ROOT');
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(STRATEGY_DOC_PREFIX) === 0 && !f.isTrashed() && String(f.getMimeType()).indexOf('document') >= 0) return f;
  }
  const doc = DocumentApp.create(strategyDocName_(obj));
  const b = doc.getBody();
  b.getParagraphs()[0].setText('Маркетинговая стратегия: ' + obj.name);
  b.getParagraphs()[0].setHeading(DocumentApp.ParagraphHeading.TITLE);
  b.appendParagraph([obj.address, obj.kind, obj.deal, obj.area ? obj.area + ' м²' : '', 'ID ' + obj.id].filter(Boolean).join(' · '));
  b.appendParagraph('Документ пополняется: новые записи добавляются ниже — сначала дата, затем тезисы. Старое не удаляем — это история стратегии. Аналитика — отдельные файлы в папке «Аналитика».')
    .editAsText().setItalic(true).setFontSize(10);
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(folder);
  return file;
}

/**
 * Дописать блок в документ стратегии.
 * sections: [{title: 'Сценарии', lines: ['…', '…']}, …]; пустые разделы пропускаются.
 */
function appendStrategyDoc_(obj, source, sections) {
  const secs = sections.filter(s => s.lines && s.lines.length);
  if (!secs.length) return '';
  const file = isServiceObject_(obj) ? ensureAgencyDecisionsDoc_() : ensureStrategyDoc_(obj);
  const doc = DocumentApp.openById(file.getId());
  const b = doc.getBody();
  const who = personByEmail_(userEmail_()) || userEmail_();
  b.appendParagraph(fmtDate_(new Date(), 'dd.MM.yyyy') + (source ? ' · ' + source : '') + (who ? ' · ' + who : ''))
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  secs.forEach(s => {
    b.appendParagraph(s.title).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    s.lines.forEach(l => b.appendListItem(String(l)).setGlyphType(DocumentApp.GlyphType.BULLET));
  });
  doc.saveAndClose();
  return file.getUrl();
}

/** Тезисы по разделам из вставленных строк вкладки (для документа стратегии). */
function strategyThesis_(plan) {
  const cols = {};
  objTabSections_().forEach(s => { if (s.cols) cols[s.key] = s.cols; });
  const money = v => typeof v === 'number' ? v.toLocaleString('ru-RU') + ' ₽' : v;
  const j = (row, map) => map.map(m => {
    const v = row[m[0]];
    if (v === undefined || v === '') return '';
    return (m[1] ? m[1] + ': ' : '') + (m[2] ? m[2](v) : v);
  }).filter(Boolean);
  const rows = key => plan.rows[key] || [];
  const out = [];
  const kv = plan.kv;
  const price = [];
  if (kv.positioning) price.push('Позиционирование: ' + kv.positioning);
  if (kv.rec_price) price.push('Рекомендуемая цена: ' + money(kv.rec_price));
  if (kv.min_price) price.push('Минимальная цена: ' + money(kv.min_price));
  if (kv.price_note) price.push('Вывод по цене: ' + kv.price_note);
  out.push({ title: 'Цена и позиционирование', lines: price });
  out.push({ title: 'Аналоги', lines: rows('ANALOG').map(r => { const p = j(r, [[1], [2, '', v => v + ' м²'], [3, '', money]]); return r[0] + (p.length ? ' — ' + p.join(', ') : '') + (r[6] ? '. ' + r[6] : ''); }) });
  out.push({ title: 'Сценарии использования', lines: rows('SCEN').map(r => r[0] + (r[4] ? ' — ' + r[4] : '') + (r[5] ? ' [' + r[5] + ']' : '') + (j(r, [[2, 'проверить'], [3, 'привлечь']]).length ? '. ' + j(r, [[2, 'проверить'], [3, 'привлечь']]).join('; ') : '')) });
  out.push({ title: 'Целевые аудитории', lines: rows('AUD').map(r => (r[4] ? r[4] + ' ' : '') + r[0] + (r[1] ? ' (' + r[1] + ')' : '') + (r[2] ? ' — ' + r[2] : '') + (r[3] ? '. Где искать: ' + r[3] : '')) });
  out.push({ title: 'Каналы и партнёры', lines: rows('CHAN').map(r => r[0] + (r[1] ? ' — ' + r[1] : '')) });
  out.push({ title: 'КП и материалы', lines: rows('KP').map(r => r[0] + (r[1] ? ' (' + r[1] + ')' : '') + (r[2] ? ' — для: ' + r[2] : '') + (r[5] ? '. ' + r[5] : '')) });
  out.push({ title: 'Выводы и решения', lines: rows('DEC').map(r => r[1] + (r[3] ? ' → ' + r[3] : '')) });
  out.push({ title: 'Задачи на 2 недели', lines: (plan.tasks || []).map(o => o.task + (o.owner ? ' — ' + o.owner : '') + (o.plan !== '' && o.plan !== undefined ? ', ' + o.plan + (o.unit ? ' ' + o.unit : '') : '') + (o.deadline ? ', до ' + fmtDate_(o.deadline) : '')) });
  return out;
}

/** Меню / установка: документ стратегии у каждого объекта. */
function ensureAllStrategyDocs_(start) {
  start = start || Date.now();
  let n = 0;
  readTable_('OBJ').rows.forEach(o => {
    if (!o.id || !o.name || isServiceObject_(o) || Date.now() - start > 4 * 60000) return;
    try { ensureStrategyDoc_(o); n++; } catch (e) { Logger.log('Стратегия ' + o.id + ': ' + e.message); }
  });
  return n;
}

// ═════════════ 24_AnalogTemplate.gs ═════════════
/**
 * 24_AnalogTemplate — шаблон «Анализ аналогов (конкуренты)» в 02_ШАБЛОНЫ.
 * Файл берётся из репозитория (templates/analogs_template.xlsx) и загружается как Google Таблица.
 * Новая версия шаблона заменяет старую (старая — в корзину). Копии в папках объектов не трогаются.
 */

const ANALOG_TEMPLATE_VERSION = '3';
const ANALOG_TEMPLATE_NAME = 'Шаблон — Анализ аналогов (конкуренты)';
const ANALOG_TEMPLATE_URL = 'https://raw.githubusercontent.com/kopacheva3103-bot/broker_nata_media/claude/gallant-gauss-krudky/exclusive_system/templates/analogs_template.xlsx';

/** Установка / меню: создать или обновить шаблон. Возвращает текст для журнала установки или ''. */
function ensureAnalogTemplate_(force) {
  const folder = folderById_(cfgGet_('FOLDER_TEMPLATES_ID'));
  if (!folder) return '';
  const mark = 'analogs v' + ANALOG_TEMPLATE_VERSION;
  const old = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(ANALOG_TEMPLATE_NAME) !== 0) continue;
    if (!force && f.getDescription() === mark && f.getMimeType() === MimeType.GOOGLE_SHEETS) return '';
    old.push(f);
  }
  const res = UrlFetchApp.fetch(ANALOG_TEMPLATE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('не скачался шаблон (' + res.getResponseCode() + ')');
  const id = uploadAsSheet_(res.getBlob(), ANALOG_TEMPLATE_NAME, folder.getId(), mark);
  old.forEach(f => { try { f.setTrashed(true); } catch (e) { /* чужой файл — оставляем */ } });
  return 'Шаблон «' + ANALOG_TEMPLATE_NAME + '» в 02_ШАБЛОНЫ ' + (old.length ? 'обновлён' : 'создан') + ': https://docs.google.com/spreadsheets/d/' + id;
}

/** Excel → Google Таблица через Drive API (multipart upload с конвертацией). */
function uploadAsSheet_(blob, name, folderId, description) {
  const boundary = 'b' + Utilities.getUuid();
  const meta = { name: name, mimeType: MimeType.GOOGLE_SHEETS, parents: [folderId], description: description };
  const head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--' + boundary + '\r\nContent-Type: ' + MimeType.MICROSOFT_EXCEL + '\r\n\r\n';
  const tail = '\r\n--' + boundary + '--';
  const body = Utilities.newBlob(head).getBytes().concat(blob.getBytes()).concat(Utilities.newBlob(tail).getBytes());
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: body,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('Drive: ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText()).id;
}

/** Меню: обновить шаблон анализа аналогов принудительно. */
function updateAnalogTemplate() {
  if (!requireAdmin_('Обновить шаблон анализа аналогов')) return;
  const msg = ensureAnalogTemplate_(true);
  SpreadsheetApp.getUi().alert(msg || 'Папка 02_ШАБЛОНЫ не найдена — запустите «Установить / обновить систему».');
}

// ═════════════ 25_MediaTasks.gs ═════════════
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
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && !isServiceObject_(o));
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

// ═════════════ 26_BaseTools.gs ═════════════
/**
 * 26_BaseTools — помощь ассистенту в 03_ОБЗВОН_И_КП:
 *  - выпадающий список «Аудитория» в каждой строке — аудитории из вкладки объекта (цифры во вкладке считаются только при точном совпадении);
 *  - напоминание о повторном контакте: КП отправлено, ответа нет 3 рабочих дня, следующий шаг не назначен → шаг и дата ставятся сами;
 *  - утренняя сводка каждому сотруднику с email: просроченные задачи, звонки и повторные контакты на сегодня.
 */

const FOLLOWUP_DAYS = 3;
const FOLLOWUP_TEXT = 'Повторный контакт: получили ли КП, есть ли вопросы';

/** Аудитории объекта из раздела 4 его вкладки. */
function objectAudiences_(objId) {
  const obj = objectById_(objId);
  const tab = obj ? findObjectTab_(obj) : null;
  if (!tab) return [];
  const rows = readObjectTab_(tab).tables.AUD || [];
  const out = [];
  rows.forEach(r => { const a = String(r[0] || '').trim(); if (a && out.indexOf(a) < 0) out.push(a); });
  return out;
}

/** Ставит в столбце «Аудитория» 03_ОБЗВОН_И_КП список аудиторий объекта строки. objIds — только эти объекты (по умолчанию все). */
function refreshBaseAudienceLists_(objIds) {
  const t = readTable_('BASE');
  const col = sheetSpecs_().BASE.fields.findIndex(f => f.key === 'audience') + 1;
  const only = objIds ? objIds.map(String) : null;
  const lists = {};
  let n = 0;
  // соседние строки одного объекта — одним диапазоном
  let start = 0, prevId = '', prevRow = 0;
  const flush = (endRow) => {
    if (!start || !prevId) return;
    const list = lists[prevId];
    const rng = t.sh.getRange(start, col, endRow - start + 1, 1);
    if (list.length) {
      rng.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false)
        .setHelpText('Аудитории из вкладки объекта. Нужной нет — сначала добавьте её во вкладку (раздел 4).').build());
      n += endRow - start + 1;
    }
  };
  t.rows.forEach(r => {
    const id = String(r.obj_id || '');
    const use = id && (!only || only.indexOf(id) >= 0);
    if (use && !(id in lists)) lists[id] = objectAudiences_(id);
    if (use && id === prevId && r._row === prevRow + 1) { prevRow = r._row; return; }
    flush(prevRow);
    start = use ? r._row : 0; prevId = use ? id : ''; prevRow = r._row;
  });
  flush(prevRow);
  return n;
}

/** КП без ответа дольше FOLLOWUP_DAYS рабочих дней и без следующего шага → «Повторный контакт» на сегодня. */
function scheduleFollowUps_() {
  const t = readTable_('BASE');
  const today = today_();
  let n = 0;
  t.rows.forEach(r => {
    if (!(r.kp_date instanceof Date) || r.next_step || r.next_date) return;
    const cls = r.response ? dictClassOf_('responses', r.response) : 'NONE';
    if (cls && cls !== 'NONE') return;
    if (workdayAfter_(r.kp_date, FOLLOWUP_DAYS) > today) return;
    writeFields_(t.sh, 'BASE', r._row, { next_step: FOLLOWUP_TEXT, next_date: today });
    n++;
  });
  return n;
}

/** Утренняя сводка на почту каждому сотруднику, у кого указан email (08_НАСТРОЙКИ → «Утренняя сводка» = ДА). */
function sendDailyDigest_(now) {
  if (String(cfgGet_('DIGEST_ON') || 'ДА').trim().toUpperCase() !== 'ДА') return 0;
  const today = now || today_();
  if (today.getDay() === 0 || today.getDay() === 6) return 0;
  const people = dictRows_('people').filter(p => p[0] && /@/.test(String(p[2] || '')));
  if (!people.length) return 0;
  const objName = {};
  readTable_('OBJ').rows.forEach(o => { objName[String(o.id)] = o.name; });
  const tasks = readTable_('TASK').rows.filter(r => r.task && dictClassOf_('task_status', r.status) === CLS.OPEN && r.deadline instanceof Date && r.deadline <= today);
  const base = readTable_('BASE').rows.filter(r => r.company && r.next_date instanceof Date && r.next_date <= today);
  let idle = [];
  try { idle = idleAudiences_(); } catch (e) { /* без сигнала */ }
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const d = x => fmtDate_(x);
  let sent = 0;
  people.forEach(p => {
    const name = String(p[0]).trim(), email = String(p[2]).trim();
    const my = tasks.filter(r => r.owner === name);
    const calls = base.filter(r => r.owner === name);
    const myIdle = idle.filter(x => x.obj.assistant === name || x.obj.manager === name);
    if (!my.length && !calls.length && !myIdle.length) return;
    const li = arr => '<ul>' + arr.join('') + '</ul>';
    let html = '<p>Доброе утро! План на ' + d(today) + ':</p>';
    if (my.length) html += '<p><b>Задачи со сроком сегодня и просроченные (' + my.length + ')</b></p>' +
      li(my.map(r => '<li>' + esc(objName[String(r.obj_id)] || r.obj_id) + ': ' + esc(r.task) + ' — срок ' + d(r.deadline) + (r.deadline < today ? ' <b style="color:#B71C1C">просрочено</b>' : '') + '</li>'));
    if (calls.length) html += '<p><b>Звонки и повторные контакты (' + calls.length + ')</b></p>' +
      li(calls.map(r => '<li>' + esc(r.company) + ' (' + esc(objName[String(r.obj_id)] || r.obj_id) + ')' + (r.contact ? ', ' + esc(r.contact) : '') + ' — ' + esc(r.next_step || 'следующий шаг') + '</li>'));
    if (myIdle.length) html += '<p><b>Аудитории первой волны (★★★) без компаний в базе (' + myIdle.length + ')</b></p>' +
      li(myIdle.map(x => '<li>' + esc(x.obj.name) + ': «' + esc(x.name) + '» — промпт «Целевые аудитории объекта» даст базу для обзвона</li>'));
    html += '<p><a href="' + ss_().getUrl() + '">Открыть систему</a></p>';
    MailApp.sendEmail({ to: email, subject: 'План на ' + d(today) + ': задач ' + my.length + ', контактов ' + calls.length, htmlBody: html, name: 'Система эксклюзивов' });
    sent++;
  });
  return sent;
}

// ───────────────────────── аудитории объекта: приоритеты и цифры ─────────────────────────

/** Строки раздела 4 вкладки: [{name, who, portrait, where, prio (0–3)}]. */
function objectAudienceRows_(objId) {
  const obj = objectById_(objId);
  const tab = obj ? findObjectTab_(obj) : null;
  if (!tab) return [];
  return (readObjectTab_(tab).tables.AUD || []).filter(r => String(r[0] || '').trim()).map(r => ({
    name: String(r[0]).trim(), who: r[1], portrait: r[2], where: r[3], prio: (String(r[4] || '').match(/★/g) || []).length,
  }));
}

/** Цифры по аудиториям объекта из 03_ОБЗВОН_И_КП: {аудитория: {total, calls, kp, yes, kpWeek}}. */
function audienceStats_(objId, from, to) {
  const out = {};
  readTable_('BASE').rows.forEach(r => {
    if (String(r.obj_id) !== String(objId) || !r.company) return;
    const a = String(r.audience || '').trim() || 'Без аудитории';
    const s = out[a] = out[a] || { total: 0, calls: 0, kp: 0, yes: 0, kpWeek: 0 };
    s.total++;
    if (r.call_date instanceof Date) s.calls++;
    if (r.kp_date instanceof Date) { s.kp++; if (from && r.kp_date >= from && r.kp_date <= to) s.kpWeek++; }
    if (r.response && dictClassOf_('responses', r.response) === 'YES') s.yes++;
  });
  return out;
}

/** Строки «по аудиториям» для отчёта собственнику. */
function audienceReportLines_(objId, wk) {
  const mon = wk ? mondayOfWeekKey_(wk) : null;
  const st = audienceStats_(objId, mon, mon ? addDays_(mon, 6) : null);
  const names = Object.keys(st);
  if (!names.length) return [];
  const order = objectAudienceRows_(objId).map(a => a.name);
  names.sort((x, y) => (order.indexOf(x) < 0 ? 99 : order.indexOf(x)) - (order.indexOf(y) < 0 ? 99 : order.indexOf(y)));
  return ['Работа по целевым аудиториям (всего с начала работы):'].concat(names.map(n => {
    const s = st[n];
    return '• ' + n + ': в работе компаний — ' + s.total + ', звонков — ' + s.calls + ', отправлено КП — ' + s.kp +
      (s.kpWeek ? ' (за неделю — ' + s.kpWeek + ')' : '') + (s.yes ? ', проявили интерес — ' + s.yes : '');
  }));
}

/** Аудитории первой волны (★★★), по которым в базе нет ни одной компании: [{obj, name}]. */
function idleAudiences_() {
  const out = [];
  readTable_('OBJ').rows.filter(o => o.id && o.name && o.in_work !== 'НЕТ').forEach(o => {
    const top = objectAudienceRows_(o.id).filter(a => a.prio >= 3);
    if (!top.length) return;
    const st = audienceStats_(o.id);
    top.forEach(a => { if (!st[a.name]) out.push({ obj: o, name: a.name }); });
  });
  return out;
}

/** Записывает в 01_ОБЪЕКТЫ «Аудитории ★★★ без базы» (видно на дэшборде). */
function refreshIdleAudiences_() {
  const idle = idleAudiences_();
  const t = readTable_('OBJ');
  let n = 0;
  t.rows.filter(o => o.id).forEach(o => {
    const v = idle.filter(x => String(x.obj.id) === String(o.id)).map(x => x.name).join(', ');
    if (String(o.idle_aud || '') !== v) { writeFields_(t.sh, 'OBJ', o._row, { idle_aud: v }); n++; }
  });
  return idle.length;
}

/** Компания уже есть в базе по другому объекту: [{obj_id, audience, kp_date, response}]. */
function companyElsewhere_(company, objId) {
  const norm = x => String(x || '').trim().toLowerCase().replace(/[«»"'.,]/g, '').replace(/\s+/g, ' ');
  const key = norm(company);
  if (!key) return [];
  return readTable_('BASE').rows.filter(r => norm(r.company) === key && String(r.obj_id) !== String(objId));
}

// ───────────────────────── инструкция ассистенту на почту ─────────────────────────

const ASSISTANT_MANUAL_TITLE = '10 — Инструкция ассистента';

/** Один раз отправляет ассистентам (роль «Ассистент» с email) письмо со ссылкой на инструкцию из 03_ИНСТРУКЦИИ. */
function sendAssistantManual_(force) {
  const props = PropertiesService.getScriptProperties();
  const it = DriveApp.searchFiles('title contains "' + ASSISTANT_MANUAL_TITLE + '" and trashed = false');
  let doc = null;
  while (it.hasNext()) { const f = it.next(); if (!doc || f.getLastUpdated() > doc.getLastUpdated()) doc = f; }
  if (!doc) return [];
  const boss = String(cfgGet_('MANAGER_NAME') || 'руководитель');
  const sent = [];
  dictRows_('people').forEach(p => {
    const name = String(p[0] || '').trim(), role = String(p[1] || ''), email = String(p[2] || '').trim();
    if (!name || !/ассистент/i.test(role) || !/@/.test(email)) return;
    const key = 'MANUAL_SENT_' + email.toLowerCase();
    if (!force && props.getProperty(key) === doc.getId()) return;
    try { doc.addViewer(email); } catch (e) { /* доступ уже есть */ }
    const html = '<p>Здравствуйте!</p>' +
      '<p>Высылаю пошаговую инструкцию по работе в нашей системе эксклюзивов — что делать каждый день и каждую неделю:</p>' +
      '<p><a href="' + doc.getUrl() + '"><b>' + doc.getName() + '</b></a></p>' +
      '<p>Главное:</p><ul>' +
      '<li>каждый будний день в 9:00 на почту приходит «План на сегодня» — работаем по нему;</li>' +
      '<li>задачи со сроками будут в вашем Google Календаре;</li>' +
      '<li>каждый звонок и КП вносим в 03_ОБЗВОН_И_КП в тот же день, аудиторию — только из списка;</li>' +
      '<li>в пятницу до 19:00 закрываем задачи недели — в 20:00 отчёты уходят собственникам автоматически.</li></ul>' +
      '<p><a href="' + ss_().getUrl() + '">Открыть систему</a></p><p>' + boss + '</p>';
    MailApp.sendEmail({ to: email, subject: 'Инструкция по работе в системе эксклюзивов', htmlBody: html, name: boss });
    props.setProperty(key, doc.getId());
    sent.push(name);
  });
  return sent;
}

/** Меню: отправить инструкцию ассистенту ещё раз. */
function sendAssistantManual() {
  if (!requireAdmin_('Отправить ассистенту инструкцию')) return;
  const s = sendAssistantManual_(true);
  toast_(s.length ? 'Инструкция отправлена: ' + s.join(', ') : 'Не найден документ «' + ASSISTANT_MANUAL_TITLE + '…» или у ассистента нет email в 07_СПРАВОЧНИКИ.', 'Инструкция', 8);
}

// ═════════════ 27_Agency.gs ═════════════
/**
 * 27_Agency — «Агентство — общие задачи»: служебный объект для рутинных задач с оперативки, не привязанных к объекту
 * (CRM, соцсети агентства, регламенты, документы, найм, обучение). ID «АГЕНТСТВО», статус «Внутреннее» (не в работе):
 * без вкладки, папки, отчётов и дэшборда объектов; задачи — в 02_ЗАДАЧИ, календарях и утренней сводке как обычно.
 * Общие решения с оперативок — в документ «Решения оперативок — общие по агентству» в корневой папке системы.
 */

const AGENCY_ID = 'АГЕНТСТВО';
const AGENCY_NAME = 'Агентство — общие задачи';
const AGENCY_DOC_NAME = 'Решения оперативок — общие по агентству';

function isServiceObject_(o) { return !!o && String(o.id) === AGENCY_ID; }

/** Создаёт служебный объект, если его нет. */
function ensureAgencyObject_() {
  if (objectById_(AGENCY_ID)) return false;
  appendRow_('OBJ', Object.assign({}, teamDefaults_(), { id: AGENCY_ID, name: AGENCY_NAME, status: 'Внутреннее', created_at: today_() }));
  return true;
}

/** Документ для общих решений с оперативок (в корневой папке системы). */
function ensureAgencyDecisionsDoc_() {
  const root = folderById_(cfgGet_('FOLDER_ROOT_ID'));
  if (!root) throw new Error('Нет корневой папки системы — «Установить / обновить систему»');
  const it = root.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getName() === AGENCY_DOC_NAME && !f.isTrashed()) return f; }
  const doc = DocumentApp.create(AGENCY_DOC_NAME);
  const b = doc.getBody();
  b.getParagraphs()[0].setText(AGENCY_DOC_NAME);
  b.getParagraphs()[0].setHeading(DocumentApp.ParagraphHeading.TITLE);
  b.appendParagraph('Общие решения с оперативок (не по конкретному объекту). Новые записи добавляются ниже: сначала дата, затем решения.')
    .editAsText().setItalic(true).setFontSize(10);
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(root);
  return file;
}

// ═════════════ 28_AdReport.gs ═════════════
/**
 * 28_AdReport — раздел отчёта клиенту «Реклама на площадках» из отчёта по рекламе TopenLab.
 * Ссылка на отчёт (crm.topnlab.ru/lk/report/…) вставляется в 01_ОБЪЕКТЫ → «Отчёт по рекламе CRM (ссылка)».
 * Система сама берёт оттуда площадки, просмотры, избранное, обращения и ссылку на ЦИАН (показы — только руководителю). Саму ссылку клиенту не отправляем.
 * Цифры в CRM — накопительные с начала рекламы; «за неделю» считается по снимку прошлой недели.
 */

const AD_REPORT_API = 'https://ad-p.topnlab.ru/public/report';
const AD_SITE_NAMES = { CIAN: 'ЦИАН', AVITO: 'Авито', YANDEX: 'Яндекс Недвижимость', BANK: 'Домклик' };
const AD_MAIN_SITES = ['ЦИАН', 'Авито', 'Яндекс Недвижимость', 'Домклик'];

/** 1 площадке / 2 площадках / 5 площадках. */
function plural_(n, one, few, many) {
  const m = Math.abs(n) % 100, d = m % 10;
  if (m > 10 && m < 20) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}

function adReportHash_(url) {
  const m = /\/report\/([A-Za-z0-9=_%-]+)/.exec(String(url || ''));
  return m ? decodeURIComponent(m[1]) : '';
}

/** Данные отчёта по рекламе. Из ответа берём только цифры и площадки (там есть и лишние данные — не сохраняем). */
function fetchAdReport_(url) {
  const hash = adReportHash_(url);
  if (!hash) return null;
  const r = UrlFetchApp.fetch(AD_REPORT_API, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ active_only: true, paid_sites: true, partner_sites: true, hash: hash, period: -1 }),
  });
  if (r.getResponseCode() !== 200) throw new Error('отчёт по рекламе CRM: код ' + r.getResponseCode());
  const j = JSON.parse(r.getContentText());
  if (j.status !== 'success' || !j.data || !j.data.stats) throw new Error('отчёт по рекламе CRM: нет данных');
  return adStatsFrom_(j.data);
}

function adStatsFrom_(d) {
  const st = d.stats || {}, cfg = d.config || {};
  const num = x => Number(x) || 0;
  const sum = o => Object.keys(o || {}).reduce((s, k) => s + num(o[k]), 0);
  const order = ['CIAN', 'AVITO', 'YANDEX', 'BANK'];
  const sites = (d.sites || []).filter(s => s.is_active && num(s.ads_count) > 0)
    .sort((a, b) => {
      const ia = order.indexOf(a.uid), ib = order.indexOf(b.uid);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a.name).localeCompare(String(b.name));
    })
    .map(s => AD_SITE_NAMES[s.uid] || (String(s.name).indexOf('.') > 0 ? s.name : String(s.url_base || s.name).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')))
    .filter((x, i, a) => x && a.indexOf(x) === i);
  const cianSite = (d.sites || []).find(s => s.uid === 'CIAN' && s.url);
  const since = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(st.in_ad_from || ''));
  return {
    entity: String(st.entity_id || ''),
    since: since ? new Date(Number(since[1]), Number(since[2]) - 1, Number(since[3])) : null,
    views: 'manual_total_views' in cfg ? num(cfg.manual_total_views) : num(st.views_total),
    fav: 'manual_total_favorites' in cfg ? num(cfg.manual_total_favorites) : sum(st.favorites),
    shows: 'manual_successful_showing_count' in cfg ? num(cfg.manual_successful_showing_count) : num(st.successful_showing_count),
    appeals: 'manual_appeals' in cfg ? num(cfg.manual_appeals) : num((d.realty || {}).appeal),
    appealsOn: cfg.isAppealsVisible !== false,
    sites: sites,
    cian: st.cian_url || (cianSite ? cianSite.url : ''),
    spend: num(st.price_total),
  };
}

/** Строки раздела для клиента + строка для руководителя. Снимок цифр недели сохраняется для расчёта «за неделю». */
function adReportPart_(obj, wk) {
  if (!obj || !obj.crm_report_link) return null;
  const a = fetchAdReport_(obj.crm_report_link);
  if (!a) return null;
  if (a.entity && isCrmId_(obj.id) && a.entity !== String(obj.id)) {
    throw new Error('ссылка на отчёт по рекламе от другого объекта CRM (' + a.entity + '), а у объекта ID ' + obj.id);
  }
  const props = PropertiesService.getDocumentProperties();
  const key = 'AD_SNAP_' + obj.id;
  let snaps = {};
  try { snaps = JSON.parse(props.getProperty(key) || '{}'); } catch (e) { snaps = {}; }
  const prevWk = Object.keys(snaps).filter(k => k < wk).sort().pop();
  const prev = prevWk ? snaps[prevWk] : null;
  snaps[wk] = { v: a.views, f: a.fav, s: a.shows, a: a.appeals };
  Object.keys(snaps).sort().slice(0, -26).forEach(k => delete snaps[k]);
  props.setProperty(key, JSON.stringify(snaps));
  const fmt = n => Number(n).toLocaleString('ru-RU');
  const plus = (cur, k) => prev && k in prev ? ', из них за эту неделю — ' + fmt(Math.max(0, cur - (prev[k] || 0))) : '';
  const main = a.sites.filter(s => AD_MAIN_SITES.indexOf(s) >= 0), partners = a.sites.filter(s => AD_MAIN_SITES.indexOf(s) < 0);
  const client = [
    a.sites.length ? 'Ваш объект в рекламе' + (a.since ? ' с ' + fmtDate_(a.since) : '') + ', объявление размещено на ' + a.sites.length + ' ' + plural_(a.sites.length, 'площадке', 'площадках', 'площадках') + '.' : '',
    main.length ? '• Основные площадки: ' + main.join(', ') + '.' : '',
    partners.length ? '• Партнёрские площадки: ' + partners.join(', ') + '.' : '',
    '• Объявление посмотрели: ' + fmt(a.views) + ' ' + plural_(a.views, 'раз', 'раза', 'раз') + plus(a.views, 'v') + '.',
    '• Добавили в избранное: ' + fmt(a.fav) + ' ' + plural_(a.fav, 'человек', 'человека', 'человек') + plus(a.fav, 'f') + '.',
    a.appealsOn ? '• Обращений по объекту: ' + fmt(a.appeals) + plus(a.appeals, 'a') + '.' : '',
    a.cian ? 'На всех площадках размещено объявление в одинаковом формате. Посмотреть, как оно выглядит (ЦИАН): ' + a.cian : '',
  ].filter(Boolean);
  return { lines: client, inner: 'Реклама: просмотры ' + fmt(a.views) + ', избранное ' + fmt(a.fav) + ', обращения ' + fmt(a.appeals) + ', показы ' + fmt(a.shows) + (a.spend ? ', расходы на площадки ' + fmt(a.spend) + ' ₽' : '') };
}

/** Раздел «Реклама на площадках» в значения отчёта (ошибка — раздел просто не выводится). */
function addAdStats_(values, obj, wk) {
  values.kv.AD_STATS = '';
  try {
    const p = adReportPart_(obj, wk);
    if (p) { values.kv.AD_STATS = p.lines.join('\n'); values.adInner = p.inner; }
  } catch (e) {
    values.adInner = '⚠ ' + e.message;
    Logger.log('Реклама ' + (obj && obj.id) + ': ' + e.message);
  }
  return values;
}

/** Меню: проверить ссылки на отчёты по рекламе у всех объектов. */
function checkAdReports() {
  const out = [];
  readTable_('OBJ').rows.filter(o => o.id && o.name && !isServiceObject_(o)).forEach(o => {
    if (!o.crm_report_link) { out.push('— ' + o.name + ': ссылки нет'); return; }
    try {
      const a = fetchAdReport_(o.crm_report_link);
      if (a.entity && isCrmId_(o.id) && a.entity !== String(o.id)) out.push('⚠ ' + o.name + ': ссылка от другого объекта CRM (' + a.entity + ')');
      else out.push('✓ ' + o.name + ': площадок ' + a.sites.length + ', просмотры ' + a.views + ', избранное ' + a.fav + ', обращения ' + a.appeals + ', показы ' + a.shows + (a.cian ? ', ЦИАН есть' : ', ЦИАН нет'));
    } catch (e) { out.push('⚠ ' + o.name + ': ' + e.message); }
  });
  SpreadsheetApp.getUi().alert('Отчёты по рекламе CRM', out.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Меню: вставить сразу несколько ссылок на отчёты по рекламе — объект система определит сама (по ID из CRM внутри отчёта). */
function pasteAdReportLinks() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Ссылки на отчёты по рекламе CRM',
    'Вставьте одну или несколько ссылок вида crm.topnlab.ru/lk/report/… (через пробел или с новой строки).\nК какому объекту относится каждая ссылка, система определит сама.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const res = saveAdReportLinks_(r.getResponseText());
  try { const c = closeAdLinkTasks_(); if (c) res.push('Закрыто задач «вставить ссылку»: ' + c); } catch (e) { /* закроются утром */ }
  ui.alert('Ссылки на отчёты по рекламе', res.length ? res.join('\n') : 'Ссылок вида crm.topnlab.ru/lk/report/… не найдено.', ui.ButtonSet.OK);
}

function saveAdReportLinks_(text) {
  const links = (String(text || '').match(/https?:\/\/crm\.topnlab\.ru\/lk\/report\/[A-Za-z0-9=_%-]+/g) || []).filter((x, i, a) => a.indexOf(x) === i);
  const t = readTable_('OBJ');
  const out = [];
  links.forEach(url => {
    try {
      const a = fetchAdReport_(url);
      const o = a && t.rows.find(x => String(x.id) === a.entity);
      if (!o) { out.push('⚠ …' + url.slice(-10) + ': объект CRM ' + (a ? a.entity : '?') + ' не найден в ' + SHEET_NAMES.OBJ); return; }
      writeFields_(t.sh, 'OBJ', o._row, { crm_report_link: url });
      o.crm_report_link = url;
      out.push('✓ ' + o.name + ': площадок ' + a.sites.length + ', просмотры ' + a.views);
    } catch (e) { out.push('⚠ …' + url.slice(-10) + ': ' + e.message); }
  });
  return out;
}

const AD_LINK_TASK_MARK = 'отчёт по рекламе CRM';
const AD_LINK_TASK_TEXT = 'Вставить ссылку на отчёт по рекламе CRM: TopenLab → карточка объекта → «Отчёт по рекламе» → «Скопировать ссылку» → в таблице меню «➜ Вставить ссылки на отчёты по рекламе CRM»';

/** Ассистенту — задача по объектам в работе без ссылки на отчёт по рекламе (одна задача на объект). */
function ensureAdLinkTasks_() {
  closeAdLinkTasks_();
  const tasks = readTable_('TASK').rows;
  const has = id => tasks.some(x => String(x.obj_id) === String(id) && String(x.task).indexOf(AD_LINK_TASK_MARK) >= 0);
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.name && !isServiceObject_(o) && o.in_work !== 'НЕТ' && isCrmId_(o.id) && !o.crm_report_link && !has(o.id));
  if (!objs.length) return 0;
  const owner = teamDefaults_().assistant || '';
  const source = dictValues_('task_sources').indexOf('Система') >= 0 ? 'Система' : 'Вручную';
  const deadline = workdayAfter_(today_(), 1);
  const cache = {};
  appendRows_('TASK', objs.map(o => ({
    id: nextId_('TASK', cache), week: isoWeekKey_(deadline), obj_id: String(o.id), block: 'Отчётность', task: AD_LINK_TASK_TEXT,
    owner: owner, unit: '', plan: '', deadline: deadline, status: dictFirstByClass_('task_status', CLS.OPEN),
    to_report: false, source: source, created_at: new Date(), author: 'система',
  })));
  return objs.length;
}

/** Ссылка на отчёт по рекламе уже вставлена — открытая задача «вставить ссылку» закрывается сама. */
function closeAdLinkTasks_() {
  const withLink = {};
  readTable_('OBJ').rows.forEach(o => { if (o.id && o.crm_report_link) withLink[String(o.id)] = true; });
  const t = readTable_('TASK');
  const done = dictFirstByClass_('task_status', CLS.DONE);
  let n = 0;
  t.rows.forEach(r => {
    if (!withLink[String(r.obj_id)] || String(r.task).indexOf(AD_LINK_TASK_MARK) < 0) return;
    if (r.status && dictClassOf_('task_status', r.status) !== CLS.OPEN) return;
    writeFields_(t.sh, 'TASK', r._row, { status: done, result: 'Ссылка вставлена в 01_ОБЪЕКТЫ' });
    n++;
  });
  return n;
}

// ═════════════ 29_WebApp.gs ═════════════
/**
 * 29_WebApp — личные кабинеты: веб-приложение (сайт) поверх таблицы.
 * Таблица остаётся базой данных; сотрудники работают в кабинете, а не в листах.
 *
 * Кто есть кто — по Google-аккаунту и 07_СПРАВОЧНИКИ «Сотрудник / Роль / Email»:
 *   Директор (роль «Руководитель» / «Директор» или владелец таблицы) — видит и меняет всё;
 *   Ассистент — объекты директора (Ответственный пустой или директор) и объекты, где он указан ассистентом;
 *   Агент — объекты, где он «Ответственный»;
 *   SMM — все объекты (маркетинг компании): контент меняет, задачи — только свои, базу обзвона не видит.
 * Правки из кабинета проходят через ту же автоматику, что и правки в таблице (ID, история, перенос задач, даты).
 */

const WEB_ROLE_TITLES = { director: 'Директор', assistant: 'Ассистент', agent: 'Агент', smm: 'SMM' };

function doGet() {
  return HtmlService.createHtmlOutput(WEB_HTML)
    .setTitle('Кабинет — ' + SYS.TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function webRoleOf_(text) {
  const t = String(text || '').toLowerCase();
  if (/руковод|директор/.test(t)) return 'director';
  if (/ассист/.test(t)) return 'assistant';
  if (/smm|смм|маркет/.test(t)) return 'smm';
  if (/агент|брокер|риэлт|риелт/.test(t)) return 'agent';
  return '';
}

/** Текущий сотрудник: {email, name, role, roleTitle, directors}. Нет в справочнике — ошибка «нет доступа». */
function webUser_() {
  const email = String(userEmail_() || '').trim().toLowerCase();
  if (!email) throw new Error('Не удалось определить ваш Google-аккаунт. Войдите в Google и откройте ссылку снова.');
  const people = dictRows_('people');
  const directors = people.filter(r => webRoleOf_(r[1]) === 'director').map(r => String(r[0]));
  let owner = '';
  try { owner = String(ss_().getOwner().getEmail() || '').toLowerCase(); } catch (e) { /* общий диск */ }
  const row = people.find(r => String(r[2] || '').trim().toLowerCase() === email);
  if (!row && email !== owner) {
    throw new Error('Нет доступа для ' + email + '. Руководитель добавляет сотрудника в 07_СПРАВОЧНИКИ: имя, роль (Директор / Ассистент / Агент / SMM) и этот email.');
  }
  const role = email === owner ? 'director' : webRoleOf_(row[1]);
  if (!role) throw new Error('У сотрудника ' + row[0] + ' в 07_СПРАВОЧНИКИ не указана роль: Директор, Ассистент, Агент или SMM.');
  const name = row ? String(row[0]) : (directors[0] || 'Директор');
  return { email: email, name: name, role: role, roleTitle: WEB_ROLE_TITLES[role], directors: directors };
}

function webCanSee_(u, o) {
  if (!o) return false;
  if (u.role === 'director' || u.role === 'smm') return true;
  if (isServiceObject_(o)) return false;
  const mgr = String(o.manager || '');
  if (u.role === 'agent') return mgr === u.name;
  if (u.role === 'assistant') return !mgr || u.directors.indexOf(mgr) >= 0 || String(o.assistant || '') === u.name;
  return false;
}

/** Может ли менять записи листа code по объекту o. SMM — только контент. */
function webCanEdit_(u, o, code) {
  if (!webCanSee_(u, o)) return false;
  if (u.role === 'smm') return code === 'CONT';
  return true;
}

function webVal_(v) {
  if (v instanceof Date) return fmtDate_(v, 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : v;
}

function webRow_(o, keys) {
  const r = {};
  keys.forEach(k => { r[k] = webVal_(o[k]); });
  return r;
}

const WEB_OBJ_KEYS = ['id', 'name', 'kind', 'deal', 'address', 'area', 'price', 'status', 'manager', 'assistant', 'smm', 'strategy_pct',
  'folder_link', 'crm_link', 'last_report_link', 'last_report_date', 'tab_url', 'in_work', 'idle_aud'];
const WEB_TASK_KEYS = ['id', 'week', 'obj_id', 'block', 'task', 'owner', 'unit', 'plan', 'fact', 'fact_auto', 'deadline', 'status', 'result', 'source'];
const WEB_BASE_KEYS = ['id', 'obj_id', 'audience', 'company', 'site', 'contact', 'fit', 'fit_note', 'call_date', 'call_result', 'kp_date', 'kp_type',
  'response', 'response_date', 'next_step', 'next_date', 'to_crm', 'owner'];
const WEB_CONT_KEYS = ['id', 'obj_id', 'topic', 'platform', 'format', 'goal', 'script', 'status', 'pub_date', 'link', 'views', 'reach', 'saves', 'leads', 'owner',
  'rubric', 'likes', 'comments', 'shares', 'followers_gained'];

/** Что можно менять из кабинета и что можно указывать при создании записи. */
const WEB_EDITABLE = {
  TASK: ['status', 'result', 'fact', 'deadline', 'owner', 'task', 'plan'],
  BASE: ['call_date', 'call_result', 'kp_date', 'kp_type', 'response', 'next_step', 'next_date', 'fit', 'fit_note', 'contact', 'site', 'audience', 'company', 'to_crm'],
  CONT: ['topic', 'platform', 'format', 'goal', 'script', 'status', 'pub_date', 'link', 'views', 'reach', 'saves', 'leads', 'owner', 'rubric', 'likes', 'comments', 'shares', 'followers_gained'],
};
const WEB_CREATE = {
  TASK: ['obj_id', 'block', 'task', 'owner', 'unit', 'plan', 'deadline'],
  BASE: ['obj_id', 'audience', 'company', 'site', 'contact', 'fit_note', 'next_step', 'next_date'],
  CONT: ['obj_id', 'topic', 'platform', 'format', 'goal', 'script', 'pub_date', 'owner', 'rubric', 'status'],
};

function webObjects_(u) {
  return readTable_('OBJ').rows.filter(o => o.id && o.name && webCanSee_(u, o));
}

function webClassOf_(dict, v) {
  try { return v ? dictClassOf_(dict, v) : CLS.OPEN; } catch (e) { return ''; }
}

/** Стартовые данные кабинета. */
function webBootstrap() {
  const u = webUser_();
  const objs = webObjects_(u).map(o => {
    const r = webRow_(o, WEB_OBJ_KEYS);
    r.service = isServiceObject_(o);
    r.has_ad = !!o.crm_report_link;
    if (u.role !== 'director') { delete r.crm_link; }
    return r;
  });
  const dict = k => { try { return dictValues_(k); } catch (e) { return []; } };
  const statusRows = k => { try { return dictRows_(k).map(r => [r[0], r[1]]); } catch (e) { return []; } };
  const wk = isoWeekKey_(today_());
  return {
    me: { name: u.name, role: u.role, roleTitle: u.roleTitle, email: u.email },
    today: fmtDate_(today_(), 'yyyy-MM-dd'), week: wk,
    objects: objs,
    dicts: {
      people: dict('people'), task_blocks: dict('task_blocks'), units: dict('units'), task_status: statusRows('task_status'),
      responses: dict('responses'), kp_types: dict('kp_types'), fit: dict('fit'),
      platforms: dict('platforms'), content_rubrics: dict('content_rubrics'), content_formats: dict('content_formats'), content_goals: dict('content_goals'), content_status: statusRows('content_status'),
    },
    sheetUrl: u.role === 'director' ? ss_().getUrl() : '',
  };
}

/** Задачи: по видимым объектам + свои по любому объекту. Открытые любой недели и все за эту и прошлую неделю. */
function webTasks() {
  const u = webUser_();
  const vis = {};
  webObjects_(u).forEach(o => { vis[String(o.id)] = o; });
  const wk = isoWeekKey_(today_()), prev = isoWeekKey_(addDays_(today_(), -7));
  return readTable_('TASK').rows.filter(t => t.id && t.task).filter(t => {
    const mine = String(t.owner) === u.name;
    const see = u.role === 'smm' ? mine : (mine || !!vis[String(t.obj_id)]);
    if (!see) return false;
    const cls = webClassOf_('task_status', t.status);
    return cls === CLS.OPEN || t.week === wk || t.week === prev;
  }).map(t => {
    const r = webRow_(t, WEB_TASK_KEYS);
    r.cls = webClassOf_('task_status', t.status);
    r.mine = String(t.owner) === u.name;
    r.can = u.role === 'director' || r.mine || webCanEdit_(u, vis[String(t.obj_id)], 'TASK');
    return r;
  });
}

/** База обзвона по видимым объектам (SMM — нет доступа). */
function webBase(objId) {
  const u = webUser_();
  if (u.role === 'smm') return [];
  const vis = {};
  webObjects_(u).forEach(o => { vis[String(o.id)] = o; });
  return readTable_('BASE').rows.filter(r => r.id && r.company && vis[String(r.obj_id)] && (!objId || String(r.obj_id) === String(objId)))
    .map(r => { const x = webRow_(r, WEB_BASE_KEYS); x.resp_cls = webClassOf_('responses', r.response); return x; });
}

/** Контент по видимым объектам. */
function webContent(objId) {
  const u = webUser_();
  const vis = {};
  webObjects_(u).forEach(o => { vis[String(o.id)] = o; });
  return readTable_('CONT').rows.filter(r => r.id && vis[String(r.obj_id)] && (!objId || String(r.obj_id) === String(objId)))
    .map(r => { const x = webRow_(r, WEB_CONT_KEYS); x.cls = webClassOf_('content_status', r.status); return x; });
}

/** Карточка объекта: стратегия из вкладки и отчёты. */
function webObject(objId) {
  const u = webUser_();
  const o = objectById_(objId);
  if (!webCanSee_(u, o)) throw new Error('Нет доступа к объекту');
  const out = { strategy: { kv: {}, aud: [], dec: [], chan: [], scen: [], kp: [] }, reports: [] };
  try {
    const tab = findObjectTab_(o);
    if (tab) {
      const d = readObjectTab_(tab);
      const kv = d.kv || {};
      ['rec_price', 'min_price', 'positioning', 'price_note', 'analysis_link', 'median', 'our_m2'].forEach(k => { out.strategy.kv[k] = webVal_(kv[k]); });
      const t = (k, n) => (d.tables[k] || []).map(r => r.slice(0, n).map(webVal_));
      out.strategy.aud = t('AUD', 5); out.strategy.dec = t('DEC', 4); out.strategy.chan = t('CHAN', 5); out.strategy.scen = t('SCEN', 6); out.strategy.kp = t('KP', 6);
    }
  } catch (e) { out.strategyError = e.message; }
  out.reports = readTable_('ARCH').rows.filter(r => String(r.obj_id) === String(objId) && r.status !== REPORT_STATUS.REPLACED)
    .map(r => ({ no: webVal_(r.report_no), week: r.week, period: r.period, link: r.doc_link || r.pdf_link, status: r.status })).reverse().slice(0, 12);
  return out;
}

/** Реклама по объекту (из отчёта CRM). Расходы — только директору. */
function webAd(objId) {
  const u = webUser_();
  const o = objectById_(objId);
  if (!webCanSee_(u, o) || !o.crm_report_link) return null;
  const a = fetchAdReport_(o.crm_report_link);
  if (!a) return null;
  return { since: a.since ? fmtDate_(a.since, 'yyyy-MM-dd') : '', sites: a.sites, views: a.views, fav: a.fav, appeals: a.appeals, shows: a.shows,
    cian: a.cian, spend: u.role === 'director' ? a.spend : null };
}

/** Директор: команда и объекты за неделю. */
function webTeam() {
  const u = webUser_();
  if (u.role !== 'director') throw new Error('Раздел доступен только директору');
  const wk = isoWeekKey_(today_()), today = today_();
  const tasks = readTable_('TASK').rows.filter(t => t.id && t.task);
  const cls = t => webClassOf_('task_status', t.status);
  const people = dictRows_('people').map(r => ({ name: String(r[0]), role: String(r[1] || '') }));
  const team = people.map(p => {
    const my = tasks.filter(t => String(t.owner) === p.name);
    return {
      name: p.name, role: p.role,
      open: my.filter(t => cls(t) === CLS.OPEN).length,
      overdue: my.filter(t => cls(t) === CLS.OPEN && t.deadline instanceof Date && t.deadline < today).length,
      doneWeek: my.filter(t => t.week === wk && cls(t) === CLS.DONE).length,
      week: my.filter(t => t.week === wk && cls(t) !== CLS.CANCEL).length,
    };
  });
  const base = readTable_('BASE').rows;
  const inWk = d => d instanceof Date && isoWeekKey_(d) === wk;
  const objs = webObjects_(u).filter(o => !isServiceObject_(o)).map(o => {
    const id = String(o.id);
    const wt = tasks.filter(t => String(t.obj_id) === id && t.week === wk && cls(t) !== CLS.CANCEL);
    const b = base.filter(r => String(r.obj_id) === id && r.company);
    return {
      id: id, name: o.name, manager: o.manager || '',
      tasksWeek: wt.length, doneWeek: wt.filter(t => cls(t) === CLS.DONE).length,
      callsWeek: b.filter(r => inWk(r.call_date)).length, kpWeek: b.filter(r => inWk(r.kp_date)).length,
      baseTotal: b.length, interested: b.filter(r => webClassOf_('responses', r.response) === 'YES').length,
      lastReport: webVal_(o.last_report_date), strategy: webVal_(o.strategy_pct),
    };
  });
  return { team: team, objects: objs, week: wk };
}

function webParse_(code, key, v) {
  const f = fieldOf_(code, key);
  if (v === null || v === undefined) return '';
  if (f.kind === 'date') {
    if (!v) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : (parseRuDate_(String(v)) || '');
  }
  if (f.kind === 'num' || f.kind === 'money') { const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return v === '' || isNaN(n) ? '' : n; }
  if (f.kind === 'cb') return v === true || v === 'true';
  return String(v).trim();
}

/** Правка записи (TASK / BASE / CONT) из кабинета. Каждое поле — как правка одной ячейки в таблице. */
function webUpdate(code, id, changes) {
  const u = webUser_();
  if (!WEB_EDITABLE[code]) throw new Error('Нельзя менять ' + code);
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const t = readTable_(code);
    const r = t.rows.find(x => String(x.id) === String(id));
    if (!r) throw new Error('Запись ' + id + ' не найдена — обновите страницу');
    const o = objectById_(r.obj_id);
    const ownTask = code === 'TASK' && String(r.owner) === u.name;
    if (!(u.role === 'director' || ownTask || webCanEdit_(u, o, code))) throw new Error('Нет прав менять эту запись');
    Object.keys(changes || {}).forEach(k => {
      if (WEB_EDITABLE[code].indexOf(k) < 0) return;
      if (code === 'TASK' && k === 'owner' && u.role !== 'director') return;
      const nv = webParse_(code, k, changes[k]);
      const old = r[k];
      if (sameValue_(old, nv)) return;
      const col = fieldIndex_(code, k);
      writeFields_(t.sh, code, r._row, { [k]: nv });
      r[k] = nv;
      processEditedRows_(t.sh, t.spec, r._row, r._row, col, col, { oldValue: old instanceof Date ? fmtDate_(old) : old });
    });
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Новая запись из кабинета. */
function webCreate(code, data) {
  const u = webUser_();
  if (!WEB_CREATE[code]) throw new Error('Нельзя создавать ' + code);
  const o = objectById_(data && data.obj_id);
  if (!(webCanEdit_(u, o, code) || (u.role === 'director' && o))) throw new Error('Нет прав на этот объект');
  const rec = {};
  WEB_CREATE[code].forEach(k => { if (data[k] !== undefined && data[k] !== '') rec[k] = webParse_(code, k, data[k]); });
  rec.obj_id = String(o.id);
  if (code === 'TASK' && !rec.task) throw new Error('Напишите задачу');
  if (code === 'BASE' && !rec.company) throw new Error('Укажите компанию');
  if (code === 'CONT' && !rec.topic) throw new Error('Укажите тему');
  if (!rec.owner && (code !== 'TASK' || u.role !== 'director')) rec.owner = u.name;
  if (code === 'TASK' && rec.deadline instanceof Date) rec.week = isoWeekKey_(rec.deadline);
  if (code === 'TASK') rec.source = 'Вручную';
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const t = readTable_(code);
    const row = appendRow_(code, rec);
    processEditedRows_(t.sh, t.spec, row, row, 1, t.spec.fields.length, {});
    const id = t.sh.getRange(row, fieldIndex_(code, 'id')).getValue();
    if (code === 'BASE') { try { refreshBaseAudienceLists_([rec.obj_id]); } catch (e) { /* утром */ } }
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/** Меню: ссылка на личные кабинеты (или как их включить). */
function webAppLink() {
  const ui = SpreadsheetApp.getUi();
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { /* не развёрнуто */ }
  if (url) {
    showLinks_('Личные кабинеты', [{ label: 'Открыть кабинет', url: url }],
      'Эту ссылку отправьте сотрудникам. Каждый входит своим Google-аккаунтом и видит свой кабинет. ' +
      'Сотрудник должен быть в 07_СПРАВОЧНИКИ (имя, роль, email) и иметь доступ к таблице.');
    return;
  }
  ui.alert('Личные кабинеты ещё не опубликованы',
    'Один раз (делает руководитель):\n' +
    '1) Расширения → Apps Script → кнопка «Начать развертывание» → «Новое развертывание».\n' +
    '2) Тип (шестерёнка) — «Веб-приложение».\n' +
    '3) «Запуск от имени» — «Пользователь, у которого есть доступ к веб-приложению».\n' +
    '4) «У кого есть доступ» — «Все, у кого есть аккаунт Google».\n' +
    '5) «Развернуть» → скопируйте ссылку «Веб-приложение» — это адрес кабинетов.\n\n' +
    'После каждого обновления кода: «Начать развертывание» → «Управление развертываниями» → карандаш → «Версия: новая версия» → «Развернуть». Ссылка не меняется.',
    ui.ButtonSet.OK);
}

// ═════════════ 30_WebUi.gs ═════════════
/**
 * 30_WebUi — страница личного кабинета (HTML + CSS + JS одним текстом, чтобы код оставался одним файлом Code.gs).
 * Внутри нельзя использовать обратные кавычки и «доллар+фигурная скобка» — это строка String.raw.
 */
const WEB_HTML = String.raw`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><base target="_top">
<style>
:root{--bg:#f4f6f9;--card:#fff;--ink:#1f2933;--mut:#6b7785;--line:#e3e8ef;--acc:#1f5f99;--acc2:#e8f1fa;--red:#c0392b;--redbg:#fdecea;--grn:#1e7d4f;--grnbg:#e6f4ec;--amb:#9a6b00;--ambbg:#fff4d6}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink)}
header{background:#14324f;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;position:sticky;top:0;z-index:5}
header .t{font-weight:600;font-size:15px}header .me{margin-left:auto;font-size:13px;opacity:.9}
nav{display:flex;gap:4px;padding:8px 12px;background:#fff;border-bottom:1px solid var(--line);overflow-x:auto;position:sticky;top:44px;z-index:4}
nav button{border:0;background:none;padding:8px 12px;border-radius:8px;font:inherit;color:var(--mut);cursor:pointer;white-space:nowrap}
nav button.on{background:var(--acc2);color:var(--acc);font-weight:600}
main{max-width:1100px;margin:0 auto;padding:14px 12px 60px}
h2{font-size:17px;margin:18px 0 8px}h3{font-size:15px;margin:14px 0 6px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.obj{cursor:pointer}.obj:hover{border-color:var(--acc)}.obj .n{font-weight:600;margin-bottom:2px}
.mut{color:var(--mut);font-size:12.5px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.item{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--line);cursor:pointer}.item:first-child{border-top:0}
.item .main{flex:1;min-width:0}.item .ttl{font-weight:500}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;background:#eef1f5;color:var(--mut);white-space:nowrap}
.pill.red{background:var(--redbg);color:var(--red)}.pill.grn{background:var(--grnbg);color:var(--grn)}.pill.amb{background:var(--ambbg);color:var(--amb)}.pill.acc{background:var(--acc2);color:var(--acc)}
button.b{border:1px solid var(--acc);background:var(--acc);color:#fff;border-radius:8px;padding:7px 12px;font:inherit;cursor:pointer}
button.b2{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:8px;padding:7px 12px;font:inherit;cursor:pointer}
a.lnk{color:var(--acc);text-decoration:none}a.lnk:hover{text-decoration:underline}
input,select,textarea{font:inherit;padding:7px 9px;border:1px solid var(--line);border-radius:8px;width:100%;background:#fff}
textarea{min-height:64px}label.f{display:block;margin:8px 0 3px;font-size:12.5px;color:var(--mut)}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.kpi .v{font-size:22px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:7px 6px;border-top:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--mut);font-weight:500;border-top:0}
.tabs{display:flex;gap:4px;margin:10px 0;flex-wrap:wrap}.tabs button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:6px 10px;font:inherit;cursor:pointer}.tabs button.on{border-color:var(--acc);color:var(--acc);font-weight:600}
#modal{position:fixed;inset:0;background:rgba(15,25,40,.45);display:none;align-items:flex-start;justify-content:center;padding:30px 10px;z-index:20;overflow:auto}
#modal .box{background:#fff;border-radius:14px;max-width:560px;width:100%;padding:16px 18px}
#toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#1f2933;color:#fff;padding:9px 14px;border-radius:10px;display:none;z-index:30;max-width:90%}
#load{position:fixed;top:0;left:0;height:3px;width:100%;background:linear-gradient(90deg,var(--acc),#7fb3e6);display:none;z-index:40}
.empty{color:var(--mut);padding:8px 0}.chk{width:auto}
</style></head><body>
<div id="load"></div>
<header><div class="t">Маркетинг эксклюзивов</div><div class="me" id="me">Загрузка…</div></header>
<nav id="nav"></nav>
<main id="main"><div class="empty">Загружаю кабинет…</div></main>
<div id="modal"><div class="box" id="mbox"></div></div>
<div id="toast"></div>
<script>
var B=null, S={ct:'plan',cf:{platform:'',rubric:'',obj:'',status:''},pf:'',pt:'',af:'',at:'',an:null,soc:null,view:'today',tasks:null,base:null,cont:null,obj:null,objTab:'tasks',taskScope:'mine',baseObj:'',baseToday:false,q:''};
function h(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function el(id){return document.getElementById(id);}
function load(on){el('load').style.display=on?'block':'none';}
function toast(t){var x=el('toast');x.textContent=t;x.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(function(){x.style.display='none';},3500);}
function api(fn,args,cb){load(true);var r=google.script.run.withSuccessHandler(function(v){load(false);cb&&cb(v);}).withFailureHandler(function(e){load(false);toast('Ошибка: '+(e&&e.message||e));});r[fn].apply(r,args||[]);}
function d(s){if(!s)return '';var p=String(s).split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0].slice(2):s;}
function iso(dt){var z=function(n){return (n<10?'0':'')+n;};return dt.getFullYear()+'-'+z(dt.getMonth()+1)+'-'+z(dt.getDate());}
function addD(s,n){var p=s.split('-');var dt=new Date(+p[0],+p[1]-1,+p[2]);dt.setDate(dt.getDate()+n);return iso(dt);}
function num(v){return v===''||v==null?'':Number(v).toLocaleString('ru-RU');}
function money(v){return v===''||v==null?'':Number(v).toLocaleString('ru-RU')+' ₽';}
function obj(id){for(var i=0;i<B.objects.length;i++)if(String(B.objects[i].id)===String(id))return B.objects[i];return null;}
function oname(id){var o=obj(id);return o?(o.service?'Общий контент агентства':o.name):id;}
function can(code){return B.me.role!=='smm'||code==='CONT';}
function role(r){return B.me.role===r;}
function opts(list,val,empty){var s=empty?'<option value="">'+h(empty)+'</option>':'';(list||[]).forEach(function(v){v=Array.isArray(v)?v[0]:v;s+='<option'+(String(v)===String(val)?' selected':'')+'>'+h(v)+'</option>';});return s;}
function objOpts(val,filterCode){var s='';B.objects.forEach(function(o){if(filterCode&&!can(filterCode))return;s+='<option value="'+h(o.id)+'"'+(String(o.id)===String(val)?' selected':'')+'>'+h(oname(o.id))+'</option>';});return s;}
function clsOf(dict,v){var r=(B.dicts[dict]||[]).filter(function(x){return x[0]===v;})[0];return r?r[1]:(v?'':'OPEN');}

/* ───────── навигация ───────── */
function views(){var v=[['today','Сегодня'],['objects','Объекты'],['tasks','Задачи']];if(!role('smm'))v.push(['base','База']);v.push(['content','Контент']);if(role('director'))v.push(['team','Команда']);return v;}
function nav(){var s='';views().forEach(function(v){s+='<button class="'+(S.view===v[0]?'on':'')+'" onclick="go(\''+v[0]+'\')">'+v[1]+'</button>';});if(B.sheetUrl)s+='<button onclick="window.open(\''+B.sheetUrl+'\')">Таблица ↗</button>';el('nav').innerHTML=s;}
function go(v){S.view=v;S.obj=null;nav();render();window.scrollTo(0,0);}
function render(){
  if(S.obj)return renderObj();
  if(S.view==='today')return renderToday();
  if(S.view==='objects')return renderObjects();
  if(S.view==='tasks')return need('tasks',renderTasks);
  if(S.view==='base')return need('base',renderBase);
  if(S.view==='content')return need('cont',renderContent);
  if(S.view==='team')return api('webTeam',[],renderTeam);
}
function need(k,fn){if(S[k])return fn();var m={tasks:'webTasks',base:'webBase',cont:'webContent'}[k];api(m,k==='tasks'?[]:[''],function(v){S[k]=v;fn();});}
function reload(keys,cb){var left=keys.length;if(!left)return cb&&cb();keys.forEach(function(k){var m={tasks:'webTasks',base:'webBase',cont:'webContent'}[k];api(m,k==='tasks'?[]:[''],function(v){S[k]=v;if(--left===0)cb&&cb();});});}

/* ───────── Сегодня ───────── */
function renderToday(){
  var need2=['tasks'];if(!role('smm'))need2.push('base');if(role('smm')||role('director'))need2.push('cont');
  var miss=need2.filter(function(k){return !S[k];});
  if(miss.length)return reload(miss,renderToday);
  var t=B.today, my=S.tasks.filter(function(x){return x.mine&&x.cls==='OPEN';});
  var over=my.filter(function(x){return x.deadline&&x.deadline<t;}), td=my.filter(function(x){return x.deadline===t;}), wk=my.filter(function(x){return !x.deadline||x.deadline>t;});
  var h2='<h2>Добрый день, '+h(B.me.name)+'</h2><div class="mut">'+h(B.me.roleTitle)+' · сегодня '+d(t)+'</div>';
  var k='<div class="kpis" style="margin-top:12px">'+kpi('Просрочено',over.length,over.length?'red':'')+kpi('На сегодня',td.length)+kpi('Остальные мои',wk.length);
  var calls=[];
  if(S.base){calls=S.base.filter(function(r){return r.next_date&&r.next_date<=t;});k+=kpi('Звонки / контакты',calls.length,calls.length?'amb':'');}
  k+='</div>';
  var s=h2+k;
  s+=block('Просроченные задачи',over.map(taskItem).join(''),'Нет — отлично');
  s+=block('Задачи на сегодня',td.map(taskItem).join(''),'Нет задач со сроком сегодня');
  s+=block('Мои задачи дальше',wk.slice(0,30).map(taskItem).join(''),'Нет');
  if(S.base)s+=block('Звонки и повторные контакты на сегодня',calls.sort(function(a,b){return a.next_date<b.next_date?-1:1;}).map(baseItem).join(''),'Сегодня звонков нет');
  if(S.cont){var c=S.cont.filter(function(x){return x.cls!=='DONE'&&(role('director')||x.owner===B.me.name);});s+=block('Контент в работе',c.map(contItem).join(''),'Нет');}
  el('main').innerHTML=s;
}
function kpi(l,v,c){return '<div class="card kpi"><div class="mut">'+l+'</div><div class="v" style="color:'+(c==='red'?'var(--red)':c==='amb'?'var(--amb)':'inherit')+'">'+v+'</div></div>';}
function block(title,inner,empty){return '<h3>'+title+'</h3><div class="card">'+(inner||'<div class="empty">'+empty+'</div>')+'</div>';}

/* ───────── элементы списков ───────── */
function taskPill(x){if(x.cls==='DONE')return '<span class="pill grn">'+h(x.status)+'</span>';if(x.cls==='CANCEL'||x.cls==='MOVED'||x.cls==='FAIL')return '<span class="pill">'+h(x.status)+'</span>';if(x.deadline&&x.deadline<B.today)return '<span class="pill red">просрочено '+d(x.deadline)+'</span>';return '<span class="pill acc">'+(x.deadline?'до '+d(x.deadline):h(x.status||'открыта'))+'</span>';}
function taskItem(x){var done=x.cls==='DONE';return '<div class="item" onclick="editTask(\''+h(x.id)+'\')"><input type="checkbox" class="chk" '+(done?'checked ':'')+(x.can&&x.cls==='OPEN'?'':'disabled ')+'onclick="event.stopPropagation();quickDone(\''+h(x.id)+'\',this)"><div class="main"><div class="ttl">'+h(x.task)+'</div><div class="mut">'+h(oname(x.obj_id))+(x.owner?' · '+h(x.owner):'')+(x.plan?' · план '+h(x.plan)+(x.fact!==''?' / факт '+h(x.fact):x.fact_auto!==''?' / факт '+h(x.fact_auto):''):'')+(x.result?' · '+h(x.result):'')+'</div></div>'+taskPill(x)+'</div>';}
function baseItem(r){var last=r.response?('ответ: '+r.response):r.kp_date?('КП '+d(r.kp_date)):r.call_date?('звонок '+d(r.call_date)):'новая';var nx=r.next_date?('<span class="pill '+(r.next_date<=B.today?'amb':'')+'">'+d(r.next_date)+'</span>'):'';return '<div class="item" onclick="editBase(\''+h(r.id)+'\')"><div class="main"><div class="ttl">'+h(r.company)+'</div><div class="mut">'+h(oname(r.obj_id))+(r.audience?' · '+h(r.audience):'')+' · '+h(last)+(r.next_step?' · дальше: '+h(r.next_step):'')+'</div>'+(r.contact?'<div class="mut">'+h(r.contact)+'</div>':'')+'</div>'+nx+'</div>';}
function contItem(x){var p=x.cls==='DONE'?'grn':'acc';return '<div class="item" onclick="editCont(\''+h(x.id)+'\')"><div class="main"><div class="ttl">'+h(x.topic)+'</div><div class="mut">'+(x.rubric?'<span class="pill acc">'+h(x.rubric)+'</span> ':'')+h(oname(x.obj_id))+' · '+h(x.platform)+' · '+h(x.format)+(x.owner?' · '+h(x.owner):'')+(x.views!==''?' · просмотры '+num(x.views):'')+(x.reach!==''?' · охват '+num(x.reach):'')+'</div></div><span class="pill '+p+'">'+h(x.status)+(x.pub_date?' '+d(x.pub_date):'')+'</span></div>';}

/* ───────── Объекты ───────── */
function renderObjects(){
  var q=S.q.toLowerCase();
  var list=B.objects.filter(function(o){return !q||(o.name+' '+o.address+' '+o.id).toLowerCase().indexOf(q)>=0;});
  var s='<div class="row"><h2 style="flex:1">Объекты ('+list.length+')</h2><input style="max-width:260px" placeholder="Поиск" value="'+h(S.q)+'" oninput="S.q=this.value;renderObjects();this.focus();this.setSelectionRange(this.value.length,this.value.length)"></div><div class="grid">';
  list.forEach(function(o){s+='<div class="card obj" onclick="openObj(\''+h(o.id)+'\')"><div class="n">'+h(o.name)+'</div><div class="mut">'+h([o.kind,o.deal].filter(Boolean).join(' · '))+(o.price?' · '+money(o.price):'')+'</div><div class="mut">'+h(o.address)+'</div><div class="row" style="margin-top:6px">'+(o.manager?'<span class="pill">'+h(o.manager)+'</span>':'')+(o.status?'<span class="pill '+(o.in_work==='НЕТ'?'':'acc')+'">'+h(o.status)+'</span>':'')+(o.idle_aud?'<span class="pill amb">нет базы ★★★</span>':'')+'</div></div>';});
  s+='</div>';if(!list.length)s+='<div class="empty">'+(role('agent')?'За вами пока нет объектов. Руководитель назначает вас «Ответственным» в 01_ОБЪЕКТЫ.':'Ничего не найдено')+'</div>';
  el('main').innerHTML=s;
}
function openObj(id){S.obj={id:id,data:null,ad:undefined};S.objTab='tasks';var miss=['tasks','cont'];if(!role('smm'))miss.push('base');reload(miss.filter(function(k){return !S[k];}),function(){api('webObject',[id],function(v){S.obj.data=v;renderObj();});});renderObj();}
function renderObj(){
  var o=obj(S.obj.id);if(!o){S.obj=null;return render();}
  var s='<button class="b2" onclick="S.obj=null;render()">← Назад</button><h2>'+h(o.name)+'</h2><div class="mut">'+h(o.address)+'</div>';
  s+='<div class="row" style="margin:8px 0">'+[o.kind,o.deal,o.area?o.area+' м²':'',o.price?money(o.price):''].filter(Boolean).map(function(x){return '<span class="pill">'+h(x)+'</span>';}).join('')+'</div>';
  s+='<div class="mut">Ответственный: '+h(o.manager||'—')+' · Ассистент: '+h(o.assistant||'—')+' · SMM: '+h(o.smm||'—')+'</div>';
  s+='<div class="row" style="margin:10px 0">'+(o.folder_link?'<a class="lnk" target="_blank" href="'+h(o.folder_link)+'">Папка объекта ↗</a>':'')+(o.last_report_link?' · <a class="lnk" target="_blank" href="'+h(o.last_report_link)+'">Последний отчёт ↗</a>':'')+(role('director')&&o.tab_url&&B.sheetUrl?' · <a class="lnk" target="_blank" href="'+h(B.sheetUrl+o.tab_url)+'">Вкладка в таблице ↗</a>':'')+(o.crm_link?' · <a class="lnk" target="_blank" href="'+h(o.crm_link)+'">CRM ↗</a>':'')+'</div>';
  var tabs=[['tasks','Задачи']];if(!role('smm'))tabs.push(['base','База']);tabs.push(['cont','Контент'],['strat','Стратегия'],['ad','Реклама'],['rep','Отчёты']);
  s+='<div class="tabs">'+tabs.map(function(t){return '<button class="'+(S.objTab===t[0]?'on':'')+'" onclick="S.objTab=\''+t[0]+'\';renderObj()">'+t[1]+'</button>';}).join('')+'</div>';
  var id=String(o.id), T=S.objTab;
  if(T==='tasks'){var ts=(S.tasks||[]).filter(function(x){return String(x.obj_id)===id;});s+=(can('TASK')?'<button class="b" onclick="newTask(\''+h(id)+'\')">+ Задача</button>':'')+'<div class="card" style="margin-top:8px">'+(ts.map(taskItem).join('')||'<div class="empty">Задач нет</div>')+'</div>';}
  if(T==='base'){var bs=(S.base||[]).filter(function(x){return String(x.obj_id)===id;});s+='<button class="b" onclick="newBase(\''+h(id)+'\')">+ Компания / контакт</button><div class="mut" style="margin-top:6px">Всего: '+bs.length+' · КП: '+bs.filter(function(r){return r.kp_date;}).length+' · интерес: '+bs.filter(function(r){return r.resp_cls==='YES';}).length+'</div><div class="card" style="margin-top:8px">'+(bs.map(baseItem).join('')||'<div class="empty">База пуста</div>')+'</div>';}
  if(T==='cont'){var cs=(S.cont||[]).filter(function(x){return String(x.obj_id)===id;});s+='<button class="b" onclick="newCont(\''+h(id)+'\')">+ Публикация</button><div class="card" style="margin-top:8px">'+(cs.map(contItem).join('')||'<div class="empty">Контента нет</div>')+'</div>';}
  if(T==='strat'){var D=S.obj.data;if(!D)s+='<div class="empty">Загружаю…</div>';else{var st=D.strategy,kv=st.kv;s+='<div class="card"><h3 style="margin-top:0">Цена и позиционирование</h3>'+line('Рекомендуемая цена',money(kv.rec_price))+line('Минимальная для торга',money(kv.min_price))+line('Медиана по аналогам, ₽/м²',money(kv.median))+line('Наша цена за м²',money(kv.our_m2))+line('Позиционирование',kv.positioning)+line('Вывод по цене',kv.price_note)+(kv.analysis_link?line('Анализ','<a class="lnk" target="_blank" href="'+h(kv.analysis_link)+'">открыть ↗</a>',1):'')+'</div>';
    s+=tbl('Целевые аудитории',['Аудитория','Кто','Портрет','Где искать','Приоритет'],st.aud)+tbl('Сценарии',['Сценарий','Чек-лист','Что проверить','Консультанты','Вывод','Статус'],st.scen)+tbl('КП и материалы',['Материал','Какое','Для кого','Ссылка','Готовность','Комментарий'],st.kp)+tbl('Каналы и партнёры',['Канал','Что делаем','Ответственный','Статус','Результат'],st.chan)+tbl('Выводы и решения',['Дата','Вывод / решение','Кто','Что дальше'],st.dec);}}
  if(T==='ad'){if(S.obj.ad===undefined){S.obj.ad=null;api('webAd',[id],function(v){S.obj.ad=v||false;renderObj();});s+='<div class="empty">Загружаю отчёт по рекламе…</div>';}else if(!S.obj.ad)s+='<div class="empty">'+(S.obj.ad===null?'Загружаю…':'Нет ссылки на отчёт по рекламе CRM (01_ОБЪЕКТЫ).')+'</div>';else{var a=S.obj.ad;s+='<div class="kpis">'+kpi('Просмотры',a.views)+kpi('В избранном',a.fav)+kpi('Обращения',a.appeals)+kpi('Показы',a.shows)+(a.spend!=null?kpi('Расходы, ₽',Number(a.spend).toLocaleString('ru-RU')):'')+'</div><div class="card"><div class="mut">В рекламе с '+d(a.since)+' · площадок: '+a.sites.length+'</div><div style="margin-top:6px">'+h(a.sites.join(', '))+'</div>'+(a.cian?'<div style="margin-top:8px"><a class="lnk" target="_blank" href="'+h(a.cian)+'">Объявление на ЦИАН ↗</a></div>':'')+'</div>';}}
  if(T==='rep'){var D2=S.obj.data;s+='<div class="card">'+(!D2?'<div class="empty">Загружаю…</div>':(D2.reports.map(function(r){return '<div class="item" onclick="window.open(\''+h(r.link)+'\')"><div class="main"><div class="ttl">Отчёт № '+h(r.no)+' · '+h(r.period||r.week)+'</div><div class="mut">'+h(r.status)+'</div></div><span class="pill acc">открыть ↗</span></div>';}).join('')||'<div class="empty">Отчётов пока нет</div>'))+'</div>';}
  el('main').innerHTML=s;
}
function line(l,v,raw){return v===''||v==null?'':'<div class="row" style="padding:4px 0;border-top:1px solid var(--line)"><div class="mut" style="width:190px">'+h(l)+'</div><div style="flex:1">'+(raw?v:h(v))+'</div></div>';}
function tbl(t,cols,rows){if(!rows||!rows.length)return '';var s='<div class="card"><h3 style="margin-top:0">'+h(t)+'</h3><div style="overflow-x:auto"><table><tr>'+cols.map(function(c){return '<th>'+h(c)+'</th>';}).join('')+'</tr>';rows.forEach(function(r){s+='<tr>'+cols.map(function(c,i){var v=r[i];v=/^\d{4}-\d\d-\d\d$/.test(v)?d(v):v;return '<td>'+(/^https?:\/\//.test(v)?'<a class="lnk" target="_blank" href="'+h(v)+'">ссылка ↗</a>':h(v))+'</td>';}).join('')+'</tr>';});return s+'</table></div></div>';}

/* ───────── Задачи ───────── */
function renderTasks(){
  var list=S.tasks.filter(function(x){return S.taskScope==='mine'?x.mine:true;});
  var open=list.filter(function(x){return x.cls==='OPEN';}), closed=list.filter(function(x){return x.cls!=='OPEN';});
  var s='<div class="row"><h2 style="flex:1">Задачи</h2>'+(role('smm')?'':'<select style="max-width:200px" onchange="S.taskScope=this.value;renderTasks()"><option value="mine"'+(S.taskScope==='mine'?' selected':'')+'>Мои</option><option value="all"'+(S.taskScope==='all'?' selected':'')+'>Все по моим объектам</option></select>')+(can('TASK')?'<button class="b" onclick="newTask(\'\')">+ Задача</button>':'')+'</div>';
  var groups={};open.forEach(function(x){(groups[x.obj_id]=groups[x.obj_id]||[]).push(x);});
  Object.keys(groups).forEach(function(k){s+='<h3>'+h(oname(k))+'</h3><div class="card">'+groups[k].sort(function(a,b){return (a.deadline||'9')<(b.deadline||'9')?-1:1;}).map(taskItem).join('')+'</div>';});
  if(!open.length)s+='<div class="card empty">Открытых задач нет</div>';
  if(closed.length)s+=block('Закрытые за эту и прошлую неделю',closed.map(taskItem).join(''),'');
  el('main').innerHTML=s;
}
function findIn(k,id){return (S[k]||[]).filter(function(x){return String(x.id)===String(id);})[0];}
function quickDone(id,cb){var done=(B.dicts.task_status.filter(function(r){return r[1]==='DONE';})[0]||['Выполнено'])[0];api('webUpdate',['TASK',id,{status:done}],function(){toast('Готово: задача выполнена');reload(['tasks'],render);});}
function editTask(id){var x=findIn('tasks',id);if(!x)return;var ro=!x.can;
  form('Задача · '+oname(x.obj_id),[
    {k:'task',l:'Задача',t:role('director')?'textarea':'ro',v:x.task},
    {k:'status',l:'Статус',t:'select',o:B.dicts.task_status,v:x.status},
    {k:'deadline',l:'Срок',t:'date',v:x.deadline},
    {k:'result',l:'Результат / комментарий (видит собственник в отчёте)',t:'textarea',v:x.result},
    {k:'fact',l:'Факт (если план в штуках; звонки и КП считаются сами)',t:'number',v:x.fact},
    role('director')?{k:'owner',l:'Исполнитель',t:'select',o:B.dicts.people,v:x.owner}:null
  ],ro?null:function(v){api('webUpdate',['TASK',id,v],function(){toast('Сохранено'+(clsOf('task_status',v.status)==='MOVED'?' · задача перенесена на следующую неделю':''));closeM();reload(['tasks'],render);});},x);}
function newTask(objId){form('Новая задача',[
    {k:'obj_id',l:'Объект',t:'obj',v:objId||(S.obj&&S.obj.id)||''},
    {k:'task',l:'Задача',t:'textarea'},{k:'block',l:'Блок',t:'select',o:B.dicts.task_blocks},
    {k:'owner',l:'Исполнитель',t:'select',o:B.dicts.people,v:B.me.name},{k:'deadline',l:'Срок',t:'date'},
    {k:'plan',l:'План (число, необязательно)',t:'number'},{k:'unit',l:'Единица',t:'select',o:B.dicts.units,e:'—'}
  ],function(v){api('webCreate',['TASK',v],function(r){toast('Задача создана '+(r.id||''));closeM();reload(['tasks'],render);});});}

/* ───────── База ───────── */
function renderBase(){
  var q=S.q.toLowerCase(), list=S.base.filter(function(r){return (!S.baseObj||String(r.obj_id)===S.baseObj)&&(!S.baseToday||(r.next_date&&r.next_date<=B.today))&&(!q||(r.company+' '+r.contact+' '+r.audience).toLowerCase().indexOf(q)>=0);});
  var s='<div class="row"><h2 style="flex:1">База обзвона и КП ('+list.length+')</h2><button class="b" onclick="newBase(S.baseObj)">+ Компания</button></div><div class="row" style="margin-bottom:8px"><select style="max-width:260px" onchange="S.baseObj=this.value;renderBase()"><option value="">Все мои объекты</option>'+objOpts(S.baseObj,'BASE')+'</select><label class="row mut"><input type="checkbox" class="chk" '+(S.baseToday?'checked':'')+' onchange="S.baseToday=this.checked;renderBase()"> только на сегодня</label><input style="max-width:220px" placeholder="Поиск" value="'+h(S.q)+'" oninput="S.q=this.value;renderBase();this.focus();this.setSelectionRange(this.value.length,this.value.length)"></div>';
  s+='<div class="card">'+(list.sort(function(a,b){return (a.next_date||'9')<(b.next_date||'9')?-1:1;}).map(baseItem).join('')||'<div class="empty">Нет записей</div>')+'</div>';
  el('main').innerHTML=s;
}
function editBase(id){var r=findIn('base',id);if(!r)return;
  form(r.company+' · '+oname(r.obj_id),[
    {t:'info',v:[r.audience,r.contact,r.site,r.fit_note].filter(Boolean).join(' · ')+(r.call_date?'<br>Звонок '+d(r.call_date)+(r.call_result?': '+h(r.call_result):''):'')+(r.kp_date?'<br>КП '+d(r.kp_date)+' ('+h(r.kp_type)+')':'')+(r.response?'<br>Ответ: '+h(r.response)+' '+d(r.response_date):'')},
    {k:'_call',l:'Позвонил(а) сегодня',t:'check'},{k:'call_result',l:'Итог звонка',t:'textarea',v:''},
    {k:'_kp',l:'Отправил(а) КП сегодня',t:'check'},{k:'kp_type',l:'Какое КП',t:'select',o:B.dicts.kp_types,v:r.kp_type||''},
    {k:'response',l:'Ответ',t:'select',o:B.dicts.responses,v:r.response,e:'—'},
    {k:'next_step',l:'Следующий шаг',t:'text',v:r.next_step},{k:'next_date',l:'Когда',t:'date',v:r.next_date},
    {k:'contact',l:'Контакт (ЛПР, телефон, email)',t:'text',v:r.contact},{k:'to_crm',l:'Передан в CRM (интерес — заведён в CRM)',t:'check',v:r.to_crm===true}
  ],function(v){var c={};if(v._call){c.call_date=B.today;c.call_result=v.call_result;}else if(v.call_result)c.call_result=v.call_result;if(v._kp){c.kp_date=B.today;c.kp_type=v.kp_type;}
    ['response','next_step','next_date','contact','to_crm'].forEach(function(k){c[k]=v[k];});
    api('webUpdate',['BASE',id,c],function(){toast('Сохранено');closeM();reload(['base'],render);});});}
function newBase(objId){form('Новая компания / контакт',[
    {k:'obj_id',l:'Объект',t:'obj',v:objId||(S.obj&&S.obj.id)||'',code:'BASE'},{k:'audience',l:'Аудитория (как во вкладке объекта)',t:'text'},
    {k:'company',l:'Компания',t:'text'},{k:'site',l:'Сайт',t:'text'},{k:'contact',l:'Контакт (ЛПР, должность, телефон, email)',t:'text'},
    {k:'fit_note',l:'Почему подходит',t:'textarea'},{k:'next_step',l:'Следующий шаг',t:'text',v:'Позвонить ЛПР'},{k:'next_date',l:'Когда',t:'date',v:B.today}
  ],function(v){api('webCreate',['BASE',v],function(){toast('Компания добавлена');closeM();reload(['base'],render);});});}

/* ───────── Контент (SMM) ───────── */
function smm(){return role('smm')||role('director');}
function renderContent(){
  var tabs=[['plan','Контент-план'],['pub','Опубликовано']];if(smm())tabs.push(['an','Аналитика'],['soc','Соцсети']);
  var s='<div class="row"><h2 style="flex:1">Контент</h2><button class="b" onclick="newCont(\'\')">+ Публикация</button></div><div class="tabs">'+tabs.map(function(t){return '<button class="'+(S.ct===t[0]?'on':'')+'" onclick="S.ct=\''+t[0]+'\';renderContent()">'+t[1]+'</button>';}).join('')+'</div>';
  if(S.ct==='plan')s+=contPlan();
  if(S.ct==='pub')s+=contPub();
  if(S.ct==='an')s+=contAn();
  if(S.ct==='soc')s+=contSoc();
  el('main').innerHTML=s;
}
function contFilter(list){var f=S.cf;return list.filter(function(x){return (!f.platform||x.platform===f.platform)&&(!f.rubric||x.rubric===f.rubric)&&(!f.obj||String(x.obj_id)===f.obj)&&(!f.status||x.status===f.status);});}
function filtersBar(){var f=S.cf;function sel(k,list,label){return '<select style="max-width:190px" onchange="S.cf.'+k+'=this.value;renderContent()">'+opts(list,f[k],label)+'</select>';}
  return '<div class="row" style="margin-bottom:8px">'+sel('platform',B.dicts.platforms,'Все площадки')+sel('rubric',B.dicts.content_rubrics,'Все рубрики')+'<select style="max-width:220px" onchange="S.cf.obj=this.value;renderContent()"><option value="">Все объекты и общий</option>'+B.objects.map(function(o){return '<option value="'+h(o.id)+'"'+(String(o.id)===f.obj?' selected':'')+'>'+h(oname(o.id))+'</option>';}).join('')+'</select>'+sel('status',B.dicts.content_status,'Все статусы')+'</div>';}
function periodBar(a,b,def1,def2,extra){if(!S[a]){S[a]=addD(B.today,def1);S[b]=addD(B.today,def2);}return '<div class="row" style="margin-bottom:8px"><input type="date" style="max-width:160px" value="'+S[a]+'" onchange="S.'+a+'=this.value"> — <input type="date" style="max-width:160px" value="'+S[b]+'" onchange="S.'+b+'=this.value">'+(extra||'')+'</div>';}
function contPlan(){
  var s=periodBar('pf','pt',-7,28,' <button class="b2" onclick="renderContent()">Показать</button>'+(smm()?' <button class="b2" onclick="planDoc()">Выгрузить контент-план</button>':''))+filtersBar();
  var list=contFilter(S.cont).filter(function(x){return x.pub_date?(x.pub_date>=S.pf&&x.pub_date<=S.pt):x.cls!=='DONE';}).sort(function(a,b){return (a.pub_date||'9')<(b.pub_date||'9')?-1:1;});
  var wk={};list.forEach(function(x){var k=x.pub_date?weekOf(x.pub_date):'Без даты';(wk[k]=wk[k]||[]).push(x);});
  Object.keys(wk).forEach(function(k){s+='<h3>'+h(k)+' <span class="mut">('+wk[k].length+')</span></h3><div class="card">'+wk[k].map(contItem).join('')+'</div>';});
  if(!list.length)s+='<div class="card empty">В плане на этот период пусто — добавьте публикации</div>';
  return s;
}
function weekOf(ds){var p=ds.split('-');var dt=new Date(+p[0],+p[1]-1,+p[2]);var wd=(dt.getDay()+6)%7;dt.setDate(dt.getDate()-wd);var e=new Date(dt);e.setDate(e.getDate()+6);return 'Неделя '+d(iso(dt))+' – '+d(iso(e));}
function contPub(){
  var list=contFilter(S.cont).filter(function(x){return x.cls==='DONE';}).sort(function(a,b){return (b.pub_date||'')<(a.pub_date||'')?-1:1;});
  var s=filtersBar()+'<div class="card" style="overflow-x:auto"><table><tr><th>Дата</th><th>Площадка</th><th>Рубрика</th><th>Тема</th><th>Просмотры</th><th>Охват</th><th>Лайки</th><th>Сохр.</th><th>Заявки</th></tr>';
  list.slice(0,200).forEach(function(x){s+='<tr style="cursor:pointer" onclick="editCont(\''+h(x.id)+'\')"><td>'+d(x.pub_date)+'</td><td>'+h(x.platform)+'</td><td>'+h(x.rubric)+'</td><td>'+h(x.topic)+(x.link?' <a class="lnk" target="_blank" onclick="event.stopPropagation()" href="'+h(x.link)+'">↗</a>':'')+'</td><td>'+num(x.views)+'</td><td>'+num(x.reach)+'</td><td>'+num(x.likes)+'</td><td>'+num(x.saves)+'</td><td>'+num(x.leads)+'</td></tr>';});
  return s+'</table>'+(list.length?'':'<div class="empty">Опубликованного пока нет</div>')+'</div>';
}
function contAn(){
  var s=periodBar('af','at',-29,0,' <button class="b2" onclick="S.af=addD(B.today,-6);S.at=B.today;loadAn()">7 дней</button> <button class="b2" onclick="S.af=addD(B.today,-29);S.at=B.today;loadAn()">30 дней</button> <button class="b2" onclick="S.af=addD(B.today,-89);S.at=B.today;loadAn()">Квартал</button> <button class="b" onclick="loadAn()">Показать</button> <button class="b2" onclick="smmDoc()">Выгрузить отчёт</button>');
  var A=S.an;if(!A){setTimeout(loadAn,0);return s+'<div class="empty">Считаю аналитику…</div>';}
  var t=A.totals;
  s+='<div class="mut">Период '+d(A.from)+' – '+d(A.to)+'</div><div class="kpis" style="margin-top:8px">'+kpi('Публикаций',t.posts)+kpi('Просмотры',num(t.views))+kpi('Охват',num(t.reach))+kpi('Вовлечённость',t.er===null?'—':t.er+'%')+kpi('Заявки',num(t.leads))+kpi('Подписки с публ.',num(t.followers_gained))+'</div>';
  if(A.insights.length)s+='<div class="card"><h3 style="margin-top:0">Выводы</h3>'+A.insights.map(function(x){return '<div style="padding:3px 0">• '+h(x)+'</div>';}).join('')+'</div>';
  s+=tbl('Подписчики и аккаунты',['Площадка','Аккаунт','Было','Стало','Рост','Охват','Просмотры','Переходы','Заявки'],A.followers.map(function(x){return [x.platform,x.account,num(x.start),num(x.end),x.growth===null?'—':(x.growth>=0?'+':'')+num(x.growth),num(x.reach),num(x.views),num(x.visits),num(x.leads)];}));
  var g=function(title,list){return tbl(title,['','Публ.','Охват ср.','Просм. ср.','Охват','Просмотры','ER, %','Заявки'],list.map(function(x){return [x.name,x.posts,num(x.avgReach),num(x.avgViews),num(x.reach),num(x.views),x.er===null?'—':x.er,num(x.leads)];}));};
  s+=g('Рубрики — что приносит охваты',A.byRubric)+g('Площадки',A.byPlatform)+g('Форматы',A.byFormat)+g('Объекты и общий контент',A.byObject);
  s+=tbl('Топ-10 публикаций',['Дата','Тема','Площадка','Рубрика','Просмотры','Охват','Ссылка'],A.top.map(function(x){return [x.date,x.topic,x.platform,x.rubric,num(x.views),num(x.reach),x.link];}));
  return s;
}
function loadAn(){api('webSmmAnalytics',[S.af,S.at],function(v){S.an=v;renderContent();});}
function smmDoc(){api('webSmmReport',[S.af,S.at],function(r){links('Отчёт SMM готов',r);});}
function planDoc(){api('webContentPlanDoc',[S.pf,S.pt],function(r){links('Контент-план выгружен',r);});}
function links(t,r){form(t,[{t:'info',v:'<a class="lnk" target="_blank" href="'+h(r.url)+'">Открыть Google Документ ↗</a><br><br><a class="lnk" target="_blank" href="'+h(r.word)+'">Скачать в Word ↗</a><br><br><span class="mut">Файл сохранён в папке «05_СММ» системы (или в вашем Google Диске).</span>'}],null);}
function contSoc(){
  if(!S.soc){api('webSocial',[],function(v){S.soc=v;renderContent();});return '<div class="empty">Загружаю…</div>';}
  var s='<div class="row"><div class="mut" style="flex:1">Раз в неделю внесите цифры по каждой площадке (из статистики аккаунта) — по ним считаются рост подписчиков и охваты.</div><button class="b" onclick="socForm()">+ Внести неделю</button></div>';
  var rows=S.soc.slice().sort(function(a,b){return a.week<b.week?1:a.week>b.week?-1:(a.platform<b.platform?-1:1);});
  s+='<div class="card" style="overflow-x:auto;margin-top:8px"><table><tr><th>Неделя</th><th>Площадка</th><th>Аккаунт</th><th>Подписчики</th><th>Охват</th><th>Просмотры</th><th>Переходы</th><th>Заявки</th><th>Комментарий</th></tr>';
  rows.forEach(function(r){s+='<tr style="cursor:pointer" onclick="socForm(\''+h(r.week)+'\',\''+h(r.platform)+'\')"><td>'+h(r.week)+'</td><td>'+h(r.platform)+'</td><td>'+h(r.account)+'</td><td>'+num(r.followers)+'</td><td>'+num(r.reach)+'</td><td>'+num(r.views)+'</td><td>'+num(r.profile_visits)+'</td><td>'+num(r.leads)+'</td><td class="mut">'+h(r.note)+'</td></tr>';});
  return s+'</table>'+(rows.length?'':'<div class="empty">Пока нет данных</div>')+'</div>';
}
function socForm(wk,pl){var r=(S.soc||[]).filter(function(x){return x.week===wk&&x.platform===pl;})[0]||{week:wk||B.week,platform:pl||''};
  var prev=(S.soc||[]).filter(function(x){return x.platform===r.platform&&x.account;}).pop();
  form('Статистика аккаунта за неделю',[{k:'week',l:'Неделя (ГГГГ-Wнн)',t:'text',v:r.week},{k:'platform',l:'Площадка',t:'select',o:B.dicts.platforms,v:r.platform},{k:'account',l:'Аккаунт / канал',t:'text',v:r.account||(prev?prev.account:'')},
    {k:'followers',l:'Подписчики (на конец недели)',t:'number',v:r.followers},{k:'reach',l:'Охват за неделю',t:'number',v:r.reach},{k:'views',l:'Просмотры за неделю',t:'number',v:r.views},
    {k:'profile_visits',l:'Переходы в профиль',t:'number',v:r.profile_visits},{k:'leads',l:'Заявки из соцсети',t:'number',v:r.leads},{k:'note',l:'Комментарий',t:'textarea',v:r.note}],
    function(v){api('webSocialSave',[v],function(){toast('Сохранено');closeM();S.soc=null;S.an=null;renderContent();});});}
function contFields(x){x=x||{};var nw=!x.id;return [
  {k:'obj_id',l:'Объект (или «Общий контент агентства»)',t:nw?'obj':'ro',v:nw?(x.obj_id||''):oname(x.obj_id),code:'CONT'},{k:'rubric',l:'Рубрика',t:'select',o:B.dicts.content_rubrics,v:x.rubric,e:'—'},
  {k:'topic',l:'Тема',t:'text',v:x.topic},
  nw?{k:'platforms',l:'Площадки (одна тема — несколько площадок)',t:'multi',o:B.dicts.platforms,v:[]}:{k:'platform',l:'Площадка',t:'select',o:B.dicts.platforms,v:x.platform},
  {k:'format',l:'Формат',t:'select',o:B.dicts.content_formats,v:x.format},{k:'goal',l:'Цель',t:'select',o:B.dicts.content_goals,v:x.goal,e:'—'},
  {k:'status',l:'Статус',t:'select',o:B.dicts.content_status,v:x.status||''},{k:'pub_date',l:'Дата публикации',t:'date',v:x.pub_date},
  {k:'owner',l:'Кто делает',t:'select',o:B.dicts.people,v:x.owner||B.me.name},{k:'script',l:'Сценарий (текст или ссылка)',t:'textarea',v:x.script},
  nw?null:{k:'link',l:'Ссылка на публикацию',t:'text',v:x.link},
  nw?null:{k:'views',l:'Просмотры',t:'number',v:x.views},nw?null:{k:'reach',l:'Охват',t:'number',v:x.reach},nw?null:{k:'likes',l:'Лайки',t:'number',v:x.likes},
  nw?null:{k:'comments',l:'Комментарии',t:'number',v:x.comments},nw?null:{k:'saves',l:'Сохранения',t:'number',v:x.saves},nw?null:{k:'shares',l:'Репосты',t:'number',v:x.shares},
  nw?null:{k:'followers_gained',l:'Подписки с публикации',t:'number',v:x.followers_gained},nw?null:{k:'leads',l:'Заявки',t:'number',v:x.leads}];}
function editCont(id){var x=findIn('cont',id);if(!x)return;form('Публикация · '+oname(x.obj_id),contFields(x),function(v){delete v.obj_id;api('webUpdate',['CONT',id,v],function(){toast('Сохранено');closeM();S.an=null;reload(['cont'],render);});});}
function newCont(objId){form('Новая публикация',contFields({obj_id:objId||(S.obj&&S.obj.id)||''}),function(v){if(!v.platforms||!v.platforms.length)return toast('Отметьте хотя бы одну площадку');api('webCreateContent',[v],function(r){toast('Добавлено публикаций: '+r.ids.length);closeM();S.an=null;reload(['cont'],render);});});}

/* ───────── Команда (директор) ───────── */
function renderTeam(T){
  var s='<h2>Команда · неделя '+h(T.week)+'</h2><div class="card" style="overflow-x:auto"><table><tr><th>Сотрудник</th><th>Роль</th><th>Неделя: сделано / всего</th><th>Открыто</th><th>Просрочено</th></tr>';
  T.team.forEach(function(p){s+='<tr><td>'+h(p.name)+'</td><td class="mut">'+h(p.role)+'</td><td>'+p.doneWeek+' / '+p.week+'</td><td>'+p.open+'</td><td style="color:'+(p.overdue?'var(--red)':'inherit')+'">'+p.overdue+'</td></tr>';});
  s+='</table></div><h2>Объекты · неделя</h2><div class="card" style="overflow-x:auto"><table><tr><th>Объект</th><th>Ответственный</th><th>Задачи</th><th>Звонки</th><th>КП</th><th>База</th><th>Интерес</th><th>Отчёт</th></tr>';
  T.objects.forEach(function(o){s+='<tr style="cursor:pointer" onclick="openObj(\''+h(o.id)+'\')"><td>'+h(o.name)+'</td><td class="mut">'+h(o.manager)+'</td><td>'+o.doneWeek+' / '+o.tasksWeek+'</td><td>'+o.callsWeek+'</td><td>'+o.kpWeek+'</td><td>'+o.baseTotal+'</td><td>'+o.interested+'</td><td class="mut">'+d(o.lastReport)+'</td></tr>';});
  el('main').innerHTML=s+'</table></div>';
}

/* ───────── формы ───────── */
var M=null;
function form(title,fields,onSave,rec){
  fields=fields.filter(Boolean);M={fields:fields,onSave:onSave};
  var s='<div class="row"><h3 style="flex:1;margin:0">'+h(title)+'</h3><button class="b2" onclick="closeM()">✕</button></div>';
  fields.forEach(function(f,i){var id='f'+i,v=f.v==null?'':f.v;
    if(f.t==='hide')return;
    if(f.t==='info'){s+='<div class="mut" style="margin-top:8px">'+v+'</div>';return;}
    if(f.t==='multi'){s+='<label class="f">'+h(f.l)+'</label><div class="row">'+(f.o||[]).map(function(o,j){return '<label class="row" style="gap:4px;margin-right:8px"><input type="checkbox" class="chk" id="'+id+'_'+j+'" value="'+h(o)+'"> '+h(o)+'</label>';}).join('')+'</div>';return;}
    if(f.t==='check'){s+='<label class="row" style="margin-top:10px"><input type="checkbox" class="chk" id="'+id+'" '+(v?'checked':'')+(onSave?'':' disabled')+'> '+h(f.l)+'</label>';return;}
    s+='<label class="f">'+h(f.l)+'</label>';
    if(f.t==='ro'){s+='<div>'+h(v)+'</div>';return;}
    var dis=onSave?'':' disabled';
    if(f.t==='select')s+='<select id="'+id+'"'+dis+'>'+opts(f.o,v,f.e||(v?'':'—'))+'</select>';
    else if(f.t==='obj')s+='<select id="'+id+'"'+dis+'>'+objOpts(v,f.code)+'</select>';
    else if(f.t==='textarea')s+='<textarea id="'+id+'"'+dis+'>'+h(v)+'</textarea>';
    else s+='<input id="'+id+'" type="'+(f.t==='number'?'number':f.t==='date'?'date':'text')+'" value="'+h(v)+'"'+dis+'>';
  });
  s+='<div class="row" style="margin-top:14px">'+(onSave?'<button class="b" onclick="saveM()">Сохранить</button>':'<span class="mut">Только просмотр</span>')+'<button class="b2" onclick="closeM()">Отмена</button></div>';
  el('mbox').innerHTML=s;el('modal').style.display='flex';
}
function saveM(){var v={};M.fields.forEach(function(f,i){if(!f.k||f.t==='ro'||f.t==='info')return;if(f.t==='multi'){v[f.k]=(f.o||[]).filter(function(o,j){var c=el('f'+i+'_'+j);return c&&c.checked;});return;}var x=el('f'+i);if(!x)return;v[f.k]=f.t==='check'?x.checked:x.value;});M.onSave(v);}
function closeM(){el('modal').style.display='none';M=null;}
el('modal').addEventListener('click',function(e){if(e.target===el('modal'))closeM();});

/* ───────── старт ───────── */
api('webBootstrap',[],function(b){B=b;el('me').textContent=b.me.name+' · '+b.me.roleTitle;nav();render();});
</script></body></html>`;

// ═════════════ 31_Smm.gs ═════════════
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

/** Несколько публикаций за раз — одна тема на несколько площадок (кросспостинг). */
function webCreateContent(data) {
  const plats = (data && data.platforms && data.platforms.length ? data.platforms : [data && data.platform]).filter(Boolean);
  if (!plats.length) throw new Error('Выберите площадку');
  const ids = plats.map(p => webCreate('CONT', Object.assign({}, data, { platform: p, platforms: undefined })).id);
  return { ok: true, ids: ids };
}

/** Статистика аккаунтов: последние 26 недель. */
function webSocial() {
  webSmmUser_();
  const from = isoWeekKey_(addDays_(today_(), -7 * 26));
  return readTable_('SOC').rows.filter(r => r.id && r.platform && String(r.week) >= from)
    .map(r => webRow_(r, ['id', 'week', 'platform', 'account', 'followers', 'reach', 'views', 'profile_visits', 'leads', 'note']));
}

/** Сохранить неделю по площадке: есть строка (неделя + площадка) — обновить, нет — создать. */
function webSocialSave(rec) {
  const u = webSmmUser_();
  if (!rec || !rec.platform) throw new Error('Выберите площадку');
  const wk = rec.week || isoWeekKey_(today_());
  const keys = ['account', 'followers', 'reach', 'views', 'profile_visits', 'leads', 'note'];
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
  const group = keyFn => {
    const g = {};
    posts.forEach(r => { const k = keyFn(r) || '— без рубрики'; (g[k] = g[k] || []).push(r); });
    return Object.keys(g).map(k => Object.assign({ name: k }, sum(g[k]))).sort((a, b) => b.avgReach - a.avgReach || b.avgViews - a.avgViews);
  };
  const objName = id => isServiceObject_(objs[String(id)] || {}) ? 'Общий контент агентства' : ((objs[String(id)] || {}).name || String(id));
  const totals = sum(posts);
  const byPlatform = group(r => r.platform);
  const byRubric = group(r => r.rubric);
  const byFormat = group(r => r.format);
  const byObject = group(r => objName(r.obj_id));
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
  const noRub = posts.filter(r => !r.rubric).length;
  if (noRub) ins.push('У ' + noRub + ' публикаций не указана рубрика — проставьте, чтобы аналитика по рубрикам была точной.');
  const noStat = posts.filter(r => !smmNum_(r.views) && !smmNum_(r.reach)).length;
  if (noStat) ins.push('У ' + noStat + ' публикаций нет просмотров и охвата — внесите цифры (Instagram, Threads, Telegram, YouTube подтягиваются по ссылке сами).');
  const allPlats = dictValues_('platforms').filter(p => !/другое|циан/i.test(p));
  const silent = allPlats.filter(p => !byPlatform.some(x => x.name === p) && followers.some(f => f.platform === p));
  if (silent.length) ins.push('Не было публикаций за период: ' + silent.join(', ') + '.');
  return {
    from: fmtDate_(R.from, 'yyyy-MM-dd'), to: fmtDate_(R.to, 'yyyy-MM-dd'),
    totals: totals, byPlatform: byPlatform, byRubric: byRubric, byFormat: byFormat, byObject: byObject, top: top, followers: followers, insights: ins,
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
  smmTable_(b, ['Площадка', 'Аккаунт', 'Было', 'Стало', 'Рост', 'Охват', 'Просмотры', 'Переходы', 'Заявки'],
    A.followers.map(x => [x.platform, x.account, x.start, x.end, x.growth === null ? '—' : (x.growth >= 0 ? '+' : '') + x.growth, f(x.reach), f(x.views), f(x.visits), x.leads]));
  const g = (title, list) => {
    b.appendParagraph(title).setHeading(H.HEADING1);
    smmTable_(b, ['', 'Публ.', 'Охват ср.', 'Просм. ср.', 'Охват', 'Просмотры', 'ER, %', 'Заявки'],
      list.map(x => [x.name, x.posts, f(x.avgReach), f(x.avgViews), f(x.reach), f(x.views), x.er === null ? '—' : x.er, x.leads]));
  };
  g('Рубрики (по среднему охвату)', A.byRubric);
  g('Площадки', A.byPlatform);
  g('Форматы', A.byFormat);
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
    smmTable_(b, ['Дата', 'Площадка', 'Формат', 'Рубрика', 'Объект', 'Тема', 'Статус', 'Кто'],
      weeks[k].map(r => [fmtDate_(r.pub_date, 'dd.MM'), r.platform, r.format, r.rubric || '', isServiceObject_(objs[String(r.obj_id)] || {}) ? 'Общий' : ((objs[String(r.obj_id)] || {}).name || r.obj_id), r.topic, r.status, r.owner]));
  });
  doc.saveAndClose();
  return { url: doc.getUrl(), word: wordExportUrl_(doc.getId()) };
}
