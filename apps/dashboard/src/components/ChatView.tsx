import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  ArrowDown,
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
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, ApiError } from '@/lib/api'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getLeadStateMeta } from '@/lib/lead-state'
import type { ConversationWithPreview } from '@/hooks/useConversations'
import type { LeadProfile, LeadState, Message } from '@/types'

interface ChatViewProps {
  conversation: ConversationWithPreview
  messages: Message[]
  bottomRef: RefObject<HTMLDivElement | null>
  onBack?: () => void
  className?: string
}

const QUICK_TEMPLATES = [
  'Hola, soy tu asesor de CodeAndes 👋',
  '¿Te ayudo a completar tu inscripción?',
  'Te comparto los horarios disponibles',
  'Gracias por tu paciencia 🙏',
] as const

const LINK_RE =
  /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g

function roleLabel(role: Message['role']): string | null {
  if (role === 'assistant') return 'IA · Andrea'
  if (role === 'operator') return 'Asesor'
  return null
}

const EMPTY_PROFILE_VALUES = new Set([
  'unknown',
  'desconocido',
  'n/a',
  'no especificado',
])

const SUMMARY_LINE_LABELS = [
  'Lead',
  'Interés',
  'Objeciones',
  'Estado',
  'Siguiente paso',
] as const

function isMeaningfulProfileValue(value: string | undefined): value is string {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return !EMPTY_PROFILE_VALUES.has(trimmed.toLowerCase())
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
    .filter(([, v]) => isMeaningfulProfileValue(v))
    .map(([label, value]) => ({ label, value: value!.trim() }))
}

function ProfileChipsRow({
  chips,
  className,
}: {
  chips: Array<{ label: string; value: string }>
  className?: string
}) {
  if (chips.length === 0) {
    return (
      <p className={cn('text-[11px] text-[var(--uta-text-muted)]', className)}>
        Aún sin datos del perfil
      </p>
    )
  }
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--uta-border)] bg-[var(--uta-bg)] px-2 py-0.5 text-[11px] text-[var(--uta-text)]"
        >
          <span className="font-medium text-[var(--uta-text-muted)]">{chip.label}:</span>
          {chip.value}
        </span>
      ))}
    </div>
  )
}

function renderSummaryText(text: string): ReactNode {
  const cleaned = text.replace(/\*+/g, '')
  const lines = cleaned.split('\n')
  return lines.map((line, index) => {
    const match = SUMMARY_LINE_LABELS.find((label) =>
      line.startsWith(`${label}:`),
    )
    if (match) {
      const rest = line.slice(match.length + 1)
      return (
        <p key={index} className="leading-relaxed">
          <strong className="font-semibold">{match}:</strong>
          {rest}
        </p>
      )
    }
    return (
      <p key={index} className="leading-relaxed">
        {line.length > 0 ? line : '\u00A0'}
      </p>
    )
  })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  const re = new RegExp(LINK_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const token = match[0]
    const href = token.includes('@') && !token.startsWith('http') ? `mailto:${token}` : token
    parts.push(
      <a
        key={`${match.index}-${token}`}
        href={href}
        target={href.startsWith('mailto:') ? undefined : '_blank'}
        rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
        className="underline underline-offset-2 break-all"
      >
        {token}
      </a>,
    )
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : [text]
}

function MessageBubble({
  message,
  showLabel,
  animate,
}: {
  message: Message
  showLabel: boolean
  animate: boolean
}) {
  const isUser = message.role === 'user'
  const isOperator = message.role === 'operator'
  const isAssistant = message.role === 'assistant'
  const label = roleLabel(message.role)

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-start' : 'justify-end',
        animate && 'bubble-enter',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-[20px] px-3.5 py-2 text-[15px] shadow-[var(--uta-shadow-soft)] sm:max-w-[75%]',
          isUser &&
            'rounded-bl-md border border-[var(--uta-hairline)] bg-white text-[var(--uta-text)]',
          isAssistant && 'rounded-br-md bg-[var(--uta-primary-soft)] text-[var(--uta-text)]',
          isOperator && 'rounded-br-md bg-[var(--uta-primary)] text-white',
        )}
      >
        {(showLabel || message.source === 'voice' || message.flagged_injection) && (
          <div
            className={cn(
              'mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium tracking-wide',
              isOperator ? 'text-white/80' : 'text-[var(--uta-text-muted)]',
            )}
          >
            {showLabel && label && <span>{label}</span>}
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
        <p className="whitespace-pre-wrap leading-relaxed">{linkify(message.content)}</p>
        <p
          className={cn(
            'mt-1 text-[11px]',
            isOperator ? 'text-white/70' : 'text-[var(--uta-text-muted)]',
          )}
        >
          {formatRelativeTime(message.created_at)}
        </p>
      </div>
    </div>
  )
}

function LeadTimeline({ states }: { states: LeadState[] }) {
  if (states.length === 0) return null
  return (
    <div className="flex items-center gap-1" title="Evolución del termómetro">
      {states.map((state, i) => {
        const meta = getLeadStateMeta(state)
        return (
          <span
            key={`${state}-${i}`}
            className={cn('size-2 rounded-full', meta.dot)}
            title={meta.label}
          />
        )
      })}
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
  const [stickToBottom, setStickToBottom] = useState(true)
  const [newBelow, setNewBelow] = useState(0)
  const [animateFrom, setAnimateFrom] = useState<number | null>(null)
  const [thermoPulse, setThermoPulse] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const prevCountRef = useRef(0)
  const convIdRef = useRef(conversation.id)
  const prevLeadRef = useRef(conversation.lead_state)

  const meta = getLeadStateMeta(conversation.lead_state)
  const StateIcon = meta.Icon
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'
  const chips = profileChips(conversation.profile)
  const summaryText = advisorSummary ?? conversation.summary

  const timelineStates = useMemo(() => {
    const states: LeadState[] = []
    for (const m of messages) {
      if (m.role === 'assistant' && m.lead_state) states.push(m.lead_state)
    }
    return states.slice(-8)
  }, [messages])

  const items = useMemo(() => {
    const out: Array<
      | { type: 'day'; key: string; label: string }
      | { type: 'msg'; key: string; message: Message; showLabel: boolean; index: number }
    > = []
    let lastDay = ''
    let prevRole: Message['role'] | null = null
    messages.forEach((m, index) => {
      const dk = dayKey(m.created_at)
      if (dk !== lastDay) {
        lastDay = dk
        out.push({ type: 'day', key: `day-${dk}`, label: dayLabel(m.created_at) })
        prevRole = null
      }
      const showLabel = m.role !== 'user' && m.role !== prevRole
      out.push({ type: 'msg', key: m.id, message: m, showLabel, index })
      prevRole = m.role
    })
    return out
  }, [messages])

  useEffect(() => {
    setDraft('')
    setAdvisorSummary(null)
    setSummaryOpen(true)
    setStickToBottom(true)
    setNewBelow(0)
    setAnimateFrom(null)
    setThermoPulse(false)
    prevCountRef.current = 0
    convIdRef.current = conversation.id
    prevLeadRef.current = conversation.lead_state
  }, [conversation.id])

  useEffect(() => {
    if (prevLeadRef.current === conversation.lead_state) return
    prevLeadRef.current = conversation.lead_state
    setThermoPulse(true)
    const t = window.setTimeout(() => setThermoPulse(false), 450)
    return () => window.clearTimeout(t)
  }, [conversation.lead_state])

  useEffect(() => {
    const prev = prevCountRef.current
    const next = messages.length
    if (convIdRef.current !== conversation.id) return

    if (next > prev) {
      if (stickToBottom) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        })
        setNewBelow(0)
      } else {
        setNewBelow((n) => n + (next - prev))
      }
      if (prev > 0) setAnimateFrom(prev)
    } else if (next > 0 && prev === 0) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' })
      })
    }
    prevCountRef.current = next
  }, [messages, stickToBottom, bottomRef, conversation.id])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = distance < 80
    setStickToBottom(nearBottom)
    if (nearBottom) setNewBelow(0)
  }

  function scrollToBottom() {
    setStickToBottom(true)
    setNewBelow(0)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

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
      setStickToBottom(true)
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
      <div className="panel-header flex flex-col gap-2 border-b border-[var(--uta-hairline)] bg-white/90 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
              <h2 className="truncate text-[17px] font-semibold tracking-tight text-[var(--uta-text)]">
                {name}
              </h2>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[13px] font-semibold transition-ui',
                  meta.bg,
                )}
              >
                <StateIcon className={cn('size-4', meta.color)} />
                <span
                  className={cn(
                    'size-2 rounded-full transition-[background-color] duration-200',
                    meta.dot,
                    thermoPulse && 'thermo-pulse',
                  )}
                />
                {meta.label}
              </span>
              <LeadTimeline states={timelineStates} />
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
              <p className="mt-0.5 text-xs text-[var(--uta-text-muted)]">
                @{conversation.telegram_username}
              </p>
            )}
            <ProfileChipsRow chips={chips} className="mt-2" />
          </div>

          <div className="flex shrink-0 gap-2">
            {conversation.ai_paused ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-not-allowed">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[var(--uta-primary)] opacity-40 grayscale hover:bg-[var(--uta-primary)]"
                      disabled
                      aria-disabled
                    >
                      Tomar control
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Ya estás atendiendo esta conversación
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-[var(--uta-primary)] hover:bg-[var(--uta-primary-mid)]"
                onClick={() => void handleTakeover()}
                disabled={takingOver}
              >
                {takingOver ? 'Tomando…' : 'Tomar control'}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                !conversation.ai_paused &&
                  'cursor-not-allowed opacity-40 grayscale hover:bg-background hover:text-foreground',
              )}
              onClick={() => void handleRelease()}
              disabled={releasing || !conversation.ai_paused}
            >
              {releasing ? 'Devolviendo…' : 'Devolver a la IA'}
            </Button>
          </div>
        </div>
      </div>

      {summaryText && (
        <div className="border-b border-amber-200/80 bg-amber-50/70">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium text-amber-900 transition-ui"
            onClick={() => setSummaryOpen((o) => !o)}
            aria-expanded={summaryOpen}
            aria-label={summaryOpen ? 'Colapsar resumen' : 'Expandir resumen'}
          >
            <span>Resumen para el asesor</span>
            {summaryOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          <div className="summary-collapse" data-open={summaryOpen ? 'true' : 'false'}>
            <div>
              <div className="space-y-2 px-4 pb-3">
                <ProfileChipsRow
                  chips={chips}
                  className="[&_span]:border-amber-200/80 [&_span]:bg-white/70"
                />
                <div className="space-y-0.5 text-[13px] text-amber-950/90">
                  {renderSummaryText(summaryText)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="chat-pattern h-full overflow-y-auto"
        >
          <div className="flex flex-col gap-2 px-4 py-4">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--uta-text-muted)]">
                Aún no hay mensajes en esta conversación.
              </p>
            ) : (
              items.map((item) => {
                if (item.type === 'day') {
                  return (
                    <div key={item.key} className="my-2 flex items-center justify-center">
                      <span className="rounded-full border border-[var(--uta-border)] bg-white/90 px-3 py-0.5 text-[11px] font-medium text-[var(--uta-text-muted)] shadow-sm">
                        {item.label}
                      </span>
                    </div>
                  )
                }
                return (
                  <MessageBubble
                    key={item.key}
                    message={item.message}
                    showLabel={item.showLabel}
                    animate={animateFrom !== null && item.index >= animateFrom}
                  />
                )
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {!stickToBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--uta-hairline)] bg-white/95 px-3 py-1.5 text-[12px] font-medium text-[var(--uta-primary)] shadow-[var(--uta-shadow-lift)] backdrop-blur-sm transition-ui hover:bg-[var(--uta-primary-soft)] active:scale-[0.97]"
            aria-label="Ir al final del chat"
          >
            <ArrowDown className="size-3.5" />
            Ir al final
            {newBelow > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--uta-primary)] px-1.5 text-[10px] font-semibold text-white tabular-nums">
                {newBelow > 99 ? '99+' : newBelow}
              </span>
            )}
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="border-t border-[var(--uta-hairline)] bg-white/95 p-3 backdrop-blur-md"
      >
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDraft(t)}
              className="rounded-full border border-[var(--uta-hairline)] bg-[var(--uta-bg)] px-2.5 py-1 text-[11px] text-[var(--uta-text)] transition-ui hover:border-[var(--uta-primary)] hover:bg-[var(--uta-primary-soft)] active:scale-[0.97]"
            >
              {t.length > 36 ? `${t.slice(0, 35)}…` : t}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe como el bot…"
            rows={2}
            className="min-h-[48px] resize-none rounded-2xl text-[15px] shadow-[var(--uta-shadow-soft)]"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-xl bg-[var(--uta-primary)] hover:bg-[var(--uta-primary-mid)]"
            disabled={sending || !draft.trim()}
            aria-label="Enviar mensaje"
          >
            <Send />
          </Button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--uta-text-muted)]">
          <p>
            <kbd className="rounded border border-[var(--uta-border)] bg-[var(--uta-bg)] px-1">Enter</kbd>{' '}
            envía ·{' '}
            <kbd className="rounded border border-[var(--uta-border)] bg-[var(--uta-bg)] px-1">
              Shift+Enter
            </kbd>{' '}
            salto de línea
          </p>
          <span className="tabular-nums">{draft.length} caracteres</span>
        </div>
        {!conversation.ai_paused && (
          <p className="mt-1 text-[11px] text-amber-700">
            Al enviar, tomarás el control de la conversación
          </p>
        )}
      </form>
    </div>
  )
}
