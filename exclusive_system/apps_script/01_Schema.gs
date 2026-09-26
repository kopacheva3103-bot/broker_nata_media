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
      F('to_crm', 'Передан в CRM', 'cb', { d: 'Отметьте, когда контакт стал реальным интересом и заведён в CRM.' }),
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
      F('views', 'Просмотры', 'num', { fmt: '#,##0', client: true }),
      F('reach', 'Охват', 'num', { fmt: '#,##0', client: true }),
      F('saves', 'Сохранения', 'num', { fmt: '#,##0' }),
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
