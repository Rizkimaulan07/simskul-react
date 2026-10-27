import type {
  AttendanceEntry,
  Grade,
  Session,
  Student,
} from './types'
import { todayISO } from './utils'

export interface AttendanceStats {
  hadir: number
  izin: number
  sakit: number
  alpa: number
  total: number
  rate: number
}

export function summarizeAttendance(entries: AttendanceEntry[]): AttendanceStats {
  const stats = entries.reduce(
    (acc, entry) => {
      acc[entry.status] += 1
      return acc
    },
    { hadir: 0, izin: 0, sakit: 0, alpa: 0 },
  )
  const total = entries.length
  return {
    ...stats,
    total,
    rate: total ? Math.round((stats.hadir / total) * 100) : 0,
  }
}

export function getSessionStats(session: Session) {
  return summarizeAttendance(session.attendance)
}

export function getEskulAttendance(sessions: Session[], eskulId: string) {
  const entries = sessions.filter((s) => s.eskulId === eskulId).flatMap((s) => s.attendance)
  return summarizeAttendance(entries)
}

export function getAllAttendance(sessions: Session[]) {
  return summarizeAttendance(sessions.flatMap((s) => s.attendance))
}

export function getMonthlyAttendance(sessions: Session[]) {
  const month = todayISO().slice(0, 7)
  const entries = sessions.filter((s) => s.date.startsWith(month)).flatMap((s) => s.attendance)
  return summarizeAttendance(entries)
}

export function getStudentAttendance(sessions: Session[], studentId: string) {
  const entries = sessions.flatMap((s) =>
    s.attendance.filter((entry) => entry.studentId === studentId),
  )
  return summarizeAttendance(entries)
}

export function getFinalScore(grade?: Grade | null) {
  if (!grade || grade.keaktifan === null || grade.sikap === null || grade.keterampilan === null) {
    return null
  }
  return Math.round(grade.keaktifan * 0.4 + grade.sikap * 0.3 + grade.keterampilan * 0.3)
}

export function getPredicate(score: number | null) {
  if (score === null) return { letter: '-', label: 'Belum dinilai', badge: 'secondary' as const }
  if (score >= 90)
    return {
      letter: 'A',
      label: 'Sangat Baik',
      badge: 'default' as const,
    }
  if (score >= 80) return { letter: 'B', label: 'Baik', badge: 'info' as const }
  if (score >= 70) return { letter: 'C', label: 'Cukup', badge: 'warning' as const }
  return { letter: 'D', label: 'Perlu Bimbingan', badge: 'danger' as const }
}

export function getActiveStudents(students: Student[], eskulId: string) {
  return students.filter((student) => student.eskulId === eskulId && student.active)
}

export function getNextSession(sessions: Session[], eskulId?: string) {
  const today = todayISO()
  return sessions
    .filter((session) => (!eskulId || session.eskulId === eskulId) && session.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
}

export function getDelegatedSessions(sessions: Session[], eskulId: string) {
  const today = todayISO()
  return sessions.filter(
    (session) =>
      session.eskulId === eskulId && session.coachPresent === false && session.date >= today,
  )
}

export function isSessionPast(session: Session) {
  return session.date < todayISO()
}

export function isSessionToday(session: Session) {
  return session.date === todayISO()
}

export function getSessionLabel(session: Session) {
  if (isSessionToday(session)) return { label: 'Hari ini', variant: 'warning' as const }
  if (isSessionPast(session)) return { label: 'Selesai', variant: 'secondary' as const }
  return { label: 'Akan datang', variant: 'info' as const }
}

export function getAttendanceTrend(sessions: Session[], eskulId?: string, limit = 6) {
  return sessions
    .filter((session) => (!eskulId || session.eskulId === eskulId) && session.attendance.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map((session) => {
      const stats = getSessionStats(session)
      return {
        id: session.id,
        label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(
          new Date(`${session.date}T00:00:00`),
        ),
        hadir: stats.hadir,
        izin: stats.izin,
        sakit: stats.sakit,
        alpa: stats.alpa,
        rate: stats.rate,
        topic: session.topic,
      }
    })
}
