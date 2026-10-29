import { useMemo, useState } from 'react'
import {
  MOCK_CONVERSATIONS,
  MOCK_METRICS,
  getLastMessagePreview,
  getMessagesForConversation,
} from '@/mocks'
import type { Conversation, Message, Metrics } from '@/types'

export interface ConversationWithPreview extends Conversation {
  last_message_preview: string
}

/**
 * Temporary data source for the dashboard skeleton.
 * Replace the mock internals with Supabase Realtime subscriptions later
 * without changing consumers of this hook.
 */
export function useConversations() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const conversations: ConversationWithPreview[] = useMemo(
    () =>
      [...MOCK_CONVERSATIONS]
        .sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
        )
        .map((c) => ({
          ...c,
          last_message_preview: getLastMessagePreview(c.id),
        })),
    [],
  )

  const selected: ConversationWithPreview | null =
    conversations.find((c) => c.id === selectedId) ?? null

  const messages: Message[] = useMemo(
    () => (selectedId ? getMessagesForConversation(selectedId) : []),
    [selectedId],
  )

  const metrics: Metrics = MOCK_METRICS

  return {
    conversations,
    selected,
    selectedId,
    setSelectedId,
    messages,
    metrics,
    loading: false,
  }
}
