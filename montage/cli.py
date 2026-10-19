"""Command line: python -m montage render project.yaml"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import grading
from .ffmpeg import FFmpegError


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="montage", description="Монтаж вертикальных роликов (Reels / Shorts / TikTok)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("render", help="собрать ролик по файлу проекта")
    r.add_argument("project", help="project.yaml или project.json")
    r.add_argument("--preview", action="store_true", help="быстрый черновик в половинном разрешении")
    r.add_argument("-o", "--output", help="переопределить путь результата")
    r.add_argument("-j", "--jobs", type=int, help="сколько сегментов рендерить параллельно")
    r.add_argument("-v", "--verbose", action="store_true", help="показывать команды ffmpeg")

    t = sub.add_parser("transcribe", help="распознать речь в видео → .srt (нужен faster-whisper)")
    t.add_argument("media")
    t.add_argument("-o", "--output")
    t.add_argument("--model", default="small")
    t.add_argument("--language", default="ru")

    sub.add_parser("presets", help="список пресетов цветокоррекции")

    a = ap.parse_args(argv)
    try:
        if a.cmd == "presets":
            for name, params in grading.PRESETS.items():
                print(f"{name:10s} {params}")
        elif a.cmd == "transcribe":
            from . import ass, autosubs
            from .ffmpeg import run
            media = Path(a.media)
            wav = media.with_suffix(".tmp16k.wav")
            run(["-i", str(media), "-vn", "-ac", "1", "-ar", "16000", str(wav)])
            try:
                cues = autosubs.transcribe(wav, a.model, a.language)
            finally:
                wav.unlink(missing_ok=True)
            out = Path(a.output or media.with_suffix(".srt"))
            ass.write_srt(cues, out)
            print(f"Сохранено: {out} ({len(cues)} фраз)")
        else:
            from .project import load, render
            p = load(a.project)
            if a.output:
                p["output"] = str(Path(a.output).resolve())
            render(p, preview=a.preview, jobs=a.jobs, verbose=a.verbose)
    except (FFmpegError, ValueError, FileNotFoundError, RuntimeError) as e:
        print(f"Ошибка: {e}", file=sys.stderr)
        return 1
    return 0
