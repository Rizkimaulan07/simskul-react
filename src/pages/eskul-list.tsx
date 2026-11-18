import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  MapPin,
  Pencil,
  School,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EskulDeleteDialog, EskulFormDialog } from '@/components/eskul/eskul-form-dialog'
import { useAppStore, useCurrentUser } from '@/lib/store'
import { getAllAttendance, getEskulAttendance } from '@/lib/selectors'
import { eskulThemes } from '@/lib/theme'
import type { Eskul } from '@/lib/types'
import { cn } from '@/lib/utils'

export function EskulListPage() {
  const store = useAppStore()
  const currentUser = useCurrentUser()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingEskul, setEditingEskul] = useState<Eskul | null>(null)
  const [deletingEskul, setDeletingEskul] = useState<Eskul | null>(null)

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
        eyebrow="Administrasi Kesiswaan"
        title="Data Eskul"
        description="Kelola profil setiap ekstrakurikuler, pembina, anggota, serta performa kehadirannya."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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
            <Button
              onClick={() => {
                setEditingEskul(null)
                setFormOpen(true)
              }}
              className="shrink-0"
            >
              <School />
              Tambah Eskul
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
          description={
            store.eskul.length === 0
              ? 'Belum ada eskul terdaftar. Tambahkan eskul pertama untuk memulai.'
              : 'Coba kata kunci lain untuk menemukan ekstrakurikuler.'
          }
          action={
            store.eskul.length === 0 ? (
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <School />
                Tambah Eskul
              </Button>
            ) : undefined
          }
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
                    {eskul.logoUrl ? (
                      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white">
                        <img
                          src={eskul.logoUrl}
                          alt={`Logo ${eskul.name}`}
                          className="size-full scale-150 object-contain"
                        />
                      </span>
                    ) : (
                      <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white backdrop-blur">
                        {eskul.shortName}
                      </span>
                    )}
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
                  <div className="flex gap-1.5">
                    <Link
                      to={`/eskul/${eskul.id}`}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'flex-1 justify-between bg-card group-hover:border-primary/25 group-hover:text-primary',
                      )}
                    >
                      Lihat profil eskul
                      <ArrowRight />
                    </Link>
                    {currentUser?.role === 'admin' ? (
                      <>
                        <Button
                          variant="outline"
                          size="iconSm"
                          className="shrink-0"
                          title="Edit eskul"
                          aria-label={`Edit ${eskul.name}`}
                          onClick={() => {
                            setEditingEskul(eskul)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="outline"
                          size="iconSm"
                          className="shrink-0 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                          title="Hapus eskul"
                          aria-label={`Hapus ${eskul.name}`}
                          onClick={() => setDeletingEskul(eskul)}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {formOpen ? (
        <EskulFormDialog
          open
          onOpenChange={setFormOpen}
          eskul={editingEskul ?? undefined}
          users={store.users}
        />
      ) : null}
      {deletingEskul ? (
        <EskulDeleteDialog
          eskul={deletingEskul}
          memberCount={
            store.students.filter(
              (student) => student.eskulId === deletingEskul.id && student.active,
            ).length
          }
          onClose={() => setDeletingEskul(null)}
        />
      ) : null}
    </div>
  )
}
