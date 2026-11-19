import {
  ArrowRight,
  Award,
  CalendarCheck2,
  Dumbbell,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  GraduationCap,
  Image,
  Loader2,
  LockKeyhole,
  Mail,
  Moon,
  Sparkles,
  Sun,
  UserCog,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/shared/brand'
import { Field } from '@/components/shared/field'
import { useTheme } from '@/hooks/use-theme'
import { apiErrorMessage, isDemoMode } from '@/lib/api'
import { ACADEMIC_YEAR, SCHOOL_NAME } from '@/lib/constants'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { Role } from '@/lib/types'
import { cn, firstName } from '@/lib/utils'

const roleVisuals: Record<Role, { icon: typeof Dumbbell; className: string }> = {
  admin: {
    icon: UserCog,
    className:
      'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  },
  pelatih: {
    icon: Dumbbell,
    className:
      'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  },
  ketua: {
    icon: Users,
    className:
      'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  },
  wakasek: {
    icon: FileSignature,
    className:
      'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  },
}

const demoAccounts: {
  role: Role
  name: string
  email: string
  password: string
  description: string
}[] = [
  {
    role: 'admin',
    name: 'Administrator SIMSKUL',
    email: 'admin@simskul.sch.id',
    password: 'admin123',
    description: 'Kelola eskul, pengguna, dan persetujuan izin',
  },
  {
    role: 'pelatih',
    name: 'Budi Santoso, S.Pd.',
    email: 'budi@simskul.sch.id',
    password: 'simskul123',
    description: 'Kelola Pramuka: presensi, nilai, dokumentasi',
  },
  {
    role: 'ketua',
    name: 'Rani Puspita',
    email: 'rani@simskul.sch.id',
    password: 'simskul123',
    description: 'Bantu pelatih dan isi presensi pengganti',
  },
  {
    role: 'wakasek',
    name: 'Dewi Kartika, M.Pd.',
    email: 'wakasek@simskul.sch.id',
    password: 'simskul123',
    description: 'Tinjau dan cetak surat izin kegiatan',
  },
]

export function LoginPage() {
  const user = useCurrentUser()
  const login = useAppStore((state) => state.login)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to="/" replace />

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setSubmitting(true)
    setError(null)
    try {
      await login(loginEmail, loginPassword)
      toast.success('Berhasil masuk', {
        description: `Selamat datang kembali di SIMSKUL.`,
      })
      navigate('/', { replace: true })
    } catch (loginError) {
      setError(apiErrorMessage(loginError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Email dan kata sandi wajib diisi.')
      return
    }
    void doLogin(email.trim(), password)
  }

  const handleQuickLogin = (account: (typeof demoAccounts)[number]) => {
    setEmail(account.email)
    setPassword(account.password)
    void doLogin(account.email, account.password)
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.04fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="grid-pattern absolute inset-0 opacity-60" />
        <div className="absolute -left-24 top-1/4 size-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-20 right-0 size-96 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="absolute right-10 top-10 size-40 rounded-full border border-white/10" />
        <div className="absolute right-24 top-24 size-2 rounded-full bg-amber-400" />

        <div className="relative z-10 flex items-center justify-between">
          <Logo inverted size="lg" subtitle="Sistem Informasi Manajemen Eskul" />
        </div>

        <div className="relative z-10 my-auto max-w-xl py-10">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-100 backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            {SCHOOL_NAME} · TA {ACADEMIC_YEAR}
          </p>
          <h1 className="text-balance font-display text-[42px] font-extrabold leading-[1.08] tracking-[-0.03em] xl:text-[52px]">
            Satu tempat untuk semua{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-emerald-300 bg-clip-text text-transparent">
              kegiatan eskul
            </span>
            .
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-emerald-100/70">
            Satu aplikasi untuk mengelola seluruh kegiatan ekstrakurikuler SMK BPPI — dari
            presensi sesi, penilaian, dokumentasi, hingga laporan semester — agar kesiswaan
            lebih tertib dan terdokumentasi.
          </p>

          <div className="mt-9 grid max-w-md grid-cols-2 gap-3">
            {[
              { value: '4', label: 'Peran pengguna' },
              { value: '3', label: 'Eskul aktif' },
              { value: '4', label: 'Jurusan' },
              { value: '10–12', label: 'Tingkat kelas' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3.5 backdrop-blur"
              >
                <p className="text-2xl font-extrabold tracking-tight text-white">{stat.value}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-100/50">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            {[
              {
                icon: CalendarCheck2,
                text: 'Presensi sesi eskul dan delegasi otomatis ke ketua saat pelatih berhalangan',
              },
              {
                icon: Award,
                text: 'Penilaian keaktifan, sikap, dan keterampilan untuk tiap anggota',
              },
              {
                icon: Image,
                text: 'Dokumentasi kegiatan tersusun rapi dalam galeri per eskul',
              },
              {
                icon: FileText,
                text: 'Laporan kehadiran, nilai, dan surat izin siap diekspor',
              },
            ].map((feature) => {
              const FeatureIcon = feature.icon
              return (
                <div key={feature.text} className="flex items-center gap-3 text-sm text-emerald-50/85">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                    <FeatureIcon className="size-3.5" />
                  </span>
                  {feature.text}
                </div>
              )
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/50">
              Didukung untuk jurusan:
            </span>
            {['PPLG', 'TJKT', 'AKL', 'AXIO'].map((major) => (
              <span
                key={major}
                className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/80 backdrop-blur"
              >
                {major}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-emerald-100/40">
          <p>© 2026 SIMSKUL</p>
          <p className="flex items-center gap-1.5">
            <GraduationCap className="size-3.5" />
            Dibangun untuk kesiswaan yang lebih rapi
          </p>
        </div>
      </div>

      <div className="relative flex min-h-dvh flex-col overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-emerald-100/60 blur-3xl dark:bg-emerald-500/5" />
        <div className="absolute -bottom-32 -left-24 size-80 rounded-full bg-amber-100/50 blur-3xl dark:bg-amber-500/5" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="iconSm" onClick={toggleTheme} aria-label="Ubah tema">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>

        <div className="relative z-10 my-auto mx-auto w-full max-w-[480px] py-10">
          <div className="mb-7">
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <CalendarCheck2 className="size-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              Masuk ke SIMSKUL
            </p>
            <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-foreground">
              Selamat datang kembali
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {isDemoMode
                ? 'Mode demo dengan data contoh di browser. Perubahan tidak tersimpan permanen.'
                : 'Gunakan email dan kata sandi akun Anda. Data tersimpan di database server.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" htmlFor="login-email" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@simskul.sch.id"
                  autoComplete="username"
                  className="pl-10"
                  autoFocus
                  disabled={submitting}
                />
              </div>
            </Field>

            <Field label="Kata sandi" htmlFor="login-password" required>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  className="pl-10 pr-11"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
              {submitting ? 'Memeriksa akun...' : 'Masuk ke SIMSKUL'}
            </Button>
          </form>

          <div className="mt-7">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                Akun demo
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {demoAccounts.map((account) => {
                const visual = roleVisuals[account.role]
                const Icon = visual.icon
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => handleQuickLogin(account)}
                    disabled={submitting}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-xl border border-border/80 bg-card p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-60',
                      account.role === 'admin' && 'border-amber-200/80 bg-amber-50/30 dark:border-amber-500/20 dark:bg-amber-500/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl ring-1',
                        visual.className,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold text-foreground">
                        {firstName(account.name)}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] text-muted-foreground">
                        {account.description}
                      </span>
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                )
              })}
            </div>

            <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
              <Sparkles className="mt-0.5 size-3 shrink-0 text-amber-500" />
              Klik kartu demo untuk langsung masuk. Akun admin: admin@simskul.sch.id dengan kata
              sandi admin123. Akun demo lain memakai kata sandi simskul123.
            </p>
          </div>

          <div className="mt-7 border-t border-border/70 pt-5 text-right text-[11px] text-muted-foreground/60">
            SIMSKUL v1.1
          </div>
        </div>

        <p className="relative z-10 mx-auto w-full max-w-[480px] text-center text-[10px] text-muted-foreground/70">
          Jangan gunakan kata sandi demo untuk data sekolah yang sebenarnya. Ganti kata sandi
          melalui menu administrator setelah masuk.
        </p>
      </div>
    </div>
  )
}
