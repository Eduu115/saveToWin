import { createMiddleware } from 'hono/factory'
import { readAuthCookie } from './cookies.js'
import { apiError } from './errors.js'
import { verifyAccessToken } from './jwt.js'

export type AuthVariables = {
  userId: number
}

const PUBLIC_API = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
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
    c.set('userId', userId)
  } catch {
    return c.json(apiError('UNAUTHORIZED', 'Sesión inválida'), 401)
  }

  return next()
})
