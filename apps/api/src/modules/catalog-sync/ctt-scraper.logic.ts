/**
 * Pure CTT-FISEI scraping/parsing (fetch + regex, no deps).
 * Shared by CtttScraperService and apps/api/scripts/scrape-ctt.mjs.
 */

export const CTT_BASE = 'https://ctt-talleresfisei.uta.edu.ec';
export const CTT_LIST_URL = `${CTT_BASE}/course.php`;

const USER_AGENT = 'CTT-FISEI-catalog-scraper/1.0 (hackathon UTA)';
const DEFAULT_PAGE_TIMEOUT_MS = 15_000;
const DEFAULT_CONCURRENCY = 3;

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export interface PriceTier {
  audience: string;
  price_usd: number;
}

export interface SyllabusModule {
  module: number;
  title: string;
  topics: string[];
}

export interface CourseListMeta {
  n: number;
  slug: string;
  list_title: string;
  site_status: string;
  /** True when the listing card shows INSCRIBIRME / #inscripcion. */
  enroll_open_on_site: boolean;
  source_url: string;
}

export interface ScrapedCourse {
  id: string;
  n: number;
  name: string;
  list_title: string;
  description: string;
  objectives: string;
  outcomes: string;
  enrollment_raw: string | null;
  enrollment_start: string | null;
  enrollment_end: string | null;
  cupo: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  course_dates_raw: string | null;
  schedule: string | null;
  schedules: string[];
  modality: string | null;
  total_hours: number | null;
  prerequisites: string | null;
  certificate: string | null;
  instructors: string | null;
  price_tiers: PriceTier[];
  price_usd: number;
  syllabus: SyllabusModule[];
  site_status: string;
  /** True when the listing card shows INSCRIBIRME / #inscripcion. */
  enroll_open_on_site: boolean;
  source_url: string;
  enrollment_form_url: string | null;
  active: boolean;
}

export interface ScrapeOptions {
  pageTimeoutMs?: number;
  concurrency?: number;
  onProgress?: (meta: CourseListMeta, result: 'ok' | 'error', detail?: string) => void;
}

export interface ScrapeAllResult {
  courses: ScrapedCourse[];
  errors: { slug: string; message: string }[];
  durationMs: number;
}

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCharCode(Number(n)),
    );
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(day: number, month: number, year: number): string | null {
  if (!day || !month || !year) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Parse Spanish date ranges into { start, end } ISO dates. */
export function parseSpanishDateRange(text: string | null | undefined): {
  start: string | null;
  end: string | null;
} {
  if (!text) return { start: null, end: null };
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/\bdel\b/g, 'de')
    .trim();

  const dashed =
    /(\d{1,2})-([a-z]+)(?:-(\d{4}))?\s+al?\s+(\d{1,2})-([a-z]+)(?:-(\d{4}))?/i.exec(
      t,
    );
  if (dashed) {
    const yearEnd = dashed[6] ? +dashed[6] : dashed[3] ? +dashed[3] : null;
    const yearStart = dashed[3] ? +dashed[3] : yearEnd;
    if (yearStart && yearEnd && MONTHS[dashed[2]] && MONTHS[dashed[5]]) {
      return {
        start: toIso(+dashed[1], MONTHS[dashed[2]], yearStart),
        end: toIso(+dashed[4], MONTHS[dashed[5]], yearEnd),
      };
    }
  }

  const full =
    /(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})\s+al?\s+(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i.exec(
      t,
    );
  if (full) {
    return {
      start: toIso(+full[1], MONTHS[full[2]], +full[3]),
      end: toIso(+full[4], MONTHS[full[5]], +full[6]),
    };
  }

  const partial =
    /(\d{1,2})\s+de\s+([a-z]+)\s+al?\s+(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i.exec(
      t,
    );
  if (partial) {
    const year = +partial[5];
    const m1 = MONTHS[partial[2]];
    const m2 = MONTHS[partial[4]];
    const y1 = m1 > m2 ? year - 1 : year;
    return {
      start: toIso(+partial[1], m1, y1),
      end: toIso(+partial[3], m2, year),
    };
  }

  const single = /(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i.exec(t);
  if (single) {
    const iso = toIso(+single[1], MONTHS[single[2]], +single[3]);
    return { start: iso, end: iso };
  }
  return { start: null, end: null };
}

function extractSection(html: string, className: string): string {
  const re = new RegExp(
    `<div[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)</div>`,
    'i',
  );
  const m = re.exec(html);
  return m ? m[1] : '';
}

function extractBalancedDiv(html: string, startIndex: number): string {
  const openEnd = html.indexOf('>', startIndex);
  if (openEnd < 0) return '';
  let depth = 1;
  let i = openEnd + 1;
  while (i < html.length && depth > 0) {
    const nextOpen = html.toLowerCase().indexOf('<div', i);
    const nextClose = html.toLowerCase().indexOf('</div>', i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(openEnd + 1, nextClose);
      i = nextClose + 6;
    }
  }
  return html.slice(openEnd + 1);
}

function extractTab(html: string, tabId: string): string {
  const tabRe = new RegExp(
    `<div[^>]*class=["'][^"']*\\b${tabId}\\b[^"']*["'][^>]*>`,
    'gi',
  );
  let best = '';
  let m: RegExpExecArray | null;
  while ((m = tabRe.exec(html)) !== null) {
    const inner = extractBalancedDiv(html, m.index);
    if (inner.length >= best.length) best = inner;
  }
  return best;
}

function fieldFromTab(tabHtml: string, labelPattern: string): string | null {
  const re = new RegExp(
    `<strong>${labelPattern}:</strong>\\s*([\\s\\S]*?)(?=</li>|$)`,
    'i',
  );
  const m = re.exec(tabHtml);
  if (!m) return null;
  return stripTags(m[1]).replace(/^[:\s]+/, '').trim() || null;
}

function extractPriceBlock(tabHtml: string): string {
  const re =
    /<strong>\s*Precio(?:\s+para\s+los\s+asistentes)?\s*:?\s*<\/strong>\s*([\s\S]*?)(?=<li>\s*<strong>|<\/ul>\s*<\/div>)/i;
  const m = re.exec(tabHtml);
  if (!m) return '';
  return m[1];
}

function parsePrices(tabHtml: string): PriceTier[] {
  const tiers: PriceTier[] = [];
  const seen = new Set<string>();

  const add = (audience: string, price: number) => {
    const aud = audience
      .replace(/^[-•·]\s*/, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*\d+(?:[.,]\d{1,2})?\s*USD.*$/i, '')
      .trim();
    if (!aud || aud.length < 3 || Number.isNaN(price)) return;
    if (/^precio/i.test(aud)) return;
    const key = `${aud.toLowerCase()}|${price}`;
    if (seen.has(key)) return;
    seen.add(key);
    tiers.push({ audience: aud, price_usd: price });
  };

  const block = extractPriceBlock(tabHtml) || tabHtml;
  const textBlob = stripTags(block);

  const fmtA = /([^:\n$]{3,80}?):\s*\$\s*(\d+(?:[.,]\d{1,2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = fmtA.exec(textBlob)) !== null) {
    add(m[1], parseFloat(m[2].replace(',', '.')));
  }

  if (tiers.length === 0) {
    const fmtB = /(\d+(?:[.,]\d{1,2})?)\s*USD\s+([^\n]+)/gi;
    while ((m = fmtB.exec(textBlob)) !== null) {
      add(m[2].trim(), parseFloat(m[1].replace(',', '.')));
    }
  }

  const hasStudent = tiers.some((t) => /estudiante/i.test(t.audience));
  if (!hasStudent || tiers.length < 3) {
    const fmtC =
      /^(\d+(?:[.,]\d{1,2})?)\s+(?![Uu][Ss][Dd]\b)(Estudiantes[^\n]*|Graduados[^\n]*|P[uú]blico[^\n]*)$/gim;
    while ((m = fmtC.exec(textBlob)) !== null) {
      add(m[2].trim(), parseFloat(m[1].replace(',', '.')));
    }
  }

  return tiers;
}

function generalPrice(tiers: PriceTier[]): number {
  if (tiers.length === 0) return 0;
  const general = tiers.find((t) => /p[uú]blico|general/i.test(t.audience));
  if (general) return general.price_usd;
  return Math.max(...tiers.map((t) => t.price_usd));
}

function parseSyllabus(tab3Html: string): SyllabusModule[] {
  const items: SyllabusModule[] = [];
  const kindRe = 'M[oó]dulo|Clase|Unidad|Cap[ií]tulo';
  const re = new RegExp(
    `<(?:strong|b)[^>]*>\\s*(?:[•·\\-]\\s*)?(${kindRe})\\s+(\\d+)\\s*[:.]?\\s*</(?:strong|b)>\\s*([^<]*)`,
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(tab3Html)) !== null) {
    const kind = m[1];
    const num = Number(m[2]);
    const title = stripTags(m[3]).replace(/^[:.\-–—\s]+/, '').trim();
    items.push({
      module: num,
      title: title || `${kind} ${num}`,
      topics: [],
    });
  }
  if (items.length === 0) {
    const text = stripTags(tab3Html);
    const lineRe = new RegExp(
      `(${kindRe})\\s+(\\d+)\\s*[:.\\-–—]\\s*(.+)`,
      'gi',
    );
    while ((m = lineRe.exec(text)) !== null) {
      items.push({
        module: Number(m[2]),
        title: m[3].trim(),
        topics: [],
      });
    }
  }
  return items;
}

function extractEnrollmentFormUrl(html: string): string | null {
  const blocks: string[] = [];
  const reBlock = /<div[^>]*class=["'][^"']*\bregistro\b[^"']*["'][^>]*>/gi;
  let bm: RegExpExecArray | null;
  while ((bm = reBlock.exec(html)) !== null) {
    const inner = extractBalancedDiv(html, bm.index);
    if (inner) blocks.push(inner);
  }
  const searchIn = blocks.length > 0 ? blocks.join('\n') : html;
  const re =
    /href=["'](https:\/\/(?:forms\.gle\/[A-Za-z0-9_-]+|docs\.google\.com\/forms\/d\/e\/[^"'?\s#]+(?:\/viewform)?[^"']*))["']/i;
  const m = re.exec(searchIn);
  if (!m) return null;
  const url = m[1].replace(/&amp;/g, '&').trim();
  const long =
    /^(https:\/\/docs\.google\.com\/forms\/d\/e\/[^/]+)/i.exec(url);
  if (long) return `${long[1]}/viewform`;
  return url;
}

async function resolveFormUrl(
  url: string | null,
  timeoutMs: number,
): Promise<string | null> {
  if (!url) return null;
  if (/^https:\/\/docs\.google\.com\/forms\//i.test(url)) {
    const base = /^(https:\/\/docs\.google\.com\/forms\/d\/e\/[^/]+)/i.exec(
      url,
    );
    return base ? `${base[1]}/viewform` : url;
  }
  if (!/^https:\/\/forms\.gle\//i.test(url)) return url;
  try {
    const res = await fetchWithTimeout(url, timeoutMs, {
      method: 'GET',
      redirect: 'manual',
    });
    const loc = res.headers.get('location');
    if (loc) {
      const abs = loc.startsWith('http') ? loc : new URL(loc, url).href;
      const base = /^(https:\/\/docs\.google\.com\/forms\/d\/e\/[^/]+)/i.exec(
        abs,
      );
      if (base) return `${base[1]}/viewform`;
      return abs.split('?')[0].split('#')[0];
    }
  } catch {
    // keep short URL
  }
  return url;
}

function extractInstructors(html: string): string | null {
  const section =
    extractSection(html, 'instructores') ||
    (() => {
      const m =
        /<h2[^>]*>\s*INSTRUCTORES\s*<\/h2>([\s\S]*?)(?=<h2|<div class="pc-tab"|$)/i.exec(
          html,
        );
      return m ? m[1] : '';
    })();
  if (!section) return null;
  const names: string[] = [];
  for (const li of section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const t = stripTags(li[1]);
    if (t) names.push(t);
  }
  if (names.length === 0) {
    const p = stripTags(section);
    if (p && !/^instructores$/i.test(p)) return p;
    return null;
  }
  return names.join('; ');
}

function extractObjectives(html: string): string {
  const m =
    /<div[^>]*class=["'][^"']*objetivos[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(
      html,
    );
  if (!m) return '';
  const items: string[] = [];
  for (const li of m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const t = stripTags(li[1]);
    if (t) items.push(t);
  }
  return items.length ? items.map((x) => `• ${x}`).join('\n') : stripTags(m[1]);
}

function extractDescription(html: string): string {
  const m =
    /<div[^>]*class=["'][^"']*descripcion[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>\s*DESCRIPCI[OÓ]N\s*<\/h2>([\s\S]*?)<\/div>/i.exec(
      html,
    );
  if (!m) {
    const alt =
      /<h2[^>]*>\s*DESCRIPCI[OÓ]N\s*<\/h2>\s*<p>([\s\S]*?)<\/p>/i.exec(html);
    return alt ? stripTags(alt[1]) : '';
  }
  const p = /<p>([\s\S]*?)<\/p>/i.exec(m[1]);
  return p ? stripTags(p[1]) : stripTags(m[1]);
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(
  url: string,
  timeoutMs = DEFAULT_PAGE_TIMEOUT_MS,
): Promise<string> {
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export function listCourses(listHtml: string): CourseListMeta[] {
  const clean = stripComments(listHtml);
  const courses: CourseListMeta[] = [];
  const seen = new Set<number>();

  const cardRe =
    /<a\b(?=[^>]*\bclass=["'][^"']*\bh5\b)(?=[^>]*\bhref=["'](curso(\d+)\.php)["'])[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(clean)) !== null) {
    const slug = m[1];
    const num = Number(m[2]);
    const list_title = stripTags(m[3]);
    if (seen.has(num)) continue;
    seen.add(num);
    const around = clean.slice(Math.max(0, m.index - 500), m.index);
    const statuses = [...around.matchAll(/\b(ABIERTO|CERRADO)\b/gi)];
    const site_status = (
      statuses.length ? statuses[statuses.length - 1][1] : 'cerrado'
    ).toLowerCase();
    // INSCRIBIRME sits right after the title link inside the same card.
    const cardTail = clean.slice(
      m.index,
      Math.min(clean.length, m.index + m[0].length + 400),
    );
    const enrollHref = new RegExp(
      `href=["'](?:${slug.replace('.', '\\.')}|curso${num}\\.php)#inscripcion["']`,
      'i',
    );
    const enroll_open_on_site =
      enrollHref.test(cardTail) || />\s*INSCRIBIRME\s*</i.test(cardTail);
    courses.push({
      n: num,
      slug,
      list_title,
      site_status,
      enroll_open_on_site,
      source_url: `${CTT_BASE}/${slug}`,
    });
  }

  courses.sort((a, b) => a.n - b.n);
  return courses;
}

export async function scrapeCourse(
  meta: CourseListMeta,
  timeoutMs = DEFAULT_PAGE_TIMEOUT_MS,
): Promise<ScrapedCourse> {
  const html = stripComments(await fetchText(meta.source_url, timeoutMs));
  const titleM =
    /<h1[^>]*class=["']tituloCurso["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const name = titleM ? stripTags(titleM[1]) : meta.list_title;

  const tab1 = extractTab(html, 'tab1');
  const tab3 = extractTab(html, 'tab3');

  const enrollmentRaw =
    fieldFromTab(tab1, 'Fechas? de inscripciones') ||
    fieldFromTab(tab1, 'Fecha(?:s)? de inscripci[oó]n(?:es)?');
  const cupo =
    fieldFromTab(tab1, '(?:El )?cupo de inscripciones') ||
    fieldFromTab(tab1, 'Cupo');
  const location =
    fieldFromTab(tab1, 'Lugar del evento') ||
    fieldFromTab(tab1, 'Lugar de celebraci[oó]n');
  const courseDatesRaw = fieldFromTab(tab1, 'Fecha del curso');
  const schedule = fieldFromTab(tab1, 'Horario');
  const certificate = fieldFromTab(tab1, 'Tipo de capacitaci[oó]n');
  const hoursRaw = fieldFromTab(tab1, 'Horas de capacitaci[oó]n');
  const modality = fieldFromTab(tab1, 'Modalidad');
  const prerequisites = fieldFromTab(tab1, 'Conocimientos previos');

  const enrollment = parseSpanishDateRange(enrollmentRaw || '');
  const courseDates = parseSpanishDateRange(courseDatesRaw || '');

  let total_hours: number | null = null;
  if (hoursRaw) {
    const hm = /(\d+)/.exec(hoursRaw);
    if (hm) total_hours = Number(hm[1]);
  }

  const price_tiers = parsePrices(tab1);
  const price_usd = generalPrice(price_tiers);

  const description = extractDescription(html);
  const objectives = extractObjectives(html);
  const outcomes = [description, objectives].filter(Boolean).join('\n\n');
  const syllabus = parseSyllabus(tab3);
  const instructors = extractInstructors(html);
  const enrollment_form_url_raw = extractEnrollmentFormUrl(html);
  const enrollment_form_url = await resolveFormUrl(
    enrollment_form_url_raw,
    timeoutMs,
  );

  return {
    id: `ctt-${meta.n}`,
    n: meta.n,
    name,
    list_title: meta.list_title,
    description,
    objectives,
    outcomes,
    enrollment_raw: enrollmentRaw,
    enrollment_start: enrollment.start,
    enrollment_end: enrollment.end,
    cupo,
    location,
    start_date: courseDates.start,
    end_date: courseDates.end,
    course_dates_raw: courseDatesRaw,
    schedule,
    schedules: schedule ? [schedule] : [],
    modality,
    total_hours,
    prerequisites,
    certificate,
    instructors,
    price_tiers,
    price_usd,
    syllabus,
    site_status: meta.site_status,
    enroll_open_on_site: meta.enroll_open_on_site,
    source_url: meta.source_url,
    enrollment_form_url,
    active: true,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function scrapeAllCourses(
  options: ScrapeOptions = {},
): Promise<ScrapeAllResult> {
  const pageTimeoutMs = options.pageTimeoutMs ?? DEFAULT_PAGE_TIMEOUT_MS;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const started = Date.now();

  const listHtml = await fetchText(CTT_LIST_URL, pageTimeoutMs);
  const metas = listCourses(listHtml);

  const courses: ScrapedCourse[] = [];
  const errors: { slug: string; message: string }[] = [];

  await mapPool(metas, concurrency, async (meta) => {
    try {
      const course = await scrapeCourse(meta, pageTimeoutMs);
      courses.push(course);
      options.onProgress?.(meta, 'ok', course.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ slug: meta.slug, message });
      options.onProgress?.(meta, 'error', message);
    }
  });

  courses.sort((a, b) => a.n - b.n);

  return {
    courses,
    errors,
    durationMs: Date.now() - started,
  };
}

function sqlString(value: string | null | undefined): string {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

/** Generate idempotent seed SQL (no DELETE). */
export function generateSeedSql(courses: ScrapedCourse[]): string {
  const lines: string[] = [];
  lines.push(
    '-- CTT-FISEI real catalog seed (generated by apps/api/scripts/scrape-ctt.mjs)',
  );
  lines.push(
    '-- Requires migrations 003–007 (incl. enroll_open_on_site). Idempotent upserts; no DELETE.',
  );
  lines.push('');
  lines.push('-- Deactivate fictional CodeAndes courses and promos');
  lines.push(
    `update courses set active = false where id in ('python-fundamentos','fullstack-js','ciencia-datos','ia-aplicada','ciberseguridad','cloud-devops','ux-ui-figma');`,
  );
  lines.push(
    `update promotions set active = false where id in ('PRONTO15','COMBO20');`,
  );
  lines.push('');

  for (const c of courses) {
    lines.push(`-- ${c.id}: ${c.name}`);
    lines.push(`insert into courses (
  id, name, level, duration_weeks, hours_per_week, total_hours,
  price_usd, price_tiers, modality, start_date, end_date,
  enrollment_start, enrollment_end, schedules, syllabus, outcomes,
  location, instructors, prerequisites, certificate, source_url,
  enrollment_form_url, site_status, enroll_open_on_site, active
) values (
  ${sqlString(c.id)},
  ${sqlString(c.name)},
  null,
  null,
  null,
  ${c.total_hours == null ? 'null' : c.total_hours},
  ${c.price_usd},
  ${sqlJson(c.price_tiers)},
  ${sqlString(c.modality)},
  ${sqlString(c.start_date)},
  ${sqlString(c.end_date)},
  ${sqlString(c.enrollment_start)},
  ${sqlString(c.enrollment_end)},
  ${sqlJson(c.schedules)},
  ${sqlJson(c.syllabus)},
  ${sqlString(c.outcomes)},
  ${sqlString(c.location)},
  ${sqlString(c.instructors)},
  ${sqlString(c.prerequisites)},
  ${sqlString(c.certificate)},
  ${sqlString(c.source_url)},
  ${sqlString(c.enrollment_form_url)},
  ${sqlString(c.site_status)},
  ${c.enroll_open_on_site ? 'true' : 'false'},
  true
)
on conflict (id) do update set
  name = excluded.name,
  level = excluded.level,
  duration_weeks = excluded.duration_weeks,
  hours_per_week = excluded.hours_per_week,
  total_hours = excluded.total_hours,
  price_usd = excluded.price_usd,
  price_tiers = excluded.price_tiers,
  modality = excluded.modality,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  enrollment_start = excluded.enrollment_start,
  enrollment_end = excluded.enrollment_end,
  schedules = excluded.schedules,
  syllabus = excluded.syllabus,
  outcomes = excluded.outcomes,
  location = excluded.location,
  instructors = excluded.instructors,
  prerequisites = excluded.prerequisites,
  certificate = excluded.certificate,
  source_url = excluded.source_url,
  enrollment_form_url = excluded.enrollment_form_url,
  site_status = excluded.site_status,
  enroll_open_on_site = excluded.enroll_open_on_site,
  active = excluded.active;
`);
  }
  return lines.join('\n');
}
