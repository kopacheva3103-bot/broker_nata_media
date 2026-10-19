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
    <серия>/Выпуск_N/4_готово/            итоговый ролик от монтажёра

Примеры:
    python run_brief.py series/begovaya5.yaml find
    python run_brief.py series/begovaya5.yaml generate -e 1 -s G3
    python run_brief.py series/begovaya5.yaml animate -e 1 -e 2
    python run_brief.py series/begovaya5.yaml status
"""
import argparse
import csv
import shutil
from pathlib import Path

import requests
import yaml

import agent1_search as archivist
import agent2_animate as animator
from agent3_colorize import Replicate
from common import IMAGE_EXT, OUTPUT_DIR, Drive, env, open_drive

CANDIDATES = "1_кандидаты"
SELECTED = "2_выбрано"
MONTAGE = "3_монтаж"
READY = "4_готово"  # монтажёр кладёт сюда итоговый ролик
SOURCES = "исходники"  # съёмка (коды С…) и озвучка


class Episode:
    """Папки одного выпуска локально и (если включено) на Google Drive."""

    def __init__(self, series, number, drive):
        self.code = f"Выпуск_{number}"
        self.local = OUTPUT_DIR / series / self.code
        self.drive = drive
        self._ids = {}
        if drive:
            self._ids["root"] = drive.folder(self.code, drive.folder(series))
        else:
            # Сразу создаём все три папки, чтобы было куда переносить выбранные кадры
            for sub in (SOURCES, CANDIDATES, SELECTED, MONTAGE, READY):
                (self.local / sub).mkdir(parents=True, exist_ok=True)

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
    adopt_renamed(brief)
    return brief


def adopt_renamed(brief):
    """Серию переименовали в брифе — переносим её папку на диске под новое имя.

    Новой папки нет — просто переименовываем старую. Есть обе (часть файлов уже легла в новую) —
    копируем старую поверх, а саму старую оставляем с пометкой, ничего не удаляя.
    """
    old_name = brief.get("renamed_from")
    if not old_name:
        return
    old, new = OUTPUT_DIR / old_name, OUTPUT_DIR / brief["series"]
    if not old.is_dir():
        return
    if not new.exists():
        old.rename(new)
        print(f"→ Папка серии переименована: «{old_name}» → «{brief['series']}»")
        return
    shutil.copytree(old, new, dirs_exist_ok=True)
    old.rename(old.with_name(old_name + " (перенесено)"))
    print(f"→ Файлы из «{old_name}» перенесены в «{brief['series']}»; старая папка помечена «(перенесено)»")


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
        found, used = archivist.search_wiki_relaxed(query["wiki"], limit, years_range(query.get("years")))
        note = f" (искал как «{used}»)" if used != query["wiki"] else ""
        print(f"    Wikimedia «{query['wiki']}»: {len(found)}{note}")
        return found
    if "pastvu_cid" in query:
        return archivist.pastvu_photo(query["pastvu_cid"])
    if "pastvu" in query:
        place = brief["places"].get(query["pastvu"], query["pastvu"])
        if place not in geo_cache:
            geo_cache[place] = archivist.geocode(place)
            print(f"    координаты «{place}»: {geo_cache[place][0]:.5f}, {geo_cache[place][1]:.5f}")
        found = archivist.search_pastvu(geo_cache[place], limit, years_range(query.get("years")))
        print(f"    PastVu «{query['pastvu']}» {query.get('years', '')}: {len(found)}")
        return found
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


def step_animate(brief, targets, drive, force, variants=False):
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
        per_code = {}
        for name, _ in files:
            per_code.setdefault(name.split("_")[0].upper(), []).append(name)
        for name, file_id in files:
            code = name.split("_")[0].upper()
            shot = shots.get((number, code))
            if not shot or not shot.get("motion"):
                continue  # статичный кадр — наезд/параллакс сделает монтажёр
            if len(per_code[code]) > 1 and not variants:
                if name == per_code[code][0]:
                    print(f"[{number}/{code}] в 2_выбрано {len(per_code[code])} файла: {', '.join(per_code[code])}.\n"
                          f"    Оставь один (каждое оживление платное) или запусти с --variants, чтобы оживить все")
                continue
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


def step_montage(brief, targets, drive, force, final=False, render=True):
    import montage_bridge
    for number in sorted({n for n, _, _ in targets} or brief["episodes"]):
        if not brief["episodes"][number].get("timeline"):
            continue
        ep = Episode(brief["series"], number, None)
        montage_bridge.run(brief, number, ep.local, render=render, final=final)


STEPS = {"find": step_find, "generate": step_generate, "animate": step_animate, "status": step_status,
         "montage": step_montage}


def main():
    parser = argparse.ArgumentParser(description="Агенты по брифу сериала")
    parser.add_argument("brief", help="файл брифа, например series/begovaya5.yaml")
    parser.add_argument("step", choices=list(STEPS) + ["all"],
                        help="all = find + generate + status (оживление — после выбора кадров)")
    parser.add_argument("-e", "--episode", type=int, action="append", help="только этот выпуск (можно несколько)")
    parser.add_argument("-s", "--shot", action="append", help="только этот код кадра, например G3")
    parser.add_argument("--force", action="store_true", help="переделать, даже если уже есть результат")
    parser.add_argument("--no-drive", action="store_true", help="работать только локально в output/")
    parser.add_argument("--final", action="store_true", help="montage: финальный рендер 1080×1920 (иначе черновик)")
    parser.add_argument("--no-render", action="store_true", help="montage: только собрать project.yaml")
    parser.add_argument("--variants", action="store_true",
                        help="оживить все выбранные варианты одного кода (по умолчанию — только если он один)")
    args = parser.parse_args()

    brief = load_brief(args.brief)
    codes = [c.upper() for c in args.shot or []]
    codes = ["С" + c[1:] if c[:1] == "C" and c[1:].isdigit() else c for c in codes]  # латинская C → С
    targets = list(selected_shots(brief, args.episode, codes))
    drive = open_drive(args.no_drive)
    for step in (["find", "generate", "status"] if args.step == "all" else [args.step]):
        if step == "animate":
            step_animate(brief, targets, drive, args.force, args.variants)
        elif step == "montage":
            step_montage(brief, targets, drive, args.force, final=args.final, render=not args.no_render)
        else:
            STEPS[step](brief, targets, drive, args.force)


if __name__ == "__main__":
    main()
