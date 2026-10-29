import { useEffect, useMemo, useState } from 'react'
import { PanelLeft } from 'lucide-react'
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
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  const needsAdvisorCount = useMemo(
    () => conversations.filter(needsAdvisor).length,
    [conversations],
  )

  const showChatOnMobile = Boolean(selectedId)

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
    setDrawerOpen(false)
    if (view !== 'conversations') {
      handleViewChange('conversations')
    }
  }

  useEffect(() => {
    if (view !== 'conversations') setDrawerOpen(false)
  }, [view])

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
      <div className="flex h-dvh flex-col overflow-hidden bg-white">
        <ConfigBanner missing={missing} />
        <Header
          isLive={isLive && configured}
          view={view}
          onViewChange={handleViewChange}
          attentionCount={needsAdvisorCount}
        />

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
            {drawerOpen && (
              <button
                type="button"
                aria-label="Cerrar lista de conversaciones"
                className="absolute inset-0 z-20 bg-black/30 transition-ui lg:hidden"
                onClick={() => setDrawerOpen(false)}
              />
            )}

            {/*
              Visibilidad:
              - < md: pantalla completa si no hay chat seleccionado
              - md–lg: drawer superpuesto (drawerOpen)
              - ≥ lg: columna fija salvo listCollapsed
            */}
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
                // tablet drawer
                'md:absolute md:inset-y-0 md:left-0 md:z-30 md:flex md:shadow-[var(--uta-shadow-lift)]',
                drawerOpen ? 'md:translate-x-0' : 'md:-translate-x-full md:pointer-events-none',
                // desktop columna
                'lg:static lg:z-auto lg:translate-x-0 lg:pointer-events-auto lg:shadow-none',
                listCollapsed ? 'lg:hidden' : 'lg:flex',
              )}
            />

            <main className="relative flex min-h-0 min-w-0 flex-1 flex-col border-l border-[var(--line)]">
              <div className="pointer-events-none absolute top-2 left-2 z-10 hidden gap-1 md:flex">
                {listCollapsed && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="pointer-events-auto hidden h-8 w-8 rounded-md border-[var(--line)] bg-white/95 shadow-sm lg:inline-flex"
                    onClick={toggleListCollapsed}
                    aria-label="Mostrar lista de conversaciones"
                  >
                    <PanelLeft className="size-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="pointer-events-auto h-8 w-8 rounded-md border-[var(--line)] bg-white/95 shadow-sm lg:hidden"
                  onClick={() => setDrawerOpen((o) => !o)}
                  aria-label={
                    drawerOpen
                      ? 'Cerrar lista de conversaciones'
                      : 'Abrir lista de conversaciones'
                  }
                >
                  <PanelLeft className="size-4" />
                </Button>
              </div>

              {error && conversations.length === 0 ? (
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
      </div>
    </TooltipProvider>
  )
}
