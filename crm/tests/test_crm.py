import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import crm  # noqa: E402

VCF = """BEGIN:VCARD
VERSION:2.1
N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D0=9F=D0=B5=D1=82=D1=80=D0=BE=D0=B2;=D0=98=D0=B2=D0=B0=D0=BD;;;
TEL;CELL:8 (916) 123-45-67
TEL;HOME:+7 495 000-00-00
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Ольга Смирнова
item1.TEL;type=CELL:+7 903 111-22-33
CATEGORIES:Инвестор,VIP
NOTE:Коммерция
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Без номера
END:VCARD
"""


class CrmTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.db = crm.connect(self.dir / "t.db")

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_normalize_phone(self):
        self.assertEqual(crm.normalize_phone("8 (916) 123-45-67"), "+79161234567")
        self.assertEqual(crm.normalize_phone("9161234567"), "+79161234567")
        self.assertEqual(crm.normalize_phone("+375 29 123 45 67"), "+375291234567")
        self.assertIsNone(crm.normalize_phone("112"))

    def test_parse_vcf(self):
        items = crm.parse_vcf(VCF)
        self.assertEqual(items[0]["name"], "Иван Петров")
        self.assertEqual(len(items[0]["phones"]), 2)
        self.assertEqual(items[1]["tags"], ["инвестор", "vip"])
        for it in items:
            crm.upsert_contact(self.db, it, ["телефон"])
        rows = crm.select_contacts(self.db, ["инвестор"])
        self.assertEqual([r["phone"] for r in rows], ["+79031112233"])
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM contacts").fetchone()[0], 2)

    def test_export_edit_import_roundtrip(self):
        for it in crm.parse_vcf(VCF):
            crm.upsert_contact(self.db, it)
        path = self.dir / "c.csv"
        crm.cmd_export(self.db, type("A", (), {"file": str(path), "tag": ""}))
        text = path.read_text(encoding="utf-8-sig").replace(
            "+79161234567;;;0;0", "+79161234567;;покупатель, москва;1;0")
        path.write_text(text, encoding="utf-8-sig")
        crm.cmd_import(self.db, type("A", (), {"file": str(path), "tag": ""}))
        r = self.db.execute("SELECT * FROM contacts WHERE phone='+79161234567'").fetchone()
        self.assertEqual(r["tags"], "покупатель,москва")
        self.assertEqual(r["consent"], 1)

    def test_render(self):
        row = {"name": "Иван Петров", "phone": "+7", "notes": ""}
        self.assertIn("Иван!", crm.render("{hello}, {first_name}! {unknown}", row))
        self.assertTrue(crm.render("{hello}, {first_name}!", {"name": "", "phone": "",
                                                              "notes": ""}).endswith("!"))

    def test_send_whatsapp_links_respects_consent_and_stop(self):
        crm.DATA_DIR = self.dir
        crm.CONFIG_PATH = self.dir / "none.ini"
        for it in crm.parse_vcf(VCF):
            crm.upsert_contact(self.db, it, ["клиент"])
        self.db.execute("UPDATE contacts SET consent=1")
        self.db.execute("UPDATE contacts SET stopped=1 WHERE phone='+79031112233'")
        tpl = self.dir / "t.txt"
        tpl.write_text("{hello}, {first_name}! Есть объект.", encoding="utf-8")
        args = crm.build_parser().parse_args(
            ["send", "--name", "Тест", "--template", str(tpl), "--tags", "клиент",
             "--channels", "wa", "--send"])
        crm.cmd_send(self.db, args)
        msgs = self.db.execute("SELECT * FROM messages").fetchall()
        self.assertEqual(len(msgs), 1)
        self.assertEqual(msgs[0]["status"], "link")
        page = next(self.dir.glob("wa_links_*.html")).read_text(encoding="utf-8")
        self.assertIn("https://wa.me/79161234567?text=", page)
        # повторный запуск не шлёт тем же людям
        crm.cmd_send(self.db, args)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM messages").fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
