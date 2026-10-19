"""Colour grading: presets + manual controls, turned into an ffmpeg filter chain."""
from __future__ import annotations

from pathlib import Path

from .ffmpeg import esc

# Each preset is just a set of default parameters; user values override them.
PRESETS: dict[str, dict] = {
    "none": {},
    "natural": {"contrast": 1.04, "saturation": 1.06, "sharpen": 0.3},
    # Bright, airy look for interiors / real estate: lifted shadows, clean whites.
    "interior": {
        "auto_levels": 0.4, "brightness": 0.03, "gamma": 1.12, "contrast": 1.03,
        "saturation": 1.12, "temperature": 6300, "sharpen": 0.5,
    },
    "warm": {"temperature": 5200, "saturation": 1.08, "contrast": 1.04},
    "cool": {"temperature": 8200, "saturation": 0.98, "contrast": 1.05},
    # Teal shadows / orange highlights.
    "cinematic": {
        "contrast": 1.08, "saturation": 0.95,
        "shadows": [-0.06, 0.0, 0.08], "highlights": [0.07, 0.02, -0.07],
        "curves": "0/0.03 0.25/0.21 0.5/0.5 0.75/0.8 1/0.97", "vignette": 0.5,
    },
    "vivid": {"contrast": 1.1, "saturation": 1.35, "sharpen": 0.6},
    "film": {
        "curves": "0/0.07 0.3/0.29 0.7/0.72 1/0.94", "saturation": 0.88,
        "temperature": 5800, "grain": 7, "vignette": 0.35,
    },
    "moody": {
        "brightness": -0.04, "contrast": 1.12, "saturation": 0.78,
        "shadows": [-0.04, 0.0, 0.06], "vignette": 0.6,
    },
    "bw": {"saturation": 0.0, "contrast": 1.18, "grain": 5},
}

PARAMS = {
    "preset", "brightness", "contrast", "saturation", "gamma", "temperature", "shadows", "midtones",
    "highlights", "curves", "lut", "lut_intensity", "vignette", "sharpen", "grain", "auto_levels",
}


def merge(*grades: dict | str | None) -> dict:
    """Merge grades left to right. A string is shorthand for {'preset': name}."""
    out: dict = {}
    for g in grades:
        if not g:
            continue
        if isinstance(g, str):
            g = {"preset": g}
        if "preset" in g and g["preset"] != out.get("preset"):
            name = g["preset"]
            if name not in PRESETS:
                raise ValueError(f"Неизвестный пресет цветокоррекции '{name}'. Доступны: {', '.join(PRESETS)}")
            # A new preset replaces the preset part, keeps nothing from the old one.
            out = {"preset": name, **PRESETS[name]}
        unknown = set(g) - PARAMS
        if unknown:
            raise ValueError(f"Неизвестные параметры цветокоррекции: {', '.join(sorted(unknown))}")
        out.update({k: v for k, v in g.items() if k != "preset"})
    return out


def filters(grade: dict, label_prefix: str = "g") -> str:
    """Return a comma-separated filter chain ('' when nothing to do).

    The chain may contain labelled sub-graphs (LUT intensity blend), so callers
    must place it where a full filterchain segment is allowed.
    """
    f: list[str] = []
    g = grade
    if g.get("auto_levels"):
        strength = 1.0 if g["auto_levels"] is True else float(g["auto_levels"])
        f.append(f"normalize=smoothing=24:strength={strength:.3f}:independence=0.3")
    if g.get("temperature") and float(g["temperature"]) != 6500:
        f.append(f"colortemperature=temperature={float(g['temperature']):.0f}:mix=0.8:pl=0.5")
    eq = []
    for key, default in (("brightness", 0.0), ("contrast", 1.0), ("saturation", 1.0), ("gamma", 1.0)):
        if key in g and float(g[key]) != default:
            eq.append(f"{key}={float(g[key]):.4f}")
    if eq:
        f.append("eq=" + ":".join(eq))
    cb = []
    for zone, prefix in (("shadows", "s"), ("midtones", "m"), ("highlights", "h")):
        if g.get(zone):
            r, gr, b = (list(g[zone]) + [0, 0, 0])[:3]
            cb += [f"r{prefix}={r}", f"g{prefix}={gr}", f"b{prefix}={b}"]
    if cb:
        f.append("colorbalance=" + ":".join(cb) + ":pl=1")
    if g.get("curves"):
        curves = str(g["curves"])
        if curves in {"lighter", "darker", "increase_contrast", "strong_contrast", "vintage", "medium_contrast"}:
            f.append(f"curves=preset={curves}")
        else:
            f.append(f"curves=all='{curves}'")
    if g.get("lut"):
        lut = Path(g["lut"])
        if not lut.exists():
            raise FileNotFoundError(f"LUT не найден: {lut}")
        intensity = float(g.get("lut_intensity", 1.0))
        if intensity >= 0.999:
            f.append(f"lut3d=file={esc(lut)}")
        else:
            p = label_prefix
            f.append(
                f"split=2[{p}a][{p}b];[{p}b]lut3d=file={esc(lut)}[{p}l];"
                f"[{p}a][{p}l]blend=all_mode=normal:all_opacity={intensity:.3f}"
            )
    if g.get("vignette"):
        v = 0.5 if g["vignette"] is True else float(g["vignette"])
        # angle PI/5 is subtle, PI/3 is heavy
        angle = 0.35 + 0.7 * max(0.0, min(v, 1.0))
        f.append(f"vignette=angle={angle:.3f}")
    if g.get("sharpen"):
        f.append(f"unsharp=5:5:{float(g['sharpen']):.2f}:5:5:0")
    if g.get("grain"):
        f.append(f"noise=alls={int(g['grain'])}:allf=t")
    return ",".join(f)


def beauty(cfg: dict | None, p: str = "b", k: float = 1.0) -> str:
    """Skin smoothing + skin tone evening, limited to skin-coloured areas.

    cfg: {skin_smooth: 0..1 (0.14 = 14 %), skin_tone: 0..1}
    A soft skin mask is built from chroma (Cb/Cr skin range); inside it the
    luma is smoothed edge-preservingly (bilateral) and the chroma is evened
    out (blotches / redness blend into the surrounding tone).
    """
    if not cfg:
        return ""
    smooth = float(cfg.get("skin_smooth", 0))
    tone = float(cfg.get("skin_tone", 0))
    if smooth <= 0 and tone <= 0:
        return ""
    u0, u1 = cfg.get("cb_range", (80, 130))
    v0, v1 = cfg.get("cr_range", (135, 178))
    ramp = 6

    def band(lo: int, hi: int) -> str:
        return f"255*clip((val-{lo})/{ramp},0,1)*clip(({hi}-val)/{ramp},0,1)"

    return (
        f"format=yuv444p,split=3[{p}o][{p}m][{p}s];"
        f"[{p}m]extractplanes=u+v[{p}u][{p}v];"
        f"[{p}u]lut=c0='{band(u0, u1)}'[{p}mu];[{p}v]lut=c0='{band(v0, v1)}'[{p}mv];"
        f"[{p}mu][{p}mv]blend=all_mode=multiply,gblur=sigma={6 * k:.1f},split=2[{p}m1][{p}m2];"
        f"[{p}m1]lut=c0='val*{min(smooth, 1):.3f}'[{p}ml];[{p}m2]lut=c0='val*{min(tone, 1):.3f}'[{p}mc];"
        f"[{p}ml][{p}mc]mergeplanes=format=yuv444p:map0s=0:map0p=0:map1s=1:map1p=0:map2s=1:map2p=0[{p}mask];"
        f"[{p}s]bilateral=sigmaS={12 * k:.1f}:sigmaR=0.10:planes=1,gblur=sigma={10 * k:.1f}:planes=6[{p}sm];"
        f"[{p}o][{p}sm][{p}mask]maskedmerge"
    )
