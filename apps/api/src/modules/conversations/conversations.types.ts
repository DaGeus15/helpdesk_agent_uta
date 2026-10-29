export type LeadState =
  | 'interesado'
  | 'dudoso'
  | 'frustrado'
  | 'lead_caliente';

export type MessageRole = 'user' | 'assistant' | 'operator';

export type MessageSource = 'text' | 'voice';

export interface LeadProfile {
  name?: string;
  interest?: string;
  level?: string;
  availability?: string;
  budget?: string;
  goal?: string;
  contact?: string;
  email?: string;
  phone?: string;
  /** Ecuadorian cédula (10 digits). */
  id_number?: string;
  /** estudiante UTA | graduado/docente/administrativo | público general */
  audience?: string;
}

export interface Conversation {
  id: string;
  telegram_chat_id: number;
  telegram_username: string | null;
  display_name: string | null;
  lead_state: LeadState;
  ai_paused: boolean;
  paused_reason: string | null;
  profile: LeadProfile;
  summary: string;
  injection_attempts: number;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

export type DeliveryStatus = 'pending' | 'sent' | 'failed';

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  source: MessageSource;
  intent: string | null;
  lead_state: string | null;
  flagged_injection: boolean;
  blocked_by_guard: boolean;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  delivery_status: DeliveryStatus;
  client_id: string | null;
  created_at: string;
}
