import { CURRENT_SEMESTER } from './constants.ts'
import type {
  Activity,
  AttendanceEntry,
  AttendanceStatus,
  Documentation,
  Eskul,
  Grade,
  Permit,
  SeedData,
  Session,
  Student,
  User,
} from './types.ts'
import { addDaysISO, todayISO } from './utils.ts'

function localISO(offset: number) {
  return addDaysISO(offset)
}

function timestamp(date: string, time = '15:30') {
  return new Date(`${date}T${time}:00`).toISOString()
}

function makeAttendance(
  students: Student[],
  date: string,
  actorId: string,
  asSubstitute: boolean,
  sessionSeed: number,
): AttendanceEntry[] {
  return students.map((student, index) => {
    const value = index * 3 + sessionSeed * 5
    let status: AttendanceStatus = 'hadir'
    if (value % 23 === 0) status = 'alpa'
    else if (value % 11 === 0) status = 'sakit'
    else if (value % 7 === 0) status = 'izin'

    return {
      studentId: student.id,
      status,
      updatedBy: actorId,
      asSubstitute,
      updatedAt: timestamp(date),
    }
  })
}

const users: User[] = [
  {
    id: 'u-admin',
    name: 'Administrator SIMSKUL',
    email: 'admin@simskul.sch.id',
    role: 'admin',
    phone: '0811-0000-0001',
  },
  {
    id: 'u-pelatih-pramuka',
    name: 'Budi Santoso, S.Pd.',
    email: 'budi@simskul.sch.id',
    role: 'pelatih',
    eskulId: 'e-pramuka',
    phone: '0812-3456-7890',
  },
  {
    id: 'u-ketua-pramuka',
    name: 'Rani Puspita',
    email: 'rani@simskul.sch.id',
    role: 'ketua',
    eskulId: 'e-pramuka',
    phone: '0813-2211-3344',
  },
  {
    id: 'u-wakasek',
    name: 'Sari Wulandari, M.Pd.',
    email: 'sari@simskul.sch.id',
    role: 'wakasek',
    phone: '0811-9000-1122',
  },
  {
    id: 'u-pelatih-futsal',
    name: 'Andi Pratama, S.Or.',
    email: 'andi@simskul.sch.id',
    role: 'pelatih',
    eskulId: 'e-futsal',
    phone: '0812-7788-9900',
  },
  {
    id: 'u-ketua-futsal',
    name: 'Dimas Arya',
    email: 'dimas@simskul.sch.id',
    role: 'ketua',
    eskulId: 'e-futsal',
  },
  {
    id: 'u-pelatih-tari',
    name: 'Citra Lestari, S.Sn.',
    email: 'citra@simskul.sch.id',
    role: 'pelatih',
    eskulId: 'e-tari',
    phone: '0813-6655-4433',
  },
  {
    id: 'u-ketua-tari',
    name: 'Salsa Nabila',
    email: 'salsa@simskul.sch.id',
    role: 'ketua',
    eskulId: 'e-tari',
  },
]

const eskul: Eskul[] = [
  {
    id: 'e-pramuka',
    name: 'Pramuka',
    shortName: 'PRM',
    description:
      'Membentuk karakter mandiri, disiplin, dan peduli sesama melalui kegiatan kepramukaan, pionering, serta bakti sosial.',
    color: 'emerald',
    day: 'Sabtu',
    time: '08.00 – 10.00',
    location: 'Lapangan Utama',
    coachId: 'u-pelatih-pramuka',
    leaderId: 'u-ketua-pramuka',
    quota: 40,
  },
  {
    id: 'e-futsal',
    name: 'Futsal',
    shortName: 'FTS',
    description:
      'Wadah pengembangan bakat sepak bola ruang bagi siswa, dengan fokus pada teknik, taktik, kebugaran, dan sportivitas.',
    color: 'sky',
    day: 'Rabu',
    time: '15.30 – 17.00',
    location: 'Lapangan Futsal',
    coachId: 'u-pelatih-futsal',
    leaderId: 'u-ketua-futsal',
    quota: 20,
  },
  {
    id: 'e-tari',
    name: 'Seni Tari',
    shortName: 'TAR',
    description:
      'Mengembangkan kreativitas dan apresiasi seni melalui latihan gerak, koreografi, serta tampil di panggung sekolah dan lomba.',
    color: 'rose',
    day: 'Jumat',
    time: '14.00 – 16.00',
    location: 'Aula Serbaguna',
    coachId: 'u-pelatih-tari',
    leaderId: 'u-ketua-tari',
    quota: 25,
  },
]

const studentSeeds: Omit<Student, 'id' | 'active' | 'joinedAt'>[] = [
  { name: 'Rani Puspita', nis: '2026001', className: 'X IPA 1', gender: 'P', eskulId: 'e-pramuka' },
  { name: 'Bagas Saputra', nis: '2026002', className: 'X IPA 1', gender: 'L', eskulId: 'e-pramuka' },
  { name: 'Nadia Putri', nis: '2026003', className: 'X IPS 2', gender: 'P', eskulId: 'e-pramuka' },
  { name: 'Fajar Ramadhan', nis: '2026004', className: 'XI IPA 3', gender: 'L', eskulId: 'e-pramuka' },
  { name: 'Intan Permata', nis: '2026005', className: 'XI IPS 1', gender: 'P', eskulId: 'e-pramuka' },
  { name: 'Rifqi Hidayat', nis: '2026006', className: 'X IPA 2', gender: 'L', eskulId: 'e-pramuka' },
  { name: 'Laila Nuraini', nis: '2026007', className: 'XII IPA 1', gender: 'P', eskulId: 'e-pramuka' },
  { name: 'Yoga Pratama', nis: '2026008', className: 'XI IPA 2', gender: 'L', eskulId: 'e-pramuka' },

  { name: 'Dimas Arya', nis: '2026011', className: 'XI IPA 3', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Rio Febrian', nis: '2026012', className: 'X IPA 2', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Aditya Nugraha', nis: '2026013', className: 'XII IPS 1', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Bima Saputra', nis: '2026014', className: 'X IPS 1', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Galih Ramadhan', nis: '2026015', className: 'XI IPS 2', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Hafizh Alfarizi', nis: '2026016', className: 'X IPA 1', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Kevin Ardiansyah', nis: '2026017', className: 'XII IPA 2', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Reza Maulana', nis: '2026018', className: 'XI IPA 1', gender: 'L', eskulId: 'e-futsal' },

  { name: 'Salsa Nabila', nis: '2026021', className: 'XI IPS 1', gender: 'P', eskulId: 'e-tari' },
  { name: 'Anisa Rahma', nis: '2026022', className: 'X IPA 1', gender: 'P', eskulId: 'e-tari' },
  { name: 'Dinda Ayu Lestari', nis: '2026023', className: 'X IPS 2', gender: 'P', eskulId: 'e-tari' },
  { name: 'Kirana Maharani', nis: '2026024', className: 'XII IPA 1', gender: 'P', eskulId: 'e-tari' },
  { name: 'Melati Kusuma', nis: '2026025', className: 'XI IPA 2', gender: 'P', eskulId: 'e-tari' },
  { name: 'Zahra Aulia', nis: '2026026', className: 'X IPA 3', gender: 'P', eskulId: 'e-tari' },
]

const students: Student[] = studentSeeds.map((student, index) => ({
  ...student,
  id: `st-${String(index + 1).padStart(2, '0')}`,
  active: true,
  joinedAt: '2026-07-20',
}))

const pramuka = students.filter((s) => s.eskulId === 'e-pramuka')
const futsal = students.filter((s) => s.eskulId === 'e-futsal')
const tari = students.filter((s) => s.eskulId === 'e-tari')

const sessionSeeds: {
  id: string
  eskulId: string
  offset: number
  topic: string
  startTime: string
  endTime: string
  location: string
  coachPresent: boolean | null
  coachNote?: string
  filled: boolean
  filledBy: string
  asSubstitute: boolean
  sessionSeed: number
}[] = [
  {
    id: 's-pramuka-1',
    eskulId: 'e-pramuka',
    offset: -28,
    topic: 'Dasar Kepramukaan & Simpul',
    startTime: '08.00',
    endTime: '10.00',
    location: 'Lapangan Utama',
    coachPresent: true,
    filled: true,
    filledBy: 'u-pelatih-pramuka',
    asSubstitute: false,
    sessionSeed: 1,
  },
  {
    id: 's-pramuka-2',
    eskulId: 'e-pramuka',
    offset: -21,
    topic: 'Pionering & Tali Temali',
    startTime: '08.00',
    endTime: '10.00',
    location: 'Lapangan Utama',
    coachPresent: true,
    filled: true,
    filledBy: 'u-pelatih-pramuka',
    asSubstitute: false,
    sessionSeed: 2,
  },
  {
    id: 's-pramuka-3',
    eskulId: 'e-pramuka',
    offset: -14,
    topic: 'Pertolongan Pertama Dasar',
    startTime: '08.00',
    endTime: '10.00',
    location: 'Ruang UKS',
    coachPresent: true,
    filled: true,
    filledBy: 'u-pelatih-pramuka',
    asSubstitute: false,
    sessionSeed: 3,
  },
  {
    id: 's-pramuka-4',
    eskulId: 'e-pramuka',
    offset: -7,
    topic: 'Latihan Upacara Bendera',
    startTime: '08.00',
    endTime: '10.00',
    location: 'Lapangan Utama',
    coachPresent: false,
    coachNote: 'Ada tugas dinas luar kota. Presensi dititipkan ke ketua eskul.',
    filled: true,
    filledBy: 'u-ketua-pramuka',
    asSubstitute: true,
    sessionSeed: 4,
  },
  {
    id: 's-pramuka-5',
    eskulId: 'e-pramuka',
    offset: 0,
    topic: 'Persiapan Lomba Tingkat Kota',
    startTime: '08.00',
    endTime: '10.00',
    location: 'Lapangan Utama',
    coachPresent: false,
    coachNote: 'Sedang mendampingi rapat dinas. Rani tolong isi presensi ya.',
    filled: false,
    filledBy: 'u-ketua-pramuka',
    asSubstitute: true,
    sessionSeed: 5,
  },
  {
    id: 's-pramuka-6',
    eskulId: 'e-pramuka',
    offset: 7,
    topic: 'Evaluasi & Latihan Rutin',
    startTime: '08.00',
    endTime: '10.00',
    location: 'Lapangan Utama',
    coachPresent: null,
    filled: false,
    filledBy: 'u-pelatih-pramuka',
    asSubstitute: false,
    sessionSeed: 6,
  },

  {
    id: 's-futsal-1',
    eskulId: 'e-futsal',
    offset: -20,
    topic: 'Teknik Dasar & Passing',
    startTime: '15.30',
    endTime: '17.00',
    location: 'Lapangan Futsal',
    coachPresent: true,
    filled: true,
    filledBy: 'u-pelatih-futsal',
    asSubstitute: false,
    sessionSeed: 2,
  },
  {
    id: 's-futsal-2',
    eskulId: 'e-futsal',
    offset: -13,
    topic: 'Latihan Taktik dan Formasi',
    startTime: '15.30',
    endTime: '17.00',
    location: 'Lapangan Futsal',
    coachPresent: true,
    filled: true,
    filledBy: 'u-pelatih-futsal',
    asSubstitute: false,
    sessionSeed: 3,
  },
  {
    id: 's-futsal-3',
    eskulId: 'e-futsal',
    offset: -6,
    topic: 'Sparring Internal',
    startTime: '15.30',
    endTime: '17.00',
    location: 'Lapangan Futsal',
    coachPresent: true,
    filled: true,
    filledBy: 'u-pelatih-futsal',
    asSubstitute: false,
    sessionSeed: 4,
  },
  {
    id: 's-futsal-4',
    eskulId: 'e-futsal',
    offset: 2,
    topic: 'Persiapan Turnamen Antar Sekolah',
    startTime: '15.30',
    endTime: '17.00',
    location: 'Lapangan Futsal',
    coachPresent: null,
    filled: false,
    filledBy: 'u-pelatih-futsal',
    asSubstitute: false,
    sessionSeed: 5,
  },

  {
    id: 's-tari-1',
    eskulId: 'e-tari',
    offset: -18,
    topic: 'Latihan Gerak Dasar',
    startTime: '14.00',
    endTime: '16.00',
    location: 'Aula Serbaguna',
    coachPresent: true,
    filled: true,
    filledBy: 'u-pelatih-tari',
    asSubstitute: false,
    sessionSeed: 1,
  },
  {
    id: 's-tari-2',
    eskulId: 'e-tari',
    offset: -11,
    topic: 'Koreografi Tari Saman',
    startTime: '14.00',
    endTime: '16.00',
    location: 'Aula Serbaguna',
    coachPresent: true,
    filled: true,
    filledBy: 'u-pelatih-tari',
    asSubstitute: false,
    sessionSeed: 2,
  },
  {
    id: 's-tari-3',
    eskulId: 'e-tari',
    offset: -4,
    topic: 'Latihan Formasi & Ekspresi',
    startTime: '14.00',
    endTime: '16.00',
    location: 'Aula Serbaguna',
    coachPresent: false,
    coachNote: 'Sakit dan istirahat di rumah. Salsa mengambil alih presensi.',
    filled: true,
    filledBy: 'u-ketua-tari',
    asSubstitute: true,
    sessionSeed: 3,
  },
  {
    id: 's-tari-4',
    eskulId: 'e-tari',
    offset: 9,
    topic: 'Gladi Bersih Pentas Seni',
    startTime: '14.00',
    endTime: '16.00',
    location: 'Aula Serbaguna',
    coachPresent: null,
    filled: false,
    filledBy: 'u-pelatih-tari',
    asSubstitute: false,
    sessionSeed: 4,
  },
]

const sessions: Session[] = sessionSeeds.map((seed) => {
  const members =
    seed.eskulId === 'e-pramuka' ? pramuka : seed.eskulId === 'e-futsal' ? futsal : tari
  const date = localISO(seed.offset)

  return {
    id: seed.id,
    eskulId: seed.eskulId,
    date,
    startTime: seed.startTime,
    endTime: seed.endTime,
    location: seed.location,
    topic: seed.topic,
    notes:
      seed.coachPresent === null
        ? 'Sesi terjadwal. Pelatih belum mengonfirmasi kehadiran.'
        : undefined,
    coachPresent: seed.coachPresent,
    coachNote: seed.coachNote,
    attendance: seed.filled
      ? makeAttendance(members, date, seed.filledBy, seed.asSubstitute, seed.sessionSeed)
      : [],
    createdBy:
      seed.eskulId === 'e-pramuka'
        ? 'u-pelatih-pramuka'
        : seed.eskulId === 'e-futsal'
          ? 'u-pelatih-futsal'
          : 'u-pelatih-tari',
    createdAt: timestamp(localISO(seed.offset - 5), '09:00'),
  }
})

const grades: Grade[] = students
  .filter((student) => student.id !== 'st-07' && student.id !== 'st-08')
  .map((student, index) => {
    const base = 76 + ((index * 7) % 19)
    return {
      id: `grade-${student.id}-${CURRENT_SEMESTER.replaceAll(' ', '-')}`,
      studentId: student.id,
      semester: CURRENT_SEMESTER,
      keaktifan: Math.min(100, base + 2),
      sikap: Math.min(100, base + 4),
      keterampilan: Math.max(60, base - 3),
      note:
        index % 5 === 0
          ? 'Konsisten aktif dan menunjukkan peningkatan yang baik.'
          : undefined,
      updatedBy:
        student.eskulId === 'e-pramuka'
          ? 'u-pelatih-pramuka'
          : student.eskulId === 'e-futsal'
            ? 'u-pelatih-futsal'
            : 'u-pelatih-tari',
      updatedAt: timestamp(localISO(-3)),
    }
  })

const documentation: Documentation[] = [
  {
    id: 'doc-1',
    eskulId: 'e-pramuka',
    sessionId: 's-pramuka-4',
    title: 'Upacara Pembukaan Latihan',
    caption:
      'Anggota Pramuka berlatih formasi dan tata upacara sebelum mengikuti lomba tingkat kota.',
    imageUrl:
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
    date: localISO(-7),
    uploadedBy: 'u-ketua-pramuka',
    createdAt: timestamp(localISO(-7), '11:15'),
  },
  {
    id: 'doc-2',
    eskulId: 'e-pramuka',
    sessionId: 's-pramuka-2',
    title: 'Pionering & Tali Temali',
    caption:
      'Setiap regu menyelesaikan menara pionering sederhana. Kegiatan ditutup dengan evaluasi bersama.',
    imageUrl:
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80',
    date: localISO(-21),
    uploadedBy: 'u-pelatih-pramuka',
    createdAt: timestamp(localISO(-21), '10:30'),
  },
  {
    id: 'doc-3',
    eskulId: 'e-futsal',
    sessionId: 's-futsal-3',
    title: 'Sparring Internal',
    caption:
      'Uji coba antar tim inti dan pelapis. Fokus pada transisi bertahan ke menyerang.',
    imageUrl:
      'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
    date: localISO(-6),
    uploadedBy: 'u-pelatih-futsal',
    createdAt: timestamp(localISO(-6), '17:20'),
  },
  {
    id: 'doc-4',
    eskulId: 'e-futsal',
    sessionId: 's-futsal-2',
    title: 'Latihan Taktik dan Formasi',
    caption:
      'Pemain mempelajari pola 2-2 dan rotasi cepat. Latihan ditutup dengan sesi pendinginan.',
    imageUrl:
      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
    date: localISO(-13),
    uploadedBy: 'u-pelatih-futsal',
    createdAt: timestamp(localISO(-13), '17:05'),
  },
  {
    id: 'doc-5',
    eskulId: 'e-tari',
    sessionId: 's-tari-3',
    title: 'Latihan Formasi & Ekspresi',
    caption:
      'Penataan formasi panggung untuk pentas seni sekolah. Ketua eskul mendampingi penuh sesi ini.',
    imageUrl:
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=80',
    date: localISO(-4),
    uploadedBy: 'u-ketua-tari',
    createdAt: timestamp(localISO(-4), '16:10'),
  },
  {
    id: 'doc-6',
    eskulId: 'e-tari',
    sessionId: 's-tari-2',
    title: 'Koreografi Tari Saman',
    caption:
      'Latihan kekompakan gerak tangan dan tempo. Seluruh anggota tampil percaya diri.',
    imageUrl:
      'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=1200&q=80',
    date: localISO(-11),
    uploadedBy: 'u-pelatih-tari',
    createdAt: timestamp(localISO(-11), '16:25'),
  },
]

const permits: Permit[] = [
  {
    id: 'perm-1',
    eskulId: 'e-pramuka',
    type: 'lomba',
    title: 'Lomba Pramuka Tingkat Kota',
    description:
      'Mengikuti lomba pionering, cerdas cermat kepramukaan, dan pentas seni budaya. Kontingen terdiri dari 8 anggota dan 2 pembina pendamping.',
    startDate: localISO(14),
    endDate: localISO(16),
    location: 'Bumi Perkemahan Cibubur',
    status: 'disetujui',
    createdBy: 'u-pelatih-pramuka',
    createdAt: timestamp(localISO(-10), '08:20'),
    decidedBy: 'u-wakasek',
    decidedAt: timestamp(localISO(-8), '13:40'),
    decisionNote:
      'Disetujui. Pastikan surat izin orang tua dan daftar anggota terlampir sebelum keberangkatan.',
  },
  {
    id: 'perm-2',
    eskulId: 'e-futsal',
    type: 'lomba',
    title: 'Turnamen Futsal Antar Sekolah',
    description:
      'Mengikuti turnamen tahunan yang diikuti 16 sekolah. Tim terdiri dari 12 pemain dan 2 pelatih.',
    startDate: localISO(10),
    endDate: localISO(12),
    location: 'GOR Nusantara',
    status: 'diajukan',
    createdBy: 'u-pelatih-futsal',
    createdAt: timestamp(localISO(-2), '10:05'),
  },
  {
    id: 'perm-3',
    eskulId: 'e-tari',
    type: 'latihan',
    title: 'Latihan Tambahan Pentas Seni',
    description:
      'Latihan intensif menjelang Pentas Seni Sekolah. Dibutuhkan aula dan sound system sederhana selama tiga hari.',
    startDate: localISO(3),
    endDate: localISO(5),
    location: 'Aula Serbaguna',
    status: 'diajukan',
    createdBy: 'u-ketua-tari',
    createdAt: timestamp(localISO(-1), '14:30'),
  },
  {
    id: 'perm-4',
    eskulId: 'e-pramuka',
    type: 'fasilitas',
    title: 'Penggunaan Aula untuk Latihan',
    description: 'Latihan upacara membutuhkan ruang teduh karena cuaca tidak menentu.',
    startDate: localISO(-5),
    endDate: localISO(-4),
    location: 'Aula Serbaguna',
    status: 'ditolak',
    createdBy: 'u-pelatih-pramuka',
    createdAt: timestamp(localISO(-12), '09:10'),
    decidedBy: 'u-wakasek',
    decidedAt: timestamp(localISO(-10), '11:05'),
    decisionNote:
      'Ditolak karena aula sudah digunakan untuk kegiatan ujian praktik. Silakan gunakan lapangan utama.',
  },
  {
    id: 'perm-5',
    eskulId: 'e-futsal',
    type: 'kegiatan_luar',
    title: 'Uji Coba di Lapangan Merdeka',
    description: 'Uji coba lapangan menghadapi turnamen antar sekolah.',
    startDate: localISO(-20),
    endDate: localISO(-20),
    location: 'Lapangan Merdeka',
    status: 'selesai',
    createdBy: 'u-pelatih-futsal',
    createdAt: timestamp(localISO(-30), '13:00'),
    decidedBy: 'u-wakasek',
    decidedAt: timestamp(localISO(-28), '09:30'),
    decisionNote: 'Disetujui. Kegiatan telah dilaksanakan dengan baik.',
  },
  {
    id: 'perm-6',
    eskulId: 'e-tari',
    type: 'lomba',
    title: 'Festival Tari Tradisional Provinsi',
    description:
      'Mengirim satu tim tari untuk mewakili sekolah pada festival tari tradisional tingkat provinsi.',
    startDate: localISO(21),
    endDate: localISO(22),
    location: 'Taman Budaya Provinsi',
    status: 'disetujui',
    createdBy: 'u-ketua-tari',
    createdAt: timestamp(localISO(-3), '08:45'),
    decidedBy: 'u-wakasek',
    decidedAt: timestamp(localISO(-2), '15:10'),
    decisionNote: 'Disetujui. Koordinasikan transportasi dengan bagian kesiswaan.',
  },
]

const now = Date.now()
const activities: Activity[] = [
  {
    id: 'act-1',
    at: new Date(now - 35 * 60000).toISOString(),
    userId: 'u-pelatih-pramuka',
    action: 'Menandai pelatih berhalangan',
    detail: 'Pramuka · Persiapan Lomba Tingkat Kota hari ini',
  },
  {
    id: 'act-2',
    at: new Date(now - 2 * 3600000).toISOString(),
    userId: 'u-ketua-tari',
    action: 'Mengajukan perizinan',
    detail: 'Seni Tari · Latihan Tambahan Pentas Seni',
  },
  {
    id: 'act-3',
    at: new Date(now - 26 * 3600000).toISOString(),
    userId: 'u-pelatih-futsal',
    action: 'Mengajukan perizinan',
    detail: 'Futsal · Turnamen Futsal Antar Sekolah',
  },
  {
    id: 'act-4',
    at: new Date(now - 3 * 86400000).toISOString(),
    userId: 'u-pelatih-tari',
    action: 'Memperbarui nilai eskul',
    detail: 'Seni Tari · 6 anggota dinilai',
  },
  {
    id: 'act-5',
    at: new Date(now - 4 * 86400000).toISOString(),
    userId: 'u-ketua-tari',
    action: 'Mengunggah dokumentasi',
    detail: 'Seni Tari · Latihan Formasi & Ekspresi',
  },
  {
    id: 'act-6',
    at: new Date(now - 7 * 86400000).toISOString(),
    userId: 'u-ketua-pramuka',
    action: 'Mengisi presensi sebagai pengganti',
    detail: 'Pramuka · Latihan Upacara Bendera · 8 anggota',
  },
  {
    id: 'act-7',
    at: new Date(now - 8 * 86400000).toISOString(),
    userId: 'u-wakasek',
    action: 'Menyetujui perizinan',
    detail: 'Pramuka · Lomba Pramuka Tingkat Kota',
  },
]

export function createSeedData(): SeedData {
  return {
    users: structuredClone(users),
    eskul: structuredClone(eskul),
    students: structuredClone(students),
    sessions: structuredClone(sessions),
    grades: structuredClone(grades),
    documentation: structuredClone(documentation),
    permits: structuredClone(permits),
    activities: structuredClone(activities),
  }
}

export const DEMO_TODAY = todayISO()
