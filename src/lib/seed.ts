import { CURRENT_SEMESTER } from './constants.ts'
import { buildDefaultPermitLetter } from './permit-letter.ts'
import type {
  Achievement,
  Activity,
  AttendanceEntry,
  AttendanceStatus,
  Documentation,
  Eskul,
  EskulColor,
  Gender,
  Grade,
  Permit,
  SeedData,
  Session,
  StaffAttendanceEntry,
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

function makeStaffAttendance(
  eskul: Eskul | undefined,
  date: string,
  coachPresent: boolean | null,
  filled: boolean,
  filledBy: string,
  coachNote?: string,
): StaffAttendanceEntry[] {
  if (!eskul) return []
  const entries: StaffAttendanceEntry[] = []

  if (eskul.coachId && coachPresent !== null) {
    entries.push({
      userId: eskul.coachId,
      role: 'pelatih',
      status: coachPresent
        ? 'hadir'
        : coachNote?.toLowerCase().includes('sakit')
          ? 'sakit'
          : 'izin',
      note: coachNote,
      updatedBy: eskul.coachId,
      updatedAt: timestamp(date),
    })
  }

  if (eskul.leaderId && filled) {
    entries.push({
      userId: eskul.leaderId,
      role: 'ketua',
      status: 'hadir',
      updatedBy: filledBy,
      updatedAt: timestamp(date),
    })
  }

  return entries
}

const baseUsers: User[] = [
  {
    id: 'u-admin',
    name: 'Administrator SIMSKUL',
    email: 'admin@simskul.sch.id',
    role: 'admin',
    phone: '0811-0000-0001',
  },
  {
    id: 'u-wakasek',
    name: 'Dewi Kartika, M.Pd.',
    email: 'wakasek@simskul.sch.id',
    role: 'wakasek',
    phone: '0811-0000-0002',
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

const baseEskul: Eskul[] = [
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

interface ExtraEskulSeed {
  id: string
  name: string
  shortName: string
  description: string
  color: EskulColor
  day: string
  time: string
  location: string
  quota: number
  coach: { name: string; email: string; phone: string }
  leader: { name: string; email: string; phone: string }
  members: Array<[name: string, className: string, gender: Gender]>
}

/**
 * Eskul tambahan yang dipakai untuk melengkapi data demo.
 * ID-nya sengaja stabil agar migrasi database lama dapat menambahkan data
 * tanpa menduplikasi eskul yang sudah ada.
 */
const extraEskulSeeds: ExtraEskulSeed[] = [
  {
    id: 'e-andro-it',
    name: 'Andro-IT',
    shortName: 'AIT',
    description:
      'Mengembangkan keterampilan pemrograman Android, robotika dasar, dan literasi digital untuk mendukung kompetisi teknologi siswa.',
    color: 'sky',
    day: 'Senin',
    time: '15.00 – 17.00',
    location: 'Lab Komputer 1',
    quota: 30,
    coach: {
      name: 'Rizky Firmansyah, S.Kom.',
      email: 'pelatih.andro-it@simskul.sch.id',
      phone: '0812-1100-0001',
    },
    leader: {
      name: 'Aditya Putra Pratama',
      email: 'ketua.andro-it@simskul.sch.id',
      phone: '0813-2100-0001',
    },
    members: [
      ['Bagus Setiawan', '10 PPLG 1', 'L'],
      ['Nadia Safira', '10 PPLG 2', 'P'],
      ['Fikri Ramadhan', '11 PPLG 1', 'L'],
      ['Alya Putri', '11 TJKT 1', 'P'],
      ['Raka Saputra', '10 TJKT 2', 'L'],
      ['Intan Maharani', '12 PPLG 1', 'P'],
      ['Yusuf Hidayat', '11 PPLG 2', 'L'],
      ['Sinta Wulandari', '12 TJKT 1', 'P'],
    ],
  },
  {
    id: 'e-band',
    name: 'Band',
    shortName: 'BND',
    description:
      'Wadah bagi siswa yang hobi bermusik untuk berlatih bersama, mengaransemen lagu, dan tampil pada acara sekolah.',
    color: 'violet',
    day: 'Kamis',
    time: '15.00 – 17.00',
    location: 'Ruang Musik',
    quota: 25,
    coach: {
      name: 'Arief Maulana, S.Sn.',
      email: 'pelatih.band@simskul.sch.id',
      phone: '0812-1100-0002',
    },
    leader: {
      name: 'Nabila Ayu Safitri',
      email: 'ketua.band@simskul.sch.id',
      phone: '0813-2100-0002',
    },
    members: [
      ['Reza Pratama', '11 PPLG 1', 'L'],
      ['Melati Kusumawardani', '10 AKL 1', 'P'],
      ['Dika Saputra', '12 TJKT 1', 'L'],
      ['Rani Maharani', '11 PPLG 2', 'P'],
      ['Fajar Nugraha', '10 AXIO 1', 'L'],
      ['Cinta Ramadhani', '12 AKL 1', 'P'],
      ['Bima Aditya', '11 TJKT 2', 'L'],
      ['Zahra Amalia', '10 PPLG 1', 'P'],
    ],
  },
  {
    id: 'e-basket',
    name: 'Basket',
    shortName: 'BSK',
    description:
      'Melatih teknik dasar bola basket, strategi permainan, kebugaran, dan sportivitas melalui latihan rutin serta pertandingan.',
    color: 'amber',
    day: 'Selasa',
    time: '15.30 – 17.00',
    location: 'Lapangan Basket',
    quota: 20,
    coach: {
      name: 'Doni Setiawan, S.Or.',
      email: 'pelatih.basket@simskul.sch.id',
      phone: '0812-1100-0003',
    },
    leader: {
      name: 'Fahri Akbar',
      email: 'ketua.basket@simskul.sch.id',
      phone: '0813-2100-0003',
    },
    members: [
      ['Fahri Akbar', '11 PPLG 1', 'L'],
      ['Rizky Maulana', '12 TJKT 2', 'L'],
      ['Andika Pratama', '10 AXIO 1', 'L'],
      ['Gilang Saputra', '11 PPLG 3', 'L'],
      ['Dimas Kurniawan', '10 TJKT 1', 'L'],
      ['Arif Rahman', '12 PPLG 2', 'L'],
      ['Bayu Nugroho', '11 AKL 1', 'L'],
      ['Faris Abdillah', '10 PPLG 2', 'L'],
    ],
  },
  {
    id: 'e-badminton',
    name: 'Badminton',
    shortName: 'BDM',
    description:
      'Meningkatkan teknik pukulan, footwork, dan strategi bulu tangkis serta mempersiapkan anggota untuk kejuaraan sekolah dan kota.',
    color: 'sky',
    day: 'Senin',
    time: '14.00 – 16.00',
    location: 'GOR Sekolah',
    quota: 24,
    coach: {
      name: 'Hendra Wijaya, S.Pd.',
      email: 'pelatih.badminton@simskul.sch.id',
      phone: '0812-1100-0004',
    },
    leader: {
      name: 'Siti Aulia Rahma',
      email: 'ketua.badminton@simskul.sch.id',
      phone: '0813-2100-0004',
    },
    members: [
      ['Siti Aulia Rahma', '11 PPLG 2', 'P'],
      ['Kevin Saputra', '10 TJKT 1', 'L'],
      ['Dinda Ayu Safitri', '12 AKL 1', 'P'],
      ['Rio Firmansyah', '11 PPLG 1', 'L'],
      ['Kirana Amelia', '10 PPLG 3', 'P'],
      ['Hafizh Pratama', '12 TJKT 2', 'L'],
      ['Anisa Rahmawati', '11 AXIO 1', 'P'],
      ['Galih Saputra', '10 PPLG 1', 'L'],
    ],
  },
  {
    id: 'e-irma',
    name: 'IRMA',
    shortName: 'IRM',
    description:
      'Ikatan Remaja Masjid: membina akhlak, memperdalam ilmu keislaman, serta menggerakkan kegiatan sosial dan keagamaan di sekolah.',
    color: 'emerald',
    day: 'Jumat',
    time: '12.30 – 14.00',
    location: 'Masjid Sekolah',
    quota: 40,
    coach: {
      name: 'Ahmad Fauzi, S.Ag.',
      email: 'pelatih.irma@simskul.sch.id',
      phone: '0812-1100-0005',
    },
    leader: {
      name: 'Muhammad Rizal',
      email: 'ketua.irma@simskul.sch.id',
      phone: '0813-2100-0005',
    },
    members: [
      ['Muhammad Rizal', '11 PPLG 1', 'L'],
      ['Aisyah Nur Fadilah', '10 AKL 1', 'P'],
      ['Fauzan Ramadhan', '12 TJKT 1', 'L'],
      ['Zahra Nabila', '11 PPLG 2', 'P'],
      ['Ilham Maulana', '10 AXIO 1', 'L'],
      ['Salsabila Putri', '12 AKL 1', 'P'],
      ['Arif Hidayat', '11 TJKT 2', 'L'],
      ['Nabila Rahmawati', '10 PPLG 3', 'P'],
    ],
  },
  {
    id: 'e-jbm',
    name: 'JBM',
    shortName: 'JBM',
    description:
      'Jaringan Bisnis Muda: mengasah jiwa wirausaha, pemasaran digital, pengelolaan keuangan, dan praktik bisnis siswa.',
    color: 'amber',
    day: 'Rabu',
    time: '14.00 – 16.00',
    location: 'Ruang Kewirausahaan',
    quota: 30,
    coach: {
      name: 'Ratna Sari, S.E.',
      email: 'pelatih.jbm@simskul.sch.id',
      phone: '0812-1100-0006',
    },
    leader: {
      name: 'Dewi Anggraini',
      email: 'ketua.jbm@simskul.sch.id',
      phone: '0813-2100-0006',
    },
    members: [
      ['Dewi Anggraini', '12 AKL 1', 'P'],
      ['Raka Pratama', '11 PPLG 1', 'L'],
      ['Sinta Amelia', '10 AKL 1', 'P'],
      ['Fikri Maulana', '12 PPLG 2', 'L'],
      ['Putri Salsabila', '11 PPLG 3', 'P'],
      ['Andi Kurniawan', '10 TJKT 2', 'L'],
      ['Rina Wulandari', '11 AXIO 1', 'P'],
      ['Dafa Alfarizi', '10 PPLG 1', 'L'],
    ],
  },
  {
    id: 'e-karate',
    name: 'Karate',
    shortName: 'KRT',
    description:
      'Latihan bela diri karate untuk membangun disiplin, kebugaran, teknik dasar, dan kesiapan mengikuti kejuaraan.',
    color: 'rose',
    day: 'Sabtu',
    time: '10.00 – 12.00',
    location: 'Aula Serbaguna',
    quota: 25,
    coach: {
      name: 'Agus Salim, S.Pd.',
      email: 'pelatih.karate@simskul.sch.id',
      phone: '0812-1100-0007',
    },
    leader: {
      name: 'Bagas Dwi Nugroho',
      email: 'ketua.karate@simskul.sch.id',
      phone: '0813-2100-0007',
    },
    members: [
      ['Bagas Dwi Nugroho', '11 PPLG 1', 'L'],
      ['Rani Kusuma', '10 PPLG 2', 'P'],
      ['Fajar Setiawan', '12 TJKT 1', 'L'],
      ['Intan Sari', '11 AKL 1', 'P'],
      ['Yoga Aditya', '10 AXIO 1', 'L'],
      ['Laila Rahmawati', '11 PPLG 3', 'P'],
      ['Rifqi Maulana', '12 AKL 1', 'L'],
      ['Nadia Fitriani', '10 TJKT 2', 'P'],
    ],
  },
  {
    id: 'e-muay-thai',
    name: 'MuayThai',
    shortName: 'MTI',
    description:
      'Olahraga bela diri Muay Thai yang melatih kekuatan, kecepatan, teknik dasar, dan disiplin anggota.',
    color: 'rose',
    day: 'Sabtu',
    time: '13.00 – 15.00',
    location: 'Aula Serbaguna',
    quota: 20,
    coach: {
      name: 'Rudi Hartono',
      email: 'pelatih.muay-thai@simskul.sch.id',
      phone: '0812-1100-0008',
    },
    leader: {
      name: 'Arya Saputra',
      email: 'ketua.muay-thai@simskul.sch.id',
      phone: '0813-2100-0008',
    },
    members: [
      ['Arya Saputra', '11 PPLG 1', 'L'],
      ['Bima Pratama', '10 TJKT 1', 'L'],
      ['Citra Kirana', '12 AKL 1', 'P'],
      ['Galih Prakoso', '11 PPLG 2', 'L'],
      ['Hafizh Ramadhan', '10 PPLG 2', 'L'],
      ['Melati Anggraini', '11 TJKT 2', 'P'],
      ['Reza Fahlevi', '12 PPLG 1', 'L'],
      ['Zahra Anindya', '10 AXIO 1', 'P'],
    ],
  },
  {
    id: 'e-osis',
    name: 'OSIS',
    shortName: 'OSIS',
    description:
      'Organisasi Siswa Intra Sekolah: wadah kepemimpinan, organisasi, dan pelayanan siswa melalui program kerja sekolah.',
    color: 'sky',
    day: 'Jumat',
    time: '14.00 – 15.30',
    location: 'Ruang OSIS',
    quota: 30,
    coach: {
      name: 'Dewi Anggraeni, S.Pd.',
      email: 'pelatih.osis@simskul.sch.id',
      phone: '0812-1100-0009',
    },
    leader: {
      name: 'Raka Aditya',
      email: 'ketua.osis@simskul.sch.id',
      phone: '0813-2100-0009',
    },
    members: [
      ['Raka Aditya', '11 PPLG 1', 'L'],
      ['Nabila Putri', '12 AKL 1', 'P'],
      ['Fikri Ananda', '10 TJKT 2', 'L'],
      ['Alya Safira', '11 PPLG 2', 'P'],
      ['Dimas Prasetyo', '12 TJKT 1', 'L'],
      ['Salsabila Aulia', '10 PPLG 3', 'P'],
      ['Ilham Ramadhan', '11 AXIO 1', 'L'],
      ['Cinta Lestari', '12 PPLG 1', 'P'],
    ],
  },
  {
    id: 'e-padus',
    name: 'Padus',
    shortName: 'PDS',
    description:
      'Paduan Suara: melatih teknik vokal, harmoni, dan kekompakan untuk tampil pada upacara serta kompetisi sekolah.',
    color: 'violet',
    day: 'Selasa',
    time: '14.00 – 16.00',
    location: 'Ruang Musik',
    quota: 30,
    coach: {
      name: 'Yohanes Surya, S.Mus.',
      email: 'pelatih.padus@simskul.sch.id',
      phone: '0812-1100-0010',
    },
    leader: {
      name: 'Clara Anindya',
      email: 'ketua.padus@simskul.sch.id',
      phone: '0813-2100-0010',
    },
    members: [
      ['Clara Anindya', '11 PPLG 1', 'P'],
      ['Michael Jonathan', '12 TJKT 1', 'L'],
      ['Angelina Putri', '10 AKL 1', 'P'],
      ['Rafael Simbolon', '11 PPLG 2', 'L'],
      ['Debora Natalia', '12 AKL 1', 'P'],
      ['Gideon Pratama', '10 PPLG 1', 'L'],
      ['Maria Fransiska', '11 AXIO 1', 'P'],
      ['Samuel Hutapea', '10 TJKT 2', 'L'],
    ],
  },
  {
    id: 'e-paskibra',
    name: 'Paskibra',
    shortName: 'PASK',
    description:
      'Pasukan Pengibar Bendera: melatih kedisiplinan, baris-berbaris, dan ketahanan fisik untuk tugas upacara bendera.',
    color: 'rose',
    day: 'Jumat',
    time: '15.00 – 17.00',
    location: 'Lapangan Utama',
    quota: 30,
    coach: {
      name: 'Hadi Susanto',
      email: 'pelatih.paskibra@simskul.sch.id',
      phone: '0812-1100-0011',
    },
    leader: {
      name: 'Farhan Maulana',
      email: 'ketua.paskibra@simskul.sch.id',
      phone: '0813-2100-0011',
    },
    members: [
      ['Farhan Maulana', '11 PPLG 1', 'L'],
      ['Nadia Ramadhani', '12 TJKT 1', 'P'],
      ['Rizky Pratama', '10 PPLG 2', 'L'],
      ['Putri Aulia', '11 AKL 1', 'P'],
      ['Fajar Hidayat', '12 PPLG 1', 'L'],
      ['Intan Permatasari', '10 AXIO 1', 'P'],
      ['Bagas Setiawan', '11 TJKT 2', 'L'],
      ['Laila Safitri', '10 PPLG 3', 'P'],
    ],
  },
  {
    id: 'e-pencak-silat',
    name: 'Pencak Silat',
    shortName: 'PSL',
    description:
      'Melestarikan seni bela diri pencak silat, membina kedisiplinan, serta mempersiapkan anggota untuk festival dan kejuaraan.',
    color: 'emerald',
    day: 'Selasa',
    time: '15.30 – 17.30',
    location: 'Aula Serbaguna',
    quota: 25,
    coach: {
      name: 'Bambang Sutrisno',
      email: 'pelatih.pencak-silat@simskul.sch.id',
      phone: '0812-1100-0012',
    },
    leader: {
      name: 'Rani Oktaviani',
      email: 'ketua.pencak-silat@simskul.sch.id',
      phone: '0813-2100-0012',
    },
    members: [
      ['Rani Oktaviani', '11 PPLG 2', 'P'],
      ['Fikri Hidayat', '10 TJKT 1', 'L'],
      ['Sinta Nuraini', '12 AKL 1', 'P'],
      ['Andika Saputra', '11 PPLG 1', 'L'],
      ['Melati Puspita', '10 PPLG 3', 'P'],
      ['Raka Fadillah', '12 TJKT 2', 'L'],
      ['Aisyah Ramadhani', '11 AXIO 1', 'P'],
      ['Yoga Firmansyah', '10 PPLG 1', 'L'],
    ],
  },
  {
    id: 'e-pmr',
    name: 'PMR',
    shortName: 'PMR',
    description:
      'Palang Merah Remaja: membekali anggota dengan pertolongan pertama, kesehatan dasar, dan kegiatan kemanusiaan.',
    color: 'emerald',
    day: 'Kamis',
    time: '14.00 – 16.00',
    location: 'Ruang UKS',
    quota: 30,
    coach: {
      name: 'Maya Kusuma, S.Ked.',
      email: 'pelatih.pmr@simskul.sch.id',
      phone: '0812-1100-0013',
    },
    leader: {
      name: 'Anisa Fitriani',
      email: 'ketua.pmr@simskul.sch.id',
      phone: '0813-2100-0013',
    },
    members: [
      ['Anisa Fitriani', '11 PPLG 1', 'P'],
      ['Dimas Saputra', '10 TJKT 2', 'L'],
      ['Nadia Puspita', '12 AKL 1', 'P'],
      ['Fauzan Hidayat', '11 PPLG 2', 'L'],
      ['Salsabila Nuraini', '10 PPLG 1', 'P'],
      ['Rizky Ramadhan', '12 TJKT 1', 'L'],
      ['Intan Salsabila', '11 AKL 1', 'P'],
      ['Bagas Pratama', '10 AXIO 1', 'L'],
    ],
  },
  {
    id: 'e-volly',
    name: 'Volly',
    shortName: 'VOL',
    description:
      'Melatih teknik dasar bola voli, servis, smash, dan kerja sama tim untuk mengikuti turnamen antar sekolah.',
    color: 'sky',
    day: 'Kamis',
    time: '15.30 – 17.00',
    location: 'Lapangan Voli',
    quota: 24,
    coach: {
      name: 'Rahmat Hidayat, S.Or.',
      email: 'pelatih.volly@simskul.sch.id',
      phone: '0812-1100-0014',
    },
    leader: {
      name: 'Fajar Nugroho',
      email: 'ketua.volly@simskul.sch.id',
      phone: '0813-2100-0014',
    },
    members: [
      ['Fajar Nugroho', '11 PPLG 1', 'L'],
      ['Rani Puspitasari', '10 PPLG 2', 'P'],
      ['Andi Saputra', '12 TJKT 1', 'L'],
      ['Siti Nurhaliza', '11 AKL 1', 'P'],
      ['Bima Kurniawan', '10 TJKT 2', 'L'],
      ['Dewi Lestari', '12 PPLG 2', 'P'],
      ['Rizky Hidayat', '11 AXIO 1', 'L'],
      ['Nabila Zahra', '10 PPLG 3', 'P'],
    ],
  },
]

export const EXTRA_ESKUL_IDS = extraEskulSeeds.map((item) => item.id)

const extraEskul: Eskul[] = extraEskulSeeds.map((item) => ({
  id: item.id,
  name: item.name,
  shortName: item.shortName,
  description: item.description,
  color: item.color,
  day: item.day,
  time: item.time,
  location: item.location,
  coachId: `u-pelatih-${item.id.slice(2)}`,
  leaderId: `u-ketua-${item.id.slice(2)}`,
  quota: item.quota,
}))

const extraUsers: User[] = extraEskulSeeds.flatMap((item) => {
  const slug = item.id.slice(2)
  return [
    {
      id: `u-pelatih-${slug}`,
      name: item.coach.name,
      email: item.coach.email,
      role: 'pelatih' as const,
      eskulId: item.id,
      phone: item.coach.phone,
    },
    {
      id: `u-ketua-${slug}`,
      name: item.leader.name,
      email: item.leader.email,
      role: 'ketua' as const,
      eskulId: item.id,
      phone: item.leader.phone,
    },
  ]
})

const users: User[] = [...baseUsers, ...extraUsers]
const eskul: Eskul[] = [...baseEskul, ...extraEskul]

const baseStudentSeeds: Omit<Student, 'id' | 'active' | 'joinedAt'>[] = [
  { name: 'Rani Puspita', nis: '2026001', className: '10 PPLG 1', gender: 'P', eskulId: 'e-pramuka' },
  { name: 'Bagas Saputra', nis: '2026002', className: '10 PPLG 1', gender: 'L', eskulId: 'e-pramuka' },
  { name: 'Nadia Putri', nis: '2026003', className: '10 TJKT 1', gender: 'P', eskulId: 'e-pramuka' },
  { name: 'Fajar Ramadhan', nis: '2026004', className: '11 PPLG 2', gender: 'L', eskulId: 'e-pramuka' },
  { name: 'Intan Permata', nis: '2026005', className: '11 AKL 1', gender: 'P', eskulId: 'e-pramuka' },
  { name: 'Rifqi Hidayat', nis: '2026006', className: '10 AXIO 1', gender: 'L', eskulId: 'e-pramuka' },
  { name: 'Laila Nuraini', nis: '2026007', className: '12 AKL 1', gender: 'P', eskulId: 'e-pramuka' },
  { name: 'Yoga Pratama', nis: '2026008', className: '11 PPLG 1', gender: 'L', eskulId: 'e-pramuka' },

  { name: 'Dimas Arya', nis: '2026011', className: '11 PPLG 1', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Rio Febrian', nis: '2026012', className: '10 TJKT 2', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Aditya Nugraha', nis: '2026013', className: '12 TJKT 1', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Bima Saputra', nis: '2026014', className: '10 AXIO 1', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Galih Ramadhan', nis: '2026015', className: '11 TJKT 1', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Hafizh Alfarizi', nis: '2026016', className: '11 PPLG 3', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Kevin Ardiansyah', nis: '2026017', className: '12 PPLG 1', gender: 'L', eskulId: 'e-futsal' },
  { name: 'Reza Maulana', nis: '2026018', className: '11 AXIO 1', gender: 'L', eskulId: 'e-futsal' },

  { name: 'Salsa Nabila', nis: '2026021', className: '11 AKL 1', gender: 'P', eskulId: 'e-tari' },
  { name: 'Anisa Rahma', nis: '2026022', className: '10 PPLG 2', gender: 'P', eskulId: 'e-tari' },
  { name: 'Dinda Ayu Lestari', nis: '2026023', className: '10 AKL 1', gender: 'P', eskulId: 'e-tari' },
  { name: 'Kirana Maharani', nis: '2026024', className: '12 PPLG 2', gender: 'P', eskulId: 'e-tari' },
  { name: 'Melati Kusuma', nis: '2026025', className: '11 TJKT 2', gender: 'P', eskulId: 'e-tari' },
  { name: 'Zahra Aulia', nis: '2026026', className: '12 AXIO 1', gender: 'P', eskulId: 'e-tari' },
]

const extraStudentSeeds: Omit<Student, 'id' | 'active' | 'joinedAt'>[] =
  extraEskulSeeds.flatMap((item, eskulIndex) =>
    item.members.map(([name, className, gender], memberIndex) => ({
      name,
      nis: String(2026101 + eskulIndex * 10 + memberIndex),
      className,
      gender,
      eskulId: item.id,
    })),
  )

const studentSeeds = [...baseStudentSeeds, ...extraStudentSeeds]

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
  const eskulData = eskul.find((item) => item.id === seed.eskulId)

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
    staffAttendance: makeStaffAttendance(
      eskulData,
      date,
      seed.coachPresent,
      seed.filled,
      seed.filledBy,
      seed.coachNote,
    ),
    createdBy:
      seed.eskulId === 'e-pramuka'
        ? 'u-pelatih-pramuka'
        : seed.eskulId === 'e-futsal'
          ? 'u-pelatih-futsal'
          : 'u-pelatih-tari',
    createdAt: timestamp(localISO(seed.offset - 5), '09:00'),
  }
})

const coachByEskul = new Map(eskul.map((item) => [item.id, item.coachId]))

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
      updatedBy: coachByEskul.get(student.eskulId) ?? 'u-admin',
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

const permitSeeds: Permit[] = [
  {
    id: 'perm-1',
    eskulId: 'e-pramuka',
    type: 'lomba',
    title: 'Lomba Pramuka Tingkat Kota',
    description:
      'Mengikuti lomba pionering, cerdas cermat kepramukaan, dan pentas seni budaya. Kontingen terdiri dari 8 anggota dan 2 pembina pendamping.',
    startDate: localISO(14),
    endDate: localISO(16),
    startTime: '08:00',
    endTime: '16:00',
    location: 'Bumi Perkemahan Cibubur',
    status: 'disetujui',
    createdBy: 'u-pelatih-pramuka',
    createdAt: timestamp(localISO(-10), '08:20'),
    decidedBy: 'u-admin',
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
    startTime: '09:00',
    endTime: '15:00',
    location: 'Aula SMK BPPI',
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
    startTime: '14:00',
    endTime: '17:00',
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
    startTime: '08:00',
    endTime: '10:00',
    location: 'Aula Serbaguna',
    status: 'ditolak',
    createdBy: 'u-pelatih-pramuka',
    createdAt: timestamp(localISO(-12), '09:10'),
    decidedBy: 'u-admin',
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
    startTime: '07:00',
    endTime: '17:00',
    location: 'Lapangan Merdeka',
    status: 'selesai',
    createdBy: 'u-pelatih-futsal',
    createdAt: timestamp(localISO(-30), '13:00'),
    decidedBy: 'u-admin',
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
    startTime: '08:00',
    endTime: '17:00',
    location: 'Taman Budaya Provinsi',
    status: 'disetujui',
    createdBy: 'u-ketua-tari',
    createdAt: timestamp(localISO(-3), '08:45'),
    decidedBy: 'u-admin',
    decidedAt: timestamp(localISO(-2), '15:10'),
    decisionNote: 'Disetujui. Koordinasikan transportasi dengan bagian kesiswaan.',
  },
]

const permitOrder = [...permitSeeds].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

const permits: Permit[] = permitSeeds.map((permit) => {
  const eskulData = eskul.find((item) => item.id === permit.eskulId)
  const leader = users.find((user) => user.id === eskulData?.leaderId)
  const participantCount = students.filter(
    (student) => student.eskulId === permit.eskulId && student.active,
  ).length

  return {
    ...permit,
    letter: buildDefaultPermitLetter({
      permit,
      eskul: eskulData,
      leader,
      participantCount,
      sequence: permitOrder.findIndex((item) => item.id === permit.id) + 1,
    }),
  }
})

const achievements: Achievement[] = [
  {
    id: 'ach-1',
    eskulId: 'e-pramuka',
    title: 'Juara 2 Lomba Pionering',
    event: 'Lomba Pramuka Tingkat Kota',
    level: 'kota',
    rank: 'juara_2',
    date: localISO(-18),
    participants: 'Regu Garuda: Bagas Saputra, Fajar Ramadhan, Rifqi Hidayat',
    description:
      'Regu Garuda menyelesaikan menara pionering tercepat kedua dengan simpul dan ikatan yang rapi.',
    createdBy: 'u-pelatih-pramuka',
    createdAt: timestamp(localISO(-18), '16:10'),
  },
  {
    id: 'ach-2',
    eskulId: 'e-futsal',
    title: 'Juara 1 Turnamen Futsal Antar Sekolah',
    event: 'Turnamen Futsal Kecamatan',
    level: 'kecamatan',
    rank: 'juara_1',
    date: localISO(-42),
    participants: 'Tim Inti Futsal: Dimas Arya, Rio Febrian, Aditya Nugraha, Bima Saputra',
    description:
      'Tim inti menang 4–2 pada laga final dan mencatatkan clean sheet di dua pertandingan sebelumnya.',
    createdBy: 'u-pelatih-futsal',
    createdAt: timestamp(localISO(-42), '17:30'),
  },
  {
    id: 'ach-3',
    eskulId: 'e-tari',
    title: 'Juara 3 Festival Tari Tradisional',
    event: 'Festival Tari Tradisional Provinsi',
    level: 'provinsi',
    rank: 'juara_3',
    date: localISO(-76),
    participants: 'Tim Tari Saman: Salsa Nabila, Anisa Rahma, Dinda Ayu Lestari, Kirana Maharani',
    description:
      'Penampilan Tari Saman mendapat apresiasi tinggi dari dewan juri karena kekompakan dan ekspresi.',
    createdBy: 'u-pelatih-tari',
    createdAt: timestamp(localISO(-76), '20:15'),
  },
  {
    id: 'ach-4',
    eskulId: 'e-futsal',
    title: 'Harapan 1 Futsal Pelajar',
    event: 'Kejuaraan Futsal Pelajar Kota',
    level: 'kota',
    rank: 'harapan_1',
    date: localISO(-120),
    participants: 'Tim Futsal Putra',
    description: 'Menembus babak semifinal dan meraih posisi harapan pertama pada kejuaraan kota.',
    createdBy: 'u-pelatih-futsal',
    createdAt: timestamp(localISO(-120), '18:45'),
  },
  {
    id: 'ach-5',
    eskulId: 'e-pramuka',
    title: 'Peserta Terbaik Jambore Daerah',
    event: 'Jambore Pramuka Daerah',
    level: 'provinsi',
    rank: 'peserta',
    date: localISO(-210),
    participants: 'Kontingen Pramuka SMK BPPI',
    description:
      'Kontingen mengikuti seluruh rangkaian kegiatan dan meraih penghargaan regu disiplin terbaik.',
    createdBy: 'u-pelatih-pramuka',
    createdAt: timestamp(localISO(-210), '14:20'),
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
    userId: 'u-admin',
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
    achievements: structuredClone(achievements),
    activities: structuredClone(activities),
  }
}

export const DEMO_TODAY = todayISO()
