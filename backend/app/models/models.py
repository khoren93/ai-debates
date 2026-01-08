import uuid
from datetime import datetime
from typing import Optional, Any
from sqlalchemy import String, Integer, DateTime, Boolean, JSON, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base

class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # session_id cookie
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    debates: Mapped[list["Debate"]] = relationship("Debate", back_populates="session")


class Debate(Base):
    __tablename__ = "debates"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("sessions.id"), nullable=True, index=True)
    
    # queued, running, completed, error, stopped
    status: Mapped[str] = mapped_column(String, default="queued", index=True)
    title: Mapped[str] = mapped_column(String, nullable=True)
    
    # Full DebateConfig JSON
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, default={})
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Aggregated stats: {tokens_in, tokens_out, cost, turns_count}
    totals_json: Mapped[dict[str, Any]] = mapped_column(JSON, default={})

    session: Mapped[Optional["Session"]] = relationship("Session", back_populates="debates")
    turns: Mapped[list["Turn"]] = relationship("Turn", back_populates="debate", cascade="all, delete-orphan")
    participants: Mapped[list["DebateParticipant"]] = relationship("DebateParticipant", back_populates="debate", cascade="all, delete-orphan")


class DebateParticipant(Base):
    """Normalized table for analytics (e.g., finding all debates with GPT-4)"""
    __tablename__ = "debate_participants"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debates.id"))
    
    role: Mapped[str] = mapped_column(String)  # moderator, debater
    model_id: Mapped[str] = mapped_column(String) # openrouter model id
    persona_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    voice_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    debate: Mapped["Debate"] = relationship("Debate", back_populates="participants")


class Turn(Base):
    __tablename__ = "turns"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debates.id"), index=True)
    
    seq_index: Mapped[int] = mapped_column(Integer) # Order 0, 1, 2...
    round_id: Mapped[str] = mapped_column(String) # e.g. "opening_1"
    turn_type: Mapped[str] = mapped_column(String) # opening, rebuttal...
    
    speaker_id: Mapped[str] = mapped_column(String)
    speaker_name: Mapped[str] = mapped_column(String)
    
    text: Mapped[str] = mapped_column(Text)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    
    model_used: Mapped[str] = mapped_column(String)
    # {tokens_in, tokens_out, cost}
    usage_json: Mapped[dict[str, Any]] = mapped_column(JSON, default={})
    
    retake_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    debate: Mapped["Debate"] = relationship("Debate", back_populates="turns")


class Preset(Base):
    __tablename__ = "presets"
    
    id: Mapped[str] = mapped_column(String, primary_key=True) # e.g. "classic_v1"
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    preset_json: Mapped[dict[str, Any]] = mapped_column(JSON)
