import { ArrowLeft, Compass, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { Logo } from '@/components/shared/brand'
import { useCurrentUser } from '@/lib/store'
import { cn } from '@/lib/utils'

export function NotFoundPage() {
  const user = useCurrentUser()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <Logo />
      <div className="relative mt-10">
        <p className="text-[110px] font-extrabold leading-none tracking-[-0.06em] text-primary/10 sm:text-[150px]">
          404
        </p>
        <span className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-card text-primary shadow-lg ring-1 ring-border/70">
          <Compass className="size-7" />
        </span>
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Tautan yang Anda buka mungkin salah atau halaman sudah dipindahkan. Kembali ke dashboard
        untuk melanjutkan.
      </p>
      <Link to={user ? '/' : '/login'} className={cn(buttonVariants(), 'mt-6')}>
        <ArrowLeft />
        Kembali ke {user ? 'Dashboard' : 'Halaman Masuk'}
      </Link>
    </div>
  )
}

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
        <LockKeyhole className="size-7" />
      </span>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-rose-600">
        403 · Akses dibatasi
      </p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
        Anda tidak memiliki akses
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Peran Anda tidak diizinkan membuka halaman ini. Hubungi pelatih atau wakasek kesiswaan
        jika Anda merasa ini sebuah kekeliruan.
      </p>
      <Link to="/" className={cn(buttonVariants(), 'mt-6')}>
        <ArrowLeft />
        Kembali ke Dashboard
      </Link>
    </div>
  )
}
