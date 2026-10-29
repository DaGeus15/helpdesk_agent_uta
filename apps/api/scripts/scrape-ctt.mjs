#!/usr/bin/env node
/**
 * Scrapes CTT-FISEI course pages into supabase/data/ctt-cursos.json
 * and generates supabase/seed_ctt.sql. Node 20+, no deps (fetch + regex).
 *
 * Usage: node apps/api/scripts/scrape-ctt.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://ctt-talleresfisei.uta.edu.ec';
const LIST_URL = `${BASE}/course.php`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const JSON_OUT = join(ROOT, 'supabase', 'data', 'ctt-cursos.json');
const SQL_OUT = join(ROOT, 'supabase', 'seed_ctt.sql');

const MONTHS = {
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

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function decodeEntities(s) {
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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html) {
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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toIso(day, month, year) {
  if (!day || !month || !year) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Parse Spanish date ranges into { start, end } ISO dates. */
function parseSpanishDateRange(text) {
  if (!text) return { start: null, end: null };
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/\bdel\b/g, 'de')
    .trim();

  // "01-marzo a 31-marzo-2025" / "01-marzo-2025 a 31-marzo-2025" / "31-mayo al 05-julio-2025"
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

  // "del 01 de octubre de 2026 al 15 de octubre de 2026"
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
  // "15 de febrero al 02 de marzo de 2025" / "11 de marzo al 05 de abril de 2024"
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
  // single date
  const single = /(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i.exec(t);
  if (single) {
    const iso = toIso(+single[1], MONTHS[single[2]], +single[3]);
    return { start: iso, end: iso };
  }
  return { start: null, end: null };
}

function extractSection(html, className) {
  const re = new RegExp(
    `<div[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)</div>`,
    'i',
  );
  const m = re.exec(html);
  return m ? m[1] : '';
}

function extractBalancedDiv(html, startIndex) {
  // startIndex points at '<' of the opening <div...>; return inner HTML.
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

function extractTab(html, tabId) {
  const tabRe = new RegExp(
    `<div[^>]*class=["'][^"']*\\b${tabId}\\b[^"']*["'][^>]*>`,
    'gi',
  );
  let best = '';
  let m;
  while ((m = tabRe.exec(html)) !== null) {
    const inner = extractBalancedDiv(html, m.index);
    if (inner.length >= best.length) best = inner;
  }
  return best;
}

function fieldFromTab(tabHtml, labelPattern) {
  const re = new RegExp(
    `<strong>${labelPattern}:</strong>\\s*([\\s\\S]*?)(?=</li>|$)`,
    'i',
  );
  const m = re.exec(tabHtml);
  if (!m) return null;
  return stripTags(m[1]).replace(/^[:\s]+/, '').trim() || null;
}

function extractPriceBlock(tabHtml) {
  const re =
    /<strong>\s*Precio(?:\s+para\s+los\s+asistentes)?\s*:?\s*<\/strong>\s*([\s\S]*?)(?=<li>\s*<strong>|<\/ul>\s*<\/div>)/i;
  const m = re.exec(tabHtml);
  if (!m) return '';
  return m[1];
}

function parsePrices(tabHtml) {
  const tiers = [];
  const seen = new Set();

  const add = (audience, price) => {
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

  // Format A: "Estudiantes UTA (...): $40,00"
  const fmtA = /([^:\n$]{3,80}?):\s*\$\s*(\d+(?:[.,]\d{1,2})?)/gi;
  let m;
  while ((m = fmtA.exec(textBlob)) !== null) {
    add(m[1], parseFloat(m[2].replace(',', '.')));
  }

  // Format B: "40 USD Estudiantes UTA (...)"
  if (tiers.length === 0) {
    const fmtB = /(\d+(?:[.,]\d{1,2})?)\s*USD\s+([^\n]+)/gi;
    while ((m = fmtB.exec(textBlob)) !== null) {
      add(m[2].trim(), parseFloat(m[1].replace(',', '.')));
    }
  }

  // Format C (typos on old pages): "30 Estudiantes UTA" without the USD token
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

function generalPrice(tiers) {
  if (tiers.length === 0) return 0;
  const general = tiers.find((t) =>
    /p[uú]blico|general/i.test(t.audience),
  );
  if (general) return general.price_usd;
  return Math.max(...tiers.map((t) => t.price_usd));
}

function parseSyllabus(tab3Html) {
  const items = [];
  const kindRe = 'M[oó]dulo|Clase|Unidad|Cap[ií]tulo';
  // Match "Módulo N:", "Clase N:", "Unidad N:", "Capítulo N:"
  const re = new RegExp(
    `<(?:strong|b)[^>]*>\\s*(?:[•·\\-]\\s*)?(${kindRe})\\s+(\\d+)\\s*[:.]?\\s*</(?:strong|b)>\\s*([^<]*)`,
    'gi',
  );
  let m;
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

function extractInstructors(html) {
  const section = extractSection(html, 'instructores') ||
    (() => {
      const m = /<h2[^>]*>\s*INSTRUCTORES\s*<\/h2>([\s\S]*?)(?=<h2| <div class="pc-tab"|$)/i.exec(
        html,
      );
      return m ? m[1] : '';
    })();
  if (!section) return null;
  const names = [];
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

function extractObjectives(html) {
  const m = /<div[^>]*class=["'][^"']*objetivos[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(
    html,
  );
  if (!m) return '';
  const items = [];
  for (const li of m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const t = stripTags(li[1]);
    if (t) items.push(t);
  }
  return items.length ? items.map((x) => `• ${x}`).join('\n') : stripTags(m[1]);
}

function extractDescription(html) {
  const m = /<div[^>]*class=["'][^"']*descripcion[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>\s*DESCRIPCI[OÓ]N\s*<\/h2>([\s\S]*?)<\/div>/i.exec(
    html,
  );
  if (!m) {
    const alt = /<h2[^>]*>\s*DESCRIPCI[OÓ]N\s*<\/h2>\s*<p>([\s\S]*?)<\/p>/i.exec(
      html,
    );
    return alt ? stripTags(alt[1]) : '';
  }
  const p = /<p>([\s\S]*?)<\/p>/i.exec(m[1]);
  return p ? stripTags(p[1]) : stripTags(m[1]);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'CTT-FISEI-catalog-scraper/1.0 (hackathon UTA)',
      Accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function listCourses(listHtml) {
  const clean = stripComments(listHtml);
  const courses = [];
  const seen = new Set();

  // Attribute order varies: class before href OR href before class
  const cardRe =
    /<a\b(?=[^>]*\bclass=["'][^"']*\bh5\b)(?=[^>]*\bhref=["'](curso(\d+)\.php)["'])[^>]*>([\s\S]*?)<\/a>/gi;

  let m;
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
    courses.push({
      n: num,
      slug,
      list_title,
      site_status,
      source_url: `${BASE}/${slug}`,
    });
  }

  courses.sort((a, b) => a.n - b.n);
  return courses;
}

async function scrapeCourse(meta) {
  const html = stripComments(await fetchText(meta.source_url));
  const titleM = /<h1[^>]*class=["']tituloCurso["'][^>]*>([\s\S]*?)<\/h1>/i.exec(
    html,
  );
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

  let total_hours = null;
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
    source_url: meta.source_url,
    active: true,
  };
}

function sqlString(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

function generateSeedSql(courses) {
  const lines = [];
  lines.push('-- CTT-FISEI real catalog seed (generated by apps/api/scripts/scrape-ctt.mjs)');
  lines.push('-- Requires migration 003_real_catalog.sql. Idempotent upserts; no DELETE.');
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
  location, instructors, prerequisites, certificate, source_url, site_status, active
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
  ${sqlString(c.site_status)},
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
  site_status = excluded.site_status,
  active = excluded.active;
`);
  }
  return lines.join('\n');
}

async function main() {
  console.log('Fetching course list…');
  const listHtml = await fetchText(LIST_URL);
  const metas = listCourses(listHtml);
  console.log(`Found ${metas.length} courses on listing.`);

  const courses = [];
  for (const meta of metas) {
    process.stdout.write(`  Scraping ${meta.slug} (${meta.site_status})… `);
    try {
      const course = await scrapeCourse(meta);
      console.log(
        `${course.name.slice(0, 40)}… prices=${course.price_tiers.length} $${course.price_usd}`,
      );
      courses.push(course);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      throw err;
    }
  }

  const withPrices = courses.filter((c) => c.price_tiers.length > 0);
  console.log(
    `\nScraped ${courses.length} courses, ${withPrices.length} with prices.`,
  );

  mkdirSync(dirname(JSON_OUT), { recursive: true });
  writeFileSync(JSON_OUT, JSON.stringify(courses, null, 2), 'utf8');
  writeFileSync(SQL_OUT, generateSeedSql(courses), 'utf8');
  console.log(`Wrote ${JSON_OUT}`);
  console.log(`Wrote ${SQL_OUT}`);

  if (courses.length !== 18) {
    console.warn(`WARNING: expected 18 courses, got ${courses.length}`);
  }
  if (withPrices.length < 18) {
    console.warn(
      `WARNING: expected prices on all courses; missing on: ${courses
        .filter((c) => c.price_tiers.length === 0)
        .map((c) => c.id)
        .join(', ')}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
