import { ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, formatRelativeTime, truncate } from '@/lib/utils'
import { getLeadStateMeta } from '@/lib/lead-state'
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
  const Icon = meta.Icon
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'
  const handle = conversation.telegram_username
    ? `@${conversation.telegram_username}`
    : 'sin usuario'
  const alert = needsAdvisor(conversation)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-300',
        selected
          ? 'border-indigo-200 bg-indigo-50/80 shadow-sm'
          : 'border-transparent bg-card hover:border-border hover:bg-muted/40',
        alert && !selected && 'border-red-200 bg-red-50/70 hover:bg-red-50',
        alert && selected && 'border-red-300 bg-red-50/90',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{handle}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(conversation.last_message_at)}
          </span>
          {unread > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white tabular-nums">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
        {truncate(conversation.last_message_preview, 90)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors duration-300',
            meta.bg,
          )}
        >
          <span className={cn('size-1.5 rounded-full transition-colors duration-300', meta.dot)} />
          <Icon className={cn('size-3 transition-colors duration-300', meta.color)} />
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
            {conversation.injection_attempts} injection
            {conversation.injection_attempts > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    </button>
  )
}
