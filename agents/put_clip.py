"""Положить свой готовый ролик в папку монтажа нужного выпуска с правильным именем.

    ./run.sh put <файл> <выпуск> <код> [описание]
    ./run.sh put ~/Downloads/utochkin.mp4 1 A4 уточкин

Код — из ТЗ (A4, G2…) или ДОП для дополнительного кадра.
Файл копируется в <серия>/Выпуск_N/3_монтаж/<КОД>_<описание>_наталья.<расширение>.
"""
import shutil
import sys
from pathlib import Path

import run_brief as rb
from common import OUTPUT_DIR, slugify

BRIEF = Path(__file__).resolve().parent / "series" / "begovaya5.yaml"


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    src = Path(sys.argv[1].strip().strip("'\"")).expanduser()
    episode, code = int(sys.argv[2]), sys.argv[3].upper()
    note = slugify(" ".join(sys.argv[4:])) if len(sys.argv) > 4 else ""
    if not src.is_file():
        sys.exit(f"❌ Файл не найден: {src}")

    brief = rb.load_brief(BRIEF)
    shots = (brief["episodes"].get(episode) or {}).get("shots") or {}
    if episode not in brief["episodes"]:
        sys.exit(f"❌ В серии нет выпуска {episode}")
    if code != "ДОП" and code not in shots:
        sys.exit(f"❌ В выпуске {episode} нет кода {code}. Есть: {', '.join(shots) or '—'} (или ДОП)")

    ep = rb.Episode(brief["series"], episode, None)
    name = "_".join(x for x in (code, note, "наталья") if x) + src.suffix.lower()
    dest = ep.path(rb.MONTAGE) / name
    shutil.copy2(src, dest)
    print(f"✅ {src.name} → {brief['series']}/Выпуск_{episode}/3_монтаж/{name}")
    if code in shots:
        print(f"   Это кадр {code}: {shots[code].get('what', '')} ({shots[code].get('timecode', '')} с)")

    # Чтобы агент не оживил тот же код ещё раз за деньги
    selected = [p.name for p in ep.path(rb.SELECTED).iterdir() if p.name.upper().startswith(code + "_")]
    if selected and shots.get(code, {}).get("motion"):
        print(f"⚠️ В 2_выбрано лежит {', '.join(selected)} — агент оживит его повторно. "
              "Убери его оттуда, если твой ролик заменяет этот кадр.")


if __name__ == "__main__":
    main()
