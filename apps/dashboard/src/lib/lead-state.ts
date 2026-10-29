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
  Icon: LucideIcon
}

export const LEAD_STATE_META: Record<LeadState, LeadStateMeta> = {
  interesado: {
    label: 'Interesado',
    color: 'text-blue-600',
    dot: 'bg-blue-600',
    bg: 'bg-blue-50 text-blue-700 border-blue-100',
    Icon: Sparkles,
  },
  dudoso: {
    label: 'Dudoso',
    color: 'text-amber-600',
    dot: 'bg-amber-600',
    bg: 'bg-amber-50 text-amber-800 border-amber-100',
    Icon: HelpCircle,
  },
  frustrado: {
    label: 'Frustrado',
    color: 'text-red-600',
    dot: 'bg-red-600',
    bg: 'bg-red-50 text-red-700 border-red-100',
    Icon: Flame,
  },
  lead_caliente: {
    label: 'Lead caliente',
    color: 'text-emerald-600',
    dot: 'bg-emerald-600',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Icon: Rocket,
  },
}

/** Alias icon for frustration alerts (badge / warnings) */
export const FrustrationIcon = AlertTriangle

export function getLeadStateMeta(state: LeadState): LeadStateMeta {
  return LEAD_STATE_META[state]
}
