import {
  ArrowLeft,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AttendanceBadge, CoachPresenceBadge, EskulChip, RoleBadge } from '@/components/shared/badges'
import { EmptyState } from '@/components/shared/empty-state'
import { ATTENDANCE_META, ATTENDANCE_STATUSES } from '@/lib/constants'
import { canEditAttendance } from '@/lib/permissions'
import { useAppStore, useCurrentUser } from '@/lib/store'
import { getActiveStudents, getSessionStats } from '@/lib/selectors'
import type { AttendanceStatus, StaffAttendanceEntry, StaffRole } from '@/lib/types'
import {
  cn,
  downloadCSV,
  formatDate,
  formatDateTime,
  formatDateShort,
  percentage,
} from '@/lib/utils'

function AttendanceStatusPicker({
  current,
  label,
  onSelect,
}: {
  current?: AttendanceStatus
  label: string
  onSelect: (status: AttendanceStatus) => void
}) {
  return (
    <div className="grid w-full grid-cols-4 gap-1 sm:w-auto" role="group" aria-label={label}>
      {ATTENDANCE_STATUSES.map((status) => {
        const meta = ATTENDANCE_META[status]
        const active = current === status
        return (
          <button
            key={status}
            type="button"
            data-active={active}
            aria-pressed={active}
            aria-label={`${label}: ${meta.label}`}
            onClick={() => onSelect(status)}
            className={cn(
              'h-8 rounded-lg border border-border bg-card px-2.5 text-[10px] font-bold text-muted-foreground transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
              meta.button,
            )}
          >
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

function StaffAttendanceRow({
  userId,
  name,
  role,
  hint,
  entry,
  updatedByName,
  canEdit,
  onSelect,
}: {
  userId?: string
  name: string
  role: StaffRole
  hint: string
  entry?: StaffAttendanceEntry
  updatedByName?: string
  canEdit: boolean
  onSelect: (status: AttendanceStatus) => void
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={name} id={userId} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-xs font-bold text-foreground">{name}</p>
            <RoleBadge role={role} className="px-1.5 py-0 text-[9px]" />
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
          {entry ? (
            <p className="mt-0.5 text-[9px] text-muted-foreground/70">
              Diisi {updatedByName ?? 'pengguna'} · {formatDateTime(entry.updatedAt)}
            </p>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <AttendanceStatusPicker
          current={entry?.status}
          label={`Presensi ${name}`}
          onSelect={onSelect}
        />
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          {entry ? (
            <AttendanceBadge status={entry.status} />
          ) : (
            <Badge variant="outline">Belum diisi</Badge>
          )}
        </div>
      )}
    </div>
  )
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useCurrentUser()
  const store = useAppStore()

  if (!user) return null

  const session = store.sessions.find((item) => item.id === id)

  if (!session) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Sesi tidak ditemukan"
        description="Sesi mungkin sudah dihapus atau tautannya tidak valid."
        action={
          <Link to="/sesi" className={buttonVariants()}>
            Kembali ke daftar sesi
          </Link>
        }
      />
    )
  }

  if (user.role !== 'admin' && session.eskulId !== user.eskulId) {
    return <Navigate to="/sesi" replace />
  }

  const eskul = store.eskul.find((item) => item.id === session.eskulId)
  const coach = store.users.find((item) => item.id === eskul?.coachId)
  const leader = store.users.find((item) => item.id === eskul?.leaderId)
  const members = getActiveStudents(store.students, session.eskulId)
  const stats = getSessionStats(session)
  const canEdit = canEditAttendance(user, session)
  const isSubstituteMode = user.role === 'ketua' && session.coachPresent === false
  const filledCount = members.filter((member) =>
    session.attendance.some((entry) => entry.studentId === member.id),
  ).length
  const completion = percentage(filledCount, members.length)
  const coachEntry = coach
    ? session.staffAttendance.find((entry) => entry.userId === coach.id)
    : undefined
  const leaderEntry = leader
    ? session.staffAttendance.find((entry) => entry.userId === leader.id)
    : undefined
  const staffCount = [coach, leader].filter(Boolean).length
  const staffFilled = [coachEntry, leaderEntry].filter(Boolean).length
  const canEditCoachStaff = canEdit && user.role === 'pelatih'
  const canEditLeaderStaff = canEdit && (user.role === 'pelatih' || leader?.id === user.id)
  const lastEntry = [...session.attendance, ...session.staffAttendance].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0]
  const savedBy = store.users.find((item) => item.id === lastEntry?.updatedBy)

  const handleStaffAttendance = (
    staffUserId: string,
    role: StaffRole,
    status: AttendanceStatus,
  ) => {
    store.setStaffAttendance(session.id, staffUserId, status, user.id)
    if (role !== 'pelatih') return
    if (status === 'hadir') {
      toast.success('Pelatih ditandai hadir', {
        description: 'Presensi ketua eskul terkunci selama pelatih tercatat hadir.',
      })
    } else {
      toast.warning('Presensi dialihkan ke ketua eskul', {
        description: `${leader?.name ?? 'Ketua eskul'} sekarang dapat mengisi presensi sesi ini.`,
      })
    }
  }

  const handleSetAttendance = (studentId: string, status: AttendanceStatus) => {
    store.setAttendance(session.id, studentId, status, user.id)
  }

  const handleMarkAllPresent = () => {
    store.markAllPresent(session.id, user.id)
    toast.success('Semua anggota ditandai hadir', {
      description: isSubstituteMode
        ? 'Isian tercatat sebagai pengganti pelatih.'
        : 'Anda masih dapat mengubah status per anggota.',
    })
  }

  const handleExport = () => {
    const staffRows: (string | number)[][] = []
    if (coach && coachEntry) {
      staffRows.push([
        coach.name,
        'Pelatih',
        '-',
        '-',
        ATTENDANCE_META[coachEntry.status].label,
        store.users.find((item) => item.id === coachEntry.updatedBy)?.name ?? '-',
      ])
    }
    if (leader && leaderEntry) {
      staffRows.push([
        leader.name,
        'Ketua',
        '-',
        '-',
        ATTENDANCE_META[leaderEntry.status].label,
        store.users.find((item) => item.id === leaderEntry.updatedBy)?.name ?? '-',
      ])
    }
    const rows = members.map((member) => {
      const entry = session.attendance.find((item) => item.studentId === member.id)
      return [
        member.name,
        'Anggota',
        member.nis,
        member.className,
        entry ? ATTENDANCE_META[entry.status].label : 'Belum diisi',
        entry?.asSubstitute ? 'Pengganti pelatih' : entry ? 'Pelatih' : '-',
      ]
    })
    const slug = session.topic.toLowerCase().replaceAll(/\s+/g, '-').replaceAll(/[^\w-]/g, '')
    downloadCSV(
      `presensi-${slug}-${session.date}.csv`,
      ['Nama', 'Peran', 'NIS', 'Kelas', 'Status', 'Diisi oleh'],
      [...staffRows, ...rows],
    )
    toast.success('Data presensi diekspor ke CSV')
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/sesi"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar sesi
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {eskul ? <EskulChip eskul={eskul} /> : null}
              <Badge variant="outline" className="gap-1">
                <CalendarDays className="size-3" />
                {formatDateShort(session.date)}
              </Badge>
              {isSubstituteMode ? (
                <Badge variant="warning" className="gap-1">
                  <ShieldCheck className="size-3" /> Mode pengganti
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-2 text-balance text-[26px] font-extrabold tracking-tight text-foreground sm:text-[30px]">
              {session.topic}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-primary" />
                {formatDate(session.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 className="size-3.5 text-primary" />
                {session.startTime} – {session.endTime}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                {session.location}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download />
              Ekspor CSV
            </Button>
            {canEdit ? (
              <Button variant="soft" onClick={handleMarkAllPresent}>
                <CheckCheck />
                Semua Anggota
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/60 bg-muted/15">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Daftar Presensi</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {members.length} anggota aktif · {filledCount} sudah diisi
                    {staffCount > 0 ? ` · ${staffFilled}/${staffCount} pembina` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      Tersimpan otomatis
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <LockKeyhole className="size-3" />
                      Hanya baca
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={completion} className="h-2 flex-1" />
                <span className="text-[11px] font-bold text-foreground">{completion}%</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {ATTENDANCE_STATUSES.map((status) => {
                  const meta = ATTENDANCE_META[status]
                  return (
                    <div
                      key={status}
                      className="rounded-xl border border-border/60 bg-card px-3 py-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn('size-1.5 rounded-full', meta.dot)} />
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-lg font-extrabold leading-none text-foreground">
                        {stats[status]}
                      </p>
                    </div>
                  )
                })}
              </div>
            </CardHeader>

            {user.role === 'ketua' && !canEdit ? (
              <div className="border-b border-amber-200/70 bg-amber-50/60 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/[0.06]">
                <div className="flex items-start gap-2.5">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
                  <p className="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-100/70">
                    <span className="font-bold">Presensi terkunci.</span>{' '}
                    {session.coachPresent === null
                      ? 'Pelatih belum mengonfirmasi kehadiran untuk sesi ini.'
                      : 'Pelatih tercatat hadir, sehingga presensi hanya dapat diisi pelatih.'}{' '}
                    Anda dapat mengisi presensi saat pelatih menandai dirinya berhalangan.
                  </p>
                </div>
              </div>
            ) : null}

            {isSubstituteMode ? (
              <div className="border-b border-sky-200/70 bg-sky-50/60 px-4 py-3 dark:border-sky-500/20 dark:bg-sky-500/[0.06]">
                <div className="flex items-start gap-2.5">
                  <UserCheck className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" />
                  <p className="text-[11px] leading-relaxed text-sky-900/80 dark:text-sky-100/70">
                    <span className="font-bold">Anda mengisi sebagai pengganti.</span> Pelatih{' '}
                    {coach?.name ?? ''} berhalangan. Setiap status yang Anda pilih tercatat atas
                    nama Anda dan ditandai sebagai isian pengganti.
                  </p>
                </div>
              </div>
            ) : null}

            {user.role === 'admin' ? (
              <div className="border-b border-violet-200/70 bg-violet-50/50 px-4 py-3 dark:border-violet-500/20 dark:bg-violet-500/[0.06]">
                <p className="flex items-center gap-2 text-[11px] text-violet-900/75 dark:text-violet-100/70">
                  <ShieldCheck className="size-3.5" />
                  Mode pantau administrator. Anda dapat meninjau seluruh isian dan mengekspor rekap.
                </p>
              </div>
            ) : null}

            {staffCount > 0 ? (
              <div className="border-b border-border/60 bg-muted/10">
                <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Pelatih & Ketua
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {staffFilled}/{staffCount} terisi
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {coach ? (
                    <StaffAttendanceRow
                      userId={coach.id}
                      name={coach.name}
                      role="pelatih"
                      hint="Status kehadiran menentukan akses presensi ketua eskul."
                      entry={coachEntry}
                      updatedByName={
                        store.users.find((item) => item.id === coachEntry?.updatedBy)?.name
                      }
                      canEdit={canEditCoachStaff}
                      onSelect={(status) => handleStaffAttendance(coach.id, 'pelatih', status)}
                    />
                  ) : null}
                  {leader ? (
                    <StaffAttendanceRow
                      userId={leader.id}
                      name={leader.name}
                      role="ketua"
                      hint={
                        isSubstituteMode
                          ? 'Pengganti pelatih · dapat mengisi presensi sesi ini.'
                          : 'Dapat mengisi presensi saat pelatih berhalangan.'
                      }
                      entry={leaderEntry}
                      updatedByName={
                        store.users.find((item) => item.id === leaderEntry?.updatedBy)?.name
                      }
                      canEdit={canEditLeaderStaff}
                      onSelect={(status) => handleStaffAttendance(leader.id, 'ketua', status)}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/10 px-4 pb-1 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Anggota Eskul
              </p>
              <span className="text-[10px] text-muted-foreground">
                {filledCount}/{members.length} terisi
              </span>
            </div>

            {members.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Users}
                  title="Belum ada anggota aktif"
                  description="Tambahkan anggota terlebih dahulu sebelum mengisi presensi."
                />
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {members.map((member, index) => {
                  const entry = session.attendance.find(
                    (item) => item.studentId === member.id,
                  )
                  const updatedBy = store.users.find((item) => item.id === entry?.updatedBy)
                  return (
                    <div
                      key={member.id}
                      className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="w-5 text-center text-[10px] font-bold text-muted-foreground/60">
                          {index + 1}
                        </span>
                        <Avatar name={member.name} id={member.id} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-xs font-bold text-foreground">
                              {member.name}
                            </p>
                            {entry?.asSubstitute ? (
                              <Badge variant="info" className="gap-1 px-1.5 py-0 text-[9px]">
                                <ShieldCheck className="size-2.5" /> Pengganti
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {member.className} · NIS {member.nis}
                          </p>
                          {entry ? (
                            <p className="mt-0.5 text-[9px] text-muted-foreground/70">
                              Diisi {updatedBy ? updatedBy.name : 'pengguna'} ·{' '}
                              {formatDateTime(entry.updatedAt)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {canEdit ? (
                        <AttendanceStatusPicker
                          current={entry?.status}
                          label={`Presensi ${member.name}`}
                          onSelect={(status) => handleSetAttendance(member.id, status)}
                        />
                      ) : (
                        <div className="flex shrink-0 items-center gap-2">
                          {entry ? (
                            <AttendanceBadge status={entry.status} />
                          ) : (
                            <Badge variant="outline">Belum diisi</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-col gap-1.5 border-t border-border/60 bg-muted/20 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {session.attendance.length > 0 || session.staffAttendance.length > 0
                  ? `Terakhir diisi oleh ${savedBy?.name ?? 'pengguna'}`
                  : 'Presensi belum diisi'}
              </span>
              <span>
                {stats.total} catatan anggota · {stats.rate}% kehadiran
              </span>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Kehadiran Pembina</CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Pelatih dan ketua eskul pada sesi ini.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={coach?.name ?? 'Pelatih'} id={coach?.id} size="xs" />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-foreground">
                        {coach?.name ?? 'Pelatih'}
                      </p>
                      <p className="text-[9px] text-muted-foreground">Pelatih {eskul?.name}</p>
                    </div>
                  </div>
                  {coachEntry ? (
                    <AttendanceBadge status={coachEntry.status} />
                  ) : (
                    <CoachPresenceBadge present={session.coachPresent} />
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={leader?.name ?? 'Ketua'} id={leader?.id} size="xs" />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-foreground">
                        {leader?.name ?? 'Ketua eskul'}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {isSubstituteMode
                          ? 'Pengganti · dapat mengisi presensi'
                          : 'Ketua eskul'}
                      </p>
                    </div>
                  </div>
                  {leaderEntry ? (
                    <AttendanceBadge status={leaderEntry.status} />
                  ) : (
                    <Badge variant="outline">Belum diisi</Badge>
                  )}
                </div>
              </div>

              {session.coachPresent === false ? (
                <div className="rounded-xl bg-sky-50/70 p-3 text-[10px] leading-relaxed text-sky-900/80 dark:bg-sky-500/[0.07] dark:text-sky-100/70">
                  <span className="font-bold">
                    {leader?.name ?? 'Ketua eskul'} dapat mengisi presensi.
                  </span>{' '}
                  Pelatih berhalangan, sehingga ketua eskul mendapat akses untuk sesi ini.
                </div>
              ) : session.coachPresent === null ? (
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Presensi ketua eskul menunggu konfirmasi kehadiran pelatih.
                </p>
              ) : (
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Presensi ketua eskul terkunci selama pelatih tercatat hadir.
                </p>
              )}

              {session.coachNote ? (
                <div className="rounded-xl bg-amber-50/70 p-3 text-[10px] leading-relaxed text-amber-900/80 dark:bg-amber-500/[0.07] dark:text-amber-100/70">
                  <span className="font-bold">Catatan pelatih:</span> {session.coachNote}
                </div>
              ) : null}
              {user.role === 'pelatih' ? (
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Ubah status pelatih pada daftar presensi. Status selain Hadir otomatis membuka
                  akses presensi untuk ketua eskul.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Detail Sesi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">{formatDate(session.date)}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {session.startTime} – {session.endTime}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">{session.location}</p>
                  <p className="mt-0.5 text-muted-foreground">Lokasi kegiatan</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">
                    {members.length} anggota aktif
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {stats.hadir} hadir · {stats.izin} izin · {stats.sakit} sakit · {stats.alpa}{' '}
                    alpa
                  </p>
                </div>
              </div>
              {session.notes ? (
                <div className="flex items-start gap-2.5">
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Catatan sesi</p>
                    <p className="mt-0.5 leading-relaxed text-muted-foreground">{session.notes}</p>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
                <span>Dibuat oleh</span>
                <span className="font-semibold text-foreground">
                  {store.users.find((item) => item.id === session.createdBy)?.name ?? '-'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Link
            to="/dokumentasi"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'w-full justify-between bg-card',
            )}
          >
            Lihat dokumentasi eskul
            <ArrowLeft className="rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  )
}
