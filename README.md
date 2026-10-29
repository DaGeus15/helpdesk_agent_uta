# CTT-FISEI · Talleres Tecnológicos UTA — Agente de ventas en Telegram + Panel de mando

Proyecto para la **Hackathon UTA 2026 · Ecosistema Multi-Agente para Ventas** (FISEI). Modelo híbrido IA–humano para los **Talleres Tecnológicos CTT-FISEI** de la Universidad Técnica de Ambato:

- **Módulo A — Agente en Telegram:** asesora "Andrea" con tono humano: perfila al prospecto, resuelve dudas con el catálogo real de CTT-FISEI, maneja objeciones y guía la inscripción. Entiende notas de voz.
- **Módulo B — Panel de mando:** dashboard web en tiempo real con todos los chats concurrentes, termómetro del lead (interesado, dudoso, frustrado, lead caliente), toma de control, envío como bot y "Devolver a la IA".

Producción: bot [@HelpdeskUTA15Bot](https://t.me/HelpdeskUTA15Bot) · panel https://helpdesk-agent-uta.vercel.app (usuario `admin`, contraseña `admin`) · API https://codeandes-api.onrender.com/health

Documentación: [arquitectura](docs/ARCHITECTURE.md) · [plan](docs/PLAN.md) · [catálogo](docs/CATALOGO.md) · [batería de pruebas](docs/PRUEBAS.md) · [guion de demo](docs/DEMO.md) · [decisiones y seguridad](docs/DECISIONES.md) · [reto](docs/RETO.md)

## Arquitectura en 30 segundos

```mermaid
flowchart LR
    U[Telegram] <--> TG[telegram]
    subgraph API[apps/api · NestJS]
        TG --> AG[agent + guardrails]
        AG --> LLM[llm · LlmProvider → Gemini]
        AG --> CAT[catalog]
        AG --> CONV[conversations]
        OP[operator REST] --> CONV
        OP --> TG
    end
    CONV <--> DB[(Supabase Postgres)]
    DB -- Realtime WS --> D[apps/dashboard · React]
    D -- REST --> OP
```

- **Capas separadas:** el conector (`telegram`) es el único que conoce grammY; el pipeline (`agent`) no sabe de Telegram ni de HTTP; el proveedor LLM está detrás de una interfaz (`LLM_PROVIDER`), y la persistencia y el handover viven en `conversations`.
- **Una llamada estructurada por mensaje:** Gemini devuelve un JSON validado con zod (`reply`, `lead_state`, `intent`, `profile_updates`, `handover_requested`, `injection_detected`, …).
- **Contexto eficiente:** prompt fijo y catálogo compacto (prefijo estable, cacheable), perfil del lead estructurado, resumen acumulado y solo los últimos 12 mensajes. Se registran los tokens y la latencia de cada llamada.
- **Guardrails en capas:** reglas inmutables y entrada delimitada, detector heurístico previo y validación de la salida contra el catálogo (importes, porcentajes, "gratis", fuga del prompt). Si la respuesta no pasa, se regenera o se usa una respuesta segura.
- **Handover:** `ai_paused` por conversación. Se activa por frustración, por petición de un humano o cuando el operador interviene. Mientras está activo no se infiere, y la IA retoma con lo que dijo el asesor.
- **Formulario de inscripción prellenado:** en leads calientes el servidor arma el enlace del Google Form oficial del curso con los datos del perfil (el LLM no inventa URLs).

## Estructura

```
apps/
  api/          NestJS: telegram, agent, guardrails, llm, conversations, operator, catalog, catalog-sync, supabase
  dashboard/    React + Vite + Tailwind + shadcn/ui (Supabase Realtime)
supabase/
  migrations/001_init.sql              esquema base, RLS y Realtime
  migrations/003_real_catalog.sql      campos del catálogo CTT-FISEI
  migrations/004_enrollment_form.sql   URL del Google Form por curso
  migrations/005_catalog_sync.sql      historial de sincronizaciones del catálogo
  seed.sql                             seed ficticio legacy (desactivado por seed_ctt)
  seed_ctt.sql                         catálogo real (18 cursos CTT-FISEI)
  data/ctt-cursos.json             dump del scraper
docs/           arquitectura, plan, catálogo, pruebas y demo
render.yaml     blueprint del despliegue de la API
```

## Puesta en marcha local

Requisitos: Node ≥ 20 y pnpm (`corepack enable`).

1. **Supabase:** crea un proyecto y, en el *SQL Editor*, ejecuta en orden `supabase/migrations/001_init.sql`, `supabase/migrations/003_real_catalog.sql`, `supabase/migrations/004_enrollment_form.sql`, `supabase/migrations/005_catalog_sync.sql` y `supabase/seed_ctt.sql`. (Opcional: regenerar el seed con `pnpm --filter api build && node apps/api/scripts/scrape-ctt.mjs`.)
2. **Bot:** crea uno con @BotFather (`/newbot`) y guarda el token.
3. **Gemini:** crea una API key en https://aistudio.google.com/apikey.
4. **Variables:** copia `apps/api/.env.example` → `apps/api/.env` y `apps/dashboard/.env.example` → `apps/dashboard/.env` y complétalas (tablas abajo).
5. Instala y arranca:
   ```bash
   pnpm install
   pnpm dev
   ```
   La API queda en `http://localhost:3000` con long polling de Telegram y el panel en `http://localhost:5173`.

### Sincronización del catálogo

El módulo `catalog-sync` descarga https://ctt-talleresfisei.uta.edu.ec/course.php, hace upsert de los cursos `ctt-*` en Supabase y desactiva (`active = false`) los que ya no aparecen en la web (nunca DELETE). Arranca 10 s después del boot y se repite cada `CATALOG_SYNC_HOURS` (por defecto 6). Se puede forzar desde el panel (**Cursos → Actualizar ahora**) o con `POST /operator/catalog/sync`. Salvaguardas: si el scrape devuelve 0 cursos o menos del 50 % de los activos actuales, no toca la base. Desactivar con `CATALOG_SYNC_ENABLED=false`.

### Variables de la API (`apps/api/.env`)

| Variable | Descripción |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token de @BotFather |
| `TELEGRAM_MODE` | `polling` (local) o `webhook` (producción) |
| `TELEGRAM_WEBHOOK_SECRET` | Secreto del webhook, solo `[A-Za-z0-9_-]` (`openssl rand -hex 24`) |
| `PUBLIC_API_URL` | URL HTTPS pública de la API (modo webhook) |
| `LLM_PROVIDER` / `GEMINI_API_KEY` / `GEMINI_MODEL` | Proveedor LLM (`gemini`, `gemini-2.5-flash`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Proyecto Supabase; clave secreta (`sb_secret_…` o service role), solo en el servidor |
| `DASHBOARD_ORIGIN` | Orígenes permitidos por CORS, separados por comas |
| `CONTEXT_WINDOW_MESSAGES` / `SUMMARY_EVERY_N_MESSAGES` | Ventana de contexto (12) y frecuencia del resumen (8) |
| `OPERATOR_USERNAME` / `OPERATOR_PASSWORD` | Credenciales del panel (por defecto `admin` / `admin`) |
| `AUTH_TOKEN_SECRET` / `AUTH_TOKEN_TTL_HOURS` | Firma y duración del token del operador (opcional; 12 h) |
| `CATALOG_SYNC_ENABLED` / `CATALOG_SYNC_HOURS` | Sync automática del catálogo CTT-FISEI (`true` / `6`) |

### Variables del dashboard (`apps/dashboard/.env`)

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (`sb_publishable_…` o anon). El RLS solo permite lectura |
| `VITE_API_URL` | URL de la API |

## Despliegue

### API → Render

1. *New → Blueprint* y elige este repo (usa `render.yaml`), o crea un *Web Service* con:
   - Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter api build`
   - Start: `pnpm --filter api start:prod` · Health check: `/health`
2. Variables: las de la tabla con `TELEGRAM_MODE=webhook`, `PUBLIC_API_URL=https://<servicio>.onrender.com` y `DASHBOARD_ORIGIN=https://<dashboard>.vercel.app`.
3. Al arrancar, la API registra el webhook (`setWebhook` con `secret_token`) automáticamente.

> El plan gratuito de Render se duerme tras 15 min sin tráfico. Un ping externo a `/health` (p. ej. UptimeRobot cada 5 min) lo mantiene despierto para la demo.

### Dashboard → Vercel

1. *Add New Project* → este repo → **Root Directory:** `apps/dashboard` (framework Vite).
2. Variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_URL=https://<servicio>.onrender.com`.
3. Añade la URL de Vercel a `DASHBOARD_ORIGIN` en Render (CORS).

## Seguridad y limitaciones conocidas

- La clave secreta de Supabase solo vive en la API. El dashboard usa la clave pública con RLS de solo lectura y escribe a través de la API.
- **Login del operador:** `POST /auth/login` con `OPERATOR_USERNAME`/`OPERATOR_PASSWORD` (por defecto `admin`/`admin`; cámbialos en producción) devuelve un token HMAC con caducidad (`AUTH_TOKEN_TTL_HOURS`). Todos los endpoints `/operator/*` exigen `Authorization: Bearer`.
- Limitación conocida: la lectura en tiempo real usa la clave pública de Supabase con RLS de solo lectura. El siguiente paso sería Supabase Auth con políticas `to authenticated`.
- Precios y promociones salen solo de la base de datos. El LLM no puede crearlos y la salida se valida contra el catálogo.
