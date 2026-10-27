import { toast } from 'sonner'
import { create } from 'zustand'
import { api, ApiError, apiErrorMessage } from './api'
import type {
  AttendanceStatus,
  Grade,
  NewDocumentationInput,
  NewPermitInput,
  NewSessionInput,
  NewStudentInput,
  NewUserInput,
  SeedData,
  Session,
  Student,
  User,
  UserPatch,
} from './types'
import { todayISO, uid } from './utils'

type GradePatch = Partial<Pick<Grade, 'keaktifan' | 'sikap' | 'keterampilan' | 'note'>>

type BootStatus = 'loading' | 'authenticated' | 'guest' | 'error'

interface BootstrapPayload extends SeedData {
  user: User
}

interface AppStore extends SeedData {
  currentUser: User | null
  status: BootStatus
  bootError: string | null
  init: () => Promise<void>
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  addActivity: (userId: string, action: string, detail: string) => void
  addSession: (input: NewSessionInput) => Session
  setCoachPresence: (
    sessionId: string,
    present: boolean,
    actorId: string,
    note?: string,
  ) => void
  setAttendance: (
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    actorId: string,
    note?: string,
  ) => void
  markAllPresent: (sessionId: string, actorId: string) => void
  saveGrade: (studentId: string, semester: string, patch: GradePatch, actorId: string) => void
  addDocumentation: (input: NewDocumentationInput) => void
  deleteDocumentation: (documentationId: string, actorId: string) => void
  createPermit: (input: NewPermitInput) => void
  reviewPermit: (
    permitId: string,
    decision: 'disetujui' | 'ditolak',
    note: string,
    actorId: string,
  ) => void
  completePermit: (permitId: string, actorId: string) => void
  addStudent: (input: NewStudentInput, actorId: string) => Student
  toggleStudentActive: (studentId: string, actorId: string) => void
  createUser: (input: NewUserInput) => Promise<User>
  updateUser: (userId: string, patch: UserPatch) => Promise<User>
  setUserActive: (userId: string, active: boolean) => Promise<User>
  resetUserPassword: (userId: string, password: string) => Promise<void>
  resetDemo: () => Promise<void>
}

function emptyData(): SeedData {
  return {
    users: [],
    eskul: [],
    students: [],
    sessions: [],
    grades: [],
    documentation: [],
    permits: [],
    activities: [],
  }
}

let initPromise: Promise<void> | null = null

function handleSyncError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    useAppStore.setState({
      ...emptyData(),
      currentUser: null,
      status: 'guest',
      bootError: null,
    })
    toast.error('Sesi berakhir', {
      description: 'Silakan masuk kembali untuk melanjutkan.',
    })
    return
  }
  toast.error('Perubahan gagal disimpan', {
    description: apiErrorMessage(error),
  })
}

function sync(request: Promise<unknown>) {
  void request.catch(handleSyncError)
}

export const useAppStore = create<AppStore>()((set, get) => ({
  ...emptyData(),
  currentUser: null,
  status: 'loading',
  bootError: null,

  init: () => {
    if (initPromise) return initPromise
    initPromise = (async () => {
      set({ status: 'loading', bootError: null })
      try {
        const payload = await api.get<BootstrapPayload>('/bootstrap')
        const { user, ...data } = payload
        set({ ...data, currentUser: user, status: 'authenticated' })
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          set({ ...emptyData(), currentUser: null, status: 'guest', bootError: null })
          return
        }
        set({ status: 'error', bootError: apiErrorMessage(error) })
      }
    })().finally(() => {
      initPromise = null
    })
    return initPromise
  },

  refresh: async () => {
    const payload = await api.get<BootstrapPayload>('/bootstrap')
    const { user, ...data } = payload
    set({ ...data, currentUser: user, status: 'authenticated', bootError: null })
  },

  login: async (email, password) => {
    const result = await api.post<{ user: User }>('/auth/login', { email, password })
    const payload = await api.get<BootstrapPayload>('/bootstrap')
    const { user, ...data } = payload
    set({
      ...data,
      currentUser: user ?? result.user,
      status: 'authenticated',
      bootError: null,
    })
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // The local session is cleared even if the server is unreachable.
    }
    set({ ...emptyData(), currentUser: null, status: 'guest', bootError: null })
  },

  addActivity: (userId, action, detail) =>
    set((state) => ({
      activities: [
        {
          id: uid('act'),
          at: new Date().toISOString(),
          userId,
          action,
          detail,
        },
        ...state.activities,
      ].slice(0, 100),
    })),

  addSession: (input) => {
    const session: Session = {
      id: uid('sesi'),
      eskulId: input.eskulId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location,
      topic: input.topic,
      notes: input.notes,
      coachPresent: true,
      attendance: [],
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ sessions: [...state.sessions, session] }))
    const eskulName = get().eskul.find((item) => item.id === input.eskulId)?.name ?? 'Eskul'
    get().addActivity(input.createdBy, 'Membuat sesi baru', `${eskulName} · ${input.topic}`)
    sync(api.post('/sessions', session))
    return session
  },

  setCoachPresence: (sessionId, present, actorId, note) => {
    const session = get().sessions.find((item) => item.id === sessionId)
    if (!session) return
    set((state) => ({
      sessions: state.sessions.map((item) =>
        item.id === sessionId
          ? { ...item, coachPresent: present, coachNote: note ?? item.coachNote }
          : item,
      ),
    }))
    const eskulName = get().eskul.find((item) => item.id === session.eskulId)?.name ?? 'Eskul'
    get().addActivity(
      actorId,
      present ? 'Menandai pelatih hadir' : 'Menandai pelatih berhalangan',
      `${eskulName} · ${session.topic}${present ? '' : ' · presensi dialihkan ke ketua eskul'}`,
    )
    sync(
      api.patch(`/sessions/${encodeURIComponent(sessionId)}/coach-presence`, {
        present,
        note,
      }),
    )
  },

  setAttendance: (sessionId, studentId, status, actorId, note) => {
    const actorIsKetua = get().users.find((user) => user.id === actorId)?.role === 'ketua'
    set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session.id !== sessionId) return session
        const entry = {
          studentId,
          status,
          note,
          updatedBy: actorId,
          asSubstitute: actorIsKetua && session.coachPresent === false,
          updatedAt: new Date().toISOString(),
        }
        const exists = session.attendance.some((item) => item.studentId === studentId)
        return {
          ...session,
          attendance: exists
            ? session.attendance.map((item) =>
                item.studentId === studentId ? { ...item, ...entry } : item,
              )
            : [...session.attendance, entry],
        }
      }),
    }))
    sync(
      api.put(`/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(studentId)}`, {
        status,
        note,
      }),
    )
  },

  markAllPresent: (sessionId, actorId) => {
    const state = get()
    const session = state.sessions.find((item) => item.id === sessionId)
    if (!session) return
    const actorIsKetua = state.users.find((user) => user.id === actorId)?.role === 'ketua'
    const memberIds = state.students
      .filter((student) => student.eskulId === session.eskulId && student.active)
      .map((student) => student.id)
    const now = new Date().toISOString()

    set((current) => ({
      sessions: current.sessions.map((item) =>
        item.id === sessionId
          ? {
              ...item,
              attendance: memberIds.map((studentId) => {
                const existing = item.attendance.find((entry) => entry.studentId === studentId)
                return {
                  studentId,
                  status: 'hadir' as const,
                  note: existing?.note,
                  updatedBy: actorId,
                  asSubstitute: actorIsKetua && item.coachPresent === false,
                  updatedAt: now,
                }
              }),
            }
          : item,
      ),
    }))

    const eskulName = state.eskul.find((item) => item.id === session.eskulId)?.name ?? 'Eskul'
    get().addActivity(
      actorId,
      'Menandai semua hadir',
      `${eskulName} · ${session.topic} · ${memberIds.length} anggota`,
    )
    sync(api.post(`/sessions/${encodeURIComponent(sessionId)}/attendance/mark-all`))
  },

  saveGrade: (studentId, semester, patch, actorId) => {
    const existing = get().grades.find(
      (grade) => grade.studentId === studentId && grade.semester === semester,
    )
    const now = new Date().toISOString()
    let grade: Grade

    if (existing) {
      grade = { ...existing, ...patch, updatedBy: actorId, updatedAt: now }
      set((state) => ({
        grades: state.grades.map((item) => (item.id === existing.id ? grade : item)),
      }))
    } else {
      grade = {
        id: uid('grade'),
        studentId,
        semester,
        keaktifan: patch.keaktifan ?? null,
        sikap: patch.sikap ?? null,
        keterampilan: patch.keterampilan ?? null,
        note: patch.note,
        updatedBy: actorId,
        updatedAt: now,
      }
      set((state) => ({ grades: [...state.grades, grade] }))
    }

    sync(
      api.put(`/grades/${encodeURIComponent(studentId)}/${encodeURIComponent(semester)}`, {
        id: grade.id,
        ...patch,
      }),
    )
  },

  addDocumentation: (input) => {
    const record = {
      ...input,
      id: uid('doc'),
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ documentation: [record, ...state.documentation] }))
    const eskulName = get().eskul.find((item) => item.id === input.eskulId)?.name ?? 'Eskul'
    get().addActivity(input.uploadedBy, 'Mengunggah dokumentasi', `${eskulName} · ${input.title}`)
    sync(api.post('/documentation', record))
  },

  deleteDocumentation: (documentationId, actorId) => {
    const doc = get().documentation.find((item) => item.id === documentationId)
    if (!doc) return
    set((state) => ({
      documentation: state.documentation.filter((item) => item.id !== documentationId),
    }))
    const eskulName = get().eskul.find((item) => item.id === doc.eskulId)?.name ?? 'Eskul'
    get().addActivity(actorId, 'Menghapus dokumentasi', `${eskulName} · ${doc.title}`)
    sync(api.delete(`/documentation/${encodeURIComponent(documentationId)}`))
  },

  createPermit: (input) => {
    const permit = {
      ...input,
      id: uid('perm'),
      status: 'diajukan' as const,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ permits: [permit, ...state.permits] }))
    const eskulName = get().eskul.find((item) => item.id === input.eskulId)?.name ?? 'Eskul'
    get().addActivity(input.createdBy, 'Mengajukan perizinan', `${eskulName} · ${input.title}`)
    sync(api.post('/permits', permit))
  },

  reviewPermit: (permitId, decision, note, actorId) => {
    const permit = get().permits.find((item) => item.id === permitId)
    if (!permit) return
    set((state) => ({
      permits: state.permits.map((item) =>
        item.id === permitId
          ? {
              ...item,
              status: decision,
              decidedBy: actorId,
              decidedAt: new Date().toISOString(),
              decisionNote: note,
            }
          : item,
      ),
    }))
    const eskulName = get().eskul.find((item) => item.id === permit.eskulId)?.name ?? 'Eskul'
    get().addActivity(
      actorId,
      decision === 'disetujui' ? 'Menyetujui perizinan' : 'Menolak perizinan',
      `${eskulName} · ${permit.title}`,
    )
    sync(
      api.patch(`/permits/${encodeURIComponent(permitId)}/review`, {
        decision,
        note,
      }),
    )
  },

  completePermit: (permitId, actorId) => {
    const permit = get().permits.find((item) => item.id === permitId)
    if (!permit) return
    set((state) => ({
      permits: state.permits.map((item) =>
        item.id === permitId ? { ...item, status: 'selesai' as const } : item,
      ),
    }))
    const eskulName = get().eskul.find((item) => item.id === permit.eskulId)?.name ?? 'Eskul'
    get().addActivity(actorId, 'Menandai kegiatan selesai', `${eskulName} · ${permit.title}`)
    sync(api.patch(`/permits/${encodeURIComponent(permitId)}/complete`))
  },

  addStudent: (input, actorId) => {
    const student: Student = {
      ...input,
      id: uid('st'),
      active: true,
      joinedAt: todayISO(),
    }
    set((state) => ({ students: [...state.students, student] }))
    const eskulName = get().eskul.find((item) => item.id === input.eskulId)?.name ?? 'Eskul'
    get().addActivity(actorId, 'Menambahkan anggota', `${eskulName} · ${input.name}`)
    sync(api.post('/students', student))
    return student
  },

  toggleStudentActive: (studentId, actorId) => {
    const student = get().students.find((item) => item.id === studentId)
    if (!student) return
    set((state) => ({
      students: state.students.map((item) =>
        item.id === studentId ? { ...item, active: !item.active } : item,
      ),
    }))
    get().addActivity(
      actorId,
      student.active ? 'Menonaktifkan anggota' : 'Mengaktifkan anggota',
      `Siswa · ${student.name}`,
    )
    sync(
      api.patch(`/students/${encodeURIComponent(studentId)}/active`, {
        active: !student.active,
      }),
    )
  },

  createUser: async (input) => {
    const result = await api.post<{ user: User }>('/admin/users', input)
    set((state) => ({ users: [...state.users, result.user] }))
    return result.user
  },

  updateUser: async (userId, patch) => {
    const result = await api.patch<{ user: User }>(
      `/admin/users/${encodeURIComponent(userId)}`,
      patch,
    )
    set((state) => ({
      users: state.users.map((user) => (user.id === userId ? result.user : user)),
      currentUser: state.currentUser?.id === userId ? result.user : state.currentUser,
    }))
    return result.user
  },

  setUserActive: (userId, active) => get().updateUser(userId, { active }),

  resetUserPassword: async (userId, password) => {
    await api.post(`/admin/users/${encodeURIComponent(userId)}/password`, { password })
  },

  resetDemo: async () => {
    await api.post('/admin/reset-data')
    await get().refresh()
  },
}))

export function useCurrentUser() {
  return useAppStore((state) => state.currentUser)
}
