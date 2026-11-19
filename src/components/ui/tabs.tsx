import { cn } from '@/lib/utils'

interface TabItem {
  value: string
  label: string
  count?: number
}

interface TabsProps {
  items: TabItem[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  fullWidth?: boolean
}

export function Tabs({ items, value, onValueChange, className, fullWidth }: TabsProps) {
  return (
    <div
      className={cn(
        'no-scrollbar flex max-w-full flex-wrap items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/45 p-1 sm:flex-nowrap',
        fullWidth ? 'flex w-full' : 'w-fit',
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-muted-foreground transition-all hover:text-foreground sm:px-3 sm:text-xs',
              fullWidth ? 'flex-1' : 'shrink-0',
              active && 'bg-card text-foreground shadow-sm ring-1 ring-border/70',
            )}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                  active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
