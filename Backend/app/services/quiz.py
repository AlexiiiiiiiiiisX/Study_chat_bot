from core.llm import gemini_lite_client
from services.flashcards import _build_context  # reutilizamos el armado de contexto

SYSTEM_PROMPT = (
    "Eres un asistente que crea quizzes de opción múltiple a partir de material académico. "
    "Cada pregunta debe tener exactamente 4 opciones, solo una correcta, y una breve "
    "explicación de por qué es correcta. Evita preguntas ambiguas o con doble respuesta válida."
)

QUIZ_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "question": {"type": "STRING"},
            "options": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "minItems": 4,
                "maxItems": 4,
            },
            "correct_index": {"type": "INTEGER"},
            "explanation": {"type": "STRING"},
            "page": {"type": "INTEGER", "nullable": True},
        },
        "required": ["question", "options", "correct_index", "explanation"],
    },
}


async def generate_quiz_questions(*, document_id: str, count: int = 5) -> list[dict]:
    context = _build_context(document_id)
    if not context:
        return []

    prompt = (
        f"A partir del siguiente material, genera exactamente {count} preguntas de opción "
        f"múltiple (4 opciones cada una, índice 0-3 para la correcta).\n\n"
        f"Material:\n{context}"
    )

    result = await gemini_lite_client.generate_json(
        prompt=prompt,
        response_schema=QUIZ_SCHEMA,
        system=SYSTEM_PROMPT,
    )

    if not isinstance(result, list):
        return []

    # Sanitiza: nos asegura que correct_index sea válido (0-3) antes de persistir
    clean = []
    for q in result:
        options = q.get("options", [])
        idx = q.get("correct_index", 0)
        if len(options) == 4 and 0 <= idx <= 3:
            clean.append(q)
    return clean
