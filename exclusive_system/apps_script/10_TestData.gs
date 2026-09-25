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
