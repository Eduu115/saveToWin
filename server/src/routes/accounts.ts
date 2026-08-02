import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/client.js'
import { accounts } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'
import { accountCreateSchema, accountPatchSchema } from '../lib/schemas.js'
import { parseBody } from '../lib/validate.js'

export const accountsRoutes = new Hono<{ Variables: AuthVariables }>()

accountsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const items = await db.select().from(accounts).where(eq(accounts.userId, userId))
  return c.json({ items })
})

accountsRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, accountCreateSchema)
  if (body instanceof Response) return body

  try {
    const [row] = await db
      .insert(accounts)
      .values({ ...body, userId })
      .returning()
    return c.json(row, 201)
  } catch {
    return c.json(apiError('CONFLICT', 'No se pudo crear la cuenta (¿key duplicada?)'), 409)
  }
})

accountsRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }
  const body = await parseBody(c, accountPatchSchema)
  if (body instanceof Response) return body
  if (Object.keys(body).length === 0) {
    return c.json(apiError('VALIDATION_ERROR', 'Nada que actualizar'), 400)
  }

  const [row] = await db
    .update(accounts)
    .set(body)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Cuenta no encontrada'), 404)
  return c.json(row)
})

accountsRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }

  const [row] = await db
    .delete(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Cuenta no encontrada'), 404)
  return c.json({ ok: true })
})
