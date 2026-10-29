import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Lock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

export function LoginPage() {
  const { login, sessionMessage, clearSessionMessage } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--uta-bg)] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #E8EFFA 0%, transparent 45%), radial-gradient(circle at 80% 80%, #d6e3f5 0%, transparent 40%)',
        }}
      />

      <div className="relative w-full max-w-md rounded-xl border border-[var(--uta-border)] bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-[var(--uta-primary)] text-sm font-bold tracking-wide text-white">
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
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu.usuario"
                className="h-10 pl-9"
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
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 pl-9"
                disabled={loading}
                required
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="h-10 w-full bg-[var(--uta-primary)] hover:bg-[var(--uta-primary-mid)]"
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

      <p className="relative mt-6 text-center text-xs text-[var(--uta-text-muted)]">
        CodeAndes Academy · Hackathon UTA 2026 — FISEI
      </p>
    </div>
  )
}
