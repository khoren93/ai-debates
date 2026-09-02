from app.services.media.script import (
    clean_markdown,
    even_words,
    has_audio_tags,
    split_for_tts,
    spoken_speaker_name,
    strip_audio_tags,
)


def test_clean_markdown_headers_lists_links_and_emphasis() -> None:
    text = (
        "## Opening statement\n\n"
        "I believe **strongly** that *AI* should refuse.\n"
        "- First point\n"
        "- Second point with a [link](https://example.com)\n\n"
        "> quoted line\n"
        "`code` and ~~strike~~ 🎉"
    )
    out = clean_markdown(text)
    assert "#" not in out and "**" not in out and "](" not in out and "`" not in out
    assert "Opening statement." in out
    assert "First point." in out and "Second point with a link." in out
    assert "quoted line." in out
    assert "🎉" not in out


def test_clean_markdown_keeps_audio_tags_and_drops_code_blocks() -> None:
    text = "[sarcastic] Oh really?\n\n```python\nprint('hi')\n```\nYes."
    out = clean_markdown(text)
    assert out.startswith("[sarcastic] Oh really?")
    assert "print" not in out
    assert out.endswith("Yes.")


def test_clean_markdown_tables() -> None:
    text = "| a | b |\n|---|---|\n| one | two |"
    assert clean_markdown(text) == "a, b. one, two."


def test_strip_audio_tags() -> None:
    assert strip_audio_tags("[sarcastic] Oh, so [pause] what?") == "Oh, so what?"
    assert has_audio_tags("[laughs] ha") and not has_audio_tags("no tags [123]")


def test_split_for_tts_respects_limit_and_order() -> None:
    sentences = [f"Sentence number {i} is here." for i in range(20)]
    text = " ".join(sentences)
    chunks = split_for_tts(text, 80)
    assert all(len(c) <= 80 for c in chunks)
    assert " ".join(chunks) == text
    assert split_for_tts("short", 80) == ["short"]
    assert split_for_tts("   ", 80) == []


def test_split_for_tts_long_sentence_is_cut_on_clauses() -> None:
    text = "word " * 100
    chunks = split_for_tts(text.strip(), 60)
    assert all(len(c) <= 60 for c in chunks)
    assert len(chunks) > 1


def test_spoken_speaker_name() -> None:
    assert spoken_speaker_name("⚖️ Verdict", "en") == "The Judge"
    assert spoken_speaker_name("⚖️ Verdict", "ru") == "Судья"
    assert spoken_speaker_name("Nova", "en") == "Nova"


def test_even_words_spans_duration() -> None:
    words = even_words("[calm] one two three", 3000)
    assert [w["w"] for w in words] == ["one", "two", "three"]
    assert words[0]["s"] == 0 and words[-1]["e"] == 3000
    assert all(int(w["s"]) < int(w["e"]) for w in words)
    assert even_words("", 1000) == []
