from sqlalchemy import select, func
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.security import get_current_verified_user
from models.db_models import User, Document, Flashcard, QuizAttempt
from models.schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/me", response_model=DashboardStats)
async def my_dashboard(
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    total_documents = await db.scalar(
        select(func.count(Document.id)).where(Document.user_id == user.id)
    ) or 0

    total_flashcards = await db.scalar(
        select(func.count(Flashcard.id))
        .join(Document, Flashcard.document_id == Document.id)
        .where(Document.user_id == user.id)
    ) or 0

    attempts_result = await db.execute(
        select(QuizAttempt.score, QuizAttempt.total_questions, QuizAttempt.created_at)
        .where(QuizAttempt.user_id == user.id)
    )
    attempts = attempts_result.all()

    total_attempts = len(attempts)
    if total_attempts > 0:
        avg_pct = sum((a.score / a.total_questions) * 100 for a in attempts if a.total_questions) / total_attempts
        last_activity = max(a.created_at for a in attempts)
    else:
        avg_pct = 0.0
        last_activity = None

    return DashboardStats(
        total_documents=total_documents,
        total_flashcards=total_flashcards,
        total_quiz_attempts=total_attempts,
        average_quiz_score_pct=round(avg_pct, 1),
        last_activity=last_activity,
    )
