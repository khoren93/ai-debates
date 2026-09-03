"""Login state for API requests. The signed session cookie (SessionMiddleware) carries
the user id; the same cookie also holds the admin panel login, under a different key."""

import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.models import User

SESSION_USER_KEY = "uid"
ADMIN_SESSION_KEY = "token"


def login_session(request: Request, user: User) -> None:
    request.session[SESSION_USER_KEY] = str(user.id)


def logout_session(request: Request) -> None:
    request.session.pop(SESSION_USER_KEY, None)


def is_admin_session(request: Request) -> bool:
    return request.session.get(ADMIN_SESSION_KEY) == "authenticated"


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    """The logged-in user, or None for anonymous requests."""
    raw = request.session.get(SESSION_USER_KEY)
    if not raw:
        return None
    try:
        user_id = uuid.UUID(str(raw))
    except ValueError:
        logout_session(request)
        return None
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        logout_session(request)
        return None
    return user


async def require_user(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue")
    return user
