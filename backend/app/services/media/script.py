"""Turn LLM debate text into something a TTS engine can read aloud (pure functions)."""

import re

_TAG_RE = re.compile(r"\[[a-zA-Z][a-zA-Z ,'-]{0,40}\]")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?…])\s+")
_EMOJI_RE = re.compile("[\U0001f300-\U0001faff\U00002600-\U000027bf\U0001f1e6-\U0001f1ff️]+")


def strip_audio_tags(text: str) -> str:
    """Remove ElevenLabs v3 audio tags such as [sarcastic] and collapse whitespace."""
    return re.sub(r"\s+", " ", _TAG_RE.sub(" ", text)).strip()


def has_audio_tags(text: str) -> bool:
    return bool(_TAG_RE.search(text))


def clean_markdown(text: str) -> str:
    """Convert Markdown to plain spoken prose. Keeps [audio tags] intact."""
    lines: list[str] = []
    in_code = False
    for raw in text.splitlines():
        line = raw.rstrip()
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        stripped = line.strip()
        if not stripped:
            lines.append("")
            continue
        if re.fullmatch(r"[-*_]{3,}", stripped):
            continue
        # Table rows: keep cell text, drop separator rows.
        if stripped.startswith("|"):
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                continue
            stripped = ", ".join(c for c in cells if c)
        # Headers -> sentence.
        m = re.match(r"^#{1,6}\s+(.*)$", stripped)
        if m:
            stripped = m.group(1).strip().rstrip(":")
            if stripped and stripped[-1] not in ".!?":
                stripped += "."
        # Blockquotes and list markers.
        stripped = re.sub(r"^>\s*", "", stripped)
        stripped = re.sub(r"^(?:[-*+]|\d+[.)])\s+", "", stripped)
        lines.append(stripped)

    out = "\n".join(lines)
    # Inline markup.
    out = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", out)  # images
    out = re.sub(r"\[([^\]]+)\]\((?:[^)]+)\)", r"\1", out)  # links -> label
    out = re.sub(r"<[^>\n]+>", "", out)  # html tags
    out = re.sub(r"`([^`]*)`", r"\1", out)
    out = re.sub(r"(\*\*|__)(.+?)\1", r"\2", out)
    out = re.sub(r"(?<![A-Za-z0-9])[*_](.+?)[*_](?![A-Za-z0-9])", r"\1", out)
    out = out.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"')
    out = _EMOJI_RE.sub("", out)
    # Paragraph breaks become sentence pauses; make sure paragraphs end with punctuation.
    paragraphs = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n|\n", out)]
    paragraphs = [p for p in paragraphs if p]
    fixed: list[str] = []
    for p in paragraphs:
        if p[-1] not in ".!?…\"'”»)" and not p.endswith("]"):
            p += "."
        fixed.append(p)
    return " ".join(fixed).strip()


def split_for_tts(text: str, max_chars: int) -> list[str]:
    """Split on sentence boundaries so every chunk stays under `max_chars`."""
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []
    chunks: list[str] = []
    current = ""
    for sentence in _SENTENCE_SPLIT.split(text):
        if not sentence:
            continue
        # A single sentence longer than the limit is cut on clause boundaries.
        pieces = [sentence] if len(sentence) <= max_chars else _split_long(sentence, max_chars)
        for piece in pieces:
            if current and len(current) + 1 + len(piece) > max_chars:
                chunks.append(current)
                current = piece
            else:
                current = f"{current} {piece}".strip()
    if current:
        chunks.append(current)
    return chunks


def _split_long(sentence: str, max_chars: int) -> list[str]:
    parts: list[str] = []
    current = ""
    for clause in re.split(r"(?<=[,;:])\s+", sentence):
        words = clause.split()
        for word in words:
            if current and len(current) + 1 + len(word) > max_chars:
                parts.append(current)
                current = word
            else:
                current = f"{current} {word}".strip()
    if current:
        parts.append(current)
    return parts


def spoken_speaker_name(speaker_name: str, language_code: str) -> str:
    """The verdict turn is stored under a symbolic name; give it a readable one."""
    cleaned = _EMOJI_RE.sub("", speaker_name).strip()
    if cleaned.lower() in ("verdict", "judge", "the judge") or not cleaned:
        return "Судья" if language_code == "ru" else "The Judge"
    return cleaned


def even_words(text: str, duration_ms: int) -> list[dict[str, int | str]]:
    """Spread words evenly over the audio when the provider gave no timestamps."""
    tokens = strip_audio_tags(text).split()
    if not tokens:
        return []
    weights = [max(2, len(re.sub(r"[^\w]", "", t)) + 1) for t in tokens]
    total = sum(weights)
    cursor = 0.0
    words: list[dict[str, int | str]] = []
    for i, (tok, w) in enumerate(zip(tokens, weights, strict=True)):
        length = duration_ms * w / total
        start = round(cursor)
        cursor += length
        end = round(cursor) - (0 if i == len(tokens) - 1 else 20)
        words.append({"w": tok, "s": start, "e": max(start + 1, end)})
    return words
