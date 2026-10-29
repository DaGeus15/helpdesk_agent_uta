import { ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, formatRelativeTime, truncate } from '@/lib/utils'
import { getLeadStateMeta } from '@/lib/lead-state'
import type { ConversationWithPreview } from '@/hooks/useConversations'

interface ConversationCardProps {
  conversation: ConversationWithPreview
  selected: boolean
  onSelect: () => void
}

export function ConversationCard({ conversation, selected, onSelect }: ConversationCardProps) {
  const meta = getLeadStateMeta(conversation.lead_state)
  const Icon = meta.Icon
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'
  const handle = conversation.telegram_username ? `@${conversation.telegram_username}` : 'sin usuario'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-indigo-200 bg-indigo-50/80 shadow-sm'
          : 'border-transparent bg-card hover:border-border hover:bg-muted/40',
        conversation.ai_paused && conversation.paused_reason === 'frustration' && !selected
          ? 'border-l-2 border-l-red-400'
          : '',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{handle}</p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {formatRelativeTime(conversation.last_message_at)}
        </span>
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
        {truncate(conversation.last_message_preview, 90)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
            meta.bg,
          )}
        >
          <span className={cn('size-1.5 rounded-full', meta.dot)} />
          <Icon className={cn('size-3', meta.color)} />
          {meta.label}
        </span>

        {conversation.ai_paused && (
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
