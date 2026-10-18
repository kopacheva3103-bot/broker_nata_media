"""Общие настройки и работа с Google Drive для агентов."""
import mimetypes
import os
import re
from pathlib import Path

from dotenv import load_dotenv

AGENTS_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = AGENTS_DIR.parent / "output"
load_dotenv(AGENTS_DIR / ".env")

# Папки внутри корневой папки на Google Drive
FOLDER_FOUND = "1_найдено"        # сюда агент 1 кладёт найденные фото
FOLDER_TO_COLOR = "2_раскрасить"  # сюда ты переносишь ч/б фото для колоризации
FOLDER_TO_ANIMATE = "2_оживить"   # сюда ты переносишь отобранные фото
FOLDER_EDIT = "3_монтаж"          # сюда агент 2 кладёт видео для монтажёра

SCOPES = ["https://www.googleapis.com/auth/drive"]
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def env(name, default=None, required=False):
    value = os.getenv(name, default)
    if required and not value:
        raise SystemExit(f"Не задан {name} в agents/.env (см. agents/.env.example)")
    return value


def slugify(text, max_len=50):
    text = re.sub(r"[^\w\s-]", "", text.lower(), flags=re.UNICODE)
    return re.sub(r"[\s-]+", "_", text).strip("_")[:max_len] or "без_названия"


class Drive:
    """Минимальная обёртка над Google Drive API."""

    def __init__(self):
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build

        token_path = AGENTS_DIR / "token.json"
        creds = None
        if token_path.exists():
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                secrets = AGENTS_DIR / env("GOOGLE_CREDENTIALS_FILE", "credentials.json")
                if not secrets.exists():
                    raise SystemExit(f"Нет файла {secrets}. Как его получить — в agents/README.md")
                creds = InstalledAppFlow.from_client_secrets_file(str(secrets), SCOPES).run_local_server(port=0)
            token_path.write_text(creds.to_json())
        self.api = build("drive", "v3", credentials=creds)
        self.root = env("DRIVE_ROOT_FOLDER_ID", required=True)

    def folder(self, name, parent=None):
        """Находит папку по имени или создаёт её."""
        parent = parent or self.root
        safe = name.replace("'", "\\'")
        q = (f"name = '{safe}' and '{parent}' in parents and trashed = false "
             "and mimeType = 'application/vnd.google-apps.folder'")
        found = self.api.files().list(q=q, fields="files(id)").execute().get("files", [])
        if found:
            return found[0]["id"]
        meta = {"name": name, "parents": [parent], "mimeType": "application/vnd.google-apps.folder"}
        return self.api.files().create(body=meta, fields="id").execute()["id"]

    def upload(self, path, parent):
        from googleapiclient.http import MediaFileUpload

        mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        media = MediaFileUpload(str(path), mimetype=mime, resumable=True)
        meta = {"name": Path(path).name, "parents": [parent]}
        return self.api.files().create(body=meta, media_body=media, fields="id").execute()["id"]

    def list_images(self, parent):
        return self.list_files(parent, "image/")

    def list_files(self, parent, mime_prefix=None):
        q = f"'{parent}' in parents and trashed = false"
        if mime_prefix:
            q += f" and mimeType contains '{mime_prefix}'"
        return self.api.files().list(q=q, fields="files(id, name, mimeType)",
                                     pageSize=500).execute().get("files", [])

    def download(self, file_id, dest):
        from googleapiclient.http import MediaIoBaseDownload

        with open(dest, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, self.api.files().get_media(fileId=file_id))
            done = False
            while not done:
                _, done = downloader.next_chunk()
        return dest

    def move(self, file_id, new_parent, old_parent):
        self.api.files().update(fileId=file_id, addParents=new_parent,
                                removeParents=old_parent, fields="id").execute()
