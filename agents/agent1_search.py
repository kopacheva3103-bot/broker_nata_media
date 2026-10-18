"""Агент 1: ищет фото по промту.

Источники (-s):
    stock   — Pexels + Unsplash: современные фото, можно в коммерцию без указания автора.
    wiki    — Wikimedia Commons: старые и исторические фото, только со свободной
              лицензией (общественное достояние / CC). Автора и лицензию пишем в _авторы.csv.
    pastvu  — PastVu: архив старых фото Москвы по координатам и годам.
              Лицензии разные — только с указанием источника, для рекламы проверять каждое.

Примеры:
    python agent1_search.py "панорамный вид на Москва-Сити вечером"
    python agent1_search.py "Tverskaya street Moscow 1900" -s wiki
    python agent1_search.py "Красная площадь" -s pastvu --geo 55.7539,37.6208 --years 1880-1930
    python agent1_search.py -f prompts.txt --no-drive
"""
import argparse
import csv
import html
import json
import re
from pathlib import Path

import requests

from common import FOLDER_FOUND, OUTPUT_DIR, Drive, env, slugify

TIMEOUT = 30
# Википедия и PastVu просят представляться в запросах
USER_AGENT = "broker-nata-content-agent/1.0 (https://github.com/kopacheva3103-bot/broker_nata_media)"

# Лицензии Wikimedia, которые разрешают коммерческое использование
FREE_LICENSES = ("public domain", "pd", "cc0", "cc by", "cc-by", "no restrictions")


def search_pexels(query, limit, orientation):
    key = env("PEXELS_API_KEY")
    if not key:
        return []
    params = {"query": query, "per_page": min(limit, 80), "locale": "ru-RU"}
    if orientation:
        params["orientation"] = orientation
    r = requests.get("https://api.pexels.com/v1/search", params=params,
                     headers={"Authorization": key}, timeout=TIMEOUT)
    r.raise_for_status()
    return [{
        "source": "pexels",
        "id": p["id"],
        "url": p["src"]["large2x"],
        "author": p["photographer"],
        "page": p["url"],
    } for p in r.json().get("photos", [])]


def search_unsplash(query, limit, orientation):
    key = env("UNSPLASH_ACCESS_KEY")
    if not key:
        return []
    params = {"query": query, "per_page": min(limit, 30), "lang": "ru"}
    if orientation:
        params["orientation"] = "squarish" if orientation == "square" else orientation
    headers = {"Authorization": f"Client-ID {key}"}
    r = requests.get("https://api.unsplash.com/search/photos", params=params,
                     headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    results = []
    for p in r.json().get("results", []):
        results.append({
            "source": "unsplash",
            "id": p["id"],
            "url": p["urls"]["regular"],
            "author": p["user"]["name"],
            "page": p["links"]["html"],
            "download_location": p["links"]["download_location"],
        })
    return results


def _clean(text):
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def search_wiki(query, limit, years):
    params = {
        "action": "query", "format": "json",
        "generator": "search", "gsrsearch": f"{query} filetype:bitmap",
        "gsrnamespace": 6, "gsrlimit": min(limit * 3, 50),  # с запасом: часть отсеется по лицензии
        "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 1920,
        "iiextmetadatafilter": "LicenseShortName|Artist|DateTimeOriginal|ObjectName",
    }
    r = requests.get("https://commons.wikimedia.org/w/api.php", params=params,
                     headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    r.raise_for_status()
    pages = sorted(r.json().get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    results = []
    for page in pages:
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        license_name = _clean(meta.get("LicenseShortName", {}).get("value"))
        if not license_name.lower().startswith(FREE_LICENSES) or "nc" in license_name.lower().split("-"):
            continue
        date = _clean(meta.get("DateTimeOriginal", {}).get("value"))
        year = re.search(r"1[6-9]\d\d|20\d\d", date)
        if years and year and not (years[0] <= int(year.group()) <= years[1]):
            continue
        if min(info.get("width", 0), info.get("height", 0)) < 300:  # Kling не примет меньше 300 px
            continue
        results.append({
            "source": "wiki",
            "id": page["pageid"],
            "url": info.get("thumburl") or info["url"],
            "author": _clean(meta.get("Artist", {}).get("value")) or "неизвестен",
            "page": info.get("descriptionurl"),
            "license": license_name,
            "year": date,
            "title": _clean(meta.get("ObjectName", {}).get("value")),
        })
        if len(results) >= limit:
            break
    return results


def search_pastvu(geo, limit, years):
    params = {"geo": list(geo), "limit": min(limit, 30)}  # PastVu отдаёт не больше 30
    if years:
        params.update(year=years[0], year2=years[1])
    r = requests.get("https://pastvu.com/api2",
                     params={"method": "photo.giveNearestPhotos", "params": json.dumps(params)},
                     headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    r.raise_for_status()
    return [{
        "source": "pastvu",
        "id": p["cid"],
        "url": f"https://pastvu.com/_p/a/{p['file']}",
        "author": "см. страницу фото",
        "page": f"https://pastvu.com/p/{p['cid']}",
        "license": "проверить на странице фото",
        "year": f"{p.get('year')}" + (f"–{p['year2']}" if p.get("year2") not in (None, p.get("year")) else ""),
        "title": p.get("title", ""),
    } for p in r.json().get("result", {}).get("photos", [])]


def download(item, folder):
    path = folder / f"{item['source']}_{item['id']}.jpg"
    r = requests.get(item["url"], headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    r.raise_for_status()
    path.write_bytes(r.content)
    if item.get("download_location"):
        # Правила Unsplash: отмечаем скачивание, иначе ключ могут заблокировать
        requests.get(item["download_location"], timeout=TIMEOUT,
                     headers={"Authorization": f"Client-ID {env('UNSPLASH_ACCESS_KEY')}"})
    return path


def find(query, source, limit, orientation, years, geo):
    if source == "wiki":
        return search_wiki(query, limit, years)
    if source == "pastvu":
        if not geo:
            raise SystemExit("Для PastVu нужны координаты места: --geo 55.7539,37.6208")
        return search_pastvu(geo, limit, years)[:limit]
    if not env("PEXELS_API_KEY") and not env("UNSPLASH_ACCESS_KEY"):
        raise SystemExit("Нужен хотя бы один ключ: PEXELS_API_KEY или UNSPLASH_ACCESS_KEY")
    # Берём поровну с каждого стока, чтобы был выбор
    half = max(1, limit // 2)
    items = search_pexels(query, half, orientation) + search_unsplash(query, limit - half, orientation)
    return items[:limit]


def run(query, source, limit, orientation, years, geo, drive):
    items = find(query, source, limit, orientation, years, geo)
    if not items:
        print(f"  Ничего не найдено по запросу «{query}». Попробуй сформулировать иначе или на английском.")
        return

    folder = OUTPUT_DIR / FOLDER_FOUND / slugify(query)
    folder.mkdir(parents=True, exist_ok=True)
    rows = []
    for item in items:
        try:
            item["file"] = download(item, folder).name
            rows.append(item)
            print(f"  + {item['file']} ({item['author']})")
        except requests.RequestException as e:
            print(f"  ! не скачалось {item['url']}: {e}")

    # Авторы, лицензии и годы: для подписи в ролике («Фото: ..., Wikimedia Commons»)
    credits = folder / "_авторы.csv"
    with open(credits, "w", newline="", encoding="utf-8-sig") as fh:  # -sig: чтобы Excel открыл кириллицу
        fields = ["file", "source", "year", "title", "author", "license", "page"]
        writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    if drive:
        target = drive.folder(slugify(query), drive.folder(FOLDER_FOUND))
        for path in sorted(folder.iterdir()):
            drive.upload(path, target)
        print(f"  → загружено на Google Drive: {FOLDER_FOUND}/{slugify(query)}")
    print(f"  Готово: {len(rows)} фото в {folder}")


def main():
    parser = argparse.ArgumentParser(description="Агент 1: поиск фото по промту")
    parser.add_argument("prompts", nargs="*", help="поисковые промты")
    parser.add_argument("-s", "--source", choices=["stock", "wiki", "pastvu"], default="stock",
                        help="stock — современные фото, wiki и pastvu — исторические")
    parser.add_argument("--years", help="диапазон лет для исторических фото, например 1880-1930")
    parser.add_argument("--geo", help="координаты места для PastVu: широта,долгота (из Яндекс.Карт)")
    parser.add_argument("-f", "--file", help="файл с промтами, по одному на строку")
    parser.add_argument("-n", "--limit", type=int, default=10, help="сколько фото на промт (по умолчанию 10)")
    parser.add_argument("-o", "--orientation", choices=["portrait", "landscape", "square"], default="portrait",
                        help="ориентация для stock (по умолчанию portrait — под Reels)")
    parser.add_argument("--no-drive", action="store_true", help="не загружать на Google Drive")
    args = parser.parse_args()

    prompts = list(args.prompts)
    if args.file:
        prompts += [line.strip() for line in Path(args.file).read_text(encoding="utf-8").splitlines()
                    if line.strip() and not line.startswith("#")]
    if not prompts:
        parser.error("укажи промт или файл с промтами (-f)")
    years = geo = None
    if args.years:
        start, _, end = args.years.partition("-")
        years = (int(start), int(end or start))
    if args.geo:
        lat, lng = (float(x) for x in args.geo.replace(" ", "").split(","))
        geo = (lat, lng)

    drive = None if args.no_drive else Drive()
    for prompt in prompts:
        print(f"Ищу: «{prompt}» ({args.source})")
        run(prompt, args.source, args.limit, args.orientation, years, geo, drive)


if __name__ == "__main__":
    main()
