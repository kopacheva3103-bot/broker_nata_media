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


def kling():
    import agent2_animate
    if not env("KLING_API_KEY"):
        need("KLING_ACCESS_KEY"), need("KLING_SECRET_KEY")
    k = agent2_animate.Kling()
    r = requests.get(f"{k.base}/v1/videos/image2video", params={"pageNum": 1, "pageSize": 1},
                     headers=k._headers(), timeout=30)
    if r.status_code == 401:
        raise RuntimeError("Kling не принял ключ: проверь, что скопировала его целиком")
    r.raise_for_status()
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"Kling: {body.get('message')}")
    return f"ключи приняты ({k.base}). Баланс API смотри в кабинете Kling"


def replicate():
    r = requests.get("https://api.replicate.com/v1/account",
                     headers={"Authorization": f"Bearer {need('REPLICATE_API_TOKEN')}"}, timeout=30)
    if r.status_code == 401:
        raise RuntimeError("Replicate не принял токен")
    r.raise_for_status()
    return f"аккаунт {r.json().get('username')}. Привязку карты смотри в Billing"


def drive():
    from common import Drive
    need("DRIVE_ROOT_FOLDER_ID")
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
    check("Replicate", "генерация G-кадров и колоризация", replicate)
    check("Kling", "оживление кадров", kling)
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
