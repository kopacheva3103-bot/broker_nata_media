# Integrations and pipeline UX for a custom Russian real-estate agency CRM (Django), state as of Oct 2026

Research method note: ~20 tool calls. Official portals were hard to reach: cian.ru and hc.cian.ru returned Yandex SmartCaptcha, and developers.avito.ru could not be fetched. Many findings therefore come from search-result excerpts, integrator or connector pages (ApiMonster, Bitrix24 Marketplace, vendor blogs) and the Yandex Realty help center. Anything marked "(background, unverified)" comes from the researcher's prior knowledge and has no fetched source. The report writer should treat it as a hypothesis to check, not as a cited fact.

## 1. Listing portals (ЦИАН, Авито, Домклик, Яндекс Недвижимость): feeds, leads, costs, API access

### Takeaway
Publishing listings is a solved, cheap problem for a Django CRM. Each portal pulls an XML feed from a public URL that the agency hosts: ЦИАН uses "Циан 2.0", Авито uses Autoload (formatVersion 3), Яндекс uses YRL, and Домклик accepts a Циан-format feed. Building one serializer per portal is a few days of work. Receiving leads is harder and less standardized. Авито has an official OAuth API with messenger webhooks, available only to paid business accounts. For ЦИАН no public lead or chat API for agencies could be confirmed. Calls from all portals are best captured through the agency's own call-tracking numbers in the listings.

### Cited Findings
**ЦИАН**
- Only feeds in the "Циан 2.0" format are accepted for connection. The version tag is `Feed_Version` with the value 2. The official technical-requirements page is old, so check that it is still current. — [cian.ru xml_import/doc (search excerpt)](https://www.cian.ru/xml_import/doc/)
- Feed upload is activated only on the agency's main account. Listings are assigned to individual agents with the `SubAgent` tag. Creating an employee account through SubAgent requires every element except AvatarUrl. — [cian.ru xml_import/doc (search excerpt)](https://www.cian.ru/xml_import/doc/)
- Feeds are processed only when the account balance is positive. With a zero balance the order is not processed. — [cian.ru (search excerpt)](https://www.cian.ru/xml_import/doc/)
- Crawl frequency: ЦИАН officially says only "мы регулярно проверяем данные из фидов". The figures that circulate come from third parties: Левиан says several times a day (03:00, 09:00, 15:00 and 21:00), and other sources say "every few hours". "Once an hour" is not an official ЦИАН rule. — [cian.ru](https://www.cian.ru/xml_import/doc/); [Левиан](https://moscow.levian.ru/xml-feed/cian/); [DataLopata](https://datalopata.ru/blog/tsian-fid-polnoe-rukovodstvo-po-avtomaticheskoj-vygruzke-objavlenij-nedvizhimosti/)
- A public GitHub repo has a single "Циан 2.0" XML feed used for both ЦИАН and Домклик. This suggests Домклик accepts the ЦИАН feed format. — [GitHub kp-schastye-feed](https://github.com/dpoleschukbm-creator/kp-schastye-feed)
- ЦИАН's published API is for new-build developers: a "call auction" where they create or deactivate auctions, view statistics and calculate bids. Statistics refresh every 30 min. It is not clear whether agencies can use it. — [ЦИАН: API по новостройкам](https://www.cian.ru/stati-api-po-novostrojkam-novye-vozmozhnosti-dlja-zastrojschikov-314144/)
- A third-party connector (ApiMonster) offers "ЦИАН → CRM" sync of chats, messages and leads. Its webhook fields include chatId, offerId, messageId, userId, message.content.text, offer.address and offer.price. This suggests some chat API exists, but the documentation is not public. — [ApiMonster Cian](https://apimonster.ru/connector/bundle/cian/closeup/)
- Agencies on ЦИАН pay for unique calls. The source is a secondary description with no details. — [toolfox (search excerpt)](https://toolfox.ru/services/s/cian/alternatives)

**Авито**
- Autoload is "the official mechanism for bulk uploading". Авито reads the XML from a public URL on a schedule, every few hours (no exact interval given). The example uses `formatVersion="3" target="Avito.ru"` with fields for address, rooms, area, floor, price, description, images and contact phone. — [kalinkindev.ru](https://kalinkindev.ru/blog/avtomatizaciya-avito-dlya-agentstv-nedvizhimosti/)
- Crawl interval, tariffs and eligibility conflict between sources:
  - One source says the default fetch is every 3 hours, and that Autoload is available only to ООО or ИП and requires "Компания" account status.
  - For the categories "Недвижимость — Продам/Сдам" and "Транспорт", Autoload is included even in the "Базовый" tariff. Other categories need "Расширенный" (cited as 2,000 ₽/month) or "Максимальный".
  - [joywork.ru](https://joywork.ru/avtovygruzka-nedvizhimosti-na-avito.php); [bidline.ru](https://bidline.ru/autoload-avito); [massposting.com](https://massposting.com/post/avtozagruzka-obyavleniy-na-avito) (aggregated in a search summary, so verify)
- When Autoload is run through the API, it can be triggered at most once per hour. The upload report appears in the "Автозагрузка" section after about an hour and lists per-listing errors. The same article warns that from September 2026 old API methods may return incomplete data (excerpt truncated, unverified). — [spark.ru](https://spark.ru/startup/picktech/blog/381867/avtomatizatsiya-avito-obyavleniya-i-perepiski-mdash-raznie-instrumenti)
- Avito Messenger API, based on a Bitrix24 connector's description:
  - It connects only from paid Авито accounts, using a Client ID and Client Secret from the account settings.
  - Text and images (up to 40 MB) can be received and sent. Voice messages, geolocation, delivery status and ad info can only be received. Quoting is not supported.
  - The connector itself costs 0 ₽ for 1 account and 500 ₽/month per account for 2–5 accounts.
  - [Bitrix24: Avito API для открытых линий](https://www.bitrix24.ru/apps/app/asmo.avito_api/)
- Webhook events "Сообщение менеджера" and "Сообщение бота" exist, as do Авито call-tracking connectors. — [ApiMonster Avito webhook](https://apimonster.ru/connector/trigger/avito/event/new-message-manager/); [ApiMonster Avito calltracking](https://apimonster.ru/connector/bundle/avito/calltracking/)
- In February 2026 Авито updated the Avito Pro API for advertising agencies: spend statistics and checking businesses by ИНН for up to 100 sellers. It covers the "Товары", "Услуги" and "Спецтехника" categories (not real estate) and is available only to partner-program members. — [sostav.ru](https://www.sostav.ru/publication/avito-rasshiril-funktsionalnost-api-dlya-reklamnykh-agentstv-81942.html); [click.ru](https://blog.click.ru/market-news/na-avito-zapushhen-obnovlennyj-api-dlya-reklamnyx-agentstv/)

**Яндекс Недвижимость**
- Format and hosting:
  - YRL is an XML format: UTF-8, root element `<realty-feed>`, one `<offer>` per listing, optional `<generation-date>`, dates in ISO 8601 (+03:00 for Moscow).
  - The only allowed markup in text is `<br>`. Repeated values such as photos use repeated tags.
  - The feed must sit on the agency's own domain and be reachable over HTTP 24/7.
  - Each listing is one property. Edit it in place and keep the same `internal-id`; do not delete it and create a duplicate.
  - Agency listings must state the agency explicitly.
  - [Yandex Realty: общие требования](https://yandex.ru/support/realty/partners/requirements.html)
- Actuality rules:
  - At least 80% of sale listings and 70% of rental listings must be current.
  - A listing counts as outdated if the property is sold, the phone cannot be reached, the price differs significantly, or the address or other details don't match.
  - Price must be above the regional minimum for the segment.
  - Minimum publication periods apply, e.g. a secondary-market flat for sale: 90 days from creation and 45 days from update.
  - [Yandex Realty requirements](https://yandex.ru/support/realty/partners/requirements.html)
- The free "Минимальный" tariff does not cover new builds or assignments (переуступка). The service accepts links to existing Авито, ЦИАН and Домклик feeds. Feeds are checked by quality control within a few days. Data is as of 30.09.2026 (search summary). — [Yandex Realty](https://yandex.ru/support/realty/partners/requirements.html); [quickstart](https://yandex.ru/support/realty/partners/quickstart.html)

**Домклик**
- No official Домклик agency feed specification or lead API was found. The only evidence is that the ЦИАН 2.0 feed is reused for Домклик ([GitHub](https://github.com/dpoleschukbm-creator/kp-schastye-feed)) and that Яндекс imports Домклик feed links ([Yandex](https://yandex.ru/support/realty/partners/requirements.html)).

**Ready-made multi-portal tools**
- Bitrix24 Marketplace has real-estate CRM templates with board uploads, e.g. "CRM Агентство Недвижимости + Выгрузка на доски объявлений", Quick Deal (200+ portals) and the real-estate-only service afy.ru. — [Bitrix24 exdigital.crm](https://www.bitrix24.ru/apps/app/exdigital.crm); [spark.ru](https://spark.ru/startup/picktech/blog/381867/avtomatizatsiya-avito-obyavleniya-i-perepiski-mdash-raznie-instrumenti)

### Inferences
- Build cost: one Django model, `Listing`, plus four template- or lxml-based serializers (ЦИАН 2.0, Авито v3, YRL, and the ЦИАН format reused for Домклик). Serve them at stable public URLs, cached and regenerated on save or every N minutes. Estimate 3–7 developer-days, then iterate on portal validation reports.
- Track `internal-id`/`ExternalId` stability and a per-listing "actual" flag, so that Яндекс's 80/70% actuality rule and similar ЦИАН and Авито moderation checks can be enforced in the CRM. For example, auto-unpublish a listing when its deal stage is "Сделка закрыта".
- Lead intake by priority:
  1. Calls: substitute call-tracking or virtual numbers in each feed's phone field (per portal or per listing), so every portal call arrives through the telephony webhook. This is the most reliable and cheapest route.
  2. Авито chats: use the official Messenger API (OAuth client_credentials plus webhook subscription), or a paid connector.
  3. ЦИАН chats: use an integrator connector or email notifications, because no public API was confirmed.
  4. Email parsing of portal notifications as a fallback (an IMAP poller in Celery).
- (background, unverified) Авито API access uses OAuth2 client_credentials. The Messenger API with webhooks (v3) requires a paid tariff/subscription for business accounts. Rate limits apply. ЦИАН has had an agency API, "API Циан для агентств" (feed reports, statistics, chats), available on request to paid accounts. Confirm both on developers.avito.ru and with a ЦИАН account manager.

### Gaps
- No official 2026 ЦИАН or Авито agency price lists (per-listing, per-call or packages) were obtained; the official sites were captcha-blocked.
- No official Avito API docs: rate limits, webhook schema, and whether Autoload v3 is still current for real estate in 2026.
- The September 2026 Авито API deprecation claim is unverified (truncated source).
- Домклик: no agency feed spec, tariffs or lead API found.
- Яндекс Недвижимость: no lead/call API found. Whether its call tracking substitutes numbers was not checked.

## 2. Telephony and call tracking (Mango Office, UIS/CoMagic, Calltouch, Zadarma, Билайн/МТС)

### Takeaway
All major Russian cloud PBX providers push call events (start, answer, end, missed) to an HTTP webhook and expose recordings via links or an API. Integrating one provider with Django means a webhook endpoint plus a recording downloader, roughly 2–5 developer-days. Zadarma is the cheapest and simplest. Mango and UIS are the mainstream options for agencies.

### Cited Findings
- Mango Office:
  - Webhook events cover incoming, outgoing and missed calls plus recording links.
  - Event fields include entry_id, call_id, the event time in UTC+3, seq (notification sequence number) and call_state.
  - Common CRM scenarios: create a contact or deal on an incoming call and attach the recording to the client card.
  - [ApiMonster Mango](https://apimonster.ru/connector/service/mango); [ApiMonster Mango webhook](https://apimonster.ru/connector/bundle/mango/webhook)
- Mango Office has four tariffs, starting at 1,600 ₽/month. The corporate tariff is priced individually (May 2026 review; verify on the official site). — [Яндекс Практикум, 26.05.2026](https://practicum.yandex.ru/blog/obzor-servisa-mango-office/)
- Zadarma event notifications:
  - Configured in the account under Settings → Integrations & API → Event Notifications ("PBX Calls" URL).
  - Events: NOTIFY_START, NOTIFY_END, NOTIFY_OUT_START/END, NOTIFY_RECORD (recording ready), among others.
  - [ApiMonster Zadarma NOTIFY_START](https://apimonster.ru/connector/trigger/zadarma/event/NOTIFY-START/); [NOTIFY_RECORD](https://apimonster.ru/connector/trigger/zadarma/event/NOTIFY-RECORD/); [helloclient](https://learn.helloclient.by/en/integrations/zadarma)
- Zadarma's official n8n integration is free and offers start, answer, end and missed-call triggers. — [zadarma.com n8n](https://zadarma.com/en/support/instructions/n8n/)
- Telfin offers a ready integration of the MAX messenger with amoCRM and Bitrix24, so telephony vendors are bundling messengers too. — [sostav.ru](https://www.sostav.ru/publication/gotovaya-integratsiya-max-s-amocrm-i-bitriks24-ot-telfin-80627.html)

### Inferences
- Design a provider-agnostic `CallEvent` model: provider, external call id, direction, from/to, agent extension, timestamps, status, recording URL or file, and the linked lead or deal. Write one adapter per provider.
- Download recordings into storage hosted in Russia rather than keeping provider links, which often expire. This also bears on 152-ФЗ (see section 4).
- Click-to-call from the card (a provider callback API) is a cheap, high-value quick action.
- Call tracking: dynamic numbers for the website plus static numbers per portal make portal calls attributable without any portal API.

### Gaps
- No verified 2026 pricing for UIS/CoMagic, Calltouch, Zadarma, Билайн Облачная АТС or МТС Exolve/виртуальная АТС; their official pricing pages were not fetched.
- No official Mango or UIS API documentation was fetched (only connector descriptions). The researcher's background: Mango uses the "VPBX API" with sign = sha256(key+json+salt) events at /events/call and /events/summary, and UIS has a Call API, Data API and notifications. Unverified.
- Recording retention periods and default storage costs per provider are unknown.

## 3. Messengers in Russia 2025–2026: MAX, Telegram, WhatsApp, VK

### Takeaway
Since August 2025, WhatsApp and Telegram calls have been restricted, and regulators have threatened a full WhatsApp block (as of the sources found, not executed). MAX is the state-backed alternative with a Bot API, but onboarding requires business verification and bot moderation, and a bot cannot reach users who have not written first (not confirmed). A custom CRM should treat messengers as pluggable channels. Telegram Bot API and MAX Bot API are buildable in-house. WhatsApp is best reached through an aggregator (Wazzup, Umnico, i2crm, Radist, ChatApp), or avoided.

### Cited Findings
- In August 2025 Роскомнадзор partially restricted voice calls in WhatsApp and Telegram; other functions were not blocked. — [vbr.ru 13.08.2025](https://www.vbr.ru/novosti/tehnologii/2025/08/13/roskomnadzor-zablokiroval-zvonki-s-telegram-i-whatsapp/); [3dnews](https://3dnews.ru/1127574/roskomnadzor-chastichno-zablokiroval-zvonki-v-telegram-i-whatsapp)
- РКН announced phased restrictions on WhatsApp and Telegram (reported October 2025) and warned of a full WhatsApp block if the law continues not to be complied with. Duma deputy Андрей Свинцов said WhatsApp would be fully blocked in 2026 and Telegram would not; this is a forecast, not a decision. — [profile.ru](https://profile.ru/?p=1807984); [ppc.world](https://ppc.world/news/whatsapp-otklyuchat-v-2026-godu-telegram-trogat-ne-budut-deputat-gosdumy/)
- Status as of Oct 2026: no confirmed official full WhatsApp block was found. Verify before relying on WhatsApp.
- MAX for business (Bitrix24 journal, 18.08.2026):
  - Registration and verification at business.max.ru take from minutes to 48 h. Verification is via Госуслуги, T-Business ID or Alfa ID, by the director or another signatory.
  - A bot must pass moderation before it gets an API token.
  - Channels are one-way, so CRM integration requires a bot.
  - MAX controls the volume of mass mailings, and misuse can lead to blocking.
  - The API changes often.
  - The FAQ contradicts the main text: it says only ЮЛ/ИП qualify and that a company must also publish an app in RuStore or be registered on МСП.РФ.
  - One customer quote says up to 5 bots per company.
  - [Bitrix24: CRM для MAX](https://www.bitrix24.ru/journal/crm-dlya-max/)
- How CRMs connect MAX: through aggregators (Wazzup, Umnico, i2crm, ChatApp, Radist.Online) for a subscription fee, or directly through the MAX Bot API. Bitrix24 recommends the direct route for larger, custom setups. A claim of 125 million installs comes from marketing material. — [Bitrix24](https://www.bitrix24.ru/journal/crm-dlya-max/); [callibri.ru](https://callibri.ru/blog/messendzher-max-dlya-biznesa); [vc.ru Wazzup](https://vc.ru/services/2715640-integratsiya-bitrix24-i-max-cherez-wazzup); [Callibri MAX–amoCRM](https://callibri.ru/crm-chat/max-amocrm)

### Inferences
- Implementation priority for a Django CRM:
  1. Telegram Bot API: free, well documented, webhooks; 1–2 days.
  2. MAX Bot API: similar effort once verification is done; 2–4 days.
  3. Авито chat (see section 1).
  4. WhatsApp only through an aggregator (Wazzup-like, about a few thousand ₽/month per number per background knowledge, unverified), because the official WhatsApp Business API is unavailable to Russian companies (unverified).
  5. VK: Callback API for community messages (background, unverified, not researched).
- Use a unified "inbox" model, `Conversation`/`Message` with a channel field, linked to the client's card timeline.

### Gaps
- MAX Bot API technical limits (rate limits, whether bots can message first, file sizes) were not found.
- VK community messages API and its CRM integration were not researched.
- 2026 aggregator pricing (Wazzup and others) was not verified.

## 4. Pipeline UX patterns that increase agent discipline

### Takeaway
The proven pattern set is:
- a kanban per deal type (buy, sell, rent, commercial) with sums and counts per column;
- red "rotting" highlighting when a deal sits in a stage past its SLA;
- a hard "no next task" warning, because 67.5% of deals without any activity is a typical real-world failure;
- mandatory fields per stage and a required loss reason from a fixed list;
- a "мой день" agent view, and manager dashboards that list deals without tasks or with overdue tasks.

### Cited Findings
- Pipedrive "rotting":
  - Deals not updated for longer than a per-stage rotting period are highlighted red on the kanban tile.
  - The period is configured per stage with the pencil icon in pipeline view.
  - The timer resets on deal updates, completed activities or email actions.
  - Scheduling a new activity or editing the deal restores it.
  - Rotting ignores the next-activity date, so a deal with an activity scheduled far in the future can still rot.
  - Third-party claims of rotting alerts through Insights conflict with the official article.
  - [Pipedrive KB: The Rotting feature](https://support.pipedrive.com/en/article/the-rotting-feature)
- Real-estate agency case: 1,730 of 2,564 active deals (67.5%) had no activity or task at all, and another 13.3% were overdue. Mandatory task binding is the remedy. — [Bitrix24 partner case](https://www.bitrix24.ru/partners/case/28207338/)
- Real-estate CRM templates use separate pipelines by deal type (sale, purchase, rent), each with its own stages. Commercial real estate needs its own pipeline because nearly every stage differs. — [Bitrix24 apps (citrus/zenova)](https://www.bitrix24.ru/apps/app/citrus.crm_nedvizhimost); [workspace.ru amoCRM case](https://workspace.ru/cases/rost-pribyli-v-agentstve-nedvizhimosti-na-25-za-schet-vnedreniya-amocrm/)
- Loss reasons are often vague ("неактуально, дорого, нет бюджета, не дозвонились, выбрали конкурента, думает"). Fix a reference list so a deal cannot be closed without a specific reason. — [sostav.ru: где теряются сделки](https://www.sostav.ru/blogs/280282/93490)
- Managers want real-time visibility of subordinates' deals and KPIs. — [Bitrix24 app zenova](https://www.bitrix24.ru/apps/app/zenova_pro.crm_nedvizhimost_an); [Контур: CRM для АН](https://kontur.ru/articles/6247)

### Inferences (design recommendations, synthesis rather than sourced facts)
- Kanban card: client, object, budget or commission, agent avatar, days in stage, and next-task date. The badge is red if the task is overdue and orange or striped if there is no task. The column header shows count and Σ commission.
- Stage SLA aging: configure max days per stage, with green, yellow and red background. Unlike Pipedrive, treat "no future task" as its own violation, separate from aging.
- Blocking rules:
  - A stage move requires its mandatory fields, e.g. "Показ" requires an object and a date; "Задаток" requires the amount and a document scan.
  - Closing a deal as lost requires a reason from the reference list plus a comment.
  - Saving a deal without a next task triggers a modal prompting the agent to schedule one.
- Quick actions on card hover: call (click-to-call), write (channel picker), add task, move stage, mark as lost.
- Card timeline: a single feed of calls with player, chats, tasks, stage changes, comments and documents.
- WIP limits per agent per stage, e.g. at most N active "Показ" deals. Use these softly, as warnings.
- "Мой день" agent page: overdue tasks first, then today's tasks, new unprocessed leads with a timer since arrival (speed-to-lead), deals without tasks, and today's showings on a map or list.
- Manager panel:
  - a leaderboard of agents by calls, showings, deposits and closed commission;
  - a funnel conversion per agent;
  - counters for deals without tasks, overdue tasks and leads not taken within X minutes;
  - missed calls without a callback.
- Gamification: a weekly rating and plan-vs-actual progress bars. Keep it transparent and activity-based (showings, deposits), not only revenue.
- Django implementation: kanban through HTMX or Alpine with SortableJS, which is cheap. Rules as server-side stage validators. SLA computed from a `stage_entered_at` timestamp. Daily digests via Celery beat.

### Gaps
- No Russian-language empirical studies (A/B tests or measured conversion lift) of specific UX patterns were found. Evidence is vendor cases and Pipedrive documentation.
- Gamification effectiveness for realtors in particular was not researched or sourced.

## 5. Data protection (152-ФЗ) for client data and call recordings

### Takeaway
A custom CRM storing client names, phones, passport or deal data and call recordings makes the agency a personal-data operator. Consequences:
- databases must be located in Russia;
- consent must be a standalone document (since 1 Sep 2025);
- the agency must notify РКН as an operator;
- leaks carry fines of millions of rubles, with turnover-based fines for repeat leaks.

Hosting the CRM, its backups and call recordings on Russian servers (Yandex Cloud, Selectel, VK Cloud, etc.) is effectively mandatory.

### Cited Findings
- Consent must be a separate document since 1 Sep 2025. It cannot be hidden in a user agreement or be a pre-ticked checkbox. Fines for missing or non-specific consent reach 700,000 ₽, and 1.5 million ₽ for a repeat violation within a year. — [Unisender](https://www.unisender.com/ru/blog/personalnye-dannye-hranenie-i-nakazanie/)
- Leak fines for legal entities under КоАП 13.11:
  - 3–5 million ₽ for 1,000–10,000 subjects (or 10,000–100,000 identifiers);
  - 5–10 million ₽ for 10,000–100,000 subjects (or 100,000–1 million identifiers);
  - 10–15 million ₽ for more than 100,000 subjects (or more than 1 million identifiers);
  - up to 20 million ₽ for biometric data.
  - Failing to notify РКН of a leak: up to 3 million ₽ for legal entities.
  - Repeat leaks: 0.1–3% of revenue, with a range of 20–500 million ₽.
  - The amendments were signed 30.11.2024 and the fines took effect in 2025.
  - [Unisender](https://www.unisender.com/ru/blog/personalnye-dannye-hranenie-i-nakazanie/)
- Databases must be located in Russia (ст. 18 ч. 5 152-ФЗ). — [Unisender](https://www.unisender.com/ru/blog/personalnye-dannye-hranenie-i-nakazanie/)
- 2025 amendments, in force from 30 May 2025, also affect small SaaS products. Sources mention categorization of data and consents and a ban on foreign analytics services. Sources disagree on fine amounts ("up to 300k" vs "up to 700k"). — [tproger](https://tproger.ru/articles/it-zakonodatelstvo-2025--razbor-izmenenij-dlya-biznesa-i-specialistov); [infostart](https://infostart.ru/public/2526813/)
- The localization duty rests on the operator; processors are not directly liable. — [Habr (search excerpt)](https://habr.com/ru/post/949628)

### Inferences
- CRM requirements:
  - hosting in Russia, including backups and recording storage;
  - role-based access, with agents seeing only their own clients;
  - an audit log of who viewed or exported what;
  - encryption at rest for recordings and passport scans;
  - retention and deletion policies, plus a "delete or anonymize client" function;
  - separate consent records (date, text version, channel) attached to the client;
  - no foreign analytics or trackers (e.g. Google Analytics) in the CRM's web interface.
- Call recordings: inform callers ("разговор записывается") in the IVR greeting, and cover recording in the privacy policy and the consent documents. Background, unverified: recording calls with prior notice is the common practice. No specific РКН guidance on call recordings was found.
- Using Telegram, WhatsApp or foreign SaaS for client personal data raises localization and cross-border transfer questions. A self-hosted Django CRM in Russia is an advantage here.

### Gaps
- No primary-source text (КоАП/152-ФЗ articles or РКН clarifications) was fetched. Fine figures come from a secondary blog, and sources conflict.
- No specific legal guidance on call-recording consent was found.
- The procedure and timelines for notifying РКН as an operator were not detailed.
