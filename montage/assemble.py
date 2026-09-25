"""Joining rendered segments with transitions, music, subtitles and a logo."""
from __future__ import annotations

from pathlib import Path

from . import ass
from .ffmpeg import run
from .segments import Ctx

XFADE = {
    "fade", "fadeblack", "fadewhite", "dissolve", "wipeleft", "wiperight", "wipeup", "wipedown",
    "slideleft", "slideright", "slideup", "slidedown", "smoothleft", "smoothright", "smoothup", "smoothdown",
    "circlecrop", "rectcrop", "circleopen", "circleclose", "vertopen", "vertclose", "horzopen", "horzclose",
    "radial", "pixelize", "hblur", "distance", "squeezeh", "squeezev", "zoomin", "diagtl", "diagtr",
    "diagbl", "diagbr", "hlslice", "hrslice", "vuslice", "vdslice", "coverleft", "coverright", "coverup",
    "coverdown", "revealleft", "revealright", "revealup", "revealdown",
}


def plan(durations: list[float], transitions: list[dict]) -> tuple[list[tuple[str, float, float]], list[float], float]:
    """Return per-join (type, duration, offset), segment start times and total length."""
    joins, starts = [], [0.0]
    length = durations[0]
    for i in range(1, len(durations)):
        t = transitions[i - 1]
        kind = t.get("type", "fade")
        d = float(t.get("duration", 0.5)) if kind not in ("cut", "none") else 0.0
        d = max(0.0, min(d, durations[i - 1] * 0.5, durations[i] * 0.5))
        if d < 0.04:
            kind, d = "cut", 0.0
        joins.append((kind, d, length - d))
        starts.append(length - d)
        length = length + durations[i] - d
    return joins, starts, length


def _chain(n: int, joins: list, video: bool) -> tuple[list[str], str]:
    parts = []
    for i in range(n):
        if video:
            parts.append(f"[{i}:v]settb=AVTB,setpts=PTS-STARTPTS[v{i}]")
        else:
            parts.append(f"[{i}:a]asetpts=PTS-STARTPTS[a{i}]")
    cur = "v0" if video else "a0"
    for i, (kind, d, off) in enumerate(joins, 1):
        nxt = f"{'v' if video else 'a'}x{i}"
        src = f"v{i}" if video else f"a{i}"
        if kind == "cut":
            f = f"concat=n=2:v={1 if video else 0}:a={0 if video else 1}"
        elif video:
            f = f"xfade=transition={kind}:duration={d:.3f}:offset={off:.3f}"
        else:
            f = f"acrossfade=d={d:.3f}:c1=tri:c2=tri"
        parts.append(f"[{cur}][{src}]{f}[{nxt}]")
        cur = nxt
    return parts, cur


def voice_track(ctx: Ctx, files: list[Path], joins: list, out: Path) -> Path:
    """Only the joined original audio (used for automatic subtitles)."""
    parts, cur = _chain(len(files), joins, video=False)
    args = [a for f in files for a in ("-i", str(f))]
    run([*args, "-filter_complex", ";".join(parts), "-map", f"[{cur}]", "-ac", "1", "-ar", "16000", str(out)],
        ctx.verbose)
    return out


def final(ctx: Ctx, files: list[Path], durations: list[float], transitions: list[dict], project: dict,
          cues: list[ass.Cue], out: Path) -> float:
    joins, _, length = plan(durations, transitions)
    args = [a for f in files for a in ("-i", str(f))]
    vparts, vcur = _chain(len(files), joins, video=True)
    aparts, acur = _chain(len(files), joins, video=False)
    graph = vparts + aparts
    n = len(files)

    # subtitles over the whole reel
    title = project.get("title")
    if title and title.get("darken"):
        # darkened lower part of the frame while the title is on screen
        t0, t1 = float(title.get("start", 0)), float(title.get("end", 3.5))
        k, h = float(title["darken"]), ctx.h
        gh = int(h * float(title.get("darken_height", 0.45))) // 2 * 2
        args += ["-f", "lavfi", "-t", f"{t1:.3f}", "-i", f"color=c=black:s={ctx.w}x{gh}:r={ctx.fps}"]
        graph.append(f"[{n}:v]format=rgba,geq=r=0:g=0:b=0:a='255*{k}*pow(Y/H,1.1)',"
                     f"fade=t=in:st={t0}:d=0.35:alpha=1,fade=t=out:st={max(t1 - 0.4, 0):.3f}:d=0.4:alpha=1,"
                     f"setpts=PTS-STARTPTS[dk]")
        graph.append(f"[{vcur}][dk]overlay=0:H-h:eof_action=pass[vd]")
        vcur = "vd"
        n += 1
    if cues or title:
        doc = ass.AssDoc(ctx.width, ctx.height, ctx.font, ctx.styles)
        scfg = dict(project.get("subtitles") or {})
        if title and scfg.get("hide_during_title", True):
            scfg["_hide_until"] = float(title.get("end", 3.5))
        if cues:
            ass.subtitle_events(doc, cues, scfg)
        if title:
            ass.title_events(doc, title)
        path = doc.write(ctx.workdir / "subtitles.ass")
        graph.append(f"[{vcur}]{ctx.ass_filter(path)}[vs]")
        vcur = "vs"

    # logo / watermark
    wm = project.get("watermark")
    if wm:
        args += ["-loop", "1", "-i", wm["src"]]
        k = ctx.scale
        width = round(float(wm.get("width", 220)) * k)
        m = round(float(wm.get("margin", 60)) * k)
        pos = {"top_left": (f"{m}", f"{m + round(80 * k)}"), "top_right": (f"W-w-{m}", f"{m + round(80 * k)}"),
               "bottom_left": (f"{m}", f"H-h-{m}"), "bottom_right": (f"W-w-{m}", f"H-h-{m}"),
               "center": ("(W-w)/2", "(H-h)/2")}[wm.get("position", "top_right")]
        graph.append(f"[{n}:v]scale={width}:-1,format=rgba,colorchannelmixer=aa={float(wm.get('opacity', 0.85))}[wm]")
        graph.append(f"[{vcur}][wm]overlay=x={pos[0]}:y={pos[1]}:shortest=1[vw]")
        vcur = "vw"
        n += 1
    # overall playback speed (subtitles are already burned in, so they stay in sync)
    speed = float(project.get("speed", 1.0))
    if abs(speed - 1.0) > 1e-3:
        graph.append(f"[{vcur}]setpts=PTS/{speed},fps={ctx.fps}[vsp]")
        vcur = "vsp"
    graph.append(f"[{vcur}]format=yuv420p[vout]")

    # music: loop, trim, fades, ducking under the voice
    audio = project.get("audio") or {}
    if audio.get("voiceover"):
        args += ["-i", audio["voiceover"]]
        delay = int(float(audio.get("voiceover_start", 0)) * 1000)
        graph.append(
            f"[{n}:a]volume={float(audio.get('voiceover_volume', 1.0))},adelay={delay}|{delay},"
            f"aresample=48000,aformat=channel_layouts=stereo,apad[vover]"
        )
        graph.append(f"[{acur}][vover]amix=inputs=2:duration=first:normalize=0[avo]")
        acur = "avo"
        n += 1
    if abs(speed - 1.0) > 1e-3:  # tempo change keeps the voice pitch
        graph.append(f"[{acur}]atempo={speed}[asp]")
        acur = "asp"
        length = length / speed
    if audio.get("music"):
        args += ["-stream_loop", "-1", "-i", audio["music"]]
        fi, fo = float(audio.get("fade_in", 1.0)), float(audio.get("fade_out", 2.0))
        mstart = float(audio.get("music_start", 0))
        graph.append(
            f"[{n}:a]atrim=start={mstart}:duration={length:.3f},asetpts=PTS-STARTPTS,"
            f"volume={float(audio.get('music_volume', 0.3))},afade=t=in:d={fi},"
            f"afade=t=out:st={max(length - fo, 0):.3f}:d={fo},aresample=48000,aformat=channel_layouts=stereo[mus]"
        )
        if audio.get("duck", True):
            graph.append(f"[{acur}]asplit=2[vo][sc]")
            graph.append("[mus][sc]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=500[md]")
            graph.append("[vo][md]amix=inputs=2:duration=first:normalize=0[am]")
        else:
            graph.append(f"[{acur}][mus]amix=inputs=2:duration=first:normalize=0[am]")
        acur = "am"
    if audio.get("loudnorm", True):
        lufs = float(audio.get("lufs", -14))
        graph.append(f"[{acur}]loudnorm=I={lufs}:TP=-1.5:LRA=11,aresample=48000[aout]")
    else:
        graph.append(f"[{acur}]anull[aout]")

    enc = project.get("encode") or {}
    run([*args, "-filter_complex", ";\n".join(graph), "-map", "[vout]", "-map", "[aout]", "-t", f"{length:.3f}",
         "-c:v", "libx264", "-preset", enc.get("preset", ctx.extra.get("final_preset", "medium")),
         "-crf", str(enc.get("crf", ctx.extra.get("final_crf", 18))), "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-r", str(ctx.fps), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(out)],
        ctx.verbose)
    return length
