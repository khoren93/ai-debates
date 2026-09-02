from itertools import pairwise

from app.services.media.alignment import (
    WordTiming,
    chars_to_words,
    clamp_words,
    merge_chunks,
    shift,
    words_from_forced_alignment,
)


def _alignment(text: str, step: float = 0.05):
    chars = list(text)
    starts = [i * step for i in range(len(chars))]
    ends = [i * step + step for i in range(len(chars))]
    return chars, starts, ends


def test_chars_to_words_groups_and_skips_tags() -> None:
    words = chars_to_words(*_alignment("[sarcastic] Oh, so a hammer? Yes."))
    assert [w.w for w in words] == ["Oh,", "so", "a", "hammer?", "Yes."]
    assert words[0].s_ms == 600 and words[0].e_ms == 750
    assert all(a.e_ms <= b.s_ms for a, b in pairwise(words))


def test_chars_to_words_handles_multiple_spaces_and_newlines() -> None:
    words = chars_to_words(*_alignment("one  two\nthree"))
    assert [w.w for w in words] == ["one", "two", "three"]


def test_merge_chunks_and_shift() -> None:
    a = [WordTiming("a", 0, 100)]
    b = [WordTiming("b", 0, 200)]
    merged = merge_chunks([(a, 1000), (b, 500)])
    assert merged == [WordTiming("a", 0, 100), WordTiming("b", 1000, 1200)]
    assert shift(a, 10) == [WordTiming("a", 10, 110)]


def test_words_from_forced_alignment() -> None:
    payload = {
        "words": [{"text": " Hi", "start": 0.1, "end": 0.4}, {"text": "  ", "start": 1, "end": 2}]
    }
    assert words_from_forced_alignment(payload) == [WordTiming("Hi", 100, 400)]


def test_clamp_words() -> None:
    words = [WordTiming("a", 0, 100), WordTiming("b", 900, 1500), WordTiming("c", 1200, 1300)]
    assert clamp_words(words, 1000) == [WordTiming("a", 0, 100), WordTiming("b", 900, 1000)]
