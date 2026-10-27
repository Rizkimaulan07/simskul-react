import type { EskulColor } from './types'

interface EskulTheme {
  gradient: string
  soft: string
  text: string
  dot: string
  border: string
  ring: string
  cover: string
}

export const eskulThemes: Record<EskulColor, EskulTheme> = {
  emerald: {
    gradient: 'from-emerald-500 via-teal-500 to-teal-700',
    soft: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-500/25',
    ring: 'ring-emerald-500/20',
    cover:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.28),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(13,148,136,0.65),transparent_55%),linear-gradient(135deg,#059669,#115e59)]',
  },
  sky: {
    gradient: 'from-sky-500 via-blue-500 to-blue-700',
    soft: 'bg-sky-50 dark:bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
    border: 'border-sky-200 dark:border-sky-500/25',
    ring: 'ring-sky-500/20',
    cover:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.28),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(2,132,199,0.65),transparent_55%),linear-gradient(135deg,#0284c7,#1e3a8a)]',
  },
  rose: {
    gradient: 'from-rose-500 via-pink-500 to-pink-700',
    soft: 'bg-rose-50 dark:bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    border: 'border-rose-200 dark:border-rose-500/25',
    ring: 'ring-rose-500/20',
    cover:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.28),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(225,29,72,0.6),transparent_55%),linear-gradient(135deg,#e11d48,#831843)]',
  },
  amber: {
    gradient: 'from-amber-400 via-orange-500 to-orange-600',
    soft: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-500/25',
    ring: 'ring-amber-500/20',
    cover:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.32),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(234,88,12,0.55),transparent_55%),linear-gradient(135deg,#f59e0b,#9a3412)]',
  },
  violet: {
    gradient: 'from-violet-500 via-purple-500 to-purple-700',
    soft: 'bg-violet-50 dark:bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500',
    border: 'border-violet-200 dark:border-violet-500/25',
    ring: 'ring-violet-500/20',
    cover:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.28),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(124,58,237,0.6),transparent_55%),linear-gradient(135deg,#7c3aed,#4c1d95)]',
  },
}

export const avatarGradients = [
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-rose-500 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-teal-600',
]

export function getAvatarGradient(id: string) {
  const total = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return avatarGradients[total % avatarGradients.length]
}
