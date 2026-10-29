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
  ClipboardList,
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
import type { HandoverEvent, LeadProfile, Message } from '@/types'

interface ChatViewProps {
  conversation: ConversationWithPreview
  messages: Message[]
  handoverEvents: HandoverEvent[]
  bottomRef: RefObject<HTMLDivElement | null>
  onOptimisticSend: (text: string, clientId: string) => void
  onOptimisticFailed: (clientId: string) => void
  onServerMessage: (message: Message) => void
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

const HANDOVER_REASON_LABELS: Record<string, string> = {
  frustration: 'Frustración',
  user_request: 'Pidió un asesor',
  operator_takeover: 'Intervención del operador',
  operator_message: 'Mensaje del operador',
  operator_release: 'Operador liberó el control',
}

function handoverReasonLabel(reason: string): string {
  return HANDOVER_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')
}

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
    <div className={cn('flex gap-1 overflow-x-auto whitespace-nowrap', className)}>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex shrink-0 items-center gap-1 rounded bg-white/95 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[var(--navy)] uppercase"
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
          <strong className="font-semibold text-[var(--ink)]">{match}:</strong>
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
  sameRoleAsPrev,
  onRetry,
}: {
  message: Message
  animate: boolean
  sameRoleAsPrev: boolean
  onRetry?: (message: Message) => void
}) {
  const isUser = message.role === 'user'
  const isOperator = message.role === 'operator'
  const isAssistant = message.role === 'assistant'
  const discarded = message.intent === 'descartada_por_handover'
  const failed = message.delivery_status === 'failed'
  const pending = message.delivery_status === 'pending'

  return (
    <div
      className={cn(
        'max-w-[85%] rounded-[10px] px-3 py-2.5 text-[14px] leading-snug text-[var(--ink)] whitespace-pre-wrap break-words sm:max-w-[62%]',
        sameRoleAsPrev ? 'mt-1' : 'mt-2.5',
        isUser && 'rounded-bl-sm bg-[var(--mist)]',
        (isAssistant || isOperator) && 'ml-auto rounded-br-sm border border-[var(--line)]',
        isOperator &&
          !failed &&
          'border-[color-mix(in_srgb,var(--operator)_45%,var(--line))] bg-[color-mix(in_srgb,var(--operator)_7%,white)]',
        failed &&
          'border-[color-mix(in_srgb,var(--critical)_45%,var(--line))] bg-[color-mix(in_srgb,var(--critical)_8%,white)]',
        discarded && 'opacity-55',
        animate && 'bubble-enter',
      )}
    >
      {(message.source === 'voice' || message.flagged_injection || discarded) && (
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
          {discarded && (
            <span className="rounded bg-[var(--mist)] px-1.5 text-[10px] text-[var(--muted)]">
              Respuesta de la IA descartada (tomaste el control)
            </span>
          )}
        </div>
      )}
      <p className={cn(discarded && 'line-through decoration-[var(--muted)]')}>
        {linkify(message.content)}
      </p>
      <small className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted)]">
        {pending && !failed ? (
          <span className="text-[var(--muted)]">enviando…</span>
        ) : failed ? (
          <button
            type="button"
            className="font-medium text-[var(--critical)] underline-offset-2 hover:underline"
            onClick={() => onRetry?.(message)}
          >
            No se pudo enviar · Reintentar
          </button>
        ) : (
          messageMeta(message)
        )}
      </small>
    </div>
  )
}

function SystemSeparator({ label }: { label: string }) {
  return (
    <p className="my-2.5 text-center text-[11px] text-[var(--muted)]">{label}</p>
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
  | { type: 'msg'; key: string; message: Message; index: number; sameRoleAsPrev: boolean }

export function ChatView({
  conversation,
  messages,
  handoverEvents,
  bottomRef,
  onOptimisticSend,
  onOptimisticFailed,
  onServerMessage,
  onBack,
  className,
}: ChatViewProps) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [takingOver, setTakingOver] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [regeneratingSummary, setRegeneratingSummary] = useState(false)
  const [advisorSummary, setAdvisorSummary] = useState<string | null | undefined>(undefined)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(true)
  const [stickToBottom, setStickToBottom] = useState(true)
  const [newBelow, setNewBelow] = useState(0)
  const [animateFrom, setAnimateFrom] = useState<number | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const summaryPanelRef = useRef<HTMLDivElement | null>(null)
  const summaryBtnRef = useRef<HTMLButtonElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const prevCountRef = useRef(0)
  const convIdRef = useRef(conversation.id)
  const pendingClientIdRef = useRef<string | null>(null)

  const meta = getLeadStateMeta(conversation.lead_state)
  const name = conversation.display_name ?? conversation.telegram_username ?? 'Sin nombre'
  const chips = profileChips(conversation.profile)
  const summaryMissing = advisorSummary === null
  const summaryText =
    advisorSummary === undefined
      ? conversation.summary || null
      : advisorSummary
  const humanMode = conversation.ai_paused

  const items = useMemo(() => {
    const out: TimelineItem[] = []
    let lastDay = ''
    let prevRole: Message['role'] | null = null

    type Raw =
      | { kind: 'msg'; at: number; message: Message; index: number }
      | { kind: 'event'; at: number; event: HandoverEvent }

    const raw: Raw[] = [
      ...messages.map((message, index) => ({
        kind: 'msg' as const,
        at: new Date(message.created_at).getTime(),
        message,
        index,
      })),
      ...handoverEvents.map((event) => ({
        kind: 'event' as const,
        at: new Date(event.created_at).getTime(),
        event,
      })),
    ].sort((a, b) => a.at - b.at || (a.kind === 'event' ? -1 : 1))

    for (const entry of raw) {
      const iso =
        entry.kind === 'msg' ? entry.message.created_at : entry.event.created_at
      const dk = dayKey(iso)
      if (dk !== lastDay) {
        lastDay = dk
        out.push({ type: 'day', key: `day-${dk}`, label: dayLabel(iso) })
        prevRole = null
      }

      if (entry.kind === 'event') {
        const time = formatClockTime(entry.event.created_at)
        const label =
          entry.event.type === 'paused'
            ? `— IA en pausa · ${handoverReasonLabel(entry.event.reason)} · ${time} —`
            : `— IA reanudada · ${time} —`
        out.push({
          type: 'system',
          key: `handover-${entry.event.id}`,
          label,
        })
        continue
      }

      const sameRoleAsPrev = prevRole === entry.message.role
      out.push({
        type: 'msg',
        key: entry.message.id,
        message: entry.message,
        index: entry.index,
        sameRoleAsPrev,
      })
      prevRole = entry.message.role
    }
    return out
  }, [messages, handoverEvents])

  useEffect(() => {
    setDraft('')
    setAdvisorSummary(undefined)
    setSummaryOpen(false)
    setTemplatesOpen(true)
    setStickToBottom(true)
    setNewBelow(0)
    setAnimateFrom(null)
    prevCountRef.current = 0
    convIdRef.current = conversation.id
    pendingClientIdRef.current = null
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
      const panel = summaryPanelRef.current
      const btn = summaryBtnRef.current
      const target = e.target as Node
      if (panel?.contains(target) || btn?.contains(target)) return
      setSummaryOpen(false)
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
    const next = Math.min(Math.max(el.scrollHeight, 44), 160)
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
      toast.success('Control tomado', {
        description: res.summary
          ? 'La IA quedó en pausa'
          : 'La IA quedó en pausa; el resumen no se generó',
      })
    } catch (err) {
      toast.error('No se pudo tomar control', { description: errorMessage(err) })
    } finally {
      setTakingOver(false)
    }
  }

  async function handleRegenerateSummary() {
    setRegeneratingSummary(true)
    try {
      const res = await api.getSummary(conversation.id)
      setAdvisorSummary(res.summary)
      setSummaryOpen(true)
      toast.success('Resumen actualizado')
    } catch (err) {
      toast.error('No se pudo generar el resumen', { description: errorMessage(err) })
    } finally {
      setRegeneratingSummary(false)
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

  async function sendWithClientId(text: string, clientId: string) {
    pendingClientIdRef.current = clientId
    onOptimisticSend(text, clientId)
    setSending(true)
    try {
      const res = await api.sendMessage(conversation.id, text, clientId)
      onServerMessage(res.message)
      setDraft('')
      setStickToBottom(true)
    } catch (err) {
      onOptimisticFailed(clientId)
      if (!(err instanceof ApiError && err.isNetwork)) {
        toast.error('No se pudo enviar el mensaje', { description: errorMessage(err) })
      }
    } finally {
      pendingClientIdRef.current = null
      setSending(false)
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    const clientId = crypto.randomUUID()
    await sendWithClientId(text, clientId)
  }

  async function handleRetry(message: Message) {
    if (!message.client_id || sending) return
    await sendWithClientId(message.content, message.client_id)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-[var(--line)] bg-white',
        className,
      )}
    >
      {/* Cabecera compacta navy / carmesí (~88px máx) */}
      <div
        className={cn(
          'relative z-20 max-h-[88px] shrink-0 overflow-hidden px-4 py-2.5 text-white sm:px-5',
          humanMode ? 'bg-[var(--crimson)]' : 'bg-[var(--navy)]',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {onBack && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-white hover:bg-white/15 hover:text-white md:hidden"
                  onClick={onBack}
                  aria-label="Volver a conversaciones"
                >
                  <ArrowLeft className="size-4" />
                </Button>
              )}
              <h2 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                {name}
              </h2>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="rounded bg-white px-2 py-px text-[10px] font-bold tracking-wide text-[var(--navy)] uppercase">
                {meta.emoji} {meta.label}
              </span>
              <span
                className={cn(
                  'rounded bg-white px-2 py-px text-[10px] font-bold tracking-wide uppercase',
                  humanMode ? 'text-[var(--crimson)]' : 'text-[var(--navy)]',
                )}
              >
                {humanMode ? 'Operador' : 'IA'}
              </span>
              {conversation.injection_attempts > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded bg-white px-2 py-px text-[10px] font-bold tracking-wide text-[var(--crimson)] uppercase">
                  <ShieldAlert className="size-2.5" />
                  {conversation.injection_attempts}
                </span>
              )}
              {chips.length > 0 && (
                <ProfileChipsRow chips={chips.slice(0, 3)} className="ml-0.5" />
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <button
              ref={summaryBtnRef}
              type="button"
              onClick={() => setSummaryOpen((o) => !o)}
              aria-expanded={summaryOpen}
              aria-controls="advisor-summary-panel"
              className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-[var(--navy)] transition-ui hover:bg-white/90 focus-visible:outline-none"
            >
              <ClipboardList className="size-3.5" />
              Resumen
              <ChevronDown
                className={cn(
                  'size-3.5 transition-ui',
                  summaryOpen && 'rotate-180',
                )}
              />
            </button>

            {humanMode ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-not-allowed">
                      <button
                        type="button"
                        disabled
                        className="h-8 cursor-not-allowed rounded-md bg-white/70 px-3 text-xs font-semibold text-[var(--red)] opacity-60"
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
                  className="h-8 rounded-md bg-white px-3 text-xs font-semibold text-[var(--crimson)] transition-ui hover:bg-white/90 focus-visible:outline-none disabled:opacity-60"
                >
                  {releasing ? 'Devolviendo…' : 'Devolver a la IA'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleTakeover()}
                disabled={takingOver}
                className="h-8 rounded-md bg-white px-3 text-xs font-semibold text-[var(--red)] transition-ui hover:bg-white/90 focus-visible:outline-none disabled:opacity-60"
              >
                {takingOver ? 'Tomando…' : 'Tomar control'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {summaryOpen && (
          <div
            id="advisor-summary-panel"
            ref={summaryPanelRef}
            role="dialog"
            aria-label="Resumen para el asesor"
            className="absolute inset-x-0 top-0 z-20 max-h-[45%] overflow-y-auto border-b border-[var(--line)] bg-white px-4 py-3 shadow-[var(--uta-shadow-lift)] banner-enter sm:px-5"
          >
            {summaryMissing ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
                <p>No se pudo generar el resumen; puedes regenerarlo</p>
                <button
                  type="button"
                  onClick={() => void handleRegenerateSummary()}
                  disabled={regeneratingSummary}
                  className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {regeneratingSummary ? 'Generando…' : 'Regenerar resumen'}
                </button>
              </div>
            ) : summaryText ? (
              <div className="space-y-0.5 text-sm text-[var(--text)]">
                {renderSummaryText(summaryText)}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Aún no hay suficiente conversación para resumir.
              </p>
            )}
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full min-h-0 overflow-y-auto px-4 py-3 sm:px-5"
        >
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              Aún no hay mensajes en esta conversación.
            </p>
          ) : (
            items.map((item) => {
              if (item.type === 'day') {
                return (
                  <div key={item.key} className="my-1.5 flex items-center justify-center">
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
                  sameRoleAsPrev={item.sameRoleAsPrev}
                  onRetry={(m) => void handleRetry(m)}
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
        <div className="flex items-center gap-2 px-4 pt-2 sm:px-5">
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

        <div className="flex items-end gap-2 px-4 pt-1.5 pb-1 sm:px-5">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe como el bot… (Enter envía, Shift+Enter nueva línea)"
            rows={1}
            className="min-h-[44px] max-h-[160px] flex-1 resize-none rounded-md border-[var(--line)] py-2.5 text-[14px] shadow-none focus-visible:ring-[var(--red)]"
            disabled={sending}
          />
          <Button
            type="submit"
            className="h-11 shrink-0 self-end rounded-md bg-[var(--red)] px-5 font-semibold text-white hover:bg-[var(--crimson)]"
            disabled={sending || !draft.trim()}
          >
            Enviar
          </Button>
        </div>

        <p className="px-4 pb-2.5 text-[11px] text-[var(--muted)] sm:px-5">
          Al enviar, la IA se pausa y tu mensaje llega por el mismo bot.
        </p>
      </form>
    </div>
  )
}
