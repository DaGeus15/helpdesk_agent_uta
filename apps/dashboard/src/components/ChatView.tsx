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
  Mic,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, ApiError } from '@/lib/api'
import { cn, formatClockTime, formatLatencyShort } from '@/lib/utils'
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

const QUICK_TEMPLATES = [
  'Hola, soy tu asesor de CTT-FISEI 👋',
  '¿Te ayudo a completar tu inscripción?',
  'Te comparto los horarios disponibles',
  'Gracias por tu paciencia 🙏',
] as const

const LINK_RE =
  /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g

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
  if (chips.length === 0) return null
  return (
    <div className={cn('flex gap-1.5 overflow-x-auto whitespace-nowrap', className)}>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex shrink-0 items-center gap-1 rounded bg-white/95 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[var(--navy)] uppercase"
        >
          <span className="opacity-70">{chip.label}:</span>
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
          <strong className="font-semibold text-white">{match}:</strong>
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
        className="break-all underline underline-offset-2"
      >
        {token}
      </a>,
    )
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : [text]
}

function messageMeta(message: Message): string {
  const time = formatClockTime(message.created_at)
  if (message.role === 'assistant') {
    const latency = formatLatencyShort(message.latency_ms)
    return latency ? `IA · ${time} · ${latency}` : `IA · ${time}`
  }
  if (message.role === 'operator') return `Operador · ${time}`
  return time
}

function MessageBubble({
  message,
  animate,
}: {
  message: Message
  animate: boolean
}) {
  const isUser = message.role === 'user'
  const isOperator = message.role === 'operator'
  const isAssistant = message.role === 'assistant'

  return (
    <div
      className={cn(
        'mb-2.5 max-w-[72%] rounded-[10px] px-3.5 py-2.5 text-[var(--ink)] whitespace-pre-wrap break-words',
        isUser && 'rounded-bl-sm bg-[var(--mist)]',
        (isAssistant || isOperator) && 'ml-auto rounded-br-sm border border-[var(--line)]',
        isOperator &&
          'border-[color-mix(in_srgb,var(--operator)_45%,var(--line))] bg-[color-mix(in_srgb,var(--operator)_7%,white)]',
        animate && 'bubble-enter',
      )}
    >
      {(message.source === 'voice' || message.flagged_injection) && (
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
          {message.source === 'voice' && (
            <span className="inline-flex items-center gap-0.5">
              <Mic className="size-3" />
              Nota de voz transcrita
            </span>
          )}
          {message.flagged_injection && (
            <span className="inline-flex items-center gap-0.5 rounded bg-[color-mix(in_srgb,var(--critical)_14%,white)] px-1.5 text-[var(--ink)]">
              <ShieldAlert className="size-3" />
              Intento de manipulación
            </span>
          )}
        </div>
      )}
      <p>{linkify(message.content)}</p>
      <small className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--muted)]">
        {messageMeta(message)}
      </small>
    </div>
  )
}

function SystemSeparator({ label }: { label: string }) {
  return (
    <p className="my-3.5 text-center text-xs text-[var(--muted)]">{label}</p>
  )
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Error desconocido'
}

type TimelineItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'system'; key: string; label: string }
  | { type: 'msg'; key: string; message: Message; index: number }

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
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(true)
  const [stickToBottom, setStickToBottom] = useState(true)
  const [newBelow, setNewBelow] = useState(0)
  const [animateFrom, setAnimateFrom] = useState<number | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const summaryPanelRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const prevCountRef = useRef(0)
  const convIdRef = useRef(conversation.id)

  const meta = getLeadStateMeta(conversation.lead_state)
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'
  const chips = profileChips(conversation.profile)
  const summaryText = advisorSummary ?? conversation.summary
  const humanMode = conversation.ai_paused

  const items = useMemo(() => {
    const out: TimelineItem[] = []
    let lastDay = ''
    let prevRole: Message['role'] | null = null
    let sawOperator = false

    messages.forEach((m, index) => {
      const dk = dayKey(m.created_at)
      if (dk !== lastDay) {
        lastDay = dk
        out.push({ type: 'day', key: `day-${dk}`, label: dayLabel(m.created_at) })
        prevRole = null
      }

      if (m.role === 'operator' && prevRole !== 'operator') {
        out.push({
          type: 'system',
          key: `pause-${m.id}`,
          label: `— IA en pausa · Intervención del operador · ${formatClockTime(m.created_at)} —`,
        })
        sawOperator = true
      } else if (
        m.role === 'assistant' &&
        sawOperator &&
        prevRole === 'operator'
      ) {
        out.push({
          type: 'system',
          key: `resume-${m.id}`,
          label: `— IA reanudada · ${formatClockTime(m.created_at)} —`,
        })
      }

      out.push({ type: 'msg', key: m.id, message: m, index })
      prevRole = m.role
      if (m.role === 'operator') sawOperator = true
    })
    return out
  }, [messages])

  useEffect(() => {
    setDraft('')
    setAdvisorSummary(null)
    setSummaryOpen(false)
    setTemplatesOpen(true)
    setStickToBottom(true)
    setNewBelow(0)
    setAnimateFrom(null)
    prevCountRef.current = 0
    convIdRef.current = conversation.id
  }, [conversation.id])

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

  useEffect(() => {
    if (!summaryOpen) return
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setSummaryOpen(false)
    }
    function onPointer(e: MouseEvent) {
      const el = summaryPanelRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) setSummaryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      window.addEventListener('mousedown', onPointer)
    }, 0)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [summaryOpen])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight, 46), 160)
    el.style.height = `${next}px`
  }, [draft])

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

  const oneLineSummary = summaryText
    ? summaryText.replace(/\s+/g, ' ').trim().slice(0, 140)
    : 'Aún no hay suficiente conversación para resumir.'

  return (
    <div
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-[var(--line)] bg-white',
        className,
      )}
    >
      {/* Cabecera póster navy / carmesí */}
      <div
        className={cn(
          'relative z-20 shrink-0 px-5 py-5 text-white sm:px-6',
          humanMode ? 'bg-[var(--crimson)]' : 'bg-[var(--navy)]',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {onBack && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-white hover:bg-white/15 hover:text-white md:hidden"
                  onClick={onBack}
                  aria-label="Volver a conversaciones"
                >
                  <ArrowLeft className="size-4" />
                </Button>
              )}
              <h2 className="truncate text-[clamp(1.25rem,2.4vw,1.875rem)] font-bold tracking-wide text-white uppercase">
                {name}
              </h2>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded bg-white px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[var(--navy)] uppercase">
                {meta.emoji} {meta.label}
              </span>
              <span
                className={cn(
                  'rounded bg-white px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase',
                  humanMode ? 'text-[var(--crimson)]' : 'text-[var(--navy)]',
                )}
              >
                {humanMode ? 'Operador' : 'IA'}
              </span>
              <span
                className={cn(
                  'rounded bg-white px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase',
                  humanMode ? 'text-[var(--crimson)]' : 'text-[var(--navy)]',
                )}
              >
                Telegram
              </span>
              {conversation.injection_attempts > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[var(--crimson)] uppercase">
                  <ShieldAlert className="size-3" />
                  {conversation.injection_attempts}
                </span>
              )}
            </div>

            {chips.length > 0 && (
              <div className="mt-2">
                <ProfileChipsRow chips={chips} />
              </div>
            )}

            <button
              type="button"
              onClick={() => summaryText && setSummaryOpen((o) => !o)}
              className="mt-3 max-w-[80ch] text-left text-sm text-white/90 focus-visible:outline-none"
              aria-expanded={summaryOpen}
            >
              <strong className="font-semibold text-white">Resumen:</strong>{' '}
              {oneLineSummary}
              {summaryText ? (
                <ChevronDown
                  className={cn(
                    'ml-1 inline size-3.5 transition-ui',
                    summaryOpen && 'rotate-180',
                  )}
                />
              ) : null}
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {humanMode ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-not-allowed">
                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-md bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--red)] opacity-60"
                      >
                        Tomar control
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Ya estás atendiendo esta conversación
                  </TooltipContent>
                </Tooltip>
                <button
                  type="button"
                  onClick={() => void handleRelease()}
                  disabled={releasing}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-[var(--crimson)] transition-ui hover:bg-white/90 focus-visible:outline-none disabled:opacity-60"
                >
                  {releasing ? 'Devolviendo…' : 'Devolver a la IA'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleTakeover()}
                disabled={takingOver}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-[var(--red)] transition-ui hover:bg-white/90 focus-visible:outline-none disabled:opacity-60"
              >
                {takingOver ? 'Tomando…' : 'Tomar control'}
              </button>
            )}
          </div>
        </div>

        {summaryOpen && summaryText && (
          <div
            ref={summaryPanelRef}
            className="mt-3 max-h-48 overflow-y-auto rounded-md bg-black/20 p-3 banner-enter"
            role="dialog"
            aria-label="Resumen para el asesor"
          >
            <div className="space-y-0.5 text-sm text-white/90">
              {renderSummaryText(summaryText)}
            </div>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full min-h-0 overflow-y-auto px-5 py-5 sm:px-6"
        >
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              Aún no hay mensajes en esta conversación.
            </p>
          ) : (
            items.map((item) => {
              if (item.type === 'day') {
                return (
                  <div key={item.key} className="my-2 flex items-center justify-center">
                    <span className="text-[11px] font-medium text-[var(--muted)]">
                      — {item.label} —
                    </span>
                  </div>
                )
              }
              if (item.type === 'system') {
                return <SystemSeparator key={item.key} label={item.label} />
              }
              return (
                <MessageBubble
                  key={item.key}
                  message={item.message}
                  animate={animateFrom !== null && item.index >= animateFrom}
                />
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {!stickToBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--navy)] shadow-sm transition-ui hover:bg-[var(--mist)]"
            aria-label="Ir al final del chat"
          >
            <ArrowDown className="size-3.5" />
            Ir al final
            {newBelow > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--red)] px-1.5 text-[10px] font-semibold text-white tabular-nums">
                {newBelow > 99 ? '99+' : newBelow}
              </span>
            )}
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="shrink-0 border-t border-[var(--line)] bg-white"
      >
        <div className="flex items-center gap-2 px-5 pt-3 sm:px-6">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 gap-1 px-2 text-[11px] text-[var(--ink)]"
            onClick={() => setTemplatesOpen((o) => !o)}
            aria-expanded={templatesOpen}
            aria-label={templatesOpen ? 'Ocultar plantillas' : 'Mostrar plantillas'}
          >
            <Zap className="size-3" />
            Plantillas
          </Button>
          {templatesOpen && (
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {QUICK_TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDraft(t)}
                  className="h-7 shrink-0 rounded-full border border-[var(--line)] bg-[var(--mist)] px-2.5 text-[11px] text-[var(--ink)] transition-ui hover:border-[var(--red)]"
                >
                  {t.length > 36 ? `${t.slice(0, 35)}…` : t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 px-5 pt-2 sm:px-6">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe como el bot… (Enter envía, Shift+Enter nueva línea)"
            rows={1}
            className="min-h-[46px] max-h-[160px] flex-1 resize-y rounded-md border-[var(--line)] py-2.5 text-[15px] shadow-none focus-visible:ring-[var(--red)]"
            disabled={sending}
          />
          <Button
            type="submit"
            className="mb-0.5 h-11 shrink-0 self-end rounded-md bg-[var(--red)] px-5 font-semibold text-white hover:bg-[var(--crimson)]"
            disabled={sending || !draft.trim()}
          >
            Enviar
          </Button>
        </div>

        <p className="px-5 pt-1.5 pb-3 text-xs text-[var(--muted)] sm:px-6">
          Al enviar, la IA se pausa y tu mensaje llega por el mismo bot.
        </p>
      </form>
    </div>
  )
}
