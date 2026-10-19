"""Проверка доступов: запусти после настройки .env, увидишь, что работает, а что нет.

    python check_setup.py

Проверки бесплатные: ничего не генерируется и деньги не списываются.
"""
import sys

import requests

from common import AGENTS_DIR, env

USER_AGENT = "broker-nata-content-agent/1.0 (https://github.com/kopacheva3103-bot/broker_nata_media)"
results = []


def check(name, needed_for, fn):
    try:
        note = fn()
        results.append((True, name, note or "работает"))
    except requests.ConnectionError:
        results.append((False, name, "сайт не открывается: проверь интернет; если сайт недоступен "
                                     f"из России — нужен VPN  →  нужно для: {needed_for}"))
    except Exception as e:
        results.append((False, name, f"{e}  →  нужно для: {needed_for}"))


def need(key):
    value = env(key)
    if not value:
        raise RuntimeError(f"не заполнен {key} в agents/.env")
    return value


KLING_BASES = [
    "https://api-singapore.klingai.com",
    "https://api.klingai.com",
    "https://api-global.klingai.com",
    "https://api-beijing.klingai.com",
]


def kling():
    import agent2_animate
    from set_keys import save
    if not env("KLING_API_KEY"):
        need("KLING_ACCESS_KEY"), need("KLING_SECRET_KEY")
    k = agent2_animate.Kling()
    bases = [k.base] + [b for b in KLING_BASES if b != k.base]
    answers = []
    for base in bases:
        try:
            r = requests.get(f"{base}/v1/videos/image2video", params={"pageNum": 1, "pageSize": 1},
                             headers=k._headers(), timeout=20)
        except requests.RequestException as e:
            answers.append(f"{base}: не открывается ({type(e).__name__})")
            continue
        try:
            body = r.json()
        except ValueError:
            body = {}
        if r.ok and body.get("code") == 0:
            if base != k.base:
                save("KLING_API_BASE", base)
                return f"ключ принят на {base} — адрес сохранён в .env"
            return f"ключ принят ({base}). Баланс API смотри в кабинете Kling"
        answers.append(f"{base}: HTTP {r.status_code}, code={body.get('code')}, "
                       f"{body.get('message') or r.text[:120]}")
    raise RuntimeError("Kling не принял ключ ни на одном адресе. Ответы:\n      " + "\n      ".join(answers))


def replicate():
    r = requests.get("https://api.replicate.com/v1/account",
                     headers={"Authorization": f"Bearer {need('REPLICATE_API_TOKEN')}"}, timeout=30)
    if r.status_code == 401:
        raise RuntimeError("Replicate не принял токен")
    r.raise_for_status()
    return f"аккаунт {r.json().get('username')}. Привязку карты смотри в Billing"


def drive():
    if (env("STORAGE") or "api").lower() == "sync":
        from common import OUTPUT_DIR
        if not OUTPUT_DIR.is_dir():
            raise RuntimeError(f"папка {OUTPUT_DIR} не найдена — запусти ./run.sh drive")
        probe = OUTPUT_DIR / ".check"
        probe.write_text("ok")
        probe.unlink()
        return f"через приложение Google Drive, папка «{OUTPUT_DIR.name}»"
    from common import Drive
    if not env("DRIVE_ROOT_FOLDER_ID"):
        raise RuntimeError("не подключён — запусти ./run.sh drive (нужно приложение Google Drive на Mac)")
    d = Drive()
    folder = d.api.files().get(fileId=d.root, fields="name").execute()
    return f"папка «{folder['name']}» доступна"


def pexels():
    r = requests.get("https://api.pexels.com/v1/search", params={"query": "moscow", "per_page": 1},
                     headers={"Authorization": need("PEXELS_API_KEY")}, timeout=30)
    r.raise_for_status()


def unsplash():
    r = requests.get("https://api.unsplash.com/photos", params={"per_page": 1},
                     headers={"Authorization": f"Client-ID {need('UNSPLASH_ACCESS_KEY')}"}, timeout=30)
    r.raise_for_status()


def site(url):
    def fn():
        requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30).raise_for_status()
        return "сайт открывается, ключ не нужен"
    return fn


def main():
    if not (AGENTS_DIR / ".env").exists():
        sys.exit("Нет файла agents/.env — скопируй .env.example в .env и впиши ключи")

    print("Проверяю доступы...\n")
    check("Google Drive", "все агенты (папки для команды)", drive)
    check("Replicate", "генерация G-кадров, оживление (Kling) и колоризация", replicate)
    if (env("ANIMATE_PROVIDER", "replicate") or "replicate").lower() == "kling":
        check("Kling", "оживление кадров", kling)
    else:
        results.append((True, "Оживление кадров", "через Replicate (модель Kling) — отдельный ключ Kling не нужен"))
    check("Wikimedia Commons", "поиск архива", site("https://commons.wikimedia.org/w/api.php?action=query&format=json"))
    check("PastVu", "поиск архива Москвы", site("https://pastvu.com/api2?method=photo.giveForPage&params=%7B%22cid%22%3A1%7D"))
    check("OpenStreetMap", "координаты для PastVu",
          site("https://nominatim.openstreetmap.org/search?q=Moscow&format=json&limit=1"))
    optional = [("Pexels", "агент 1 со стоками (для Беговой не нужен)", pexels),
                ("Unsplash", "агент 1 со стоками (для Беговой не нужен)", unsplash)]
    for name, why, fn in optional:
        check(f"{name} (необязательно)", why, fn)

    for ok, name, note in results:
        print(f"{'✅' if ok else '❌'} {name}: {note}")
    required_failed = [n for ok, n, _ in results if not ok and "необязательно" not in n]
    print("\nВсё готово, можно запускать run_brief.py" if not required_failed
          else f"\nОсталось настроить: {', '.join(required_failed)}")


if __name__ == "__main__":
    main()
