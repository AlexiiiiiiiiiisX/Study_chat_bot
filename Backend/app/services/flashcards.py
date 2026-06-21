from core.llm import gemini_lite_client
from core.vectorstore import get_document_chunks

COLLECTION_NAME = "study_documents"

SYSTEM_PROMPT = (
    "Eres un asistente que crea flashcards de estudio (pregunta/respuesta) a partir de "
    "material académico. Las preguntas deben ser claras y evaluar comprensión real, no "
    "solo memorización literal. Las respuestas deben ser concisas (1-3 oraciones)."
)

FLASHCARD_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "question": {"type": "STRING"},
            "answer": {"type": "STRING"},
            "page": {"type": "INTEGER", "nullable": True},
        },
        "required": ["question", "answer"],
    },
}

MAX_CONTEXT_CHARS = 12000


def _build_context(document_id: str) -> str:
    chunks = get_document_chunks(COLLECTION_NAME, document_id)
    documents = chunks.get("documents", [])
    metadatas = chunks.get("metadatas", [])

    parts = []
    total_len = 0
    for doc, meta in zip(documents, metadatas):
        piece = f"[Página {meta.get('page', '?')}] {doc}"
        if total_len + len(piece) > MAX_CONTEXT_CHARS:
            break
        parts.append(piece)
        total_len += len(piece)

    return "\n\n".join(parts)


async def generate_flashcards(*, document_id: str, count: int = 10) -> list[dict]:
    context = _build_context(document_id)
    if not context:
        return []

    prompt = (
        f"A partir del siguiente material, genera exactamente {count} flashcards.\n\n"
        f"Material:\n{context}"
    )

    result = await gemini_lite_client.generate_json(
        prompt=prompt,
        response_schema=FLASHCARD_SCHEMA,
        system=SYSTEM_PROMPT,
    )
    return result if isinstance(result, list) else []
