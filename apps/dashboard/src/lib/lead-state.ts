import { AlertTriangle, Flame, HelpCircle, Rocket, Sparkles, type LucideIcon } from 'lucide-react'
import type { LeadState } from '@/types'

export interface LeadStateMeta {
  label: string
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
    color: 'text-[#1E4FA3]',
    dot: 'bg-[#1E4FA3]',
    bg: 'bg-[#E8EFFA] text-[#0A2A5E] border-[#c5d5ef]',
    bar: 'bg-[#1E4FA3]',
    Icon: Sparkles,
  },
  dudoso: {
    label: 'Dudoso',
    color: 'text-amber-700',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    bar: 'bg-amber-500',
    Icon: HelpCircle,
  },
  frustrado: {
    label: 'Frustrado',
    color: 'text-red-700',
    dot: 'bg-red-600',
    bg: 'bg-red-50 text-red-700 border-red-200',
    bar: 'bg-red-600',
    Icon: Flame,
  },
  lead_caliente: {
    label: 'Lead caliente',
    color: 'text-emerald-700',
    dot: 'bg-emerald-600',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    bar: 'bg-emerald-600',
    Icon: Rocket,
  },
}

/** Alias icon for frustration alerts (badge / warnings) */
export const FrustrationIcon = AlertTriangle

export function getLeadStateMeta(state: LeadState): LeadStateMeta {
  return LEAD_STATE_META[state]
}

const AVATAR_COLORS = ['#0A2A5E', '#1E4FA3', '#0F766E', '#B45309', '#9F1239', '#4338CA', '#0369A1']

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
