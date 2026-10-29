import { QRCodeSVG } from 'qrcode.react'
import { ExternalLink, Loader2, Mail, MapPin, Send } from 'lucide-react'
import { CourseCard } from '@/components/CourseCard'
import { Button } from '@/components/ui/button'
import { useCourses } from '@/hooks/useCourses'
import {
  CAMPUS_ADDRESS,
  CONTACT_EMAILS,
  TELEGRAM_BOT_URL,
} from '@/lib/courses'

export function ContactLanding() {
  const { courses, loading, error, configured } = useCourses()
  const open = courses.filter((c) => c.status === 'inscripciones_abiertas')
  const running = courses.filter((c) => c.status === 'en_curso')

  return (
    <div className="min-h-screen bg-[var(--uta-bg)]">
      <header className="relative overflow-hidden bg-[linear-gradient(165deg,#061833_0%,#0a2a5e_45%,#1e4fa3_100%)] px-4 pb-16 pt-10 text-white sm:px-6 sm:pb-20 sm:pt-14">
        <div className="login-blob pointer-events-none absolute -top-24 -left-16 size-[24rem] rounded-full bg-[#1e4fa3]/40 blur-3xl" />
        <div className="login-blob login-blob-delay pointer-events-none absolute -right-20 bottom-0 size-[22rem] rounded-full bg-[#7eb6ff]/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium tracking-wide text-white/70 uppercase">
            Universidad Técnica de Ambato
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Talleres Tecnológicos CTT-FISEI · UTA
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/80 sm:text-base">
            Capacitación práctica en tecnologías digitales. Escanea el código o
            escríbenos por Telegram y te orientamos sobre inscripciones, horarios
            y precios oficiales.
          </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-10 w-full max-w-5xl px-4 pb-16 sm:-mt-12 sm:px-6">
        <section className="rounded-3xl border border-[var(--uta-hairline)] bg-white p-6 shadow-[var(--uta-shadow-lift)] sm:p-8">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="rounded-3xl border border-[var(--uta-hairline)] bg-white p-4 shadow-sm">
              <QRCodeSVG
                value={TELEGRAM_BOT_URL}
                size={200}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#0a2a5e"
                title="Código QR del bot de Telegram CTT-FISEI"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--uta-primary)] sm:text-2xl">
                  Contáctanos por Telegram
                </h2>
                <p className="mt-2 text-sm text-[var(--uta-text-muted)] sm:text-base">
                  Nuestro asistente responde dudas del catálogo y te acompaña
                  hasta la inscripción. Misma identidad que en el panel de mando.
                </p>
              </div>
              <Button
                asChild
                className="h-11 rounded-xl bg-[var(--uta-primary)] px-6 shadow-[0_8px_20px_rgba(10,42,94,0.25)] hover:bg-[var(--uta-primary-mid)]"
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
          <p className="mt-10 text-center text-sm text-[var(--uta-text-muted)]">
            Catálogo no disponible: faltan variables de Supabase.
          </p>
        ) : loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-[var(--uta-text-muted)]">
            <Loader2 className="size-4 animate-spin" />
            Cargando cursos…
          </div>
        ) : error ? (
          <p className="mt-10 text-center text-sm text-red-600">{error}</p>
        ) : (
          <>
            <section className="mt-12">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--uta-primary)] sm:text-xl">
                Inscripciones abiertas
              </h2>
              <p className="mt-1 text-sm text-[var(--uta-text-muted)]">
                Cursos listos para matricularte ahora
              </p>
              {open.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-[var(--uta-hairline)] bg-white px-4 py-6 text-sm text-[var(--uta-text-muted)] shadow-[var(--uta-shadow-soft)]">
                  No hay inscripciones abiertas en este momento. Escríbenos por
                  Telegram para conocer la próxima convocatoria.
                </p>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {open.map((course) => (
                    <CourseCard key={course.id} course={course} compact />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-12">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--uta-primary)] sm:text-xl">
                En curso
              </h2>
              <p className="mt-1 text-sm text-[var(--uta-text-muted)]">
                Talleres que se están dictando actualmente
              </p>
              {running.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-[var(--uta-hairline)] bg-white px-4 py-6 text-sm text-[var(--uta-text-muted)] shadow-[var(--uta-shadow-soft)]">
                  No hay talleres en dictado ahora.
                </p>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {running.map((course) => (
                    <CourseCard key={course.id} course={course} compact />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--uta-hairline)] bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-sm text-[var(--uta-text-muted)] sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-[var(--uta-primary)]">
              CTT-FISEI · Talleres Tecnológicos UTA
            </p>
            <p className="mt-2 flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>{CAMPUS_ADDRESS}</span>
            </p>
          </div>
          <ul className="space-y-1.5">
            {CONTACT_EMAILS.map((email) => (
              <li key={email}>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 transition-ui hover:text-[var(--uta-primary)]"
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
