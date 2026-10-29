import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { AlertCircle, ArrowUpRight, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { TELEGRAM_BOT_URL } from '@/lib/courses'
import { cn, formatRelativeTime } from '@/lib/utils'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface LoginStats {
  courseCount: number | null
  lastSyncLabel: string | null
  botOnline: boolean | null
}

function FloatingField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onKeyEvent,
  autoComplete,
  autoFocus,
  disabled,
  inputRef,
  icon,
  trailing,
}: {
  id: string
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  onKeyEvent?: (e: KeyboardEvent<HTMLInputElement>) => void
  autoComplete?: string
  autoFocus?: boolean
  disabled?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  icon: ReactNode
  trailing?: ReactNode
}) {
  const filled = value.length > 0

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-[var(--muted)]">
        {icon}
      </span>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyEvent}
        onKeyUp={onKeyEvent}
        className={cn(
          'peer h-14 w-full rounded-2xl bg-[var(--mist)] pt-4 pr-12 pb-1.5 pl-11 text-[15px] text-[var(--ink)]',
          'ring-1 ring-black/[0.06] outline-none',
          'transition-[box-shadow] duration-300',
          '[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]',
          'focus:ring-2 focus:ring-[var(--navy)]/35 focus:shadow-[0_0_0_4px_rgba(1,46,90,0.08)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
        placeholder=" "
      />
      <label
        htmlFor={id}
        className={cn(
          'pointer-events-none absolute left-11 origin-left',
          'transition-[top,transform,font-size,color,letter-spacing] duration-300',
          '[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]',
          filled
            ? 'top-2 translate-y-0 text-[10px] font-medium tracking-wide text-[var(--navy)]'
            : 'top-1/2 -translate-y-1/2 text-[15px] font-normal tracking-normal text-[var(--muted)] peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-medium peer-focus:tracking-wide peer-focus:text-[var(--navy)]',
        )}
      >
        {label}
      </label>
      {trailing}
    </div>
  )
}

function StatusCard({
  value,
  leading,
  delayMs,
}: {
  value: string
  leading?: ReactNode
  delayMs: number
}) {
  return (
    <div
      className="login-enter rounded-2xl bg-white/[0.05] p-0.5 ring-1 ring-white/10 backdrop-blur-md"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex min-h-[3.25rem] items-center gap-2.5 rounded-[calc(1rem-2px)] bg-white/[0.04] px-3.5 py-3">
        {leading}
        <p className="text-sm leading-snug font-medium text-white/90 tabular-nums">{value}</p>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login, sessionMessage, clearSessionMessage } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shakeError, setShakeError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<LoginStats>({
    courseCount: null,
    lastSyncLabel: null,
    botOnline: null,
  })
  const usernameRef = useRef<HTMLInputElement>(null)
  const errorId = useId()

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  useEffect(() => {
    if (sessionMessage) {
      setError(sessionMessage)
      clearSessionMessage()
      usernameRef.current?.focus()
    }
  }, [sessionMessage, clearSessionMessage])

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      if (!isSupabaseConfigured || !supabase) {
        if (!cancelled) {
          setStats({ courseCount: null, lastSyncLabel: null, botOnline: null })
        }
        return
      }

      try {
        const [coursesRes, syncRes] = await Promise.all([
          supabase
            .from('courses')
            .select('*', { count: 'exact', head: true })
            .eq('active', true),
          supabase
            .from('catalog_sync_runs')
            .select('finished_at, started_at, ok')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        if (cancelled) return

        const courseCount =
          coursesRes.error || coursesRes.count == null ? null : coursesRes.count

        let lastSyncLabel: string | null = null
        if (!syncRes.error && syncRes.data) {
          const iso = syncRes.data.finished_at ?? syncRes.data.started_at
          if (iso) lastSyncLabel = formatRelativeTime(iso)
        }

        setStats({
          courseCount,
          lastSyncLabel,
          botOnline: true,
        })
      } catch {
        if (!cancelled) {
          setStats({ courseCount: null, lastSyncLabel: null, botOnline: null })
        }
      }
    }

    void loadStats()
    return () => {
      cancelled = true
    }
  }, [])

  function handleCaps(e: KeyboardEvent<HTMLInputElement>) {
    setCapsOn(e.getModifierState('CapsLock'))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setShakeError(false)
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo iniciar sesión'
      setError(message)
      setShakeError(true)
      usernameRef.current?.focus()
      window.setTimeout(() => setShakeError(false), 500)
    } finally {
      setLoading(false)
    }
  }

  const courseValue =
    stats.courseCount == null ? '—' : `${stats.courseCount} cursos sincronizados`
  const syncValue =
    stats.lastSyncLabel == null
      ? '—'
      : `Última sincronización ${stats.lastSyncLabel}`
  const botValue = stats.botOnline == null ? '—' : 'Bot en línea'

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col md:flex-row">
      {/* Grain overlay */}
      <div className="login-grain pointer-events-none fixed inset-0 z-50" aria-hidden />

      {/* Brand panel — left / mobile header */}
      <aside className="relative flex shrink-0 flex-col overflow-hidden bg-[var(--navy)] text-white md:w-[55%] md:min-h-[100dvh]">
        <div className="login-orbits pointer-events-none absolute inset-0" aria-hidden>
          <div className="login-orb login-orb-a" />
          <div className="login-orb login-orb-b" />
          <div className="login-orb login-orb-c" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col px-6 py-6 sm:px-10 sm:py-8 md:px-12 md:py-12 lg:px-16">
          <div
            className="login-enter inline-flex w-fit items-center rounded-2xl bg-white p-2.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]"
            style={{ animationDelay: '0ms' }}
          >
            <img
              src="/logo-ctt.png"
              alt="FISEI · CTT Talleres Tecnológicos"
              className="h-10 w-auto md:h-12"
              width={220}
              height={91}
            />
          </div>

          <div
            className="login-enter mt-6 md:mt-10"
            style={{ animationDelay: '70ms' }}
          >
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium tracking-[0.2em] text-white/80 uppercase ring-1 ring-white/15">
              Talleres Tecnológicos · FISEI · UTA
            </span>
          </div>

          <h1
            className="login-enter mt-5 text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] text-white sm:text-5xl md:mt-6 md:text-5xl lg:text-6xl"
            style={{ animationDelay: '140ms' }}
          >
            Panel de mando
            <span className="mt-1 block font-medium text-white/70">
              del asistente de cursos
            </span>
          </h1>

          <p
            className="login-enter mt-4 hidden max-w-md text-sm leading-relaxed text-white/65 md:mt-6 md:block md:text-[15px]"
            style={{ animationDelay: '210ms' }}
          >
            Atención 24/7 por Telegram, handover en vivo con operadores y catálogo
            sincronizado con la web oficial del CTT-FISEI.
          </p>

          <div className="mt-auto hidden gap-3 pt-10 md:grid md:grid-cols-1 lg:grid-cols-3">
            <StatusCard
              value={botValue}
              delayMs={280}
              leading={
                stats.botOnline ? (
                  <span className="live-dot relative inline-flex size-2 shrink-0 rounded-full bg-[var(--good)]" />
                ) : null
              }
            />
            <StatusCard value={courseValue} delayMs={350} />
            <StatusCard value={syncValue} delayMs={420} />
          </div>

          <p
            className="login-enter mt-6 hidden text-xs text-white/40 md:mt-8 md:block"
            style={{ animationDelay: '490ms' }}
          >
            © Universidad Técnica de Ambato · CTT-FISEI
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-1 items-center justify-center bg-[linear-gradient(165deg,#f2f1f8_0%,#ffffff_55%,#f7f6fb_100%)] px-4 py-10 sm:px-8 md:w-[45%] md:min-h-[100dvh] md:py-12">
        <div className="w-full max-w-[420px]">
          <div
            className="login-enter rounded-[2rem] bg-black/[0.03] p-2 ring-1 ring-black/5"
            style={{ animationDelay: '160ms' }}
          >
            <div className="rounded-[calc(2rem-0.5rem)] bg-white p-7 shadow-[0_30px_80px_-30px_rgba(1,46,90,0.25),inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-9">
              <div className="login-enter" style={{ animationDelay: '220ms' }}>
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--navy)]">
                  Bienvenido de vuelta
                </h2>
                <p className="mt-1.5 text-sm text-[var(--text)]">
                  Ingresa con tu cuenta de operador
                </p>
              </div>

              <form
                onSubmit={(e) => void handleSubmit(e)}
                className="mt-8 space-y-4"
                noValidate={false}
              >
                <div className="login-enter" style={{ animationDelay: '280ms' }}>
                  <FloatingField
                    id="username"
                    label="Usuario"
                    value={username}
                    onChange={setUsername}
                    onKeyEvent={handleCaps}
                    autoComplete="username"
                    autoFocus
                    disabled={loading}
                    inputRef={usernameRef}
                    icon={<User className="size-[18px]" strokeWidth={1.25} />}
                  />
                </div>

                <div className="login-enter" style={{ animationDelay: '350ms' }}>
                  <FloatingField
                    id="password"
                    label="Contraseña"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={setPassword}
                    onKeyEvent={handleCaps}
                    autoComplete="current-password"
                    disabled={loading}
                    icon={<Lock className="size-[18px]" strokeWidth={1.25} />}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute top-1/2 right-3 z-10 -translate-y-1/2 rounded-xl p-2 text-[var(--muted)] transition-[color,transform,opacity] duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:text-[var(--navy)] focus-visible:outline-none"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="size-[18px]" strokeWidth={1.25} />
                        ) : (
                          <Eye className="size-[18px]" strokeWidth={1.25} />
                        )}
                      </button>
                    }
                  />
                  {capsOn && (
                    <p className="mt-2 text-xs font-medium text-[var(--warning)]" role="status">
                      Bloq Mayús activado
                    </p>
                  )}
                </div>

                <div
                  className={cn('login-enter min-h-[1.25rem]', shakeError && 'login-shake')}
                  style={{ animationDelay: '400ms' }}
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  {error ? (
                    <p
                      id={errorId}
                      role="alert"
                      className="flex items-start gap-2 text-sm text-[var(--critical)]"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.25} />
                      <span>{error}</span>
                    </p>
                  ) : null}
                </div>

                <div className="login-enter pt-1" style={{ animationDelay: '460ms' }}>
                  <button
                    type="submit"
                    disabled={loading || !username.trim() || !password}
                    aria-describedby={error ? errorId : undefined}
                    className={cn(
                      'group relative flex h-14 w-full items-center justify-center rounded-full bg-[var(--red)] pr-14 pl-6',
                      'text-[15px] font-semibold text-white',
                      'shadow-[0_12px_32px_-12px_rgba(173,39,46,0.55)]',
                      'transition-[transform,opacity] duration-200',
                      '[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]',
                      'hover:bg-[var(--crimson)] active:scale-[0.98]',
                      'disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100',
                      'focus-visible:outline-none',
                    )}
                  >
                    <span>{loading ? 'Verificando…' : 'Ingresar'}</span>
                    <span
                      className={cn(
                        'absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 items-center justify-center',
                        'rounded-full bg-white/15',
                        'transition-transform duration-300',
                        '[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]',
                        'group-hover:translate-x-0.5 group-hover:-translate-y-[55%] group-hover:scale-105',
                      )}
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <ArrowUpRight className="size-4" strokeWidth={1.5} />
                      )}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div
            className="login-enter mt-8 space-y-4"
            style={{ animationDelay: '520ms' }}
          >
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--line)]" />
              <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                ¿Eres prospecto?
              </span>
              <div className="h-px flex-1 bg-[var(--line)]" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                href="/contacto"
                className="text-sm font-medium text-[var(--red)] underline-offset-4 transition-opacity hover:underline hover:opacity-80"
              >
                Ver cursos y contacto →
              </a>

              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full bg-white px-3 py-2 ring-1 ring-black/5 shadow-[0_8px_24px_-16px_rgba(1,46,90,0.35)] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5"
                aria-label="Abrir bot de Telegram CTT-FISEI"
              >
                <span className="overflow-hidden rounded-md bg-white p-0.5">
                  <QRCodeSVG
                    value={TELEGRAM_BOT_URL}
                    size={40}
                    level="M"
                    marginSize={0}
                    bgColor="#ffffff"
                    fgColor="#012e5a"
                    title="Código QR del bot de Telegram CTT-FISEI"
                  />
                </span>
                <span className="pr-1 text-xs font-medium text-[var(--navy)]">Telegram</span>
              </a>
            </div>

            <p className="pt-2 text-center text-[11px] text-[var(--muted)] md:hidden">
              © Universidad Técnica de Ambato · CTT-FISEI
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
