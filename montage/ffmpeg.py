"""Thin wrappers around the ffmpeg / ffprobe binaries."""
from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


class FFmpegError(RuntimeError):
    pass


def _binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise FFmpegError(
            f"Не найден {name}. Установите ffmpeg:\n"
            "  macOS:   brew install ffmpeg\n"
            "  Ubuntu:  sudo apt install ffmpeg\n"
            "  Windows: winget install Gyan.FFmpeg"
        )
    return path


def run(args: list[str], verbose: bool = False, cwd: str | Path | None = None) -> None:
    cmd = [_binary("ffmpeg"), "-hide_banner", "-y", "-loglevel", "info" if verbose else "error", *map(str, args)]
    if verbose:
        print("  $ " + " ".join(cmd))
    proc = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-25:])
        raise FFmpegError(f"ffmpeg завершился с ошибкой ({proc.returncode}):\n{tail}\n\nКоманда: {' '.join(cmd)}")


@dataclass
class MediaInfo:
    duration: float
    width: int
    height: int
    has_video: bool
    has_audio: bool
    color_transfer: str = ""


def probe(path: str | Path) -> MediaInfo:
    cmd = [_binary("ffprobe"), "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise FFmpegError(f"ffprobe не смог прочитать {path}: {proc.stderr.strip()}")
    data = json.loads(proc.stdout)
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    duration = float(data.get("format", {}).get("duration") or (video or {}).get("duration") or 0)
    return MediaInfo(
        duration=duration,
        width=int((video or {}).get("width") or 0),
        height=int((video or {}).get("height") or 0),
        has_video=video is not None,
        has_audio=audio is not None,
        color_transfer=(video or {}).get("color_transfer", ""),
    )


def esc(path: str | Path) -> str:
    """Escape a file path for use as a filter option value inside a filtergraph."""
    p = str(Path(path).resolve()).replace("\\", "/")
    p = p.replace(":", r"\:").replace("'", r"\'")
    return f"'{p}'"


def hex_color(color: str) -> str:
    """'#RRGGBB' / 'RRGGBB' / 'white' -> ffmpeg colour string."""
    c = str(color).strip()
    if c.startswith("#"):
        return "0x" + c[1:]
    return c
