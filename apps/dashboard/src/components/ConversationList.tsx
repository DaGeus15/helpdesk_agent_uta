import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { PanelLeftClose, Search } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  collapsed?: boolean
  onToggleCollapse?: () => void
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
  onToggleCollapse,
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
        // 300px < 1440, 320px ≥ 1440; full width en móvil
        'flex h-full min-h-0 w-full shrink-0 flex-col border-r border-[var(--uta-hairline)] bg-[#fbfcfe] md:w-[300px] min-[1440px]:w-[320px]',
        className,
      )}
    >
      <div className="shrink-0 space-y-2 border-b border-[var(--uta-hairline)] bg-white/80 px-3 py-2 backdrop-blur-md">
        <div className="flex h-7 items-center justify-between gap-2">
          <h2 className="truncate text-[13px] font-semibold tracking-tight text-[var(--uta-text)]">
            Conversaciones
            <span className="ml-1.5 font-normal tabular-nums text-[var(--uta-text-muted)]">
              {filtered.length}/{conversations.length}
            </span>
          </h2>
          {onToggleCollapse && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="hidden h-7 w-7 rounded-lg lg:inline-flex"
              onClick={onToggleCollapse}
              aria-label="Colapsar lista de conversaciones"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--uta-text-muted)]" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar conversaciones"
            className="h-9 rounded-xl border-transparent bg-[#eef1f6] pl-8 pr-9 text-[13px] shadow-none focus-visible:border-[rgba(30,79,163,0.25)] focus-visible:bg-white focus-visible:ring-[rgba(30,79,163,0.25)]"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-[var(--uta-hairline)] bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-[var(--uta-text-muted)]">
            /
          </kbd>
        </div>

        <div
          role="tablist"
          aria-label="Filtrar por estado"
          className="relative grid h-8 grid-cols-5 gap-0.5 rounded-xl bg-[#e8ecf3] p-0.5"
        >
          <span
            aria-hidden
            className="absolute top-0.5 bottom-0.5 rounded-lg bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] transition-ui"
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
                'relative z-10 flex items-center justify-center gap-0.5 truncate rounded-lg px-0.5 text-[10px] font-semibold transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(30,79,163,0.35)] active:scale-[0.97]',
                stateFilter === f.id
                  ? 'text-[var(--uta-primary)]'
                  : 'text-[var(--uta-text-muted)] hover:text-[var(--uta-text)]',
              )}
              title={`${f.label} (${filterCounts[f.id]})`}
            >
              <span className="truncate">{f.label.split(' ')[0]}</span>
              <span
                className={cn(
                  'inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[9px] tabular-nums',
                  stateFilter === f.id
                    ? 'bg-[var(--uta-primary-soft)] text-[var(--uta-primary)]'
                    : 'bg-black/5 text-[var(--uta-text-muted)]',
                )}
              >
                {filterCounts[f.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
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
