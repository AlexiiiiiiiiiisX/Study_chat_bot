#!/bin/bash
set -e

echo "Esperando a que Postgres esté disponible..."

# DATABASE_URL tiene forma: postgresql+asyncpg://user:pass@host:port/dbname
python3 - <<'PYEOF'
import os
import sys 
import time
import asyncio
import asyncpg
from urllib.parse import urlparse

url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
parsed = urlparse(url)

async def wait_for_db():
    max_attempts = 30
    for attempt in range(1, max_attempts + 1):
        try:
            conn = await asyncpg.connect(
                user=parsed.username,
                password=parsed.password,
                host=parsed.hostname,
                port=parsed.port or 5432,
                database=parsed.path.lstrip("/"),
            )
            await conn.close()
            print("Postgres está listo.")
            return
        except Exception as e:
            print(f"Intento {attempt}/{max_attempts}: Postgres aún no responde ({e})")
            time.sleep(2)
    print("No se pudo conectar a Postgres después de varios intentos.", file=sys.stderr)
    sys.exit(1)

asyncio.run(wait_for_db())
PYEOF

echo "Iniciando la aplicación..."
exec "$@"
