import {
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSignature,
  MapPin,
  Plus,
  Trophy,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CreateSessionDialog } from '@/components/sessions/create-session-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import {
  ACHIEVEMENT_LEVEL_META,
  ACHIEVEMENT_RANK_META,
  PERMIT_STATUS_META,
} from '@/lib/constants'
import { useAppStore, useCurrentUser } from '@/lib/store'
import { getSessionStats } from '@/lib/selectors'
import {
  cn,
  formatDate,
  formatDateRange,
  formatDateShort,
  parseDate,
  percentage,
  todayISO,
} from '@/lib/utils'

type CalendarFilter = 'semua' | 'sesi' | 'izin' | 'prestasi'

const weekdayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  )
}

export function CalendarPage() {
  const user = useCurrentUser()
  const store = useAppStore()
  const navigate = useNavigate()
  const today = todayISO()
  const todayDate = parseDate(today)
  const [cursor, setCursor] = useState({
    year: todayDate.getFullYear(),
    month: todayDate.getMonth(),
  })
  const [selectedDate, setSelectedDate] = useState(today)
  const [eskulFilter, setEskulFilter] = useState('semua')
  const [filter, setFilter] = useState<CalendarFilter>('semua')
  const [createOpen, setCreateOpen] = useState(false)

  if (!user) return null

  const ownEskul = store.eskul.find((item) => item.id === user.eskulId)
  const scopeSessions = store.sessions.filter(
    (session) => user.role === 'admin' || session.eskulId === user.eskulId,
  )
  const scopePermits = store.permits.filter(
    (permit) => user.role === 'admin' || permit.eskulId === user.eskulId,
  )
  const scopeAchievements = store.achievements.filter(
    (achievement) => user.role === 'admin' || achievement.eskulId === user.eskulId,
  )
  const sessions =
    user.role === 'admin' && eskulFilter !== 'semua'
      ? scopeSessions.filter((session) => session.eskulId === eskulFilter)
      : scopeSessions
  const permits =
    user.role === 'admin' && eskulFilter !== 'semua'
      ? scopePermits.filter((permit) => permit.eskulId === eskulFilter)
      : scopePermits
  const achievements =
    user.role === 'admin' && eskulFilter !== 'semua'
      ? scopeAchievements.filter((achievement) => achievement.eskulId === eskulFilter)
      : scopeAchievements

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const monthStart = `${monthPrefix}-01`
  const monthEnd = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`
  const monthSessions = sessions.filter((session) => session.date.startsWith(monthPrefix))
  const monthPermits = permits.filter(
    (permit) => permit.startDate <= monthEnd && permit.endDate >= monthStart,
  )
  const monthAchievements = achievements.filter((achievement) =>
    achievement.date.startsWith(monthPrefix),
  )
  const activeDays = new Set<string>([
    ...monthSessions.map((session) => session.date),
    ...monthAchievements.map((achievement) => achievement.date),
    ...monthPermits.flatMap((permit) => {
      const dates: string[] = []
      const cursorDate = parseDate(permit.startDate)
      const end = parseDate(permit.endDate)
      while (cursorDate <= end && dates.length < 62) {
        const iso = toISODate(cursorDate)
        if (iso.startsWith(monthPrefix)) dates.push(iso)
        cursorDate.setDate(cursorDate.getDate() + 1)
      }
      return dates
    }),
  ])

  const showSessions = filter === 'semua' || filter === 'sesi'
  const showPermits = filter === 'semua' || filter === 'izin'
  const showAchievements = filter === 'semua' || filter === 'prestasi'
  const visibleSessions = showSessions ? sessions : []
  const visiblePermits = showPermits ? permits : []
  const visibleAchievements = showAchievements ? achievements : []

  const sessionsOn = (iso: string) =>
    visibleSessions.filter((session) => session.date === iso)
  const permitsOn = (iso: string) =>
    visiblePermits.filter((permit) => permit.startDate <= iso && permit.endDate >= iso)
  const achievementsOn = (iso: string) =>
    visibleAchievements.filter((achievement) => achievement.date === iso)

  const firstDay = new Date(cursor.year, cursor.month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(cursor.year, cursor.month, index - startOffset + 1)
    const iso = toISODate(date)
    return {
      iso,
      day: date.getDate(),
      inMonth: date.getMonth() === cursor.month,
      isToday: iso === today,
    }
  })

  const selectedSessions = sessionsOn(selectedDate)
  const selectedPermits = permitsOn(selectedDate)
  const selectedAchievements = achievementsOn(selectedDate)
  const selectedTotal =
    selectedSessions.length + selectedPermits.length + selectedAchievements.length
  const filteredMonthCount =
    (showSessions ? monthSessions.length : 0) +
    (showPermits ? monthPermits.length : 0) +
    (showAchievements ? monthAchievements.length : 0)

  const handleSelect = (iso: string) => {
    setSelectedDate(iso)
    const date = parseDate(iso)
    if (date.getMonth() !== cursor.month || date.getFullYear() !== cursor.year) {
      setCursor({ year: date.getFullYear(), month: date.getMonth() })
    }
  }

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: next.getFullYear(), month: next.getMonth() })
    setSelectedDate(toISODate(next))
  }

  const goToToday = () => {
    setCursor({ year: todayDate.getFullYear(), month: todayDate.getMonth() })
    setSelectedDate(today)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Jadwal & Agenda"
        title="Kalender Kegiatan"
        description={
          user.role === 'admin'
            ? 'Pantau jadwal sesi, rentang surat izin, dan prestasi seluruh eskul dalam satu kalender.'
            : `Lihat agenda sesi, izin kegiatan, dan prestasi ${ownEskul?.name ?? 'eskul Anda'}.`
        }
        actions={
          user.role === 'pelatih' && ownEskul ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Buat Sesi
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Sesi bulan ini"
          value={monthSessions.length}
          icon={CalendarCheck2}
          hint={monthLabel(cursor.year, cursor.month)}
          accent="primary"
        />
        <StatCard
          label="Izin kegiatan"
          value={monthPermits.length}
          icon={FileSignature}
          hint="Sesi luar & lomba"
          accent="sky"
        />
        <StatCard
          label="Prestasi"
          value={monthAchievements.length}
          icon={Trophy}
          hint="Tercatat bulan ini"
          accent="amber"
        />
        <StatCard
          label="Hari terisi"
          value={activeDays.size}
          icon={CalendarRange}
          hint={`${percentage(activeDays.size, daysInMonth)}% hari aktif`}
          accent="violet"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  size="iconSm"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft />
                </Button>
                <p className="min-w-0 flex-1 truncate text-center text-sm font-bold capitalize text-foreground sm:min-w-40 sm:flex-none">
                  {monthLabel(cursor.year, cursor.month)}
                </p>
                <Button
                  variant="outline"
                  size="iconSm"
                  onClick={() => shiftMonth(1)}
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight />
                </Button>
                <Button variant="ghost" size="sm" onClick={goToToday}>
                  Hari ini
                </Button>
              </div>
              {user.role === 'admin' ? (
                <Select
                  value={eskulFilter}
                  onChange={(event) => setEskulFilter(event.target.value)}
                  wrapperClassName="w-full sm:w-auto"
                  className="h-9 w-full text-xs sm:w-44"
                  aria-label="Filter eskul"
                >
                  <option value="semua">Semua eskul</option>
                  {store.eskul.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as CalendarFilter)}
              items={[
                { value: 'semua', label: 'Semua', count: filteredMonthCount },
                { value: 'sesi', label: 'Sesi', count: monthSessions.length },
                { value: 'izin', label: 'Izin', count: monthPermits.length },
                { value: 'prestasi', label: 'Prestasi', count: monthAchievements.length },
              ]}
            />
          </div>

          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 pb-2">
              {weekdayLabels.map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    'text-center text-[10px] font-bold uppercase tracking-wider',
                    index >= 5 ? 'text-rose-500/70' : 'text-muted-foreground/70',
                  )}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell) => {
                const cellSessions = sessionsOn(cell.iso)
                const cellPermits = permitsOn(cell.iso)
                const cellAchievements = achievementsOn(cell.iso)
                const total =
                  cellSessions.length + cellPermits.length + cellAchievements.length
                const selected = cell.iso === selectedDate
                const preview = [
                  ...cellSessions.map((session) => ({
                    id: session.id,
                    kind: 'sesi' as const,
                    label: session.topic,
                    meta: session.startTime,
                  })),
                  ...cellPermits.map((permit) => ({
                    id: permit.id,
                    kind: 'izin' as const,
                    label: permit.title,
                    meta: 'Izin',
                  })),
                  ...cellAchievements.map((achievement) => ({
                    id: achievement.id,
                    kind: 'prestasi' as const,
                    label: achievement.title,
                    meta: ACHIEVEMENT_RANK_META[achievement.rank].label,
                  })),
                ].slice(0, 2)

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => handleSelect(cell.iso)}
                    className={cn(
                      'group relative flex min-h-[76px] flex-col rounded-xl border p-1.5 text-left align-top transition-all sm:min-h-[104px] sm:p-2',
                      cell.inMonth
                        ? 'border-border/60 bg-card hover:border-primary/30 hover:bg-muted/30'
                        : 'border-transparent bg-muted/20 text-muted-foreground/50 hover:bg-muted/40',
                      selected &&
                        'border-primary/40 bg-primary/[0.06] shadow-sm ring-1 ring-primary/20',
                    )}
                    aria-pressed={selected}
                    aria-label={`${formatDateShort(cell.iso)}${total ? `, ${total} kegiatan` : ''}`}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          'flex size-6 items-center justify-center rounded-lg text-[11px] font-bold',
                          cell.isToday
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : cell.inMonth
                              ? 'text-foreground'
                              : 'text-muted-foreground/60',
                        )}
                      >
                        {cell.day}
                      </span>
                      {total > 2 ? (
                        <span className="text-[9px] font-bold text-muted-foreground">
                          +{total - 2}
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-1 hidden min-w-0 flex-1 space-y-0.5 sm:block">
                      {preview.map((entry) => (
                        <span
                          key={`${entry.kind}-${entry.id}`}
                          className={cn(
                            'flex items-center gap-1 truncate rounded px-1 py-0.5 text-[9px] font-semibold',
                            entry.kind === 'sesi' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                            entry.kind === 'izin' && 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
                            entry.kind === 'prestasi' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                          )}
                        >
                          <span className="shrink-0 text-[8px] opacity-70">{entry.meta}</span>
                          <span className="truncate">{entry.label}</span>
                        </span>
                      ))}
                    </span>

                    <span className="mt-auto flex items-center gap-1 pt-1 sm:hidden">
                      {cellSessions.length > 0 ? (
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                      ) : null}
                      {cellPermits.length > 0 ? (
                        <span className="size-1.5 rounded-full bg-sky-500" />
                      ) : null}
                      {cellAchievements.length > 0 ? (
                        <span className="size-1.5 rounded-full bg-amber-500" />
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/60 pt-3 text-[10px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" /> Sesi eskul
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-sky-500" /> Surat izin
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" /> Prestasi
              </span>
              <span className="ml-auto hidden sm:inline">Klik tanggal untuk melihat agenda</span>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden xl:sticky xl:top-20">
          <div className="border-b border-border/60 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white p-4 dark:from-emerald-500/10 dark:via-teal-500/[0.06] dark:to-transparent">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700/70 dark:text-emerald-200/60">
                  Agenda
                </p>
                <p className="mt-1 text-sm font-bold capitalize text-foreground">
                  {formatDate(selectedDate)}
                </p>
              </div>
              <Badge variant="outline" className="bg-card/70">
                {selectedTotal} kegiatan
              </Badge>
            </div>
            {user.role === 'pelatih' && ownEskul ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full bg-card/80"
                onClick={() => setCreateOpen(true)}
              >
                <Plus />
                Jadwalkan sesi di tanggal ini
              </Button>
            ) : null}
          </div>

          <div className="max-h-[640px] space-y-3 overflow-y-auto p-4">
            {selectedTotal === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Tidak ada kegiatan"
                description="Tanggal ini belum memiliki sesi, izin kegiatan, atau prestasi."
                className="border-0 bg-transparent px-2 py-8"
              />
            ) : null}

            {selectedSessions.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300">
                  <CalendarCheck2 className="size-3.5" />
                  Sesi eskul
                </p>
                {selectedSessions.map((session) => {
                  const sessionEskul = store.eskul.find((item) => item.id === session.eskulId)
                  const stats = getSessionStats(session)
                  return (
                    <Link
                      key={session.id}
                      to={`/sesi/${session.id}`}
                      className="group block rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-xs font-bold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                          {session.topic}
                        </p>
                        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                        <Clock3 className="size-3" />
                        {session.startTime} – {session.endTime}
                        <span className="text-muted-foreground/40">·</span>
                        {sessionEskul?.name ?? 'Eskul'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <MapPin className="size-3" />
                        {session.location}
                        <span className="text-muted-foreground/40">·</span>
                        <Users className="size-3" />
                        {stats.hadir}/{stats.total || 0} hadir
                      </p>
                    </Link>
                  )
                })}
              </div>
            ) : null}

            {selectedPermits.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-sky-700 dark:text-sky-300">
                  <FileSignature className="size-3.5" />
                  Surat izin
                </p>
                {selectedPermits.map((permit) => {
                  const permitEskul = store.eskul.find((item) => item.id === permit.eskulId)
                  const meta = PERMIT_STATUS_META[permit.status]
                  return (
                    <Link
                      key={permit.id}
                      to={`/surat/${permit.id}`}
                      className="group block rounded-xl border border-sky-200/70 bg-sky-50/40 p-3 transition-colors hover:border-sky-300 hover:bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-500/[0.06] dark:hover:bg-sky-500/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-xs font-bold text-foreground group-hover:text-sky-700 dark:group-hover:text-sky-300">
                          {permit.title}
                        </p>
                        <Badge className={cn('border text-[9px]', meta.badge)}>{meta.label}</Badge>
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                        {permitEskul?.name ?? 'Eskul'} ·{' '}
                        {formatDateRange(permit.startDate, permit.endDate)}
                      </p>
                      {permit.location ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <MapPin className="size-3" />
                          {permit.location}
                        </p>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            ) : null}

            {selectedAchievements.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300">
                  <Trophy className="size-3.5" />
                  Prestasi
                </p>
                {selectedAchievements.map((achievement) => {
                  const achievementEskul = store.eskul.find(
                    (item) => item.id === achievement.eskulId,
                  )
                  return (
                    <Link
                      key={achievement.id}
                      to="/prestasi"
                      className="group block rounded-xl border border-amber-200/70 bg-amber-50/40 p-3 transition-colors hover:border-amber-300 hover:bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:hover:bg-amber-500/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-xs font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-300">
                          {achievement.title}
                        </p>
                        <Badge className="border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300">
                          {ACHIEVEMENT_RANK_META[achievement.rank].label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                        {achievementEskul?.name ?? 'Eskul'} ·{' '}
                        {ACHIEVEMENT_LEVEL_META[achievement.level].label}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {achievement.event}
                      </p>
                    </Link>
                  )
                })}
              </div>
            ) : null}

            {selectedTotal > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                {selectedSessions.length > 0 ? (
                  <Link
                    to="/sesi"
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1')}
                  >
                    Semua sesi
                  </Link>
                ) : null}
                {selectedPermits.length > 0 ? (
                  <Link
                    to="/surat"
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1')}
                  >
                    Semua surat
                  </Link>
                ) : null}
                {selectedAchievements.length > 0 ? (
                  <Link
                    to="/prestasi"
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1')}
                  >
                    Semua prestasi
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {user.role === 'pelatih' && ownEskul && createOpen ? (
        <CreateSessionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          eskul={ownEskul}
          userId={user.id}
          initialDate={selectedDate}
          onCreated={(session) => navigate(`/sesi/${session.id}`)}
        />
      ) : null}
    </div>
  )
}
