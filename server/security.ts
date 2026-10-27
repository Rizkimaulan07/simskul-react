import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_KEY_LENGTH = 64

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex')
  return `scrypt:${salt}:${derived}`
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, expected] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !expected) return false
  try {
    const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH)
    const expectedBuffer = Buffer.from(expected, 'hex')
    if (derived.length !== expectedBuffer.length) return false
    return timingSafeEqual(derived, expectedBuffer)
  } catch {
    return false
  }
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
