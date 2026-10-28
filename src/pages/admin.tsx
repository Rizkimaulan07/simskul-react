import {
  Activity as ActivityIcon,
  AlertTriangle,
  Database,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  School,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { PageHeader } from '@/components/shared/page-header'
import { RoleBadge } from '@/components/shared/badges'
import { StatCard } from '@/components/shared/stat-card'
import { apiErrorMessage } from '@/lib/api'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/constants'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { Role, User } from '@/lib/types'
import { cn, formatRelative } from '@/lib/utils'

type AdminTab = 'pengguna' | 'aktivitas'
type RoleFilter = 'semua' | Role
type StatusFilter = 'semua' | 'aktif' | 'nonaktif'

interface UserFormState {
  name: string
  email: string
  role: Role
  eskulId: string
  phone: string
  password: string
}

const roleOptions: Role[] = ['admin', 'pelatih', 'ketua']

function needsEskul(role: Role) {
  return role === 'pelatih' || role === 'ketua'
}

function isActive(account: User) {
  return account.active !== false
}

export function AdminPage() {
  const currentUser = useCurrentUser()
  const store = useAppStore()
  const [tab, setTab] = useState<AdminTab>('pengguna')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('semua')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua')
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [passwordUser, setPasswordUser] = useState<User | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [form, setForm] = useState<UserFormState>({
    name: '',
    email: '',
    role: 'pelatih',
    eskulId: '',
    phone: '',
    password: '',
  })

  if (!currentUser) return null

  const activeUsers = store.users.filter(isActive)
  const adminCount = activeUsers.filter((account) => account.role === 'admin').length
  const filteredUsers = store.users
    .filter((account) => {
      if (roleFilter !== 'semua' && account.role !== roleFilter) return false
      if (statusFilter === 'aktif' && !isActive(account)) return false
      if (statusFilter === 'nonaktif' && isActive(account)) return false
      if (!search.trim()) return true
      const query = search.toLowerCase()
      return (
        account.name.toLowerCase().includes(query) ||
        account.email.toLowerCase().includes(query) ||
        (account.phone ?? '').toLowerCase().includes(query)
      )
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const firstEskulId = store.eskul[0]?.id ?? ''

  const openAdd = () => {
    setForm({
      name: '',
      email: '',
      role: 'pelatih',
      eskulId: firstEskulId,
      phone: '',
      password: '',
    })
    setFormError(null)
    setAddOpen(true)
  }

  const openEdit = (account: User) => {
    setForm({
      name: account.name,
      email: account.email,
      role: account.role,
      eskulId: account.eskulId ?? firstEskulId,
      phone: account.phone ?? '',
      password: '',
    })
    setFormError(null)
    setEditUser(account)
  }

  const openPassword = (account: User) => {
    setPassword('')
    setPasswordConfirm('')
    setPasswordError(null)
    setPasswordUser(account)
  }

  const validateCommon = () => {
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Nama dan email wajib diisi.')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Format email tidak valid.')
      return false
    }
    if (needsEskul(form.role) && !form.eskulId) {
      setFormError('Pilih eskul untuk peran pelatih atau ketua.')
      return false
    }
    return true
  }

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!validateCommon()) return
    if (form.password.length < 8) {
      setFormError('Kata sandi minimal 8 karakter.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await store.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        eskulId: needsEskul(form.role) ? form.eskulId : undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
      })
      toast.success('Pengguna berhasil ditambahkan', {
        description: `${form.name.trim()} dapat masuk dengan email ${form.email.trim()}.`,
      })
      setAddOpen(false)
    } catch (error) {
      setFormError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editUser || !validateCommon()) return
    setSaving(true)
    setFormError(null)
    try {
      await store.updateUser(editUser.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        eskulId: needsEskul(form.role) ? form.eskulId : null,
        phone: form.phone.trim() || null,
      })
      toast.success('Data pengguna diperbarui', { description: form.name.trim() })
      setEditUser(null)
    } catch (error) {
      setFormError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!passwordUser) return
    if (password.length < 8) {
      setPasswordError('Kata sandi minimal 8 karakter.')
      return
    }
    if (password !== passwordConfirm) {
      setPasswordError('Konfirmasi kata sandi tidak sama.')
      return
    }
    setSaving(true)
    setPasswordError(null)
    try {
      await store.resetUserPassword(passwordUser.id, password)
      toast.success('Kata sandi diperbarui', {
        description: `Pengguna ${passwordUser.name} perlu masuk kembali dengan kata sandi baru.`,
      })
      setPasswordUser(null)
    } catch (error) {
      setPasswordError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (account: User) => {
    if (account.id === currentUser.id) {
      toast.error('Anda tidak dapat menonaktifkan akun sendiri.')
      return
    }
    try {
      await store.setUserActive(account.id, !isActive(account))
      toast.success(isActive(account) ? 'Pengguna dinonaktifkan' : 'Pengguna diaktifkan', {
        description: account.name,
      })
    } catch (error) {
      toast.error('Gagal mengubah status pengguna', { description: apiErrorMessage(error) })
    }
  }

  const handleResetDemo = async () => {
    setResetting(true)
    try {
      await store.resetDemo()
      toast.success('Data demo berhasil dipulihkan', {
        description: 'Akun pengguna tetap dipertahankan; data eskul dibuat ulang.',
      })
      setResetOpen(false)
    } catch (error) {
      toast.error('Gagal memulihkan data demo', { description: apiErrorMessage(error) })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrasi Sistem"
        title="Manajemen Pengguna"
        description="Kelola akun, peran, dan hak akses pengguna SIMSKUL. Semua perubahan langsung disimpan ke database."
        actions={
          <Button onClick={openAdd}>
            <UserPlus />
            Tambah Pengguna
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total pengguna"
          value={store.users.length}
          icon={Users}
          hint={`${store.users.length - activeUsers.length} nonaktif`}
          accent="primary"
        />
        <StatCard
          label="Akun aktif"
          value={activeUsers.length}
          icon={UserCheck}
          hint="Dapat masuk ke SIMSKUL"
          accent="sky"
        />
        <StatCard
          label="Administrator"
          value={adminCount}
          icon={ShieldCheck}
          hint="Minimal satu harus aktif"
          accent="amber"
        />
        <StatCard
          label="Eskul terdaftar"
          value={store.eskul.length}
          icon={School}
          hint="Referensi peran pelatih & ketua"
          accent="violet"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as AdminTab)}
          items={[
            { value: 'pengguna', label: 'Pengguna', count: store.users.length },
            { value: 'aktivitas', label: 'Log Aktivitas', count: store.activities.length },
          ]}
        />
        {tab === 'pengguna' ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
              className="h-9 w-full text-xs sm:w-40"
              aria-label="Filter peran"
            >
              <option value="semua">Semua peran</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-9 w-full text-xs sm:w-36"
              aria-label="Filter status"
            >
              <option value="semua">Semua status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </Select>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, email, telepon..."
                className="h-9 pl-9 text-xs"
                aria-label="Cari pengguna"
              />
            </div>
          </div>
        ) : null}
      </div>

      {tab === 'pengguna' ? (
        <Card className="overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={UserCog}
                title="Tidak ada pengguna yang cocok"
                description="Ubah filter pencarian atau tambahkan akun pengguna baru."
                action={
                  <Button size="sm" onClick={openAdd}>
                    <UserPlus />
                    Tambah Pengguna
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead className="hidden lg:table-cell">Eskul</TableHead>
                    <TableHead className="hidden md:table-cell">Kontak</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((account) => {
                    const accountEskul = store.eskul.find((item) => item.id === account.eskulId)
                    const self = account.id === currentUser.id
                    return (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={account.name} id={account.id} size="sm" />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate text-xs font-bold text-foreground">
                                {account.name}
                                {self ? (
                                  <Badge variant="outline" className="px-1.5 py-0 text-[9px]">
                                    Anda
                                  </Badge>
                                ) : null}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {account.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={account.role} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-xs font-medium text-foreground">
                            {accountEskul?.name ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-[11px] text-muted-foreground">
                            {account.phone ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isActive(account) ? 'default' : 'secondary'}>
                            {isActive(account) ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => openEdit(account)}
                              title="Edit pengguna"
                              aria-label={`Edit ${account.name}`}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => openPassword(account)}
                              title="Reset kata sandi"
                              aria-label={`Reset kata sandi ${account.name}`}
                            >
                              <KeyRound />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => void handleToggleActive(account)}
                              disabled={self}
                              title={isActive(account) ? 'Nonaktifkan pengguna' : 'Aktifkan pengguna'}
                              aria-label={
                                isActive(account) ? 'Nonaktifkan pengguna' : 'Aktifkan pengguna'
                              }
                              className={cn(
                                'text-muted-foreground',
                                isActive(account)
                                  ? 'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10'
                                  : 'hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10',
                              )}
                            >
                              {isActive(account) ? <UserX /> : <UserCheck />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-1 border-t border-border/60 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Menampilkan {filteredUsers.length} dari {store.users.length} pengguna
                </span>
                <span>Kata sandi disimpan sebagai hash scrypt, bukan teks biasa.</span>
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-border/60 p-5">
            <p className="text-sm font-bold text-foreground">Log aktivitas terbaru</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Maksimal 100 aktivitas terakhir dari seluruh pengguna dan eskul.
            </p>
          </div>
          {store.activities.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ActivityIcon}
                title="Belum ada aktivitas"
                description="Aktivitas pengguna akan tampil setelah ada perubahan data."
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {store.activities.slice(0, 40).map((activity) => {
                const actor = store.users.find((account) => account.id === activity.userId)
                return (
                  <div key={activity.id} className="flex items-start gap-3 p-4">
                    <Avatar
                      name={actor?.name ?? 'Pengguna'}
                      id={activity.userId}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {actor?.name ?? 'Pengguna'}
                        </span>{' '}
                        {activity.action.toLowerCase()}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-foreground/75">
                        {activity.detail}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelative(activity.at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-hidden border-amber-200/70 dark:border-amber-500/20">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
              <Database className="size-[18px]" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Database & pemeliharaan</p>
              <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                SIMSKUL terhubung ke PostgreSQL melalui variabel <code className="font-semibold">DATABASE_URL</code>.
                Pemulihan data demo akan membuat ulang eskul, anggota, sesi, nilai, dokumentasi,
                dan perizinan, tetapi tidak menghapus akun pengguna.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setResetOpen(true)} className="shrink-0">
            <RotateCcw />
            Pulihkan Data Demo
          </Button>
        </div>
      </Card>

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Tambah Pengguna"
        description="Buat akun baru dan tentukan perannya di SIMSKUL."
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="add-user-form" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Simpan Pengguna
            </Button>
          </>
        }
      >
        <form id="add-user-form" onSubmit={handleAdd} className="space-y-4">
          <UserFields
            form={form}
            setForm={setForm}
            eskul={store.eskul}
            includePassword
          />
          {formError ? <FormError message={formError} /> : null}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {ROLE_DESCRIPTIONS[form.role]}
          </p>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editUser)}
        onOpenChange={(open) => {
          if (!open) setEditUser(null)
        }}
        title="Edit Pengguna"
        description={editUser ? `Perbarui data akun ${editUser.name}.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Batal
            </Button>
            <Button type="submit" form="edit-user-form" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Pencil />}
              Simpan Perubahan
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleEdit} className="space-y-4">
          <UserFields form={form} setForm={setForm} eskul={store.eskul} />
          {formError ? <FormError message={formError} /> : null}
          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-[11px] leading-relaxed text-sky-800/80 dark:border-sky-500/20 dark:bg-sky-500/[0.06] dark:text-sky-100/70">
            Kata sandi tidak diubah di sini. Gunakan tombol reset kata sandi pada daftar pengguna
            jika diperlukan.
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(passwordUser)}
        onOpenChange={(open) => {
          if (!open) setPasswordUser(null)
        }}
        title="Reset Kata Sandi"
        description={
          passwordUser
            ? passwordUser.id === currentUser.id
              ? 'Buat kata sandi baru untuk akun Anda. Sesi Anda saat ini tetap aktif.'
              : `Buat kata sandi baru untuk ${passwordUser.name}. Sesi aktif pengguna tersebut akan diakhiri.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setPasswordUser(null)}>
              Batal
            </Button>
            <Button type="submit" form="reset-password-form" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Perbarui Kata Sandi
            </Button>
          </>
        }
      >
        <form id="reset-password-form" onSubmit={handleResetPassword} className="space-y-4">
          <Field label="Kata sandi baru" htmlFor="reset-password" required>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
              autoComplete="new-password"
              autoFocus
            />
          </Field>
          <Field label="Konfirmasi kata sandi" htmlFor="reset-password-confirm" required>
            <Input
              id="reset-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="Ulangi kata sandi baru"
              autoComplete="new-password"
            />
          </Field>
          {passwordError ? <FormError message={passwordError} /> : null}
        </form>
      </Dialog>

      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Pulihkan Data Demo?"
        description="Tindakan ini menimpa seluruh data eskul dengan data contoh awal."
        footer={
          <>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={() => void handleResetDemo()} disabled={resetting}>
              {resetting ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Ya, Pulihkan Data
            </Button>
          </>
        }
      >
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100/80">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-bold">Data yang dibuat ulang</p>
            <p className="mt-1">
              Eskul, anggota, sesi, presensi, nilai, dokumentasi, perizinan, dan log aktivitas
              akan dikembalikan ke data demo. Akun pengguna dan kata sandinya tetap dipertahankan.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function UserFields({
  form,
  setForm,
  eskul,
  includePassword = false,
}: {
  form: UserFormState
  setForm: (form: UserFormState) => void
  eskul: { id: string; name: string }[]
  includePassword?: boolean
}) {
  return (
    <>
      <Field label="Nama lengkap" htmlFor="user-name" required>
        <Input
          id="user-name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Contoh: Dewi Anggraini, S.Pd."
          autoFocus
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" htmlFor="user-email" required>
          <Input
            id="user-email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="nama@simskul.sch.id"
            autoComplete="off"
          />
        </Field>
        <Field label="Nomor telepon" htmlFor="user-phone" hint="Opsional">
          <Input
            id="user-phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="0812-3456-7890"
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Peran" htmlFor="user-role" required>
          <Select
            id="user-role"
            value={form.role}
            onChange={(event) => {
              const role = event.target.value as Role
              setForm({
                ...form,
                role,
                eskulId: needsEskul(role) ? form.eskulId || eskul[0]?.id || '' : '',
              })
            }}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
        {needsEskul(form.role) ? (
          <Field label="Eskul" htmlFor="user-eskul" required>
            <Select
              id="user-eskul"
              value={form.eskulId}
              onChange={(event) => setForm({ ...form, eskulId: event.target.value })}
            >
              <option value="">Pilih eskul</option>
              {eskul.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Cakupan akses" htmlFor="user-scope">
            <Input
              id="user-scope"
              value="Administrasi sistem & seluruh eskul"
              readOnly
              className="bg-muted/40"
            />
          </Field>
        )}
      </div>
      {includePassword ? (
        <Field
          label="Kata sandi awal"
          htmlFor="user-password"
          hint="Minimal 8 karakter. Sampaikan kepada pengguna dan minta segera diganti."
          required
        >
          <Input
            id="user-password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
          />
        </Field>
      ) : null}
    </>
  )
}

function FormError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
      {message}
    </div>
  )
}
