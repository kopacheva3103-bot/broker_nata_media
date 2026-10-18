"""Агент 3: раскрашивает и реставрирует старые ч/б фото (FLUX Kontext через Replicate).

Режим Google Drive (по умолчанию): берёт фото из «2_раскрасить», цветные версии кладёт
в «2_оживить» (дальше их оживляет агент 2), а ч/б оригиналы переносит в
«3_монтаж/<дата>/ч_б_оригиналы» — монтажёру для перехода «было ч/б → стало цветным».

Примеры:
    python agent3_colorize.py
    python agent3_colorize.py --input ../output/1_найдено/tverskaya --no-drive
    python agent3_colorize.py -p "Colorize as a sunny summer day in 1905 ..."
"""
import argparse
import base64
import mimetypes
import time
from datetime import datetime
from pathlib import Path

import requests

from common import FOLDER_EDIT, FOLDER_TO_ANIMATE, FOLDER_TO_COLOR, IMAGE_EXT, OUTPUT_DIR, Drive, env

# FLUX лучше понимает промты на английском
DEFAULT_PROMPT = (
    "Restore and colorize this old black-and-white photograph of Moscow. "
    "Use realistic, natural, historically accurate colors of the late 19th and early 20th century: "
    "warm stone and plaster facades, muted period clothing, natural sky. "
    "Remove scratches, dust, stains and film damage. "
    "Keep the composition, architecture, signs, people and every detail exactly the same. "
    "Do not add, remove or modernize anything."
)
MAX_WAIT = 5 * 60
ORIGINALS = "ч_б_оригиналы"


class Replicate:
    def __init__(self):
        self.token = env("REPLICATE_API_TOKEN", required=True)
        self.model = env("COLORIZE_MODEL", "black-forest-labs/flux-kontext-pro")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def colorize(self, image_path, prompt, dest):
        mime = mimetypes.guess_type(str(image_path))[0] or "image/jpeg"
        data_uri = f"data:{mime};base64,{base64.b64encode(Path(image_path).read_bytes()).decode()}"
        payload = {"input": {
            "prompt": prompt,
            "input_image": data_uri,
            "aspect_ratio": "match_input_image",
            "output_format": "jpg",
        }}
        r = requests.post(f"https://api.replicate.com/v1/models/{self.model}/predictions",
                          json=payload, headers={**self.headers, "Prefer": "wait"}, timeout=90)
        r.raise_for_status()
        pred = r.json()

        started = time.time()
        while pred["status"] not in ("succeeded", "failed", "canceled"):
            if time.time() - started > MAX_WAIT:
                raise RuntimeError(f"не дождались за {MAX_WAIT // 60} мин")
            time.sleep(3)
            pred = requests.get(pred["urls"]["get"], headers=self.headers, timeout=30).json()
        if pred["status"] != "succeeded":
            raise RuntimeError(pred.get("error") or pred["status"])

        output = pred["output"]
        url = output[0] if isinstance(output, list) else output
        dest.write_bytes(requests.get(url, timeout=120).content)
        return dest


def main():
    parser = argparse.ArgumentParser(description="Агент 3: колоризация и реставрация старых фото")
    parser.add_argument("-p", "--prompt", default=env("COLORIZE_PROMPT", DEFAULT_PROMPT),
                        help="как раскрашивать (лучше на английском)")
    parser.add_argument("--input", help="локальная папка с фото (вместо Google Drive)")
    parser.add_argument("--no-drive", action="store_true", help="не загружать результат на Google Drive")
    args = parser.parse_args()
    if args.input is None and args.no_drive:
        parser.error("без Google Drive укажи папку с фото: --input <папка>")

    replicate = Replicate()
    drive = None if args.no_drive else Drive()

    if args.input:
        jobs = [{"image": p} for p in sorted(Path(args.input).iterdir()) if p.suffix.lower() in IMAGE_EXT]
    else:
        src_folder = drive.folder(FOLDER_TO_COLOR)
        tmp = OUTPUT_DIR / FOLDER_TO_COLOR
        tmp.mkdir(parents=True, exist_ok=True)
        jobs = [{"image": drive.download(f["id"], tmp / f["name"]), "drive_id": f["id"]}
                for f in drive.list_images(src_folder)]

    if not jobs:
        print(f"Нет фото для колоризации в {args.input or 'Google Drive → ' + FOLDER_TO_COLOR}")
        return

    out_dir = OUTPUT_DIR / FOLDER_TO_ANIMATE
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Раскрашиваю {len(jobs)} фото ({replicate.model})")
    for job in jobs:
        try:
            job["color"] = replicate.colorize(job["image"], args.prompt, out_dir / f"{job['image'].stem}_color.jpg")
            print(f"  ✓ {job['color'].name}")
        except Exception as e:
            print(f"  ✗ {job['image'].name}: {e}")

    done = [j for j in jobs if "color" in j]
    if drive and done:
        to_animate = drive.folder(FOLDER_TO_ANIMATE)
        day = drive.folder(datetime.now().strftime("%Y-%m-%d"), drive.folder(FOLDER_EDIT))
        originals = drive.folder(ORIGINALS, day)
        for job in done:
            drive.upload(job["color"], to_animate)
            if "drive_id" in job:
                drive.move(job["drive_id"], originals, src_folder)
        print(f"→ цветные: {FOLDER_TO_ANIMATE}, ч/б оригиналы: {FOLDER_EDIT}/{datetime.now():%Y-%m-%d}/{ORIGINALS}")
    print(f"Итого: {len(done)} из {len(jobs)} раскрашено. Проверь цвета и запускай агента 2: "
          "python agent2_animate.py --style history_color")


if __name__ == "__main__":
    main()
