from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://user:contraseña@localhost:puerto/study_chat_bot"

    # --- JWT ---
    JWT_SECRET: str  # generar con: openssl rand -hex 32
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MIN: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- App ---
    ENVIRONMENT: str = "development"  # development | production
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    COOKIE_SECURE: bool = False  # True en producción (requiere HTTPS)

    # --- LLM / RAG ---
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-flash"          # bueno relación costo/calidad
    GEMINI_MODEL_LITE: str = "gemini-2.5-flash-lite"  # para flashcards/quiz, más barato
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # --- Google OAuth (lo conectamos en el siguiente paso) ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
