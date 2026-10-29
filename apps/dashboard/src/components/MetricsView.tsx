import {
  Activity,
  Flame,
  HandHelping,
  ShieldAlert,
  Timer,
  Zap,
} from 'lucide-react'
import { needsAdvisor } from '@/components/ConversationCard'
import { LEAD_STATE_META, getLeadStateMeta } from '@/lib/lead-state'
import type { ConversationWithPreview } from '@/hooks/useConversations'
import type { LeadState, Metrics } from '@/types'
import { cn, formatRelativeTime } from '@/lib/utils'

interface MetricsViewProps {
  metrics: Metrics
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
  icon: Icon,
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
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--uta-hairline)] bg-white px-4 py-3.5 shadow-[var(--uta-shadow-soft)] transition-ui hover:-translate-y-px hover:shadow-[var(--uta-shadow-lift)]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--uta-primary-soft)] text-[var(--uta-primary-mid)]">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-2xl font-semibold tracking-tight tabular-nums text-[var(--uta-text)]">
          {value}
        </p>
        <p className="text-xs text-[var(--uta-text-muted)]">{label}</p>
      </div>
    </div>
  )
}

export function MetricsView({
  metrics,
  conversations,
  onSelectConversation,
}: MetricsViewProps) {
  const totalStates = STATES.reduce((sum, s) => sum + (metrics.byState[s] ?? 0), 0) || 1
  const hot = conversations.filter((c) => c.lead_state === 'lead_caliente')
  const advisor = conversations.filter(needsAdvisor)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--uta-primary)] sm:text-xl">
            Métricas
          </h2>
          <p className="mt-1 text-sm text-[var(--uta-text-muted)]">
            Panorama en vivo del panel de conversaciones
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Activas"
            value={metrics.active}
            icon={Activity}
            title="Conversaciones con actividad reciente"
          />
          <MetricCard
            label="Calientes"
            value={metrics.hotLeads}
            icon={Flame}
            title="Leads en estado caliente listos para cierre"
          />
          <MetricCard
            label="Handovers"
            value={metrics.handovers}
            icon={HandHelping}
            title="Conversaciones con IA pausada / control humano"
          />
          <MetricCard
            label="Injections"
            value={metrics.injectionAttempts}
            icon={ShieldAlert}
            title="Intentos de prompt injection detectados"
          />
          <MetricCard
            label="Latencia"
            value={formatLatencySeconds(metrics.avgLatencyMs)}
            icon={Timer}
            title={`Latencia media del LLM: ${Math.round(metrics.avgLatencyMs)} ms`}
          />
          <MetricCard
            label="Tokens"
            value={formatTokens(metrics.tokensTotal)}
            icon={Zap}
            title="Tokens totales consumidos en inferencias"
          />
        </div>

        <div className="rounded-2xl border border-[var(--uta-hairline)] bg-white p-4 shadow-[var(--uta-shadow-soft)] sm:p-5">
          <p className="mb-3 text-sm font-medium text-[var(--uta-text)]">
            Distribución por estado
          </p>
          <div className="flex h-4 overflow-hidden rounded-full bg-[var(--uta-primary-soft)]">
            {STATES.map((state) => {
              const meta = LEAD_STATE_META[state]
              const count = metrics.byState[state] ?? 0
              const pct = (count / totalStates) * 100
              if (count === 0) return null
              return (
                <div
                  key={state}
                  className={cn('h-full transition-ui', meta.bar)}
                  style={{ width: `${pct}%` }}
                  title={`${meta.label}: ${count} (${Math.round(pct)}%)`}
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
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--uta-hairline)] bg-[var(--uta-bg)] px-3 py-1.5 text-xs text-[var(--uta-text)]"
                >
                  <span className={cn('size-2 rounded-full', meta.dot)} />
                  <span className="font-medium">{meta.label}</span>
                  <span className="tabular-nums text-[var(--uta-text-muted)]">
                    {count} · {pct}%
                  </span>
                </span>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
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
    <div className="rounded-2xl border border-[var(--uta-hairline)] bg-white p-4 shadow-[var(--uta-shadow-soft)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--uta-text)]">{title}</h3>
        <span className="rounded-full bg-[var(--uta-primary-soft)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--uta-primary)]">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--uta-text-muted)]">{empty}</p>
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
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(30,79,163,0.35)]',
                    alert
                      ? 'border-red-200/80 bg-red-50/60 hover:bg-red-50'
                      : 'border-[var(--uta-hairline)] bg-[var(--uta-bg)] hover:bg-[var(--uta-primary-soft)]',
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', meta.dot)} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--uta-text)]">
                    {name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-[var(--uta-text-muted)]">
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
