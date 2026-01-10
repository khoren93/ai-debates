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
        
        # Determine Max Turns
        # If num_rounds is specified: (num_rounds * 2 debaters) + maybe moderator intros?
        # Let's simplify: 1 Round = Mod + Debater1 + Debater2
        num_rounds = conf.get('num_rounds', 3)
        turns_per_round = len(debaters) + 1 if moderator else len(debaters)
        max_turns_total = num_rounds * turns_per_round
        
        if seq_index >= max_turns_total:
             # Add Verdict Job here before finishing
            q.enqueue("app.services.orchestrator.conduct_verdict_job", debate_id=debate_id, seq_index=seq_index)
            return

        # Simple Round Robin: Mod -> D1 -> D2 -> Mod...
        cycle_len = len(debaters) + (1 if moderator else 0)
        pos_in_cycle = seq_index % cycle_len
        
        if moderator and pos_in_cycle == 0:
            speaker = moderator
            turn_type = "moderator_comment"
        else:
            # debater index
            # if mod exists, debaters start at index 1. so pos_in_cycle 1 -> debater 0
            d_idx = (pos_in_cycle - 1) if moderator else pos_in_cycle
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
            conf.get('intensity', 5),
            conf.get('language', 'English')
        )

        # Handling length_preset
        length_preset = conf.get('length_preset', 'medium')
        length_map = {
            'very_short': 'Keep your response very short and concise, around 50 words.',
            'short': 'Keep your response short, around 100 words.',
            'medium': 'Keep your response medium length, around 250 words.',
            'long': 'You can provide a detailed response, around 500 words or more.'
        }
        length_instruction = length_map.get(length_preset, length_map['medium'])
        system_prompt += f"\n\n{length_instruction}"
        
        # 4. Generate - Real OpenRouter Call
        full_text = ""
        
        # Build Context (History)
        prev_turns = db.query(Turn).filter(Turn.debate_id == uuid.UUID(debate_id)).order_by(Turn.seq_index).all()
        history_str = ""
        for t in prev_turns:
            history_str += f"{t.speaker_name}: {t.text}\n\n"
            
        user_content = f"The debate topic is: {conf.get('topic')}. \n"
        if conf.get('description'):
            user_content += f"Context: {conf.get('description')}\n"
            
        # Add Participants Info
        user_content += "\nParticipants:\n"
        for p in participants:
             user_content += f"- {p.get('display_name')} ({p.get('role')})\n"
        
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
            "text": full_text,
            "speaker_name": speaker['display_name']
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


def conduct_verdict_job(debate_id: str, seq_index: int):
    """
    Job 2.5: Generate Final Verdict (Judge/Moderator)
    """
    db = SessionLocal()
    try:
        debate = db.query(Debate).filter(Debate.id == uuid.UUID(debate_id)).first()
        if not debate: return

        conf = debate.config_json
        # Use moderator as judge
        moderator = next((p for p in conf.get('participants', []) if p['role'] == 'moderator'), None)
        if not moderator:
            # Fallback if no moderator found
            moderator = {
                "role": "moderator",
                "display_name": "AI Judge",
                "model_id": "google/gemini-2.0-flash-exp:free" 
            }
        
        publish_event(debate_id, "turn_started", {
            "seq_index": seq_index,
            "speaker_name": "⚖️ Moderator (Verdict)"
        })

        # Build Prompt for Verdict
        language = conf.get('language', 'English')
        
        system_prompt = f"""You are an expert Debate Judge. 
        Your task is to analyze the debate history provided by the user.
        
        Strictly follow this structure in your response (use Markdown):
        1. **Winner**: Declare the winner (or a draw) based on argument strength, logic, and persuasion.
        2. **Analysis**: Briefly analyze the performance of each participant.
        3. **Key Arguments**: Highlight the strongest points made.
        4. **Logical Fallacies**: Point out any logical errors or weak arguments.
        
        Output Language: {language}
        Style: Objective, Professional, and Analytical.
        FORMATTING: You MUST use bolding, lists, and headers.
        """

        # Build Context (History)
        prev_turns = db.query(Turn).filter(Turn.debate_id == uuid.UUID(debate_id)).order_by(Turn.seq_index).all()
        history_str = ""
        for t in prev_turns:
            history_str += f"{t.speaker_name}: {t.text}\n\n"
            
        user_content = f"The debate topic was: {conf.get('topic')}. \n"
        if conf.get('description'):
            user_content += f"Context: {conf.get('description')}\n"
        
        user_content += f"\nFull Debate Transcript:\n{history_str}\n"
        user_content += f"Please provide your final verdict now."

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        
        client = OpenRouterClient()
        full_text = ""
        
        async def run_generation():
            text_accumulator = ""
            try:
                model_id = moderator.get('model_id') or "google/gemini-2.0-flash-exp:free"
                async for chunk in client.create_chat_completion(model_id, messages):
                    text_accumulator += chunk
                    publish_event(debate_id, "turn_delta", {
                        "seq_index": seq_index,
                        "delta": chunk,
                        "speaker_name": "⚖️ Moderator (Verdict)"
                    })
            except Exception as ex:
                print(f"Verdict Generation Error: {ex}")
                text_accumulator += f" [Error: {ex}]"
            return text_accumulator

        full_text = asyncio.run(run_generation())

        # Save Verdict Turn
        new_turn = Turn(
            debate_id=uuid.UUID(debate_id),
            seq_index=seq_index,
            round_id="verdict",
            turn_type="verdict",
            speaker_id=moderator.get('model_id'),
            speaker_name="⚖️ Moderator (Verdict)",
            text=full_text,
            word_count=len(full_text.split()),
            model_used=moderator.get('model_id', 'unknown')
        )
        db.add(new_turn)
        db.commit()

        publish_event(debate_id, "turn_completed", {
            "seq_index": seq_index,
            "text": full_text,
            "speaker_name": "⚖️ Moderator (Verdict)"
        })

        # Finally, finish debate
        q.enqueue("app.services.orchestrator.finish_debate_job", debate_id=debate_id)

    except Exception as e:
        print(f"Verdict Job Error: {e}")
        # Ensure we still close the debate if judge fails
        q.enqueue("app.services.orchestrator.finish_debate_job", debate_id=debate_id)
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
