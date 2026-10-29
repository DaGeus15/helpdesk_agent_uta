import { MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  className?: string
}

export function EmptyState({ className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-4 px-6 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-[var(--uta-primary-soft)] p-5 text-[var(--uta-primary)]">
        <MessagesSquare className="size-10" strokeWidth={1.5} />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h2 className="text-base font-semibold text-[var(--uta-text)]">
          Selecciona una conversación
        </h2>
        <p className="text-sm text-[var(--uta-text-muted)]">
          Elige un chat de la lista para ver el historial, el termómetro del lead y tomar el
          control cuando haga falta.
        </p>
      </div>
    </div>
  )
}
