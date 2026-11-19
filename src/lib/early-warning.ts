import { summarizeAttendance, type AttendanceStats } from './selectors'
import type { Session, Student } from './types'
import { todayISO } from './utils'

/** Ambang persentase kehadiran yang dianggap perlu perhatian. */
export const ATTENDANCE_WARNING_THRESHOLD = 75

/** Jumlah alpa beruntun yang memicu peringatan. */
export const CONSECUTIVE_ALPA_LIMIT = 3

/** Jumlah minimal catatan presensi sebelum persentase dinilai. */
export const MIN_ATTENDANCE_RECORDS = 3

/** Jumlah sesi terakhir yang dipakai untuk mendeteksi anggota tidak aktif. */
export const INACTIVE_SESSION_WINDOW = 3

export type AttendanceWarningCode = 'alpa_beruntun' | 'kehadiran_rendah' | 'tidak_aktif'

export interface AttendanceWarningReason {
  code: AttendanceWarningCode
  label: string
  detail: string
}

export type AttendanceWarningSeverity = 'kritis' | 'perhatian'

export interface AttendanceWarning {
  student: Student
  stats: AttendanceStats
  consecutiveAbsences: number
  reasons: AttendanceWarningReason[]
  severity: AttendanceWarningSeverity
}

export interface AttendanceWarningOptions {
  students: Student[]
  sessions: Session[]
  eskulId?: string
  threshold?: number
  consecutiveLimit?: number
  minimumRecords?: number
  inactiveWindow?: number
}

function sortSessions(sessions: Session[]) {
  return [...sessions].sort((left, right) => {
    const byDate = left.date.localeCompare(right.date)
    return byDate !== 0 ? byDate : left.startTime.localeCompare(right.startTime)
  })
}

function isFilledSession(session: Session) {
  return session.attendance.length > 0
}

/**
 * Menganalisis presensi setiap anggota aktif dan mengembalikan daftar
 * peringatan dini. Semua peringatan dihitung dari data sesi yang sudah ada,
 * jadi hasilnya otomatis berubah ketika pelatih mengisi atau mengoreksi presensi.
 */
export function getAttendanceWarnings({
  students,
  sessions,
  eskulId,
  threshold = ATTENDANCE_WARNING_THRESHOLD,
  consecutiveLimit = CONSECUTIVE_ALPA_LIMIT,
  minimumRecords = MIN_ATTENDANCE_RECORDS,
  inactiveWindow = INACTIVE_SESSION_WINDOW,
}: AttendanceWarningOptions): AttendanceWarning[] {
  const today = todayISO()
  const scopedSessions = sortSessions(
    sessions.filter(
      (session) =>
        (!eskulId || session.eskulId === eskulId) &&
        session.date <= today &&
        isFilledSession(session),
    ),
  )

  return students
    .filter((student) => student.active)
    .map((student) => {
      // Sesi sebelum anggota bergabung tidak dihitung agar anggota baru tidak
      // langsung mendapat peringatan karena data lama eskul.
      const joinedAt = student.joinedAt || '0000-01-01'
      const studentSessions = scopedSessions.filter((session) => session.date >= joinedAt)

      const entries = studentSessions.flatMap((session) =>
        session.attendance.filter((entry) => entry.studentId === student.id),
      )
      const stats = summarizeAttendance(entries)

      let consecutiveAbsences = 0
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        if (entries[index].status !== 'alpa') break
        consecutiveAbsences += 1
      }

      const reasons: AttendanceWarningReason[] = []

      if (consecutiveAbsences >= consecutiveLimit) {
        reasons.push({
          code: 'alpa_beruntun',
          label: `Alpa ${consecutiveAbsences} sesi beruntun`,
          detail: `Tidak hadir tanpa keterangan pada ${consecutiveAbsences} sesi terakhir.`,
        })
      }

      if (stats.total >= minimumRecords && stats.rate < threshold) {
        reasons.push({
          code: 'kehadiran_rendah',
          label: `Kehadiran ${stats.rate}%`,
          detail: `Di bawah ambang ${threshold}% (${stats.hadir} hadir dari ${stats.total} catatan presensi).`,
        })
      }

      const recentSessions = studentSessions.slice(-inactiveWindow)
      const recentEntries = recentSessions.map((session) =>
        session.attendance.find((entry) => entry.studentId === student.id),
      )
      const hasCompleteRecentData =
        recentSessions.length >= inactiveWindow &&
        recentEntries.every((entry) => entry !== undefined)
      const recentlyPresent = recentEntries.some((entry) => entry?.status === 'hadir')
      const onlyAlpaRecently =
        recentEntries.length > 0 && recentEntries.every((entry) => entry?.status === 'alpa')

      if (hasCompleteRecentData && !recentlyPresent && !onlyAlpaRecently) {
        reasons.push({
          code: 'tidak_aktif',
          label: `Tidak hadir ${inactiveWindow} sesi terakhir`,
          detail: `Tidak memiliki status hadir pada ${inactiveWindow} sesi terakhir yang sudah diisi.`,
        })
      }

      const severity: AttendanceWarningSeverity =
        consecutiveAbsences >= consecutiveLimit ||
        (stats.total >= minimumRecords && stats.rate < threshold / 2)
          ? 'kritis'
          : 'perhatian'

      return {
        student,
        stats,
        consecutiveAbsences,
        reasons,
        severity,
      }
    })
    .filter((warning) => warning.reasons.length > 0)
    .sort((left, right) => {
      if (left.severity !== right.severity) return left.severity === 'kritis' ? -1 : 1
      if (left.stats.rate !== right.stats.rate) return left.stats.rate - right.stats.rate
      return right.consecutiveAbsences - left.consecutiveAbsences
    })
}
