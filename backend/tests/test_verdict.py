from app.services.verdict import (
    build_verdict_parse_messages,
    debaters_from_config,
    fallback_verdict,
    parse_verdict_payload,
)

CONF = {
    "topic": "Is pineapple pizza good?",
    "participants": [
        {"role": "moderator", "display_name": "Host"},
        {"role": "debater", "display_name": "Alice"},
        {"role": "debater", "display_name": "Bob"},
    ],
}
DEBATERS = debaters_from_config(CONF)


def test_debaters_from_config_skips_moderator():
    assert DEBATERS == [
        {"id": "participant_1", "name": "Alice"},
        {"id": "participant_2", "name": "Bob"},
    ]


def test_parse_payload_with_winner_and_feedback():
    payload = {
        "winner": "alice",
        "headline": "Alice wins the debate.",
        "feedback": [
            {"name": "Alice", "text": "Strong evidence."},
            {"name": "Bob", "text": "Weak rebuttals."},
            {"name": "Nobody", "text": "ignored"},
        ],
    }
    out = parse_verdict_payload(payload, DEBATERS)
    assert out is not None
    assert out["winner_id"] == "participant_1"
    assert out["winner_name"] == "Alice"
    assert out["is_draw"] is False
    assert [f["speaker_id"] for f in out["feedback"]] == ["participant_1", "participant_2"]
    assert out["source"] == "llm"


def test_parse_payload_draw():
    out = parse_verdict_payload({"winner": None, "headline": "It is a draw."}, DEBATERS)
    assert out is not None
    assert out["winner_id"] is None
    assert out["is_draw"] is True


def test_parse_payload_rejects_garbage():
    assert parse_verdict_payload("nope", DEBATERS) is None
    assert parse_verdict_payload({}, DEBATERS) is None


def test_fallback_finds_winner_in_english():
    text = "**Winner** — Bob wins this debate thanks to sharper rebuttals. Alice was solid too."
    out = fallback_verdict(text, DEBATERS)
    assert out["winner_id"] == "participant_2"
    assert out["is_draw"] is False
    assert out["headline"].startswith("Winner")
    assert out["source"] == "fallback"


def test_fallback_detects_draw_and_strips_tags():
    text = "[calm] The debate ends in a draw. Both sides argued well."
    out = fallback_verdict(text, DEBATERS)
    assert out["winner_id"] is None
    assert out["is_draw"] is True
    assert out["headline"] == "The debate ends in a draw."


def test_fallback_russian():
    text = "Победителем становится Alice, её аргументы были убедительнее."
    out = fallback_verdict(text, DEBATERS)
    assert out["winner_id"] == "participant_1"


def test_parse_messages_mention_debaters():
    messages = build_verdict_parse_messages(
        topic="t", language="English", verdict_text="Alice wins", debaters=DEBATERS
    )
    assert messages[0]["role"] == "system"
    assert "Alice, Bob" in messages[1]["content"]
    assert "JSON" in messages[1]["content"]
