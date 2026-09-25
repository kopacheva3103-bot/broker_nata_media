/** СИСТЕМА УПРАВЛЕНИЯ ЭКСКЛЮЗИВАМИ — весь код одним файлом. Собрано из apps_script/*.gs (tools/build_dist.sh). */

// ═════════════ 00_Config.gs ═════════════
/**
 * СИСТЕМА УПРАВЛЕНИЯ ЭКСКЛЮЗИВАМИ
 * 00_Config — константы, настройки, справочники.
 *
 * Правило: значения, которые может захотеть поменять пользователь,
 * живут в листах 08_СПРАВОЧНИКИ и 10_НАСТРОЙКИ, а не в формулах.
 * Здесь — только начальные значения, которыми эти листы заполняются при установке.
 */

const SYS = {
  VERSION: '1.3.0',
  TITLE: 'СИСТЕМА УПРАВЛЕНИЯ ЭКСКЛЮЗИВАМИ',
  MENU: 'УПРАВЛЕНИЕ ЭКСКЛЮЗИВАМИ',
  ROOT_FOLDER: 'СИСТЕМА ЭКСКЛЮЗИВОВ',
  FOLDERS: {
    MASTER: '00_ТАБЛИЦА',
    OBJECTS: '01_ОБЪЕКТЫ',
    TEMPLATES: '02_ШАБЛОНЫ',
  },
  /** Подпапки внутри папки объекта «Название (ID)». */
  OBJECT_SUBFOLDERS: {
    STRATEGIES: 'Стратегия',
    REPORTS: 'Отчёты',
    MATERIALS: 'Материалы',
  },
  REPORT_TEMPLATE_NAME: 'Еженедельный отчёт по продаже объекта',
  STRATEGY_TEMPLATE_NAME: 'Шаблон стратегии продажи объекта',
  DATA_ROWS: 2000,        // стартовое количество строк в листах-журналах
  STAT_ROWS: 1000,
  TZ: 'Europe/Moscow',
  LOCALE: 'ru_RU',
  PROTECT_PREFIX: 'SYS: ',
};

const SHEET_NAMES = {
  OBJ: '01_ОБЪЕКТЫ',
  STR: '02_СТРАТЕГИЯ',
  ACT: '03_ДЕЙСТВИЯ',
  FUN: '04_ВОРОНКА',
  STAT: '05_СТАТИСТИКА',
  PF: '06_ПЛАН_ФАКТ',
  REP: '07_ОТЧЕТ',
  DICT: '08_СПРАВОЧНИКИ',
  DASH: '09_ДЭШБОРД',
  CFG: '10_НАСТРОЙКИ',
  CTRL: '11_КОНТРОЛЬ',
  HIST: '12_ИСТОРИЯ',
  ARCH: '13_АРХИВ_ОТЧЕТОВ',
  HYP: '14_ГИПОТЕЗЫ',
};

const SHEET_ORDER = ['OBJ', 'STR', 'ACT', 'FUN', 'STAT', 'PF', 'REP', 'DICT', 'DASH', 'CFG', 'CTRL', 'HIST', 'ARCH', 'HYP'];

const TAB_COLORS = {
  OBJ: '#37474F', STR: '#37474F', ACT: '#2E7D32', FUN: '#1565C0', STAT: '#1565C0',
  PF: '#2E7D32', REP: '#6A1B9A', DICT: '#9E9E9E', DASH: '#1565C0', CFG: '#9E9E9E',
  CTRL: '#C62828', HIST: '#9E9E9E', ARCH: '#6A1B9A', HYP: '#2E7D32',
};

/** Спокойная палитра: без кислотных цветов. */
const COLORS = {
  HDR_INPUT_BG: '#263238', HDR_INPUT_FG: '#FFFFFF',     // вводится вручную
  HDR_FORMULA_BG: '#CFD8DC', HDR_FORMULA_FG: '#263238', // считается формулой
  HDR_AUTO_BG: '#E3E7EA', HDR_AUTO_FG: '#37474F',       // заполняет скрипт
  HDR_HELPER_BG: '#F1F3F4', HDR_HELPER_FG: '#80868B',   // служебное (скрыто)
  FORMULA_CELL_BG: '#F8F9FA',
  SECTION_BG: '#263238', SECTION_FG: '#FFFFFF',
  SUBHEADER_BG: '#ECEFF1',
  RED_BG: '#F4CCCC', RED_FG: '#7F1D1D',
  YELLOW_BG: '#FFF2CC', YELLOW_FG: '#6B4E00',
  GREEN_BG: '#D9EAD3', GREEN_FG: '#1E4620',
  GREY_FG: '#80868B',
  SELECT_BG: '#FFF8E1',
};

/** Системные классы статусов (коды, не показываются пользователю как значения выбора). */
const CLS = {
  OPEN: 'OPEN', DONE: 'DONE', MOVED: 'MOVED', FAIL: 'FAIL', CANCEL: 'CANCEL',
  WON: 'WON', LOST: 'LOST', PAUSED: 'PAUSED',
};

const HIST_KIND = {
  INITIAL: 'Первичное значение',
  CHANGE: 'Изменение',
  MOVE: 'Перенос',
  CREATE: 'Создание',
};

const REPORT_STATUS = { ACTUAL: 'Актуальный', REPLACED: 'Заменён' };

/** Типы предупреждений (листы 11_КОНТРОЛЬ и 09_ДЭШБОРД). */
const ALERT = {
  IDLE_HIGH: 'Нет активности',
  IDLE_WARN: 'Мало активности',
  TASK_OVERDUE: 'Просроченная задача',
  ACTION_OVERDUE: 'Просроченное действие',
  REPORT_DUE: 'Пора подготовить отчёт',
  NO_LEADS: 'Нет новых заинтересованных',
  CONV_DROP: 'Падение конверсии',
  MANY_LOST: 'Много отказов',
  STRATEGY_OLD: 'Стратегия не пересматривалась',
  STRATEGY_FLAG: 'Требуется изменение стратегии',
  HYP_DUE: 'Гипотеза: пора подвести итог',
  NO_OWNER: 'Задача без ответственного',
  EXCL_END: 'Эксклюзив заканчивается',
  ID_PROBLEM: 'Проблема с ID объекта',
};
/** Предупреждения, которые означают «пора менять стратегию». */
const ALERTS_STRATEGY = [ALERT.CONV_DROP, ALERT.MANY_LOST, ALERT.STRATEGY_OLD, ALERT.STRATEGY_FLAG];

const SEVERITY = { HIGH: '1 · Высокая', MID: '2 · Средняя', LOW: '3 · Низкая' };

/**
 * Настройки (лист 10_НАСТРОЙКИ). Каждое значение получает именованный диапазон CFG_<KEY>,
 * поэтому пороги меняются в одной ячейке без правки формул.
 */
function cfgDefs_() {
  return [
    { group: 'Пороги контроля' },
    { key: 'NO_ACTIVITY_DAYS', label: 'Нет активности: объект без действий дольше, дней (красный)', value: 7 },
    { key: 'WARN_ACTIVITY_DAYS', label: 'Мало активности: без действий дольше, дней (жёлтый)', value: 4 },
    { key: 'NO_LEADS_DAYS', label: 'Нет новых заинтересованных (лидов) дольше, дней', value: 14 },
    { key: 'STRATEGY_REVIEW_DAYS', label: 'Стратегия не пересматривалась дольше, дней', value: 30 },
    { key: 'EXCL_END_WARN_DAYS', label: 'Предупредить об окончании эксклюзива за, дней', value: 14 },
    { key: 'RECENT_DAYS', label: 'Окно «последний период» для сравнения конверсии, дней', value: 14 },
    { key: 'COMPARE_DAYS', label: 'Окно «предыдущий период» для сравнения конверсии, дней', value: 28 },
    { key: 'CONV_DROP', label: 'Падение конверсии контакт→интерес, считается значимым от (доля)', value: 0.3, fmt: '0%' },
    { key: 'MIN_CONTACTS', label: 'Мин. контактов в каждом окне для оценки падения конверсии', value: 10 },
    { key: 'MANY_REFUSALS', label: 'Много отказов: действий с причиной отказа за последние (окно посл. + пред.) дней, от', value: 3 },
    { group: 'Отчёты и недели' },
    { key: 'REPORT_WEEKDAY', label: 'День отчёта клиенту (1 = пн … 5 = пт)', value: 5 },
    { key: 'REPORT_PERIOD_DAYS', label: 'Периодичность отчёта, дней', value: 7 },
    { key: 'WEEKS_START', label: 'Начало учёта недель (любая дата)', value: '2026-01-05', fmt: 'dd.mm.yyyy', date: true },
    { key: 'FUTURE_WEEKS', label: 'Сколько будущих недель показывать в списках', value: 12 },
    { group: 'Подпись в отчёте клиенту' },
    { key: 'AGENCY_NAME', label: 'Название агентства / бренд', value: '' },
    { key: 'MANAGER_NAME', label: 'Имя руководителя (подпись отчёта)', value: '' },
    { key: 'MANAGER_CONTACT', label: 'Контакт руководителя (телефон / Telegram)', value: '' },
    { group: 'Команда и уведомления' },
    { key: 'ASSISTANT_EMAIL', label: 'Email ассистента (доступ к папкам Drive)', value: '' },
    { key: 'DAILY_EMAIL', label: 'Email для ежедневной сводки предупреждений', value: '' },
    { group: 'Служебное — заполняет скрипт, не менять вручную' },
    { key: 'FOLDER_ROOT_ID', label: 'ID папки «СИСТЕМА ЭКСКЛЮЗИВОВ»', value: '', sys: true },
    { key: 'FOLDER_MASTER_ID', label: 'ID папки 00_ТАБЛИЦА', value: '', sys: true },
    { key: 'FOLDER_OBJECTS_ID', label: 'ID папки 01_ОБЪЕКТЫ', value: '', sys: true },
    { key: 'FOLDER_TEMPLATES_ID', label: 'ID папки 02_ШАБЛОНЫ', value: '', sys: true },
    { key: 'TEMPLATE_REPORT_ID', label: 'ID шаблона отчёта (Google Doc)', value: '', sys: true },
    { key: 'TEMPLATE_STRATEGY_ID', label: 'ID шаблона стратегии (Google Doc)', value: '', sys: true },
    { key: 'SYSTEM_VERSION', label: 'Версия системы', value: SYS.VERSION, sys: true },
  ];
}

/** KPI-метрики плана недели и откуда берётся их факт. Порядок = порядок в справочнике. */
const KPI_SOURCES = [
  { title: 'Контакты', act: 'contacts' },
  { title: 'Ответы', act: 'responses' },
  { title: 'Лиды', act: 'interested' }, // лид = заинтересованный контакт (столбец «Количество заинтересованных» в 03)
  { title: 'Презентации', act: 'presentations' },
  { title: 'Показы', act: 'showings' },
  { title: 'Переговоры', act: 'negotiations' },
  { title: 'Предложения', act: 'offers' },
  { title: 'Брони', act: 'bookings' },
  { title: 'Сделки', act: 'deals' },
  { title: 'Действия', count: true },
];

/** KPI, которые «Создать план недели» ставит каждому активному объекту (меняются в 10_НАСТРОЙКИ). */
const DEFAULT_WEEK_KPI = [['Контакты', 30], ['Лиды', 2], ['Показы', 1]];

/** Поля стратегии, изменения которых можно показывать клиенту (остальные — внутренние). */
const STRATEGY_CLIENT_FIELD_KEYS = ['positioning', 'key_argument', 'channels', 'partner_channels', 'content_strategy', 'promo_plan', 'conclusion'];

/**
 * Справочники (лист 08_СПРАВОЧНИКИ). Все выпадающие списки берут значения отсюда.
 * Колонка «Класс» — системный смысл значения: сами названия можно переименовывать,
 * формулы опираются на класс, а не на текст.
 */
function dictDefs_() {
  return [
    {
      key: 'obj_status', cols: ['Статус объекта', 'Класс', 'В работе'], values: [
        ['Новый', 'ACTIVE', 'ДА'], ['Стратегия', 'ACTIVE', 'ДА'], ['Активная продажа', 'ACTIVE', 'ДА'],
        ['Переговоры', 'NEGOTIATION', 'ДА'], ['Бронь', 'BOOKING', 'ДА'], ['Сделка', 'DEAL', 'ДА'],
        ['Продан', 'SOLD', 'НЕТ'], ['Пауза', 'PAUSED', 'НЕТ'], ['Снят с продажи', 'REMOVED', 'НЕТ'],
      ],
    },
    { key: 'temperature', cols: ['Температура'], values: [['HOT'], ['WARM'], ['COLD'], ['RISK']] },
    { key: 'obj_types', cols: ['Тип объекта'], values: [['Квартира'], ['Апартаменты'], ['Пентхаус'], ['Дом'], ['Таунхаус'], ['Участок'], ['Коммерческая'], ['Другое']] },
    { key: 'categories', cols: ['Категория'], values: [['Комфорт'], ['Бизнес'], ['Премиум'], ['Элит'], ['Инвестиционная']] },
    { key: 'deal_types', cols: ['Тип сделки'], values: [['Продажа'], ['Переуступка'], ['Аренда']] },
    { key: 'priorities', cols: ['Приоритет'], values: [['A — высокий'], ['B — средний'], ['C — низкий']] },
    {
      key: 'action_types', cols: ['Тип действия'], values: [
        ['CRM'], ['Звонок'], ['WhatsApp'], ['Telegram'], ['Email'], ['Рассылка'], ['Партнёры'], ['Брокеры'], ['Показ'],
        ['Переговоры'], ['Презентация'], ['ЦИАН'], ['Авито'], ['Яндекс'], ['Контент'], ['Reels'], ['Stories'], ['Threads'],
        ['Реклама'], ['Outbound'], ['WLC'], ['Бизнес-клуб'], ['Юристы'], ['Банки'], ['Private Banking'], ['Дизайнеры'],
        ['Архитекторы'], ['Другое'],
      ],
    },
    {
      key: 'channels', cols: ['Канал', 'Группа канала', 'Площадка объявлений'], values: [
        ['CRM-база', 'Прямые', 'НЕТ'], ['Холодная база / Outbound', 'Прямые', 'НЕТ'], ['Личная сеть', 'Прямые', 'НЕТ'],
        ['WhatsApp', 'Прямые', 'НЕТ'], ['Email', 'Прямые', 'НЕТ'], ['Входящий звонок', 'Входящие', 'НЕТ'],
        ['Сайт / лендинг', 'Входящие', 'НЕТ'], ['Рекомендация', 'Входящие', 'НЕТ'],
        ['ЦИАН', 'Объявления', 'ДА'], ['Авито', 'Объявления', 'ДА'], ['Яндекс Недвижимость', 'Объявления', 'ДА'],
        ['Telegram', 'Контент', 'НЕТ'], ['Instagram', 'Контент', 'НЕТ'], ['Threads', 'Контент', 'НЕТ'],
        ['Реклама', 'Реклама', 'НЕТ'], ['Брокеры', 'Партнёры', 'НЕТ'], ['Партнёры', 'Партнёры', 'НЕТ'],
        ['Юристы', 'Партнёры', 'НЕТ'], ['Банки', 'Партнёры', 'НЕТ'], ['Private Banking', 'Партнёры', 'НЕТ'],
        ['Дизайнеры', 'Партнёры', 'НЕТ'], ['Архитекторы', 'Партнёры', 'НЕТ'], ['WLC', 'Сообщества', 'НЕТ'],
        ['Бизнес-клуб', 'Сообщества', 'НЕТ'], ['Другое', 'Прочее', 'НЕТ'],
      ],
    },
    {
      key: 'task_status', cols: ['Статус задачи / действия', 'Класс'], values: [
        ['Запланировано', 'OPEN'], ['В работе', 'OPEN'], ['Выполнено', 'DONE'], ['Перенесено', 'MOVED'],
        ['Не выполнено', 'FAIL'], ['Отменено', 'CANCEL'],
      ],
    },
    {
      key: 'refusal_reasons', cols: ['Причина отказа'], values: [
        ['Цена'], ['Локация'], ['Планировка'], ['Площадь'], ['Состояние / ремонт'], ['Инфраструктура'],
        ['Юридические вопросы'], ['Сроки'], ['Не подходит формат'], ['Нет бюджета'], ['Выбрал другой объект'], ['Другое'],
      ],
    },
    { key: 'people', cols: ['Ответственный', 'Роль', 'Email'], values: [['Руководитель', 'Руководитель', ''], ['Ассистент', 'Ассистент', '']] },
    { key: 'kpi_metrics', cols: ['KPI-метрика'], values: KPI_SOURCES.map(k => [k.title]) },
    {
      key: 'hyp_status', cols: ['Статус гипотезы', 'Класс'], values: [
        ['В проверке', 'OPEN'], ['Подтвердилась', 'DONE'], ['Не подтвердилась', 'FAIL'], ['Отменена', 'CANCEL'],
      ],
    },
    { key: 'strategy_status', cols: ['Статус стратегии'], values: [['Черновик'], ['На утверждении'], ['Утверждена'], ['Требует пересмотра']] },
    { key: 'strategy_client_fields', cols: ['Поля стратегии, видимые клиенту'], values: STRATEGY_CLIENT_FIELD_KEYS.map(k => [fieldTitle_('STR', k)]) },
    // Ниже — вычисляемые списки (формулы), руками не заполняются.
    { key: 'weeks', cols: ['Неделя', 'Понедельник', 'Воскресенье', 'Неделя (подпись)'], generated: true },
    { key: 'obj_labels', cols: ['Объект (выбор)'], generated: true },
    { key: 'obj_filter', cols: ['Фильтр объектов'], generated: true },
    { key: 'week_filter', cols: ['Фильтр недель'], generated: true },
  ];
}

// ═════════════ 01_Schema.gs ═════════════
/**
 * 01_Schema — структура данных всех листов-журналов.
 *
 * Каждое поле описано ОДИН раз: заголовок, тип ввода, справочник, формула.
 * Из этого описания строятся: заголовки, формулы, выпадающие списки, форматы,
 * защита формул, onEdit-логика и документация (tools/gen_docs.js).
 *
 * Типы полей (kind):
 *   id    — уникальный ID, ставит скрипт (ACT-0001, TASK-0001). ID объекта — из CRM, вручную
 *   text  — ручной ввод текста
 *   dd    — ручной выбор из выпадающего списка (dict = справочник, list = другой лист)
 *   date  — ручной ввод даты (календарь)
 *   num   — ручной ввод числа
 *   money — ручной ввод суммы
 *   cb    — чекбокс
 *   link  — ссылка, вводится вручную
 *   sys   — заполняет скрипт (ссылки на документы, даты создания, автор)
 *   f     — формула (ARRAYFORMULA в заголовке столбца; руками не трогать)
 *
 * Флаги: helper — служебный столбец (скрыт), track — изменения пишутся в 12_ИСТОРИЯ,
 *        client — может попасть в отчёт клиенту, internal — никогда не попадает к клиенту.
 *
 * Токены в формулах: [[@поле]] — столбец этого листа, [[ACT.поле]] — столбец другого листа,
 * [[D.справочник]] — справочник, [[CFG.КЛЮЧ]] — настройка. Разворачиваются в 02_Formulas.
 */

function F(key, title, kind, opts) {
  return Object.assign({ key: key, title: title, kind: kind }, opts || {});
}

const WEEK_OF_ = d => `YEAR(${d}-WEEKDAY(${d},2)+4)&"-W"&TEXT(ISOWEEKNUM(${d}),"00")`;
const MONTH_OF_ = d => `YEAR(${d})&"-"&TEXT(MONTH(${d}),"00")`;
const OBJ_NAME_F_ = key => `IFERROR(VLOOKUP([[@${key}]],{[[OBJ.id]],[[OBJ.name]]},2,FALSE),"⚠ нет объекта")`;

function sheetSpecs_() {
  if (sheetSpecs_.cache) return sheetSpecs_.cache;
  const S = {};

  // ─────────────────────────────── 01_ОБЪЕКТЫ ───────────────────────────────
  S.OBJ = {
    code: 'OBJ', guard: 'name', frozenCols: 2,
    about: 'Единый реестр эксклюзивов. Одна строка = один объект.',
    fields: [
      F('id', 'ID объекта', 'text', { w: 100, d: 'ID объекта из CRM — вводится вручную, должен быть уникальным. По нему связаны все листы и его удобно искать в CRM. Если исправить ID здесь, скрипт обновит его во всех связанных строках.' }),
      F('name', 'Название объекта', 'text', { w: 170, client: true, d: 'Как объект называется в отчётах клиенту.' }),
      F('address', 'Адрес', 'text', { w: 200, client: true }),
      F('complex', 'ЖК / поселок', 'text', { w: 130 }),
      F('obj_type', 'Тип объекта', 'dd', { dict: 'obj_types' }),
      F('category', 'Категория', 'dd', { dict: 'categories' }),
      F('area', 'Площадь', 'num', { fmt: '#,##0.0', d: 'м²' }),
      F('rooms', 'Количество комнат', 'num', { fmt: '0' }),
      F('price', 'Цена', 'money', { track: true, client: true, d: 'Текущая цена. Каждое изменение сохраняется в 12_ИСТОРИЯ.' }),
      F('price_m2', 'Цена за м²', 'f', { fmt: 'money', f: 'IFERROR(ROUND([[@price]]/[[@area]],0),"")' }),
      F('deal_type', 'Тип сделки', 'dd', { dict: 'deal_types' }),
      F('date_sign', 'Дата подписания эксклюзива', 'date'),
      F('date_end', 'Дата окончания эксклюзива', 'date', { track: true }),
      F('close_date', 'Дата закрытия', 'date', { track: true, d: 'Ставится автоматически при статусе «Продан» или «Снят с продажи» (можно поправить вручную). С этой даты «дни в продаже» перестают расти.' }),
      F('days_on_market', 'Количество дней в продаже', 'f', { fmt: '0', f: 'IF([[@date_sign]]="","",IF([[@close_date]]="",TODAY(),[[@close_date]])-[[@date_sign]])' }),
      F('status', 'Статус объекта', 'dd', { dict: 'obj_status', track: true }),
      F('manager', 'Ответственный', 'dd', { dict: 'people', track: true }),
      F('assistant', 'Ассистент', 'dd', { dict: 'people' }),
      F('crm_link', 'Ссылка на CRM', 'link', { w: 120 }),
      F('strategy_link', 'Ссылка на стратегию', 'sys', { w: 120, d: 'Google Doc стратегии. Создаётся меню «Открыть стратегию».' }),
      F('folder_link', 'Ссылка на папку объекта', 'sys', { w: 120, d: 'Папка объекта в 01_ОБЪЕКТЫ: внутри «Стратегия», «Отчёты», «Материалы».' }),
      F('last_report_link', 'Ссылка на последний отчёт', 'sys', { w: 120, d: 'PDF последнего отчёта клиенту.' }),
      F('last_report_date', 'Дата последнего отчёта', 'sys', { fmt: 'date' }),
      F('next_report', 'Следующий отчёт', 'f', {
        fmt: 'date',
        f: 'IF([[@last_report_date]]="",TODAY()-WEEKDAY(TODAY(),2)+[[CFG.REPORT_WEEKDAY]],[[@last_report_date]]+[[CFG.REPORT_PERIOD_DAYS]])',
      }),
      F('priority', 'Приоритет', 'dd', { dict: 'priorities' }),
      F('temperature', 'Температура объекта', 'dd', { dict: 'temperature', track: true }),
      F('target_buyer', 'Целевой покупатель', 'text', { w: 180 }),
      F('main_channel', 'Основной канал продаж', 'dd', { dict: 'channels' }),
      F('last_action', 'Последнее действие', 'f', {
        w: 220,
        f: 'IFERROR(VLOOKUP([[@id]],SORT(FILTER({[[ACT.obj_id]],[[ACT.date]],TEXT([[ACT.date]],"dd.mm")&" · "&[[ACT.type]]&IF([[ACT.fact]]="",""," — "&LEFT([[ACT.fact]],80))},[[ACT.status_class]]="DONE",[[ACT.date]]<=TODAY()),2,FALSE),3,FALSE),"—")',
      }),
      F('next_action', 'Следующее действие', 'f', {
        w: 220, d: 'Ближайшая открытая задача из 06_ПЛАН_ФАКТ, иначе ближайший «Следующий шаг» из 03_ДЕЙСТВИЯ.',
        f: 'IFERROR(VLOOKUP([[@id]],SORT(FILTER({[[PF.obj_id]],[[PF.deadline]],IF([[PF.task]]="",[[PF.week_goal]],[[PF.task]])},[[PF.status_class]]="OPEN",([[PF.task]]<>"")+([[PF.week_goal]]<>"")),2,TRUE),3,FALSE),IFERROR(VLOOKUP([[@id]],SORT(FILTER({[[ACT.obj_id]],[[ACT.next_step_date]],[[ACT.next_step]]},[[ACT.next_step]]<>"",[[ACT.next_step_date]]>=TODAY()),2,TRUE),3,FALSE),"—"))',
      }),
      F('next_action_deadline', 'Дедлайн следующего действия', 'f', {
        fmt: 'date',
        f: 'IFERROR(VLOOKUP([[@id]],SORT(FILTER({[[PF.obj_id]],[[PF.deadline]]},[[PF.status_class]]="OPEN",([[PF.task]]<>"")+([[PF.week_goal]]<>"")),2,TRUE),2,FALSE),IFERROR(VLOOKUP([[@id]],SORT(FILTER({[[ACT.obj_id]],[[ACT.next_step_date]]},[[ACT.next_step]]<>"",[[ACT.next_step_date]]>=TODAY()),2,TRUE),2,FALSE),""))',
      }),
      F('days_idle', 'Количество дней без активности', 'f', {
        fmt: '0', d: 'Сегодня минус дата последнего выполненного действия (если действий нет — от даты подписания).',
        f: 'IF([[@last_action_date]]="",IF([[@date_sign]]="","",TODAY()-[[@date_sign]]),TODAY()-[[@last_action_date]])',
      }),
      F('manager_comment', 'Комментарий руководителя', 'text', { w: 200, internal: true, d: 'Внутренний. В отчёт клиенту не попадает.' }),
      F('risk_flag', 'Флаг активности', 'f', {
        d: 'RISK — нет действий дольше порога NO_ACTIVITY_DAYS; ВНИМАНИЕ — дольше WARN_ACTIVITY_DAYS; OK; «—» — объект не в работе.',
        f: 'IF([[@in_work]]<>"ДА","—",IF([[@days_idle]]="","",IF([[@days_idle]]>[[CFG.NO_ACTIVITY_DAYS]],"RISK",IF([[@days_idle]]>[[CFG.WARN_ACTIVITY_DAYS]],"ВНИМАНИЕ","OK"))))',
      }),
      F('id_check', 'Проверка ID', 'f', { d: '«НЕТ ID» — объект не участвует в расчётах; «ДУБЛЬ ID» — такой ID уже есть.', f: 'IF([[@id]]="","НЕТ ID",IF(COUNTIF([[@id]],[[@id]])>1,"ДУБЛЬ ID",""))' }),
      F('status_class', 'Класс статуса', 'f', { helper: true, f: 'IFERROR(VLOOKUP([[@status]],[[D.obj_status:tbl]],2,FALSE),"")' }),
      F('in_work', 'В работе', 'f', { helper: true, f: 'IFERROR(VLOOKUP([[@status]],[[D.obj_status:tbl]],3,FALSE),"ДА")' }),
      F('last_action_date', 'Дата последнего действия', 'f', {
        helper: true, fmt: 'date',
        f: 'IFERROR(VLOOKUP([[@id]],SORT(FILTER({[[ACT.obj_id]],[[ACT.date]]},[[ACT.status_class]]="DONE",[[ACT.date]]<=TODAY()),2,FALSE),2,FALSE),"")',
      }),
      F('created_at', 'Создан', 'sys', { fmt: 'date', helper: true }),
    ],
  };

  // ─────────────────────────────── 02_СТРАТЕГИЯ ───────────────────────────────
  const strText = (key, title, extra) => F(key, title, 'text', Object.assign({ track: true, w: 200 }, extra || {}));
  S.STR = {
    code: 'STR', guard: 'obj_id', frozenCols: 2,
    about: 'Краткая управленческая версия стратегии. Полная стратегия — в Google Doc по ссылке.',
    fields: [
      F('obj_id', 'ID объекта', 'dd', { list: 'OBJ.id', d: 'Строка создаётся автоматически при добавлении объекта.' }),
      F('obj_name', 'Объект', 'f', { w: 160, f: OBJ_NAME_F_('obj_id') }),
      F('strategy_status', 'Статус стратегии', 'dd', { dict: 'strategy_status', track: true, d: 'Утверждает руководитель.' }),
      F('strategy_doc', 'Ссылка на Google Doc стратегии', 'sys', { w: 130 }),
      strText('goal', 'Цель продажи'),
      F('target_price', 'Целевая цена', 'money', { track: true, internal: true }),
      strText('price_range', 'Допустимый ценовой диапазон', { internal: true }),
      strText('positioning', 'Позиционирование', { client: true }),
      strText('ta1', 'Целевая аудитория №1'),
      strText('ta2', 'Целевая аудитория №2'),
      strText('ta3', 'Целевая аудитория №3'),
      strText('motives', 'Основные мотивы покупателя'),
      strText('objections', 'Основные возражения'),
      strText('answers', 'Ответы на возражения'),
      strText('competitors', 'Конкуренты'),
      strText('advantages', 'Преимущества объекта'),
      strText('weaknesses', 'Слабые стороны', { internal: true }),
      strText('not_public', 'Что нельзя использовать в публичной коммуникации', { internal: true }),
      strText('key_argument', 'Ключевой продающий аргумент', { client: true }),
      strText('scenario', 'Основной сценарий продажи'),
      strText('channels', 'Каналы продвижения', { client: true }),
      strText('partner_channels', 'Партнёрские каналы', { client: true }),
      strText('crm_base', 'CRM-база'),
      strText('content_strategy', 'Контент-стратегия', { client: true }),
      strText('outbound_strategy', 'Outbound-стратегия'),
      strText('promo_plan', 'План продвижения', { client: true }),
      strText('hypotheses', 'Гипотезы', { internal: true }),
      F('review_date', 'Дата последнего пересмотра', 'date', { track: true }),
      strText('conclusion', 'Вывод', { client: true }),
      strText('next_hypothesis', 'Следующая гипотеза', { internal: true }),
      F('need_change', 'Требуется изменение стратегии', 'cb', { d: 'Ручной флаг руководителя/ассистента.' }),
      F('days_since_review', 'Дней с пересмотра', 'f', { fmt: '0', f: 'IF([[@review_date]]="","",TODAY()-[[@review_date]])' }),
      F('changed_at', 'Дата последнего изменения', 'sys', { fmt: 'datetime', d: 'Ставит скрипт при любом изменении стратегии.' }),
      F('changed_by', 'Кто изменил', 'sys'),
    ],
  };

  // ─────────────────────────────── 03_ДЕЙСТВИЯ ───────────────────────────────
  const cnt = (key, title, extra) => F(key, title, 'num', Object.assign({ fmt: '0', w: 88, client: true }, extra || {}));
  S.ACT = {
    code: 'ACT', guard: 'date', frozenCols: 3, idField: 'id', idPrefix: 'ACT-', idPad: 4,
    about: 'Главный журнал работы. Одна строка = одно значимое действие по продаже объекта.',
    fields: [
      F('id', 'ID действия', 'id'),
      F('date', 'Дата', 'date', { client: true, d: 'Если не указать — скрипт поставит сегодняшнюю.' }),
      F('week', 'Неделя', 'f', { f: WEEK_OF_('[[@date]]'), d: 'ISO-неделя вида 2026-W39, считается из даты.' }),
      F('obj_id', 'ID объекта', 'dd', { list: 'OBJ.id' }),
      F('obj_name', 'Объект', 'f', { guard: 'obj_id', w: 150, f: OBJ_NAME_F_('obj_id') }),
      F('owner', 'Ответственный', 'dd', { dict: 'people' }),
      F('type', 'Тип действия', 'dd', { dict: 'action_types', client: true }),
      F('channel', 'Канал', 'dd', { dict: 'channels', client: true }),
      F('goal', 'Цель действия', 'text', { w: 180 }),
      F('plan', 'План', 'text', { w: 160 }),
      F('fact', 'Факт', 'text', { w: 220, client: true, d: 'Что сделано — пишется так, чтобы можно было показать клиенту.' }),
      F('status', 'Статус', 'dd', { dict: 'task_status', track: true, d: 'По умолчанию «Выполнено». «Запланировано» с прошедшей датой = просрочка.' }),
      cnt('contacts', 'Количество контактов'),
      cnt('responses', 'Количество ответов'),
      cnt('interested', 'Количество заинтересованных', { d: 'Сколько человек проявили интерес = ЛИДЫ. Из этого столбца считаются лиды, конверсии и стоимость лида.' }),
      cnt('presentations', 'Количество презентаций'),
      cnt('showings', 'Количество показов'),
      cnt('repeat_contacts', 'Количество повторных контактов'),
      cnt('offers', 'Количество предложений'),
      cnt('negotiations', 'Количество переговоров'),
      cnt('bookings', 'Количество броней'),
      cnt('deals', 'Количество сделок'),
      F('result', 'Результат', 'text', { w: 180 }),
      F('refusal', 'Причина отказа', 'dd', { dict: 'refusal_reasons', client: true }),
      F('feedback', 'Полученная обратная связь', 'text', { w: 220, client: true, d: 'Попадает в раздел «Что показал рынок».' }),
      F('conclusion', 'Вывод', 'text', { w: 200, client: true, d: 'Попадает в раздел «Выводы».' }),
      F('next_step', 'Следующий шаг', 'text', { w: 180, client: true }),
      F('next_step_date', 'Дата следующего шага', 'date'),
      F('comment', 'Комментарий', 'text', { w: 180, internal: true, d: 'Внутренний. В отчёт клиенту не попадает.' }),
      F('views', 'Просмотры (охват)', 'num', { fmt: '#,##0', d: 'Просмотры объявления / охват публикации.' }),
      F('cost', 'Расходы, ₽', 'money', { internal: true, d: 'Для расчёта стоимости лида (расходы / заинтересованные).' }),
      F('to_report', 'В отчёт клиенту', 'cb', { d: 'Снимите галочку, если действие внутреннее и не должно попасть в отчёт.' }),
      F('month', 'Месяц', 'f', { helper: true, f: MONTH_OF_('[[@date]]') }),
      F('status_class', 'Класс статуса', 'f', { helper: true, guard: 'status', f: 'IFERROR(VLOOKUP([[@status]],[[D.task_status:tbl]],2,FALSE),"")' }),
      F('channel_group', 'Группа канала', 'f', { helper: true, guard: 'channel', f: 'IFERROR(VLOOKUP([[@channel]],[[D.channels:tbl]],2,FALSE),"")' }),
      F('is_listing', 'Площадка объявлений', 'f', { helper: true, guard: 'channel', f: 'IFERROR(VLOOKUP([[@channel]],[[D.channels:tbl]],3,FALSE),"НЕТ")' }),
      F('window', 'Окно сравнения', 'f', {
        helper: true,
        f: 'IF(TODAY()-[[@date]]<=[[CFG.RECENT_DAYS]],"R",IF(TODAY()-[[@date]]<=[[CFG.RECENT_DAYS]]+[[CFG.COMPARE_DAYS]],"P",""))',
      }),
      F('created_at', 'Создано', 'sys', { fmt: 'datetime', helper: true }),
      F('author', 'Автор', 'sys', { helper: true }),
    ],
  };

  // ─────────────────────────────── 06_ПЛАН_ФАКТ ───────────────────────────────
  S.PF = {
    code: 'PF', guard: 'obj_id', frozenCols: 3, idField: 'task_id', idPrefix: 'TASK-', idPad: 4,
    about: 'План недели и его выполнение. Одна строка = одна задача или один KPI недели по объекту.',
    fields: [
      F('week', 'Неделя', 'dd', { list: 'D.weeks', d: 'Ключ недели, например 2026-W40.' }),
      F('obj_id', 'ID объекта', 'dd', { list: 'OBJ.id' }),
      F('obj_name', 'Объект', 'f', { w: 150, f: OBJ_NAME_F_('obj_id') }),
      F('week_goal', 'Цель недели', 'text', { w: 180, client: true }),
      F('task', 'Задача', 'text', { w: 200, client: true, d: 'Задачи следующей недели попадают в отчёт клиенту как «Что планируем».' }),
      F('type', 'Тип действия', 'dd', { dict: 'action_types', d: 'Если указан — факт KPI считается только по действиям этого типа.' }),
      F('owner', 'Ответственный', 'dd', { dict: 'people' }),
      F('plan', 'План', 'text', { w: 160, track: true }),
      F('fact', 'Факт', 'text', { w: 160 }),
      F('result', 'Результат', 'text', { w: 160 }),
      F('kpi_metric', 'KPI', 'dd', { dict: 'kpi_metrics', client: true, d: 'Какой показатель планируем (контакты, лиды = заинтересованные, показы…).' }),
      F('kpi_plan', 'KPI план', 'num', { fmt: '0', track: true, client: true }),
      F('kpi_fact', 'Фактический KPI', 'f', { guard: 'kpi_metric', fmt: '0', f: '__KPI_FACT__', d: 'Считается автоматически из 03_ДЕЙСТВИЯ / 04_ЛИДЫ по объекту и неделе.' }),
      F('kpi_pct', '% выполнения KPI', 'f', { guard: 'kpi_plan', fmt: 'pct', f: 'IFERROR([[@kpi_fact]]/[[@kpi_plan]],"")' }),
      F('status', 'Статус', 'dd', { dict: 'task_status', track: true, d: '«Перенесено» автоматически создаёт копию задачи на следующую неделю; старая строка остаётся в истории.' }),
      F('fail_reason', 'Причина невыполнения', 'text', { w: 160, internal: true }),
      F('conclusion', 'Вывод', 'text', { w: 180, client: true }),
      F('next_step', 'Следующий шаг', 'text', { w: 160 }),
      F('deadline', 'Дедлайн', 'date', { track: true }),
      F('to_report', 'В отчёт клиенту', 'cb'),
      F('overdue', 'Просрочка', 'f', { f: 'IF(([[@status_class]]="OPEN")*([[@deadline]]<>"")*([[@deadline]]<TODAY()),"ПРОСРОЧЕНО","")' }),
      F('task_id', 'ID задачи', 'id'),
      F('moved_from', 'Перенесено из', 'sys'),
      F('status_class', 'Класс статуса', 'f', { helper: true, f: 'IF([[@status]]="","OPEN",IFERROR(VLOOKUP([[@status]],[[D.task_status:tbl]],2,FALSE),"OPEN"))' }),
      F('created_at', 'Создано', 'sys', { fmt: 'datetime', helper: true }),
    ],
  };

  // ─────────────────────────────── 14_ГИПОТЕЗЫ ───────────────────────────────
  S.HYP = {
    code: 'HYP', guard: 'obj_id', frozenCols: 3, idField: 'id', idPrefix: 'HYP-', idPad: 3,
    about: 'Журнал маркетинговых гипотез: что проверяем → в каком канале → какую цифру ждём → что получилось → вывод. Факт считается сам из 03_ДЕЙСТВИЯ.',
    fields: [
      F('id', 'ID гипотезы', 'id'),
      F('obj_id', 'ID объекта', 'dd', { list: 'OBJ.id' }),
      F('obj_name', 'Объект', 'f', { w: 150, f: OBJ_NAME_F_('obj_id') }),
      F('hypothesis', 'Гипотеза', 'text', { w: 260, client: true, d: 'Формула: «Если сделать …, то получим …». Пишется так, чтобы можно было показать клиенту.' }),
      F('channel', 'Канал', 'dd', { dict: 'channels', client: true, d: 'Пусто = все каналы объекта.' }),
      F('metric', 'Метрика', 'dd', { dict: 'kpi_metrics', client: true, d: 'Что меряем: контакты, лиды, показы…' }),
      F('target', 'Цель', 'num', { fmt: '0', client: true }),
      F('date_start', 'Начало проверки', 'date', { d: 'Если не указать — сегодня.' }),
      F('date_end', 'Срок проверки', 'date', { d: 'Пусто = проверка идёт до сегодняшнего дня.' }),
      F('fact', 'Факт', 'f', { guard: 'metric', fmt: '0', f: '__HYP_FACT__', d: 'Сумма метрики из 03_ДЕЙСТВИЯ по объекту (и каналу) за период проверки.' }),
      F('fact_pct', '% от цели', 'f', { guard: 'target', fmt: 'pct', f: 'IFERROR([[@fact]]/[[@target]],"")' }),
      F('status', 'Статус', 'dd', { dict: 'hyp_status', track: true, d: 'Итог ставит руководитель: подтвердилась / не подтвердилась.' }),
      F('conclusion', 'Вывод', 'text', { w: 220, client: true, d: 'Что узнали о рынке. Попадает в отчёт клиенту.' }),
      F('decision', 'Решение', 'text', { w: 220, internal: true, d: 'Что меняем в стратегии. Внутреннее.' }),
      F('to_report', 'В отчёт клиенту', 'cb'),
      F('due', 'Пора подвести итог', 'f', { f: 'IF(([[@status_class]]="OPEN")*([[@date_end]]<>"")*([[@date_end]]<TODAY()),"ДА","")' }),
      F('status_class', 'Класс статуса', 'f', { helper: true, f: 'IF([[@status]]="","OPEN",IFERROR(VLOOKUP([[@status]],[[D.hyp_status:tbl]],2,FALSE),"OPEN"))' }),
      F('created_at', 'Создано', 'sys', { fmt: 'datetime', helper: true }),
    ],
  };

  // ─────────────────────────────── 12_ИСТОРИЯ ───────────────────────────────
  S.HIST = {
    code: 'HIST', guard: 'ts', frozenCols: 1, readonly: true,
    about: 'Журнал изменений: цена, статусы, стратегия, переносы задач. Заполняет только скрипт, ничего не удаляется.',
    fields: [
      F('ts', 'Дата и время', 'sys', { fmt: 'datetime', w: 130 }),
      F('user', 'Пользователь', 'sys', { w: 160 }),
      F('sheet', 'Лист', 'sys', { w: 130 }),
      F('record_id', 'ID записи', 'sys'),
      F('obj_id', 'ID объекта', 'sys'),
      F('field', 'Поле', 'sys', { w: 170 }),
      F('old', 'Было', 'sys', { w: 200 }),
      F('new', 'Стало', 'sys', { w: 200 }),
      F('kind', 'Тип изменения', 'sys', { w: 130 }),
      F('note', 'Комментарий', 'sys', { w: 200 }),
    ],
  };

  // ─────────────────────────────── 13_АРХИВ_ОТЧЕТОВ ───────────────────────────────
  S.ARCH = {
    code: 'ARCH', guard: 'ts', frozenCols: 1, readonly: true,
    about: 'Реестр всех сформированных отчётов клиентам. Заполняет скрипт при создании отчёта.',
    fields: [
      F('ts', 'Дата создания', 'sys', { fmt: 'datetime', w: 130 }),
      F('obj_id', 'ID объекта', 'sys'),
      F('obj_name', 'Объект', 'sys', { w: 150 }),
      F('week', 'Неделя', 'sys'),
      F('period', 'Период', 'sys', { w: 130 }),
      F('doc_link', 'Google Doc', 'sys', { w: 130 }),
      F('pdf_link', 'PDF', 'sys', { w: 130 }),
      F('author', 'Создал', 'sys', { w: 160 }),
      F('status', 'Статус', 'sys'),
      F('manager_comment', 'Комментарий руководителя', 'sys', { w: 220 }),
    ],
  };

  Object.keys(S).forEach(code => { S[code].name = SHEET_NAMES[code]; });
  sheetSpecs_.cache = S;
  return S;
}

function sheetName_(code) { return SHEET_NAMES[code]; }

function fieldOf_(code, key) {
  const spec = sheetSpecs_()[code];
  const f = spec.fields.find(x => x.key === key);
  if (!f) throw new Error('Нет поля ' + code + '.' + key);
  return f;
}

function fieldIndex_(code, key) {
  const spec = sheetSpecs_()[code];
  const i = spec.fields.findIndex(x => x.key === key);
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

// ═════════════ 03_Setup.gs ═════════════
/**
 * 03_Setup — установка и обновление системы.
 *
 * «Установить / обновить систему» можно запускать повторно:
 *  - данные в журналах (01–04, 06, 12, 13) и значения настроек/справочников сохраняются;
 *  - заголовки, формулы, списки, форматирование и защита пересоздаются по схеме;
 *  - расчётные листы (05, 07, 09, 11) пересобираются, выбранные фильтры сохраняются.
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
    'Будут созданы или обновлены все листы, формулы, выпадающие списки, папки Google Drive, шаблоны документов и триггеры.\n\n' +
    'Данные в журналах не удаляются. Продолжить?',
    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  const log = [];
  runSetup_(log);
  let driveMsg = '';
  try {
    ensureDrive_();
    log.push('Google Drive: папки и шаблоны готовы');
  } catch (err) {
    driveMsg = '\n\n⚠ Drive: ' + err.message + '\nПапки можно создать позже повторным запуском установки.';
  }
  try {
    installTriggers_();
    log.push('Триггер onEdit установлен');
  } catch (err) {
    driveMsg += '\n\n⚠ Триггер: ' + err.message;
  }
  ui.alert('Готово', log.join('\n') + driveMsg + '\n\nДальше: «Загрузить тестовые данные» → «Самопроверка», либо сразу добавляйте реальные объекты в 01_ОБЪЕКТЫ.', ui.ButtonSet.OK);
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
  buildSettings_(); log.push('10_НАСТРОЙКИ');
  buildDict_(); log.push('08_СПРАВОЧНИКИ');
  ['OBJ', 'STR', 'ACT', 'PF', 'HIST', 'ARCH', 'HYP'].forEach(code => { buildDataSheet_(code); log.push(SHEET_NAMES[code]); });
  buildPfBlock_();
  SpreadsheetApp.flush();
  buildFunnel_(); log.push(SHEET_NAMES.FUN);
  buildStats_(); log.push(SHEET_NAMES.STAT);
  buildReportSheet_(); log.push(SHEET_NAMES.REP);
  buildCtrl_(); log.push(SHEET_NAMES.CTRL);
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

function orderSheets_() {
  const ss = ss_();
  SHEET_ORDER.forEach((code, i) => {
    const sh = ss.getSheetByName(SHEET_NAMES[code]);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  ss.setActiveSheet(ss.getSheetByName(SHEET_NAMES.DASH));
}

function removeDefaultSheet_() {
  const ss = ss_();
  const ours = Object.keys(SHEET_NAMES).map(k => SHEET_NAMES[k]);
  ss.getSheets().forEach(sh => {
    if (ours.indexOf(sh.getName()) < 0 && sh.getLastRow() === 0 && sh.getLastColumn() === 0 && ss.getSheets().length > 1) {
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

// ───────────────────────── 10_НАСТРОЙКИ ─────────────────────────

function buildSettings_() {
  const sh = sheet_('CFG');
  const existing = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(1, 1, sh.getLastRow(), 3).getValues().forEach(r => { if (r[0]) existing[r[0]] = r[2]; });
  }
  const kpiExisting = [];
  if (sh.getLastRow() > 1 && sh.getMaxColumns() >= 7) {
    sh.getRange(2, 6, 20, 2).getValues().forEach(r => { if (r[0] !== '') kpiExisting.push(r); });
  }
  removeSysProtections_(sh);
  sh.clear();
  sh.clearConditionalFormatRules();
  ensureSize_(sh, 60, 8);
  sh.getRange('A:H').clearDataValidations();

  const defs = cfgDefs_();
  const rows = [['Ключ', 'Параметр', 'Значение', 'Описание']];
  defs.forEach(d => {
    if (d.group) { rows.push(['', d.group, '', '']); return; }
    let v = (d.key in existing && existing[d.key] !== '' && !(d.key === 'SYSTEM_VERSION')) ? existing[d.key] : d.value;
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
      else cell.setBackground(COLORS.SELECT_BG);
    }
    r++;
  });
  sh.getRange(1, 1, r, 1).setFontColor(COLORS.GREY_FG).setFontSize(9);
  sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 420); sh.setColumnWidth(3, 200); sh.setColumnWidth(4, 140);

  // KPI по умолчанию для «Создать план недели»
  sh.getRange('F1:G1').setValues([['KPI по умолчанию', 'План на объект в неделю']]);
  styleHeaderRow_(sh.getRange('F1:G1'), 'input');
  const kpi = kpiExisting.length ? kpiExisting : DEFAULT_WEEK_KPI;
  sh.getRange(2, 6, kpi.length, 2).setValues(kpi);
  sh.getRange('F2:F21').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(rangeFromToken_('D.kpi_metrics'), true).setAllowInvalid(false).build());
  sh.getRange('F2:G21').setBackground(COLORS.SELECT_BG);
  ss_().setNamedRange('CFG_DEFAULT_KPI', sh.getRange('F2:G21'));
  sh.setColumnWidth(6, 170); sh.setColumnWidth(7, 170);
  sh.setFrozenRows(1);
  sh.hideColumns(1);
}

// ───────────────────────── 08_СПРАВОЧНИКИ ─────────────────────────

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
  const extraCols = code === 'PF' ? 5 : 0;
  ensureSize_(sh, SYS.DATA_ROWS, n + extraCols);
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
  if (f.track) flags.push('изменения пишутся в 12_ИСТОРИЯ');
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
  const red = [COLORS.RED_BG, COLORS.RED_FG], yel = [COLORS.YELLOW_BG, COLORS.YELLOW_FG], grn = [COLORS.GREEN_BG, COLORS.GREEN_FG];
  const add = (f, rng, c) => R.push(cfRule_(f, rng, c[0], c[1]));
  if (code === 'OBJ') {
    add('=$' + col('id_check') + '2<>""', colRange('id'), red);
    add('=$' + col('risk_flag') + '2="RISK"', row, red);
    add('=$' + col('risk_flag') + '2="ВНИМАНИЕ"', row, yel);
    add('=($' + col('status_class') + '2="SOLD")+($' + col('status_class') + '2="DEAL")', colRange('status'), grn);
    add('=($' + col('status_class') + '2="PAUSED")+($' + col('status_class') + '2="REMOVED")', row, [null, COLORS.GREY_FG]);
    add('=$' + col('temperature') + '2="HOT"', colRange('temperature'), grn);
    add('=$' + col('temperature') + '2="WARM"', colRange('temperature'), yel);
    add('=$' + col('temperature') + '2="RISK"', colRange('temperature'), red);
    add('=($' + col('next_action_deadline') + '2<>"")*($' + col('next_action_deadline') + '2<TODAY())', colRange('next_action_deadline'), red);
    add('=($' + col('next_report') + '2<>"")*($' + col('next_report') + '2<=TODAY())*($' + col('in_work') + '2="ДА")', colRange('next_report'), yel);
    add('=($' + col('date_end') + '2<>"")*($' + col('date_end') + '2-TODAY()<=INDIRECT("CFG_EXCL_END_WARN_DAYS"))', colRange('date_end'), red);
  }
  if (code === 'STR') {
    add('=$' + col('need_change') + '2=TRUE', colRange('need_change'), red);
    add('=($' + col('obj_id') + '2<>"")*($' + col('review_date') + '2="")', colRange('review_date'), yel);
    add('=($' + col('days_since_review') + '2<>"")*($' + col('days_since_review') + '2>INDIRECT("CFG_STRATEGY_REVIEW_DAYS"))', colRange('days_since_review'), yel);
    add('=$' + col('strategy_status') + '2="Утверждена"', colRange('strategy_status'), grn);
  }
  if (code === 'ACT') {
    add('=($' + col('status_class') + '2="OPEN")*($' + col('date') + '2<>"")*($' + col('date') + '2<TODAY())', row, red);
    add('=$' + col('status_class') + '2="DONE"', colRange('status'), grn);
    add('=($' + col('id') + '2<>"")*($' + col('to_report') + '2=FALSE)', colRange('to_report'), [null, COLORS.GREY_FG]);
  }
  if (code === 'HYP') {
    add('=$' + col('due') + '2="ДА"', row, yel);
    add('=$' + col('status_class') + '2="DONE"', colRange('status'), grn);
    add('=$' + col('status_class') + '2="FAIL"', colRange('status'), red);
    add('=($' + col('fact_pct') + '2<>"")*($' + col('fact_pct') + '2>=1)', colRange('fact_pct'), grn);
  }
  if (code === 'PF') {
    add('=$' + col('overdue') + '2="ПРОСРОЧЕНО"', row, red);
    add('=$' + col('status_class') + '2="DONE"', colRange('status'), grn);
    add('=$' + col('status_class') + '2="FAIL"', colRange('status'), red);
    add('=$' + col('status_class') + '2="MOVED"', row, [null, COLORS.GREY_FG]);
    add('=($' + col('kpi_pct') + '2<>"")*($' + col('kpi_pct') + '2>=1)', colRange('kpi_pct'), grn);
    add('=($' + col('kpi_pct') + '2<>"")*($' + col('kpi_pct') + '2<1)', colRange('kpi_pct'), yel);
    add('=($' + col('obj_id') + '2<>"")*($' + col('owner') + '2="")', colRange('owner'), yel);
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

/** 04_ВОРОНКА — расчётный лист (воронка, конверсии, каналы, причины отказов) из 03_ДЕЙСТВИЯ. */
function buildFunnel_() {
  const sh = sheet_('FUN');
  const L = funnelLayout_();
  const keep = [safeGet_(sh, L.selObj), safeGet_(sh, L.selWeek)];
  resetSheet_(sh);
  ensureSize_(sh, 300, FUN_CH_COL + 14);
  applyCells_(sh, L.cells);
  L.formats.forEach(f => sh.getRange(f.range).setNumberFormat(nf_(f.fmt)));
  restoreSel_(sh, L.selObj, keep[0]);
  restoreSel_(sh, L.selWeek, keep[1]);
  sh.setColumnWidth(1, 290); sh.setColumnWidth(2, 130); sh.setColumnWidth(3, 110); sh.setColumnWidth(4, 24);
  sh.setColumnWidth(FUN_CH_COL, 190);
  for (let c = FUN_CH_COL + 1; c < FUN_CH_COL + 14; c++) sh.setColumnWidth(c, 100);
  sh.setRowHeight(7, 40);
  protectWarn_(sh.getRange(4, 1, sh.getMaxRows() - 3, sh.getMaxColumns()), 'Воронка считается автоматически');
}

/** Блок «План-факт недели» справа от журнала задач. */
function buildPfBlock_() {
  const sh = sheet_('PF');
  const L = pfBlockLayout_();
  const keepW = safeGet_(sh, L.selWeek), keepO = safeGet_(sh, L.selObj);
  const rng = sh.getRange(1, L.startCol, 40, 4);
  rng.clear(); rng.clearDataValidations();
  applyCells_(sh, L.cells);
  restoreSel_(sh, L.selWeek, keepW);
  restoreSel_(sh, L.selObj, keepO);
  sh.setColumnWidth(L.startCol - 1, 24);
  sh.setColumnWidth(L.startCol, 230);
  for (let i = 1; i < 4; i++) sh.setColumnWidth(L.startCol + i, 110);
  const pctCell = sh.getRange(L.at.pct);
  const rules = sh.getConditionalFormatRules();
  rules.push(cfRule_('=(' + L.at.pct + '<>"")*(' + L.at.pct + '>=1)', pctCell, COLORS.GREEN_BG, COLORS.GREEN_FG));
  rules.push(cfRule_('=(' + L.at.pct + '<>"")*(' + L.at.pct + '<1)', pctCell, COLORS.YELLOW_BG, COLORS.YELLOW_FG));
  sh.setConditionalFormatRules(rules);
  protectWarn_(sh.getRange(4, L.startCol, 37, 4), 'Расчёт план-факта');
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

// ───────────────────────── 05_СТАТИСТИКА ─────────────────────────

function buildStats_() {
  const sh = sheet_('STAT');
  const keep = safeGet_(sh, 'B2');
  resetSheet_(sh);
  ensureSize_(sh, SYS.STAT_ROWS, 50);
  const L = statsLayout_(sh.getSheetId());
  applyCells_(sh, L.cells);
  L.formats.forEach(f => sh.getRange(f.range).setNumberFormat(nf_(f.fmt)));
  restoreSel_(sh, 'B2', keep);
  Object.keys(STAT_SECTIONS).forEach(k => sh.setRowHeight(STAT_SECTIONS[k].header, 44));
  sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 170);
  for (let c = 3; c <= 50; c++) sh.setColumnWidth(c, 96);
  sh.setFrozenColumns(2);
  protectWarn_(sh.getRange(3, 1, sh.getMaxRows() - 2, sh.getMaxColumns()), 'Статистика считается автоматически');
}

// ───────────────────────── 07_ОТЧЕТ ─────────────────────────

function buildReportSheet_() {
  const sh = sheet_('REP');
  const keep = ['B3', 'B4', 'B5'].map(a => safeGet_(sh, a));
  resetSheet_(sh);
  ensureSize_(sh, 60, 6);
  const L = reportLayout_();
  applyCells_(sh, L.cells);
  ['B3', 'B4', 'B5'].forEach((a, i) => restoreSel_(sh, a, keep[i]));
  if (!keep[1]) {
    // по умолчанию — текущая неделя
    SpreadsheetApp.flush();
    const label = weekLabelByKey_(isoWeekKey_(new Date()));
    if (label) sh.getRange('B4').setValue(label);
  }
  sh.setColumnWidth(1, 250); sh.setColumnWidth(2, 620); sh.setColumnWidth(3, 170); sh.setColumnWidth(4, 130); sh.setColumnWidth(5, 110);
  sh.getRange('B5').setWrap(true);
  sh.setFrozenRows(0);
  protectWarn_(sh.getRange(REP_FIRST_ROW, 1, L.lastRow - REP_FIRST_ROW + 1, 5), 'Отчёт собирается автоматически');
  protectWarn_(sh.getRange('D2:E8'), 'Служебные параметры отчёта');
}

// ───────────────────────── 11_КОНТРОЛЬ ─────────────────────────

function buildCtrl_() {
  const sh = sheet_('CTRL');
  resetSheet_(sh);
  ensureSize_(sh, SYS.DATA_ROWS, CTRL_MON_START + ctrlMonitorCols_().length + 1);
  const L = ctrlLayout_();
  applyCells_(sh, L.cells);
  sh.setFrozenRows(2);
  const widths = [110, 190, 90, 150, 380, 130, 95, 130];
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setColumnWidth(9, 24); sh.setColumnWidth(10, 24);
  for (let c = CTRL_MON_START; c < CTRL_MON_START + ctrlMonitorCols_().length; c++) sh.setColumnWidth(c, 105);
  sh.setRowHeight(2, 44);
  const body = sh.getRange(CTRL_FIRST, 1, sh.getMaxRows() - CTRL_FIRST + 1, 8);
  sh.setConditionalFormatRules([
    cfRule_('=LEFT($A' + CTRL_FIRST + ')="1"', body, COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=LEFT($A' + CTRL_FIRST + ')="2"', body, COLORS.YELLOW_BG, COLORS.YELLOW_FG),
  ]);
  protectWarn_(sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()), 'Контроль считается автоматически');
}

// ───────────────────────── 09_ДЭШБОРД ─────────────────────────

function buildDash_() {
  const sh = sheet_('DASH');
  const keep = safeGet_(sh, 'C2');
  resetSheet_(sh);
  ensureSize_(sh, 300, DASH_CHART_COL + 8);
  const L = dashLayout_();
  applyCells_(sh, L.cells);
  restoreSel_(sh, 'C2', keep);
  sh.setColumnWidth(1, 200); sh.setColumnWidth(2, 170);
  for (let c = 3; c <= 17; c++) sh.setColumnWidth(c, 105);
  sh.setColumnWidth(13, 230); sh.setColumnWidth(14, 230);
  sh.setRowHeight(5, 36); sh.setRowHeight(6, 34);
  sh.setFrozenRows(2);
  sh.hideColumns(25, 2); // Y:Z — параметры
  sh.hideColumns(DASH_CHART_COL, 6); // данные графика

  const oc = L.objCol;
  const first = DASH_OBJ_FIRST;
  const max = sh.getMaxRows();
  const colR = L => sh.getRange(L + first + ':' + L + max);
  const idle = oc['Дней без активности'], dl = oc['Дедлайн'], tmp = oc['Темп.'];
  const row = sh.getRange('A' + first + ':Q' + max);
  const rules = [
    cfRule_('=($' + idle + first + '<>"")*($' + idle + first + '>$Z$3)', row, COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=($' + idle + first + '<>"")*($' + idle + first + '>$Z$4)', row, COLORS.YELLOW_BG, COLORS.YELLOW_FG),
    cfRule_('=($' + dl + first + '<>"")*($' + dl + first + '<TODAY())', colR(dl), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=$' + tmp + first + '="HOT"', colR(tmp), COLORS.GREEN_BG, COLORS.GREEN_FG),
    cfRule_('=$' + tmp + first + '="RISK"', colR(tmp), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=B6>0', sh.getRange('B6:C6'), COLORS.RED_BG, COLORS.RED_FG),
    cfRule_('=H6>0', sh.getRange('H6'), COLORS.YELLOW_BG, COLORS.YELLOW_FG),
    cfRule_('=B12>0', sh.getRange('B12:I12'), null, COLORS.GREEN_FG),
    cfRule_('=B12<0', sh.getRange('B12:I12'), null, COLORS.RED_FG),
  ];
  sh.setConditionalFormatRules(rules);

  const chart = sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(L.chartRange))
    .setNumHeaders(1)
    .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH)
    .setPosition(4, 11, 0, 0)
    .setOption('title', 'Динамика за 12 недель')
    .setOption('legend', { position: 'bottom' })
    .setOption('colors', ['#90A4AE', '#546E7A', '#26A69A', '#1565C0'])
    .setOption('width', 620).setOption('height', 300)
    .build();
  sh.insertChart(chart);
  protectWarn_(sh.getRange(3, 1, max - 2, sh.getMaxColumns()), 'Дэшборд считается автоматически');
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
  ensureStrategyTemplate_();
  const email = String(cfgGet_('ASSISTANT_EMAIL') || '').trim();
  if (email) {
    try { root.addEditor(email); ss.addEditor(email); } catch (e) { /* email может быть недоступен для шаринга */ }
  }
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

// ═════════════ 04_Triggers.gs ═════════════
/**
 * 04_Triggers — автоматика при редактировании (устанавливаемый триггер onEdit).
 *
 * Что делает при вводе данных:
 *  - ставит ID действиям и задачам (ACT-0001, TASK-0001), дату, статус по умолчанию, автора;
 *  - ID объекта вводится вручную (из CRM): скрипт проверяет его и при исправлении обновляет во всех листах;
 *  - пишет изменения цены, статусов, стратегии, дедлайнов в 12_ИСТОРИЯ (старое значение не теряется);
 *  - задача со статусом «Перенесено» копируется на следующую неделю, исходная остаётся в истории;
 *  - при создании объекта добавляет ему строку в 02_СТРАТЕГИЯ.
 */

function onEditHandler(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
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
  const newObjects = [];
  const renamed = [];
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
    if (code === 'OBJ' && isNew) newObjects.push(o.id);
    if (code === 'PF' && !isNew && editedKeys.indexOf('status') >= 0 && dictClassOf_('task_status', o.status) === CLS.MOVED) {
      const newId = moveTask_(o, hist);
      if (newId) toast_('Задача ' + o.task_id + ' перенесена на следующую неделю как ' + newId + '. Исходная строка сохранена.');
    }
  }
  renamed.forEach(p => {
    renameObjectId_(p[0], p[1]);
    hist.push({ sheet: spec.name, record_id: p[1], obj_id: p[1], field: fieldTitle_('OBJ', 'id'), old: p[0], new: p[1], kind: HIST_KIND.CHANGE, note: 'ID обновлён во всех листах' });
    toast_('ID ' + p[0] + ' → ' + p[1] + ' обновлён во всех связанных листах.');
  });
  if (newObjects.length) ensureStrategyRows_(newObjects);
  logHistory_(hist, user);
}

function applyDefaults_(code, o, upd, isNew, user, editedKeys) {
  const now = new Date();
  const today = today_();
  const set = (k, v) => { upd[k] = v; o[k] = v; };
  if (code === 'OBJ' && isNew) {
    set('created_at', today);
    if (!o.status) set('status', dictValues_('obj_status')[0] || '');
  }
  if (code === 'OBJ' && editedKeys.indexOf('status') >= 0 && o.status) {
    // «Дата закрытия»: ставится при продаже / снятии, снимается, если объект вернули в работу
    const cls = dictClassOf_('obj_status', o.status);
    const closed = cls === 'SOLD' || cls === 'REMOVED';
    if (closed && !o.close_date) set('close_date', today);
    if (!closed && o.close_date) set('close_date', '');
  }
  if (code === 'STR') {
    const content = editedKeys.some(k => ['obj_id', 'obj_name', 'changed_at', 'changed_by', 'strategy_doc'].indexOf(k) < 0);
    if (content) { set('changed_at', now); set('changed_by', user); }
    if (!o.strategy_status) set('strategy_status', dictValues_('strategy_status')[0] || '');
  }
  if (code === 'ACT' && isNew) {
    if (!o.date) set('date', today);
    if (!o.status) set('status', dictFirstByClass_('task_status', CLS.DONE));
    if (!o.owner) { const p = personByEmail_(user); if (p) set('owner', p); }
    set('to_report', true);
    set('created_at', now);
    set('author', user);
  }
  if (code === 'HYP' && isNew) {
    if (!o.date_start) set('date_start', today);
    if (!o.status) set('status', dictFirstByClass_('hyp_status', CLS.OPEN));
    set('to_report', true);
    set('created_at', now);
  }
  if (code === 'PF' && isNew) {
    if (!o.week) set('week', isoWeekKey_(today));
    if (!o.status) set('status', dictFirstByClass_('task_status', CLS.OPEN));
    if (!o.deadline) { const m = mondayOfWeekKey_(o.week); if (m) set('deadline', addDays_(m, 4)); }
    set('to_report', true);
    set('created_at', now);
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

/** Исправили ID объекта в 01 → заменить старый ID в связанных листах и в именах папок Drive. */
function renameObjectId_(oldId, newId) {
  ['STR', 'ACT', 'PF', 'ARCH', 'HYP'].forEach(code => {
    const sh = sheet_(code);
    const col = fieldIndex_(code, 'obj_id');
    sh.getRange(2, col, sh.getMaxRows() - 1, 1).createTextFinder(oldId).matchEntireCell(true).replaceAllWith(newId);
  });
  ['FOLDER_OBJECTS_ID'].forEach(k => {
    try {
      const parent = folderById_(cfgGet_(k));
      if (!parent) return;
      const it = parent.getFolders();
      const suffix = '(' + oldId + ')';
      while (it.hasNext()) {
        const f = it.next();
        if (f.getName().slice(-suffix.length) === suffix) f.setName(f.getName().slice(0, -suffix.length) + '(' + newId + ')');
      }
    } catch (err) { /* папки переименуются вручную */ }
  });
}

/** Строка в 02_СТРАТЕГИЯ для каждого нового объекта (если её ещё нет). */
function ensureStrategyRows_(ids) {
  const t = readTable_('STR');
  const have = {};
  t.rows.forEach(r => { have[r.obj_id] = true; });
  const toAdd = ids.filter(id => !have[id]).map(id => ({ obj_id: id, strategy_status: dictValues_('strategy_status')[0] || '' }));
  if (toAdd.length) appendRows_('STR', toAdd);
}

/** Копия задачи на следующую неделю. Исходная строка остаётся со статусом «Перенесено». */
function moveTask_(o, hist, targetWeek) {
  const pf = readTable_('PF');
  if (pf.rows.some(r => r.moved_from === o.task_id)) return null;
  const baseMon = mondayOfWeekKey_(o.week) || mondayOf_(today_());
  const nextKey = targetWeek || isoWeekKey_(addDays_(baseMon, 7));
  const nextMon = mondayOfWeekKey_(nextKey);
  const deadline = o.deadline instanceof Date ? addDays_(o.deadline, 7) : addDays_(nextMon, 4);
  const newId = nextId_('PF');
  appendRow_('PF', {
    week: nextKey, obj_id: o.obj_id, week_goal: o.week_goal, task: o.task, type: o.type, owner: o.owner,
    plan: o.plan, kpi_metric: o.kpi_metric, kpi_plan: o.kpi_plan,
    status: dictFirstByClass_('task_status', CLS.OPEN), deadline: deadline,
    to_report: o.to_report === '' ? true : o.to_report, task_id: newId, moved_from: o.task_id, created_at: new Date(),
  });
  hist.push({
    sheet: SHEET_NAMES.PF, record_id: o.task_id, obj_id: o.obj_id, field: fieldTitle_('PF', 'week'),
    old: o.week, new: nextKey, kind: HIST_KIND.MOVE, note: 'Создана копия ' + newId + ' (дедлайн ' + fmtDate_(deadline) + ')',
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

// ═════════════ 05_Reports.gs ═════════════
/**
 * 05_Reports — еженедельный отчёт клиенту: Google Doc + PDF + архив.
 *
 * Источник текста — лист 07_ОТЧЕТ (предпросмотр). Скрипт берёт оттуда только строки
 * с placeholder'ами, поэтому внутренние поля физически не могут попасть в документ.
 */

function createReport() {
  const ui = SpreadsheetApp.getUi();
  SpreadsheetApp.flush();
  const rep = sheet_('REP');
  const id = String(rep.getRange('E3').getValue() || '');
  const wk = String(rep.getRange('E4').getValue() || '');
  if (!id || !wk) {
    rep.activate();
    ui.alert('Выберите объект и неделю в листе 07_ОТЧЕТ (ячейки B3 и B4), затем повторите.');
    return;
  }
  const res = generateReport_(id, wk, { interactive: true });
  if (!res) return;
  showLinks_('Отчёт готов', [
    { label: 'Google Doc: ' + res.name, url: res.docUrl },
    { label: 'PDF для клиента', url: res.pdfUrl },
    { label: 'Папка отчётов объекта', url: res.folderUrl },
  ], 'Проверьте документ. Если поправите текст в Google Doc — нажмите «Создать PDF», чтобы обновить PDF.');
}

/** Собирает отчёт для объекта/недели. Лист 07_ОТЧЕТ должен быть выставлен на этот объект и неделю. */
function generateReport_(id, wk, opts) {
  opts = opts || {};
  const obj = objectById_(id);
  if (!obj) throw new Error('Объект ' + id + ' не найден в 01_ОБЪЕКТЫ');
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
  const period = values.PERIOD || weekPeriodLabel_(wk);
  const name = obj.name + ' — Отчёт — ' + period;
  const copy = tpl.makeCopy(name, folder);
  const doc = DocumentApp.openById(copy.getId());
  fillDoc_(doc, values, reportListKeys_());
  doc.saveAndClose();
  const pdf = folder.createFile(copy.getAs(MimeType.PDF)).setName(name + '.pdf');

  appendRow_('ARCH', {
    ts: new Date(), obj_id: id, obj_name: obj.name, week: wk, period: period,
    doc_link: copy.getUrl(), pdf_link: pdf.getUrl(), author: userEmail_(), status: REPORT_STATUS.ACTUAL,
    manager_comment: values.MANAGER_COMMENT === '—' ? '' : values.MANAGER_COMMENT,
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
    ui.alert('Для выбранного в 07_ОТЧЕТ объекта и недели ещё нет отчёта. Сначала нажмите «Создать отчёт».');
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

function reportListKeys_() {
  const keys = {};
  reportRows_().forEach(r => { if (r.list) keys[r.ph] = true; });
  return keys;
}

/** Значения placeholder'ов из 07_ОТЧЕТ (отображаемый текст) + подпись из настроек. */
function readReportValues_() {
  const sh = sheet_('REP');
  const rows = reportRows_();
  const vals = sh.getRange(REP_FIRST_ROW, 2, rows.length, 2).getDisplayValues();
  const out = {};
  vals.forEach(v => {
    const m = /^\{\{([A-Z_]+)\}\}$/.exec(v[1]);
    if (m) out[m[1]] = v[0] === '' ? '—' : v[0];
  });
  out.AGENCY = String(cfgGet_('AGENCY_NAME') || '');
  out.MANAGER_NAME = String(cfgGet_('MANAGER_NAME') || '');
  out.MANAGER_CONTACT = String(cfgGet_('MANAGER_CONTACT') || '');
  out.REPORT_DATE = fmtDate_(new Date());
  return out;
}

/** Подстановка значений: обычные — replaceText, списочные — маркированный список. */
function fillDoc_(doc, values, listKeys) {
  const sections = [doc.getBody()];
  if (doc.getHeader()) sections.push(doc.getHeader());
  if (doc.getFooter()) sections.push(doc.getFooter());
  sections.forEach(sec => {
    Object.keys(values).forEach(k => {
      if (listKeys[k]) {
        const lines = String(values[k]).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        replaceWithList_(sec, k, lines.length ? lines : ['—']);
      }
    });
    Object.keys(values).forEach(k => {
      if (!listKeys[k]) sec.replaceText(phPattern_(k), escapeReplacement_(String(values[k])));
    });
    sec.replaceText('\\{\\{[A-Z_]+\\}\\}', '—');
  });
}

function phPattern_(key) { return '\\{\\{' + key + '\\}\\}'; }
function escapeReplacement_(s) { return s.replace(/\\/g, '\\\\').replace(/\$/g, '\\$'); }

function replaceWithList_(container, key, lines) {
  const pat = phPattern_(key);
  let found = container.findText(pat);
  let guard = 0;
  while (found && guard++ < 30) {
    const textEl = found.getElement().asText();
    const para = textEl.getParent();
    const parent = para.getParent();
    const whole = para.asText().getText().trim() === '{{' + key + '}}';
    if (!whole || typeof parent.insertListItem !== 'function') {
      textEl.replaceText(pat, escapeReplacement_(lines.join('; ')));
    } else {
      const idx = parent.getChildIndex(para);
      lines.forEach((ln, i) => {
        const li = parent.insertListItem(idx + 1 + i, ln);
        li.setGlyphType(DocumentApp.GlyphType.BULLET);
        li.editAsText().setFontSize(11).setBold(false);
        li.setSpacingAfter(2);
      });
      para.removeFromParent();
    }
    found = container.findText(pat);
  }
}

/**
 * Одна папка на объект: 01_ОБЪЕКТЫ/«Название (ID из CRM)»/{Стратегия, Отчёты, Материалы}.
 * kind: 'ROOT' — сама папка объекта, 'STRATEGIES' / 'REPORTS' / 'MATERIALS' — подпапка.
 * Ссылка на папку объекта записывается в 01_ОБЪЕКТЫ.
 */
function ensureObjectFolder_(id, kind) {
  let parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID'));
  if (!parent) { ensureDrive_(); parent = folderById_(cfgGet_('FOLDER_OBJECTS_ID')); }
  const obj = objectById_(id);
  const suffix = '(' + id + ')';
  let root = null;
  const it = parent.getFolders();
  while (it.hasNext() && !root) {
    const f = it.next();
    if (f.getName().slice(-suffix.length) === suffix) root = f;
  }
  if (!root) {
    root = parent.createFolder((obj ? obj.name : id) + ' ' + suffix);
    Object.keys(SYS.OBJECT_SUBFOLDERS).forEach(k => childFolder_(root, SYS.OBJECT_SUBFOLDERS[k]));
  }
  if (obj && obj.folder_link !== root.getUrl()) writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { folder_link: root.getUrl() });
  if (!kind || kind === 'ROOT') return root;
  return childFolder_(root, SYS.OBJECT_SUBFOLDERS[kind]);
}

/** Шаблон «Еженедельный отчёт по продаже объекта» (создаётся один раз, дальше можно менять вёрстку в Google Docs). */
function ensureReportTemplate_() {
  const id = String(cfgGet_('TEMPLATE_REPORT_ID') || '');
  if (id) {
    try { if (!DriveApp.getFileById(id).isTrashed()) return id; } catch (e) { /* создадим заново */ }
  }
  const doc = DocumentApp.create(SYS.REPORT_TEMPLATE_NAME);
  const b = doc.getBody();
  b.setMarginTop(48).setMarginBottom(48).setMarginLeft(56).setMarginRight(56);
  const base = {};
  base[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
  base[DocumentApp.Attribute.FONT_SIZE] = 11;
  base[DocumentApp.Attribute.FOREGROUND_COLOR] = '#263238';
  b.setAttributes(base);
  const H = DocumentApp.ParagraphHeading;
  b.getParagraphs()[0].setText('Еженедельный отчёт о продаже объекта').setHeading(H.SUBTITLE);
  b.appendParagraph('{{OBJECT}}').setHeading(H.TITLE);
  const info = b.appendTable([
    ['Адрес', '{{ADDRESS}}'], ['Период', '{{PERIOD}}'], ['Цена', '{{PRICE}}'], ['Дней в экспозиции', '{{DAYS_ON_MARKET}}'],
  ]);
  styleTable_(info, false);
  const sec = (title, level) => b.appendParagraph(title).setHeading(level || H.HEADING2);
  sec('1. Что сделано за неделю');
  b.appendParagraph('Выполнено действий: {{ACTIONS}}. Основные каналы: {{CHANNELS}}.');
  b.appendParagraph('{{DONE}}');
  sec('2. Результаты недели');
  const res = b.appendTable([
    ['Показатель', 'Значение'],
    ['Контакты с потенциальными покупателями', '{{CONTACTS}}'], ['Получили ответ', '{{RESPONSES}}'],
    ['Проявили интерес (лиды)', '{{INTERESTED}}'], ['Презентации', '{{PRESENTATIONS}}'],
    ['Показы', '{{SHOWINGS}}'], ['Переговоры', '{{NEGOTIATIONS}}'], ['Предложения', '{{OFFERS}}'],
    ['Брони', '{{BOOKINGS}}'], ['Сделки', '{{DEALS}}'],
  ]);
  styleTable_(res, true);
  sec('3. Воронка и конверсии');
  b.appendParagraph('{{CONVERSIONS}}');
  sec('4. Что показал рынок');
  b.appendParagraph('{{MARKET_FEEDBACK}}');
  sec('Возражения покупателей', H.HEADING3);
  b.appendParagraph('{{OBJECTIONS}}');
  sec('Что протестировали на рынке', H.HEADING3);
  b.appendParagraph('{{TESTS}}');
  sec('5. Выводы');
  b.appendParagraph('{{CONCLUSIONS}}');
  sec('Что изменили в стратегии', H.HEADING3);
  b.appendParagraph('{{STRATEGY_CHANGES}}');
  sec('6. План на следующую неделю');
  b.appendParagraph('{{NEXT_WEEK}}');
  sec('Целевые показатели следующей недели', H.HEADING3);
  b.appendParagraph('{{NEXT_WEEK_KPI}}');
  sec('7. Комментарий руководителя');
  b.appendParagraph('{{MANAGER_COMMENT}}');
  b.appendParagraph('');
  b.appendParagraph('{{MANAGER_NAME}} {{MANAGER_CONTACT}} {{AGENCY}} · отчёт сформирован {{REPORT_DATE}}')
    .editAsText().setFontSize(9).setForegroundColor('#80868B');
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  const tplFolder = folderById_(cfgGet_('FOLDER_TEMPLATES_ID'));
  if (tplFolder) file.moveTo(tplFolder);
  cfgSet_('TEMPLATE_REPORT_ID', doc.getId());
  return doc.getId();
}

function styleTable_(t, withHeader) {
  t.setBorderColor('#CFD8DC');
  for (let r = 0; r < t.getNumRows(); r++) {
    const row = t.getRow(r);
    row.getCell(0).setWidth(250);
    for (let c = 0; c < row.getNumCells(); c++) {
      row.getCell(c).setPaddingTop(3).setPaddingBottom(3);
      row.getCell(c).editAsText().setFontSize(10);
    }
    if (withHeader && r === 0) {
      for (let c = 0; c < row.getNumCells(); c++) row.getCell(c).setBackgroundColor('#ECEFF1').editAsText().setBold(true);
    } else if (!withHeader) {
      row.getCell(0).editAsText().setForegroundColor('#80868B');
    }
  }
}

// ═════════════ 06_Strategy.gs ═════════════
/**
 * 06_Strategy — полная стратегия объекта в Google Doc.
 *
 * В 02_СТРАТЕГИЯ — короткая управленческая версия. Полный документ создаётся один раз
 * из шаблона (поля 02 подставляются как стартовый текст) и дальше ведётся в Google Docs.
 */

function openStrategy() {
  const ui = SpreadsheetApp.getUi();
  let id = selectedObjectId_();
  if (!id) {
    const r = ui.prompt('Открыть стратегию', 'Введите ID объекта (ID из CRM) или встаньте на строку объекта:', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    id = r.getResponseText().trim();
  }
  const obj = objectById_(id);
  if (!obj) { ui.alert('Объект ' + id + ' не найден.'); return; }
  const res = ensureStrategyDoc_(id);
  showLinks_('Стратегия: ' + obj.name, [{ label: res.name, url: res.url }], res.created ? 'Документ создан из шаблона и заполнен краткой версией из 02_СТРАТЕГИЯ.' : '');
}

function ensureStrategyDoc_(id) {
  const obj = objectById_(id);
  ensureStrategyRows_([id]);
  const t = readTable_('STR');
  const row = t.rows.find(r => r.obj_id === id);
  const existingId = idFromUrl_(row.strategy_doc) || idFromUrl_(obj.strategy_link);
  if (existingId) {
    try {
      const f = DriveApp.getFileById(existingId);
      if (!f.isTrashed()) {
        if (!row.strategy_doc) writeFields_(t.sh, 'STR', row._row, { strategy_doc: f.getUrl() });
        if (!obj.strategy_link) writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { strategy_link: f.getUrl() });
        return { url: f.getUrl(), name: f.getName(), created: false };
      }
    } catch (e) { /* документ удалён — создадим новый */ }
  }
  const folder = ensureObjectFolder_(id, 'STRATEGIES');
  const tpl = DriveApp.getFileById(ensureStrategyTemplate_());
  const name = obj.name + ' — Стратегия продажи';
  const copy = tpl.makeCopy(name, folder);
  const doc = DocumentApp.openById(copy.getId());
  const values = { OBJECT: obj.name, OBJ_ID: id, ADDRESS: obj.address || '—', DATE: fmtDate_(new Date()) };
  strategyDocFields_().forEach(f => {
    const v = row[f.key];
    values[f.key.toUpperCase()] = v instanceof Date ? fmtDate_(v) : (v === '' || v === null ? '—' : String(v));
  });
  fillDoc_(doc, values, {});
  doc.saveAndClose();
  writeFields_(t.sh, 'STR', row._row, { strategy_doc: copy.getUrl() });
  writeFields_(sheet_('OBJ'), 'OBJ', obj._row, { strategy_link: copy.getUrl() });
  return { url: copy.getUrl(), name: name, created: true };
}

function strategyDocFields_() {
  return sheetSpecs_().STR.fields.filter(f => ['text', 'money', 'dd', 'date'].indexOf(f.kind) >= 0 && f.key !== 'obj_id');
}

function ensureStrategyTemplate_() {
  const id = String(cfgGet_('TEMPLATE_STRATEGY_ID') || '');
  if (id) {
    try { if (!DriveApp.getFileById(id).isTrashed()) return id; } catch (e) { /* создадим заново */ }
  }
  const doc = DocumentApp.create(SYS.STRATEGY_TEMPLATE_NAME);
  const b = doc.getBody();
  const base = {};
  base[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
  base[DocumentApp.Attribute.FONT_SIZE] = 11;
  base[DocumentApp.Attribute.FOREGROUND_COLOR] = '#263238';
  b.setAttributes(base);
  const H = DocumentApp.ParagraphHeading;
  b.getParagraphs()[0].setText('Стратегия продажи').setHeading(H.SUBTITLE);
  b.appendParagraph('{{OBJECT}}').setHeading(H.TITLE);
  b.appendParagraph('{{OBJ_ID}} · {{ADDRESS}} · документ создан {{DATE}}').editAsText().setFontSize(9).setForegroundColor('#80868B');
  b.appendParagraph('ВНУТРЕННИЙ ДОКУМЕНТ. Клиенту не передаётся. Краткая версия и дата пересмотра — в листе 02_СТРАТЕГИЯ.')
    .editAsText().setFontSize(9).setBold(true).setForegroundColor('#7F1D1D');
  const groups = [
    ['1. Цель и цена', ['strategy_status', 'goal', 'target_price', 'price_range']],
    ['2. Позиционирование и аргументы', ['positioning', 'key_argument', 'advantages', 'weaknesses', 'not_public']],
    ['3. Покупатель', ['ta1', 'ta2', 'ta3', 'motives', 'objections', 'answers']],
    ['4. Рынок и конкуренты', ['competitors']],
    ['5. Сценарий и каналы', ['scenario', 'channels', 'partner_channels', 'crm_base', 'content_strategy', 'outbound_strategy', 'promo_plan']],
    ['6. Гипотезы и выводы', ['hypotheses', 'conclusion', 'next_hypothesis', 'review_date']],
  ];
  groups.forEach(g => {
    b.appendParagraph(g[0]).setHeading(H.HEADING2);
    g[1].forEach(k => {
      b.appendParagraph(fieldTitle_('STR', k)).setHeading(H.HEADING3);
      b.appendParagraph('{{' + k.toUpperCase() + '}}');
    });
  });
  b.appendParagraph('7. Подробный анализ').setHeading(H.HEADING2);
  b.appendParagraph('Здесь — глубокая проработка: анализ аналогов, расчёты, сценарии переговоров, материалы для контента.');
  b.appendParagraph('8. Журнал решений').setHeading(H.HEADING2);
  b.appendParagraph('Дата — решение — почему — кто утвердил.');
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  const tplFolder = folderById_(cfgGet_('FOLDER_TEMPLATES_ID'));
  if (tplFolder) file.moveTo(tplFolder);
  cfgSet_('TEMPLATE_STRATEGY_ID', doc.getId());
  return doc.getId();
}

/** Меню: создать папки и документы стратегий для всех объектов, где их нет. */
function createFoldersForAll() {
  const objs = readTable_('OBJ').rows.filter(o => o.id);
  let n = 0;
  objs.forEach(o => {
    ensureObjectFolder_(o.id, 'ROOT');
    if (ensureStrategyDoc_(o.id).created) n++;
  });
  SpreadsheetApp.getUi().alert('Готово: папки проверены для ' + objs.length + ' объектов, создано документов стратегии: ' + n + '.');
}

// ═════════════ 07_Planning.gs ═════════════
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

// ═════════════ 08_Control.gs ═════════════
/**
 * 08_Control — просрочки, обновление статистики, ежедневная сводка.
 * Сами предупреждения считаются формулами в 11_КОНТРОЛЬ; здесь — показ и обслуживание.
 */

function readAlerts_() {
  SpreadsheetApp.flush();
  const sh = sheet_('CTRL');
  const n = sh.getMaxRows() - CTRL_FIRST + 1;
  return sh.getRange(CTRL_FIRST, 1, n, 8).getDisplayValues().filter(r => r[1] !== '');
}

function checkOverdue() {
  const alerts = readAlerts_();
  sheet_('CTRL').activate();
  if (!alerts.length) {
    SpreadsheetApp.getUi().alert('Просрочек и предупреждений нет ✓');
    return;
  }
  const byType = {};
  alerts.forEach(a => { byType[a[1]] = (byType[a[1]] || 0) + 1; });
  const high = alerts.filter(a => a[0].charAt(0) === '1').length;
  const summary = Object.keys(byType).sort((a, b) => byType[b] - byType[a]).map(k => '<li>' + htmlEscape_(k) + ': <b>' + byType[k] + '</b></li>').join('');
  const rows = alerts.slice(0, 40).map(a => {
    const color = a[0].charAt(0) === '1' ? '#F4CCCC' : a[0].charAt(0) === '2' ? '#FFF2CC' : '#FFFFFF';
    return '<tr style="background:' + color + '"><td>' + htmlEscape_(a[1]) + '</td><td>' + htmlEscape_(a[3]) + '</td><td>' +
      htmlEscape_(a[4]) + '</td><td>' + htmlEscape_(a[5]) + '</td><td>' + htmlEscape_(a[6]) + '</td></tr>';
  }).join('');
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:13px">' +
    '<p>Всего предупреждений: <b>' + alerts.length + '</b>, из них высокой критичности: <b>' + high + '</b></p>' +
    '<ul>' + summary + '</ul>' +
    '<table style="border-collapse:collapse;width:100%" border="1" cellpadding="4">' +
    '<tr style="background:#ECEFF1"><th>Тип</th><th>Объект</th><th>Что случилось</th><th>Ответственный</th><th>Срок</th></tr>' + rows + '</table>' +
    (alerts.length > 40 ? '<p>… полный список — лист 11_КОНТРОЛЬ</p>' : '') + '</div>').setWidth(900).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'Проверка просрочек');
}

function openDashboard() { sheet_('DASH').activate(); }

/**
 * «Обновить статистику»: формулы пересчитываются сами, но эта команда
 * 1) проставляет недостающие ID/значения по умолчанию (если данные вставляли, а триггер не сработал);
 * 2) создаёт строки стратегии для новых объектов;
 * 3) добавляет строки в журналы, если они заканчиваются, и растягивает на них списки/чекбоксы;
 * 4) пересчитывает таблицу.
 */
function refreshStats() {
  const fixed = fillMissing_();
  ['OBJ', 'STR', 'ACT', 'PF', 'HIST', 'ARCH', 'HYP'].forEach(code => {
    const sh = sheet_(code);
    const last = lastDataRow_(sh, sheetSpecs_()[code]);
    if (sh.getMaxRows() - last < 200) extendSheet_(code, 1000);
  });
  SpreadsheetApp.flush();
  toast_('Статистика пересчитана. Исправлено строк без ID/значений по умолчанию: ' + fixed + '.');
}

function fillMissing_() {
  let fixed = 0;
  const user = userEmail_();
  ['ACT', 'PF', 'HYP'].forEach(code => {
    const t = readTable_(code);
    const cache = {};
    t.rows.forEach(o => {
      const hasInput = t.spec.fields.some(f => isInputKind_(f.kind) && f.kind !== 'cb' && o[f.key] !== '');
      if (!hasInput || o[t.spec.idField]) return;
      const upd = {};
      upd[t.spec.idField] = nextId_(code, cache);
      o[t.spec.idField] = upd[t.spec.idField];
      applyDefaults_(code, o, upd, true, user, []);
      writeFields_(t.sh, code, o._row, upd);
      fixed++;
    });
  });
  const ids = readTable_('OBJ').rows.map(o => o.id).filter(Boolean);
  ensureStrategyRows_(ids);
  return fixed;
}

// ───────────── ежедневная сводка на email ─────────────

function installDailyCheck() {
  const ui = SpreadsheetApp.getUi();
  const email = String(cfgGet_('DAILY_EMAIL') || '').trim();
  if (!email) { ui.alert('Укажите email в 10_НАСТРОЙКИ → «Email для ежедневной сводки предупреждений».'); return; }
  removeDailyCheck_();
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(9).create();
  ui.alert('Ежедневная сводка включена: около 9:00 на ' + email + '.');
}

function uninstallDailyCheck() {
  removeDailyCheck_();
  SpreadsheetApp.getUi().alert('Ежедневная сводка выключена.');
}

function removeDailyCheck_() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'dailyCheck') ScriptApp.deleteTrigger(t); });
}

function dailyCheck() {
  const email = String(cfgGet_('DAILY_EMAIL') || '').trim();
  if (!email) return;
  const alerts = readAlerts_();
  if (!alerts.length) return;
  const lines = alerts.slice(0, 60).map(a => '• [' + a[0] + '] ' + a[1] + ' — ' + a[3] + ': ' + a[4] + (a[5] ? ' (' + a[5] + ')' : ''));
  MailApp.sendEmail(email, 'Эксклюзивы: ' + alerts.length + ' предупреждений на ' + fmtDate_(new Date()),
    lines.join('\n') + '\n\nТаблица: ' + ss_().getUrl());
}

// ═════════════ 09_Dialogs.gs ═════════════
/**
 * 09_Dialogs — форма «Добавить действие» (быстрый ввод без поиска нужной колонки).
 */

function addAction() {
  const html = HtmlService.createHtmlOutputFromFile('AddActionDialog').setWidth(640).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html, 'Добавить действие');
}

/** Данные для выпадающих списков формы. */
function getActionFormData() {
  const objs = readTable_('OBJ').rows.filter(o => o.id && o.in_work === 'ДА').map(o => ({ id: o.id, label: objLabel_(o.id, o.name) }));
  const preselect = selectedObjectId_();
  return {
    objects: objs,
    preselect: preselect,
    types: dictValues_('action_types'),
    channels: dictValues_('channels'),
    people: dictValues_('people'),
    statuses: dictValues_('task_status'),
    defaultStatus: dictFirstByClass_('task_status', CLS.DONE),
    refusals: dictValues_('refusal_reasons'),
    defaultOwner: personByEmail_(userEmail_()),
    today: fmtDate_(today_(), 'yyyy-MM-dd'),
    counters: sheetSpecs_().ACT.fields.filter(f => f.kind === 'num' && f.key !== 'views').map(f => ({ key: f.key, title: f.title.replace('Количество ', '') })),
  };
}

/** Сохраняет действие из формы. Возвращает ID. */
function submitActionForm(d) {
  if (!d.obj_id) throw new Error('Выберите объект');
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const parts = String(d.date || '').split('-').map(Number);
    const date = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : today_();
    const nsParts = String(d.next_step_date || '').split('-').map(Number);
    const obj = {
      id: nextId_('ACT'), date: date, obj_id: d.obj_id, owner: d.owner || '', type: d.type || '', channel: d.channel || '',
      goal: d.goal || '', plan: d.plan || '', fact: d.fact || '', status: d.status || dictFirstByClass_('task_status', CLS.DONE),
      result: d.result || '', refusal: d.refusal || '', feedback: d.feedback || '', conclusion: d.conclusion || '',
      next_step: d.next_step || '', next_step_date: nsParts.length === 3 ? new Date(nsParts[0], nsParts[1] - 1, nsParts[2]) : '',
      comment: d.comment || '', views: num_(d.views), cost: num_(d.cost), to_report: d.to_report !== false,
      created_at: new Date(), author: userEmail_(),
    };
    sheetSpecs_().ACT.fields.filter(f => f.kind === 'num' && f.key !== 'views').forEach(f => { obj[f.key] = num_(d[f.key]); });
    const row = appendRow_('ACT', obj);
    const hist = [{ sheet: SHEET_NAMES.ACT, record_id: obj.id, obj_id: obj.obj_id, field: fieldTitle_('ACT', 'status'), old: '', new: obj.status, kind: HIST_KIND.CREATE, note: 'Через форму' }];
    logHistory_(hist, obj.author);
    return { id: obj.id, row: row };
  } finally {
    lock.releaseLock();
  }
}

function num_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
  return isNaN(n) ? '' : n;
}

// ═════════════ 10_TestData.gs ═════════════
/**
 * 10_TestData — тестовые объекты «Остров», «Аносино Парк», «Павловы Озёра».
 *
 * Даты строятся относительно текущей недели, поэтому тест воспроизводим в любой день:
 *   M = понедельник текущей недели, P = M − 7 (отчётная неделя), Q = P − 7.
 * Ожидаемые значения описаны в docs/08_ТЕСТИРОВАНИЕ.md и проверяются «Самопроверкой».
 */

const TEST_NAMES = { OSTROV: 'Остров', ANOSINO: 'Аносино Парк', PAVLOVY: 'Павловы Озёра' };

function loadTestData() {
  const ui = SpreadsheetApp.getUi();
  const exists = readTable_('OBJ').rows.some(o => o.name === TEST_NAMES.OSTROV);
  if (exists) {
    ui.alert('Тестовые данные уже загружены (есть объект «' + TEST_NAMES.OSTROV + '»).');
    return;
  }
  const ok = ui.alert('Тестовые данные', 'Будут добавлены 3 тестовых объекта с действиями, задачами и историей цены. Продолжить?', ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  const ids = loadTestData_();
  ui.alert('Готово', 'Добавлены: ' + ids.OSTROV + ' Остров, ' + ids.ANOSINO + ' Аносино Парк, ' + ids.PAVLOVY + ' Павловы Озёра.\n\nТеперь запустите «Самопроверку».', ui.ButtonSet.OK);
}

function loadTestData_() {
  const M = mondayOf_(today_());
  const P = addDays_(M, -7);
  const Q = addDays_(P, -7);
  const d = (base, n) => addDays_(base, n);
  const now = new Date();
  const DONE = 'Выполнено', PLANNED = 'Запланировано', INWORK = 'В работе', FAILED = 'Не выполнено';
  const BOSS = 'Руководитель', ASSIST = 'Ассистент';

  // ── объекты
  // ID объектов — как в CRM (вводятся вручную)
  const ids = { OSTROV: '4501', ANOSINO: '4502', PAVLOVY: '4503' };
  appendRows_('OBJ', [
    {
      id: ids.OSTROV, name: TEST_NAMES.OSTROV, address: 'Московская обл., Одинцовский г.о., КП «Остров», уч. 12', complex: 'Остров',
      obj_type: 'Дом', category: 'Премиум', area: 450, rooms: 6, price: 185000000, deal_type: 'Продажа',
      date_sign: d(M, -60), date_end: d(M, 120), status: 'Активная продажа', manager: BOSS, assistant: ASSIST,
      crm_link: 'https://crm.example.com/object/1001', priority: 'A — высокий', temperature: 'HOT',
      target_buyer: 'Семья с детьми, собственник бизнеса, бюджет 170–200 млн', main_channel: 'CRM-база',
      manager_comment: 'ВНУТР: собственник готов обсуждать торг до 5%', created_at: d(M, -60),
    },
    {
      id: ids.ANOSINO, name: TEST_NAMES.ANOSINO, address: 'Московская обл., Истринский г.о., КП «Аносино Парк»', complex: 'Аносино Парк',
      obj_type: 'Дом', category: 'Бизнес', area: 320, rooms: 5, price: 98000000, deal_type: 'Продажа',
      date_sign: d(M, -40), date_end: d(M, 140), status: 'Переговоры', manager: BOSS, assistant: ASSIST,
      priority: 'A — высокий', temperature: 'WARM', target_buyer: 'Семья, переезд из Москвы', main_channel: 'Партнёры', created_at: d(M, -40),
    },
    {
      id: ids.PAVLOVY, name: TEST_NAMES.PAVLOVY, address: 'Московская обл., Истринский г.о., КП «Павловы Озёра»', complex: 'Павловы Озёра',
      obj_type: 'Дом', category: 'Премиум', area: 280, rooms: 5, price: 72000000, deal_type: 'Продажа',
      date_sign: d(M, -90), date_end: d(M, 10), status: 'Активная продажа', manager: BOSS, assistant: ASSIST,
      priority: 'B — средний', temperature: 'COLD', target_buyer: 'Инвестор / второй дом', main_channel: 'Авито', created_at: d(M, -90),
    },
  ]);

  // ── стратегия (краткая версия)
  ensureStrategyRows_([ids.OSTROV, ids.ANOSINO, ids.PAVLOVY]);
  const str = readTable_('STR');
  const strRow = id => str.rows.find(r => r.obj_id === id)._row;
  writeFields_(str.sh, 'STR', strRow(ids.OSTROV), {
    strategy_status: 'Утверждена', goal: 'Продать за 60 дней по цене не ниже 178 млн', target_price: 180000000,
    price_range: '176–185 млн', positioning: 'Семейная резиденция у воды в охраняемом посёлке',
    ta1: 'Семьи с детьми из Москвы', ta2: 'Собственники бизнеса', ta3: 'Клиенты Private Banking',
    motives: 'Экология, безопасность, школа рядом', objections: 'Цена, стоимость обслуживания посёлка',
    answers: 'Сравнение с аналогами, расчёт стоимости владения', competitors: '3 дома в соседних посёлках 170–210 млн',
    advantages: 'Выход к воде, готовый ремонт, 30 соток', weaknesses: 'Высокий эксплуатационный платёж',
    not_public: 'Собственник готов к торгу до 5%', key_argument: 'Единственный дом у воды с готовым ремонтом',
    scenario: 'Закрытые показы по записи → повторный показ с семьёй → переговоры',
    channels: 'CRM, ЦИАН, брокеры премиум-сегмента, Private Banking', partner_channels: 'Private Banking, брокеры',
    crm_base: '420 контактов загородного премиум-сегмента', content_strategy: 'Reels-обзор, серия Stories',
    outbound_strategy: 'Рассылка по базе + звонки брокерам', promo_plan: 'Неделя 1–2 база и брокеры, неделя 3–4 контент и PB',
    hypotheses: 'Если снизить до 179 — ускорим переговоры', review_date: P, conclusion: 'Лучше всего работает база и брокерский канал',
    next_hypothesis: 'Проверить закрытый показ для клиентов PB', changed_at: d(P, 2), changed_by: 'test',
  });
  writeFields_(str.sh, 'STR', strRow(ids.ANOSINO), {
    strategy_status: 'Утверждена', goal: 'Довести переговоры до брони', positioning: 'Готовый дом для переезда семьи',
    channels: 'Партнёры, брокеры', review_date: d(M, -20), changed_at: d(M, -20), changed_by: 'test',
  });
  writeFields_(str.sh, 'STR', strRow(ids.PAVLOVY), {
    strategy_status: 'Черновик', goal: 'Найти покупателя-инвестора', positioning: 'Дом у озера для второго жилья',
    channels: 'Авито, ЦИАН', review_date: d(M, -60), changed_at: d(M, -60), changed_by: 'test',
  });

  // ── действия
  const ac = {};
  const A = (date, obj, type, channel, fact, extra) => Object.assign({
    id: nextId_('ACT', ac), date: date, obj_id: obj, owner: ASSIST, type: type, channel: channel, goal: '', fact: fact,
    status: DONE, to_report: true, created_at: now, author: 'test',
  }, extra || {});
  appendRows_('ACT', [
    A(d(Q, 1), ids.OSTROV, 'Рассылка', 'CRM-база', 'Рассылка по базе покупателей загородной недвижимости', { contacts: 40, responses: 4, interested: 2, presentations: 1 }),
    A(d(Q, 3), ids.OSTROV, 'Показ', 'Брокеры', 'Показ объекта покупателю брокера', { showings: 1, feedback: 'Покупателю понравился участок, вопросы по стоимости' }),
    A(d(P, 0), ids.OSTROV, 'Рассылка', 'CRM-база', 'Рассылка по базе покупателей загородной недвижимости премиум-сегмента',
      { contacts: 30, responses: 5, interested: 2, presentations: 1, conclusion: 'Лучше всего откликаются клиенты, ранее искавшие дома от 400 м²' }),
    A(d(P, 1), ids.OSTROV, 'ЦИАН', 'ЦИАН', 'Обновлено объявление: новые фото и описание', { views: 850, contacts: 8, responses: 2, cost: 15000 }),
    A(d(P, 1), ids.OSTROV, 'Брокеры', 'Брокеры', 'Презентация объекта пулу брокеров премиум-сегмента',
      { contacts: 12, responses: 1, interested: 1, presentations: 1, refusal: 'Цена' }),
    A(d(P, 2), ids.OSTROV, 'Показ', 'Брокеры', 'Показ объекта семье покупателя',
      { showings: 1, feedback: 'Нравится планировка и участок; вопрос — стоимость обслуживания посёлка', next_step: 'Повторный показ с семьёй', next_step_date: d(M, 3) }),
    A(d(P, 3), ids.OSTROV, 'Переговоры', 'Брокеры', 'Первичные переговоры по условиям сделки',
      { negotiations: 1, conclusion: 'Покупатель готов обсуждать сделку при корректировке цены в пределах 3–4%', comment: 'ВНУТР: собственник согласен на 5%, клиенту не раскрывать' }),
    A(d(P, 3), ids.OSTROV, 'Reels', 'Instagram', '', { goal: 'Снять Reels-обзор объекта', status: PLANNED }),
    A(d(P, 4), ids.OSTROV, 'CRM', 'CRM-база', 'Внутренняя чистка базы', { to_report: false }),
    A(d(M, 0), ids.OSTROV, 'Рассылка', 'Private Banking', 'Рассылка через партнёров Private Banking', { contacts: 10, responses: 2 }),
    A(d(P, 0), ids.ANOSINO, 'Партнёры', 'Партнёры', 'Презентация объекта партнёрам-агентствам', { contacts: 15, responses: 6, interested: 3, presentations: 2 }),
    A(d(P, 2), ids.ANOSINO, 'Показ', 'Партнёры', 'Два показа, один покупатель перешёл к переговорам',
      { showings: 2, negotiations: 1, offers: 1, feedback: 'Покупатели отмечают качество строительства' }),
    A(d(M, 0), ids.ANOSINO, 'Переговоры', 'Партнёры', 'Переговоры по предложению покупателя', { negotiations: 1 }),
    A(d(M, -21), ids.PAVLOVY, 'Авито', 'Авито', 'Размещено объявление на Авито', { views: 400, contacts: 3, responses: 1 }),
    A(d(M, -20), ids.PAVLOVY, 'Звонок', 'Авито', 'Обработка откликов с Авито', { contacts: 2, responses: 2, refusal: 'Локация', feedback: 'Далеко от Москвы для постоянного проживания' }),
    A(d(M, -19), ids.PAVLOVY, 'WhatsApp', 'Авито', 'Ответ на запрос по объявлению', { contacts: 1, responses: 1, refusal: 'Цена' }),
    A(d(M, -19), ids.PAVLOVY, 'Звонок', 'Авито', 'Повторный звонок откликнувшимся', { repeat_contacts: 1, refusal: 'Цена' }),
  ]);

  // ── план-факт
  const tc = {};
  const wkP = isoWeekKey_(P), wkM = isoWeekKey_(M);
  const T = (week, obj, extra) => Object.assign({
    week: week, obj_id: obj, owner: ASSIST, status: PLANNED, to_report: true, task_id: nextId_('PF', tc), created_at: now,
  }, extra || {});
  appendRows_('PF', [
    T(wkP, ids.OSTROV, { week_goal: 'Выйти на 2 показа', task: 'Контакты по базе и брокерам', kpi_metric: 'Контакты', kpi_plan: 50, status: DONE, deadline: d(P, 4), conclusion: 'План по контактам выполнен' }),
    T(wkP, ids.OSTROV, { week_goal: 'Выйти на 2 показа', task: 'Организовать показы', owner: BOSS, kpi_metric: 'Показы', kpi_plan: 2, status: FAILED, fail_reason: 'Второй покупатель перенёс показ', deadline: d(P, 4) }),
    T(wkP, ids.OSTROV, { week_goal: 'Выйти на 2 показа', task: 'Новые лиды', kpi_metric: 'Лиды', kpi_plan: 3, status: DONE, deadline: d(P, 4) }),
    T(wkP, ids.OSTROV, { task: 'Снять Reels-обзор', type: 'Reels', status: INWORK, deadline: d(P, 4) }),
    T(wkP, ids.OSTROV, { task: 'Обновить презентацию объекта', owner: '', status: PLANNED, deadline: d(P, 4) }),
    T(wkP, ids.ANOSINO, { task: 'Презентация партнёрам', kpi_metric: 'Контакты', kpi_plan: 15, status: DONE, deadline: d(P, 4) }),
    T(wkP, ids.ANOSINO, { task: 'Вывести покупателя на переговоры', owner: BOSS, kpi_metric: 'Переговоры', kpi_plan: 1, status: DONE, deadline: d(P, 4) }),
    T(wkM, ids.OSTROV, { week_goal: 'Повторный показ и переговоры', task: 'Провести повторный показ для семьи Б.', owner: BOSS, kpi_metric: 'Показы', kpi_plan: 2, deadline: d(M, 4) }),
    T(wkM, ids.OSTROV, { week_goal: 'Повторный показ и переговоры', task: 'Рассылка по клиентам Private Banking', kpi_metric: 'Контакты', kpi_plan: 40, deadline: d(M, 4) }),
  ]);

  // ── гипотезы
  const hc = {};
  const H = (obj, extra) => Object.assign({ id: nextId_('HYP', hc), obj_id: obj, to_report: true, created_at: now }, extra);
  appendRows_('HYP', [
    H(ids.OSTROV, { hypothesis: 'Если подключить брокеров премиум-сегмента, получим не меньше 2 новых лидов за 2 недели', channel: 'Брокеры', metric: 'Лиды', target: 2,
      date_start: Q, date_end: d(P, 6), status: 'Не подтвердилась', conclusion: 'Брокерский канал даёт показы, но мало новых покупателей', decision: 'ВНУТР: перераспределить время на Private Banking' }),
    H(ids.OSTROV, { hypothesis: 'Рассылка через Private Banking даст 30 контактов за неделю', channel: 'Private Banking', metric: 'Контакты', target: 30,
      date_start: M, date_end: d(M, 6), status: 'В проверке' }),
    H(ids.PAVLOVY, { hypothesis: 'Объявление на Авито с новыми фото даст 3 лида за месяц', channel: 'Авито', metric: 'Лиды', target: 3,
      date_start: d(M, -40), date_end: d(M, -10), status: 'В проверке' }),
  ]);

  // ── история: цена и стратегия (как будто менялись через таблицу)
  const priceTitle = fieldTitle_('OBJ', 'price');
  appendRows_('HIST', [
    { ts: d(M, -60), user: 'test', sheet: SHEET_NAMES.OBJ, record_id: ids.OSTROV, obj_id: ids.OSTROV, field: priceTitle, old: '', new: 195000000, kind: HIST_KIND.INITIAL },
    { ts: d(P, 1), user: 'test', sheet: SHEET_NAMES.OBJ, record_id: ids.OSTROV, obj_id: ids.OSTROV, field: priceTitle, old: 195000000, new: 185000000, kind: HIST_KIND.CHANGE },
    { ts: d(P, 2), user: 'test', sheet: SHEET_NAMES.STR, record_id: ids.OSTROV, obj_id: ids.OSTROV, field: fieldTitle_('STR', 'channels'), old: 'CRM, ЦИАН', new: 'CRM, ЦИАН, брокеры премиум-сегмента, Private Banking', kind: HIST_KIND.CHANGE },
    { ts: d(P, 2), user: 'test', sheet: SHEET_NAMES.STR, record_id: ids.OSTROV, obj_id: ids.OSTROV, field: fieldTitle_('STR', 'not_public'), old: '', new: 'Собственник готов к торгу до 5%', kind: HIST_KIND.INITIAL },
    { ts: d(M, -90), user: 'test', sheet: SHEET_NAMES.OBJ, record_id: ids.PAVLOVY, obj_id: ids.PAVLOVY, field: priceTitle, old: '', new: 72000000, kind: HIST_KIND.INITIAL },
  ]);
  SpreadsheetApp.flush();
  return ids;
}

// ═════════════ 11_SelfTest.gs ═════════════
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
  eq('01: ID из CRM сохранён как введён', ost.id, '4501');
  eq('01: проверка ID — без замечаний', ost.id_check, '');
  eq('01: цена за м² (Остров)', ost.price_m2, Math.round(185000000 / 450));
  eq('01: дней в продаже (Остров)', ost.days_on_market, days(today_(), addDays_(M, -60)));
  eq('01: дней без активности (Павловы)', pav.days_idle, days(today_(), addDays_(M, -19)));
  eq('01: флаг RISK (Павловы)', pav.risk_flag, 'RISK');
  has('01: последнее действие (Остров)', ost.last_action, 'Рассылка');
  truthy('01: следующее действие заполнено (Остров)', ost.next_action && ost.next_action !== '—', ost.next_action);

  // 2. Неделя действия считается из даты
  const acts = readTable_('ACT').rows;
  const a3 = acts.find(a => a.obj_id === ost.id && a.fact.indexOf('премиум-сегмента') > 0 && a.type === 'Рассылка');
  eq('03: неделя из даты', a3 ? a3.week : '', wkP);

  // 3. Воронка 04 (из журнала действий) с фильтром по объекту и неделе
  const fun = sheet_('FUN');
  const FB = funnelLayout_();
  const keepFB = [fun.getRange(FB.selObj).getValue(), fun.getRange(FB.selWeek).getValue()];
  fun.getRange(FB.selObj).setValue(objLabel_(ost.id, ost.name));
  fun.getRange(FB.selWeek).setValue(weekLabelByKey_(wkP));
  SpreadsheetApp.flush();
  const fv = a1 => fun.getRange(a1).getValue();
  eq('04: контакты (Остров, неделя P)', fv(FB.at.contacts), 50);
  eq('04: ответы', fv(FB.at.responses), 8);
  eq('04: лиды (заинтересовались)', fv(FB.at.leads), 3);
  eq('04: презентации', fv(FB.at.pres), 2);
  eq('04: показы', fv(FB.at.show), 1);
  eq('04: переговоры', fv(FB.at.neg), 1);
  eq('04: отказы', fv(FB.at.refusals), 1);
  eq('04: конверсия контакт → ответ', fv(FB.conv['Контакт → ответ']), 0.16);
  eq('04: конверсия ответ → интерес', fv(FB.conv['Ответ → интерес (лид)']), 0.375);
  eq('04: стоимость лида', fv(FB.conv['Стоимость лида']), 5000);
  const chRows = fun.getRange(8, FUN_CH_COL, 40, Object.keys(FB.chLetter).length).getValues();
  const chHdr = Object.keys(FB.chLetter);
  const br = chRows.find(r => r[0] === 'Брокеры') || [];
  eq('04: канал Брокеры — лиды', br[chHdr.indexOf('Лиды')], 1);
  eq('04: канал Брокеры — показы', br[chHdr.indexOf('Показы')], 1);
  const refTbl = fun.getRange(FB.refRow + 1, 1, 5, 2).getValues();
  truthy('04: причины отказов — «Цена» 1 раз', refTbl.some(r => r[0] === 'Цена' && Number(r[1]) === 1), JSON.stringify(refTbl.slice(0, 3)));
  fun.getRange(FB.selObj).setValue('Все');
  fun.getRange(FB.selWeek).setValue('Все время');
  SpreadsheetApp.flush();
  eq('04: все объекты, всё время — лиды', fv(FB.at.leads), 8);
  fun.getRange(FB.selObj).setValue(keepFB[0] || 'Все');
  fun.getRange(FB.selWeek).setValue(keepFB[1] || 'Все время');

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
  eq('05: объект — лиды (заинтересованные)', so['Лиды'], 5);
  eq('05: объект — показы', so['Показы'], 2);
  eq('05: объект — первая цена', so['Первая цена'], 195000000);
  eq('05: объект — изменение цены', so['Изменение цены, ₽'], -10000000);
  eq('05: объект — изменений цены', so['Изменений цены'], 1);
  const sc = sec('channel', 'ЦИАН');
  eq('05: канал ЦИАН — просмотры', sc['Просмотры объявлений'], 850);
  eq('05: канал ЦИАН — контакты', sc['Контакты'], 8);
  eq('05: канал ЦИАН — лиды', sc['Лиды'], 0);
  eq('05: канал ЦИАН — объявление → контакт', sc['Объявление → контакт'], 8 / 850);
  const sw = sec('week', wkP);
  eq('05: неделя P — контакты (все объекты)', sw['Контакты'], 65);
  eq('05: неделя P — лиды', sw['Лиды'], 6);
  const stt = sec('total', 'Итого');
  eq('05: итого — контакты', stt['Контакты'], 121);
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
  eq('07: заинтересовались (лиды)', v.INTERESTED, '3');
  eq('07: показы', v.SHOWINGS, '1');
  eq('07: переговоры', v.NEGOTIATIONS, '1');
  eq('07: предложения', v.OFFERS, '0');
  eq('07: дней в экспозиции', v.DAYS_ON_MARKET, String(days(addDays_(P, 6), addDays_(M, -60))));
  eq('07: строк «что сделано»', v.DONE.split('\n').length, 5);
  has('07: внутреннее действие скрыто', v.DONE, 'Внутренняя чистка', true);
  has('07: воронка', v.CONVERSIONS, 'Воронка недели: контакты 50 → ответы 8 → заинтересовались 3');
  has('07: конверсия контакт → ответ', v.CONVERSIONS, 'Контакт → ответ: 16%');
  has('07: обратная связь рынка', v.MARKET_FEEDBACK, 'планировка');
  has('07: возражения с подсчётом', v.OBJECTIONS, 'Цена — 1');
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
  truthy('11: задача без ответственного — Остров', hasAlert(ALERT.NO_OWNER, ost.id));
  truthy('11: нет ложной тревоги «нет активности» — Остров', !hasAlert(ALERT.IDLE_HIGH, ost.id));

  // 7b. Гипотезы: факт считается из 03 за период проверки
  const hyps = readTable_('HYP').rows;
  const hBr = hyps.find(h => h.obj_id === ost.id && h.channel === 'Брокеры');
  const hPb = hyps.find(h => h.obj_id === ost.id && h.channel === 'Private Banking');
  eq('14: гипотеза «брокеры» — факт лидов', hBr ? hBr.fact : '', 1);
  eq('14: гипотеза «брокеры» — % от цели', hBr ? hBr.fact_pct : '', 0.5);
  eq('14: гипотеза «Private Banking» — факт контактов', hPb ? hPb.fact : '', 10);
  truthy('11: гипотеза с истёкшим сроком — Павловы', hasAlert(ALERT.HYP_DUE, pav.id));
  has('07: что протестировали — гипотеза недели', v.TESTS, 'брокеров премиум-сегмента');
  has('07: что протестировали — будущая гипотеза не попала', v.TESTS, 'Private Banking даст', true);
  has('07: внутреннее решение по гипотезе скрыто', v.TESTS, 'перераспределить', true);

  // 8. Дэшборд
  const dashIds = dashIds_();
  truthy('09: все тестовые объекты в таблице дэшборда', [ost.id, ano.id, pav.id].every(id => dashIds.indexOf(id) >= 0), dashIds.join(', '));

  // 9. Масштабирование: новый объект подхватывается без правки формул
  const objSh = sheet_('OBJ');
  const newId = 'TEST-9999';
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

  // 9b. Дата закрытия: у проданного объекта дни в продаже перестают расти
  const clRow = appendRow_('OBJ', { id: 'TEST-9998', name: 'Тест закрытия', price: 1000000, area: 50, status: 'Продан', date_sign: addDays_(today_(), -30), close_date: addDays_(today_(), -10) });
  SpreadsheetApp.flush();
  const clObj = readTable_('OBJ').rows.find(o => o.id === 'TEST-9998');
  eq('Закрытие: дни в продаже считаются до даты закрытия', clObj ? clObj.days_on_market : '', 20);
  truthy('Закрытие: проданный объект не на дэшборде «в работе»', dashIds_().indexOf('TEST-9998') < 0);
  objSh.deleteRow(clRow);
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
      const objFolder = ensureObjectFolder_(ost.id, 'ROOT');
      const subs = []; const it = objFolder.getFolders(); while (it.hasNext()) subs.push(it.next().getName());
      truthy('Drive: одна папка объекта с подпапками Стратегия / Отчёты / Материалы',
        ['STRATEGIES', 'REPORTS', 'MATERIALS'].every(k => subs.indexOf(SYS.OBJECT_SUBFOLDERS[k]) >= 0), subs.join(', '));
      eq('Drive: ссылка на папку объекта в 01', readTable_('OBJ').rows.find(o => o.id === ost.id).folder_link, objFolder.getUrl());
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

/** Следующий ID: ACT-0012, TASK-0031 … (максимум существующих + 1). */
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

/** Запись в 12_ИСТОРИЯ. entries: [{sheet, record_id, obj_id, field, old, new, kind, note}] */
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

/** Выбранный объект: активная строка листа с ID объекта, иначе выбор в 07_ОТЧЕТ. */
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
  if (sh.getName() === SHEET_NAMES.DASH && row >= DASH_OBJ_FIRST) {
    const v = sh.getRange(row, 1).getValue();
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
 * 13_Menu — меню «УПРАВЛЕНИЕ ЭКСКЛЮЗИВАМИ».
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(SYS.MENU)
    .addItem('➜ Создать отчёт', 'createReport')
    .addItem('➜ Создать PDF', 'createPdf')
    .addItem('➜ Открыть стратегию', 'openStrategy')
    .addItem('➜ Добавить действие', 'addAction')
    .addItem('➜ Создать план недели', 'createWeekPlan')
    .addItem('➜ Обновить статистику', 'refreshStats')
    .addItem('➜ Проверить просрочки', 'checkOverdue')
    .addItem('➜ Открыть Dashboard', 'openDashboard')
    .addSeparator()
    .addSubMenu(ui.createMenu('Сервис')
      .addItem('⚙ Установить / обновить систему', 'setupSystem')
      .addItem('Создать папки и стратегии для всех объектов', 'createFoldersForAll')
      .addItem('Включить ежедневную сводку на email', 'installDailyCheck')
      .addItem('Выключить ежедневную сводку', 'uninstallDailyCheck')
      .addSeparator()
      .addItem('Загрузить тестовые данные', 'loadTestData')
      .addItem('Запустить самопроверку', 'runSelfTest')
      .addItem('О системе', 'aboutSystem'))
    .addToUi();
}

function aboutSystem() {
  SpreadsheetApp.getUi().alert(SYS.TITLE + ' v' + SYS.VERSION,
    'Логика: ОБЪЕКТ → ДЕЙСТВИЕ → РЕЗУЛЬТАТ → СТАТИСТИКА → ВЫВОД → СЛЕДУЮЩИЙ ШАГ.\n\n' +
    'Вводим данные: 01 (объекты), 02 (стратегия), 03 (действия), 06 (план недели), 14 (гипотезы).\n' +
    'Считается само: 04 (воронка), 05, 07, 09, 11. Историю ведёт скрипт: 12, 13.\n\n' +
    'Цвет заголовка: тёмный — вводится вручную; серо-голубой — формула; светло-серый — заполняет скрипт.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
