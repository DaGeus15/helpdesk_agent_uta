import { LEAD_STATE_META } from '@/lib/lead-state'
import type { LeadState, Metrics } from '@/types'
import { cn } from '@/lib/utils'

interface MetricsBarProps {
  metrics: Metrics
}

const STATES: LeadState[] = ['interesado', 'dudoso', 'frustrado', 'lead_caliente']

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  )
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Stat label="Activas" value={metrics.active} />

      <div className="flex flex-wrap items-center gap-1.5">
        {STATES.map((state) => {
          const meta = LEAD_STATE_META[state]
          return (
            <span
              key={state}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
                meta.bg,
              )}
              title={meta.label}
            >
              <span className={cn('size-1.5 rounded-full', meta.dot)} />
              <span className="tabular-nums">{metrics.byState[state] ?? 0}</span>
            </span>
          )
        })}
      </div>

      <Stat label="Calientes" value={metrics.hotLeads} />
      <Stat label="Handovers" value={metrics.handovers} />
      <Stat label="Injections" value={metrics.injectionAttempts} />
      <Stat label="Latencia" value={`${Math.round(metrics.avgLatencyMs)} ms`} />
      <Stat label="Tokens" value={metrics.tokensTotal.toLocaleString('es-EC')} />
    </div>
  )
}
