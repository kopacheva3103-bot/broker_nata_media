"""Агент 1: ищет фото по промту на бесплатных стоках (Pexels, Unsplash).

Фото со стоков Pexels и Unsplash бесплатны и разрешены для коммерческого
использования, поэтому их можно публиковать в соцсетях и рекламе.

Примеры:
    python agent1_search.py "панорамный вид на Москва-Сити вечером"
    python agent1_search.py "luxury living room" "penthouse terrace" -n 15
    python agent1_search.py -f prompts.txt --no-drive
"""
import argparse
import csv
from pathlib import Path

import requests

from common import FOLDER_FOUND, OUTPUT_DIR, Drive, env, slugify

TIMEOUT = 30


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


def download(item, folder):
    path = folder / f"{item['source']}_{item['id']}.jpg"
    r = requests.get(item["url"], timeout=TIMEOUT)
    r.raise_for_status()
    path.write_bytes(r.content)
    if item.get("download_location"):
        # Правила Unsplash: отмечаем скачивание, иначе ключ могут заблокировать
        requests.get(item["download_location"], timeout=TIMEOUT,
                     headers={"Authorization": f"Client-ID {env('UNSPLASH_ACCESS_KEY')}"})
    return path


def run(query, limit, orientation, drive):
    if not env("PEXELS_API_KEY") and not env("UNSPLASH_ACCESS_KEY"):
        raise SystemExit("Нужен хотя бы один ключ: PEXELS_API_KEY или UNSPLASH_ACCESS_KEY")

    # Берём поровну с каждого стока, чтобы был выбор
    half = max(1, limit // 2)
    items = search_pexels(query, half, orientation) + search_unsplash(query, limit - half, orientation)
    items = items[:limit]
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

    # Список авторов: пригодится, чтобы указать автора в посте, если захочешь
    credits = folder / "_авторы.csv"
    with open(credits, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["file", "source", "author", "page"], extrasaction="ignore")
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
    parser.add_argument("-f", "--file", help="файл с промтами, по одному на строку")
    parser.add_argument("-n", "--limit", type=int, default=10, help="сколько фото на промт (по умолчанию 10)")
    parser.add_argument("-o", "--orientation", choices=["portrait", "landscape", "square"], default="portrait",
                        help="ориентация (по умолчанию portrait — под Reels)")
    parser.add_argument("--no-drive", action="store_true", help="не загружать на Google Drive")
    args = parser.parse_args()

    prompts = list(args.prompts)
    if args.file:
        prompts += [line.strip() for line in Path(args.file).read_text(encoding="utf-8").splitlines()
                    if line.strip() and not line.startswith("#")]
    if not prompts:
        parser.error("укажи промт или файл с промтами (-f)")

    drive = None if args.no_drive else Drive()
    for prompt in prompts:
        print(f"Ищу: «{prompt}»")
        run(prompt, args.limit, args.orientation, drive)


if __name__ == "__main__":
    main()
