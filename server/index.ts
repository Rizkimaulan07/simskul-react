import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { read, utils } from 'xlsx'
import type {
  AchievementLevel,
  AchievementRank,
  AttendanceStatus,
  EskulColor,
  Gender,
  PermitType,
  Role,
  User,
} from '../src/lib/types.ts'
import { WEEKDAY_OPTIONS } from '../src/lib/constants.ts'
import {
  closeDatabase,
  databaseLabel,
  db,
  getUserByEmail,
  getUserById,
  getUserBySessionToken,
  ready,
  readState,
  recordActivity,
  resetDemoData,
  toPublicUser,
  transaction,
} from './db.ts'
import { readMultipart } from './utils.ts'

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
const maxDocumentationImageBytes = 6 * 1024 * 1024
const documentationImageTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const ESKUL_COLORS: EskulColor[] = ['emerald', 'sky', 'rose', 'amber', 'violet']

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

async function getSessionUser(req: IncomingMessage): Promise<User | null> {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[sessionCookie]
  if (!token) return null
  return getUserBySessionToken(hashToken(token))
}

async function requireAuth(req: IncomingMessage): Promise<User> {
  const user = await getSessionUser(req)
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

/** Tanggal hari ini menurut waktu lokal server dalam format YYYY-MM-DD. */
function currentDateISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  if (value === 'admin' || value === 'pelatih' || value === 'ketua') {
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

function parseAchievementLevel(value: unknown): AchievementLevel {
  if (
    value === 'sekolah' ||
    value === 'kecamatan' ||
    value === 'kota' ||
    value === 'provinsi' ||
    value === 'nasional' ||
    value === 'internasional'
  ) {
    return value
  }
  throw new HttpError(400, 'Tingkat prestasi tidak valid.')
}

function parseAchievementRank(value: unknown): AchievementRank {
  if (
    value === 'juara_1' ||
    value === 'juara_2' ||
    value === 'juara_3' ||
    value === 'harapan_1' ||
    value === 'harapan_2' ||
    value === 'harapan_3' ||
    value === 'peserta'
  ) {
    return value
  }
  throw new HttpError(400, 'Peringkat prestasi tidak valid.')
}

function parseScore(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') return null
  const score = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new HttpError(400, `${label} harus bernilai antara 0 sampai 100.`)
  }
  return Math.round(score)
}

function parseQuota(value: unknown, label: string) {
  const quota = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(quota) || quota < 1 || quota > 999) {
    throw new HttpError(400, `${label} harus berupa angka bulat antara 1 sampai 999.`)
  }
  return quota
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

async function eskulName(eskulId: string) {
  const row = await db
    .prepare('SELECT name FROM eskul WHERE id = ? LIMIT 1')
    .get(eskulId) as unknown as { name: string } | undefined
  return row?.name ?? 'Eskul'
}

async function sessionMeta(sessionId: string) {
  const row = await db
    .prepare('SELECT id, eskul_id, topic, coach_present FROM sessions WHERE id = ? LIMIT 1')
    .get(sessionId) as unknown as
    | { id: string; eskul_id: string; topic: string; coach_present: number | null }
    | undefined
  if (!row) throw new HttpError(404, 'Sesi tidak ditemukan.')
  return row
}

async function studentMeta(studentId: string) {
  const row = await db
    .prepare('SELECT id, name, eskul_id, active FROM students WHERE id = ? LIMIT 1')
    .get(studentId) as unknown as
    | { id: string; name: string; eskul_id: string; active: number }
    | undefined
  if (!row) throw new HttpError(404, 'Anggota tidak ditemukan.')
  return row
}

async function ensureEskulExists(eskulId: string) {
  const row = await db
    .prepare('SELECT id FROM eskul WHERE id = ? LIMIT 1')
    .get(eskulId) as unknown as { id: string } | undefined
  if (!row) throw new HttpError(400, 'Eskul tidak ditemukan.')
  return row.id
}

async function createSessionForUser(userId: string) {
  const token = createSessionToken()
  const now = new Date()
  const expires = new Date(now.getTime() + sessionTtlMs)
  await db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now.toISOString())
  await db
    .prepare(
      'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
    .run(hashToken(token), userId, now.toISOString(), expires.toISOString())
  return token
}

async function publicUserById(userId: string): Promise<User> {
  const row = await getUserById(userId)
  if (!row) throw new HttpError(404, 'Pengguna tidak ditemukan.')
  return toPublicUser(row)
}

async function emailInUse(email: string, exceptUserId?: string) {
  const existing = await getUserByEmail(email)
  return Boolean(existing && existing.id !== exceptUserId)
}

async function assertLastAdminRemains(userId: string, nextRole: Role, nextActive: boolean) {
  const current = await getUserById(userId)
  if (!current || current.role !== 'admin') return
  if (nextRole === 'admin' && nextActive) return
  const count = await db
    .prepare(
      "SELECT COUNT(*)::int AS total FROM users WHERE role = 'admin' AND active = 1 AND id <> ?",
    )
    .get(userId) as unknown as { total: number }
  if (count.total === 0) {
    throw new HttpError(400, 'Minimal harus ada satu administrator aktif.')
  }
}

/* ------------------------------------------------------------------ */
/* Eskul management helpers                                            */
/* ------------------------------------------------------------------ */

function parseEskulColor(value: unknown): EskulColor {
  if (typeof value === 'string' && (ESKUL_COLORS as string[]).includes(value)) {
    return value as EskulColor
  }
  throw new HttpError(400, 'Warna eskul tidak valid.')
}

function parseWeekday(value: unknown): string {
  if (typeof value === 'string' && (WEEKDAY_OPTIONS as readonly string[]).includes(value)) {
    return value
  }
  throw new HttpError(400, 'Hari latihan tidak valid.')
}

function optionalUserId(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new HttpError(400, `${label} tidak valid.`)
  return value
}

/** Clears an old pairing on another eskul without touching auth data. */
async function detachUserFromOtherEskuls(userId: string, currentEskulId: string | null) {
  await db.prepare(
    'UPDATE eskul SET coach_id = NULL WHERE coach_id = ? AND id <> ?',
  ).run(userId, currentEskulId ?? '')
  await db.prepare(
    'UPDATE eskul SET leader_id = NULL WHERE leader_id = ? AND id <> ?',
  ).run(userId, currentEskulId ?? '')
}

async function resolveEskulPersons(body: Record<string, unknown>) {
  const coachId = optionalUserId(body.coachId, 'Pelatih')
  const leaderId = optionalUserId(body.leaderId, 'Ketua')
  if (coachId) {
    const coach = await getUserById(coachId)
    if (!coach) throw new HttpError(400, 'Pelatih yang dipilih tidak ditemukan.')
    if (coach.role !== 'pelatih') {
      throw new HttpError(400, 'Pelatih harus memiliki peran Pelatih Eskul.')
    }
  }
  if (leaderId) {
    const leader = await getUserById(leaderId)
    if (!leader) throw new HttpError(400, 'Ketua yang dipilih tidak ditemukan.')
    if (leader.role !== 'ketua') {
      throw new HttpError(400, 'Ketua eskul harus memiliki peran Ketua Eskul.')
    }
  }
  return { coachId, leaderId }
}

/** Keeps `users.eskul_id` aligned with the eskul's coach/leader assignment. */
async function syncAssignedUsers(eskulId: string, coachId: string | null, leaderId: string | null) {
  if (coachId) {
    await detachUserFromOtherEskuls(coachId, eskulId)
    await db
      .prepare('UPDATE users SET eskul_id = ?, updated_at = ? WHERE id = ?')
      .run(eskulId, new Date().toISOString(), coachId)
  }
  if (leaderId) {
    await detachUserFromOtherEskuls(leaderId, eskulId)
    await db
      .prepare('UPDATE users SET eskul_id = ?, updated_at = ? WHERE id = ?')
      .run(eskulId, new Date().toISOString(), leaderId)
  }
}

/* ------------------------------------------------------------------ */
/* API routing                                                         */
/* ------------------------------------------------------------------ */

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  await ready()

  const method = req.method ?? 'GET'
  const pathname = url.pathname

  if (method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      database: 'postgresql',
      connection: databaseLabel(),
      time: new Date().toISOString(),
    })
    return
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJson(req)
    const email = requireEmail(body.email)
    const password = requirePassword(body.password)
    const row = await getUserByEmail(email)
    if (!row || !row.active || !verifyPassword(password, row.password_hash)) {
      throw new HttpError(401, 'Email atau kata sandi salah.')
    }
    const token = await createSessionForUser(row.id)
    res.setHeader('Set-Cookie', sessionCookieHeader(token, Math.floor(sessionTtlMs / 1000)))
    sendJson(res, 200, { user: toPublicUser(row) })
    return
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const cookies = parseCookies(req.headers.cookie)
    const token = cookies[sessionCookie]
    if (token) {
      await db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token))
    }
    res.setHeader('Set-Cookie', sessionCookieHeader('', 0))
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'GET' && pathname === '/api/auth/me') {
    const user = await requireAuth(req)
    sendJson(res, 200, { user })
    return
  }

  if (method === 'PATCH' && pathname === '/api/profile') {
    const user = await requireAuth(req)
    const current = await getUserById(user.id)
    if (!current) throw new HttpError(404, 'Pengguna tidak ditemukan.')
    const body = await readJson(req)
    const name = body.name === undefined ? current.name : requireText(body.name, 'Nama lengkap', 200)
    const email = body.email === undefined ? current.email : requireEmail(body.email)
    const phone =
      body.phone === undefined
        ? (current.phone ?? null)
        : (optionalText(body.phone, 50) ?? null)
    if (await emailInUse(email, user.id)) {
      throw new HttpError(409, 'Email sudah digunakan pengguna lain.')
    }
    await db
      .prepare('UPDATE users SET name = ?, email = ?, phone = ?, updated_at = ? WHERE id = ?')
      .run(name, email, phone, new Date().toISOString(), user.id)
    recordActivity(user.id, 'Memperbarui profil', name)
    sendJson(res, 200, { user: await publicUserById(user.id) })
    return
  }

  if (method === 'POST' && pathname === '/api/profile/password') {
    const user = await requireAuth(req)
    const current = await getUserById(user.id)
    if (!current) throw new HttpError(404, 'Pengguna tidak ditemukan.')
    const body = await readJson(req)
    const currentPassword =
      typeof body.currentPassword === 'string' ? body.currentPassword : ''
    if (!verifyPassword(currentPassword, current.password_hash)) {
      throw new HttpError(400, 'Kata sandi saat ini tidak sesuai.')
    }
    const newPassword = requirePassword(body.newPassword)
    if (verifyPassword(newPassword, current.password_hash)) {
      throw new HttpError(400, 'Kata sandi baru harus berbeda dari kata sandi saat ini.')
    }
    await db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashPassword(newPassword), new Date().toISOString(), user.id)
    // Invalidate every existing session, then keep the current device signed in.
    await db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(user.id)
    const token = await createSessionForUser(user.id)
    res.setHeader('Set-Cookie', sessionCookieHeader(token, Math.floor(sessionTtlMs / 1000)))
    recordActivity(user.id, 'Mengganti kata sandi', 'Keamanan akun diperbarui')
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'GET' && pathname === '/api/bootstrap') {
    const user = await requireAuth(req)
    sendJson(res, 200, { user, ...(await readState()) })
    return
  }

  /* ---------------------- Eskul management ------------------------ */

  if (method === 'POST' && pathname === '/api/eskul') {
    const actor = await requireAuth(req)
    requireRole(actor, ['admin'])
    const body = await readJson(req)
    const name = requireText(body.name, 'Nama eskul', 200)
    const shortName = requireText(body.shortName, 'Singkatan eskul', 10)
    const description = requireText(body.description, 'Deskripsi eskul', 2000)
    const color = parseEskulColor(body.color)
    const day = parseWeekday(body.day)
    const time = requireText(body.time, 'Jam latihan', 100)
    const location = requireText(body.location, 'Lokasi latihan', 200)
    const quota = parseQuota(body.quota, 'Kuota anggota')
    const { coachId, leaderId } = await resolveEskulPersons(body)

    const id = safeId(body.id, 'eskul')
    await db
      .prepare(
        `INSERT INTO eskul
          (id, name, short_name, description, color, day, time, location, coach_id, leader_id, quota)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, name, shortName, description, color, day, time, location, coachId, leaderId, quota)
    await syncAssignedUsers(id, coachId, leaderId)
    recordActivity(actor.id, 'Menambahkan eskul', `${name} · ${day} ${time}`)
    sendJson(res, 201, { eskul: { id, name } })
    return
  }

  const eskulPatchMatch = pathname.match(/^\/api\/eskul\/([^/]+)$/)
  if (method === 'PATCH' && eskulPatchMatch) {
    const actor = await requireAuth(req)
    requireRole(actor, ['admin'])
    const eskulId = decodeURIComponent(eskulPatchMatch[1])
    const current = await db
      .prepare('SELECT * FROM eskul WHERE id = ? LIMIT 1')
      .get(eskulId) as unknown as
      | {
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
      | undefined
    if (!current) throw new HttpError(404, 'Eskul tidak ditemukan.')
    const body = await readJson(req)
    const name = 'name' in body ? requireText(body.name, 'Nama eskul', 200) : current.name
    const shortName =
      'shortName' in body ? requireText(body.shortName, 'Singkatan eskul', 10) : current.short_name
    const description =
      'description' in body
        ? requireText(body.description, 'Deskripsi eskul', 2000)
        : current.description
    const color =
      'color' in body ? parseEskulColor(body.color) : current.color
    const day = 'day' in body ? parseWeekday(body.day) : current.day
    const time = 'time' in body ? requireText(body.time, 'Jam latihan', 100) : current.time
    const location =
      'location' in body ? requireText(body.location, 'Lokasi latihan', 200) : current.location
    const quota = 'quota' in body ? parseQuota(body.quota, 'Kuota anggota') : current.quota
    const { coachId, leaderId } = await resolveEskulPersons(body)

    await db
      .prepare(
        `UPDATE eskul
         SET name = ?, short_name = ?, description = ?, color = ?, day = ?, time = ?,
             location = ?, coach_id = ?, leader_id = ?, quota = ?
         WHERE id = ?`,
      )
      .run(
        name,
        shortName,
        description,
        color,
        day,
        time,
        location,
        coachId,
        leaderId,
        quota,
        eskulId,
      )
    await syncAssignedUsers(eskulId, coachId, leaderId)
    recordActivity(actor.id, 'Memperbarui eskul', name)
    sendJson(res, 200, { ok: true })
    return
  }

  const eskulDeleteMatch = pathname.match(/^\/api\/eskul\/([^/]+)$/)
  if (method === 'DELETE' && eskulDeleteMatch) {
    const actor = await requireAuth(req)
    requireRole(actor, ['admin'])
    const eskulId = decodeURIComponent(eskulDeleteMatch[1])
    const row = await db
      .prepare('SELECT id, name FROM eskul WHERE id = ? LIMIT 1')
      .get(eskulId) as unknown as { id: string; name: string } | undefined
    if (!row) throw new HttpError(404, 'Eskul tidak ditemukan.')
    await db.prepare('UPDATE users SET eskul_id = NULL WHERE eskul_id = ?').run(eskulId)
    await db.prepare('DELETE FROM eskul WHERE id = ?').run(eskulId)
    recordActivity(actor.id, 'Menghapus eskul', row.name)
    sendJson(res, 200, { ok: true })
    return
  }

  /* ---------------------- Excel import ------------------------ */

  if (method === 'POST' && pathname === '/api/eskul/import') {
    try {
      const actor = await requireAuth(req)
      requireRole(actor, ['admin'])
      const body = await readMultipart(req)
      const fileEntry = body.files.find((f) => f.fieldname === 'file')
      if (!fileEntry) throw new HttpError(400, 'File Excel tidak ditemukan.')
      if (fileEntry.data.length > maxBodyBytes) {
        throw new HttpError(413, 'File Excel terlalu besar.')
      }

      const workbook = read(fileEntry.data, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) throw new HttpError(400, 'File Excel kosong.')

      const jsonRows = utils.sheet_to_json<ImportRow>(sheet, { defval: '' })
      const results = [] as { status: 'ok' | 'error'; eskul?: { id: string; name: string }; error?: string }[]
      const summary = { success: 0, error: 0, total: 0 } as { success: number; error: number; total: number }

      for (let i = 0; i < jsonRows.length; i += 1) {
        const row = jsonRows[i]
        summary.total += 1
        try {
          const name = String(row.name || '').trim()
          const shortName = String(row.shortName || '').trim()
          if (!name) throw new HttpError(400, `Baris ${i + 2}: kolom "name" wajib diisi.`)
          if (!shortName) throw new HttpError(400, `Baris ${i + 2}: kolom "shortName" wajib diisi.`)

          const color = parseEskulColor(String(row.color || 'emerald'))
          const day = parseWeekday(String(row.day || ''))
          const time = String(row.time || '').trim()
          const location = String(row.location || '').trim()
          const quota =
            typeof row.quota === 'number' ? row.quota : Number(row.quota)
          if (!Number.isInteger(quota) || quota < 1 || quota > 999) {
            throw new HttpError(400, `Baris ${i + 2}: kolom "quota" harus bilangan bulat 1–999.`)
          }

          const { coachId, leaderId } = await resolveEskulPersonsByNames({
            coachName: String(row.coachName || '').trim(),
            leaderName: String(row.leaderName || '').trim(),
          })

          const id = safeId(row.id, 'eskul')
          await db
            .prepare(
              `INSERT INTO eskul
                (id, name, short_name, description, color, day, time, location, coach_id, leader_id, quota)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(id, name, shortName, String(row.description || ''), color, day, time, location, coachId, leaderId, quota)
          await syncAssignedUsers(id, coachId, leaderId)
          recordActivity(actor.id, 'Import eskul dari Excel', `${name} · ${day} ${time}`)

          results.push({ status: 'ok', eskul: { id, name } })
          summary.success += 1
        } catch (error) {
          const e = error as { status?: number; message?: string }
          results.push({ status: 'error', error: e.message ?? String(error) })
          summary.error += 1
        }
      }

      sendJson(res, 200, { results, summary })
      return
    } catch (error) {
      console.error('[handleApi] uncaught error:', error)
      throw error
    }
  }

  /* ---------------------- Combined Excel import ------------------------ */

  if (method === 'POST' && pathname === '/api/import') {
    try {
      const actor = await requireAuth(req)
      requireRole(actor, ['admin'])
      const body = await readMultipart(req)
      const fileEntry = body?.files?.find((f) => f.fieldname === 'file')
      if (!fileEntry) throw new HttpError(400, 'File Excel tidak ditemukan.')
      if (fileEntry.data.length > maxBodyBytes) {
        throw new HttpError(413, 'File Excel terlalu besar.')
      }

      const workbook = read(fileEntry.data, { type: 'buffer' })
      const results: Record<string, { status: 'ok' | 'error'; error?: string }[]> = {}
      const summary = { success: 0, error: 0, total: 0 } as { success: number; error: number; total: number }

      const sheetRank = (name: string) => {
        const index = ['eskul', 'pelatih', 'ketua', 'anggota'].indexOf(name.trim().toLowerCase())
        return index === -1 ? 99 : index
      }
      for (const sheetName of [...workbook.SheetNames].sort((a, b) => sheetRank(a) - sheetRank(b))) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue

        const jsonRows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        const type = sheetName.trim().toLowerCase()
        const resultKey =
          type === 'eskul'
            ? 'Eskul'
            : type === 'pelatih'
              ? 'Pelatih'
              : type === 'ketua'
                ? 'Ketua'
                : type === 'anggota'
                  ? 'Anggota'
                  : sheetName
        const typeResults = [] as { status: 'ok' | 'error'; error?: string }[]

        for (let i = 0; i < jsonRows.length; i += 1) {
          const row = jsonRows[i]
          summary.total += 1
          try {
            if (type === 'eskul') {
              const name = String(row.name || '').trim()
              const shortName = String(row.shortName || '').trim()
              if (!name) throw new HttpError(400, `Baris ${i + 2}: kolom "name" wajib diisi.`)
              if (!shortName) throw new HttpError(400, `Baris ${i + 2}: kolom "shortName" wajib diisi.`)
              const color = parseEskulColor(String(row.color || 'emerald'))
              const day = parseWeekday(String(row.day || ''))
              const time = String(row.time || '').trim()
              const location = String(row.location || '').trim()
              const quota =
                typeof row.quota === 'number' ? row.quota : Number(row.quota)
              if (!Number.isInteger(quota) || quota < 1 || quota > 999) {
                throw new HttpError(400, `Baris ${i + 2}: kolom "quota" harus bilangan bulat 1–999.`)
              }
              const coachName = String(row.coachName || '').trim()
              const leaderName = String(row.leaderName || '').trim()
              const { coachId, leaderId } = await resolveEskulPersonsByNames({
                coachName,
                leaderName,
              })
              const description = String(row.description || '')
              const existing = (await db
                .prepare(
                  'SELECT id, coach_id, leader_id FROM eskul WHERE lower(name) = lower(?) ORDER BY seq ASC LIMIT 1',
                )
                .get(name)) as unknown as
                | { id: string; coach_id: string | null; leader_id: string | null }
                | undefined
              const id = existing?.id ?? safeId(row.id, 'eskul')
              const nextCoachId = existing && !coachName ? existing.coach_id : coachId
              const nextLeaderId = existing && !leaderName ? existing.leader_id : leaderId
              if (existing) {
                await db
                  .prepare(
                    `UPDATE eskul
                     SET name = ?, short_name = ?, description = ?, color = ?, day = ?, time = ?,
                         location = ?, coach_id = ?, leader_id = ?, quota = ?
                     WHERE id = ?`,
                  )
                  .run(
                    name,
                    shortName,
                    description,
                    color,
                    day,
                    time,
                    location,
                    nextCoachId,
                    nextLeaderId,
                    quota,
                    id,
                  )
              } else {
                await db
                  .prepare(
                    `INSERT INTO eskul
                      (id, name, short_name, description, color, day, time, location, coach_id, leader_id, quota)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  )
                  .run(
                    id,
                    name,
                    shortName,
                    description,
                    color,
                    day,
                    time,
                    location,
                    nextCoachId,
                    nextLeaderId,
                    quota,
                  )
              }
              await syncAssignedUsers(id, nextCoachId, nextLeaderId)
              if (existing?.coach_id && existing.coach_id !== nextCoachId) {
                await db
                  .prepare('UPDATE users SET eskul_id = NULL WHERE id = ? AND eskul_id = ?')
                  .run(existing.coach_id, id)
              }
              if (existing?.leader_id && existing.leader_id !== nextLeaderId) {
                await db
                  .prepare('UPDATE users SET eskul_id = NULL WHERE id = ? AND eskul_id = ?')
                  .run(existing.leader_id, id)
              }
              recordActivity(
                actor.id,
                existing ? 'Memperbarui eskul dari Excel' : 'Import eskul dari Excel',
                `${name} · ${day} ${time}`,
              )
              typeResults.push({ status: 'ok' })
              summary.success += 1
            } else if (type === 'pelatih') {
              const name = String(row.name || '').trim()
              if (!name) throw new HttpError(400, `Baris ${i + 2}: kolom "name" wajib diisi.`)
              await importStaffRow({
                name,
                email: optionalText(row.email, 180)?.toLowerCase(),
                phone: optionalText(row.phone, 50),
                password: optionalText(row.password, 200),
                role: 'pelatih',
                eskulName: String(row.eskulName || '').trim() || undefined,
              })
              recordActivity(actor.id, 'Import pelatih dari Excel', name)
              typeResults.push({ status: 'ok' })
              summary.success += 1
            } else if (type === 'anggota') {
              const name = String(row.name || '').trim()
              const nis = String(row.nis || '').trim()
              const className = String(row.className || '').trim()
              const genderValue = String(row.gender || '').trim().toUpperCase()
              if (genderValue !== 'L' && genderValue !== 'P') {
                throw new HttpError(400, `Baris ${i + 2}: kolom "gender" harus diisi L atau P.`)
              }
              const gender = parseGender(genderValue)
              const eskulName = String(row.eskulName || '').trim()
              if (!name) throw new HttpError(400, `Baris ${i + 2}: kolom "name" wajib diisi.`)
              if (!nis) throw new HttpError(400, `Baris ${i + 2}: kolom "nis" wajib diisi.`)
              if (!className) throw new HttpError(400, `Baris ${i + 2}: kolom "className" wajib diisi.`)
              if (!eskulName) throw new HttpError(400, `Baris ${i + 2}: kolom "eskulName" wajib diisi.`)
              const eskul = await db.prepare('SELECT id FROM eskul WHERE name = ? LIMIT 1').get(eskulName) as unknown as { id: string } | undefined
              if (!eskul) throw new HttpError(400, `Baris ${i + 2}: eskul "${eskulName}" tidak ditemukan.`)
              const existing = await db.prepare('SELECT id FROM students WHERE nis = ? LIMIT 1').get(nis) as unknown as { id: string } | undefined
              if (existing) throw new HttpError(409, `Baris ${i + 2}: NIS ${nis} sudah terdaftar.`)
              const id = safeId(row.id, 'st')
              const joinedAt = typeof row.joinedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.joinedAt) ? row.joinedAt : new Date().toISOString().slice(0, 10)
              await db
                .prepare(
                  `INSERT INTO students (id, name, nis, class_name, gender, eskul_id, active, joined_at)
                   VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
                )
                .run(id, name, nis, className, gender, eskul.id, joinedAt)
              recordActivity(actor.id, 'Import anggota dari Excel', `${name} · ${eskulName}`)
              typeResults.push({ status: 'ok' })
              summary.success += 1
            } else if (type === 'ketua') {
              const name = String(row.name || '').trim()
              if (!name) throw new HttpError(400, `Baris ${i + 2}: kolom "name" wajib diisi.`)
              await importStaffRow({
                name,
                email: optionalText(row.email, 180)?.toLowerCase(),
                phone: optionalText(row.phone, 50),
                password: optionalText(row.password, 200),
                role: 'ketua',
                eskulName: String(row.eskulName || '').trim() || undefined,
              })
              recordActivity(actor.id, 'Import ketua dari Excel', name)
              typeResults.push({ status: 'ok' })
              summary.success += 1
            } else {
              throw new HttpError(400, `Sheet "${sheetName}" tidak dikenali. Gunakan "Eskul", "Pelatih", "Anggota", atau "Ketua" sebagai nama sheet.`)
            }
          } catch (error) {
            const e = error as { status?: number; message?: string }
            typeResults.push({ status: 'error', error: e.message ?? String(error) })
            summary.error += 1
          }
        }

        results[resultKey] = typeResults
      }

      sendJson(res, 200, { results, summary })
      return
    } catch (error) {
      console.error('[handleApi] uncaught error:', error)
      throw error
    }
  }

  /* ---------------------- Sessions & attendance ------------------- */

  if (method === 'POST' && pathname === '/api/sessions') {
    const user = await requireAuth(req)
    const body = await readJson(req)
    const eskulId = requireText(body.eskulId, 'Eskul', 100)
    assertEskulAccess(user, eskulId, ['pelatih'])
    await ensureEskulExists(eskulId)
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
    await db
      .prepare(
        `INSERT INTO sessions
          (id, eskul_id, date, start_time, end_time, location, topic, notes, coach_present, coach_note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
      )
      .run(id, eskulId, date, startTime, endTime, location, topic, notes ?? null, user.id, now)
    recordActivity(user.id, 'Membuat sesi baru', `${await eskulName(eskulId)} · ${topic}`)
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
    const user = await requireAuth(req)
    const body = await readJson(req)
    const sessionId = decodeURIComponent(coachMatch[1])
    const session = await sessionMeta(sessionId)
    assertEskulAccess(user, session.eskul_id, ['pelatih'])
    const present = parseBoolean(body.present, 'Kehadiran pelatih')
    const note = optionalText(body.note, 2000)
    await db
      .prepare(
        'UPDATE sessions SET coach_present = ?, coach_note = COALESCE(?, coach_note) WHERE id = ?',
      )
      .run(present ? 1 : 0, note ?? null, sessionId)
    recordActivity(
      user.id,
      present ? 'Menandai pelatih hadir' : 'Menandai pelatih berhalangan',
      `${await eskulName(session.eskul_id)} · ${session.topic}${present ? '' : ' · presensi dialihkan ke ketua eskul'}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  const staffAttendanceMatch = pathname.match(
    /^\/api\/sessions\/([^/]+)\/staff-attendance\/([^/]+)$/,
  )
  if (method === 'PUT' && staffAttendanceMatch) {
    const user = await requireAuth(req)
    const body = await readJson(req)
    const sessionId = decodeURIComponent(staffAttendanceMatch[1])
    const staffUserId = decodeURIComponent(staffAttendanceMatch[2])
    const session = await sessionMeta(sessionId)
    assertEskulAccess(user, session.eskul_id, ['pelatih', 'ketua'])
    const eskul = (await db
      .prepare('SELECT coach_id, leader_id FROM eskul WHERE id = ? LIMIT 1')
      .get(session.eskul_id)) as unknown as
      | { coach_id: string | null; leader_id: string | null }
      | undefined
    if (!eskul) throw new HttpError(404, 'Eskul tidak ditemukan.')
    const staffRole =
      eskul.coach_id === staffUserId
        ? ('pelatih' as const)
        : eskul.leader_id === staffUserId
          ? ('ketua' as const)
          : null
    if (!staffRole) {
      throw new HttpError(400, 'Pengguna bukan pelatih atau ketua pada eskul sesi ini.')
    }
    if (user.role === 'ketua') {
      if (staffUserId !== user.id) {
        throw new HttpError(403, 'Ketua eskul hanya dapat mengisi kehadiran dirinya sendiri.')
      }
      if (session.coach_present !== 0) {
        throw new HttpError(403, 'Presensi baru dapat diisi ketua setelah pelatih berhalangan.')
      }
    }
    const status = parseAttendanceStatus(body.status)
    const note = optionalText(body.note, 2000)
    const now = new Date().toISOString()
    await transaction(async (tx) => {
      await tx
        .prepare(
          `INSERT INTO session_staff_attendance
            (session_id, user_id, role, status, note, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(session_id, user_id) DO UPDATE SET
             role = excluded.role,
             status = excluded.status,
             note = excluded.note,
             updated_by = excluded.updated_by,
             updated_at = excluded.updated_at`,
        )
        .run(sessionId, staffUserId, staffRole, status, note ?? null, user.id, now)
      if (staffRole === 'pelatih') {
        await tx
          .prepare('UPDATE sessions SET coach_present = ?, coach_note = ? WHERE id = ?')
          .run(status === 'hadir' ? 1 : 0, status === 'hadir' ? null : (note ?? null), sessionId)
      }
    })
    recordActivity(
      user.id,
      staffRole === 'pelatih'
        ? status === 'hadir'
          ? 'Menandai pelatih hadir'
          : 'Menandai pelatih berhalangan'
        : 'Mengisi kehadiran ketua eskul',
      `${await eskulName(session.eskul_id)} · ${session.topic} · ${staffRole}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  const markAllMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/attendance\/mark-all$/)
  if (method === 'POST' && markAllMatch) {
    const user = await requireAuth(req)
    const sessionId = decodeURIComponent(markAllMatch[1])
    const session = await sessionMeta(sessionId)
    assertEskulAccess(user, session.eskul_id, ['pelatih', 'ketua'])
    if (user.role === 'ketua' && session.coach_present !== 0) {
      throw new HttpError(403, 'Presensi baru dapat diisi ketua setelah pelatih berhalangan.')
    }
    const students = await db
      .prepare('SELECT id FROM students WHERE eskul_id = ? AND active = 1')
      .all(session.eskul_id) as unknown as { id: string }[]
    const now = new Date().toISOString()
    const asSubstitute = user.role === 'ketua' && session.coach_present === 0
    const count = await transaction(async (tx) => {
      const upsert = tx.prepare(
        `INSERT INTO attendance
          (session_id, student_id, status, note, updated_by, as_substitute, updated_at)
         VALUES (?, ?, 'hadir', NULL, ?, ?, ?)
         ON CONFLICT(session_id, student_id) DO UPDATE SET
           status = 'hadir',
           updated_by = excluded.updated_by,
           as_substitute = excluded.as_substitute,
           updated_at = excluded.updated_at`,
      )
      for (const student of students) {
        await upsert.run(sessionId, student.id, user.id, asSubstitute ? 1 : 0, now)
      }
      return students.length
    })
    recordActivity(
      user.id,
      'Menandai semua hadir',
      `${await eskulName(session.eskul_id)} · ${session.topic} · ${count} anggota`,
    )
    sendJson(res, 200, { ok: true, count })
    return
  }

  const attendanceMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/attendance\/([^/]+)$/)
  if (method === 'PUT' && attendanceMatch) {
    const user = await requireAuth(req)
    const body = await readJson(req)
    const sessionId = decodeURIComponent(attendanceMatch[1])
    const studentId = decodeURIComponent(attendanceMatch[2])
    const session = await sessionMeta(sessionId)
    assertEskulAccess(user, session.eskul_id, ['pelatih', 'ketua'])
    if (user.role === 'ketua' && session.coach_present !== 0) {
      throw new HttpError(403, 'Presensi baru dapat diisi ketua setelah pelatih berhalangan.')
    }
    const student = await studentMeta(studentId)
    if (student.eskul_id !== session.eskul_id) {
      throw new HttpError(400, 'Anggota tidak terdaftar pada eskul sesi ini.')
    }
    const status = parseAttendanceStatus(body.status)
    const note = optionalText(body.note, 500)
    const asSubstitute = user.role === 'ketua' && session.coach_present === 0
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO attendance
          (session_id, student_id, status, note, updated_by, as_substitute, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id, student_id) DO UPDATE SET
           status = excluded.status,
           note = excluded.note,
           updated_by = excluded.updated_by,
           as_substitute = excluded.as_substitute,
           updated_at = excluded.updated_at`,
      )
      .run(sessionId, studentId, status, note ?? null, user.id, asSubstitute ? 1 : 0, now)
    sendJson(res, 200, { ok: true })
    return
  }

  const gradeMatch = pathname.match(/^\/api\/grades\/([^/]+)\/([^/]+)$/)
  if (method === 'PUT' && gradeMatch) {
    const user = await requireAuth(req)
    const body = await readJson(req)
    const studentId = decodeURIComponent(gradeMatch[1])
    const semester = decodeURIComponent(gradeMatch[2])
    const student = await studentMeta(studentId)
    assertEskulAccess(user, student.eskul_id, ['pelatih'])
    const existing = await db
      .prepare('SELECT * FROM grades WHERE student_id = ? AND semester = ? LIMIT 1')
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
    await db
      .prepare(
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
      )
      .run(id, studentId, semester, keaktifan, sikap, keterampilan, note ?? null, user.id, now)
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

  /* ------------------ Dokumentasi: unggah gambar -------------------- */

  if (method === 'POST' && pathname === '/api/documentation/images') {
    const user = await requireAuth(req)
    requireRole(user, ['pelatih', 'ketua'])
    let body: Awaited<ReturnType<typeof readMultipart>>
    try {
      body = await readMultipart(req)
    } catch (error) {
      throw new HttpError(
        413,
        error instanceof Error ? error.message : 'Berkas yang diunggah terlalu besar.',
      )
    }
    const file = body.files.find((entry) => entry.fieldname === 'image')
    if (!file) throw new HttpError(400, 'Berkas gambar tidak ditemukan.')
    const contentType = file.contentType.split(';')[0]?.trim().toLowerCase() ?? ''
    if (!documentationImageTypes[contentType]) {
      throw new HttpError(400, 'Format gambar harus JPG, PNG, atau WEBP.')
    }
    if (file.data.length === 0) throw new HttpError(400, 'Berkas gambar kosong.')
    if (file.data.length > maxDocumentationImageBytes) {
      throw new HttpError(413, 'Ukuran gambar maksimal 6 MB.')
    }
    const id = `docimg_${randomUUID()}`
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO documentation_images
          (id, content_type, byte_size, data, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, contentType, file.data.length, file.data, user.id, now)
    sendJson(res, 201, {
      image: {
        id,
        url: `/api/documentation/images/${id}`,
        contentType,
        size: file.data.length,
      },
    })
    return
  }

  const documentationImageMatch = pathname.match(/^\/api\/documentation\/images\/([^/]+)$/)
  if ((method === 'GET' || method === 'HEAD') && documentationImageMatch) {
    await requireAuth(req)
    const imageId = decodeURIComponent(documentationImageMatch[1])
    const row = await db
      .prepare('SELECT content_type, data FROM documentation_images WHERE id = ? LIMIT 1')
      .get(imageId) as unknown as { content_type: string; data: Buffer } | undefined
    if (!row) throw new HttpError(404, 'Gambar dokumentasi tidak ditemukan.')
    const data = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data)
    res.statusCode = 200
    res.setHeader('Content-Type', row.content_type)
    res.setHeader('Content-Length', data.byteLength)
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    res.setHeader('ETag', `"${imageId}"`)
    if (method === 'HEAD') {
      res.end()
      return
    }
    res.end(data)
    return
  }

  if (method === 'POST' && pathname === '/api/documentation') {
    const user = await requireAuth(req)
    const body = await readJson(req)
    const eskulId = requireText(body.eskulId, 'Eskul', 100)
    assertEskulAccess(user, eskulId, ['pelatih', 'ketua'])
    await ensureEskulExists(eskulId)
    const title = requireText(body.title, 'Judul dokumentasi', 200)
    const caption = optionalText(body.caption, 3000) ?? ''
    const imageUrl = requireText(body.imageUrl, 'Gambar dokumentasi', 2000)
    const date = requireDate(body.date, 'Tanggal')
    if (date > currentDateISO()) {
      throw new HttpError(400, 'Tanggal dokumentasi tidak boleh melebihi hari ini.')
    }
    const sessionId = optionalText(body.sessionId, 100)
    if (sessionId) {
      const session = await sessionMeta(sessionId)
      if (session.eskul_id !== eskulId) {
        throw new HttpError(400, 'Sesi dokumentasi tidak berasal dari eskul yang sama.')
      }
    }
    const id = safeId(body.id, 'doc')
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO documentation
          (id, eskul_id, session_id, title, caption, image_url, date, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, eskulId, sessionId ?? null, title, caption, imageUrl, date, user.id, now)
    recordActivity(user.id, 'Mengunggah dokumentasi', `${await eskulName(eskulId)} · ${title}`)
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
    const user = await requireAuth(req)
    const documentationId = decodeURIComponent(documentationMatch[1])
    const doc = await db
      .prepare('SELECT id, eskul_id, title, image_url FROM documentation WHERE id = ? LIMIT 1')
      .get(documentationId) as unknown as
      | { id: string; eskul_id: string; title: string; image_url: string }
      | undefined
    if (!doc) throw new HttpError(404, 'Dokumentasi tidak ditemukan.')
    assertEskulAccess(user, doc.eskul_id, ['pelatih', 'ketua'])
    await db.prepare('DELETE FROM documentation WHERE id = ?').run(documentationId)
    const imagePrefix = '/api/documentation/images/'
    if (doc.image_url.startsWith(imagePrefix)) {
      const imageId = doc.image_url.slice(imagePrefix.length)
      await db.prepare('DELETE FROM documentation_images WHERE id = ?').run(imageId)
    }
    recordActivity(
      user.id,
      'Menghapus dokumentasi',
      `${await eskulName(doc.eskul_id)} · ${doc.title}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && pathname === '/api/achievements') {
    const user = await requireAuth(req)
    requireRole(user, ['admin', 'pelatih', 'ketua'])
    const body = await readJson(req)
    const eskulId = requireText(body.eskulId, 'Eskul', 100)
    assertEskulAccess(user, eskulId, ['pelatih', 'ketua'])
    await ensureEskulExists(eskulId)
    const title = requireText(body.title, 'Judul prestasi', 200)
    const event = requireText(body.event, 'Nama kegiatan', 200)
    const level = parseAchievementLevel(body.level)
    const rank = parseAchievementRank(body.rank)
    const date = requireDate(body.date, 'Tanggal prestasi')
    const participants = requireText(body.participants, 'Nama peserta', 500)
    const description = optionalText(body.description, 3000)
    const id = safeId(body.id, 'ach')
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO achievements
          (id, eskul_id, title, event, level, rank, date, participants, description, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        eskulId,
        title,
        event,
        level,
        rank,
        date,
        participants,
        description ?? null,
        user.id,
        now,
      )
    recordActivity(user.id, 'Menambahkan prestasi', `${await eskulName(eskulId)} · ${title}`)
    sendJson(res, 201, {
      achievement: {
        id,
        eskulId,
        title,
        event,
        level,
        rank,
        date,
        participants,
        description,
        createdBy: user.id,
        createdAt: now,
      },
    })
    return
  }

  const achievementMatch = pathname.match(/^\/api\/achievements\/([^/]+)$/)
  if (method === 'DELETE' && achievementMatch) {
    const user = await requireAuth(req)
    requireRole(user, ['admin', 'pelatih', 'ketua'])
    const achievementId = decodeURIComponent(achievementMatch[1])
    const achievement = await db
      .prepare('SELECT id, eskul_id, title FROM achievements WHERE id = ? LIMIT 1')
      .get(achievementId) as unknown as
      | { id: string; eskul_id: string; title: string }
      | undefined
    if (!achievement) throw new HttpError(404, 'Prestasi tidak ditemukan.')
    if (user.role !== 'admin' && user.eskulId !== achievement.eskul_id) {
      throw new HttpError(403, 'Anda hanya dapat menghapus prestasi eskul Anda sendiri.')
    }
    await db.prepare('DELETE FROM achievements WHERE id = ?').run(achievementId)
    recordActivity(
      user.id,
      'Menghapus prestasi',
      `${await eskulName(achievement.eskul_id)} · ${achievement.title}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && pathname === '/api/permits') {
    const user = await requireAuth(req)
    const body = await readJson(req)
    const eskulId = requireText(body.eskulId, 'Eskul', 100)
    assertEskulAccess(user, eskulId, ['pelatih', 'ketua'])
    await ensureEskulExists(eskulId)
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
    await db
      .prepare(
        `INSERT INTO permits
          (id, eskul_id, type, title, description, start_date, end_date, location, status, created_by, created_at, decided_by, decided_at, decision_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'diajukan', ?, ?, NULL, NULL, NULL)`,
      )
      .run(id, eskulId, type, title, description, startDate, endDate, location, user.id, now)
    recordActivity(user.id, 'Mengajukan perizinan', `${await eskulName(eskulId)} · ${title}`)
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
    const user = await requireAuth(req)
    requireRole(user, ['admin'])
    const body = await readJson(req)
    const permitId = decodeURIComponent(permitReviewMatch[1])
    const decision = body.decision
    if (decision !== 'disetujui' && decision !== 'ditolak') {
      throw new HttpError(400, 'Keputusan perizinan tidak valid.')
    }
    const permit = await db
      .prepare('SELECT id, eskul_id, title, status FROM permits WHERE id = ? LIMIT 1')
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
    await db
      .prepare(
        `UPDATE permits
         SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?
         WHERE id = ?`,
      )
      .run(decision, user.id, now, note || null, permitId)
    recordActivity(
      user.id,
      decision === 'disetujui' ? 'Menyetujui perizinan' : 'Menolak perizinan',
      `${await eskulName(permit.eskul_id)} · ${permit.title}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  const permitCompleteMatch = pathname.match(/^\/api\/permits\/([^/]+)\/complete$/)
  if (method === 'PATCH' && permitCompleteMatch) {
    const user = await requireAuth(req)
    const permitId = decodeURIComponent(permitCompleteMatch[1])
    const permit = await db
      .prepare('SELECT id, eskul_id, title, status FROM permits WHERE id = ? LIMIT 1')
      .get(permitId) as unknown as
      | { id: string; eskul_id: string; title: string; status: string }
      | undefined
    if (!permit) throw new HttpError(404, 'Perizinan tidak ditemukan.')
    if (user.role !== 'admin' && user.eskulId !== permit.eskul_id) {
      throw new HttpError(403, 'Anda tidak memiliki akses ke perizinan ini.')
    }
    if (permit.status !== 'disetujui') {
      throw new HttpError(409, 'Hanya perizinan yang disetujui dapat ditandai selesai.')
    }
    await db.prepare("UPDATE permits SET status = 'selesai' WHERE id = ?").run(permitId)
    recordActivity(
      user.id,
      'Menandai kegiatan selesai',
      `${await eskulName(permit.eskul_id)} · ${permit.title}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && pathname === '/api/students') {
    const user = await requireAuth(req)
    const body = await readJson(req)
    const eskulId = requireText(body.eskulId, 'Eskul', 100)
    assertEskulAccess(user, eskulId, ['pelatih', 'ketua'])
    await ensureEskulExists(eskulId)
    const name = requireText(body.name, 'Nama anggota', 200)
    const nis = requireText(body.nis, 'NIS', 50)
    const className = requireText(body.className, 'Kelas', 50)
    const gender = parseGender(body.gender)
    const duplicate = await db
      .prepare('SELECT id FROM students WHERE nis = ? LIMIT 1')
      .get(nis) as unknown as { id: string } | undefined
    if (duplicate) throw new HttpError(409, 'NIS sudah terdaftar.')
    const id = safeId(body.id, 'st')
    const joinedAt =
      typeof body.joinedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.joinedAt)
        ? body.joinedAt
        : new Date().toISOString().slice(0, 10)
    await db
      .prepare(
        `INSERT INTO students (id, name, nis, class_name, gender, eskul_id, active, joined_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .run(id, name, nis, className, gender, eskulId, joinedAt)
    recordActivity(user.id, 'Menambahkan anggota', `${await eskulName(eskulId)} · ${name}`)
    sendJson(res, 201, {
      student: { id, name, nis, className, gender, eskulId, active: true, joinedAt },
    })
    return
  }

  const studentActiveMatch = pathname.match(/^\/api\/students\/([^/]+)\/active$/)
  if (method === 'PATCH' && studentActiveMatch) {
    const user = await requireAuth(req)
    const body = await readJson(req)
    const studentId = decodeURIComponent(studentActiveMatch[1])
    const student = await studentMeta(studentId)
    assertEskulAccess(user, student.eskul_id, ['pelatih', 'ketua'])
    const active = parseBoolean(body.active, 'Status anggota')
    await db.prepare('UPDATE students SET active = ? WHERE id = ?').run(active ? 1 : 0, studentId)
    recordActivity(
      user.id,
      active ? 'Mengaktifkan anggota' : 'Menonaktifkan anggota',
      `Siswa · ${student.name}`,
    )
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && pathname === '/api/admin/users') {
    const actor = await requireAuth(req)
    requireRole(actor, ['admin'])
    const body = await readJson(req)
    const name = requireText(body.name, 'Nama pengguna', 200)
    const email = requireEmail(body.email)
    const password = requirePassword(body.password)
    const role = parseRole(body.role)
    const phone = optionalText(body.phone, 50)
    if (await emailInUse(email)) throw new HttpError(409, 'Email sudah digunakan pengguna lain.')
    let eskulId: string | undefined
    if (role === 'pelatih' || role === 'ketua') {
      eskulId = requireText(body.eskulId, 'Eskul', 100)
      await ensureEskulExists(eskulId)
    }
    const id = safeId(body.id, 'u')
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO users
          (id, name, email, password_hash, role, eskul_id, phone, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
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
    sendJson(res, 201, { user: await publicUserById(id) })
    return
  }

  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
  if (method === 'PATCH' && adminUserMatch) {
    const actor = await requireAuth(req)
    requireRole(actor, ['admin'])
    const userId = decodeURIComponent(adminUserMatch[1])
    const current = await getUserById(userId)
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
      await ensureEskulExists(eskulId)
    } else {
      eskulId = null
    }
    if (await emailInUse(email, userId)) {
      throw new HttpError(409, 'Email sudah digunakan pengguna lain.')
    }
    if (userId === actor.id && (role !== 'admin' || !active)) {
      throw new HttpError(400, 'Anda tidak dapat menurunkan atau menonaktifkan akun sendiri.')
    }
    await assertLastAdminRemains(userId, role, active)
    const now = new Date().toISOString()
    await db
      .prepare(
        `UPDATE users
         SET name = ?, email = ?, role = ?, eskul_id = ?, phone = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(name, email, role, eskulId, phone, active ? 1 : 0, now, userId)
    if (!active) {
      await db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId)
    }
    recordActivity(actor.id, 'Memperbarui pengguna', `${name} · ${role}`)
    sendJson(res, 200, { user: await publicUserById(userId) })
    return
  }

  const adminPasswordMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/)
  if (method === 'POST' && adminPasswordMatch) {
    const actor = await requireAuth(req)
    requireRole(actor, ['admin'])
    const userId = decodeURIComponent(adminPasswordMatch[1])
    if (!(await getUserById(userId))) throw new HttpError(404, 'Pengguna tidak ditemukan.')
    const body = await readJson(req)
    const password = requirePassword(body.password)
    await db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashPassword(password), new Date().toISOString(), userId)
    if (userId !== actor.id) {
      await db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId)
    }
    recordActivity(actor.id, 'Mereset kata sandi', `Pengguna ${userId}`)
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'POST' && pathname === '/api/admin/reset-data') {
    const actor = await requireAuth(req)
    requireRole(actor, ['admin'])
    await resetDemoData(actor.id)
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

async function main() {
  const wasSeeded = await ready()

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
    console.log(`[simskul] Database: ${databaseLabel()}`)
    console.log(`[simskul] Akun awal — ${passwordHint}`)
    if (wasSeeded) console.log('[simskul] Database baru diisi dengan data demo.')
  })

  function shutdown() {
    server.close(() => {
      closeDatabase()
      process.exit(0)
    })
    setTimeout(() => process.exit(0), 3000).unref()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('[simskul] Server gagal dimulai:', error)
  process.exit(1)
})

// ---- Excel import types ----

export interface ImportRow {
  id?: string
  name: string
  shortName: string
  description: string
  color: string
  day: string
  time: string
  location: string
  quota: string | number
  coachName: string
  leaderName: string
}

// ---- Excel import helpers ----

type UserRow = NonNullable<Awaited<ReturnType<typeof getUserByEmail>>>

interface PersonsByNames {
  coachName: string
  leaderName: string
}

/** Resolve coach/ketua by name; create placeholder accounts if not found. */
async function resolveEskulPersonsByNames(
  input: PersonsByNames,
): Promise<{ coachId: string | null; leaderId: string | null }> {
  const coachId = input.coachName
    ? await findOrCreateStaffByName(input.coachName, 'pelatih')
    : null
  const leaderId = input.leaderName
    ? await findOrCreateStaffByName(input.leaderName, 'ketua')
    : null
  return { coachId, leaderId }
}

async function getUserRowByNameAndRole(
  name: string,
  role: Role,
): Promise<UserRow | undefined> {
  const exact = (await db
    .prepare('SELECT * FROM users WHERE name = ? AND role = ? ORDER BY created_at ASC LIMIT 1')
    .get(name, role)) as unknown as UserRow | undefined
  if (exact) return exact

  // Cocokkan juga nama yang memakai gelar, mis. "Budi Santoso, S.Pd.".
  const target = normalizePersonName(name)
  const rows = (await db
    .prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at ASC')
    .all(role)) as unknown as UserRow[]
  return rows.find((row) => normalizePersonName(row.name) === target)
}

function normalizePersonName(name: string): string {
  return name
    .split(',')[0]
    .toLowerCase()
    .replace(
      /\b(s\.?pd\.?|m\.?pd\.?|s\.?or\.?|s\.?sn\.?|s\.?kom\.?|m\.?kom\.?|s\.?t\.?|m\.?t\.?|s\.?si\.?|m\.?si\.?|s\.?sos\.?|m\.?sos\.?|s\.?h\.?|m\.?h\.?|s\.?e\.?|m\.?e\.?|s\.?ak\.?|m\.?ak\.?|s\.?ked\.?|drs\.?|dra\.?|dr\.?)\s*$/i,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

async function findOrCreateStaffByName(name: string, role: 'pelatih' | 'ketua'): Promise<string> {
  const existing = await getUserRowByNameAndRole(name, role)
  if (existing) return existing.id

  const id = `u-${randomUUID()}`
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO users
        (id, name, email, password_hash, role, eskul_id, phone, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, 1, ?, ?)`,
    )
    .run(id, name, await generateUniqueEmail(name), hashPassword('temp123'), role, now, now)
  return id
}

async function generateUniqueEmail(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'pengguna'
  let email = `${base}@simskul.sch.id`
  let counter = 2
  while (await emailInUse(email)) {
    email = `${base}${counter}@simskul.sch.id`
    counter += 1
  }
  return email
}

interface StaffImportInput {
  name: string
  email?: string
  phone?: string
  password?: string
  role: 'pelatih' | 'ketua'
  eskulName?: string
}

/**
 * Impor satu akun pelatih/ketua. Bila akun dengan nama+peran yang sama sudah
 * ada (misalnya placeholder dari sheet Eskul), akun itu yang dipakai ulang
 * supaya tidak terjadi data ganda.
 */
async function importStaffRow(input: StaffImportInput): Promise<string> {
  const name = input.name.trim()
  if (!name) throw new HttpError(400, 'Nama wajib diisi.')

  let email = input.email?.trim().toLowerCase()
  let existing = email ? await getUserByEmail(email) : undefined
  if (existing && existing.role !== input.role) {
    throw new HttpError(
      400,
      `Email ${email} sudah digunakan akun dengan peran ${existing.role}.`,
    )
  }

  if (!existing) {
    existing = await getUserRowByNameAndRole(name, input.role)
  }
  if (!email) {
    // Jangan ubah email akun lama hanya karena kolom email dikosongkan.
    email = existing ? existing.email.toLowerCase() : await generateUniqueEmail(name)
  }

  const now = new Date().toISOString()
  let userId: string

  if (existing) {
    userId = existing.id
    if (existing.email.toLowerCase() !== email && (await emailInUse(email, existing.id))) {
      throw new HttpError(409, `Email ${email} sudah digunakan pengguna lain.`)
    }
    // Pertahankan nama lama bila hanya berbeda gelar (mis. ", S.Pd.").
    const nextName =
      normalizePersonName(existing.name) === normalizePersonName(name) ? existing.name : name
    await db
      .prepare(
        `UPDATE users
         SET name = ?, email = ?, phone = COALESCE(?, phone), password_hash = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        nextName,
        email,
        input.phone ?? null,
        input.password ? hashPassword(input.password) : existing.password_hash,
        now,
        userId,
      )
  } else {
    userId = `u-${randomUUID()}`
    await db
      .prepare(
        `INSERT INTO users
          (id, name, email, password_hash, role, eskul_id, phone, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, 1, ?, ?)`,
      )
      .run(
        userId,
        name,
        email,
        hashPassword(input.password || 'temp123'),
        input.role,
        input.phone ?? null,
        now,
        now,
      )
  }

  if (input.eskulName) {
    await linkStaffToEskul(userId, input.role, input.eskulName)
  }
  return userId
}

async function linkStaffToEskul(
  userId: string,
  role: 'pelatih' | 'ketua',
  eskulName: string,
): Promise<void> {
  const row = (await db
    .prepare('SELECT id, coach_id, leader_id FROM eskul WHERE name = ? ORDER BY seq ASC LIMIT 1')
    .get(eskulName)) as
    | { id: string; coach_id: string | null; leader_id: string | null }
    | undefined
  if (!row) throw new HttpError(400, `Eskul "${eskulName}" tidak ditemukan.`)

  await detachUserFromOtherEskuls(userId, row.id)
  const previousId = role === 'pelatih' ? row.coach_id : row.leader_id
  const column = role === 'pelatih' ? 'coach_id' : 'leader_id'
  await db.prepare(`UPDATE eskul SET ${column} = ? WHERE id = ?`).run(userId, row.id)
  await db
    .prepare('UPDATE users SET eskul_id = ?, updated_at = ? WHERE id = ?')
    .run(row.id, new Date().toISOString(), userId)

  if (previousId && previousId !== userId) {
    await db
      .prepare('UPDATE users SET eskul_id = NULL WHERE id = ? AND eskul_id = ?')
      .run(previousId, row.id)
  }
}
