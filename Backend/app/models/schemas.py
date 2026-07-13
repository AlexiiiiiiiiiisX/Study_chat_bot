import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("La contraseña debe contener al menos una mayúscula")
        if not re.search(r"[a-z]", v):
            raise ValueError("La contraseña debe contener al menos una minúscula")
        if not re.search(r"\d", v):
            raise ValueError("La contraseña debe contener al menos un número")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("La contraseña debe contener al menos un carácter especial")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: str
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    msg: str


# ---------------------------------------------------------------------------
# Documentos
# ---------------------------------------------------------------------------

class DocumentPublic(BaseModel):
    id: uuid.UUID
    filename: str
    total_pages: int
    total_chunks: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Chat / RAG
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_id: uuid.UUID | None = None  # si se omite, busca en todos los docs del usuario
    session_id: uuid.UUID | None = None


class SourceChunk(BaseModel):
    content: str
    source: str
    page: int | None = None
    score: float | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceChunk] = []
    session_id: uuid.UUID


# ---------------------------------------------------------------------------
# Flashcards
# ---------------------------------------------------------------------------

class FlashcardPublic(BaseModel):
    id: uuid.UUID
    question: str
    answer: str
    page_reference: int | None = None

    model_config = {"from_attributes": True}


class FlashcardGenerateRequest(BaseModel):
    document_id: uuid.UUID
    count: int = Field(default=10, ge=3, le=30)


# ---------------------------------------------------------------------------
# Quizzes
# ---------------------------------------------------------------------------

class QuizQuestionPublic(BaseModel):
    id: uuid.UUID
    question: str
    options: list[str]
    page_reference: int | None = None
    # Nota: correct_index y explanation NO se exponen aquí para no filtrar la respuesta

    model_config = {"from_attributes": True}


class QuizPublic(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    questions: list[QuizQuestionPublic]

    model_config = {"from_attributes": True}


class QuizGenerateRequest(BaseModel):
    document_id: uuid.UUID
    count: int = Field(default=5, ge=3, le=20)


class QuizAnswer(BaseModel):
    question_id: uuid.UUID
    selected_index: int = Field(ge=0)


class QuizSubmitRequest(BaseModel):
    answers: list[QuizAnswer]


class QuizResultItem(BaseModel):
    question_id: uuid.UUID
    correct: bool
    correct_index: int
    explanation: str | None = None


class QuizSubmitResponse(BaseModel):
    score: int
    total_questions: int
    results: list[QuizResultItem]


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    total_documents: int
    total_flashcards: int
    total_quiz_attempts: int
    average_quiz_score_pct: float
    last_activity: datetime | None = None


# ---------------------------------------------------------------------------
# Salas de estudio
# ---------------------------------------------------------------------------

class RoomCreateRequest(BaseModel):
    name: str = Field(min_length=3, max_length=120)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 3:
            raise ValueError("El nombre debe tener al menos 3 caracteres")
        return value


class RoomJoinRequest(BaseModel):
    invite_code: str = Field(min_length=6, max_length=12)

    @field_validator("invite_code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()


class RoomShareDocumentRequest(BaseModel):
    document_id: uuid.UUID


class RoomMemberPublic(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    role: str
    joined_at: datetime


class RoomSummaryPublic(BaseModel):
    id: uuid.UUID
    name: str
    invite_code: str
    owner_id: uuid.UUID
    role: str
    member_count: int
    resource_count: int
    created_at: datetime


class RoomResourcePublic(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    room_name: str
    document: DocumentPublic
    shared_by_id: uuid.UUID
    shared_by_email: EmailStr
    shared_at: datetime


class RoomDetailPublic(RoomSummaryPublic):
    members: list[RoomMemberPublic]
    resources: list[RoomResourcePublic]
