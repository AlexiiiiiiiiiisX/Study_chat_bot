from sqlalchemy import select
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.security import require_admin
from models.db_models import User
from models.schemas import UserPublic

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserPublic])
async def list_users(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Solo administradores pueden ver el listado completo de usuarios de la plataforma."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()
