import { hash, verify } from 'argon2'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { seedForUser } from '../../db/seed.js'
import { clearAuthCookie, readAuthCookie, setAuthCookie } from '../lib/cookies.js'
import { apiError } from '../lib/errors.js'
import { signAccessToken, verifyAccessToken } from '../lib/jwt.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function toPublicUser(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
  }
}

export const authRoutes = new Hono()

authRoutes.post('/register', async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json(apiError('VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten()), 400)
  }

  const email = parsed.data.email.trim().toLowerCase()
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    return c.json(apiError('CONFLICT', 'El email ya está registrado'), 409)
  }

  const passwordHash = await hash(parsed.data.password)
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: parsed.data.name ?? null,
    })
    .returning()

  await seedForUser(user.id)
  const token = await signAccessToken(user.id)
  setAuthCookie(c, token)
  return c.json({ user: toPublicUser(user) }, 201)
})

authRoutes.post('/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json(apiError('VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten()), 400)
  }

  const email = parsed.data.email.trim().toLowerCase()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    return c.json(apiError('UNAUTHORIZED', 'Credenciales incorrectas'), 401)
  }

  const ok = await verify(user.passwordHash, parsed.data.password)
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
