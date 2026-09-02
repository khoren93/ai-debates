"""Build the Timeline document from config, turns and per-turn audio results."""

from typing import Any

from app.schemas.timeline import TimelineSpeaker
from app.services.media.script import spoken_speaker_name

PALETTE: tuple[str, ...] = (
    "#22D3EE",
    "#F97316",
    "#A78BFA",
    "#34D399",
    "#F472B6",
    "#60A5FA",
    "#FB7185",
    "#FBBF24",
)
MASCOTS: tuple[str, ...] = ("orb", "bolt", "cube")
MODERATOR_COLOR = "#9CA3AF"
JUDGE_COLOR = "#FBBF24"


def short_model_name(model_id: str) -> str:
    """ "openai/gpt-4o-mini" -> "gpt-4o-mini"."""
    return (model_id or "").split("/", 1)[-1].split(":")[0]


def build_speakers(
    participants: list[dict[str, Any]], language_code: str, judge_model: str
) -> list[TimelineSpeaker]:
    speakers: list[TimelineSpeaker] = []
    debater_index = 0
    for i, p in enumerate(participants):
        role = "moderator" if p.get("role") == "moderator" else "debater"
        if role == "debater":
            color = PALETTE[debater_index % len(PALETTE)]
            mascot = MASCOTS[debater_index % len(MASCOTS)]
            debater_index += 1
        else:
            color = MODERATOR_COLOR
            mascot = "cube"
        speakers.append(
            TimelineSpeaker(
                id=f"participant_{i}",
                name=str(
                    p.get("display_name")
                    or ("Moderator" if role == "moderator" else f"Debater {i}")
                ),
                role=role,
                model=short_model_name(str(p.get("model_id") or "")),
                color=color,
                mascot=mascot,  # type: ignore[arg-type]
                avatar_url=p.get("avatar_url"),
            )
        )
    speakers.append(
        TimelineSpeaker(
            id="judge",
            name=spoken_speaker_name("Verdict", language_code),
            role="judge",
            model=short_model_name(judge_model),
            color=JUDGE_COLOR,
            mascot="cube",
        )
    )
    return speakers
