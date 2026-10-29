import type { Metrics } from '@/types'

interface MetricsBarProps {
  metrics: Metrics
}

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
      <Stat label="Leads calientes" value={metrics.hotLeads} />
      <Stat label="Handovers" value={metrics.handovers} />
      <Stat label="Injections" value={metrics.injectionAttempts} />
      <Stat label="Latencia" value={`${metrics.avgLatencyMs} ms`} />
    </div>
  )
}
