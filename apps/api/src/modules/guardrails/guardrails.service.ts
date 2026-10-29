import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
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

@Injectable()
export class GuardrailsService {
  private readonly logger = new Logger(GuardrailsService.name);

  constructor(private readonly catalog: CatalogService) {}

  preCheck(text: string): PreCheckResult {
    const normalized = normalizeForMatch(text);
    const matches: string[] = [];

    for (const { name, pattern } of INJECTION_PATTERNS) {
      if (pattern.test(normalized)) {
        matches.push(name);
      }
    }

    if (matches.length > 0) {
      this.logger.warn(
        `Injection preCheck flagged: [${matches.join(', ')}]`,
      );
    }

    return { suspicious: matches.length > 0, matches };
  }

  async postCheck(reply: string): Promise<PostCheckResult> {
    const violations: string[] = [];
    const normalized = normalizeForMatch(reply);

    const [allowedAmounts, allowedPercents] = await Promise.all([
      this.catalog.getAllowedAmounts(),
      this.catalog.getAllowedPercents(),
    ]);

    const scrubbed = scrubNonMoneyNumbers(normalized);

    for (const amount of extractAmounts(scrubbed)) {
      if (!isAllowedAmount(amount, allowedAmounts)) {
        violations.push(`unauthorized_amount:${amount}`);
      }
    }

    for (const percent of extractPercents(scrubbed)) {
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

    if (violations.length > 0) {
      this.logger.warn(
        `Guardrails postCheck blocked: [${violations.join(', ')}]`,
      );
    }

    return { ok: violations.length === 0, violations };
  }
}

/** Drop times, weeks, modules, hours so they are not treated as money. */
function scrubNonMoneyNumbers(text: string): string {
  return text
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(
      /\b\d+([.,]\d+)?\s*(semanas?|sem|modulos?|horas?|h\/sem|dias?)\b/g,
      ' ',
    )
    .replace(/\b(modulo|semana|hora)\s*\d+\b/g, ' ');
}

function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  const patterns: RegExp[] = [
    /\$\s*(\d+(?:[.,]\d{1,2})?)/g,
    /usd\s*(\d+(?:[.,]\d{1,2})?)/g,
    /(\d+(?:[.,]\d{1,2})?)\s*usd\b/g,
    /(\d+(?:[.,]\d{1,2})?)\s*dolares\b/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const raw = match[1].replace(',', '.');
      const value = Number(raw);
      if (!Number.isNaN(value)) {
        amounts.push(value);
      }
    }
  }

  return amounts;
}

function extractPercents(text: string): number[] {
  const percents: number[] = [];
  const patterns: RegExp[] = [
    /(\d+)\s*%/g,
    /(\d+)\s*por\s*ciento\b/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        percents.push(value);
      }
    }
  }

  return percents;
}

function isAllowedAmount(value: number, allowed: Set<number>): boolean {
  for (const candidate of allowed) {
    if (Math.abs(candidate - value) <= 0.01) {
      return true;
    }
  }
  return false;
}

function isAllowedPercent(value: number, allowed: Set<number>): boolean {
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
function hasFreeCourseClaim(normalized: string): boolean {
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
