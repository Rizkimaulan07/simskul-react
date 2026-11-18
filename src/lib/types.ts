export type Role = 'admin' | 'pelatih' | 'ketua' | 'wakasek'

export type EskulColor = 'emerald' | 'sky' | 'rose' | 'amber' | 'violet'

export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alpa'

export type PermitStatus = 'diajukan' | 'disetujui' | 'ditolak' | 'selesai'

export type PermitType = 'lomba' | 'latihan' | 'kegiatan_luar' | 'fasilitas' | 'lainnya'

export type Gender = 'L' | 'P'

export type AchievementLevel =
  | 'sekolah'
  | 'kecamatan'
  | 'kota'
  | 'provinsi'
  | 'nasional'
  | 'internasional'

export type AchievementRank =
  | 'juara_1'
  | 'juara_2'
  | 'juara_3'
  | 'harapan_1'
  | 'harapan_2'
  | 'harapan_3'
  | 'peserta'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  eskulId?: string
  phone?: string
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Eskul {
  id: string
  name: string
  shortName: string
  description: string
  color: EskulColor
  day: string
  time: string
  location: string
  coachId: string
  leaderId: string
  quota: number
  logoUrl?: string
}

export interface Student {
  id: string
  name: string
  nis: string
  className: string
  gender: Gender
  eskulId: string
  active: boolean
  joinedAt: string
}

export interface AttendanceEntry {
  studentId: string
  status: AttendanceStatus
  note?: string
  updatedBy: string
  asSubstitute: boolean
  updatedAt: string
}

export type StaffRole = 'pelatih' | 'ketua'

export interface StaffAttendanceEntry {
  userId: string
  role: StaffRole
  status: AttendanceStatus
  note?: string
  updatedBy: string
  updatedAt: string
}

export interface Session {
  id: string
  eskulId: string
  date: string
  startTime: string
  endTime: string
  location: string
  topic: string
  notes?: string
  coachPresent: boolean | null
  coachNote?: string
  attendance: AttendanceEntry[]
  staffAttendance: StaffAttendanceEntry[]
  createdBy: string
  createdAt: string
}

export interface Grade {
  id: string
  studentId: string
  semester: string
  keaktifan: number | null
  sikap: number | null
  keterampilan: number | null
  note?: string
  updatedBy: string
  updatedAt: string
}

export interface Documentation {
  id: string
  eskulId: string
  sessionId?: string
  title: string
  caption: string
  imageUrl: string
  date: string
  uploadedBy: string
  createdAt: string
}

export interface PermitLetter {
  number: string
  place: string
  date: string
  recipient: string
  subject: string
  body: string
  participantCount: number | null
  attachments?: string
  signerName: string
  signerRole: string
  updatedBy: string
  updatedAt: string
}

export type PermitLetterInput = Omit<PermitLetter, 'updatedBy' | 'updatedAt'>

export interface Permit {
  id: string
  eskulId: string
  type: PermitType
  title: string
  description: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  location: string
  status: PermitStatus
  createdBy: string
  createdAt: string
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
  letter?: PermitLetter
}

export interface Achievement {
  id: string
  eskulId: string
  title: string
  event: string
  level: AchievementLevel
  rank: AchievementRank
  date: string
  participants: string
  description?: string
  createdBy: string
  createdAt: string
}

export interface NewAchievementInput {
  eskulId: string
  title: string
  event: string
  level: AchievementLevel
  rank: AchievementRank
  date: string
  participants: string
  description?: string
}

export interface Activity {
  id: string
  at: string
  userId: string
  action: string
  detail: string
}

export interface NewSessionInput {
  eskulId: string
  date: string
  startTime: string
  endTime: string
  location: string
  topic: string
  notes?: string
  createdBy: string
}

export interface NewPermitInput {
  eskulId: string
  type: PermitType
  title: string
  description: string
  startDate: string
  endDate: string
  location: string
  createdBy: string
}

export interface NewStudentInput {
  name: string
  nis: string
  className: string
  gender: Gender
  eskulId: string
}

export interface NewDocumentationInput {
  eskulId: string
  sessionId?: string
  title: string
  caption: string
  imageUrl: string
  date: string
  uploadedBy: string
}

export interface SeedData {
  users: User[]
  eskul: Eskul[]
  students: Student[]
  sessions: Session[]
  grades: Grade[]
  documentation: Documentation[]
  permits: Permit[]
  achievements: Achievement[]
  activities: Activity[]
}

export interface NewUserInput {
  name: string
  email: string
  role: Role
  eskulId?: string
  phone?: string
  password: string
}

export interface NewEskulInput {
  id?: string
  name: string
  shortName: string
  description: string
  color: EskulColor
  day: string
  time: string
  location: string
  quota: number
  coachId?: string | null
  leaderId?: string | null
}

export type EskulPatch = Partial<NewEskulInput>

export interface UserPatch {
  name?: string
  email?: string
  role?: Role
  eskulId?: string | null
  phone?: string | null
  active?: boolean
}
