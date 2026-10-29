import { Toaster } from 'sonner'
import { Header } from '@/components/Header'
import { ConversationList } from '@/components/ConversationList'
import { ChatView } from '@/components/ChatView'
import { EmptyState } from '@/components/EmptyState'
import { ConfigBanner } from '@/components/ConfigBanner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useConversations } from '@/hooks/useConversations'
import { useMessages } from '@/hooks/useMessages'
import { useMetrics } from '@/hooks/useMetrics'
import { getMissingEnvVars } from '@/lib/env'

export default function App() {
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

  return (
    <TooltipProvider delayDuration={200}>
      <Toaster position="top-right" richColors closeButton />
      <div className="flex h-screen flex-col overflow-hidden">
        <ConfigBanner missing={missing} />
        <Header metrics={metrics} isLive={isLive && configured} />
        {!configured ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Configura las variables VITE_* para cargar conversaciones en vivo.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              unread={unread}
              onSelect={setSelectedId}
            />
            <main className="min-h-0 min-w-0 flex-1">
              {loading && conversations.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Cargando conversaciones…
                </div>
              ) : error && conversations.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
                  {error}
                </div>
              ) : selected ? (
                <ChatView conversation={selected} messages={messages} bottomRef={bottomRef} />
              ) : (
                <EmptyState />
              )}
            </main>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
