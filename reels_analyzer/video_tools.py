"""Извлечение технических данных из видео: длительность, монтаж, кадры, речь."""

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}

# Моменты хука, которые снимаем всегда: первые 3 секунды решают удержание.
HOOK_TIMES = [0.0, 0.5, 1.0, 1.5, 2.0, 3.0]
MAX_FRAMES = 20


@dataclass
class VideoFacts:
    path: Path
    duration: float = 0.0
    width: int = 0
    height: int = 0
    fps: float = 0.0
    cuts: list[float] = field(default_factory=list)
    frames: list[tuple[float, Path]] = field(default_factory=list)
    transcript: list[tuple[float, float, str]] = field(default_factory=list)
    language: str = ""

    @property
    def cuts_per_10s(self) -> float:
        return round(len(self.cuts) / self.duration * 10, 1) if self.duration else 0.0

    @property
    def avg_shot(self) -> float:
        return round(self.duration / (len(self.cuts) + 1), 2) if self.duration else 0.0

    @property
    def words_per_sec(self) -> float:
        words = sum(len(t.split()) for _, _, t in self.transcript)
        return round(words / self.duration, 2) if self.duration else 0.0

    def summary(self) -> str:
        orient = "вертикальное 9:16" if self.height > self.width else "горизонтальное/квадрат"
        first_cut = f"{self.cuts[0]:.1f} c" if self.cuts else "нет склеек"
        lines = [
            f"Файл: {self.path.name}",
            f"Длительность: {self.duration:.1f} c, {self.width}x{self.height} ({orient}), {self.fps:.0f} fps",
            f"Склеек: {len(self.cuts)} (≈{self.cuts_per_10s} на 10 c, средний план {self.avg_shot} c), первая склейка: {first_cut}",
            f"Моменты склеек: {', '.join(f'{c:.1f}' for c in self.cuts[:60]) or '—'}",
            f"Темп речи: {self.words_per_sec} слов/с" if self.transcript else "Речи не обнаружено (музыка / текст на экране)",
        ]
        if self.transcript:
            lines.append("Расшифровка речи с таймкодами:")
            lines += [f"[{s:05.1f}-{e:05.1f}] {t}" for s, e, t in self.transcript]
        return "\n".join(lines)


def _run(args: list[str]) -> str:
    proc = subprocess.run([FFMPEG, "-hide_banner", *args], capture_output=True, text=True, errors="replace")
    return proc.stderr


def probe(facts: VideoFacts) -> None:
    info = _run(["-i", str(facts.path)])
    if m := re.search(r"Duration: (\d+):(\d+):([\d.]+)", info):
        h, mnt, s = m.groups()
        facts.duration = int(h) * 3600 + int(mnt) * 60 + float(s)
    if m := re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", info):
        facts.width, facts.height = int(m.group(1)), int(m.group(2))
    if m := re.search(r"([\d.]+) fps", info):
        facts.fps = float(m.group(1))
    # Телефонные видео часто хранят поворот в метаданных.
    if re.search(r"rotate\s*:\s*-?(90|270)|rotation of -?90", info):
        facts.width, facts.height = facts.height, facts.width


def detect_cuts(facts: VideoFacts, threshold: float = 0.3) -> None:
    out = _run([
        "-i", str(facts.path), "-an",
        "-vf", f"select='gt(scene,{threshold})',showinfo", "-f", "null", "-",
    ])
    facts.cuts = [round(float(t), 2) for t in re.findall(r"pts_time:([\d.]+)", out)]


def extract_frames(facts: VideoFacts, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    dur = max(facts.duration - 0.05, 0.0)
    times = [t for t in HOOK_TIMES if t < dur]
    # Кадры сразу после склеек показывают смену сцен, остаток — равномерно.
    times += [c + 0.1 for c in facts.cuts if c > 3.0]
    step = max((dur - 3.0) / 8, 1.0)
    times += [3.0 + step * i for i in range(1, 9) if 3.0 + step * i < dur]
    times.append(max(dur - 0.3, 0.0))  # финал / призыв к действию

    times = sorted({round(t, 1) for t in times})
    if len(times) > MAX_FRAMES:
        hook = [t for t in times if t <= 3.0]
        rest = [t for t in times if t > 3.0]
        keep = MAX_FRAMES - len(hook)
        rest = [rest[round(i * (len(rest) - 1) / max(keep - 1, 1))] for i in range(keep)]
        times = sorted(set(hook + rest))

    for t in times:
        target = out_dir / f"{t:06.1f}.jpg"
        if not target.exists():
            _run(["-ss", f"{t}", "-i", str(facts.path), "-frames:v", "1",
                  "-vf", "scale=512:-2", "-q:v", "4", "-y", str(target)])
        if target.exists():
            facts.frames.append((t, target))


_whisper = None


def transcribe(facts: VideoFacts, model_size: str = "small") -> None:
    global _whisper
    from faster_whisper import WhisperModel

    if _whisper is None:
        _whisper = WhisperModel(model_size, device="auto", compute_type="int8")
    segments, info = _whisper.transcribe(str(facts.path), vad_filter=True)
    facts.language = info.language
    facts.transcript = [(s.start, s.end, s.text.strip()) for s in segments if s.text.strip()]


def collect(path: Path, work_dir: Path, whisper_model: str, skip_speech: bool) -> VideoFacts:
    facts = VideoFacts(path=path)
    probe(facts)
    detect_cuts(facts)
    extract_frames(facts, work_dir / "frames" / path.stem)
    if not skip_speech:
        transcribe(facts, whisper_model)
    return facts
