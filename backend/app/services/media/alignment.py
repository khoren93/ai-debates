"""Word timing helpers (pure)."""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class WordTiming:
    w: str
    s_ms: int
    e_ms: int

    def as_dict(self) -> dict[str, int | str]:
        return {"w": self.w, "s": self.s_ms, "e": self.e_ms}


def chars_to_words(
    characters: list[str], starts_s: list[float], ends_s: list[float]
) -> list[WordTiming]:
    """Group ElevenLabs character alignment into words. Audio tags in [brackets] are skipped."""
    words: list[WordTiming] = []
    current = ""
    start = 0.0
    end = 0.0
    in_tag = False

    def flush() -> None:
        nonlocal current
        if current.strip():
            words.append(WordTiming(current, round(start * 1000), round(end * 1000)))
        current = ""

    for i, ch in enumerate(characters):
        if ch == "[":
            flush()
            in_tag = True
            continue
        if in_tag:
            if ch == "]":
                in_tag = False
            continue
        if ch.isspace():
            flush()
            continue
        if not current:
            start = starts_s[i]
        current += ch
        end = ends_s[i]
    flush()
    return words


def shift(words: list[WordTiming], offset_ms: int) -> list[WordTiming]:
    return [WordTiming(w.w, w.s_ms + offset_ms, w.e_ms + offset_ms) for w in words]


def merge_chunks(parts: list[tuple[list[WordTiming], int]]) -> list[WordTiming]:
    """Concatenate per-chunk timings given each chunk's duration in ms."""
    merged: list[WordTiming] = []
    offset = 0
    for words, duration_ms in parts:
        merged.extend(shift(words, offset))
        offset += duration_ms
    return merged


def words_from_forced_alignment(payload: dict[str, Any]) -> list[WordTiming]:
    """Parse the ElevenLabs /v1/forced-alignment response."""
    out: list[WordTiming] = []
    for item in payload.get("words") or []:
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        out.append(
            WordTiming(
                text,
                round(float(item.get("start") or 0) * 1000),
                round(float(item.get("end") or 0) * 1000),
            )
        )
    return out


def clamp_words(words: list[WordTiming], duration_ms: int) -> list[WordTiming]:
    """Drop words that start after the (trimmed) audio ends and clamp end times."""
    out: list[WordTiming] = []
    for w in words:
        if w.s_ms >= duration_ms:
            continue
        out.append(WordTiming(w.w, w.s_ms, min(max(w.e_ms, w.s_ms + 1), duration_ms)))
    return out
