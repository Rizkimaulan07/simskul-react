import {
  Bell,
  CalendarCheck2,
  CalendarX2,
  CheckCheck,
  ClipboardCheck,
  FileSignature,
  Inbox,
  ShieldAlert,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAppStore, useCurrentUser } from '@/lib/store'
import { cn, formatRelative, todayISO } from '@/lib/utils'

type Tone = 'amber' | 'sky' | 'emerald' | 'violet' | 'rose'

interface NotificationItem {
  id: string
  title: string
  description: string
  meta: string
  to: string
  icon: LucideIcon
  tone: Tone
  priority: number
}

const toneStyles: Record<Tone, { icon: string; dot: string }> = {
  amber: {
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  sky: {
    icon: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
}

const storageKey = (userId: string) => `simskul-notifications-${userId}`

function isWithinDays(isoDate: string, days: number) {
  const timestamp = new Date(isoDate).getTime()
  if (!Number.isFinite(timestamp)) return false
  return Date.now() - timestamp < days * 24 * 60 * 60 * 1000
}

export function NotificationCenter() {
  const user = useCurrentUser()
  const eskul = useAppStore((state) => state.eskul)
  const sessions = useAppStore((state) => state.sessions)
  const permits = useAppStore((state) => state.permits)
  const achievements = useAppStore((state) => state.achievements)
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (!user) return new Set()
    try {
      const raw = window.localStorage.getItem(storageKey(user.id))
      const parsed = raw ? (JSON.parse(raw) as unknown) : []
      return Array.isArray(parsed)
        ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
        : new Set()
    } catch {
      return new Set()
    }
  })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const notifications = useMemo<NotificationItem[]>(() => {
    if (!user) return []
    const today = todayISO()
    const items: NotificationItem[] = []
    const eskulById = new Map(eskul.map((item) => [item.id, item]))
    const scopedPermits = permits.filter(
      (permit) => user.role === 'admin' || permit.eskulId === user.eskulId,
    )
    const scopedSessions = sessions.filter(
      (session) => user.role === 'admin' || session.eskulId === user.eskulId,
    )

    if (user.role === 'admin' || user.role === 'wakasek') {
      for (const permit of permits.filter((item) => item.status === 'diajukan')) {
        items.push({
          id: `permit-pending-${permit.id}`,
          title:
            user.role === 'admin'
              ? 'Pengajuan izin menunggu keputusan'
              : 'Pengajuan izin baru',
          description: `${eskulById.get(permit.eskulId)?.name ?? 'Eskul'} · ${permit.title}`,
          meta: formatRelative(permit.createdAt),
          to: `/surat/${permit.id}`,
          icon: ClipboardCheck,
          tone: 'amber',
          priority: 100,
        })
      }
    }

    if (user.role === 'wakasek') {
      for (const permit of permits.filter((item) => item.status === 'disetujui')) {
        items.push({
          id: `permit-sign-${permit.id}`,
          title: 'Surat siap dicetak & ditandatangani',
          description: `${eskulById.get(permit.eskulId)?.name ?? 'Eskul'} · ${permit.title}`,
          meta: permit.decidedAt ? formatRelative(permit.decidedAt) : 'Sudah disetujui',
          to: `/surat/${permit.id}`,
          icon: FileSignature,
          tone: 'violet',
          priority: 90,
        })
      }
    }

    if (user.role === 'ketua') {
      for (const session of scopedSessions.filter(
        (item) => item.coachPresent === false && item.date >= today,
      )) {
        items.push({
          id: `session-delegated-${session.id}`,
          title: 'Presensi dititipkan kepada Anda',
          description: `${eskulById.get(session.eskulId)?.name ?? 'Eskul'} · ${session.topic}`,
          meta: `${session.date === today ? 'Hari ini' : formatRelative(`${session.date}T${session.startTime}:00`)} · ${session.startTime}`,
          to: `/sesi/${session.id}`,
          icon: ShieldAlert,
          tone: 'amber',
          priority: 95,
        })
      }
    }

    if (user.role === 'pelatih' || user.role === 'ketua' || user.role === 'admin') {
      for (const session of scopedSessions.filter((item) => item.date === today)) {
        const filled = session.attendance.length > 0
        items.push({
          id: `session-today-${session.id}`,
          title:
            user.role === 'admin'
              ? 'Sesi berlangsung hari ini'
              : filled
                ? 'Sesi hari ini sudah diisi'
                : 'Presensi sesi hari ini belum diisi',
          description: `${eskulById.get(session.eskulId)?.name ?? 'Eskul'} · ${session.topic}`,
          meta: `${session.startTime} – ${session.endTime} · ${session.location}`,
          to: `/sesi/${session.id}`,
          icon: filled ? CalendarCheck2 : CalendarX2,
          tone: filled ? 'emerald' : 'sky',
          priority: filled ? 60 : 85,
        })
      }
    }

    if (user.role === 'pelatih') {
      const missed = scopedSessions
        .filter(
          (session) =>
            session.date < today &&
            session.attendance.length === 0 &&
            session.staffAttendance.length === 0,
        )
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 2)
      for (const session of missed) {
        items.push({
          id: `session-missed-${session.id}`,
          title: 'Presensi sesi lampau belum diisi',
          description: `${eskulById.get(session.eskulId)?.name ?? 'Eskul'} · ${session.topic}`,
          meta: formatRelative(`${session.date}T${session.startTime}:00`),
          to: `/sesi/${session.id}`,
          icon: CalendarX2,
          tone: 'rose',
          priority: 80,
        })
      }
    }

    if (user.role === 'pelatih' || user.role === 'ketua') {
      for (const permit of scopedPermits
        .filter((item) => item.status === 'disetujui' || item.status === 'ditolak')
        .sort((a, b) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt))
        .slice(0, 3)) {
        items.push({
          id: `permit-decision-${permit.id}-${permit.status}`,
          title:
            permit.status === 'disetujui'
              ? 'Pengajuan izin disetujui'
              : 'Pengajuan izin ditolak',
          description: `${eskulById.get(permit.eskulId)?.name ?? 'Eskul'} · ${permit.title}`,
          meta: permit.decidedAt ? formatRelative(permit.decidedAt) : 'Keputusan admin',
          to: `/surat/${permit.id}`,
          icon: FileSignature,
          tone: permit.status === 'disetujui' ? 'emerald' : 'rose',
          priority: 70,
        })
      }
    }

    const latestAchievement = achievements
      .filter((achievement) => user.role === 'admin' || achievement.eskulId === user.eskulId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    const achievementIsRecent =
      latestAchievement !== undefined && isWithinDays(latestAchievement.createdAt, 7)
    if (latestAchievement && achievementIsRecent) {
      items.push({
        id: `achievement-${latestAchievement.id}`,
        title: 'Prestasi baru tercatat',
        description: `${eskulById.get(latestAchievement.eskulId)?.name ?? 'Eskul'} · ${latestAchievement.title}`,
        meta: formatRelative(latestAchievement.createdAt),
        to: '/prestasi',
        icon: Trophy,
        tone: 'violet',
        priority: 50,
      })
    }

    return items.sort((a, b) => b.priority - a.priority).slice(0, 10)
  }, [achievements, eskul, permits, sessions, user])

  const unreadCount = notifications.filter((item) => !readIds.has(item.id)).length

  if (!user) return null

  const persist = (next: Set<string>) => {
    setReadIds(next)
    try {
      window.localStorage.setItem(storageKey(user.id), JSON.stringify([...next]))
    } catch {
      // Storage can be unavailable in private browsing; the badge still works in memory.
    }
  }

  const markRead = (id: string) => {
    if (readIds.has(id)) return
    const next = new Set(readIds)
    next.add(id)
    persist(next)
  }

  const markAllRead = () => {
    persist(new Set([...readIds, ...notifications.map((item) => item.id)]))
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'relative flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground',
          open && 'border-primary/30 bg-primary/[0.06] text-primary',
        )}
        aria-label="Notifikasi"
        aria-expanded={open}
        title="Notifikasi"
      >
        <Bell className="size-[17px]" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white ring-2 ring-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Pusat notifikasi"
          className="page-enter fixed inset-x-4 top-[4.25rem] z-50 overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[min(380px,calc(100vw-2rem))]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">Notifikasi</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} notifikasi belum dibaca`
                  : 'Semua notifikasi sudah dibaca'}
              </p>
            </div>
            {unreadCount > 0 ? (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px]" onClick={markAllRead}>
                <CheckCheck className="size-3.5" />
                Tandai dibaca
              </Button>
            ) : null}
          </div>

          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Inbox className="size-5" />
                </span>
                <p className="mt-3 text-xs font-bold text-foreground">Tidak ada notifikasi</p>
                <p className="mt-1 max-w-56 text-[11px] leading-relaxed text-muted-foreground">
                  Pengingat sesi, presensi, dan surat izin akan tampil di sini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {notifications.map((item) => {
                  const Icon = item.icon
                  const tone = toneStyles[item.tone]
                  const isUnread = !readIds.has(item.id)
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => {
                        markRead(item.id)
                        setOpen(false)
                      }}
                      className={cn(
                        'group flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
                        isUnread && 'bg-primary/[0.035]',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl',
                          tone.icon,
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="min-w-0 flex-1 text-[11px] font-bold leading-snug text-foreground group-hover:text-primary">
                            {item.title}
                          </p>
                          {isUnread ? (
                            <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', tone.dot)} />
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {item.description}
                        </p>
                        <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/60">
                          {item.meta}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border/70 bg-muted/25 px-4 py-2.5 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              Notifikasi disimpan di perangkat ini
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
