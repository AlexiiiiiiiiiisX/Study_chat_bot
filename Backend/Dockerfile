# ---------------------------------------------------------------------------
# Stage 1: build de dependencias
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

# Dependencias del sistema necesarias para compilar paquetes con extensiones
# nativas (argon2-cffi, asyncpg, pypdf, sentence-transformers, etc).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# IMPORTANTE: instalamos torch en su build CPU-only ANTES del resto de
# requirements.txt. Si no hacemos esto, "sentence-transformers" arrastra
# por defecto la build CUDA de torch (+5GB de paquetes nvidia-*) aunque
# el contenedor no tenga GPU. Al instalarlo aquí primero desde el índice
# oficial de CPU, pip ve que torch ya satisface la dependencia y no
# vuelve a descargar la versión con CUDA.
RUN pip install --no-cache-dir --user \
    torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir --user -r requirements.txt

# ---------------------------------------------------------------------------
# Stage 2: imagen final, ligera
# ---------------------------------------------------------------------------
FROM python:3.11-slim

# Usuario no-root por seguridad
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

WORKDIR /app

# Dependencias de sistema mínimas en runtime (libpq para asyncpg, curl para healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiamos solo los paquetes ya compilados desde el builder (imagen final más liviana)
COPY --from=builder /root/.local /home/appuser/.local

COPY app ./app
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh && \
    mkdir -p /app/chroma_data && \
    chown -R appuser:appuser /app /home/appuser/.local

USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app/app
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
