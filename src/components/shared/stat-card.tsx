import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

type Accent = 'primary' | 'sky' | 'amber' | 'rose' | 'violet'

const accents: Record<Accent, { icon: string; bar: string }> = {
  primary: {
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  sky: {
    icon: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
    bar: 'bg-rose-500',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
}

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
  accent?: Accent
  trend?: { value: string; direction: 'up' | 'down'; positive?: boolean }
  className?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 'primary',
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn('group relative overflow-hidden p-4 sm:p-5', className)}>
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-0.5 opacity-70',
          accents[accent].bar,
        )}
      />
      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-snug tracking-[0.09em] text-muted-foreground sm:text-[11px]">
            {label}
          </p>
          <p className="mt-2 text-[24px] font-extrabold leading-none tracking-tight text-foreground tabular-nums sm:text-[26px]">
            {value}
          </p>
        </div>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 sm:size-10',
            accents[accent].icon,
          )}
        >
          <Icon className="size-4 sm:size-[18px]" />
        </span>
      </div>
      <div className="mt-3 flex min-w-0 items-center gap-2">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-bold',
              trend.positive === false ? 'text-rose-600' : 'text-emerald-600',
            )}
          >
            {trend.direction === 'up' ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {trend.value}
          </span>
        ) : null}
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </Card>
  )
}
