# Study Chat Bot Frontend

Frontend en Next.js para consumir la API FastAPI del proyecto.

## Configuración

1. Instala dependencias:

```bash
npm install
```

2. Crea el archivo de entorno:

```bash
cp .env.example .env.local
```

3. Verifica que el backend tenga este origen permitido:

```env
FRONTEND_ORIGIN=http://localhost:3000
```

4. Arranca el frontend:

```bash
npm run dev
```

La app queda disponible en `http://localhost:3000`.

## Seguridad implementada

- Login contra `/auth/login` con JWT bearer.
- Refresh automático contra `/auth/refresh` usando la cookie httpOnly del backend.
- Access token guardado en `sessionStorage`, no en `localStorage`.
- Logout contra `/auth/logout` y limpieza local de sesión.
- Protección de rutas para `/dashboard` y `/admin`.
- Validación de rol admin antes de mostrar funcionalidades administrativas.
- Headers básicos de seguridad desde `next.config.mjs`.

## Interfaces incluidas

- Login y registro.
- Subida, listado y eliminación de PDFs.
- Chat RAG mediante `/chat/ask-sync`.
- Generación y listado de flashcards.
- Generación, listado y resolución de quizzes.
- Panel admin para listar usuarios.
