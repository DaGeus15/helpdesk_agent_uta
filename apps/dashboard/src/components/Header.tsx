import type { Metrics } from '@/types'
import { MetricsBar } from '@/components/MetricsBar'

interface HeaderProps {
  metrics: Metrics
}

export function Header({ metrics }: HeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-indigo-700">
          CodeAndes · Panel de mando
        </h1>
        <p className="text-xs text-muted-foreground">Supervisión de conversaciones en vivo</p>
      </div>
      <MetricsBar metrics={metrics} />
    </header>
  )
}
