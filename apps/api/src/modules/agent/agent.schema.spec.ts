import { describe, expect, it } from 'vitest';
import { AgentOutput } from './agent.schema';

const valid = {
  reply: 'Hola, ¿qué te gustaría aprender?',
  lead_state: 'interesado',
  intent: 'saludo',
  profile_updates: { name: 'Ana' },
  mentioned_course_ids: [],
  mentioned_promotion_ids: [],
  handover_requested: false,
  handover_reason: null,
  injection_detected: false,
};

describe('AgentOutput schema', () => {
  it('accepts a valid structured JSON payload', () => {
    const parsed = AgentOutput.parse(valid);
    expect(parsed.reply).toContain('Hola');
    expect(parsed.lead_state).toBe('interesado');
  });

  it('rejects empty reply', () => {
    expect(() => AgentOutput.parse({ ...valid, reply: '' })).toThrow();
  });

  it('rejects unknown lead_state', () => {
    expect(() =>
      AgentOutput.parse({ ...valid, lead_state: 'vip' }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    const { handover_requested: _, ...rest } = valid;
    expect(() => AgentOutput.parse(rest)).toThrow();
  });
});
