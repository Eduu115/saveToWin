import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/client.js'
import { budgets, categories } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'
import { budgetCreateSchema, budgetPatchSchema } from '../lib/schemas.js'
import { parseBody } from '../lib/validate.js'

export const budgetsRoutes = new Hono<{ Variables: AuthVariables }>()

budgetsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const items = await db.select().from(budgets).where(eq(budgets.userId, userId))
  return c.json({ items })
})

budgetsRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, budgetCreateSchema)
  if (body instanceof Response) return body

  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, body.categoryId), eq(categories.userId, userId)))
    .limit(1)
  if (!cat) return c.json(apiError('VALIDATION_ERROR', 'categoryId no válido'), 400)

  try {
    const [row] = await db
      .insert(budgets)
      .values({
        userId,
        categoryId: body.categoryId,
        period: body.period,
        limit: body.limit,
      })
      .returning()
    return c.json(row, 201)
  } catch {
    return c.json(apiError('CONFLICT', 'Ya existe presupuesto para esa categoría y periodo'), 409)
  }
})

budgetsRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }
  const body = await parseBody(c, budgetPatchSchema)
  if (body instanceof Response) return body
  if (Object.keys(body).length === 0) {
    return c.json(apiError('VALIDATION_ERROR', 'Nada que actualizar'), 400)
  }

  if (body.categoryId !== undefined) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, body.categoryId), eq(categories.userId, userId)))
      .limit(1)
    if (!cat) return c.json(apiError('VALIDATION_ERROR', 'categoryId no válido'), 400)
  }

  const [row] = await db
    .update(budgets)
    .set(body)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Presupuesto no encontrado'), 404)
  return c.json(row)
})

budgetsRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }

  const [row] = await db
    .delete(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Presupuesto no encontrado'), 404)
  return c.json({ ok: true })
})
