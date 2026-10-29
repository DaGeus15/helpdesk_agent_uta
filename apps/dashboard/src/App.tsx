import { Header } from '@/components/Header'
import { ConversationList } from '@/components/ConversationList'
import { ChatView } from '@/components/ChatView'
import { EmptyState } from '@/components/EmptyState'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useConversations } from '@/hooks/useConversations'

export default function App() {
  const { conversations, selected, selectedId, setSelectedId, messages, metrics } =
    useConversations()

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen flex-col overflow-hidden">
        <Header metrics={metrics} />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <main className="min-h-0 min-w-0 flex-1">
            {selected ? (
              <ChatView conversation={selected} messages={messages} />
            ) : (
              <EmptyState />
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
