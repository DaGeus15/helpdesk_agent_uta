import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { USE_MOCKS, hasSupabaseEnv } from '@/lib/env'
import { MOCK_METRICS } from '@/mocks'
import { metricsFromConversations } from '@/hooks/useConversations'
import { supabase } from '@/lib/supabase'
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
  llm: { fallbacks: 0, rateLimited: 0 },
}

const REALTIME_DEBOUNCE_MS = 2_000

export function useMetrics(conversations: Conversation[]) {
  const [metrics, setMetrics] = useState<Metrics>(USE_MOCKS ? MOCK_METRICS : EMPTY_METRICS)
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations
  const pullRef = useRef<() => Promise<void>>(async () => {})

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
          llm: prev.llm,
        }))
      }
    }

    pullRef.current = pull
    void pull()
    const id = window.setInterval(() => void pull(), 15_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (USE_MOCKS || !hasSupabaseEnv || !supabase) return

    let debounceId: number | null = null
    const client = supabase

    function scheduleRefresh() {
      if (debounceId != null) window.clearTimeout(debounceId)
      debounceId = window.setTimeout(() => {
        debounceId = null
        void pullRef.current()
      }, REALTIME_DEBOUNCE_MS)
    }

    const channel = client
      .channel('metrics-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => scheduleRefresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'handover_events' },
        () => scheduleRefresh(),
      )
      .subscribe()

    return () => {
      if (debounceId != null) window.clearTimeout(debounceId)
      void client.removeChannel(channel)
    }
  }, [])

  return metrics
}
