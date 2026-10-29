import { Toaster } from 'sonner'
import { Header } from '@/components/Header'
import { MetricsBar } from '@/components/MetricsBar'
import { ConversationList } from '@/components/ConversationList'
import { ChatView } from '@/components/ChatView'
import { EmptyState } from '@/components/EmptyState'
import { ConfigBanner } from '@/components/ConfigBanner'
import { Footer } from '@/components/Footer'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useConversations } from '@/hooks/useConversations'
import { useMessages } from '@/hooks/useMessages'
import { useMetrics } from '@/hooks/useMetrics'
import { getMissingEnvVars } from '@/lib/env'

/**
 * Panel principal: solo se monta con sesión activa para no abrir canales Realtime
 * mientras el operador no ha iniciado sesión.
 */
export function DashboardShell() {
  const missing = getMissingEnvVars()
  const {
    conversations,
    selected,
    selectedId,
    setSelectedId,
    unread,
    loading,
    error,
    isLive,
    configured,
  } = useConversations()
  const { messages, bottomRef } = useMessages(selectedId)
  const metrics = useMetrics(conversations)

  const showChatOnMobile = Boolean(selectedId)

  return (
    <TooltipProvider delayDuration={200}>
      <Toaster position="top-right" richColors closeButton />
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--uta-bg)]">
        <ConfigBanner missing={missing} />
        <Header isLive={isLive && configured} />
        <MetricsBar metrics={metrics} />

        {!configured ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[var(--uta-text-muted)]">
            Configura las variables VITE_* para cargar conversaciones en vivo.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              unread={unread}
              onSelect={setSelectedId}
              className={showChatOnMobile ? 'hidden md:flex' : 'flex'}
            />
            <main className="min-h-0 min-w-0 flex-1">
              {loading && conversations.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--uta-text-muted)]">
                  Cargando conversaciones…
                </div>
              ) : error && conversations.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
                  {error}
                </div>
              ) : selected ? (
                <ChatView
                  conversation={selected}
                  messages={messages}
                  bottomRef={bottomRef}
                  onBack={() => setSelectedId(null)}
                  className={showChatOnMobile ? 'flex' : 'hidden md:flex'}
                />
              ) : (
                <EmptyState className="hidden md:flex" />
              )}
            </main>
          </div>
        )}

        <Footer />
      </div>
    </TooltipProvider>
  )
}
