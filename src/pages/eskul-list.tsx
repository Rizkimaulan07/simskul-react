import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  MapPin,
  Search,
  School,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { useAppStore } from '@/lib/store'
import { getAllAttendance, getEskulAttendance } from '@/lib/selectors'
import { eskulThemes } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function EskulListPage() {
  const store = useAppStore()
  const [search, setSearch] = useState('')

  const totalMembers = store.students.filter((student) => student.active).length
  const totalSessions = store.sessions.length
  const overall = getAllAttendance(store.sessions)
  const filteredEskul = store.eskul.filter((eskul) => {
    if (!search.trim()) return true
    const query = search.toLowerCase()
    return (
      eskul.name.toLowerCase().includes(query) ||
      eskul.description.toLowerCase().includes(query) ||
      eskul.day.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pemantauan Kesiswaan"
        title="Data Eskul"
        description="Lihat profil setiap ekstrakurikuler, pembina, anggota, serta performa kehadirannya."
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari eskul..."
              className="h-10 pl-9 text-xs"
              aria-label="Cari eskul"
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Eskul aktif"
          value={store.eskul.length}
          icon={School}
          hint="Terdaftar di kesiswaan"
          accent="primary"
        />
        <StatCard
          label="Anggota aktif"
          value={totalMembers}
          icon={Users}
          hint="Dari seluruh eskul"
          accent="sky"
        />
        <StatCard
          label="Total sesi"
          value={totalSessions}
          icon={CalendarCheck2}
          hint="Sepanjang tahun ajaran"
          accent="violet"
        />
        <StatCard
          label="Kehadiran global"
          value={`${overall.rate}%`}
          icon={TrendingUp}
          hint={`${overall.hadir} hadir dari ${overall.total} catatan`}
          accent="amber"
        />
      </div>

      {filteredEskul.length === 0 ? (
        <EmptyState
          icon={School}
          title="Eskul tidak ditemukan"
          description="Coba kata kunci lain untuk menemukan ekstrakurikuler."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEskul.map((eskul) => {
            const theme = eskulThemes[eskul.color]
            const coach = store.users.find((user) => user.id === eskul.coachId)
            const leader = store.users.find((user) => user.id === eskul.leaderId)
            const members = store.students.filter(
              (student) => student.eskulId === eskul.id && student.active,
            )
            const sessions = store.sessions.filter((session) => session.eskulId === eskul.id)
            const stats = getEskulAttendance(store.sessions, eskul.id)
            return (
              <Card
                key={eskul.id}
                className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/[0.06]"
              >
                <div className={cn('relative h-32 overflow-hidden p-4', theme.cover)}>
                  <div className="grid-pattern absolute inset-0 opacity-30" />
                  <div className="absolute -right-6 -top-8 size-28 rounded-full border border-white/15" />
                  <div className="relative flex items-start justify-between">
                    <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white backdrop-blur">
                      {eskul.shortName}
                    </span>
                    <Badge variant="dark">{eskul.day}</Badge>
                  </div>
                  <div className="absolute inset-x-4 bottom-4">
                    <h3 className="text-xl font-extrabold tracking-tight text-white">
                      {eskul.name}
                    </h3>
                    <p className="mt-0.5 text-[10px] font-medium text-white/60">
                      {members.length} anggota · {sessions.length} sesi
                    </p>
                  </div>
                </div>
                <CardContent className="space-y-3.5 p-4">
                  <p className="line-clamp-2 min-h-8 text-[11px] leading-relaxed text-muted-foreground">
                    {eskul.description}
                  </p>
                  <div className="space-y-1.5 text-[10px] text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Clock3 className="size-3 text-primary" />
                      {eskul.time}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="size-3 text-primary" />
                      {eskul.location}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="size-3 text-primary" />
                      Setiap {eskul.day}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 pt-3">
                    <div className="flex -space-x-1.5">
                      <Avatar name={coach?.name ?? 'Pelatih'} id={coach?.id} size="xs" />
                      <Avatar
                        name={leader?.name ?? 'Ketua'}
                        id={leader?.id}
                        size="xs"
                        className="ring-card"
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Kehadiran
                      </p>
                      <p className="text-sm font-extrabold text-foreground">{stats.rate}%</p>
                    </div>
                  </div>
                  <Progress
                    value={stats.rate}
                    className="h-1.5"
                    indicatorClassName={
                      stats.rate >= 90
                        ? 'bg-emerald-500'
                        : stats.rate >= 75
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }
                  />
                  <Link
                    to={`/eskul/${eskul.id}`}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'w-full justify-between bg-card group-hover:border-primary/25 group-hover:text-primary',
                    )}
                  >
                    Lihat profil eskul
                    <ArrowRight />
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
