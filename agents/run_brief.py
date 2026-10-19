"""Запуск агентов по брифу сериала (series/*.yaml).

Шаги:
    find      — агент-архивист: ищет А-кадры (Wikimedia, PastVu) → 1_кандидаты/<код>
    generate  — агент-художник: рисует G-кадры (FLUX, 3 варианта, 9:16) → 1_кандидаты/<код>
    animate   — агент-аниматор: оживляет в Kling то, что ассистент перенёс в 2_выбрано → 3_монтаж
    status    — таблица: что найдено, выбрано, оживлено и что осталось сделать руками

Структура на Google Drive (и локально в output/):
    <серия>/Выпуск_N/1_кандидаты/<код>/   варианты от агентов
    <серия>/Выпуск_N/2_выбрано/           ассистент переносит сюда по одному лучшему кадру на код
    <серия>/Выпуск_N/3_монтаж/            видео от Kling, монтажёр берёт отсюда + из 2_выбрано

Примеры:
    python run_brief.py series/begovaya5.yaml find
    python run_brief.py series/begovaya5.yaml generate -e 1 -s G3
    python run_brief.py series/begovaya5.yaml animate -e 1 -e 2
    python run_brief.py series/begovaya5.yaml status
"""
import argparse
import csv
from pathlib import Path

import requests
import yaml

import agent1_search as archivist
import agent2_animate as animator
from agent3_colorize import Replicate
from common import IMAGE_EXT, OUTPUT_DIR, Drive, env

CANDIDATES = "1_кандидаты"
SELECTED = "2_выбрано"
MONTAGE = "3_монтаж"


class Episode:
    """Папки одного выпуска локально и (если включено) на Google Drive."""

    def __init__(self, series, number, drive):
        self.code = f"Выпуск_{number}"
        self.local = OUTPUT_DIR / series / self.code
        self.drive = drive
        self._ids = {}
        if drive:
            self._ids["root"] = drive.folder(self.code, drive.folder(series))

    def path(self, *parts):
        p = self.local.joinpath(*parts)
        p.mkdir(parents=True, exist_ok=True)
        return p

    def drive_folder(self, *parts):
        key = "/".join(parts)
        if key not in self._ids:
            parent = self._ids["root"]
            for part in parts:
                parent = self.drive.folder(part, parent)
            self._ids[key] = parent
        return self._ids[key]

    def has_candidates(self, shot):
        local = self.local / CANDIDATES / shot
        if local.exists() and any(p.suffix.lower() in IMAGE_EXT for p in local.iterdir()):
            return True
        return bool(self.drive and self.drive.list_images(self.drive_folder(CANDIDATES, shot)))

    def publish(self, files, *parts):
        if self.drive:
            target = self.drive_folder(*parts)
            for f in files:
                self.drive.upload(f, target)


def load_brief(path):
    brief = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    brief.setdefault("defaults", {})
    brief.setdefault("places", {})
    return brief


def selected_shots(brief, episodes, shots):
    for number, ep in brief["episodes"].items():
        if episodes and int(number) not in episodes:
            continue
        for code, shot in (ep.get("shots") or {}).items():
            if shots and code not in shots:
                continue
            yield int(number), code, shot


def years_range(text):
    if not text:
        return None
    start, _, end = str(text).partition("-")
    return int(start), int(end or start)


def search(query, brief, geo_cache, limit):
    if "wiki" in query:
        return archivist.search_wiki(query["wiki"], limit, years_range(query.get("years")))
    if "pastvu_cid" in query:
        return archivist.pastvu_photo(query["pastvu_cid"])
    if "pastvu" in query:
        place = brief["places"].get(query["pastvu"], query["pastvu"])
        if place not in geo_cache:
            geo_cache[place] = archivist.geocode(place)
            print(f"    координаты «{place}»: {geo_cache[place][0]:.5f}, {geo_cache[place][1]:.5f}")
        return archivist.search_pastvu(geo_cache[place], limit, years_range(query.get("years")))
    raise ValueError(f"непонятный запрос: {query}")


def step_find(brief, targets, drive, force):
    limit = brief["defaults"].get("candidates", 8)
    geo_cache = {}
    for number, code, shot in targets:
        if not shot.get("find"):
            continue
        ep = Episode(brief["series"], number, drive)
        if ep.has_candidates(code) and not force:
            print(f"[{number}/{code}] уже есть кандидаты — пропускаю (--force, чтобы искать заново)")
            continue
        print(f"[{number}/{code}] {shot['what']}")
        items, seen = [], set()
        for query in shot["find"]:
            try:
                found = search(query, brief, geo_cache, limit)
            except (requests.RequestException, RuntimeError) as e:
                print(f"    ! {query}: {e}")
                continue
            for item in found:
                key = (item["source"], item["id"])
                if key not in seen:
                    seen.add(key)
                    items.append(item)
        items = items[:limit]

        folder = ep.path(CANDIDATES, code)
        rows = []
        for i, item in enumerate(items, 1):
            try:
                raw = archivist.download(item, folder)
            except requests.RequestException as e:
                print(f"    ! не скачалось {item['page']}: {e}")
                continue
            item["file"] = raw.rename(folder / f"{code}_{i:02d}_{raw.name}").name
            rows.append(item)
        if not rows:
            print(f"    ничего не нашли → {shot.get('fallback') or shot.get('manual') or 'искать вручную'}")
            continue
        credits = folder / "_авторы.csv"
        with open(credits, "w", newline="", encoding="utf-8-sig") as fh:
            fields = ["file", "source", "year", "title", "author", "license", "page"]
            writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        ep.publish([folder / r["file"] for r in rows] + [credits], CANDIDATES, code)
        print(f"    + {len(rows)} кандидатов")


def step_generate(brief, targets, drive, force):
    variants = brief["defaults"].get("variants", 3)
    replicate = None
    for number, code, shot in targets:
        if not shot.get("generate"):
            continue
        ep = Episode(brief["series"], number, drive)
        if ep.has_candidates(code) and not force:
            print(f"[{number}/{code}] уже сгенерировано — пропускаю (--force, чтобы перегенерировать)")
            continue
        replicate = replicate or Replicate()
        print(f"[{number}/{code}] {shot['what']} — {variants} варианта")
        folder = ep.path(CANDIDATES, code)
        made = []
        for v in range(1, variants + 1):
            try:
                made.append(replicate.generate(shot["generate"], folder / f"{code}_v{v}.jpg"))
            except Exception as e:
                print(f"    ! вариант {v}: {e}")
        ep.publish(made, CANDIDATES, code)
        print(f"    + {len(made)} вариантов")


def step_animate(brief, targets, drive, force):
    shots = {(n, c): s for n, c, s in targets}
    negative = brief["defaults"].get("negative", "")
    by_episode = {}
    for number in sorted({n for n, _ in shots}):
        ep = Episode(brief["series"], number, drive)
        if drive:
            src = ep.drive_folder(SELECTED)
            files = [(f["name"], f["id"]) for f in drive.list_images(src)]
            done = {Path(f["name"]).stem for f in drive.list_files(ep.drive_folder(MONTAGE))}
        else:
            src_dir = ep.path(SELECTED)
            files = [(p.name, None) for p in sorted(src_dir.iterdir()) if p.suffix.lower() in IMAGE_EXT]
            done = {p.stem for p in ep.path(MONTAGE).glob("*.mp4")}
        jobs = []
        for name, file_id in files:
            code = name.split("_")[0].upper()
            shot = shots.get((number, code))
            if not shot or not shot.get("motion"):
                continue  # статичный кадр — наезд/параллакс сделает монтажёр
            if Path(name).stem in done and not force:
                print(f"[{number}/{code}] видео уже есть — пропускаю")
                continue
            local = ep.path(SELECTED) / name
            if file_id and not local.exists():
                drive.download(file_id, local)
            jobs.append({"image": local, "name": Path(name).stem,
                         "prompt": shot["motion"], "negative": shot.get("negative", negative)})
        if jobs:
            by_episode[number] = (ep, jobs)

    if not by_episode:
        print("Нечего оживлять: перенеси выбранные кадры с motion в 2_выбрано "
              "(имя файла должно начинаться с кода, например G1_v2.jpg)")
        return
    kling = animator.make_client()
    for number, (ep, jobs) in by_episode.items():
        print(f"Выпуск {number}: оживляю {len(jobs)} кадров")
        animator.animate(jobs, kling, "", "", env("KLING_DURATION", "5"), env("KLING_MODE", "pro"),
                         env("KLING_MODEL", "kling-v2-1"), out_dir=ep.path(MONTAGE))
        ep.publish([j["video"] for j in jobs if "video" in j], MONTAGE)


def step_status(brief, targets, drive, _force):
    lines = [f"# Статус: {brief['series']}", ""]
    current = None
    for number, code, shot in targets:
        ep = Episode(brief["series"], number, drive)
        if number != current:
            current = number
            title = brief["episodes"][number].get("title", "")
            lines += ["", f"## Выпуск {number}/5 — {title}", "",
                      "| Код | Что | Таймкод | Кандидаты | Выбрано | Видео | Руками / запасной вариант |",
                      "|---|---|---|---|---|---|---|"]
        if drive:
            cands = len(drive.list_images(ep.drive_folder(CANDIDATES, code)))
            chosen = [f["name"] for f in drive.list_images(ep.drive_folder(SELECTED))]
            videos = [f["name"] for f in drive.list_files(ep.drive_folder(MONTAGE))]
        else:
            cdir = ep.local / CANDIDATES / code
            cands = len([p for p in cdir.iterdir() if p.suffix.lower() in IMAGE_EXT]) if cdir.exists() else 0
            chosen = [p.name for p in (ep.local / SELECTED).glob("*")]
            videos = [p.name for p in (ep.local / MONTAGE).glob("*.mp4")]
        is_mine = lambda name: name.upper().startswith(code + "_") or name.upper().startswith(code + ".")
        auto = shot.get("find") or shot.get("generate")
        picked = "✅" if any(map(is_mine, chosen)) else ("⬜ ассистент" if cands else "—")
        video = ("✅" if any(map(is_mine, videos)) else "⬜") if shot.get("motion") else "не нужно"
        todo = " · ".join(x for x in (shot.get("manual"), shot.get("fallback") and f"запасной: {shot['fallback']}") if x)
        lines.append(f"| {code} | {shot.get('what', '')} | {shot.get('timecode', '')} | "
                     f"{cands if auto else 'руками'} | {picked} | {video} | {todo} |")
    report = OUTPUT_DIR / brief["series"] / "_статус.md"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\nСохранено: {report}")


STEPS = {"find": step_find, "generate": step_generate, "animate": step_animate, "status": step_status}


def main():
    parser = argparse.ArgumentParser(description="Агенты по брифу сериала")
    parser.add_argument("brief", help="файл брифа, например series/begovaya5.yaml")
    parser.add_argument("step", choices=list(STEPS) + ["all"],
                        help="all = find + generate + status (оживление — после выбора кадров)")
    parser.add_argument("-e", "--episode", type=int, action="append", help="только этот выпуск (можно несколько)")
    parser.add_argument("-s", "--shot", action="append", help="только этот код кадра, например G3")
    parser.add_argument("--force", action="store_true", help="переделать, даже если уже есть результат")
    parser.add_argument("--no-drive", action="store_true", help="работать только локально в output/")
    args = parser.parse_args()

    brief = load_brief(args.brief)
    targets = list(selected_shots(brief, args.episode, [s.upper() for s in args.shot or []]))
    drive = None if args.no_drive else Drive()
    for step in (["find", "generate", "status"] if args.step == "all" else [args.step]):
        STEPS[step](brief, targets, drive, args.force)


if __name__ == "__main__":
    main()
