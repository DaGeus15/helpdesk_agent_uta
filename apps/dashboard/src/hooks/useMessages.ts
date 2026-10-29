import { useCallback, useEffect, useRef, useState } from 'react'
import { getMessagesForConversation } from '@/mocks'
import { USE_MOCKS, hasSupabaseEnv } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import type { HandoverEvent, Message } from '@/types'

function sortMessages(list: Message[]): Message[] {
  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

function sortEvents(list: HandoverEvent[]): HandoverEvent[] {
  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

/** Merge Realtime/API message with local list; reconcile optimistic rows by client_id. */
function reconcileMessage(prev: Message[], incoming: Message): Message[] {
  const withoutDupes = prev.filter((m) => {
    if (m.id === incoming.id) return false
    if (
      incoming.client_id &&
      m.client_id === incoming.client_id &&
      (m.id.startsWith('optimistic:') || m.id === incoming.id)
    ) {
      return false
    }
    return true
  })
  return sortMessages([...withoutDupes, incoming])
}

function upsertById(prev: Message[], incoming: Message): Message[] {
  const idx = prev.findIndex((m) => m.id === incoming.id)
  if (idx === -1) {
    if (incoming.client_id) {
      return reconcileMessage(prev, incoming)
    }
    return sortMessages([...prev, incoming])
  }
  const next = [...prev]
  next[idx] = { ...next[idx], ...incoming }
  return sortMessages(next)
}

/**
 * Messages + handover events for the open conversation: initial load + Realtime.
 * Also supports optimistic operator sends reconciled by client_id.
 */
export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [handoverEvents, setHandoverEvents] = useState<HandoverEvent[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setHandoverEvents([])
      setLoading(false)
      return
    }

    if (USE_MOCKS) {
      setMessages(getMessagesForConversation(conversationId))
      setHandoverEvents([])
      setLoading(false)
      return
    }

    if (!hasSupabaseEnv || !supabase) {
      setMessages([])
      setHandoverEvents([])
      setLoading(false)
      return
    }

    let cancelled = false
    const client = supabase
    setLoading(true)

    void (async () => {
      const [msgRes, evRes] = await Promise.all([
        client
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
        client
          .from('handover_events')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
      ])

      if (cancelled) return
      if (msgRes.error) {
        setMessages([])
      } else {
        setMessages((msgRes.data ?? []) as Message[])
      }
      if (evRes.error) {
        setHandoverEvents([])
      } else {
        setHandoverEvents((evRes.data ?? []) as HandoverEvent[])
      }
      setLoading(false)
    })()

    const channel = client
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = payload.new as Message
          setMessages((prev) => reconcileMessage(prev, message))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = payload.new as Message
          setMessages((prev) => upsertById(prev, message))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'handover_events',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const event = payload.new as HandoverEvent
          setHandoverEvents((prev) => {
            if (prev.some((e) => e.id === event.id)) return prev
            return sortEvents([...prev, event])
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }, [conversationId])

  const addOptimistic = useCallback(
    (text: string, clientId: string): Message => {
      const optimistic: Message = {
        id: `optimistic:${clientId}`,
        conversation_id: conversationId ?? '',
        role: 'operator',
        content: text,
        source: 'text',
        intent: null,
        lead_state: null,
        flagged_injection: false,
        blocked_by_guard: false,
        tokens_in: null,
        tokens_out: null,
        latency_ms: null,
        created_at: new Date().toISOString(),
        delivery_status: 'pending',
        client_id: clientId,
      }
      setMessages((prev) => {
        if (prev.some((m) => m.client_id === clientId)) {
          return prev.map((m) =>
            m.client_id === clientId
              ? { ...m, content: text, delivery_status: 'pending' }
              : m,
          )
        }
        return sortMessages([...prev, optimistic])
      })
      return optimistic
    },
    [conversationId],
  )

  const markOptimisticFailed = useCallback((clientId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.client_id === clientId ? { ...m, delivery_status: 'failed' as const } : m,
      ),
    )
  }, [])

  const applyServerMessage = useCallback((message: Message) => {
    setMessages((prev) => reconcileMessage(prev, message))
  }, [])

  return {
    messages,
    handoverEvents,
    loading,
    bottomRef,
    addOptimistic,
    markOptimisticFailed,
    applyServerMessage,
  }
}
