import {
  CalendarCheck2,
  CalendarDays,
  CalendarX2,
  ClipboardList,
  Info,
  Plus,
  Search,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { CreateSessionDialog } from '@/components/sessions/create-session-dialog'
import { SessionRow } from '@/components/sessions/session-row'
import { useAppStore, useCurrentUser } from '@/lib/store'
import { canEditAttendance } from '@/lib/permissions'
import { getAllAttendance, getDelegatedSessions, getMonthlyAttendance } from '@/lib/selectors'
import { cn, todayISO } from '@/lib/utils'

type StatusFilter = 'semua' | 'akan-datang' | 'selesai'

export function SessionsPage() {
  const user = useCurrentUser()
  const store = useAppStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua')
  const [eskulFilter, setEskulFilter] = useState('semua')
  const [createOpen, setCreateOpen] = useState(false)

  if (!user) return null

  const eskul = store.eskul.find((item) => item.id === user.eskulId)
  const baseSessions = store.sessions
    .filter((session) =>
      user.role === 'admin' ? true : session.eskulId === user.eskulId,
    )
    .sort((a, b) => b.date.localeCompare(a.date))
  const scopedSessions =
    user.role === 'admin' && eskulFilter !== 'semua'
      ? baseSessions.filter((session) => session.eskulId === eskulFilter)
      : baseSessions
  const today = todayISO()
  const month = today.slice(0, 7)
  const stats = getAllAttendance(baseSessions)
  const monthlyStats = getMonthlyAttendance(baseSessions)
  const monthlyCount = baseSessions.filter((session) => session.date.startsWith(month)).length
  const unfilled = baseSessions.filter(
    (session) =>
      session.date < today &&
      session.attendance.length === 0 &&
      session.staffAttendance.length === 0,
  ).length
  const delegatedSessions = user.role === 'ketua' && user.eskulId
    ? getDelegatedSessions(baseSessions, user.eskulId)
    : []

  const filteredSessions = scopedSessions
    .filter((session) => {
      if (statusFilter === 'akan-datang' && session.date < today) return false
      if (statusFilter === 'selesai' && session.date >= today) return false
      if (!search.trim()) return true
      const query = search.toLowerCase()
      return (
        session.topic.toLowerCase().includes(query) ||
        session.location.toLowerCase().includes(query)
      )
    })
    .sort((a, b) =>
      statusFilter === 'akan-datang'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date),
    )

  const upcomingCount = scopedSessions.filter((session) => session.date >= today).length
  const pastCount = scopedSessions.filter((session) => session.date < today).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Presensi & Kehadiran"
        title="Sesi & Presensi"
        description={
          user.role === 'admin'
            ? 'Pantau seluruh sesi eskul dan rekap kehadiran anggota lintas ekstrakurikuler.'
            : user.role === 'ketua'
              ? `Pantau sesi ${eskul?.name ?? 'eskul'}. Anda dapat mengisi presensi saat pelatih berhalangan.`
              : `Buat sesi, isi presensi, dan pantau kehadiran anggota ${eskul?.name ?? 'eskul'}.`
        }
        actions={
          user.role === 'pelatih' && eskul ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Buat Sesi
            </Button>
          ) : undefined
        }
      />

      {user.role === 'ketua' ? (
        delegatedSessions.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/20 dark:from-amber-500/10 dark:to-amber-500/[0.03]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <ShieldAlert className="size-5" />
              </span>
              <div>
                <p className="text-xs font-bold text-amber-950 dark:text-amber-50">
                  {delegatedSessions.length} sesi dititipkan kepada Anda
                </p>
                <p className="mt-0.5 text-[11px] text-amber-800/70 dark:text-amber-100/60">
                  {delegatedSessions[0].topic} · {delegatedSessions[0].startTime} –{' '}
                  {delegatedSessions[0].endTime}
                </p>
              </div>
            </div>
            <Link
              to={`/sesi/${delegatedSessions[0].id}`}
              className={cn(
                buttonVariants({ size: 'sm' }),
                'shrink-0 bg-amber-600 hover:bg-amber-700',
              )}
            >
              Isi Presensi Sekarang
            </Link>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/60 p-4 dark:border-sky-500/20 dark:bg-sky-500/[0.06]">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" />
            <p className="text-[11px] leading-relaxed text-sky-900/80 dark:text-sky-100/70">
              <span className="font-bold">Presensi masih dikunci.</span> Anda dapat mengisi
              presensi setelah pelatih menandai dirinya berhalangan pada sesi tersebut. Nilai
              eskul tetap hanya dapat diubah oleh pelatih.
            </p>
          </div>
        )
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total sesi"
          value={baseSessions.length}
          icon={CalendarCheck2}
          hint={user.role === 'admin' ? 'Seluruh eskul' : eskul?.name}
          accent="primary"
        />
        <StatCard
          label="Sesi bulan ini"
          value={monthlyCount}
          icon={CalendarDays}
          hint={`${monthlyStats.total} catatan kehadiran`}
          accent="violet"
        />
        <StatCard
          label="Rata-rata kehadiran"
          value={`${stats.rate}%`}
          icon={TrendingUp}
          hint={`${stats.hadir} hadir dari ${stats.total} catatan`}
          accent="sky"
        />
        {user.role === 'ketua' ? (
          <StatCard
            label="Sesi dititipkan"
            value={delegatedSessions.length}
            icon={ShieldAlert}
            hint="Presensi terbuka untuk Anda"
            accent="amber"
          />
        ) : (
          <StatCard
            label="Presensi belum diisi"
            value={unfilled}
            icon={ClipboardList}
            hint="Sesi lampau tanpa presensi"
            accent="amber"
          />
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Tabs
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              items={[
                { value: 'semua', label: 'Semua', count: scopedSessions.length },
                { value: 'akan-datang', label: 'Akan datang', count: upcomingCount },
                { value: 'selesai', label: 'Selesai', count: pastCount },
              ]}
            />
            {user.role === 'admin' ? (
              <Select
                value={eskulFilter}
                onChange={(event) => setEskulFilter(event.target.value)}
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
          <div className="relative w-full lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari kegiatan atau lokasi..."
              className="h-9 pl-9 text-xs"
              aria-label="Cari sesi"
            />
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={CalendarX2}
              title="Tidak ada sesi yang cocok"
              description="Ubah filter atau buat sesi baru untuk memulai pencatatan presensi."
              action={
                user.role === 'pelatih' && eskul ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus />
                    Buat Sesi
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredSessions.map((session) => {
              const sessionEskul = store.eskul.find((item) => item.id === session.eskulId)
              const coach = store.users.find((item) => item.id === sessionEskul?.coachId)
              const canEdit = canEditAttendance(user, session)
              return (
                <SessionRow
                  key={session.id}
                  session={session}
                  eskul={sessionEskul}
                  coachName={coach?.name ?? 'Pelatih'}
                  canEdit={canEdit}
                  showEskul={user.role === 'admin'}
                  delegated={
                    user.role === 'ketua' &&
                    session.coachPresent === false &&
                    session.eskulId === user.eskulId
                  }
                />
              )
            })}
          </div>
        )}
      </Card>

      {user.role === 'pelatih' && eskul && createOpen ? (
        <CreateSessionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          eskul={eskul}
          userId={user.id}
          onCreated={(session) => navigate(`/sesi/${session.id}`)}
        />
      ) : null}
    </div>
  )
}
