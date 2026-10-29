import { useState } from 'react'
import { ChevronDown, Clock, ExternalLink, MapPin, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  return (
    <article
      className={cn(
        'flex flex-col rounded-2xl border border-[var(--uta-hairline)] bg-white shadow-[var(--uta-shadow-soft)] transition-ui hover:-translate-y-px hover:shadow-[var(--uta-shadow-lift)]',
        compact ? 'p-4' : 'p-5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-[var(--uta-text)]">
          {course.name}
        </h3>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
            meta.className,
          )}
        >
          {meta.label}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-[var(--uta-text-muted)]">
        {enrollRange && (
          <p className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-3.5 shrink-0 opacity-70" />
            <span>Inscripción: {enrollRange}</span>
          </p>
        )}
        {runRange && (
          <p className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-3.5 shrink-0 opacity-70" />
            <span>Dictado: {runRange}</span>
          </p>
        )}
        {schedule && (
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 size-3.5 shrink-0 opacity-70" />
            <span>{schedule}</span>
          </p>
        )}
        {(course.modality || course.location) && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 opacity-70" />
            <span>
              {[course.modality, course.location].filter(Boolean).join(' · ')}
            </span>
          </p>
        )}
        {course.total_hours != null && (
          <p className="text-xs text-[var(--uta-text-muted)]">
            {course.total_hours} horas
          </p>
        )}
      </div>

      <div className="mt-3 space-y-1">
        {tiers.length > 0 ? (
          tiers.map((tier) => (
            <p
              key={`${tier.audience}-${tier.price_usd}`}
              className="flex justify-between gap-3 text-sm"
            >
              <span className="text-[var(--uta-text-muted)]">{tier.audience}</span>
              <span className="font-medium tabular-nums text-[var(--uta-primary)]">
                ${formatMoney(tier.price_usd)}
              </span>
            </p>
          ))
        ) : course.price_usd != null ? (
          <p className="flex justify-between gap-3 text-sm">
            <span className="text-[var(--uta-text-muted)]">Público general</span>
            <span className="font-medium tabular-nums text-[var(--uta-primary)]">
              ${formatMoney(course.price_usd)}
            </span>
          </p>
        ) : null}
      </div>

      {course.prerequisites && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--uta-text-muted)]">
          <span className="font-medium text-[var(--uta-text)]">Requisitos: </span>
          {course.prerequisites}
        </p>
      )}

      {syllabus.length > 0 && !compact && (
        <div className="mt-3 border-t border-[var(--uta-hairline)] pt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left text-sm font-medium text-[var(--uta-primary)] transition-ui hover:bg-[var(--uta-primary-soft)]"
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
              <ol className="space-y-1.5 pb-1 pl-1 text-sm text-[var(--uta-text-muted)]">
                {syllabus.map((mod) => (
                  <li key={`${mod.module}-${mod.title}`}>
                    <span className="font-medium text-[var(--uta-text)]">
                      {mod.module}. {mod.title}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {course.source_url && (
        <div className="mt-auto pt-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 w-full rounded-xl border-[var(--uta-hairline)]"
          >
            <a href={course.source_url} target="_blank" rel="noreferrer">
              Ver en la web
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      )}
    </article>
  )
}
