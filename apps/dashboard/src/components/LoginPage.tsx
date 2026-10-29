import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react'
import { ContactCard } from '@/components/ContactCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

export function LoginPage() {
  const { login, sessionMessage, clearSessionMessage } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  useEffect(() => {
    if (sessionMessage) {
      setError(sessionMessage)
      clearSessionMessage()
    }
  }, [sessionMessage, clearSessionMessage])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--mist)] px-4 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[var(--navy)]" />

      <div className="relative w-full max-w-md space-y-4">
        <div className="rounded-lg border border-[var(--line)] bg-white p-8 shadow-[var(--uta-shadow-lift)]">
          <div className="mb-6 flex flex-col items-center text-center">
            <img
              src="/logo-ctt.png"
              alt="FISEI · CTT Talleres Tecnológicos"
              className="mb-4 h-14 w-auto"
              width={220}
              height={91}
            />
            <h1 className="text-xl font-semibold text-[var(--navy)]">
              Panel de mando
            </h1>
            <p className="mt-1 text-sm text-[var(--text)]">
              CTT-FISEI · Talleres Tecnológicos UTA
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-medium text-[var(--ink)]">
                Usuario
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  ref={usernameRef}
                  id="username"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="tu.usuario"
                  className="h-11 rounded-md border-[var(--line)] bg-white pl-9 shadow-none focus-visible:ring-[var(--red)]"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-[var(--ink)]">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-md border-[var(--line)] bg-white pr-10 pl-9 shadow-none focus-visible:ring-[var(--red)]"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted)] transition-ui hover:bg-[var(--mist)] hover:text-[var(--navy)] focus-visible:outline-none"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="banner-enter rounded-md border border-[color-mix(in_srgb,var(--critical)_30%,var(--line))] bg-[color-mix(in_srgb,var(--critical)_6%,white)] px-3 py-2 text-sm text-[var(--critical)]"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full rounded-md bg-[var(--red)] font-semibold text-white hover:bg-[var(--crimson)]"
              disabled={loading || !username.trim() || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Ingresando…
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>
        </div>

        <ContactCard
          title="¿Quieres información de los cursos? Contáctanos"
          compact
          qrSize={120}
        />

        <p className="text-center">
          <a
            href="/contacto"
            className="text-xs font-medium text-[var(--red)] underline-offset-2 hover:underline"
          >
            Ver cursos y contacto →
          </a>
        </p>
      </div>

      <p className="relative mt-8 text-center text-xs text-[var(--muted)]">
        Centro de Transferencia y Desarrollo de Tecnologías · FISEI · UTA
      </p>
    </div>
  )
}
