from collections.abc import AsyncGenerator

from core.llm import gemini_client
from core.vectorstore import query as vector_query

COLLECTION_NAME = "study_documents"

SYSTEM_PROMPT = (
    "Eres un asistente de estudio. Responde SOLO usando el contexto proporcionado, citando "
    "la página de donde sale cada dato cuando sea posible (ej. '(página 4)'). "
    "Si la respuesta no está en el contexto, dilo claramente en lugar de inventar información. "
    "Sé claro, conciso y didáctico, como si le explicaras a un compañero de clase."
)


def retrieve_context(*, user_id: str, question: str, document_id: str | None, n_results: int = 4) -> dict:
    where: dict = {"user_id": user_id}
    if document_id:
        where = {"$and": [{"user_id": user_id}, {"document_id": document_id}]}

    results = vector_query(
        collection_name=COLLECTION_NAME,
        query_text=question,
        n_results=n_results,
        where=where,
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    sources = [
        {
            "content": doc[:300],
            "source": meta.get("source", "desconocido"),
            "page": meta.get("page"),
            "score": dist,
        }
        for doc, meta, dist in zip(documents, metadatas, distances)
    ]

    if documents:
        context_text = "\n\n---\n\n".join(
            f"[Página {m.get('page', '?')}] {d}" for d, m in zip(documents, metadatas)
        )
    else:
        context_text = "No hay documentos relevantes en la base de conocimiento del usuario."

    return {"context_text": context_text, "sources": sources}


def build_prompt(question: str, context_text: str) -> str:
    return (
        f"Contexto:\n{context_text}\n\n"
        f"Pregunta del estudiante: {question}\n\n"
        f"Respuesta:"
    )


async def stream_answer(
    *, user_id: str, question: str, document_id: str | None = None
) -> AsyncGenerator[dict, None]:
    """
    Generador asíncrono que primero emite las fuentes recuperadas y luego
    va emitiendo la respuesta token por token. Pensado para volcarse
    directamente a un StreamingResponse en formato SSE.
    """
    retrieval = retrieve_context(user_id=user_id, question=question, document_id=document_id)

    yield {"type": "sources", "data": retrieval["sources"]}

    prompt = build_prompt(question, retrieval["context_text"])
    async for token in gemini_client.generate_stream(prompt=prompt, system=SYSTEM_PROMPT):
        yield {"type": "token", "data": token}

    yield {"type": "done", "data": None}


async def answer_question(*, user_id: str, question: str, document_id: str | None = None) -> dict:
    """Versión no-streaming (útil para tests o integraciones que no usan SSE)."""
    retrieval = retrieve_context(user_id=user_id, question=question, document_id=document_id)
    prompt = build_prompt(question, retrieval["context_text"])
    answer = await gemini_client.generate(prompt=prompt, system=SYSTEM_PROMPT)
    return {"answer": answer, "sources": retrieval["sources"]}
