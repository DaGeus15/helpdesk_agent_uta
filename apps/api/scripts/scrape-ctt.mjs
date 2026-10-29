#!/usr/bin/env node
/**
 * Thin wrapper: scrapes CTT-FISEI into supabase/data/ctt-cursos.json
 * and generates supabase/seed_ctt.sql using the same logic as CatalogSync.
 *
 * Requires a prior build: pnpm --filter api build
 * Usage: node apps/api/scripts/scrape-ctt.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const JSON_OUT = join(ROOT, 'supabase', 'data', 'ctt-cursos.json');
const SQL_OUT = join(ROOT, 'supabase', 'seed_ctt.sql');

let logic;
try {
  logic = require('../dist/modules/catalog-sync/ctt-scraper.logic.js');
} catch (err) {
  console.error(
    'Missing compiled scraper. Run: pnpm --filter api build\n',
    err.message,
  );
  process.exit(1);
}

const { scrapeAllCourses, generateSeedSql } = logic;

async function main() {
  console.log('Fetching course list…');
  const { courses, errors, durationMs } = await scrapeAllCourses({
    pageTimeoutMs: 15_000,
    concurrency: 3,
    onProgress: (meta, status, detail) => {
      if (status === 'ok') {
        console.log(
          `  Scraping ${meta.slug} (${meta.site_status})… ${(detail || '').slice(0, 40)}…`,
        );
      } else {
        console.log(`  Scraping ${meta.slug}… ERROR: ${detail}`);
      }
    },
  });

  if (errors.length) {
    console.warn(`Skipped ${errors.length} course(s):`);
    for (const e of errors) console.warn(`  - ${e.slug}: ${e.message}`);
  }

  const withPrices = courses.filter((c) => c.price_tiers.length > 0);
  const withForms = courses.filter((c) => c.enrollment_form_url);
  console.log(
    `\nScraped ${courses.length} courses, ${withPrices.length} with prices, ${withForms.length} with enrollment form (${durationMs}ms).`,
  );

  mkdirSync(dirname(JSON_OUT), { recursive: true });
  writeFileSync(JSON_OUT, JSON.stringify(courses, null, 2), 'utf8');
  writeFileSync(SQL_OUT, generateSeedSql(courses), 'utf8');
  console.log(`Wrote ${JSON_OUT}`);
  console.log(`Wrote ${SQL_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
