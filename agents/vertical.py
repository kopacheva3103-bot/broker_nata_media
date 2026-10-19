"""Вертикаль 9:16 для исходников перед оживлением.

Горизонтальный кадр, оживлённый как есть, в Reels стоит полосой на размытом фоне.
Поэтому до оживления делаем вертикальную версию «<имя>_9x16.jpg» рядом с оригиналом:

  auto      бока подрезаются до 4:5 вокруг focus, недостающее сверху и снизу
            дорисовывает FLUX Fill (пиксели оригинала не меняются; ~$0.05 за кадр)
  outpaint  без обрезки — весь кадр, дорисовка сверху и снизу (афиши, панорамы с текстом)
  crop      бесплатно: только обрезка до 9:16 вокруг focus
  keep      оставить горизонтальным

В брифе у кадра: vertical: crop, focus: 0.3 (0 — левый край, 1 — правый).
"""
import base64
import subprocess
import sys
import tempfile
from pathlib import Path

SUFFIX = "_9x16"
VERTICAL_MAX = 0.6        # ширина/высота ≤ 0.6 — уже вертикаль (9:16 = 0.5625)
CROP_TO = 4 / 5           # auto: бока режем не уже 4:5, остальное дорисовываем
WIDTH, HEIGHT = 864, 1536  # 9:16, кратно 32 — удобно для FLUX
FEATHER = 12              # на столько пикселей маска заходит в оригинал — без шва
FILL_MODEL = "black-forest-labs/flux-fill-pro"
PROMPT = ("Seamlessly extend this photograph upward and downward to a tall vertical frame. "
          "Continue whatever is above and below (sky, ceiling, walls, floor, ground) naturally, "
          "in exactly the same style, era, colors, "
          "lighting, film grain and sharpness. No text, no new people, no frames, no borders.")

REPO = Path(__file__).resolve().parent.parent


def size(path):
    sys.path.insert(0, str(REPO))
    from montage import ffmpeg
    info = ffmpeg.probe(path)
    return info.width, info.height


def is_vertical(path):
    w, h = size(path)
    return w / h <= VERTICAL_MAX


def is_derived(name):
    return Path(name).stem.endswith(SUFFIX)


def target(path):
    path = Path(path)
    return path.with_name(path.stem + SUFFIX + ".jpg")


def _ffmpeg(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def _crop_box(w, h, ratio, focus):
    cw = min(w, round(h * ratio))
    x = min(max(round(focus * w - cw / 2), 0), w - cw)
    return cw, h, x


def crop(src, dest, focus=0.5):
    w, h = size(src)
    cw, ch, x = _crop_box(w, h, WIDTH / HEIGHT, focus)
    _ffmpeg("-i", src, "-vf", f"crop={cw}:{ch}:{x}:0,scale={WIDTH}:{HEIGHT}", "-q:v", "2", dest)
    return dest


def outpaint(client, src, dest, mode="auto", focus=0.5, prompt=""):
    """Подрезка до 4:5 (auto) и дорисовка верха/низа через FLUX Fill."""
    w, h = size(src)
    cw, ch, x = _crop_box(w, h, CROP_TO if mode == "auto" else 10.0, focus)
    sh = min(round(ch * WIDTH / cw / 2) * 2, HEIGHT)
    top = (HEIGHT - sh) // 2
    with tempfile.TemporaryDirectory() as tmp:
        canvas, mask = Path(tmp) / "canvas.png", Path(tmp) / "mask.png"
        # оригинал по центру, поля — размытым продолжением кадра (FLUX дорисовывает их по маске)
        _ffmpeg("-i", src, "-filter_complex",
                f"[0]crop={cw}:{ch}:{x}:0,split[a][b];"
                f"[a]scale={WIDTH}:{HEIGHT},boxblur=40[bg];[b]scale={WIDTH}:{sh}[fg];"
                f"[bg][fg]overlay=0:{top}", canvas)
        keep = max(sh - 2 * FEATHER, 2)
        _ffmpeg("-f", "lavfi", "-i", f"color=white:s={WIDTH}x{HEIGHT}",
                "-f", "lavfi", "-i", f"color=black:s={WIDTH}x{keep}",
                "-filter_complex", f"[0][1]overlay=0:{top + FEATHER},format=gray", "-frames:v", "1", mask)
        uri = lambda p: "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()
        return client.run(FILL_MODEL, {"image": uri(canvas), "mask": uri(mask),
                                       "prompt": f"{PROMPT} {prompt}".strip(),
                                       "output_format": "jpg", "safety_tolerance": 2}, dest)


def make(client, src, shot):
    """Вертикальная версия кадра. None — если не нужна или не просили."""
    mode = str(shot.get("vertical", "auto")).lower()
    if mode == "keep" or is_derived(src.name) or is_vertical(src):
        return None
    dest = target(src)
    focus = float(shot.get("focus", 0.5))
    if mode == "crop" or client is None:
        return crop(src, dest, focus)
    try:
        return outpaint(client, src, dest, mode, focus, shot.get("vertical_prompt", ""))
    except Exception as e:  # дорисовка не удалась — хотя бы обрезка, чтобы кадр был вертикальным
        print(f"    ! дорисовка не удалась ({e}) — делаю обрезку до 9:16")
        return crop(src, dest, focus)
