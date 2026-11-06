import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { GraduationCap, LogOut, Menu, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel } from '@/components/ResponsivePanel'
import { useAuth } from '@/hooks/useAuth'
import { useCourses } from '@/hooks/useCourses'
import { api, type CatalogSyncStatus } from '@/lib/api'
import { TELEGRAM_BOT_URL } from '@/lib/courses'
import { cn } from '@/lib/utils'

export type DashboardView = 'conversations' | 'metrics' | 'courses'

const TELEGRAM_HANDLE = '@HelpdeskUTA15Bot'

interface HeaderProps {
  isLive: boolean
  view: DashboardView
  onViewChange: (view: DashboardView) => void
  attentionCount?: number
  /** @deprecated KPI strip removido; se mantiene por compatibilidad de props. */
  kpiStrip?: ReactNode
}

function formatSyncClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Header({
  isLive,
  view,
  onViewChange,
  attentionCount = 0,
}: HeaderProps) {
  const { username, logout } = useAuth()
  const { courses } = useCourses()
  const [menuOpen, setMenuOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<CatalogSyncStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .getCatalogStatus()
      .then((status) => {
        if (!cancelled) setSyncStatus(status)
      })
      .catch(() => {
        /* panel usable sin API */
      })
    return () => {
      cancelled = true
    }
  }, [view])

  const openCourses = useMemo(
    () => courses.filter((c) => c.status === 'inscripciones_abiertas').length,
    [courses],
  )
  const published = syncStatus?.lastRun?.total ?? courses.length
  const syncedAt =
    syncStatus?.lastRun?.finished_at ?? syncStatus?.lastRun?.started_at ?? null

  function selectView(next: DashboardView) {
    onViewChange(next)
    setMenuOpen(false)
  }

  return (
    <header className="dashboard-header relative z-30 w-full shrink-0 bg-white">
      {/* Placa superior blanca con logo CTT */}
      <div className="border-b border-[#e6e4ec] bg-white">
        <div className="header-row flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a
            href="https://ctt-talleresfisei.uta.edu.ec/"
            target="_blank"
            rel="noopener noreferrer"
            className="header-logo shrink-0 focus-visible:outline-none"
          >
            <img
              src="/logo-ctt.png"
              alt="FISEI · CTT Talleres Tecnológicos"
              className="block h-12 w-auto"
              width={220}
              height={91}
            />
          </a>

          <div className="header-tools flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-6 gap-y-3 sm:gap-x-8">
            <div className="header-channels flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Estado de los canales">
              <ChannelStatus
                icon={<Send className="size-5" />}
                color="var(--telegram)"
                title="Telegram"
                subtitle={
                  <a
                    href={TELEGRAM_BOT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--red)] underline-offset-2 hover:underline"
                  >
                    {TELEGRAM_HANDLE}
                  </a>
                }
                ok
              />
              <ChannelStatus
                icon={<GraduationCap className="size-5" />}
                color="var(--navy)"
                title={
                  openCourses === 1
                    ? '1 curso con inscripción vigente'
                    : `${openCourses} cursos con inscripción vigente`
                }
                subtitle={
                  <span>
                    de {published} publicados · sincronizado {formatSyncClock(syncedAt)}
                  </span>
                }
                ok={openCourses > 0}
              />
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              {username ? (
                <span className="max-w-[140px] truncate text-sm font-medium text-[var(--ink)]">
                  {username}
                </span>
              ) : null}
              <button
                type="button"
                onClick={logout}
                className="text-[13px] font-semibold text-[var(--red)] underline underline-offset-[3px] focus-visible:outline-none"
              >
                Cerrar sesión
              </button>
            </div>

            <span className="mobile-live-dot md:hidden" role="status" aria-label={isLive ? 'En vivo' : 'Sin conexión'} title={isLive ? 'En vivo' : 'Sin conexión'}
              style={{ backgroundColor: isLive ? 'var(--good)' : 'var(--muted)' }} />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              aria-controls="dashboard-menu"
              className="h-11 w-11 rounded-md border-[var(--line)] text-[var(--ink)] lg:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Barra de pestañas */}
      <nav className="hidden border-b border-[var(--line)] bg-white md:block" aria-label="Secciones">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-1.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1" role="tablist">
            <TabButton
              active={view === 'conversations'}
              onClick={() => selectView('conversations')}
              badge={attentionCount > 0 ? attentionCount : undefined}
            >
              Bandeja en vivo
            </TabButton>
            <TabButton
              active={view === 'metrics'}
              onClick={() => selectView('metrics')}
            >
              Métricas
            </TabButton>
            <TabButton
              active={view === 'courses'}
              onClick={() => selectView('courses')}
            >
              Cursos
            </TabButton>
            <span
              className={cn(
                'hidden items-center text-[13px] sm:inline-flex',
                isLive ? 'live-pulse text-[var(--good)]' : 'text-[var(--muted)]',
              )}
              title={isLive ? 'Canal Realtime suscrito' : 'Sin suscripción en vivo'}
            >
              {isLive ? 'En vivo' : 'Sin conexión'}
            </span>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <ResponsivePanel id="dashboard-menu" label="Menú del operador" media="(max-width: 1023px)"
          onClose={() => setMenuOpen(false)} className="header-menu-panel lg:hidden"
          backdropClassName="header-menu-backdrop lg:hidden">
          <div className="flex items-center justify-between gap-3 pb-3">
            <strong className="min-w-0 truncate text-[var(--navy)]">{username || 'Operador'}</strong>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="grid size-11 shrink-0 place-items-center rounded-md text-[var(--navy)]"><X className="size-5" /></button>
          </div>
          <div className="mb-4 space-y-3 border-b border-[var(--line)] pb-4 text-sm text-[var(--ink)]">
            <a className="flex min-h-11 items-center gap-2" href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer"><Send className="size-5 shrink-0" />Telegram · {TELEGRAM_HANDLE}</a>
            <p>{openCourses} cursos con inscripción vigente</p>
            <p className="text-xs text-[var(--muted)]">de {published} publicados · sincronizado {formatSyncClock(syncedAt)}</p>
          </div>
          <div className="flex flex-col gap-1">
            <MobileNavItem
              active={view === 'conversations'}
              onClick={() => selectView('conversations')}
              label="Bandeja en vivo"
              badge={attentionCount > 0 ? attentionCount : undefined}
            />
            <MobileNavItem
              active={view === 'metrics'}
              onClick={() => selectView('metrics')}
              label="Métricas"
            />
            <MobileNavItem
              active={view === 'courses'}
              onClick={() => selectView('courses')}
              label="Cursos"
            />
            <button
              type="button"
              onClick={logout}
              className="mt-1 flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-[var(--red)] transition-ui hover:bg-[var(--mist)]"
            >
              <LogOut className="size-4" />
              Cerrar sesión
              {username ? (
                <span className="ml-auto truncate text-xs text-[var(--muted)]">{username}</span>
              ) : null}
            </button>
          </div>
        </ResponsivePanel>
      )}
    </header>
  )
}

function ChannelStatus({
  icon,
  color,
  title,
  subtitle,
  ok,
}: {
  icon: ReactNode
  color: string
  title: ReactNode
  subtitle: ReactNode
  ok?: boolean
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3">
      <span
        className="row-span-2 grid size-10 place-items-center rounded-full"
        style={{
          background: `color-mix(in srgb, ${color} 12%, #ffffff)`,
          color,
        }}
      >
        {icon}
      </span>
      <strong className="text-[15px] font-semibold text-[var(--ink)]">{title}</strong>
      <small className="flex items-center gap-2 text-[13px] text-[var(--red)]">
        <span
          className={cn(
            'inline-block size-2 shrink-0 rounded-full',
            ok ? 'bg-[var(--good)]' : 'bg-[var(--muted)]',
          )}
        />
        {subtitle}
      </small>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  badge?: number
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'border-b-[3px] border-transparent px-0.5 py-2.5 text-base transition-ui focus-visible:outline-none',
        active
          ? 'border-[var(--red)] font-semibold text-[var(--ink)]'
          : 'font-medium text-[var(--ink)] hover:text-[var(--navy)]',
      )}
    >
      {children}
      {badge != null && (
        <span className="ml-1 inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-[var(--red)] px-1.5 py-px text-xs font-semibold text-white tabular-nums">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function MobileNavItem({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  label: string
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-ui',
        active
          ? 'bg-[var(--mist)] font-semibold text-[var(--ink)]'
          : 'text-[var(--text)] hover:bg-[var(--mist)]',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {label}
      {badge != null && (
        <span className="ml-auto inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-[var(--red)] px-1.5 text-xs font-semibold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
