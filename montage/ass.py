"""Building .ass subtitle files: styles, captions, slide text, reels-style subtitles."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

REF_H = 1920  # style sizes in configs are given for a 1080x1920 frame


def ass_color(color: str, alpha: float = 0.0) -> str:
    """'#RRGGBB' -> '&HAABBGGRR' (alpha 0 = opaque, 1 = transparent)."""
    c = str(color).lstrip("#")
    if len(c) != 6:
        raise ValueError(f"Цвет должен быть в формате #RRGGBB, получено: {color}")
    r, g, b = c[0:2], c[2:4], c[4:6]
    a = f"{int(round(max(0, min(alpha, 1)) * 255)):02X}"
    return f"&H{a}{b}{g}{r}".upper()


def ts(seconds: float) -> str:
    seconds = max(0.0, seconds)
    cs = int(round(seconds * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def clean(text: str) -> str:
    text = str(text).replace("\\", "/").replace("{", "(").replace("}", ")")
    return text.replace("\r", "").replace("\n", r"\N")


DEFAULT_STYLES: dict[str, dict] = {
    "title": {"size": 96, "color": "#FFFFFF", "outline_color": "#000000", "outline": 0, "shadow": 3,
              "bold": True, "margin_x": 90},
    "text": {"size": 58, "color": "#F2F2F2", "outline_color": "#000000", "outline": 0, "shadow": 2,
             "bold": False, "margin_x": 100},
    "caption": {"size": 70, "color": "#FFFFFF", "outline_color": "#000000", "outline": 4, "shadow": 2,
                "bold": True, "margin_x": 80, "box": False, "box_color": "#000000", "box_opacity": 0.45},
    "subtitle": {"size": 78, "color": "#FFFFFF", "outline_color": "#000000", "outline": 5, "shadow": 2,
                 "bold": True, "margin_x": 70, "highlight": "#FFD400", "box": False,
                 "box_color": "#000000", "box_opacity": 0.45},
}


@dataclass
class AssDoc:
    width: int
    height: int
    font: str
    styles: dict[str, dict]
    events: list[str] = field(default_factory=list)

    @property
    def k(self) -> float:
        return self.height / REF_H

    def style(self, name: str) -> dict:
        return {**DEFAULT_STYLES.get(name, DEFAULT_STYLES["text"]), **(self.styles.get(name) or {})}

    def _style_line(self, name: str) -> str:
        s = self.style(name)
        k = self.k
        box = bool(s.get("box"))
        outline_col = ass_color(s["box_color"], s.get("box_opacity", 0.45)) if box else ass_color(s["outline_color"])
        return (
            f"Style: {name},{s.get('font', self.font)},{round(s['size'] * k)},{ass_color(s['color'])},"
            f"{ass_color(s.get('highlight', s['color']))},{outline_col},{ass_color('#000000', 0.4)},"
            f"{-1 if s.get('bold') else 0},{-1 if s.get('italic') else 0},0,0,100,100,{s.get('spacing', 0)},0,"
            f"{3 if box else 1},{(s.get('box_padding', 14) if box else s['outline']) * k:.1f},"
            f"{s['shadow'] * k:.1f},5,{round(s['margin_x'] * k)},{round(s['margin_x'] * k)},0,1"
        )

    def add(self, start: float, end: float, style: str, text: str) -> None:
        if end - start <= 0.01:
            return
        self.events.append(f"Dialogue: 0,{ts(start)},{ts(end)},{style},,0,0,0,,{text}")

    def write(self, path: Path) -> Path:
        head = [
            "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {self.width}", f"PlayResY: {self.height}",
            "WrapStyle: 0", "ScaledBorderAndShadow: yes", "YCbCr Matrix: TV.709", "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
            "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
            "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
            *(self._style_line(n) for n in DEFAULT_STYLES),
            "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        ]
        path.write_text("\n".join(head + self.events) + "\n", encoding="utf-8")
        return path

    # --- positions -------------------------------------------------------
    def y_for(self, position: str | float) -> int:
        if isinstance(position, (int, float)):
            return round(self.height * float(position))
        return round(self.height * {"top": 0.17, "upper": 0.3, "middle": 0.5, "center": 0.5,
                                    "lower": 0.6, "bottom": 0.6}.get(position, 0.6))


def intro_tags(animation: str, x: int, y: int, k: float) -> str:
    anim = animation or "fade"
    if anim == "none":
        return rf"\pos({x},{y})"
    if anim == "slide_up":
        return rf"\move({x},{y + round(110 * k)},{x},{y},0,450)\fad(350,250)"
    if anim == "slide_down":
        return rf"\move({x},{y - round(110 * k)},{x},{y},0,450)\fad(350,250)"
    if anim == "pop":
        return rf"\pos({x},{y})\fscx60\fscy60\t(0,260,0.6,\fscx106\fscy106)\t(260,380,\fscx100\fscy100)\fad(150,250)"
    return rf"\pos({x},{y})\fad(450,300)"


def slide_events(doc: AssDoc, seg: dict, duration: float) -> None:
    """Title + text + bullets as one centred block (so lines never overlap)."""
    x = doc.width // 2
    y = doc.y_for(seg.get("text_position", "middle"))
    parts: list[str] = []
    if seg.get("title"):
        parts.append(r"{\rtitle}" + clean(seg["title"]))
    if seg.get("text"):
        parts.append(r"{\rtext}" + clean(seg["text"]))
    bullets = seg.get("bullets") or []
    start_ms = 600 if parts else 200
    step = int(float(seg.get("bullet_delay", 0.45)) * 1000)
    bullet_mark = seg.get("bullet", "•")
    for i, b in enumerate(bullets):
        t0 = start_ms + i * step
        parts.append(rf"{{\rtext\alpha&HFF&\t({t0},{t0 + 300},\alpha&H00&)}}{bullet_mark} {clean(b)}")
    if not parts:
        return
    spacer = r"\N{\fscy35} \N" if seg.get("title") and (seg.get("text") or bullets) else r"\N"
    body = parts[0] + (spacer + r"\N".join(parts[1:]) if len(parts) > 1 else "")
    tags = r"{\an5" + intro_tags(seg.get("animation", "slide_up"), x, y, doc.k) + "}"
    doc.add(float(seg.get("text_start", 0.0)), duration, "title" if seg.get("title") else "text", tags + body)


def caption_events(doc: AssDoc, seg: dict, duration: float) -> None:
    """Text overlay on top of a video/photo segment."""
    cap = seg.get("text")
    if not cap:
        return
    items = cap if isinstance(cap, list) else [cap]
    for item in items:
        if isinstance(item, str):
            item = {"text": item}
        start = float(item.get("start", seg.get("text_start", 0.3)))
        end = float(item.get("end", seg.get("text_end", duration)))
        pos = item.get("position", seg.get("text_position", "top"))
        anim = item.get("animation", seg.get("text_animation", "pop"))
        tags = r"{\an5" + intro_tags(anim, doc.width // 2, doc.y_for(pos), doc.k) + "}"
        doc.add(start, min(end, duration), "caption", tags + clean(item["text"]))


# --- subtitles --------------------------------------------------------------

@dataclass
class Cue:
    start: float
    end: float
    text: str
    words: list[tuple[float, float, str]] | None = None  # precise word timings (whisper)


_TIME = re.compile(r"(\d+):(\d{2}):(\d{2})[,.](\d{1,3})")


def _t(s: str) -> float:
    m = _TIME.search(s)
    if not m:
        raise ValueError(f"Неверное время в SRT: {s}")
    h, mi, se, ms = m.groups()
    return int(h) * 3600 + int(mi) * 60 + int(se) + int(ms.ljust(3, "0")) / 1000


def parse_srt(text: str) -> list[Cue]:
    cues = []
    for block in re.split(r"\n\s*\n", text.replace("\r", "").strip()):
        lines = [l for l in block.split("\n") if l.strip()]
        idx = next((i for i, l in enumerate(lines) if "-->" in l), None)
        if idx is None:
            continue
        a, b = lines[idx].split("-->")
        body = " ".join(lines[idx + 1:]).strip()
        if body:
            cues.append(Cue(_t(a), _t(b), re.sub(r"<[^>]+>", "", body)))
    return cues


def write_srt(cues: list[Cue], path: Path) -> Path:
    def f(t: float) -> str:
        ms = int(round(t * 1000))
        h, ms = divmod(ms, 3600000)
        m, ms = divmod(ms, 60000)
        s, ms = divmod(ms, 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
    out = [f"{i}\n{f(c.start)} --> {f(c.end)}\n{c.text}\n" for i, c in enumerate(cues, 1)]
    path.write_text("\n".join(out), encoding="utf-8")
    return path


def _word_times(cue: Cue) -> list[tuple[float, float, str]]:
    if cue.words:
        return cue.words
    words = cue.text.split()
    if not words:
        return []
    weights = [len(w) + 2 for w in words]
    total = sum(weights)
    out, t = [], cue.start
    for w, wt in zip(words, weights):
        d = (cue.end - cue.start) * wt / total
        out.append((t, t + d, w))
        t += d
    return out


def chunk(cues: list[Cue], max_words: int, max_chars: int) -> list[list[tuple[float, float, str]]]:
    """Split cues into short on-screen phrases (reels style)."""
    chunks = []
    for cue in cues:
        cur: list[tuple[float, float, str]] = []
        for w in _word_times(cue):
            length = sum(len(x[2]) + 1 for x in cur) + len(w[2])
            if cur and (len(cur) >= max_words or length > max_chars):
                chunks.append(cur)
                cur = []
            cur.append(w)
            if w[2][-1:] in ".!?" and max_words < 99:
                chunks.append(cur)
                cur = []
        if cur:
            chunks.append(cur)
    return chunks


def subtitle_events(doc: AssDoc, cues: list[Cue], cfg: dict) -> None:
    style = doc.style("subtitle")
    upper = cfg.get("uppercase", False)
    karaoke = cfg.get("karaoke", True)
    hl = ass_color(style.get("highlight", "#FFD400"))
    pos = cfg.get("position", "bottom")
    y = doc.y_for({"bottom": 0.72, "middle": 0.55, "top": 0.2}.get(pos, pos) if isinstance(pos, str) else pos)
    base = r"{\an5\pos(" + f"{doc.width // 2},{y}" + ")}"
    offset = float(cfg.get("offset", 0.0))
    chunks = chunk(cues, int(cfg.get("max_words", 4)), int(cfg.get("max_chars", 26)))
    for n, words in enumerate(chunks):
        start = words[0][0] + offset
        end = words[-1][1] + offset
        # keep phrase on screen until the next one starts (no flicker), max +0.4s
        if n + 1 < len(chunks):
            end = max(end, min(chunks[n + 1][0][0] + offset, end + 0.4))
        tokens = [clean(w[2].upper() if upper else w[2]) for w in words]
        if not karaoke:
            doc.add(start, end, "subtitle", base + " ".join(tokens))
            continue
        for i, (ws, we, _) in enumerate(words):
            ws += offset
            we = end if i == len(words) - 1 else words[i + 1][0] + offset
            line = " ".join(
                (r"{\c" + hl + r"\fscx108\fscy108}" + t + r"{\r}") if j == i else t
                for j, t in enumerate(tokens)
            )
            doc.add(max(ws, start), we, "subtitle", base + line)
