import { ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { avatarColorFromName, getInitials, getLeadStateMeta } from '@/lib/lead-state'
import { cn, formatRelativeTime, truncate } from '@/lib/utils'
import type { ConversationWithPreview } from '@/hooks/useConversations'

interface ConversationCardProps {
  conversation: ConversationWithPreview
  selected: boolean
  unread?: number
  onSelect: () => void
}

function needsAdvisor(conversation: ConversationWithPreview): boolean {
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
  onSelect,
}: ConversationCardProps) {
  const meta = getLeadStateMeta(conversation.lead_state)
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'
  const alert = needsAdvisor(conversation)
  const avatarBg = avatarColorFromName(name)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-ui',
        selected
          ? 'border-[var(--uta-primary-soft)] border-l-[3px] border-l-[var(--uta-primary)] bg-[var(--uta-primary-soft)]'
          : 'bg-white hover:border-[var(--uta-border)] hover:bg-[#f8fafc]',
        alert && !selected && 'border-red-200 bg-red-50/70 hover:bg-red-50',
        alert && selected && 'border-red-300 border-l-red-600 bg-red-50/90',
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ backgroundColor: avatarBg }}
          aria-hidden
        >
          {getInitials(name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-[var(--uta-text)]">{name}</p>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[11px] text-[var(--uta-text-muted)]">
                {formatRelativeTime(conversation.last_message_at)}
              </span>
              {unread > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--uta-primary)] px-1.5 text-[10px] font-semibold text-white tabular-nums">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
          </div>

          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--uta-text-muted)]">
            {truncate(conversation.last_message_preview, 90)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-ui',
                meta.bg,
              )}
            >
              <span className={cn('size-1.5 rounded-full', meta.dot)} />
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
