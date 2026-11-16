import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  Save,
  School,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { EskulChip, RoleBadge } from '@/components/shared/badges'
import { PageHeader } from '@/components/shared/page-header'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Field } from '@/components/shared/field'
import { apiErrorMessage } from '@/lib/api'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/constants'
import { useAppStore, useCurrentUser } from '@/lib/store'
import { cn, formatDateShort, formatRelative, firstName } from '@/lib/utils'

const passwordChecks = (value: string) => [
  { label: 'Minimal 8 karakter', valid: value.length >= 8 },
  { label: 'Mengandung huruf besar', valid: /[A-Z]/.test(value) },
  { label: 'Mengandung angka', valid: /\d/.test(value) },
  { label: 'Mengandung simbol', valid: /[^A-Za-z0-9]/.test(value) },
]

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  autoComplete?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  )
}

export function ProfilePage() {
  const user = useCurrentUser()
  const store = useAppStore()
  const updateProfile = useAppStore((state) => state.updateProfile)
  const changePassword = useAppStore((state) => state.changePassword)
  const activities = useAppStore((state) => state.activities)

  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [savingPassword, setSavingPassword] = useState(false)

  if (!user) return null
  const eskul = store.eskul.find((item) => item.id === user.eskulId)
  const coach = store.users.find((item) => item.id === eskul?.coachId)
  const leader = store.users.find((item) => item.id === eskul?.leaderId)
  const ownActivities = activities.filter((activity) => activity.userId === user.id).slice(0, 5)
  const checks = passwordChecks(passwords.next)
  const passedChecks = checks.filter((item) => item.valid).length
  const strength = Math.round((passedChecks / checks.length) * 100)
  const profileChanged =
    profile.name !== user.name ||
    profile.email !== user.email ||
    (profile.phone ?? '') !== (user.phone ?? '')

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile.name.trim()) {
      toast.error('Nama lengkap tidak boleh kosong.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      toast.error('Format email belum valid.')
      return
    }
    setSavingProfile(true)
    try {
      await updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
      })
      toast.success('Profil diperbarui', {
        description: 'Perubahan akun Anda telah disimpan.',
      })
    } catch (error) {
      toast.error('Profil gagal disimpan', { description: apiErrorMessage(error) })
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!passwords.current) {
      toast.error('Masukkan kata sandi saat ini.')
      return
    }
    if (passwords.next.length < 8) {
      toast.error('Kata sandi baru minimal 8 karakter.')
      return
    }
    if (passwords.next === passwords.current) {
      toast.error('Kata sandi baru harus berbeda dari kata sandi saat ini.')
      return
    }
    if (passwords.next !== passwords.confirm) {
      toast.error('Konfirmasi kata sandi belum sama.')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword(passwords.current, passwords.next)
      setPasswords({ current: '', next: '', confirm: '' })
      toast.success('Kata sandi diperbarui', {
        description: 'Perangkat lain otomatis keluar. Sesi ini tetap aktif.',
      })
    } catch (error) {
      toast.error('Kata sandi gagal diubah', { description: apiErrorMessage(error) })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Akun & Keamanan"
        title="Profil & Keamanan"
        description="Perbarui identitas akun, kontak sekolah, dan kata sandi. Perubahan langsung tersimpan ke database."
      />

      <Card className="overflow-hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 px-5 py-6 text-white sm:px-6">
          <div className="grid-pattern absolute inset-0 opacity-40" />
          <div className="absolute -right-12 -top-16 size-48 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar
              name={user.name}
              id={user.id}
              size="xl"
              className="ring-4 ring-white/20 shadow-xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={user.role} className="border-white/20 bg-white/10 text-white" />
                {eskul ? <EskulChip eskul={eskul} className="bg-white/10 text-white" /> : null}
              </div>
              <h2 className="mt-2 truncate text-xl font-extrabold tracking-tight sm:text-2xl">
                {user.name}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/60">
                <Mail className="size-3.5" />
                {user.email}
                {user.phone ? (
                  <>
                    <span className="text-white/30">·</span>
                    <Phone className="size-3.5" />
                    {user.phone}
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-semibold backdrop-blur">
                <ShieldCheck className="size-3.5 text-emerald-300" />
                Akun aktif
              </span>
              <span className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-semibold backdrop-blur">
                <CalendarDays className="size-3.5 text-emerald-300" />
                {user.createdAt ? `Bergabung ${formatDateShort(user.createdAt.slice(0, 10))}` : 'Akun sekolah'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <UserRound className="size-4 text-primary" />
                Informasi pribadi
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Nama dan kontak ini tampil pada aktivitas, surat, serta komunikasi eskul.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSave} className="space-y-4">
                <Field label="Nama lengkap" htmlFor="profile-name" required>
                  <Input
                    id="profile-name"
                    value={profile.name}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                    placeholder="Nama lengkap Anda"
                    autoComplete="name"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Email" htmlFor="profile-email" required>
                    <Input
                      id="profile-email"
                      type="email"
                      value={profile.email}
                      onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                      placeholder="nama@simskul.sch.id"
                      autoComplete="email"
                    />
                  </Field>
                  <Field
                    label="Nomor telepon"
                    htmlFor="profile-phone"
                    hint="Opsional, dipakai untuk koordinasi kegiatan."
                  >
                    <Input
                      id="profile-phone"
                      value={profile.phone}
                      onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                      placeholder="08xxxxxxxxxx"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </Field>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    Email harus unik dan aktif untuk menerima informasi sekolah.
                  </p>
                  <Button type="submit" disabled={savingProfile || !profileChanged}>
                    <Save />
                    {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <KeyRound className="size-4 text-primary" />
                Ubah kata sandi
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Gunakan kata sandi yang kuat dan tidak dipakai pada akun lain.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSave} className="space-y-4">
                <Field label="Kata sandi saat ini" htmlFor="password-current" required>
                  <PasswordInput
                    id="password-current"
                    value={passwords.current}
                    onChange={(event) =>
                      setPasswords({ ...passwords, current: event.target.value })
                    }
                    placeholder="Masukkan kata sandi saat ini"
                    autoComplete="current-password"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Kata sandi baru" htmlFor="password-next" required>
                    <PasswordInput
                      id="password-next"
                      value={passwords.next}
                      onChange={(event) =>
                        setPasswords({ ...passwords, next: event.target.value })
                      }
                      placeholder="Minimal 8 karakter"
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Konfirmasi kata sandi" htmlFor="password-confirm" required>
                    <PasswordInput
                      id="password-confirm"
                      value={passwords.confirm}
                      onChange={(event) =>
                        setPasswords({ ...passwords, confirm: event.target.value })
                      }
                      placeholder="Ulangi kata sandi baru"
                      autoComplete="new-password"
                    />
                  </Field>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Kekuatan kata sandi
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-extrabold',
                        strength >= 75
                          ? 'text-emerald-600'
                          : strength >= 50
                            ? 'text-amber-600'
                            : 'text-rose-600',
                      )}
                    >
                      {passwords.next ? `${strength}%` : 'Belum diisi'}
                    </span>
                  </div>
                  <Progress
                    value={strength}
                    className="mt-2 h-1.5"
                    indicatorClassName={
                      strength >= 75
                        ? 'bg-emerald-500'
                        : strength >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }
                  />
                  <div className="mt-2.5 grid gap-1 sm:grid-cols-2">
                    {checks.map((item) => (
                      <span
                        key={item.label}
                        className={cn(
                          'flex items-center gap-1.5 text-[10px]',
                          item.valid ? 'font-semibold text-emerald-600' : 'text-muted-foreground',
                        )}
                      >
                        {item.valid ? <Check className="size-3" /> : <X className="size-3" />}
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <LockKeyhole className="size-3" />
                    Semua perangkat lain akan otomatis keluar setelah perubahan.
                  </p>
                  <Button
                    type="submit"
                    disabled={
                      savingPassword ||
                      !passwords.current ||
                      !passwords.next ||
                      !passwords.confirm
                    }
                  >
                    <KeyRound />
                    {savingPassword ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-primary" />
                Peran & cakupan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Peran akun
                </p>
                <p className="mt-1 text-xs font-bold text-foreground">{ROLE_LABELS[user.role]}</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {ROLE_DESCRIPTIONS[user.role]}
                </p>
              </div>
              <div className="border-t border-border/60 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Cakupan eskul
                </p>
                {eskul ? (
                  <div className="mt-1.5 space-y-1.5">
                    <EskulChip eskul={eskul} />
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <School className="size-3" />
                      {coach?.name ?? 'Belum ada pelatih'}
                    </p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <UserRound className="size-3" />
                      Ketua: {leader?.name ?? 'Belum ditunjuk'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-foreground">
                    {user.role === 'admin'
                      ? 'Seluruh ekstrakurikuler'
                      : 'Lingkup kesiswaan & surat izin'}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status akun
                </span>
                <Badge variant={user.active === false ? 'secondary' : 'default'}>
                  {user.active === false ? 'Nonaktif' : 'Aktif'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="size-4 text-primary" />
                Aktivitas saya
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Lima jejak terakhir akun ini.</p>
            </CardHeader>
            <CardContent>
              {ownActivities.length === 0 ? (
                <p className="rounded-xl bg-muted/30 px-3 py-6 text-center text-[11px] text-muted-foreground">
                  Belum ada aktivitas tercatat.
                </p>
              ) : (
                <div className="space-y-3">
                  {ownActivities.map((activity) => (
                    <div key={activity.id} className="flex gap-2.5">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CheckCircle2 className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold leading-snug text-foreground">
                          {activity.action}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {activity.detail}
                        </p>
                        <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/60">
                          {formatRelative(activity.at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4 dark:border-sky-500/20 dark:bg-sky-500/[0.06]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" />
            <div>
              <p className="text-[11px] font-bold text-sky-950 dark:text-sky-50">
                Tips keamanan akun
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-sky-800/70 dark:text-sky-100/60">
                {firstName(user.name)}, jangan bagikan kata sandi kepada siapa pun. Laporkan
                aktivitas mencurigakan kepada administrator sekolah.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
