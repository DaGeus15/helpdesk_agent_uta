import { MessagesSquare } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-indigo-50 p-4 text-indigo-600">
        <MessagesSquare className="size-8" />
      </div>
      <div className="max-w-sm space-y-1">
        <h2 className="text-base font-semibold text-foreground">Selecciona una conversación</h2>
        <p className="text-sm text-muted-foreground">
          Elige un chat de la izquierda para ver el historial, el termómetro del lead y tomar el
          control cuando haga falta.
        </p>
      </div>
    </div>
  )
}
