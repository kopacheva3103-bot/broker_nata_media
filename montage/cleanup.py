"""Talking-head clean-up: cut long pauses, fillers and false starts (retakes).

Works on word timings from Whisper. A retake is detected when the speaker
restarts a phrase: the words right after a point repeat the words that began
a short time earlier ("Сегодня я покажу вам кварти… Сегодня я покажу вам
квартиру"). The first, broken attempt is cut, the repeated one is kept.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

FILLERS = {"э", "ээ", "эээ", "эм", "ээм", "эмм", "м", "мм", "ммм", "хм", "а-а", "э-э", "ам", "ну-у"}

Word = tuple[float, float, str]


def norm(w: str) -> str:
    return re.sub(r"[^\w-]", "", w.lower().replace("ё", "е")).strip("-")


@dataclass
class Cut:
    start: float
    end: float
    reason: str
    text: str


def sanitize(words: list[Word]) -> list[Word]:
    """Drop Whisper hallucinations: zero-length words and words going back in time."""
    out: list[Word] = []
    for w in words:
        if w[1] - w[0] < 0.02 or (out and w[0] < out[-1][0]):
            continue
        out.append(w)
    return out


def transcribe_cached(src: str, workdir: Path, model: str, language: str | None) -> list[Word]:
    st = Path(src).stat()
    key = hashlib.sha1(f"{src}:{st.st_size}:{st.st_mtime_ns}:{model}:{language}".encode()).hexdigest()[:12]
    cache = workdir / f"words_{Path(src).stem}_{key}.json"
    if cache.exists():
        return sanitize([tuple(w) for w in json.loads(cache.read_text(encoding="utf-8"))])
    from . import autosubs
    from .ffmpeg import run
    wav = workdir / f"asr_{key}.wav"
    run(["-i", src, "-vn", "-ac", "1", "-ar", "16000", str(wav)])
    words: list[Word] = []
    for cue in autosubs.transcribe(wav, model, language):
        words += cue.words or [(cue.start, cue.end, cue.text)]
    wav.unlink(missing_ok=True)
    cache.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
    return sanitize(words)


def find_retakes(words: list[Word], max_back_words: int = 25, max_back_sec: float = 15.0) -> list[tuple[int, int]]:
    """Return (i, j) word index ranges [i, j) that are abandoned attempts."""
    n = [norm(w[2]) for w in words]
    out: list[tuple[int, int]] = []
    j = 1
    while j < len(words):
        found, run = None, 0
        floor = out[-1][1] if out else 0  # never reach back into an already cut attempt
        for i in range(j - 1, max(floor - 1, j - 1 - max_back_words), -1):
            if words[j][0] - words[i][0] > max_back_sec:
                break
            # length of the repeated run starting at i and j
            k = 0
            while j + k < len(n) and i + k < j and n[i + k] and n[i + k] == n[j + k]:
                k += 1
            chars = sum(len(x) for x in n[j:j + k])
            immediate_stutter = k >= 1 and i + k == j and len(n[j]) >= 3  # "квартиру квартиру"
            if k >= 3 or (k == 2 and chars >= 10) or immediate_stutter:
                found, run = i, k  # keep searching back for the start of the failed attempt
        if found is not None:
            out.append((found, j))
            j += run  # the repeated words are the good take — skip them
        else:
            j += 1
    # merge overlapping ranges
    merged: list[tuple[int, int]] = []
    for i, j in sorted(out):
        if merged and i <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], j))
        else:
            merged.append((i, j))
    return merged


def plan_cuts(words: list[Word], duration: float, cfg: dict, fps: int) -> tuple[list[tuple[float, float]], list[Cut]]:
    """Keep intervals (source seconds, frame-aligned) + a report of what was removed."""
    max_pause = float(cfg.get("max_pause", 0.35))
    pad = float(cfg.get("pad", 0.12))
    drop = [False] * len(words)
    cuts: list[Cut] = []
    manual = [(float(a), float(b)) for a, b in cfg.get("remove") or []]
    for a, b in manual:
        cuts.append(Cut(a, b, "вручную", ""))
        for k, w in enumerate(words):
            if w[0] >= a - 0.05 and w[1] <= b + 0.05:
                drop[k] = True
    if cfg.get("cut_retakes", True):
        # search retakes only among words that survived manual cuts
        alive = [k for k in range(len(words)) if not drop[k]]
        for i, j in find_retakes([words[k] for k in alive]):
            for k in alive[i:j]:
                drop[k] = True
            wi, wj = words[alive[i]], words[alive[j]]
            cuts.append(Cut(wi[0], wj[0], "дубль/запинка", " ".join(words[k][2] for k in alive[i:j])))
    if cfg.get("cut_fillers", True):
        for k, w in enumerate(words):
            if norm(w[2]) in FILLERS and not drop[k]:
                drop[k] = True
                cuts.append(Cut(w[0], w[1], "слово-паразит", w[2]))

    kept = [w for w, d in zip(words, drop) if not d]
    iv: list[list[float]] = []
    for s, e, _ in kept:
        s, e = max(0.0, s - pad), min(duration, e + pad)
        if iv and s - iv[-1][1] <= max_pause:
            iv[-1][1] = max(iv[-1][1], e)
        else:
            iv.append([s, e])
    # manual removals punch holes into the keep intervals
    for a, b in manual:
        nxt = []
        for s, e in iv:
            if b <= s or a >= e:
                nxt.append([s, e])
                continue
            if a > s:
                nxt.append([s, a])
            if b < e:
                nxt.append([b, e])
        iv = nxt
    # pauses that were removed, for the report
    for (s0, e0), (s1, _) in zip(iv, iv[1:]):
        if s1 - e0 > 0.25 and not any(c.start < s1 and c.end > e0 for c in cuts):
            cuts.append(Cut(e0, s1, "пауза", ""))
    # snap to the frame grid so audio and video stay in sync after the cut
    snap = [(round(s * fps) / fps, round(e * fps) / fps) for s, e in iv]
    snap = [(s, e) for s, e in snap if e - s >= 2 / fps]
    return snap, sorted(cuts, key=lambda c: c.start)


def remap(words: list[Word], keep: list[tuple[float, float]]) -> list[Word]:
    """Move word timings from source time to the cut timeline."""
    out, acc = [], 0.0
    for s, e in keep:
        for ws, we, t in words:
            if ws >= s - 0.02 and we <= e + 0.05:
                out.append((max(ws, s) - s + acc, min(we, e) - s + acc, t))
        acc += e - s
    return out


def select_filters(keep: list[tuple[float, float]]) -> tuple[str, str]:
    """(video filter, audio filter) that keep only the intervals, with 10 ms declick fades."""
    sel = "+".join(f"between(t,{s:.4f},{e - 0.0005:.4f})" for s, e in keep)
    bounds = sorted({round(x, 4) for s, e in keep for x in (s, e) if x > 0})
    gain = "*".join(f"min(1,abs(t-{b})*100)" for b in bounds) or "1"
    v = f"select='{sel}',setpts=N/FRAME_RATE/TB"
    a = (f"asetnsamples=n=160:p=0,volume=eval=frame:volume='{gain}',"
         f"aselect='{sel}',asetpts=N/SR/TB")
    return v, a


def report(cuts: list[Cut], path: Path, src: str) -> None:
    lines = [f"# Вырезано из {Path(src).name}"]
    for c in cuts:
        lines.append(f"{c.start:7.2f} – {c.end:7.2f}  {c.reason:14s} {c.text}")
    lines.append("\nЕсли вырезано лишнее: в сегменте cleanup поставьте cut_retakes: false, увеличьте max_pause или добавьте remove: [[нач, кон]]")
    with path.open("a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n\n")
