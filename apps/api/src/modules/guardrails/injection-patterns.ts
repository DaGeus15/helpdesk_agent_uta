/**
 * Heuristic patterns for prompt-injection / manipulation attempts.
 * Match against NFD-normalized, lowercased, accent-stripped text.
 */
export interface InjectionPattern {
  name: string;
  pattern: RegExp;
}

export const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    name: 'ignore_instructions',
    pattern:
      /\b(ignor[ae]|olvid[ae]|ignore|forget)\b[\s\S]{0,60}\b(instrucciones|reglas|prompt|instructions|rules)\b/,
  },
  {
    name: 'system_prompt_leak',
    pattern:
      /\b(system\s*prompt|prompt\s+de\s+sistema|instrucciones\s+internas)\b/,
  },
  {
    name: 'repeat_above',
    pattern:
      /\b(repite\s+lo\s+de\s+arriba|repite\s+todo\s+lo\s+anterior|repeat\s+the\s+above|repeat\s+everything\s+above)\b/,
  },
  {
    name: 'dan_jailbreak',
    pattern:
      /\b(eres\s+dan|modo\s+desarrollador|jailbreak|sin\s+reglas|actua\s+como|developer\s+mode)\b/,
  },
  {
    name: 'fake_authority',
    pattern: /\bsoy\s+el\s+(director|gerente|dueno)\b/,
  },
  {
    name: 'authorize_discount',
    pattern: /\bautorizo\s+(un\s+)?descuento\b/,
  },
  {
    name: 'free_course',
    pattern:
      // Pedir algo gratis, no mencionar que algo es gratis ("en YouTube es gratis").
      /\b(dame|dar(me)?|regala(me)?|quiero|exijo)\b.{0,40}\b(gratis|gratuito|free)\b|\bcurso\s+(gratis|gratuito|free)\b|\b100\s*%\s*(de\s+)?descuento\b/,
  },
  {
    name: 'promised_price',
    pattern:
      /\b((te|me)\s+prometio|me\s+prometieron)[\s\S]{0,40}(\$\s*\d|\d+\s*(usd|dolares))?/,
  },
  {
    name: 'roleplay_tags',
    pattern: /<system\b|\[inst\]|###\s*instrucciones/,
  },
];

/** Strip accents and lowercase for accent/case-insensitive matching. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}
