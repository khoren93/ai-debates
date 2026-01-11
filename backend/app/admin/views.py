from sqladmin import ModelView
from app.models.models import Debate, DebateParticipant, Turn, Session

class DebateAdmin(ModelView, model=Debate):
    column_list = [Debate.id, Debate.status, Debate.created_at, Debate.session_id]
    can_delete = False
    name = "Debate"
    name_plural = "Debates"
    icon = "fa-solid fa-comments"
    column_searchable_list = [Debate.id, Debate.session_id]
    column_sortable_list = [Debate.created_at, Debate.status]

class ParticipantAdmin(ModelView, model=DebateParticipant):
    column_list = [DebateParticipant.id, DebateParticipant.debate_id, DebateParticipant.role, DebateParticipant.model_id]
    can_delete = False
    name = "Participant"
    name_plural = "Participants"
    icon = "fa-solid fa-users"

class TurnAdmin(ModelView, model=Turn):
    column_list = [Turn.id, Turn.debate_id, Turn.seq_index, Turn.speaker_name, Turn.created_at]
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
