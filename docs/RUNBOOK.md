# Runbook operativo — CTT-FISEI Helpdesk Agent

Guía corta para desplegar, recuperar y operar en producción (API en Render, panel en Vercel). Complementa el [README](../README.md) y [DECISIONES.md](DECISIONES.md).

## Despliegue

### API (Render)

1. *New → Blueprint* con este repo (`render.yaml`) o *Web Service* en la raíz del monorepo.
2. Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter api build`
3. Start: `pnpm --filter api start:prod` · Health: `/health`
4. Variables: ver `apps/api/.env.example` (`TELEGRAM_MODE=webhook`, `PUBLIC_API_URL`, `DASHBOARD_ORIGIN`, secretos de Telegram / Gemini / Supabase / auth).
5. Al arrancar, la API llama a `setWebhook` con `secret_token`. Comprueba con el Bot API (abajo).

Cada push a `main` redeploya si el servicio está enlazado al repo.

### Dashboard (Vercel)

1. Proyecto con **Root Directory** `apps/dashboard`.
2. Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (URL HTTPS de Render).
3. Añade la URL de Vercel a `DASHBOARD_ORIGIN` en Render (CORS).

### Rollback

- **Render:** *Dashboard del servicio → Events / Deploys* → redeploy de un deploy anterior verde, o *Rollback* si está disponible en el plan.
- **Vercel:** *Deployments* → elige un deployment previo → *Promote to Production*.
- Si el fallo es de datos (migración / seed), no hagas rollback ciego: restaura el catálogo con sync forzada o re-ejecuta el SQL de `supabase/` en el orden documentado.

## Rotación de secretos

Rota uno a uno; no hace falta redeployar el dashboard salvo que cambies la URL de la API o las claves públicas de Supabase.

| Secreto | Dónde | Cómo rotar |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/revoke` o nuevo bot | Actualiza en Render; al boot se re-registra el webhook |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 24` (solo `[A-Za-z0-9_-]`) | Cambia en Render; el siguiente boot llama `setWebhook` con el nuevo `secret_token` |
| `GEMINI_API_KEY` | Google AI Studio | Sustituye en Render; sin cambios de código |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Actualiza en Render. Si rotas la **anon/publishable**, actualiza también `VITE_SUPABASE_*` en Vercel y redeploy del panel |
| `AUTH_TOKEN_SECRET` | `openssl rand -hex 32` | Cambia en Render; invalida todos los tokens de operador en curso (vuelven a login) |
| `OPERATOR_USERNAME` / `OPERATOR_PASSWORD` | Variables de Render | Cámbialos tras la demo; el panel pide login de nuevo |

Nunca commits de `.env`. Tras la hackathon, rota Telegram, Gemini, Supabase service role y `AUTH_TOKEN_SECRET`.

## Forzar sincronización del catálogo

- Panel: **Cursos → Actualizar ahora**, o
- `POST /operator/catalog/sync` con `Authorization: Bearer <token>` (mismo login del operador).

La sync hace upsert de cursos `ctt-*` y desactiva (`active = false`) los que ya no están en la web; **nunca DELETE**. Intervalo por defecto: cada `CATALOG_SYNC_HOURS` (6). Desactivar: `CATALOG_SYNC_ENABLED=false`.

## Incidentes frecuentes

### Gemini responde 429 masivos

1. Revisa la cadena en `GEMINI_MODEL` (varios modelos separados por coma: cada uno tiene cuota propia en el free tier).
2. Espera 1–2 minutos o reduce tráfico de prueba (`eval-agent`, varios chats a la vez).
3. Si un modelo da 404 (retirado), quítalo de la cadena; el proveedor ya salta 429/404/5xx al siguiente.
4. Último recurso: otra API key o subir de plan en AI Studio.

### La web de CTT cambia el HTML (salvaguarda de sync)

Si el scrape devuelve **0 cursos** o **menos del 50 %** de los `ctt-*` activos, **no se escribe** en `courses` (se registra el error en `catalog_sync_runs` y se conserva el catálogo anterior).

Qué hacer:

1. Mira el último run en el panel / tabla `catalog_sync_runs`.
2. Reproduce en local: `pnpm --filter api build && node apps/api/scripts/scrape-ctt.mjs`.
3. Ajusta el scraper (`ctt-scraper.logic`) si cambió el DOM; despliega la API; fuerza sync.
4. Mientras tanto el bot sigue con el catálogo en cache/BD.

### El webhook de Telegram falla

Con el token del bot:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Comprueba `url` (= `PUBLIC_API_URL/telegram/webhook`), `has_custom_certificate`, `last_error_message` y `pending_update_count`.

- URL incorrecta o HTTP: corrige `PUBLIC_API_URL` y reinicia el servicio (vuelve a `setWebhook`).
- 401 en el webhook: `TELEGRAM_WEBHOOK_SECRET` no coincide con el registrado; alinea el valor y redeploy.
- Servicio dormido (Render free): el primer mensaje despierta la instancia; mitiga con ping a `/health` cada ~5 min.

## Una sola instancia de la API

Las colas por chat de Telegram y los rate limiters (`InMemoryRateLimiter`) viven **en memoria del proceso**. No escales a varias réplicas de Render sin sticky sessions o un store compartido: dos instancias duplicarían procesamiento o perderían el límite por chat. Mantén **una** instancia web.

## Batería `eval-agent.js`

Prueba de rúbrica (tono, precios, jailbreaks, handover) contra la API ya arrancada con `.env` real:

```bash
pnpm --filter api build
cd apps/api
TELEGRAM_MODE=webhook PUBLIC_API_URL=<url-api> node scripts/eval-agent.js
# Subconjunto: ONLY=9,10 node scripts/eval-agent.js
```

Cada caso usa un `chat_id` de prueba (9900xx) y al final se borran esas conversaciones. No lo corras en demos en vivo con el mismo bot si vas a saturar la cuota de Gemini.
