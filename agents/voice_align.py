"""Синхронизация выпуска по реальной озвучке — до каждого слова.

Распознаём запись (faster-whisper, время каждого слова) и сопоставляем слова со сценарием.
Получаем: начало каждой строки покадровой таблицы (длительность кадров) и время каждого
слова сценария — по нему титры (до 5 слов) появляются ровно тогда, когда слово звучит.
Текст титров — дословно из сценария, распознавание нужно только для времени.

Двойной дубль в начале записи (как просит сценарий для хука) отрезается: остаётся дубль,
за которым сразу идёт следующая фраза. Голос можно ускорить (voice_speed), тембр сохраняется.
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
SUB_WORDS, SUB_CHARS = 5, 24   # титры по стандарту монтажа: до 5 слов / 24 знаков
BREAK = ".,!?;:—…»"


def norm(word):
    word = word.lower().replace("ё", "е")
    return re.sub(r"[^\w]", "", word)


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


def _script(rows):
    """Слова сценария: [(row, слово как в тексте, нормализованное)]."""
    out = []
    for i, r in enumerate(rows):
        for w in str(r.get("voice") or "").split():
            out.append((i, w, norm(w)))
    return out


def _word_times(script, words):
    """Время начала каждого слова сценария в записи + индекс начала выбранного дубля."""
    trans = [norm(w[2]) for w in words]
    keyed = [k for k, s in enumerate(script) if s[2]]           # слова, которые можно сопоставлять
    first_row = script[0][0]
    head = [script[k][2] for k in keyed if script[k][0] == first_row]
    rest = [k for k in keyed if script[k][0] != first_row]

    times = {}
    # 1. Всё, кроме первой строки, — целиком: так повтор хука не сбивает сопоставление
    for a, b, n in SequenceMatcher(None, [script[k][2] for k in rest], trans, autojunk=False).get_matching_blocks():
        for m in range(n):
            times[rest[a + m]] = words[b + m][0]
    nxt = min(times.values(), default=words[-1][0])
    # 2. Первая строка: последний дубль перед второй строкой
    before = [j for j, w in enumerate(words) if w[0] < nxt] or [0]
    best, best_score = before[0], -1.0
    for j in before:
        score = SequenceMatcher(None, head, trans[j:j + len(head)], autojunk=False).ratio()
        if score >= best_score - 1e-9:      # при равенстве — более поздний дубль
            best, best_score = j, score
    head_keys = [k for k in keyed if script[k][0] == first_row]
    window = trans[best:best + len(head) + 3]
    for a, b, n in SequenceMatcher(None, head, window, autojunk=False).get_matching_blocks():
        for m in range(n):
            times[head_keys[a + m]] = words[best + b + m][0]
    times.setdefault(0, words[best][0])
    # 3. Нераспознанные слова — между соседями пропорционально
    known = sorted(times)
    end = words[-1][1]
    full = []
    for k in range(len(script)):
        if k in times:
            full.append(times[k])
            continue
        prev = max((x for x in known if x < k), default=None)
        nxt_k = min((x for x in known if x > k), default=None)
        t0 = times[prev] if prev is not None else words[best][0]
        t1 = times[nxt_k] if nxt_k is not None else end
        k0 = prev if prev is not None else 0
        k1 = nxt_k if nxt_k is not None else len(script)
        full.append(t0 + (t1 - t0) * (k - k0) / max(k1 - k0, 1))
    for k in range(1, len(full)):           # время не идёт назад
        full[k] = max(full[k], full[k - 1])
    return full, words[best][0]


def _phrases(script, times, end):
    """Титры: куски до 5 слов / 24 знаков, разрыв на знаках препинания, внутри одной строки."""
    out, cur = [], []

    def flush(next_start):
        if cur:
            out.append([times[cur[0]], next_start, " ".join(script[k][1] for k in cur)])
            cur.clear()

    for k, (row, word, _) in enumerate(script):
        if cur and (script[cur[0]][0] != row or len(cur) >= SUB_WORDS
                    or len(" ".join(script[x][1] for x in cur + [k])) > SUB_CHARS):
            if word.strip("—–-"):          # одинокое тире не переносим в начало нового куска
                flush(times[k])
        cur.append(k)
        if word[-1:] in BREAK and len(cur) > 1:
            flush(times[k + 1] if k + 1 < len(script) else end)
    flush(end)
    return [p for p in out if p[2].strip("—– ")]


def sync(rows, words, speed=1.0):
    """→ (spans, cut_at, phrases): время строк и титров в ролике, секунда обрезки записи."""
    script = _script(rows)
    if not script or not words:
        raise ValueError("нечего сопоставлять")
    times, take = _word_times(script, words)
    cut_at = max(0.0, take - LEAD)
    voice_end = words[-1][1] + TAIL

    def reel(t):  # секунда записи → секунда ролика (после обрезки и ускорения)
        return round(max(0.0, t - cut_at) / speed, 2)

    row_start = {}
    for k, (row, _, _) in enumerate(script):
        row_start.setdefault(row, times[k])
    voiced = sorted(row_start)
    spans, t = [None] * len(rows), 0.0
    for n, i in enumerate(voiced):
        a = 0.0 if n == 0 else reel(row_start[i])
        b = reel(row_start[voiced[n + 1]]) if n + 1 < len(voiced) else reel(voice_end)
        a = max(a, t)
        spans[i] = (a, max(b, a + MIN_ROW))
        t = spans[i][1]
    for i, row in enumerate(rows):  # строки без голоса (финальная карточка) — своей длины после голоса
        if spans[i] is None:
            a, b = (float(x.replace(",", ".")) for x in str(row["t"]).split("-"))
            spans[i] = (round(t, 2), round(t + (b - a), 2))
            t += b - a
    phrases = [{"start": reel(a), "end": reel(b), "text": txt} for a, b, txt in _phrases(script, times, voice_end)]
    return spans, cut_at, phrases


def prepare_voice(src, dst, cut_at, speed=1.0):
    """Обрезка до выбранного дубля, ускорение без изменения тембра и мягкая чистка голоса."""
    af = "highpass=f=80,afftdn=nf=-25" + (f",atempo={speed:.3f}" if abs(speed - 1) > 1e-3 else "")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{cut_at:.2f}", "-i", str(src),
                    "-af", af, "-c:a", "aac", "-b:a", "192k", str(dst)], check=True)
    return dst
