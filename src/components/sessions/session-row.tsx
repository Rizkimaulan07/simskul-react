import { CalendarDays, ChevronRight, MapPin, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CoachPresenceBadge, EskulChip } from '@/components/shared/badges'
import type { Eskul, Session } from '@/lib/types'
import { getSessionLabel, getSessionStats } from '@/lib/selectors'
import { cn, parseDate } from '@/lib/utils'

interface SessionRowProps {
  session: Session
  eskul?: Eskul
  coachName: string
  canEdit: boolean
  showEskul?: boolean
  delegated?: boolean
}

function DateTile({ date }: { date: string }) {
  const parsed = parseDate(date)
  const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(parsed)
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(parsed)
  return (
    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-muted/25">
      <span className="text-base font-extrabold leading-none text-foreground">
        {parsed.getDate()}
      </span>
      <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
        {month} · {weekday}
      </span>
    </div>
  )
}

export function SessionRow({
  session,
  eskul,
  coachName,
  canEdit,
  showEskul,
  delegated,
}: SessionRowProps) {
  const stats = getSessionStats(session)
  const filled = session.attendance.length > 0
  const label = getSessionLabel(session)
  const hasSubstitute = session.attendance.some((entry) => entry.asSubstitute)

  return (
    <Link
      to={`/sesi/${session.id}`}
      className={cn(
        'group flex flex-col gap-3 p-4 transition-colors hover:bg-muted/25 sm:flex-row sm:items-center',
        delegated && 'bg-amber-50/50 dark:bg-amber-500/[0.04]',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <DateTile date={session.date} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">
              {session.topic}
            </p>
            {showEskul && eskul ? <EskulChip eskul={eskul} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" />
              {session.startTime} – {session.endTime}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {session.location}
            </span>
            <span className="hidden text-muted-foreground/50 sm:inline">·</span>
            <span className="hidden sm:inline">{coachName}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={label.variant}>{label.label}</Badge>
            <CoachPresenceBadge present={session.coachPresent} />
            {delegated ? (
              <Badge variant="warning" className="gap-1">
                <UserCheck className="size-3" /> Dititipkan
              </Badge>
            ) : null}
            {hasSubstitute ? (
              <Badge variant="secondary" className="hidden gap-1 sm:inline-flex">
                Diisi pengganti
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="w-28 shrink-0">
          {filled ? (
            <>
              <div className="flex items-center justify-between text-[10px] font-semibold">
                <span className="text-muted-foreground">Hadir</span>
                <span className="text-foreground">
                  {stats.hadir}/{stats.total}
                </span>
              </div>
              <Progress
                value={stats.rate}
                className="mt-1 h-1.5"
                indicatorClassName={
                  stats.rate >= 90
                    ? 'bg-emerald-500'
                    : stats.rate >= 75
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }
              />
            </>
          ) : (
            <div className="text-right sm:text-left">
              <p className="text-[10px] font-semibold text-muted-foreground">Presensi</p>
              <p className="text-[11px] font-bold text-amber-600">Belum diisi</p>
            </div>
          )}
        </div>
        <span
          className={cn(
            buttonVariants({ variant: canEdit ? 'default' : 'outline', size: 'sm' }),
            'shrink-0',
          )}
        >
          {canEdit ? 'Isi Presensi' : 'Lihat'}
          <ChevronRight />
        </span>
      </div>
    </Link>
  )
}
