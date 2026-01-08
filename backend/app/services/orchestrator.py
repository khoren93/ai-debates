import time
import json
import uuid
import asyncio
from typing import Optional
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, Session
from rq import Queue
import redis

from app.core.config import settings
from app.models.models import Debate, Turn
from app.services.events import publish_event
from app.services.prompt_builder import prompt_builder
from app.services.openrouter_client import OpenRouterClient

# Sync DB setup for Worker
SYNC_DB_URL = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
engine = create_engine(SYNC_DB_URL)
SessionLocal = sessionmaker(bind=engine)

# Redis Queue for chaining
redis_conn = redis.from_url(settings.REDIS_URL)
q = Queue(connection=redis_conn)

# --- Jobs ---

def start_debate_job(debate_id: str):
    """
    Job 1: Initialize debate
    """
    db = SessionLocal()
    try:
        debate = db.query(Debate).filter(Debate.id == uuid.UUID(debate_id)).first()
        if not debate:
            print(f"Debate {debate_id} not found")
            return

        debate.status = "running"
        debate.started_at = datetime.utcnow()
        db.commit()

        # Notify
        publish_event(debate_id, "debate_started", {
            "debate_id": debate_id,
            "status": "running"
        })

        # Start Chain: Turn 0
        q.enqueue(
            "app.services.orchestrator.process_turn_job",
            debate_id=debate_id,
            seq_index=0
        )
    finally:
        db.close()


def process_turn_job(debate_id: str, seq_index: int):
    """
    Job 2: Process a single turn
    """
    db = SessionLocal()
    try:
        debate = db.query(Debate).filter(Debate.id == uuid.UUID(debate_id)).first()
        if not debate or debate.status != "running":
             # Stopped or Error
            return

        conf = debate.config_json
        # 1. Determine Speaker & Round (Simplified Logic for MVP)
        # Using a fixed mapped logic based on presets would go here.
        # For MVP, let's just rotate debaters.
        
        participants = conf.get('participants', [])
        debaters = [p for p in participants if p['role'] == 'debater']
        moderator = next((p for p in participants if p['role'] == 'moderator'), None)
        
        max_turns = conf.get('limits', {}).get('max_turns_total', 10)
        
        if seq_index >= max_turns:
            q.enqueue("app.services.orchestrator.finish_debate_job", debate_id=debate_id)
            return

        # Simple Round Robin: Mod -> D1 -> D2 -> Mod...
        is_mod_turn = (seq_index % (len(debaters) + 1)) == 0
        
        if is_mod_turn:
            speaker = moderator
            turn_type = "moderator_comment"
        else:
            # debater index
            d_idx = (seq_index - 1) % len(debaters)
            speaker = debaters[d_idx]
            turn_type = "argument"

        # 2. Publish Start Turn
        publish_event(debate_id, "turn_started", {
            "seq_index": seq_index,
            "speaker_name": speaker['display_name']
        })

        # 3. Build Prompt (Mocking context fetch)
        # last_turns = db.query(Turn)... limit(5)
        # For now empty context
        system_prompt = prompt_builder.build_system_prompt(
            speaker['role'], 
            speaker.get('persona_custom', 'Standard'), 
            conf.get('intensity', 5)
        )
        
        # 4. Generate - Real OpenRouter Call
        full_text = ""
        
        # Build Context (History)
        prev_turns = db.query(Turn).filter(Turn.debate_id == uuid_id).order_by(Turn.seq_index).all()
        history_str = ""
        for t in prev_turns:
            history_str += f"{t.speaker_name}: {t.text}\n\n"
            
        user_content = f"The debate topic is: {conf.get('topic')}. \n"
        if conf.get('description'):
            user_content += f"Context: {conf.get('description')}\n"
        
        user_content += f"\nDebate History:\n{history_str}\n"
        user_content += f"Now it is your turn, {speaker['display_name']}. Please provide your argument."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        
        client = OpenRouterClient()
        
        async def run_generation():
            text_accumulator = ""
            try:
                # Use model from speaker config, fallback to free model
                model_id = speaker.get('model_id') or "google/gemini-2.0-flash-exp:free"
                # Check for BYOK API Key usually passed in debate config or settings
                # For now using global settings
                async for chunk in client.create_chat_completion(model_id, messages):
                    text_accumulator += chunk
                    # Publish delta
                    publish_event(debate_id, "turn_delta", {
                        "seq_index": seq_index,
                        "delta": chunk,
                        "speaker_name": speaker['display_name']
                    })
            except Exception as ex:
                print(f"LLM Generation Error: {ex}")
                text_accumulator += f" [Error generating response: {ex}]"
                publish_event(debate_id, "turn_delta", {"seq_index": seq_index, "delta": f" [Error: {ex}]"})
            return text_accumulator

        full_text = asyncio.run(run_generation())

        # 5. Save Turn
        new_turn = Turn(
            debate_id=uuid.UUID(debate_id),
            seq_index=seq_index,
            round_id="round_1", # placeholder
            turn_type=turn_type,
            speaker_id=speaker.get('model_id'),
            speaker_name=speaker['display_name'],
            text=full_text,
            word_count=len(full_text.split()),
            model_used=speaker.get('model_id', 'unknown')
        )
        db.add(new_turn)
        db.commit()

        publish_event(debate_id, "turn_completed", {
            "seq_index": seq_index,
            "text": full_text
        })

        # 6. Next Job
        q.enqueue(
            "app.services.orchestrator.process_turn_job",
            debate_id=debate_id,
            seq_index=seq_index + 1
        )
        
    except Exception as e:
        print(f"Error in turn {seq_index}: {e}")
        # Optionally fail debate
    finally:
        db.close()


def finish_debate_job(debate_id: str):
    """
    Job 3: Cleanup
    """
    db = SessionLocal()
    try:
        debate = db.query(Debate).filter(Debate.id == uuid.UUID(debate_id)).first()
        if debate:
            debate.status = "completed"
            debate.ended_at = datetime.utcnow()
            db.commit()
            
            publish_event(debate_id, "debate_completed", {
                "debate_id": debate_id
            })
    finally:
        db.close()

from datetime import datetime # Late import fix
