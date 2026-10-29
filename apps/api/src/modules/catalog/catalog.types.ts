export interface SyllabusModule {
  module: number;
  title: string;
  topics: string[];
}

export interface PriceTier {
  audience: string;
  price_usd: number;
}

/** Computed enrollment/course lifecycle for America/Guayaquil "today". */
export type CourseStatus =
  | 'inscripciones_abiertas'
  | 'en_curso'
  | 'proximamente'
  | 'finalizado';

export interface Course {
  id: string;
  name: string;
  level: 'inicial' | 'intermedio' | 'avanzado' | null;
  duration_weeks: number | null;
  hours_per_week: number | null;
  total_hours: number | null;
  price_usd: number;
  price_tiers: PriceTier[];
  modality: string;
  start_date: string | null;
  end_date: string | null;
  enrollment_start: string | null;
  enrollment_end: string | null;
  schedules: string[];
  syllabus: SyllabusModule[];
  outcomes: string;
  location: string | null;
  instructors: string | null;
  prerequisites: string | null;
  certificate: string | null;
  source_url: string | null;
  site_status: string | null;
  active: boolean;
  /** Derived; not stored in DB. */
  status: CourseStatus;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_percent: number;
  applies_to: string[] | null;
  conditions: string;
  valid_until: string;
  active: boolean;
}
