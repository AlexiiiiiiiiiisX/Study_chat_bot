import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.access import get_accessible_document
from core.security import get_current_verified_user
from models.db_models import User, Flashcard
from models.schemas import FlashcardPublic, FlashcardGenerateRequest
from services.flashcards import generate_flashcards

router = APIRouter(prefix="/flashcards", tags=["flashcards"])


@router.post("/generate", response_model=list[FlashcardPublic], status_code=status.HTTP_201_CREATED)
async def generate(
    data: FlashcardGenerateRequest,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    document = await get_accessible_document(db, data.document_id, user.id)

    raw_cards = await generate_flashcards(document_id=str(document.id), count=data.count)
    if not raw_cards:
        raise HTTPException(400, "No se pudieron generar flashcards para este documento")

    cards = [
        Flashcard(
            document_id=document.id,
            question=c["question"],
            answer=c["answer"],
            page_reference=c.get("page"),
        )
        for c in raw_cards
    ]
    db.add_all(cards)
    await db.commit()
    for c in cards:
        await db.refresh(c)
    return cards


@router.get("/document/{document_id}", response_model=list[FlashcardPublic])
async def list_by_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    await get_accessible_document(db, document_id, user.id)
    result = await db.execute(
        select(Flashcard).where(Flashcard.document_id == document_id).order_by(Flashcard.created_at)
    )
    return result.scalars().all()
