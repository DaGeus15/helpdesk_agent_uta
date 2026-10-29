import {
  Activity,
  Flame,
  HandHelping,
  ShieldAlert,
  Timer,
  Zap,
} from 'lucide-react'
import { LEAD_STATE_META } from '@/lib/lead-state'
import type { LeadState, Metrics } from '@/types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface MetricsBarProps {
  metrics: Metrics
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
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          title={title}
          className="flex min-w-[120px] flex-1 cursor-default items-center gap-3 rounded-2xl border border-[var(--uta-hairline)] bg-white px-3 py-2.5 shadow-[var(--uta-shadow-soft)] transition-ui hover:-translate-y-px hover:shadow-[var(--uta-shadow-lift)]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--uta-primary-soft)] text-[var(--uta-primary-mid)]">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-2xl font-semibold tracking-tight tabular-nums text-[var(--uta-text)]">
              {value}
            </p>
            <p className="text-[11px] text-[var(--uta-text-muted)]">{label}</p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{title}</TooltipContent>
    </Tooltip>
  )
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  const totalStates = STATES.reduce((sum, s) => sum + (metrics.byState[s] ?? 0), 0) || 1
  const latency = formatLatencySeconds(metrics.avgLatencyMs)
  const tokens = formatTokens(metrics.tokensTotal)

  return (
    <div className="space-y-3 border-b border-[var(--uta-hairline)] bg-[var(--uta-bg)]/80 px-4 py-3 backdrop-blur-sm sm:px-6">
      <div className="flex flex-wrap gap-2">
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
          value={latency}
          icon={Timer}
          title={`Latencia media del LLM: ${Math.round(metrics.avgLatencyMs)} ms`}
        />
        <MetricCard
          label="Tokens"
          value={tokens}
          icon={Zap}
          title="Tokens totales consumidos en inferencias"
        />
      </div>

      <div className="rounded-2xl border border-[var(--uta-hairline)] bg-white px-3 py-2.5 shadow-[var(--uta-shadow-soft)]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[var(--uta-text-muted)]">
            Distribución por estado
          </p>
          <div className="flex flex-wrap gap-2">
            {STATES.map((state) => {
              const meta = LEAD_STATE_META[state]
              return (
                <span
                  key={state}
                  className="inline-flex items-center gap-1 text-[10px] text-[var(--uta-text-muted)]"
                  title={`${meta.label}: ${metrics.byState[state] ?? 0}`}
                >
                  <span className={cn('size-1.5 rounded-full', meta.dot)} />
                  {meta.label}
                  <span className="font-medium tabular-nums text-[var(--uta-text)]">
                    {metrics.byState[state] ?? 0}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-[var(--uta-primary-soft)]">
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
                title={`${meta.label}: ${count}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
