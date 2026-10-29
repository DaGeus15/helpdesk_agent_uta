import { useEffect, useRef, useState } from 'react'
import { getLeadStateMeta } from '@/lib/lead-state'
import { cn, formatClockTime, truncate } from '@/lib/utils'
import type { ConversationWithPreview } from '@/hooks/useConversations'

interface ConversationCardProps {
  conversation: ConversationWithPreview
  selected: boolean
  unread?: number
  flash?: boolean
  now?: number
  onSelect: () => void
}

export function needsAdvisor(conversation: ConversationWithPreview): boolean {
  return (
    conversation.ai_paused &&
    (conversation.paused_reason === 'frustration' ||
      conversation.paused_reason === 'user_request')
  )
}

function previewPrefix(role: ConversationWithPreview['last_message_role']): string {
  if (role === 'assistant') return 'IA: '
  if (role === 'operator') return 'Operador: '
  return ''
}

export function ConversationCard({
  conversation,
  selected,
  unread = 0,
  flash = false,
  onSelect,
}: ConversationCardProps) {
  const meta = getLeadStateMeta(conversation.lead_state)
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'
  const alert = needsAdvisor(conversation)
  const [thermoPulse, setThermoPulse] = useState(false)
  const prevStateRef = useRef(conversation.lead_state)

  useEffect(() => {
    if (prevStateRef.current !== conversation.lead_state) {
      prevStateRef.current = conversation.lead_state
      setThermoPulse(true)
      const t = window.setTimeout(() => setThermoPulse(false), 450)
      return () => window.clearTimeout(t)
    }
  }, [conversation.lead_state])

  const preview = `${previewPrefix(conversation.last_message_role)}${truncate(
    conversation.last_message_preview,
    80,
  )}`

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Conversación con ${name}`}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'grid w-full gap-1.5 rounded-md border-0 border-l-4 bg-white px-3.5 py-3 text-left text-[var(--text)] transition-ui focus-visible:outline-none',
        selected && 'shadow-[inset_0_0_0_2px_var(--red)]',
        !selected && 'hover:bg-[color-mix(in_srgb,white_94%,var(--ink))]',
        flash && 'card-flash',
      )}
      style={{ borderLeftColor: meta.colorHex }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-semibold text-[var(--ink)]">{name}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {unread > 0 && (
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[var(--red)] px-1.5 text-xs font-semibold text-white tabular-nums">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
          <time className="text-xs whitespace-nowrap text-[var(--muted)]">
            {formatClockTime(conversation.last_message_at)}
          </time>
        </div>
      </div>

      <p className="truncate text-[13px]">{preview}</p>

      <div className="flex flex-wrap gap-1">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-2 py-px text-xs font-medium shadow-[inset_3px_0_0_var(--state-color)]',
            meta.bg,
            thermoPulse && 'thermo-pulse',
          )}
          style={{ ['--state-color' as string]: meta.colorHex }}
        >
          <span aria-hidden>{meta.emoji}</span>
          {meta.label}
        </span>

        {conversation.ai_paused ? (
          <span className="inline-flex items-center rounded bg-[var(--operator)] px-2 py-px text-xs font-medium text-white">
            Operador
          </span>
        ) : (
          <span className="inline-flex items-center rounded bg-[color-mix(in_srgb,var(--ink)_8%,white)] px-2 py-px text-xs font-medium text-[var(--ink)]">
            IA
          </span>
        )}

        <span className="inline-flex items-center rounded bg-[var(--navy)] px-2 py-px text-xs font-medium text-white">
          Telegram
        </span>

        {alert && (
          <span className="inline-flex items-center rounded bg-[var(--critical)] px-2 py-px text-xs font-medium text-white">
            Atención
          </span>
        )}
      </div>
    </button>
  )
}
