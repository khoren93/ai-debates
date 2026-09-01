import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # session_id cookie
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    debates: Mapped[list["Debate"]] = relationship("Debate", back_populates="session")


class Debate(Base):
    __tablename__ = "debates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("sessions.id"), nullable=True, index=True
    )

    # queued | running | completed | error | stopped
    status: Mapped[str] = mapped_column(String, default="queued", index=True)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Full DebateConfig JSON (never contains user API keys)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Aggregated stats: {tokens_in, tokens_out, cost, turns_count}
    totals_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    session: Mapped["Session | None"] = relationship("Session", back_populates="debates")
    turns: Mapped[list["Turn"]] = relationship(
        "Turn",
        back_populates="debate",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Turn.seq_index",
    )
    participants: Mapped[list["DebateParticipant"]] = relationship(
        "DebateParticipant",
        back_populates="debate",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="DebateParticipant.id",
    )


class DebateParticipant(Base):
    """Normalized table for analytics (e.g., finding all debates with GPT-4)."""

    __tablename__ = "debate_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("debates.id", ondelete="CASCADE")
    )

    role: Mapped[str] = mapped_column(String)  # moderator | debater
    model_id: Mapped[str] = mapped_column(String)  # openrouter model id
    persona_name: Mapped[str | None] = mapped_column(String, nullable=True)
    voice_name: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

    debate: Mapped["Debate"] = relationship("Debate", back_populates="participants")


class Turn(Base):
    __tablename__ = "turns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("debates.id", ondelete="CASCADE"), index=True
    )

    seq_index: Mapped[int] = mapped_column(Integer)  # Order 0, 1, 2...
    round_id: Mapped[str] = mapped_column(String)  # e.g. "round_1", "verdict"
    # moderator_intro | moderator_transition | opening | rebuttal | closing | argument | verdict
    turn_type: Mapped[str] = mapped_column(String)

    speaker_id: Mapped[str] = mapped_column(String)
    speaker_name: Mapped[str] = mapped_column(String)

    text: Mapped[str] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    word_count: Mapped[int] = mapped_column(Integer, default=0)

    model_used: Mapped[str] = mapped_column(String)
    # {prompt_tokens, completion_tokens, total_tokens, cost}
    usage_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    retake_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    debate: Mapped["Debate"] = relationship("Debate", back_populates="turns")


class Preset(Base):
    __tablename__ = "presets"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # e.g. "classic_v1"
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    preset_json: Mapped[dict[str, Any]] = mapped_column(JSON)
