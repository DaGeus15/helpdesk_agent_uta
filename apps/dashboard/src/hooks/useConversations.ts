import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  MOCK_CONVERSATIONS,
  getLastMessagePreview,
} from '@/mocks'
import { USE_MOCKS, hasSupabaseEnv } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import type { Conversation, LeadState, Message, PausedReason } from '@/types'

export interface ConversationWithPreview extends Conversation {
  last_message_preview: string
}

const ADVISOR_REASONS: PausedReason[] = ['frustration', 'user_request']

function sortByLastMessage(list: ConversationWithPreview[]): ConversationWithPreview[] {
  return [...list].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  )
}

function upsertConversation(
  list: ConversationWithPreview[],
  next: Conversation,
  preview?: string,
): ConversationWithPreview[] {
  const existing = list.find((c) => c.id === next.id)
  const withPreview: ConversationWithPreview = {
    ...next,
    last_message_preview:
      preview ?? existing?.last_message_preview ?? next.summary ?? 'Sin mensajes',
  }
  const without = list.filter((c) => c.id !== next.id)
  return sortByLastMessage([...without, withPreview])
}

function notifyStateChange(prev: Conversation | undefined, next: Conversation) {
  const name = next.display_name ?? next.telegram_username ?? 'Prospecto'

  const becameAdvisorPause =
    next.ai_paused &&
    ADVISOR_REASONS.includes(next.paused_reason) &&
    (!prev?.ai_paused || !ADVISOR_REASONS.includes(prev.paused_reason))

  if (becameAdvisorPause) {
    const reason =
      next.paused_reason === 'frustration' ? 'frustración' : 'pidió un asesor'
    toast.warning(`${name} requiere asesor`, {
      description: `IA pausada por ${reason}`,
    })
  }

  if (next.lead_state === 'lead_caliente' && prev?.lead_state !== 'lead_caliente') {
    toast.success(`Lead caliente: ${name}`, {
      description: 'Oportunidad lista para cerrar',
    })
  }
}

function buildMockConversations(): ConversationWithPreview[] {
  return sortByLastMessage(
    MOCK_CONVERSATIONS.map((c) => ({
      ...c,
      last_message_preview: getLastMessagePreview(c.id),
    })),
  )
}

/**
 * Live conversations list via Supabase Realtime (or mocks when VITE_USE_MOCKS=true).
 * Owns the single `conversations` channel and the single `messages` channel
 * (for card previews + unread + fan-out to useMessages).
 */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationWithPreview[]>(() =>
    USE_MOCKS ? buildMockConversations() : [],
  )
  const [selectedId, setSelectedIdState] = useState<string | null>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(!USE_MOCKS && hasSupabaseEnv)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(USE_MOCKS)

  const selectedIdRef = useRef<string | null>(null)
  const conversationsRef = useRef(conversations)
  selectedIdRef.current = selectedId
  conversationsRef.current = conversations

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id)
    if (id) {
      setUnread((prev) => {
        if (!prev[id]) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }, [])

  useEffect(() => {
    if (USE_MOCKS || !hasSupabaseEnv || !supabase) {
      setLoading(false)
      return
    }

    let cancelled = false
    const client = supabase

    async function loadInitial() {
      setLoading(true)
      setError(null)

      const { data: convData, error: convError } = await client
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false })

      if (cancelled) return

      if (convError) {
        setError(convError.message)
        setLoading(false)
        return
      }

      const convs = (convData ?? []) as Conversation[]
      const ids = convs.map((c) => c.id)

      const previewByConv = new Map<string, string>()
      if (ids.length > 0) {
        const { data: msgData } = await client
          .from('messages')
          .select('conversation_id, content, created_at')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false })
          .limit(Math.max(ids.length * 3, 50))

        if (!cancelled && msgData) {
          for (const row of msgData) {
            if (!previewByConv.has(row.conversation_id)) {
              previewByConv.set(row.conversation_id, row.content)
            }
          }
        }
      }

      if (cancelled) return

      setConversations(
        sortByLastMessage(
          convs.map((c) => ({
            ...c,
            last_message_preview: previewByConv.get(c.id) ?? (c.summary || 'Sin mensajes'),
          })),
        ),
      )
      setLoading(false)
    }

    void loadInitial()

    const channel = client
      .channel('dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string }
            if (oldRow.id) {
              setConversations((prev) => prev.filter((c) => c.id !== oldRow.id))
            }
            return
          }

          const next = payload.new as Conversation
          const prev = conversationsRef.current.find((c) => c.id === next.id)
          notifyStateChange(prev, next)
          setConversations((list) => upsertConversation(list, next))
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const message = payload.new as Message
          setConversations((list) => {
            const existing = list.find((c) => c.id === message.conversation_id)
            if (!existing) return list
            return upsertConversation(
              list,
              {
                ...existing,
                last_message_at: message.created_at,
                message_count: existing.message_count + 1,
              },
              message.content,
            )
          })
          if (message.conversation_id !== selectedIdRef.current) {
            setUnread((prev) => ({
              ...prev,
              [message.conversation_id]: (prev[message.conversation_id] ?? 0) + 1,
            }))
          }
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
      })

    return () => {
      cancelled = true
      void client.removeChannel(channel)
      setIsLive(false)
    }
  }, [])

  const selected: ConversationWithPreview | null = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  return {
    conversations,
    selected,
    selectedId,
    setSelectedId,
    unread,
    loading,
    error,
    isLive,
    configured: USE_MOCKS || hasSupabaseEnv,
  }
}

export function metricsFromConversations(
  conversations: Conversation[],
): Pick<
  import('@/types').Metrics,
  'active' | 'byState' | 'hotLeads' | 'injectionAttempts'
> {
  const byState: Record<LeadState, number> = {
    interesado: 0,
    dudoso: 0,
    frustrado: 0,
    lead_caliente: 0,
  }
  let injectionAttempts = 0
  for (const c of conversations) {
    byState[c.lead_state] = (byState[c.lead_state] ?? 0) + 1
    injectionAttempts += c.injection_attempts
  }
  return {
    active: conversations.length,
    byState,
    hotLeads: byState.lead_caliente,
    injectionAttempts,
  }
}
