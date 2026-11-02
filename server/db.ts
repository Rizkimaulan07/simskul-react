import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { buildDefaultPermitLetter } from '../src/lib/permit-letter.ts'
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
  PermitLetter,
  PermitStatus,
  PermitType,
  Role,
  SeedData,
  Session,
  StaffAttendanceEntry,
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
    role TEXT NOT NULL CHECK (role IN ('admin', 'pelatih', 'ketua', 'wakasek')),
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

  CREATE TABLE IF NOT EXISTS session_staff_attendance (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('pelatih', 'ketua')),
    status TEXT NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alpa')),
    note TEXT,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, user_id)
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

  CREATE TABLE IF NOT EXISTS permit_letters (
    permit_id TEXT PRIMARY KEY REFERENCES permits(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    place TEXT NOT NULL DEFAULT '',
    letter_date TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    participant_count INTEGER,
    attachments TEXT,
    signer_name TEXT NOT NULL,
    signer_role TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL
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

  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (lower(email));
  CREATE UNIQUE INDEX IF NOT EXISTS idx_students_nis_unique ON students (nis);
  CREATE INDEX IF NOT EXISTS idx_students_eskul ON students (eskul_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_eskul ON sessions (eskul_id, date);
  CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance (student_id);
  CREATE INDEX IF NOT EXISTS idx_session_staff_user ON session_staff_attendance (user_id);
  CREATE INDEX IF NOT EXISTS idx_grades_student ON grades (student_id);
  CREATE INDEX IF NOT EXISTS idx_permits_status ON permits (status);
  CREATE INDEX IF NOT EXISTS idx_permit_letters_date ON permit_letters (letter_date);
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

interface StaffAttendanceRow {
  session_id: string
  user_id: string
  role: 'pelatih' | 'ketua'
  status: AttendanceStatus
  note: string | null
  updated_by: string
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
  start_time: string
  end_time: string
  location: string
  status: PermitStatus
  created_by: string
  created_at: string
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
}

interface PermitLetterRow {
  permit_id: string
  number: string
  place: string
  letter_date: string
  recipient: string
  subject: string
  body: string
  participant_count: number | null
  attachments: string | null
  signer_name: string
  signer_role: string
  updated_by: string
  updated_at: string
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

function toStaffAttendance(row: StaffAttendanceRow): StaffAttendanceEntry {
  return {
    userId: row.user_id,
    role: row.role,
    status: row.status,
    note: row.note ?? undefined,
    updatedBy: row.updated_by,
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
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
  }
}

function toPermitLetter(row: PermitLetterRow): PermitLetter {
  return {
    number: row.number,
    place: row.place,
    date: row.letter_date,
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    participantCount: row.participant_count,
    attachments: row.attachments ?? undefined,
    signerName: row.signer_name,
    signerRole: row.signer_role,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
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

const STAFF_ATTENDANCE_MIGRATION = '2026-10-29-staff-attendance'
const STAFF_KETUA_MIGRATION = '2026-10-29-staff-attendance-ketua'
const WAKASEK_ROLE_MIGRATION = '2026-10-29-wakasek-role'
const WAKASEK_ACCOUNT_MIGRATION = '2026-10-29-wakasek-account'
const PERMIT_LETTERS_MIGRATION = '2026-10-29-permit-letters'

const WAKASEK_EMAIL = 'wakasek@simskul.sch.id'

async function migrationApplied(id: string) {
  const applied = await db
    .prepare('SELECT id FROM schema_migrations WHERE id = ? LIMIT 1')
    .get(id)
  return Boolean(applied)
}

async function recordMigration(tx: Executor, id: string) {
  await tx
    .prepare(
      `INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .run(id, new Date().toISOString())
}

async function runMigration(id: string, statement: string) {
  if (await migrationApplied(id)) return
  await transaction(async (tx) => {
    await tx.exec(statement)
    await recordMigration(tx, id)
  })
}

/**
 * Existing databases were created with a role CHECK constraint that predates
 * the wakasek role. Rebuild it once so wakasek accounts can be stored.
 */
async function migrateWakasekRole() {
  await runMigration(
    WAKASEK_ROLE_MIGRATION,
    `DO $$
     DECLARE constraint_name TEXT;
     BEGIN
       FOR constraint_name IN
         SELECT c.conname
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE t.relname = 'users'
           AND n.nspname = current_schema()
           AND c.contype = 'c'
           AND pg_get_constraintdef(c.oid) ILIKE '%role%'
       LOOP
         EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
       END LOOP;
       ALTER TABLE users
         ADD CONSTRAINT users_role_check
         CHECK (role IN ('admin', 'pelatih', 'ketua', 'wakasek'));
     END $$;`,
  )
}

/** Adds the demo wakasek account for databases seeded before the role existed. */
async function migrateWakasekAccount() {
  if (await migrationApplied(WAKASEK_ACCOUNT_MIGRATION)) return
  await transaction(async (tx) => {
    const existing = await tx
      .prepare('SELECT id FROM users WHERE lower(email) = lower(?) OR id = ? LIMIT 1')
      .get(WAKASEK_EMAIL, 'u-wakasek')
    if (!existing) {
      const now = new Date().toISOString()
      const password = process.env.SIMSKUL_DEMO_PASSWORD ?? 'simskul123'
      await tx
        .prepare(
          `INSERT INTO users
            (id, name, email, password_hash, role, eskul_id, phone, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          'u-wakasek',
          'Dewi Kartika, M.Pd.',
          WAKASEK_EMAIL,
          hashPassword(password),
          'wakasek',
          null,
          '0811-0000-0002',
          1,
          now,
          now,
        )
    }
    await recordMigration(tx, WAKASEK_ACCOUNT_MIGRATION)
  })
}

/**
 * Backfills one default letter per permit so every existing submission can be
 * reviewed and printed without creating a letter manually first.
 */
async function migratePermitLetters() {
  if (await migrationApplied(PERMIT_LETTERS_MIGRATION)) return
  await transaction(async (tx) => {
    const permitRows = (await tx
      .prepare('SELECT * FROM permits ORDER BY created_at')
      .all()) as unknown as PermitRow[]
    const existingRows = (await tx
      .prepare('SELECT permit_id FROM permit_letters')
      .all()) as unknown as { permit_id: string }[]
    const existing = new Set(existingRows.map((row) => row.permit_id))
    const eskulRows = (await tx.prepare('SELECT * FROM eskul').all()) as unknown as EskulRow[]
    const userRows = (await tx.prepare('SELECT id, name FROM users').all()) as unknown as {
      id: string
      name: string
    }[]
    const memberRows = (await tx
      .prepare(
        'SELECT eskul_id, COUNT(*)::int AS total FROM students WHERE active = 1 GROUP BY eskul_id',
      )
      .all()) as unknown as { eskul_id: string; total: number }[]

    const eskulById = new Map(eskulRows.map((row) => [row.id, toEskul(row)]))
    const userNameById = new Map(userRows.map((row) => [row.id, row.name]))
    const memberCountByEskul = new Map(memberRows.map((row) => [row.eskul_id, row.total]))
    const sequenceByYear = new Map<string, number>()

    const insertLetter = tx.prepare(
      `INSERT INTO permit_letters
        (permit_id, number, place, letter_date, recipient, subject, body, participant_count, attachments, signer_name, signer_role, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )

    for (const row of permitRows) {
      const permit = toPermit(row)
      if (existing.has(permit.id)) continue
      const year = permit.createdAt.slice(0, 4)
      const sequence = (sequenceByYear.get(year) ?? 0) + 1
      sequenceByYear.set(year, sequence)
      const eskul = eskulById.get(permit.eskulId)
      const leaderName = eskul?.leaderId ? userNameById.get(eskul.leaderId) : undefined
      const letter = buildDefaultPermitLetter({
        permit,
        eskul,
        leader: leaderName ? { name: leaderName } : undefined,
        participantCount: memberCountByEskul.get(permit.eskulId) ?? 0,
        sequence,
      })
      await insertLetter.run(
        permit.id,
        letter.number,
        letter.place,
        letter.date,
        letter.recipient,
        letter.subject,
        letter.body,
        letter.participantCount,
        letter.attachments ?? null,
        letter.signerName,
        letter.signerRole,
        letter.updatedBy,
        letter.updatedAt,
      )
    }
    await recordMigration(tx, PERMIT_LETTERS_MIGRATION)
  })
}

/**
 * Backfills staff attendance once for databases created before staff
 * attendance existed. Migration markers prevent new coach/ketua assignments
 * from rewriting historical sessions on every server start.
 */
async function migrateStaffAttendance() {
  await runMigration(
    STAFF_ATTENDANCE_MIGRATION,
    `INSERT INTO session_staff_attendance
      (session_id, user_id, role, status, note, updated_by, updated_at)
     SELECT s.id, e.coach_id, 'pelatih',
       CASE
         WHEN s.coach_present = 1 THEN 'hadir'
         WHEN lower(coalesce(s.coach_note, '')) LIKE '%sakit%' THEN 'sakit'
         ELSE 'izin'
       END,
       s.coach_note, e.coach_id, s.created_at
     FROM sessions s
     JOIN eskul e ON e.id = s.eskul_id
     JOIN users u ON u.id = e.coach_id
     WHERE e.coach_id IS NOT NULL AND s.coach_present IS NOT NULL
     ON CONFLICT (session_id, user_id) DO NOTHING`,
  )
  await runMigration(
    STAFF_KETUA_MIGRATION,
    `INSERT INTO session_staff_attendance
      (session_id, user_id, role, status, note, updated_by, updated_at)
     SELECT s.id, e.leader_id, 'ketua', 'hadir', NULL, e.leader_id, max(a.updated_at)
     FROM sessions s
     JOIN eskul e ON e.id = s.eskul_id
     JOIN attendance a ON a.session_id = s.id AND a.as_substitute = 1
     JOIN users u ON u.id = e.leader_id
     WHERE e.leader_id IS NOT NULL
     GROUP BY s.id, e.leader_id
     ON CONFLICT (session_id, user_id) DO NOTHING`,
  )
}

let readyPromise: Promise<boolean> | null = null

/** Ensures combined schema creation + seeding runs exactly once. */
export function ready(): Promise<boolean> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await db.exec(SCHEMA)
      const seeded = await seedIfEmpty()
      await migrateStaffAttendance()
      await migrateWakasekRole()
      await migrateWakasekAccount()
      await migratePermitLetters()
      return seeded
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
  const insertStaffAttendance = store.prepare(
    `INSERT INTO session_staff_attendance
      (session_id, user_id, role, status, note, updated_by, updated_at)
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
    for (const entry of session.staffAttendance) {
      await insertStaffAttendance.run(
        session.id,
        entry.userId,
        entry.role,
        entry.status,
        entry.note ?? null,
        entry.updatedBy,
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
  const insertPermitLetter = store.prepare(
    `INSERT INTO permit_letters
      (permit_id, number, place, letter_date, recipient, subject, body, participant_count, attachments, signer_name, signer_role, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    if (permit.letter) {
      await insertPermitLetter.run(
        permit.id,
        permit.letter.number,
        permit.letter.place,
        permit.letter.date,
        permit.letter.recipient,
        permit.letter.subject,
        permit.letter.body,
        permit.letter.participantCount,
        permit.letter.attachments ?? null,
        permit.letter.signerName,
        permit.letter.signerRole,
        permit.letter.updatedBy,
        permit.letter.updatedAt,
      )
    }
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
  const staffAttendanceRows = (await db
    .prepare('SELECT * FROM session_staff_attendance ORDER BY updated_at')
    .all()) as unknown as StaffAttendanceRow[]
  const staffAttendanceBySession = new Map<string, StaffAttendanceEntry[]>()
  for (const row of staffAttendanceRows) {
    const entries = staffAttendanceBySession.get(row.session_id) ?? []
    entries.push(toStaffAttendance(row))
    staffAttendanceBySession.set(row.session_id, entries)
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
    staffAttendance: staffAttendanceBySession.get(row.id) ?? [],
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
  const letterRows = (await db
    .prepare('SELECT * FROM permit_letters')
    .all()) as unknown as PermitLetterRow[]
  const lettersByPermit = new Map<string, PermitLetter>()
  for (const row of letterRows) {
    lettersByPermit.set(row.permit_id, toPermitLetter(row))
  }
  const permits = permitRows.map((row) => {
    const permit = toPermit(row)
    const letter = lettersByPermit.get(permit.id)
    return letter ? { ...permit, letter } : permit
  })

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
      DELETE FROM session_staff_attendance;
      DELETE FROM attendance;
      DELETE FROM grades;
      DELETE FROM documentation;
      DELETE FROM permit_letters;
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
