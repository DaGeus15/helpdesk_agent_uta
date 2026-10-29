import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { ConversationCard, needsAdvisor } from '@/components/ConversationCard'
import { LEAD_STATE_META } from '@/lib/lead-state'
import { cn } from '@/lib/utils'
import type { ConversationWithPreview } from '@/hooks/useConversations'
import type { LeadState } from '@/types'

interface ConversationListProps {
  conversations: ConversationWithPreview[]
  selectedId: string | null
  unread: Record<string, number>
  loading?: boolean
  onSelect: (id: string) => void
  className?: string
}

const FILTERS: Array<{ id: 'all' | LeadState; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'interesado', label: LEAD_STATE_META.interesado.label },
  { id: 'dudoso', label: LEAD_STATE_META.dudoso.label },
  { id: 'frustrado', label: LEAD_STATE_META.frustrado.label },
  { id: 'lead_caliente', label: LEAD_STATE_META.lead_caliente.label },
]

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-[var(--uta-border)] bg-white px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <div className="size-9 shrink-0 rounded-full bg-slate-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex justify-between gap-2">
            <div className="h-3.5 w-28 rounded bg-slate-200" />
            <div className="h-3 w-10 rounded bg-slate-100" />
          </div>
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-2/3 rounded bg-slate-100" />
          <div className="h-5 w-20 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

export function ConversationList({
  conversations,
  selectedId,
  unread,
  loading = false,
  onSelect,
  className,
}: ConversationListProps) {
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<'all' | LeadState>('all')
  const [now, setNow] = useState(() => Date.now())
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set())
  const prevActivityRef = useRef<Map<string, string>>(new Map())
  const primedRef = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const prev = prevActivityRef.current
    const nextFlash = new Set<string>()

    for (const c of conversations) {
      const prevAt = prev.get(c.id)
      if (primedRef.current && prevAt && prevAt !== c.last_message_at) {
        nextFlash.add(c.id)
      }
      prev.set(c.id, c.last_message_at)
    }

    if (!primedRef.current && conversations.length > 0) {
      primedRef.current = true
    }

    if (nextFlash.size === 0) return

    setFlashIds((cur) => {
      const merged = new Set(cur)
      nextFlash.forEach((id) => merged.add(id))
      return merged
    })

    const timer = window.setTimeout(() => {
      setFlashIds((cur) => {
        const cleaned = new Set(cur)
        nextFlash.forEach((id) => cleaned.delete(id))
        return cleaned
      })
    }, 900)

    return () => window.clearTimeout(timer)
  }, [conversations])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = conversations.filter((c) => {
      if (stateFilter !== 'all' && c.lead_state !== stateFilter) return false
      if (!q) return true
      const name = (c.display_name ?? '').toLowerCase()
      const user = (c.telegram_username ?? '').toLowerCase()
      return name.includes(q) || user.includes(q)
    })

    return [...list].sort((a, b) => {
      const aAlert = needsAdvisor(a) ? 1 : 0
      const bAlert = needsAdvisor(b) ? 1 : 0
      if (aAlert !== bAlert) return bAlert - aAlert
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    })
  }, [conversations, query, stateFilter])

  const filterCounts = useMemo(() => {
    const counts: Record<'all' | LeadState, number> = {
      all: conversations.length,
      interesado: 0,
      dudoso: 0,
      frustrado: 0,
      lead_caliente: 0,
    }
    for (const c of conversations) {
      counts[c.lead_state] += 1
    }
    return counts
  }, [conversations])

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-r border-[var(--uta-border)] bg-white md:w-[360px] md:shrink-0',
        className,
      )}
    >
      <div className="panel-header space-y-2 border-b border-[var(--uta-border)] px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--uta-text)]">Conversaciones</h2>
          <p className="text-xs text-[var(--uta-text-muted)]">
            {filtered.length} visibles · {conversations.length} total
            {stateFilter !== 'all' ? ` · filtro: ${filterCounts[stateFilter]}` : ''}
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--uta-text-muted)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o usuario…"
            className="h-9 pl-8 text-[13px]"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStateFilter(f.id)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-ui',
                stateFilter === f.id
                  ? 'border-[var(--uta-primary)] bg-[var(--uta-primary-soft)] text-[var(--uta-primary)]'
                  : 'border-[var(--uta-border)] bg-white text-[var(--uta-text-muted)] hover:bg-[var(--uta-bg)]',
              )}
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-70">{filterCounts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-2">
          {loading && conversations.length === 0 ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-[var(--uta-text-muted)]">
              {conversations.length === 0
                ? 'Aún no hay conversaciones — escribe al bot @HelpdeskUTA15Bot'
                : 'No hay conversaciones con ese filtro.'}
            </p>
          ) : (
            filtered.map((c) => (
              <ConversationCard
                key={c.id}
                conversation={c}
                selected={c.id === selectedId}
                unread={unread[c.id] ?? 0}
                flash={flashIds.has(c.id)}
                now={now}
                onSelect={() => onSelect(c.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
