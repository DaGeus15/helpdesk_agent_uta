import { useEffect, useRef, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { avatarColorFromName, getInitials, getLeadStateMeta } from '@/lib/lead-state'
import { cn, formatRelativeTime, truncate } from '@/lib/utils'
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

export function ConversationCard({
  conversation,
  selected,
  unread = 0,
  flash = false,
  now = Date.now(),
  onSelect,
}: ConversationCardProps) {
  const meta = getLeadStateMeta(conversation.lead_state)
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'
  const alert = needsAdvisor(conversation)
  const avatarBg = avatarColorFromName(name)
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

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Conversación con ${name}`}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'w-full rounded-2xl border px-3 py-2.5 text-left transition-ui focus-visible:ring-2 focus-visible:ring-[rgba(30,79,163,0.35)] focus-visible:outline-none active:scale-[0.99]',
        selected
          ? 'border-[rgba(30,79,163,0.2)] border-l-[3px] border-l-[var(--uta-primary)] bg-[var(--uta-primary-soft)] shadow-[var(--uta-shadow-soft)]'
          : 'border-[var(--uta-hairline)] bg-white shadow-[var(--uta-shadow-soft)] hover:-translate-y-px hover:shadow-[var(--uta-shadow-lift)]',
        alert && !selected && 'border-red-200/80 bg-red-50/70 hover:bg-red-50',
        alert && selected && 'border-red-300 border-l-red-600 bg-red-50/90',
        flash && 'card-flash',
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: avatarBg }}
          aria-hidden
        >
          {getInitials(name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-semibold tracking-tight text-[var(--uta-text)]">
              {name}
            </p>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[11px] tabular-nums text-[var(--uta-text-muted)]">
                {formatRelativeTime(conversation.last_message_at, now)}
              </span>
              {unread > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--uta-primary)] px-1.5 text-[10px] font-semibold text-white tabular-nums">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
          </div>

          <p className="mt-0.5 line-clamp-2 text-[13px] text-[var(--uta-text-muted)]">
            {truncate(conversation.last_message_preview, 90)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[11px] font-medium transition-ui',
                meta.bg,
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full transition-[background-color] duration-200',
                  meta.dot,
                  thermoPulse && 'thermo-pulse',
                )}
              />
              {meta.label}
            </span>

            {alert && (
              <Badge variant="destructive" className="text-[10px]">
                Requiere asesor
              </Badge>
            )}

            {conversation.ai_paused && !alert && (
              <Badge variant="warning" className="text-[10px]">
                IA pausada
              </Badge>
            )}

            {conversation.injection_attempts > 0 && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <ShieldAlert className="size-3" />
                {conversation.injection_attempts}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
