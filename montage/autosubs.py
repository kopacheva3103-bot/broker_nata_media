"""Optional speech recognition via faster-whisper (pip install faster-whisper)."""
from __future__ import annotations

from pathlib import Path

from .ass import Cue


def transcribe(audio: str | Path, model: str = "small", language: str | None = "ru") -> list[Cue]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise RuntimeError(
            "Для автосубтитров установите faster-whisper: pip install faster-whisper\n"
            "(или отключите subtitles.auto и подключите готовый .srt)"
        ) from e
    wm = WhisperModel(model, device="auto", compute_type="auto")
    segments, _ = wm.transcribe(str(audio), language=language or None, word_timestamps=True, vad_filter=True,
                                condition_on_previous_text=False)
    cues = []
    for s in segments:
        words: list[tuple[float, float, str]] = []
        for w in s.words or []:
            text = w.word.strip()
            if not text:
                continue
            # Whisper splits "кухня-гостиная" into "кухня" + "-гостиная": glue pieces back
            if words and (not w.word.startswith(" ") or text.startswith("-")):
                a, _, prev = words[-1]
                words[-1] = (a, w.end, prev + text)
            else:
                words.append((w.start, w.end, text))
        cues.append(Cue(s.start, s.end, s.text.strip(), words or None))
    return cues
