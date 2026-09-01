"""Pure turn-scheduling logic for a debate.

A debate with a moderator and N debaters runs `num_rounds` rounds. Each round
starts with the moderator (intro on round 1, a short transition afterwards)
followed by every debater once. The verdict is appended by the worker after
the last scheduled turn.
"""

from dataclasses import dataclass
from typing import Any

# "moderator_comment" is the legacy type used by debates created before v0.2.
MODERATOR_TURN_TYPES = frozenset(
    {"moderator_intro", "moderator_transition", "moderator_comment", "verdict"}
)


@dataclass(frozen=True)
class ScheduledTurn:
    seq_index: int
    round_number: int  # 1-based
    turn_type: str
    speaker_index: int  # index into the debate's participants list

    @property
    def round_id(self) -> str:
        return f"round_{self.round_number}"

    @property
    def is_moderator(self) -> bool:
        return self.turn_type in MODERATOR_TURN_TYPES


def speaker_role_for(turn_type: str) -> str:
    return "moderator" if turn_type in MODERATOR_TURN_TYPES else "debater"


def debater_turn_type(round_number: int, num_rounds: int) -> str:
    if num_rounds <= 1:
        return "argument"
    if round_number == 1:
        return "opening"
    if round_number == num_rounds:
        return "closing"
    return "rebuttal"


def build_schedule(participants: list[dict[str, Any]], num_rounds: int) -> list[ScheduledTurn]:
    """Return the ordered list of turns for the given participant config."""
    num_rounds = max(1, int(num_rounds))
    moderator_idx = next(
        (i for i, p in enumerate(participants) if p.get("role") == "moderator"), None
    )
    debater_idxs = [i for i, p in enumerate(participants) if p.get("role") == "debater"]

    schedule: list[ScheduledTurn] = []
    seq = 0
    for round_number in range(1, num_rounds + 1):
        if moderator_idx is not None:
            turn_type = "moderator_intro" if round_number == 1 else "moderator_transition"
            schedule.append(ScheduledTurn(seq, round_number, turn_type, moderator_idx))
            seq += 1
        for d_idx in debater_idxs:
            turn_type = debater_turn_type(round_number, num_rounds)
            schedule.append(ScheduledTurn(seq, round_number, turn_type, d_idx))
            seq += 1
    return schedule
