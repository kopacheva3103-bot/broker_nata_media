#!/bin/sh
# Собирает dist/Code.gs из apps_script/*.gs
cd "$(dirname "$0")/.."
(echo "/** СИСТЕМА УПРАВЛЕНИЯ ЭКСКЛЮЗИВАМИ — весь код одним файлом. Собрано из apps_script/*.gs (tools/build_dist.sh). */"; for f in apps_script/*.gs; do echo; echo "// ═════════════ $(basename $f) ═════════════"; cat "$f"; done) > dist/Code.gs
cp apps_script/AddActionDialog.html apps_script/appsscript.json dist/
