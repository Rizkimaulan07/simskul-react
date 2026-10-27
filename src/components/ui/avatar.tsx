import { cn, initials } from '@/lib/utils'
import { getAvatarGradient } from '@/lib/theme'

interface AvatarProps {
  name: string
  id?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  xs: 'size-7 text-[10px]',
  sm: 'size-9 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
}

export function Avatar({ name, id, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white shadow-sm ring-2 ring-white/70 dark:ring-white/10',
        getAvatarGradient(id ?? name),
        sizeClasses[size],
        className,
      )}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}
