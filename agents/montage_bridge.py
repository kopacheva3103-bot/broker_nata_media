"""Мост «бриф серии → сценарий монтажа»: собирает project.yaml для ИИ-монтажёра (montage/)
из покадровой таблицы выпуска (timeline в брифе) и готовых файлов в папках выпуска.

Для каждой строки таблицы берётся первый готовый кадр из списка shots:
  видео из 3_монтаж  →  фото из 2_выбрано (с наездом)  →  съёмка из «исходники» (коды С…).
Если ничего нет — тёмная карточка-заглушка «что снять», так видно ритм и пробелы (аниматик).
Озвучка подхватывается из «исходники», если там лежит файл со словом «озвучка» или «voice».
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent
VIDEO_EXT = {".mp4", ".mov", ".m4v"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
AUDIO_EXT = {".m4a", ".mp3", ".wav", ".aac"}

# Прошлое — сепия с зерном и виньеткой (цвет убираем, тёплый тон возвращаем балансом), сегодня — тёплый цвет
GRADES = {
    "sepia": {"saturation": 0.0, "contrast": 1.08, "shadows": [0.05, 0.01, -0.05],
              "midtones": [0.14, 0.05, -0.14], "highlights": [0.08, 0.03, -0.08],
              "grain": 8, "vignette": 0.45},
    "warm": {"preset": "warm"},
}
PLACEHOLDER_BG = {"gradient": ["#26221d", "#0e0d0b"]}
CAPTION_Y = 0.28      # надписи «ЭКРАН» — выше титров (титры по стандарту на 52 % высоты)
SLIDE_TEXT_Y = 0.30   # текст слайдов и заглушек тоже над титрами, чтобы не наезжал


def _latin(code):
    """С (кириллица) и C (латиница) в кодах съёмки считаем одной буквой."""
    return code.upper().replace("С", "C")


def _span(t):
    a, b = (float(x.replace(",", ".")) for x in str(t).split("-"))
    return a, b


def _split_accent(text):
    """«КОНИ ПЕРЕЖИЛИ ◆ПОЖАР» → ("КОНИ ПЕРЕЖИЛИ", "ПОЖАР"): акцентное слово уходит в золото."""
    m = re.search(r"◆(\d[\d\s.,]*\d|\S+)", text)  # число с пробелами («1 000 000») — целиком
    if not m:
        return text.strip(), ""
    plain = (text[:m.start()] + text[m.end():]).replace("  ", " ").strip(" ·—")
    return plain, m.group(1)


def _accent_first(text):
    return text.strip().startswith("◆")


def _find(folder, code, exts):
    if not folder.exists():
        return None
    want = _latin(code)
    files = sorted(p for p in folder.iterdir()
                   if p.suffix.lower() in exts and _latin(p.name.split("_")[0].split(".")[0]) == want)
    return files[0] if files else None


def _duration(path):
    sys.path.insert(0, str(REPO))
    from montage import ffmpeg
    return ffmpeg.probe(path).duration


def _media_segment(ep_dir, code, dur):
    """Сегмент для кода кадра или None, если файла ещё нет."""
    video = _find(ep_dir / "3_монтаж", code, VIDEO_EXT) or _find(ep_dir / "исходники", code, VIDEO_EXT)
    if video:
        seg = {"src": str(video.relative_to(ep_dir)), "start": 0, "mute": True, "fit": "blur"}
        length = _duration(video)
        if length >= dur:
            seg["end"] = round(dur, 2)
        else:  # клип короче строки — слегка замедляем, чтобы закрыть время
            seg["end"] = round(length, 2)
            seg["speed"] = round(length / dur, 3)
        return seg, f"видео {video.name}"
    still = _find(ep_dir / "2_выбрано", code, IMAGE_EXT) or _find(ep_dir / "исходники", code, IMAGE_EXT)
    note = "фото"
    if not still and (ep_dir / "1_кандидаты" / code).is_dir():
        # ничего не выбрано — для аниматика берём первого кандидата, чтобы был виден ритм
        still = _find(ep_dir / "1_кандидаты" / code, code, IMAGE_EXT)
        note = "кандидат (не выбран)"
    if still:
        return {"src": str(still.relative_to(ep_dir)), "duration": round(dur, 2),
                "motion": "zoom_in", "fit": "blur"}, f"{note} {still.name}"
    return None, None


def _texts(screen, dur):
    """Надпись над титрами: белая строка + акцентное слово золотом (в порядке, как в сценарии)."""
    plain, accent = _split_accent(screen)
    lines = [(plain, "caption"), (accent, "gold")]
    if _accent_first(screen):
        lines.reverse()
    lines = [(t, st) for t, st in lines if t]
    return [{"text": t, "style": st, "position": round(CAPTION_Y + i * 0.04, 3), "start": 0.15 + 0.15 * i,
             "end": dur, "animation": "rise"} for i, (t, st) in enumerate(lines)]


def _credits(ep_dir, used):
    """«Фото: Wikimedia Commons / автор, автор» для кадров под лицензией CC (по таблицам _авторы.csv)."""
    import csv
    licenses = {}
    for table in (ep_dir / "1_кандидаты").glob("*/_авторы.csv"):
        with open(table, encoding="utf-8-sig") as fh:
            for row in csv.DictReader(fh):
                key = Path(row["file"]).stem.rsplit("_", 1)[-1]   # номер снимка в источнике
                licenses[(row["source"], key)] = (row.get("author", ""), row.get("license", ""))
    by_source = {}
    for name in used:
        stem = Path(name).stem
        source = "wiki" if "_wiki_" in stem else "pastvu" if "_pastvu_" in stem else None
        if not source:
            continue
        author, lic = licenses.get((source, stem.rsplit("_", 1)[-1]), ("", ""))
        if lic.upper().startswith("CC") and "CC0" not in lic.upper() and author:
            author = re.sub(r"^User:", "", author).split(" from ")[0].strip()
            by_source.setdefault(source, []).append(author) if author not in by_source.get(source, []) else None
    names = {"wiki": "Wikimedia Commons", "pastvu": "PastVu"}
    parts = [f"{names[src]} / {', '.join(authors)}" for src, authors in by_source.items()]
    return ("Фото: " + "; ".join(parts)) if parts else ""


def _find_voice(ep_dir):
    """Озвучка в «исходники» (имя со словом «озвучка» или «voice»); служебные файлы «_…» не в счёт."""
    folder = ep_dir / "исходники"
    if not folder.exists():
        return None
    return next((p for p in sorted(folder.iterdir())
                 if p.suffix.lower() in AUDIO_EXT and not p.name.startswith("_")
                 and re.search(r"озвучк|voice", p.name, re.I)), None)


def _sync_to_voice(rows, voice, ep_dir, report, speed):
    """Подгоняет строки и титры под реальную озвучку. None — если распознать не удалось."""
    import os
    import voice_align
    model = os.getenv("WHISPER_MODEL") or "small"
    try:
        words = voice_align.transcribe(voice, ep_dir / "исходники" / "_озвучка_слова.json", model)
        spans, cut_at, phrases = voice_align.sync(rows, words, speed)
    except Exception as e:  # нет faster-whisper, не распознался текст и т. п.
        report.append(f"⚠️ синхронизация по голосу не удалась ({e}) — кадры стоят по таймкодам сценария")
        return None
    synced = voice_align.prepare_voice(voice, ep_dir / "исходники" / "_озвучка_синхр.m4a", cut_at, speed)
    report.append(f"синхронизация по голосу: запись обрезана с {cut_at:.1f} с (последний дубль хука), "
                  f"скорость {speed:g}×, ролик {spans[-1][1]:.1f} с, титры по словам")
    return spans, synced, phrases


def build(brief, number, ep_dir):
    """Возвращает (project: dict, report: list[str])."""
    ep = brief["episodes"][number]
    rows = ep.get("timeline")
    if not rows:
        raise SystemExit(f"В брифе у выпуска {number} нет таблицы timeline — нечего монтировать")
    segments, cues, report = [], [], []
    title = None
    voice = _find_voice(ep_dir)
    spans, voice_file, phrases = [_span(r["t"]) for r in rows], voice, None
    if voice:
        synced = _sync_to_voice(rows, voice, ep_dir, report, float(brief["defaults"].get("voice_speed", 1.0)))
        if synced:
            spans, voice_file, phrases = synced
    missing, used = [], []
    for row, (a, b) in zip(rows, spans):
        dur = round(b - a, 2)
        grade = GRADES.get(row.get("color", "warm"), GRADES["warm"])
        if row.get("final"):
            plain, accent = _split_accent(row["final"])
            final_card = {"type": "slide", "duration": dur, "background": PLACEHOLDER_BG,
                          "title": brief.get("nickname", ""),
                          "text": f"{plain} {accent}".strip() + f"\n{number}/{brief.get('total', len(brief['episodes']))}",
                          "animation": "fade", "text_position": SLIDE_TEXT_Y}
            segments.append(final_card)
            report.append(f"{a:5.1f}–{b:5.1f}  финальная карточка")
            continue
        if row.get("slide"):
            seg = {"type": "slide", "duration": dur, "background": {"gradient": ["#3a2f22", "#14110d"]},
                   "title": row["slide"].get("title", ""), "text": row["slide"].get("text", ""), "animation": "fade",
                   "text_position": SLIDE_TEXT_Y}
            what = "слайд-типографика" + (f" (финально: {row['need']})" if row.get("need") else "")
        else:
            seg, what = None, None
            for code in row.get("shots", []):
                seg, what = _media_segment(ep_dir, code, dur)
                if seg:
                    used.append(Path(seg["src"]).name)
                    what = f"{code}: {what}"
                    break
            if seg is None and row.get("fallback_slide"):
                fs = row["fallback_slide"]
                seg = {"type": "slide", "duration": dur, "title": fs.get("title", ""), "text": fs.get("text", ""),
                       "background": {"gradient": fs.get("colors", ["#1f3f8a", "#152d66"])}, "animation": "fade",
                       "text_position": fs.get("position", 0.36)}
                what = f"слайд «{fs.get('title', '')}» (вместо {', '.join(row.get('shots', []))})"
            if seg is None:
                need = row.get("need") or ", ".join(row.get("shots", [])) or "кадр"
                body = f"нужно: {need}"
                if row.get("screen"):
                    body += "\nна экране: " + row["screen"].replace("◆", "")
                seg = {"type": "slide", "duration": dur, "background": PLACEHOLDER_BG,
                       "title": " / ".join(row.get("shots", [])) or "КАДР", "text": body,
                       "animation": "none", "text_position": SLIDE_TEXT_Y}
                what = f"ЗАГЛУШКА — нужно: {need}"
                missing.append(f"{a:5.1f}–{b:5.1f} с  {need}")
            seg["grade"] = grade
            if row.get("screen") and title is None and a == 0:
                # надпись первой строки — заголовок ролика по стандарту (белая строка + золото)
                plain, accent = _split_accent(row["screen"])
                title = {"start": 0, "end": min(dur, 3.5),
                         "lines": [l for l in ({"text": plain, "style": "title"},
                                               {"text": accent, "style": "accent"}) if l["text"]]}
                if seg.get("type") == "slide":  # заглушка под заголовком — только код, без текста
                    seg["text"] = ""
            elif row.get("screen") and seg.get("type") != "slide":
                seg["text"] = _texts(row["screen"], dur)
        segments.append(seg)
        if row.get("voice") and phrases is None:  # без синхронизации — титры по строкам сценария
            cues.append({"start": a, "end": b, "text": row["voice"]})
        report.append(f"{a:5.1f}–{b:5.1f}  {what}")

    project = {
        "preset": "premium",
        "output": "4_готово/аниматик.mp4",
        # промежуточные файлы — локально, чтобы не гонять сотни МБ через облачный диск
        "workdir": str(Path.home() / ".cache" / "broker_montage" / ep_dir.parent.name / ep_dir.name),
        "speed": 1.0,                       # таймкоды ТЗ — без ускорения пресета
        "transition": {"type": "cut"},      # склейки встык, чтобы ролик совпадал с таймкодами
        "grade": "none",
        "audio": {"music_volume": 0.0},
        "subtitles": {"items": phrases if phrases is not None else cues},
        "segments": segments,
        # мелкий серый титр авторов фото (лицензии CC требуют указывать автора)
        "styles": {"credit": {"font": "Montserrat SemiBold", "bold": False, "size": 24, "color": "#8C8C8C",
                              "outline": 0, "shadow": 0, "margin_x": 110}},
    }
    if title:
        project["title"] = title
    if voice_file:
        project["audio"]["voiceover"] = str(voice_file.relative_to(ep_dir))
        report.append(f"озвучка: {voice_file.name}")
    else:
        report.append("озвучки нет — положи файл в «исходники» (имя со словом «озвучка»)")
    credit = _credits(ep_dir, used)
    final = next((sg for sg in reversed(segments) if sg.get("type") == "slide"), None)
    if credit and final is not None:
        final["overlay"] = [{"text": credit, "style": "credit", "position": 0.76, "start": 0.0,
                             "end": final["duration"], "animation": "fade"}]
        report.append(f"титр авторов на финальной карточке: {credit}")
    if missing:
        report.append(f"НЕ ХВАТАЕТ КАДРОВ ({len(missing)}):")
        report += ["  " + m for m in missing]
    return project, report


def ensure_ffmpeg():
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        return True
    try:  # ffmpeg без Homebrew: пакет static-ffmpeg сам скачает программу при первом запуске
        import static_ffmpeg
        print("→ Скачиваю ffmpeg (один раз, ~1 минута)…")
        static_ffmpeg.add_paths()
        return bool(shutil.which("ffmpeg"))
    except Exception as e:
        print(f"❌ Нет ffmpeg ({e}). Установи: brew install ffmpeg")
        return False


def run(brief, number, ep_dir, render=True, final=False):
    if not ensure_ffmpeg():
        return None
    project, report = build(brief, number, ep_dir)
    path = ep_dir / "project.yaml"
    header = (f"# Сценарий монтажа выпуска {number}: собран автоматически из брифа серии.\n"
              "# Можно править руками; при следующем ./run.sh … montage файл пересоберётся.\n")
    path.write_text(header + yaml.safe_dump(project, allow_unicode=True, sort_keys=False, width=120),
                    encoding="utf-8")
    print(f"Выпуск {number}: сценарий монтажа → {path.name}")
    for line in report:
        print("   " + line)
    if not render:
        return path
    cmd = [sys.executable, "-m", "montage", "render", str(path)] + ([] if final else ["--preview"])
    print(f"→ Рендер {'финальный' if final else 'черновой 540×960'}…")
    subprocess.run(cmd, cwd=REPO, check=True)
    out = ep_dir / project["output"]
    if not final:
        out = out.with_name(out.stem + "_preview" + out.suffix)
    print(f"✅ Готово: {out.relative_to(ep_dir.parent.parent)}")
    return out
