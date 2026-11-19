import { ApiError } from './api-error'
import { createSeedData } from './seed'
import type {
  Achievement,
  Documentation,
  Eskul,
  EskulPatch,
  Grade,
  NewEskulInput,
  NewUserInput,
  Permit,
  SeedData,
  Session,
  Student,
  User,
  UserPatch,
} from './types'

type DemoMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface DemoState {
  data: SeedData
  passwords: Record<string, string>
  currentUserId: string | null
}

const storageKey = 'simskul-demo-user-v1'

let state: DemoState | null = null
let sequence = 0

function nextId(prefix: string) {
  sequence += 1
  return `${prefix}-demo-${Date.now().toString(36)}-${sequence}`
}

function defaultPassword(user: User) {
  return user.role === 'admin' ? 'admin123' : 'simskul123'
}

function readStoredUserId() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function storeUserId(userId: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (userId) window.localStorage.setItem(storageKey, userId)
    else window.localStorage.removeItem(storageKey)
  } catch {
    // Mode demo tetap berjalan tanpa localStorage.
  }
}

function getState(): DemoState {
  if (!state) {
    const data = createSeedData()
    state = {
      data,
      passwords: Object.fromEntries(data.users.map((user) => [user.id, defaultPassword(user)])),
      currentUserId: readStoredUserId(),
    }
  }
  return state
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function currentUser(): User {
  const current = getState()
  const user = current.data.users.find((item) => item.id === current.currentUserId)
  if (!user) {
    throw new ApiError('Sesi demo berakhir. Silakan masuk kembali.', 401)
  }
  return user
}

function findEskul(eskulId: string) {
  const eskul = getState().data.eskul.find((item) => item.id === eskulId)
  if (!eskul) throw new ApiError('Eskul tidak ditemukan.', 404)
  return eskul
}

function findSession(sessionId: string) {
  const session = getState().data.sessions.find((item) => item.id === sessionId)
  if (!session) throw new ApiError('Sesi tidak ditemukan.', 404)
  return session
}

function setEskulPerson(eskulId: string, role: 'pelatih' | 'ketua', userId?: string | null) {
  const current = getState()
  const eskul = findEskul(eskulId)
  const field = role === 'pelatih' ? 'coachId' : 'leaderId'
  const previousId = eskul[field]

  if (previousId && previousId !== userId) {
    const previous = current.data.users.find((user) => user.id === previousId)
    if (previous && previous.eskulId === eskulId) previous.eskulId = undefined
  }

  if (!userId) {
    eskul[field] = ''
    return
  }

  eskul[field] = userId
  const user = current.data.users.find((item) => item.id === userId)
  if (user) user.eskulId = eskulId
}

function findPermit(permitId: string) {
  const permit = getState().data.permits.find((item) => item.id === permitId)
  if (!permit) throw new ApiError('Perizinan tidak ditemukan.', 404)
  return permit
}

function removeById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((item) => item.id !== id)
}

function handleLogin(body: Record<string, unknown>) {
  const current = getState()
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(body.password ?? '')
  const user = current.data.users.find((item) => item.email.toLowerCase() === email)

  if (!user || current.passwords[user.id] !== password) {
    throw new ApiError('Email atau kata sandi salah.', 401)
  }

  current.currentUserId = user.id
  storeUserId(user.id)
  return { user: clone(user) }
}

function handleProfileUpdate(body: Record<string, unknown>) {
  const user = currentUser()
  const patch = body as UserPatch

  if (patch.name !== undefined) user.name = patch.name
  if (patch.email !== undefined) user.email = patch.email
  if (patch.phone !== undefined) user.phone = patch.phone ?? undefined
  if (patch.role !== undefined) user.role = patch.role
  if (patch.eskulId !== undefined) user.eskulId = patch.eskulId ?? undefined
  if (patch.active !== undefined) user.active = patch.active
  user.updatedAt = new Date().toISOString()

  return { user: clone(user) }
}

function handleCreateUser(body: Record<string, unknown>) {
  const current = getState()
  const input = body as unknown as NewUserInput
  const now = new Date().toISOString()
  const user: User = {
    id: nextId('u'),
    name: input.name,
    email: input.email,
    role: input.role,
    eskulId: input.eskulId,
    phone: input.phone,
    active: true,
    createdAt: now,
    updatedAt: now,
  }

  current.data.users.push(user)
  current.passwords[user.id] = input.password
  if (input.eskulId) {
    if (input.role === 'pelatih' || input.role === 'ketua') {
      setEskulPerson(input.eskulId, input.role, user.id)
    }
  }

  return { user: clone(user) }
}

function handleUpdateUser(userId: string, body: Record<string, unknown>) {
  const current = getState()
  const user = current.data.users.find((item) => item.id === userId)
  if (!user) throw new ApiError('Pengguna tidak ditemukan.', 404)
  const patch = body as UserPatch

  if (patch.name !== undefined) user.name = patch.name
  if (patch.email !== undefined) user.email = patch.email
  if (patch.phone !== undefined) user.phone = patch.phone ?? undefined
  if (patch.role !== undefined) user.role = patch.role
  if (patch.eskulId !== undefined) user.eskulId = patch.eskulId ?? undefined
  if (patch.active !== undefined) user.active = patch.active
  user.updatedAt = new Date().toISOString()

  if (user.eskulId && (user.role === 'pelatih' || user.role === 'ketua')) {
    setEskulPerson(user.eskulId, user.role, user.id)
  }

  return { user: clone(user) }
}

function handleCreateEskul(body: Record<string, unknown>) {
  const current = getState()
  const input = body as unknown as NewEskulInput
  const eskul: Eskul = {
    id: input.id ?? nextId('e'),
    name: input.name,
    shortName: input.shortName,
    description: input.description,
    color: input.color,
    day: input.day,
    time: input.time,
    location: input.location,
    quota: input.quota,
    coachId: input.coachId ?? '',
    leaderId: input.leaderId ?? '',
  }

  current.data.eskul.push(eskul)
  if (input.coachId) setEskulPerson(eskul.id, 'pelatih', input.coachId)
  if (input.leaderId) setEskulPerson(eskul.id, 'ketua', input.leaderId)

  return { eskul: { id: eskul.id, name: eskul.name } }
}

function handleUpdateEskul(eskulId: string, body: Record<string, unknown>) {
  const eskul = findEskul(eskulId)
  const patch = body as EskulPatch

  if (patch.name !== undefined) eskul.name = patch.name
  if (patch.shortName !== undefined) eskul.shortName = patch.shortName
  if (patch.description !== undefined) eskul.description = patch.description
  if (patch.color !== undefined) eskul.color = patch.color
  if (patch.day !== undefined) eskul.day = patch.day
  if (patch.time !== undefined) eskul.time = patch.time
  if (patch.location !== undefined) eskul.location = patch.location
  if (patch.quota !== undefined) eskul.quota = patch.quota
  if (patch.coachId !== undefined) setEskulPerson(eskul.id, 'pelatih', patch.coachId)
  if (patch.leaderId !== undefined) setEskulPerson(eskul.id, 'ketua', patch.leaderId)

  return { eskul: clone(eskul) }
}

function handleDeleteEskul(eskulId: string) {
  const current = getState()
  findEskul(eskulId)
  current.data.eskul = removeById(current.data.eskul, eskulId)
  for (const user of current.data.users) {
    if (user.eskulId === eskulId) user.eskulId = undefined
  }
  return {}
}

function handleAttendance(sessionId: string, studentId: string, body: Record<string, unknown>) {
  const session = findSession(sessionId)
  const actor = currentUser()
  const status = String(body.status ?? 'hadir')
  const note = typeof body.note === 'string' ? body.note : undefined
  const existing = session.attendance.find((entry) => entry.studentId === studentId)
  const now = new Date().toISOString()

  if (existing) {
    existing.status = status as typeof existing.status
    existing.note = note
    existing.updatedBy = actor.id
    existing.updatedAt = now
  } else {
    session.attendance.push({
      studentId,
      status: status as (typeof session.attendance)[number]['status'],
      note,
      updatedBy: actor.id,
      asSubstitute: false,
      updatedAt: now,
    })
  }

  return {}
}

function handleStaffAttendance(
  sessionId: string,
  staffUserId: string,
  body: Record<string, unknown>,
) {
  const current = getState()
  const session = findSession(sessionId)
  const actor = currentUser()
  const status = String(body.status ?? 'hadir')
  const note = typeof body.note === 'string' ? body.note : undefined
  const existing = session.staffAttendance.find((entry) => entry.userId === staffUserId)
  const eskul = current.data.eskul.find((item) => item.id === session.eskulId)
  const role = eskul?.leaderId === staffUserId ? 'ketua' : 'pelatih'
  const now = new Date().toISOString()

  if (existing) {
    existing.status = status as typeof existing.status
    existing.note = note
    existing.updatedBy = actor.id
    existing.updatedAt = now
  } else {
    session.staffAttendance.push({
      userId: staffUserId,
      role,
      status: status as (typeof session.staffAttendance)[number]['status'],
      note,
      updatedBy: actor.id,
      updatedAt: now,
    })
  }

  return {}
}

function handleMarkAll(sessionId: string) {
  const current = getState()
  const session = findSession(sessionId)
  const actor = currentUser()
  const now = new Date().toISOString()
  const students = current.data.students.filter(
    (student) => student.eskulId === session.eskulId && student.active,
  )

  for (const student of students) {
    const existing = session.attendance.find((entry) => entry.studentId === student.id)
    if (existing) {
      existing.status = 'hadir'
      existing.updatedBy = actor.id
      existing.updatedAt = now
    } else {
      session.attendance.push({
        studentId: student.id,
        status: 'hadir',
        updatedBy: actor.id,
        asSubstitute: actor.role === 'ketua' && session.coachPresent === false,
        updatedAt: now,
      })
    }
  }

  return {}
}

function handleGrade(studentId: string, semester: string, body: Record<string, unknown>) {
  const current = getState()
  const actor = currentUser()
  const now = new Date().toISOString()
  const existing = current.data.grades.find(
    (grade) => grade.studentId === studentId && grade.semester === semester,
  )

  if (existing) {
    if (typeof body.keaktifan === 'number' || body.keaktifan === null) {
      existing.keaktifan = body.keaktifan
    }
    if (typeof body.sikap === 'number' || body.sikap === null) existing.sikap = body.sikap
    if (typeof body.keterampilan === 'number' || body.keterampilan === null) {
      existing.keterampilan = body.keterampilan
    }
    if (typeof body.note === 'string') existing.note = body.note
    existing.updatedBy = actor.id
    existing.updatedAt = now
  } else {
    const grade: Grade = {
      id: String(body.id ?? nextId('grade')),
      studentId,
      semester,
      keaktifan: typeof body.keaktifan === 'number' ? body.keaktifan : null,
      sikap: typeof body.sikap === 'number' ? body.sikap : null,
      keterampilan: typeof body.keterampilan === 'number' ? body.keterampilan : null,
      note: typeof body.note === 'string' ? body.note : undefined,
      updatedBy: actor.id,
      updatedAt: now,
    }
    current.data.grades.push(grade)
  }

  return {}
}

function handleDocumentationDelete(documentationId: string) {
  const current = getState()
  current.data.documentation = removeById(current.data.documentation, documentationId)
  return {}
}

function handleAchievement(body: Record<string, unknown>) {
  const current = getState()
  current.data.achievements.unshift(body as unknown as Achievement)
  return {}
}

function handleAchievementDelete(achievementId: string) {
  const current = getState()
  current.data.achievements = removeById(current.data.achievements, achievementId)
  return {}
}

function handlePermit(body: Record<string, unknown>) {
  const current = getState()
  current.data.permits.unshift(body as unknown as Permit)
  return {}
}

function handlePermitReview(permitId: string, body: Record<string, unknown>) {
  const permit = findPermit(permitId)
  const actor = currentUser()
  permit.status = body.decision === 'disetujui' ? 'disetujui' : 'ditolak'
  permit.decidedBy = actor.id
  permit.decidedAt = new Date().toISOString()
  permit.decisionNote = typeof body.note === 'string' ? body.note : undefined
  return {}
}

function handlePermitComplete(permitId: string) {
  findPermit(permitId).status = 'selesai'
  return {}
}

function handlePermitLetter(permitId: string, body: Record<string, unknown>) {
  findPermit(permitId).letter = body as unknown as Permit['letter']
  return {}
}

function handleStudent(body: Record<string, unknown>) {
  const current = getState()
  current.data.students.push(body as unknown as Student)
  return {}
}

function handleStudentActive(studentId: string, body: Record<string, unknown>) {
  const student = getState().data.students.find((item) => item.id === studentId)
  if (student) student.active = Boolean(body.active)
  return {}
}

function handleResetData() {
  const current = getState()
  const activeUserId = current.currentUserId
  const data = createSeedData()
  const nextUser =
    data.users.find((user) => user.id === activeUserId) ??
    data.users.find((user) => user.role === 'admin')

  state = {
    data,
    passwords: Object.fromEntries(data.users.map((user) => [user.id, defaultPassword(user)])),
    currentUserId: nextUser?.id ?? null,
  }
  storeUserId(state.currentUserId)
  return { ok: true }
}

export async function demoRequest<T>(
  path: string,
  method: DemoMethod,
  body?: unknown,
): Promise<T> {
  const current = getState()
  const segments = path
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
  const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

  if (method === 'GET' && segments[0] === 'bootstrap') {
    const user = currentUser()
    return { user: clone(user), ...clone(current.data) } as T
  }

  if (method === 'POST' && segments[0] === 'auth' && segments[1] === 'login') {
    return handleLogin(payload) as T
  }

  if (method === 'POST' && segments[0] === 'auth' && segments[1] === 'logout') {
    current.currentUserId = null
    storeUserId(null)
    return {} as T
  }

  if (segments[0] === 'profile' && method === 'PATCH') {
    return handleProfileUpdate(payload) as T
  }

  if (segments[0] === 'profile' && segments[1] === 'password' && method === 'POST') {
    const user = currentUser()
    const currentPassword = String(payload.currentPassword ?? '')
    const newPassword = String(payload.newPassword ?? '')
    if (current.passwords[user.id] !== currentPassword) {
      throw new ApiError('Kata sandi saat ini tidak sesuai.', 400)
    }
    if (newPassword.length < 8) {
      throw new ApiError('Kata sandi baru minimal 8 karakter.', 400)
    }
    current.passwords[user.id] = newPassword
    return {} as T
  }

  if (segments[0] === 'admin' && segments[1] === 'reset-data' && method === 'POST') {
    return handleResetData() as T
  }

  if (segments[0] === 'admin' && segments[1] === 'users') {
    if (segments[2] && segments[3] === 'password' && method === 'POST') {
      const userId = segments[2]
      const user = current.data.users.find((item) => item.id === userId)
      if (!user) throw new ApiError('Pengguna tidak ditemukan.', 404)
      current.passwords[userId] = String(payload.password ?? '')
      return {} as T
    }
    if (segments[2] && method === 'PATCH') {
      return handleUpdateUser(segments[2], payload) as T
    }
    if (!segments[2] && method === 'POST') {
      return handleCreateUser(payload) as T
    }
  }

  if (segments[0] === 'eskul') {
    if (segments[2] === 'logo') {
      const eskulId = segments[1]
      const eskul = findEskul(eskulId)
      if (method === 'DELETE') {
        eskul.logoUrl = undefined
        return {} as T
      }
      if (method === 'POST') {
        return { logoUrl: eskul.logoUrl ?? '' } as T
      }
    }
    if (segments[1] && method === 'PATCH') {
      return handleUpdateEskul(segments[1], payload) as T
    }
    if (segments[1] && method === 'DELETE') {
      return handleDeleteEskul(segments[1]) as T
    }
    if (!segments[1] && method === 'POST') {
      return handleCreateEskul(payload) as T
    }
  }

  if (segments[0] === 'sessions') {
    if (segments[1] && segments[2] === 'coach-presence' && method === 'PATCH') {
      const session = findSession(segments[1])
      session.coachPresent = Boolean(payload.present)
      session.coachNote = typeof payload.note === 'string' ? payload.note : undefined
      return {} as T
    }
    if (segments[1] && segments[2] === 'attendance' && segments[3] === 'mark-all') {
      return handleMarkAll(segments[1]) as T
    }
    if (segments[1] && segments[2] === 'attendance' && segments[3] && method === 'PUT') {
      return handleAttendance(segments[1], segments[3], payload) as T
    }
    if (segments[1] && segments[2] === 'staff-attendance' && segments[3] && method === 'PUT') {
      return handleStaffAttendance(segments[1], segments[3], payload) as T
    }
    if (!segments[1] && method === 'POST') {
      current.data.sessions.push(payload as unknown as Session)
      return payload as T
    }
  }

  if (segments[0] === 'grades' && segments[1] && segments[2] && method === 'PUT') {
    return handleGrade(segments[1], segments[2], payload) as T
  }

  if (segments[0] === 'documentation') {
    if (segments[1] === 'images') return {} as T
    if (segments[1] && method === 'DELETE') {
      return handleDocumentationDelete(segments[1]) as T
    }
    if (!segments[1] && method === 'POST') {
      current.data.documentation.unshift(payload as unknown as Documentation)
      return payload as T
    }
  }

  if (segments[0] === 'achievements') {
    if (segments[1] && method === 'DELETE') {
      return handleAchievementDelete(segments[1]) as T
    }
    if (!segments[1] && method === 'POST') {
      return handleAchievement(payload) as T
    }
  }

  if (segments[0] === 'permits') {
    if (segments[1] && segments[2] === 'review' && method === 'PATCH') {
      return handlePermitReview(segments[1], payload) as T
    }
    if (segments[1] && segments[2] === 'complete' && method === 'PATCH') {
      return handlePermitComplete(segments[1]) as T
    }
    if (segments[1] && segments[2] === 'letter' && method === 'PUT') {
      return handlePermitLetter(segments[1], payload) as T
    }
    if (!segments[1] && method === 'POST') {
      return handlePermit(payload) as T
    }
  }

  if (segments[0] === 'students') {
    if (segments[1] && segments[2] === 'active' && method === 'PATCH') {
      return handleStudentActive(segments[1], payload) as T
    }
    if (!segments[1] && method === 'POST') {
      return handleStudent(payload) as T
    }
  }

  // Endpoint yang tidak dipakai untuk demo tetap dianggap berhasil agar UI responsif.
  return {} as T
}

export async function demoUpload<T>(path: string, form: FormData): Promise<T> {
  const segments = path
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
  const file = form.get('image')
  const objectUrl =
    typeof File !== 'undefined' && file instanceof File && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : ''

  if (segments[0] === 'documentation' && segments[1] === 'images') {
    return { image: { url: objectUrl } } as T
  }

  if (segments[0] === 'eskul' && segments[1] && segments[2] === 'logo') {
    const eskul = findEskul(segments[1])
    eskul.logoUrl = objectUrl
    return { logoUrl: objectUrl } as T
  }

  return {} as T
}
