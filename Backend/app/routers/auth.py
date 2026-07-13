import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from config import settings
from models.db_models import User, RefreshToken
from models.schemas import UserCreate, UserLogin, TokenResponse, MessageResponse, UserPublic
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from middleware.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION_MIN = 15
REFRESH_COOKIE_NAME = "refresh_token"

oauth = OAuth()
if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
    oauth.register(
        name="google",
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        client_kwargs={"scope": "openid email profile"},
    )


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,       # True en producción (requiere HTTPS)
        samesite="strict",
        max_age=60 * 60 * 24 * settings.REFRESH_TOKEN_EXPIRE_DAYS,
        path="/auth",                         # solo se envía a rutas de auth
    )


async def _create_session(user: User, request: Request, response: Response, db: AsyncSession) -> str:
    """Emite los mismos tokens para login local y proveedores externos."""
    access_token = create_access_token(str(user.id))
    refresh_token, jti, expires_at = create_refresh_token(str(user.id))
    db.add(
        RefreshToken(
            jti=jti,
            user_id=user.id,
            expires_at=expires_at,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    )
    await db.commit()
    _set_refresh_cookie(response, refresh_token)
    return access_token


# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------

@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none() is not None:
        # Respuesta genérica para no filtrar si el email existe (mitiga enumeración de usuarios)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se pudo completar el registro")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        # En desarrollo no hay flujo de email todavía; en producción se conserva la verificación.
        is_verified=settings.ENVIRONMENT == "development",
    )
    db.add(user)
    await db.commit()

    if user.is_verified:
        return MessageResponse(msg="Usuario creado. Ya puedes iniciar sesión.")

    # TODO: generar token de verificación y enviar email (ver services/email.py)
    return MessageResponse(msg="Usuario creado. Revisa tu email para verificar la cuenta.")


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    # Mensaje idéntico tanto si el usuario no existe como si la password es incorrecta
    generic_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Email o contraseña incorrectos")

    if user is None:
        raise generic_error

    # Bloqueo temporal por intentos fallidos
    if user.locked_until and user.locked_until > _utcnow():
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Cuenta bloqueada temporalmente. Intenta de nuevo más tarde.",
        )

    if not verify_password(data.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = _utcnow() + timedelta(minutes=LOCK_DURATION_MIN)
            user.failed_login_attempts = 0
        await db.commit()
        raise generic_error

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cuenta deshabilitada")

    if not user.is_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email no verificado")

    # Login correcto: resetear contador de intentos fallidos
    user.failed_login_attempts = 0
    user.locked_until = None

    access_token = await _create_session(user, request, response, db)
    return TokenResponse(access_token=access_token)


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

@router.get("/google")
async def google_login(request: Request):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "El acceso con Google no está configurado")
    return await oauth.google.authorize_redirect(request, settings.GOOGLE_REDIRECT_URI)


@router.get("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    error_url = f"{settings.FRONTEND_ORIGIN}/login?error=google_auth_failed"
    try:
        token = await oauth.google.authorize_access_token(request)
        userinfo = token.get("userinfo") or await oauth.google.userinfo(token=token)
        google_sub = userinfo.get("sub")
        email = userinfo.get("email")
        email_verified = userinfo.get("email_verified")
        if not google_sub or not email or email_verified is not True:
            return RedirectResponse(error_url, status_code=status.HTTP_303_SEE_OTHER)

        result = await db.execute(select(User).where(User.google_sub == google_sub))
        user = result.scalar_one_or_none()
        if user is None:
            # Una cuenta local con el mismo email verificado se enlaza a Google.
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if user is None:
                user = User(email=email, google_sub=google_sub, is_verified=True)
                db.add(user)
                await db.flush()
            elif user.google_sub is None:
                user.google_sub = google_sub
                user.is_verified = True
            else:
                # El mismo correo no debe permitir vincular dos identidades Google.
                return RedirectResponse(error_url, status_code=status.HTTP_303_SEE_OTHER)

        if not user.is_active:
            return RedirectResponse(error_url, status_code=status.HTTP_303_SEE_OTHER)

        response = RedirectResponse(
            f"{settings.FRONTEND_ORIGIN}/login#access_token=",
            status_code=status.HTTP_303_SEE_OTHER,
        )
        access_token = await _create_session(user, request, response, db)
        response.headers["location"] = f"{settings.FRONTEND_ORIGIN}/login#access_token={quote(access_token)}"
        return response
    except Exception:
        # No exponemos detalles del proveedor ni de la validación al navegador.
        return RedirectResponse(error_url, status_code=status.HTTP_303_SEE_OTHER)


# ---------------------------------------------------------------------------
# Refresh (rotación de tokens)
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No se encontró refresh token")

    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tipo de token incorrecto")

    jti = payload.get("jti")
    result = await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
    stored = result.scalar_one_or_none()

    if stored is None or stored.revoked:
        # Posible reutilización de un token ya rotado -> señal de robo de token.
        # En un sistema real: revocar TODOS los refresh tokens de ese usuario aquí.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token revocado")

    if stored.expires_at < _utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token expirado")

    user_id = payload["sub"]

    # Rotación: se invalida el token usado y se emite uno nuevo
    stored.revoked = True

    new_refresh_token, new_jti, new_expires_at = create_refresh_token(user_id)
    db.add(
        RefreshToken(
            jti=new_jti,
            user_id=uuid.UUID(user_id),
            expires_at=new_expires_at,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    )
    await db.commit()

    _set_refresh_cookie(response, new_refresh_token)
    new_access_token = create_access_token(user_id)
    return TokenResponse(access_token=new_access_token)


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if token:
        try:
            payload = decode_token(token)
            result = await db.execute(select(RefreshToken).where(RefreshToken.jti == payload.get("jti")))
            stored = result.scalar_one_or_none()
            if stored:
                stored.revoked = True
                await db.commit()
        except HTTPException:
            pass  # token ya inválido, no pasa nada

    response.delete_cookie(REFRESH_COOKIE_NAME, path="/auth")
    return MessageResponse(msg="Sesión cerrada correctamente")


# ---------------------------------------------------------------------------
# Usuario actual
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)):
    return user
