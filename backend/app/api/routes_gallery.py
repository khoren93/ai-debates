"""Public gallery of published debates and share links (/d/{slug})."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.serializers import detail_out, gallery_item_out
from app.core.auth import get_current_user
from app.core.db import get_db
from app.models.models import Debate, User
from app.schemas.schemas import GALLERY_CATEGORIES, DebateDetail, GalleryResponse
from app.services.views import count_view

router = APIRouter()


@router.get("", response_model=GalleryResponse)
async def list_gallery(
    category: str | None = Query(None, max_length=40),
    q: str | None = Query(None, max_length=200),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> GalleryResponse:
    conditions: list[ColumnElement[bool]] = [Debate.is_public.is_(True), Debate.slug.is_not(None)]
    if category and category.lower() in GALLERY_CATEGORIES:
        conditions.append(Debate.category == category.lower())
    if q and q.strip():
        conditions.append(Debate.title.ilike(f"%{q.strip()}%"))
    total = await db.scalar(select(func.count(Debate.id)).where(*conditions)) or 0
    stmt = (
        select(Debate)
        .options(selectinload(Debate.participants), selectinload(Debate.user))
        .where(*conditions)
        .order_by(Debate.published_at.desc().nulls_last(), Debate.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    debates = (await db.execute(stmt)).scalars().all()
    return GalleryResponse(items=[gallery_item_out(d) for d in debates], total=int(total))


@router.get("/{slug}", response_model=DebateDetail)
async def get_public_debate(
    slug: str,
    request: Request,
    viewer: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DebateDetail:
    stmt = (
        select(Debate)
        .options(
            selectinload(Debate.turns),
            selectinload(Debate.participants),
            selectinload(Debate.user),
        )
        .where(Debate.slug == slug, Debate.is_public.is_(True))
    )
    debate = (await db.execute(stmt)).scalar_one_or_none()
    if debate is None:
        raise HTTPException(status_code=404, detail="This debate is not public")
    await count_view(db, debate, viewer, request)
    return detail_out(debate, viewer)
