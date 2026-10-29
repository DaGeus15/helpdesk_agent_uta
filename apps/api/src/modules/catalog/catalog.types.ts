export interface SyllabusModule {
  module: number;
  title: string;
  topics: string[];
}

export interface Course {
  id: string;
  name: string;
  level: 'inicial' | 'intermedio' | 'avanzado';
  duration_weeks: number;
  hours_per_week: number;
  price_usd: number;
  modality: string;
  start_date: string;
  schedules: string[];
  syllabus: SyllabusModule[];
  outcomes: string;
  active: boolean;
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
