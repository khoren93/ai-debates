from sqladmin import ModelView

from app.models.models import Debate, DebateParticipant, Session, Turn


class DebateAdmin(ModelView, model=Debate):
    column_list = [Debate.id, Debate.title, Debate.status, Debate.created_at, Debate.ended_at]
    column_searchable_list = [Debate.id, Debate.title, Debate.status]
    column_sortable_list = [Debate.created_at, Debate.status]
    column_default_sort = (Debate.created_at, True)
    can_delete = True
    name = "Debate"
    name_plural = "Debates"
    icon = "fa-solid fa-comments"


class ParticipantAdmin(ModelView, model=DebateParticipant):
    column_list = [
        DebateParticipant.id,
        DebateParticipant.debate_id,
        DebateParticipant.role,
        DebateParticipant.persona_name,
        DebateParticipant.model_id,
    ]
    can_delete = False
    name = "Participant"
    name_plural = "Participants"
    icon = "fa-solid fa-users"


class TurnAdmin(ModelView, model=Turn):
    column_list = [
        Turn.id,
        Turn.debate_id,
        Turn.seq_index,
        Turn.turn_type,
        Turn.speaker_name,
        Turn.model_used,
        Turn.created_at,
    ]
    column_sortable_list = [Turn.created_at, Turn.seq_index]
    can_delete = False
    name = "Turn"
    name_plural = "Turns"
    icon = "fa-solid fa-microphone"


class SessionAdmin(ModelView, model=Session):
    column_list = [Session.id, Session.created_at, Session.last_seen_at]
    can_delete = False
    name = "Session"
    name_plural = "Sessions"
    icon = "fa-solid fa-user"
