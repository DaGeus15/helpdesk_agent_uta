# Decisiones de diseño, contexto y seguridad

Complementa a [ARCHITECTURE.md](ARCHITECTURE.md). Resume qué se decidió, por qué y qué queda fuera, para defenderlo ante el jurado.

## 1. Decisiones de implementación

| Tema | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| Canal | Solo **Telegram** (grammY) | Bot gratuito e inmediato. El conector está aislado: otro canal produciría el mismo `IncomingMessage` | WhatsApp: la Cloud API exige trámite en Meta y `whatsapp-web.js` no es oficial (riesgo de bloqueo del número) |
| Backend | **NestJS** con módulos por capa | La separación conector / pipeline / proveedor LLM / persistencia vale el 10 % de la rúbrica (C1) | Express suelto |
| LLM | **Gemini** detrás de `LlmProvider` | Tier gratuito, JSON con esquema nativo y audio inline (voz sin otro servicio) | OpenAI o Anthropic: de pago y sin audio en la misma llamada |
| Cuota | **Cadena de 5 modelos** (`GEMINI_MODEL` + respaldos): si uno da 429/404/5xx se usa el siguiente | El free tier da ~5-15 peticiones por minuto por modelo y cada modelo tiene cuota propia | Un solo modelo: se cae con el jurado escribiendo a la vez |
| Inferencia | **Una sola llamada estructurada** por mensaje (respuesta + estado + intención + perfil + handover + injection) validada con zod | La mitad de latencia y tokens que una cadena clasificador → generador | Varias llamadas encadenadas |
| Datos y tiempo real | **Supabase** (Postgres + Realtime por WebSockets) | Postgres gestionado y `postgres_changes` sin montar servidor de sockets | SSE propio |
| Panel | React + Vite + Tailwind + shadcn/ui en Vercel. Lee de Supabase y **escribe solo vía API** | Tiempo real directo desde la BD y escritura controlada | Escribir desde el navegador con la service key |
| Despliegue | API en **Render** (webhook HTTPS + keep-alive) y panel en **Vercel** | Gratis y con deploy automático en cada push a `main` | Servidor propio |
| Catálogo | **Cursos reales de CTT-FISEI** sincronizados automáticamente desde la web (`catalog-sync`; seed/script solo para bootstrap) | Datos veraces y al día. Precios y fechas salen de la BD, nunca del LLM | Catálogo inventado o actualización manual |
| Estado del curso | **Fechas** (America/Guayaquil) + override: si la web muestra el botón **INSCRIBIRME**, el estado es `inscripciones_abiertas` aunque la fecha de inscripción empiece mañana (la web manda) | La etiqueta "ABIERTO" de la web incluye cursos ya terminados; las fechas solas marcan "próximamente" cursos que ya aceptan inscripción | Confiar solo en la etiqueta o solo en las fechas |
| Flujo de trabajo | Claude planifica y revisa; Cursor implementa cada tarea; un commit por tarea | Pedido por el equipo; trazabilidad en el historial de git | — |
| Enlace de inscripción | Lo arma el **servidor** (`EnrollmentFormService`) con el Google Form oficial del curso y el perfil del lead; el LLM no lo genera | Evita URLs inventadas o manipuladas por prompt injection; el formulario sale del scraper (`enrollment_form_url`) | Dejar que el modelo pegue el link |
| Sync del catálogo | Automática al boot (+10 s) y cada `CATALOG_SYNC_HOURS` (6); upsert + soft-deactivate; nunca DELETE | El panel y el bot siempre reflejan la web oficial sin intervención manual | Seed SQL a mano en cada cambio de la web |

### Salvaguardas del `catalog-sync`
- Si el scrape devuelve **0 cursos**, o **menos del 50 %** de los `ctt-*` activos actuales, **no se escribe** en `courses` (probable caída de la web o cambio de HTML). Se registra el error en `catalog_sync_runs` y se conserva el catálogo anterior.
- Timeout de **15 s** por página y como máximo **3 descargas en paralelo**. Un curso que falle al parsear se omite sin abortar el resto.
- Lock en memoria: no hay ejecuciones solapadas. Desactivable con `CATALOG_SYNC_ENABLED=false`.

## 2. Ventana de contexto: qué pasa con conversaciones largas

Cada llamada al modelo lleva siempre lo mismo, sin importar cuánto dure la conversación:

1. **System prompt fijo** (rol, tono, reglas de seguridad, formato) y **catálogo compacto**: es el prefijo estable, que Gemini puede cachear.
2. **Perfil del lead** en JSON (nombre, interés, nivel, disponibilidad, presupuesto, contacto).
3. **Resumen acumulado** (≤ 100 palabras). Se regenera en segundo plano cada `SUMMARY_EVERY_N_MESSAGES` = 8 mensajes y al tomar control.
4. **Ventana deslizante**: solo los últimos `CONTEXT_WINDOW_MESSAGES` = 12 mensajes.
5. El mensaje actual, delimitado como dato no confiable.

**Si la conversación supera la ventana**, los mensajes antiguos simplemente dejan de enviarse. Su contenido sobrevive en el resumen y en el perfil estructurado, así que el bot no olvida quién es el usuario ni qué le interesa, y el coste por mensaje se mantiene constante (unos 3-4 mil tokens) aunque la charla tenga 200 mensajes. Nunca se llega al límite del modelo, que es de un millón de tokens.

**Otros límites:**
- La respuesta tiene un máximo de 1800 caracteres (Telegram permite 4096). Si el JSON no valida, se reintenta una vez; si vuelve a fallar, se envía una respuesta segura.
- Cada llamada tiene un timeout de 25 s. Los tokens y la latencia de cada respuesta se guardan en `messages` y aparecen en las métricas.

## 3. Consideraciones de seguridad

### Contra prompt injection (defensa en capas)
1. **Reglas inmutables** en el system prompt. El texto del usuario va dentro de `<mensaje_usuario>` y se trata como dato. Se eliminan del texto del usuario las etiquetas que imitan las nuestras.
2. **Detector previo heurístico** (ES/EN, sin tildes ni mayúsculas): "ignora tus instrucciones", "prompt de sistema", DAN y modo desarrollador, falsa autoridad ("soy el director"), precios "prometidos", pedir cursos gratis, etiquetas tipo `[SYSTEM]`. Marca el intento (badge en el panel y contador) y añade un aviso de seguridad al contexto.
3. **Validación de la salida** contra la BD. Cada importe y porcentaje de la respuesta debe existir en el catálogo; también se bloquean ofertas de "gratis" y fugas del prompt (frases firma). Si falla, se regenera una vez y, si persiste, se usa una respuesta segura (`blocked_by_guard`).
4. **El LLM no es fuente de datos comerciales**: precios, fechas y promociones solo vienen de Supabase.
5. **Batería automática** (`apps/api/scripts/eval-agent.js`) con los ataques de `PRUEBAS.md`.

### Aplicación e infraestructura
- **Secretos** solo en variables de entorno (`.env` ignorado por git; Render y Vercel). La clave secreta de Supabase vive solo en la API.
- **RLS en Supabase**: la clave pública del panel solo puede **leer**. Toda escritura pasa por la API.
- **Login del operador**: `POST /auth/login` emite un token HMAC-SHA256 con caducidad (12 h) y compara las credenciales en tiempo constante. Todos los `/operator/*` exigen `Bearer`.
- **Webhook de Telegram** protegido con `secret_token` (`X-Telegram-Bot-Api-Secret-Token`). Si falta o no coincide, devuelve 401. Nunca devuelve 500, para evitar reintentos en bucle.
- **CORS** limitado a los orígenes de `DASHBOARD_ORIGIN`, con las cabeceras `Content-Type` y `Authorization`.
- **Validación con zod** de variables de entorno (la API no arranca mal configurada), del cuerpo de cada endpoint y de la salida del LLM.
- **Errores**: ninguna excepción tumba el proceso. El usuario siempre recibe una respuesta: IA, respuesta segura o aviso de espera.

### Limitaciones conocidas (honestas, para el jurado)
- Usuario y contraseña únicos del operador (`OPERATOR_USERNAME`/`OPERATOR_PASSWORD`), cambiables en Render. El siguiente paso sería Supabase Auth con un usuario por operador y RLS `to authenticated`.
- La lectura en tiempo real con la clave pública expone las conversaciones a quien conozca la URL de Supabase y la clave pública. Mitigación futura: el mismo paso anterior.
- Sin rate limiting por usuario de Telegram. Lo amortiguan la cadena de modelos y la cola por chat.
- Las heurísticas no detectan todos los ataques. Por eso la defensa principal es la validación de salida contra la BD, no el detector.
- Las credenciales usadas durante la hackathon deben rotarse después del evento.

### Formulario de inscripción: estado del prellenado
El Google Form oficial del CTT exige iniciar sesión con una cuenta institucional: responde 401 sin sesión. Por eso el servidor no puede leer los `entry.<id>` de sus campos y hoy el bot envía el **enlace directo** al formulario de la edición vigente. El prellenado ya está implementado (`src/modules/enrollment/`) y se activa solo si el formulario pasa a ser público. La otra vía es configurar a mano los IDs de los campos, obtenidos con "Obtener enlace prellenado" por quien administra el form.
