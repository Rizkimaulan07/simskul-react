import type { Permit, Session, User } from './types'

export function isAdmin(user: User) {
  return user.role === 'admin'
}

export function canEditAttendance(user: User, session: Session) {
  if (user.role === 'admin') return false
  if (session.eskulId !== user.eskulId) return false
  if (user.role === 'pelatih') return true
  return session.coachPresent === false
}

export function canScore(user: User) {
  return user.role === 'pelatih'
}

export function canReviewPermits(user: User) {
  return user.role === 'admin'
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
  return user.role === 'admin'
}

export function canEditPermitLetter(user: User, permit: Permit) {
  if (permit.status !== 'diajukan') return false
  if (user.role !== 'pelatih' && user.role !== 'ketua') return false
  return permit.eskulId === user.eskulId
}

export function canViewPermitLetter(user: User, permit: Permit) {
  if (user.role === 'admin') return true
  if (user.role === 'wakasek') {
    return permit.status === 'disetujui' || permit.status === 'selesai'
  }
  return permit.eskulId === user.eskulId
}

export function canPrintPermitLetter(user: User, permit: Permit) {
  return canViewPermitLetter(user, permit) && permit.status !== 'ditolak'
}

export function canEditGrades(user: User) {
  return user.role === 'pelatih'
}
