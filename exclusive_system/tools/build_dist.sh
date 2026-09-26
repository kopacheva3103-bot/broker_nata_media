#!/bin/sh
# Собирает dist/Code.gs из apps_script/*.gs — весь код одним файлом для вставки в Apps Script.
cd "$(dirname "$0")/.."
(echo "/** СИСТЕМА МАРКЕТИНГА ЭКСКЛЮЗИВОВ — весь код одним файлом. Собрано из apps_script/*.gs (tools/build_dist.sh). */"; for f in apps_script/*.gs; do echo; echo "// ═════════════ $(basename $f) ═════════════"; cat "$f"; done) > dist/Code.gs
rm -f dist/AddActionDialog.html
cp apps_script/appsscript.json dist/
