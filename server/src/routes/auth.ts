import { hash, verify } from 'argon2'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { seedForUser } from '../../db/seed.js'
import { clearAuthCookie, readAuthCookie, setAuthCookie } from '../lib/cookies.js'
import { apiError } from '../lib/errors.js'
import { signAccessToken, verifyAccessToken } from '../lib/jwt.js'
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

authRoutes.post('/register', async (c) => {
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
  const token = await signAccessToken(user.id)
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

  const token = await signAccessToken(user.id)
  setAuthCookie(c, token)
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
