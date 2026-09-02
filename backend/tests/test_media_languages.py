from app.services.media.languages import language_code


def test_language_code_names_and_codes() -> None:
    assert language_code("English") == "en"
    assert language_code("russian") == "ru"
    assert language_code("Chinese") == "zh"
    assert language_code("ru") == "ru"
    assert language_code("ru-RU") == "ru"
    assert language_code(None) == "en"
    assert language_code("Klingon") == "en"
