import { ImageOff } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface DocImageProps {
  src: string
  alt: string
  className?: string
}

export function DocImage({ src, alt, className }: DocImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = Boolean(src) && failedSrc === src

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white/70',
          className,
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <ImageOff className="size-7" />
          <span className="text-[10px] font-semibold uppercase tracking-widest">Dokumentasi</span>
        </div>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={cn('object-cover', className)}
    />
  )
}
