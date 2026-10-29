import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { CENTER_INFO } from './catalog.constants';
import type { Course, Promotion, SyllabusModule } from './catalog.types';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CatalogCache {
  courses: Course[];
  promotions: Promotion[];
  expiresAt: number;
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private cache: CatalogCache | null = null;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async refresh(): Promise<void> {
    const [coursesRes, promotionsRes] = await Promise.all([
      this.supabase.from('courses').select('*').eq('active', true),
      this.supabase.from('promotions').select('*').eq('active', true),
    ]);

    if (coursesRes.error) {
      throw new Error(`Failed to load courses: ${coursesRes.error.message}`);
    }
    if (promotionsRes.error) {
      throw new Error(
        `Failed to load promotions: ${promotionsRes.error.message}`,
      );
    }

    const today = todayIsoDate();
    const courses = (coursesRes.data ?? []).map(mapCourse);
    const promotions = (promotionsRes.data ?? [])
      .map(mapPromotion)
      .filter((promo) => promo.valid_until >= today);

    this.cache = {
      courses,
      promotions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    this.logger.debug(
      `Catalog refreshed: ${courses.length} courses, ${promotions.length} promotions`,
    );
  }

  async getCourses(): Promise<Course[]> {
    await this.ensureCache();
    return this.cache!.courses;
  }

  async getPromotions(): Promise<Promotion[]> {
    await this.ensureCache();
    return this.cache!.promotions;
  }

  async getCompactCatalog(): Promise<string> {
    const [courses, promotions] = await Promise.all([
      this.getCourses(),
      this.getPromotions(),
    ]);

    const courseLines: string[] = ['CURSOS'];
    for (const course of courses) {
      const schedules = course.schedules.join(' · ');
      courseLines.push(
        `${course.id} | ${course.name} | nivel ${course.level} | ${course.duration_weeks}sem ${course.hours_per_week}h/sem | $${formatMoney(course.price_usd)} | inicio ${course.start_date} | ${schedules}`,
      );
      for (const mod of course.syllabus) {
        courseLines.push(
          `  ${mod.module}. ${mod.title}: ${mod.topics.join(', ')}`,
        );
      }
    }

    const promoLines: string[] = ['PROMOCIONES VIGENTES'];
    if (promotions.length === 0) {
      promoLines.push('(ninguna)');
    } else {
      for (const promo of promotions) {
        promoLines.push(
          `${promo.id} | ${promo.discount_percent}% | ${promo.conditions} | hasta ${promo.valid_until}`,
        );
      }
    }

    const general = [
      'DATOS GENERALES',
      `Centro: ${CENTER_INFO.name}`,
      `Sede: ${CENTER_INFO.sede}`,
      `Modalidad: ${CENTER_INFO.modalidad}`,
      `Incluye: ${CENTER_INFO.incluye}`,
      `Pagos: ${CENTER_INFO.pagos}`,
      `Garantía: ${CENTER_INFO.garantia}`,
      `Asesores: ${CENTER_INFO.asesores}`,
    ];

    return [...courseLines, '', ...promoLines, '', ...general].join('\n');
  }

  async getAllowedAmounts(): Promise<Set<number>> {
    const [courses, promotions] = await Promise.all([
      this.getCourses(),
      this.getPromotions(),
    ]);

    const amounts = new Set<number>();
    const add = (value: number) => amounts.add(round2(value));

    for (const course of courses) {
      const base = course.price_usd;
      add(base);
      add(base / 2);

      for (const promo of promotions) {
        if (promo.id === 'COMBO20') {
          continue;
        }
        if (!promoAppliesTo(promo, course.id)) {
          continue;
        }
        const discounted = base * (1 - promo.discount_percent / 100);
        add(discounted);
        add(discounted / 2);
      }
    }

    const combo = promotions.find((p) => p.id === 'COMBO20');
    if (combo) {
      for (const course of courses) {
        add(course.price_usd * 0.8);
      }
      for (let i = 0; i < courses.length; i++) {
        for (let j = i + 1; j < courses.length; j++) {
          const a = courses[i].price_usd;
          const b = courses[j].price_usd;
          const expensive = Math.max(a, b);
          const cheap = Math.min(a, b);
          add(expensive + cheap * 0.8);
        }
      }
    }

    return amounts;
  }

  async getAllowedPercents(): Promise<Set<number>> {
    const promotions = await this.getPromotions();
    const percents = new Set<number>([50, 100]);
    for (const promo of promotions) {
      percents.add(promo.discount_percent);
    }
    return percents;
  }

  private async ensureCache(): Promise<void> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return;
    }
    await this.refresh();
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function promoAppliesTo(promo: Promotion, courseId: string): boolean {
  if (promo.applies_to == null || promo.applies_to.length === 0) {
    return true;
  }
  return promo.applies_to.includes(courseId);
}

function mapCourse(row: Record<string, unknown>): Course {
  return {
    id: String(row.id),
    name: String(row.name),
    level: row.level as Course['level'],
    duration_weeks: Number(row.duration_weeks),
    hours_per_week: Number(row.hours_per_week),
    price_usd: Number(row.price_usd),
    modality: String(row.modality),
    start_date: String(row.start_date),
    schedules: Array.isArray(row.schedules)
      ? (row.schedules as string[])
      : [],
    syllabus: Array.isArray(row.syllabus)
      ? (row.syllabus as SyllabusModule[])
      : [],
    outcomes: String(row.outcomes),
    active: Boolean(row.active),
  };
}

function mapPromotion(row: Record<string, unknown>): Promotion {
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
