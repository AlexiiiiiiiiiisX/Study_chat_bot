import json
from collections.abc import AsyncGenerator

from google import genai
from google.genai import types

from config import settings

_client = genai.Client(api_key=settings.GEMINI_API_KEY)


class GeminiClient:
    """Cliente para Gemini: texto normal, streaming y salida JSON estructurada."""

    def __init__(self, model: str | None = None):
        self.model = model or settings.GEMINI_MODEL

    async def generate(self, prompt: str, system: str | None = None, temperature: float = 0.3) -> str:
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
        )
        response = await _client.aio.models.generate_content(
            model=self.model,
            contents=prompt,
            config=config,
        )
        return response.text or ""

    async def generate_stream(
        self, prompt: str, system: str | None = None, temperature: float = 0.3
    ) -> AsyncGenerator[str, None]:
        """Genera la respuesta token por token (para Server-Sent Events)."""
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
        )
        stream = await _client.aio.models.generate_content_stream(
            model=self.model,
            contents=prompt,
            config=config,
        )
        async for chunk in stream:
            if chunk.text:
                yield chunk.text

    async def generate_json(
        self,
        prompt: str,
        response_schema: dict,
        system: str | None = None,
        temperature: float = 0.4,
    ) -> dict | list:
        """
        Pide al modelo una respuesta que cumpla un JSON schema (usado para
        flashcards y quizzes). Devuelve ya el dict/list parseado.
        """
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            response_mime_type="application/json",
            response_schema=response_schema,
        )
        response = await _client.aio.models.generate_content(
            model=self.model,
            contents=prompt,
            config=config,
        )
        return json.loads(response.text)


# Cliente "lite" para tareas masivas/baratas como flashcards y quizzes
gemini_client = GeminiClient(model=settings.GEMINI_MODEL)
gemini_lite_client = GeminiClient(model=settings.GEMINI_MODEL_LITE)
