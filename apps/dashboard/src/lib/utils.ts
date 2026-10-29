import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diffMs = now - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`

  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export function truncate(text: string, max = 72): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}
