import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { readAuthToken } from './cookies.js'
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
  '/api/auth/register/confirm',
  '/api/auth/registration',
  // Valida el token ella misma: sin cookie responde { user: null } en vez de un 401.
  '/api/auth/me',
  // Cerrar sesión siempre funciona, aunque la sesión ya no sea válida.
  '/api/auth/logout',
])

export async function authenticateToken(
  token: string,
): Promise<
  | { ok: true; userId: number }
  | { ok: false; code: 'UNAUTHORIZED' | 'SESSION_REVOKED' }
> {
  try {
    const payload = await verifyAccessToken(token)
    const userId = Number(payload.sub)
    if (!Number.isInteger(userId)) return { ok: false, code: 'UNAUTHORIZED' }
    // ponytail: una consulta por clave primaria en cada petición; cachear si pesa.
    const [user] = await db
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user || user.sessionVersion !== payload.sv) {
      return { ok: false, code: 'SESSION_REVOKED' }
    }
    return { ok: true, userId }
  } catch {
    return { ok: false, code: 'UNAUTHORIZED' }
  }
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  if (PUBLIC_API.has(c.req.path)) {
    return next()
  }

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
  c.set('userId', session.userId)
  return next()
})
