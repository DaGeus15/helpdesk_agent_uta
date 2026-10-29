import { AlertTriangle, Flame, HelpCircle, Rocket, Sparkles, type LucideIcon } from 'lucide-react'
import type { LeadState } from '@/types'

export interface LeadStateMeta {
  label: string
  emoji: string
  /** CSS color for state accent */
  colorHex: string
  /** Tailwind text color for icon */
  color: string
  /** Tailwind bg for thermometer dot */
  dot: string
  /** Soft background for chips */
  bg: string
  /** Segment bar color */
  bar: string
  Icon: LucideIcon
}

export const LEAD_STATE_META: Record<LeadState, LeadStateMeta> = {
  interesado: {
    label: 'Interesado',
    emoji: '🙂',
    colorHex: '#1f5fa8',
    color: 'text-[var(--state-interesado)]',
    dot: 'bg-[var(--state-interesado)]',
    bg: 'bg-[color-mix(in_srgb,var(--state-interesado)_13%,white)] text-[var(--ink)]',
    bar: 'bg-[var(--state-interesado)]',
    Icon: Sparkles,
  },
  dudoso: {
    label: 'Dudoso',
    emoji: '🤔',
    colorHex: '#c08a00',
    color: 'text-[var(--state-dudoso)]',
    dot: 'bg-[var(--state-dudoso)]',
    bg: 'bg-[color-mix(in_srgb,var(--state-dudoso)_13%,white)] text-[var(--ink)]',
    bar: 'bg-[var(--state-dudoso)]',
    Icon: HelpCircle,
  },
  frustrado: {
    label: 'Frustrado',
    emoji: '😤',
    colorHex: '#b70717',
    color: 'text-[var(--state-frustrado)]',
    dot: 'bg-[var(--state-frustrado)]',
    bg: 'bg-[color-mix(in_srgb,var(--state-frustrado)_13%,white)] text-[var(--ink)]',
    bar: 'bg-[var(--state-frustrado)]',
    Icon: Flame,
  },
  lead_caliente: {
    label: 'Lead caliente',
    emoji: '🔥',
    colorHex: '#1f8a3b',
    color: 'text-[var(--state-lead)]',
    dot: 'bg-[var(--state-lead)]',
    bg: 'bg-[color-mix(in_srgb,var(--state-lead)_13%,white)] text-[var(--ink)]',
    bar: 'bg-[var(--state-lead)]',
    Icon: Rocket,
  },
}

/** Alias icon for frustration alerts (badge / warnings) */
export const FrustrationIcon = AlertTriangle

export function getLeadStateMeta(state: LeadState): LeadStateMeta {
  return LEAD_STATE_META[state]
}

const AVATAR_COLORS = ['#012e5a', '#1f5fa8', '#ad272e', '#c08a00', '#1f8a3b', '#44425a']

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function avatarColorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
