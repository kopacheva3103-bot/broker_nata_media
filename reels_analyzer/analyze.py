"""Профессиональный разбор Reels конкурентов: хуки, структура, закономерности и ТЗ.

Запуск:
    python analyze.py --drive "https://drive.google.com/drive/folders/<id>"
    python analyze.py --videos ./videos --stats stats.csv
"""

import argparse
import base64
import csv
import json
import os
import re
import sys
from pathlib import Path

import anthropic

import prompts
import video_tools

MODEL = "claude-opus-5"
DEFAULT_NICHE = "брокер / эксперт по недвижимости (новостройки, инвестиции в недвижимость)"
DEFAULT_GOAL = "максимальный охват и прирост подписчиков"


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def download_from_drive(url: str, target: Path) -> None:
    import gdown

    target.mkdir(parents=True, exist_ok=True)
    print(f"Скачиваю видео с Google Диска в {target} ...")
    gdown.download_folder(url=url, output=str(target), quiet=False, remaining_ok=True)


def load_stats(path: Path | None) -> dict[str, dict]:
    if not path or not path.exists():
        return {}
    with path.open(encoding="utf-8-sig") as f:
        rows = {row["file"].strip(): row for row in csv.DictReader(f) if row.get("file")}
    for row in rows.values():
        try:
            row["views_to_followers"] = round(float(row["views"]) / float(row["followers"]), 1)
        except (KeyError, ValueError, ZeroDivisionError):
            pass
    return rows


def ask_claude(client: anthropic.Anthropic, system: str, content: list[dict], max_tokens: int) -> str:
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        betas=["server-side-fallback-2026-07-01"],
        extra_body={"fallbacks": "default"},
        messages=[{"role": "user", "content": content}],
    ) as stream:
        message = stream.get_final_message()
    if message.stop_reason == "refusal":
        raise RuntimeError("Модель отказалась обрабатывать запрос")
    return "".join(b.text for b in message.content if b.type == "text")


def parse_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("В ответе нет JSON")
    return json.loads(match.group(0))


def analyze_video(client, system: str, facts: video_tools.VideoFacts, stats: dict | None) -> dict:
    content: list[dict] = []
    for t, frame in facts.frames:
        content.append({"type": "text", "text": f"Кадр на {t:.1f} c:"})
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg",
                       "data": base64.standard_b64encode(frame.read_bytes()).decode()},
        })
    content.append({"type": "text", "text": prompts.VIDEO_TASK.format(
        facts=facts.summary(),
        stats=json.dumps(stats, ensure_ascii=False) if stats else "нет данных",
    )})
    result = parse_json(ask_claude(client, system, content, max_tokens=32000))
    result["file"] = facts.path.name
    result["tech"] = {
        "duration_s": round(facts.duration, 1),
        "cuts": len(facts.cuts),
        "cuts_per_10s": facts.cuts_per_10s,
        "avg_shot_s": facts.avg_shot,
        "words_per_sec": facts.words_per_sec,
        "vertical": facts.height > facts.width,
    }
    if stats:
        result["stats"] = stats
    return result


def write_table(analyses: list[dict], path: Path) -> None:
    fields = ["file", "format", "topic_category", "hook_type", "hook_spoken", "hook_text",
              "duration_s", "cuts_per_10s", "words_per_sec", "score_hook", "score_retention",
              "score_value", "score_shareability", "score_follow", "views", "views_to_followers",
              "why_it_works"]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for a in analyses:
            hook, sc, tech, st = a.get("hook", {}), a.get("scores", {}), a.get("tech", {}), a.get("stats", {})
            writer.writerow({
                "file": a["file"], "format": a.get("format"), "topic_category": a.get("topic_category"),
                "hook_type": hook.get("hook_type"), "hook_spoken": hook.get("spoken"),
                "hook_text": hook.get("text_on_screen"), "duration_s": tech.get("duration_s"),
                "cuts_per_10s": tech.get("cuts_per_10s"), "words_per_sec": tech.get("words_per_sec"),
                "score_hook": sc.get("hook"), "score_retention": sc.get("retention"),
                "score_value": sc.get("value"), "score_shareability": sc.get("shareability"),
                "score_follow": sc.get("follow_potential"), "views": st.get("views"),
                "views_to_followers": st.get("views_to_followers"), "why_it_works": a.get("why_it_works"),
            })


def video_card(a: dict) -> str:
    hook = a.get("hook", {})
    lines = [f"## {a['file']}", "", f"**{a.get('one_line', '')}**", "",
             f"- Формат: {a.get('format')} · Рубрика: {a.get('topic_category')}",
             f"- Тех: {a['tech']['duration_s']} c, {a['tech']['cuts_per_10s']} склеек/10 c, "
             f"{a['tech']['words_per_sec']} слов/с",
             f"- Оценки: {json.dumps(a.get('scores', {}), ensure_ascii=False)}", "",
             "### Хук", f"- Тип: {hook.get('hook_type')} (сила {hook.get('strength_1_10')}/10)",
             f"- Визуал: {hook.get('visual')}", f"- Текст на экране: {hook.get('text_on_screen')}",
             f"- Первая фраза: {hook.get('spoken')}", f"- Почему работает: {hook.get('why_it_stops_scroll')}",
             "", "### Структура", "| время | блок | что происходит | зачем |", "|---|---|---|---|"]
    lines += [f"| {s.get('time')} | {s.get('block')} | {s.get('what_happens')} | {s.get('purpose')} |"
              for s in a.get("structure", [])]
    lines += ["", "### Механики удержания"] + [f"- {m}" for m in a.get("retention_mechanics", [])]
    lines += ["", "### Триггеры"] + [f"- {t}" for t in a.get("emotional_triggers", [])]
    lines += ["", f"**Ценность:** {a.get('value')}", f"**CTA:** {a.get('cta')}",
              f"**Почему залетел:** {a.get('why_it_works')}", "", "### Слабые места"]
    lines += [f"- {w}" for w in a.get("weak_points", [])]
    lines += ["", "### Идеи для адаптации"]
    lines += [f"- **{i.get('title')}** — хук: «{i.get('hook')}», на экране: «{i.get('text_on_screen')}»"
              for i in a.get("adaptation_ideas", [])]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Разбор Reels конкурентов и генерация ТЗ")
    parser.add_argument("--drive", help="ссылка на папку Google Диска с видео (доступ «все, у кого есть ссылка»)")
    parser.add_argument("--videos", type=Path, default=Path("videos"), help="папка с видео")
    parser.add_argument("--stats", type=Path, default=Path("stats.csv"), help="CSV со статистикой роликов")
    parser.add_argument("--out", type=Path, default=Path("output"), help="папка для результатов")
    parser.add_argument("--niche", default=DEFAULT_NICHE, help="ваша ниша")
    parser.add_argument("--goal", default=DEFAULT_GOAL, help="цель контента")
    parser.add_argument("--briefs", type=int, default=10, help="сколько ТЗ сгенерировать")
    parser.add_argument("--whisper", default="small", help="модель распознавания речи: tiny/base/small/medium")
    parser.add_argument("--no-speech", action="store_true", help="не распознавать речь (быстрее)")
    parser.add_argument("--force", action="store_true", help="переанализировать уже разобранные ролики")
    args = parser.parse_args()

    load_env(Path(__file__).with_name(".env"))
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Не найден ANTHROPIC_API_KEY. Создайте файл .env по образцу config.example.env")

    if args.drive:
        download_from_drive(args.drive, args.videos)

    videos = sorted(p for p in args.videos.rglob("*") if p.suffix.lower() in video_tools.VIDEO_EXT)
    if not videos:
        sys.exit(f"В папке {args.videos} нет видео")

    stats = load_stats(args.stats)
    cache_dir = args.out / "analyses"
    cache_dir.mkdir(parents=True, exist_ok=True)
    client = anthropic.Anthropic()
    system = prompts.SYSTEM.format(niche=args.niche, goal=args.goal)

    analyses = []
    for i, video in enumerate(videos, 1):
        cached = cache_dir / f"{video.stem}.json"
        if cached.exists() and not args.force:
            print(f"[{i}/{len(videos)}] {video.name}: уже разобран, беру из кэша")
            analyses.append(json.loads(cached.read_text(encoding="utf-8")))
            continue
        print(f"[{i}/{len(videos)}] {video.name}: извлекаю кадры, монтаж и речь ...")
        try:
            facts = video_tools.collect(video, args.out, args.whisper, args.no_speech)
            print(f"    {facts.duration:.1f} c, склеек {len(facts.cuts)}, кадров {len(facts.frames)}; анализирую ...")
            result = analyze_video(client, system, facts, stats.get(video.name))
        except Exception as exc:  # один битый файл не должен останавливать весь разбор
            print(f"    ошибка: {exc}")
            continue
        cached.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        analyses.append(result)

    if not analyses:
        sys.exit("Не удалось разобрать ни одного ролика")

    write_table(analyses, args.out / "таблица_роликов.csv")
    (args.out / "разборы_роликов.md").write_text(
        "# Разборы роликов\n\n" + "\n---\n\n".join(video_card(a) for a in analyses), encoding="utf-8")

    print("Ищу закономерности и пишу ТЗ ...")
    report = ask_claude(client, system, [{"type": "text", "text": prompts.REPORT_TASK.format(
        n=len(analyses), niche=args.niche, goal=args.goal, briefs=args.briefs,
        analyses=json.dumps(analyses, ensure_ascii=False, indent=1),
    )}], max_tokens=64000)
    (args.out / "отчёт_и_ТЗ.md").write_text(report, encoding="utf-8")

    print(f"\nГотово. Результаты в папке {args.out.resolve()}:")
    print("  отчёт_и_ТЗ.md        — закономерности, банк хуков, стратегия, ТЗ, контент-план")
    print("  разборы_роликов.md   — подробный разбор каждого ролика")
    print("  таблица_роликов.csv  — сводная таблица (открывается в Google Таблицах / Excel)")


if __name__ == "__main__":
    main()
