import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { readAuthCookie } from './cookies.js'
import { apiError } from './errors.js'
import { verifyAccessToken } from './jwt.js'

export type AuthVariables = {
  userId: number
  /**
   * Opcional (`YYYY-MM-DD`): si una extensión lo fija, no se sirven estadísticas ni
   * gráficos de periodos que terminan antes. Los datos se conservan. Sin fijar = sin límite.
   */
  historyFrom?: string
}

const PUBLIC_API = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/login/2fa',
  '/api/auth/register',
  '/api/auth/registration',
  // Cerrar sesión siempre funciona, aunque la sesión ya no sea válida.
  '/api/auth/logout',
])

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  if (PUBLIC_API.has(c.req.path)) {
    return next()
  }

  const token = readAuthCookie(c)
  if (!token) {
    return c.json(apiError('UNAUTHORIZED', 'No autenticado'), 401)
  }

  try {
    const payload = await verifyAccessToken(token)
    const userId = Number(payload.sub)
    if (!Number.isInteger(userId)) {
      return c.json(apiError('UNAUTHORIZED', 'Sesión inválida'), 401)
    }
    // ponytail: una consulta por clave primaria en cada petición; cachear si pesa.
    const [user] = await db
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user || user.sessionVersion !== payload.sv) {
      return c.json(apiError('SESSION_REVOKED', 'Tu sesión se ha cerrado. Vuelve a entrar.'), 401)
    }
    c.set('userId', userId)
  } catch {
    return c.json(apiError('UNAUTHORIZED', 'Sesión inválida'), 401)
  }

  return next()
})
