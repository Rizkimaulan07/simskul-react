import {
  ArrowLeft,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  Images,
  MapPin,
  Pencil,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import { DocImage } from '@/components/shared/doc-image'
import { CoachPresenceBadge, PermitStatusBadge } from '@/components/shared/badges'
import { SessionRow } from '@/components/sessions/session-row'
import { EskulFormDialog } from '@/components/eskul/eskul-form-dialog'
import { StatCard } from '@/components/shared/stat-card'
import { useAppStore, useCurrentUser } from '@/lib/store'
import {
  getActiveStudents,
  getEskulAttendance,
  getStudentAttendance,
} from '@/lib/selectors'
import { eskulThemes } from '@/lib/theme'
import type { Permit } from '@/lib/types'
import { cn, formatDateShort, formatDateRange, todayISO } from '@/lib/utils'

type DetailTab = 'ringkasan' | 'anggota' | 'sesi' | 'dokumentasi'

function PermitRow({ permit }: { permit: Permit }) {
  return (
    <Link
      to={`/surat/${permit.id}`}
      className="flex items-center gap-2.5 rounded-xl border border-border/60 p-2.5 transition-colors hover:bg-muted/40"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ClipboardCheck className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-foreground">{permit.title}</p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          {formatDateRange(permit.startDate, permit.endDate)}
        </p>
      </div>
      <PermitStatusBadge status={permit.status} />
    </Link>
  )
}

export function EskulDetailPage() {
  const { id } = useParams<{ id: string }>()
  const store = useAppStore()
  const currentUser = useCurrentUser()
  const [tab, setTab] = useState<DetailTab>('ringkasan')
  const [formOpen, setFormOpen] = useState(false)

  const eskul = store.eskul.find((item) => item.id === id)

  if (!eskul) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Eskul tidak ditemukan"
        description="Data ekstrakurikuler yang Anda cari tidak tersedia."
        action={
          <Link to="/eskul" className={buttonVariants()}>
            Kembali ke data eskul
          </Link>
        }
      />
    )
  }

  const theme = eskulThemes[eskul.color]
  const coach = store.users.find((user) => user.id === eskul.coachId)
  const leader = store.users.find((user) => user.id === eskul.leaderId)
  const members = store.students
    .filter((student) => student.eskulId === eskul.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const activeMembers = getActiveStudents(store.students, eskul.id)
  const sessions = store.sessions
    .filter((session) => session.eskulId === eskul.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const stats = getEskulAttendance(store.sessions, eskul.id)
  const eskulPermits = store.permits
    .filter((permit) => permit.eskulId === eskul.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const pendingPermits = eskulPermits.filter((permit) => permit.status === 'diajukan')
  const docs = store.documentation
    .filter((doc) => doc.eskulId === eskul.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const upcomingSessions = sessions
    .filter((session) => session.date >= todayISO())
    .sort((a, b) => a.date.localeCompare(b.date))
  const nextSessions = upcomingSessions.slice(0, 3)

  return (
    <div className="space-y-5">
      <Link
        to="/eskul"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Kembali ke data eskul
      </Link>

      <div className={cn('relative overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:p-8', theme.cover)}>
        <div className="grid-pattern absolute inset-0 opacity-30" />
        <div className="absolute -right-16 -top-20 size-64 rounded-full border border-white/10" />
        <div className="absolute -bottom-24 right-24 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="dark" className="gap-1">
              <CalendarDays className="size-3" />
              Setiap {eskul.day}
            </Badge>
            <Badge variant="dark" className="gap-1">
              <Users className="size-3" />
              {activeMembers.length} / {eskul.quota} anggota
            </Badge>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{eskul.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
            {eskul.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/70">
            <span className="flex items-center gap-1.5">
              <Clock3 className="size-3.5 text-white/50" />
              {eskul.time}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-white/50" />
              {eskul.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Avatar name={coach?.name ?? 'Pelatih'} id={coach?.id} size="xs" className="ring-white/20" />
              {coach?.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Avatar name={leader?.name ?? 'Ketua'} id={leader?.id} size="xs" className="ring-white/20" />
              {leader?.name}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Anggota aktif"
          value={activeMembers.length}
          icon={Users}
          hint={`Kuota ${eskul.quota} siswa`}
          accent="primary"
        />
        <StatCard
          label="Total sesi"
          value={sessions.length}
          icon={CalendarCheck2}
          hint="Sepanjang tahun ajaran"
          accent="sky"
        />
        <StatCard
          label="Kehadiran"
          value={`${stats.rate}%`}
          icon={TrendingUp}
          hint={`${stats.hadir} hadir dari ${stats.total} catatan`}
          accent="violet"
        />
        <StatCard
          label="Izin menunggu"
          value={pendingPermits.length}
          icon={ClipboardCheck}
          hint="Menunggu persetujuan"
          accent="amber"
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as DetailTab)}
        items={[
          { value: 'ringkasan', label: 'Ringkasan' },
          { value: 'anggota', label: 'Anggota', count: members.length },
          { value: 'sesi', label: 'Sesi', count: sessions.length },
          { value: 'dokumentasi', label: 'Dokumentasi', count: docs.length },
        ]}
      />

      {tab === 'ringkasan' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Informasi Eskul</CardTitle>
                {currentUser?.role === 'admin' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormOpen(true)}
                    className="shrink-0"
                  >
                    <Pencil />
                    Edit Eskul
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    Pelatih / Pembina
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Avatar name={coach?.name ?? 'Pelatih'} id={coach?.id} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{coach?.name}</p>
                      <p className="text-[10px] text-muted-foreground">{coach?.email}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    Ketua Eskul
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Avatar name={leader?.name ?? 'Ketua'} id={leader?.id} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{leader?.name}</p>
                      <p className="text-[10px] text-muted-foreground">{leader?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3 border-t border-border/60 pt-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      Jadwal
                    </p>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {eskul.day}, {eskul.time}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      Lokasi
                    </p>
                    <p className="mt-1 text-xs font-semibold text-foreground">{eskul.location}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      Kuota
                    </p>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {activeMembers.length} dari {eskul.quota} siswa
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Sesi mendatang</CardTitle>
                <Link to="/sesi" className="text-[10px] font-bold text-primary hover:underline">
                  Semua sesi
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {nextSessions.length === 0 ? (
                  <p className="rounded-xl bg-muted/40 py-6 text-center text-[11px] text-muted-foreground">
                    Belum ada sesi mendatang yang dijadwalkan.
                  </p>
                ) : (
                  nextSessions.map((session) => (
                    <Link
                      key={session.id}
                      to={`/sesi/${session.id}`}
                      className="group flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/25 hover:bg-muted/30"
                    >
                      <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="text-sm font-extrabold leading-none">
                          {new Date(`${session.date}T00:00:00`).getDate()}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-wider">
                          {new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(
                            new Date(`${session.date}T00:00:00`),
                          )}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-foreground group-hover:text-primary">
                          {session.topic}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatDateShort(session.date)} · {session.startTime} – {session.endTime}
                        </p>
                      </div>
                      <CoachPresenceBadge present={session.coachPresent} />
                      <ChevronRight className="size-4 text-muted-foreground/40" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Rekap Kehadiran</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-extrabold tracking-tight text-foreground">
                      {stats.rate}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {stats.hadir} dari {stats.total} catatan hadir
                    </p>
                  </div>
                  <TrendingUp className="size-6 text-emerald-500" />
                </div>
                <Progress value={stats.rate} className="h-2" />
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'H', value: stats.hadir, className: 'text-emerald-600' },
                    { label: 'I', value: stats.izin, className: 'text-sky-600' },
                    { label: 'S', value: stats.sakit, className: 'text-amber-600' },
                    { label: 'A', value: stats.alpa, className: 'text-rose-600' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-border/60 bg-muted/20 px-2 py-2 text-center"
                    >
                      <p className={cn('text-sm font-extrabold', item.className)}>{item.value}</p>
                      <p className="text-[9px] font-semibold text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm">Surat Izin</CardTitle>
                <Link to="/surat" className="text-[10px] font-bold text-primary hover:underline">
                  Lihat semua
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {eskulPermits.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-muted-foreground">
                    Belum ada surat izin.
                  </p>
                ) : (
                  eskulPermits.slice(0, 3).map((permit) => (
                    <PermitRow key={permit.id} permit={permit} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'anggota' ? (
        <Card className="overflow-hidden">
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Belum ada anggota"
              description="Anggota yang terdaftar di eskul ini akan tampil di sini."
              className="m-4"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anggota</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Kehadiran</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((student) => {
                    const studentStats = getStudentAttendance(store.sessions, student.id)
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={student.name} id={student.id} size="sm" />
                            <div>
                              <p className="text-xs font-bold text-foreground">{student.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                NIS {student.nis}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-foreground">{student.className}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex w-40 items-center gap-2">
                            <Progress value={studentStats.rate} className="h-1.5 flex-1" />
                            <span className="text-[10px] font-bold text-foreground">
                              {studentStats.total ? `${studentStats.rate}%` : '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.active ? 'default' : 'secondary'}>
                            {student.active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="border-t border-border/60 px-4 py-3 text-[10px] text-muted-foreground">
                {members.length} anggota terdaftar · {activeMembers.length} aktif
              </div>
            </>
          )}
        </Card>
      ) : null}

      {tab === 'sesi' ? (
        <Card className="overflow-hidden">
          {sessions.length === 0 ? (
            <EmptyState
              icon={CalendarCheck2}
              title="Belum ada sesi"
              description="Sesi eskul akan muncul di sini setelah dibuat oleh pelatih."
              className="m-4"
            />
          ) : (
            <div className="divide-y divide-border/60">
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  eskul={eskul}
                  coachName={coach?.name ?? 'Pelatih'}
                  canEdit={false}
                />
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'dokumentasi' ? (
        docs.length === 0 ? (
          <EmptyState
            icon={Images}
            title="Belum ada dokumentasi"
            description="Dokumentasi kegiatan eskul ini akan tampil di sini."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                to="/dokumentasi"
                className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <DocImage
                    src={doc.imageUrl}
                    alt={doc.title}
                    className="size-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                  <p className="absolute inset-x-3 bottom-3 line-clamp-2 text-sm font-bold text-white">
                    {doc.title}
                  </p>
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-[10px] text-muted-foreground">
                    {formatDateShort(doc.date)} ·{' '}
                    {store.users.find((user) => user.id === doc.uploadedBy)?.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : null}

      {formOpen ? (
        <EskulFormDialog
          open
          onOpenChange={setFormOpen}
          eskul={eskul}
          users={store.users}
        />
      ) : null}
    </div>
  )
}
