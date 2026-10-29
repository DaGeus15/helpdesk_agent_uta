import { useState, type ReactNode } from 'react'
import { BarChart3, BookOpen, LogOut, Menu, MessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export type DashboardView = 'conversations' | 'metrics' | 'courses'

interface HeaderProps {
  isLive: boolean
  view: DashboardView
  onViewChange: (view: DashboardView) => void
  /** Tira compacta de KPIs (solo vista Conversaciones). */
  kpiStrip?: ReactNode
}

export function Header({ isLive, view, onViewChange, kpiStrip }: HeaderProps) {
  const { username, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  function selectView(next: DashboardView) {
    onViewChange(next)
    setMenuOpen(false)
  }

  return (
    <header className="relative z-30 w-full shrink-0 border-b border-white/10 bg-[rgba(10,42,94,0.88)] text-white shadow-[0_8px_24px_rgba(10,42,94,0.18)] backdrop-blur-xl">
      <div className="relative flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-[10px] font-bold tracking-wide shadow-inner">
            CA
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              CTT-FISEI · Talleres Tecnológicos UTA
            </p>
          </div>
          <span
            className={cn(
              'ml-1 hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex',
              isLive
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                : 'border-white/20 bg-white/10 text-white/70',
            )}
            title={isLive ? 'Canal Realtime suscrito' : 'Sin suscripción en vivo'}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                isLive ? 'live-dot bg-emerald-400' : 'bg-white/40',
              )}
            />
            En vivo
          </span>
        </div>

        <nav
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-xl bg-white/10 p-1 md:flex"
          aria-label="Vistas del panel"
        >
          <ViewTab
            active={view === 'conversations'}
            onClick={() => selectView('conversations')}
            icon={<MessageSquare className="size-3.5" />}
            label="Conversaciones"
          />
          <ViewTab
            active={view === 'metrics'}
            onClick={() => selectView('metrics')}
            icon={<BarChart3 className="size-3.5" />}
            label="Métricas"
          />
          <ViewTab
            active={view === 'courses'}
            onClick={() => selectView('courses')}
            icon={<BookOpen className="size-3.5" />}
            label="Cursos"
          />
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:hidden',
              isLive
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                : 'border-white/20 bg-white/10 text-white/70',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                isLive ? 'live-dot bg-emerald-400' : 'bg-white/40',
              )}
            />
            En vivo
          </span>
          {username && (
            <span className="hidden max-w-[100px] truncate text-xs text-white/90 sm:inline sm:max-w-[160px]">
              {username}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={logout}
            aria-label="Cerrar sesión"
            className="hidden h-8 rounded-xl border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            className="h-8 w-8 rounded-xl border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white md:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-white/10 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            <MobileNavItem
              active={view === 'conversations'}
              onClick={() => selectView('conversations')}
              icon={<MessageSquare className="size-4" />}
              label="Conversaciones"
            />
            <MobileNavItem
              active={view === 'metrics'}
              onClick={() => selectView('metrics')}
              icon={<BarChart3 className="size-4" />}
              label="Métricas"
            />
            <MobileNavItem
              active={view === 'courses'}
              onClick={() => selectView('courses')}
              icon={<BookOpen className="size-4" />}
              label="Cursos"
            />
            <button
              type="button"
              onClick={logout}
              className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/85 transition-ui hover:bg-white/10"
            >
              <LogOut className="size-4" />
              Cerrar sesión
              {username ? (
                <span className="ml-auto truncate text-xs text-white/60">{username}</span>
              ) : null}
            </button>
          </div>
        </div>
      )}

      {kpiStrip}
    </header>
  )
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
        active
          ? 'bg-white text-[var(--uta-primary)] shadow-sm'
          : 'text-white/80 hover:bg-white/10 hover:text-white',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      {label}
    </button>
  )
}

function MobileNavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-ui',
        active
          ? 'bg-white/15 font-medium text-white'
          : 'text-white/80 hover:bg-white/10',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      {label}
    </button>
  )
}
