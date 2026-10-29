import { Activity, Flame, HandHelping, Timer } from 'lucide-react'
import type { Metrics } from '@/types'
import { cn } from '@/lib/utils'

interface MiniKpiStripProps {
  metrics: Metrics
  needsAdvisor: number
  onOpenMetrics: () => void
}

function formatLatencySeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

export function MiniKpiStrip({ metrics, needsAdvisor, onOpenMetrics }: MiniKpiStripProps) {
  const pills = [
    {
      key: 'active',
      label: 'Activas',
      value: String(metrics.active),
      icon: Activity,
      danger: false,
    },
    {
      key: 'advisor',
      label: 'Requieren asesor',
      value: String(needsAdvisor),
      icon: HandHelping,
      danger: needsAdvisor > 0,
    },
    {
      key: 'hot',
      label: 'Calientes',
      value: String(metrics.hotLeads),
      icon: Flame,
      danger: false,
    },
    {
      key: 'latency',
      label: 'Latencia',
      value: formatLatencySeconds(metrics.avgLatencyMs),
      icon: Timer,
      danger: false,
    },
  ] as const

  return (
    <button
      type="button"
      onClick={onOpenMetrics}
      aria-label="Ver métricas completas"
      className="flex h-8 w-full items-center gap-1.5 overflow-x-auto border-b border-white/10 bg-[rgba(10,42,94,0.72)] px-3 transition-ui hover:bg-[rgba(10,42,94,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:px-6"
    >
      {pills.map((p) => {
        const Icon = p.icon
        return (
          <span
            key={p.key}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums',
              p.danger
                ? 'border-red-300/50 bg-red-500/25 text-red-50'
                : 'border-white/15 bg-white/10 text-white/90',
            )}
          >
            <Icon className="size-3 opacity-80" aria-hidden />
            <span className="text-white/70">{p.label}</span>
            <span className="font-semibold">{p.value}</span>
          </span>
        )
      })}
    </button>
  )
}
