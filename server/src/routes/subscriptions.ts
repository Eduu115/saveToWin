import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/client.js'
import { accounts, cards, categories, subscriptions } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'
import {
  subscriptionCreateSchema,
  subscriptionPatchSchema,
} from '../lib/schemas.js'
import { ensureSubscriptionOccurrences } from '../lib/subscriptions.js'
import { parseBody } from '../lib/validate.js'

export const subscriptionsRoutes = new Hono<{ Variables: AuthVariables }>()

async function ownedCategory(userId: number, categoryId: number) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1)
  return row
}

async function ownedAccount(userId: number, accountId: number) {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1)
  return row
}

async function ownedCardForAccount(
  userId: number,
  accountId: number,
  cardId: number | null | undefined,
) {
  if (cardId == null) return true
  const [row] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(
      and(
        eq(cards.id, cardId),
        eq(cards.userId, userId),
        eq(cards.accountId, accountId),
      ),
    )
    .limit(1)
  return Boolean(row)
}

subscriptionsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  await ensureSubscriptionOccurrences(userId)
  const items = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(subscriptions.id)
  return c.json({ items })
})

subscriptionsRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, subscriptionCreateSchema)
  if (body instanceof Response) return body

  if (!(await ownedCategory(userId, body.categoryId))) {
    return c.json(apiError('VALIDATION_ERROR', 'categoryId no válido'), 400)
  }
  if (!(await ownedAccount(userId, body.accountId))) {
    return c.json(apiError('VALIDATION_ERROR', 'accountId no válido'), 400)
  }
  if (!(await ownedCardForAccount(userId, body.accountId, body.cardId))) {
    return c.json(apiError('VALIDATION_ERROR', 'cardId no válido para esa cuenta'), 400)
  }

  const [row] = await db
    .insert(subscriptions)
    .values({
      userId,
      categoryId: body.categoryId,
      accountId: body.accountId,
      cardId: body.cardId ?? null,
      amount: body.amount,
      recurrence: body.recurrence,
      customEvery: body.recurrence === 'custom' ? (body.customEvery ?? null) : null,
      customUnit: body.recurrence === 'custom' ? (body.customUnit ?? null) : null,
      nextDate: body.nextDate,
      note: body.note ?? null,
      status: 'active',
    })
    .returning()

  // Materializa el primer cargo (y atrasados) de forma idempotente
  await ensureSubscriptionOccurrences(userId)
  const [fresh] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, row.id), eq(subscriptions.userId, userId)))
    .limit(1)
  return c.json(fresh ?? row, 201)
})

subscriptionsRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }
  const body = await parseBody(c, subscriptionPatchSchema)
  if (body instanceof Response) return body
  if (Object.keys(body).length === 0) {
    return c.json(apiError('VALIDATION_ERROR', 'Nada que actualizar'), 400)
  }

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
    .limit(1)
  if (!existing) return c.json(apiError('NOT_FOUND', 'Suscripción no encontrada'), 404)

  const accountId = body.accountId ?? existing.accountId
  if (body.categoryId != null && !(await ownedCategory(userId, body.categoryId))) {
    return c.json(apiError('VALIDATION_ERROR', 'categoryId no válido'), 400)
  }
  if (body.accountId != null && !(await ownedAccount(userId, body.accountId))) {
    return c.json(apiError('VALIDATION_ERROR', 'accountId no válido'), 400)
  }
  const cardId = body.cardId !== undefined ? body.cardId : existing.cardId
  if (!(await ownedCardForAccount(userId, accountId, cardId))) {
    return c.json(apiError('VALIDATION_ERROR', 'cardId no válido para esa cuenta'), 400)
  }

  const recurrence = body.recurrence ?? existing.recurrence
  const patch: Partial<typeof subscriptions.$inferInsert> = { ...body }
  if (body.recurrence != null || body.customEvery !== undefined || body.customUnit !== undefined) {
    if (recurrence === 'custom') {
      patch.customEvery = body.customEvery ?? existing.customEvery
      patch.customUnit = body.customUnit ?? existing.customUnit
    } else {
      patch.customEvery = null
      patch.customUnit = null
    }
  }
  if (body.status === 'cancelled' && existing.status !== 'cancelled') {
    patch.cancelledAt = new Date().toISOString()
  }
  if (body.status === 'active') {
    patch.cancelledAt = null
  }

  const [row] = await db
    .update(subscriptions)
    .set(patch)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Suscripción no encontrada'), 404)

  if (row.status === 'active') {
    await ensureSubscriptionOccurrences(userId)
    const [fresh] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .limit(1)
    return c.json(fresh ?? row)
  }
  return c.json(row)
})

/** Soft-cancel: deja de generar; histórico intacto. */
subscriptionsRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }

  const [row] = await db
    .update(subscriptions)
    .set({ status: 'cancelled', cancelledAt: new Date().toISOString() })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Suscripción no encontrada'), 404)
  return c.json(row)
})
