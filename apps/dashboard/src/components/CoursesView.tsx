import { useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { ContactCard } from '@/components/ContactCard'
import { CourseCard } from '@/components/CourseCard'
import { Input } from '@/components/ui/input'
import { useCourses } from '@/hooks/useCourses'
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

export function CoursesView() {
  const { courses, loading, error, configured } = useCourses()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--uta-primary)] sm:text-xl">
            Catálogo de cursos
          </h2>
          <p className="mt-1 text-sm text-[var(--uta-text-muted)]">
            Talleres tecnológicos CTT-FISEI · datos en vivo desde el catálogo oficial
          </p>
        </div>

        <ContactCard />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--uta-text-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar curso, modalidad, horario…"
              className="h-10 rounded-xl border-[var(--uta-hairline)] bg-white pl-9 shadow-sm"
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
                    ? 'border-[var(--uta-primary)] bg-[var(--uta-primary)] text-white'
                    : 'border-[var(--uta-hairline)] bg-white text-[var(--uta-text-muted)] hover:border-[rgba(30,79,163,0.25)] hover:text-[var(--uta-primary)]',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {!configured ? (
          <p className="rounded-2xl border border-[var(--uta-hairline)] bg-white px-4 py-8 text-center text-sm text-[var(--uta-text-muted)] shadow-[var(--uta-shadow-soft)]">
            Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para cargar el catálogo.
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--uta-text-muted)]">
            <Loader2 className="size-4 animate-spin" />
            Cargando cursos…
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
            No se pudo cargar el catálogo: {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-[var(--uta-hairline)] bg-white px-4 py-8 text-center text-sm text-[var(--uta-text-muted)] shadow-[var(--uta-shadow-soft)]">
            No hay cursos que coincidan con el filtro.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
