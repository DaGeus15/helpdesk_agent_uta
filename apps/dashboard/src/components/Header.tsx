import type { Metrics } from '@/types'
import { MetricsBar } from '@/components/MetricsBar'
import { cn } from '@/lib/utils'

interface HeaderProps {
  metrics: Metrics
  isLive: boolean
}

export function Header({ metrics, isLive }: HeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-indigo-700">
            CodeAndes · Panel de mando
          </h1>
          <p className="text-xs text-muted-foreground">Supervisión de conversaciones en vivo</p>
        </div>
        <span
          className={cn(
            'mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
            isLive
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-border bg-muted text-muted-foreground',
          )}
          title={isLive ? 'Canal Realtime suscrito' : 'Sin suscripción en vivo'}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              isLive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50',
            )}
          />
          En vivo
        </span>
      </div>
      <MetricsBar metrics={metrics} />
    </header>
  )
}
