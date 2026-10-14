import { hash, verify } from 'argon2'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { seedForUser } from '../../db/seed.js'
import { clearAuthCookie, readAuthCookie, setAuthCookie } from '../lib/cookies.js'
import { env } from '../lib/env.js'
import { apiError } from '../lib/errors.js'
import {
  signAccessToken,
  signTwoFactorChallenge,
  verifyAccessToken,
  verifyTwoFactorChallenge,
} from '../lib/jwt.js'
import { normalizeRecovery, sha256, verifyTotp } from '../lib/totp.js'
import { loginSchema, registerSchema, updateMeSchema } from '../lib/schemas.js'
import { parseBody } from '../lib/validate.js'

function toPublicUser(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
    savingsGoalCents: row.savingsGoalCents,
  }
}

export const authRoutes = new Hono()

authRoutes.get('/registration', (c) => {
  return c.json({ open: env.registrationOpen() })
})

authRoutes.post('/register', async (c) => {
  if (!env.registrationOpen()) {
    return c.json(apiError('FORBIDDEN', 'El registro está cerrado'), 403)
  }
  const parsed = await parseBody(c, registerSchema)
  if (parsed instanceof Response) return parsed

  const email = parsed.email.trim().toLowerCase()
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    return c.json(apiError('CONFLICT', 'El email ya está registrado'), 409)
  }

  const passwordHash = await hash(parsed.password)
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: parsed.name ?? null,
    })
    .returning()

  await seedForUser(user.id)
  const token = await signAccessToken(user.id, user.sessionVersion)
  setAuthCookie(c, token)
  return c.json({ user: toPublicUser(user) }, 201)
})

authRoutes.post('/login', async (c) => {
  const parsed = await parseBody(c, loginSchema)
  if (parsed instanceof Response) return parsed

  const email = parsed.email.trim().toLowerCase()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    return c.json(apiError('UNAUTHORIZED', 'Credenciales incorrectas'), 401)
  }

  const ok = await verify(user.passwordHash, parsed.password)
  if (!ok) {
    return c.json(apiError('UNAUTHORIZED', 'Credenciales incorrectas'), 401)
  }

  // Con 2FA activa no hay sesión todavía: se devuelve un reto para el segundo paso.
  if (user.totpEnabledAt) {
    return c.json({ twoFactorRequired: true, challenge: await signTwoFactorChallenge(user.id) })
  }

  const token = await signAccessToken(user.id, user.sessionVersion)
  setAuthCookie(c, token)
  return c.json({ user: toPublicUser(user) })
})

const twoFactorSchema = z.object({
  challenge: z.string().min(1),
  code: z.string().trim().min(6).max(12),
})

/** Segundo paso: código de la app (6 dígitos) o un código de recuperación (se gasta). */
authRoutes.post('/login/2fa', async (c) => {
  const parsed = await parseBody(c, twoFactorSchema)
  if (parsed instanceof Response) return parsed
  let userId: number
  try {
    userId = await verifyTwoFactorChallenge(parsed.challenge)
  } catch {
    return c.json(apiError('CHALLENGE_EXPIRED', 'Ha pasado demasiado tiempo. Vuelve a entrar.'), 401)
  }
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user?.totpEnabledAt || !user.totpSecret) {
    return c.json(apiError('UNAUTHORIZED', 'Credenciales incorrectas'), 401)
  }
  if (!verifyTotp(user.totpSecret, parsed.code)) {
    const hashed = sha256(normalizeRecovery(parsed.code))
    if (!user.totpRecovery.includes(hashed)) {
      return c.json(apiError('CODE_INVALID', 'El código no es correcto'), 401)
    }
    await db
      .update(users)
      .set({ totpRecovery: user.totpRecovery.filter((h) => h !== hashed) })
      .where(eq(users.id, user.id))
  }
  setAuthCookie(c, await signAccessToken(user.id, user.sessionVersion))
  return c.json({ user: toPublicUser(user) })
})

authRoutes.post('/logout', (c) => {
  clearAuthCookie(c)
  return c.json({ ok: true })
})

authRoutes.get('/me', async (c) => {
  const token = readAuthCookie(c)
  if (!token) {
    return c.json(apiError('UNAUTHORIZED', 'No autenticado'), 401)
  }

  let payload
  try {
    payload = await verifyAccessToken(token)
  } catch {
    return c.json(apiError('UNAUTHORIZED', 'Sesión inválida'), 401)
  }

  const userId = Number(payload.sub)
  if (!Number.isInteger(userId)) {
    return c.json(apiError('UNAUTHORIZED', 'Sesión inválida'), 401)
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) {
    return c.json(apiError('UNAUTHORIZED', 'Usuario no encontrado'), 401)
  }

  return c.json({ user: toPublicUser(user) })
})

authRoutes.patch('/me', async (c) => {
  const token = readAuthCookie(c)
  if (!token) {
    return c.json(apiError('UNAUTHORIZED', 'No autenticado'), 401)
  }

  let payload
  try {
    payload = await verifyAccessToken(token)
  } catch {
    return c.json(apiError('UNAUTHORIZED', 'Sesión inválida'), 401)
  }

  const userId = Number(payload.sub)
  if (!Number.isInteger(userId)) {
    return c.json(apiError('UNAUTHORIZED', 'Sesión inválida'), 401)
  }

  const body = await parseBody(c, updateMeSchema)
  if (body instanceof Response) return body
  if (body.savingsGoalCents === undefined && body.name === undefined) {
    return c.json(apiError('VALIDATION_ERROR', 'Nada que actualizar'), 400)
  }

  const patch: { savingsGoalCents?: number; name?: string | null } = {}
  if (body.savingsGoalCents !== undefined) patch.savingsGoalCents = body.savingsGoalCents
  if (body.name !== undefined) patch.name = body.name

  const [user] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning()
  if (!user) return c.json(apiError('UNAUTHORIZED', 'Usuario no encontrado'), 401)
  return c.json({ user: toPublicUser(user) })
})
