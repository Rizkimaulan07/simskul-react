import { useState, type FormEvent } from 'react'
import { Loader2, Save, School, UserPlus, UserRound, X } from 'lucide-react'
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
import { cn, uid } from '@/lib/utils'

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

interface PendingUser {
  name: string
  email: string
  phone: string
  password: string
}

function emptyPendingUser(): PendingUser {
  return { name: '', email: '', phone: '', password: '' }
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
  const createUser = useAppStore((state) => state.createUser)
  const [form, setForm] = useState<EskulFormState>(() => toFormState(eskul))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCoach, setNewCoach] = useState<PendingUser | null>(null)
  const [newLeader, setNewLeader] = useState<PendingUser | null>(null)
  const [quickRole, setQuickRole] = useState<'pelatih' | 'ketua' | null>(null)
  const [quickForm, setQuickForm] = useState<PendingUser>(emptyPendingUser)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [savedEskulId, setSavedEskulId] = useState<string | null>(null)

  const coaches = users.filter((user) => user.role === 'pelatih' && user.active !== false)
  const leaders = users.filter((user) => user.role === 'ketua' && user.active !== false)

  const openQuickForm = (role: 'pelatih' | 'ketua') => {
    setQuickRole(role)
    setQuickForm(
      role === 'pelatih' ? (newCoach ?? emptyPendingUser()) : (newLeader ?? emptyPendingUser()),
    )
    setQuickError(null)
    setError(null)
  }

  const closeQuickForm = () => {
    setQuickRole(null)
    setQuickForm(emptyPendingUser())
    setQuickError(null)
  }

  const handleQuickAdd = () => {
    if (!quickRole) return
    const name = quickForm.name.trim()
    const email = quickForm.email.trim().toLowerCase()
    if (!name) {
      setQuickError('Nama lengkap wajib diisi.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setQuickError('Format email tidak valid.')
      return
    }
    if (quickForm.password.length < 8) {
      setQuickError('Kata sandi minimal 8 karakter.')
      return
    }
    if (users.some((user) => user.email.toLowerCase() === email)) {
      setQuickError('Email sudah digunakan pengguna lain.')
      return
    }
    const otherDraft = quickRole === 'pelatih' ? newLeader : newCoach
    if (otherDraft && otherDraft.email.toLowerCase() === email) {
      setQuickError('Email sudah dipakai akun baru lainnya.')
      return
    }

    const draft: PendingUser = {
      name,
      email,
      phone: quickForm.phone.trim(),
      password: quickForm.password,
    }
    if (quickRole === 'pelatih') {
      setNewCoach(draft)
      setForm((current) => ({ ...current, coachId: '' }))
    } else {
      setNewLeader(draft)
      setForm((current) => ({ ...current, leaderId: '' }))
    }
    closeQuickForm()
  }

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
    if (quickRole) {
      setError('Selesaikan atau batalkan pembuatan akun baru terlebih dahulu.')
      return
    }
    setSaving(true)
    setError(null)
    const targetId = eskul?.id ?? savedEskulId ?? uid('eskul')
    const isNew = !eskul && !savedEskulId
    let eskulSavedInThisAttempt = false
    const basePayload = {
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      description: form.description.trim(),
      color: form.color,
      day: form.day,
      time: form.time.trim(),
      location: form.location.trim(),
      quota,
      coachId: newCoach ? null : form.coachId || null,
      leaderId: newLeader ? null : form.leaderId || null,
    }
    try {
      if (isNew) {
        await createEskul({ id: targetId, ...basePayload }, { notify: false })
        setSavedEskulId(targetId)
        eskulSavedInThisAttempt = true
      }

      let coachId = basePayload.coachId
      let leaderId = basePayload.leaderId

      if (newCoach) {
        const created = await createUser({
          name: newCoach.name,
          email: newCoach.email,
          role: 'pelatih',
          eskulId: targetId,
          phone: newCoach.phone || undefined,
          password: newCoach.password,
        })
        coachId = created.id
        setForm((current) => ({ ...current, coachId: created.id }))
        setNewCoach(null)
      }

      if (newLeader) {
        const created = await createUser({
          name: newLeader.name,
          email: newLeader.email,
          role: 'ketua',
          eskulId: targetId,
          phone: newLeader.phone || undefined,
          password: newLeader.password,
        })
        leaderId = created.id
        setForm((current) => ({ ...current, leaderId: created.id }))
        setNewLeader(null)
      }

      if (!isNew) {
        await updateEskul(targetId, { ...basePayload, coachId, leaderId }, { notify: false })
      } else if (newCoach || newLeader) {
        await updateEskul(targetId, { coachId, leaderId }, { notify: false })
      }

      toast.success(isNew ? 'Eskul berhasil ditambahkan' : 'Data eskul diperbarui', {
        description: isNew
          ? `${form.name.trim()}${newCoach || newLeader ? ' beserta akun barunya' : ''}`
          : form.name.trim(),
      })
      onOpenChange(false)
    } catch (submitError) {
      const message = apiErrorMessage(submitError)
      setError(
        !eskul && (eskulSavedInThisAttempt || savedEskulId)
          ? `${message} Eskul sudah tersimpan, silakan perbaiki data akun lalu simpan lagi.`
          : message,
      )
    } finally {
      setSaving(false)
    }
  }

  const userLabel = (user: User) => `${user.name}${user.eskulId ? ' (tertautan eskul lain)' : ''}`
  const persisted = Boolean(eskul || savedEskulId)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={persisted ? 'Edit Eskul' : 'Tambah Eskul'}
      description={
        eskul
          ? `Perbarui data ekstrakurikuler ${eskul.name}.`
          : savedEskulId
            ? 'Eskul sudah tersimpan. Lengkapi data akun pelatih atau ketua yang gagal dibuat.'
            : 'Daftarkan ekstrakurikuler baru beserta jadwal, pembina, dan ketuanya.'
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="submit" form="eskul-form" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : persisted ? <Save /> : <School />}
            {persisted ? 'Simpan Perubahan' : 'Tambah Eskul'}
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
            hint="Pilih akun yang sudah ada atau buat akun baru"
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  id="eskul-coach"
                  value={form.coachId}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm({ ...form, coachId: value })
                    if (value) setNewCoach(null)
                  }}
                >
                  <option value="">
                    {newCoach ? `Akun baru: ${newCoach.name}` : 'Belum ditentukan'}
                  </option>
                  {coaches.map((user) => (
                    <option key={user.id} value={user.id}>
                      {userLabel(user)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0"
                onClick={() => openQuickForm('pelatih')}
                aria-label="Buat akun pelatih baru"
              >
                <UserPlus />
                <span className="hidden sm:inline">Akun baru</span>
              </Button>
            </div>
            {newCoach ? <PendingUserBadge user={newCoach} onRemove={() => setNewCoach(null)} /> : null}
          </Field>
          <Field
            label="Ketua eskul"
            htmlFor="eskul-leader"
            hint="Pilih akun yang sudah ada atau buat akun baru"
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  id="eskul-leader"
                  value={form.leaderId}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm({ ...form, leaderId: value })
                    if (value) setNewLeader(null)
                  }}
                >
                  <option value="">
                    {newLeader ? `Akun baru: ${newLeader.name}` : 'Belum ditentukan'}
                  </option>
                  {leaders.map((user) => (
                    <option key={user.id} value={user.id}>
                      {userLabel(user)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0"
                onClick={() => openQuickForm('ketua')}
                aria-label="Buat akun ketua baru"
              >
                <UserPlus />
                <span className="hidden sm:inline">Akun baru</span>
              </Button>
            </div>
            {newLeader ? (
              <PendingUserBadge user={newLeader} onRemove={() => setNewLeader(null)} />
            ) : null}
          </Field>
        </div>
        {quickRole ? (
          <div
            className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                event.preventDefault()
                handleQuickAdd()
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-foreground">
                  Buat akun {quickRole === 'pelatih' ? 'pelatih' : 'ketua'} baru
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  Akun akan ditautkan ke {form.name.trim() || 'eskul ini'} saat form disimpan.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={closeQuickForm}
                aria-label="Batalkan akun baru"
              >
                <X />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nama lengkap" htmlFor="quick-user-name" required>
                <Input
                  id="quick-user-name"
                  value={quickForm.name}
                  onChange={(event) => setQuickForm({ ...quickForm, name: event.target.value })}
                  placeholder={
                    quickRole === 'pelatih'
                      ? 'Contoh: Dewi Anggraini, S.Pd.'
                      : 'Contoh: Rani Puspita'
                  }
                  autoFocus
                />
              </Field>
              <Field label="Email" htmlFor="quick-user-email" required>
                <Input
                  id="quick-user-email"
                  type="email"
                  value={quickForm.email}
                  onChange={(event) => setQuickForm({ ...quickForm, email: event.target.value })}
                  placeholder="nama@simskul.sch.id"
                  autoComplete="off"
                />
              </Field>
              <Field label="Nomor telepon" htmlFor="quick-user-phone" hint="Opsional">
                <Input
                  id="quick-user-phone"
                  value={quickForm.phone}
                  onChange={(event) => setQuickForm({ ...quickForm, phone: event.target.value })}
                  placeholder="0812-3456-7890"
                />
              </Field>
              <Field
                label="Kata sandi awal"
                htmlFor="quick-user-password"
                hint="Minimal 8 karakter"
                required
              >
                <Input
                  id="quick-user-password"
                  type="password"
                  value={quickForm.password}
                  onChange={(event) => setQuickForm({ ...quickForm, password: event.target.value })}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                />
              </Field>
            </div>
            {quickError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
                {quickError}
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={closeQuickForm}>
                Batal
              </Button>
              <Button type="button" size="sm" onClick={handleQuickAdd}>
                <UserPlus />
                Tambahkan akun
              </Button>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Pelatih dan ketua yang dipilih akan otomatis tertaut ke eskul ini. Gunakan tombol
          “Akun baru” untuk membuat akun langsung dari form ini, atau kelola akun lain melalui
          halaman Manajemen Pengguna.
        </p>
      </form>
    </Dialog>
  )
}

function PendingUserBadge({ user, onRemove }: { user: PendingUser; onRemove: () => void }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.05] px-2.5 py-1.5">
      <UserRound className="size-3.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-foreground">{user.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{user.email} · akun baru</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="iconSm"
        className="-mr-1 size-7"
        onClick={onRemove}
        aria-label={`Batalkan akun ${user.name}`}
      >
        <X />
      </Button>
    </div>
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
