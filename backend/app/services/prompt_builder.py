"""Builds chat messages for moderator, debater and verdict turns."""

from typing import Any

from app.services.scheduler import ScheduledTurn

LENGTH_WORDS: dict[str, int] = {
    "very_short": 50,
    "short": 100,
    "medium": 250,
    "long": 500,
}

_TURN_INSTRUCTIONS: dict[str, str] = {
    "argument": "Present your full position on the topic with your strongest arguments.",
    "opening": (
        "This is your OPENING statement. Clearly state your position and lay out "
        "your two or three strongest arguments."
    ),
    "rebuttal": (
        "This is a REBUTTAL round. Directly address and counter the strongest points "
        "made by your opponents so far, then reinforce your own position."
    ),
    "closing": (
        "This is your CLOSING statement. Summarize why your position prevails, address "
        "the key objections raised, and finish with a memorable conclusion. "
        "Do not introduce new arguments."
    ),
}


def intensity_description(intensity: int) -> str:
    if intensity <= 2:
        return "Be extremely polite, calm, and academic."
    if intensity <= 4:
        return "Be measured, courteous, and thoughtful."
    if intensity <= 6:
        return "Be firm, engaging, and persuasive."
    if intensity <= 8:
        return "Be assertive, energetic, and pointed in your criticism."
    return "Be very passionate, dramatic, and intense, but respectful."


def length_words(length_preset: str) -> int:
    return LENGTH_WORDS.get(length_preset, LENGTH_WORDS["medium"])


def _history_block(history: list[dict[str, Any]]) -> str:
    if not history:
        return "(No statements yet — the debate is just beginning.)"
    return "\n\n".join(f"{t['speaker_name']}: {t['text']}" for t in history)


def _participants_block(participants: list[dict[str, Any]]) -> str:
    return "\n".join(f"- {p.get('display_name')} ({p.get('role')})" for p in participants)


def _common_rules(language: str, words: int) -> str:
    return (
        f"\nIMPORTANT: Write your response in {language}."
        f"\nLength: about {words} words. Stay within this limit."
        "\nFORMATTING: Use Markdown (bold, italics, short lists) to make your text readable."
        "\nDo NOT prefix your response with your own name or role. Speak in first person."
    )


def build_debater_messages(
    conf: dict[str, Any],
    speaker: dict[str, Any],
    turn: ScheduledTurn,
    history: list[dict[str, Any]],
) -> list[dict[str, str]]:
    words = length_words(conf.get("length_preset", "medium"))
    language = conf.get("language", "English")
    persona = speaker.get("persona_custom") or "You are a skilled, well-informed debater."

    system = (
        f"You are a participant in a structured debate. Your name is {speaker['display_name']}.\n"
        f"Persona and stance: {persona}\n"
        f"Style: {intensity_description(int(conf.get('intensity', 5)))}"
        + _common_rules(language, words)
    )

    user = (
        f"Debate topic: {conf.get('topic')}\n"
        + (f"Context: {conf['description']}\n" if conf.get("description") else "")
        + f"\nParticipants:\n{_participants_block(conf.get('participants', []))}\n"
        f"\nDebate so far:\n{_history_block(history)}\n"
        f"\nRound {turn.round_number} of {conf.get('num_rounds', 1)}. "
        f"{_TURN_INSTRUCTIONS.get(turn.turn_type, _TURN_INSTRUCTIONS['argument'])}\n"
        f"It is now your turn, {speaker['display_name']}."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_moderator_messages(
    conf: dict[str, Any],
    speaker: dict[str, Any],
    turn: ScheduledTurn,
    history: list[dict[str, Any]],
) -> list[dict[str, str]]:
    # Moderator interjections are short regardless of the debate length preset.
    words = min(length_words(conf.get("length_preset", "medium")), 120)
    language = conf.get("language", "English")
    persona = speaker.get("persona_custom") or "You are an impartial, articulate debate moderator."
    participants = conf.get("participants", [])
    debaters = [p for p in participants if p.get("role") == "debater"]
    num_rounds = int(conf.get("num_rounds", 1))

    system = (
        f"You are the moderator of a structured debate. Your name is {speaker['display_name']}.\n"
        f"{persona}\n"
        "You never argue for a side and never give your own opinion on the topic."
        + _common_rules(language, words)
    )

    if turn.turn_type == "moderator_intro":
        task = (
            "Open the debate: welcome the audience, introduce the topic in one or two sentences, "
            "introduce each debater by name, briefly explain the format "
            f"({num_rounds} round(s)), and invite {debaters[0]['display_name']} to begin."
            if debaters
            else "Open the debate and introduce the topic."
        )
    else:
        task = (
            f"Round {turn.round_number - 1} has just ended. In a few sentences, neutrally summarize "
            f"the key points made so far, then open round {turn.round_number} of {num_rounds} "
            f"and hand over to {debaters[0]['display_name']}."
            if debaters
            else f"Open round {turn.round_number}."
        )

    user = (
        f"Debate topic: {conf.get('topic')}\n"
        + (f"Context: {conf['description']}\n" if conf.get("description") else "")
        + f"\nParticipants:\n{_participants_block(participants)}\n"
        f"\nDebate so far:\n{_history_block(history)}\n"
        f"\nYour task: {task}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_verdict_messages(
    conf: dict[str, Any], history: list[dict[str, Any]]
) -> list[dict[str, str]]:
    language = conf.get("language", "English")
    system = (
        "You are an expert, impartial debate judge.\n"
        "Analyze the full debate transcript provided by the user and deliver a verdict.\n"
        "Strictly follow this structure (use Markdown headers and bold text):\n"
        "1. **Winner** — declare the winner (or a draw) based on argument strength, "
        "logic, and persuasiveness.\n"
        "2. **Analysis** — briefly evaluate each debater's performance.\n"
        "3. **Key Arguments** — highlight the strongest points made.\n"
        "4. **Logical Fallacies** — point out weak reasoning or fallacies, if any.\n"
        f"\nWrite in {language}. Style: objective, professional, analytical."
    )
    user = (
        f"Debate topic: {conf.get('topic')}\n"
        + (f"Context: {conf['description']}\n" if conf.get("description") else "")
        + f"\nFull transcript:\n{_history_block(history)}\n"
        "\nPlease deliver your final verdict now."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
