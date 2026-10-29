# Plan de trabajo — CodeAndes Academy

Plan vivo: cada tarea = un prompt a Cursor = un commit. Se marca `[x]` al pasar build + revisión.

## Realidad del tiempo

- Fase 0 cerrada a las **11:45**. Entrega a las **13:00** → **~75 minutos** de construcción.
- Estrategia para llegar con demo estable:
  1. **Paralelizar Cursor** en carpetas disjuntas (`apps/api` y `apps/dashboard` a la vez): los contratos de `ARCHITECTURE.md` permiten trabajar ambos lados sin esperar.
  2. **Desplegar temprano** (~12:20) el esqueleto en Render/Vercel para eliminar el riesgo de despliegue, y luego redeploy por commit.
  3. Tareas algo más grandes de lo ideal (una por módulo, no por archivo).
  4. Recortes ya decididos: métricas avanzadas y endurecimiento de auth fuera; notas de voz y resumen al tomar control se incluyen dentro de sus tareas porque cuestan poco con Gemini.
- **Corte duro a las 12:45:** lo que no funcione se desactiva; desde ahí solo despliegue, prueba en vivo y guion de demo.

## Lo que Dayle debe preparar YA (en paralelo, ~10 min)

- [x] Bot de Telegram: @BotFather → `/newbot` → token.
- [x] Gemini API key: https://aistudio.google.com/apikey
- [x] Proyecto Supabase: URL, `anon` key y `service_role` key (Settings → API).
- [x] Repo vacío en GitHub (para Render y Vercel) y cuentas de Render y Vercel enlazadas a GitHub.

## Fase 1 — Esqueleto (11:45 → 12:00)

- [x] **T1.1 API (Cursor A):** monorepo pnpm (`pnpm-workspace.yaml`, `package.json` raíz con `dev` usando `concurrently`), NestJS en `apps/api` con módulos vacíos `telegram`, `agent`, `llm`, `conversations`, `operator`, `catalog`, `supabase` (cliente con service role), `ConfigModule` validado con zod, `GET /health`, CORS desde `DASHBOARD_ORIGIN`, `.env.example`.
- [x] **T1.2 Dashboard (Cursor B, en paralelo):** Vite + React + TS + Tailwind + shadcn/ui en `apps/dashboard`, cliente Supabase, cliente API, layout de 2 columnas (lista | chat) con datos mock, `.env.example`.
- [x] **T1.3 SQL (Claude):** `supabase/migrations/001_init.sql` (de `ARCHITECTURE.md` §3) y `supabase/seed.sql` (de `CATALOGO.md`). Dayle los pega en el SQL Editor de Supabase.
- Criterio: `pnpm dev` levanta ambos; `/health` responde; tablas y catálogo creados en Supabase.

## Fase 2 — Bot conversacional (12:00 → 12:20)

- [x] **T2.1 llm + catalog:** interfaz `LlmProvider` (`generateStructured`, `transcribeAudio`, `summarize`, devuelven tokens y latencia), `GeminiProvider` con `@google/genai`, fábrica por `LLM_PROVIDER`; `CatalogService` que carga cursos y promociones de Supabase, los cachea, genera el catálogo compacto para el prompt y calcula el conjunto de importes/porcentajes permitidos.
- [x] **T2.2 telegram + conversations + agent:** grammY (polling en local, webhook con secret en prod), normalización a `IncomingMessage` (texto y voz → transcripción), `ConversationsService` (upsert, guardar mensajes, ventana de N, perfil, contadores), `AgentService` con prompt en capas, salida zod `AgentOutput`, actualización de estado/perfil/tokens y resumen cada N mensajes.
- Criterio: conversación natural en Telegram usando el catálogo real (casos 1-8 de `PRUEBAS.md`); los mensajes aparecen en Supabase.

## Fase 3 — Guardrails y handover lógico (12:20 → 12:30, en paralelo con la Fase 4)

- [x] **T3.1 guardrails + handover + operator:** `GuardrailsService.preCheck` (heurísticas de injection) y `postCheck` (importes, porcentajes, "gratis", fuga de prompt → regenerar una vez / respuesta segura); pausa automática por `frustrado` o petición de humano; endpoints `takeover`, `release`, `messages`, `summary` y `metrics` según contrato; con IA pausada no se infiere.
- Criterio: casos 9-18 de `PRUEBAS.md`.

## Fase 4 — Dashboard en tiempo real (12:20 → 12:40, en paralelo con la Fase 3)

- [x] **T4.1 lista + chat en vivo:** suscripción Realtime a `conversations` y `messages`; tarjetas ordenadas por actividad con termómetro (color + icono por `lead_state`), badge de IA pausada y de intentos de injection; vista de chat con burbujas por rol (usuario / IA / operador, voz marcada).
- [x] **T4.2 controles del operador:** "Tomar control" (muestra el resumen), caja de texto "enviar como bot", "Devolver a la IA", tira de métricas arriba (activas, por estado, leads calientes, handovers).
- Criterio: dos chats de Telegram a la vez reflejados al instante; handover sin que el usuario note el cambio (casos 17-19).

## Fase 5 — Valor agregado (incluido en tareas anteriores)

- [x] Notas de voz → dentro de T2.2.
- [x] Resumen para el operador al tomar control → dentro de T3.1 / T4.2.
- [x] Métricas → endpoint en T3.1, tira básica en T4.2. Panel avanzado (gráficas, latencia por mensaje): **recortado**.

## Fase 6 — Despliegue y sustentación (12:20 deploy inicial, 12:40 → 13:00 final)

- [x] **T6.1 deploy esqueleto (12:20):** Render (API, webhook) + Vercel (dashboard) con variables; CORS verificado contra la URL de Vercel.
- [x] **T6.2 README + DEMO (Claude, 12:45):** README con arquitectura, variables y guía de despliegue; `docs/DEMO.md` con el guion de 5 min y respuestas al jurado por criterio de la rúbrica.
- [x] **T6.3 prueba final en producción:** batería rápida de `PRUEBAS.md` contra el bot desplegado.

## URLs de producción

- Bot: https://t.me/HelpdeskUTA15Bot
- Dashboard: https://helpdesk-agent-uta.vercel.app
- API: https://codeandes-api.onrender.com (`/health`)

## Extras añadidos al final (12:25 → 12:35)

- [x] Login del operador (`admin`/`admin` configurable) con token HMAC y guard en `/operator/*`.
- [x] Rediseño del panel con identidad visual UTA (azul institucional) y pantalla de login.
- [x] Cadena de respaldo de modelos Gemini ante 429 (free tier: 5 RPM por modelo).
- [x] Prueba de punta a punta en producción: voz, venta, guardrails, handover y devolución a la IA.
