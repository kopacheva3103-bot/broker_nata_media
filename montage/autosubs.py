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
    segments, _ = wm.transcribe(str(audio), language=language or None, word_timestamps=True, vad_filter=True)
    cues = []
    for s in segments:
        words = [(w.start, w.end, w.word.strip()) for w in (s.words or []) if w.word.strip()]
        cues.append(Cue(s.start, s.end, s.text.strip(), words or None))
    return cues
