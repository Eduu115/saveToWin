import { hash, verify } from 'argon2'
import { eq, lt } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { authCodes, pendingRegistrations, users } from '../../db/schema.js'
import { seedForUser } from '../../db/seed.js'
import { authenticateToken } from '../lib/auth.js'
import { clearAuthCookie, readAuthToken, setAuthCookie } from '../lib/cookies.js'
import { env } from '../lib/env.js'
import { apiError } from '../lib/errors.js'
import { signAccessToken, signTwoFactorChallenge, verifyTwoFactorChallenge } from '../lib/jwt.js'
import { mailConfigured, maskEmail, sendOrFail } from '../lib/mail.js'
import { emailCode, normalizeRecovery, sha256, verifyTotp } from '../lib/totp.js'
import { loginSchema, registerConfirmSchema, registerSchema, updateMeSchema } from '../lib/schemas.js'
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

/** La extensión pide el JWT en el cuerpo: su origen no puede usar la cookie httpOnly. */
function sessionJson(c: Context, user: typeof users.$inferSelect, token: string) {
  setAuthCookie(c, token)
  const body: { user: ReturnType<typeof toPublicUser>; token?: string } = {
    user: toPublicUser(user),
  }
  if (c.req.header('x-savetowin-client') === 'extension') body.token = token
  return c.json(body)
}

export const authRoutes = new Hono()

const CODE_TTL_MIN = 15
const MAX_CODE_ATTEMPTS = 5
/** Un código por minuto y email: que no se pueda bombardear un buzón con altas. */
const RESEND_AFTER_MS = 60_000

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
  const name = parsed.name ?? null

  // Sin correo en este servidor (self-hosted sin SMTP): alta directa, como siempre.
  if (!mailConfigured()) return createAccount(c, { email, passwordHash, name })

  // Con correo: la cuenta se crea al confirmar el código enviado a ese email.
  const [prev] = await db
    .select({ createdAt: pendingRegistrations.createdAt })
    .from(pendingRegistrations)
    .where(eq(pendingRegistrations.email, email))
    .limit(1)
  if (prev && Date.now() - prev.createdAt.getTime() < RESEND_AFTER_MS) {
    return c.json(apiError('RATE_LIMITED', 'Espera un minuto antes de pedir otro código'), 429)
  }
  const code = emailCode()
  await db.delete(pendingRegistrations).where(eq(pendingRegistrations.email, email))
  await db.insert(pendingRegistrations).values({
    email,
    passwordHash,
    name,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
  })
  const failed = await sendOrFail(
    email,
    'saveToWin · confirma tu email',
    `Tu código para crear tu cuenta de saveToWin es:\n\n    ${code}\n\nCaduca en ${CODE_TTL_MIN} minutos. Si no has sido tú, ignora este correo: no se creará ninguna cuenta.\n\n— saveToWin`,
  )
  if (failed) {
    await db.delete(pendingRegistrations).where(eq(pendingRegistrations.email, email))
    return c.json(failed, 503)
  }
  return c.json({ verifyEmail: true, to: maskEmail(email) }, 202)
})

authRoutes.post('/register/confirm', async (c) => {
  if (!env.registrationOpen()) {
    return c.json(apiError('FORBIDDEN', 'El registro está cerrado'), 403)
  }
  const body = await parseBody(c, registerConfirmSchema)
  if (body instanceof Response) return body
  const email = body.email.trim().toLowerCase()
  const [pending] = await db
    .select()
    .from(pendingRegistrations)
    .where(eq(pendingRegistrations.email, email))
    .limit(1)
  if (!pending || pending.expiresAt.getTime() < Date.now() || pending.attempts >= MAX_CODE_ATTEMPTS) {
    if (pending) await db.delete(pendingRegistrations).where(eq(pendingRegistrations.id, pending.id))
    return c.json(apiError('CODE_EXPIRED', 'El código ha caducado. Pide uno nuevo.'), 410)
  }
  if (pending.codeHash !== sha256(body.code)) {
    await db
      .update(pendingRegistrations)
      .set({ attempts: pending.attempts + 1 })
      .where(eq(pendingRegistrations.id, pending.id))
    return c.json(apiError('CODE_INVALID', 'El código no es correcto'), 400)
  }
  await db.delete(pendingRegistrations).where(eq(pendingRegistrations.id, pending.id))
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (taken) return c.json(apiError('CONFLICT', 'El email ya está registrado'), 409)
  return createAccount(c, { email, passwordHash: pending.passwordHash, name: pending.name })
})

async function createAccount(
  c: Context,
  values: { email: string; passwordHash: string; name: string | null },
) {
  const [user] = await db.insert(users).values(values).returning()
  await seedForUser(user.id)
  setAuthCookie(c, await signAccessToken(user.id, user.sessionVersion))
  return c.json({ user: toPublicUser(user) }, 201)
}

/** Altas y códigos caducados fuera (la política de privacidad lo promete). */
export async function purgeExpiredCodes() {
  const now = new Date()
  await db.delete(pendingRegistrations).where(lt(pendingRegistrations.expiresAt, now))
  await db.delete(authCodes).where(lt(authCodes.expiresAt, now))
}

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
  return sessionJson(c, user, token)
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
  return sessionJson(c, user, await signAccessToken(user.id, user.sessionVersion))
})

authRoutes.post('/logout', (c) => {
  clearAuthCookie(c)
  return c.json({ ok: true })
})

authRoutes.get('/me', async (c) => {
  const token = readAuthToken(c)
  // Sin cookie ni Bearer no hay sesión, y no es un error: el cliente lleva al login.
  if (!token) return c.json({ user: null })

  const session = await authenticateToken(token)
  if (!session.ok) {
    const message =
      session.code === 'SESSION_REVOKED'
        ? 'Tu sesión se ha cerrado. Vuelve a entrar.'
        : 'Sesión inválida'
    return c.json(apiError(session.code, message), 401)
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  if (!user) {
    return c.json(apiError('UNAUTHORIZED', 'Usuario no encontrado'), 401)
  }

  return c.json({ user: toPublicUser(user) })
})

authRoutes.patch('/me', async (c) => {
  const token = readAuthToken(c)
  if (!token) {
    return c.json(apiError('UNAUTHORIZED', 'No autenticado'), 401)
  }

  const session = await authenticateToken(token)
  if (!session.ok) {
    const message =
      session.code === 'SESSION_REVOKED'
        ? 'Tu sesión se ha cerrado. Vuelve a entrar.'
        : 'Sesión inválida'
    return c.json(apiError(session.code, message), 401)
  }
  const userId = session.userId

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
