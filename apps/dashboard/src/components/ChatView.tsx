import {
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import {
  ArrowLeft,
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
  onBack?: () => void
  className?: string
}

function roleLabel(role: Message['role']): string | null {
  if (role === 'assistant') return 'IA · Andrea'
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
  const isAssistant = message.role === 'assistant'
  const label = roleLabel(message.role)

  return (
    <div className={cn('flex w-full', isUser ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[75%]',
          isUser && 'rounded-bl-md border border-[var(--uta-border)] bg-white text-[var(--uta-text)]',
          isAssistant &&
            'rounded-br-md bg-[var(--uta-primary-soft)] text-[var(--uta-text)]',
          isOperator && 'rounded-br-md bg-[var(--uta-primary)] text-white',
        )}
      >
        {(label || message.source === 'voice' || message.flagged_injection) && (
          <div
            className={cn(
              'mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium tracking-wide',
              isOperator ? 'text-white/80' : 'text-[var(--uta-text-muted)]',
            )}
          >
            {label && <span>{label}</span>}
            {message.source === 'voice' && (
              <span className="inline-flex items-center gap-0.5">
                <Mic className="size-3" />
                Nota de voz transcrita
              </span>
            )}
            {message.flagged_injection && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5',
                  isOperator ? 'text-red-200' : 'text-red-600',
                )}
              >
                <ShieldAlert className="size-3" />
                Intento de manipulación
              </span>
            )}
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <p
          className={cn(
            'mt-1 text-[10px]',
            isOperator ? 'text-white/70' : 'text-[var(--uta-text-muted)]',
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

export function ChatView({
  conversation,
  messages,
  bottomRef,
  onBack,
  className,
}: ChatViewProps) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [takingOver, setTakingOver] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [advisorSummary, setAdvisorSummary] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(true)

  const meta = getLeadStateMeta(conversation.lead_state)
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
    <div className={cn('flex h-full min-w-0 flex-1 flex-col bg-[var(--uta-bg)]', className)}>
      <div className="flex flex-col gap-3 border-b border-[var(--uta-border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {onBack && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mr-0.5 h-8 px-2 md:hidden"
                onClick={onBack}
                aria-label="Volver a conversaciones"
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <h2 className="truncate text-base font-semibold text-[var(--uta-text)]">{name}</h2>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-ui',
                meta.bg,
              )}
            >
              <span className={cn('size-1.5 rounded-full', meta.dot)} />
              {meta.label}
            </span>
            {conversation.ai_paused ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                <PauseCircle className="size-3" />
                Atendiendo un asesor
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <PlayCircle className="size-3" />
                IA activa
              </span>
            )}
            {conversation.injection_attempts > 0 && (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="size-3" />
                {conversation.injection_attempts} intento
                {conversation.injection_attempts > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {conversation.telegram_username && (
            <p className="text-xs text-[var(--uta-text-muted)]">
              @{conversation.telegram_username}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-[var(--uta-primary)] hover:bg-[var(--uta-primary-mid)]"
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
        <div className="border-b border-amber-200/80 bg-amber-50/70">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium text-amber-900 transition-ui"
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
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-amber-950/90">
                {summaryText}
              </p>
            </div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="chat-pattern flex flex-col gap-3 px-4 py-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form onSubmit={(e) => void handleSubmit(e)} className="border-t border-[var(--uta-border)] bg-white p-3">
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
            className="bg-[var(--uta-primary)] hover:bg-[var(--uta-primary-mid)]"
            disabled={sending || !draft.trim()}
            aria-label="Enviar"
          >
            <Send />
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--uta-text-muted)]">
          Enter envía · Shift+Enter salto de línea. El mensaje aparece por Realtime.
        </p>
      </form>
    </div>
  )
}
