import json
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core.security import get_current_verified_user
from models.db_models import User
from models.schemas import ChatRequest, ChatResponse
from services.chat import stream_answer, answer_question

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/ask")
async def ask(data: ChatRequest, user: User = Depends(get_current_verified_user)):
    """
    Responde la pregunta en streaming usando Server-Sent Events.
    El frontend debe leer el stream y reaccionar a los eventos:
      - event: sources -> lista de chunks fuente (con página)
      - event: token   -> un fragmento de texto de la respuesta
      - event: done     -> fin del stream
    """
    session_id = data.session_id or uuid.uuid4()
    document_id = str(data.document_id) if data.document_id else None

    async def event_generator():
        async for chunk in stream_answer(
            user_id=str(user.id),
            question=data.question,
            document_id=document_id,
        ):
            payload = {**chunk, "session_id": str(session_id)}
            yield f"event: {chunk['type']}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # evita buffering en proxies tipo nginx
        },
    )


@router.post("/ask-sync", response_model=ChatResponse)
async def ask_sync(data: ChatRequest, user: User = Depends(get_current_verified_user)):
    """Variante sin streaming, útil para pruebas automatizadas (pytest) o integraciones simples."""
    document_id = str(data.document_id) if data.document_id else None
    result = await answer_question(user_id=str(user.id), question=data.question, document_id=document_id)
    return ChatResponse(
        answer=result["answer"],
        sources=result["sources"],
        session_id=data.session_id or uuid.uuid4(),
    )
