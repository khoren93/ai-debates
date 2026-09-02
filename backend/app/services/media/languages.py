"""Map the free-text `DebateConfig.language` display name to a BCP-47-ish code."""

LANGUAGE_CODES: dict[str, str] = {
    "english": "en",
    "russian": "ru",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "chinese": "zh",
    "italian": "it",
    "portuguese": "pt",
    "japanese": "ja",
    "korean": "ko",
    "armenian": "hy",
    "ukrainian": "uk",
    "polish": "pl",
    "turkish": "tr",
    "arabic": "ar",
    "hindi": "hi",
    "dutch": "nl",
}


def language_code(name: str | None) -> str:
    key = (name or "").strip().lower()
    if not key:
        return "en"
    if key in LANGUAGE_CODES:
        return LANGUAGE_CODES[key]
    # Already a code such as "en" or "ru-RU".
    if len(key) in (2, 5) and key[:2].isalpha():
        return key[:2]
    return "en"
