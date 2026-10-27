import { GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  markOnly?: boolean
  subtitle?: string
  inverted?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const markSizes = {
  sm: 'size-9 rounded-xl [&_svg]:size-5',
  md: 'size-10 rounded-xl [&_svg]:size-5',
  lg: 'size-12 rounded-2xl [&_svg]:size-6',
}

export function Logo({
  className,
  markOnly = false,
  subtitle = 'Manajemen Eskul',
  inverted = false,
  size = 'md',
}: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center bg-gradient-to-br from-emerald-500 via-teal-500 to-teal-700 text-white shadow-lg shadow-emerald-900/20',
          markSizes[size],
        )}
      >
        <GraduationCap strokeWidth={2.2} />
        <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-white bg-amber-400 dark:border-card" />
      </div>
      {markOnly ? null : (
        <div className="min-w-0">
          <p
            className={cn(
              'font-display text-[17px] font-extrabold leading-none tracking-tight',
              inverted ? 'text-white' : 'text-foreground',
            )}
          >
            SIMSKUL
          </p>
          <p
            className={cn(
              'mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em]',
              inverted ? 'text-white/55' : 'text-muted-foreground',
            )}
          >
            {subtitle}
          </p>
        </div>
      )}
    </div>
  )
}
