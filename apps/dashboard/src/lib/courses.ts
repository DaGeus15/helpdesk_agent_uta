export const TELEGRAM_BOT_URL = 'https://t.me/HelpdeskUTA15Bot'
export const CONTACT_EMAILS = [
  'talleresfisei@uta.edu.ec',
  'ctt.fisei@uta.edu.ec',
] as const
export const CAMPUS_ADDRESS =
  'Av. Los Chasquis y Río Guayllabamba, Campus Huachi, Ambato'

export interface SyllabusModule {
  module: number
  title: string
  topics?: string[]
}

export interface PriceTier {
  audience: string
  price_usd: number
}

export type CourseStatus =
  | 'inscripciones_abiertas'
  | 'en_curso'
  | 'proximamente'
  | 'finalizado'

export interface CourseRow {
  id: string
  name: string
  level?: string | null
  duration_weeks?: number | null
  hours_per_week?: number | null
  total_hours?: number | null
  price_usd?: number | null
  price_tiers?: PriceTier[] | null
  modality?: string | null
  start_date?: string | null
  end_date?: string | null
  enrollment_start?: string | null
  enrollment_end?: string | null
  /** Web site toggle: open enrollments regardless of start date window. */
  enroll_open_on_site?: boolean | null
  schedules?: string[] | null
  syllabus?: SyllabusModule[] | null
  outcomes?: string | null
  location?: string | null
  instructors?: string | null
  prerequisites?: string | null
  certificate?: string | null
  source_url?: string | null
  site_status?: string | null
  active?: boolean | null
}

export interface Course extends CourseRow {
  status: CourseStatus
}

export const COURSE_STATUS_META: Record<
  CourseStatus,
  { label: string; className: string; order: number }
> = {
  inscripciones_abiertas: {
    label: 'Inscripciones abiertas',
    className:
      'border-emerald-200/80 bg-emerald-50 text-emerald-800',
    order: 0,
  },
  en_curso: {
    label: 'En curso',
    className: 'border-sky-200/80 bg-sky-50 text-sky-800',
    order: 1,
  },
  proximamente: {
    label: 'Próximamente',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    order: 2,
  },
  finalizado: {
    label: 'Finalizado',
    className: 'border-slate-100 bg-slate-50 text-slate-400',
    order: 3,
  },
}

export function todayInGuayaquil(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Guayaquil',
  })
}

export function computeCourseStatus(
  course: CourseRow,
  today = todayInGuayaquil(),
): CourseStatus {
  const {
    enrollment_start,
    enrollment_end,
    start_date,
    end_date,
    site_status,
    enroll_open_on_site,
  } = course

  // Botón de la web: prioridad sobre las ventanas de fechas.
  if (
    enroll_open_on_site &&
    (!enrollment_end || today <= enrollment_end)
  ) {
    return 'inscripciones_abiertas'
  }

  if (
    enrollment_start &&
    enrollment_end &&
    today >= enrollment_start &&
    today <= enrollment_end
  ) {
    return 'inscripciones_abiertas'
  }
  if (start_date && end_date && today >= start_date && today <= end_date) {
    return 'en_curso'
  }
  if (end_date && today > end_date) {
    return 'finalizado'
  }
  if (
    (enrollment_start && today < enrollment_start) ||
    (start_date && !enrollment_start && today < start_date)
  ) {
    return 'proximamente'
  }
  if (start_date && !end_date && today >= start_date) {
    return 'en_curso'
  }

  const site = (site_status || '').toLowerCase()
  if (site === 'abierto') return 'inscripciones_abiertas'
  if (site === 'cerrado') return 'finalizado'
  return 'proximamente'
}

export function normalizeCourse(row: CourseRow): Course {
  return {
    ...row,
    price_tiers: Array.isArray(row.price_tiers) ? row.price_tiers : [],
    schedules: Array.isArray(row.schedules) ? row.schedules : [],
    syllabus: Array.isArray(row.syllabus) ? row.syllabus : [],
    status: computeCourseStatus(row),
  }
}

export function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function formatDateRange(
  start?: string | null,
  end?: string | null,
): string | null {
  if (!start && !end) return null
  if (start && end) return `${start} → ${end}`
  return start || end || null
}

/** Formats an ISO date as "30 de octubre" (Spanish day + month, no year). */
export function formatSpanishDayMonth(isoDate?: string | null): string | null {
  if (!isoDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  return date.toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export function minPriceFromTiers(course: CourseRow): number | null {
  const tiers = Array.isArray(course.price_tiers) ? course.price_tiers : []
  if (tiers.length > 0) {
    return Math.min(...tiers.map((t) => t.price_usd))
  }
  return course.price_usd ?? null
}

export function sortCoursesByStatus(a: Course, b: Course): number {
  const orderDiff =
    COURSE_STATUS_META[a.status].order - COURSE_STATUS_META[b.status].order
  if (orderDiff !== 0) return orderDiff
  return a.name.localeCompare(b.name, 'es')
}
