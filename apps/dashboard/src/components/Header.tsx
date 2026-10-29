import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface HeaderProps {
  isLive: boolean
}

export function Header({ isLive }: HeaderProps) {
  const { username, logout } = useAuth()

  return (
    <header className="flex w-full items-center justify-between gap-3 bg-[var(--uta-primary)] px-4 py-3 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold tracking-wide">
          CA
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight sm:text-base">
            CodeAndes Academy
          </p>
          <p className="text-[11px] text-white/70">Panel de mando</p>
        </div>
        <span
          className={cn(
            'ml-1 hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:inline-flex',
            isLive
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
              : 'border-white/20 bg-white/10 text-white/70',
          )}
          title={isLive ? 'Canal Realtime suscrito' : 'Sin suscripción en vivo'}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              isLive ? 'animate-pulse bg-emerald-400' : 'bg-white/40',
            )}
          />
          En vivo
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:hidden',
            isLive
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
              : 'border-white/20 bg-white/10 text-white/70',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              isLive ? 'animate-pulse bg-emerald-400' : 'bg-white/40',
            )}
          />
          En vivo
        </span>
        {username && (
          <span className="max-w-[100px] truncate text-xs text-white/90 sm:max-w-[160px] sm:text-sm">
            {username}
          </span>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={logout}
          className="h-8 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </Button>
      </div>
    </header>
  )
}
