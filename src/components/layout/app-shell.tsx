import {
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  FileSignature,
  GraduationCap,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  School,
  Settings,
  Sun,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { NotificationCenter } from '@/components/layout/notification-center'
import { Avatar } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Logo } from '@/components/shared/brand'
import { useTheme } from '@/hooks/use-theme'
import { ACADEMIC_YEAR, ROLE_LABELS, SCHOOL_NAME } from '@/lib/constants'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { Role } from '@/lib/types'
import { cn, firstName } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/eskul', label: 'Data Eskul', icon: School },
    { to: '/sesi', label: 'Sesi & Presensi', icon: CalendarCheck2 },
    { to: '/kalender', label: 'Kalender Kegiatan', icon: CalendarRange },
    { to: '/surat', label: 'Surat Izin', icon: FileSignature },
    { to: '/prestasi', label: 'Prestasi Eskul', icon: Trophy },
    { to: '/laporan', label: 'Laporan & Nilai', icon: TrendingUp },
    { to: '/dokumentasi', label: 'Galeri Eskul', icon: Images },
    { to: '/admin', label: 'Manajemen Pengguna', icon: UserCog },
  ],
  pelatih: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/sesi', label: 'Sesi & Presensi', icon: CalendarCheck2 },
    { to: '/kalender', label: 'Kalender Kegiatan', icon: CalendarRange },
    { to: '/anggota', label: 'Data Anggota', icon: Users },
    { to: '/nilai', label: 'Penilaian', icon: GraduationCap },
    { to: '/prestasi', label: 'Prestasi Eskul', icon: Trophy },
    { to: '/dokumentasi', label: 'Dokumentasi', icon: Images },
    { to: '/surat', label: 'Surat Izin', icon: FileSignature },
  ],
  ketua: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/sesi', label: 'Sesi & Presensi', icon: CalendarCheck2 },
    { to: '/kalender', label: 'Kalender Kegiatan', icon: CalendarRange },
    { to: '/anggota', label: 'Data Anggota', icon: Users },
    { to: '/prestasi', label: 'Prestasi Eskul', icon: Trophy },
    { to: '/dokumentasi', label: 'Dokumentasi', icon: Images },
    { to: '/surat', label: 'Surat Izin', icon: FileSignature },
  ],
  wakasek: [{ to: '/surat', label: 'Surat Izin', icon: FileSignature }],
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/sesi': 'Sesi & Presensi',
  '/kalender': 'Kalender Kegiatan',
  '/anggota': 'Data Anggota',
  '/nilai': 'Penilaian',
  '/prestasi': 'Prestasi Eskul',
  '/dokumentasi': 'Dokumentasi',
  '/surat': 'Surat Izin',
  '/laporan': 'Laporan & Nilai',
  '/eskul': 'Data Eskul',
  '/admin': 'Manajemen Pengguna',
  '/profil': 'Profil & Keamanan',
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith('/sesi/')) return 'Detail Sesi'
  if (pathname.startsWith('/eskul/')) return 'Detail Eskul'
  if (pathname.startsWith('/surat/')) return 'Detail Surat Izin'
  return pageTitles[pathname] ?? 'SIMSKUL'
}

const TODAY_LABEL = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}).format(new Date())

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser()
  const eskul = useAppStore((state) => state.eskul)
  const permits = useAppStore((state) => state.permits)
  const logout = useAppStore((state) => state.logout)

  if (!user) return null

  const navItems = navByRole[user.role]
  const userEskul = eskul.find((item) => item.id === user.eskulId)
  const pendingCount = permits.filter(
    (permit) =>
      permit.status === 'diajukan' &&
      (user.role === 'admin' || permit.eskulId === user.eskulId),
  ).length

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 shrink-0 items-center justify-between px-5">
        <Link to="/" onClick={onNavigate} aria-label="SIMSKUL">
          <Logo />
        </Link>
        {onNavigate ? (
          <Button variant="ghost" size="iconSm" onClick={onNavigate} aria-label="Tutup menu">
            <X />
          </Button>
        ) : null}
      </div>

      <div className="px-4">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50/70 to-white p-3.5 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:via-teal-500/5 dark:to-transparent">
          <div className="absolute -right-4 -top-5 size-16 rounded-full bg-emerald-200/40 blur-xl dark:bg-emerald-500/15" />
          <div className="relative flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm dark:bg-white/10 dark:text-emerald-300">
              <School className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-emerald-950 dark:text-emerald-50">
                {SCHOOL_NAME}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700/60 dark:text-emerald-200/50">
                Tahun Ajaran {ACADEMIC_YEAR}
              </p>
            </div>
          </div>
        </div>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="scrollbar-soft mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4"
      >
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
          Menu Utama
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const showBadge = item.to === '/surat' && pendingCount > 0
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground',
                      isActive &&
                        'bg-primary/[0.08] text-primary hover:bg-primary/[0.1] hover:text-primary dark:bg-primary/15 dark:text-primary',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'absolute left-0 h-5 w-[3px] rounded-r-full bg-primary opacity-0 transition-opacity',
                          isActive && 'opacity-100',
                        )}
                      />
                      <Icon
                        className={cn(
                          'size-[18px] text-muted-foreground/80 transition-colors group-hover:text-foreground',
                          isActive && 'text-primary',
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {showBadge ? (
                        <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm">
                          {pendingCount}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Link
              to="/profil"
              onClick={onNavigate}
              className="group flex min-w-0 flex-1 items-center gap-2.5"
              title="Buka profil"
            >
              <Avatar name={user.name} id={user.id} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground group-hover:text-primary">
                  {user.name}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
                  {ROLE_LABELS[user.role]}
                  {userEskul ? ` · ${userEskul.name}` : ''}
                </p>
              </div>
            </Link>
            <Link
              to="/profil"
              onClick={onNavigate}
              title="Profil & keamanan"
              aria-label="Profil & keamanan"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'iconSm' }),
                'text-muted-foreground hover:text-foreground',
              )}
            >
              <Settings />
            </Link>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={logout}
              title="Keluar"
              aria-label="Keluar"
              className="text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
            >
              <LogOut />
            </Button>
          </div>
          {user.role !== 'admin' && userEskul ? (
            <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Eskul Anda
              </span>
              <span className="text-[11px] font-bold text-foreground">{userEskul.name}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Topbar({
  onOpenMenu,
  menuOpen,
}: {
  onOpenMenu: () => void
  menuOpen: boolean
}) {
  const user = useCurrentUser()
  const eskul = useAppStore((state) => state.eskul)
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const title = getPageTitle(location.pathname)

  if (!user) return null
  const userEskul = eskul.find((item) => item.id === user.eskulId)

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl print:hidden">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="outline"
            size="iconSm"
            className="lg:hidden"
            onClick={onOpenMenu}
            aria-label="Buka menu navigasi"
            aria-expanded={menuOpen}
            aria-controls="mobile-sidebar"
          >
            <Menu />
          </Button>
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <span className="hidden font-semibold text-muted-foreground sm:inline">SIMSKUL</span>
            <span className="hidden text-muted-foreground/40 sm:inline">/</span>
            <span className="truncate font-bold text-foreground">{title}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm md:inline-flex">
            <CalendarDays className="size-3.5 text-primary" />
            {TODAY_LABEL}
          </span>
          <NotificationCenter key={user.id} />
          <Button
            variant="outline"
            size="iconSm"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Link
            to="/profil"
            className="group ml-0.5 hidden items-center gap-2.5 border-l border-border/70 pl-3 sm:flex"
            title="Buka profil & keamanan"
          >
            <Avatar name={user.name} id={user.id} size="sm" />
            <div className="max-w-32">
              <p className="truncate text-xs font-bold leading-tight text-foreground group-hover:text-primary">
                {firstName(user.name)}
              </p>
              <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
                {userEskul ? userEskul.name : user.role === 'admin' ? 'Administrasi' : 'Kesiswaan'}
              </p>
            </div>
          </Link>
          <Link to="/profil" className="sm:hidden" aria-label="Buka profil">
            <Avatar name={user.name} id={user.id} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  return (
    <div className="min-h-dvh bg-background print:bg-white">
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="mobile-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[288px] max-w-[85vw] border-r border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-300 ease-out print:hidden lg:max-w-none lg:translate-x-0 lg:shadow-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent onNavigate={mobileOpen ? () => setMobileOpen(false) : undefined} />
      </aside>

      <div className="lg:pl-[288px] print:pl-0">
        <Topbar onOpenMenu={() => setMobileOpen(true)} menuOpen={mobileOpen} />
        <main className="page-enter mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
        <footer className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-2 border-t border-border/60 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-[10px] text-muted-foreground sm:flex-row sm:px-6 sm:text-left lg:px-8 print:hidden">
          <p>
            <span className="font-bold text-foreground">SIMSKUL</span> · Sistem Informasi Manajemen
            Eskul
          </p>
        </footer>
      </div>
    </div>
  )
}
