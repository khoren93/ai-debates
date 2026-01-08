from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
import uuid

from app.core.db import get_db
from app.models.models import Debate, DebateParticipant, Turn
from app.schemas.schemas import DebateConfig, DebateResponse
from app.services.queue_manager import enqueue_debate_start

router = APIRouter()

@router.get("/", response_model=List[dict])
async def list_debates(db: AsyncSession = Depends(get_db)):
    """List all debates ordered by creation time."""
    stmt = select(Debate).order_by(Debate.created_at.desc())
    result = await db.execute(stmt)
    debates = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "title": d.title,
            "status": d.status,
            "created_at": d.created_at
        }
        for d in debates
    ]


@router.post("/", response_model=DebateResponse, status_code=status.HTTP_201_CREATED)
async def create_debate(
    config: DebateConfig,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new debate and enqueue it for processing.
    """
    # 1. Create Debate record
    new_debate = Debate(
        title=f"Debate: {config.topic[:50]}...",
        config_json=config.model_dump(),
        status="queued"
    )
    db.add(new_debate)
    await db.flush() # flush to get ID
    
    # 2. Add Participants (for analytics)
    # Moderator
    mod_config = next((p for p in config.participants if p.role == 'moderator'), None)
    if mod_config:
        mod_participant = DebateParticipant(
            debate_id=new_debate.id,
            role="moderator",
            model_id=mod_config.model_id,
            persona_name=mod_config.display_name
        )
        db.add(mod_participant)

    # Debaters
    for p in config.participants:
        if p.role == 'debater':
            deb_participant = DebateParticipant(
                debate_id=new_debate.id,
                role="debater",
                model_id=p.model_id,
                persona_name=p.display_name
            )
            db.add(deb_participant)
    
    await db.commit()
    
    # 3. Enqueue Job
    try:
        enqueue_debate_start(str(new_debate.id))
    except Exception as e:
        print(f"Failed to enqueue: {e}")
        # In a real app we might want to rollback or mark as error, 
        # but for now we just verify redis connection is up
        new_debate.status = "error"
        await db.commit()
        raise HTTPException(status_code=500, detail="Failed to start debate worker")
        
    return {
        "debate_id": str(new_debate.id),
        "status": "queued",
        "message": "Debate created and queued successfully"
    }

@router.get("/{debate_id}")
async def get_debate(debate_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get debate details and status, including turns and participants.
    """
    try:
        uuid_id = uuid.UUID(debate_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    stmt = (
        select(Debate)
        .options(selectinload(Debate.turns), selectinload(Debate.participants))
        .where(Debate.id == uuid_id)
    )
    result = await db.execute(stmt)
    debate = result.scalar_one_or_none()
    
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
        
    return {
        "id": str(debate.id),
        "status": debate.status,
        "title": debate.title,
        "created_at": debate.created_at,
        "participants": [
            {"name": p.persona_name, "role": p.role, "model": p.model_id}
            for p in debate.participants
        ],
        "turns": sorted(
            [
                {
                    "seq_index": t.seq_index,
                    "speaker_name": t.speaker_name,
                    "text": t.text,
                    "created_at": t.created_at
                }
                for t in debate.turns
            ],
            key=lambda x: x["seq_index"]
        )
    }
