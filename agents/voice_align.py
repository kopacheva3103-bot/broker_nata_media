"""Синхронизация выпуска по реальной озвучке.

Распознаём запись (faster-whisper, время каждого слова) и сопоставляем слова со сценарием:
так узнаём, на какой секунде начинается каждая строка покадровой таблицы. Текст титров
при этом берётся из сценария — распознавание нужно только для времени.

Двойной дубль в начале записи (как просит сценарий для хука) отрезается: остаётся дубль,
за которым сразу идёт следующая фраза.
"""
import json
import re
import subprocess
import sys
from difflib import SequenceMatcher
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LEAD = 0.15        # запас перед первым словом, сек
TAIL = 0.45        # запас после последнего слова
MIN_ROW = 0.8      # строка не короче — иначе кадр мелькнёт


def norm(word):
    word = word.lower().replace("ё", "е")
    return re.sub(r"[^\w]", "", word)


def tokens(text):
    return [w for w in (norm(x) for x in str(text).split()) if w]


def transcribe(voice, cache, model):
    """Слова записи [(start, end, word)] с кэшем рядом с файлом."""
    stamp = f"{voice.stat().st_size}:{voice.stat().st_mtime_ns}:{model}"
    if cache.exists():
        data = json.loads(cache.read_text(encoding="utf-8"))
        if data.get("stamp") == stamp:
            return [tuple(w) for w in data["words"]]
    sys.path.insert(0, str(REPO))
    from montage import autosubs
    print(f"→ Распознаю озвучку (модель {model}, 1–3 минуты; при первом запуске скачается модель)…")
    words = [w for cue in autosubs.transcribe(voice, model, "ru") for w in (cue.words or [])]
    cache.write_text(json.dumps({"stamp": stamp, "words": words}, ensure_ascii=False), encoding="utf-8")
    return words


def align(rows, words):
    """Начало каждой озвученной строки во времени записи + отметка, откуда резать запись.

    rows — строки таблицы с полем voice; возвращает (starts, cut_at, voice_end), где
    starts[i] — секунда записи, на которой начинается строка i (None для строк без голоса).
    """
    voiced = [i for i, r in enumerate(rows) if r.get("voice")]
    if not voiced or not words:
        raise ValueError("нечего сопоставлять")
    trans = [norm(w[2]) for w in words]
    row_words = {i: tokens(rows[i]["voice"]) for i in voiced}
    first = voiced[0]

    # 1. Всё, кроме первой строки, сопоставляем целиком: так дубль хука не мешает
    script, owner = [], []
    for i in voiced[1:]:
        script += row_words[i]
        owner += [i] * len(row_words[i])
    mapped = {}
    for a, b, n in SequenceMatcher(None, script, trans, autojunk=False).get_matching_blocks():
        for k in range(n):
            mapped[a + k] = b + k

    starts, pos = {}, 0
    for i in voiced[1:]:
        n = len(row_words[i])
        hits = [(k, mapped[pos + k]) for k in range(n) if pos + k in mapped]
        if hits:
            k, j = hits[0]
            per_word = (words[min(j + 1, len(words) - 1)][0] - words[j][0]) or 0.35
            starts[i] = max(0.0, words[j][0] - k * per_word)  # первые слова не распознались — отступаем
        pos += n

    # 2. Первая строка: последний дубль перед второй строкой
    nxt = min((s for s in starts.values()), default=words[-1][0])
    head = row_words[first]
    before = [k for k, w in enumerate(words) if w[0] < nxt]
    best, best_score = None, 0.0
    for k in before:
        window = trans[k:k + len(head)]
        score = SequenceMatcher(None, head, window, autojunk=False).ratio()
        if score >= best_score - 1e-9 and score >= 0.45:  # ≥ — при равенстве берём более поздний дубль
            best, best_score = k, score
    starts[first] = words[best][0] if best is not None else (words[before[0]][0] if before else 0.0)

    # 3. Строки без распознанных слов — между соседями пропорционально числу слов
    for idx, i in enumerate(voiced):
        if i in starts:
            continue
        prev_i = next(v for v in reversed(voiced[:idx]) if v in starts)
        next_i = next((v for v in voiced[idx + 1:] if v in starts), None)
        end = starts[next_i] if next_i is not None else words[-1][1]
        span = voiced[voiced.index(prev_i):voiced.index(next_i) if next_i is not None else len(voiced)]
        total = sum(len(row_words[v]) for v in span) or 1
        before_n = sum(len(row_words[v]) for v in span[:span.index(i)])
        starts[i] = starts[prev_i] + (end - starts[prev_i]) * before_n / total

    # порядок строк должен сохраняться
    last = -1.0
    for i in voiced:
        starts[i] = max(starts[i], last + MIN_ROW) if last >= 0 else starts[i]
        last = starts[i]
    cut_at = max(0.0, starts[first] - LEAD)
    voice_end = words[-1][1] + TAIL
    return [starts.get(i) for i in range(len(rows))], cut_at, voice_end


def timings(rows, words):
    """(start, end) каждой строки во времени ролика + отметка обрезки записи."""
    starts, cut_at, voice_end = align(rows, words)
    out, t_voice = [], [None] * len(rows)
    voiced = [i for i, s in enumerate(starts) if s is not None]
    for n, i in enumerate(voiced):
        a = starts[i] - cut_at
        b = (starts[voiced[n + 1]] - cut_at) if n + 1 < len(voiced) else voice_end - cut_at
        t_voice[i] = (round(a if n else 0.0, 2), round(max(b, a + MIN_ROW), 2))
    t = t_voice[voiced[-1]][1]
    for i, row in enumerate(rows):  # строки без голоса (финальная карточка) — своей длины после голоса
        if t_voice[i] is None:
            a, b = (float(x.replace(",", ".")) for x in str(row["t"]).split("-"))
            t_voice[i] = (round(t, 2), round(t + (b - a), 2))
            t += b - a
    return t_voice, cut_at


def prepare_voice(src, dst, cut_at):
    """Обрезка до выбранного дубля и мягкая чистка: срез гула и лёгкое шумоподавление."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{cut_at:.2f}", "-i", str(src),
                    "-af", "highpass=f=80,afftdn=nf=-25", "-c:a", "aac", "-b:a", "192k", str(dst)], check=True)
    return dst
