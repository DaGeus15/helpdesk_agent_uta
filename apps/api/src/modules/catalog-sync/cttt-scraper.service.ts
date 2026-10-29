import { Injectable, Logger } from '@nestjs/common';
import {
  scrapeAllCourses,
  scrapeCourse,
  listCourses,
  fetchText,
  CTT_LIST_URL,
  type ScrapedCourse,
  type ScrapeAllResult,
  type ScrapeOptions,
  type CourseListMeta,
} from './ctt-scraper.logic';

@Injectable()
export class CtttScraperService {
  private readonly logger = new Logger(CtttScraperService.name);

  async scrapeAll(options?: ScrapeOptions): Promise<ScrapeAllResult> {
    this.logger.log('Scraping CTT-FISEI course catalog…');
    const result = await scrapeAllCourses({
      ...options,
      onProgress: (meta, status, detail) => {
        if (status === 'ok') {
          this.logger.debug(`  ✓ ${meta.slug}: ${detail?.slice(0, 50) ?? ''}`);
        } else {
          this.logger.warn(`  ✗ ${meta.slug}: ${detail}`);
        }
        options?.onProgress?.(meta, status, detail);
      },
    });
    this.logger.log(
      `Scraped ${result.courses.length} courses (${result.errors.length} skipped) in ${result.durationMs}ms`,
    );
    return result;
  }

  async fetchList(): Promise<CourseListMeta[]> {
    const html = await fetchText(CTT_LIST_URL);
    return listCourses(html);
  }

  async scrapeOne(meta: CourseListMeta): Promise<ScrapedCourse> {
    return scrapeCourse(meta);
  }
}
