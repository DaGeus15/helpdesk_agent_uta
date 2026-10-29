import { describe, expect, it } from 'vitest';
import {
  collectAllowedAmounts,
  collectAllowedPercents,
  computeStatus,
  formatCompactCatalog,
  todayIsoDate,
} from './catalog.logic';
import type { Course, Promotion } from './catalog.types';

function baseCourse(
  overrides: Partial<Omit<Course, 'status'>> = {},
): Omit<Course, 'status'> {
  return {
    id: 'ctt-python-2',
    name: 'Fundamentos de Python 2',
    level: 'inicial',
    duration_weeks: 4,
    hours_per_week: 4,
    total_hours: 16,
    price_usd: 50,
    price_tiers: [
      { audience: 'estudiante UTA', price_usd: 40 },
      { audience: 'público general', price_usd: 50 },
    ],
    modality: 'virtual',
    start_date: '2026-11-16',
    end_date: '2026-12-14',
    enrollment_start: '2026-11-01',
    enrollment_end: '2026-11-15',
    schedules: ['sábados 09:00'],
    syllabus: [],
    outcomes: '',
    location: null,
    instructors: null,
    prerequisites: null,
    certificate: null,
    source_url: 'https://example.com/python2',
    enrollment_form_url: null,
    site_status: null,
    enroll_open_on_site: false,
    active: true,
    ...overrides,
  };
}

describe('computeStatus (injected today)', () => {
  it('inscripciones_abiertas by enrollment window', () => {
    expect(computeStatus(baseCourse(), '2026-11-05')).toBe(
      'inscripciones_abiertas',
    );
  });

  it('inscripciones_abiertas when enroll_open_on_site even before start', () => {
    expect(
      computeStatus(
        baseCourse({
          enroll_open_on_site: true,
          enrollment_start: '2026-11-10',
        }),
        '2026-11-05',
      ),
    ).toBe('inscripciones_abiertas');
  });

  it('en_curso during run dates', () => {
    expect(computeStatus(baseCourse(), '2026-11-20')).toBe('en_curso');
  });

  it('proximamente before enrollment', () => {
    expect(computeStatus(baseCourse(), '2026-10-01')).toBe('proximamente');
  });

  it('finalizado after end_date', () => {
    expect(computeStatus(baseCourse(), '2026-12-20')).toBe('finalizado');
  });

  it('falls back to site_status abierto', () => {
    expect(
      computeStatus(
        baseCourse({
          enrollment_start: null,
          enrollment_end: null,
          start_date: null,
          end_date: null,
          site_status: 'abierto',
        }),
        '2026-11-05',
      ),
    ).toBe('inscripciones_abiertas');
  });
});

describe('formatCompactCatalog', () => {
  it('puts finished editions on a single line each', () => {
    const open: Course = {
      ...baseCourse({ id: 'ctt-py2-new', name: 'Fundamentos de Python 2' }),
      status: 'inscripciones_abiertas',
    };
    const finished: Course = {
      ...baseCourse({
        id: 'ctt-py2-old',
        name: 'Fundamentos de Python 2',
        end_date: '2025-06-01',
      }),
      status: 'finalizado',
    };
    const text = formatCompactCatalog([open, finished], []);
    expect(text).toContain('## INSCRIPCIONES ABIERTAS');
    expect(text).toContain('## FINALIZADOS');
    expect(text).toContain(
      'Ediciones ANTERIORES ya terminadas',
    );
    expect(text).toMatch(
      /- Fundamentos de Python 2 \(edición finalizada el 2025-06-01\)/,
    );
    expect(text).toContain('(ninguna — la web oficial no publica descuentos');
  });

  it('lists promotions when present', () => {
    const promo: Promotion = {
      id: 'promo-10',
      title: 'Early bird',
      description: 'x',
      discount_percent: 10,
      applies_to: null,
      conditions: 'pago anticipado',
      valid_until: '2026-12-31',
      active: true,
    };
    const text = formatCompactCatalog(
      [{ ...baseCourse(), status: 'proximamente' }],
      [promo],
    );
    expect(text).toContain('promo-10 | 10% | pago anticipado');
  });
});

describe('allowed amounts / percents', () => {
  it('collects price and tiers', () => {
    const amounts = collectAllowedAmounts([
      { ...baseCourse(), status: 'inscripciones_abiertas' },
    ]);
    expect(amounts.has(40)).toBe(true);
    expect(amounts.has(50)).toBe(true);
    expect(amounts.has(99)).toBe(false);
  });

  it('collects promo percents', () => {
    const percents = collectAllowedPercents([
      {
        id: 'p',
        title: 't',
        description: 'd',
        discount_percent: 15,
        applies_to: null,
        conditions: 'c',
        valid_until: '2099-01-01',
        active: true,
      },
    ]);
    expect([...percents]).toEqual([15]);
  });
});

describe('todayIsoDate', () => {
  it('formats injected date in Guayaquil calendar day', () => {
    // Fixed UTC instant → Guayaquil is UTC-5
    const iso = todayIsoDate(new Date('2026-11-05T12:00:00.000Z'));
    expect(iso).toBe('2026-11-05');
  });
});
