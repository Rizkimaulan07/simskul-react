import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Info,
  LockKeyhole,
  MapPin,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AttendanceTrendChart } from '@/components/charts/attendance-trend-chart'
import { AttendanceWarningPanel } from '@/components/shared/attendance-warning-panel'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CoachPresenceBadge, EskulChip, PermitStatusBadge, RoleBadge } from '@/components/shared/badges'
import { EmptyState } from '@/components/shared/empty-state'
import { EskulMark } from '@/components/shared/eskul-mark'
import { StatCard } from '@/components/shared/stat-card'
import { ACADEMIC_YEAR, ACHIEVEMENT_LEVEL_META, ACHIEVEMENT_RANK_META } from '@/lib/constants'
import { getAttendanceWarnings } from '@/lib/early-warning'
import { useAppStore, useCurrentUser } from '@/lib/store'
import {
  getAllAttendance,
  getAttendanceTrend,
  getDelegatedSessions,
  getEskulAttendance,
  getMonthlyAttendance,
  getNextSession,
  getSessionLabel,
  getSessionStats,
  getStudentAttendance,
} from '@/lib/selectors'
import type { Achievement, Activity, Eskul, Permit, User } from '@/lib/types'
import {
  cn,
  firstName,
  formatDateShort,
  formatDateRange,
  formatRelative,
  greeting,
  parseDate,
  todayISO,
} from '@/lib/utils'

function shortMonth(iso: string) {
  return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(parseDate(iso))
}

function dayNumber(iso: string) {
  return parseDate(iso).getDate()
}

function DashboardHeader({
  user,
  eskul,
  pendingCount,
  primarySessionId,
  isDelegated,
}: {
  user: User
  eskul?: Eskul
  pendingCount: number
  primarySessionId?: string
  isDelegated: boolean
}) {
  const isSupervisor = user.role === 'admin'
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <RoleBadge role={user.role} />
          {eskul ? <EskulChip eskul={eskul} /> : null}
          <Badge variant="outline" className="gap-1">
            <CalendarDays className="size-3" />
            TA {ACADEMIC_YEAR}
          </Badge>
        </div>
        <h1 className="mt-3 text-balance text-[26px] font-extrabold tracking-tight text-foreground sm:text-[30px]">
          {greeting()}, {firstName(user.name)}
          <span className="ml-1.5 inline-block">👋</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {isSupervisor
            ? 'Pantau kehadiran, surat izin, dan performa seluruh ekstrakurikuler dalam satu ringkasan.'
            : `Kelola kegiatan ${eskul?.name ?? 'eskul'} dan pastikan setiap sesi terdokumentasi dengan baik.`}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          to="/sesi"
          className={cn(buttonVariants({ variant: 'outline' }), 'bg-card')}
        >
          <CalendarCheck2 />
          Lihat Sesi
        </Link>
        {isSupervisor ? (
          <Link to="/surat" className={buttonVariants()}>
            <ClipboardCheck />
            Tinjau Surat
            {pendingCount > 0 ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                {pendingCount}
              </span>
            ) : null}
          </Link>
        ) : (
          <Link
            to={primarySessionId ? `/sesi/${primarySessionId}` : '/sesi'}
            className={buttonVariants()}
          >
            <UserCheck />
            {isDelegated ? 'Isi Presensi' : 'Kelola Presensi'}
          </Link>
        )}
      </div>
    </div>
  )
}

function DelegationBanner({
  role,
  sessionId,
  topic,
  coachName,
  leaderName,
  note,
}: {
  role: 'pelatih' | 'ketua'
  sessionId: string
  topic: string
  coachName: string
  leaderName: string
  note?: string
}) {
  const isLeader = role === 'ketua'
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50/70 to-white p-4 shadow-sm sm:p-5 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-amber-500/[0.06] dark:to-transparent">
      <div className="absolute -right-8 -top-10 size-32 rounded-full bg-amber-200/40 blur-2xl dark:bg-amber-500/10" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25">
          {isLeader ? <ShieldAlert className="size-5" /> : <Info className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300">
            {isLeader ? 'Anda ditunjuk sebagai pengganti' : 'Anda menandai berhalangan'}
          </p>
          <p className="mt-1 text-sm font-bold text-amber-950 dark:text-amber-50">
            {isLeader
              ? `Presensi ${topic} dapat Anda isi hari ini.`
              : `Presensi ${topic} dititipkan ke ${leaderName}.`}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800/70 dark:text-amber-100/60">
            {note ??
              (isLeader
                ? `${coachName} menandai dirinya berhalangan. Isian Anda akan tercatat sebagai pengganti.`
                : 'Ketua eskul otomatis mendapat akses pengisian untuk sesi ini.')}
          </p>
        </div>
        <Link
          to={`/sesi/${sessionId}`}
          className={cn(
            buttonVariants({ size: 'sm' }),
            'shrink-0 bg-amber-600 text-white shadow-amber-600/20 hover:bg-amber-700',
          )}
        >
          {isLeader ? 'Isi Presensi' : 'Lihat Sesi'}
          <ArrowRight />
        </Link>
      </div>
    </div>
  )
}

function NextSessionCard({
  session,
  eskul,
  coachName,
  memberCount,
  canEdit,
}: {
  session: NonNullable<ReturnType<typeof getNextSession>>
  eskul?: Eskul
  coachName: string
  memberCount: number
  canEdit: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 p-5 text-white">
        <div className="grid-pattern absolute inset-0 opacity-40" />
        <div className="absolute -right-10 -top-12 size-36 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
            <span className="text-xl font-extrabold leading-none">{dayNumber(session.date)}</span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/60">
              {shortMonth(session.date)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/80">
              Sesi berikutnya
            </p>
            <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug">{session.topic}</h3>
            <p className="mt-1 text-[11px] text-white/60">{eskul?.name ?? 'Eskul'}</p>
          </div>
        </div>
      </div>
      <CardContent className="space-y-3 p-5">
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <CalendarDays className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">{formatDateShort(session.date)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>
              {session.startTime} – {session.endTime}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <MapPin className="size-3.5 text-primary" />
            {session.location}
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Users className="size-3.5 text-primary" />
            {memberCount} anggota · {coachName}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <CoachPresenceBadge present={session.coachPresent} />
          {session.coachPresent === false ? (
            <Badge variant="warning" className="gap-1">
              <LockKeyhole className="size-3" /> Presensi terbuka untuk ketua
            </Badge>
          ) : null}
        </div>
        <Link
          to={`/sesi/${session.id}`}
          className={cn(buttonVariants({ variant: canEdit ? 'default' : 'outline', size: 'sm' }), 'w-full')}
        >
          {canEdit ? 'Buka & Isi Presensi' : 'Lihat Detail Sesi'}
          <ChevronRight />
        </Link>
      </CardContent>
    </Card>
  )
}

function PermitMiniList({ permits, eskul, limit = 3 }: { permits: Permit[]; eskul: Eskul[]; limit?: number }) {
  if (permits.length === 0) {
    return (
      <p className="rounded-xl bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
        Belum ada pengajuan izin.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {permits.slice(0, limit).map((permit) => {
        const itemEskul = eskul.find((item) => item.id === permit.eskulId)
        return (
          <Link
            key={permit.id}
            to={`/surat/${permit.id}`}
            className="group block rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/25 hover:bg-muted/30"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground group-hover:text-primary">
                  {permit.title}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {itemEskul?.name} · {formatDateRange(permit.startDate, permit.endDate)}
                </p>
              </div>
              <PermitStatusBadge status={permit.status} />
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function AchievementMiniList({
  achievements,
  eskul,
  limit = 3,
}: {
  achievements: Achievement[]
  eskul: Eskul[]
  limit?: number
}) {
  if (achievements.length === 0) {
    return (
      <p className="rounded-xl bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
        Belum ada prestasi tercatat.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {achievements.slice(0, limit).map((achievement) => {
        const itemEskul = eskul.find((item) => item.id === achievement.eskulId)
        const level = ACHIEVEMENT_LEVEL_META[achievement.level]
        const rank = ACHIEVEMENT_RANK_META[achievement.rank]
        return (
          <Link
            key={achievement.id}
            to="/prestasi"
            className="group block rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-amber-200 hover:bg-amber-50/30 dark:hover:border-amber-500/25 dark:hover:bg-amber-500/[0.04]"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
                <Trophy className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-300">
                  {achievement.title}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {itemEskul?.name ?? 'Eskul'} · {level.label}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] font-bold',
                  rank.badge,
                )}
              >
                {rank.label}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function ActivityTimeline({
  activities,
  users,
}: {
  activities: Activity[]
  users: User[]
}) {
  return (
    <div className="relative space-y-4">
      <div className="absolute bottom-2 left-[13px] top-2 w-px bg-border" aria-hidden="true" />
      {activities.map((activity) => {
        const actor = users.find((item) => item.id === activity.userId)
        return (
          <div key={activity.id} className="relative flex gap-3">
            <Avatar
              name={actor?.name ?? 'Pengguna'}
              id={activity.userId}
              size="xs"
              className="relative z-10 ring-2 ring-card"
            />
            <div className="min-w-0 flex-1 pb-0.5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground">{actor ? firstName(actor.name) : 'Pengguna'}</span>{' '}
                {activity.action.toLowerCase()}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80">{activity.detail}</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/60">
                {formatRelative(activity.at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardPage() {
  const user = useCurrentUser()
  const store = useAppStore()

  if (!user) return null

  const isSupervisor = user.role === 'admin'
  const eskul = store.eskul.find((item) => item.id === user.eskulId)
  const userSessions = store.sessions
    .filter((session) => session.eskulId === user.eskulId)
    .sort((a, b) => b.date.localeCompare(a.date))
  const members = store.students.filter(
    (student) => student.eskulId === user.eskulId && student.active,
  )
  const pendingPermits = store.permits
    .filter((permit) => permit.status === 'diajukan')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const ownPendingPermits = pendingPermits.filter((permit) => permit.eskulId === user.eskulId)
  const ownPermits = store.permits
    .filter((permit) => permit.eskulId === user.eskulId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const monthlyStats = getMonthlyAttendance(userSessions)
  const thisMonth = todayISO().slice(0, 7)
  const monthlySessionCount = userSessions.filter((session) => session.date.startsWith(thisMonth)).length
  const delegatedSessions = eskul ? getDelegatedSessions(userSessions, eskul.id) : []
  const nextSession = getNextSession(store.sessions, user.eskulId)
  const todaySession = userSessions.find((session) => session.date === todayISO())
  const trend = getAttendanceTrend(isSupervisor ? store.sessions : userSessions, undefined, 6)
  const recentSessions = userSessions
    .filter((session) => session.attendance.length > 0 || session.staffAttendance.length > 0)
    .slice(0, 4)
  const coach = store.users.find((item) => item.id === eskul?.coachId)
  const leader = store.users.find((item) => item.id === eskul?.leaderId)
  const lowestAttendance = members
    .map((student) => ({
      student,
      stats: getStudentAttendance(store.sessions, student.id),
    }))
    .filter((item) => item.stats.total > 0)
    .sort((a, b) => a.stats.rate - b.stats.rate)
    .slice(0, 3)
  const attendanceWarnings =
    user.role === 'pelatih' && user.eskulId
      ? getAttendanceWarnings({
          students: store.students,
          sessions: store.sessions,
          eskulId: user.eskulId,
        })
      : []
  const primarySessionId =
    user.role === 'ketua'
      ? delegatedSessions[0]?.id ?? todaySession?.id
      : todaySession?.id ?? nextSession?.id

  const allStats = getAllAttendance(store.sessions)
  const allPermitsPending = pendingPermits.length
  const recentAchievements = store.achievements
    .filter((achievement) => isSupervisor || achievement.eskulId === user.eskulId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <DashboardHeader
        user={user}
        eskul={eskul}
        pendingCount={isSupervisor ? allPermitsPending : ownPendingPermits.length}
        primarySessionId={primarySessionId}
        isDelegated={user.role === 'ketua' && delegatedSessions.length > 0}
      />

      {isSupervisor ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Eskul aktif"
              value={store.eskul.length}
              icon={Sparkles}
              hint="Terdaftar di kesiswaan"
              accent="primary"
            />
            <StatCard
              label="Anggota aktif"
              value={store.students.filter((student) => student.active).length}
              icon={Users}
              hint="Dari seluruh eskul"
              accent="sky"
            />
            <StatCard
              label="Kehadiran global"
              value={`${allStats.rate}%`}
              icon={TrendingUp}
              hint={`${allStats.hadir} hadir dari ${allStats.total} catatan`}
              accent="violet"
            />
            <StatCard
              label="Izin menunggu"
              value={allPermitsPending}
              icon={ClipboardCheck}
              hint="Perlu keputusan Anda"
              accent="amber"
            />
          </div>

          {allPermitsPending > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50 via-indigo-50/60 to-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-violet-500/20 dark:from-violet-500/10 dark:via-indigo-500/[0.06] dark:to-transparent">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                  <ClipboardCheck className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-violet-950 dark:text-violet-50">
                    {allPermitsPending} pengajuan menunggu persetujuan
                  </p>
                  <p className="mt-0.5 text-[11px] text-violet-800/60 dark:text-violet-100/60">
                    Periksa detail kegiatan sebelum memberikan keputusan.
                  </p>
                </div>
              </div>
              <Link to="/surat" className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}>
                Tinjau Sekarang
                <ArrowRight />
              </Link>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="min-w-0 space-y-4 xl:col-span-2">
              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>Tren kehadiran global</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Enam sesi terakhir dari seluruh eskul
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="size-3 text-emerald-600" />
                    {allStats.rate}% rata-rata
                  </Badge>
                </CardHeader>
                <CardContent>
                  {trend.length ? (
                    <>
                      <AttendanceTrendChart data={trend} height={220} />
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-chart-1" /> Persentase hadir
                        </span>
                        <span>Izin {allStats.izin}</span>
                        <span>Sakit {allStats.sakit}</span>
                        <span>Alpa {allStats.alpa}</span>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      icon={TrendingUp}
                      title="Belum ada data kehadiran"
                      description="Data tren muncul setelah sesi pertama diisi."
                      className="border-0 bg-transparent py-10"
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Performa per eskul</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Persentase kehadiran dari seluruh sesi terisi
                    </p>
                  </div>
                  <Link
                    to="/eskul"
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    Lihat semua
                  </Link>
                </CardHeader>
                <CardContent className="space-y-2">
                  {store.eskul.map((item) => {
                    const stats = getEskulAttendance(store.sessions, item.id)
                    const itemMembers = store.students.filter(
                      (student) => student.eskulId === item.id && student.active,
                    )
                    const itemCoach = store.users.find((u) => u.id === item.coachId)
                    return (
                      <Link
                        key={item.id}
                        to={`/eskul/${item.id}`}
                        className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-colors hover:border-border/60 hover:bg-muted/30"
                      >
                        <EskulMark eskul={item} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-foreground">
                                {item.name}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {itemCoach?.name} · {itemMembers.length} anggota
                              </p>
                            </div>
                            <span className="text-xs font-extrabold text-foreground">
                              {stats.rate}%
                            </span>
                          </div>
                          <Progress
                            value={stats.rate}
                            className="mt-1.5 h-1.5"
                            indicatorClassName={
                              stats.rate >= 90
                                ? 'bg-emerald-500'
                                : stats.rate >= 75
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                            }
                          />
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </Link>
                    )
                  })}
                </CardContent>
              </Card>
            </div>

            <div className="min-w-0 space-y-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Menunggu persetujuan</CardTitle>
                  <Badge variant="warning">{allPermitsPending}</Badge>
                </CardHeader>
                <CardContent>
                  <PermitMiniList permits={pendingPermits} eskul={store.eskul} limit={4} />
                  <Link
                    to="/surat"
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'mt-3 w-full',
                    )}
                  >
                    Buka semua surat
                    <ChevronRight />
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Prestasi terbaru</CardTitle>
                  <Link
                    to="/prestasi"
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    Lihat semua
                  </Link>
                </CardHeader>
                <CardContent>
                  <AchievementMiniList
                    achievements={recentAchievements}
                    eskul={store.eskul}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Aktivitas terbaru</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityTimeline activities={store.activities.slice(0, 5)} users={store.users} />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <>
          {delegatedSessions.length > 0 && eskul ? (
            <DelegationBanner
              role={user.role as 'pelatih' | 'ketua'}
              sessionId={delegatedSessions[0].id}
              topic={delegatedSessions[0].topic}
              coachName={coach?.name ?? 'Pelatih'}
              leaderName={leader?.name ?? 'Ketua eskul'}
              note={delegatedSessions[0].coachNote}
            />
          ) : null}
          {user.role === 'pelatih' && todaySession?.coachPresent === null ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/70 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-sky-500/20 dark:bg-sky-500/[0.06]">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  <Info className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-sky-950 dark:text-sky-50">
                    Konfirmasi kehadiran Anda untuk sesi hari ini
                  </p>
                  <p className="mt-0.5 text-[11px] text-sky-800/70 dark:text-sky-100/60">
                    {todaySession.topic} · {todaySession.startTime} – {todaySession.endTime}
                  </p>
                </div>
              </div>
              <Link
                to={`/sesi/${todaySession.id}`}
                className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
              >
                Konfirmasi
                <ArrowRight />
              </Link>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Anggota aktif"
              value={members.length}
              icon={Users}
              hint={eskul ? `Kuota ${eskul.quota} anggota` : undefined}
              accent="primary"
            />
            <StatCard
              label="Kehadiran bulan ini"
              value={`${monthlyStats.rate}%`}
              icon={TrendingUp}
              hint={`${monthlyStats.hadir} hadir dari ${monthlyStats.total} catatan`}
              accent="sky"
            />
            <StatCard
              label="Sesi bulan ini"
              value={monthlySessionCount}
              icon={CalendarCheck2}
              hint="Termasuk sesi mendatang"
              accent="violet"
            />
            <StatCard
              label="Izin menunggu"
              value={ownPendingPermits.length}
              icon={ClipboardCheck}
              hint="Menunggu persetujuan admin"
              accent="amber"
            />
          </div>

          <AttendanceWarningPanel warnings={attendanceWarnings} />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="min-w-0 space-y-4 xl:col-span-2">
              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>Tren kehadiran</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Enam sesi terakhir {eskul?.name ?? 'eskul'}
                    </p>
                  </div>
                  {monthlyStats.total > 0 ? (
                    <Badge variant="secondary" className="gap-1">
                      <TrendingUp className="size-3 text-emerald-600" />
                      {monthlyStats.rate}% bulan ini
                    </Badge>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {trend.length ? (
                    <>
                      <AttendanceTrendChart data={trend} height={225} />
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-chart-1" /> Persentase hadir
                        </span>
                        <span>Tiap titik mewakili satu sesi</span>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      icon={TrendingUp}
                      title="Belum ada data kehadiran"
                      description="Isi presensi sesi pertama untuk melihat tren."
                      className="border-0 bg-transparent py-10"
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Sesi terbaru</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Rekap sesi yang sudah berlangsung
                    </p>
                  </div>
                  <Link to="/sesi" className="text-[11px] font-bold text-primary hover:underline">
                    Semua sesi
                  </Link>
                </CardHeader>
                <CardContent className="space-y-1">
                  {recentSessions.length === 0 ? (
                    <EmptyState
                      icon={CalendarCheck2}
                      title="Belum ada sesi"
                      description="Buat sesi pertama dan isi presensi anggota."
                      className="border-0 bg-transparent py-8"
                    />
                  ) : (
                    recentSessions.map((session) => {
                      const stats = getSessionStats(session)
                      const label = getSessionLabel(session)
                      return (
                        <Link
                          key={session.id}
                          to={`/sesi/${session.id}`}
                          className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-muted/30">
                            <span className="text-sm font-extrabold leading-none text-foreground">
                              {dayNumber(session.date)}
                            </span>
                            <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                              {shortMonth(session.date)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-foreground group-hover:text-primary">
                              {session.topic}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {session.startTime} · {session.location}
                            </p>
                          </div>
                          <div className="hidden items-center gap-2 sm:flex">
                            <Badge variant={label.variant}>{label.label}</Badge>
                            <div className="w-16">
                              <div className="flex items-center justify-between text-[9px] font-semibold text-muted-foreground">
                                <span>Hadir</span>
                                <span>{stats.rate}%</span>
                              </div>
                              <Progress value={stats.rate} className="mt-1 h-1" />
                            </div>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-primary" />
                        </Link>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="min-w-0 space-y-4">
              {nextSession ? (
                <NextSessionCard
                  session={nextSession}
                  eskul={eskul}
                  coachName={coach?.name ?? 'Pelatih'}
                  memberCount={members.length}
                  canEdit={user.role === 'pelatih' || nextSession.coachPresent === false}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Sesi berikutnya</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EmptyState
                      icon={CalendarDays}
                      title="Belum dijadwalkan"
                      description="Buat sesi baru agar anggota tahu jadwal berikutnya."
                      action={
                        user.role === 'pelatih' ? (
                          <Link to="/sesi" className={buttonVariants({ size: 'sm' })}>
                            Buat Sesi
                          </Link>
                        ) : undefined
                      }
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Surat terbaru</CardTitle>
                  <Link to="/surat" className="text-[10px] font-bold text-primary hover:underline">
                    Lihat semua
                  </Link>
                </CardHeader>
                <CardContent>
                  <PermitMiniList permits={ownPermits} eskul={store.eskul} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Prestasi terbaru</CardTitle>
                  <Link
                    to="/prestasi"
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    Lihat semua
                  </Link>
                </CardHeader>
                <CardContent>
                  <AchievementMiniList
                    achievements={recentAchievements}
                    eskul={store.eskul}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Kehadiran terendah</CardTitle>
                  <p className="text-[10px] text-muted-foreground">
                    Anggota yang perlu pendampingan
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lowestAttendance.length === 0 ? (
                    <p className="py-3 text-center text-[11px] text-muted-foreground">
                      Belum ada data presensi.
                    </p>
                  ) : (
                    lowestAttendance.map(({ student, stats }) => (
                      <div key={student.id} className="flex items-center gap-2.5">
                        <Avatar name={student.name} id={student.id} size="xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold text-foreground">
                            {student.name}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {student.className} · {stats.hadir}/{stats.total} hadir
                          </p>
                        </div>
                        <span
                          className={cn(
                            'text-[11px] font-extrabold',
                            stats.rate >= 80 ? 'text-emerald-600' : 'text-amber-600',
                          )}
                        >
                          {stats.rate}%
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {user.role === 'ketua' ? (
                <Card className="border-dashed bg-muted/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <LockKeyhole className="size-3.5 text-muted-foreground" />
                      Kewenangan ketua
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-[11px]">
                    {[
                      { allowed: true, label: 'Melihat data eskul & anggota' },
                      { allowed: true, label: 'Presensi saat pelatih berhalangan' },
                      { allowed: true, label: 'Dokumentasi & pengajuan izin' },
                      { allowed: false, label: 'Mengubah nilai eskul' },
                      { allowed: false, label: 'Menyetujui surat izin' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-muted-foreground">
                        {item.allowed ? (
                          <Check className="size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <X className="size-3.5 shrink-0 text-rose-500" />
                        )}
                        <span className={item.allowed ? 'text-foreground/80' : ''}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4 dark:border-sky-500/20 dark:bg-sky-500/[0.06]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" />
                  <div>
                    <p className="text-[11px] font-bold text-sky-950 dark:text-sky-50">
                      Tips pengisian
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-sky-800/70 dark:text-sky-100/60">
                      Tandai kehadiran Anda di setiap sesi. Jika berhalangan, ketua eskul
                      otomatis mendapat akses mengisi presensi.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
