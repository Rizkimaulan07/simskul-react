import {
  CalendarDays,
  GraduationCap,
  ImagePlus,
  Images,
  Loader2,
  Search,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import { api, apiErrorMessage } from '@/lib/api'
import {
  compressDocumentationImage,
  MAX_DOCUMENTATION_IMAGE_BYTES,
  validateDocumentationImage,
} from '@/lib/image'
import { canUploadDocumentation } from '@/lib/permissions'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { Documentation } from '@/lib/types'
import { formatDate, formatDateShort, formatDateTime, todayISO } from '@/lib/utils'

const emptyForm = {
  title: '',
  caption: '',
  date: todayISO(),
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [preparingImage, setPreparingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  if (!user) return null

  const eskul = store.eskul.find((item) => item.id === user.eskulId)
  const canUpload = canUploadDocumentation(user)
  const scopedDocs = store.documentation
    .filter((doc) => (user.role === 'admin' ? true : doc.eskulId === user.eskulId))
    .filter((doc) =>
      user.role === 'admin' && eskulFilter !== 'semua' ? doc.eskulId === eskulFilter : true,
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
    setImageFile(null)
    setPreviewUrl('')
    setAddOpen(true)
  }

  const handleImageSelect = async (file: File | undefined) => {
    if (!file) return
    const validationError = validateDocumentationImage(file)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setPreparingImage(true)
    try {
      const prepared = await compressDocumentationImage(file)
      if (prepared.size > MAX_DOCUMENTATION_IMAGE_BYTES) {
        toast.error('Gambar terlalu besar setelah dikompresi. Pilih foto lain.')
        return
      }
      setImageFile(prepared)
      setPreviewUrl(URL.createObjectURL(prepared))
    } catch {
      toast.error('Gambar tidak dapat diproses. Coba file lain.')
    } finally {
      setPreparingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setPreviewUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user.eskulId) return
    if (!form.title.trim()) {
      toast.error('Lengkapi judul dokumentasi.')
      return
    }
    if (!imageFile) {
      toast.error('Pilih gambar dokumentasi dari perangkat terlebih dahulu.')
      return
    }
    setSubmitting(true)
    try {
      const payload = new FormData()
      payload.append('image', imageFile, imageFile.name)
      const upload = await api.upload<{ image: { url: string } }>(
        '/documentation/images',
        payload,
      )
      store.addDocumentation({
        eskulId: user.eskulId,
        sessionId: form.sessionId === 'none' ? undefined : form.sessionId,
        title: form.title.trim(),
        caption: form.caption.trim(),
        imageUrl: upload.image.url,
        date: form.date,
        uploadedBy: user.id,
      })
      toast.success('Dokumentasi berhasil diunggah', {
        description: 'Foto kegiatan kini tampil di galeri eskul.',
      })
      setForm({ ...emptyForm, date: todayISO() })
      removeImage()
      setAddOpen(false)
    } catch (error) {
      toast.error('Gagal mengunggah dokumentasi', {
        description: apiErrorMessage(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eskul ? `Galeri ${eskul.name}` : 'Galeri Kesiswaan'}
        title="Dokumentasi Kegiatan"
        description={
          user.role === 'admin'
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          className="col-span-2 sm:col-span-1"
          label={user.role === 'admin' ? 'Eskul tercakup' : 'Sesi terdokumentasi'}
          value={
            user.role === 'admin'
              ? coveredEskul
              : new Set(scopedDocs.map((doc) => doc.sessionId).filter(Boolean)).size
          }
          icon={GraduationCap}
          hint={user.role === 'admin' ? `Dari ${store.eskul.length} eskul` : 'Terhubung ke sesi'}
          accent="violet"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
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
            <Button
              type="submit"
              form="add-documentation-form"
              disabled={submitting || preparingImage}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <UploadCloud />}
              {submitting ? 'Mengunggah...' : 'Unggah'}
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
            label="Gambar dokumentasi"
            htmlFor="doc-image"
            hint="Unggah JPG, PNG, atau WEBP. Foto otomatis diperkecil agar hemat ruang."
            required
          >
            <input
              ref={fileInputRef}
              id="doc-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => void handleImageSelect(event.target.files?.[0])}
            />
            {previewUrl ? (
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-xl border border-border/70">
                  <img
                    src={previewUrl}
                    alt="Pratinjau gambar dokumentasi"
                    className="h-44 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    disabled={submitting}
                    className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-slate-950/65 text-white backdrop-blur transition hover:bg-slate-950/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-50"
                    aria-label="Hapus gambar"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="max-w-full truncate font-medium">{imageFile?.name}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting || preparingImage}
                  >
                    {preparingImage ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                    Ganti gambar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={preparingImage || submitting}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {preparingImage ? (
                  <Loader2 className="size-7 animate-spin text-primary" />
                ) : (
                  <UploadCloud className="size-7 text-primary" />
                )}
                <span className="text-sm font-semibold text-foreground">
                  {preparingImage ? 'Memproses gambar...' : 'Pilih gambar dari perangkat'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  JPG, PNG, atau WEBP · maksimal 12 MB sebelum dikompresi
                </span>
              </button>
            )}
          </Field>
        </form>
      </Dialog>
    </div>
  )
}
