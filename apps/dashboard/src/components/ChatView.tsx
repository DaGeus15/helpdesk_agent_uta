import { useState, type FormEvent } from 'react'
import { Mic, PauseCircle, PlayCircle, Send, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getLeadStateMeta } from '@/lib/lead-state'
import type { ConversationWithPreview } from '@/hooks/useConversations'
import type { Message } from '@/types'

interface ChatViewProps {
  conversation: ConversationWithPreview
  messages: Message[]
}

function roleLabel(role: Message['role']): string | null {
  if (role === 'assistant') return 'IA'
  if (role === 'operator') return 'Asesor'
  return null
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isOperator = message.role === 'operator'
  const label = roleLabel(message.role)

  return (
    <div className={cn('flex w-full', isUser ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
          isUser && 'rounded-bl-md bg-white border text-foreground',
          message.role === 'assistant' && 'rounded-br-md bg-indigo-600 text-white',
          isOperator && 'rounded-br-md bg-teal-700 text-white',
          message.flagged_injection && 'ring-2 ring-red-400',
        )}
      >
        {(label || message.source === 'voice' || message.flagged_injection) && (
          <div
            className={cn(
              'mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide',
              isUser ? 'text-muted-foreground' : 'text-white/80',
            )}
          >
            {label && <span>{label}</span>}
            {message.source === 'voice' && (
              <span className="inline-flex items-center gap-0.5">
                <Mic className="size-3" />
                voz
              </span>
            )}
            {message.flagged_injection && (
              <span className="inline-flex items-center gap-0.5 text-red-200">
                <ShieldAlert className="size-3" />
                injection
              </span>
            )}
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <p
          className={cn(
            'mt-1 text-[10px]',
            isUser ? 'text-muted-foreground' : 'text-white/70',
          )}
        >
          {formatRelativeTime(message.created_at)}
        </p>
      </div>
    </div>
  )
}

export function ChatView({ conversation, messages }: ChatViewProps) {
  const [draft, setDraft] = useState('')
  const meta = getLeadStateMeta(conversation.lead_state)
  const Icon = meta.Icon
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Wired in a later task (operator sendMessage)
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <div className="flex flex-col gap-3 border-b bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{name}</h2>
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
            {conversation.ai_paused ? (
              <Badge variant="warning" className="gap-1">
                <PauseCircle className="size-3" />
                IA pausada
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <PlayCircle className="size-3" />
                IA activa
              </Badge>
            )}
          </div>
          {conversation.telegram_username && (
            <p className="text-xs text-muted-foreground">@{conversation.telegram_username}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" disabled title="Próximamente">
            Tomar control
          </Button>
          <Button type="button" size="sm" variant="outline" disabled title="Próximamente">
            Devolver a la IA
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 bg-[radial-gradient(circle_at_top,_#eef2ff_0%,_transparent_55%)] px-4 py-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="border-t bg-card p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe como el bot…"
            rows={2}
            className="min-h-[44px] resize-none"
            disabled
          />
          <Button type="submit" size="icon" disabled aria-label="Enviar">
            <Send />
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          El envío como operador se habilitará al conectar la API.
        </p>
      </form>
    </div>
  )
}
