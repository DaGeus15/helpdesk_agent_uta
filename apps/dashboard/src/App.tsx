import { LoginPage } from '@/components/LoginPage'
import { DashboardShell } from '@/components/DashboardShell'
import { useAuth } from '@/hooks/useAuth'

export default function App() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <DashboardShell />
}
