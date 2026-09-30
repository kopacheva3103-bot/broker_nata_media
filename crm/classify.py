"""Систематизация контактов: пол по имени, регион и оператор по номеру,
категории по вашим пометкам в телефоне (файл categories.txt)."""

import csv
import io
import re
import urllib.request
from bisect import bisect_right
from pathlib import Path

# ---------------------------------------------------------------- пол

FEMALE = set("""
александра алла алина алена алёна алиса альбина алевтина алия алсу аля амина
анастасия ангелина анжела анжелика анжелина анна антонина анфиса аида айгуль
айя айша ариадна ариана арина асель ася ада аделина агата аглая белла валентина
валерия варвара василиса вера вероника вета виктория виолетта влада владислава
галина гульнара гульнар гузель гюзель дана дарина дарья дария диана дина динара
доминика ева евгения екатерина елена елизавета есения жанна зарина земфира
зинаида злата зоя зульфия иветта илона инга инесса инна ирина ирэн камилла
карина кира клавдия клара кристина ксения лада лариса леся лейла лейсан лиана
лидия лилия лиля лина лия лолита лорелла луиза любовь людмила мадина майя
маргарита марго марина мария мартина марта марьяна мила милана милена
мирослава надежда наиля наталья наталия натали наташа нелли ника николь нина
нинель нонна нора оксана олеся ольга полина радима раиса рана регина рената
римма роза розалия руслана сабина светлана серафима снежана софья софия
стелла стефания сусанна таисия тамара тата татьяна ульяна фаина фатима эвелина
элеонора элина эльвира эльза эльмира эмилия эмма юлиана юлия юна яна ярослава
настя катя лена оля таня света юля маша даша ира аня люда галя вика лиза соня
ксюша надя люба тоня лана лера алёнка альфия алтыншаш гульшат гульнур
айгерим асем жанар ляйсан резеда венера зарема камила эльвина эльнара
гуля малика рина
""".split())

MALE = set("""
александр алексей анатолий андрей антон аркадий арсений артем артём артур
борис вадим валентин валерий василий виктор виталий владимир владислав
вячеслав геннадий георгий герман глеб григорий давид даниил данил денис
дмитрий евгений егор иван игорь илья кирилл константин лев леонид максим
марат марк матвей михаил никита николай олег павел петр пётр роман руслан
рустам семен семён сергей станислав степан тимофей тимур федор фёдор филипп
эдуард юрий ярослав ренат айдар азат ринат рамиль эльдар камиль али ахмед
магомед мурат заур тагир шамиль яков эрик эмиль эмин роберт ростислав
святослав всеволод богдан демид елисей захар лука мирон платон прохор савелий
тихон фома ян иосиф ашот армен арам тигран зураб нодар реваз отар гоша миша
дима вова коля толя петя ваня паша леша лёша алеша сережа серёжа юра боря
гена костя вася федя рома витя слава стас влад макс лёня леня гриша эдик
тёма тема жора азамат данияр ерлан нурлан арман айбек ильдар ильнур
рафаэль альберт анвар булат ильгиз салават эльвир бек гагик карен макар
максимус
""".split())

LATIN_FEMALE = set("""
alexandra alla alina alena alyona alisa alice anastasia anastasiya anna ann
anne angela anzhela arina daria darya diana elena elina eleonora elizaveta
emma eva evgenia evgeniya eugenia galina inna irina irene iuliia julia julie
jana yana karina katerina ekaterina kate kira kristina christina ksenia
kseniya xenia larisa lena lilia liliya lina liza ludmila lyudmila lubov
lyubov margarita maria mariya marie mary marina marta masha dasha katya
milana nadezhda nadia nadya natalia natalya nataliya natali nataly natalie
nina oksana olga olya polina regina sofia sofiya sophia svetlana sveta
taisia tata tatiana tatyana ulyana valentina valeria veronika veronica vera
victoria viktoria viktoriya yulia yuliya zoya aiya nelly ellie elly aigul
""".split())

LATIN_MALE = set("""
alexander aleksandr alex alexey aleksey alexei andrey andrei andrew anton
artem artur arthur boris vadim viktor victor vitaly vladimir vlad vladislav
denis dmitry dmitriy dmitrii dima evgeny evgeniy eugene egor ivan igor ilya
kirill konstantin maxim maksim max mikhail michael misha nikita nikolay
nikolai nick oleg pavel paul petr peter roman ruslan sergey sergei serge
stanislav stas timur fedor philipp yury yuri yaroslav georgy george gleb
grigory david daniel danil leonid lev mark matvey stepan timofey eduard
rustam john mike tom
""".split())


def _words(text):
    return re.findall(r"[A-Za-zА-Яа-яЁё]+(?:-[A-Za-zА-Яа-яЁё]+)?", text or "")


def known_name(word):
    """'ж' / 'м', если слово — известное имя, иначе ''."""
    w = word.lower()
    if w in FEMALE or w in LATIN_FEMALE:
        return "ж"
    if w in MALE or w in LATIN_MALE:
        return "м"
    return ""


def find_first_name(text):
    """Первое известное имя в строке: «Покупатель Ирина» -> «Ирина»."""
    for w in _words(text):
        if known_name(w):
            return w[0].upper() + w[1:].lower() if w.isupper() else w
    return ""


def guess_gender(*texts):
    words = [w for t in texts for w in _words(t)]
    for w in words:  # 1) известное имя
        g = known_name(w)
        if g:
            return g
    for w in words:  # 2) отчество
        lw = w.lower()
        if lw.endswith(("вна", "чна", "кызы", "vna")):
            return "ж"
        if len(lw) > 4 and lw.endswith(("вич", "ьич", "оглы", "vich")):
            return "м"
    for w in words:  # 3) фамилия
        lw = w.lower()
        if len(lw) < 5 or not w[0].isupper():
            continue
        if lw.endswith(("ова", "ева", "ёва", "ина", "ына", "ская", "цкая",
                        "ova", "eva", "ina", "skaya", "tskaya")):
            return "ж"
        if lw.endswith(("ов", "ев", "ёв", "ин", "ын", "ский", "цкий",
                        "ov", "ev", "sky", "skiy", "skii")):
            return "м"
    return ""


GENDER_LABEL = {"ж": "женщина", "м": "мужчина", "": ""}


def parse_gender(value):
    v = (value or "").strip().lower()
    if v in ("ж", "жен", "женщина", "f", "female", "w"):
        return "ж"
    if v in ("м", "муж", "мужчина", "m", "male"):
        return "м"
    return ""


# ---------------------------------------------------------------- регион номера

COUNTRIES = {  # код страны -> название (самые частые)
    "375": "Беларусь", "380": "Украина", "998": "Узбекистан", "996": "Киргизия",
    "992": "Таджикистан", "993": "Туркменистан", "994": "Азербайджан",
    "374": "Армения", "995": "Грузия", "373": "Молдова", "371": "Латвия",
    "370": "Литва", "372": "Эстония", "971": "ОАЭ", "972": "Израиль",
    "357": "Кипр", "381": "Сербия", "382": "Черногория", "359": "Болгария",
    "90": "Турция", "66": "Таиланд", "62": "Индонезия", "84": "Вьетнам",
    "86": "Китай", "91": "Индия", "44": "Великобритания", "49": "Германия",
    "33": "Франция", "34": "Испания", "39": "Италия", "41": "Швейцария",
    "43": "Австрия", "48": "Польша", "420": "Чехия", "30": "Греция",
    "351": "Португалия", "31": "Нидерланды", "1": "США/Канада", "20": "Египет",
    "966": "Саудовская Аравия", "974": "Катар", "965": "Кувейт", "968": "Оман",
    "973": "Бахрейн", "960": "Мальдивы", "94": "Шри-Ланка", "95": "Мьянма",
    "60": "Малайзия", "65": "Сингапур", "63": "Филиппины", "82": "Южная Корея",
    "81": "Япония", "55": "Бразилия", "52": "Мексика", "54": "Аргентина",
}

REGISTRY_FILES = ("DEF-9xx.csv", "ABC-3xx.csv", "ABC-4xx.csv", "ABC-8xx.csv")
REGISTRY_URL = "https://opendata.digital.gov.ru/downloads/{}"
REGISTRY_PAGE = "https://opendata.digital.gov.ru/registry/numeric/downloads"


class Numbering:
    """Реестр российской нумерации Минцифры: диапазоны номеров -> оператор, регион."""

    def __init__(self, folder):
        self.ranges = {}  # код (3 цифры) -> отсортированный список (от, до, оператор, регион)
        for f in sorted(Path(folder).glob("*.csv")) if Path(folder).exists() else []:
            self._load(f)
        for lst in self.ranges.values():
            lst.sort()
        self.starts = {k: [r[0] for r in v] for k, v in self.ranges.items()}

    def __bool__(self):
        return bool(self.ranges)

    def _load(self, path):
        raw = path.read_bytes()
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("cp1251", "replace")
        lines = list(csv.reader(io.StringIO(text), delimiter=";"))
        if not lines:
            return
        head = [h.strip().lower() for h in lines[0]]

        def col(*keys, default=None):
            for i, h in enumerate(head):
                if any(k in h for k in keys):
                    return i
            return default

        i_code, i_from, i_to = col("def", "авс", "abc", default=0), col("от"), col("до")
        i_op, i_reg = col("оператор"), col("регион")
        if None in (i_from, i_to, i_reg):
            return
        for p in lines[1:]:
            try:
                code = re.sub(r"\D", "", p[i_code])
                start, end = int(p[i_from]), int(p[i_to])
            except (ValueError, IndexError):
                continue
            op = p[i_op].strip() if i_op is not None and i_op < len(p) else ""
            reg = p[i_reg].strip() if i_reg < len(p) else ""
            self.ranges.setdefault(code, []).append((start, end, op, reg))

    def lookup(self, phone):
        digits = re.sub(r"\D", "", phone or "")
        if len(digits) != 11 or not digits.startswith("7"):
            return "", ""
        code, rest = digits[1:4], int(digits[4:])
        lst = self.ranges.get(code)
        if not lst:
            return "", ""
        i = bisect_right(self.starts[code], rest) - 1
        if i >= 0 and lst[i][0] <= rest <= lst[i][1]:
            return lst[i][3], lst[i][2]
        return "", ""


def region_of(phone, numbering=None):
    """(регион, оператор). Без реестра для России — только «Россия»."""
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        return "", ""
    if digits.startswith("7") and len(digits) == 11:
        if digits[1] in "67":
            return "Казахстан", ""
        if numbering:
            reg, op = numbering.lookup(phone)
            if reg:
                return reg, op
        return "Россия", ""
    for n in (3, 2, 1):
        if digits[:n] in COUNTRIES:
            return COUNTRIES[digits[:n]], ""
    return "", ""


def _ssl_context(insecure):
    import ssl
    if insecure:
        return ssl._create_unverified_context()
    try:
        import certifi  # свежие корневые сертификаты (ставится вместе с requests)
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def download_registry(folder, log=print, insecure=False):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    ok, ssl_failed = 0, False
    for name in REGISTRY_FILES:
        url = REGISTRY_URL.format(name)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=180,
                                        context=_ssl_context(insecure)) as r:
                data = r.read()
        except Exception as e:  # сеть, сертификат, блокировка
            ssl_failed |= "SSL" in str(e) or "CERTIFICATE" in str(e).upper()
            log(f"  {name}: не скачался ({e.__class__.__name__}: {e})")
            continue
        if data.count(b";") < 1000:
            log(f"  {name}: пришёл не тот файл, пропускаю")
            continue
        (folder / name).write_bytes(data)
        ok += 1
        log(f"  {name}: скачан ({len(data) // 1024} КБ)")
    if ssl_failed and not insecure:
        log("Сайт Минцифры использует сертификат, которому Mac не доверяет "
            "(российский удостоверяющий центр). Реестр — открытые данные без "
            "личной информации, его можно скачать без проверки сертификата:\n"
            "  python3 crm.py regions --insecure")
    return ok


# ---------------------------------------------------------------- категории

def load_rules(path):
    """categories.txt: «агент: р-р, агент, риелтор». Слово с # — это уже
    стоящая категория: «премиум: #чат-premium-wlc»."""
    rules = []
    if not Path(path).exists():
        return rules
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.split("//")[0].strip()
        if not line or ":" not in line:
            continue
        tag, words = line.split(":", 1)
        words = [w.strip().lower() for w in words.split(",") if w.strip()]
        rules.append((tag.strip().lower(), words))
    return rules


def match_rules(rules, name, notes, tags):
    """Категории по пометкам в ИМЕНИ контакта (так вы подписываете людей
    в телефоне). Слово ищется с начала слова: «агент» найдётся в «Агентство»,
    но не в «Турагент». Заметки не смотрим: там бывает случайный текст."""
    text = (name or "").lower()
    found = []
    for tag, words in rules:
        for w in words:
            if w.startswith("#"):
                hit = w[1:] in tags
            else:
                hit = re.search(r"(?<![a-zа-яё0-9])" + re.escape(w), text)
            if hit:
                found.append(tag)
                break
    return found
