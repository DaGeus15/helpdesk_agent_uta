import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react'
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[linear-gradient(165deg,#061833_0%,#0a2a5e_42%,#1e4fa3_100%)] px-4 py-10">
      <div className="login-blob pointer-events-none absolute -top-24 -left-20 size-[28rem] rounded-full bg-[#1e4fa3]/45 blur-3xl" />
      <div className="login-blob login-blob-delay pointer-events-none absolute -right-16 bottom-0 size-[26rem] rounded-full bg-[#7eb6ff]/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(232,239,250,0.12),transparent_55%)]" />

      <div className="relative w-full max-w-md rounded-2xl border border-white/25 bg-white/85 p-8 shadow-[0_20px_60px_rgba(6,24,51,0.35)] backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[var(--uta-primary)] text-sm font-bold tracking-wide text-white shadow-[0_8px_20px_rgba(10,42,94,0.35)]">
            CA
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--uta-primary)]">
            CodeAndes · Panel de mando
          </h1>
          <p className="mt-1 text-sm text-[var(--uta-text-muted)]">
            Hackathon UTA 2026 · FISEI
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-xs font-medium text-[var(--uta-text)]">
              Usuario
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--uta-text-muted)]" />
              <Input
                ref={usernameRef}
                id="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu.usuario"
                className="h-11 rounded-xl border-[var(--uta-hairline)] bg-white/90 pl-9 shadow-sm"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-[var(--uta-text)]">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--uta-text-muted)]" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 rounded-xl border-[var(--uta-hairline)] bg-white/90 pr-10 pl-9 shadow-sm"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-[var(--uta-text-muted)] transition-ui hover:bg-[var(--uta-primary-soft)] hover:text-[var(--uta-primary)] focus-visible:ring-2 focus-visible:ring-[rgba(30,79,163,0.35)] focus-visible:outline-none active:scale-[0.97]"
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
              className="banner-enter rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="h-11 w-full rounded-xl bg-[var(--uta-primary)] shadow-[0_8px_20px_rgba(10,42,94,0.25)] hover:bg-[var(--uta-primary-mid)]"
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

      <p className="relative mt-6 text-center text-xs text-white/70">
        CodeAndes Academy · Hackathon UTA 2026 — FISEI
      </p>
    </div>
  )
}
