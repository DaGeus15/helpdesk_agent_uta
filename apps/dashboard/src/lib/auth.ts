const STORAGE_KEY = 'codeandes_auth'

export interface AuthSession {
  token: string
  expiresAt: string
  username: string
}

type AuthListener = (session: AuthSession | null, reason?: 'expired' | 'logout' | 'login') => void

const listeners = new Set<AuthListener>()

function notify(session: AuthSession | null, reason?: 'expired' | 'logout' | 'login') {
  for (const listener of listeners) {
    try {
      listener(session, reason)
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeAuth(listener: AuthListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.token || !parsed?.expiresAt || !parsed?.username) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (isSessionExpired(parsed)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    return null
  }
}

export function getToken(): string | null {
  return getSession()?.token ?? null
}

export function isSessionExpired(session: AuthSession): boolean {
  const expires = new Date(session.expiresAt).getTime()
  if (Number.isNaN(expires)) return true
  return Date.now() >= expires
}

export function setSession(session: AuthSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // storage may be unavailable; keep in-memory via listeners only
  }
  notify(session, 'login')
}

export function logout(reason: 'expired' | 'logout' = 'logout'): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  notify(null, reason)
}

/** Called from api.ts when an authenticated request returns 401. */
export function handleUnauthorized(): void {
  logout('expired')
}
