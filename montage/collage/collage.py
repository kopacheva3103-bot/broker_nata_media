"""Collage montage: speaker sticker + object cards + paper strips, one scene per phrase.

python3.13 collage.py <workdir> <srcdir> <out.mp4>
workdir: talk.mp4 (cleaned speech), matte.mp4 (person mask 432x768), words.json
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from clean import clean_mask

WORK, SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
W, H, FPS = 1080, 1920, 30
FONTS = Path("/home/user/broker_nata_media/montage/fonts")
XB, SB, BD = (str(FONTS / f) for f in ("Montserrat-ExtraBold.ttf", "Montserrat-SemiBold.ttf", "Montserrat-Bold.ttf"))
GOLD, INK, CHAMP, EMER, WHITE = (230, 180, 80), (29, 42, 38), (243, 234, 216), (15, 90, 70), (255, 255, 255)

words = json.load(open(WORK / "words.json"))
WT = lambda i: words[i][0]  # word start time
dur_talk = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                 str(WORK / "talk.mp4")], capture_output=True, text=True).stdout)
TOTAL = dur_talk + 0.6
NF = int(TOTAL * FPS)

# ---------- backgrounds ----------
rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def emerald_bg():
    r = np.sqrt(((xx - W * 0.55) / W) ** 2 + ((yy - H * 0.38) / H) ** 2)
    base = np.array([12, 52, 43], np.float32) * (1.15 - 0.9 * np.clip(r, 0, 1))[..., None]
    glow = np.exp(-(((xx - W * 0.2) / (W * 0.5)) ** 2 + ((yy - H * 0.82) / (H * 0.3)) ** 2))
    base += np.array([150, 105, 40], np.float32) * 0.22 * glow[..., None]
    grid = ((xx % 90 < 1.5) | (yy % 90 < 1.5)).astype(np.float32) * 10
    base += np.array([200, 160, 80], np.float32) * (grid / 255)[..., None]
    base += rng.normal(0, 4, (H, W, 1)).astype(np.float32)
    return np.clip(base, 0, 255)


def paper_bg():
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
    base = np.array(CHAMP, np.float32) * (1.02 - 0.18 * r)[..., None]
    base += rng.normal(0, 3.5, (H, W, 1)).astype(np.float32)
    return np.clip(base, 0, 255)


BG = {"emerald": emerald_bg(), "paper": paper_bg()}


# ---------- compositing ----------
def over(canvas, rgba, x, y, alpha=1.0):
    """Alpha-composite float RGBA (h,w,4 0..255) onto canvas at top-left x,y."""
    h, w = rgba.shape[:2]
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x0 >= x1 or y0 >= y1:
        return
    src = rgba[y0 - y:y1 - y, x0 - x:x1 - x]
    a = src[..., 3:4] / 255.0 * alpha
    canvas[y0:y1, x0:x1] = canvas[y0:y1, x0:x1] * (1 - a) + src[..., :3] * a


def pil_rgba(img):
    return np.asarray(img.convert("RGBA"), np.float32)


def rotate_rgba(arr, deg, scale=1.0):
    h, w = arr.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), deg, scale)
    c, s = abs(m[0, 0]), abs(m[0, 1])
    nw, nh = int(h * s + w * c) + 2, int(h * c + w * s) + 2
    m[0, 2] += nw / 2 - w / 2
    m[1, 2] += nh / 2 - h / 2
    return cv2.warpAffine(arr, m, (nw, nh), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))


def with_shadow(arr, blur=18, off=10, opacity=0.38):
    h, w = arr.shape[:2]
    pad = blur * 2 + off
    out = np.zeros((h + pad * 2, w + pad * 2, 4), np.float32)
    sh = cv2.GaussianBlur(arr[..., 3], (0, 0), blur) * opacity
    out[pad + off:pad + off + h, pad:pad + w, 3] = sh
    a = arr[..., 3:4] / 255
    reg = out[pad:pad + h, pad:pad + w]
    ra = reg[..., 3:4] / 255
    na = a + ra * (1 - a)
    reg[..., :3] = (arr[..., :3] * a + reg[..., :3] * ra * (1 - a)) / np.maximum(na, 1e-6)
    reg[..., 3:4] = na * 255
    return out, pad


def ease_out(p):
    p = min(max(p, 0), 1)
    return 1 - (1 - p) ** 3


def pop(t, t0, d=0.35):
    """scale with a small overshoot, alpha"""
    p = (t - t0) / d
    if p <= 0:
        return 0, 0
    if p >= 1:
        return 1, 1
    s = 0.6 + 0.4 * ease_out(p) + 0.08 * math.sin(p * math.pi)
    return s, min(1, p * 3)


def place(canvas, arr, cx, cy, t, t0, rot=0.0, shadow=True):
    s, a = pop(t, t0)
    if a <= 0:
        return
    img = rotate_rgba(arr, rot, s) if (rot or s != 1) else arr
    if shadow:
        img, pad = with_shadow(img)
    h, w = img.shape[:2]
    over(canvas, img, int(cx - w / 2), int(cy - h / 2), a)


# ---------- text pieces ----------
_cache = {}


def strip(text, kind="champ", size=72, maxw=940):
    key = (text, kind, size)
    if key in _cache:
        return _cache[key]
    bg, fg = {"champ": (CHAMP, INK), "gold": (GOLD, INK), "emer": (EMER, WHITE), "ink": (INK, WHITE)}[kind]
    while True:
        f = ImageFont.truetype(XB, size)
        b = f.getbbox(text)
        tw = b[2] - b[0]
        if tw + 56 <= maxw or size <= 40:
            break
        size -= 2
    asc, desc = f.getmetrics()
    ph, pw = int(size * 0.26), 28
    img = Image.new("RGBA", (tw + pw * 2, asc + desc + ph * 2 - int(size * 0.18)), bg + (255,))
    d = ImageDraw.Draw(img)
    d.text((pw - b[0], ph - int(size * 0.09)), text, font=f, fill=fg)
    arr = pil_rgba(img)
    _cache[key] = arr
    return arr


def big_text(text, size, color, font=XB):
    f = ImageFont.truetype(font, size)
    b = f.getbbox(text)
    img = Image.new("RGBA", (b[2] - b[0] + 40, b[3] - b[1] + 40), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((20 - b[0], 20 - b[1]), text, font=f, fill=color + (255,))
    return pil_rgba(img)


def glow_text(text, size, color, glow=(0, 0, 0), glow_a=0.5, font=SB):
    f = ImageFont.truetype(font, size)
    b = f.getbbox(text)
    pad = 30
    img = Image.new("RGBA", (b[2] - b[0] + pad * 2, size + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((pad - b[0], pad), text, font=f, fill=color + (255,))
    arr = pil_rgba(img)
    if glow_a:
        g = cv2.GaussianBlur(cv2.dilate(arr[..., 3], np.ones((7, 7), np.uint8)), (0, 0), 8) * glow_a
        base = np.zeros_like(arr)
        base[..., :3] = glow
        base[..., 3] = g
        a = arr[..., 3:4] / 255
        base[..., :3] = arr[..., :3] * a + base[..., :3] * (1 - a)
        base[..., 3] = np.maximum(base[..., 3], arr[..., 3])
        arr = base
    return arr


# ---------- doodles: polylines drawn progressively ----------
def draw_lines(canvas, polys, p, color=GOLD, width=9, ox=0, oy=0):
    total = sum(sum(math.dist(a, b) for a, b in zip(pl, pl[1:])) for pl in polys)
    left = total * min(max(p, 0), 1)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for pl in polys:
        for a, b in zip(pl, pl[1:]):
            L = math.dist(a, b)
            if left <= 0:
                break
            k = min(1, left / L)
            e = (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)
            d.line([(a[0] + ox, a[1] + oy), (e[0] + ox, e[1] + oy)], fill=color + (255,), width=width, joint="curve")
            left -= L
    over(canvas, pil_rgba(img), 0, 0)


def circle(cx, cy, r, n=40, a0=0, a1=360):
    return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
            for a in np.linspace(a0, a1, n)]


# ---------- video readers ----------
class Reader:
    def __init__(self, path, w, h, start=0.0, speed=1.0, gray=False):
        self.w, self.h, self.ch = w, h, 1 if gray else 3
        vf = f"setpts=PTS/{speed},fps={FPS},scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(start), "-i", str(path), "-vf", vf,
                                   "-f", "rawvideo", "-pix_fmt", "gray" if gray else "rgb24", "-"],
                                  stdout=subprocess.PIPE)
        self.last = np.zeros((h, w, self.ch), np.uint8)

    def next(self):
        b = self.p.stdout.read(self.w * self.h * self.ch)
        if len(b) == self.w * self.h * self.ch:
            self.last = np.frombuffer(b, np.uint8).reshape(self.h, self.w, self.ch)
        return self.last


def card(frame, border=16, bottom=16):
    h, w = frame.shape[:2]
    arr = np.full((h + border + bottom, w + border * 2, 4), 255, np.float32)
    arr[border:border + h, border:border + w, :3] = frame
    return arr


def sticker(frame, mask, scale=1.0):
    """person cut-out with a white sticker outline; returns RGBA full frame scaled"""
    a = cv2.resize(mask, (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32)
    a = np.clip((a - 40) * 1.4, 0, 255)
    a = clean_mask(frame, a)  # no chair remnants
    hard = (a > 127).astype(np.uint8)
    hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    hard = cv2.morphologyEx(hard, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61)))
    out = cv2.dilate(hard, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (27, 27)))
    out = cv2.GaussianBlur(out.astype(np.float32) * 255, (0, 0), 1.5)
    rgba = np.zeros((H, W, 4), np.float32)
    af = a[..., None] / 255
    rgba[..., :3] = frame * af + 255 * (1 - af)
    rgba[..., 3] = np.maximum(out, a)
    if scale != 1.0:
        rgba = cv2.resize(rgba, (int(W * scale), int(H * scale)), interpolation=cv2.INTER_AREA)
    return rgba


def big_sticker(canvas, frame, mask, scale=1.1, drop=0):
    rgba = sticker(frame, mask, scale)
    put_sticker(canvas, rgba, (W - rgba.shape[1]) // 2, H + drop)


def put_sticker(canvas, rgba, x, bottom, alpha=1.0):
    h, w = rgba.shape[:2]
    sh = np.zeros_like(rgba)
    sh[..., 3] = cv2.GaussianBlur(rgba[..., 3], (0, 0), 16) * 0.35
    over(canvas, sh, x + 10, bottom - h + 14, alpha)
    over(canvas, rgba, x, bottom - h, alpha)


# ---------- subtitles ----------
import os as _os
SPEC = {}
if _os.environ.get("REEL"):
    exec(open(_os.environ["REEL"], encoding="utf-8").read(), SPEC)
FIX = SPEC.get("FIX", {13: "ЖК", 14: "«Время»,", 15: "Преображенская", 37: "ЖК"})
wl = [(s, e, FIX.get(i, w)) for i, (s, e, w) in enumerate(words)]
wl = [x for x in wl if x[2]]  # a fix can glue two words: the second becomes ""
chunks, cur = [], []
for i, wd in enumerate(wl):
    cur.append(wd)
    txt = " ".join(x[2] for x in cur)
    end_p = wd[2][-1] in ".,?!" or i == len(wl) - 1
    nxt = wl[i + 1][2] if i + 1 < len(wl) else ""
    if end_p or len(cur) >= 3 or len(txt + " " + nxt) > 17:
        chunks.append(cur)
        cur = []
subs = []
for k, c in enumerate(chunks):
    t0, t1 = c[0][0], c[-1][1]
    if k + 1 < len(chunks):
        t1 = max(t1, min(chunks[k + 1][0][0], t1 + 0.4))
    text = " ".join(x[2] for x in c)
    subs.append((t0, t1, text[:1].upper() + text[1:]))
HIDE = [(WT(i) - 0.05 if i else 0, WT(j) - 0.05) for i, j in SPEC.get("HIDE_IDX", [(0, 13), (98, 118)])]


def sub_at(t):
    if any(a <= t < b for a, b in HIDE):
        return None
    for a, b, s in subs:
        if a <= t < b:
            return s, a
    return None


# ---------- scenes ----------
S = []  # (t0, t1, kind, params)


def sc(t0, t1, kind, **p):
    S.append((t0, t1, kind, p))


T = WT
if "scenes" in SPEC:
    SPEC["scenes"](T, sc, TOTAL)
else:
  sc(0, T(13), "hook")
  sc(T(13), T(19), "zk")
  sc(T(19), T(26), "area")
  sc(T(26), T(35), "docs")
  sc(T(35), T(42), "korpus")
  sc(T(42), T(54), "talk")
  sc(T(54), T(65), "invest")
  sc(T(65), T(81), "ad")
  sc(T(81), T(87), "search")
  sc(T(87), T(98), "team")
  sc(T(98), T(118), "check")
  sc(T(118), T(132), "papers")
  sc(T(132), T(150), "question")
  sc(T(150), T(157), "talk")
  sc(T(157), T(164), "comments")
  sc(T(164), TOTAL + 1, "cta")

HOOK = _os.environ.get("HOOK", SPEC.get("HOOK", "КАК ПРОДАТЬ|756 М²?")).split("|")
HOOK_STRIKE = _os.environ.get("HOOK_STRIKE") == "1"
HOOK_BIG = SPEC.get("HOOK_BIG", "756 м²?")
HOOK_CUT = SPEC.get("HOOK_CUT", 6)
readers = {}


def rd(key, *a, **k):
    if key not in readers:
        readers[key] = Reader(*a, **k)
    return readers[key]


def render(t, frame, mask, kind, t0, canvas, P=None):
    P = P or {}
    """frame, mask: current speaker frame and matte"""
    if kind == "talk":
        canvas[:] = CUR["room"]
        a = cv2.resize(mask, (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32)
        a = clean_mask(frame, np.clip((a - 40) * 1.4, 0, 255))
        a = cv2.GaussianBlur(a, (0, 0), 2.0)[..., None] / 255
        canvas[:] = frame * a + canvas * (1 - a)
        return None
    if kind == "hook":
        lines = HOOK[1:]
        if t < T(HOOK_CUT):  # beat 1: the premises with a fast push-in, the number and the first line slam in
            f = rd("3109h", SRC / "IMG_3109.mov", W, H, 0.4, 0.9).next().astype(np.float32)
            z = 1.0 + 0.16 * ease_out(t / T(HOOK_CUT))
            zw, zh = int(W / z), int(H / z)
            x0, y0 = (W - zw) // 2, (H - zh) // 2
            canvas[:] = cv2.resize(f[y0:y0 + zh, x0:x0 + zw], (W, H)) * 0.5
            place(canvas, strip(HOOK[0], "champ", 96), 540, 640, t, 0.0, -3)
            s, a = pop(t, 0.35, 0.3)
            if a > 0:
                num = big_text(HOOK_BIG, 230, GOLD)
                num = rotate_rgba(num, 0, s)
                over(canvas, num, int(540 - num.shape[1] / 2), int(900 - num.shape[0] / 2), a)
            if HOOK_STRIKE and t > T(5):
                draw_lines(canvas, [[(160, 1010), (920, 800)]], (t - T(5)) / 0.22, (200, 50, 40), 22)
            return None
        canvas[:] = CUR["bg"]  # beat 2: hard cut, big sticker slides up, the whole hook above the head
        rise = ease_out((t - T(HOOK_CUT)) / 0.3)
        big_sticker(canvas, frame, mask, 1.1, int(260 * (1 - rise)))
        allx = [HOOK[0]] + lines
        for k, txt in enumerate(allx):
            p = ease_out((t - T(HOOK_CUT) - k * 0.25) / 0.22)
            if p > 0:
                st = strip(txt, "gold" if k == len(allx) - 1 else "champ", 74, 1000)
                over(canvas, with_shadow(rotate_rgba(st, (-1.5, 1, -1, 1.5)[k % 4]))[0], int(30 - 60 * (1 - p)), 80 + k * 100, p)
        return None
    if kind == "zk":
        canvas[:] = CUR["bg"]
        f = rd("3105", SRC / "IMG_3105.mov", 700, 960, 0.0, 0.85).next()
        place(canvas, card(f), 540, 700, t, t0, -3)
        for k, (txt, kd, wi) in enumerate([("ЖК «ВРЕМЯ»", "gold", 13), ("ПРЕОБРАЖЕНСКАЯ ПЛОЩАДЬ", "champ", 15),
                                           ("БИЗНЕС-КЛАСС", "emer", 18)]):
            s = strip(txt, kd, 64)
            p = ease_out((t - T(wi)) / 0.25)
            if p > 0:
                over(canvas, with_shadow(rotate_rgba(s, (2, -1.5, 1.5)[k]))[0], int(60 - 60 * (1 - p)), 1010 + k * 95, p)
        return None
    if kind == "area":
        f = rd("4131a", SRC / "IMG_4131.mov", W, H, 2.0, 0.8).next().astype(np.float32)
        canvas[:] = f * 0.38 + CUR["bg"] * 0.35
        p = ease_out((t - T(23)) / 1.1)
        if p > 0:
            num = big_text(f"{int(round(756 * p))} м²", 230, GOLD)
            over(canvas, num, int(540 - num.shape[1] / 2), 560, min(1, p * 3))
        s = strip("2 ЭТАЖА", "champ", 72)
        q = ease_out((t - T(20)) / 0.25)
        if q > 0:
            over(canvas, with_shadow(rotate_rgba(s, -2))[0], int(540 - s.shape[1] / 2), 380, q)
        return None
    if kind == "docs":
        canvas[:] = BG["paper"]
        x0, y0, w, h = 290, 250, 500, 680
        page = [[(x0, y0), (x0 + w - 90, y0), (x0 + w, y0 + 90), (x0 + w, y0 + h), (x0, y0 + h), (x0, y0)],
                [(x0 + w - 90, y0), (x0 + w - 90, y0 + 90), (x0 + w, y0 + 90)]]
        lines = [[(x0 + 60, y0 + 160 + i * 75), (x0 + w - 60 - (i % 3) * 60, y0 + 160 + i * 75)] for i in range(6)]
        draw_lines(canvas, page, (t - t0) / 0.6, INK, 8)
        draw_lines(canvas, lines, (t - t0 - 0.4) / 0.8, INK, 6)
        s = strip("ЧАСТНЫЙ ДЕТСКИЙ САД", "gold", 70)
        place(canvas, s, 560, 860, t, T(32), -7)
        return "dark"
    if kind == "korpus":
        canvas[:] = CUR["bg"]
        f = rd("3111", SRC / "IMG_3111.mov", 700, 960, 0.3, 0.8).next()
        place(canvas, card(f), 520, 690, t, t0, 2.5)
        s = strip("ВСЕГО 3 КОРПУСА", "gold", 72)
        place(canvas, s, 560, 1230, t, T(39), -2)
        return None
    if kind == "invest":
        canvas[:] = CUR["bg"]
        big_sticker(canvas, frame, mask, 1.1)
        for k, (txt, kd, wi) in enumerate([("ОГРОМНЫЕ ВЛОЖЕНИЯ", "champ", 54), ("В КРИЗИС", "champ", 56),
                                           ("НИКОМУ НЕ ПОДОЙДЁТ", "gold", 61)]):
            s = strip(txt, kd, 66)
            p = ease_out((t - T(wi)) / 0.25)
            if p > 0:
                over(canvas, with_shadow(rotate_rgba(s, (-1.5, 1.5, -1)[k]))[0], int(50 - 60 * (1 - p)), 100 + k * 100, p)
        return None
    if kind == "ad":
        canvas[:] = BG["paper"]
        x0, y0, w, h = 190, 260, 700, 560
        box = [[(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h), (x0, y0)],
               [(x0 + 40, y0 + 40), (x0 + 300, y0 + 40), (x0 + 300, y0 + 260), (x0 + 40, y0 + 260), (x0 + 40, y0 + 40)],
               [(x0 + 40, y0 + 260), (x0 + 130, y0 + 150), (x0 + 200, y0 + 220), (x0 + 250, y0 + 170), (x0 + 300, y0 + 230)]]
        box += [[(x0 + 340, y0 + 70 + i * 60), (x0 + w - 50 - (i % 2) * 90, y0 + 70 + i * 60)] for i in range(4)]
        box += [[(x0 + 40, y0 + 330 + i * 60), (x0 + w - 60 - (i % 2) * 140, y0 + 330 + i * 60)] for i in range(3)]
        draw_lines(canvas, box, (t - t0) / 0.9, INK, 7)
        place(canvas, strip("ОБЪЯВЛЕНИЕ", "ink", 54), 540, y0 - 10, t, T(68), -3, False)
        if t > T(73):
            draw_lines(canvas, [[(x0 - 30, y0 + h + 10), (x0 + w + 30, y0 - 10)]], (t - T(73)) / 0.35, (180, 60, 40), 14)
        for k, (txt, kd, wi) in enumerate([("ПРОДАТЬ,", "emer", 76), ("А НЕ РЕКЛАМИРОВАТЬ", "gold", 78)]):
            place(canvas, strip(txt, kd, 70), 540, 960 + k * 120, t, T(wi), (-2, 1.5)[k])
        return "dark"
    if kind == "search":
        canvas[:] = CUR["bg"]
        big_sticker(canvas, frame, mask, 1.1)
        lens = [circle(880, 300, 105)] + [[(955, 375), (1050, 470)]]
        draw_lines(canvas, lens, (t - T(85)) / 0.5, GOLD, 16)
        place(canvas, strip("ИСКАТЬ ПОКУПАТЕЛЯ", "gold", 60), 380, 150, t, T(85), -2)
        return None
    if kind == "team":
        canvas[:] = CUR["bg"]
        for key, path, st, cx, cy, rot, wi in [("4127", "IMG_4127.mov", 12.0, 330, 560, -5, 87),
                                              ("4129", "IMG_4129.mov", 2.0, 740, 780, 4, 92),
                                              ("4127b", "IMG_4127.mov", 3.0, 430, 1000, -2, 95)]:
            if t >= T(wi):
                f = rd(key, SRC / path, 520, 700, st, 0.85).next()
                place(canvas, card(f), cx, cy, t, T(wi), rot)
        return None
    if kind == "check":
        canvas[:] = BG["paper"]
        place(canvas, strip("ПОСМОТРЕЛИ ВСЁ", "emer", 70), 540, 230, t, t0, -2)
        items = [("Куда выходят окна?", 98), ("Как выходят двери?", 101), ("Сколько мокрых точек?", 104),
                 ("Где парковаться?", 107), ("Как идти до метро?", 109), ("Какой здесь человекопоток?", 113)]
        f = ImageFont.truetype(SB, 52)
        for k, (txt, wi) in enumerate(items):
            p = ease_out((t - T(wi)) / 0.3)
            if p <= 0:
                continue
            y = 400 + k * 125
            img = Image.new("RGBA", (980, 100), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            d.rounded_rectangle((8, 18, 72, 82), 10, outline=INK + (255,), width=6)
            d.text((105, 22), txt, font=f, fill=INK + (255,))
            over(canvas, pil_rgba(img), int(60 + 40 * (1 - p)), y, p)
            draw_lines(canvas, [[(80, y + 50), (100, y + 75), (140, y + 22)]], (t - T(wi) - 0.25) / 0.25, GOLD, 12)
        st = sticker(frame, mask, 0.55)
        put_sticker(canvas, st, W - st.shape[1] + 60, H)
        return "dark"
    if kind == "papers":
        canvas[:] = CUR["bg"]
        f = rd("4128", SRC / "IMG_4128.mov", 560, 640, 0.0, 0.7).next()
        place(canvas, card(f), 560, 470, t, t0, -3)
        for k, (txt, wi) in enumerate([("ДОКУМЕНТЫ", 121), ("ЭЛЕКТРИЧЕСТВО", 122), ("ВОДОСНАБЖЕНИЕ", 123),
                                       ("ПЛАНЫ", 124), ("ПОДЗЕМНЫЙ ПАРКИНГ", 125)]):
            kd = "gold" if k == 4 else "champ"
            p = ease_out((t - T(wi)) / 0.22)
            if p > 0:
                s = strip(txt, kd, 50)
                over(canvas, with_shadow(rotate_rgba(s, (1, -1.5, 2, -1, 1.5)[k]))[0], int(70 + (k % 2) * 60 - 50 * (1 - p)), 860 + k * 88, p)
        return None
    if kind == "question":
        canvas[:] = CUR["bg"]
        big_sticker(canvas, frame, mask, 1.1)
        q = big_text("?", 380, GOLD)
        place(canvas, q, 960, 300, t, T(133), 10, False)
        for k, (txt, kd, wi) in enumerate([("НУЖНО ДАЖЕ В КРИЗИС", "champ", 137), ("ЗАЕХАЛ БЫСТРО", "champ", 144),
                                           ("СРАЗУ ОКУПИЛ", "gold", 147)]):
            p = ease_out((t - T(wi)) / 0.25)
            if p > 0:
                s = strip(txt, kd, 60, 760)
                over(canvas, with_shadow(rotate_rgba(s, (-1.5, 1.5, -1)[k]))[0], int(40 - 60 * (1 - p)), 100 + k * 100, p)
        return None
    if kind == "comments":
        canvas[:] = CUR["bg"]
        big_sticker(canvas, frame, mask, 1.1)
        place(canvas, strip("ПИШИТЕ В КОММЕНТАРИЯХ", "gold", 62), 540, 150, t, T(157), -2)
        place(canvas, strip("РАЗБОР В СЛЕДУЮЩЕМ РОЛИКЕ", "champ", 54), 540, 260, t, T(160), 1.5)
        return None
    if kind == "cta":
        canvas[:] = CUR["bg"]
        f = rd("4132", SRC / "IMG_4132.mov", 640, 860, 9.0, 0.8).next()
        place(canvas, card(f), 540, 640, t, t0, -2.5)
        place(canvas, strip("СЕЙЧАС В ПРОДАЖЕ", "champ", 68), 540, 1160, t, T(175), 2)
        place(canvas, strip("НАПИШИТЕ МНЕ В ДИРЕКТ", "gold", 68), 540, 1275, t, T(178), -1.5)
        return None
    return generic(t, frame, mask, kind, t0, canvas, P)


def strip_stack(canvas, t, items, y0, step=100, x=40, size=66, maxw=1000, center=False):
    """items: (text, kind, word_index) appearing one by one, slightly rotated"""
    for k, (txt, kd, wi) in enumerate(items):
        p = ease_out((t - T(wi)) / 0.22)
        if p <= 0:
            continue
        st = with_shadow(rotate_rgba(strip(txt, kd, size, maxw), (-1.5, 1.2, -1, 1.5, -0.8)[k % 5]))[0]
        xx = int(540 - st.shape[1] / 2) if center else int(x - 60 * (1 - p))
        over(canvas, st, xx, y0 + k * step, p)


def generic(t, frame, mask, kind, t0, canvas, P):
    if kind == "sticker":
        canvas[:] = CUR["bg"]
        big_sticker(canvas, frame, mask, 1.1)
        strip_stack(canvas, t, P.get("strips", []), 90, 100, 30, P.get("size", 64), 1000)
        if P.get("lens"):
            draw_lines(canvas, [circle(880, 300, 105)] + [[(955, 375), (1050, 470)]], (t - T(P["lens"])) / 0.5, GOLD, 16)
        if P.get("q"):
            place(canvas, big_text("?", 380, GOLD), 960, 300, t, T(P["q"]), 10, False)
        return None
    if kind == "card":
        canvas[:] = CUR["bg"]
        key, path, st0 = P["clip"]
        f = rd(key, SRC / path, 700, 960, st0, P.get("speed", 0.85)).next()
        place(canvas, card(f), 540, P.get("cy", 640), t, t0, P.get("rot", -2.5))
        strip_stack(canvas, t, P.get("strips", []), P.get("sy", 1070), 95, 50, P.get("size", 64), 980)
        return None
    if kind == "cards":
        canvas[:] = CUR["bg"]
        for key, path, st0, cx, cy, rot, wi in P["cards"]:
            if t >= T(wi):
                f = rd(key, SRC / path, 520, 700, st0, 0.85).next()
                place(canvas, card(f), cx, cy, t, T(wi), rot)
        strip_stack(canvas, t, P.get("strips", []), P.get("sy", 1180), 100, 50, P.get("size", 62), 980)
        return None
    if kind == "paper":
        canvas[:] = BG["paper"]
        if P.get("doc"):
            x0, y0, w, h = 290, 260, 500, 600
            page = [[(x0, y0), (x0 + w - 90, y0), (x0 + w, y0 + 90), (x0 + w, y0 + h), (x0, y0 + h), (x0, y0)],
                    [(x0 + w - 90, y0), (x0 + w - 90, y0 + 90), (x0 + w, y0 + 90)]]
            draw_lines(canvas, page, (t - t0) / 0.6, INK, 8)
            draw_lines(canvas, [[(x0 + 60, y0 + 160 + i * 70), (x0 + w - 60 - (i % 3) * 60, y0 + 160 + i * 70)] for i in range(5)],
                       (t - t0 - 0.4) / 0.8, INK, 6)
        if P.get("plan"):  # floor plan splitting into small lots
            x0, y0, w, h = 140, 300, 800, 620
            draw_lines(canvas, [[(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h), (x0, y0)]], (t - t0) / 0.5, INK, 9)
            cols, rows = 4, 2
            cuts = [[(x0 + w * c / cols, y0), (x0 + w * c / cols, y0 + h)] for c in range(1, cols)]
            cuts += [[(x0, y0 + h * r / rows), (x0 + w, y0 + h * r / rows)] for r in range(1, rows)]
            draw_lines(canvas, cuts, (t - T(P["plan"])) / 1.0, GOLD, 8)
        strip_stack(canvas, t, P.get("strips", []), P.get("sy", 980), P.get("step", 115), 0, P.get("size", 72), 980, True)
        return "dark"
    if kind == "checklist":
        canvas[:] = BG["paper"]
        place(canvas, strip(P["title"], "emer", 64, 980), 540, 230, t, t0, -2)
        f = ImageFont.truetype(SB, 52)
        for k, (txt, wi) in enumerate(P["items"]):
            p = ease_out((t - T(wi)) / 0.3)
            if p <= 0:
                continue
            y = 400 + k * 125
            img = Image.new("RGBA", (1000, 100), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            d.rounded_rectangle((8, 18, 72, 82), 10, outline=INK + (255,), width=6)
            d.text((105, 22), txt, font=f, fill=INK + (255,))
            over(canvas, pil_rgba(img), int(50 + 40 * (1 - p)), y, p)
            draw_lines(canvas, [[(70, y + 50), (90, y + 75), (130, y + 22)]], (t - T(wi) - 0.25) / 0.25, GOLD, 12)
        st = sticker(frame, mask, 0.55)
        put_sticker(canvas, st, W - st.shape[1] + 60, H)
        return "dark"
    if kind == "facts":  # dark premises, facts stack up in the middle
        key, path, st0 = P["clip"]
        f = rd(key, SRC / path, W, H, st0, 0.8).next().astype(np.float32)
        canvas[:] = f * 0.35 + CUR["bg"] * 0.35
        strip_stack(canvas, t, P["strips"], P.get("sy", 420), P.get("step", 150), 0, P.get("size", 84), 1000, True)
        return None
    raise ValueError(kind)


# ---------- main loop ----------
talk = Reader(WORK / "talk.mp4", W, H)
CUR = {}
TINT = np.array((12, 40, 34), np.float32) * 0.35
roomv = subprocess.Popen(["ffmpeg", "-v", "error", "-stream_loop", "-1", "-i", str(WORK / "bgroom.mp4"), "-vf",
                          f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
bgv = subprocess.Popen(["ffmpeg", "-v", "error", "-stream_loop", "-1", "-i", str(WORK / "bgloop.mp4"), "-vf",
                        f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
matte = Reader(WORK / "matte.mp4", 432, 768, gray=True)
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                        "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "17", "-preset", "medium",
                        "-pix_fmt", "yuv420p", str(WORK / "collage_video.mp4")], stdin=subprocess.PIPE)
canvas = np.zeros((H, W, 3), np.float32)
import os
PREV = {int(float(x) * FPS) for x in os.environ["PREVIEW"].split(",")} if os.environ.get("PREVIEW") else None
sub_cache = {}
for i in range(NF):
    t = i / FPS
    frame = talk.next().astype(np.float32)
    CUR["bg"] = np.frombuffer(bgv.stdout.read(W * H * 3), np.uint8).reshape(H, W, 3).astype(np.float32) * 0.45 + TINT
    CUR["room"] = np.frombuffer(roomv.stdout.read(W * H * 3), np.uint8).reshape(H, W, 3).astype(np.float32) * 0.8
    mask = matte.next()[..., 0]
    t0, t1, kind, p = next(s for s in S if s[0] <= t < s[1])
    if PREV is not None and i > max(PREV):
        break
    if PREV is not None and i not in PREV:
        continue
    tone = render(t, frame, mask, kind, t0, canvas, p)
    st = sub_at(t)
    if st:
        text, a = st
        dark = tone == "dark"
        key = (text, dark)
        if key not in sub_cache:
            sub_cache[key] = glow_text(text, 66, INK if dark else WHITE, CHAMP if dark else (0, 0, 0),
                                       0.6 if dark else 0.5)
        g = sub_cache[key]
        al = min(1, (t - a) / 0.12)
        over(canvas, g, int(540 - g.shape[1] / 2), int(1396 - g.shape[0] / 2 + 8 * (1 - al)), al)
    if PREV is not None:
        Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).resize((360, 640)).save(f"{WORK}/pv_{i:05d}.jpg")
        continue
    enc.stdin.write(np.clip(canvas, 0, 255).astype(np.uint8).tobytes())
    if i % 300 == 0:
        print(f"{i}/{NF}", kind, flush=True)
enc.stdin.close()
enc.wait()
print("video done")
