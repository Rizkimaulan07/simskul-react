import { toast } from 'sonner'
import { create } from 'zustand'
import { api, ApiError, apiErrorMessage } from './api'
import { buildDefaultPermitLetter, nextPermitLetterSequence } from './permit-letter'
import type {
  AttendanceStatus,
  EskulPatch,
  Grade,
  NewDocumentationInput,
  NewEskulInput,
  NewPermitInput,
  NewSessionInput,
  NewStudentInput,
  NewUserInput,
  Permit,
  PermitLetterInput,
  SeedData,
  Session,
  StaffAttendanceEntry,
  Student,
  User,
  UserPatch,
} from './types'
import { todayISO, uid } from './utils'

type GradePatch = Partial<Pick<Grade, 'keaktifan' | 'sikap' | 'keterampilan' | 'note'>>

interface MutationOptions {
  notify?: boolean
}

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
  setStaffAttendance: (
    sessionId: string,
    staffUserId: string,
    status: AttendanceStatus,
    actorId: string,
    note?: string,
  ) => void
  markAllPresent: (sessionId: string, actorId: string) => void
  saveGrade: (studentId: string, semester: string, patch: GradePatch, actorId: string) => void
  addDocumentation: (input: NewDocumentationInput) => void
  deleteDocumentation: (documentationId: string, actorId: string) => void
  createPermit: (input: NewPermitInput) => string
  reviewPermit: (
    permitId: string,
    decision: 'disetujui' | 'ditolak',
    note: string,
    actorId: string,
  ) => void
  completePermit: (permitId: string, actorId: string) => void
  savePermitLetter: (permitId: string, input: PermitLetterInput, actorId: string) => void
  addStudent: (input: NewStudentInput, actorId: string) => Student
  toggleStudentActive: (studentId: string, actorId: string) => void
  createEskul: (input: NewEskulInput, options?: MutationOptions) => Promise<void>
  updateEskul: (eskulId: string, patch: EskulPatch, options?: MutationOptions) => Promise<void>
  deleteEskul: (eskulId: string) => Promise<void>
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
    const state = get()
    const eskul = state.eskul.find((item) => item.id === input.eskulId)
    const coach = state.users.find((item) => item.id === eskul?.coachId)
    const now = new Date().toISOString()
    const staffAttendance: StaffAttendanceEntry[] = coach
      ? [
          {
            userId: coach.id,
            role: 'pelatih',
            status: 'hadir',
            updatedBy: input.createdBy,
            updatedAt: now,
          },
        ]
      : []
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
      staffAttendance,
      createdBy: input.createdBy,
      createdAt: now,
    }
    set((current) => ({ sessions: [...current.sessions, session] }))
    const eskulName = eskul?.name ?? 'Eskul'
    get().addActivity(input.createdBy, 'Membuat sesi baru', `${eskulName} · ${input.topic}`)
    sync(api.post('/sessions', session))
    return session
  },

  setCoachPresence: (sessionId, present, actorId, note) => {
    const state = get()
    const session = state.sessions.find((item) => item.id === sessionId)
    if (!session) return
    const coachId = state.eskul.find((item) => item.id === session.eskulId)?.coachId
    if (coachId) {
      get().setStaffAttendance(sessionId, coachId, present ? 'hadir' : 'izin', actorId, note)
      return
    }
    set((current) => ({
      sessions: current.sessions.map((item) =>
        item.id === sessionId
          ? { ...item, coachPresent: present, coachNote: note ?? item.coachNote }
          : item,
      ),
    }))
    get().addActivity(
      actorId,
      present ? 'Menandai pelatih hadir' : 'Menandai pelatih berhalangan',
      `${state.eskul.find((item) => item.id === session.eskulId)?.name ?? 'Eskul'} · ${session.topic}${present ? '' : ' · presensi dialihkan ke ketua eskul'}`,
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

  setStaffAttendance: (sessionId, staffUserId, status, actorId, note) => {
    const state = get()
    const session = state.sessions.find((item) => item.id === sessionId)
    if (!session) return
    const eskul = state.eskul.find((item) => item.id === session.eskulId)
    const role =
      eskul?.coachId === staffUserId
        ? ('pelatih' as const)
        : eskul?.leaderId === staffUserId
          ? ('ketua' as const)
          : null
    if (!role) return
    const now = new Date().toISOString()
    const entry: StaffAttendanceEntry = {
      userId: staffUserId,
      role,
      status,
      note,
      updatedBy: actorId,
      updatedAt: now,
    }
    set((current) => ({
      sessions: current.sessions.map((item) => {
        if (item.id !== sessionId) return item
        const exists = item.staffAttendance.some((staff) => staff.userId === staffUserId)
        return {
          ...item,
          coachPresent: role === 'pelatih' ? status === 'hadir' : item.coachPresent,
          coachNote:
            role === 'pelatih' ? (status === 'hadir' ? undefined : note) : item.coachNote,
          staffAttendance: exists
            ? item.staffAttendance.map((staff) =>
                staff.userId === staffUserId ? { ...staff, ...entry } : staff,
              )
            : [...item.staffAttendance, entry],
        }
      }),
    }))
    const roleLabel = role === 'pelatih' ? 'pelatih' : 'ketua'
    get().addActivity(
      actorId,
      role === 'pelatih'
        ? status === 'hadir'
          ? 'Menandai pelatih hadir'
          : 'Menandai pelatih berhalangan'
        : 'Mengisi kehadiran ketua eskul',
      `${eskul?.name ?? 'Eskul'} · ${session.topic} · ${roleLabel}`,
    )
    sync(
      api.put(
        `/sessions/${encodeURIComponent(sessionId)}/staff-attendance/${encodeURIComponent(staffUserId)}`,
        { status, note },
      ),
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
    const permit: Permit = {
      ...input,
      id: uid('perm'),
      status: 'diajukan',
      createdAt: new Date().toISOString(),
      startTime: '08:00',
      endTime: '17:00',
    }
    const eskulData = get().eskul.find((item) => item.id === input.eskulId)
    const leader = get().users.find((user) => user.id === eskulData?.leaderId)
    const participantCount = get().students.filter(
      (student) => student.eskulId === input.eskulId && student.active,
    ).length
    permit.letter = buildDefaultPermitLetter({
      permit,
      eskul: eskulData,
      leader,
      participantCount,
      sequence: nextPermitLetterSequence(get().permits, permit.createdAt),
    })
    set((state) => ({ permits: [permit, ...state.permits] }))
    const eskulName = eskulData?.name ?? 'Eskul'
    get().addActivity(input.createdBy, 'Mengajukan perizinan', `${eskulName} · ${input.title}`)
    sync(api.post('/permits', permit))
    return permit.id
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

  savePermitLetter: (permitId, input, actorId) => {
    const permit = get().permits.find((item) => item.id === permitId)
    if (!permit) return
    const letter = {
      ...input,
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    }
    set((state) => ({
      permits: state.permits.map((item) =>
        item.id === permitId ? { ...item, letter } : item,
      ),
    }))
    const eskulName = get().eskul.find((item) => item.id === permit.eskulId)?.name ?? 'Eskul'
    get().addActivity(actorId, 'Memperbarui surat izin', `${eskulName} · ${input.subject}`)
    sync(api.put(`/permits/${encodeURIComponent(permitId)}/letter`, letter))
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

  createEskul: async (input, options) => {
    await api.post<{ eskul: { id: string; name: string } }>('/eskul', input)
    await get().refresh()
    if (options?.notify !== false) {
      toast.success('Eskul berhasil ditambahkan', { description: input.name })
    }
  },

  updateEskul: async (eskulId, patch, options) => {
    await api.patch(`/eskul/${encodeURIComponent(eskulId)}`, patch)
    await get().refresh()
    if (options?.notify !== false) {
      const eskul = get().eskul.find((item) => item.id === eskulId)
      toast.success('Data eskul diperbarui', { description: eskul?.name })
    }
  },

  deleteEskul: async (eskulId) => {
    await api.delete(`/eskul/${encodeURIComponent(eskulId)}`)
    await get().refresh()
    toast.success('Eskul berhasil dihapus')
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
