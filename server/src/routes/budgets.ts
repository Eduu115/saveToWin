import { and, eq, gt } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/client.js'
import { budgets, categories } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'
import { budgetSetSchema } from '../lib/schemas.js'
import { parseBody } from '../lib/validate.js'

export const budgetsRoutes = new Hono<{ Variables: AuthVariables }>()

/** Filas crudas; el vigente de cada mes lo resuelve `effectiveBudgets` (shared/stats). */
budgetsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const items = await db.select().from(budgets).where(eq(budgets.userId, userId))
  return c.json({ items })
})

/**
 * Fija el límite mensual de una categoría desde `period` en adelante:
 * upsert de ese mes + borra los meses posteriores. Los anteriores no se tocan.
 */
budgetsRoutes.put('/', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, budgetSetSchema)
  if (body instanceof Response) return body

  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, body.categoryId), eq(categories.userId, userId)))
    .limit(1)
  if (!cat) return c.json(apiError('VALIDATION_ERROR', 'categoryId no válido'), 400)

  const row = await db.transaction(async (tx) => {
    await tx
      .delete(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.categoryId, body.categoryId),
          gt(budgets.period, body.period),
        ),
      )
    const [saved] = await tx
      .insert(budgets)
      .values({ userId, ...body })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.period],
        set: { limit: body.limit },
      })
      .returning()
    return saved
  })
  return c.json(row)
})
