import {
  Award,
  ClipboardCheck,
  Download,
  Printer,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { PermitStatusBadge } from '@/components/shared/badges'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import {
  CURRENT_SEMESTER,
  PERMIT_STATUSES,
  PERMIT_STATUS_META,
  PERMIT_TYPE_LABELS,
  SCHOOL_NAME,
  SEMESTER_OPTIONS,
} from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import {
  getAllAttendance,
  getEskulAttendance,
  getFinalScore,
  getPredicate,
  getStudentAttendance,
} from '@/lib/selectors'
import {
  cn,
  downloadCSV,
  formatDateRange,
  formatDateShort,
  percentage,
  todayISO,
} from '@/lib/utils'

type ReportTab = 'kehadiran' | 'nilai' | 'surat'

export function ReportsPage() {
  const store = useAppStore()
  const [tab, setTab] = useState<ReportTab>('kehadiran')
  const [eskulFilter, setEskulFilter] = useState('semua')
  const [semester, setSemester] = useState(CURRENT_SEMESTER)
  const [search, setSearch] = useState('')

  const activeStudents = store.students.filter((student) => student.active)
  const scopedStudents =
    eskulFilter === 'semua'
      ? activeStudents
      : activeStudents.filter((student) => student.eskulId === eskulFilter)
  const filteredStudents = scopedStudents.filter((student) => {
    if (!search.trim()) return true
    return (
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.className.toLowerCase().includes(search.toLowerCase())
    )
  })
  const scopedPermits = store.permits
    .filter((permit) => (eskulFilter === 'semua' ? true : permit.eskulId === eskulFilter))
    .filter((permit) => {
      if (!search.trim()) return true
      return permit.title.toLowerCase().includes(search.toLowerCase())
    })
    .sort((a, b) => {
      if (a.status === 'diajukan' && b.status !== 'diajukan') return -1
      if (a.status !== 'diajukan' && b.status === 'diajukan') return 1
      return b.createdAt.localeCompare(a.createdAt)
    })

  const overall = getAllAttendance(store.sessions)
  const allGraded = activeStudents
    .map((student) =>
      store.grades.find(
        (grade) => grade.studentId === student.id && grade.semester === semester,
      ),
    )
    .map((grade) => getFinalScore(grade))
    .filter((score): score is number => score !== null)
  const averageGrade = allGraded.length
    ? Math.round(allGraded.reduce((sum, score) => sum + score, 0) / allGraded.length)
    : 0
  const pendingCount = store.permits.filter((permit) => permit.status === 'diajukan').length
  const permitCounts = PERMIT_STATUSES.reduce(
    (acc, status) => {
      acc[status] = store.permits.filter((permit) => permit.status === status).length
      return acc
    },
    {} as Record<(typeof PERMIT_STATUSES)[number], number>,
  )

  const handleExport = () => {
    if (tab === 'kehadiran') {
      downloadCSV(
        `laporan-kehadiran-${todayISO()}.csv`,
        ['Nama', 'Eskul', 'Kelas', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Kehadiran'],
        filteredStudents.map((student) => {
          const stats = getStudentAttendance(store.sessions, student.id)
          const eskul = store.eskul.find((item) => item.id === student.eskulId)
          return [
            student.name,
            eskul?.name ?? '-',
            student.className,
            stats.hadir,
            stats.izin,
            stats.sakit,
            stats.alpa,
            `${stats.rate}%`,
          ]
        }),
      )
    } else if (tab === 'nilai') {
      downloadCSV(
        `laporan-nilai-${semester.replaceAll(' ', '-')}.csv`,
        ['Nama', 'Eskul', 'Kelas', 'Keaktifan', 'Sikap', 'Keterampilan', 'Akhir', 'Predikat'],
        filteredStudents.map((student) => {
          const grade = store.grades.find(
            (item) => item.studentId === student.id && item.semester === semester,
          )
          const final = getFinalScore(grade)
          const eskul = store.eskul.find((item) => item.id === student.eskulId)
          return [
            student.name,
            eskul?.name ?? '-',
            student.className,
            grade?.keaktifan ?? '-',
            grade?.sikap ?? '-',
            grade?.keterampilan ?? '-',
            final ?? '-',
            getPredicate(final).letter,
          ]
        }),
      )
    } else {
      downloadCSV(
        `laporan-surat-izin-${todayISO()}.csv`,
        ['Kegiatan', 'Eskul', 'Jenis', 'Mulai', 'Selesai', 'Lokasi', 'Status', 'Catatan'],
        scopedPermits.map((permit) => {
          const eskul = store.eskul.find((item) => item.id === permit.eskulId)
          return [
            permit.title,
            eskul?.name ?? '-',
            PERMIT_TYPE_LABELS[permit.type],
            permit.startDate,
            permit.endDate,
            permit.location,
            PERMIT_STATUS_META[permit.status].label,
            permit.decisionNote ?? '-',
          ]
        }),
      )
    }
    toast.success('Laporan berhasil diekspor ke CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laporan Kesiswaan"
        title="Laporan & Nilai"
        description="Tinjau rekap kehadiran, nilai, dan surat izin lintas eskul. Cetak atau ekspor untuk rapat kesiswaan."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              Cetak
            </Button>
            <Button onClick={handleExport}>
              <Download />
              Ekspor CSV
            </Button>
          </>
        }
      />

      <div className="hidden rounded-2xl border border-border p-4 text-xs print:block">
        <p className="text-base font-bold">{SCHOOL_NAME}</p>
        <p className="mt-1 text-muted-foreground">
          Laporan {tab} · Dicetak {formatDateShort(todayISO())}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Kehadiran global"
          value={`${overall.rate}%`}
          icon={TrendingUp}
          hint={`${overall.hadir} hadir dari ${overall.total} catatan`}
          accent="primary"
        />
        <StatCard
          label="Anggota aktif"
          value={activeStudents.length}
          icon={Users}
          hint={`Dari ${store.eskul.length} eskul`}
          accent="sky"
        />
        <StatCard
          label="Rata-rata nilai"
          value={allGraded.length ? averageGrade : '—'}
          icon={Award}
          hint={`${allGraded.length} anggota dinilai · ${semester}`}
          accent="violet"
        />
        <StatCard
          label="Izin menunggu"
          value={pendingCount}
          icon={ClipboardCheck}
          hint="Perlu keputusan admin"
          accent="amber"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm print:hidden xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as ReportTab)
            setSearch('')
          }}
          items={[
            { value: 'kehadiran', label: 'Kehadiran', count: activeStudents.length },
            { value: 'nilai', label: 'Nilai', count: allGraded.length },
            { value: 'surat', label: 'Surat Izin', count: store.permits.length },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={eskulFilter}
            onChange={(event) => setEskulFilter(event.target.value)}
            className="h-9 w-full text-xs sm:w-40"
            aria-label="Filter eskul"
          >
            <option value="semua">Semua eskul</option>
            {store.eskul.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          {tab === 'nilai' ? (
            <Select
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              className="h-9 w-full text-xs sm:w-44"
              aria-label="Filter semester"
            >
              {SEMESTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          ) : null}
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tab === 'surat' ? 'Cari kegiatan...' : 'Cari anggota...'}
              className="h-9 pl-9 text-xs"
              aria-label="Cari pada laporan"
            />
          </div>
        </div>
      </div>

      {tab === 'kehadiran' ? (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ringkasan per eskul</CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Diurutkan berdasarkan persentase kehadiran.
              </p>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Eskul</TableHead>
                  <TableHead className="text-center">Anggota</TableHead>
                  <TableHead className="text-center">Sesi</TableHead>
                  <TableHead className="text-center">H</TableHead>
                  <TableHead className="text-center">I</TableHead>
                  <TableHead className="text-center">S</TableHead>
                  <TableHead className="text-center">A</TableHead>
                  <TableHead>Kehadiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.eskul
                  .filter((eskul) => eskulFilter === 'semua' || eskul.id === eskulFilter)
                  .map((eskul) => ({
                    eskul,
                    stats: getEskulAttendance(store.sessions, eskul.id),
                    memberCount: activeStudents.filter(
                      (student) => student.eskulId === eskul.id,
                    ).length,
                    sessionCount: store.sessions.filter(
                      (session) => session.eskulId === eskul.id,
                    ).length,
                  }))
                  .sort((a, b) => b.stats.rate - a.stats.rate)
                  .map(({ eskul, stats, memberCount, sessionCount }) => (
                    <TableRow key={eskul.id}>
                      <TableCell>
                        <Link
                          to={`/eskul/${eskul.id}`}
                          className="text-xs font-bold text-foreground hover:text-primary"
                        >
                          {eskul.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-xs">{memberCount}</TableCell>
                      <TableCell className="text-center text-xs">{sessionCount}</TableCell>
                      <TableCell className="text-center text-xs font-semibold text-emerald-600">
                        {stats.hadir}
                      </TableCell>
                      <TableCell className="text-center text-xs text-sky-600">{stats.izin}</TableCell>
                      <TableCell className="text-center text-xs text-amber-600">
                        {stats.sakit}
                      </TableCell>
                      <TableCell className="text-center text-xs text-rose-600">{stats.alpa}</TableCell>
                      <TableCell>
                        <div className="flex w-40 items-center gap-2">
                          <Progress
                            value={stats.rate}
                            className="h-1.5 flex-1"
                            indicatorClassName={
                              stats.rate >= 90
                                ? 'bg-emerald-500'
                                : stats.rate >= 75
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                            }
                          />
                          <span className="text-[10px] font-bold text-foreground">
                            {stats.rate}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Rekap anggota</CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    {filteredStudents.length} anggota · data dari seluruh sesi terisi
                  </p>
                </div>
                <Badge variant="secondary">{percentage(overall.hadir, overall.total)}% global</Badge>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anggota</TableHead>
                  <TableHead>Eskul</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead className="text-center">Hadir</TableHead>
                  <TableHead className="text-center">Izin</TableHead>
                  <TableHead className="text-center">Sakit</TableHead>
                  <TableHead className="text-center">Alpa</TableHead>
                  <TableHead>Kehadiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-xs text-muted-foreground">
                      Tidak ada anggota yang cocok dengan filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => {
                    const stats = getStudentAttendance(store.sessions, student.id)
                    const eskul = store.eskul.find((item) => item.id === student.eskulId)
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <p className="text-xs font-bold text-foreground">{student.name}</p>
                          <p className="text-[10px] text-muted-foreground">NIS {student.nis}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{eskul?.name ?? '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{student.className}</TableCell>
                        <TableCell className="text-center text-xs font-semibold text-emerald-600">
                          {stats.hadir}
                        </TableCell>
                        <TableCell className="text-center text-xs">{stats.izin}</TableCell>
                        <TableCell className="text-center text-xs">{stats.sakit}</TableCell>
                        <TableCell className="text-center text-xs">{stats.alpa}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'text-xs font-extrabold',
                              stats.rate >= 90
                                ? 'text-emerald-600'
                                : stats.rate >= 75
                                  ? 'text-amber-600'
                                  : 'text-rose-600',
                            )}
                          >
                            {stats.total ? `${stats.rate}%` : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : null}

      {tab === 'nilai' ? (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm">Rekap nilai eskul</CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Semester {semester} · bobot 40% keaktifan, 30% sikap, 30% keterampilan
                </p>
              </div>
              <Badge variant="secondary">Rata-rata {allGraded.length ? averageGrade : '—'}</Badge>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anggota</TableHead>
                <TableHead>Eskul</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead className="text-center">Keaktifan</TableHead>
                <TableHead className="text-center">Sikap</TableHead>
                <TableHead className="text-center">Keterampilan</TableHead>
                <TableHead className="text-center">Akhir</TableHead>
                <TableHead>Predikat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-xs text-muted-foreground">
                    Tidak ada anggota yang cocok dengan filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => {
                  const grade = store.grades.find(
                    (item) => item.studentId === student.id && item.semester === semester,
                  )
                  const final = getFinalScore(grade)
                  const predicate = getPredicate(final)
                  const eskul = store.eskul.find((item) => item.id === student.eskulId)
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <p className="text-xs font-bold text-foreground">{student.name}</p>
                        <p className="text-[10px] text-muted-foreground">NIS {student.nis}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{eskul?.name ?? '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{student.className}</TableCell>
                      <TableCell className="text-center text-xs">{grade?.keaktifan ?? '—'}</TableCell>
                      <TableCell className="text-center text-xs">{grade?.sikap ?? '—'}</TableCell>
                      <TableCell className="text-center text-xs">
                        {grade?.keterampilan ?? '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-extrabold text-foreground">
                          {final ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={predicate.badge}>{predicate.letter}</Badge>
                        <span className="ml-1.5 hidden text-[10px] text-muted-foreground xl:inline">
                          {predicate.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {tab === 'surat' ? (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm">Rekap surat izin</CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  {scopedPermits.length} pengajuan sesuai filter
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PERMIT_STATUSES.map((status) => (
                  <Badge key={status} variant="secondary" className="gap-1">
                    {PERMIT_STATUS_META[status].label} {permitCounts[status]}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kegiatan</TableHead>
                <TableHead>Eskul</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catatan keputusan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopedPermits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-xs text-muted-foreground">
                    Tidak ada pengajuan yang cocok dengan filter.
                  </TableCell>
                </TableRow>
              ) : (
                scopedPermits.map((permit) => {
                  const eskul = store.eskul.find((item) => item.id === permit.eskulId)
                  return (
                    <TableRow key={permit.id}>
                      <TableCell>
                        <p className="max-w-56 truncate text-xs font-bold text-foreground">
                          {permit.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{permit.location}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{eskul?.name ?? '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {PERMIT_TYPE_LABELS[permit.type]}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateRange(permit.startDate, permit.endDate)}
                      </TableCell>
                      <TableCell>
                        <PermitStatusBadge status={permit.status} />
                      </TableCell>
                      <TableCell>
                        <p className="max-w-64 truncate text-[10px] text-muted-foreground">
                          {permit.decisionNote ?? '—'}
                        </p>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          <div className="border-t border-border/60 px-4 py-3 print:hidden">
            <Link to="/surat" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Buka halaman surat izin
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
