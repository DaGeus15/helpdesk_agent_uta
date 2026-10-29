import {
  Activity,
  Flame,
  HandHelping,
  Cpu,
  ShieldAlert,
  Timer,
  Zap,
} from 'lucide-react'
import { needsAdvisor } from '@/components/ConversationCard'
import { useMetrics } from '@/hooks/useMetrics'
import { LEAD_STATE_META, getLeadStateMeta } from '@/lib/lead-state'
import type { ConversationWithPreview } from '@/hooks/useConversations'
import type { LeadState } from '@/types'
import { cn, formatRelativeTime } from '@/lib/utils'

interface MetricsViewProps {
  conversations: ConversationWithPreview[]
  onSelectConversation: (id: string) => void
}

const STATES: LeadState[] = ['interesado', 'dudoso', 'frustrado', 'lead_caliente']

function formatLatencySeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}

function formatTokens(n: number): string {
  return n.toLocaleString('es-EC')
}

function MetricCard({
  label,
  value,
  title,
}: {
  label: string
  value: string | number
  icon: typeof Activity
  title: string
}) {
  return (
    <div
      title={title}
      className="rounded-lg bg-[var(--mist)] px-4 py-4"
    >
      <span className="text-[13px] text-[var(--text)]">{label}</span>
      <strong className="mt-0.5 block text-[30px] font-bold tabular-nums text-[var(--ink)]">
        {value}
      </strong>
    </div>
  )
}

export function MetricsView({
  conversations,
  onSelectConversation,
}: MetricsViewProps) {
  const metrics = useMetrics(conversations)
  const totalStates = STATES.reduce((sum, s) => sum + (metrics.byState[s] ?? 0), 0) || 1
  const hot = conversations.filter((c) => c.lead_state === 'lead_caliente')
  const advisor = conversations.filter(needsAdvisor)
  const maxState = Math.max(...STATES.map((s) => metrics.byState[s] ?? 0), 1)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          <MetricCard
            label="Personas atendidas"
            value={metrics.active}
            icon={Activity}
            title="Conversaciones con actividad reciente"
          />
          <MetricCard
            label="Leads calientes"
            value={metrics.hotLeads}
            icon={Flame}
            title="Leads en estado caliente listos para cierre"
          />
          <MetricCard
            label="Derivaciones a humano"
            value={metrics.handovers}
            icon={HandHelping}
            title="Conversaciones con IA pausada / control humano"
          />
          <MetricCard
            label="Manipulaciones bloqueadas"
            value={metrics.injectionAttempts}
            icon={ShieldAlert}
            title="Intentos de prompt injection detectados"
          />
          <MetricCard
            label="Respuesta media"
            value={formatLatencySeconds(metrics.avgLatencyMs)}
            icon={Timer}
            title={`Latencia media del LLM: ${Math.round(metrics.avgLatencyMs)} ms`}
          />
          <MetricCard
            label="Tokens totales"
            value={formatTokens(metrics.tokensTotal)}
            icon={Zap}
            title="Tokens totales consumidos en inferencias"
          />
          <div
            title="Saltos de modelo de respaldo y respuestas 429 por cuota"
            className="rounded-lg bg-[var(--mist)] px-4 py-4 sm:col-span-2 xl:col-span-1 2xl:col-span-1"
          >
            <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text)]">
              <Cpu className="size-3.5 opacity-70" />
              LLM
            </span>
            <div className="mt-1.5 space-y-0.5">
              <p className="text-sm text-[var(--ink)]">
                <strong className="text-[22px] font-bold tabular-nums">
                  {metrics.llm?.fallbacks ?? 0}
                </strong>{' '}
                <span className="text-[var(--muted)]">saltos de respaldo</span>
              </p>
              <p className="text-sm text-[var(--ink)]">
                <strong className="text-[22px] font-bold tabular-nums">
                  {metrics.llm?.rateLimited ?? 0}
                </strong>{' '}
                <span className="text-[var(--muted)]">429 por modelo</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-[var(--line)] bg-white p-5">
            <header className="mb-3.5">
              <h2 className="text-base font-semibold text-[var(--navy)]">
                Termómetro de prospectos
              </h2>
            </header>
            <div className="space-y-3">
              {STATES.map((state) => {
                const meta = LEAD_STATE_META[state]
                const count = metrics.byState[state] ?? 0
                const pct = Math.round((count / totalStates) * 100)
                const width = `${Math.max((count / maxState) * 100, count > 0 ? 4 : 0)}%`
                return (
                  <div key={state} className="grid grid-cols-[140px_1fr_48px] items-center gap-3">
                    <span className="truncate text-sm text-[var(--ink)]">
                      {meta.emoji} {meta.label}
                    </span>
                    <div className="h-6 overflow-hidden rounded bg-[var(--mist)]">
                      <div
                        className="h-full rounded transition-ui"
                        style={{ width, background: meta.colorHex }}
                        title={`${meta.label}: ${count} (${pct}%)`}
                      />
                    </div>
                    <span className="text-right text-sm tabular-nums text-[var(--muted)]">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </article>

          <article className="rounded-lg border border-[var(--line)] bg-white p-5">
            <header className="mb-3.5">
              <h2 className="text-base font-semibold text-[var(--navy)]">
                Distribución por estado
              </h2>
            </header>
            <div className="flex h-4 overflow-hidden rounded-full bg-[var(--mist)]">
              {STATES.map((state) => {
                const meta = LEAD_STATE_META[state]
                const count = metrics.byState[state] ?? 0
                const pct = (count / totalStates) * 100
                if (count === 0) return null
                return (
                  <div
                    key={state}
                    className="h-full transition-ui"
                    style={{ width: `${pct}%`, background: meta.colorHex }}
                    title={`${meta.label}: ${count}`}
                  />
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {STATES.map((state) => {
                const meta = LEAD_STATE_META[state]
                const count = metrics.byState[state] ?? 0
                const pct = Math.round((count / totalStates) * 100)
                return (
                  <span
                    key={state}
                    className="inline-flex items-center gap-2 text-[13px] text-[var(--ink)]"
                  >
                    <i
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: meta.colorHex }}
                    />
                    {meta.label}
                    <span className="tabular-nums text-[var(--muted)]">
                      {count} · {pct}%
                    </span>
                  </span>
                )
              })}
            </div>
          </article>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <LeadList
            title="Leads calientes"
            empty="No hay leads calientes ahora."
            items={hot}
            onSelect={onSelectConversation}
          />
          <LeadList
            title="Requieren asesor"
            empty="Ninguna conversación requiere asesor."
            items={advisor}
            onSelect={onSelectConversation}
            alert
          />
        </div>
      </div>
    </div>
  )
}

function LeadList({
  title,
  empty,
  items,
  onSelect,
  alert,
}: {
  title: string
  empty: string
  items: ConversationWithPreview[]
  onSelect: (id: string) => void
  alert?: boolean
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-5">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--navy)]">{title}</h3>
        <span className="rounded-full bg-[var(--mist)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--ink)]">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto">
          {items.map((c) => {
            const name = c.display_name ?? c.telegram_username ?? 'Sin nombre'
            const meta = getLeadStateMeta(c.lead_state)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-ui focus-visible:outline-none',
                    alert
                      ? 'border-[color-mix(in_srgb,var(--critical)_30%,var(--line))] bg-[color-mix(in_srgb,var(--critical)_6%,white)] hover:bg-[color-mix(in_srgb,var(--critical)_10%,white)]'
                      : 'border-[var(--line)] bg-[var(--mist)] hover:bg-[color-mix(in_srgb,var(--navy)_6%,white)]',
                  )}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: meta.colorHex }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
                    {name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
                    {formatRelativeTime(c.last_message_at)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
