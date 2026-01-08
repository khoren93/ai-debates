from typing import List
from fastapi import APIRouter
from app.schemas.schemas import Preset

router = APIRouter()

# Simple static presets for MVP
PRESETS_DB = [
    {
        "id": "classic_v1",
        "name": "Classic Debate (6 Rounds)",
        "description": "Standard format: Openings, Rebuttals, Closing.",
        "preset_json": {
            "rounds": [
                {"type": "moderator_intro", "round_index": 0},
                {"type": "opening", "round_index": 1, "speakers": "all"},
                {"type": "rebuttal", "round_index": 2, "speakers": "all"},
                {"type": "rebuttal", "round_index": 3, "speakers": "all"},
                {"type": "closing", "round_index": 4, "speakers": "all"},
                {"type": "moderator_outro", "round_index": 5}
            ]
        }
    },
    {
        "id": "blitz_v1",
        "name": "Blitz Debate (3 Rounds)",
        "description": "Fast paced: Opening, Rebuttal, Closing.",
        "preset_json": {
            "rounds": [
                 {"type": "moderator_intro", "round_index": 0},
                 {"type": "opening", "round_index": 1, "speakers": "all"},
                 {"type": "closing", "round_index": 2, "speakers": "all"}
            ]
        }
    }
]

@router.get("", response_model=List[Preset])
def get_presets():
    """
    Get list of available debate presets.
    """
    return PRESETS_DB
