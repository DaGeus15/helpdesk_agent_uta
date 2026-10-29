import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  COURSE_STATUS_META,
  formatDateRange,
  formatMoney,
  type Course,
} from '@/lib/courses'
import { cn } from '@/lib/utils'

interface CourseCardProps {
  course: Course
  compact?: boolean
}

export function CourseCard({ course, compact = false }: CourseCardProps) {
  const [open, setOpen] = useState(false)
  const meta = COURSE_STATUS_META[course.status]
  const schedule = course.schedules?.[0] ?? null
  const enrollRange = formatDateRange(course.enrollment_start, course.enrollment_end)
  const runRange = formatDateRange(course.start_date, course.end_date)
  const syllabus = course.syllabus ?? []
  const tiers = course.price_tiers ?? []
  const isOpen = course.status === 'inscripciones_abiertas'
  const isPast =
    course.status === 'finalizado' || course.status === 'proximamente'

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-lg bg-[var(--mist)]',
        isPast && !isOpen && 'opacity-95',
      )}
    >
      <div
        className={cn(
          'grid content-start gap-2.5 px-5 py-5 text-white',
          isOpen ? 'bg-[var(--navy)]' : 'bg-[var(--text)]',
        )}
      >
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded bg-white px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[var(--navy)] uppercase">
            {isOpen ? 'Inscripción abierta' : meta.label}
          </span>
          {course.total_hours != null && (
            <span className="rounded bg-white px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[var(--navy)] uppercase">
              {course.total_hours} horas
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold text-white uppercase">{course.name}</h3>
      </div>

      <div className={cn('flex flex-1 flex-col gap-3 px-5 pt-4 pb-5', compact && 'pt-3')}>
        {course.prerequisites && !compact && (
          <p className="line-clamp-4 text-sm text-[var(--text)]">{course.prerequisites}</p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[13px]">
          {enrollRange && (
            <>
              <dt className="font-semibold text-[var(--ink)]">Inscripciones</dt>
              <dd className="m-0 whitespace-pre-line text-[var(--text)]">{enrollRange}</dd>
            </>
          )}
          {runRange && (
            <>
              <dt className="font-semibold text-[var(--ink)]">Fechas</dt>
              <dd className="m-0 whitespace-pre-line text-[var(--text)]">{runRange}</dd>
            </>
          )}
          {(course.modality || course.location) && (
            <>
              <dt className="font-semibold text-[var(--ink)]">Modalidad</dt>
              <dd className="m-0 text-[var(--text)]">
                {[course.modality, course.location].filter(Boolean).join(' · ')}
              </dd>
            </>
          )}
          {schedule && (
            <>
              <dt className="font-semibold text-[var(--ink)]">Horario</dt>
              <dd className="m-0 whitespace-pre-line text-[var(--text)]">{schedule}</dd>
            </>
          )}
          {(tiers.length > 0 || course.price_usd != null) && (
            <>
              <dt className="font-semibold text-[var(--ink)]">Precios</dt>
              <dd className="m-0 whitespace-pre-line text-[var(--text)]">
                {tiers.length > 0
                  ? tiers
                      .map((t) => `${t.audience}: $${formatMoney(t.price_usd)}`)
                      .join('\n')
                  : `Público general: $${formatMoney(course.price_usd!)}`}
              </dd>
            </>
          )}
        </dl>

        {syllabus.length > 0 && !compact && (
          <div className="border-t border-[var(--line)] pt-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-sm font-medium text-[var(--navy)] transition-ui hover:bg-white/60"
              aria-expanded={open}
            >
              Temario
              <ChevronDown
                className={cn(
                  'size-4 transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
            </button>
            <div className="summary-collapse" data-open={open}>
              <div>
                <ol className="space-y-1.5 pb-1 pl-1 text-sm text-[var(--text)]">
                  {syllabus.map((mod) => (
                    <li key={`${mod.module}-${mod.title}`}>
                      <span className="font-medium text-[var(--ink)]">
                        {mod.module}. {mod.title}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1.5 text-sm">
          {isOpen && course.source_url && (
            <a
              href={course.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md bg-[var(--red)] px-4 py-2.5 font-semibold text-white no-underline transition-ui hover:bg-[var(--crimson)]"
            >
              Formulario de inscripción
            </a>
          )}
          {course.source_url && (
            <a
              href={course.source_url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--red)] underline-offset-2 hover:underline"
            >
              Ver en la web del CTT
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
