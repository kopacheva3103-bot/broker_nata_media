#!/bin/bash
# Запуск агентов на Mac без активации окружения:
#   ./run.sh update                                 — скачать свежую версию (ключи и установка сохраняются)
#   ./run.sh keys                                   — ввести ключи (без редактирования .env)
#   ./run.sh yandex                                 — подключить Яндекс.Диск (через приложение)
#   ./run.sh drive                                  — подключить Google Drive (через приложение)
#   ./run.sh check                                  — проверить доступы
#   ./run.sh open                                   — открыть папку агентов в Finder
#   ./run.sh put <файл> <выпуск> <код> [описание]   — положить свой ролик в папку монтажа
#   ./run.sh begovaya all                           — серия «Беговая, 5»: архив + генерация + статус
#   ./run.sh begovaya vertical                      — горизонтальные кадры → вертикаль 9:16 (до оживления)
#   ./run.sh begovaya animate | status              — оживление / таблица статуса
#   ./run.sh agent1_search.py "Arbat 1900" -s wiki  — любой агент напрямую
cd "$(dirname "$0")"

if [ "$1" = "update" ]; then
  BRANCH="claude/eager-maxwell-rrsrje"
  TMP=$(mktemp -d)
  echo "→ Скачиваю свежую версию..."
  curl -fsSL "https://github.com/kopacheva3103-bot/broker_nata_media/archive/refs/heads/$BRANCH.zip" -o "$TMP/code.zip"
  unzip -q "$TMP/code.zip" -d "$TMP"
  # Ключи (.env, credentials.json, token.json) и установленное окружение (.venv) не трогаем
  rsync -a --exclude .env --exclude .venv --exclude credentials.json --exclude token.json \
    "$TMP"/broker_nata_media-*/agents/ ./
  rsync -a --delete "$TMP"/broker_nata_media-*/montage/ ../montage/
  rm -rf "$TMP"
  chmod +x run.sh setup_mac.sh
  .venv/bin/pip install -q -r requirements.txt 2>/dev/null || true
  echo "✅ Обновлено"
  exit 0
fi

PY=.venv/bin/python
[ -x "$PY" ] || { echo "Сначала установка: bash setup_mac.sh"; exit 1; }

case "$1" in
  keys)     shift; exec "$PY" set_keys.py "$@" ;;
  drive)    shift; exec "$PY" drive_sync.py drive ;;
  yandex)   shift; exec "$PY" drive_sync.py yandex ;;
  put)      shift; exec "$PY" put_clip.py "$@" ;;
  open)     shift; exec open "$("$PY" -c 'from common import OUTPUT_DIR; OUTPUT_DIR.mkdir(parents=True, exist_ok=True); print(OUTPUT_DIR)')" ;;
  check)    shift; exec "$PY" check_setup.py "$@" ;;
  begovaya) shift; exec "$PY" run_brief.py series/begovaya5.yaml "$@" ;;
  *)        exec "$PY" "$@" ;;
esac
