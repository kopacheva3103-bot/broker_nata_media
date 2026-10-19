"""Положить свой готовый ролик в папку монтажа нужного выпуска с правильным именем.

    ./run.sh put <файл> <выпуск> <код> [описание]
    ./run.sh put ~/Downloads/utochkin.mp4 1 A4 уточкин

Код — из ТЗ (A4, G2…), ДОП для дополнительного кадра, С1…С12 для съёмки,
ОЗВУЧКА для записи голоса.
Ролики (A, G, ДОП) кладутся в Выпуск_N/3_монтаж, съёмка и озвучка — в Выпуск_N/исходники.

    ./run.sh put ~/Downloads/kony.mov 1 С1 кони снизу
    ./run.sh put ~/Downloads/voice.m4a 1 ОЗВУЧКА черновик
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
    code = code.replace("C", "С") if code[:1] == "C" and code[1:].isdigit() else code  # латинская C → С
    filmed = {c for row in brief["episodes"][episode].get("timeline") or [] for c in row.get("shots", [])}
    if code in ("ОЗВУЧКА", "VOICE"):
        folder, name = rb.SOURCES, "_".join(x for x in ("озвучка", note) if x) + src.suffix.lower()
    elif code.startswith("С"):
        if filmed and code not in filmed:
            sys.exit(f"❌ В выпуске {episode} нет кадра {code}. Съёмка: {', '.join(sorted(c for c in filmed if c.startswith('С')))}")
        folder, name = rb.SOURCES, "_".join(x for x in (code, note) if x) + src.suffix.lower()
    elif code == "ДОП" or code in shots:
        folder, name = rb.MONTAGE, "_".join(x for x in (code, note, "наталья") if x) + src.suffix.lower()
    else:
        sys.exit(f"❌ В выпуске {episode} нет кода {code}. Есть: {', '.join(shots) or '—'} (или ДОП, С…, ОЗВУЧКА)")

    ep = rb.Episode(brief["series"], episode, None)
    dest = ep.path(folder) / name
    shutil.copy2(src, dest)
    print(f"✅ {src.name} → {brief['series']}/Выпуск_{episode}/{folder}/{name}")
    if folder == rb.SOURCES:
        print("   Подхватится при следующей сборке: ./run.sh begovaya montage -e " + str(episode))
    if code in shots:
        print(f"   Это кадр {code}: {shots[code].get('what', '')} ({shots[code].get('timecode', '')} с)")

    # Чтобы агент не оживил тот же код ещё раз за деньги
    selected = [p.name for p in ep.path(rb.SELECTED).iterdir() if p.name.upper().startswith(code + "_")]
    if selected and shots.get(code, {}).get("motion"):
        print(f"⚠️ В 2_выбрано лежит {', '.join(selected)} — агент оживит его повторно. "
              "Убери его оттуда, если твой ролик заменяет этот кадр.")


if __name__ == "__main__":
    main()
