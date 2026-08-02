import { Hono } from 'hono'
import type { AuthVariables } from '../lib/auth.js'
import { accountCreateSchema } from '../lib/schemas.js'
import { parseBody } from '../lib/validate.js'

/** Stub de validación P3.1; CRUD real en P3.2. */
export const accountsRoutes = new Hono<{ Variables: AuthVariables }>()

accountsRoutes.post('/', async (c) => {
  const body = await parseBody(c, accountCreateSchema)
  if (body instanceof Response) return body
  return c.json({ ok: true, data: body })
})
