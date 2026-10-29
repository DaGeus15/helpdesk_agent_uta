# Helpdesk Agent — Hackathon UTA 2026 (Ecosistema Multi-Agente para Ventas)

Contexto permanente para Claude Code. Léelo entero antes de cualquier fase.

- Reto completo y rúbrica oficial: `docs/RETO.md` (la fuente de verdad: si algo aquí contradice el reto, gana el reto).
- Plan vivo por fases: `docs/PLAN.md` (lo creas tú en la Fase 0 y lo vas actualizando).
- Decisiones de arquitectura: `docs/ARCHITECTURE.md` (Fase 0).

## Contexto de tiempo

Es una hackathon que empezó el 29 de octubre a las 08:00. Prioridad absoluta: **demo funcionando en vivo** (bot de Telegram + dashboard en URL pública) antes que perfección. Cada fase debe terminar en algo demostrable. Si el tiempo aprieta, recorta alcance de la Fase 5, nunca la estabilidad de lo ya hecho.

## Cómo trabajamos: Claude orquesta, Cursor implementa

Usa la skill `cursor` (`.claude/skills/cursor/SKILL.md`) para TODA la escritura de código no trivial.

- **Tú (Claude Code):** planificas, diseñas, divides en tareas pequeñas, escribes prompts precisos para Cursor, revisas diffs, corres builds/tests, haces commits y mantienes `docs/PLAN.md` al día.
- **Cursor (`agent -p --trust --force ...`):** implementa cada tarea. Las correcciones también se las mandas a Cursor (`--continue`), salvo arreglos de 1-2 líneas.
- Una tarea = un prompt a Cursor = un commit. Nunca "haz toda la fase" en un solo prompt.
- Cada prompt a Cursor incluye: objetivo, archivos/carpetas, stack y convenciones de este documento, qué NO tocar y criterio de terminado.
- Al terminar cada fase: resumen corto para Dayle (qué quedó, cómo probarlo, qué sigue) y **espera su "ok / siguiente fase"** antes de continuar.

## Stack por defecto (confirmar con Dayle en la Fase 0)

Elegido para velocidad y porque encaja con la rúbrica de separación de capas:

- **Monorepo** con `apps/api` y `apps/dashboard` (npm/pnpm workspaces). TypeScript en todo.
- **Backend `apps/api`: NestJS.** Módulos separados que mapean 1:1 a la rúbrica C:
  - `telegram` — conector de mensajería (grammY o Telegraf). Webhook en producción, long polling en local.
  - `agent` — pipeline de inferencia: construcción de prompt, gestión de contexto, llamada al LLM, guardrails, clasificación.
  - `conversations` — persistencia y reglas de handover (pausa/reanudación de IA).
  - `operator` — endpoints REST para el dashboard (enviar mensaje como bot, tomar/soltar conversación, resumen).
  - `catalog` — cursos, precios, horarios y promociones oficiales (datos semilla, nunca inventados por el LLM).
  - `llm` — capa de proveedor intercambiable (interfaz `LlmProvider`), configurable por variable de entorno.
- **Base de datos y tiempo real: Supabase** (Postgres + Realtime). El dashboard se suscribe a cambios de `messages` y `conversations` vía Supabase Realtime (WebSockets) → cumple "sin recarga manual".
- **Dashboard `apps/dashboard`:** React + Vite + Tailwind + shadcn/ui. Lee con Supabase (anon key + RLS de solo lectura) y escribe a través de la API (CORS habilitado para el dominio del dashboard).
- **LLM:** proveedor por definir en Fase 0 (Gemini por defecto: tier gratuito y acepta audio para transcripción; alternativas: OpenAI, Anthropic, Groq). Nunca acoplar el código a un proveedor concreto.
- **Despliegue:** API en Render/Railway (o el servidor Oracle Cloud de Dayle con Docker) con HTTPS para el webhook; dashboard en Vercel. Decidir en Fase 0.

## Diseño funcional clave (requisitos del reto)

1. **Agente de ventas (Módulo A).** Tono humano y empático, nada de respuestas tipo catálogo o menú. Perfila al prospecto (nombre, interés, nivel, disponibilidad, presupuesto) de forma conversacional, resuelve dudas del pénsum con datos de `catalog`, maneja objeciones comerciales y guía a la inscripción. Tolera faltas de ortografía y cambios de tema.
2. **Una sola llamada estructurada por mensaje** (ahorra tokens y latencia): el LLM devuelve JSON validado (zod) con `reply`, `lead_state` (`interesado | dudoso | frustrado | lead_caliente`), `intent`, `profile_updates`, `handover_requested` y `handover_reason`.
3. **Handover transparente.** Campo `ai_paused` por conversación. Se pausa automáticamente si `lead_state = frustrado`, si el usuario pide un humano, o en cuanto un operador escribe o pulsa "Tomar control". Con la IA pausada, los mensajes entrantes se guardan y se muestran, pero no se infiere. Los mensajes del operador salen por el mismo bot (mismo token, misma identidad). Botón "Devolver a la IA" para reanudar, y la IA retoma con el contexto de lo que dijo el operador.
4. **Termómetro en tiempo real.** `lead_state` visible en cada tarjeta de chat con un indicador sutil (color/icono) que se actualiza en vivo.
5. **Guardrails contra prompt injection.** Defensa en capas:
   - System prompt con reglas inmutables y los datos del usuario delimitados como no confiables.
   - Precios, descuentos y promociones salen SOLO de `catalog`. El LLM no puede crear descuentos ni cursos gratis.
   - Validación de la salida: si la respuesta menciona un descuento/precio que no existe en `catalog`, se bloquea y se regenera o se usa una respuesta segura.
   - Detector previo barato (heurísticas + clasificación) de intentos de jailbreak; se registran y se marcan en el dashboard.
   - Nunca revelar el system prompt ni instrucciones internas.
6. **Gestión de contexto (rúbrica C2).** Ventana de los últimos N mensajes + resumen acumulado de la conversación + perfil del lead en campos estructurados. Prompt del sistema compacto y estable. Registrar tokens por llamada para mostrarlo en métricas.
7. **Valor agregado (rúbrica D1), por orden de prioridad:** transcripción de notas de voz de Telegram, resumen automático de la conversación para el operador al tomar control, panel de métricas (conversaciones activas, distribución de estados, leads calientes, handovers, tokens/latencia).

## Fases

Cada fase termina con commit, actualización de `docs/PLAN.md` y resumen a Dayle.

- **Fase 0 — Planificación y diseño (la haces tú, sin Cursor).** Confirma con Dayle: proveedor de LLM, hosting, nombre del centro de capacitación ficticio y hora límite de entrega. Luego escribe `docs/ARCHITECTURE.md` (diagrama Mermaid de componentes y flujo de mensaje, modelo de datos SQL de Supabase, contratos de la API, estrategia de handover y guardrails) y `docs/PLAN.md` (tareas por fase con checkbox, cada una del tamaño de un prompt de Cursor). Inventa el catálogo de cursos del centro (5-8 cursos con pénsum, duración, horarios, precios y 1-2 promociones oficiales) en `docs/CATALOGO.md`.
- **Fase 1 — Esqueleto.** Monorepo, NestJS y Vite arrancando, migraciones SQL de Supabase + seed del catálogo, `.env.example` en cada app, `.gitignore`, script de desarrollo único.
- **Fase 2 — Bot conversacional (Módulo A).** Conector de Telegram, pipeline del agente con salida estructurada, persistencia de mensajes, contexto (ventana + resumen + perfil). Criterio: conversación natural de punta a punta en Telegram usando el catálogo.
- **Fase 3 — Guardrails y handover lógico.** Defensa anti-injection, validación de salida, pausa automática por frustración/petición de humano, endpoints del operador. Criterio: batería de pruebas de `docs/PRUEBAS.md` (ataques de descuento, jailbreak, faltas de ortografía, cambio de tema, frustración) pasando.
- **Fase 4 — Dashboard en tiempo real (Módulo B).** Lista de conversaciones concurrentes con termómetro, vista de chat, tomar control / enviar como bot / devolver a la IA, todo en vivo sin recargar. Criterio: dos chats de Telegram a la vez reflejados al instante y handover sin que el usuario note el cambio.
- **Fase 5 — Valor agregado.** Notas de voz, resumen para el operador, panel de métricas (en ese orden; recorta si no da el tiempo).
- **Fase 6 — Despliegue y sustentación.** Deploy de API (webhook HTTPS) y dashboard con CORS correcto, README con arquitectura, variables de entorno y guía de despliegue, y `docs/DEMO.md` con el guion de demo de 5 minutos y respuestas preparadas a preguntas del jurado mapeadas a cada criterio de la rúbrica.

## Reglas

- Nunca commitear secretos. Todo en `.env` (ignorado); documentar en `.env.example`.
- Los tokens/keys (Telegram, LLM, Supabase) los pone Dayle; pídeselos cuando hagan falta, no los inventes.
- Código limpio y por capas: es 20 % de la nota y el jurado revisará el repo.
- Antes de dar una fase por terminada: build sin errores y prueba manual del criterio de la fase.
- Idioma: código y nombres en inglés; textos del bot, dashboard y documentación en español.
