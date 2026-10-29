import { QRCodeSVG } from 'qrcode.react'
import { ExternalLink, Loader2, Mail, MapPin, Send } from 'lucide-react'
import { CourseCard } from '@/components/CourseCard'
import { Button } from '@/components/ui/button'
import { useCourses } from '@/hooks/useCourses'
import {
  CAMPUS_ADDRESS,
  CONTACT_EMAILS,
  TELEGRAM_BOT_URL,
  formatSpanishDayMonth,
} from '@/lib/courses'

export function ContactLanding() {
  const { courses, loading, error, configured } = useCourses()
  const open = courses.filter((c) => c.status === 'inscripciones_abiertas')
  const upcoming = courses
    .filter((c) => c.status === 'proximamente')
    .slice()
    .sort((a, b) =>
      (a.enrollment_start ?? a.start_date ?? '').localeCompare(
        b.enrollment_start ?? b.start_date ?? '',
      ),
    )
  const running = courses.filter((c) => c.status === 'en_curso')
  const nextEnrollmentDate =
    upcoming
      .map((c) => c.enrollment_start)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ??
    upcoming
      .map((c) => c.start_date)
      .filter((d): d is string => Boolean(d))
      .sort()[0]
  const nextEnrollmentLabel = formatSpanishDayMonth(nextEnrollmentDate)

  return (
    <div className="min-h-screen bg-[var(--mist)]">
      <header className="border-b border-[#e6e4ec] bg-white px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <img
            src="/logo-ctt.png"
            alt="FISEI · CTT Talleres Tecnológicos"
            className="h-12 w-auto"
            width={220}
            height={91}
          />
          <p className="text-sm text-[var(--text)]">
            Talleres Tecnológicos · FISEI · UTA
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <section className="rounded-lg border border-[var(--line)] bg-white p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <QRCodeSVG
                value={TELEGRAM_BOT_URL}
                size={200}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#012e5a"
                title="Código QR del bot de Telegram CTT-FISEI"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--navy)] sm:text-3xl">
                  Contáctanos por Telegram
                </h1>
                <p className="mt-2 text-sm text-[var(--text)] sm:text-base">
                  Nuestro asistente responde dudas del catálogo y te acompaña
                  hasta la inscripción con precios y horarios oficiales.
                </p>
              </div>
              <Button
                asChild
                className="h-11 rounded-md bg-[var(--red)] px-6 font-semibold text-white hover:bg-[var(--crimson)]"
              >
                <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">
                  <Send className="size-4" />
                  Contáctanos por Telegram
                  <ExternalLink className="size-3.5 opacity-70" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        {!configured ? (
          <p className="mt-10 text-center text-sm text-[var(--muted)]">
            Catálogo no disponible: faltan variables de Supabase.
          </p>
        ) : loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 className="size-4 animate-spin" />
            Cargando cursos…
          </div>
        ) : error ? (
          <p className="mt-10 text-center text-sm text-[var(--critical)]">{error}</p>
        ) : (
          <>
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-[var(--navy)] sm:text-xl">
                Inscripciones abiertas
              </h2>
              <p className="mt-1 text-sm text-[var(--text)]">
                Cursos listos para matricularte ahora
              </p>
              {open.length === 0 ? (
                <p className="mt-4 rounded-lg border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
                  {upcoming.length > 0 && nextEnrollmentLabel
                    ? `Las próximas inscripciones abren el ${nextEnrollmentLabel}. Escríbenos por Telegram para reservar tu cupo.`
                    : 'No hay inscripciones abiertas en este momento. Escríbenos por Telegram para conocer la próxima convocatoria.'}
                </p>
              ) : (
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {open.map((course) => (
                    <CourseCard key={course.id} course={course} compact />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-12">
              <h2 className="text-lg font-semibold text-[var(--navy)] sm:text-xl">
                Próximamente
              </h2>
              <p className="mt-1 text-sm text-[var(--text)]">
                Talleres con inscripción próxima a abrir
              </p>
              {upcoming.length === 0 ? (
                <p className="mt-4 rounded-lg border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
                  No hay cursos anunciados como próximos por ahora.
                </p>
              ) : (
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {upcoming.map((course) => (
                    <CourseCard key={course.id} course={course} compact />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-12">
              <h2 className="text-lg font-semibold text-[var(--navy)] sm:text-xl">
                En curso
              </h2>
              <p className="mt-1 text-sm text-[var(--text)]">
                Talleres que se están dictando actualmente
              </p>
              {running.length === 0 ? (
                <p className="mt-4 rounded-lg border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
                  No hay talleres en dictado ahora.
                </p>
              ) : (
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {running.map((course) => (
                    <CourseCard key={course.id} course={course} compact />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="bg-[var(--ink)] px-4 py-5 text-center text-[13px] text-[#dddce6] sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div>
            <p className="m-0 font-medium text-white">
              Centro de Transferencia y Desarrollo de Tecnologías · FISEI · UTA
            </p>
            <p className="mt-2 flex items-start gap-2 text-[#dddce6]">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>{CAMPUS_ADDRESS}</span>
            </p>
          </div>
          <ul className="space-y-1.5">
            {CONTACT_EMAILS.map((email) => (
              <li key={email}>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 text-[#dddce6] no-underline transition-ui hover:text-white"
                >
                  <Mail className="size-3.5" />
                  {email}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  )
}
