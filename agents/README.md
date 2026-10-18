# Контент-агенты: фото → живое видео → монтаж

```
Агент 1 (поиск)            Ты (отбор)              Агент 2 (Kling)          Монтажёр
промт ──► Pexels/Unsplash ──► 1_найдено ──► 2_оживить ──► видео .mp4 ──► 3_монтаж/<дата>
```

Всё лежит в одной папке на Google Drive:

| Папка | Кто кладёт | Что внутри |
|---|---|---|
| `1_найдено/<тема>` | агент 1 | найденные фото + `_авторы.csv` |
| `2_оживить` | **ты**: переносишь лучшие кадры сюда | фото, которые надо оживить |
| `3_монтаж/<дата>` | агент 2 | видео + исходное фото рядом, монтажёр берёт отсюда |

Ручной отбор между агентами сделан специально: каждое оживление в Kling стоит денег,
поэтому платим только за кадры, которые ты одобрила.

## Почему фото со стоков, а не из Google
Pexels и Unsplash разрешают бесплатно использовать фото в коммерческих целях без указания
автора. Картинки из поиска Google чужие: в Instagram и рекламе за них бывают жалобы и блокировки.
Ограничение одно: нельзя выдавать стоковое фото за фото конкретного объекта, который продаёшь.
Стоковые кадры подходят для атмосферы, лайфстайла и видов города.

## Настройка (один раз)

1. **Python 3.10+**, затем в папке `agents`:
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

## Настройки Kling (в `.env` или флагами)
- `KLING_MODE`: `std` дешевле, для теста; `pro` качественнее, для публикации.
- `KLING_DURATION`: 5 или 10 секунд.
- `KLING_MODEL`: модель, по умолчанию `kling-v2-1`. Если у тебя открыта более новая, впиши её название из кабинета.
- `KLING_DEFAULT_PROMPT` описывает движение камеры и сцены. Для недвижимости лучше всего
  работают плавные движения: наезд, облёт, движение штор и воды, смена света.
