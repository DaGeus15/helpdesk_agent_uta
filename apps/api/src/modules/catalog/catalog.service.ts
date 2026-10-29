import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import {
  collectAllowedAmounts,
  collectAllowedPercents,
  formatCompactCatalog,
  mapCourse,
  mapPromotion,
  todayIsoDate,
} from './catalog.logic';
import type { Course, Promotion } from './catalog.types';

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
    const courses = (coursesRes.data ?? []).map((row) =>
      mapCourse(row as Record<string, unknown>, today),
    );
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

  async getCourseById(id: string): Promise<Course | null> {
    const courses = await this.getCourses();
    return courses.find((c) => c.id === id) ?? null;
  }

  /** Best-effort match by name / interest text (normalized contains). */
  async findCourseByInterest(interest: string): Promise<Course | null> {
    const hint = interest
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .trim();
    if (!hint) return null;
    const courses = await this.getCourses();
    let best: { course: Course; score: number } | null = null;
    for (const course of courses) {
      const name = course.name
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();
      let score = 0;
      if (name === hint) score = 100;
      else if (name.includes(hint) || hint.includes(name)) score = 50;
      else {
        const tokens = hint.split(/\s+/).filter((t) => t.length > 3);
        score = tokens.filter((t) => name.includes(t)).length;
      }
      if (!best || score > best.score) best = { course, score };
    }
    return best && best.score > 0 ? best.course : null;
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
    return formatCompactCatalog(courses, promotions);
  }

  async getAllowedAmounts(): Promise<Set<number>> {
    const courses = await this.getCourses();
    return collectAllowedAmounts(courses);
  }

  async getAllowedPercents(): Promise<Set<number>> {
    const promotions = await this.getPromotions();
    return collectAllowedPercents(promotions);
  }

  private async ensureCache(): Promise<void> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return;
    }
    await this.refresh();
  }
}
