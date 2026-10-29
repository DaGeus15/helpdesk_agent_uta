import {
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import {
  ChevronDown,
  ChevronUp,
  Mic,
  PauseCircle,
  PlayCircle,
  Send,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getLeadStateMeta } from '@/lib/lead-state'
import type { ConversationWithPreview } from '@/hooks/useConversations'
import type { LeadProfile, Message } from '@/types'

interface ChatViewProps {
  conversation: ConversationWithPreview
  messages: Message[]
  bottomRef: RefObject<HTMLDivElement | null>
}

function roleLabel(role: Message['role']): string | null {
  if (role === 'assistant') return 'IA'
  if (role === 'operator') return 'Asesor'
  return null
}

function profileChips(profile: LeadProfile): Array<{ label: string; value: string }> {
  const entries: Array<[string, string | undefined]> = [
    ['Nombre', profile.name],
    ['Interés', profile.interest],
    ['Nivel', profile.level],
    ['Disponibilidad', profile.availability],
    ['Presupuesto', profile.budget],
    ['Contacto', profile.contact],
  ]
  return entries
    .filter(([, v]) => Boolean(v))
    .map(([label, value]) => ({ label, value: value! }))
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

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Error desconocido'
}

export function ChatView({ conversation, messages, bottomRef }: ChatViewProps) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [takingOver, setTakingOver] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [advisorSummary, setAdvisorSummary] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(true)

  const meta = getLeadStateMeta(conversation.lead_state)
  const Icon = meta.Icon
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'
  const chips = profileChips(conversation.profile)
  const summaryText = advisorSummary ?? conversation.summary

  useEffect(() => {
    setDraft('')
    setAdvisorSummary(null)
    setSummaryOpen(true)
  }, [conversation.id])

  async function handleTakeover() {
    setTakingOver(true)
    try {
      const res = await api.takeover(conversation.id)
      setAdvisorSummary(res.summary)
      setSummaryOpen(true)
      toast.success('Control tomado', { description: 'La IA quedó en pausa' })
    } catch (err) {
      toast.error('No se pudo tomar control', { description: errorMessage(err) })
    } finally {
      setTakingOver(false)
    }
  }

  async function handleRelease() {
    setReleasing(true)
    try {
      await api.release(conversation.id)
      toast.success('Conversación devuelta a la IA')
    } catch (err) {
      toast.error('No se pudo devolver a la IA', { description: errorMessage(err) })
    } finally {
      setReleasing(false)
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    try {
      await api.sendMessage(conversation.id, text)
      setDraft('')
      // El mensaje llega por Realtime; no lo duplicamos en estado local.
    } catch (err) {
      toast.error('No se pudo enviar el mensaje', { description: errorMessage(err) })
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <div className="flex flex-col gap-3 border-b bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{name}</h2>
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
            {conversation.ai_paused ? (
              <Badge variant="warning" className="gap-1">
                <PauseCircle className="size-3" />
                IA en pausa — atendiendo un asesor
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                <PlayCircle className="size-3" />
                IA activa
              </Badge>
            )}
            {conversation.injection_attempts > 0 && (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="size-3" />
                {conversation.injection_attempts} injection
                {conversation.injection_attempts > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {conversation.telegram_username && (
            <p className="text-xs text-muted-foreground">@{conversation.telegram_username}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void handleTakeover()}
            disabled={takingOver || conversation.ai_paused}
          >
            {takingOver ? 'Tomando…' : 'Tomar control'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleRelease()}
            disabled={releasing || !conversation.ai_paused}
          >
            {releasing ? 'Devolviendo…' : 'Devolver a la IA'}
          </Button>
        </div>
      </div>

      {summaryText && (
        <div className="border-b bg-amber-50/60">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium text-amber-900"
            onClick={() => setSummaryOpen((o) => !o)}
          >
            <span>Resumen para el asesor</span>
            {summaryOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {summaryOpen && (
            <div className="space-y-2 px-4 pb-3">
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span
                      key={chip.label}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-0.5 text-[11px] text-amber-950"
                    >
                      <span className="font-medium text-amber-700">{chip.label}:</span>
                      {chip.value}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs leading-relaxed text-amber-950/90 whitespace-pre-wrap">
                {summaryText}
              </p>
            </div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 bg-[radial-gradient(circle_at_top,_#eef2ff_0%,_transparent_55%)] px-4 py-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form onSubmit={(e) => void handleSubmit(e)} className="border-t bg-card p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe como el bot…"
            rows={2}
            className="min-h-[44px] resize-none"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !draft.trim()}
            aria-label="Enviar"
          >
            <Send />
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Enter envía · Shift+Enter salto de línea. El mensaje aparece por Realtime.
        </p>
      </form>
    </div>
  )
}
