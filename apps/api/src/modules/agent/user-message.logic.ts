/**
 * Strip delimiter tags the model might echo so user text cannot close
 * <mensaje_usuario> early (prompt-injection separator hygiene).
 */
export function sanitizeUserText(text: string): string {
  return text.replace(/<\/?mensaje_usuario>/gi, '').trim();
}

/** Wrap untrusted user content for the LLM turn. */
export function wrapUserMessage(sanitized: string): string {
  return `<mensaje_usuario>${sanitized}</mensaje_usuario>`;
}
