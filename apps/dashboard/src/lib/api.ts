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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new ApiError(0, 'VITE_API_URL no está configurada')
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
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

export const api = {
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
}
