import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  markOnly?: boolean
  subtitle?: string
  inverted?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const markSizes = {
  sm: 'size-9',
  md: 'size-10',
  lg: 'size-12',
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
      <img
        src="/brand/logo.png"
        alt="Logo SMK BPPI"
        className={cn(
          'shrink-0 select-none object-contain drop-shadow-sm',
          markSizes[size],
        )}
        draggable={false}
      />
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
