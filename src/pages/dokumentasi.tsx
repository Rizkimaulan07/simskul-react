import {
  CalendarDays,
  GraduationCap,
  ImagePlus,
  Images,
  Search,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { DocImage } from '@/components/shared/doc-image'
import { EskulChip } from '@/components/shared/badges'
import { Field } from '@/components/shared/field'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { canUploadDocumentation } from '@/lib/permissions'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { Documentation } from '@/lib/types'
import { cn, formatDate, formatDateShort, formatDateTime, todayISO } from '@/lib/utils'

const imagePresets = [
  {
    label: 'Latihan bersama',
    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Kegiatan lapangan',
    url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Pentas seni',
    url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Kegiatan sekolah',
    url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80',
  },
]

const emptyForm = {
  title: '',
  caption: '',
  date: todayISO(),
  imageUrl: '',
  sessionId: 'none',
}

export function DocumentationPage() {
  const user = useCurrentUser()
  const store = useAppStore()
  const [search, setSearch] = useState('')
  const [eskulFilter, setEskulFilter] = useState('semua')
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<Documentation | null>(null)
  const [form, setForm] = useState(emptyForm)

  if (!user) return null

  const eskul = store.eskul.find((item) => item.id === user.eskulId)
  const canUpload = canUploadDocumentation(user)
  const scopedDocs = store.documentation
    .filter((doc) => (user.role === 'wakasek' ? true : doc.eskulId === user.eskulId))
    .filter((doc) =>
      user.role === 'wakasek' && eskulFilter !== 'semua' ? doc.eskulId === eskulFilter : true,
    )
    .sort((a, b) => b.date.localeCompare(a.date))
  const docs = scopedDocs.filter((doc) => {
    if (!search.trim()) return true
    const query = search.toLowerCase()
    return (
      doc.title.toLowerCase().includes(query) ||
      doc.caption.toLowerCase().includes(query)
    )
  })
  const thisMonth = todayISO().slice(0, 7)
  const docsThisMonth = scopedDocs.filter((doc) => doc.date.startsWith(thisMonth)).length
  const coveredEskul = new Set(scopedDocs.map((doc) => doc.eskulId)).size
  const ownSessions = store.sessions
    .filter((session) => session.eskulId === user.eskulId)
    .sort((a, b) => b.date.localeCompare(a.date))

  const openAdd = () => {
    setForm({ ...emptyForm, date: todayISO() })
    setAddOpen(true)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!user.eskulId) return
    if (!form.title.trim() || !form.imageUrl.trim()) {
      toast.error('Lengkapi judul dan gambar dokumentasi.')
      return
    }
    store.addDocumentation({
      eskulId: user.eskulId,
      sessionId: form.sessionId === 'none' ? undefined : form.sessionId,
      title: form.title.trim(),
      caption: form.caption.trim(),
      imageUrl: form.imageUrl.trim(),
      date: form.date,
      uploadedBy: user.id,
    })
    toast.success('Dokumentasi berhasil diunggah', {
      description: 'Foto kegiatan kini tampil di galeri eskul.',
    })
    setForm(emptyForm)
    setAddOpen(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eskul ? `Galeri ${eskul.name}` : 'Galeri Kesiswaan'}
        title="Dokumentasi Kegiatan"
        description={
          user.role === 'wakasek'
            ? 'Pantau dokumentasi kegiatan dari seluruh eskul dalam satu galeri.'
            : 'Simpan momen dan catatan kegiatan eskul agar mudah ditemukan kembali.'
        }
        actions={
          canUpload ? (
            <Button onClick={openAdd}>
              <ImagePlus />
              Unggah Dokumentasi
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total dokumentasi"
          value={scopedDocs.length}
          icon={Images}
          hint="Foto dan catatan kegiatan"
          accent="primary"
        />
        <StatCard
          label="Dokumentasi bulan ini"
          value={docsThisMonth}
          icon={CalendarDays}
          hint={formatDateShort(todayISO(), { weekday: 'long' })}
          accent="sky"
        />
        <StatCard
          label={user.role === 'wakasek' ? 'Eskul tercakup' : 'Sesi terdokumentasi'}
          value={
            user.role === 'wakasek'
              ? coveredEskul
              : new Set(scopedDocs.map((doc) => doc.sessionId).filter(Boolean)).size
          }
          icon={GraduationCap}
          hint={user.role === 'wakasek' ? `Dari ${store.eskul.length} eskul` : 'Terhubung ke sesi'}
          accent="violet"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {user.role === 'wakasek' ? (
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
          ) : (
            <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
              <Images className="size-4 text-primary" />
              {scopedDocs.length} dokumentasi tersimpan
            </div>
          )}
          <div className="relative w-full sm:max-w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari dokumentasi..."
              className="h-9 pl-9 text-xs"
              aria-label="Cari dokumentasi"
            />
          </div>
        </div>
        <Badge variant="secondary" className="w-fit gap-1">
          <Sparkles className="size-3 text-amber-500" />
          {docs.length} hasil
        </Badge>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Belum ada dokumentasi"
          description="Unggah foto kegiatan pertama agar momen eskul tidak hilang."
          action={
            canUpload ? (
              <Button size="sm" onClick={openAdd}>
                <ImagePlus />
                Unggah Dokumentasi
              </Button>
            ) : undefined
          }
          className="py-16"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc) => {
            const docEskul = store.eskul.find((item) => item.id === doc.eskulId)
            const uploader = store.users.find((item) => item.id === doc.uploadedBy)
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelected(doc)}
                className="group overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <DocImage
                    src={doc.imageUrl}
                    alt={doc.title}
                    className="size-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/5 to-transparent opacity-90" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    {docEskul ? <EskulChip eskul={docEskul} className="bg-white/95 backdrop-blur dark:bg-slate-900/80" /> : null}
                  </div>
                  <div className="absolute inset-x-3 bottom-3">
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-white drop-shadow">
                      {doc.title}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-white/70">
                      {formatDateShort(doc.date)} · {uploader?.name ?? 'Pengguna'}
                    </p>
                  </div>
                </div>
                <div className="p-3.5">
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {doc.caption || 'Tanpa keterangan.'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title={selected?.title ?? 'Dokumentasi'}
        description={
          selected
            ? `${store.eskul.find((item) => item.id === selected.eskulId)?.name ?? 'Eskul'} · ${formatDate(selected.date)}`
            : undefined
        }
        size="lg"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border/70">
              <DocImage
                src={selected.imageUrl}
                alt={selected.title}
                className="max-h-[48vh] w-full"
              />
            </div>
            <p className="text-sm leading-relaxed text-foreground/80">
              {selected.caption || 'Tidak ada keterangan untuk dokumentasi ini.'}
            </p>
            <div className="grid gap-3 rounded-xl bg-muted/35 p-3 text-[11px] sm:grid-cols-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Diunggah oleh
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {store.users.find((item) => item.id === selected.uploadedBy)?.name ?? '-'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Waktu unggah
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {formatDateTime(selected.createdAt)}
                </p>
              </div>
              {selected.sessionId ? (
                <div className="sm:col-span-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    Sesi terkait
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {store.sessions.find((session) => session.id === selected.sessionId)?.topic ??
                      '-'}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Unggah Dokumentasi"
        description={`Tambahkan foto kegiatan ${eskul?.name ?? 'eskul'} ke galeri.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="add-documentation-form">
              <UploadCloud />
              Unggah
            </Button>
          </>
        }
      >
        <form id="add-documentation-form" onSubmit={handleSubmit} className="space-y-4">
          <Field label="Judul dokumentasi" htmlFor="doc-title" required>
            <Input
              id="doc-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Contoh: Latihan rutin & evaluasi"
              autoFocus
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tanggal kegiatan" htmlFor="doc-date" required>
              <Input
                id="doc-date"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </Field>
            <Field label="Kaitkan ke sesi" htmlFor="doc-session" hint="Opsional">
              <Select
                id="doc-session"
                value={form.sessionId}
                onChange={(event) => {
                  const sessionId = event.target.value
                  const session = ownSessions.find((item) => item.id === sessionId)
                  setForm({
                    ...form,
                    sessionId,
                    date: session ? session.date : form.date,
                  })
                }}
              >
                <option value="none">Tidak dikaitkan</option>
                {ownSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.topic} · {formatDateShort(session.date)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Keterangan" htmlFor="doc-caption">
            <Textarea
              id="doc-caption"
              value={form.caption}
              onChange={(event) => setForm({ ...form, caption: event.target.value })}
              placeholder="Ceritakan momen atau hasil kegiatan..."
              className="min-h-20"
            />
          </Field>
          <Field
            label="Tautan gambar"
            htmlFor="doc-image"
            hint="Tempel URL gambar, atau pilih salah satu contoh di bawah."
            required
          >
            <Input
              id="doc-image"
              value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl}
              onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              placeholder="https://..."
            />
          </Field>
          <div>
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
              Pilih contoh gambar
            </p>
            <div className="grid grid-cols-4 gap-2">
              {imagePresets.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => setForm({ ...form, imageUrl: preset.url })}
                  className={cn(
                    'group relative overflow-hidden rounded-lg border-2 transition-all',
                    form.imageUrl === preset.url
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-border',
                  )}
                  title={preset.label}
                >
                  <DocImage src={preset.url} alt={preset.label} className="aspect-square w-full" />
                </button>
              ))}
            </div>
          </div>
          {form.imageUrl ? (
            <div className="overflow-hidden rounded-xl border border-border/70">
              <DocImage src={form.imageUrl} alt="Pratinjau" className="h-32 w-full" />
            </div>
          ) : null}
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-[10px] leading-relaxed text-amber-900/70 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:text-amber-100/70">
            Mode demo menyimpan tautan gambar. Pada versi produksi, foto diunggah ke storage
            server dan dikompresi otomatis.
          </div>
        </form>
      </Dialog>
    </div>
  )
}
