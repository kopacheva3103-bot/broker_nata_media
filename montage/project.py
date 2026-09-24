"""Loading a project file and running the whole pipeline."""
from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import ass, assemble, grading, segments
from .ffmpeg import probe


class ConfigError(ValueError):
    pass


def load(path: str | Path) -> dict:
    path = Path(path).resolve()
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in (".yaml", ".yml"):
        try:
            import yaml
        except ImportError as e:
            raise ConfigError("Для YAML-проектов нужен PyYAML: pip install pyyaml (или используйте .json)") from e
        data = yaml.safe_load(text) or {}
    else:
        data = json.loads(text)
    data["_base"] = str(path.parent)
    return normalise(data)


def _abs(base: Path, p: str | None) -> str | None:
    if not p:
        return p
    q = Path(os.path.expanduser(str(p)))
    return str(q if q.is_absolute() else (base / q).resolve())


def _need(path: str | None, what: str) -> None:
    if not path or not Path(path).exists():
        raise ConfigError(f"{what}: файл не найден — {path}")


def normalise(p: dict) -> dict:
    base = Path(p.get("_base", "."))
    if not p.get("segments"):
        raise ConfigError("В проекте нет ни одного сегмента (segments)")
    p["output"] = _abs(base, p.get("output", "out/reel.mp4"))
    if p.get("fonts_dir"):
        p["fonts_dir"] = _abs(base, p["fonts_dir"])
    g = p.get("grade")
    if isinstance(g, dict) and g.get("lut"):
        g["lut"] = _abs(base, g["lut"])
    default_tr = p.get("transition", {"type": "fade", "duration": 0.4})
    if isinstance(default_tr, str):
        default_tr = {"type": default_tr}

    for i, seg in enumerate(p["segments"], 1):
        where = f"Сегмент #{i}"
        t = seg.get("type") or ("slide" if "src" not in seg else None)
        if t is None:
            ext = Path(seg["src"]).suffix.lower()
            t = "image" if ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic") else "video"
        if t not in ("video", "image", "slide"):
            raise ConfigError(f"{where}: неизвестный тип '{t}' (video | image | slide)")
        seg["type"] = t
        if t in ("video", "image"):
            seg["src"] = _abs(base, seg.get("src"))
            _need(seg["src"], where)
        bg = seg.get("background")
        if isinstance(bg, dict) and bg.get("image"):
            bg["image"] = _abs(base, bg["image"])
            _need(bg["image"], f"{where} (фон)")
        if t == "video":
            info = probe(seg["src"])
            if not info.has_video:
                raise ConfigError(f"{where}: в файле нет видеодорожки — {seg['src']}")
            seg["_src_duration"] = info.duration
            if float(seg.get("start", 0)) >= info.duration:
                raise ConfigError(f"{where}: start={seg.get('start')} больше длины клипа ({info.duration:.1f} c)")
            if seg.get("end") is not None and float(seg["end"]) > info.duration:
                seg["end"] = info.duration
        sg = seg.get("grade")
        if isinstance(sg, dict) and sg.get("lut"):
            sg["lut"] = _abs(base, sg["lut"])
        # slides are not graded by the global grade (brand colours stay exact)
        try:
            if t == "slide" and not isinstance(bg, dict):
                seg["_grade"] = grading.merge(sg) if sg else {}
            elif sg is False or sg == "none":
                seg["_grade"] = {}
            else:
                seg["_grade"] = grading.merge(g, sg)
        except ValueError as e:
            raise ConfigError(f"{where}: {e}") from e
        tr = seg.get("transition", default_tr)
        seg["_transition"] = {"type": tr} if isinstance(tr, str) else {**default_tr, **tr}
        if segments.segment_duration(seg) <= 0:
            raise ConfigError(f"{where}: нулевая длительность")

    audio = p.get("audio") or {}
    for key, what in (("music", "Музыка"), ("voiceover", "Озвучка")):
        if audio.get(key):
            audio[key] = _abs(base, audio[key])
            _need(audio[key], what)
    p["audio"] = audio
    subs = p.get("subtitles") or {}
    if subs.get("srt"):
        subs["srt"] = _abs(base, subs["srt"])
        _need(subs["srt"], "Субтитры")
    p["subtitles"] = subs
    wm = p.get("watermark")
    if wm:
        wm["src"] = _abs(base, wm["src"])
        _need(wm["src"], "Логотип")
    return p


def _cues(p: dict, ctx: segments.Ctx, files: list[Path], joins: list) -> list[ass.Cue]:
    subs = p["subtitles"]
    cues: list[ass.Cue] = []
    if subs.get("srt"):
        cues += ass.parse_srt(Path(subs["srt"]).read_text(encoding="utf-8-sig"))
    for item in subs.get("items") or []:
        cues.append(ass.Cue(float(item["start"]), float(item["end"]), str(item["text"])))
    if subs.get("auto"):
        from . import autosubs
        from .ffmpeg import run
        wav = ctx.workdir / "voice.wav"
        vo = p["audio"].get("voiceover")
        if vo:  # a separate voice-over is what people want subtitled
            run(["-i", vo, "-vn", "-ac", "1", "-ar", "16000", str(wav)], ctx.verbose)
        else:
            assemble.voice_track(ctx, files, joins, wav)
        print("  распознаю речь (Whisper)…")
        auto = autosubs.transcribe(wav, subs.get("model", "small"), subs.get("language", "ru"))
        if vo and float(p["audio"].get("voiceover_start", 0)):
            shift = float(p["audio"]["voiceover_start"])
            for c in auto:
                c.start, c.end = c.start + shift, c.end + shift
                c.words = [(a + shift, b + shift, w) for a, b, w in c.words] if c.words else None
        srt = Path(p["output"]).with_suffix(".srt")
        ass.write_srt(auto, srt)
        print(f"  субтитры сохранены в {srt} — можно поправить и подключить через subtitles.srt")
        cues += auto
    return sorted(cues, key=lambda c: c.start)


def render(p: dict, preview: bool = False, jobs: int | None = None, verbose: bool = False) -> Path:
    t0 = time.time()
    out = Path(p["output"])
    if preview:
        out = out.with_name(out.stem + "_preview" + out.suffix)
    out.parent.mkdir(parents=True, exist_ok=True)
    work = Path(p.get("workdir") or out.parent / ".montage_cache")
    work.mkdir(parents=True, exist_ok=True)
    styles = p.get("styles") or {}
    if p.get("subtitle_style"):
        styles = {**styles, "subtitle": {**styles.get("subtitle", {}), **p["subtitle_style"]}}
    ctx = segments.Ctx(
        width=int(p.get("width", 1080)), height=int(p.get("height", 1920)), fps=int(p.get("fps", 30)),
        workdir=work, font=p.get("font", "DejaVu Sans"), styles=styles,
        grade=p.get("grade") or {}, fonts_dir=Path(p["fonts_dir"]) if p.get("fonts_dir") else None,
        scale=0.5 if preview else 1.0, verbose=verbose,
        crf=22 if preview else 16, preset="ultrafast" if preview else "veryfast",
        extra={"final_preset": "veryfast" if preview else "medium", "final_crf": 23 if preview else 18},
    )
    segs = p["segments"]
    print(f"Монтаж: {len(segs)} сегм., {ctx.w}x{ctx.h} @ {ctx.fps}fps → {out}")

    def job(i: int) -> Path:
        path = segments.render(ctx, i, segs[i])
        print(f"  [{i + 1}/{len(segs)}] {segs[i]['type']:5s} {segments.segment_duration(segs[i]):5.1f}c  готово")
        return path

    workers = jobs or max(1, min(4, (os.cpu_count() or 2) // 2))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        files = list(pool.map(job, range(len(segs))))

    durations = [probe(f).duration for f in files]
    transitions = [s["_transition"] for s in segs[:-1]]
    joins, _, _ = assemble.plan(durations, transitions)
    cues = _cues(p, ctx, files, joins)
    print("  финальная сборка: переходы, звук, субтитры…")
    length = assemble.final(ctx, files, durations, transitions, p, cues, out)
    print(f"Готово: {out}  ({length:.1f} c, за {time.time() - t0:.0f} c)")
    return out
