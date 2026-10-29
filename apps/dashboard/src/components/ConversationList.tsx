import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { ConversationCard } from '@/components/ConversationCard'
import { LEAD_STATE_META } from '@/lib/lead-state'
import { cn } from '@/lib/utils'
import type { ConversationWithPreview } from '@/hooks/useConversations'
import type { LeadState } from '@/types'

interface ConversationListProps {
  conversations: ConversationWithPreview[]
  selectedId: string | null
  unread: Record<string, number>
  onSelect: (id: string) => void
}

const FILTERS: Array<{ id: 'all' | LeadState; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'interesado', label: LEAD_STATE_META.interesado.label },
  { id: 'dudoso', label: LEAD_STATE_META.dudoso.label },
  { id: 'frustrado', label: LEAD_STATE_META.frustrado.label },
  { id: 'lead_caliente', label: LEAD_STATE_META.lead_caliente.label },
]

export function ConversationList({
  conversations,
  selectedId,
  unread,
  onSelect,
}: ConversationListProps) {
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<'all' | LeadState>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations.filter((c) => {
      if (stateFilter !== 'all' && c.lead_state !== stateFilter) return false
      if (!q) return true
      const name = (c.display_name ?? '').toLowerCase()
      const user = (c.telegram_username ?? '').toLowerCase()
      return name.includes(q) || user.includes(q)
    })
  }, [conversations, query, stateFilter])

  return (
    <aside className="flex h-full w-full flex-col border-r bg-card md:w-[360px] md:shrink-0">
      <div className="space-y-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Conversaciones</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} de {conversations.length}
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o usuario…"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStateFilter(f.id)}
              className={cn(
                'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                stateFilter === f.id
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1.5 p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No hay conversaciones con ese filtro.
            </p>
          ) : (
            filtered.map((c) => (
              <ConversationCard
                key={c.id}
                conversation={c}
                selected={c.id === selectedId}
                unread={unread[c.id] ?? 0}
                onSelect={() => onSelect(c.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
