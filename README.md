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
