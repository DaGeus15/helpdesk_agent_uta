import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { ContactCard } from '@/components/ContactCard'
import { CourseCard } from '@/components/CourseCard'
import { Input } from '@/components/ui/input'
import { useCourses } from '@/hooks/useCourses'
import { api, ApiError, type CatalogSyncStatus } from '@/lib/api'
import {
  COURSE_STATUS_META,
  sortCoursesByStatus,
  type CourseStatus,
} from '@/lib/courses'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | CourseStatus

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'inscripciones_abiertas', label: COURSE_STATUS_META.inscripciones_abiertas.label },
  { id: 'en_curso', label: COURSE_STATUS_META.en_curso.label },
  { id: 'proximamente', label: COURSE_STATUS_META.proximamente.label },
  { id: 'finalizado', label: COURSE_STATUS_META.finalizado.label },
]

function formatRelativeMinutes(iso: string | null | undefined): string {
  if (!iso) return 'sin sincronizar aún'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return 'recién'
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'hace menos de 1 min'
  if (mins === 1) return 'hace 1 min'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours === 1) return 'hace 1 h'
  if (hours < 48) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'hace 1 día' : `hace ${days} días`
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}

export function CoursesView() {
  const { courses, loading, error, configured, refresh } = useCourses()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [syncStatus, setSyncStatus] = useState<CatalogSyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await api.getCatalogStatus()
      setSyncStatus(status)
    } catch {
      // Panel usable without API
    }
  }, [])

  useEffect(() => {
    void loadSyncStatus()
  }, [loadSyncStatus])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return courses
      .filter((c) => (statusFilter === 'all' ? true : c.status === statusFilter))
      .filter((c) => {
        if (!q) return true
        const haystack = [
          c.name,
          c.modality,
          c.location,
          c.prerequisites,
          ...(c.schedules ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .slice()
      .sort(sortCoursesByStatus)
  }, [courses, query, statusFilter])

  const lastFinished =
    syncStatus?.lastRun?.finished_at ?? syncStatus?.lastRun?.started_at ?? null
  const lastFailed = syncStatus?.lastRun != null && !syncStatus.lastRun.ok
  const openCount = courses.filter((c) => c.status === 'inscripciones_abiertas').length
  const courseCount = syncStatus?.lastRun?.total ?? courses.length

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const result = await api.syncCatalog()
      await Promise.all([loadSyncStatus(), refresh()])
      if (result.ok) {
        toast.success('Catálogo actualizado', {
          description: `${result.upserted} cursos · ${result.deactivated} desactivados · ${result.durationMs} ms`,
        })
      } else {
        toast.error('Sincronización no aplicada', {
          description: result.error ?? 'El catálogo anterior se conservó',
        })
      }
    } catch (err) {
      toast.error('No se pudo sincronizar', { description: errorMessage(err) })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-[var(--ink)]">
            {openCount} de {courseCount} cursos tienen la inscripción abierta hoy
            {lastFinished ? ` · sincronizado ${formatRelativeMinutes(lastFinished)}` : ''}.
          </p>
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleSyncNow()}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--red)] px-4 py-2.5 text-sm font-semibold text-white transition-ui hover:bg-[var(--crimson)] focus-visible:outline-none disabled:opacity-60"
          >
            {syncing ? <Loader2 className="size-4 animate-spin" /> : null}
            {syncing ? 'Sincronizando…' : 'Sincronizar con la web'}
          </button>
        </div>

        {lastFailed ? (
          <p className="text-xs text-[var(--warning)]">
            La última sincronización falló
            {syncStatus?.lastRun?.error ? `: ${syncStatus.lastRun.error}` : ''}. Se
            conserva el catálogo anterior.
          </p>
        ) : null}

        <ContactCard />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar curso, modalidad, horario…"
              className="h-10 rounded-md border-[var(--line)] bg-white pl-9 shadow-none focus-visible:ring-[var(--red)]"
              aria-label="Buscar cursos"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-ui',
                  statusFilter === f.id
                    ? 'border-[var(--red)] bg-[var(--red)] text-white'
                    : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--red)]',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {!configured ? (
          <p className="rounded-lg border border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
            Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para cargar el catálogo.
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--muted)]">
            <Loader2 className="size-4 animate-spin" />
            Cargando cursos…
          </div>
        ) : error ? (
          <p className="rounded-lg border border-[color-mix(in_srgb,var(--critical)_30%,var(--line))] bg-[color-mix(in_srgb,var(--critical)_6%,white)] px-4 py-6 text-center text-sm text-[var(--critical)]">
            No se pudo cargar el catálogo: {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
            No hay cursos que coincidan con el filtro.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
