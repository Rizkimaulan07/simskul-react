import type {
  AchievementLevel,
  AchievementRank,
  AttendanceStatus,
  PermitStatus,
  PermitType,
  Role,
} from './types.ts'

export const CURRENT_SEMESTER = 'Ganjil 2026/2027'

export const SEMESTER_OPTIONS = ['Ganjil 2026/2027', 'Genap 2025/2026', 'Ganjil 2025/2026']

export const ACADEMIC_YEAR = '2026/2027'

export const SCHOOL_NAME = 'SMK BPPI'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  pelatih: 'Pelatih Eskul',
  ketua: 'Ketua Eskul',
  wakasek: 'Wakasek Kesiswaan',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Kelola seluruh eskul, akun pengguna, persetujuan surat izin, dan pemeliharaan data sistem.',
  pelatih: 'Kelola presensi, nilai, dokumentasi, dan surat izin eskul yang Anda bina.',
  ketua: 'Bantu pelatih mengelola eskul. Presensi terbuka saat pelatih berhalangan.',
  wakasek:
    'Tinjau, cetak, dan mintakan tanda tangan surat izin kegiatan yang telah disetujui administrator.',
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

export const ACHIEVEMENT_LEVELS: AchievementLevel[] = [
  'sekolah',
  'kecamatan',
  'kota',
  'provinsi',
  'nasional',
  'internasional',
]

export const ACHIEVEMENT_LEVEL_META: Record<
  AchievementLevel,
  { label: string; badge: string; gradient: string; dot: string }
> = {
  sekolah: {
    label: 'Tingkat Sekolah',
    badge:
      'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-500/25 dark:bg-slate-500/10 dark:text-slate-300',
    gradient: 'from-slate-500 to-slate-700',
    dot: 'bg-slate-400',
  },
  kecamatan: {
    label: 'Tingkat Kecamatan',
    badge:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300',
    gradient: 'from-sky-500 to-blue-700',
    dot: 'bg-sky-500',
  },
  kota: {
    label: 'Tingkat Kota',
    badge:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
    gradient: 'from-emerald-500 to-teal-700',
    dot: 'bg-emerald-500',
  },
  provinsi: {
    label: 'Tingkat Provinsi',
    badge:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300',
    gradient: 'from-violet-500 to-purple-700',
    dot: 'bg-violet-500',
  },
  nasional: {
    label: 'Tingkat Nasional',
    badge:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
    gradient: 'from-amber-500 to-orange-600',
    dot: 'bg-amber-500',
  },
  internasional: {
    label: 'Tingkat Internasional',
    badge:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300',
    gradient: 'from-rose-500 to-pink-700',
    dot: 'bg-rose-500',
  },
}

export const ACHIEVEMENT_RANKS: AchievementRank[] = [
  'juara_1',
  'juara_2',
  'juara_3',
  'harapan_1',
  'harapan_2',
  'harapan_3',
  'peserta',
]

export const ACHIEVEMENT_RANK_META: Record<
  AchievementRank,
  { label: string; short: string; badge: string }
> = {
  juara_1: {
    label: 'Juara 1',
    short: '1',
    badge:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  },
  juara_2: {
    label: 'Juara 2',
    short: '2',
    badge:
      'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-500/25 dark:bg-slate-500/10 dark:text-slate-300',
  },
  juara_3: {
    label: 'Juara 3',
    short: '3',
    badge:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300',
  },
  harapan_1: {
    label: 'Harapan 1',
    short: 'H1',
    badge:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300',
  },
  harapan_2: {
    label: 'Harapan 2',
    short: 'H2',
    badge:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300',
  },
  harapan_3: {
    label: 'Harapan 3',
    short: 'H3',
    badge:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300',
  },
  peserta: {
    label: 'Peserta',
    short: 'P',
    badge:
      'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-500/25 dark:bg-slate-500/10 dark:text-slate-300',
  },
}
