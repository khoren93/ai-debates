from decimal import Decimal

from app.core.config import settings
from app.models.models import Debate
from app.services.credits import debate_charge_usd, to_usd, tts_charge_usd, uses_own_key


def _debate(cost: float, own_key: bool) -> Debate:
    return Debate(
        config_json={"topic": "t", "billing": {"own_key": own_key}},
        totals_json={"cost": cost},
    )


def test_to_usd_rounds_to_micro_dollars():
    assert to_usd(0.1234567) == Decimal("0.123457")
    assert to_usd(None) == Decimal("0")


def test_debate_charge_applies_markup():
    debate = _debate(0.5, own_key=False)
    expected = to_usd(Decimal("0.5") * Decimal(str(settings.CREDIT_MARKUP)))
    assert debate_charge_usd(debate) == expected


def test_own_key_is_free():
    debate = _debate(0.5, own_key=True)
    assert uses_own_key(debate)
    assert debate_charge_usd(debate) == Decimal("0")


def test_tts_charge_per_thousand_chars():
    per_1k = Decimal(str(settings.TTS_CREDIT_PRICE_PER_1K_CHARS))
    assert tts_charge_usd(2000) == to_usd(per_1k * 2)
    assert tts_charge_usd(0) == Decimal("0")
    assert tts_charge_usd(-5) == Decimal("0")
