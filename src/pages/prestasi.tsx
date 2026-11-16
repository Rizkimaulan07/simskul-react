import {
  Award,
  CalendarDays,
  Download,
  Medal,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { EskulChip } from '@/components/shared/badges'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import {
  ACHIEVEMENT_LEVELS,
  ACHIEVEMENT_LEVEL_META,
  ACHIEVEMENT_RANKS,
  ACHIEVEMENT_RANK_META,
} from '@/lib/constants'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { Achievement, AchievementLevel, AchievementRank } from '@/lib/types'
import { cn, downloadCSV, formatDateShort, todayISO } from '@/lib/utils'

type RankGroup = 'semua' | 'juara' | 'harapan' | 'peserta'
type LevelFilter = 'semua' | AchievementLevel

function rankGroupOf(rank: AchievementRank): Exclude<RankGroup, 'semua'> {
  if (rank.startsWith('juara')) return 'juara'
  if (rank.startsWith('harapan')) return 'harapan'
  return 'peserta'
}

function emptyForm() {
  return {
    eskulId: '',
    title: '',
    event: '',
    level: 'kota' as AchievementLevel,
    rank: 'juara_1' as AchievementRank,
    date: todayISO(),
    participants: '',
    description: '',
  }
}

export function AchievementsPage() {
  const user = useCurrentUser()
  const store = useAppStore()
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('semua')
  const [eskulFilter, setEskulFilter] = useState('semua')
  const [rankGroup, setRankGroup] = useState<RankGroup>('semua')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<Achievement | null>(null)

  if (!user) return null

  const ownEskul = store.eskul.find((item) => item.id === user.eskulId)
  const scoped = store.achievements
    .filter((achievement) => user.role === 'admin' || achievement.eskulId === user.eskulId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const eskulScoped =
    user.role === 'admin' && eskulFilter !== 'semua'
      ? scoped.filter((achievement) => achievement.eskulId === eskulFilter)
      : scoped

  const filtered = eskulScoped.filter((achievement) => {
    if (levelFilter !== 'semua' && achievement.level !== levelFilter) return false
    if (rankGroup !== 'semua' && rankGroupOf(achievement.rank) !== rankGroup) return false
    if (!search.trim()) return true
    const query = search.toLowerCase()
    const eskulName =
      store.eskul.find((item) => item.id === achievement.eskulId)?.name.toLowerCase() ?? ''
    return (
      achievement.title.toLowerCase().includes(query) ||
      achievement.event.toLowerCase().includes(query) ||
      achievement.participants.toLowerCase().includes(query) ||
      eskulName.includes(query)
    )
  })

  const juaraCount = eskulScoped.filter((achievement) =>
    achievement.rank.startsWith('juara'),
  ).length
  const nationalCount = eskulScoped.filter(
    (achievement) => achievement.level === 'nasional' || achievement.level === 'internasional',
  ).length
  const eskulCount = new Set(eskulScoped.map((achievement) => achievement.eskulId)).size
  const groupCounts = {
    semua: eskulScoped.length,
    juara: eskulScoped.filter((achievement) => rankGroupOf(achievement.rank) === 'juara').length,
    harapan: eskulScoped.filter((achievement) => rankGroupOf(achievement.rank) === 'harapan')
      .length,
    peserta: eskulScoped.filter((achievement) => rankGroupOf(achievement.rank) === 'peserta')
      .length,
  }

  const canDelete = (achievement: Achievement) =>
    user.role === 'admin' || achievement.eskulId === user.eskulId

  const openAdd = () => {
    setForm({ ...emptyForm(), eskulId: user.eskulId ?? '' })
    setAddOpen(true)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const eskulId = user.role === 'admin' ? form.eskulId : (user.eskulId ?? '')
    if (!eskulId) {
      toast.error('Pilih eskul yang meraih prestasi.')
      return
    }
    if (
      !form.title.trim() ||
      !form.event.trim() ||
      !form.participants.trim() ||
      !form.date
    ) {
      toast.error('Lengkapi judul, kegiatan, tanggal, dan nama peserta.')
      return
    }
    store.addAchievement(
      {
        eskulId,
        title: form.title.trim(),
        event: form.event.trim(),
        level: form.level,
        rank: form.rank,
        date: form.date,
        participants: form.participants.trim(),
        description: form.description.trim() || undefined,
      },
      user.id,
    )
    const eskulName = store.eskul.find((item) => item.id === eskulId)?.name ?? 'Eskul'
    toast.success('Prestasi berhasil dicatat', {
      description: `${eskulName} · ${form.title.trim()}`,
    })
    setAddOpen(false)
    setForm(emptyForm())
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const title = deleteTarget.title
    store.deleteAchievement(deleteTarget.id, user.id)
    setDeleteTarget(null)
    toast.success('Prestasi dihapus', { description: title })
  }

  const handleExport = () => {
    downloadCSV(
      `prestasi-eskul-${todayISO()}.csv`,
      ['Judul', 'Eskul', 'Kegiatan', 'Tingkat', 'Peringkat', 'Tanggal', 'Peserta', 'Deskripsi'],
      filtered.map((achievement) => [
        achievement.title,
        store.eskul.find((item) => item.id === achievement.eskulId)?.name ?? '-',
        achievement.event,
        ACHIEVEMENT_LEVEL_META[achievement.level].label,
        ACHIEVEMENT_RANK_META[achievement.rank].label,
        achievement.date,
        achievement.participants,
        achievement.description ?? '-',
      ]),
    )
    toast.success('Data prestasi diekspor ke CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kebanggaan Eskul"
        title="Prestasi Eskul"
        description={
          user.role === 'admin'
            ? 'Dokumentasikan capaian anggota dari tingkat sekolah hingga internasional, lalu ekspor untuk rapat kesiswaan.'
            : `Catat dan rayakan prestasi anggota ${ownEskul?.name ?? 'eskul Anda'} di berbagai tingkat kompetisi.`
        }
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download />
              Ekspor CSV
            </Button>
            <Button onClick={openAdd}>
              <Plus />
              Catat Prestasi
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total prestasi"
          value={eskulScoped.length}
          icon={Trophy}
          hint={user.role === 'admin' ? `Dari ${eskulCount} eskul` : ownEskul?.name}
          accent="primary"
        />
        <StatCard
          label="Juara 1–3"
          value={juaraCount}
          icon={Medal}
          hint="Podium kompetisi"
          accent="amber"
        />
        <StatCard
          label="Tingkat nasional+"
          value={nationalCount}
          icon={TrendingUp}
          hint="Nasional & internasional"
          accent="violet"
        />
        <StatCard
          label="Eskul berprestasi"
          value={eskulCount}
          icon={Award}
          hint={`Dari ${store.eskul.length} eskul terdaftar`}
          accent="sky"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Tabs
              value={rankGroup}
              onValueChange={(value) => setRankGroup(value as RankGroup)}
              items={[
                { value: 'semua', label: 'Semua', count: groupCounts.semua },
                { value: 'juara', label: 'Juara', count: groupCounts.juara },
                { value: 'harapan', label: 'Harapan', count: groupCounts.harapan },
                { value: 'peserta', label: 'Peserta', count: groupCounts.peserta },
              ]}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}
                className="h-9 w-full text-xs sm:w-40"
                aria-label="Filter tingkat"
              >
                <option value="semua">Semua tingkat</option>
                {ACHIEVEMENT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {ACHIEVEMENT_LEVEL_META[level].label}
                  </option>
                ))}
              </Select>
              {user.role === 'admin' ? (
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
              ) : null}
            </div>
          </div>
          <div className="relative w-full xl:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari prestasi, peserta, eskul..."
              className="h-9 pl-9 text-xs"
              aria-label="Cari prestasi"
            />
          </div>
        </div>

        <div className="p-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Belum ada prestasi yang cocok"
              description="Ubah filter pencarian atau catat prestasi baru untuk eskul ini."
              action={
                <Button size="sm" onClick={openAdd}>
                  <Plus />
                  Catat Prestasi
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((achievement) => {
                const achievementEskul = store.eskul.find(
                  (item) => item.id === achievement.eskulId,
                )
                const level = ACHIEVEMENT_LEVEL_META[achievement.level]
                const rank = ACHIEVEMENT_RANK_META[achievement.rank]
                return (
                  <Card
                    key={achievement.id}
                    className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <div
                      className={cn(
                        'relative overflow-hidden bg-gradient-to-br p-4 text-white',
                        level.gradient,
                      )}
                    >
                      <div className="grid-pattern absolute inset-0 opacity-30" />
                      <div className="absolute -right-6 -top-8 size-24 rounded-full bg-white/15 blur-2xl" />
                      <div className="relative flex items-start justify-between gap-2">
                        <Badge variant="dark" className="text-[10px]">
                          {level.label}
                        </Badge>
                        {canDelete(achievement) ? (
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => setDeleteTarget(achievement)}
                            className="size-7 text-white/70 hover:bg-white/15 hover:text-white"
                            aria-label={`Hapus prestasi ${achievement.title}`}
                            title="Hapus prestasi"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="relative mt-4 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                            {rank.label}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug">
                            {achievement.title}
                          </p>
                        </div>
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg font-black backdrop-blur">
                          {rank.short}
                        </span>
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col p-4">
                      <p className="line-clamp-1 text-[11px] font-semibold text-muted-foreground">
                        {achievement.event}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {achievementEskul ? <EskulChip eskul={achievementEskul} /> : null}
                        <Badge variant="outline" className="gap-1">
                          <CalendarDays className="size-3" />
                          {formatDateShort(achievement.date)}
                        </Badge>
                      </div>
                      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Users className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span className="line-clamp-2">{achievement.participants}</span>
                      </p>
                      {achievement.description ? (
                        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">
                          {achievement.description}
                        </p>
                      ) : null}
                      <div className="mt-auto flex items-center gap-1.5 border-t border-border/60 pt-3 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                        <Sparkles className="size-3" />
                        Tercatat {formatDateShort(achievement.createdAt.slice(0, 10))}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-[10px] text-muted-foreground">
          <span>
            Menampilkan {filtered.length} dari {eskulScoped.length} prestasi
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="size-3 text-amber-500" />
            Setiap capaian tercatat di database sekolah
          </span>
        </div>
      </Card>

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Catat Prestasi Baru"
        description="Simpan capaian eskul agar masuk ke rekap kesiswaan dan kalender kegiatan."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="achievement-form">
              <Trophy />
              Simpan Prestasi
            </Button>
          </>
        }
      >
        <form id="achievement-form" onSubmit={handleSubmit} className="space-y-4">
          {user.role === 'admin' ? (
            <Field label="Eskul" htmlFor="achievement-eskul" required>
              <Select
                id="achievement-eskul"
                value={form.eskulId}
                onChange={(event) => setForm({ ...form, eskulId: event.target.value })}
                autoFocus
              >
                <option value="">Pilih eskul</option>
                {store.eskul.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Eskul">
              <div className="flex h-10 items-center rounded-xl border border-border/70 bg-muted/30 px-3.5 text-sm font-semibold text-foreground">
                {ownEskul?.name ?? 'Eskul Anda'}
              </div>
            </Field>
          )}

          <Field label="Judul prestasi" htmlFor="achievement-title" required>
            <Input
              id="achievement-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Contoh: Juara 1 Lomba Cerdas Cermat"
              autoFocus={user.role !== 'admin'}
            />
          </Field>

          <Field label="Nama kegiatan / kompetisi" htmlFor="achievement-event" required>
            <Input
              id="achievement-event"
              value={form.event}
              onChange={(event) => setForm({ ...form, event: event.target.value })}
              placeholder="Contoh: Festival Literasi Sekolah 2026"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tingkat" htmlFor="achievement-level" required>
              <Select
                id="achievement-level"
                value={form.level}
                onChange={(event) =>
                  setForm({ ...form, level: event.target.value as AchievementLevel })
                }
              >
                {ACHIEVEMENT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {ACHIEVEMENT_LEVEL_META[level].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Peringkat" htmlFor="achievement-rank" required>
              <Select
                id="achievement-rank"
                value={form.rank}
                onChange={(event) =>
                  setForm({ ...form, rank: event.target.value as AchievementRank })
                }
              >
                {ACHIEVEMENT_RANKS.map((rank) => (
                  <option key={rank} value={rank}>
                    {ACHIEVEMENT_RANK_META[rank].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tanggal" htmlFor="achievement-date" required>
              <Input
                id="achievement-date"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Nama peserta"
            htmlFor="achievement-participants"
            required
            hint="Pisahkan dengan koma bila lebih dari satu anggota."
          >
            <Input
              id="achievement-participants"
              value={form.participants}
              onChange={(event) => setForm({ ...form, participants: event.target.value })}
              placeholder="Contoh: Rani Puspita, Bagas Pratama"
            />
          </Field>

          <Field
            label="Deskripsi"
            htmlFor="achievement-description"
            hint="Opsional. Catatan singkat tentang proses atau hasil kompetisi."
          >
            <Textarea
              id="achievement-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Tuliskan catatan singkat..."
              className="min-h-20"
            />
          </Field>

          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-[11px] leading-relaxed text-amber-900/80 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:text-amber-100/70">
            Prestasi akan tampil di halaman ini, kalender kegiatan, dan ringkasan dashboard
            eskul.
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Hapus prestasi?"
        description={
          deleteTarget
            ? `${deleteTarget.title} akan dihapus dari rekap prestasi dan tidak dapat dikembalikan.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 />
              Hapus Prestasi
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          Pastikan data ini memang tidak lagi diperlukan. Riwayat aktivitas tetap menyimpan
          catatan penghapusan.
        </p>
      </Dialog>
    </div>
  )
}
