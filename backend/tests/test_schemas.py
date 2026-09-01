import pytest
from pydantic import ValidationError

from app.schemas.schemas import DebateConfig

MOD = {"role": "moderator", "model_id": "m/mod", "display_name": "Moderator"}
DEB = {"role": "debater", "model_id": "m/deb", "display_name": "Alice"}


def test_minimal_config_defaults():
    cfg = DebateConfig.model_validate({"topic": "Cats vs dogs", "participants": [DEB]})
    assert cfg.num_rounds == 3
    assert cfg.length_preset == "medium"
    assert cfg.intensity == 5
    assert cfg.user_provider_key is None


def test_provider_key_is_excluded_from_persisted_config():
    cfg = DebateConfig.model_validate(
        {"topic": "t", "participants": [MOD, DEB], "user_provider_key": "sk-or-secret"}
    )
    dumped = cfg.model_dump(exclude={"user_provider_key"})
    assert "user_provider_key" not in dumped
    assert dumped["participants"][0]["role"] == "moderator"


@pytest.mark.parametrize(
    "participants",
    [
        [],
        [MOD],
        [MOD, MOD, DEB],
    ],
)
def test_participant_rules(participants):
    with pytest.raises(ValidationError):
        DebateConfig.model_validate({"topic": "t", "participants": participants})


@pytest.mark.parametrize("field,value", [("num_rounds", 0), ("num_rounds", 11), ("intensity", 0)])
def test_numeric_bounds(field, value):
    with pytest.raises(ValidationError):
        DebateConfig.model_validate({"topic": "t", "participants": [DEB], field: value})


def test_invalid_role_and_length_preset():
    with pytest.raises(ValidationError):
        DebateConfig.model_validate({"topic": "t", "participants": [{**DEB, "role": "judge"}]})
    with pytest.raises(ValidationError):
        DebateConfig.model_validate({"topic": "t", "participants": [DEB], "length_preset": "huge"})
