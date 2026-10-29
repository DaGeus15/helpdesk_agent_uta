/**
 * Pure catalog helpers (status, compact text, allowed prices). No Nest / DB.
 */
import { CENTER_INFO } from './catalog.constants';
import type {
  Course,
  CourseStatus,
  PriceTier,
  Promotion,
  SyllabusModule,
} from './catalog.types';

const TZ = 'America/Guayaquil';

export const STATUS_ORDER: CourseStatus[] = [
  'inscripciones_abiertas',
  'en_curso',
  'proximamente',
  'finalizado',
];

export const STATUS_LABEL: Record<CourseStatus, string> = {
  inscripciones_abiertas: 'INSCRIPCIONES ABIERTAS',
  en_curso: 'EN CURSO',
  proximamente: 'PRÓXIMAMENTE',
  finalizado: 'FINALIZADOS',
};

/** ISO date YYYY-MM-DD in America/Guayaquil for the given instant (default: now). */
export function todayIsoDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function computeStatus(
  course: Omit<Course, 'status'>,
  today: string,
): CourseStatus {
  const {
    enrollment_start,
    enrollment_end,
    start_date,
    end_date,
    site_status,
    enroll_open_on_site,
  } = course;

  // Web listing button wins over date windows (may open before enrollment_start).
  if (
    enroll_open_on_site &&
    (!enrollment_end || today <= enrollment_end)
  ) {
    return 'inscripciones_abiertas';
  }

  if (
    enrollment_start &&
    enrollment_end &&
    today >= enrollment_start &&
    today <= enrollment_end
  ) {
    return 'inscripciones_abiertas';
  }
  if (start_date && end_date && today >= start_date && today <= end_date) {
    return 'en_curso';
  }
  if (end_date && today > end_date) {
    return 'finalizado';
  }
  if (
    (enrollment_start && today < enrollment_start) ||
    (start_date && !enrollment_start && today < start_date)
  ) {
    return 'proximamente';
  }
  if (start_date && !end_date && today >= start_date) {
    return 'en_curso';
  }
  if (end_date && today <= end_date && start_date && today >= start_date) {
    return 'en_curso';
  }

  // Fallback when dates are missing: site_status from the public listing
  const site = (site_status || '').toLowerCase();
  if (site === 'abierto') return 'inscripciones_abiertas';
  if (site === 'cerrado') return 'finalizado';
  if (end_date && today > end_date) return 'finalizado';
  return 'proximamente';
}

export function formatCourseCompact(course: Course): string {
  const prices =
    course.price_tiers.length > 0
      ? course.price_tiers
          .map((t) => `${t.audience}: $${formatMoney(t.price_usd)}`)
          .join(' · ')
      : `público general: $${formatMoney(course.price_usd)}`;

  const enroll =
    course.enrollment_start && course.enrollment_end
      ? `inscripción ${course.enrollment_start}→${course.enrollment_end}`
      : 'inscripción: ver página';
  const run =
    course.start_date && course.end_date
      ? `curso ${course.start_date}→${course.end_date}`
      : course.start_date
        ? `inicio ${course.start_date}`
        : 'fechas de curso: ver página';
  const schedule = course.schedules.length
    ? course.schedules.join(' · ')
    : 'horario: ver página';
  const place = [course.modality, course.location].filter(Boolean).join(' / ');
  const hours =
    course.total_hours != null ? `${course.total_hours} h` : 'horas: n/d';
  const req = course.prerequisites
    ? `requisitos: ${truncate(course.prerequisites, 120)}`
    : 'requisitos: n/d';
  const syllabusSummary = summarizeSyllabus(course.syllabus);
  const url = course.source_url || CENTER_INFO.site;

  return [
    `- ${course.name} [${course.status}] | ${enroll} | ${run}`,
    `  ${schedule} | ${place} | ${hours}`,
    `  precios: ${prices}`,
    `  ${req}`,
    `  temario: ${syllabusSummary}`,
    `  inscripción: ${url}`,
  ].join('\n');
}

function summarizeSyllabus(syllabus: SyllabusModule[]): string {
  if (!syllabus.length) return '(ver página del curso)';
  const titles = syllabus.map((m) => `${m.module}. ${m.title}`);
  if (titles.length <= 6) return titles.join('; ');
  return `${titles.slice(0, 5).join('; ')}; … (+${titles.length - 5} más)`;
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Compact catalog text for the LLM (same layout as CatalogService.getCompactCatalog). */
export function formatCompactCatalog(
  courses: Course[],
  promotions: Promotion[],
): string {
  const lines: string[] = [CENTER_INFO.compactHeader, '', 'CURSOS POR ESTADO'];

  for (const status of STATUS_ORDER) {
    const group = courses.filter((c) => c.status === status);
    if (group.length === 0) continue;
    lines.push(`\n## ${STATUS_LABEL[status]} (${group.length})`);
    if (status === 'finalizado') {
      // Ediciones pasadas en una línea: así el modelo no las confunde con la edición vigente
      // de un curso con el mismo nombre (p. ej. Python 2 de 2025 frente al de noviembre de 2026).
      lines.push(
        'Ediciones ANTERIORES ya terminadas. Si un curso aparece también arriba, vale SIEMPRE la edición de arriba.',
      );
      for (const course of group) {
        lines.push(
          `- ${course.name} (edición finalizada${course.end_date ? ` el ${course.end_date}` : ''})`,
        );
      }
      continue;
    }
    for (const course of group) {
      lines.push(formatCourseCompact(course));
    }
  }

  lines.push('', 'PROMOCIONES VIGENTES');
  if (promotions.length === 0) {
    lines.push('(ninguna — la web oficial no publica descuentos por chat)');
  } else {
    for (const promo of promotions) {
      lines.push(
        `${promo.id} | ${promo.discount_percent}% | ${promo.conditions} | hasta ${promo.valid_until}`,
      );
    }
  }

  return lines.join('\n');
}

export function collectAllowedAmounts(courses: Course[]): Set<number> {
  const amounts = new Set<number>();
  const add = (value: number) => {
    if (Number.isFinite(value)) amounts.add(round2(value));
  };

  for (const course of courses) {
    add(course.price_usd);
    for (const tier of course.price_tiers) {
      add(tier.price_usd);
    }
  }
  return amounts;
}

export function collectAllowedPercents(promotions: Promotion[]): Set<number> {
  const percents = new Set<number>();
  for (const promo of promotions) {
    percents.add(promo.discount_percent);
  }
  return percents;
}

export function mapCourse(
  row: Record<string, unknown>,
  today: string,
): Course {
  const base: Omit<Course, 'status'> = {
    id: String(row.id),
    name: String(row.name),
    level: (row.level as Course['level']) ?? null,
    duration_weeks:
      row.duration_weeks == null ? null : Number(row.duration_weeks),
    hours_per_week:
      row.hours_per_week == null ? null : Number(row.hours_per_week),
    total_hours: row.total_hours == null ? null : Number(row.total_hours),
    price_usd: Number(row.price_usd),
    price_tiers: Array.isArray(row.price_tiers)
      ? (row.price_tiers as PriceTier[])
      : [],
    modality: String(row.modality ?? ''),
    start_date: row.start_date == null ? null : String(row.start_date),
    end_date: row.end_date == null ? null : String(row.end_date),
    enrollment_start:
      row.enrollment_start == null ? null : String(row.enrollment_start),
    enrollment_end:
      row.enrollment_end == null ? null : String(row.enrollment_end),
    schedules: Array.isArray(row.schedules) ? (row.schedules as string[]) : [],
    syllabus: Array.isArray(row.syllabus)
      ? (row.syllabus as SyllabusModule[])
      : [],
    outcomes: String(row.outcomes ?? ''),
    location: row.location == null ? null : String(row.location),
    instructors: row.instructors == null ? null : String(row.instructors),
    prerequisites:
      row.prerequisites == null ? null : String(row.prerequisites),
    certificate: row.certificate == null ? null : String(row.certificate),
    source_url: row.source_url == null ? null : String(row.source_url),
    enrollment_form_url:
      row.enrollment_form_url == null
        ? null
        : String(row.enrollment_form_url),
    site_status: row.site_status == null ? null : String(row.site_status),
    enroll_open_on_site: Boolean(row.enroll_open_on_site),
    active: Boolean(row.active),
  };
  return { ...base, status: computeStatus(base, today) };
}

export function mapPromotion(row: Record<string, unknown>): Promotion {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    discount_percent: Number(row.discount_percent),
    applies_to: Array.isArray(row.applies_to)
      ? (row.applies_to as string[])
      : null,
    conditions: String(row.conditions),
    valid_until: String(row.valid_until),
    active: Boolean(row.active),
  };
}
