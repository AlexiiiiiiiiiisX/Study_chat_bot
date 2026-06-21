from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from config import settings
from database import init_db
from middleware.rate_limit import limiter
from routers import auth, chat, documents, flashcards, quizzes, dashboard, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: crear tablas si no existen (en producción, usar Alembic en su lugar)
    if settings.ENVIRONMENT == "development":
        await init_db()
    yield
    # Shutdown: aquí cerrarías conexiones extra si las hubiera


app = FastAPI(
    title="Study Chat Bot API",
    version="1.0.0",
    lifespan=lifespan,
)

# --- Rate limiting ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,  # necesario para que el navegador envíe la cookie httpOnly
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# --- Headers de seguridad básicos ---
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


# --- Routers ---
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(flashcards.router)
app.include_router(quizzes.router)
app.include_router(dashboard.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
