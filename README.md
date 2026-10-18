# broker_nata_media

Публичный репозиторий только для фотографий, используемых в постах Threads
(broker_nata_bot). Никакого кода и секретов здесь нет — только медиафайлы.

Фото лежат в `photos/`, ссылки на них формата:
`https://raw.githubusercontent.com/kopacheva3103-bot/broker_nata_media/main/photos/<файл>`

## Контент-агенты

В папке [`agents/`](agents/README.md) лежат скрипты: поиск фото по промту (Pexels/Unsplash)
и оживление фото через Kling, с передачей файлов монтажёру через Google Drive.
Ключи хранятся только локально в `agents/.env`, в репозиторий они не попадают.
