import { useEffect, useRef, useState } from 'react'
import { getMessagesForConversation } from '@/mocks'
import { USE_MOCKS, hasSupabaseEnv } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import type { Message } from '@/types'

function dedupeAppend(prev: Message[], incoming: Message): Message[] {
  if (prev.some((m) => m.id === incoming.id)) return prev
  return [...prev, incoming].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

/**
 * Messages for the open conversation: initial load + INSERT subscription
 * filtered by conversation_id. Channel is removed when the id changes or
 * the hook unmounts.
 */
export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    if (USE_MOCKS) {
      setMessages(getMessagesForConversation(conversationId))
      setLoading(false)
      return
    }

    if (!hasSupabaseEnv || !supabase) {
      setMessages([])
      setLoading(false)
      return
    }

    let cancelled = false
    const client = supabase
    setLoading(true)

    void (async () => {
      const { data, error } = await client
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (error) {
        setMessages([])
        setLoading(false)
        return
      }
      setMessages((data ?? []) as Message[])
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
          setMessages((prev) => dedupeAppend(prev, message))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return { messages, loading, bottomRef }
}
