"""Blocking SQLAlchemy session for RQ jobs (the API uses app.core.db instead)."""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

_SessionLocal: sessionmaker[Session] | None = None


def get_sync_session() -> Session:
    """Blocking DB session. The engine is created lazily so that forked RQ
    work-horses never share a connection pool with the parent process."""
    global _SessionLocal
    if _SessionLocal is None:
        engine = create_engine(settings.sync_database_url, poolclass=NullPool)
        _SessionLocal = sessionmaker(bind=engine)
    return _SessionLocal()
