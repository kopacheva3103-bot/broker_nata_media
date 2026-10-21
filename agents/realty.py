"""Картинки ЖК со страницы Яндекс Недвижимости → вертикаль 9:16 → оживление под Reels.

    ./run.sh realty fetch <ссылка> [-n "Имя папки"]   картинки галереи → 1_кандидаты
    ./run.sh realty fetch ~/Downloads/страница.html   то же из сохранённой страницы (если Яндекс показал капчу)
    ./run.sh realty vertical -n "Имя папки"           2_выбрано: горизонтальные → _9x16.jpg (~$0.05 за кадр)
    ./run.sh realty animate -n "Имя папки"            вертикальные кадры 2_выбрано → видео в 3_монтаж (платно)

Папка: <OUTPUT_DIR>/Объекты/<имя>/ — 1_кандидаты, 2_выбрано, 3_монтаж.
Между fetch и vertical — выбрать лучшие кадры и скопировать их в 2_выбрано.
"""
import argparse
import hashlib
import re
import sys
from pathlib import Path

import requests

import agent2_animate as animator
import montage_bridge
import vertical
from agent3_colorize import Replicate
from common import IMAGE_EXT, OUTPUT_DIR, env

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.5 Safari/605.1.15")
HEADERS = {"User-Agent": UA, "Accept-Language": "ru-RU,ru;q=0.9", "Referer": "https://realty.yandex.ru/"}
IMAGE_RE = re.compile(r"(?:https?:)?//avatars\.mds\.yandex\.net/(get-[a-z0-9\-]+/\d+/[A-Za-z0-9_\-.]+)/([A-Za-z0-9_\-]+)")
MIN_SIDE = 700  # меньше — иконки, логотипы, превью
MOTION = ("Плавный кинематографичный пролёт камеры вокруг здания, лёгкое движение облаков и листвы, "
          "мягкий естественный свет. Архитектура, пропорции и фасады без изменений.")
NEGATIVE = "люди крупным планом, текст, водяные знаки, логотипы, деформация здания, резкие движения камеры"


def folder(name, *parts):
    p = OUTPUT_DIR / "Объекты" / name
    for sub in ("1_кандидаты", "2_выбрано", "3_монтаж"):
        (p / sub).mkdir(parents=True, exist_ok=True)
    return p.joinpath(*parts)


def _size_rank(size):
    """Чем больше вариант картинки, тем выше: orig > large/1242 > … (по названию размера)."""
    digits = [int(d) for d in re.findall(r"\d+", size)] or [0]
    return ("orig" in size, "large" in size or "big" in size, max(digits))


def page_images(html):
    """{основа ссылки: [размеры, начиная с самого большого]} в порядке появления на странице."""
    text = html.replace("\\u002F", "/").replace("\\/", "/")
    found = {}
    for base, size in IMAGE_RE.findall(text):
        found.setdefault(base, set()).add(size)
    return {base: sorted(sizes, key=_size_rank, reverse=True) for base, sizes in found.items()}


def load_page(source):
    path = Path(source).expanduser()
    if path.exists():
        return path.read_text(encoding="utf-8", errors="ignore")
    r = requests.get(source, headers=HEADERS, timeout=30)
    if "captcha" in r.url or "smartcaptcha" in r.text[:20000].lower():
        sys.exit("Яндекс показал проверку «я не робот». Сохрани страницу сам:\n"
                 "  1) открой ссылку в Safari и дождись, пока загрузятся фото;\n"
                 "  2) Файл → Сохранить как… → формат «Источник страницы» → в Загрузки;\n"
                 "  3) ./run.sh realty fetch ~/Downloads/<имя файла>.html -n \"<имя ЖК>\"")
    r.raise_for_status()
    return r.text


def fetch(source, name):
    images = page_images(load_page(source))
    if not images:
        sys.exit("На странице не нашлось фото галереи. Пришли Claude скриншот или сохранённую страницу.")
    montage_bridge.ensure_ffmpeg()
    dest_dir = folder(name, "1_кандидаты")
    seen, saved = set(), 0
    for base, sizes in images.items():
        for size in ["orig"] + sizes:
            try:
                r = requests.get(f"https://avatars.mds.yandex.net/{base}/{size}", headers=HEADERS, timeout=60)
            except requests.RequestException:
                continue
            if r.ok and r.headers.get("content-type", "").startswith("image/"):
                break
        else:
            continue
        digest = hashlib.md5(r.content).hexdigest()
        if digest in seen:
            continue
        seen.add(digest)
        dest = dest_dir / f"{saved + 1:02d}_{base.rsplit('/', 1)[-1][:24]}.jpg"
        dest.write_bytes(r.content)
        w, h = vertical.size(dest)
        if min(w, h) < MIN_SIDE:
            dest.unlink()
            continue
        saved += 1
        print(f"  {dest.name}  {w}×{h}{'  вертикальный' if w / h <= vertical.VERTICAL_MAX else ''}")
    print(f"Готово: {saved} фото → {dest_dir}\n"
          f"Выбери лучшие (по одному на сцену) и скопируй в {folder(name, '2_выбрано')}, затем:\n"
          f"  ./run.sh realty vertical -n \"{name}\"")


def selected(name):
    files = sorted(p for p in folder(name, "2_выбрано").iterdir() if p.suffix.lower() in IMAGE_EXT)
    with_vertical = {p.stem[: -len(vertical.SUFFIX)] for p in files if vertical.is_derived(p.name)}
    return [p for p in files if vertical.is_derived(p.name) or p.stem not in with_vertical]


def make_vertical(name, mode, force):
    montage_bridge.ensure_ffmpeg()
    client = None if mode == "crop" else Replicate()
    files = selected(name)
    if not files:
        sys.exit(f"Пусто: скопируй выбранные фото в {folder(name, '2_выбрано')}")
    for src in files:
        if vertical.is_derived(src.name) or vertical.is_vertical(src):
            print(f"  {src.name}: уже вертикальный")
            continue
        if vertical.target(src).exists() and not force:
            continue
        print(f"  {src.name}: горизонтальный → {'обрезка' if mode == 'crop' else 'подрезка + дорисовка'}…")
        out = vertical.make(client, src, {"vertical": mode})
        print(f"    → {out.name}")
    print(f"Посмотри файлы _9x16 в {folder(name, '2_выбрано')}; если всё хорошо:\n"
          f"  ./run.sh realty animate -n \"{name}\"")


def animate(name, prompt, force):
    montage_bridge.ensure_ffmpeg()
    out_dir = folder(name, "3_монтаж")
    done = {p.stem for p in out_dir.glob("*.mp4")}
    jobs = []
    for src in selected(name):
        if not vertical.is_vertical(src):
            print(f"  {src.name}: горизонтальный — пропускаю (сначала ./run.sh realty vertical -n \"{name}\")")
        elif src.stem in done and not force:
            print(f"  {src.name}: видео уже есть")
        else:
            jobs.append({"image": src, "name": src.stem, "prompt": prompt, "negative": NEGATIVE})
    if not jobs:
        return
    print(f"Оживляю {len(jobs)} кадров (каждый — платная генерация)…")
    animator.animate(jobs, animator.make_client(), prompt, NEGATIVE, env("KLING_DURATION", "5"),
                     env("KLING_MODE", "pro"), env("KLING_MODEL", "kling-v2-1"), out_dir=out_dir)
    print(f"Видео → {out_dir}")


def main():
    parser = argparse.ArgumentParser(description="Картинки ЖК с Яндекс Недвижимости → вертикальные видео для Reels")
    parser.add_argument("step", choices=["fetch", "vertical", "animate"])
    parser.add_argument("source", nargs="?", help="fetch: ссылка на страницу или сохранённый .html")
    parser.add_argument("-n", "--name", help="имя папки объекта (по умолчанию — из ссылки)")
    parser.add_argument("--mode", choices=["auto", "outpaint", "crop"], default="auto",
                        help="vertical: auto — подрезка до 4:5 + дорисовка; crop — только обрезка (бесплатно)")
    parser.add_argument("-p", "--prompt", default=MOTION, help="animate: как двигаться камере")
    parser.add_argument("--force", action="store_true", help="переделать, даже если уже есть")
    args = parser.parse_args()

    name = args.name
    if not name and args.source:
        name = re.sub(r"[?#].*", "", args.source).rstrip("/").rsplit("/", 1)[-1].removesuffix(".html")
    if not name:
        parser.error("укажи -n \"Имя папки\"")
    if args.step == "fetch":
        if not args.source:
            parser.error("fetch: нужна ссылка или сохранённая страница")
        fetch(args.source, name)
    elif args.step == "vertical":
        make_vertical(name, args.mode, args.force)
    else:
        animate(name, args.prompt, args.force)


if __name__ == "__main__":
    main()
