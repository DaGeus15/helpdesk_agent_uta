import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  value === '' || value === undefined || value === null ? undefined : value;

export const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
    TELEGRAM_MODE: z.enum(['polling', 'webhook']).default('polling'),
    TELEGRAM_WEBHOOK_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(1).optional(),
    ),
    PUBLIC_API_URL: z.preprocess(
      emptyToUndefined,
      z.string().url().optional(),
    ),
    LLM_PROVIDER: z.enum(['gemini']).default('gemini'),
    GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
    GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash'),
    SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
    DASHBOARD_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    CONTEXT_WINDOW_MESSAGES: z.coerce.number().int().positive().default(12),
    SUMMARY_EVERY_N_MESSAGES: z.coerce.number().int().positive().default(8),
    OPERATOR_USERNAME: z.string().min(1).default('admin'),
    OPERATOR_PASSWORD: z.string().min(1).default('admin'),
    AUTH_TOKEN_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(1).optional(),
    ),
    AUTH_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(12),
  })
  .superRefine((data, ctx) => {
    if (data.TELEGRAM_MODE !== 'webhook') {
      return;
    }
    if (!data.TELEGRAM_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message:
          'TELEGRAM_WEBHOOK_SECRET is required when TELEGRAM_MODE=webhook',
      });
    }
    if (!data.PUBLIC_API_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PUBLIC_API_URL'],
        message: 'PUBLIC_API_URL is required when TELEGRAM_MODE=webhook',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
