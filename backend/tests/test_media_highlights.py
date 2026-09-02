from app.schemas.timeline import TimelineSegment, TimelineSpeaker, TimelineWord
from app.services.media.highlights import (
    HighlightPick,
    build_highlights_messages,
    extract_winner,
    fallback_highlights,
    locate_quote,
    match_speaker,
    parse_highlights,
    snap_highlight,
)

SPEAKERS = [
    TimelineSpeaker(
        id="participant_0",
        name="Moderator",
        role="moderator",
        model="m",
        color="#999",
        mascot="cube",
    ),
    TimelineSpeaker(
        id="participant_1", name="Nova", role="debater", model="gpt", color="#0ff", mascot="orb"
    ),
    TimelineSpeaker(
        id="participant_2", name="Atlas", role="debater", model="gem", color="#f80", mascot="bolt"
    ),
]


def _segment(
    seq: int, speaker: TimelineSpeaker, start_ms: int, text: str, turn_type: str = "rebuttal"
) -> TimelineSegment:
    tokens = text.split()
    per = 400
    words = [TimelineWord(w=t, s=i * per, e=i * per + per - 50) for i, t in enumerate(tokens)]
    return TimelineSegment(
        seq_index=seq,
        speaker_id=speaker.id,
        speaker_name=speaker.name,
        round_id="round_2",
        turn_type=turn_type,
        start_ms=start_ms,
        end_ms=start_ms + len(tokens) * per,
        audio=f"turns/{seq:03d}.wav",
        text=text,
        words=words,
    )


def test_parse_highlights_tolerates_bad_items() -> None:
    winner, picks = parse_highlights(
        {
            "winner_name": "Nova",
            "highlights": [
                {"title": "t", "hook": "h", "start_seq": "3", "end_seq": 2},
                "junk",
                {"title": "x"},
            ],
        }
    )
    assert winner == "Nova"
    assert picks == [HighlightPick(title="t", hook="h", start_seq=2, end_seq=3)]
    assert parse_highlights("nope") == (None, [])


def test_locate_quote_fuzzy() -> None:
    words = [
        (w, i * 100, i * 100 + 90)
        for i, w in enumerate(
            ["So", "a", "hammer", "should", "hit", "your", "thumb", "if", "you", "ask", "nicely"]
        )
    ]
    assert locate_quote(words, "hammer should hit") == 2
    assert locate_quote(words, "ask nicely!", from_end=True) == 10
    assert locate_quote(words, "completely unrelated words here") is None


def test_snap_highlight_uses_quotes_and_limits() -> None:
    text_a = " ".join(f"w{i}" for i in range(60))  # 24 s
    text_b = " ".join(f"v{i}" for i in range(60))  # 24 s
    seg_a = _segment(3, SPEAKERS[1], 0, text_a)
    seg_b = _segment(4, SPEAKERS[2], 25_000, text_b)
    pick = HighlightPick(
        title="t",
        hook="h",
        start_seq=3,
        end_seq=4,
        start_quote="w10 w11 w12",
        end_quote="v20 v21 v22",
    )
    hl = snap_highlight([seg_a, seg_b], pick, 0, 60_000)
    assert hl is not None
    assert hl.start_ms == 10 * 400 - 250
    assert hl.end_ms == 25_000 + 22 * 400 + 350 + 250
    assert hl.seq_indexes == [3, 4]

    # No quotes: whole range, clipped to the maximum length at a word boundary.
    hl2 = snap_highlight([seg_a, seg_b], HighlightPick("t", "h", 3, 4), 1, 60_000)
    assert hl2 is not None and hl2.end_ms - hl2.start_ms <= 60_000 + 500


def test_fallback_highlights_and_winner() -> None:
    seg_m = _segment(
        0, SPEAKERS[0], 0, "welcome everyone to the debate", turn_type="moderator_intro"
    )
    seg_a = _segment(1, SPEAKERS[1], 5_000, "yes we should refuse harmful requests")
    seg_b = _segment(2, SPEAKERS[2], 10_000, "no the user must stay in control")
    hls = fallback_highlights([seg_m, seg_a, seg_b], 20_000)
    assert len(hls) == 1 and hls[0].seq_indexes == [1, 2]

    assert extract_winner("## Winner\n**Atlas** wins by a narrow margin.", SPEAKERS) == SPEAKERS[2]
    assert extract_winner("Победа присуждается Нове.", SPEAKERS) is None  # name not present
    assert match_speaker("nova", SPEAKERS) == SPEAKERS[1]
    assert match_speaker(None, SPEAKERS) is None


def test_build_highlights_messages_contains_transcript() -> None:
    seg = _segment(1, SPEAKERS[1], 0, "hello world")
    messages = build_highlights_messages(
        topic="T", language="English", segments=[seg], speakers=SPEAKERS
    )
    assert messages[0]["role"] == "system"
    assert "[1] Nova (rebuttal, 1s): hello world" in messages[1]["content"]
    assert "Nova" in messages[1]["content"] and "Atlas" in messages[1]["content"]
