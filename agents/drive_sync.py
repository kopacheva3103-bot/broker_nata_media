"""Подключение облачного диска через его приложение на Mac — без API и ключей.

    ./run.sh yandex     — Яндекс.Диск: «SDELKA77 Маркетинг / 02 Рилс» (структура маркетинговой системы)
    ./run.sh drive      — Google Drive: «Мой диск / Контент-агенты»

Агенты пишут файлы в папку приложения, приложение само синхронизирует их с облаком.
При переключении уже сделанные серии копируются на новое место (с новым именем из брифа).
"""
import os
import shutil
import sys
from pathlib import Path

import yaml

from set_keys import save

AGENTS_DIR = Path(__file__).resolve().parent
HOME = Path.home()


def find_google():
    cloud = HOME / "Library" / "CloudStorage"
    accounts = sorted(cloud.glob("GoogleDrive-*")) if cloud.exists() else []
    preferred = [a for a in accounts if "kopacheva3103" in a.name] or accounts
    for acc in preferred:
        for name in ("Мой диск", "My Drive"):
            if (acc / name).is_dir():
                return acc / name / "Контент-агенты", acc.name.replace("GoogleDrive-", "")
    if accounts:
        sys.exit("❌ Google Drive найден, но папки «Мой диск» ещё нет — подожди минуту и повтори.")
    sys.exit("❌ Не нашёл Google Drive. Установи «Google Drive для компьютера»: https://www.google.com/drive/download/")


def find_yandex():
    # Классическое приложение — ~/Yandex.Disk.localized, новые версии — ~/Library/CloudStorage/Yandex…
    candidates = [HOME / "Yandex.Disk.localized", HOME / "Yandex.Disk"]
    cloud = HOME / "Library" / "CloudStorage"
    if cloud.exists():
        candidates += sorted(cloud.glob("Yandex*"))
    for c in candidates:
        if c.is_dir():
            return c / "SDELKA77 Маркетинг" / "02 Рилс", c.name
    sys.exit("❌ Не нашёл Яндекс.Диск на этом Mac.\n"
             "   Установи приложение: https://disk.yandex.ru/download — войди в аккаунт с папкой\n"
             "   «SDELKA77 Маркетинг» и запусти ./run.sh yandex снова.")


def migrate(old_root, new_root):
    """Копирует уже сделанные серии на новое место, переименовывая по брифу (renamed_from)."""
    if not old_root or not old_root.is_dir() or old_root.resolve() == new_root.resolve():
        return
    for brief_path in sorted((AGENTS_DIR / "series").glob("*.yaml")):
        brief = yaml.safe_load(brief_path.read_text(encoding="utf-8"))
        for old_name in [brief.get("renamed_from"), brief["series"]]:
            src = old_root / old_name if old_name else None
            if src and src.is_dir():
                dst = new_root / brief["series"]
                print(f"→ Переношу «{old_name}» → «{dst.relative_to(new_root.parent.parent)}»…")
                shutil.copytree(src, dst, dirs_exist_ok=True)
                break


def main():
    from dotenv import load_dotenv
    load_dotenv(AGENTS_DIR / ".env")
    provider = sys.argv[1] if len(sys.argv) > 1 else "drive"
    root, account = find_yandex() if provider == "yandex" else find_google()
    root.mkdir(parents=True, exist_ok=True)
    if os.getenv("OUTPUT_DIR"):
        migrate(Path(os.path.expanduser(os.environ["OUTPUT_DIR"])), root)
    save("STORAGE", "sync")
    save("OUTPUT_DIR", str(root))
    name = "Яндекс.Диск" if provider == "yandex" else "Google Drive"
    print(f"✅ Агенты подключены к {name} ({account})")
    print(f"   Папка: {' → '.join(root.parts[-2:])}")
    print("\nТеперь проверь: ./run.sh check")


if __name__ == "__main__":
    main()
