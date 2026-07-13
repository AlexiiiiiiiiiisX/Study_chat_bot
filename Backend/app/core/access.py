import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.db_models import Document, RoomMembership, RoomResource


async def get_accessible_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Document:
    """Return an owned document or one shared with a room containing the user."""
    owned = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    document = owned.scalar_one_or_none()
    if document is not None:
        return document

    shared = await db.execute(
        select(Document)
        .join(RoomResource, RoomResource.document_id == Document.id)
        .join(
            RoomMembership,
            (RoomMembership.room_id == RoomResource.room_id)
            & (RoomMembership.user_id == user_id),
        )
        .where(Document.id == document_id)
        .limit(1)
    )
    document = shared.scalar_one_or_none()
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")
    return document
