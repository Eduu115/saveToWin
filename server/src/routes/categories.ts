import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/client.js'
import { categories } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'
import { categoryCreateSchema, categoryPatchSchema } from '../lib/schemas.js'
import { parseBody } from '../lib/validate.js'

export const categoriesRoutes = new Hono<{ Variables: AuthVariables }>()

/** Categorías de las que depende la lógica (suscripciones, ahorro, comodín): no se archivan. */
const SYSTEM_KEYS = new Set(['Subscriptions', 'Savings transfer', 'Savings withdrawal', 'Other'])

categoriesRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const items = await db.select().from(categories).where(eq(categories.userId, userId))
  return c.json({ items })
})

categoriesRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, categoryCreateSchema)
  if (body instanceof Response) return body

  try {
    const [row] = await db
      .insert(categories)
      .values({
        key: body.key,
        label: body.label,
        color: body.color,
        type: body.type,
        parentId: body.parentId ?? null,
        userId,
      })
      .returning()
    return c.json(row, 201)
  } catch {
    return c.json(apiError('CONFLICT', 'Ya tienes una categoría con ese nombre'), 409)
  }
})

categoriesRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }
  const body = await parseBody(c, categoryPatchSchema)
  if (body instanceof Response) return body
  if (Object.keys(body).length === 0) {
    return c.json(apiError('VALIDATION_ERROR', 'Nada que actualizar'), 400)
  }
  if (body.archived) {
    const [cur] = await db
      .select({ key: categories.key })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1)
    if (cur && SYSTEM_KEYS.has(cur.key)) {
      return c.json(apiError('VALIDATION_ERROR', 'Esta categoría la usa la app y no se puede archivar'), 400)
    }
  }

  const [row] = await db
    .update(categories)
    .set(body)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Categoría no encontrada'), 404)
  return c.json(row)
})

categoriesRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }

  try {
    const [row] = await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning()
    if (!row) return c.json(apiError('NOT_FOUND', 'Categoría no encontrada'), 404)
    return c.json({ ok: true })
  } catch {
    return c.json(apiError('CONFLICT', 'No se puede borrar: hay movimientos que la usan'), 409)
  }
})
