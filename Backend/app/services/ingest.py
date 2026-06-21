import io
import uuid

from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from core.vectorstore import add_documents

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=120,
    separators=["\n\n", "\n", ". ", " ", ""],
)

COLLECTION_NAME = "study_documents"


class EmptyDocumentError(Exception):
    """El PDF no contiene texto extraíble (ej. son solo imágenes escaneadas sin OCR)."""


def extract_pages(pdf_bytes: bytes) -> list[str]:
    """Devuelve una lista donde el índice i = texto de la página i+1."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text.strip())
    return pages


def chunk_with_pages(pages: list[str]) -> list[dict]:
    """
    Trocea cada página por separado para no perder la referencia de página.
    Devuelve [{"text": ..., "page": N}, ...]
    """
    chunks = []
    for page_number, page_text in enumerate(pages, start=1):
        if not page_text:
            continue
        for piece in _splitter.split_text(page_text):
            chunks.append({"text": piece, "page": page_number})
    return chunks


async def ingest_pdf(*, user_id: str, document_id: str, filename: str, pdf_bytes: bytes) -> dict:
    """
    Procesa un PDF completo: extrae texto por página, trocea, genera embeddings
    y los guarda en Chroma con metadata para poder filtrar por usuario/documento
    y citar la página exacta de origen.
    """
    pages = extract_pages(pdf_bytes)
    chunks = chunk_with_pages(pages)

    if not chunks:
        raise EmptyDocumentError(
            "No se pudo extraer texto del PDF. Si es un documento escaneado, necesita OCR."
        )

    ids = [str(uuid.uuid4()) for _ in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [
        {
            "user_id": user_id,
            "document_id": document_id,
            "source": filename,
            "page": c["page"],
        }
        for c in chunks
    ]

    add_documents(collection_name=COLLECTION_NAME, ids=ids, documents=documents, metadatas=metadatas)

    return {"total_pages": len(pages), "total_chunks": len(chunks)}
