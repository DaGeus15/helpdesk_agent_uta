export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

export const hasSupabaseEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export const hasApiEnv = Boolean(import.meta.env.VITE_API_URL)

/** Missing vars that block live mode (ignored when mocks are on). */
export function getMissingEnvVars(): string[] {
  if (USE_MOCKS) return []
  const missing: string[] = []
  if (!import.meta.env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY')
  if (!import.meta.env.VITE_API_URL) missing.push('VITE_API_URL')
  return missing
}
