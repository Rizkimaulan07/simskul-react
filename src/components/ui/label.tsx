import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('text-[13px] font-semibold leading-none text-foreground', className)}
      {...props}
    />
  )
}
