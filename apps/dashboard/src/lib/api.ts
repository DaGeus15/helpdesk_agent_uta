import { toast } from 'sonner'
import { getToken, handleUnauthorized } from '@/lib/auth'
import type { Conversation, LeadState, Message, Metrics } from '@/types'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  statusCode: number
  isNetwork: boolean

  constructor(statusCode: number, message: string, isNetwork = false) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.isNetwork = isNetwork
  }
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const record = body as Record<string, unknown>
  const msg = record.message
  if (typeof msg === 'string' && msg.trim()) return msg
  if (Array.isArray(msg)) {
    const joined = msg.filter((m) => typeof m === 'string' && m.trim()).join('. ')
    if (joined) return joined
  }
  if (msg && typeof msg === 'object') {
    const nested = (msg as Record<string, unknown>).message
    if (typeof nested === 'string' && nested.trim()) return nested
  }
  if (typeof record.error === 'string' && record.error.trim()) return record.error
  return fallback
}

function toastNetworkError(onRetry?: () => void) {
  toast.error('Error de red', {
    description: 'No se pudo contactar al servidor',
    action: {
      label: 'Reintentar',
      onClick: () => {
        onRetry?.()
      },
    },
  })
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { auth?: boolean; onNetworkRetry?: () => void },
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(0, 'VITE_API_URL no está configurada')
  }

  const requireAuth = options?.auth !== false
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }

  if (requireAuth) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
    })
  } catch {
    toastNetworkError(options?.onNetworkRetry)
    throw new ApiError(0, 'Error de red', true)
  }

  if (!response.ok) {
    if (requireAuth && response.status === 401) {
      handleUnauthorized()
    }

    let message = response.statusText || `Error ${response.status}`
    try {
      const body: unknown = await response.json()
      message = extractErrorMessage(body, message)
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(response.status, message)
  }

  return (await response.json()) as T
}

export interface LoginResponse {
  token: string
  expiresAt: string
  username: string
}

export interface TakeoverResponse {
  conversation: Conversation
  summary: string | null
  warning?: string
}

export interface ReleaseResponse {
  conversation: Conversation
}

export interface SendMessageResponse {
  message: Message
}

export interface SummaryResponse {
  summary: string
  profile: Conversation['profile']
  lead_state: LeadState
}

export interface CatalogSyncResult {
  ok: boolean
  total: number
  upserted: number
  deactivated: number
  durationMs: number
  error?: string
}

export interface CatalogSyncRun {
  id: string
  started_at: string
  finished_at: string | null
  ok: boolean
  total: number
  upserted: number
  deactivated: number
  error: string | null
}

export interface CatalogSyncStatus {
  enabled: boolean
  intervalHours: number
  running: boolean
  nextScheduledAt: string | null
  lastRun: CatalogSyncRun | null
}

export const api = {
  login(username: string, password: string) {
    return request<LoginResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
      { auth: false },
    )
  },

  takeover(conversationId: string) {
    return request<TakeoverResponse>(`/operator/conversations/${conversationId}/takeover`, {
      method: 'POST',
    })
  },

  release(conversationId: string) {
    return request<ReleaseResponse>(`/operator/conversations/${conversationId}/release`, {
      method: 'POST',
    })
  },

  sendMessage(conversationId: string, text: string, clientId?: string) {
    return request<SendMessageResponse>(`/operator/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, ...(clientId ? { clientId } : {}) }),
    })
  },

  getSummary(conversationId: string) {
    return request<SummaryResponse>(`/operator/conversations/${conversationId}/summary`)
  },

  getMetrics() {
    return request<Metrics>('/operator/metrics')
  },

  syncCatalog() {
    return request<CatalogSyncResult>('/operator/catalog/sync', {
      method: 'POST',
    })
  },

  getCatalogStatus() {
    return request<CatalogSyncStatus>('/operator/catalog/status')
  },
}
