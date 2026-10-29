---
name: cursor
description: Delegate coding work to the Cursor Agent CLI (headless) so it runs on the user's Cursor credits. Use when the user says "usa Cursor", "con Cursor", or asks to implement/refactor large parts of the project via Cursor.
---

# Cursor Agent CLI como ejecutor

Claude (tú) orquesta: entiende el proyecto, divide el trabajo, escribe prompts precisos para Cursor y revisa lo que hizo. Cursor hace la edición pesada de código y consume los créditos de Cursor del usuario.

## Comprobación inicial (una vez por sesión)

```bash
which agent || which cursor-agent
agent --version
```

Si no está instalado, NO lo instales tú: dile al usuario que corra el instalador oficial (`curl https://cursor.com/install -fsS | bash` en macOS/Linux/WSL, o la variante de PowerShell de la doc de Cursor en Windows) y luego `agent login`.

## Reglas obligatorias de invocación

- Siempre `-p` (print/headless). Sin él abre la TUI y se cuelga.
- Siempre `--trust`. Sin él pide confirmar el workspace y se cuelga.
- Siempre `--workspace "$(pwd)"` (o la ruta del repo).
- Para que edite archivos: `--force`.
- Para solo analizar/preguntar: `--mode ask` (o `--mode plan` para un plan sin edits). Ojo: no lo trates como barrera de escritura garantizada; revisa `git status` después igual.
- Usa la salida por defecto (`text`). En Windows no asumas que `jq` está instalado; usa `--output-format json` solo si lo necesitas parsear y `jq` existe.
- En Windows, Claude Code ejecuta los comandos en Git Bash: la sintaxis bash de abajo funciona. Si `agent` no se encuentra, prueba `agent.cmd` o pide al usuario reiniciar la terminal para refrescar el PATH.
- Tareas largas: lanza el comando con `run_in_background` en Bash y espera a que termine, en vez de bloquear por timeout.

## Plantillas

Analizar (sin cambios):
```bash
agent -p --trust --mode ask --workspace "$(pwd)" \
  "Explica cómo está organizado el módulo X y qué servicios dependen de él"
```

Implementar:
```bash
agent -p --trust --force --workspace "$(pwd)" \
  "<prompt detallado>"
```

Continuar la sesión anterior:
```bash
agent -p --trust --force --continue --workspace "$(pwd)" "Sigue con el siguiente paso: ..."
```

## Flujo de trabajo

1. Antes de delegar: asegúrate de que el árbol git está limpio (`git status`). Si no lo está, pregunta al usuario si hacer commit o trabajar en una rama nueva (`git switch -c cursor/<tarea>`).
2. Divide el trabajo en tareas acotadas (un servicio, un módulo, un endpoint). Nada de "haz todo el proyecto" en un solo prompt.
3. Cada prompt a Cursor incluye: objetivo, archivos/carpetas relevantes, convenciones del proyecto (stack, estilo, patrones existentes), qué NO tocar y criterio de terminado (p. ej. "compila y pasan los tests de X").
4. Después de cada tarea:
   - `git diff --stat` y revisa el diff de verdad.
   - Corre build/tests del módulo afectado.
   - Si algo está mal, manda a Cursor una corrección concreta con `--continue` en vez de arreglarlo tú (así se gastan créditos de Cursor, no de Claude), salvo que sea un cambio de una o dos líneas.
5. Haz commit por tarea terminada con un mensaje claro.
6. Nunca edites los mismos archivos que Cursor mientras está corriendo.

## Reporte al usuario

Al final: qué tareas hizo Cursor, qué revisaste/corregiste, estado de build/tests y qué queda pendiente.
