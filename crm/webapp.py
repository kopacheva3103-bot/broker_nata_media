"""Локальное приложение для базы: python3 crm.py app

Открывается в браузере на вашем компьютере (адрес 127.0.0.1 — только для вас,
из интернета недоступен). Список с фильтрами, карточка человека с историей,
отправка выбранным людям в выбранный мессенджер. Всё отправленное и все
заметки попадают в историю контакта.
"""

import json
import random
import re
import secrets
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import classify
import crm

PAGE = Path(__file__).resolve().parent / "webapp.html"
EDITABLE = ("name", "call_name", "gender", "sphere", "telegram", "consent",
            "stopped", "notes", "tags")


class App:
    def __init__(self, db):
        self.db = db
        self.token = secrets.token_urlsafe(16)
        self.cfg = crm.load_config()
        self._tg = None

    # -------------------------------------------------------- данные

    def contact_row(self, r):
        v = crm.contact_view(r)
        last = self.db.execute(
            "SELECT at FROM interactions WHERE contact_id=? AND kind NOT IN"
            " ('добавлен в базу','найден в списке') ORDER BY at DESC LIMIT 1",
            (r["id"],)).fetchone()
        v.update(tags=crm.split_tags(r["tags"]), gender_code=r["gender"],
                 phone_ok=crm.phone_ok(r["phone"]), last=last[0] if last else "")
        return v

    def contacts(self, q):
        # Внутри группы — «любой из», между группами — «и»:
        # «чат WLC» + «агент» = агенты из чата WLC.
        rows = crm.select_contacts(
            self.db, crm.split_tags(q.get("src", "")), search=q.get("q", ""),
            gender=q.get("gender", ""), region=q.get("region", ""))
        cats = set(crm.split_tags(q.get("cat", "")))
        sphere = q.get("sphere", "").lower()
        out = []
        for r in rows:
            if cats and not cats & (set(crm.split_tags(r["tags"])) |
                                    set(crm.split_tags(r["sphere"]))):
                continue
            if sphere and sphere not in (r["sphere"] or "").lower():
                continue
            if q.get("consent") == "1" and not r["consent"]:
                continue
            if q.get("overlap") == "1" and not crm.contact_view(r)["overlap"]:
                continue
            if q.get("nostop") == "1" and r["stopped"]:
                continue
            out.append(r)
        total = len(out)
        if q.get("ids_only") == "1":
            return {"total": total, "ids": [r["id"] for r in out]}
        offset, limit = int(q.get("offset", 0)), int(q.get("limit", 100))
        return {"total": total,
                "items": [self.contact_row(r) for r in out[offset:offset + limit]]}

    def facets(self):
        tags, spheres = {}, {}
        for r in self.db.execute("SELECT tags, sphere FROM contacts"):
            for t in crm.split_tags(r["tags"]):
                tags[t] = tags.get(t, 0) + 1
            for t in crm.split_tags(r["sphere"]):
                spheres[t] = spheres.get(t, 0) + 1
        order = sorted(tags.items(), key=lambda x: -x[1])
        return {
            "sources": [[t, crm.chat_title(t), n] for t, n in order if crm.is_source(t)],
            "categories": [[t, t, n] for t, n in order if not crm.is_source(t)],
            "spheres": sorted(spheres.items(), key=lambda x: -x[1])[:100],
            "total": self.db.execute("SELECT COUNT(*) FROM contacts").fetchone()[0],
            "telegram_auto": self.cfg.has_section("telegram"),
            "mac": __import__("sys").platform == "darwin",
        }

    def contact(self, cid):
        r = self.db.execute("SELECT * FROM contacts WHERE id=?", (cid,)).fetchone()
        if r is None:
            raise KeyError(cid)
        data = self.contact_row(r)
        data["timeline"] = crm.timeline(self.db, cid)
        return data

    def update(self, cid, body):
        r = self.db.execute("SELECT * FROM contacts WHERE id=?", (cid,)).fetchone()
        new = {k: body[k] for k in EDITABLE if k in body}
        if "tags" in new:
            new["tags"] = crm.join_tags(crm.split_tags(new["tags"]))
        if "gender" in new:
            new["gender"] = classify.parse_gender(new["gender"])
        if "telegram" in new:
            new["telegram"] = crm.normalize_telegram(new["telegram"])
        for k in ("consent", "stopped"):
            if k in new:
                new[k] = 1 if new[k] in (1, True, "1", "да") else 0
        changes = [k for k in new if str(new[k]) != str(r[k])]
        if changes:
            self.db.execute(
                f"UPDATE contacts SET {', '.join(k + '=?' for k in changes)},"
                " updated_at=? WHERE id=?",
                (*[new[k] for k in changes], crm.now(), cid))
            if "consent" in changes:
                crm.log_interaction(self.db, cid, "согласие",
                                    "дал(а) согласие" if new["consent"] else "согласие снято")
            if "stopped" in changes and new["stopped"]:
                crm.log_interaction(self.db, cid, "СТОП", "просит не писать")
            self.db.commit()
        return self.contact(cid)

    def log(self, cid, body):
        crm.log_interaction(
            self.db, cid, body.get("kind") or "заметка", body.get("text", ""),
            channel=body.get("channel", ""), direction=body.get("direction", ""),
            status=body.get("status", ""), at=body.get("at") or None)
        self.db.commit()
        return self.contact(cid)

    # -------------------------------------------------------- отправка

    def tg(self):
        if self._tg is None:
            self._tg = crm.TelegramSender(self.cfg)  # при первом входе код — в Терминале
        return self._tg

    def links(self, r, text, channel):
        digits = re.sub(r"\D", "", r["phone"] or "")
        if channel == "wa":
            return f"https://wa.me/{digits}?text={urllib.parse.quote(text)}"
        if channel == "tg":
            return f"https://t.me/{r['telegram']}" if r["telegram"] else f"https://t.me/+{digits}"
        if channel == "sms":
            return f"sms:+{digits}&body={urllib.parse.quote(text)}"
        return ""

    def send(self, body):
        """Отправка выбранным. Автоматически: Telegram (если настроен) и SMS
        через «Сообщения» на Mac. WhatsApp — всегда ссылкой: личный номер
        нельзя автоматизировать без риска блокировки."""
        ids = [int(i) for i in body["ids"]][:200]
        if body.get("dry"):  # проверка перед отправкой: согласие, СТОП
            rows = [self.db.execute("SELECT * FROM contacts WHERE id=?", (i,)).fetchone()
                    for i in ids]
            first = self.contact(ids[0]) if ids else None
            return {"total": len(ids), "first": first,
                    "no_consent": sum(1 for r in rows if not r["consent"]),
                    "stopped": sum(1 for r in rows if r["stopped"])}
        channel, template = body["channel"], body["text"]
        auto = body.get("auto", True)
        results = []
        sender, stop_reason = None, ""
        for n, cid in enumerate(ids):
            r = self.db.execute("SELECT * FROM contacts WHERE id=?", (cid,)).fetchone()
            item = {"id": cid, "name": r["name"] or r["phone"] or r["telegram"]}
            text = crm.render(template, r)
            item["text"] = text
            if r["stopped"]:
                results.append({**item, "status": "пропущен: просил не писать"})
                continue
            if channel in ("wa", "sms") and not crm.phone_ok(r["phone"]):
                results.append({**item, "status": "нет номера телефона"})
                continue
            if channel == "tg" and not (crm.phone_ok(r["phone"]) or r["telegram"]):
                results.append({**item, "status": "нет номера и ника"})
                continue
            use_auto = auto and not stop_reason and (
                (channel == "tg" and self.cfg.has_section("telegram")) or
                (channel == "sms" and __import__("sys").platform == "darwin"))
            if not use_auto:
                results.append({**item, "status": "ссылка", "link": self.links(r, text, channel)})
                continue
            try:
                if sender is None:
                    sender = self.tg() if channel == "tg" else crm.MacMessagesSender()
                status, err = sender.send(r, text)
            except crm.StopChannel as e:
                stop_reason = str(e)
                results.append({**item, "status": "ссылка", "error": stop_reason,
                                "link": self.links(r, text, channel)})
                continue
            if status == "no_account":
                results.append({**item, "status": "нет Telegram у номера",
                                "link": self.links(r, text, "wa")})
                continue
            crm.log_interaction(self.db, cid, "сообщение", text, channel=channel,
                                direction="out",
                                status="отправлено" if status == "sent" else f"ошибка: {err}")
            self.db.commit()
            results.append({**item, "status": "отправлено" if status == "sent" else "ошибка",
                            "error": err})
            if status == "sent" and n < len(ids) - 1:
                time.sleep(random.uniform(4, 12))  # не частим — меньше риск блокировки
        return {"results": results, "stop_reason": stop_reason}

    def sync_tg(self, cid):
        r = self.db.execute("SELECT * FROM contacts WHERE id=?", (cid,)).fetchone()
        added = 0
        for mid, at, out, text in self.tg().history(r):
            before = self.db.total_changes
            crm.log_interaction(self.db, cid, "переписка", text, channel="tg",
                                direction="out" if out else "in", at=at,
                                ext_id=f"tg:{mid}")
            added += self.db.total_changes - before
        self.db.commit()
        data = self.contact(cid)
        data["synced"] = added
        return data


def make_handler(app):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _json(self, data, code=200):
            body = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _allowed(self):
            host = (self.headers.get("Host") or "").split(":")[0]
            return host in ("127.0.0.1", "localhost") and \
                self.headers.get("X-CRM-Token") == app.token

        def do_GET(self):
            url = urllib.parse.urlparse(self.path)
            q = {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items()}
            if url.path == "/":
                html = PAGE.read_text(encoding="utf-8").replace("__TOKEN__", app.token)
                body = html.encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if url.path == "/favicon.ico":
                self.send_response(204)
                self.end_headers()
                return
            if not self._allowed():
                return self._json({"error": "forbidden"}, 403)
            try:
                if url.path == "/api/contacts":
                    return self._json(app.contacts(q))
                if url.path == "/api/facets":
                    return self._json(app.facets())
                m = re.fullmatch(r"/api/contact/(\d+)", url.path)
                if m:
                    return self._json(app.contact(int(m.group(1))))
            except KeyError:
                return self._json({"error": "not found"}, 404)
            self._json({"error": "not found"}, 404)

        def do_POST(self):
            if not self._allowed():
                return self._json({"error": "forbidden"}, 403)
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            path = urllib.parse.urlparse(self.path).path
            try:
                m = re.fullmatch(r"/api/contact/(\d+)(/log|/sync-tg)?", path)
                if m and not m.group(2):
                    return self._json(app.update(int(m.group(1)), body))
                if m and m.group(2) == "/log":
                    return self._json(app.log(int(m.group(1)), body))
                if m and m.group(2) == "/sync-tg":
                    return self._json(app.sync_tg(int(m.group(1))))
                if path == "/api/send":
                    return self._json(app.send(body))
            except crm.StopChannel as e:
                return self._json({"error": str(e)}, 400)
            except Exception as e:  # показываем ошибку в окне, а не падаем
                return self._json({"error": f"{e.__class__.__name__}: {e}"}, 500)
            self._json({"error": "not found"}, 404)

    return Handler


def run(db, port=8765, open_browser=True):
    app = App(db)
    server = HTTPServer(("127.0.0.1", port), make_handler(app))
    url = f"http://127.0.0.1:{port}/"
    print(f"База открыта: {url}\nНе закрывайте это окно Терминала, пока работаете. "
          "Выход — Ctrl+C.")
    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nЗакрыто.")
    finally:
        if app._tg:
            app._tg.client.disconnect()
