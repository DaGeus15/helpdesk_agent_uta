import { LoginPage } from '@/components/LoginPage'
import { DashboardShell } from '@/components/DashboardShell'
import { ContactLanding } from '@/components/ContactLanding'
import { useAuth } from '@/hooks/useAuth'

export default function App() {
  const { isAuthenticated } = useAuth()
  const isContactPage =
    typeof window !== 'undefined' && window.location.pathname === '/contacto'

  if (isContactPage) {
    return <ContactLanding />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <DashboardShell />
}
