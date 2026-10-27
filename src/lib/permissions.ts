import type { Session, User } from './types'

export function isWakasek(user: User) {
  return user.role === 'wakasek'
}

export function isAdmin(user: User) {
  return user.role === 'admin'
}

export function canEditAttendance(user: User, session: Session) {
  if (user.role === 'wakasek') return false
  if (session.eskulId !== user.eskulId) return false
  if (user.role === 'pelatih') return true
  return session.coachPresent === false
}

export function canScore(user: User) {
  return user.role === 'pelatih'
}

export function canReviewPermits(user: User) {
  return user.role === 'wakasek'
}

export function canCreateSession(user: User) {
  return user.role === 'pelatih'
}

export function canManageMembers(user: User) {
  return user.role === 'pelatih' || user.role === 'ketua'
}

export function canUploadDocumentation(user: User) {
  return user.role === 'pelatih' || user.role === 'ketua'
}

export function canSubmitPermit(user: User) {
  return user.role === 'pelatih' || user.role === 'ketua'
}

export function canViewAllEskul(user: User) {
  return user.role === 'wakasek'
}

export function canEditGrades(user: User) {
  return user.role === 'pelatih'
}
