import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from core.security import get_current_verified_user
from models.db_models import User, Document, Quiz, QuizQuestion, QuizAttempt
from models.schemas import (
    QuizGenerateRequest,
    QuizPublic,
    QuizSubmitRequest,
    QuizSubmitResponse,
    QuizResultItem,
)
from services.quiz import generate_quiz_questions

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.post("/generate", response_model=QuizPublic, status_code=status.HTTP_201_CREATED)
async def generate(
    data: QuizGenerateRequest,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_owned_document(db, data.document_id, user.id)

    raw_questions = await generate_quiz_questions(document_id=str(document.id), count=data.count)
    if not raw_questions:
        raise HTTPException(400, "No se pudo generar el quiz para este documento")

    quiz = Quiz(document_id=document.id, title=f"Quiz: {document.filename}")
    db.add(quiz)
    await db.flush()

    questions = [
        QuizQuestion(
            quiz_id=quiz.id,
            question=q["question"],
            options=q["options"],
            correct_index=q["correct_index"],
            explanation=q.get("explanation"),
            page_reference=q.get("page"),
        )
        for q in raw_questions
    ]
    db.add_all(questions)
    await db.commit()

    quiz = await _get_quiz_with_questions(db, quiz.id)
    return quiz


@router.get("/document/{document_id}", response_model=list[QuizPublic])
async def list_by_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_document(db, document_id, user.id)
    result = await db.execute(
        select(Quiz)
        .where(Quiz.document_id == document_id)
        .options(selectinload(Quiz.questions))
        .order_by(Quiz.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{quiz_id}", response_model=QuizPublic)
async def get_quiz(
    quiz_id: uuid.UUID,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    quiz = await _get_quiz_with_questions(db, quiz_id)
    await _assert_quiz_ownership(db, quiz, user.id)
    return quiz


@router.post("/{quiz_id}/submit", response_model=QuizSubmitResponse)
async def submit_quiz(
    quiz_id: uuid.UUID,
    data: QuizSubmitRequest,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    quiz = await _get_quiz_with_questions(db, quiz_id)
    await _assert_quiz_ownership(db, quiz, user.id)

    questions_by_id = {q.id: q for q in quiz.questions}
    results = []
    score = 0

    for answer in data.answers:
        question = questions_by_id.get(answer.question_id)
        if question is None:
            continue
        is_correct = answer.selected_index == question.correct_index
        if is_correct:
            score += 1
        results.append(
            QuizResultItem(
                question_id=question.id,
                correct=is_correct,
                correct_index=question.correct_index,
                explanation=question.explanation,
            )
        )

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        score=score,
        total_questions=len(quiz.questions),
        answers=[a.model_dump(mode="json") for a in data.answers],
    )
    db.add(attempt)
    await db.commit()

    return QuizSubmitResponse(score=score, total_questions=len(quiz.questions), results=results)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_owned_document(db: AsyncSession, document_id: uuid.UUID, user_id: uuid.UUID) -> Document:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")
    return document


async def _get_quiz_with_questions(db: AsyncSession, quiz_id: uuid.UUID) -> Quiz:
    result = await db.execute(
        select(Quiz).where(Quiz.id == quiz_id).options(selectinload(Quiz.questions))
    )
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz no encontrado")
    return quiz


async def _assert_quiz_ownership(db: AsyncSession, quiz: Quiz, user_id: uuid.UUID) -> None:
    """El quiz pertenece a un documento; verificamos que ese documento sea del usuario."""
    result = await db.execute(
        select(Document.id).where(Document.id == quiz.document_id, Document.user_id == user_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz no encontrado")
