"""Animated schematic maps of the Mnevniki bend (OSM centrelines), rendered to mp4.

Every map is a schematic drawn from OpenStreetMap geometry and is labelled as such.
"""
import json
import math
import random
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

OUT_W, OUT_H, FPS = 1080, 1920, 30
BW, BH = 2160, 3840                      # base canvas (2x) for smooth camera moves
LAT_C, LON_C = 55.7590, 37.4585
SC = 76800                               # base px per degree latitude
COSL = math.cos(math.radians(LAT_C))

WAYS = {e["id"]: [(p["lat"], p["lon"]) for p in e["geometry"]]
        for e in json.load(open("/tmp/claude-0/doc/ways.json"))["elements"]}
UP = [51723233, 791432743, 791432742]        # from the west/north down to the loop
LOOP = [157471610, 157471611, 1171252601]    # around the floodplain
DOWN = [791432741, 1171252602, 1290440320, 51723234, 39991331]
CANAL = [157600547, 157600571, 157600548]
KHOR = [487074288]                           # Khoroshevo cut (also 1930s) - drawn only on modern map

FONT_SERIF = "/usr/share/fonts/truetype/paratype/PTF55F.ttf"
FONT_SERIF_I = "/usr/share/fonts/truetype/paratype/PTF56F.ttf"
FONT_SANS = "/usr/share/fonts/truetype/paratype/PTS55F.ttf"

OLD = dict(bg=(233, 224, 204), water=(78, 98, 110), ink=(58, 48, 36), accent=(150, 92, 40), grain=10)
NEW = dict(bg=(236, 240, 239), water=(128, 170, 188), ink=(30, 40, 46), accent=(196, 150, 84), grain=0)


def P(lat, lon):
    return ((lon - LON_C) * SC * COSL + BW / 2, (LAT_C - lat) * SC + BH / 2)


def chain(ids):
    pts = []
    for i in ids:
        seg = WAYS[i]
        if pts and seg and seg[0] != pts[-1] and seg[-1] == pts[-1]:
            seg = seg[::-1]
        pts += seg if not pts else seg[1:]
    out = []
    for p in pts:
        q = P(*p)
        if not out or math.dist(q, out[-1]) > 0.5:
            out.append(q)
    return out


RIVER = chain(UP) + chain(LOOP)[1:] + chain(DOWN)[1:]
LOOP_PX = chain(LOOP)
CANAL_PX = chain(CANAL)
ISLAND = LOOP_PX + CANAL_PX[::-1]


def font(path, size):
    return ImageFont.truetype(path, size)


def paper(style):
    img = Image.new("RGB", (BW, BH), style["bg"])
    if style["grain"]:
        rnd = Image.effect_noise((BW // 2, BH // 2), style["grain"]).resize((BW, BH)).convert("L")
        img = Image.blend(img, Image.merge("RGB", [rnd, rnd, rnd]), 0.06)
        # soft vignette
        v = Image.new("L", (BW, BH), 0)
        ImageDraw.Draw(v).ellipse((-BW * 0.35, -BH * 0.2, BW * 1.35, BH * 1.2), fill=255)
        v = v.filter(ImageFilter.GaussianBlur(260))
        img = Image.composite(img, Image.new("RGB", (BW, BH), tuple(int(c * 0.82) for c in style["bg"])), v)
    return img


def line(d, pts, col, w):
    d.line(pts, fill=col, width=w, joint="curve")
    r = w // 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=col)


def partial(pts, frac):
    """First `frac` (0..1) of a polyline by length."""
    if frac >= 1:
        return pts
    L = [0.0]
    for a, b in zip(pts, pts[1:]):
        L.append(L[-1] + math.dist(a, b))
    target = L[-1] * max(frac, 0.0)
    out = [pts[0]]
    for i in range(1, len(pts)):
        if L[i] >= target:
            t = (target - L[i - 1]) / max(L[i] - L[i - 1], 1e-6)
            a, b = pts[i - 1], pts[i]
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            break
        out.append(pts[i])
    return out


def base_map(style, canal=0.0, khor=False, island=0.0, outline=0.0):
    img = paper(style)
    d = ImageDraw.Draw(img, "RGBA")
    if island > 0:
        a = int(95 * island) if style is NEW else int(70 * island)
        d.polygon(ISLAND, fill=style["accent"] + (a,))
    line(d, RIVER, style["water"], 124)
    if khor:
        line(d, chain(KHOR), style["water"], 110)
    if canal > 0:
        line(d, partial(CANAL_PX, canal), style["water"], 96)
    if outline > 0:
        dash(d, partial(ISLAND + [ISLAND[0]], outline), style["accent"], 10, 36, 22)
    return img


def dash(d, pts, col, w, on, off):
    acc, draw_on = 0.0, True
    for a, b in zip(pts, pts[1:]):
        seg = math.dist(a, b)
        pos = 0.0
        while pos < seg:
            step = min((on if draw_on else off) - acc, seg - pos)
            p0 = (a[0] + (b[0] - a[0]) * pos / seg, a[1] + (b[1] - a[1]) * pos / seg)
            p1 = (a[0] + (b[0] - a[0]) * (pos + step) / seg, a[1] + (b[1] - a[1]) * (pos + step) / seg)
            if draw_on:
                d.line([p0, p1], fill=col, width=w)
            pos += step
            acc += step
            if acc >= (on if draw_on else off) - 1e-6:
                acc, draw_on = 0.0, not draw_on


def label(img, text, lat, lon, size, style, italic=True, alpha=1.0, anchor="mm", dot=False):
    if alpha <= 0:
        return
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = P(lat, lon)
    f = font(FONT_SERIF_I if italic else FONT_SERIF, size)
    if dot:
        d.ellipse((x - 14, y - 14, x + 14, y + 14), fill=style["ink"] + (int(255 * alpha),))
        x, y = x + 30, y
        anchor = "lm"
    d.text((x, y), text, font=f, fill=style["ink"] + (int(255 * alpha),), anchor=anchor,
           stroke_width=8, stroke_fill=style["bg"] + (int(220 * alpha),))
    img.paste(layer, (0, 0), layer)


PENDING = []


def note(img, text, style, y_frac=0.86, alpha=1.0, size=64):
    """Screen-space caption: queued here, drawn by camera() on the output frame."""
    if alpha > 0:
        PENDING.append((text, style, y_frac, alpha, size))


def _draw_notes(out):
    d = ImageDraw.Draw(out, "RGBA")
    for text, style, y_frac, alpha, size in PENDING:
        sz = int(size * 0.62)
        d.text((OUT_W / 2, OUT_H * y_frac), text, font=font(FONT_SANS, sz), fill=style["ink"] + (int(255 * alpha),),
               anchor="mm", stroke_width=6, stroke_fill=style["bg"] + (int(230 * alpha),))
    PENDING.clear()
    return out


def schema_mark(img, style):
    d = ImageDraw.Draw(img)
    d.text((BW - 70, BH - 90), "схема · данные © участники OpenStreetMap", font=font(FONT_SANS, 34),
           fill=style["ink"], anchor="rm")


def camera(img, cx, cy, zoom):
    """Crop around (cx, cy) in base px at zoom (1 = whole base canvas) and scale to output."""
    w, h = BW / zoom, BH / zoom
    x0 = min(max(cx - w / 2, 0), BW - w)
    y0 = min(max(cy - h / 2, 0), BH - h)
    out = img.crop((int(x0), int(y0), int(x0 + w), int(y0 + h))).resize((OUT_W, OUT_H), Image.LANCZOS)
    return _draw_notes(out)


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def render(name, dur, frame_fn):
    n = int(round(dur * FPS))
    cmd = ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OUT_W}x{OUT_H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
           f"/tmp/claude-0/doc/clips/{name}.mp4"]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cache = {}
    for i in range(n):
        t = i / max(n - 1, 1)
        frame = frame_fn(t, cache)
        p.stdin.write(frame.convert("RGB").tobytes())
    p.stdin.close()
    p.wait()
    print("rendered", name, dur)


# ---------------------------------------------------------------- shots
MNEV = (55.7690, 37.4735)     # Mnevniki (by the lock; houses were moved north of it)
TEREH = (55.7520, 37.4560)    # Terekhovo, inside the loop
RIVER_LBL = (55.7462, 37.4540)


def old_static(key, cache, **kw):
    if key not in cache:
        img = base_map(OLD, **kw)
        schema_mark(img, OLD)
        cache[key] = img
    return cache[key].copy()


def shot_hook(t, c):
    img = old_static("h", c)
    label(img, "Мнёвники", *MNEV, 92, OLD, dot=True)
    x, y = P(*MNEV)
    z = 1.5 + 0.35 * ease(t)
    return camera(img, x + 180, y + 200, z)


def shot_pull_out(t, c):
    img = old_static("p", c)
    label(img, "Мнёвники", *MNEV, 78, OLD, dot=True)
    label(img, "Терехово", *TEREH, 70, OLD, dot=True)
    z = 1.8 - 0.75 * ease(t)
    return camera(img, BW / 2, BH / 2 - 150, z)


def shot_outline(t, c):
    img = old_static("o", c).copy()
    img2 = base_map(OLD, outline=ease(min(t / 0.8, 1)))
    schema_mark(img2, OLD)
    label(img2, "Мнёвники", *MNEV, 78, OLD, dot=True)
    label(img2, "Терехово", *TEREH, 70, OLD, dot=True)
    note(img2, "территория нынешнего «Острова»", OLD, 0.80, alpha=ease((t - 0.55) / 0.3), size=76)
    return camera(img2, BW / 2, BH / 2 - 150, 1.05)


def shot_village(t, c):
    img = old_static("v", c)
    label(img, "Мнёвники", *MNEV, 84, OLD, dot=True)
    label(img, "Москва-река", *RIVER_LBL, 70, OLD, alpha=0.9)
    note(img, "XVII век", OLD, 0.83, alpha=ease(t / 0.25), size=90)
    x, y = P(*MNEV)
    return camera(img, x - 200 + 300 * ease(t), y + 500, 1.35)


def shot_river(t, c):
    img = old_static("r", c)
    label(img, "Москва-река", *RIVER_LBL, 84, OLD)
    x, y = P(*RIVER_LBL)
    return camera(img, x + 200 - 400 * ease(t), y - 500, 1.5)


def shot_nalim(t, c):
    img = old_static("n", c)
    label(img, "Мнёвники", *MNEV, 84, OLD, dot=True)
    note(img, "мень, мнюх, менёк — так называли налима", OLD, 0.83, alpha=ease(t / 0.3), size=62)
    x, y = P(*MNEV)
    return camera(img, x, y + 300, 1.6 + 0.2 * ease(t))


def shot_fishing(t, c):
    img = old_static("f", c).copy()
    d = ImageDraw.Draw(img, "RGBA")
    start = P(*MNEV)
    # downstream = east along the river, upstream = back towards the north-west
    i0 = min(range(len(RIVER)), key=lambda i: math.dist(RIVER[i], P(55.7677, 37.4800)))
    down = RIVER[i0:]
    j0 = min(range(len(RIVER)), key=lambda i: math.dist(RIVER[i], P(55.767, 37.4629)))
    up = RIVER[:j0 + 1][::-1]
    a1, a2 = ease(t / 0.45), ease((t - 0.45) / 0.45)
    if a1 > 0:
        line(d, partial(down, a1), OLD["accent"] + (230,), 40)
    if a2 > 0:
        line(d, partial(up, a2), OLD["accent"] + (230,), 40)
    label(img, "Мнёвники", *MNEV, 72, OLD, dot=True)
    label(img, "9 вёрст вниз — до устья Пресни", 55.7745, 37.4700, 64, OLD, italic=False, alpha=a1)
    label(img, "16 вёрст вверх — до устья Горетовки", 55.7795, 37.4560, 64, OLD, italic=False, alpha=a2)
    note(img, "≈ 25 вёрст · почти 27 км вдоль реки", OLD, 0.86, alpha=ease((t - 0.8) / 0.15), size=76)
    return camera(img, BW / 2 + 60, BH / 2 - 250, 1.1)


def shot_trade(t, c):
    img = old_static("t", c)
    label(img, "Мнёвники", *MNEV, 84, OLD, dot=True)
    note(img, "1898 · шесть торговых заведений", OLD, 0.80, alpha=ease(t / 0.2), size=74)
    note(img, "1875 · земская школа", OLD, 0.85, alpha=ease((t - 0.5) / 0.2), size=74)
    x, y = P(*MNEV)
    return camera(img, x, y + 350, 1.5)


def shot_factory(t, c):
    img = old_static("fa", c)
    label(img, "Мнёвники", *MNEV, 84, OLD, dot=True)
    note(img, "до 1917 · красильно-отделочная", OLD, 0.79, alpha=ease(t / 0.2), size=74)
    note(img, "фабрика купца Меньшикова", OLD, 0.83, alpha=ease(t / 0.2), size=74)
    note(img, "по данным краеведов", OLD, 0.875, alpha=ease((t - 0.3) / 0.2), size=48)
    x, y = P(*MNEV)
    return camera(img, x, y + 350, 1.5 + 0.2 * ease(t))


random.seed(7)
HOUSES = []
for _ in range(34):
    f = random.random()
    x, y = partial(CANAL_PX, 1)[0]
    pts = CANAL_PX
    k = min(int(f * (len(pts) - 1)), len(pts) - 2)
    a, b = pts[k], pts[k + 1]
    px, py = a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5
    px = CANAL_PX[0][0] + (CANAL_PX[-1][0] - CANAL_PX[0][0]) * f
    py = CANAL_PX[0][1] + (CANAL_PX[-1][1] - CANAL_PX[0][1]) * f + random.uniform(-90, 90)
    tx, ty = P(55.7712 + random.uniform(-0.0012, 0.0012), 37.4775 + random.uniform(-0.004, 0.004))
    HOUSES.append((px, py, tx, ty))


def shot_houses(t, c):
    img = old_static("hs", c).copy()
    d = ImageDraw.Draw(img, "RGBA")
    m = ease((t - 0.15) / 0.7)
    for px, py, tx, ty in HOUSES:
        x, y = px + (tx - px) * m, py + (ty - py) * m
        d.rectangle((x - 13, y - 13, x + 13, y + 13), fill=OLD["accent"] + (235,))
    dash(d, CANAL_PX, OLD["water"] + (200,), 12, 30, 20)  # future canal line
    note(img, "более 100 домов перенесены за шлюз", OLD, 0.80, alpha=ease((t - 0.2) / 0.25), size=74)
    x, y = P(55.7690, 37.4720)
    return camera(img, x, y + 420, 1.3)


def shot_canal(t, c):
    img = base_map(OLD, canal=ease(t / 0.45), island=ease((t - 0.5) / 0.3))
    schema_mark(img, OLD)
    label(img, "Карамышевское спрямление", 55.7712, 37.4690, 58, OLD, alpha=ease((t - 0.3) / 0.2))
    note(img, "1937 · остров", OLD, 0.80, alpha=ease((t - 0.62) / 0.2), size=110)
    return camera(img, BW / 2, BH / 2 - 150, 1.05)


def _mix(a, b, k):
    return Image.blend(a, b, k)


def shot_old_to_new(t, c):
    if "a" not in c:
        a = base_map(OLD, canal=1, island=1)
        schema_mark(a, OLD)
        b = base_map(NEW, canal=1, khor=True, island=1)
        schema_mark(b, NEW)
        c["a"], c["b"] = a, b
    img = _mix(c["a"], c["b"], ease(t / 0.7))
    return camera(img, BW / 2, BH / 2 - 150, 1.05 + 0.08 * ease(t))


def new_static(key, c, **kw):
    if key not in c:
        img = base_map(NEW, canal=1, khor=True, island=1, **kw)
        schema_mark(img, NEW)
        c[key] = img
    return c[key].copy()


def shot_new_island(t, c):
    img = new_static("ni", c)
    label(img, "Мнёвниковская пойма", 55.7575, 37.4585, 74, NEW, italic=False)
    return camera(img, BW / 2, BH / 2 - 150, 1.15 + 0.1 * ease(t))


def shot_history_card(t, c):
    img = old_static("hc", c)
    label(img, "Мнёвники", *MNEV, 84, OLD, dot=True)
    return camera(img, BW / 2, BH / 2 - 200, 1.25 + 0.1 * ease(t))


def shot_final(t, c):
    if "a" not in c:
        a = base_map(OLD)
        schema_mark(a, OLD)
        b = base_map(NEW, canal=1, khor=True, island=1)
        schema_mark(b, NEW)
        c["a"], c["b"] = a, b
    img = _mix(c["a"], c["b"], ease(t / 0.6)).copy()
    label(img, "Мнёвниковская пойма", 55.7575, 37.4585, 70, NEW, italic=False, alpha=ease((t - 0.5) / 0.3))
    note(img, "строится пешеходный мост в Крылатское", NEW, 0.80, alpha=ease((t - 0.55) / 0.3), size=58)
    return camera(img, BW / 2, BH / 2 - 150, 1.2 - 0.15 * ease(t))


def shot_teaser(t, c):
    img = new_static("te", c)
    return camera(img, BW / 2, BH / 2 - 150, 1.1 + 0.15 * ease(t))


SHOTS = {
    "m_hook": (3.0, shot_hook),
    "m_pullout": (2.5, shot_pull_out),
    "m_outline": (2.2, shot_outline),
    "m_village": (2.8, shot_village),
    "m_river": (2.7, shot_river),
    "m_nalim": (1.8, shot_nalim),
    "m_fishing": (5.4, shot_fishing),
    "m_trade": (4.1, shot_trade),
    "m_factory": (3.7, shot_factory),
    "m_houses": (2.2, shot_houses),
    "m_canal": (4.3, shot_canal),
    "m_old2new": (2.5, shot_old_to_new),
    "m_newisland": (1.3, shot_new_island),
    "m_history": (1.1, shot_history_card),
    "m_final": (3.5, shot_final),
    "m_teaser": (5.0, shot_teaser),
}

if __name__ == "__main__":
    import os
    os.makedirs("/tmp/claude-0/doc/clips", exist_ok=True)
    names = sys.argv[1:] or list(SHOTS)
    for nme in names:
        dur, fn = SHOTS[nme]
        if nme.endswith("_still"):
            continue
        render(nme, dur, fn)
