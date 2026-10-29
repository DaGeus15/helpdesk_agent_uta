import { getToken, handleUnauthorized } from '@/lib/auth'
import type { Conversation, LeadState, Message, Metrics } from '@/types'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { auth?: boolean },
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

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    if (requireAuth && response.status === 401) {
      handleUnauthorized()
    }

    let message = response.statusText
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) message = body.message
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
  summary: string
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

  sendMessage(conversationId: string, text: string) {
    return request<SendMessageResponse>(`/operator/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
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
