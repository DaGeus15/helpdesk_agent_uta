# Cómo arrancar con Claude Code

Abre una terminal en esta carpeta y ejecuta `claude`. Claude Code lee `CLAUDE.md` automáticamente.

## Primer mensaje (pégalo tal cual)

```
Lee CLAUDE.md, docs/RETO.md y docs/PRUEBAS.md. Vamos a construir el proyecto de la hackathon por fases usando Cursor como implementador (skill "cursor"): tú planificas, divides en tareas, le das prompts precisos a Cursor, revisas cada diff, corres el build y haces un commit por tarea.

Empieza la Fase 0 (planificación y diseño). Primero hazme en un solo mensaje las preguntas que necesitas confirmar (proveedor de LLM, hosting, nombre del centro ficticio, hora límite de entrega). Con mis respuestas, escribe docs/ARCHITECTURE.md, docs/PLAN.md y docs/CATALOGO.md, haz commit y espera mi ok antes de la Fase 1.
```

## Mensajes para las siguientes fases

- `ok, sigue con la Fase 1` (y así con cada fase)
- `estado` → que te resuma qué está hecho y qué falta según docs/PLAN.md
- `vamos cortos de tiempo, recorta lo necesario para tener demo estable en X horas`

## Lo que te va a pedir en algún momento

- Token del bot de Telegram (créalo con @BotFather → /newbot).
- API key del proveedor de LLM que elijas.
- Proyecto de Supabase: URL, anon key y service role key (Settings → API).
- Cuentas de hosting (Render/Railway y Vercel) para la Fase 6.
