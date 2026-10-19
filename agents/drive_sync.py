"""Подключение Google Drive через приложение «Google Drive для компьютера» — без Google Cloud.

    ./run.sh drive

Находит папку Google Drive на Mac, создаёт в ней «Контент-агенты» и переключает
агентов на неё. Приложение Google Drive само синхронизирует файлы с облаком.
"""
import sys
from pathlib import Path

from set_keys import save

ROOT_NAME = "Контент-агенты"
MY_DRIVE_NAMES = ("Мой диск", "My Drive")


def find_my_drive():
    cloud = Path.home() / "Library" / "CloudStorage"
    accounts = sorted(cloud.glob("GoogleDrive-*")) if cloud.exists() else []
    if not accounts:
        return None, []
    if len(accounts) > 1:
        # Несколько аккаунтов — предпочитаем рабочую почту Натальи, если подключена
        preferred = [a for a in accounts if "kopacheva3103" in a.name]
        accounts = preferred or accounts
    for name in MY_DRIVE_NAMES:
        if (accounts[0] / name).is_dir():
            return accounts[0] / name, accounts
    return None, accounts


def main():
    my_drive, accounts = find_my_drive()
    if not accounts:
        sys.exit("❌ Не нашёл Google Drive на этом Mac.\n"
                 "   Установи «Google Drive для компьютера»: https://www.google.com/drive/download/\n"
                 "   войди почтой kopacheva3103@gmail.com и запусти ./run.sh drive снова.")
    if my_drive is None:
        sys.exit(f"❌ Google Drive найден ({accounts[0].name}), но папки «Мой диск» в нём нет.\n"
                 "   Подожди минуту, пока приложение закончит первую синхронизацию, и повтори.")

    root = my_drive / ROOT_NAME
    root.mkdir(exist_ok=True)
    save("STORAGE", "sync")
    save("OUTPUT_DIR", str(root))
    print(f"✅ Агенты подключены к Google Drive ({accounts[0].name.replace('GoogleDrive-', '')})")
    print(f"   Папка: Мой диск → {ROOT_NAME}")
    print("   Открой к ней доступ монтажёру в Google Drive (Поделиться → почта монтажёра).")
    print("\nТеперь проверь: ./run.sh check")


if __name__ == "__main__":
    main()
