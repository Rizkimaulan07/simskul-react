import {
  Award,
  Download,
  Info,
  Save,
  StickyNote,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { CURRENT_SEMESTER, SEMESTER_OPTIONS } from '@/lib/constants'
import { useAppStore, useCurrentUser } from '@/lib/store'
import {
  getActiveStudents,
  getFinalScore,
  getPredicate,
  getStudentAttendance,
} from '@/lib/selectors'
import type { Grade } from '@/lib/types'
import { clampScore, cn, downloadCSV } from '@/lib/utils'

function ScoreInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number | null) => void
}) {
  return (
    <Input
      type="number"
      min={0}
      max={100}
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value
        onChange(raw === '' ? null : clampScore(Number(raw)))
      }}
      className="h-9 w-[68px] px-2 text-center text-xs font-bold tabular-nums"
      placeholder="—"
      aria-label="Nilai komponen"
    />
  )
}

export function GradesPage() {
  const user = useCurrentUser()
  const store = useAppStore()
  const [semester, setSemester] = useState(CURRENT_SEMESTER)
  const [noteTarget, setNoteTarget] = useState<{
    studentId: string
    name: string
    note: string
  } | null>(null)

  if (!user) return null

  const eskul = store.eskul.find((item) => item.id === user.eskulId)
  const members = getActiveStudents(store.students, user.eskulId ?? '')
  const gradeFor = (studentId: string): Grade | undefined =>
    store.grades.find(
      (grade) => grade.studentId === studentId && grade.semester === semester,
    )
  const rows = members.map((student) => {
    const grade = gradeFor(student.id)
    const final = getFinalScore(grade)
    return {
      student,
      grade,
      final,
      predicate: getPredicate(final),
      attendance: getStudentAttendance(store.sessions, student.id),
    }
  })
  const gradedRows = rows.filter((row) => row.final !== null)
  const average = gradedRows.length
    ? Math.round(gradedRows.reduce((sum, row) => sum + (row.final ?? 0), 0) / gradedRows.length)
    : 0
  const highest = gradedRows.length
    ? Math.max(...gradedRows.map((row) => row.final ?? 0))
    : 0
  const aCount = rows.filter((row) => row.predicate.letter === 'A').length
  const ungraded = rows.length - gradedRows.length
  const completion = rows.length ? Math.round((gradedRows.length / rows.length) * 100) : 0

  const updateScore = (
    studentId: string,
    component: 'keaktifan' | 'sikap' | 'keterampilan',
    value: number | null,
  ) => {
    store.saveGrade(studentId, semester, { [component]: value }, user.id)
  }

  const handleExport = () => {
    downloadCSV(
      `nilai-${eskul?.name.toLowerCase().replaceAll(' ', '-') ?? 'eskul'}-${semester.replaceAll(' ', '-')}.csv`,
      [
        'Nama',
        'NIS',
        'Kelas',
        'Keaktifan (40%)',
        'Sikap (30%)',
        'Keterampilan (30%)',
        'Nilai Akhir',
        'Predikat',
        'Catatan',
      ],
      rows.map(({ student, grade, final, predicate }) => [
        student.name,
        student.nis,
        student.className,
        grade?.keaktifan ?? '-',
        grade?.sikap ?? '-',
        grade?.keterampilan ?? '-',
        final ?? '-',
        predicate.letter,
        grade?.note ?? '-',
      ]),
    )
    toast.success('Rekap nilai diekspor ke CSV')
  }

  const handleSaveNote = () => {
    if (!noteTarget || !user) return
    store.saveGrade(
      noteTarget.studentId,
      semester,
      { note: noteTarget.note.trim() || undefined },
      user.id,
    )
    toast.success('Catatan evaluasi disimpan', { description: noteTarget.name })
    setNoteTarget(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eskul ? `Penilaian ${eskul.name}` : 'Penilaian Eskul'}
        title="Nilai Eskul"
        description="Isi nilai per komponen. Nilai akhir dan predikat dihitung otomatis dengan bobot keaktifan 40%, sikap 30%, dan keterampilan 30%."
        actions={
          <>
            <Select
              value={semester}
              onChange={(event) => {
                setSemester(event.target.value)
                setNoteTarget(null)
              }}
              className="w-full text-xs sm:w-44"
              aria-label="Pilih semester"
            >
              {SEMESTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={handleExport}>
              <Download />
              Ekspor CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Rata-rata nilai"
          value={gradedRows.length ? average : '—'}
          icon={TrendingUp}
          hint={`${gradedRows.length} anggota sudah dinilai`}
          accent="primary"
        />
        <StatCard
          label="Nilai tertinggi"
          value={gradedRows.length ? highest : '—'}
          icon={Award}
          hint={gradedRows.length ? 'Dari seluruh anggota aktif' : 'Belum ada nilai'}
          accent="violet"
        />
        <StatCard
          label="Predikat A"
          value={aCount}
          icon={Award}
          hint="Nilai akhir ≥ 90"
          accent="sky"
        />
        <StatCard
          label="Belum dinilai"
          value={ungraded}
          icon={Users}
          hint={`${completion}% kelengkapan`}
          accent="amber"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/15">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Komponen penilaian</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Semester {semester} · perubahan tersimpan otomatis
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Save className="size-3 text-emerald-600" />
                Tersimpan otomatis
              </Badge>
              <Badge variant="outline">{completion}% terisi</Badge>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-[10px] leading-relaxed text-sky-900/70 dark:border-sky-500/20 dark:bg-sky-500/[0.06] dark:text-sky-100/70">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Gunakan persentase kehadiran sebagai pertimbangan nilai keaktifan. Nilai akhir
              baru muncul setelah ketiga komponen terisi.
            </span>
          </div>
        </CardHeader>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="Belum ada anggota aktif"
              description="Tambahkan anggota terlebih dahulu sebelum mengisi nilai eskul."
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anggota</TableHead>
                  <TableHead className="text-center">Keaktifan</TableHead>
                  <TableHead className="text-center">Sikap</TableHead>
                  <TableHead className="text-center">Keterampilan</TableHead>
                  <TableHead className="text-center">Akhir</TableHead>
                  <TableHead>Predikat</TableHead>
                  <TableHead className="hidden lg:table-cell">Kehadiran</TableHead>
                  <TableHead className="text-right">Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ student, grade, final, predicate, attendance }) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">
                          {student.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {student.className} · NIS {student.nis}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreInput
                        value={grade?.keaktifan ?? null}
                        onChange={(value) => updateScore(student.id, 'keaktifan', value)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreInput
                        value={grade?.sikap ?? null}
                        onChange={(value) => updateScore(student.id, 'sikap', value)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreInput
                        value={grade?.keterampilan ?? null}
                        onChange={(value) => updateScore(student.id, 'keterampilan', value)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          'inline-flex min-w-10 items-center justify-center rounded-lg px-2 py-1 text-sm font-extrabold',
                          final === null
                            ? 'bg-muted text-muted-foreground'
                            : final >= 90
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : final >= 80
                                ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
                                : final >= 70
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
                        )}
                      >
                        {final ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={predicate.badge}>{predicate.letter}</Badge>
                      <span className="ml-1.5 hidden text-[10px] text-muted-foreground xl:inline">
                        {predicate.label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-foreground">
                          {attendance.total ? `${attendance.rate}%` : '—'}
                        </span>
                        {attendance.total ? (
                          <span className="text-[9px] text-muted-foreground">
                            {attendance.hadir}/{attendance.total}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() =>
                          setNoteTarget({
                            studentId: student.id,
                            name: student.name,
                            note: grade?.note ?? '',
                          })
                        }
                        title={grade?.note ? 'Ubah catatan evaluasi' : 'Tambah catatan evaluasi'}
                        className={cn(
                          grade?.note
                            ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-500/10'
                            : 'text-muted-foreground',
                        )}
                      >
                        <StickyNote />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-col gap-1 border-t border-border/60 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {gradedRows.length} dari {rows.length} anggota memiliki nilai lengkap
              </span>
              <span>Bobot: Keaktifan 40% · Sikap 30% · Keterampilan 30%</span>
            </div>
          </>
        )}
      </Card>

      <Dialog
        open={Boolean(noteTarget)}
        onOpenChange={(open) => {
          if (!open) setNoteTarget(null)
        }}
        title="Catatan Evaluasi"
        description={
          noteTarget
            ? `Catatan untuk ${noteTarget.name} pada semester ${semester}.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteTarget(null)}>
              Batal
            </Button>
            <Button onClick={handleSaveNote}>
              <Save />
              Simpan Catatan
            </Button>
          </>
        }
      >
        <Field
          label="Catatan untuk anggota"
          htmlFor="grade-note"
          hint="Catatan ini dapat menjadi bahan pembinaan dan laporan admin."
        >
          <Textarea
            id="grade-note"
            value={noteTarget?.note ?? ''}
            onChange={(event) =>
              setNoteTarget((current) =>
                current ? { ...current, note: event.target.value } : current,
              )
            }
            placeholder="Contoh: Konsisten aktif dan menunjukkan peningkatan yang baik."
          />
        </Field>
      </Dialog>
    </div>
  )
}
