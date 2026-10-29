/**
 * Pure helpers for Google Forms field parsing and prefilled URL building.
 * Kept free of Nest so scripts can exercise the same logic.
 */

export interface FormField {
  label: string;
  entryId: string;
  type: number;
  options: string[];
}

export interface LeadProfileLike {
  name?: string;
  interest?: string;
  level?: string;
  availability?: string;
  budget?: string;
  goal?: string;
  contact?: string;
  email?: string;
  phone?: string;
  id_number?: string;
  audience?: string;
}

export interface PrefillExtras {
  courseName?: string;
}

/** Strip accents/diacritics and lowercase for label matching. */
export function normalizeLabel(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse FB_PUBLIC_LOAD_DATA_ from a Google Form HTML page.
 * Returns [] if the script blob is missing or malformed (e.g. closed form).
 */
export function parseFormFields(html: string): FormField[] {
  const m = html.match(
    /var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/i,
  );
  if (!m) return [];
  try {
    const data = JSON.parse(m[1]) as unknown;
    const questions = (data as unknown[][])?.[1]?.[1];
    if (!Array.isArray(questions)) return [];

    const fields: FormField[] = [];
    for (const q of questions) {
      if (!Array.isArray(q)) continue;
      const label = typeof q[1] === 'string' ? q[1] : '';
      const type = typeof q[3] === 'number' ? q[3] : -1;
      const entries = q[4];
      if (!label || !Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry[0] == null) continue;
        const entryId = String(entry[0]);
        const rawOpts = Array.isArray(entry[1]) ? entry[1] : [];
        const options = rawOpts
          .map((opt: unknown) =>
            Array.isArray(opt) && typeof opt[0] === 'string' ? opt[0] : null,
          )
          .filter((s): s is string => Boolean(s));
        fields.push({ label, entryId, type, options });
      }
    }
    return fields;
  } catch {
    return [];
  }
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE =
  /(?:\+?593[\s-]?)?(?:0?9\d{8}|0[2-7]\d{7}|\d{7,10})/;
/** 10 digits not part of a longer digit run (Ecuadorian cédula). */
const CEDULA_RE = /(?:^|[^\d])(\d{10})(?:[^\d]|$)/;

export function extractEmail(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const m = EMAIL_RE.exec(text);
  return m ? m[0] : undefined;
}

export function extractPhone(text: string | undefined): string | undefined {
  if (!text) return undefined;
  // Prefer an explicit phone-looking token; avoid matching bare cédula-like runs alone
  // when the string also has an email (take the non-email part).
  const withoutEmail = text.replace(EMAIL_RE, ' ');
  const m = PHONE_RE.exec(withoutEmail.replace(/[().]/g, ' '));
  if (!m) return undefined;
  const digits = m[0].replace(/\D/g, '');
  if (
    digits.length === 10 &&
    /^[0-9]{10}$/.test(digits) &&
    !digits.startsWith('09') &&
    !/^0[2-7]/.test(digits)
  ) {
    // Likely a cédula, not a phone
    return undefined;
  }
  return m[0].replace(/\s+/g, '').trim();
}

export function extractCedula(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const m = CEDULA_RE.exec(text);
  if (!m) return undefined;
  const digits = m[1];
  // Mobile numbers also have 10 digits (09xxxxxxxx); leave those to extractPhone
  if (digits.startsWith('09')) return undefined;
  return digits;
}

/** Split "Nombre Apellido…" into given names / family names (EC-ish: last 2 = apellidos when ≥3). */
export function splitFullName(full: string): {
  nombres: string;
  apellidos: string;
  completo: string;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombres: '', apellidos: '', completo: '' };
  if (parts.length === 1) {
    return { nombres: parts[0], apellidos: '', completo: parts[0] };
  }
  if (parts.length === 2) {
    return {
      nombres: parts[0],
      apellidos: parts[1],
      completo: `${parts[0]} ${parts[1]}`,
    };
  }
  const apellidos = parts.slice(-2).join(' ');
  const nombres = parts.slice(0, -2).join(' ');
  return { nombres, apellidos, completo: parts.join(' ') };
}

type FieldKind =
  | 'nombres'
  | 'apellidos'
  | 'nombre_completo'
  | 'cedula'
  | 'correo'
  | 'telefono'
  | 'audience'
  | 'curso'
  | null;

function classifyField(label: string): FieldKind {
  const n = normalizeLabel(label);

  if (
    /nombre completo|nombres y apellidos|nombre y apellido|nombres completos/.test(
      n,
    )
  ) {
    return 'nombre_completo';
  }
  // "apellidos" before bare "nombre" so "apellido y nombre" doesn't win as nombres
  if (/apellido/.test(n) && !/nombre/.test(n)) return 'apellidos';
  if (
    (/^nombres?$/.test(n) ||
      /^nombres? /.test(n) ||
      / nombres?$/.test(n) ||
      n === 'name') &&
    !/apellido|completo/.test(n)
  ) {
    return 'nombres';
  }
  if (/apellido/.test(n)) return 'apellidos';

  if (/cedula|documento de identidad|\bci\b|identificacion|pasaporte/.test(n)) {
    return 'cedula';
  }
  if (/correo|e ?mail|mail|email/.test(n)) return 'correo';
  if (/telefono|celular|whatsapp|movil|fono/.test(n)) return 'telefono';
  if (
    /tipo de participante|tipo de asistente|categoria|audiencia|pertenece|es usted|soy/.test(
      n,
    ) ||
    (/estudiante|graduado|publico/.test(n) && /tipo|seleccione|indique/.test(n))
  ) {
    return 'audience';
  }
  if (/curso|taller|capacitacion|programa|modulo/.test(n)) return 'curso';
  return null;
}

/** Pick the option whose normalized text best contains / matches the audience hint. */
export function matchAudienceOption(
  options: string[],
  audience: string,
): string | undefined {
  if (!options.length) return undefined;
  const hint = normalizeLabel(audience);

  const buckets: Array<{ keys: RegExp; score: number }> = [
    { keys: /estudiante/, score: 3 },
    { keys: /gradua|docente|administrativ/, score: 2 },
    { keys: /publico|general|extern/, score: 1 },
  ];

  let hintBucket = 0;
  for (const b of buckets) {
    if (b.keys.test(hint)) {
      hintBucket = b.score;
      break;
    }
  }

  let best: { opt: string; score: number } | null = null;
  for (const opt of options) {
    const on = normalizeLabel(opt);
    let score = 0;
    if (on === hint || on.includes(hint) || hint.includes(on)) score += 10;
    for (const b of buckets) {
      if (b.keys.test(on) && b.score === hintBucket) score += 5;
      // token overlap
      const hintTokens = hint.split(' ').filter((t) => t.length > 3);
      for (const t of hintTokens) {
        if (on.includes(t)) score += 1;
      }
    }
    if (!best || score > best.score) best = { opt, score };
  }
  return best && best.score > 0 ? best.opt : options[0];
}

function resolveValues(
  profile: LeadProfileLike,
  extras: PrefillExtras,
): Record<Exclude<FieldKind, null>, string | undefined> {
  const contact = profile.contact ?? '';
  const email = profile.email || extractEmail(contact);
  const phone = profile.phone || extractPhone(contact);
  const cedula = profile.id_number || extractCedula(contact);
  const split = profile.name ? splitFullName(profile.name) : null;

  return {
    nombres: split?.nombres || undefined,
    apellidos: split?.apellidos || undefined,
    nombre_completo: split?.completo || profile.name,
    cedula,
    correo: email,
    telefono: phone,
    audience: profile.audience,
    curso: extras.courseName || profile.interest,
  };
}

/**
 * Build a Google Forms prefilled URL from known fields + lead profile.
 * Only includes entries that have a value. Returns the original formUrl if
 * there are no fields or no mapped values.
 */
export function buildPrefilledUrl(
  formUrl: string,
  fields: FormField[],
  profile: LeadProfileLike,
  extras: PrefillExtras = {},
): string {
  if (!formUrl) return formUrl;
  if (!fields.length) return stripToViewform(formUrl);

  const values = resolveValues(profile, extras);
  const params: string[] = [];

  for (const field of fields) {
    const kind = classifyField(field.label);
    if (!kind) continue;
    let value = values[kind];
    if (!value) continue;

    if (kind === 'audience' && field.options.length > 0) {
      value = matchAudienceOption(field.options, value) ?? value;
    } else if (kind === 'curso' && field.options.length > 0) {
      const matched = matchCourseOption(field.options, value);
      if (matched) value = matched;
    }

    params.push(`entry.${field.entryId}=${encodeURIComponent(value)}`);
  }

  if (params.length === 0) return stripToViewform(formUrl);

  const base = stripToViewform(formUrl);
  return `${base}?usp=pp_url&${params.join('&')}`;
}

function stripToViewform(formUrl: string): string {
  const base = /^(https:\/\/docs\.google\.com\/forms\/d\/e\/[^/]+)/i.exec(
    formUrl,
  );
  if (base) return `${base[1]}/viewform`;
  return formUrl.split('?')[0].split('#')[0];
}

function matchCourseOption(
  options: string[],
  courseName: string,
): string | undefined {
  const hint = normalizeLabel(courseName);
  let best: { opt: string; score: number } | null = null;
  for (const opt of options) {
    const on = normalizeLabel(opt);
    let score = 0;
    if (on === hint) score = 100;
    else if (on.includes(hint) || hint.includes(on)) score = 50;
    else {
      const tokens = hint.split(' ').filter((t) => t.length > 3);
      score = tokens.filter((t) => on.includes(t)).length;
    }
    if (!best || score > best.score) best = { opt, score };
  }
  return best && best.score > 0 ? best.opt : undefined;
}
