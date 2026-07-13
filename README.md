# Inicio de sesión con Google

El proyecto ya incluye el flujo OAuth. Para activarlo, crea un cliente OAuth de tipo
**Aplicación web** en Google Cloud Console y registra esta URI de redirección:

```
http://localhost:8000/auth/google/callback
```

Después, en `.env`, solo completa estas dos variables:

```
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret
```

`GOOGLE_REDIRECT_URI` y `NEXT_PUBLIC_API_URL` ya quedan preparados para el entorno local.

## Salas de estudio

Los estudiantes pueden crear una sala, invitar compañeros mediante un código y
compartir documentos PDF propios. Los miembros de la misma sala pueden usar esos
recursos desde Chat RAG, Flashcards y Quizzes, pero no pueden acceder a ellos al
salir del grupo.

En desarrollo, las tablas `study_rooms`, `room_memberships` y `room_resources` se
crean automáticamente al iniciar el backend. Después de integrar los cambios,
reinicia el servicio desde esta copia del proyecto:

```bash
docker compose up -d --build backend
```

En producción se debe generar y ejecutar una migración de Alembic antes de
desplegar la nueva versión.
