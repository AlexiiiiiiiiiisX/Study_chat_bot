import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.security import get_current_verified_user
from database import get_db
from middleware.rate_limit import limiter
from models.db_models import (
    Document,
    DocumentStatus,
    RoomMemberRole,
    RoomMembership,
    RoomResource,
    StudyRoom,
    User,
)
from models.schemas import (
    MessageResponse,
    RoomCreateRequest,
    RoomDetailPublic,
    RoomJoinRequest,
    RoomMemberPublic,
    RoomResourcePublic,
    RoomShareDocumentRequest,
    RoomSummaryPublic,
)

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomDetailPublic, status_code=status.HTTP_201_CREATED)
async def create_room(
    data: RoomCreateRequest,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    room = StudyRoom(name=data.name, invite_code=await _new_invite_code(db), owner_id=user.id)
    db.add(room)
    await db.flush()
    db.add(RoomMembership(room_id=room.id, user_id=user.id, role=RoomMemberRole.owner))
    await db.commit()
    return await _room_detail(db, room.id, user.id)


@router.post("/join", response_model=RoomDetailPublic)
@limiter.limit("10/minute")
async def join_room(
    request: Request,
    data: RoomJoinRequest,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StudyRoom).where(StudyRoom.invite_code == data.invite_code))
    room = result.scalar_one_or_none()
    if room is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Código de sala inválido")
    room_id = room.id

    existing = await db.execute(
        select(RoomMembership).where(
            RoomMembership.room_id == room_id,
            RoomMembership.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(RoomMembership(room_id=room_id, user_id=user.id, role=RoomMemberRole.member))
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()

    return await _room_detail(db, room_id, user.id)


@router.get("", response_model=list[RoomSummaryPublic])
async def list_rooms(
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RoomMembership)
        .where(RoomMembership.user_id == user.id)
        .options(
            selectinload(RoomMembership.room).selectinload(StudyRoom.memberships),
            selectinload(RoomMembership.room).selectinload(StudyRoom.resources),
        )
        .order_by(RoomMembership.joined_at.desc())
    )
    return [_summary(membership.room, membership.role) for membership in result.scalars().all()]


@router.get("/resources", response_model=list[RoomResourcePublic])
async def list_shared_resources(
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RoomResource)
        .join(RoomMembership, RoomMembership.room_id == RoomResource.room_id)
        .where(RoomMembership.user_id == user.id)
        .options(
            selectinload(RoomResource.room),
            selectinload(RoomResource.document),
            selectinload(RoomResource.shared_by),
        )
        .order_by(RoomResource.shared_at.desc())
    )
    return [_resource_public(resource) for resource in result.scalars().all()]


@router.get("/{room_id}", response_model=RoomDetailPublic)
async def get_room(
    room_id: uuid.UUID,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    return await _room_detail(db, room_id, user.id)


@router.post("/{room_id}/resources", response_model=RoomResourcePublic, status_code=status.HTTP_201_CREATED)
async def share_document(
    room_id: uuid.UUID,
    data: RoomShareDocumentRequest,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    await _membership(db, room_id, user.id)
    document_result = await db.execute(
        select(Document).where(
            Document.id == data.document_id,
            Document.user_id == user.id,
            Document.status == DocumentStatus.ready,
        )
    )
    document = document_result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solo puedes compartir documentos propios que estén listos")

    existing = await db.execute(
        select(RoomResource).where(
            RoomResource.room_id == room_id,
            RoomResource.document_id == document.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "El documento ya está compartido en esta sala")

    resource = RoomResource(room_id=room_id, document_id=document.id, shared_by_id=user.id)
    db.add(resource)
    await db.commit()
    return await _loaded_resource(db, resource.id)


@router.delete("/{room_id}/resources/{document_id}", response_model=MessageResponse)
async def unshare_document(
    room_id: uuid.UUID,
    document_id: uuid.UUID,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await _membership(db, room_id, user.id)
    result = await db.execute(
        select(RoomResource).where(
            RoomResource.room_id == room_id,
            RoomResource.document_id == document_id,
        )
    )
    resource = result.scalar_one_or_none()
    if resource is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recurso no encontrado")
    if membership.role != RoomMemberRole.owner and resource.shared_by_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No puedes retirar este recurso")

    await db.delete(resource)
    await db.commit()
    return MessageResponse(msg="Recurso retirado de la sala")


@router.delete("/{room_id}/members/me", response_model=MessageResponse)
async def leave_room(
    room_id: uuid.UUID,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await _membership(db, room_id, user.id)
    if membership.role == RoomMemberRole.owner:
        raise HTTPException(status.HTTP_409_CONFLICT, "El propietario debe eliminar la sala")
    await db.delete(membership)
    await db.commit()
    return MessageResponse(msg="Saliste de la sala")


@router.delete("/{room_id}", response_model=MessageResponse)
async def delete_room(
    room_id: uuid.UUID,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await _membership(db, room_id, user.id)
    if membership.role != RoomMemberRole.owner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo el propietario puede eliminar la sala")
    result = await db.execute(select(StudyRoom).where(StudyRoom.id == room_id))
    room = result.scalar_one()
    await db.delete(room)
    await db.commit()
    return MessageResponse(msg="Sala eliminada")


async def _new_invite_code(db: AsyncSession) -> str:
    for _ in range(10):
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        code = "".join(secrets.choice(alphabet) for _ in range(10))
        result = await db.execute(select(StudyRoom.id).where(StudyRoom.invite_code == code))
        if result.scalar_one_or_none() is None:
            return code
    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No se pudo generar un código de invitación")


async def _membership(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> RoomMembership:
    result = await db.execute(
        select(RoomMembership).where(
            RoomMembership.room_id == room_id,
            RoomMembership.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sala no encontrada")
    return membership


async def _room_detail(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> RoomDetailPublic:
    membership = await _membership(db, room_id, user_id)
    result = await db.execute(
        select(StudyRoom)
        .where(StudyRoom.id == room_id)
        .options(
            selectinload(StudyRoom.memberships).selectinload(RoomMembership.user),
            selectinload(StudyRoom.resources).selectinload(RoomResource.document),
            selectinload(StudyRoom.resources).selectinload(RoomResource.shared_by),
        )
    )
    room = result.scalar_one()
    summary = _summary(room, membership.role)
    return RoomDetailPublic(
        **summary.model_dump(),
        members=[
            RoomMemberPublic(
                user_id=item.user_id,
                email=item.user.email,
                role=item.role.value,
                joined_at=item.joined_at,
            )
            for item in sorted(room.memberships, key=lambda item: item.joined_at)
        ],
        resources=[_resource_public(resource) for resource in sorted(room.resources, key=lambda item: item.shared_at, reverse=True)],
    )


async def _loaded_resource(db: AsyncSession, resource_id: uuid.UUID) -> RoomResourcePublic:
    result = await db.execute(
        select(RoomResource)
        .where(RoomResource.id == resource_id)
        .options(
            selectinload(RoomResource.room),
            selectinload(RoomResource.document),
            selectinload(RoomResource.shared_by),
        )
    )
    return _resource_public(result.scalar_one())


def _summary(room: StudyRoom, role: RoomMemberRole) -> RoomSummaryPublic:
    return RoomSummaryPublic(
        id=room.id,
        name=room.name,
        invite_code=room.invite_code,
        owner_id=room.owner_id,
        role=role.value,
        member_count=len(room.memberships),
        resource_count=len(room.resources),
        created_at=room.created_at,
    )


def _resource_public(resource: RoomResource) -> RoomResourcePublic:
    return RoomResourcePublic(
        id=resource.id,
        room_id=resource.room_id,
        room_name=resource.room.name,
        document=resource.document,
        shared_by_id=resource.shared_by_id,
        shared_by_email=resource.shared_by.email,
        shared_at=resource.shared_at,
    )
