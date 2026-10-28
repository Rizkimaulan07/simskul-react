import {
  Building2,
  Bus,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  FileText,
  MapPin,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trophy,
  XCircle,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import { EskulChip, PermitStatusBadge } from '@/components/shared/badges'
import { Field } from '@/components/shared/field'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import {
  PERMIT_STATUSES,
  PERMIT_STATUS_META,
  PERMIT_TYPE_LABELS,
} from '@/lib/constants'
import { canReviewPermits, canSubmitPermit } from '@/lib/permissions'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { PermitStatus, PermitType } from '@/lib/types'
import {
  addDaysISO,
  cn,
  formatDateRange,
  formatDateTime,
  formatRelative,
  todayISO,
} from '@/lib/utils'

type StatusFilter = 'semua' | PermitStatus

const typeIcons = {
  lomba: Trophy,
  latihan: Dumbbell,
  kegiatan_luar: Bus,
  fasilitas: Building2,
  lainnya: FileText,
} satisfies Record<PermitType, typeof Trophy>

const typeColors = {
  lomba: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  latihan: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  kegiatan_luar: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  fasilitas: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  lainnya: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300',
} satisfies Record<PermitType, string>

const initialForm = {
  type: 'lomba' as PermitType,
  title: '',
  description: '',
  startDate: todayISO(),
  endDate: addDaysISO(1),
  location: '',
}

export function PermitsPage() {
  const user = useCurrentUser()
  const store = useAppStore()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua')
  const [eskulFilter, setEskulFilter] = useState('semua')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [decisionNote, setDecisionNote] = useState('')

  if (!user) return null

  const eskul = store.eskul.find((item) => item.id === user.eskulId)
  const canCreate = canSubmitPermit(user) && Boolean(user.eskulId)
  const canReview = canReviewPermits(user)
  const scopedPermits = store.permits
    .filter((permit) => (user.role === 'admin' ? true : permit.eskulId === user.eskulId))
    .sort((a, b) => {
      if (a.status === 'diajukan' && b.status !== 'diajukan') return -1
      if (a.status !== 'diajukan' && b.status === 'diajukan') return 1
      return b.createdAt.localeCompare(a.createdAt)
    })
  const filteredPermits = scopedPermits
    .filter((permit) =>
      user.role === 'admin' && eskulFilter !== 'semua'
        ? permit.eskulId === eskulFilter
        : true,
    )
    .filter((permit) => {
      if (statusFilter !== 'semua' && permit.status !== statusFilter) return false
      if (!search.trim()) return true
      const query = search.toLowerCase()
      return (
        permit.title.toLowerCase().includes(query) ||
        permit.location.toLowerCase().includes(query)
      )
    })
  const selectedPermit = selectedId
    ? store.permits.find((permit) => permit.id === selectedId) ?? null
    : null
  const selectedEskul = selectedPermit
    ? store.eskul.find((item) => item.id === selectedPermit.eskulId)
    : undefined
  const applicant = selectedPermit
    ? store.users.find((item) => item.id === selectedPermit.createdBy)
    : undefined
  const reviewer = selectedPermit?.decidedBy
    ? store.users.find((item) => item.id === selectedPermit.decidedBy)
    : undefined

  const statusCounts = PERMIT_STATUSES.reduce(
    (acc, status) => {
      acc[status] = scopedPermits.filter((permit) => permit.status === status).length
      return acc
    },
    {} as Record<PermitStatus, number>,
  )

  const openAdd = () => {
    setForm({ ...initialForm, startDate: todayISO(), endDate: addDaysISO(1) })
    setAddOpen(true)
  }

  const openDetail = (permitId: string) => {
    setSelectedId(permitId)
    setDecisionNote('')
  }

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    if (!user.eskulId) return
    if (!form.title.trim() || !form.location.trim() || !form.description.trim()) {
      toast.error('Lengkapi judul, deskripsi, dan lokasi kegiatan.')
      return
    }
    if (form.endDate < form.startDate) {
      toast.error('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }
    store.createPermit({
      eskulId: user.eskulId,
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      location: form.location.trim(),
      createdBy: user.id,
    })
    toast.success('Pengajuan izin terkirim', {
      description: 'Administrator akan meninjau pengajuan Anda.',
    })
    setAddOpen(false)
  }

  const handleReview = (decision: 'disetujui' | 'ditolak') => {
    if (!selectedPermit) return
    if (decision === 'ditolak' && !decisionNote.trim()) {
      toast.error('Tuliskan alasan penolakan terlebih dahulu.')
      return
    }
    store.reviewPermit(selectedPermit.id, decision, decisionNote.trim(), user.id)
    toast.success(decision === 'disetujui' ? 'Perizinan disetujui' : 'Perizinan ditolak', {
      description: selectedPermit.title,
    })
  }

  const handleComplete = () => {
    if (!selectedPermit) return
    store.completePermit(selectedPermit.id, user.id)
    toast.success('Kegiatan ditandai selesai', { description: selectedPermit.title })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Perizinan Kegiatan"
        title={canReview ? 'Persetujuan Izin' : 'Perizinan Eskul'}
        description={
          canReview
            ? 'Tinjau pengajuan kegiatan dari seluruh eskul, berikan keputusan, dan simpan catatannya.'
            : 'Ajukan izin kegiatan, pantau status persetujuan, dan lengkapi administrasi eskul.'
        }
        actions={
          canCreate ? (
            <Button onClick={openAdd}>
              <Plus />
              Ajukan Izin
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Menunggu"
          value={statusCounts.diajukan}
          icon={Clock3}
          hint={canReview ? 'Perlu keputusan Anda' : 'Menunggu admin'}
          accent="amber"
        />
        <StatCard
          label="Disetujui"
          value={statusCounts.disetujui}
          icon={CheckCircle2}
          hint="Siap dilaksanakan"
          accent="primary"
        />
        <StatCard
          label="Ditolak"
          value={statusCounts.ditolak}
          icon={XCircle}
          hint="Dengan catatan keputusan"
          accent="rose"
        />
        <StatCard
          label="Selesai"
          value={statusCounts.selesai}
          icon={ShieldCheck}
          hint="Kegiatan telah dilaksanakan"
          accent="violet"
        />
      </div>

      {canReview && statusCounts.diajukan > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-white p-4 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-transparent">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <ClipboardCheck className="size-4" />
          </span>
          <div>
            <p className="text-xs font-bold text-amber-950 dark:text-amber-50">
              {statusCounts.diajukan} pengajuan menunggu keputusan
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800/70 dark:text-amber-100/60">
              Periksa tanggal, lokasi, dan kesesuaian kegiatan sebelum menyetujui. Catatan
              keputusan akan terlihat oleh pengaju.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Tabs
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              items={[
                { value: 'semua', label: 'Semua', count: scopedPermits.length },
                ...PERMIT_STATUSES.map((status) => ({
                  value: status,
                  label: PERMIT_STATUS_META[status].label,
                  count: statusCounts[status],
                })),
              ]}
            />
            {canReview ? (
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
          <div className="relative w-full xl:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari kegiatan atau lokasi..."
              className="h-9 pl-9 text-xs"
              aria-label="Cari perizinan"
            />
          </div>
        </div>

        {filteredPermits.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ClipboardCheck}
              title="Belum ada pengajuan"
              description="Pengajuan izin kegiatan akan tampil di sini beserta status persetujuannya."
              action={
                canCreate ? (
                  <Button size="sm" onClick={openAdd}>
                    <Plus />
                    Ajukan Izin
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredPermits.map((permit) => {
              const permitEskul = store.eskul.find((item) => item.id === permit.eskulId)
              const permitApplicant = store.users.find((item) => item.id === permit.createdBy)
              const Icon = typeIcons[permit.type]
              const isPending = permit.status === 'diajukan'
              return (
                <button
                  key={permit.id}
                  type="button"
                  onClick={() => openDetail(permit.id)}
                  className={cn(
                    'group flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/25 sm:flex-row sm:items-center',
                    isPending && canReview && 'bg-amber-50/40 dark:bg-amber-500/[0.03]',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-xl',
                      typeColors[permit.type],
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">
                        {permit.title}
                      </p>
                      {permitEskul ? <EskulChip eskul={permitEskul} /> : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{PERMIT_TYPE_LABELS[permit.type]}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {permit.location}
                      </span>
                      <span>{formatDateRange(permit.startDate, permit.endDate)}</span>
                      <span className="hidden sm:inline">
                        oleh {permitApplicant?.name ?? '-'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <PermitStatusBadge status={permit.status} />
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelative(permit.createdAt)}
                    </span>
                    <span className="text-[10px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Lihat detail →
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        <div className="border-t border-border/60 px-4 py-3 text-[10px] text-muted-foreground">
          Menampilkan {filteredPermits.length} dari {scopedPermits.length} pengajuan
        </div>
      </Card>

      <Dialog
        open={Boolean(selectedPermit)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        title={selectedPermit?.title ?? 'Detail Perizinan'}
        description={
          selectedPermit && selectedEskul
            ? `${selectedEskul.name} · ${PERMIT_TYPE_LABELS[selectedPermit.type]}`
            : undefined
        }
        size="lg"
        footer={
          selectedPermit ? (
            <>
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Tutup
              </Button>
              {canReview && selectedPermit.status === 'diajukan' ? (
                <>
                  <Button variant="destructive" onClick={() => handleReview('ditolak')}>
                    <XCircle />
                    Tolak
                  </Button>
                  <Button onClick={() => handleReview('disetujui')}>
                    <CheckCircle2 />
                    Setujui
                  </Button>
                </>
              ) : null}
              {!canReview &&
              selectedPermit.status === 'disetujui' &&
              selectedPermit.endDate <= todayISO() ? (
                <Button onClick={handleComplete}>
                  <CheckCircle2 />
                  Tandai Selesai
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {selectedPermit ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <PermitStatusBadge status={selectedPermit.status} />
              {selectedEskul ? <EskulChip eskul={selectedEskul} /> : null}
              <Badge variant="outline">{PERMIT_TYPE_LABELS[selectedPermit.type]}</Badge>
            </div>

            <p className="text-sm leading-relaxed text-foreground/80">
              {selectedPermit.description}
            </p>

            <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/25 p-4 text-xs sm:grid-cols-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Tanggal kegiatan
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {formatDateRange(selectedPermit.startDate, selectedPermit.endDate)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Lokasi
                </p>
                <p className="mt-1 flex items-center gap-1 font-semibold text-foreground">
                  <MapPin className="size-3 text-primary" />
                  {selectedPermit.location}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Diajukan oleh
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar name={applicant?.name ?? 'Pengguna'} id={applicant?.id} size="xs" />
                  <span className="font-semibold text-foreground">
                    {applicant?.name ?? '-'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Waktu pengajuan
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {formatDateTime(selectedPermit.createdAt)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Alur pengajuan
              </p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold text-foreground">Diajukan</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDateTime(selectedPermit.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="ml-3 h-3 w-px bg-border" />
                <div className="flex gap-3">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full',
                      selectedPermit.status === 'diajukan'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                        : selectedPermit.status === 'ditolak'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
                    )}
                  >
                    {selectedPermit.status === 'diajukan' ? (
                      <Clock3 className="size-3.5" />
                    ) : selectedPermit.status === 'ditolak' ? (
                      <XCircle className="size-3.5" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                  </span>
                  <div>
                    <p className="text-[11px] font-bold text-foreground">
                      {selectedPermit.status === 'diajukan'
                        ? 'Menunggu keputusan administrator'
                        : selectedPermit.status === 'ditolak'
                          ? 'Ditolak'
                          : 'Disetujui'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedPermit.decidedAt
                        ? `${formatDateTime(selectedPermit.decidedAt)}${reviewer ? ` · ${reviewer.name}` : ''}`
                        : 'Belum ada keputusan'}
                    </p>
                  </div>
                </div>
                {selectedPermit.status === 'selesai' ? (
                  <>
                    <div className="ml-3 h-3 w-px bg-border" />
                    <div className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                        <ShieldCheck className="size-3.5" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold text-foreground">
                          Kegiatan selesai
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Ditandai selesai oleh pengelola eskul
                        </p>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {selectedPermit.decisionNote ? (
              <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Catatan keputusan
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
                  {selectedPermit.decisionNote}
                </p>
              </div>
            ) : null}

            {canReview && selectedPermit.status === 'diajukan' ? (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-4 dark:border-amber-500/20 dark:bg-amber-500/[0.05]">
                <Field
                  label="Catatan keputusan"
                  htmlFor="decision-note"
                  hint="Wajib diisi jika menolak. Catatan akan terlihat oleh pengaju."
                >
                  <Textarea
                    id="decision-note"
                    value={decisionNote}
                    onChange={(event) => setDecisionNote(event.target.value)}
                    placeholder="Contoh: Disetujui. Pastikan surat izin orang tua dilengkapi."
                    className="min-h-20 bg-card"
                  />
                </Field>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Ajukan Perizinan"
        description={`Buat pengajuan kegiatan untuk ${eskul?.name ?? 'eskul'} Anda.`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="add-permit-form">
              <Send />
              Kirim Pengajuan
            </Button>
          </>
        }
      >
        <form id="add-permit-form" onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenis kegiatan" htmlFor="permit-type" required>
              <Select
                id="permit-type"
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as PermitType })
                }
              >
                {(Object.keys(PERMIT_TYPE_LABELS) as PermitType[]).map((type) => (
                  <option key={type} value={type}>
                    {PERMIT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nama kegiatan" htmlFor="permit-title" required>
              <Input
                id="permit-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Contoh: Lomba Pramuka Tingkat Kota"
                autoFocus
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tanggal mulai" htmlFor="permit-start" required>
              <Input
                id="permit-start"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </Field>
            <Field label="Tanggal selesai" htmlFor="permit-end" required>
              <Input
                id="permit-end"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Lokasi kegiatan" htmlFor="permit-location" required>
            <Input
              id="permit-location"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              placeholder="Contoh: Aula SMK BPPI"
            />
          </Field>
          <Field label="Deskripsi kegiatan" htmlFor="permit-description" required>
            <Textarea
              id="permit-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Jelaskan tujuan, jumlah peserta, dan kebutuhan kegiatan..."
            />
          </Field>
          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-[10px] leading-relaxed text-sky-900/70 dark:border-sky-500/20 dark:bg-sky-500/[0.06] dark:text-sky-100/70">
            Pengajuan akan diteruskan ke administrator sekolah. Anda dapat memantau status dan
            catatan keputusan pada halaman ini.
          </div>
        </form>
      </Dialog>
    </div>
  )
}
