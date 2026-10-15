# TopN Lab (Topnlab / TOP&LAB) and other niche real-estate CRMs: product, UX and agency features

Research date: 2026-10-15. Primary source = topnlab.ru. It is an Angular single-page app, so the text was taken from its JS bundles (main bundle + lazy chunks for /opportunities, /documents/tariffs, /reviews, /about, /news, /safe-deal). These bundles are referred to below as "topnlab.ru (site bundle)". The texts are the company's own marketing and legal copy.

## 1. What is TopN Lab exactly (company, product, target)?

### Takeaway
The user's "TopNLab" is **Topnlab** (spelled "TOP&LAB" / "Top&Lab" in older materials), at topnlab.ru, with the app at crm.topnlab.ru. It is a St Petersburg real-estate CRM/ERP made by **ООО «РЭД» (Реал Эстейт Девелопмент)**, in market since 2015. It targets realtors, real-estate agencies (from about 10 people up to federal networks) and developers. In 2025–2026 the site is closely tied to the **Самолет Плюс** franchise network of Samolet Group: it hosts Samolet Plus offers and a "safe deal" product, which suggests Topnlab is that network's CRM platform.

### Cited Findings
- The trademark "Topnlab" belongs to ООО «РЭД», ИНН 7814217083, KPP 781101001, ОГРН 1157847149888, address: Санкт-Петербург, ул. Зольная, д. 15, стр. 1, помещ. 1Н. Trademarks № 873647 and № 859634. Product links: crm.topnlab.ru (app) and corpback-p.topnlab.ru/join (sign-up). — [topnlab.ru (site bundle; footer and privacy policy)](https://topnlab.ru/)
- "About" page: an "IT компания, которая занимается разработкой программного обеспечения для Девелоперов, Агентств недвижимости и Риэлторов". It says the company was founded in 2014 in St Petersburg, has products "для риэлторов и агентств недвижимости" and "для застройщиков и девелоперов", and calls itself a "лидер рынка автоматизации Риэлторского и Строительного бизнеса". It also says it is a member and official partner of the Российская Гильдия Риэлторов (РГР) and of the St Petersburg realtors' association. — [topnlab.ru/about (site bundle)](https://topnlab.ru/about)
- Management: Арам Пепанян (CEO), Александр Буховский (COO), Полина Рачук (executive director), Александр Довбня (development director). — [topnlab.ru/about](https://topnlab.ru/about)
- Architecture, from a vacancy: SOA, "цифровая платформа разделена на 52 логических блока, которые взаимодействуют между собой через API". The stack is PHP, .NET and Angular. — [topnlab.ru/job (site bundle)](https://topnlab.ru/job)
- Network effect claim on the homepage: "3000+ компании из 327 городов России объединили свои базы в самую большую в стране объектовую базу с делением комиссионного вознаграждения" (this is the МЛС). — [topnlab.ru (site bundle)](https://topnlab.ru/)
- Older figures (2019, flagged as outdated): Top&Lab says it has automated agencies since 2015. It reported clients in 50 cities and "12,000 specialists from 400+ organizations" using it daily. RGR signed a cooperation agreement with Top&Lab in June 2019 (code word "РГР" for a discount). — [grmonp.ru, 29.07.2019](https://grmonp.ru/novosti/crm-sistema-top-lab-my-delaem-rabotu-na-rynke-nedvizhimosti-prostoj-ponyatnoj-i-predskazuemoj-13427/)
- Reference clients from the official reviews page:
  - «Мир квартир» (St Petersburg, 200+ staff) was the first client, from December 2015.
  - «МИЭЛЬ» (3000+ staff) reports "более 70% офисов Московского региона подключены". The review mentions that MIEL's unique processes "потребовали неординарных решений… внесению изменений в ПО".
  - A third reviewer, Сергей Шулик, is from an 800+ staff company.
  - These reviews are undated and probably several years old. — [topnlab.ru/reviews (site bundle)](https://topnlab.ru/reviews)
- Link to Samolet Group in 2026:
  - The topnlab.ru documents section hosts "Оферты Хабов" (a list of ИП/ООО franchise hubs, including «Самолет Плюс МСК Юг», «Самолет Плюс Подольск», «Самолет Плюс Москва ЦАО»).
  - It hosts an offer "Бонус на оплату роялти… за сделки по продуктам Самолет Плюс" (period 01.01–31.12.2026, ended early from 01.10.2026). The offer refers to "CRM системы Организатора" and "Сделка 2.0 – сделка, оформленная через CRM систему Организатора с использованием Сервиса безопасных расчётов".
  - The /safe-deal page is branded "Самолет Плюс". It offers electronic registration in Росреестр, a nominal account at Самолет Банк, and title insurance from СК Ренессанс.
  - A vacancy on the site is written as "Группа «Самолет» — ведущий российский застройщик…". — [topnlab.ru/documents and /safe-deal (site bundle)](https://topnlab.ru/documents)
- A separate case study describes the Samolet Plus agent mobile app (built by TIQUM, delivered December 2022) as a mobile front-end for the client's existing CRM, "built by a 12-person team over 4 years". It does not name the vendor. — [workspace.ru case](https://workspace.ru/cases/mobilnoe-prilozhenie-agenta-samolet-plyus/)

### Inferences
- With high probability, Topnlab is the CRM behind Самолет Плюс (the franchise agency network), or at least shares its infrastructure. This would explain the hubs, royalty and safe-deal documents on topnlab.ru. Taken together with the "TOP&LAB" spelling, there is no other plausible match for "TopNLab". This is an inference; no public press release confirming an acquisition or partnership was found.
- The product has moved from "CRM for agencies" toward a platform/ERP for agency networks and franchises: a business-process builder, departments, a group of companies, an MLS with commission split, and a safe-deal service.

### Gaps
- No public date or terms for the Samolet relationship (ownership or licensing) were found.
- Current user and company counts are not on the site: the "about" page counters render dynamically and were empty in the bundle.

## 2. Visual design of deal/client/object workflows (pipelines, stages, cards, calendars, indicators)

### Takeaway
Topnlab organises work into four role-based registries: Продавцы, Покупатели, Арендодатели, Арендаторы. Each is a filterable table, with a **progress indicator per record** showing the stage of interaction, and a dense one-screen card for each record. A configurable **business-process builder** (stages, transition conditions, deadlines with sanctions) runs on top. The calendar has 5 views.

### Cited Findings
- The "Риелторский блок" works with "продавцами, покупателями, арендаторами и арендодателями". Its sections are: Календарь и задачи, Продавцы и Арендодатели, Покупатели и Арендаторы, Реклама объектов, Парсер, Автоподборы. — [topnlab.ru/opportunities (site bundle)](https://topnlab.ru/)
- Seller list UX:
  - "Таблица со списком клиентов собственников".
  - "Раскройте на одном экране список всех объектов компании с возможностью фильтровать: объекты офиса, отдела, компании, конкретного сотрудника".
  - "Прогресс на каждом объекте показывает на каком этапе взаимодействия находится собственник".
  - "Подробная информация по каждому из собственников на одном экране".
  - "Поиск по фильтрам и на карте". — [topnlab.ru](https://topnlab.ru/)
- Buyer list UX mirrors the seller list:
  - "На одном экране список всех Покупателей компании, с возможностью фильтровать по офису, отделу, компании и конкретному сотруднику".
  - "Прогресс на каждом покупателе показывает на каком он этапе взаимодействия".
  - "Поиск заявок по фильтрам". — [topnlab.ru](https://topnlab.ru/)
- Calendar:
  - "5 видов отображения: День, Неделя, Месяц, Год, Список".
  - Features: "Планирование мероприятий с клиентами", "Делегирование задач", "Отслеживание выполнения статуса задач", "Групповые задачи", "Уведомление органайзера через мобильное приложение". — [topnlab.ru](https://topnlab.ru/)
- Business-process builder:
  - "Конструируйте любые отделы", "Создавайте бизнес-процесс для каждого отдела", "Создавайте удобные карточки и фильтры для этих отделов", "Завязывайте отделы в общий бизнес-процесс компании".
  - Features: "Автоматическое распределение карточек", "Автодействия", "Валидация полей", "Условия перехода с этапа на этап", "Группировка этапов", "Дедлайны", "Санкции при нарушении дедлайнов". — [topnlab.ru](https://topnlab.ru/)
- Related departments: "Оценка, Ипотека, Страхование, HR, Телемаркетинг, Юр. отделы". — [topnlab.ru](https://topnlab.ru/)
- Brand palette, from site CSS (indicative of the product style): blue #318BFF / #136DE1, green #008937, orange #F18200, grey scale; fonts Manrope and SF UI Text. — [topnlab.ru (CSS)](https://topnlab.ru/)
- A third-party (likely AI-generated, partner-link) review describes navigation as "funnel → property → client" with a sidebar. It lists statuses "свободен / бронь / задаток / закрыт" and separate sale and rent funnels. Treat this source as low reliability. — [lakki-crm.ru, 2026](https://lakki-crm.ru/obzor-crm-topnlab-dlya-nedvizhimosti/)

### Inferences
- UX patterns a small agency CRM could copy:
  1. Four role registries (seller, buyer, landlord, tenant) instead of one "contacts" list.
  2. A progress bar or stage chip on every table row.
  3. An "office / department / employee / mine" scope filter at the top of every list.
  4. Stage-transition validation: required fields before moving to the next stage.
  5. Deadline per stage with an overdue flag (a "sanction").
  6. Day / week / month / year / list calendar views.

### Gaps
- No public screenshots or help-center pages describing exact colour coding of stages or overdue indicators were found. The help site help.topnlab.ru loads only a JS shell.

## 3. Real-estate object database: card, photos, map, matching, classifieds export, parser, duplicates

### Takeaway
The object card is a single screen covering media, advertising status and report, owner and agent contacts, comments, history, presentation sending and tasks. Advertising is managed as **packages with budgets per department/agent, moderation before export, and view statistics**. The object search spans three pools: company base, parser (owners' ads) and MLS. Duplicate detection ("пересечения") uses cadastral number, address + type + floor, and phone/email.

### Cited Findings
- Object card ("Карточка объекта подробно — На одном экране собрана вся подробная информация по объекту недвижимости") contains:
  - "Фотографии, видео и планировки"
  - "Отправка в рекламу и отчет"
  - "Контакты ответственного и собственника"
  - "Комментарии личные и публичные"
  - "Журнал и история"
  - "Отправка презентации объекта"
  - "Задачи по объекту с напоминаниями"
  - "Подробная информация по объекту и локации" — [topnlab.ru](https://topnlab.ru/)
- Advertising: "Выгружайте объекты недвижимости из Topnlab на рекламные площадки, такие как Авито, Циан, Домклик и тд." Features:
  - "Создание рекламных пакетов", "Настройка стоимости выгрузки", "Обратные ссылки"
  - "Распределение рекламного бюджета на отделы, офисы и сотрудников"
  - "Модерация рекламы перед выгрузкой", "Уведомление о выходе объекта с рекламы"
  - "Данные по просмотрам" — [topnlab.ru](https://topnlab.ru/)
- MLS / parser:
  - "Получайте доступ ко всем базам клиентов: Объекты компании, Парсер, МЛС".
  - "Объекты с делением комиссии", "Фиксация условий деления комиссии при сделке", "Чат между сторонами сделки".
  - "Склеивание дублей", "Очистка базы от неактуальных объектов", "Поиск списком и на карте". — [topnlab.ru](https://topnlab.ru/)
- Duplicate search ("Поиск пересечений", a news item):
  - Automatic search by cadastral number of the object or plot (internal base + MLS).
  - By address + property type + floor (internal base, "Корзина" = trash/archive, Парсер, МЛС).
  - By contact info, phones and emails (same four pools). — [topnlab.ru/news (site bundle)](https://topnlab.ru/news)
- AI: "Генерация описания объекта" is a paid add-on at 30 ₽ per 10 descriptions. There is also a "Публичная оферта сервиса генераций". — [topnlab.ru/documents/tariffs](https://topnlab.ru/documents/tariffs)
- 2019: a unified agency feed meeting RGR requirements, for export to external sites (outdated). — [grmonp.ru 2019](https://grmonp.ru/novosti/crm-sistema-top-lab-my-delaem-rabotu-na-rynke-nedvizhimosti-prostoj-ponyatnoj-i-predskazuemoj-13427/)
- A third party claims Avito, ЦИАН and Яндекс.Недвижимость sync every 30–60 min, plus N1, Domofond and regional boards. This is not confirmed by the vendor and is low reliability. — [lakki-crm.ru](https://lakki-crm.ru/obzor-crm-topnlab-dlya-nedvizhimosti/)

### Inferences
- Copyable ideas:
  1. Advertising as a budgeted resource with moderation and a "dropped off the ad" alert.
  2. Duplicate matching keyed on cadastral number + address/floor + phone.
  3. Separate "private" and "public" comments on an object.
  4. One search across own base + parser + partner/MLS pool, with a source badge on each result.

### Gaps
- The full list of object fields, and whether Yandex Недвижимость is still supported (Yandex closed its classifieds for secondary listings in some segments), could not be verified from vendor material.

## 4. Client requests (заявки/потребности) and automatic matching

### Takeaway
A buyer or tenant "потребность" is saved as filters. The system auto-matches objects from all three pools, and the agent sends a curated list with per-object comments. Price and description changes are tracked so the agent can follow up.

### Cited Findings
- "Автоподбор объектов для покупателя — Загружайте потребность покупателя в Topnlab, и система автоматически найдет подходящие объекты, а вам останется только выбрать лучшие варианты и предложить покупателю." — [topnlab.ru](https://topnlab.ru/)
- Sub-features: "Сохранение фильтров", "Предложение списка объектов", "Комментарии по каждому объекту", "Изменение цен", "Изменение описания", "Автоподбор объектов по всем базам: База компании, Парсер, МЛС". — [topnlab.ru](https://topnlab.ru/)
- Samolet Plus agent app (likely on this platform): an interactive client presentation. The agent builds a shortlist and sends a web link; the client marks interest and leaves comments, which the agent sees in real time. The app also has map search with a drawn search zone. — [workspace.ru case, Dec 2022](https://workspace.ru/cases/mobilnoe-prilozhenie-agenta-samolet-plyus/)

### Inferences
- The strongest UX idea for a small agency is a shareable selection link where the client can like or dislike and comment on each object, with feedback flowing back into the CRM. Combine it with alerts on price or description changes for objects already shown.

### Gaps
- Matching weighting and tolerance rules (for example ±10% price) are not documented publicly.

## 5. Agent workflows: showings, deals, commissions, documents, mortgage

### Takeaway
Topnlab covers:
- showings via calendar and tasks;
- commission splitting via the MLS;
- documents via a template engine with multi-entity numbering and signers;
- a "simple electronic signature" module;
- mortgage, valuation and insurance as configurable departments;
- under Samolet Plus, a "Сделка 2.0" safe-deal flow (Росреестр e-registration, nominal account, title insurance).

### Cited Findings
- Documents: "Формируйте любые документы автоматически, Разные юридические лица, Подписанты, Логики нумерации, Шаблонизаторы". Features: "Шаблонизатор", "Контроль подписания", "Путь документа", "Автоматическая нумерация", "Мультиюридические лица", "Подписанты с документом основания и датой", "выгрузка в pdf". — [topnlab.ru](https://topnlab.ru/)
- There is a separate licence for the program module «Простая электронная подпись» of Topnlab. — [topnlab.ru/documents (site bundle)](https://topnlab.ru/documents)
- Safe deal (Самолет Плюс on topnlab.ru):
  - three services: Росреестр e-registration, settlement via a nominal account at Самолет Банк, and title insurance (СК Ренессанс, 1–10 years);
  - funds are released on the 3rd working day after registration;
  - requires a УКЭП via «Госключ».
  - A service "Проведение сделки в офисе" is billed at 1,000 ₽ per processed application. — [topnlab.ru/safe-deal](https://topnlab.ru/safe-deal)
- Mortgage in the Samolet Plus offer: "Ипотечная сделка с КВ от банка", subsidised rates, and DDU insurance via Совкомбанк, all tracked as deal types in the CRM. — [topnlab.ru/documents (offer)](https://topnlab.ru/documents)

### Inferences
- For a small agency, the reusable pieces are: commission-split terms fixed on the deal record, a document path/status (draft → on signing → signed), and auto-numbered templates with a signer's power-of-attorney basis.

### Gaps
- No public description was found of a showing-specific object (показ with feedback form) or of agent commission and payroll calculation screens in Topnlab.

## 6. Manager reports / KPI / analytics

### Takeaway
A report builder with "500+ metrics": dynamics, comparisons, plan/fact, pie charts, tables, and drill-down. Third parties rate analytics as weaker than the product's core real-estate features.

### Cited Findings
- "Сформируйте свою аналитику… Табличные отчеты, Диаграммы, Планы/Факты, Сравнительные анализы", "Более 500 метрик", "Динамика", "Пирог", "Активные метрики для детализации показателя". "Конструктор диаграмм" is a paid add-on. — [topnlab.ru](https://topnlab.ru/), [tariffs](https://topnlab.ru/documents/tariffs)
- The third-party review scores analytics 6/10 and customisation 5/10. Low reliability. — [lakki-crm.ru](https://lakki-crm.ru/obzor-crm-topnlab-dlya-nedvizhimosti/)

### Inferences
- Clickable KPI tiles that drill down to the underlying records ("активные метрики") plus plan/fact per agent cover most needs of a 5–15 agent agency.

### Gaps
- No list of the standard KPIs was found.

## 7. Mobile app, messengers, telephony

### Takeaway
There are native iOS and Android apps with push notifications. The internal messenger has a news feed. The call center module provides an operator entry point, IP telephony, call recording, distribution scenarios and auto-linking of calls to cards. External messengers (WhatsApp, Telegram) are not confirmed by the vendor; there is a paid "Омниканальный чат" add-on.

### Cited Findings
- "Полнофункциональные приложения для риэлторов на iOS и Android с поддержкой пуш-уведомлений". The "Новая функциональность: обновили наши мобильные приложения" news item is undated. — [topnlab.ru](https://topnlab.ru/)
- Call center: "Операторы принимают звонки, создают карточки клиентов и распределяют по сотрудникам". Features: "Интеграция с ip телефонией", "Запись разговоров", "Разные сценарии распределения звонков/карточек", "Переадресация / удержание", "Определитель номера", "Автопривязка звонка к карточке". — [topnlab.ru](https://topnlab.ru/)
- Internal chat: "Групповые чаты, Реакции, Отправка файлов и фото, Пересылка сообщений и контактов, Постановка задач". — [topnlab.ru](https://topnlab.ru/)
- Paid add-ons: "Омниканальный чат", "Конструктор диалоговых скриптов", "Система распределения звонков". IP telephony connection costs 10,000 ₽ one-off. — [topnlab.ru/documents/tariffs](https://topnlab.ru/documents/tariffs)
- A third party lists Mango, Beeline, Asterisk, WhatsApp API, Telegram bot, 1C and a REST API. Unverified, low reliability. — [lakki-crm.ru](https://lakki-crm.ru/obzor-crm-topnlab-dlya-nedvizhimosti/)

### Gaps
- Supported telephony providers and messenger channels are not confirmed by the vendor.

## 8. Pricing (2025–2026)

### Takeaway
The official tariff document is current: it references VAT 22%, i.e. 2026. Prices are excl. VAT and paid **quarterly** (3 months in advance):
- **«Микро»**: 7,000 ₽/month for 5 users, +2,000 ₽ per extra user.
- **«Старт»**: 13,500 ₽/month for 30 users.
- User packs (only above 30 users): «Мини» 8,000 ₽ per +30 users; «Бизнес» 90,000 ₽ per +1,000 users.
- Most functional add-ons cost +10% of the base price each.

### Cited Findings
- "Базовая стоимость (тариф + пакеты с пользователями) + стоимость за подключение дополнительных функциональных блоков. Оплата производится за 3 месяца." — [topnlab.ru/documents/tariffs](https://topnlab.ru/documents/tariffs)
- Tariffs: «Старт» 13,500 ₽/month (30 users); «Микро» 7,000 ₽/month (5 users), expandable at +1 user = 2,000 ₽/month. — [topnlab.ru/documents/tariffs](https://topnlab.ru/documents/tariffs)
- Examples: Старт + 1 Мини = 21,500 ₽ (60 users); + 2 Мини = 29,500 ₽ (90 users); Старт + Бизнес = 103,500 ₽ (1,030 users). — [same](https://topnlab.ru/documents/tariffs)
- Add-ons at 10% of base per month each: Контакт центр; Формирование документов + 1 юр.лицо; Неограниченное количество юрлиц; Конструктор диалоговых скриптов; Система распределения звонков; Омниканальный чат; Конструктор диаграмм. Others:
  - «Группа компаний»: 10%, minimum 20,000 ₽
  - «Сота»: 10,000 ₽/month
  - «Коробочное решение» (on-premise): 20,000 ₽/month, plus 50,000 ₽ connection
  - «Партнерские продажи»: 3% of cashback
  - AI descriptions: 30 ₽ per 10 — [same](https://topnlab.ru/documents/tariffs)
- One-off fees: IP telephony 10,000 ₽; branded presentations 10,000 ₽; branded reports 10,000 ₽; re-configuration of business processes from 10,000 ₽. — [same](https://topnlab.ru/documents/tariffs)
- Conflict: lakki-crm.ru claims "1,500–1,800 ₽ per agent seat", a "Самозанятый" tier and a 14-day trial. This contradicts the official document and should be disregarded. — [lakki-crm.ru](https://lakki-crm.ru/obzor-crm-topnlab-dlya-nedvizhimosti/)

### Inferences
- Topnlab's pricing is flat per company rather than per seat: 30 users for 13,500 ₽. That makes it cheap per head for 10–30 agents and relatively costly for 1–4 people.

## 9. Reviews: strengths and weaknesses

### Takeaway
Independent reviews are scarce: review aggregators show zero reviews. The positives come from vendor-curated testimonials and RGR endorsements: domain depth, a support team willing to customise, and big-network adoption (MIEL, Мир квартир). Reported negatives, mostly from low-reliability sources, are customisation effort, a learning curve, and a mobile app with less functionality than the web version.

### Cited Findings
- RGR (2019): users praise "техподдержку, быструю обратную связь и готовность адаптироваться под бизнес-процессы". Андрей Хромов (RGR VP): «удобный, функциональный, а главное простой в понимании». — [grmonp.ru 2019](https://grmonp.ru/novosti/crm-sistema-top-lab-my-delaem-rabotu-na-rynke-nedvizhimosti-prostoj-ponyatnoj-i-predskazuemoj-13427/)
- MIEL testimonial: the team "очень хорошо разбирается в тонкостях риэлторского бизнеса", but MIEL's processes required "огромных совместных усилий по внесению изменений". — [topnlab.ru/reviews](https://topnlab.ru/reviews)
- crmrealestate.ru shows 0 reviews and a 0/5 rating. — [crmrealestate.ru](https://crmrealestate.ru/topnlab_crm/)
- Search summaries of rank-crm.ru and crmre.ru say there are too few reviews to form an opinion (crmre.ru was unreachable). Yandex Maps and 2GIS have office reviews (positive, possibly curated). — [rank-crm.ru](https://rank-crm.ru/product/topnlab/), [Yandex Maps](https://yandex.com/maps/org/topnlab_ru/195435153502/reviews/), [2GIS](https://2gis.ru/spb/firm/70000001048223583/tab/reviews)
- lakki-crm (low reliability) lists these cons: limited customisation, weaker analytics, a less complete mobile app, the interface "confusing the first 2 weeks", and updates breaking integrations. — [lakki-crm.ru](https://lakki-crm.ru/obzor-crm-topnlab-dlya-nedvizhimosti/)

### Gaps
- No vc.ru or realtor-forum discussions of Topnlab were found in this pass.

## 10. Other Russian niche CRMs: UX ideas unique to real estate

### Takeaway
Joywork and ReBPM, both agency-focused, add ideas Topnlab's site does not emphasise: owner-parsing with "fake" filtering, watermark removal, one-click branded PDF presentations, an owner-facing advertising report cabinet, and a new-build catalog widget.

### Cited Findings
- **Joywork** (joywork.ru):
  - "Автоматический подбор клиентов и объектов", including a reverse match: when an object is added, the system suggests matching clients.
  - Export to about 200 sites (Avito, ДомКлик, Циан, Restate, Domofond, Яндекс).
  - Scanning of owner ads with "фейки" filtered out.
  - "Презентации в один клик" (PDF with the agency logo), and watermark removal from listing photos.
  - "Отчет о размещении" (views and calls per board) and an owner-facing "Кабинет клиента".
  - Embeddable "Каталог новостроек" widget; e-signature by SMS (ПЭП, 63-ФЗ); ЕГРН extracts; valuation on 150 parameters; funnels with a checklist at each stage.
  - Pricing per employee per month: 1,200 ₽ (up to 6), 619 ₽ (up to 20), 297 ₽ (up to 100). Over 500 companies.
  - The date of the pricing is not shown; aggregators report different figures (e.g. 1,290 / 3,490 / 14,990 ₽ per month on toolfox.ru). — [joywork.ru](https://joywork.ru/), [toolfox.ru](https://toolfox.ru/services/s/joywork)
- **ReBPM** (rebpm.ru):
  - A shared object base with configurable access levels.
  - Owner contacts collected "каждые 5 минут".
  - "Автоматические подборки клиентам" with alerts on new matches.
  - Advertising on 150+ boards; removal of Avito/Cian logos and AI photo enhancement.
  - Branded templates for presentations and documents; price history and analytics; comparative market analysis.
  - A ready agency website; iOS and Android app.
  - Satisfaction survey (14.05.2021, old): 71% fully satisfied.
  - The a2is.ru catalog gives ReBPM 3.5/5; a 2022 review complains of slow support and manual object transfer. — [rebpm.ru](https://rebpm.ru/), [a2is.ru](https://a2is.ru/catalog/programmy-dlya-agentstva-nedvizhimosti/compare/kontur-nedvizhimost/rebpm)

### Inferences
- A combined copy-list for a small agency's custom CRM:
  1. Role registries (seller, buyer, landlord, tenant) with a stage-progress chip.
  2. Two-way auto-matching (request → objects, and new object → requests) with change alerts.
  3. A shareable client selection page with like and comment.
  4. A one-click branded PDF presentation.
  5. Feed export with moderation, per-board stats and a "dropped off" alert.
  6. Duplicate detection by cadastral number, address + floor, and phone.
  7. An owner report page (views and calls per board).
  8. Day / week / month / list calendar.
  9. Plan/fact KPI tiles with drill-down.

### Gaps
- A chessboard ("шахматка") of new-build units is not described on Topnlab's or Joywork's main pages. It is mainly a developer-CRM feature (Profitbase, Macro), which was not researched here.
- Intrum and Квартус were not researched due to the tool-call budget.
