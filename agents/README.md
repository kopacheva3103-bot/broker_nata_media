# Контент-агенты: фото → живое видео → монтаж

```
Агент 1 (поиск)            Ты (отбор)              Агент 2 (Kling)          Монтажёр
промт ──► Pexels/Unsplash ──► 1_найдено ──► 2_оживить ──► видео .mp4 ──► 3_монтаж/<дата>
                                   │                ▲
                                   └► 2_раскрасить ─┘  Агент 3 (колоризация старых ч/б фото)
```

Всё лежит в одной папке на Google Drive:

| Папка | Кто кладёт | Что внутри |
|---|---|---|
| `1_найдено/<тема>` | агент 1 | найденные фото + `_авторы.csv` |
| `2_раскрасить` | **ты**: ч/б кадры для колоризации | старые фото → агент 3 |
| `2_оживить` | **ты** или агент 3 | фото, которые надо оживить |
| `3_монтаж/<дата>` | агент 2 | видео + исходное фото рядом, монтажёр берёт отсюда |

Ручной отбор между агентами сделан специально: каждое оживление в Kling стоит денег,
поэтому платим только за кадры, которые ты одобрила.

## Почему фото со стоков, а не из Google
Pexels и Unsplash разрешают бесплатно использовать фото в коммерческих целях без указания
автора. Картинки из поиска Google чужие: в Instagram и рекламе за них бывают жалобы и блокировки.
Ограничение одно: нельзя выдавать стоковое фото за фото конкретного объекта, который продаёшь.
Стоковые кадры подходят для атмосферы, лайфстайла и видов города.

## Доступы: что нужно и как проверить

Для серии «Дом с историей» нужны три доступа. Всё остальное бесплатно и без ключей.

| Сервис | Для чего | Стоимость | Ключ в `.env` |
|---|---|---|---|
| Google Cloud (Drive API) | папки для команды на Google Drive | бесплатно | `credentials.json` + `DRIVE_ROOT_FOLDER_ID` |
| Replicate | генерация G-кадров, колоризация | ~0,04 $ за картинку, нужна карта | `REPLICATE_API_TOKEN` |
| Kling API | оживление кадров | пакеты в кабинете API | `KLING_ACCESS_KEY`, `KLING_SECRET_KEY` |
| Pexels, Unsplash | только агент 1 со стоками | бесплатно | необязательно |

Аккаунты лучше регистрировать на почту Натальи: ключи принадлежат бизнесу, а не исполнителю.
Ключи передавай ассистенту только лично или через менеджер паролей, не в общих чатах.

После настройки запусти проверку, она ничего не тратит:
```bash
python check_setup.py
```

### Google Drive по шагам
1. Открыть [console.cloud.google.com](https://console.cloud.google.com/) под почтой Натальи → вверху «Select a project» → **New project** → назвать `nata-agents` → Create.
2. Меню → **APIs & Services → Library** → найти **Google Drive API** → **Enable**.
3. **APIs & Services → OAuth consent screen** (или «Google Auth Platform») → Get started:
   название `Nata agents`, почта поддержки — своя, Audience — **External**, контактная почта — своя → Create.
4. В разделе **Audience** нажать **Publish app** (перевести в «In production»). Если оставить режим «Testing»,
   вход будет слетать каждые 7 дней. При первом входе Google предупредит «приложение не проверено»:
   это твоё собственное приложение, жми «Дополнительно → Перейти».
5. **Clients** (или Credentials → Create credentials → OAuth client ID) → тип **Desktop app** → Create →
   **Download JSON**. Переименовать файл в `credentials.json` и положить в папку `agents`.
6. На Google Drive создать папку «Контент-агенты», открыть её и скопировать ID из адреса
   (`drive.google.com/drive/folders/<ID>`) в `DRIVE_ROOT_FOLDER_ID`.
7. Запустить `python check_setup.py`. Откроется браузер: войти почтой Натальи и разрешить доступ.

### Replicate по шагам
1. [replicate.com](https://replicate.com) → Sign in (через GitHub или Google).
2. **Account → Billing** → привязать карту. Без карты модели FLUX не запускаются.
3. **Account → API tokens** → Create token → скопировать в `REPLICATE_API_TOKEN`.

### Kling по шагам
1. [app.klingai.com/global/dev](https://app.klingai.com/global/dev) → войти.
2. Купить пакет **API** (он отдельный от подписки на сайте Kling).
3. **API Keys** → Create → скопировать Access Key и Secret Key в `KLING_ACCESS_KEY` и `KLING_SECRET_KEY`.
   Secret Key показывается один раз, его надо сразу сохранить.
4. Для серии поставить `KLING_MODE=pro`. Для первой пробы можно оставить `std`, так дешевле.

## Быстрый старт на Mac

```bash
cd ~/Downloads/broker_nata_media-claude-eager-maxwell-rrsrje/agents
bash setup_mac.sh          # установка; в конце откроется .env для ключей
./run.sh check             # проверка доступов
./run.sh begovaya all      # серия «Беговая, 5»: архив + генерация + статус
./run.sh begovaya animate  # оживление выбранных кадров
./run.sh begovaya status   # таблица статуса
```

## Настройка (один раз)

1. **Python 3.10+** с [python.org](https://www.python.org/downloads/). На Windows при установке
   отметить галочку «Add python.exe to PATH». Скачать код: [архив ветки](https://github.com/kopacheva3103-bot/broker_nata_media/archive/refs/heads/claude/eager-maxwell-rrsrje.zip)
   → распаковать → открыть терминал в папке `agents`:
   ```bash
   pip install -r requirements.txt
   cp .env.example .env
   ```
2. **Ключи стоков** (бесплатно):
   [Pexels](https://www.pexels.com/api/) → `PEXELS_API_KEY`,
   [Unsplash](https://unsplash.com/developers) → New Application → Access Key → `UNSPLASH_ACCESS_KEY`.
   Хватит и одного из двух.
3. **Kling**: [app.klingai.com/global/dev](https://app.klingai.com/global/dev) → пополнить баланс API →
   API Keys → `KLING_ACCESS_KEY` и `KLING_SECRET_KEY`. API оплачивается отдельно от подписки на сайте.
4. **Google Drive**:
   - создай папку (например «Контент-агенты»), открой её и скопируй ID из адреса
     `drive.google.com/drive/folders/<ID>` в `DRIVE_ROOT_FOLDER_ID`;
   - [Google Cloud Console](https://console.cloud.google.com/) → новый проект → включи **Google Drive API** →
     «Credentials» → «Create credentials» → «OAuth client ID» → тип **Desktop app** → скачай JSON,
     переименуй в `credentials.json` и положи в папку `agents`;
   - при первом запуске откроется браузер: войди в свой Google-аккаунт и разреши доступ.
   - Открой монтажёру доступ к папке `3_монтаж`.

> ⚠️ Репозиторий публичный. Файлы `.env`, `credentials.json`, `token.json` в git не попадают
> (они в `.gitignore`), не загружай их на GitHub вручную.

## Запуск

```bash
# Агент 1: найти по 10 вертикальных фото по каждому промту
python agent1_search.py "luxury penthouse interior" "Moscow city skyline night"
python agent1_search.py -f prompts.example.txt -n 15
python agent1_search.py "terrace sunset" -o landscape   # горизонтальные

# Ты переносишь лучшие фото в 2_оживить на Google Drive, затем:

# Агент 2: оживить всё из 2_оживить
python agent2_animate.py
python agent2_animate.py -p "медленный облёт камеры, закатный свет" -d 10 -m pro
```

Без Google Drive (всё в локальной папке `output/`):
```bash
python agent1_search.py "luxury kitchen" --no-drive
python agent2_animate.py --input ../output/1_найдено/luxury_kitchen --no-drive
```

## Исторические ролики про Москву

Пример цепочки для ролика «Тверская 100 лет назад»:

```bash
# 1. Wikimedia Commons: только фото со свободной лицензией, 1880–1930 годы
python agent1_search.py "Tverskaya Street Moscow" -s wiki --years 1880-1930 -n 20
python agent1_search.py -f prompts.history.txt -s wiki --years 1860-1935

# 2. PastVu: все старые фото вокруг точки на карте
#    (координаты: Яндекс.Карты → правый клик по месту → скопировать координаты)
python agent1_search.py "Тверская у Пушкинской" -s pastvu --geo 55.7652,37.6050 --years 1880-1930

# 3а. Оставить ч/б: отбираешь кадры в 2_оживить и оживляешь
#     (прохожие, экипажи, трамваи, сохраняются ч/б и зерно)
python agent2_animate.py --style history -m pro

# 3б. Или сначала раскрасить: кладёшь ч/б кадры в 2_раскрасить
python agent3_colorize.py                          # цветные → 2_оживить, ч/б оригиналы → 3_монтаж
# проверяешь цвета в 2_оживить, неудачные удаляешь, затем:
python agent2_animate.py --style history_color -m pro
```

### Колоризация (агент 3)
Агент 3 раскрашивает и одновременно реставрирует фото: убирает царапины, пыль и пятна.
Работает через модель FLUX Kontext на [Replicate](https://replicate.com/account/api-tokens),
ключ кладётся в `REPLICATE_API_TOKEN`, оплата по факту, примерно 4 цента за фото.

- Ч/б оригинал попадает в `3_монтаж/<дата>/ч_б_оригиналы`. Монтажёр может сделать
  эффектный переход «ч/б фото → цвет → оживает», это хорошо удерживает зрителя.
- Цвета ИИ угадывает, а не восстанавливает по документам. В ролике честно подписывай
  «колоризация ИИ», особенно если говоришь о реальных фактах.
- Если цвет вышел неправдоподобным, запусти заново с уточнением, например
  `-p "... the building facade is pale yellow with white columns ..."`.

**Откуда брать и что с правами.** Блог продвигает твой бизнес, поэтому это коммерческое использование:

| Источник | Что там | Можно ли в Reels и рекламу |
|---|---|---|
| `wiki`, Wikimedia Commons | старые фото Москвы с проверенной лицензией | да: агент берёт только общественное достояние и CC BY / CC BY-SA. Для CC BY указывай автора, он есть в `_авторы.csv` |
| `pastvu`, PastVu | самый большой архив старой Москвы с привязкой к улицам и годам | лицензии разные: часть фото из государственных архивов, для коммерции может понадобиться их разрешение. Всегда указывай источник, перед рекламой открывай страницу фото по ссылке из `_авторы.csv` |

Простое правило: фото старше примерно 100 лет с умершим больше 70 лет назад автором, как правило,
общественное достояние. В конце ролика ставь титр «Фото: Wikimedia Commons, PastVu», это
и честно, и защищает от жалоб.

**Что учесть при оживлении старых фото:**
- Старые фото почти все горизонтальные. Kling оставит пропорции, а монтажёр сделает из
  них вертикаль панорамой (движение по кадру), так даже атмосфернее.
- Kling может «поплыть» на лицах и мелких надписях. Лучше выбирать общие планы улиц и зданий,
  а не портреты крупным планом.
- Для теста бери `-m std` (дешевле), для финального ролика `-m pro`.

## Настройки Kling (в `.env` или флагами)
- `KLING_MODE`: `std` дешевле, для теста; `pro` качественнее, для публикации.
- `KLING_DURATION`: 5 или 10 секунд.
- `KLING_MODEL`: модель, по умолчанию `kling-v2-1`. Если у тебя открыта более новая, впиши её название из кабинета.
- `KLING_DEFAULT_PROMPT` описывает движение камеры и сцены. Для недвижимости лучше всего
  работают плавные движения: наезд, облёт, движение штор и воды, смена света.

## Сериалы по брифу (`run_brief.py`)

Когда сценарий готов, все А-кадры (архив) и G-кадры (генерация) переносятся в бриф
`series/<серия>.yaml`, и агенты отрабатывают его целиком. Пример: `series/begovaya5.yaml`,
серия «Дом с историей», Беговая, 5. Коды кадров совпадают с ТЗ монтажёру.

```bash
python run_brief.py series/begovaya5.yaml all          # найти архив + сгенерировать G-кадры + статус
# ассистент переносит по одному лучшему кадру на код в Выпуск_N/2_выбрано
python run_brief.py series/begovaya5.yaml animate      # Kling оживляет только кадры с motion
python run_brief.py series/begovaya5.yaml status       # таблица: что готово, что осталось руками
python run_brief.py series/begovaya5.yaml generate -e 1 -s G3 --force   # перегенерировать один кадр
```

На Google Drive создаётся `<серия>/Выпуск_N/{1_кандидаты, 2_выбрано, 3_монтаж}`.
Монтажёр берёт статичные кадры из `2_выбрано` (наезд и параллакс делает сам), а видео из `3_монтаж`.

- Генерация G-кадров идёт через FLUX 1.1 Pro на Replicate (тот же `REPLICATE_API_TOKEN`), 3 варианта в формате 9:16.
- PastVu ищет по адресам из блока `places` брифа. Координаты определяются автоматически через OpenStreetMap.
- Уже сделанное повторно не запускается, лишних денег не тратится. Переделать можно с флагом `--force`.
