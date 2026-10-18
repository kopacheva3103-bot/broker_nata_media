#!/bin/bash
# Установка агентов на Mac. Запуск один раз: bash setup_mac.sh
set -e
cd "$(dirname "$0")"

# Ищем свежий Python: встроенный в macOS (3.9) слишком старый, а установленный
# с python.org может быть не первым в PATH, пока не открыто новое окно Терминала
PYTHON=""
for cand in python3.14 python3.13 python3.12 python3.11 python3.10 \
            /Library/Frameworks/Python.framework/Versions/Current/bin/python3 \
            /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
    PYTHON="$cand"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "❌ Нужен Python 3.10 или новее (сейчас $(python3 --version 2>&1))."
  echo "   Скачай с https://www.python.org/downloads/ (жёлтая кнопка), установи и запусти этот файл снова."
  open "https://www.python.org/downloads/"
  exit 1
fi
echo "→ Python: $("$PYTHON" --version)"

echo "→ Создаю отдельное окружение для агентов..."
rm -rf .venv
"$PYTHON" -m venv .venv
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
