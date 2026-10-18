#!/bin/bash
# Запуск агентов на Mac без активации окружения:
#   ./run.sh check                                  — проверить доступы
#   ./run.sh begovaya all                           — серия «Беговая, 5»: архив + генерация + статус
#   ./run.sh begovaya animate | status              — оживление / таблица статуса
#   ./run.sh agent1_search.py "Arbat 1900" -s wiki  — любой агент напрямую
cd "$(dirname "$0")"
PY=.venv/bin/python
[ -x "$PY" ] || { echo "Сначала установка: bash setup_mac.sh"; exit 1; }

case "$1" in
  check)    shift; exec "$PY" check_setup.py "$@" ;;
  begovaya) shift; exec "$PY" run_brief.py series/begovaya5.yaml "$@" ;;
  *)        exec "$PY" "$@" ;;
esac
