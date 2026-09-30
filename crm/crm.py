#!/usr/bin/env python3
"""Мини-CRM брокера: база контактов из телефонной книги, категории (теги)
и адресные рассылки предложений по недвижимости в Telegram, SMS и WhatsApp
с вашего личного номера. Вся история отправок хранится в базе.

Быстрый старт — см. README.md рядом. Коротко:
    python crm.py import contacts.vcf        # контакты из телефона
    python crm.py export contacts.csv        # разметить категории в Excel
    python crm.py import contacts.csv        # загрузить разметку обратно
    python crm.py send --name "Долина" --template templates/example_offer.txt \
        --tags инвестор --channels tg,wa,sms            # пробный прогон
    ... тот же вызов с --send                           # реальная отправка
"""

import argparse
import configparser
import csv
import datetime as dt
import html
import io
import quopri
import random
import re
import sqlite3
import sys
import time
import urllib.parse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "crm.db"
CONFIG_PATH = BASE_DIR / "config.ini"
CHANNELS = ("tg", "sms", "wa")

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL DEFAULT '',
    phone      TEXT UNIQUE,
    telegram   TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL DEFAULT '',
    consent    INTEGER NOT NULL DEFAULT 0,
    stopped    INTEGER NOT NULL DEFAULT 0,
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
    id         INTEGER PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    template   TEXT NOT NULL,
    photo      TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL DEFAULT '',
    channels   TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    contact_id  INTEGER NOT NULL REFERENCES contacts(id),
    channel     TEXT NOT NULL,
    status      TEXT NOT NULL,
    error       TEXT NOT NULL DEFAULT '',
    text        TEXT NOT NULL DEFAULT '',
    sent_at     TEXT NOT NULL,
    UNIQUE (campaign_id, contact_id, channel)
);
"""

# Статусы, при которых человек считается охваченным кампанией.
DELIVERED = ("sent", "queued", "link")


def now():
    return dt.datetime.now().isoformat(timespec="seconds")


def connect(path=None):
    path = Path(path or DB_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    return db


def load_config():
    cfg = configparser.ConfigParser()
    if CONFIG_PATH.exists():
        cfg.read(CONFIG_PATH, encoding="utf-8")
    return cfg


# ---------------------------------------------------------------- телефоны, теги

def normalize_phone(raw):
    """Приводит номер к виду +7XXXXXXXXXX. Возвращает None, если это не номер."""
    if not raw:
        return None
    raw = raw.strip()
    digits = re.sub(r"\D", "", raw)
    if raw.startswith("+"):
        return "+" + digits if len(digits) >= 10 else None
    if len(digits) == 11 and digits[0] in "78":
        return "+7" + digits[1:]
    if len(digits) == 10 and digits[0] == "9":
        return "+7" + digits
    if len(digits) > 11:
        return "+" + digits
    return None


def split_tags(value):
    return [t.strip().lower() for t in re.split(r"[;,]", value or "") if t.strip()]


def join_tags(tags):
    seen = []
    for t in tags:
        if t and t not in seen:
            seen.append(t)
    return ",".join(seen)


def normalize_telegram(value):
    value = (value or "").strip()
    value = re.sub(r"^(https?://)?t\.me/", "", value)
    return value.lstrip("@")


# ---------------------------------------------------------------- импорт

def parse_vcf(text):
    """Разбирает .vcf (экспорт контактов iPhone / Android / Google)."""
    # Склеиваем перенесённые строки (RFC 6350) и мягкие переносы quoted-printable.
    text = text.replace("\r\n", "\n")
    text = re.sub(r"\n[ \t]", "", text)
    text = re.sub(r"=\n", "", text)

    contacts, cur = [], None
    for line in text.split("\n"):
        if not line.strip():
            continue
        upper = line.upper()
        if upper.startswith("BEGIN:VCARD"):
            cur = {"name": "", "n": "", "phones": [], "tags": [], "notes": ""}
            continue
        if upper.startswith("END:VCARD"):
            if cur is not None:
                cur["name"] = cur["name"] or cur["n"]
                contacts.append(cur)
            cur = None
            continue
        if cur is None or ":" not in line:
            continue
        head, value = line.split(":", 1)
        parts = head.split(";")
        key = parts[0].split(".")[-1].upper()  # "item1.TEL" -> "TEL"
        params = [p.upper() for p in parts[1:]]
        if any("QUOTED-PRINTABLE" in p for p in params):
            charset = next((p.split("=", 1)[1] for p in params
                            if p.startswith("CHARSET=")), "UTF-8")
            value = quopri.decodestring(value.encode("ascii", "ignore")) \
                .decode(charset, "replace")
        value = value.replace("\\,", ",").replace("\\;", ";").replace("\\n", " ")

        if key == "FN":
            cur["name"] = value.strip()
        elif key == "N":
            last, first = (value.split(";") + ["", ""])[:2]
            cur["n"] = " ".join(x for x in (first, last) if x).strip()
        elif key == "TEL":
            cur["phones"].append(value)
        elif key == "CATEGORIES":
            cur["tags"] += split_tags(value)
        elif key == "NOTE":
            cur["notes"] = value.strip()
    return contacts


def read_csv_text(path):
    raw = Path(path).read_bytes()
    for enc in ("utf-8-sig", "cp1251"):  # Excel в Windows сохраняет в cp1251
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def parse_csv(path):
    """Наш формат (после export) или экспорт Google Контактов."""
    text = read_csv_text(path)
    first_line = text.split("\n", 1)[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","
    rows = list(csv.DictReader(io.StringIO(text), delimiter=delimiter))
    result = []
    for r in rows:
        r = {(k or "").strip(): (v or "").strip() for k, v in r.items()}
        if "phone" in r:  # наш формат
            result.append({
                "id": r.get("id", ""),
                "name": r.get("name", ""),
                "phones": [r.get("phone", "")],
                "telegram": r.get("telegram", ""),
                "tags": split_tags(r.get("tags", "")),
                "consent": r.get("consent", ""),
                "stopped": r.get("stopped", ""),
                "notes": r.get("notes", ""),
                "replace_tags": True,
            })
        else:  # Google Контакты
            name = r.get("Name") or " ".join(
                x for x in (r.get("First Name", ""), r.get("Last Name", "")) if x)
            phones = []
            for k, v in r.items():
                if k.startswith("Phone") and k.endswith("Value") and v:
                    phones += [p.strip() for p in v.split(":::")]
            labels = [t for t in split_tags(r.get("Labels", "").replace(":::", ","))
                      if t not in ("* mycontacts", "* starred")]
            result.append({"name": name, "phones": phones, "tags": labels,
                           "notes": r.get("Notes", "")})
    return result


def upsert_contact(db, item, extra_tags=()):
    """Добавляет контакт или обновляет существующий. Возвращает 'new'/'upd'/'skip'."""
    phones = [p for p in (normalize_phone(x) for x in item.get("phones", [])) if p]
    phone = phones[0] if phones else None
    row = None
    if item.get("id"):
        row = db.execute("SELECT * FROM contacts WHERE id=?", (item["id"],)).fetchone()
    if row is None and phone:
        row = db.execute("SELECT * FROM contacts WHERE phone=?", (phone,)).fetchone()
    if row is None and not phone:
        return "skip"

    notes = item.get("notes", "")
    if len(phones) > 1:
        extra = "доп. номера: " + ", ".join(phones[1:])
        notes = f"{notes}; {extra}" if notes else extra

    if row is None:
        db.execute(
            "INSERT INTO contacts (name, phone, telegram, tags, consent, stopped,"
            " notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (item.get("name", ""), phone, normalize_telegram(item.get("telegram")),
             join_tags(list(item.get("tags", [])) + list(extra_tags)),
             int(item.get("consent") or 0), int(item.get("stopped") or 0),
             notes, now(), now()))
        return "new"

    if item.get("replace_tags"):  # файл из export — это «истина» для тегов
        tags = list(item.get("tags", []))
    else:
        tags = split_tags(row["tags"]) + list(item.get("tags", []))
    tags += list(extra_tags)

    def pick(field, value):
        return row[field] if value in (None, "") else value

    db.execute(
        "UPDATE contacts SET name=?, phone=?, telegram=?, tags=?, consent=?,"
        " stopped=?, notes=?, updated_at=? WHERE id=?",
        (pick("name", item.get("name")), phone or row["phone"],
         pick("telegram", normalize_telegram(item.get("telegram"))),
         join_tags(tags),
         int(pick("consent", item.get("consent"))),
         int(pick("stopped", item.get("stopped"))),
         pick("notes", notes), now(), row["id"]))
    return "upd"


# ---------------------------------------------------------------- выборка, шаблоны

def find_contact(db, key):
    if str(key).isdigit() and len(str(key)) < 7:
        row = db.execute("SELECT * FROM contacts WHERE id=?", (int(key),)).fetchone()
    else:
        row = db.execute("SELECT * FROM contacts WHERE phone=?",
                         (normalize_phone(key),)).fetchone()
    if row is None:
        sys.exit(f"Контакт «{key}» не найден")
    return row


def select_contacts(db, tags=(), exclude=(), search=""):
    rows = db.execute("SELECT * FROM contacts ORDER BY name").fetchall()
    out = []
    for r in rows:
        ctags = set(split_tags(r["tags"]))
        if tags and not ctags & set(tags):
            continue
        if exclude and ctags & set(exclude):
            continue
        if search and search.lower() not in (
                f"{r['name']} {r['phone']} {r['notes']} {r['telegram']}".lower()):
            continue
        out.append(r)
    return out


class SafeDict(dict):
    def __missing__(self, key):
        return ""


def greeting(moment=None):
    h = (moment or dt.datetime.now()).hour
    if 5 <= h < 12:
        return "Доброе утро"
    if 12 <= h < 18:
        return "Добрый день"
    return "Добрый вечер"


def render(template, contact):
    name = (contact["name"] or "").strip()
    first = name.split()[0] if name else ""
    return template.format_map(SafeDict(
        name=name, first_name=first, hello=greeting(),
        phone=contact["phone"] or "", notes=contact["notes"] or "",
    )).replace(", !", "!").strip()


# ---------------------------------------------------------------- каналы

class StopChannel(Exception):
    """Канал нужно остановить на этот запуск (лимит, бан, нет настроек)."""


class TelegramSender:
    """Отправка от вашего личного аккаунта Telegram (Telethon)."""

    def __init__(self, cfg):
        try:
            from telethon.sync import TelegramClient
        except ImportError:
            raise StopChannel("не установлен telethon: pip install -r requirements.txt")
        if not cfg.has_section("telegram"):
            raise StopChannel("нет секции [telegram] в config.ini")
        t = cfg["telegram"]
        self.client = TelegramClient(str(DATA_DIR / "telegram"),
                                     int(t["api_id"]), t["api_hash"])
        # При первом запуске Telegram пришлёт код входа — введите его в консоли.
        self.client.start(phone=t.get("phone"))

    def _resolve(self, contact):
        from telethon.tl.functions.contacts import ImportContactsRequest
        from telethon.tl.types import InputPhoneContact
        if contact["telegram"]:
            return self.client.get_entity(contact["telegram"])
        res = self.client(ImportContactsRequest([InputPhoneContact(
            client_id=random.randrange(1 << 62), phone=contact["phone"],
            first_name=contact["name"] or contact["phone"], last_name="")]))
        return res.users[0] if res.users else None

    def send(self, contact, text, photo=""):
        from telethon import errors
        try:
            user = self._resolve(contact)
            if user is None:
                return "no_account", "номер не зарегистрирован в Telegram"
            if photo and len(text) <= 1024:
                self.client.send_file(user, photo, caption=text)
            else:
                if photo:
                    self.client.send_file(user, photo)
                self.client.send_message(user, text)
            return "sent", ""
        except errors.FloodWaitError as e:
            raise StopChannel(f"Telegram просит подождать {e.seconds} с — остановлено")
        except errors.PeerFloodError:
            raise StopChannel("Telegram ограничил аккаунт за рассылку (PeerFlood) — "
                              "остановлено, сделайте паузу на сутки")
        except (ValueError, errors.RPCError) as e:
            return "error", str(e)

    def stopped_senders(self, days=30):
        """Номера/юзернеймы тех, кто ответил «стоп» за последние дни."""
        since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
        found = []
        for d in self.client.iter_dialogs():
            if not d.is_user or d.date < since:
                continue
            for m in self.client.iter_messages(d.entity, limit=20):
                if m.date < since:
                    break
                if not m.out and re.search(r"\b(стоп|stop|отпишите)\b",
                                           m.raw_text or "", re.I):
                    found.append((getattr(d.entity, "phone", None),
                                  getattr(d.entity, "username", None)))
                    break
        return found


class SmsSender:
    """SMS с вашей SIM-карты через приложение «SMS Gateway for Android»."""

    def __init__(self, cfg):
        import requests
        if not cfg.has_section("sms"):
            raise StopChannel("нет секции [sms] в config.ini")
        s = cfg["sms"]
        self.url = s["url"].rstrip("/") + "/message"
        self.auth = (s["username"], s["password"])
        self.requests = requests

    def send(self, contact, text, photo=""):
        if photo:
            text = f"{text}\n{photo}"
        try:
            r = self.requests.post(self.url, auth=self.auth, timeout=30, json={
                "message": text, "phoneNumbers": [contact["phone"]]})
        except self.requests.RequestException as e:
            raise StopChannel(f"телефон-шлюз недоступен: {e}")
        if r.status_code in (401, 403):
            raise StopChannel("шлюз SMS: неверный логин/пароль")
        if r.status_code >= 400:
            return "error", f"HTTP {r.status_code}: {r.text[:200]}"
        return "queued", ""


class WhatsAppLinks:
    """WhatsApp: личный номер нельзя безопасно автоматизировать (бан за ботов),
    поэтому готовим страницу со ссылками wa.me — текст уже вставлен,
    остаётся нажать «Отправить» в WhatsApp у каждого контакта."""

    def __init__(self, campaign_name):
        stamp = dt.datetime.now().strftime("%Y%m%d_%H%M")
        safe = re.sub(r"[^\w-]+", "_", campaign_name)
        self.path = DATA_DIR / f"wa_links_{safe}_{stamp}.html"
        self.title = campaign_name
        self.items = []

    def send(self, contact, text, photo=""):
        if photo:
            text = f"{text}\n{photo}"
        digits = re.sub(r"\D", "", contact["phone"])
        url = f"https://wa.me/{digits}?text={urllib.parse.quote(text)}"
        self.items.append((contact["name"] or contact["phone"], contact["phone"], url))
        return "link", ""

    def close(self):
        if not self.items:
            return None
        rows = "\n".join(
            f'<li><label><input type="checkbox"> <a href="{html.escape(u)}" '
            f'target="_blank">{html.escape(n)}</a> <small>{html.escape(p)}</small>'
            f"</label></li>" for n, p, u in self.items)
        self.path.write_text(
            "<!doctype html><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width'>"
            f"<title>WhatsApp: {html.escape(self.title)}</title>"
            "<style>body{font:18px sans-serif;margin:16px}li{margin:14px 0}</style>"
            f"<h2>{html.escape(self.title)} — {len(self.items)} чел.</h2>"
            "<p>Откройте на телефоне, нажимайте имя → «Отправить» в WhatsApp, "
            "отмечайте галочкой.</p>"
            f"<ol>{rows}</ol>", encoding="utf-8")
        return self.path


# ---------------------------------------------------------------- команды

def cmd_import(db, a):
    path = Path(a.file)
    if not path.exists():
        sys.exit(f"Файл не найден: {path}")
    if path.suffix.lower() == ".vcf":
        items = parse_vcf(path.read_text(encoding="utf-8", errors="replace"))
    elif path.suffix.lower() == ".csv":
        items = parse_csv(path)
    else:
        sys.exit("Поддерживаются .vcf (из телефона) и .csv")
    stats = {"new": 0, "upd": 0, "skip": 0}
    for item in items:
        stats[upsert_contact(db, item, split_tags(a.tag))] += 1
    db.commit()
    print(f"Новых: {stats['new']}, обновлено: {stats['upd']}, "
          f"без номера (пропущено): {stats['skip']}")


def cmd_export(db, a):
    rows = select_contacts(db, split_tags(a.tag))
    with open(a.file, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id", "name", "phone", "telegram", "tags", "consent",
                    "stopped", "notes"])
        for r in rows:
            w.writerow([r["id"], r["name"], r["phone"], r["telegram"], r["tags"],
                        r["consent"], r["stopped"], r["notes"]])
    print(f"Выгружено {len(rows)} контактов в {a.file}. Откройте в Excel, "
          "заполните tags (через запятую), consent=1 у согласившихся, "
          "сохраните и загрузите: python crm.py import " + a.file)


def cmd_list(db, a):
    rows = select_contacts(db, split_tags(a.tag), search=a.search or "")
    for r in rows:
        flags = ("" if r["consent"] else " [нет согласия]") + \
                (" [СТОП]" if r["stopped"] else "")
        tg = f" @{r['telegram']}" if r["telegram"] else ""
        print(f"{r['id']:>5}  {r['phone']:<14} {r['name'][:30]:<30} "
              f"{r['tags']}{tg}{flags}")
    print(f"Итого: {len(rows)}")


def cmd_tags(db, a):
    counts = {}
    for r in db.execute("SELECT tags FROM contacts"):
        for t in split_tags(r["tags"]):
            counts[t] = counts.get(t, 0) + 1
    for t, c in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"{c:>6}  {t}")


def cmd_set(db, a):
    r = find_contact(db, a.contact)
    tags = [t for t in split_tags(r["tags"]) if t not in split_tags(a.remove_tags)]
    tags += split_tags(a.add_tags)
    notes = r["notes"]
    if a.note:
        notes = f"{notes}\n{dt.date.today()}: {a.note}".strip()
    db.execute(
        "UPDATE contacts SET tags=?, telegram=?, consent=?, stopped=?, notes=?,"
        " updated_at=? WHERE id=?",
        (join_tags(tags),
         r["telegram"] if a.telegram is None else normalize_telegram(a.telegram),
         r["consent"] if a.consent is None else a.consent,
         r["stopped"] if a.stop is None else a.stop,
         notes, now(), r["id"]))
    db.commit()
    cmd_history(db, argparse.Namespace(contact=a.contact))


def cmd_history(db, a):
    r = find_contact(db, a.contact)
    print(f"{r['name']}  {r['phone']}  теги: {r['tags'] or '—'}  "
          f"согласие: {'да' if r['consent'] else 'нет'}"
          f"{'  [СТОП]' if r['stopped'] else ''}")
    if r["notes"]:
        print(f"Заметки: {r['notes']}")
    for m in db.execute(
            "SELECT m.*, c.name AS campaign FROM messages m JOIN campaigns c"
            " ON c.id=m.campaign_id WHERE contact_id=? ORDER BY sent_at", (r["id"],)):
        print(f"  {m['sent_at']}  {m['channel']:<3} {m['status']:<10} "
              f"{m['campaign']} {m['error']}")


def cmd_campaigns(db, a):
    for c in db.execute("SELECT * FROM campaigns ORDER BY id"):
        stats = dict(db.execute(
            "SELECT status, COUNT(*) FROM messages WHERE campaign_id=?"
            " GROUP BY status", (c["id"],)).fetchall())
        print(f"{c['id']:>3}  {c['created_at'][:16]}  {c['name']:<30} "
              f"теги: {c['tags'] or 'все'}  {stats}")


def cmd_report(db, a):
    c = db.execute("SELECT * FROM campaigns WHERE name=? OR id=?",
                   (a.campaign, a.campaign)).fetchone()
    if c is None:
        sys.exit("Кампания не найдена")
    rows = db.execute(
        "SELECT m.*, k.name, k.phone FROM messages m JOIN contacts k"
        " ON k.id=m.contact_id WHERE campaign_id=? ORDER BY m.sent_at", (c["id"],))
    lines = [[m["name"], m["phone"], m["channel"], m["status"], m["error"],
              m["sent_at"]] for m in rows]
    if not a.file:
        for line in lines:
            print("  ".join(str(x) for x in line))
        return
    with open(a.file, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["name", "phone", "channel", "status", "error", "sent_at"])
        w.writerows(lines)
    print(f"Сохранено: {a.file}")


def cmd_sync_stop(db, a):
    cfg = load_config()
    try:
        tg = TelegramSender(cfg)
    except StopChannel as e:
        sys.exit(f"Telegram: {e}")
    n = 0
    for phone, username in tg.stopped_senders(a.days):
        cur = db.execute(
            "UPDATE contacts SET stopped=1, updated_at=? WHERE stopped=0 AND"
            " (phone=? OR (telegram<>'' AND lower(telegram)=lower(?)))",
            (now(), normalize_phone(phone and "+" + phone), username or ""))
        n += cur.rowcount
    db.commit()
    print(f"Отмечено «СТОП»: {n}")


def cmd_send(db, a):
    template = Path(a.template).read_text(encoding="utf-8")
    channels = [c.strip() for c in a.channels.split(",") if c.strip()]
    bad = [c for c in channels if c not in CHANNELS]
    if bad:
        sys.exit(f"Неизвестный канал: {bad}. Доступны: {', '.join(CHANNELS)}")
    tags, exclude = split_tags(a.tags), split_tags(a.exclude_tags)

    everyone = select_contacts(db, tags, exclude)
    stopped = [r for r in everyone if r["stopped"]]
    no_consent = [r for r in everyone if not r["stopped"] and not r["consent"]]
    targets = [r for r in everyone if not r["stopped"] and r["consent"]]

    campaign = db.execute("SELECT * FROM campaigns WHERE name=?", (a.name,)).fetchone()
    if campaign:
        done = {row[0] for row in db.execute(
            "SELECT contact_id FROM messages WHERE campaign_id=? AND status IN"
            f" ({','.join('?' * len(DELIVERED))})", (campaign["id"], *DELIVERED))}
        targets = [r for r in targets if r["id"] not in done]

    print(f"Кампания «{a.name}»: подходит по тегам {len(everyone)}, "
          f"отписались {len(stopped)}, без согласия {len(no_consent)} (пропущены), "
          f"к отправке {len(targets)}. Каналы по порядку: {' → '.join(channels)}")
    if targets:
        print("\n--- пример сообщения для", targets[0]["name"] or targets[0]["phone"])
        print(render(template, targets[0]))
        print("---")

    if not a.send:
        for r in targets[: a.limit or len(targets)]:
            print(f"  {r['phone']:<14} {r['name']}")
        print("\nЭто пробный прогон, ничего не отправлено. "
              "Для отправки добавьте --send")
        return

    if campaign is None:
        db.execute(
            "INSERT INTO campaigns (name, template, photo, tags, channels, created_at)"
            " VALUES (?,?,?,?,?,?)",
            (a.name, template, a.photo or "", join_tags(tags), ",".join(channels), now()))
        db.commit()
        campaign = db.execute("SELECT * FROM campaigns WHERE name=?",
                              (a.name,)).fetchone()

    cfg = load_config()
    lim = cfg["limits"] if cfg.has_section("limits") else {}
    min_d, max_d = float(lim.get("min_delay", 20)), float(lim.get("max_delay", 60))
    per_run = a.limit or int(lim.get("per_run", 40))

    senders, dead, sent_count = {}, {}, {c: 0 for c in channels}

    def get_sender(ch):
        if ch in dead:
            return None
        if ch not in senders:
            try:
                senders[ch] = {"tg": lambda: TelegramSender(cfg),
                               "sms": lambda: SmsSender(cfg),
                               "wa": lambda: WhatsAppLinks(a.name)}[ch]()
            except StopChannel as e:
                dead[ch] = str(e)
                print(f"[{ch}] отключён: {e}")
                return None
        return senders[ch]

    def log(contact, ch, status, err, text):
        db.execute(
            "INSERT INTO messages (campaign_id, contact_id, channel, status, error,"
            " text, sent_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(campaign_id,"
            " contact_id, channel) DO UPDATE SET status=excluded.status,"
            " error=excluded.error, text=excluded.text, sent_at=excluded.sent_at",
            (campaign["id"], contact["id"], ch, status, err, text, now()))
        db.commit()

    try:
        for r in targets:
            text = render(template, r)
            for ch in channels:
                if ch in dead or sent_count[ch] >= per_run:
                    continue
                sender = get_sender(ch)
                if sender is None:
                    continue
                try:
                    status, err = sender.send(r, text, a.photo or "")
                except StopChannel as e:
                    dead[ch] = str(e)
                    print(f"[{ch}] остановлен: {e}")
                    continue
                log(r, ch, status, err, text)
                print(f"[{ch}] {r['phone']:<14} {r['name'][:30]:<30} {status} {err}")
                if status in DELIVERED:
                    sent_count[ch] += 1
                    if ch != "wa":
                        time.sleep(random.uniform(min_d, max_d))
                    break  # один человек — одно сообщение (первый сработавший канал)
            if all(ch in dead or sent_count[ch] >= per_run for ch in channels):
                print("Лимиты на этот запуск исчерпаны — запустите позже, "
                      "уже отправленным повторно не придёт.")
                break
    except KeyboardInterrupt:
        print("\nПрервано. Отправленное сохранено в базе.")
    finally:
        wa = senders.get("wa")
        page = wa.close() if wa else None
        if page:
            print(f"\nWhatsApp: откройте {page} и отправьте по ссылкам.")
        tg = senders.get("tg")
        if tg:
            tg.client.disconnect()
    print("Итог по каналам:", sent_count)


def build_parser():
    p = argparse.ArgumentParser(description="CRM брокера: контакты и рассылки")
    p.add_argument("--db", help="путь к базе (по умолчанию data/crm.db)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("import", help="загрузить контакты из .vcf или .csv")
    s.add_argument("file")
    s.add_argument("--tag", default="", help="добавить всем этот тег(и)")
    s.set_defaults(func=cmd_import)

    s = sub.add_parser("export", help="выгрузить контакты в .csv для Excel")
    s.add_argument("file")
    s.add_argument("--tag", default="")
    s.set_defaults(func=cmd_export)

    s = sub.add_parser("list", help="показать контакты")
    s.add_argument("--tag", default="")
    s.add_argument("--search", default="")
    s.set_defaults(func=cmd_list)

    sub.add_parser("tags", help="категории и число людей в них") \
        .set_defaults(func=cmd_tags)

    s = sub.add_parser("set", help="изменить контакт (по номеру или id)")
    s.add_argument("contact")
    s.add_argument("--add-tags", default="")
    s.add_argument("--remove-tags", default="")
    s.add_argument("--telegram")
    s.add_argument("--consent", type=int, choices=(0, 1))
    s.add_argument("--stop", type=int, choices=(0, 1))
    s.add_argument("--note", help="добавить заметку с датой")
    s.set_defaults(func=cmd_set)

    s = sub.add_parser("history", help="карточка и история по контакту")
    s.add_argument("contact")
    s.set_defaults(func=cmd_history)

    s = sub.add_parser("send", help="рассылка (по умолчанию — пробный прогон)")
    s.add_argument("--name", required=True, help="название кампании")
    s.add_argument("--template", required=True, help="файл с текстом")
    s.add_argument("--tags", default="", help="кому: теги через запятую (любой)")
    s.add_argument("--exclude-tags", default="")
    s.add_argument("--channels", default="tg,wa",
                   help="порядок каналов, напр. tg,sms,wa")
    s.add_argument("--photo", default="", help="ссылка на фото объекта")
    s.add_argument("--limit", type=int, default=0,
                   help="максимум сообщений на канал за запуск")
    s.add_argument("--send", action="store_true", help="реально отправить")
    s.set_defaults(func=cmd_send)

    sub.add_parser("campaigns", help="список рассылок и статистика") \
        .set_defaults(func=cmd_campaigns)

    s = sub.add_parser("report", help="кому и как ушла кампания")
    s.add_argument("campaign")
    s.add_argument("--file", help="сохранить в .csv")
    s.set_defaults(func=cmd_report)

    s = sub.add_parser("sync-stop", help="отметить ответивших «СТОП» в Telegram")
    s.add_argument("--days", type=int, default=30)
    s.set_defaults(func=cmd_sync_stop)
    return p


def main(argv=None):
    a = build_parser().parse_args(argv)
    db = connect(a.db)
    try:
        a.func(db, a)
    finally:
        db.close()


if __name__ == "__main__":
    main()
