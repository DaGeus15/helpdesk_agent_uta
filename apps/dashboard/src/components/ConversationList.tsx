import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { PanelLeftClose } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConversationCard, needsAdvisor } from '@/components/ConversationCard'
import { cn } from '@/lib/utils'
import type { ConversationWithPreview } from '@/hooks/useConversations'

interface ConversationListProps {
  conversations: ConversationWithPreview[]
  selectedId: string | null
  unread: Record<string, number>
  loading?: boolean
  onSelect: (id: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  className?: string
}

type FilterId = 'all' | 'attention' | 'leads' | 'frustrado' | 'dudoso' | 'operator'

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'attention', label: 'Requieren atención' },
  { id: 'leads', label: 'Leads' },
  { id: 'frustrado', label: 'Frustrados' },
  { id: 'dudoso', label: 'Dudosos' },
  { id: 'operator', label: 'Con operador' },
]

function matchesFilter(c: ConversationWithPreview, filter: FilterId): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'attention':
      return needsAdvisor(c)
    case 'leads':
      return c.lead_state === 'lead_caliente'
    case 'frustrado':
      return c.lead_state === 'frustrado'
    case 'dudoso':
      return c.lead_state === 'dudoso'
    case 'operator':
      return c.ai_paused
  }
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-md border-l-4 border-[var(--line)] bg-white px-3.5 py-3">
      <div className="mb-2 flex justify-between gap-2">
        <div className="h-3.5 w-28 rounded bg-[var(--line)]" />
        <div className="h-3 w-12 rounded bg-[var(--mist)]" />
      </div>
      <div className="mb-2 h-3 w-full rounded bg-[var(--mist)]" />
      <div className="flex gap-1">
        <div className="h-4 w-16 rounded bg-[var(--mist)]" />
        <div className="h-4 w-10 rounded bg-[var(--mist)]" />
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
  onToggleCollapse,
  className,
}: ConversationListProps) {
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<FilterId>('all')
  const [now, setNow] = useState(() => Date.now())
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set())
  const [focusIndex, setFocusIndex] = useState(0)
  const prevActivityRef = useRef<Map<string, string>>(new Map())
  const primedRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return
      }
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
      if (!matchesFilter(c, stateFilter)) return false
      if (!q) return true
      const name = (c.display_name ?? '').toLowerCase()
      const user = (c.telegram_username ?? '').toLowerCase()
      const preview = (c.last_message_preview ?? '').toLowerCase()
      return name.includes(q) || user.includes(q) || preview.includes(q)
    })

    return [...list].sort((a, b) => {
      const aAlert = needsAdvisor(a) ? 1 : 0
      const bAlert = needsAdvisor(b) ? 1 : 0
      if (aAlert !== bAlert) return bAlert - aAlert
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    })
  }, [conversations, query, stateFilter])

  const filterCounts = useMemo(() => {
    const counts = Object.fromEntries(FILTERS.map((f) => [f.id, 0])) as Record<FilterId, number>
    for (const c of conversations) {
      for (const f of FILTERS) {
        if (matchesFilter(c, f.id)) counts[f.id] += 1
      }
    }
    return counts
  }, [conversations])

  useEffect(() => {
    if (filtered.length === 0) {
      setFocusIndex(0)
      return
    }
    const idx = selectedId ? filtered.findIndex((c) => c.id === selectedId) : -1
    setFocusIndex(idx >= 0 ? idx : 0)
  }, [filtered, selectedId, stateFilter, query])

  function handleListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((i) => {
        const next = Math.min(i + 1, filtered.length - 1)
        onSelect(filtered[next].id)
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => {
        const next = Math.max(i - 1, 0)
        onSelect(filtered[next].id)
        return next
      })
    } else if (e.key === 'Enter' && filtered[focusIndex]) {
      e.preventDefault()
      onSelect(filtered[focusIndex].id)
    }
  }

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-full shrink-0 flex-col bg-[var(--mist)] md:w-[360px]',
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o mensaje"
            aria-label="Buscar conversación"
            className="h-10 min-h-10 rounded-md border-[var(--line)] bg-white text-[var(--ink)] shadow-none focus-visible:ring-[var(--red)]"
          />
          {onToggleCollapse && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="hidden h-9 w-9 shrink-0 rounded-md lg:inline-flex"
              onClick={onToggleCollapse}
              aria-label="Colapsar lista de conversaciones"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={stateFilter === f.id}
              onClick={() => setStateFilter(f.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-[13px] transition-ui focus-visible:outline-none',
                stateFilter === f.id
                  ? 'border-[var(--red)] bg-[var(--red)] font-medium text-white'
                  : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--red)]',
              )}
              title={`${f.label} (${filterCounts[f.id]})`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div
            ref={listRef}
            tabIndex={0}
            role="listbox"
            aria-label="Lista de conversaciones"
            onKeyDown={handleListKeyDown}
            className="flex flex-col gap-2 pr-1 focus-visible:outline-none"
          >
            {loading && conversations.length === 0 ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : filtered.length === 0 ? (
              <p className="px-1 py-8 text-center text-[13px] text-[var(--muted)]">
                {conversations.length === 0
                  ? 'Aún no hay conversaciones — escribe al bot @HelpdeskUTA15Bot'
                  : 'No hay conversaciones con ese filtro.'}
              </p>
            ) : (
              filtered.map((c, i) => (
                <div
                  key={c.id}
                  role="option"
                  aria-selected={c.id === selectedId}
                  data-focused={i === focusIndex || undefined}
                  className={cn(
                    i === focusIndex &&
                      c.id !== selectedId &&
                      'rounded-md ring-2 ring-[color-mix(in_srgb,var(--red)_35%,transparent)]',
                  )}
                >
                  <ConversationCard
                    conversation={c}
                    selected={c.id === selectedId}
                    unread={unread[c.id] ?? 0}
                    flash={flashIds.has(c.id)}
                    now={now}
                    onSelect={() => {
                      setFocusIndex(i)
                      onSelect(c.id)
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}
