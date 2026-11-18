import type { Eskul } from '@/lib/types'
import { eskulThemes } from '@/lib/theme'
import { cn } from '@/lib/utils'

interface EskulMarkProps {
  eskul: Eskul
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'size-11 rounded-xl text-[10px]',
  md: 'size-12 rounded-2xl text-xs',
  lg: 'size-16 rounded-2xl text-sm',
}

export function EskulMark({ eskul, size = 'md', className }: EskulMarkProps) {
  const theme = eskulThemes[eskul.color]
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br font-extrabold tracking-[0.08em] text-white shadow-md shadow-slate-950/10',
        theme.gradient,
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {eskul.logoUrl ? (
        <img src={eskul.logoUrl} alt="" className="size-full scale-150 bg-white object-contain" />
      ) : (
        eskul.shortName
      )}
    </div>
  )
}
