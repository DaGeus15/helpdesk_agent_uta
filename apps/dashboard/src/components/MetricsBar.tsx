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

interface MetricsBarProps {
  metrics: Metrics
}

const STATES: LeadState[] = ['interesado', 'dudoso', 'frustrado', 'lead_caliente']

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof Activity
}) {
  return (
    <div className="flex min-w-[120px] flex-1 items-center gap-3 rounded-lg border border-[var(--uta-border)] bg-white px-3 py-2.5 shadow-sm transition-ui">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--uta-primary-soft)] text-[var(--uta-primary-mid)]">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-lg font-semibold tabular-nums text-[var(--uta-text)]">{value}</p>
        <p className="text-[11px] text-[var(--uta-text-muted)]">{label}</p>
      </div>
    </div>
  )
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  const totalStates = STATES.reduce((sum, s) => sum + (metrics.byState[s] ?? 0), 0) || 1

  return (
    <div className="space-y-3 border-b border-[var(--uta-border)] bg-[var(--uta-bg)] px-4 py-3 sm:px-6">
      <div className="flex flex-wrap gap-2">
        <MetricCard label="Activas" value={metrics.active} icon={Activity} />
        <MetricCard label="Calientes" value={metrics.hotLeads} icon={Flame} />
        <MetricCard label="Handovers" value={metrics.handovers} icon={HandHelping} />
        <MetricCard label="Injections" value={metrics.injectionAttempts} icon={ShieldAlert} />
        <MetricCard
          label="Latencia"
          value={`${Math.round(metrics.avgLatencyMs)} ms`}
          icon={Timer}
        />
        <MetricCard
          label="Tokens"
          value={metrics.tokensTotal.toLocaleString('es-EC')}
          icon={Zap}
        />
      </div>

      <div className="rounded-lg border border-[var(--uta-border)] bg-white px-3 py-2.5 shadow-sm">
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
                >
                  <span className={cn('size-1.5 rounded-full', meta.dot)} />
                  {meta.label}
                  <span className="tabular-nums font-medium text-[var(--uta-text)]">
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
