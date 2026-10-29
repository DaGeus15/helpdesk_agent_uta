export type LeadState = 'interesado' | 'dudoso' | 'frustrado' | 'lead_caliente'

export type MessageRole = 'user' | 'assistant' | 'operator'

export type MessageSource = 'text' | 'voice'

/** Reasons the AI can be paused — keep the union broad for API/DB values. */
export type PausedReason =
  | 'frustration'
  | 'user_request'
  | 'operator_takeover'
  | 'operator_message'
  | (string & {})
  | null

export type HandoverEventType = 'paused' | 'resumed'

export type HandoverReason =
  | 'frustration'
  | 'user_request'
  | 'operator_takeover'
  | 'operator_message'
  | 'operator_release'

export interface LeadProfile {
  name?: string
  interest?: string
  level?: string
  availability?: string
  budget?: string
  goal?: string
  contact?: string
  email?: string
  phone?: string
  /** Ecuadorian cédula (10 digits). */
  id_number?: string
  /** estudiante UTA | graduado/docente/administrativo | público general */
  audience?: string
}

export interface Conversation {
  id: string
  telegram_chat_id: number
  telegram_username: string | null
  display_name: string | null
  lead_state: LeadState
  ai_paused: boolean
  paused_reason: PausedReason
  profile: LeadProfile
  summary: string
  injection_attempts: number
  message_count: number
  last_message_at: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  source: MessageSource
  intent: string | null
  lead_state: LeadState | null
  flagged_injection: boolean
  blocked_by_guard: boolean
  tokens_in: number | null
  tokens_out: number | null
  latency_ms: number | null
  created_at: string
}

export interface HandoverEvent {
  id: string
  conversation_id: string
  type: HandoverEventType
  reason: HandoverReason
  created_at: string
}

export interface Metrics {
  active: number
  byState: Record<LeadState, number>
  hotLeads: number
  handovers: number
  injectionAttempts: number
  avgLatencyMs: number
  tokensTotal: number
}
