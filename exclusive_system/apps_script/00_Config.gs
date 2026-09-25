/**
 * СИСТЕМА УПРАВЛЕНИЯ ЭКСКЛЮЗИВАМИ
 * 00_Config — константы, настройки, справочники.
 *
 * Правило: значения, которые может захотеть поменять пользователь,
 * живут в листах 08_СПРАВОЧНИКИ и 10_НАСТРОЙКИ, а не в формулах.
 * Здесь — только начальные значения, которыми эти листы заполняются при установке.
 */

const SYS = {
  VERSION: '1.2.0',
  TITLE: 'СИСТЕМА УПРАВЛЕНИЯ ЭКСКЛЮЗИВАМИ',
  MENU: 'УПРАВЛЕНИЕ ЭКСКЛЮЗИВАМИ',
  ROOT_FOLDER: 'СИСТЕМА ЭКСКЛЮЗИВОВ',
  FOLDERS: {
    MASTER: '00_MASTER',
    OBJECTS: '01_OBJECTS',
    TEMPLATES: '02_TEMPLATES',
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
};

const SHEET_ORDER = ['OBJ', 'STR', 'ACT', 'FUN', 'STAT', 'PF', 'REP', 'DICT', 'DASH', 'CFG', 'CTRL', 'HIST', 'ARCH'];

const TAB_COLORS = {
  OBJ: '#37474F', STR: '#37474F', ACT: '#2E7D32', FUN: '#1565C0', STAT: '#1565C0',
  PF: '#2E7D32', REP: '#6A1B9A', DICT: '#9E9E9E', DASH: '#1565C0', CFG: '#9E9E9E',
  CTRL: '#C62828', HIST: '#9E9E9E', ARCH: '#6A1B9A',
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
    { key: 'FOLDER_MASTER_ID', label: 'ID папки 00_MASTER', value: '', sys: true },
    { key: 'FOLDER_OBJECTS_ID', label: 'ID папки 01_OBJECTS', value: '', sys: true },
    { key: 'FOLDER_TEMPLATES_ID', label: 'ID папки 02_TEMPLATES', value: '', sys: true },
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
    { key: 'strategy_status', cols: ['Статус стратегии'], values: [['Черновик'], ['На утверждении'], ['Утверждена'], ['Требует пересмотра']] },
    { key: 'strategy_client_fields', cols: ['Поля стратегии, видимые клиенту'], values: STRATEGY_CLIENT_FIELD_KEYS.map(k => [fieldTitle_('STR', k)]) },
    // Ниже — вычисляемые списки (формулы), руками не заполняются.
    { key: 'weeks', cols: ['Неделя', 'Понедельник', 'Воскресенье', 'Неделя (подпись)'], generated: true },
    { key: 'obj_labels', cols: ['Объект (выбор)'], generated: true },
    { key: 'obj_filter', cols: ['Фильтр объектов'], generated: true },
    { key: 'week_filter', cols: ['Фильтр недель'], generated: true },
  ];
}
