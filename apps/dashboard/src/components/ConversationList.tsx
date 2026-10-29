import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
    <div className="animate-pulse rounded-2xl border border-[var(--uta-hairline)] bg-white px-3 py-2.5 shadow-[var(--uta-shadow-soft)]">
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

  const selectedFilterIndex = FILTERS.findIndex((f) => f.id === stateFilter)

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
        'flex h-full w-full flex-col border-r border-[var(--uta-hairline)] bg-[#fbfcfe] md:w-[360px] md:shrink-0',
        className,
      )}
    >
      <div className="panel-header space-y-3 border-b border-[var(--uta-hairline)] bg-white/80 px-4 py-3 backdrop-blur-md">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--uta-text)]">
            Conversaciones
          </h2>
          <p className="text-xs text-[var(--uta-text-muted)]">
            {filtered.length} visibles · {conversations.length} total
            {stateFilter !== 'all' ? ` · filtro: ${filterCounts[stateFilter]}` : ''}
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--uta-text-muted)]" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o usuario…"
            aria-label="Buscar conversaciones"
            className="h-10 rounded-xl border-transparent bg-[#eef1f6] pl-9 pr-10 text-[13px] shadow-none focus-visible:border-[rgba(30,79,163,0.25)] focus-visible:bg-white focus-visible:ring-[rgba(30,79,163,0.25)]"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-[var(--uta-hairline)] bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-[var(--uta-text-muted)]">
            /
          </kbd>
        </div>

        {/* Segmented control estilo iOS */}
        <div
          role="tablist"
          aria-label="Filtrar por estado"
          className="relative grid grid-cols-5 gap-0.5 rounded-xl bg-[#e8ecf3] p-1"
        >
          <span
            aria-hidden
            className="absolute top-1 bottom-1 rounded-lg bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] transition-ui"
            style={{
              width: `calc((100% - 0.25rem) / 5)`,
              left: `calc(0.125rem + ${Math.max(selectedFilterIndex, 0)} * ((100% - 0.25rem) / 5))`,
            }}
          />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={stateFilter === f.id}
              onClick={() => setStateFilter(f.id)}
              className={cn(
                'relative z-10 truncate rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-ui focus-visible:ring-2 focus-visible:ring-[rgba(30,79,163,0.35)] focus-visible:outline-none active:scale-[0.97]',
                stateFilter === f.id
                  ? 'text-[var(--uta-primary)]'
                  : 'text-[var(--uta-text-muted)] hover:text-[var(--uta-text)]',
              )}
              title={`${f.label} (${filterCounts[f.id]})`}
            >
              <span className="block truncate">{f.label.split(' ')[0]}</span>
              <span className="block tabular-nums opacity-70">{filterCounts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div
          ref={listRef}
          tabIndex={0}
          role="listbox"
          aria-label="Lista de conversaciones"
          onKeyDown={handleListKeyDown}
          className="flex flex-col gap-2 p-2 focus-visible:outline-none"
        >
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
            filtered.map((c, i) => (
              <div
                key={c.id}
                role="option"
                aria-selected={c.id === selectedId}
                data-focused={i === focusIndex || undefined}
                className={cn(
                  'rounded-2xl',
                  i === focusIndex && c.id !== selectedId && 'ring-2 ring-[rgba(30,79,163,0.2)]',
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
    </aside>
  )
}
