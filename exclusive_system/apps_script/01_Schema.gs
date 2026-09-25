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
      F('folder_link', 'Ссылка на папку объекта', 'sys', { w: 120, d: 'Папка объекта в 01_OBJECTS: внутри «Стратегия», «Отчёты», «Материалы».' }),
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
