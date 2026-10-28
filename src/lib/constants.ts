import type { AttendanceStatus, PermitStatus, PermitType, Role } from './types.ts'

export const CURRENT_SEMESTER = 'Ganjil 2026/2027'

export const SEMESTER_OPTIONS = ['Ganjil 2026/2027', 'Genap 2025/2026', 'Ganjil 2025/2026']

export const ACADEMIC_YEAR = '2026/2027'

export const SCHOOL_NAME = 'SMK BPPI'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  pelatih: 'Pelatih Eskul',
  ketua: 'Ketua Eskul',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Kelola seluruh eskul, akun pengguna, persetujuan izin, dan pemeliharaan data sistem.',
  pelatih: 'Kelola presensi, nilai, dokumentasi, dan perizinan eskul yang Anda bina.',
  ketua: 'Bantu pelatih mengelola eskul. Presensi terbuka saat pelatih berhalangan.',
}

export const WEEKDAY_OPTIONS = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
] as const

export const ATTENDANCE_META: Record<
  AttendanceStatus,
  { label: string; short: string; badge: string; button: string; dot: string }
> = {
  hadir: {
    label: 'Hadir',
    short: 'H',
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25',
    button:
      'data-[active=true]:bg-emerald-600 data-[active=true]:text-white data-[active=true]:border-emerald-600',
    dot: 'bg-emerald-500',
  },
  izin: {
    label: 'Izin',
    short: 'I',
    badge:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/25',
    button: 'data-[active=true]:bg-sky-600 data-[active=true]:text-white data-[active=true]:border-sky-600',
    dot: 'bg-sky-500',
  },
  sakit: {
    label: 'Sakit',
    short: 'S',
    badge:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25',
    button:
      'data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:border-amber-500',
    dot: 'bg-amber-500',
  },
  alpa: {
    label: 'Alpa',
    short: 'A',
    badge:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25',
    button: 'data-[active=true]:bg-rose-600 data-[active=true]:text-white data-[active=true]:border-rose-600',
    dot: 'bg-rose-500',
  },
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['hadir', 'izin', 'sakit', 'alpa']

export const PERMIT_STATUS_META: Record<
  PermitStatus,
  { label: string; badge: string; dot: string; description: string }
> = {
  diajukan: {
    label: 'Menunggu',
    badge:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25',
    dot: 'bg-amber-500',
    description: 'Menunggu keputusan administrator',
  },
  disetujui: {
    label: 'Disetujui',
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25',
    dot: 'bg-emerald-500',
    description: 'Kegiatan disetujui dan dapat dilaksanakan',
  },
  ditolak: {
    label: 'Ditolak',
    badge:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25',
    dot: 'bg-rose-500',
    description: 'Pengajuan tidak disetujui',
  },
  selesai: {
    label: 'Selesai',
    badge:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/25',
    dot: 'bg-slate-400',
    description: 'Kegiatan telah selesai dilaksanakan',
  },
}

export const PERMIT_STATUSES: PermitStatus[] = ['diajukan', 'disetujui', 'ditolak', 'selesai']

export const PERMIT_TYPE_LABELS: Record<PermitType, string> = {
  lomba: 'Lomba / Kompetisi',
  latihan: 'Latihan Tambahan',
  kegiatan_luar: 'Kegiatan di Luar Sekolah',
  fasilitas: 'Penggunaan Fasilitas',
  lainnya: 'Lainnya',
}

export const GRADE_WEIGHTS = {
  keaktifan: 0.4,
  sikap: 0.3,
  keterampilan: 0.3,
} as const
