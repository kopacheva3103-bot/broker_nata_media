"""Агент 2: оживляет фото через Kling (image-to-video).

Режим Google Drive (по умолчанию): берёт все фото из папки «2_оживить»,
делает из каждого видео и кладёт в «3_монтаж/<дата>» вместе с исходником.

Примеры:
    python agent2_animate.py
    python agent2_animate.py -p "медленный облёт камеры вокруг дома, закат"
    python agent2_animate.py --input ./мои_фото --no-drive
    python agent2_animate.py --style history      # старые фото Москвы
"""
import argparse
import base64
import time
from datetime import datetime
from pathlib import Path

import jwt
import requests

from common import FOLDER_EDIT, FOLDER_TO_ANIMATE, IMAGE_EXT, OUTPUT_DIR, Drive, env

POLL_EVERY = 15        # секунд между проверками статуса
MAX_WAIT = 20 * 60     # максимум ждём одно видео
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # лимит Kling на картинку

# Готовые стили: промт движения + что запрещаем модели
STYLES = {
    "estate": {
        "prompt": None,  # берётся из KLING_DEFAULT_PROMPT
        "negative": "люди, лица, текст, водяные знаки, искажения, размытие",
    },
    "history": {
        "prompt": ("Оживи старую архивную фотографию Москвы: прохожие медленно идут по улице, "
                   "едут конные экипажи и трамваи, лёгкий дым из труб, лёгкое движение облаков, "
                   "едва заметный плавный наезд камеры. Сохрани оригинальную чёрно-белую плёночную "
                   "фактуру, зерно и архитектуру зданий без изменений."),
        "negative": ("современные машины, современная одежда, цвет, деформация зданий, искажённые лица, "
                     "лишние конечности, текст, водяные знаки, резкие движения камеры"),
    },
    "history_color": {  # для фото после агента 3 (колоризации)
        "prompt": ("Оживи раскрашенную старую фотографию Москвы: прохожие медленно идут по улице, "
                   "едут конные экипажи и трамваи, лёгкий дым из труб, движение облаков, "
                   "едва заметный плавный наезд камеры. Сохрани исторические цвета, одежду эпохи "
                   "и архитектуру зданий без изменений."),
        "negative": ("современные машины, современная одежда, кислотные цвета, деформация зданий, "
                     "искажённые лица, лишние конечности, текст, водяные знаки, резкие движения камеры"),
    },
}


class Kling:
    def __init__(self):
        self.ak = env("KLING_ACCESS_KEY", required=True)
        self.sk = env("KLING_SECRET_KEY", required=True)
        self.base = env("KLING_API_BASE", "https://api-singapore.klingai.com").rstrip("/")

    def _headers(self):
        now = int(time.time())
        token = jwt.encode({"iss": self.ak, "exp": now + 1800, "nbf": now - 5}, self.sk,
                           algorithm="HS256", headers={"alg": "HS256", "typ": "JWT"})
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _check(self, r):
        r.raise_for_status()
        body = r.json()
        if body.get("code") != 0:
            raise RuntimeError(f"Kling ошибка {body.get('code')}: {body.get('message')}")
        return body["data"]

    def submit(self, image_path, prompt, negative, duration, mode, model):
        payload = {
            "model_name": model,
            "mode": mode,
            "duration": str(duration),
            "image": base64.b64encode(Path(image_path).read_bytes()).decode(),
            "prompt": prompt,
            "negative_prompt": negative,
        }
        r = requests.post(f"{self.base}/v1/videos/image2video", json=payload,
                          headers=self._headers(), timeout=60)
        return self._check(r)["task_id"]

    def status(self, task_id):
        r = requests.get(f"{self.base}/v1/videos/image2video/{task_id}",
                         headers=self._headers(), timeout=30)
        return self._check(r)


def animate(jobs, kling, prompt, negative, duration, mode, model):
    """jobs: список словарей с ключом 'image' (локальный путь). Добавляет 'video'."""
    for job in jobs:
        size = job["image"].stat().st_size
        if size > MAX_IMAGE_BYTES:
            job["error"] = f"файл больше 10 МБ ({size // 1024 // 1024} МБ), сожми его"
            continue
        try:
            job["task_id"] = kling.submit(job["image"], prompt, negative, duration, mode, model)
            print(f"  → отправлено в Kling: {job['image'].name}")
        except Exception as e:
            job["error"] = str(e)

    started = time.time()
    pending = [j for j in jobs if "task_id" in j]
    while pending and time.time() - started < MAX_WAIT:
        time.sleep(POLL_EVERY)
        for job in list(pending):
            try:
                data = kling.status(job["task_id"])
            except Exception as e:
                print(f"  ! не удалось проверить {job['image'].name}: {e}")
                continue
            state = data.get("task_status")
            if state == "succeed":
                url = data["task_result"]["videos"][0]["url"]
                video = OUTPUT_DIR / FOLDER_EDIT / f"{job['image'].stem}.mp4"
                video.parent.mkdir(parents=True, exist_ok=True)
                video.write_bytes(requests.get(url, timeout=120).content)
                job["video"] = video
                pending.remove(job)
                print(f"  ✓ готово: {video.name}")
            elif state == "failed":
                job["error"] = data.get("task_status_msg", "Kling не смог сделать видео")
                pending.remove(job)
    for job in pending:
        job["error"] = f"не дождались за {MAX_WAIT // 60} мин, task_id={job['task_id']}"

    for job in jobs:
        if "error" in job:
            print(f"  ✗ {job['image'].name}: {job['error']}")
    return jobs


def main():
    parser = argparse.ArgumentParser(description="Агент 2: оживление фото через Kling")
    parser.add_argument("--style", choices=list(STYLES), default="estate",
                        help="estate — недвижимость (без людей), history — старые ч/б фото с прохожими, "
                             "history_color — старые фото после колоризации")
    parser.add_argument("-p", "--prompt", help="как двигаться камере и сцене (иначе — из стиля / .env)")
    parser.add_argument("-d", "--duration", choices=["5", "10"], default=env("KLING_DURATION", "5"))
    parser.add_argument("-m", "--mode", choices=["std", "pro"], default=env("KLING_MODE", "std"))
    parser.add_argument("--model", default=env("KLING_MODEL", "kling-v2-1"))
    parser.add_argument("--input", help="локальная папка с фото (вместо Google Drive)")
    parser.add_argument("--no-drive", action="store_true", help="не загружать результат на Google Drive")
    args = parser.parse_args()

    style = STYLES[args.style]
    prompt = args.prompt or style["prompt"] or env("KLING_DEFAULT_PROMPT")
    if not prompt:
        parser.error("укажи промт движения (-p) или KLING_DEFAULT_PROMPT в .env")
    if args.input is None and args.no_drive:
        parser.error("без Google Drive укажи папку с фото: --input <папка>")

    kling = Kling()
    drive = None if args.no_drive else Drive()

    if args.input:
        jobs = [{"image": p} for p in sorted(Path(args.input).iterdir()) if p.suffix.lower() in IMAGE_EXT]
    else:
        src_folder = drive.folder(FOLDER_TO_ANIMATE)
        tmp = OUTPUT_DIR / FOLDER_TO_ANIMATE
        tmp.mkdir(parents=True, exist_ok=True)
        jobs = []
        for f in drive.list_images(src_folder):
            jobs.append({"image": drive.download(f["id"], tmp / f["name"]), "drive_id": f["id"]})

    if not jobs:
        where = args.input or f"Google Drive → {FOLDER_TO_ANIMATE}"
        print(f"Нет фото для оживления в {where}")
        return

    print(f"Оживляю {len(jobs)} фото (Kling {args.model}, {args.mode}, {args.duration} сек, стиль {args.style})")
    animate(jobs, kling, prompt, style["negative"], args.duration, args.mode, args.model)

    done = [j for j in jobs if "video" in j]
    if drive and done:
        target = drive.folder(datetime.now().strftime("%Y-%m-%d"), drive.folder(FOLDER_EDIT))
        for job in done:
            drive.upload(job["video"], target)
            if "drive_id" in job:
                # Исходник переезжает к видео — монтажёру всё в одной папке
                drive.move(job["drive_id"], target, src_folder)
        print(f"→ Google Drive: {FOLDER_EDIT}/{datetime.now():%Y-%m-%d}")
    print(f"Итого: {len(done)} из {len(jobs)} видео готово. Локально: {OUTPUT_DIR / FOLDER_EDIT}")


if __name__ == "__main__":
    main()
