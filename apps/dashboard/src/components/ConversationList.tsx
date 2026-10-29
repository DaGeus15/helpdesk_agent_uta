import { ScrollArea } from '@/components/ui/scroll-area'
import { ConversationCard } from '@/components/ConversationCard'
import type { ConversationWithPreview } from '@/hooks/useConversations'

interface ConversationListProps {
  conversations: ConversationWithPreview[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  return (
    <aside className="flex h-full w-full flex-col border-r bg-card md:w-[360px] md:shrink-0">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Conversaciones</h2>
        <p className="text-xs text-muted-foreground">{conversations.length} activas</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1.5 p-2">
          {conversations.map((c) => (
            <ConversationCard
              key={c.id}
              conversation={c}
              selected={c.id === selectedId}
              onSelect={() => onSelect(c.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}
