"""Rendering every timeline segment into a normalised clip (same size/fps/audio)."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from . import ass, cleanup, grading
from .ffmpeg import esc, hex_color, probe, run


@dataclass
class Ctx:
    width: int            # design resolution (ASS PlayRes, config pixel units)
    height: int
    fps: int
    workdir: Path
    font: str
    styles: dict
    grade: dict           # global grade
    fonts_dir: Path | None = None
    scale: float = 1.0    # <1 for --preview renders
    verbose: bool = False
    crf: int = 16
    preset: str = "veryfast"
    extra: dict = field(default_factory=dict)

    @property
    def w(self) -> int:
        return int(round(self.width * self.scale / 2)) * 2

    @property
    def h(self) -> int:
        return int(round(self.height * self.scale / 2)) * 2

    def enc(self) -> list[str]:
        return ["-c:v", "libx264", "-preset", self.preset, "-crf", str(self.crf), "-pix_fmt", "yuv420p",
                "-r", str(self.fps), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]

    def ass_filter(self, path: Path) -> str:
        f = f"ass=filename={esc(path)}"
        if self.fonts_dir:
            f += f":fontsdir={esc(self.fonts_dir)}"
        return f


def _fit(mode: str, w: int, h: int, tag: str) -> str:
    """Filter that turns any-aspect input [in] into a WxH frame."""
    if mode == "fit":
        return f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"
    if mode == "blur":
        sw, sh = max(2, w // 8 // 2 * 2), max(2, h // 8 // 2 * 2)
        return (
            f"split=2[{tag}bg][{tag}fg];"
            f"[{tag}bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
            f"scale={sw}:{sh},gblur=sigma=5,scale={w}:{h},eq=brightness=-0.07:saturation=1.1[{tag}b];"
            f"[{tag}fg]scale={w}:{h}:force_original_aspect_ratio=decrease[{tag}f];"
            f"[{tag}b][{tag}f]overlay=(W-w)/2:(H-h)/2"
        )
    # fill: crop to fill the frame, focus point via crop_x/crop_y (0..1) handled by caller
    return f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"


def _fit_seg(seg: dict, w: int, h: int, tag: str) -> str:
    mode = seg.get("fit", "fill")
    if mode == "fill" and ("focus_x" in seg or "focus_y" in seg):
        fx, fy = float(seg.get("focus_x", 0.5)), float(seg.get("focus_y", 0.5))
        return (f"scale={w}:{h}:force_original_aspect_ratio=increase,"
                f"crop={w}:{h}:(iw-{w})*{fx}:(ih-{h})*{fy}")
    return _fit(mode, w, h, tag)


def _atempo(speed: float) -> str:
    parts, s = [], speed
    while s > 2.0:
        parts.append("atempo=2.0")
        s /= 2.0
    while s < 0.5:
        parts.append("atempo=0.5")
        s /= 0.5
    parts.append(f"atempo={s:.5f}")
    return ",".join(parts)


def _kenburns(motion: str, frames: int, amount: float, w: int, h: int, fps: int) -> str:
    n = max(frames - 1, 1)
    p = f"(on/{n})"
    ease = f"(0.5-0.5*cos(PI*{p}))"  # smooth start/stop
    cx, cy = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    z, x, y = "1", cx, cy
    if motion == "zoom_in":
        z = f"1+{amount}*{ease}"
    elif motion == "zoom_out":
        z = f"1+{amount}*(1-{ease})"
    elif motion in ("pan_left", "pan_right", "pan_up", "pan_down"):
        z = f"1+{amount}"
        e = ease if motion in ("pan_right", "pan_down") else f"(1-{ease})"
        if motion in ("pan_left", "pan_right"):
            x = f"(iw-iw/zoom)*{e}"
        else:
            y = f"(ih-ih/zoom)*{e}"
    return f"zoompan=z='{z}':x='{x}':y='{y}':d=1:s={w}x{h}:fps={fps}"


def _cache_name(ctx: Ctx, idx: int, seg: dict, kind: str) -> Path:
    bg = seg.get("background")
    src = seg.get("src") or (bg.get("image") if isinstance(bg, dict) else None)
    stamp = ""
    for p in (src, seg.get("_grade", {}).get("lut")):
        if p and Path(p).exists():
            st = Path(p).stat()
            stamp += f"{p}:{st.st_mtime_ns}:{st.st_size};"
    key = json.dumps([seg, stamp, ctx.w, ctx.h, ctx.fps, ctx.font, ctx.styles, ctx.crf, str(ctx.fonts_dir), 3],
                     sort_keys=True, default=str)
    digest = hashlib.sha1(key.encode()).hexdigest()[:10]
    return ctx.workdir / f"seg{idx:03d}_{kind}_{digest}.mp4"


def segment_duration(seg: dict) -> float:
    if seg.get("_keep"):
        return sum(e - s for s, e in seg["_keep"])
    if seg["type"] == "video":
        start = float(seg.get("start", 0))
        end = seg.get("end")
        if end is None:
            end = seg["_src_duration"] if seg.get("duration") is None else start + float(seg["duration"])
        return max(0.1, (float(end) - start) / float(seg.get("speed", 1.0)))
    return float(seg.get("duration", 4.0 if seg["type"] == "image" else 3.0))


def render(ctx: Ctx, idx: int, seg: dict) -> Path:
    out = _cache_name(ctx, idx, seg, seg["type"])
    if out.exists() and out.stat().st_size > 0:
        return out
    tmp = out.with_suffix(".tmp.mp4")
    {"video": _video, "image": _image, "slide": _slide}[seg["type"]](ctx, idx, seg, tmp)
    tmp.replace(out)
    return out


def _overlay_ass(ctx: Ctx, idx: int, seg: dict, duration: float) -> str:
    doc = ass.AssDoc(ctx.width, ctx.height, ctx.font, ctx.styles)
    if seg["type"] == "slide":
        ass.slide_events(doc, seg, duration)
    else:
        ass.caption_events(doc, seg, duration)
    if not doc.events:
        return ""
    return "," + ctx.ass_filter(doc.write(ctx.workdir / f"seg{idx:03d}.ass"))


def _video(ctx: Ctx, idx: int, seg: dict, out: Path) -> None:
    info = probe(seg["src"])
    keep = seg.get("_keep")
    start = float(seg.get("start", 0))
    speed = 1.0 if keep else float(seg.get("speed", 1.0))
    dur = segment_duration(seg)
    src_len = dur * speed
    grade = grading.filters(seg["_grade"], f"g{idx}")
    beauty = grading.beauty(seg.get("_beauty"), f"b{idx}", ctx.h / 1920)
    if keep:  # talking head: keep only the good takes (whole file is read)
        vsel, asel = cleanup.select_filters(keep)
        v = [f"setpts=PTS-STARTPTS,fps={ctx.fps}", vsel]
        args = ["-i", seg["src"]]
    else:
        v = [f"setpts=(PTS-STARTPTS)/{speed}"]
        args = ["-ss", f"{start:.3f}", "-t", f"{src_len:.3f}", "-i", seg["src"]]
    v += [_to_sdr(info), _fit_seg(seg, ctx.w, ctx.h, f"f{idx}"), "setsar=1", f"fps={ctx.fps}"]
    v += [f for f in (beauty, grade) if f]
    vchain = "[0:v]" + ",".join(f for f in v if f)
    # cutaways: other footage over the picture while the voice keeps going
    for k, br in enumerate(seg.get("_broll") or []):
        clip = render(ctx, idx * 100 + k + 1, br["_seg"])
        n_in = len([a for a in args if a == "-i"])
        args += ["-i", str(clip)]
        at, d, fd = br["_at"], br["_dur"], float(br.get("fade", 0.2))
        vchain += (f"[base{k}];[{n_in}:v]format=yuva420p,"
                   f"fade=t=in:st=0:d={fd}:alpha=1,fade=t=out:st={max(d - fd, 0):.3f}:d={fd}:alpha=1,"
                   f"setpts=PTS-STARTPTS+{at:.3f}/TB[br{k}];"
                   f"[base{k}][br{k}]overlay=eof_action=pass:enable='between(t,{at:.3f},{at + d:.3f})'")
    vchain += _overlay_ass(ctx, idx, seg, dur) + ",format=yuv420p[v]"

    vol = float(seg.get("volume", 1.0))
    if info.has_audio and vol > 0 and not seg.get("mute"):
        if keep:
            a = f"[0:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,{asel},volume={vol},"
        else:
            a = f"[0:a]asetpts=PTS-STARTPTS,{_atempo(speed)},volume={vol},"
        fin, fout = float(seg.get("audio_fade_in", 0.05)), float(seg.get("audio_fade_out", 0.05))
        a += f"afade=t=in:d={fin},afade=t=out:st={max(dur - fout, 0):.3f}:d={fout},"
        achain = a + "aresample=48000,aformat=channel_layouts=stereo,apad[a]"
    else:
        n_in = len([a for a in args if a == "-i"])
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        achain = f"[{n_in}:a]anull[a]"
    run([*args, "-filter_complex", vchain + ";" + achain, "-map", "[v]", "-map", "[a]",
         "-t", f"{dur:.3f}", *ctx.enc(), str(out)], ctx.verbose)


def _to_sdr(info) -> str:
    """iPhone HDR (HLG / PQ, BT.2020) -> SDR BT.709, otherwise colours look washed out."""
    if info.color_transfer in ("arib-std-b67", "smpte2084"):
        return ("zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,"
                "tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
    return ""


def _still_then_motion(ctx: Ctx, idx: int, seg: dict, out: Path, still_args: list[str],
                       still_vf: Callable[[int, int], str], motion_default: str) -> None:
    """Render one high-res graded still, then animate it (Ken Burns) + text."""
    dur = segment_duration(seg)
    motion = seg.get("motion", motion_default)
    amount = float(seg.get("zoom", 0.12))
    ss = 2 if motion != "none" else 1  # oversample for smooth motion
    W, H = ctx.w * ss, ctx.h * ss
    still = ctx.workdir / f"seg{idx:03d}_still.png"
    run([*still_args, "-filter_complex", still_vf(W, H), "-frames:v", "1", str(still)], ctx.verbose)

    frames = max(1, round(dur * ctx.fps))
    v = f"[0:v]{_kenburns(motion, frames, amount, ctx.w, ctx.h, ctx.fps)},setsar=1"
    if seg.get("_grade", {}).get("grain"):
        v += f",noise=alls={int(seg['_grade']['grain'])}:allf=t"
    v += _overlay_ass(ctx, idx, seg, dur) + ",format=yuv420p[v]"
    run(["-loop", "1", "-framerate", str(ctx.fps), "-t", f"{dur:.3f}", "-i", str(still),
         "-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo",
         "-filter_complex", v, "-map", "[v]", "-map", "1:a", "-t", f"{dur:.3f}", *ctx.enc(), str(out)],
        ctx.verbose)


def _no_grain(g: dict) -> dict:
    return {k: v for k, v in g.items() if k != "grain"}


def _image(ctx: Ctx, idx: int, seg: dict, out: Path) -> None:
    grade = grading.filters(_no_grain(seg["_grade"]), f"g{idx}")

    def still_vf(W: int, H: int) -> str:
        return "[0:v]" + _fit_seg(seg, W, H, f"f{idx}") + ",setsar=1" + ("," + grade if grade else "") + ",format=rgb24"

    _still_then_motion(ctx, idx, seg, out, ["-i", seg["src"]], still_vf, "zoom_in")


def _slide(ctx: Ctx, idx: int, seg: dict, out: Path) -> None:
    bg = seg.get("background", "#111111")
    grade = grading.filters(_no_grain(seg["_grade"]), f"g{idx}") if seg.get("_grade") else ""

    def fmt(W: int, H: int) -> str:
        if isinstance(bg, dict) and bg.get("image"):
            chain = "[0:v]" + _fit(bg.get("fit", "fill"), W, H, f"f{idx}")
            if bg.get("blur"):
                sw, sh = max(2, W // 8 // 2 * 2), max(2, H // 8 // 2 * 2)
                chain += f",scale={sw}:{sh},gblur=sigma={float(bg['blur']) / 8:.2f},scale={W}:{H}"
            if grade:
                chain += "," + grade
            if bg.get("darken"):
                chain += f",drawbox=c=black@{float(bg['darken']):.2f}:t=fill"
            return chain + ",setsar=1,format=rgb24"
        if isinstance(bg, dict) and bg.get("gradient"):
            cols = bg["gradient"]
            cs = ":".join(f"c{i}={hex_color(c)}" for i, c in enumerate(cols[:8]))
            angle = bg.get("direction", "vertical")
            x0, y0, x1, y1 = (0, 0, W, H) if angle == "diagonal" else (0, 0, W, 0) if angle == "horizontal" \
                else (W // 2, 0, W // 2, H)
            return (f"gradients=s={W}x{H}:{cs}:nb_colors={len(cols[:8])}:x0={x0}:y0={y0}:x1={x1}:y1={y1}"
                    f",setsar=1,format=rgb24")
        return f"color=c={hex_color(bg)}:s={W}x{H},setsar=1,format=rgb24"

    args = ["-i", bg["image"]] if isinstance(bg, dict) and bg.get("image") else []
    _still_then_motion(ctx, idx, seg, out, args, fmt, "zoom_in" if args else "none")
