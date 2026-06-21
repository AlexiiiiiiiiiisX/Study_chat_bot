import uuid

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.security import get_current_verified_user
from core.vectorstore import delete_document_chunks
from models.db_models import User, Document, DocumentStatus
from models.schemas import DocumentPublic
from services.ingest import ingest_pdf, EmptyDocumentError, COLLECTION_NAME

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_FILE_SIZE_MB = 20


@router.post("/upload", response_model=DocumentPublic, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se aceptan archivos PDF")

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"El archivo supera el límite de {MAX_FILE_SIZE_MB}MB")

    document = Document(
        user_id=user.id,
        filename=file.filename,
        status=DocumentStatus.processing,
    )
    db.add(document)
    await db.flush()  # para tener document.id disponible antes del commit

    try:
        result = await ingest_pdf(
            user_id=str(user.id),
            document_id=str(document.id),
            filename=file.filename,
            pdf_bytes=raw_bytes,
        )
        document.total_pages = result["total_pages"]
        document.total_chunks = result["total_chunks"]
        document.status = DocumentStatus.ready
    except EmptyDocumentError as e:
        document.status = DocumentStatus.failed
        document.error_message = str(e)
    except Exception as e:
        document.status = DocumentStatus.failed
        document.error_message = "Error inesperado procesando el documento"

    await db.commit()
    await db.refresh(document)
    return document


@router.get("", response_model=list[DocumentPublic])
async def list_documents(
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentPublic)
async def get_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_owned_document(db, document_id, user.id)
    return document


@router.delete("/{document_id}", response_model=dict)
async def delete_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_owned_document(db, document_id, user.id)

    # Borra los chunks/embeddings en Chroma y luego el registro en Postgres
    delete_document_chunks(COLLECTION_NAME, str(document.id))
    await db.delete(document)
    await db.commit()
    return {"msg": "Documento eliminado"}


async def _get_owned_document(db: AsyncSession, document_id: uuid.UUID, user_id: uuid.UUID) -> Document:
    """Helper: obtiene un documento verificando que pertenece al usuario (aislamiento de datos)."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")
    return document
