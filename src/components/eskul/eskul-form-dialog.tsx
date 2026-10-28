import { useState, type FormEvent } from 'react'
import { Loader2, Save, School } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import { Field } from '@/components/shared/field'
import { apiErrorMessage } from '@/lib/api'
import { WEEKDAY_OPTIONS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import type { Eskul, EskulColor, User } from '@/lib/types'
import { cn } from '@/lib/utils'

const colorOptions: { value: EskulColor; label: string; dot: string }[] = [
  { value: 'emerald', label: 'Hijau', dot: 'bg-emerald-500' },
  { value: 'sky', label: 'Biru', dot: 'bg-sky-500' },
  { value: 'rose', label: 'Merah Muda', dot: 'bg-rose-500' },
  { value: 'amber', label: 'Oranye', dot: 'bg-amber-500' },
  { value: 'violet', label: 'Ungu', dot: 'bg-violet-500' },
]

interface EskulFormState {
  name: string
  shortName: string
  description: string
  color: EskulColor
  day: string
  time: string
  location: string
  quota: string
  coachId: string
  leaderId: string
}

function toFormState(eskul?: Eskul): EskulFormState {
  return {
    name: eskul?.name ?? '',
    shortName: eskul?.shortName ?? '',
    description: eskul?.description ?? '',
    color: eskul?.color ?? 'emerald',
    day: eskul?.day ?? 'Sabtu',
    time: eskul?.time ?? '15.30 – 17.00',
    location: eskul?.location ?? 'Lapangan Utama',
    quota: eskul ? String(eskul.quota) : '25',
    coachId: eskul?.coachId ?? '',
    leaderId: eskul?.leaderId ?? '',
  }
}

interface EskulFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eskul?: Eskul
  users: User[]
}

export function EskulFormDialog({ open, onOpenChange, eskul, users }: EskulFormDialogProps) {
  const createEskul = useAppStore((state) => state.createEskul)
  const updateEskul = useAppStore((state) => state.updateEskul)
  const [form, setForm] = useState<EskulFormState>(() => toFormState(eskul))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const coaches = users.filter((user) => user.role === 'pelatih' && user.active !== false)
  const leaders = users.filter((user) => user.role === 'ketua' && user.active !== false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const quota = Number(form.quota)
    if (!form.name.trim() || !form.shortName.trim() || !form.description.trim()) {
      setError('Nama, singkatan, dan deskripsi eskul wajib diisi.')
      return
    }
    if (!form.day || !form.time.trim() || !form.location.trim()) {
      setError('Jadwal, jam, dan lokasi latihan wajib diisi.')
      return
    }
    if (!Number.isInteger(quota) || quota < 1 || quota > 999) {
      setError('Kuota anggota harus berupa angka antara 1 sampai 999.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      description: form.description.trim(),
      color: form.color,
      day: form.day,
      time: form.time.trim(),
      location: form.location.trim(),
      quota,
      coachId: form.coachId || null,
      leaderId: form.leaderId || null,
    }
    try {
      if (eskul) await updateEskul(eskul.id, payload)
      else await createEskul(payload)
      onOpenChange(false)
    } catch (submitError) {
      setError(apiErrorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  const userLabel = (user: User) => `${user.name}${user.eskulId ? ' (tertautan eskul lain)' : ''}`

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={eskul ? 'Edit Eskul' : 'Tambah Eskul'}
      description={
        eskul
          ? `Perbarui data ekstrakurikuler ${eskul.name}.`
          : 'Daftarkan ekstrakurikuler baru beserta jadwal, pembina, dan ketuanya.'
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="submit" form="eskul-form" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : eskul ? <Save /> : <School />}
            {eskul ? 'Simpan Perubahan' : 'Tambah Eskul'}
          </Button>
        </>
      }
    >
      <form id="eskul-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Nama eskul" htmlFor="eskul-name" required>
            <Input
              id="eskul-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Contoh: English Club"
              autoFocus
            />
          </Field>
          <Field label="Singkatan" htmlFor="eskul-short" hint="Maks. 10 karakter" required>
            <Input
              id="eskul-short"
              value={form.shortName}
              onChange={(event) => setForm({ ...form, shortName: event.target.value.toUpperCase() })}
              placeholder="EC" maxLength={10}
              className="w-full sm:w-32"
            />
          </Field>
        </div>
        <Field label="Deskripsi kegiatan" htmlFor="eskul-description" required>
          <Textarea
            id="eskul-description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Jelaskan tujuan dan fokus kegiatan eskul ini..."
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Warna tema kartu" htmlFor="eskul-color" required>
            <Select
              id="eskul-color"
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value as EskulColor })}
            >
              {colorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="pt-5">
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white',
                  colorOptions.find((option) => option.value === form.color)?.dot ?? 'bg-primary',
                )}
              >
                {form.shortName.slice(0, 3) || 'ESK'}
              </span>
              <p className="truncate text-[11px] font-semibold text-muted-foreground">
                Pratinjau warna kartu eskul
              </p>
            </div>
          </div>
          <Field label="Hari latihan" htmlFor="eskul-day" required>
            <Select
              id="eskul-day"
              value={form.day}
              onChange={(event) => setForm({ ...form, day: event.target.value })}
            >
              {WEEKDAY_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jam latihan" htmlFor="eskul-time" required>
            <Input
              id="eskul-time"
              value={form.time}
              onChange={(event) => setForm({ ...form, time: event.target.value })}
              placeholder="15.30 – 17.00"
            />
          </Field>
          <Field label="Lokasi latihan" htmlFor="eskul-location" required>
            <Input
              id="eskul-location"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              placeholder="Contoh: Lapangan Utama"
            />
          </Field>
          <Field label="Kuota anggota" htmlFor="eskul-quota" required>
            <Input
              id="eskul-quota"
              type="number"
              min={1}
              max={999}
              value={form.quota}
              onChange={(event) => setForm({ ...form, quota: event.target.value })}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Pelatih / Pembina"
            htmlFor="eskul-coach"
            hint="Akun tertaut otomatis mengikuti pemilihan"
          >
            <Select
              id="eskul-coach"
              value={form.coachId}
              onChange={(event) => setForm({ ...form, coachId: event.target.value })}
            >
              <option value="">Belum ditentukan</option>
              {coaches.map((user) => (
                <option key={user.id} value={user.id}>
                  {userLabel(user)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Ketua eskul"
            htmlFor="eskul-leader"
            hint="Akun ketua ekstrakurikuler aktif"
          >
            <Select
              id="eskul-leader"
              value={form.leaderId}
              onChange={(event) => setForm({ ...form, leaderId: event.target.value })}
            >
              <option value="">Belum ditentukan</option>
              {leaders.map((user) => (
                <option key={user.id} value={user.id}>
                  {userLabel(user)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Pelatih dan ketua yang dipilih akan otomatis tertaut ke eskul ini. Akun baru dapat
          ditambahkan melalui halaman Manajemen Pengguna.
        </p>
      </form>
    </Dialog>
  )
}

interface EskulDeleteDialogProps {
  eskul: Eskul | null
  memberCount: number
  onClose: () => void
}

export function EskulDeleteDialog({ eskul, memberCount, onClose }: EskulDeleteDialogProps) {
  const deleteEskul = useAppStore((state) => state.deleteEskul)
  const [deleting, setDeleting] = useState(false)

  if (!eskul) return null

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteEskul(eskul.id)
      onClose()
    } catch (error) {
      toast.error('Gagal menghapus eskul', { description: apiErrorMessage(error) })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Hapus ${eskul.name}?`}
      description="Seluruh data terkait eskul ini akan dihapus permanen."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : <School />}
            Ya, Hapus Eskul
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100/80">
        <p className="font-bold">Data yang ikut terhapus</p>
        <p className="mt-1">
          {eskul.name} beserta {memberCount} anggota, seluruh sesi dan presensi, nilai, dokumentasi,
          serta perizinan yang berkaitan. Pengguna eskul ini tetap ada tetapi tanpa tautan eskul.
        </p>
      </div>
    </Dialog>
  )
}
