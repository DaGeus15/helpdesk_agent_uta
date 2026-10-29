import { cn } from '@/lib/utils'

interface EmptyStateProps {
  className?: string
}

export function EmptyState({ className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-3 border border-[var(--line)] bg-white px-8 text-center',
        className,
      )}
    >
      <div className="max-w-[44ch]">
        <h2 className="mb-2 text-[22px] font-semibold text-[var(--ink)]">
          Elige una conversación
        </h2>
        <p className="text-sm text-[var(--text)]">
          Los mensajes llegan en tiempo real. Toma el control para pausar la IA y
          responder desde el mismo bot.
        </p>
      </div>
    </div>
  )
}
