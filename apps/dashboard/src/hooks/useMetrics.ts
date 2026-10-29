import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { USE_MOCKS } from '@/lib/env'
import { MOCK_METRICS } from '@/mocks'
import { metricsFromConversations } from '@/hooks/useConversations'
import type { Conversation, Metrics } from '@/types'

const EMPTY_METRICS: Metrics = {
  active: 0,
  byState: {
    interesado: 0,
    dudoso: 0,
    frustrado: 0,
    lead_caliente: 0,
  },
  hotLeads: 0,
  handovers: 0,
  injectionAttempts: 0,
  avgLatencyMs: 0,
  tokensTotal: 0,
}

export function useMetrics(conversations: Conversation[]) {
  const [metrics, setMetrics] = useState<Metrics>(USE_MOCKS ? MOCK_METRICS : EMPTY_METRICS)
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations

  useEffect(() => {
    if (USE_MOCKS) {
      setMetrics(MOCK_METRICS)
      return
    }

    let cancelled = false

    async function pull() {
      try {
        const data = await api.getMetrics()
        if (!cancelled) setMetrics(data)
      } catch {
        if (cancelled) return
        const fallback = metricsFromConversations(conversationsRef.current)
        setMetrics((prev) => ({
          ...prev,
          ...fallback,
          handovers: prev.handovers,
          avgLatencyMs: prev.avgLatencyMs,
          tokensTotal: prev.tokensTotal,
        }))
      }
    }

    void pull()
    const id = window.setInterval(() => void pull(), 15_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return metrics
}
