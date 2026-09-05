import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/client.js'
import { accounts, cards } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'
import { cardCreateSchema, cardPatchSchema } from '../lib/schemas.js'
import { parseBody } from '../lib/validate.js'

export const cardsRoutes = new Hono<{ Variables: AuthVariables }>()

cardsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const accountIdRaw = c.req.query('accountId')
  const conditions = [eq(cards.userId, userId)]
  if (accountIdRaw) {
    const accountId = Number(accountIdRaw)
    if (!Number.isInteger(accountId)) {
      return c.json(apiError('VALIDATION_ERROR', 'accountId inválido'), 400)
    }
    conditions.push(eq(cards.accountId, accountId))
  }
  const items = await db
    .select()
    .from(cards)
    .where(and(...conditions))
  return c.json({ items })
})

cardsRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, cardCreateSchema)
  if (body instanceof Response) return body

  const [acc] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, body.accountId), eq(accounts.userId, userId)))
    .limit(1)
  if (!acc) return c.json(apiError('VALIDATION_ERROR', 'accountId no válido'), 400)

  try {
    const [row] = await db
      .insert(cards)
      .values({ userId, accountId: body.accountId, name: body.name })
      .returning()
    return c.json(row, 201)
  } catch {
    return c.json(apiError('CONFLICT', 'Ya existe una tarjeta con ese nombre en la cuenta'), 409)
  }
})

cardsRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }
  const body = await parseBody(c, cardPatchSchema)
  if (body instanceof Response) return body
  if (Object.keys(body).length === 0) {
    return c.json(apiError('VALIDATION_ERROR', 'Nada que actualizar'), 400)
  }

  const [row] = await db
    .update(cards)
    .set(body)
    .where(and(eq(cards.id, id), eq(cards.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Tarjeta no encontrada'), 404)
  return c.json(row)
})

cardsRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }

  const [row] = await db
    .update(cards)
    .set({ archived: true })
    .where(and(eq(cards.id, id), eq(cards.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Tarjeta no encontrada'), 404)
  return c.json(row)
})
