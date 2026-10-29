/**
 * Pure guardrail checks (no Nest, no I/O). Used by GuardrailsService and unit tests.
 */
import { PROMPT_SIGNATURES } from '../agent/prompts/system-prompt';
import {
  INJECTION_PATTERNS,
  normalizeForMatch,
} from './injection-patterns';

export interface PreCheckResult {
  suspicious: boolean;
  matches: string[];
}

export interface PostCheckResult {
  ok: boolean;
  violations: string[];
}

/** Palabras que hacen comercial un % (ventana ≤ 40 chars). */
const DISCOUNT_CONTEXT =
  /\b(descuento|promo|promocion|rebaja|off|gratis|gratuito|precio|costo|coste|pagar|pago|barato)\b/;

/**
 * Expresiones con % no comerciales (modalidad, práctica, asistencia, etc.).
 * Se ignoran aunque el número no esté en el catálogo de promos.
 */
const NON_COMMERCIAL_PERCENT_ALLOWLIST: RegExp[] = [
  /\b100\s*%\s*(virtual|en\s*linea|online|remoto|presencial|sincrono|asincrono)\b/,
  /\b\d+\s*%\s*(practico|teorico|hands[\s-]?on|ejercicios?|laboratorio|asistencia|avance)\b/,
  /\b(practico|teorico|virtual|en\s*linea|online)\s*\d+\s*%\b/,
  /\bal\s*\d+\s*%\s*(de\s+)?(capacidad|asistencia|avance|completado)\b/,
];

const MONEY_CONTEXT =
  /(\$|usd|\bdolares?\b|\bcuesta\b|\bprecio\b|\bcosto\b|\bcoste\b|\bpagar\b|\bvale\b|\bbarato\b)/;

export function preCheck(text: string): PreCheckResult {
  const normalized = normalizeForMatch(text);
  const matches: string[] = [];

  for (const { name, pattern } of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      matches.push(name);
    }
  }

  return { suspicious: matches.length > 0, matches };
}

export function postCheck(
  reply: string,
  allowedAmounts: Set<number>,
  allowedPercents: Set<number>,
): PostCheckResult {
  const violations: string[] = [];
  const normalized = normalizeForMatch(reply);

  const scrubbed = scrubNonMoneyNumbers(normalized);

  for (const amount of extractAmounts(scrubbed)) {
    if (!isAllowedAmount(amount, allowedAmounts)) {
      violations.push(`unauthorized_amount:${amount}`);
    }
  }

  for (const percent of extractCommercialPercents(scrubbed)) {
    if (!isAllowedPercent(percent, allowedPercents)) {
      violations.push(`unauthorized_percent:${percent}`);
    }
  }

  if (hasFreeCourseClaim(normalized)) {
    violations.push('free_course_claim');
  }

  for (const signature of PROMPT_SIGNATURES) {
    const sigNorm = normalizeForMatch(signature);
    if (sigNorm && normalized.includes(sigNorm)) {
      violations.push(`prompt_leak:${signature.slice(0, 40)}`);
    }
  }

  if (
    /\bsystem\s*prompt\b/.test(normalized) ||
    /\bmis\s+instrucciones\s+son\b/.test(normalized)
  ) {
    violations.push('prompt_meta_leak');
  }

  return { ok: violations.length === 0, violations };
}

/** Drop times, weeks, modules, hours, dates so they are not treated as money. */
export function scrubNonMoneyNumbers(text: string): string {
  return text
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, ' ')
    .replace(
      /\b\d+([.,]\d+)?\s*(semanas?|sem|modulos?|clases?|horas?|h\/sem|dias?|minutos?|mins?)\b/g,
      ' ',
    )
    .replace(/\b(modulo|semana|hora|clase|unidad)\s*\d+\b/g, ' ');
}

/**
 * Extrae importes solo con contexto monetario: $, USD, dólares, "cuesta",
 * "precio", "te lo dejo en 50", "a 50 dolares", etc.
 */
export function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  const patterns: RegExp[] = [
    /\$\s*(\d+(?:[.,]\d{1,2})?)/g,
    /usd\s*(\d+(?:[.,]\d{1,2})?)/g,
    /(\d+(?:[.,]\d{1,2})?)\s*usd\b/g,
    /(\d+(?:[.,]\d{1,2})?)\s*dolares?\b/g,
    /\b(?:cuesta|precio|costo|coste|vale|pagar(?:ias)?|pagas?)\s*(?:unos?\s*)?(?:\$\s*)?(\d+(?:[.,]\d{1,2})?)/g,
    /\b(?:te\s+lo\s+dejo|queda|sale)\s+en\s+(?:\$\s*)?(\d+(?:[.,]\d{1,2})?)/g,
    /\ba\s+(\d+(?:[.,]\d{1,2})?)\s*(?:usd|dolares?|bucks)?\b/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const raw = match[1].replace(',', '.');
      const value = Number(raw);
      if (Number.isNaN(value)) continue;

      // "a 50" sin moneda solo cuenta si hay contexto monetario cerca
      const slice = text.slice(
        Math.max(0, match.index - 30),
        Math.min(text.length, match.index + match[0].length + 30),
      );
      if (!MONEY_CONTEXT.test(slice) && !/\$|usd|dolares?/.test(match[0])) {
        // Patrones con "cuesta"/"precio"/… ya traen contexto en el propio match
        if (
          !/\b(cuesta|precio|costo|coste|vale|pagar|dejo|queda|sale)\b/.test(
            match[0],
          )
        ) {
          continue;
        }
      }

      amounts.push(value);
    }
  }

  return amounts;
}

/**
 * Solo valida % con contexto de descuento/precio (≤ 40 chars) y que no
 * entren en la allowlist de usos no comerciales.
 */
export function extractCommercialPercents(text: string): number[] {
  const percents: number[] = [];
  const patterns: RegExp[] = [/(\d+)\s*%/g, /(\d+)\s*por\s*ciento\b/g];

  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const value = Number(match[1]);
      if (Number.isNaN(value)) continue;

      const start = Math.max(0, match.index - 40);
      const end = Math.min(
        text.length,
        match.index + match[0].length + 40,
      );
      const window = text.slice(start, end);

      if (isNonCommercialPercent(window, match[0])) {
        continue;
      }
      if (!DISCOUNT_CONTEXT.test(window)) {
        continue;
      }

      percents.push(value);
    }
  }

  return percents;
}

function isNonCommercialPercent(window: string, matched: string): boolean {
  const around = `${window} ${matched}`;
  return NON_COMMERCIAL_PERCENT_ALLOWLIST.some((re) => re.test(around));
}

export function isAllowedAmount(value: number, allowed: Set<number>): boolean {
  for (const candidate of allowed) {
    if (Math.abs(candidate - value) <= 0.01) {
      return true;
    }
  }
  return false;
}

export function isAllowedPercent(value: number, allowed: Set<number>): boolean {
  for (const candidate of allowed) {
    if (Math.abs(candidate - value) <= 0.01) {
      return true;
    }
  }
  return false;
}

/**
 * "gratis"/"gratuito"/"sin costo"/"free" near curso/inscripción/matrícula,
 * except "cuotas sin intereses".
 */
export function hasFreeCourseClaim(normalized: string): boolean {
  const withoutInstallments = normalized.replace(
    /cuotas?\s+sin\s+intereses/g,
    ' ',
  );

  const freeNearCourse =
    /(?:curso|inscripcion|matricula)[\s\S]{0,50}(?:gratis|gratuito|sin\s+costo|\bfree\b)|(?:gratis|gratuito|sin\s+costo|\bfree\b)[\s\S]{0,50}(?:curso|inscripcion|matricula)/;

  // Por oración: un rechazo ("no hay cursos gratis") o una comparación
  // ("en YouTube es gratis, pero...") no es una oferta.
  const isRefusalOrComparison =
    /\b(no|ni|tampoco|nunca|youtube|internet)\b/;

  return withoutInstallments
    .split(/[.!?\n]+/)
    .some(
      (sentence) =>
        freeNearCourse.test(sentence) && !isRefusalOrComparison.test(sentence),
    );
}
