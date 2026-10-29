import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../../config/env.schema';
import { CatalogService } from '../catalog/catalog.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { CtttScraperService } from './cttt-scraper.service';
import type { ScrapedCourse } from './ctt-scraper.logic';
import type {
  CatalogSyncResult,
  CatalogSyncRunRow,
  CatalogSyncStatus,
} from './catalog-sync.types';

const BOOT_DELAY_MS = 10_000;

@Injectable()
export class CatalogSyncService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CatalogSyncService.name);
  private lock = false;
  private bootTimer?: NodeJS.Timeout;
  private intervalTimer?: NodeJS.Timeout;
  private nextScheduledAt: Date | null = null;
  private readonly enabled: boolean;
  private readonly intervalHours: number;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly scraper: CtttScraperService,
    private readonly catalog: CatalogService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.enabled = this.config.get('CATALOG_SYNC_ENABLED', { infer: true });
    this.intervalHours = this.config.get('CATALOG_SYNC_HOURS', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.log('Catalog sync disabled (CATALOG_SYNC_ENABLED=false)');
      return;
    }

    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    this.bootTimer = setTimeout(() => {
      void this.sync().catch((err: unknown) =>
        this.logger.error(`Boot catalog sync failed: ${String(err)}`),
      );
      this.scheduleNext(intervalMs);
      this.intervalTimer = setInterval(() => {
        this.scheduleNext(intervalMs);
        void this.sync().catch((err: unknown) =>
          this.logger.error(`Scheduled catalog sync failed: ${String(err)}`),
        );
      }, intervalMs);
    }, BOOT_DELAY_MS);

    this.nextScheduledAt = new Date(Date.now() + BOOT_DELAY_MS);
    this.logger.log(
      `Catalog sync scheduled: first run in ${BOOT_DELAY_MS / 1000}s, then every ${this.intervalHours}h`,
    );
  }

  onModuleDestroy(): void {
    if (this.bootTimer) clearTimeout(this.bootTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
  }

  private scheduleNext(intervalMs: number): void {
    this.nextScheduledAt = new Date(Date.now() + intervalMs);
  }

  async getStatus(): Promise<CatalogSyncStatus> {
    const lastRun = await this.fetchLastRun();
    return {
      enabled: this.enabled,
      intervalHours: this.intervalHours,
      running: this.lock,
      nextScheduledAt: this.enabled
        ? (this.nextScheduledAt?.toISOString() ?? null)
        : null,
      lastRun,
    };
  }

  async sync(): Promise<CatalogSyncResult> {
    if (this.lock) {
      return {
        ok: false,
        total: 0,
        upserted: 0,
        deactivated: 0,
        durationMs: 0,
        error: 'Sync already in progress',
      };
    }

    this.lock = true;
    const startedAt = new Date().toISOString();
    const wallStart = Date.now();

    try {
      const scrape = await this.scraper.scrapeAll({
        pageTimeoutMs: 15_000,
        concurrency: 3,
      });
      const scraped = scrape.courses;

      const activeCtt = await this.countActiveCttCourses();
      if (scraped.length === 0) {
        const error =
          'Scraping returned 0 courses; catalog left unchanged (possible site outage or HTML change)';
        this.logger.error(error);
        const result: CatalogSyncResult = {
          ok: false,
          total: 0,
          upserted: 0,
          deactivated: 0,
          durationMs: Date.now() - wallStart,
          error,
        };
        await this.persistRun(startedAt, result);
        return result;
      }

      if (activeCtt > 0 && scraped.length < activeCtt * 0.5) {
        const error = `Scraping returned only ${scraped.length} courses vs ${activeCtt} active ctt-* (<50%); catalog left unchanged`;
        this.logger.error(error);
        const result: CatalogSyncResult = {
          ok: false,
          total: scraped.length,
          upserted: 0,
          deactivated: 0,
          durationMs: Date.now() - wallStart,
          error,
        };
        await this.persistRun(startedAt, result);
        return result;
      }

      let upserted = 0;
      for (const course of scraped) {
        const { error } = await this.supabase.from('courses').upsert(
          this.toDbRow(course),
          { onConflict: 'id' },
        );
        if (error) {
          this.logger.warn(`Upsert failed for ${course.id}: ${error.message}`);
          continue;
        }
        upserted += 1;
      }

      const scrapedIds = new Set(scraped.map((c) => c.id));
      const deactivated = await this.deactivateMissing(scrapedIds);

      try {
        await this.catalog.refresh();
      } catch (err) {
        this.logger.warn(`Catalog cache refresh failed: ${String(err)}`);
      }

      const result: CatalogSyncResult = {
        ok: true,
        total: scraped.length,
        upserted,
        deactivated,
        durationMs: Date.now() - wallStart,
      };
      await this.persistRun(startedAt, result);
      this.logger.log(
        `Catalog sync ok: total=${result.total} upserted=${result.upserted} deactivated=${result.deactivated} (${result.durationMs}ms)`,
      );
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Catalog sync failed: ${error}`);
      const result: CatalogSyncResult = {
        ok: false,
        total: 0,
        upserted: 0,
        deactivated: 0,
        durationMs: Date.now() - wallStart,
        error,
      };
      await this.persistRun(startedAt, result);
      return result;
    } finally {
      this.lock = false;
    }
  }

  private toDbRow(c: ScrapedCourse): Record<string, unknown> {
    return {
      id: c.id,
      name: c.name,
      level: null,
      duration_weeks: null,
      hours_per_week: null,
      total_hours: c.total_hours,
      price_usd: c.price_usd,
      price_tiers: c.price_tiers,
      modality: c.modality ?? '',
      start_date: c.start_date,
      end_date: c.end_date,
      enrollment_start: c.enrollment_start,
      enrollment_end: c.enrollment_end,
      schedules: c.schedules,
      syllabus: c.syllabus,
      outcomes: c.outcomes ?? '',
      location: c.location,
      instructors: c.instructors,
      prerequisites: c.prerequisites,
      certificate: c.certificate,
      source_url: c.source_url,
      enrollment_form_url: c.enrollment_form_url,
      site_status: c.site_status,
      enroll_open_on_site: c.enroll_open_on_site,
      active: true,
    };
  }

  private async countActiveCttCourses(): Promise<number> {
    const { data, error } = await this.supabase
      .from('courses')
      .select('id')
      .eq('active', true)
      .like('id', 'ctt-%');

    if (error) {
      this.logger.warn(`Could not count active ctt courses: ${error.message}`);
      return 0;
    }
    return data?.length ?? 0;
  }

  /** Soft-deactivate ctt-* courses no longer on the website. Never DELETE. */
  private async deactivateMissing(
    scrapedIds: Set<string>,
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('courses')
      .select('id')
      .eq('active', true)
      .like('id', 'ctt-%');

    if (error) {
      this.logger.warn(`Could not list active ctt courses: ${error.message}`);
      return 0;
    }

    const toDeactivate = (data ?? [])
      .map((r) => String(r.id))
      .filter((id) => !scrapedIds.has(id));

    if (toDeactivate.length === 0) return 0;

    const { error: updError } = await this.supabase
      .from('courses')
      .update({ active: false })
      .in('id', toDeactivate);

    if (updError) {
      this.logger.warn(`Deactivate failed: ${updError.message}`);
      return 0;
    }
    return toDeactivate.length;
  }

  private async persistRun(
    startedAt: string,
    result: CatalogSyncResult,
  ): Promise<void> {
    const { error } = await this.supabase.from('catalog_sync_runs').insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: result.ok,
      total: result.total,
      upserted: result.upserted,
      deactivated: result.deactivated,
      error: result.error ?? null,
    });
    if (error) {
      this.logger.warn(`Could not persist sync run: ${error.message}`);
    }
  }

  private async fetchLastRun(): Promise<CatalogSyncRunRow | null> {
    const { data, error } = await this.supabase
      .from('catalog_sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.warn(`Could not load last sync run: ${error.message}`);
      return null;
    }
    if (!data) return null;

    return {
      id: String(data.id),
      started_at: String(data.started_at),
      finished_at: data.finished_at == null ? null : String(data.finished_at),
      ok: Boolean(data.ok),
      total: Number(data.total ?? 0),
      upserted: Number(data.upserted ?? 0),
      deactivated: Number(data.deactivated ?? 0),
      error: data.error == null ? null : String(data.error),
    };
  }
}
