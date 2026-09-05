import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/client.js'
import { accounts } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'
import { accountCreateSchema, accountPatchSchema } from '../lib/schemas.js'
import { parseBody } from '../lib/validate.js'

export const accountsRoutes = new Hono<{ Variables: AuthVariables }>()

function slugKey(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${base || 'account'}-${Date.now().toString(36)}`
}

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
      .values({
        userId,
        name: body.name,
        entity: body.entity ?? null,
        key: body.key ?? slugKey(body.name),
        label: body.label ?? body.name,
        color: body.color,
        initialBalance: body.initialBalance,
      })
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

  const patch: Record<string, unknown> = { ...body }
  if (body.name !== undefined && body.label === undefined) {
    patch.label = body.name
  }

  const [row] = await db
    .update(accounts)
    .set(patch)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Cuenta no encontrada'), 404)
  return c.json(row)
})

/** Soft-archive (nunca borrar filas de dominio con histórico). */
accountsRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }

  const [row] = await db
    .update(accounts)
    .set({ archived: true })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Cuenta no encontrada'), 404)
  return c.json(row)
})
