#!/bin/bash
# Установка агентов на Mac. Запуск один раз: bash setup_mac.sh
set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
  echo "❌ Нужен Python 3.10 или новее: скачай с https://www.python.org/downloads/ , установи и запусти этот файл снова."
  exit 1
fi

echo "→ Создаю отдельное окружение для агентов..."
python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
echo "→ Устанавливаю библиотеки (1–2 минуты)..."
.venv/bin/pip install -q -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  echo "→ Создал файл .env для ключей"
fi

# Файл из Google Cloud обычно скачивается в «Загрузки» как client_secret_....json
if [ ! -f credentials.json ]; then
  found=$(ls -t ~/Downloads/client_secret_*.json 2>/dev/null | head -1 || true)
  if [ -n "$found" ]; then
    cp "$found" credentials.json
    echo "→ Нашёл в Загрузках файл доступа Google и положил как credentials.json"
  fi
fi

chmod +x run.sh
echo ""
echo "✅ Установка готова. Дальше введи ключи командой:  ./run.sh keys"
