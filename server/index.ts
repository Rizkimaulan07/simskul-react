import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  AttendanceStatus,
  Gender,
  PermitType,
  Role,
  User,
} from '../src/lib/types.ts'
import {
  db,
  dbPath,
  getUserByEmail,
  getUserById,
  getUserBySessionToken,
  readState,
  recordActivity,
  resetDemoData,
  toPublicUser,
  wasSeeded,
} from './db.ts'
import {
  createSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './security.ts'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(projectRoot, 'dist')
const port = Number(process.env.PORT ?? 3001)
const sessionCookie = 'simskul_session'
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000
const cookieSecure = process.env.SIMSKUL_COOKIE_SECURE === '1'
const maxBodyBytes = 2 * 1024 * 1024

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

function setSecurityHeaders(res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  const payload = JSON.stringify(data)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
}

function parseCookies(header: string | undefined) {
  const cookies: Record<string, string> = {}
  if (!header) return cookies
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (name) cookies[name] = decodeURIComponent(value)
  }
  return cookies
}

function sessionCookieHeader(token: string, maxAgeSeconds: number) {
  const parts = [
    `${sessionCookie}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (cookieSecure) parts.push('Secure')
  return parts.join('; ')
}

function getSessionUser(req: IncomingMessage): User | null {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[sessionCookie]
  if (!token) return null
  return getUserBySessionToken(hashToken(token))
}

function requireAuth(req: IncomingMessage): User {
  const user = getSessionUser(req)
  if (!user) throw new HttpError(401, 'Sesi tidak valid. Silakan masuk kembali.')
  return user
}

function requireRole(user: User, roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw new HttpError(403, 'Anda tidak memiliki akses untuk tindakan ini.')
  }
}

function assertEskulAccess(user: User, eskulId: string, roles: Role[]) {
  if (user.role === 'admin') return
  if (!roles.includes(user.role) || user.eskulId !== eskulId) {
    throw new HttpError(403, 'Anda hanya dapat mengelola data eskul Anda sendiri.')
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBodyBytes) {
      throw new HttpError(413, 'Data yang dikirim terlalu besar.')
    }
    chunks.push(buffer)
  }
  if (size === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed as Record<string, unknown>
  } catch {
    throw new HttpError(400, 'Format JSON tidak valid.')
  }
}

function requireText(value: unknown, label: string, maxLength = 300) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${label} wajib diisi.`)
  }
  const text = value.trim()
  if (text.length > maxLength) {
    throw new HttpError(400, `${label} terlalu panjang (maksimal ${maxLength} karakter).`)
  }
  return text
}

function optionalText(value: unknown, maxLength = 5000) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Format teks tidak valid.')
  }
  const text = value.trim()
  if (text.length > maxLength) {
    throw new HttpError(400, `Teks terlalu panjang (maksimal ${maxLength} karakter).`)
  }
  return text || undefined
}

function requireDate(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} harus berupa tanggal yang valid.`)
  }
  return value
}

function requireTime(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} harus berupa jam yang valid.`)
  }
  return value
}

function requireEmail(value: unknown) {
  const email = requireText(value, 'Email', 180).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Format email tidak valid.')
  }
  return email
}

function requirePassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 8) {
    throw new HttpError(400, 'Kata sandi minimal 8 karakter.')
  }
  if (value.length > 200) {
    throw new HttpError(400, 'Kata sandi terlalu panjang.')
  }
  return value
}

function parseRole(value: unknown): Role {
  if (value === 'admin' || value === 'pelatih' || value === 'ketua' || value === 'wakasek') {
    return value
  }
  throw new HttpError(400, 'Peran pengguna tidak valid.')
}

function parseAttendanceStatus(value: unknown): AttendanceStatus {
  if (value === 'hadir' || value === 'izin' || value === 'sakit' || value === 'alpa') {
    return value
  }
  throw new HttpError(400, 'Status presensi tidak valid.')
}

function parseGender(value: unknown): Gender {
  if (value === 'L' || value === 'P') return value
  throw new HttpError(400, 'Jenis kelamin tidak valid.')
}

function parsePermitType(value: unknown): PermitType {
  if (
    value === 'lomba' ||
    value === 'latihan' ||
    value === 'kegiatan_luar' ||
    value === 'fasilitas' ||
    value === 'lainnya'
  ) {
    return value
  }
  throw new HttpError(400, 'Jenis perizinan tidak valid.')
}

function parseScore(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') return null
  const score = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new HttpError(400, `${label} harus bernilai antara 0 sampai 100.`)
  }
  return Math.round(score)
}

function parseBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new HttpError(400, `${label} harus berupa nilai boolean.`)
  }
  return value
}

function safeId(value: unknown, prefix: string) {
  if (typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value)) return value
  return `${prefix}-${randomUUID()}`
}

function eskulName(eskulId: string) {
  const row = db.prepare('SELECT name FROM eskul WHERE id = ?').get(eskulId) as unknown as
    | { name: string }
    | undefined
  return row?.name ?? 'Eskul'
}

function sessionMeta(sessionId: string) {
  const row = db
    .prepare('SELECT id, eskul_id, topic, coach_present FROM sessions WHERE id = ?')
    .get(sessionId) as unknown as
    | { id: string; eskul_id: string; topic: string; coach_present: number | null }
    | undefined
  if (!row) throw new HttpError(404, 'Sesi tidak ditemukan.')
  return row
}

function studentMeta(studentId: string) {
  const row = db
    .prepare('SELECT id, name, eskul_id, active FROM students WHERE id = ?')
    .get(studentId) as unknown as
    | { id: string; name: string; eskul_id: string; active: number }
    | undefined
  if (!row) throw new HttpError(404, 'Anggota tidak ditemukan.')
  return row
}

function ensureEskulExists(eskulId: string) {
  const row = db.prepare('SELECT id FROM eskul WHERE id = ?').get(eskulId) as unknown as
    | { id: string }
    | undefined
  if (!row) throw new HttpError(400, 'Eskul tidak ditemukan.')
  return row.id
}

function createSessionForUser(userId: string) {
  const token = createSessionToken()
  const now = new Date()
  const expires = new Date(now.getTime() + sessionTtlMs)
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now.toISOString())
  db.prepare(
    'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(hashToken(token), userId, now.toISOString(), expires.toISOString())
  return token
}

function publicUserById(userId: string): User {
  const row = getUserById(userId)
  if (!row) throw new HttpError(404, 'Pengguna tidak ditemukan.')
  return toPublicUser(row)
}

function emailInUse(email: string, exceptUserId?: string) {
  const existing = getUserByEmail(email)
  return Boolean(existing && existing.id !== exceptUserId)
}

function assertLastAdminRemains(userId: string, nextRole: Role, nextActive: boolean) {
  const current = getUserById(userId)
  if (!current || current.role !== 'admin') return
  if (nextRole === 'admin' && nextActive) return
  const count = db
    .prepare(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND active = 1 AND id <> ?",
    )
    .get(userId) as unknown as { total: number }
  if (count.total === 0) {
    throw new HttpError(400, 'Minimal harus ada satu administrator aktif.')
  }
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET'
  const pathname = url.pathname

  if (method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      database: 'sqlite',
      seeded: wasSeeded,
      time: new Date().toISOString(),
    })
    return
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJson(req)
    const email = requireEmail(body.email)
    const password = requirePassword(body.password)
    const row = getUserByEmail(email)
    if (!row || !row.active || !verifyPassword(password, row.password_hash)) {
      throw new HttpError(401, 'Email atau kata sandi salah.')
    }
    const token = createSessionForUser(row.id)
    res.setHeader('Set-Cookie', sessionCookieHeader(token, Math.floor(sessionTtlMs / 1000)))
    sendJson(res, 200, { user: toPublicUser(row) })
    return
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const cookies = parseCookies(req.headers.cookie)
    const token = cookies[sessionCookie]
    if (token) {
      db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token))
    }
    res.setHeader('Set-Cookie', sessionCookieHeader('', 0))
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'GET' && pathname === '/api/auth/me') {
    const user = requireAuth(req)
    sendJson(res, 200, { user })
    return
  }

  if (method === 'GET' && pathname === '/api/bootstrap') {
    const user = requireAuth(req)
    sendJson(res, 200, { user, ...readState() })
    return
  }

  if (method === 'POST' && pathname === '/api/sessions') {
    const user = requireAuth(req)
    const body = await readJson(req)
    const eskulId = requireText(body.eskulId, 'Eskul', 100)
    assertEskulAccess(user, eskulId, ['pelatih'])
    ensureEskulExists(eskulId)
    const topic = requireText(body.topic, 'Nama kegiatan', 200)
    const date = requireDate(body.date, 'Tanggal')
    const startTime = requireTime(body.startTime, 'Jam mulai')
    const endTime = requireTime(body.endTime, 'Jam selesai')
    if (startTime >= endTime) {
      throw new HttpError(400, 'Jam selesai harus lebih lambat dari jam mulai.')
    }
    const location = requireText(body.location, 'Lokasi', 200)
    const notes = optionalText(body.notes, 2000)
    const id = safeId(body.id, 'sesi')
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO sessions
        (id, eskul_id, date, start_time, end_time, location, topic, notes, coach_present, coach_note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
    ).run(id, eskulId, date, startTime, endTime, location, topic, notes ?? null, user.id, now)
    recordActivity(user.id, 'Membuat sesi baru', `${eskulName(eskulId)} · ${topic}`)
    sendJson(res, 201, {
      session: {
        id,
        eskulId,
        date,
        startTime,
        endTime,
        location,
        topic,
        notes,
        coachPresent: true,
        attendance: [],
        createdBy: user.id,
        createdAt: now,
      },
    })
    return
  }

  const coachMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/coach-presence$/)
  if (method === 'PATCH' && coachMatch) {
    const user = requireAuth(req)
    const body = await readJson(req)
    const sessionId = decodeURIComponent(coachMatch[1])
    const session = sessionMeta(sessionId)
    assertEskulAccess(user, session.eskul_id, ['pelatih'])
    const present = parseBoolean(body.present, 'Kehadiran pelatih')
    const note = optionalText(body.note, 2000)
    db.prepare(
      'UPDATE sessions SET coach_present = ?, coach_note = COALESCE(?, coach_note) WHERE id = ?',
    ).run(present ? 1 : 0, note ?? null, sessionId)
    recordActivity(
      user.id,
      present ? 'Menandai pelatih hadir' : 'Menandai pelatih berhalangan',
      `${eskulName(session.eskul_id)} · ${session.topic}${present ? '' : ' · presensi dialihkan ke ketua eskul'}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  const markAllMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/attendance\/mark-all$/)
  if (method === 'POST' && markAllMatch) {
    const user = requireAuth(req)
    const sessionId = decodeURIComponent(markAllMatch[1])
    const session = sessionMeta(sessionId)
    assertEskulAccess(user, session.eskul_id, ['pelatih', 'ketua'])
    if (user.role === 'ketua' && session.coach_present !== 0) {
      throw new HttpError(403, 'Presensi baru dapat diisi ketua setelah pelatih berhalangan.')
    }
    const students = db
      .prepare('SELECT id FROM students WHERE eskul_id = ? AND active = 1')
      .all(session.eskul_id) as unknown as { id: string }[]
    const now = new Date().toISOString()
    const asSubstitute = user.role === 'ketua' && session.coach_present === 0
    const upsert = db.prepare(
      `INSERT INTO attendance
        (session_id, student_id, status, note, updated_by, as_substitute, updated_at)
       VALUES (?, ?, 'hadir', NULL, ?, ?, ?)
       ON CONFLICT(session_id, student_id) DO UPDATE SET
         status = 'hadir',
         updated_by = excluded.updated_by,
         as_substitute = excluded.as_substitute,
         updated_at = excluded.updated_at`,
    )
    db.exec('BEGIN')
    try {
      for (const student of students) {
        upsert.run(sessionId, student.id, user.id, asSubstitute ? 1 : 0, now)
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    recordActivity(
      user.id,
      'Menandai semua hadir',
      `${eskulName(session.eskul_id)} · ${session.topic} · ${students.length} anggota`,
    )
    sendJson(res, 200, { ok: true, count: students.length })
    return
  }

  const attendanceMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/attendance\/([^/]+)$/)
  if (method === 'PUT' && attendanceMatch) {
    const user = requireAuth(req)
    const body = await readJson(req)
    const sessionId = decodeURIComponent(attendanceMatch[1])
    const studentId = decodeURIComponent(attendanceMatch[2])
    const session = sessionMeta(sessionId)
    assertEskulAccess(user, session.eskul_id, ['pelatih', 'ketua'])
    if (user.role === 'ketua' && session.coach_present !== 0) {
      throw new HttpError(403, 'Presensi baru dapat diisi ketua setelah pelatih berhalangan.')
    }
    const student = studentMeta(studentId)
    if (student.eskul_id !== session.eskul_id) {
      throw new HttpError(400, 'Anggota tidak terdaftar pada eskul sesi ini.')
    }
    const status = parseAttendanceStatus(body.status)
    const note = optionalText(body.note, 500)
    const asSubstitute = user.role === 'ketua' && session.coach_present === 0
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO attendance
        (session_id, student_id, status, note, updated_by, as_substitute, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, student_id) DO UPDATE SET
         status = excluded.status,
         note = excluded.note,
         updated_by = excluded.updated_by,
         as_substitute = excluded.as_substitute,
         updated_at = excluded.updated_at`,
    ).run(sessionId, studentId, status, note ?? null, user.id, asSubstitute ? 1 : 0, now)
    sendJson(res, 200, { ok: true })
    return
  }

  const gradeMatch = pathname.match(/^\/api\/grades\/([^/]+)\/([^/]+)$/)
  if (method === 'PUT' && gradeMatch) {
    const user = requireAuth(req)
    const body = await readJson(req)
    const studentId = decodeURIComponent(gradeMatch[1])
    const semester = decodeURIComponent(gradeMatch[2])
    const student = studentMeta(studentId)
    assertEskulAccess(user, student.eskul_id, ['pelatih'])
    const existing = db
      .prepare('SELECT * FROM grades WHERE student_id = ? AND semester = ?')
      .get(studentId, semester) as unknown as
      | {
          id: string
          keaktifan: number | null
          sikap: number | null
          keterampilan: number | null
          note: string | null
        }
      | undefined
    const keaktifan =
      'keaktifan' in body ? parseScore(body.keaktifan, 'Nilai keaktifan') : (existing?.keaktifan ?? null)
    const sikap =
      'sikap' in body ? parseScore(body.sikap, 'Nilai sikap') : (existing?.sikap ?? null)
    const keterampilan =
      'keterampilan' in body
        ? parseScore(body.keterampilan, 'Nilai keterampilan')
        : (existing?.keterampilan ?? null)
    const note =
      'note' in body ? optionalText(body.note, 2000) : (existing?.note ?? undefined)
    const id = existing?.id ?? safeId(body.id, 'grade')
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO grades
        (id, student_id, semester, keaktifan, sikap, keterampilan, note, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, semester) DO UPDATE SET
         keaktifan = excluded.keaktifan,
         sikap = excluded.sikap,
         keterampilan = excluded.keterampilan,
         note = excluded.note,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
    ).run(id, studentId, semester, keaktifan, sikap, keterampilan, note ?? null, user.id, now)
    sendJson(res, 200, {
      grade: {
        id,
        studentId,
        semester,
        keaktifan,
        sikap,
        keterampilan,
        note,
        updatedBy: user.id,
        updatedAt: now,
      },
    })
    return
  }

  if (method === 'POST' && pathname === '/api/documentation') {
    const user = requireAuth(req)
    const body = await readJson(req)
    const eskulId = requireText(body.eskulId, 'Eskul', 100)
    assertEskulAccess(user, eskulId, ['pelatih', 'ketua'])
    ensureEskulExists(eskulId)
    const title = requireText(body.title, 'Judul dokumentasi', 200)
    const caption = optionalText(body.caption, 3000) ?? ''
    const imageUrl = requireText(body.imageUrl, 'Gambar dokumentasi', 2000)
    const date = requireDate(body.date, 'Tanggal')
    const sessionId = optionalText(body.sessionId, 100)
    if (sessionId) {
      const session = sessionMeta(sessionId)
      if (session.eskul_id !== eskulId) {
        throw new HttpError(400, 'Sesi dokumentasi tidak berasal dari eskul yang sama.')
      }
    }
    const id = safeId(body.id, 'doc')
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO documentation
        (id, eskul_id, session_id, title, caption, image_url, date, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, eskulId, sessionId ?? null, title, caption, imageUrl, date, user.id, now)
    recordActivity(user.id, 'Mengunggah dokumentasi', `${eskulName(eskulId)} · ${title}`)
    sendJson(res, 201, {
      documentation: {
        id,
        eskulId,
        sessionId: sessionId ?? undefined,
        title,
        caption,
        imageUrl,
        date,
        uploadedBy: user.id,
        createdAt: now,
      },
    })
    return
  }

  const documentationMatch = pathname.match(/^\/api\/documentation\/([^/]+)$/)
  if (method === 'DELETE' && documentationMatch) {
    const user = requireAuth(req)
    const documentationId = decodeURIComponent(documentationMatch[1])
    const doc = db
      .prepare('SELECT id, eskul_id, title FROM documentation WHERE id = ?')
      .get(documentationId) as unknown as
      | { id: string; eskul_id: string; title: string }
      | undefined
    if (!doc) throw new HttpError(404, 'Dokumentasi tidak ditemukan.')
    assertEskulAccess(user, doc.eskul_id, ['pelatih', 'ketua'])
    db.prepare('DELETE FROM documentation WHERE id = ?').run(documentationId)
    recordActivity(
      user.id,
      'Menghapus dokumentasi',
      `${eskulName(doc.eskul_id)} · ${doc.title}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && pathname === '/api/permits') {
    const user = requireAuth(req)
    const body = await readJson(req)
    const eskulId = requireText(body.eskulId, 'Eskul', 100)
    assertEskulAccess(user, eskulId, ['pelatih', 'ketua'])
    ensureEskulExists(eskulId)
    const type = parsePermitType(body.type)
    const title = requireText(body.title, 'Judul perizinan', 200)
    const description = requireText(body.description, 'Deskripsi', 3000)
    const startDate = requireDate(body.startDate, 'Tanggal mulai')
    const endDate = requireDate(body.endDate, 'Tanggal selesai')
    if (endDate < startDate) {
      throw new HttpError(400, 'Tanggal selesai tidak boleh sebelum tanggal mulai.')
    }
    const location = requireText(body.location, 'Lokasi', 200)
    const id = safeId(body.id, 'perm')
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO permits
        (id, eskul_id, type, title, description, start_date, end_date, location, status, created_by, created_at, decided_by, decided_at, decision_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'diajukan', ?, ?, NULL, NULL, NULL)`,
    ).run(id, eskulId, type, title, description, startDate, endDate, location, user.id, now)
    recordActivity(user.id, 'Mengajukan perizinan', `${eskulName(eskulId)} · ${title}`)
    sendJson(res, 201, {
      permit: {
        id,
        eskulId,
        type,
        title,
        description,
        startDate,
        endDate,
        location,
        status: 'diajukan',
        createdBy: user.id,
        createdAt: now,
      },
    })
    return
  }

  const permitReviewMatch = pathname.match(/^\/api\/permits\/([^/]+)\/review$/)
  if (method === 'PATCH' && permitReviewMatch) {
    const user = requireAuth(req)
    requireRole(user, ['wakasek', 'admin'])
    const body = await readJson(req)
    const permitId = decodeURIComponent(permitReviewMatch[1])
    const decision = body.decision
    if (decision !== 'disetujui' && decision !== 'ditolak') {
      throw new HttpError(400, 'Keputusan perizinan tidak valid.')
    }
    const permit = db
      .prepare('SELECT id, eskul_id, title, status FROM permits WHERE id = ?')
      .get(permitId) as unknown as
      | { id: string; eskul_id: string; title: string; status: string }
      | undefined
    if (!permit) throw new HttpError(404, 'Perizinan tidak ditemukan.')
    if (permit.status !== 'diajukan') {
      throw new HttpError(409, 'Perizinan ini sudah pernah diputuskan.')
    }
    const note = optionalText(body.note, 2000) ?? ''
    if (decision === 'ditolak' && !note) {
      throw new HttpError(400, 'Alasan penolakan wajib diisi.')
    }
    const now = new Date().toISOString()
    db.prepare(
      `UPDATE permits
       SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?
       WHERE id = ?`,
    ).run(decision, user.id, now, note || null, permitId)
    recordActivity(
      user.id,
      decision === 'disetujui' ? 'Menyetujui perizinan' : 'Menolak perizinan',
      `${eskulName(permit.eskul_id)} · ${permit.title}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  const permitCompleteMatch = pathname.match(/^\/api\/permits\/([^/]+)\/complete$/)
  if (method === 'PATCH' && permitCompleteMatch) {
    const user = requireAuth(req)
    const permitId = decodeURIComponent(permitCompleteMatch[1])
    const permit = db
      .prepare('SELECT id, eskul_id, title, status FROM permits WHERE id = ?')
      .get(permitId) as unknown as
      | { id: string; eskul_id: string; title: string; status: string }
      | undefined
    if (!permit) throw new HttpError(404, 'Perizinan tidak ditemukan.')
    if (user.role !== 'admin' && user.role !== 'wakasek' && user.eskulId !== permit.eskul_id) {
      throw new HttpError(403, 'Anda tidak memiliki akses ke perizinan ini.')
    }
    if (permit.status !== 'disetujui') {
      throw new HttpError(409, 'Hanya perizinan yang disetujui dapat ditandai selesai.')
    }
    db.prepare("UPDATE permits SET status = 'selesai' WHERE id = ?").run(permitId)
    recordActivity(
      user.id,
      'Menandai kegiatan selesai',
      `${eskulName(permit.eskul_id)} · ${permit.title}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && pathname === '/api/students') {
    const user = requireAuth(req)
    const body = await readJson(req)
    const eskulId = requireText(body.eskulId, 'Eskul', 100)
    assertEskulAccess(user, eskulId, ['pelatih', 'ketua'])
    ensureEskulExists(eskulId)
    const name = requireText(body.name, 'Nama anggota', 200)
    const nis = requireText(body.nis, 'NIS', 50)
    const className = requireText(body.className, 'Kelas', 50)
    const gender = parseGender(body.gender)
    const duplicate = db.prepare('SELECT id FROM students WHERE nis = ?').get(nis) as unknown as
      | { id: string }
      | undefined
    if (duplicate) throw new HttpError(409, 'NIS sudah terdaftar.')
    const id = safeId(body.id, 'st')
    const joinedAt =
      typeof body.joinedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.joinedAt)
        ? body.joinedAt
        : new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT INTO students (id, name, nis, class_name, gender, eskul_id, active, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(id, name, nis, className, gender, eskulId, joinedAt)
    recordActivity(user.id, 'Menambahkan anggota', `${eskulName(eskulId)} · ${name}`)
    sendJson(res, 201, {
      student: { id, name, nis, className, gender, eskulId, active: true, joinedAt },
    })
    return
  }

  const studentActiveMatch = pathname.match(/^\/api\/students\/([^/]+)\/active$/)
  if (method === 'PATCH' && studentActiveMatch) {
    const user = requireAuth(req)
    const body = await readJson(req)
    const studentId = decodeURIComponent(studentActiveMatch[1])
    const student = studentMeta(studentId)
    assertEskulAccess(user, student.eskul_id, ['pelatih', 'ketua'])
    const active = parseBoolean(body.active, 'Status anggota')
    db.prepare('UPDATE students SET active = ? WHERE id = ?').run(active ? 1 : 0, studentId)
    recordActivity(
      user.id,
      active ? 'Mengaktifkan anggota' : 'Menonaktifkan anggota',
      `Siswa · ${student.name}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && pathname === '/api/admin/users') {
    const actor = requireAuth(req)
    requireRole(actor, ['admin'])
    const body = await readJson(req)
    const name = requireText(body.name, 'Nama pengguna', 200)
    const email = requireEmail(body.email)
    const password = requirePassword(body.password)
    const role = parseRole(body.role)
    const phone = optionalText(body.phone, 50)
    if (emailInUse(email)) throw new HttpError(409, 'Email sudah digunakan pengguna lain.')
    let eskulId: string | undefined
    if (role === 'pelatih' || role === 'ketua') {
      eskulId = requireText(body.eskulId, 'Eskul', 100)
      ensureEskulExists(eskulId)
    }
    const id = safeId(body.id, 'u')
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO users
        (id, name, email, password_hash, role, eskul_id, phone, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id,
      name,
      email,
      hashPassword(password),
      role,
      eskulId ?? null,
      phone ?? null,
      now,
      now,
    )
    recordActivity(actor.id, 'Menambahkan pengguna', `${name} · ${role}`)
    sendJson(res, 201, { user: publicUserById(id) })
    return
  }

  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
  if (method === 'PATCH' && adminUserMatch) {
    const actor = requireAuth(req)
    requireRole(actor, ['admin'])
    const userId = decodeURIComponent(adminUserMatch[1])
    const current = getUserById(userId)
    if (!current) throw new HttpError(404, 'Pengguna tidak ditemukan.')
    const body = await readJson(req)
    const name = body.name === undefined ? current.name : requireText(body.name, 'Nama pengguna', 200)
    const email =
      body.email === undefined ? current.email : requireEmail(body.email)
    const role = body.role === undefined ? current.role : parseRole(body.role)
    const active =
      body.active === undefined ? Boolean(current.active) : parseBoolean(body.active, 'Status pengguna')
    const phone =
      body.phone === undefined ? current.phone ?? null : (optionalText(body.phone, 50) ?? null)
    let eskulId: string | null
    if (role === 'pelatih' || role === 'ketua') {
      eskulId =
        body.eskulId === undefined || body.eskulId === null
          ? (current.eskul_id ?? null)
          : requireText(body.eskulId, 'Eskul', 100)
      if (!eskulId) throw new HttpError(400, 'Eskul wajib dipilih untuk peran ini.')
      ensureEskulExists(eskulId)
    } else {
      eskulId = null
    }
    if (emailInUse(email, userId)) {
      throw new HttpError(409, 'Email sudah digunakan pengguna lain.')
    }
    if (userId === actor.id && (role !== 'admin' || !active)) {
      throw new HttpError(400, 'Anda tidak dapat menurunkan atau menonaktifkan akun sendiri.')
    }
    assertLastAdminRemains(userId, role, active)
    const now = new Date().toISOString()
    db.prepare(
      `UPDATE users
       SET name = ?, email = ?, role = ?, eskul_id = ?, phone = ?, active = ?, updated_at = ?
       WHERE id = ?`,
    ).run(name, email, role, eskulId, phone, active ? 1 : 0, now, userId)
    if (!active) {
      db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId)
    }
    recordActivity(actor.id, 'Memperbarui pengguna', `${name} · ${role}`)
    sendJson(res, 200, { user: publicUserById(userId) })
    return
  }

  const adminPasswordMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/)
  if (method === 'POST' && adminPasswordMatch) {
    const actor = requireAuth(req)
    requireRole(actor, ['admin'])
    const userId = decodeURIComponent(adminPasswordMatch[1])
    if (!getUserById(userId)) throw new HttpError(404, 'Pengguna tidak ditemukan.')
    const body = await readJson(req)
    const password = requirePassword(body.password)
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      hashPassword(password),
      new Date().toISOString(),
      userId,
    )
    if (userId !== actor.id) {
      db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId)
    }
    recordActivity(actor.id, 'Mereset kata sandi', `Pengguna ${userId}`)
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && pathname === '/api/admin/reset-data') {
    const actor = requireAuth(req)
    requireRole(actor, ['admin'])
    resetDemoData(actor.id)
    sendJson(res, 200, { ok: true })
    return
  }

  throw new HttpError(404, 'Endpoint API tidak ditemukan.')
}

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
}

async function sendFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  cache: boolean,
) {
  const content = await readFile(filePath)
  res.statusCode = 200
  res.setHeader('Content-Type', contentTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream')
  res.setHeader('Content-Length', content.byteLength)
  res.setHeader('Cache-Control', cache ? 'public, max-age=31536000, immutable' : 'no-cache')
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  res.end(content)
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'Metode tidak diizinkan.')
  }
  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    throw new HttpError(400, 'Alamat tidak valid.')
  }
  if (pathname === '/') pathname = '/index.html'
  const filePath = resolve(distDir, `.${pathname}`)
  const rootPrefix = distDir.endsWith(sep) ? distDir : `${distDir}${sep}`
  if (filePath !== distDir && !filePath.startsWith(rootPrefix)) {
    throw new HttpError(403, 'Akses ditolak.')
  }
  try {
    const info = await stat(filePath)
    if (info.isFile()) {
      await sendFile(req, res, filePath, pathname.startsWith('/assets/'))
      return
    }
  } catch {
    // Fall through to the SPA entry point.
  }
  if (pathname.startsWith('/assets/')) {
    throw new HttpError(404, 'Aset tidak ditemukan.')
  }
  const indexPath = join(distDir, 'index.html')
  try {
    await sendFile(req, res, indexPath, false)
  } catch {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(
      'SIMSKUL API berjalan, tetapi hasil build frontend belum tersedia.\n' +
        'Jalankan "npm run build" lalu buka kembali halaman ini.\n' +
        'Untuk pengembangan, gunakan "npm run dev" dan buka http://localhost:5173.',
    )
  }
}

const server = createServer(async (req, res) => {
  setSecurityHeaders(res)
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url)
      return
    }
    await serveStatic(req, res, url)
  } catch (error) {
    if (res.headersSent) {
      res.end()
      return
    }
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.message })
      return
    }
    console.error('[simskul] unhandled error:', error)
    sendJson(res, 500, { error: 'Terjadi kesalahan pada server.' })
  }
})

server.listen(port, () => {
  const passwordHint =
    process.env.SIMSKUL_ADMIN_PASSWORD || process.env.SIMSKUL_DEMO_PASSWORD
      ? 'kata sandi mengikuti variabel lingkungan'
      : 'admin: admin123 · demo: simskul123'
  console.log(`[simskul] API + web server berjalan di http://localhost:${port}`)
  console.log(`[simskul] Database SQLite: ${dbPath}`)
  console.log(`[simskul] Akun awal — ${passwordHint}`)
  if (wasSeeded) console.log('[simskul] Database baru diisi dengan data demo.')
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
