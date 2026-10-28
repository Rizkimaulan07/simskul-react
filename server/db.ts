import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { createSeedData } from '../src/lib/seed.ts'
import type {
  Activity,
  AttendanceEntry,
  AttendanceStatus,
  Documentation,
  Eskul,
  EskulColor,
  Gender,
  Grade,
  Permit,
  PermitStatus,
  PermitType,
  Role,
  SeedData,
  Session,
  Student,
  User,
} from '../src/lib/types.ts'
import { hashPassword } from './security.ts'

interface QueryResult {
  rows: Record<string, unknown>[]
  rowCount: number | null
}

interface PgClient {
  query(text: string, values?: unknown[]): Promise<QueryResult>
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Very small .env loader so DATABASE_URL can also be supplied via a file. */
async function loadDotEnv() {
  try {
    const raw = await readFile(resolve(projectRoot, '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!match) continue
      const key = match[1]
      let value = match[2] ?? ''
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    // .env is optional.
  }
}

await loadDotEnv()

/** Parse PostgreSQL BIGINT (COUNT(*), etc.) as a JavaScript number. */
pg.types.setTypeParser(20, (value: string) => Number.parseInt(value, 10))

export const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://simskul_app:simskul0808@localhost:5432/simskul'

export function databaseLabel() {
  try {
    const url = new URL(databaseUrl)
    return `PostgreSQL ${url.hostname}:${url.port || '5432'}/${url.pathname.replace(/^\//, '')}`
  } catch {
    return 'PostgreSQL'
  }
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 })

/** Converts SQLite-style `?` placeholders into PostgreSQL `$1, $2, …`. */
function toNativeSql(sql: string) {
  const parts = sql.split('?')
  let text = parts[0] ?? ''
  for (let index = 1; index < parts.length; index += 1) {
    text += `$${index}${parts[index]}`
  }
  return text
}

export class Executor {
  private readonly client: PgClient

  constructor(client: PgClient) {
    this.client = client
  }

  prepare(sql: string) {
    const text = toNativeSql(sql)
    return {
      get: async (...values: unknown[]) => {
        const result = await this.client.query(text, values)
        return result.rows[0] ?? undefined
      },
      all: async (...values: unknown[]) => {
        const result = await this.client.query(text, values)
        return result.rows
      },
      run: async (...values: unknown[]) => {
        const result = await this.client.query(text, values)
        return { rowCount: result.rowCount ?? 0 }
      },
    }
  }

  async exec(sql: string) {
    await this.client.query(sql)
  }
}

export const db = new Executor({
  query: (text, values) =>
    pool.query(text, values) as unknown as Promise<QueryResult>,
})

/** Runs `fn` inside a database transaction on a dedicated connection. */
export async function transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    const executor = new Executor(client as unknown as PgClient)
    await executor.exec('BEGIN')
    try {
      const result = await fn(executor)
      await executor.exec('COMMIT')
      return result
    } catch (error) {
      await executor.exec('ROLLBACK').catch(() => undefined)
      throw error
    }
  } finally {
    client.release()
  }
}

pool.on('error', (error) => {
  console.error('[simskul] PostgreSQL pool error:', error.message)
})

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'pelatih', 'ketua')),
    eskul_id TEXT,
    phone TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS eskul (
    id TEXT PRIMARY KEY,
    seq BIGSERIAL,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    description TEXT NOT NULL,
    color TEXT NOT NULL,
    day TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    coach_id TEXT,
    leader_id TEXT,
    quota INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nis TEXT NOT NULL,
    class_name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('L', 'P')),
    eskul_id TEXT NOT NULL REFERENCES eskul(id) ON DELETE CASCADE,
    active INTEGER NOT NULL DEFAULT 1,
    joined_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    eskul_id TEXT NOT NULL REFERENCES eskul(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT NOT NULL,
    topic TEXT NOT NULL,
    notes TEXT,
    coach_present INTEGER,
    coach_note TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alpa')),
    note TEXT,
    updated_by TEXT NOT NULL,
    as_substitute INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS grades (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester TEXT NOT NULL,
    keaktifan INTEGER,
    sikap INTEGER,
    keterampilan INTEGER,
    note TEXT,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (student_id, semester)
  );

  CREATE TABLE IF NOT EXISTS documentation (
    id TEXT PRIMARY KEY,
    eskul_id TEXT NOT NULL REFERENCES eskul(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    caption TEXT NOT NULL,
    image_url TEXT NOT NULL,
    date TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS permits (
    id TEXT PRIMARY KEY,
    eskul_id TEXT NOT NULL REFERENCES eskul(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('diajukan', 'disetujui', 'ditolak', 'selesai')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    decided_by TEXT,
    decided_at TEXT,
    decision_note TEXT
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    at TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (lower(email));
  CREATE UNIQUE INDEX IF NOT EXISTS idx_students_nis_unique ON students (nis);
  CREATE INDEX IF NOT EXISTS idx_students_eskul ON students (eskul_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_eskul ON sessions (eskul_id, date);
  CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance (student_id);
  CREATE INDEX IF NOT EXISTS idx_grades_student ON grades (student_id);
  CREATE INDEX IF NOT EXISTS idx_permits_status ON permits (status);
  CREATE INDEX IF NOT EXISTS idx_activities_at ON activities (at);
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);
`

interface UserRow {
  id: string
  name: string
  email: string
  password_hash: string
  role: Role
  eskul_id: string | null
  phone: string | null
  active: number
  created_at: string
  updated_at: string
}

interface EskulRow {
  id: string
  name: string
  short_name: string
  description: string
  color: EskulColor
  day: string
  time: string
  location: string
  coach_id: string | null
  leader_id: string | null
  quota: number
}

interface StudentRow {
  id: string
  name: string
  nis: string
  class_name: string
  gender: Gender
  eskul_id: string
  active: number
  joined_at: string
}

interface SessionRow {
  id: string
  eskul_id: string
  date: string
  start_time: string
  end_time: string
  location: string
  topic: string
  notes: string | null
  coach_present: number | null
  coach_note: string | null
  created_by: string
  created_at: string
}

interface AttendanceRow {
  session_id: string
  student_id: string
  status: AttendanceStatus
  note: string | null
  updated_by: string
  as_substitute: number
  updated_at: string
}

interface GradeRow {
  id: string
  student_id: string
  semester: string
  keaktifan: number | null
  sikap: number | null
  keterampilan: number | null
  note: string | null
  updated_by: string
  updated_at: string
}

interface DocumentationRow {
  id: string
  eskul_id: string
  session_id: string | null
  title: string
  caption: string
  image_url: string
  date: string
  uploaded_by: string
  created_at: string
}

interface PermitRow {
  id: string
  eskul_id: string
  type: PermitType
  title: string
  description: string
  start_date: string
  end_date: string
  location: string
  status: PermitStatus
  created_by: string
  created_at: string
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
}

interface ActivityRow {
  id: string
  at: string
  user_id: string
  action: string
  detail: string
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    eskulId: row.eskul_id ?? undefined,
    phone: row.phone ?? undefined,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toEskul(row: EskulRow): Eskul {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    description: row.description,
    color: row.color,
    day: row.day,
    time: row.time,
    location: row.location,
    coachId: row.coach_id ?? '',
    leaderId: row.leader_id ?? '',
    quota: row.quota,
  }
}

function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    nis: row.nis,
    className: row.class_name,
    gender: row.gender,
    eskulId: row.eskul_id,
    active: Boolean(row.active),
    joinedAt: row.joined_at,
  }
}

function toAttendance(row: AttendanceRow): AttendanceEntry {
  return {
    studentId: row.student_id,
    status: row.status,
    note: row.note ?? undefined,
    updatedBy: row.updated_by,
    asSubstitute: Boolean(row.as_substitute),
    updatedAt: row.updated_at,
  }
}

function toGrade(row: GradeRow): Grade {
  return {
    id: row.id,
    studentId: row.student_id,
    semester: row.semester,
    keaktifan: row.keaktifan,
    sikap: row.sikap,
    keterampilan: row.keterampilan,
    note: row.note ?? undefined,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

function toDocumentation(row: DocumentationRow): Documentation {
  return {
    id: row.id,
    eskulId: row.eskul_id,
    sessionId: row.session_id ?? undefined,
    title: row.title,
    caption: row.caption,
    imageUrl: row.image_url,
    date: row.date,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  }
}

function toPermit(row: PermitRow): Permit {
  return {
    id: row.id,
    eskulId: row.eskul_id,
    type: row.type,
    title: row.title,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    location: row.location,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
  }
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    at: row.at,
    userId: row.user_id,
    action: row.action,
    detail: row.detail,
  }
}

let readyPromise: Promise<boolean> | null = null

/** Ensures combined schema creation + seeding runs exactly once. */
export function ready(): Promise<boolean> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await db.exec(SCHEMA)
      return seedIfEmpty()
    })().catch((error) => {
      readyPromise = null
      throw error
    })
  }
  return readyPromise
}

/**
 * Explicit pool shutdown used when the HTTP server closes.
 */
export async function closeDatabase() {
  await pool.end()
}

export async function getUserByEmail(email: string) {
  const row = await db
    .prepare('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1')
    .get(email) as unknown as UserRow | undefined
  return row
}

export async function getUserById(userId: string) {
  const row = await db
    .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
    .get(userId) as unknown as UserRow | undefined
  return row
}

export async function getUserBySessionToken(tokenHash: string): Promise<User | null> {
  const row = await db
    .prepare(
      `SELECT u.* FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
       LIMIT 1`,
    )
    .get(tokenHash, new Date().toISOString()) as unknown as UserRow | undefined
  return row ? toUser(row) : null
}

export function toPublicUser(row: UserRow): User {
  return toUser(row)
}

export async function recordActivity(userId: string, action: string, detail: string) {
  await db
    .prepare('INSERT INTO activities (id, at, user_id, action, detail) VALUES (?, ?, ?, ?, ?)')
    .run(`act-${randomUUID()}`, new Date().toISOString(), userId, action, detail)
  await db
    .prepare(
      `DELETE FROM activities WHERE id NOT IN (
        SELECT id FROM activities ORDER BY at DESC LIMIT 100
      )`,
    )
    .run()
}

interface ExecutorLike {
  prepare(sql: string): {
    run(...values: unknown[]): Promise<unknown>
  }
}

async function insertUsers(seedUsers: User[], tx?: ExecutorLike) {
  const store = tx ?? db
  const insert = store.prepare(
    `INSERT INTO users
      (id, name, email, password_hash, role, eskul_id, phone, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const now = new Date().toISOString()
  for (const user of seedUsers) {
    const password =
      user.role === 'admin'
        ? (process.env.SIMSKUL_ADMIN_PASSWORD ?? 'admin123')
        : (process.env.SIMSKUL_DEMO_PASSWORD ?? 'simskul123')
    await insert.run(
      user.id,
      user.name,
      user.email,
      hashPassword(password),
      user.role,
      user.eskulId ?? null,
      user.phone ?? null,
      1,
      now,
      now,
    )
  }
}

async function insertOperationalData(seed: SeedData, tx?: ExecutorLike) {
  const store = tx ?? db

  const insertEskul = store.prepare(
    `INSERT INTO eskul
      (id, name, short_name, description, color, day, time, location, coach_id, leader_id, quota)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const eskul of seed.eskul) {
    await insertEskul.run(
      eskul.id,
      eskul.name,
      eskul.shortName,
      eskul.description,
      eskul.color,
      eskul.day,
      eskul.time,
      eskul.location,
      eskul.coachId || null,
      eskul.leaderId || null,
      eskul.quota,
    )
  }

  const insertStudent = store.prepare(
    `INSERT INTO students (id, name, nis, class_name, gender, eskul_id, active, joined_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const student of seed.students) {
    await insertStudent.run(
      student.id,
      student.name,
      student.nis,
      student.className,
      student.gender,
      student.eskulId,
      student.active ? 1 : 0,
      student.joinedAt,
    )
  }

  const insertSession = store.prepare(
    `INSERT INTO sessions
      (id, eskul_id, date, start_time, end_time, location, topic, notes, coach_present, coach_note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertAttendance = store.prepare(
    `INSERT INTO attendance
      (session_id, student_id, status, note, updated_by, as_substitute, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const session of seed.sessions) {
    await insertSession.run(
      session.id,
      session.eskulId,
      session.date,
      session.startTime,
      session.endTime,
      session.location,
      session.topic,
      session.notes ?? null,
      session.coachPresent === null ? null : session.coachPresent ? 1 : 0,
      session.coachNote ?? null,
      session.createdBy,
      session.createdAt,
    )
    for (const entry of session.attendance) {
      await insertAttendance.run(
        session.id,
        entry.studentId,
        entry.status,
        entry.note ?? null,
        entry.updatedBy,
        entry.asSubstitute ? 1 : 0,
        entry.updatedAt,
      )
    }
  }

  const insertGrade = store.prepare(
    `INSERT INTO grades
      (id, student_id, semester, keaktifan, sikap, keterampilan, note, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const grade of seed.grades) {
    await insertGrade.run(
      grade.id,
      grade.studentId,
      grade.semester,
      grade.keaktifan,
      grade.sikap,
      grade.keterampilan,
      grade.note ?? null,
      grade.updatedBy,
      grade.updatedAt,
    )
  }

  const insertDocumentation = store.prepare(
    `INSERT INTO documentation
      (id, eskul_id, session_id, title, caption, image_url, date, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const doc of seed.documentation) {
    await insertDocumentation.run(
      doc.id,
      doc.eskulId,
      doc.sessionId ?? null,
      doc.title,
      doc.caption,
      doc.imageUrl,
      doc.date,
      doc.uploadedBy,
      doc.createdAt,
    )
  }

  const insertPermit = store.prepare(
    `INSERT INTO permits
      (id, eskul_id, type, title, description, start_date, end_date, location, status, created_by, created_at, decided_by, decided_at, decision_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const permit of seed.permits) {
    await insertPermit.run(
      permit.id,
      permit.eskulId,
      permit.type,
      permit.title,
      permit.description,
      permit.startDate,
      permit.endDate,
      permit.location,
      permit.status,
      permit.createdBy,
      permit.createdAt,
      permit.decidedBy ?? null,
      permit.decidedAt ?? null,
      permit.decisionNote ?? null,
    )
  }

  const insertActivity = store.prepare(
    'INSERT INTO activities (id, at, user_id, action, detail) VALUES (?, ?, ?, ?, ?)',
  )
  for (const activity of seed.activities) {
    await insertActivity.run(
      activity.id,
      activity.at,
      activity.userId,
      activity.action,
      activity.detail,
    )
  }
}

async function seedIfEmpty(): Promise<boolean> {
  const existing = await db
    .prepare('SELECT COUNT(*)::int AS total FROM users')
    .get() as unknown as { total: number } | undefined
  if ((existing?.total ?? 0) > 0) return false

  const seed = createSeedData()
  await transaction(async (tx) => {
    await insertUsers(seed.users, tx)
    await insertOperationalData(seed, tx)
    return true
  })
  return true
}

export async function readState(): Promise<SeedData> {
  await ready()

  const userRows = await db
    .prepare('SELECT * FROM users ORDER BY lower(name)')
    .all() as unknown as UserRow[]
  const users = userRows.map(toUser)

  const eskulRows = await db
    .prepare('SELECT * FROM eskul ORDER BY seq')
    .all() as unknown as EskulRow[]
  const eskul = eskulRows.map(toEskul)

  const studentRows = await db
    .prepare('SELECT * FROM students ORDER BY lower(name)')
    .all() as unknown as StudentRow[]
  const students = studentRows.map(toStudent)

  const sessionRows = (await db
    .prepare('SELECT * FROM sessions ORDER BY date DESC, created_at DESC')
    .all()) as unknown as SessionRow[]
  const attendanceRows = (await db
    .prepare('SELECT * FROM attendance ORDER BY updated_at')
    .all()) as unknown as AttendanceRow[]
  const attendanceBySession = new Map<string, AttendanceEntry[]>()
  for (const row of attendanceRows) {
    const entries = attendanceBySession.get(row.session_id) ?? []
    entries.push(toAttendance(row))
    attendanceBySession.set(row.session_id, entries)
  }
  const sessions: Session[] = sessionRows.map((row) => ({
    id: row.id,
    eskulId: row.eskul_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    topic: row.topic,
    notes: row.notes ?? undefined,
    coachPresent: row.coach_present === null ? null : Boolean(row.coach_present),
    coachNote: row.coach_note ?? undefined,
    attendance: attendanceBySession.get(row.id) ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
  }))

  const gradeRows = (await db
    .prepare('SELECT * FROM grades')
    .all()) as unknown as GradeRow[]
  const grades = gradeRows.map(toGrade)

  const documentationRows = (await db
    .prepare('SELECT * FROM documentation ORDER BY date DESC, created_at DESC')
    .all()) as unknown as DocumentationRow[]
  const documentation = documentationRows.map(toDocumentation)

  const permitRows = (await db
    .prepare('SELECT * FROM permits ORDER BY created_at DESC')
    .all()) as unknown as PermitRow[]
  const permits = permitRows.map(toPermit)

  const activityRows = (await db
    .prepare('SELECT * FROM activities ORDER BY at DESC LIMIT 100')
    .all()) as unknown as ActivityRow[]
  const activities = activityRows.map(toActivity)

  return { users, eskul, students, sessions, grades, documentation, permits, activities }
}

export async function resetDemoData(actorId: string) {
  await ready()
  const seed = createSeedData()
  await transaction(async (tx) => {
    await tx.exec(`
      DELETE FROM attendance;
      DELETE FROM grades;
      DELETE FROM documentation;
      DELETE FROM permits;
      DELETE FROM activities;
      DELETE FROM sessions;
      DELETE FROM students;
      DELETE FROM eskul;
    `)
    await insertOperationalData(seed, tx)
    return true
  })
  recordActivity(actorId, 'Memulihkan data demo', 'Seluruh data eskul, anggota, dan sesi dibuat ulang')
}
