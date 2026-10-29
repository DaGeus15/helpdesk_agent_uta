import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, ApiError } from '@/lib/api'
import {
  getSession,
  logout as clearSession,
  setSession,
  subscribeAuth,
  type AuthSession,
} from '@/lib/auth'

interface AuthContextValue {
  session: AuthSession | null
  username: string | null
  isAuthenticated: boolean
  sessionMessage: string | null
  clearSessionMessage: () => void
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(() => getSession())
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)

  useEffect(() => {
    return subscribeAuth((next, reason) => {
      setSessionState(next)
      if (reason === 'expired') {
        setSessionMessage('Tu sesión expiró')
      } else if (reason === 'login') {
        setSessionMessage(null)
      }
    })
  }, [])

  const clearSessionMessage = useCallback(() => {
    setSessionMessage(null)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await api.login(username.trim(), password)
      setSession({
        token: res.token,
        expiresAt: res.expiresAt,
        username: res.username,
      })
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(err.message || 'Credenciales incorrectas')
      }
      throw err instanceof Error ? err : new Error('No se pudo iniciar sesión')
    }
  }, [])

  const logout = useCallback(() => {
    clearSession('logout')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      username: session?.username ?? null,
      isAuthenticated: Boolean(session),
      sessionMessage,
      clearSessionMessage,
      login,
      logout,
    }),
    [session, sessionMessage, clearSessionMessage, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
