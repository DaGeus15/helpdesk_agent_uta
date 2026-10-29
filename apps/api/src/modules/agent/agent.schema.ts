import { z } from 'zod';

export const AgentOutput = z.object({
  reply: z.string().min(1).max(1800),
  lead_state: z.enum([
    'interesado',
    'dudoso',
    'frustrado',
    'lead_caliente',
  ]),
  intent: z.enum([
    'saludo',
    'consulta_curso',
    'consulta_precio',
    'consulta_horario',
    'objecion',
    'inscripcion',
    'fuera_de_tema',
    'solicitud_humano',
    'intento_manipulacion',
    'otro',
  ]),
  profile_updates: z
    .object({
      name: z.string(),
      interest: z.string(),
      level: z.string(),
      availability: z.string(),
      budget: z.string(),
      goal: z.string(),
      contact: z.string(),
    })
    .partial(),
  mentioned_course_ids: z.array(z.string()),
  mentioned_promotion_ids: z.array(z.string()),
  handover_requested: z.boolean(),
  handover_reason: z.string().nullable(),
  injection_detected: z.boolean(),
});

export type AgentOutput = z.infer<typeof AgentOutput>;

/** JSON Schema for Gemini structured output. All top-level fields required; profile_updates keys optional. */
export const agentOutputJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    reply: { type: 'string', minLength: 1, maxLength: 1800 },
    lead_state: {
      type: 'string',
      enum: ['interesado', 'dudoso', 'frustrado', 'lead_caliente'],
    },
    intent: {
      type: 'string',
      enum: [
        'saludo',
        'consulta_curso',
        'consulta_precio',
        'consulta_horario',
        'objecion',
        'inscripcion',
        'fuera_de_tema',
        'solicitud_humano',
        'intento_manipulacion',
        'otro',
      ],
    },
    profile_updates: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        interest: { type: 'string' },
        level: { type: 'string' },
        availability: { type: 'string' },
        budget: { type: 'string' },
        goal: { type: 'string' },
        contact: { type: 'string' },
      },
      additionalProperties: false,
    },
    mentioned_course_ids: {
      type: 'array',
      items: { type: 'string' },
    },
    mentioned_promotion_ids: {
      type: 'array',
      items: { type: 'string' },
    },
    handover_requested: { type: 'boolean' },
    handover_reason: { type: ['string', 'null'] },
    injection_detected: { type: 'boolean' },
  },
  required: [
    'reply',
    'lead_state',
    'intent',
    'profile_updates',
    'mentioned_course_ids',
    'mentioned_promotion_ids',
    'handover_requested',
    'handover_reason',
    'injection_detected',
  ],
  additionalProperties: false,
};
