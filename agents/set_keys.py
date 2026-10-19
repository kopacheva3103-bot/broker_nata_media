"""Ввод ключей без редактирования .env: Терминал спрашивает, ты вставляешь (⌘V) и жмёшь Enter.

    ./run.sh keys           — спросит все ключи по очереди (Enter — пропустить)
    ./run.sh keys kling     — только Kling
"""
import getpass
import sys
from pathlib import Path

ENV = Path(__file__).resolve().parent / ".env"
GROUPS = {
    "kling": [("KLING_API_KEY", "ключ Kling (API Key)")],
    "replicate": [("REPLICATE_API_TOKEN", "токен Replicate")],
    "drive": [("DRIVE_ROOT_FOLDER_ID", "ID папки Google Drive (из адреса папки после /folders/)")],
    "assets": [("YADISK_BEGOVAYA", "ссылку на папку «Беговая 5» на Яндекс.Диске"),
               ("YADISK_PERSONAL", "ссылку на папку «Личное — исходники» на Яндекс.Диске")],
}
SECRET = {"KLING_API_KEY", "REPLICATE_API_TOKEN"}  # ссылки на папки тоже приватные, но их удобнее видеть


def save(key, value):
    lines = ENV.read_text(encoding="utf-8").splitlines() if ENV.exists() else []
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = f"{key}={value}"
            break
    else:
        lines.append(f"{key}={value}")
    ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    groups = sys.argv[1:] or [g for g in GROUPS if g != "assets"]
    for group in groups:
        for key, label in GROUPS.get(group, []):
            if key in SECRET:
                print(f"\nВставь {label} (⌘V) и нажми Enter.")
                print("Символы не будут видны — так и задумано, это защита.")
                value = getpass.getpass("> ").strip()
            else:
                value = input(f"\nВставь {label} и нажми Enter:\n> ").strip()
            value = value.strip("'\" ")
            if not value:
                print("Пропущено.")
                continue
            save(key, value)
            print(f"✅ Сохранено ({len(value)} символов, начинается на «{value[:4]}…»)")
    print("\nТеперь проверь: ./run.sh check")


if __name__ == "__main__":
    main()
