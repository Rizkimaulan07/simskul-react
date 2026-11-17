import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileSignature,
  FileText,
  MapPin,
  Plus,
  Search,
  Send,
  Stamp,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { EskulChip, PermitStatusBadge } from '@/components/shared/badges'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import { PERMIT_STATUSES, PERMIT_STATUS_META, PERMIT_TYPE_LABELS } from '@/lib/constants'
import { canSubmitPermit, canViewPermitLetter } from '@/lib/permissions'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { PermitStatus, PermitType } from '@/lib/types'
import { addDaysISO, cn, formatDateRange, todayISO } from '@/lib/utils'

type StatusFilter = 'semua' | PermitStatus

const initialForm = {
  type: 'lomba' as PermitType,
  title: '',
  description: '',
  startDate: todayISO(),
  endDate: addDaysISO(1),
  location: '',
}

export function PermitLettersPage() {
  const user = useCurrentUser()
  const store = useAppStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(initialForm)

  const visiblePermits = useMemo(() => {
    if (!user) return []
    return store.permits
      .filter((permit) => canViewPermitLetter(user, permit))
      .sort((a, b) => {
        if (a.status === 'diajukan' && b.status !== 'diajukan') return -1
        if (a.status !== 'diajukan' && b.status === 'diajukan') return 1
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [store.permits, user])

  const statusTabs = useMemo(() => {
    const statuses: PermitStatus[] =
      user?.role === 'wakasek' ? ['disetujui', 'selesai'] : PERMIT_STATUSES
    return [
      { value: 'semua', label: 'Semua', count: visiblePermits.length },
      ...statuses.map((status) => ({
        value: status,
        label: PERMIT_STATUS_META[status].label,
        count: visiblePermits.filter((permit) => permit.status === status).length,
      })),
    ]
  }, [user?.role, visiblePermits])

  const filteredPermits = useMemo(() => {
    const query = search.trim().toLowerCase()
    return visiblePermits.filter((permit) => {
      if (statusFilter !== 'semua' && permit.status !== statusFilter) return false
      if (!query) return true
      const eskul = store.eskul.find((item) => item.id === permit.eskulId)
      return [
        permit.title,
        permit.location,
        permit.letter?.number,
        permit.letter?.subject,
        eskul?.name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    })
  }, [search, statusFilter, store.eskul, visiblePermits])

  if (!user) return null

  const eskul = store.eskul.find((item) => item.id === user.eskulId)
  const canCreate = canSubmitPermit(user) && Boolean(user.eskulId)
  const pendingCount = visiblePermits.filter((permit) => permit.status === 'diajukan').length
  const readyCount = visiblePermits.filter((permit) => permit.status === 'disetujui').length
  const doneCount = visiblePermits.filter((permit) => permit.status === 'selesai').length
  const isWakasek = user.role === 'wakasek'

  const openAdd = () => {
    setForm({ ...initialForm, startDate: todayISO(), endDate: addDaysISO(1) })
    setAddOpen(true)
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
    const permitId = store.createPermit({
      eskulId: user.eskulId,
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      location: form.location.trim(),
      createdBy: user.id,
    })
    toast.success('Pengajuan surat terkirim', {
      description: 'Lengkapi isi surat sebelum admin memutuskan pengajuan.',
    })
    setAddOpen(false)
    navigate(`/surat/${permitId}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrasi Kesiswaan"
        title="Surat Izin Kegiatan"
        description={
          isWakasek
            ? 'Surat yang telah disetujui administrator. Cetak surat, lalu mintakan tanda tangan basah wakasek.'
            : 'Buat pengajuan, lengkapi surat, dan pantau persetujuannya dalam satu halaman.'
        }
        actions={
          canCreate ? (
            <Button onClick={openAdd}>
              <Plus />
              Ajukan Surat
            </Button>
          ) : undefined
        }
      />

      <div
        className={cn(
          'grid gap-3',
          isWakasek ? 'sm:grid-cols-3' : 'grid-cols-2 xl:grid-cols-4',
        )}
      >
        <StatCard
          label="Total surat"
          value={visiblePermits.length}
          icon={FileText}
          hint={isWakasek ? 'Surat yang dapat Anda tinjau' : 'Sesuai akses akun Anda'}
          accent="primary"
        />
        {!isWakasek ? (
          <StatCard
            label="Menunggu"
            value={pendingCount}
            icon={Clock3}
            hint="Belum diputuskan admin"
            accent="amber"
          />
        ) : null}
        <StatCard
          label="Siap ditandatangani"
          value={readyCount}
          icon={FileSignature}
          hint="Sudah disetujui administrator"
          accent="violet"
        />
        <StatCard
          label="Selesai"
          value={doneCount}
          icon={CheckCircle2}
          hint="Kegiatan sudah dilaksanakan"
          accent="sky"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          items={statusTabs}
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        />
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kegiatan, eskul, atau nomor surat"
            className="h-9 pl-9 text-xs"
            aria-label="Cari surat izin"
          />
        </div>
      </div>

      {filteredPermits.length === 0 ? (
        <EmptyState
          icon={Stamp}
          title={isWakasek ? 'Belum ada surat yang disetujui' : 'Belum ada surat izin'}
          description={
            isWakasek
              ? 'Surat akan muncul di sini setelah administrator menyetujui pengajuan.'
              : 'Ajukan surat terlebih dahulu. Template surat akan otomatis dibuat dari data kegiatan.'
          }
          action={
            canCreate ? (
              <Button size="sm" onClick={openAdd}>
                <Plus />
                Ajukan Surat
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredPermits.map((permit) => {
            const permitEskul = store.eskul.find((item) => item.id === permit.eskulId)
            return (
              <Link
                key={permit.id}
                to={`/surat/${permit.id}`}
                className="group block focus-visible:outline-none"
              >
                <Card className="flex flex-col gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-foreground">
                        {permit.letter?.subject ?? permit.title}
                      </p>
                      <PermitStatusBadge status={permit.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {permit.letter?.number ?? 'Nomor surat belum diisi'}
                      {` · ${PERMIT_TYPE_LABELS[permit.type]}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                      {permitEskul ? <EskulChip eskul={permitEskul} /> : null}
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {formatDateRange(permit.startDate, permit.endDate)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {permit.location}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-muted/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary sm:self-center">
                    Lihat surat
                    <ArrowRight className="size-3.5" />
                  </span>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Ajukan Surat Izin"
        description={`Buat pengajuan kegiatan untuk ${eskul?.name ?? 'eskul'} Anda.`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="add-letter-form">
              <Send />
              Kirim Pengajuan
            </Button>
          </>
        }
      >
        <form id="add-letter-form" onSubmit={handleCreate} className="space-y-4">
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
            Setelah dikirim, Anda langsung diarahkan ke editor surat. Template surat dibuat
            otomatis dan dapat disesuaikan sebelum admin memutuskan pengajuan.
          </div>
        </form>
      </Dialog>
    </div>
  )
}
