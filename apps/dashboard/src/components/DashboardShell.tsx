import { useMemo, useState } from 'react'
import { BarChart3, GraduationCap, Inbox, PanelLeft } from 'lucide-react'
import { Toaster } from 'sonner'
import { Header, type DashboardView } from '@/components/Header'
import { MetricsView } from '@/components/MetricsView'
import { ConversationList } from '@/components/ConversationList'
import { needsAdvisor } from '@/components/ConversationCard'
import { ChatView } from '@/components/ChatView'
import { EmptyState } from '@/components/EmptyState'
import { ConfigBanner } from '@/components/ConfigBanner'
import { CoursesView } from '@/components/CoursesView'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/useConversations'
import { useMessages } from '@/hooks/useMessages'
import { getMissingEnvVars } from '@/lib/env'
import { readStorage, writeStorage } from '@/lib/storage'
import { cn } from '@/lib/utils'

const VIEW_KEY = 'dashboard-view'
const LIST_COLLAPSED_KEY = 'dashboard-list-collapsed'

function readView(): DashboardView {
  const raw = readStorage(VIEW_KEY)
  if (raw === 'conversations' || raw === 'metrics' || raw === 'courses') return raw
  return 'conversations'
}

/**
 * Panel principal: solo se monta con sesión activa para no abrir canales Realtime
 * mientras el operador no ha iniciado sesión.
 */
export function DashboardShell() {
  const missing = getMissingEnvVars()
  const [view, setView] = useState<DashboardView>(readView)
  const [listCollapsed, setListCollapsed] = useState(
    () => readStorage(LIST_COLLAPSED_KEY) === '1',
  )

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
  const {
    messages,
    handoverEvents,
    bottomRef,
    addOptimistic,
    markOptimisticFailed,
    applyServerMessage,
  } = useMessages(selectedId)

  const needsAdvisorCount = useMemo(
    () => conversations.filter(needsAdvisor).length,
    [conversations],
  )

  const showChatOnMobile = view === 'conversations' && Boolean(selectedId)

  function handleViewChange(next: DashboardView) {
    setView(next)
    writeStorage(VIEW_KEY, next)
  }

  function toggleListCollapsed() {
    setListCollapsed((prev) => {
      const next = !prev
      writeStorage(LIST_COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }

  function selectConversation(id: string) {
    setSelectedId(id)
    if (view !== 'conversations') {
      handleViewChange('conversations')
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          className:
            'banner-enter !rounded-lg !border-[var(--line)] !shadow-[var(--uta-shadow-lift)]',
        }}
      />
      <div className={cn('dashboard-shell flex h-dvh flex-col overflow-hidden bg-white', showChatOnMobile && 'mobile-chat-open')}>
        <div className={showChatOnMobile ? 'hidden md:contents' : 'contents'}>
          <ConfigBanner missing={missing} />
          <Header
            isLive={isLive && configured}
            view={view}
            onViewChange={handleViewChange}
            attentionCount={needsAdvisorCount}
          />
        </div>

        {view === 'courses' ? (
          <CoursesView />
        ) : view === 'metrics' ? (
          <MetricsView
            conversations={conversations}
            onSelectConversation={selectConversation}
          />
        ) : !configured ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm text-[var(--text)]">
            Configura las variables VITE_* para cargar conversaciones en vivo.
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1">
            {/* Móvil: una pantalla; tablet y escritorio: columnas colapsables. */}
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              unread={unread}
              loading={loading}
              onSelect={selectConversation}
              collapsed={listCollapsed}
              onToggleCollapse={toggleListCollapsed}
              className={cn(
                'transition-ui',
                // móvil
                showChatOnMobile ? 'hidden' : 'flex',
                listCollapsed ? 'md:hidden' : 'md:flex',
              )}
            />

            <main className={cn('relative min-h-0 min-w-0 flex-1 flex-col border-l border-[var(--line)]', showChatOnMobile ? 'flex' : 'hidden md:flex', listCollapsed && 'list-is-collapsed')}>
              <div className="list-restore-control pointer-events-none absolute top-2 left-2 z-10 hidden gap-1 md:flex">
                {listCollapsed && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="pointer-events-auto inline-flex h-11 w-11 rounded-md border-[var(--line)] bg-white/95 shadow-sm lg:h-8 lg:w-8"
                    onClick={toggleListCollapsed}
                    aria-label="Mostrar lista de conversaciones"
                  >
                    <PanelLeft className="size-4" />
                  </Button>
                )}
              </div>

              {error && conversations.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
                  {error}
                </div>
              ) : selected ? (
                <ChatView
                  conversation={selected}
                  messages={messages}
                  handoverEvents={handoverEvents}
                  bottomRef={bottomRef}
                  onOptimisticSend={addOptimistic}
                  onOptimisticFailed={markOptimisticFailed}
                  onServerMessage={applyServerMessage}
                  onBack={() => setSelectedId(null)}
                  className={showChatOnMobile ? 'flex' : 'hidden md:flex'}
                />
              ) : (
                <EmptyState className="hidden md:flex" />
              )}
            </main>
          </div>
        )}
        {!showChatOnMobile && (
          <nav className="mobile-bottom-nav" aria-label="Secciones del panel">
            {([
              ['conversations', 'Bandeja', Inbox],
              ['metrics', 'Métricas', BarChart3],
              ['courses', 'Cursos', GraduationCap],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => handleViewChange(id)}
                aria-current={view === id ? 'page' : undefined}>
                <span className="relative"><Icon className="size-5" />
                  {id === 'conversations' && needsAdvisorCount > 0 && (
                    <span className="mobile-attention-badge">{needsAdvisorCount > 99 ? '99+' : needsAdvisorCount}</span>
                  )}
                </span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </TooltipProvider>
  )
}
