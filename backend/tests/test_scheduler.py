from app.services.scheduler import build_schedule, debater_turn_type, speaker_role_for

MOD = {"role": "moderator", "display_name": "Moderator"}
D1 = {"role": "debater", "display_name": "Alice"}
D2 = {"role": "debater", "display_name": "Bob"}


def test_schedule_with_moderator_three_rounds():
    schedule = build_schedule([MOD, D1, D2], 3)
    assert len(schedule) == 9
    assert [t.seq_index for t in schedule] == list(range(9))

    types = [t.turn_type for t in schedule]
    assert types == [
        "moderator_intro",
        "opening",
        "opening",
        "moderator_transition",
        "rebuttal",
        "rebuttal",
        "moderator_transition",
        "closing",
        "closing",
    ]
    assert [t.round_id for t in schedule[:3]] == ["round_1"] * 3
    assert schedule[-1].round_id == "round_3"
    assert schedule[0].speaker_index == 0 and schedule[0].is_moderator
    assert schedule[1].speaker_index == 1 and not schedule[1].is_moderator


def test_schedule_without_moderator():
    schedule = build_schedule([D1, D2], 2)
    assert [t.turn_type for t in schedule] == ["opening", "opening", "closing", "closing"]
    assert all(not t.is_moderator for t in schedule)


def test_single_round_uses_argument_type():
    schedule = build_schedule([MOD, D1, D2], 1)
    assert [t.turn_type for t in schedule] == ["moderator_intro", "argument", "argument"]


def test_moderator_position_is_irrelevant():
    schedule = build_schedule([D1, MOD, D2], 1)
    assert schedule[0].speaker_index == 1
    assert schedule[0].turn_type == "moderator_intro"
    assert [t.speaker_index for t in schedule[1:]] == [0, 2]


def test_num_rounds_is_clamped():
    assert len(build_schedule([D1, D2], 0)) == 2


def test_debater_turn_type_boundaries():
    assert debater_turn_type(1, 1) == "argument"
    assert debater_turn_type(1, 2) == "opening"
    assert debater_turn_type(2, 2) == "closing"
    assert debater_turn_type(2, 4) == "rebuttal"


def test_speaker_role_for_covers_legacy_types():
    assert speaker_role_for("moderator_comment") == "moderator"
    assert speaker_role_for("verdict") == "moderator"
    assert speaker_role_for("argument") == "debater"
    assert speaker_role_for("rebuttal") == "debater"
