import pytest

from app.services.media.llm import extract_json


def test_extract_json_plain_fenced_and_prose() -> None:
    assert extract_json('{"a": 1}') == {"a": 1}
    assert extract_json('```json\n{"a": [1, 2]}\n```') == {"a": [1, 2]}
    assert extract_json('Sure! Here it is: {"a": "b"} hope it helps') == {"a": "b"}
    with pytest.raises(ValueError):
        extract_json("no json here")
