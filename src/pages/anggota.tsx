import {
  AlertTriangle,
  Download,
  Search,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { canManageMembers } from '@/lib/permissions'
import { useAppStore, useCurrentUser } from '@/lib/store'
import { getStudentAttendance } from '@/lib/selectors'
import type { Gender } from '@/lib/types'
import { cn, downloadCSV, percentage } from '@/lib/utils'

type MemberFilter = 'semua' | 'aktif' | 'nonaktif'

export function MembersPage() {
  const user = useCurrentUser()
  const store = useAppStore()
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('semua')
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('semua')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    nis: '',
    className: '',
    gender: 'L' as Gender,
  })

  if (!user) return null

  const eskul = store.eskul.find((item) => item.id === user.eskulId)
  const allMembers = store.students
    .filter((student) => student.eskulId === user.eskulId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const activeMembers = allMembers.filter((student) => student.active)
  const canManage = canManageMembers(user)

  const enriched = allMembers.map((student) => ({
    student,
    stats: getStudentAttendance(store.sessions, student.id),
  }))
  const filtered = enriched.filter(({ student }) => {
    if (memberFilter === 'aktif' && !student.active) return false
    if (memberFilter === 'nonaktif' && student.active) return false
    if (classFilter !== 'semua' && student.className !== classFilter) return false
    if (!search.trim()) return true
    const query = search.toLowerCase()
    return (
      student.name.toLowerCase().includes(query) ||
      student.nis.includes(query) ||
      student.className.toLowerCase().includes(query)
    )
  })

  const totalEntries = activeMembers.reduce(
    (acc, student) => {
      const stats = getStudentAttendance(store.sessions, student.id)
      acc.hadir += stats.hadir
      acc.total += stats.total
      if (stats.total > 0 && stats.rate < 75) acc.attention += 1
      return acc
    },
    { hadir: 0, total: 0, attention: 0 },
  )
  const averageRate = percentage(totalEntries.hadir, totalEntries.total)
  const classOptions = Array.from(new Set(allMembers.map((student) => student.className))).sort()

  const handleExport = () => {
    const rows = filtered.map(({ student, stats }) => [
      student.name,
      student.nis,
      student.className,
      student.gender === 'L' ? 'Laki-laki' : 'Perempuan',
      student.active ? 'Aktif' : 'Nonaktif',
      stats.hadir,
      stats.izin,
      stats.sakit,
      stats.alpa,
      `${stats.rate}%`,
    ])
    downloadCSV(
      `anggota-${eskul?.name.toLowerCase().replaceAll(' ', '-') ?? 'eskul'}.csv`,
      ['Nama', 'NIS', 'Kelas', 'Gender', 'Status', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Kehadiran'],
      rows,
    )
    toast.success('Data anggota diekspor ke CSV')
  }

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    if (!user.eskulId) return
    if (!form.name.trim() || !form.nis.trim() || !form.className.trim()) {
      toast.error('Lengkapi nama, NIS, dan kelas anggota.')
      return
    }
    if (store.students.some((student) => student.nis === form.nis.trim())) {
      toast.error('NIS sudah terdaftar', {
        description: 'Periksa kembali nomor induk siswa tersebut.',
      })
      return
    }
    store.addStudent(
      {
        name: form.name.trim(),
        nis: form.nis.trim(),
        className: form.className.trim(),
        gender: form.gender,
        eskulId: user.eskulId,
      },
      user.id,
    )
    toast.success('Anggota berhasil ditambahkan', {
      description: `${form.name.trim()} kini terdaftar di ${eskul?.name}.`,
    })
    setForm({ name: '', nis: '', className: '', gender: 'L' })
    setAddOpen(false)
  }

  const handleToggleActive = (studentId: string, name: string, active: boolean) => {
    store.toggleStudentActive(studentId, user.id)
    toast.success(active ? 'Anggota dinonaktifkan' : 'Anggota diaktifkan kembali', {
      description: name,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eskul ? `Manajemen ${eskul.name}` : 'Manajemen Eskul'}
        title="Data Anggota"
        description="Kelola daftar anggota eskul, pantau kehadiran, dan ekspor rekap untuk kebutuhan pembinaan."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus />
              Tambah Anggota
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total anggota"
          value={allMembers.length}
          icon={Users}
          hint={eskul ? `Kuota ${eskul.quota} siswa` : undefined}
          accent="primary"
        />
        <StatCard
          label="Anggota aktif"
          value={activeMembers.length}
          icon={UserCheck}
          hint={`${allMembers.length - activeMembers.length} nonaktif`}
          accent="sky"
        />
        <StatCard
          label="Rata-rata kehadiran"
          value={`${averageRate}%`}
          icon={TrendingUp}
          hint={`${totalEntries.hadir} hadir dari ${totalEntries.total} catatan`}
          accent="violet"
        />
        <StatCard
          label="Perlu perhatian"
          value={totalEntries.attention}
          icon={AlertTriangle}
          hint="Kehadiran di bawah 75%"
          accent="amber"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Tabs
              value={memberFilter}
              onValueChange={(value) => setMemberFilter(value as MemberFilter)}
              items={[
                { value: 'semua', label: 'Semua', count: allMembers.length },
                { value: 'aktif', label: 'Aktif', count: activeMembers.length },
                {
                  value: 'nonaktif',
                  label: 'Nonaktif',
                  count: allMembers.length - activeMembers.length,
                },
              ]}
            />
            <Select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="h-9 w-full text-xs sm:w-36"
              aria-label="Filter kelas"
            >
              <option value="semua">Semua kelas</option>
              {classOptions.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full lg:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, NIS, kelas..."
                className="h-9 pl-9 text-xs"
                aria-label="Cari anggota"
              />
            </div>
            <Button variant="outline" size="icon" onClick={handleExport} title="Ekspor CSV">
              <Download />
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="Belum ada anggota yang cocok"
              description="Ubah filter atau tambahkan anggota baru ke eskul ini."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <UserPlus />
                    Tambah Anggota
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anggota</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead className="hidden md:table-cell">Kehadiran</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ student, stats }) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={student.name} id={student.id} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-foreground">
                            {student.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            NIS {student.nis} · {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-foreground">{student.className}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {stats.total > 0 ? (
                        <div className="w-40">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">
                              {stats.hadir}/{stats.total} hadir
                            </span>
                            <span
                              className={cn(
                                'font-bold',
                                stats.rate >= 90
                                  ? 'text-emerald-600'
                                  : stats.rate >= 75
                                    ? 'text-amber-600'
                                    : 'text-rose-600',
                              )}
                            >
                              {stats.rate}%
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
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Belum ada data</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.active ? 'default' : 'secondary'}>
                        {student.active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() =>
                              handleToggleActive(student.id, student.name, student.active)
                            }
                            title={student.active ? 'Nonaktifkan anggota' : 'Aktifkan anggota'}
                            aria-label={
                              student.active ? 'Nonaktifkan anggota' : 'Aktifkan anggota'
                            }
                            className={cn(
                              'text-muted-foreground',
                              student.active
                                ? 'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10'
                                : 'hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10',
                            )}
                          >
                            {student.active ? <UserX /> : <UserCheck />}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border/60 px-4 py-3 text-[10px] text-muted-foreground">
              Menampilkan {filtered.length} dari {allMembers.length} anggota
            </div>
          </>
        )}
      </Card>

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Tambah Anggota"
        description={`Daftarkan siswa baru ke ${eskul?.name ?? 'eskul'}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="add-member-form">
              <UserPlus />
              Simpan Anggota
            </Button>
          </>
        }
      >
        <form id="add-member-form" onSubmit={handleAdd} className="space-y-4">
          <Field label="Nama lengkap" htmlFor="member-name" required>
            <Input
              id="member-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Contoh: Nayla Putri Ramadhani"
              autoFocus
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="NIS" htmlFor="member-nis" required>
              <Input
                id="member-nis"
                value={form.nis}
                onChange={(event) => setForm({ ...form, nis: event.target.value })}
                placeholder="2026030"
                inputMode="numeric"
              />
            </Field>
            <Field label="Kelas" htmlFor="member-class" required>
              <Input
                id="member-class"
                value={form.className}
                onChange={(event) => setForm({ ...form, className: event.target.value })}
                placeholder="Contoh: 10 PPLG 1"
              />
            </Field>
          </div>
          <Field label="Jenis kelamin" htmlFor="member-gender" required>
            <Select
              id="member-gender"
              value={form.gender}
              onChange={(event) => setForm({ ...form, gender: event.target.value as Gender })}
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
          </Field>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-[11px] leading-relaxed text-emerald-900/70 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06] dark:text-emerald-100/70">
            Anggota baru otomatis berstatus aktif dan langsung muncul pada daftar presensi sesi
            berikutnya.
          </div>
        </form>
      </Dialog>
    </div>
  )
}
