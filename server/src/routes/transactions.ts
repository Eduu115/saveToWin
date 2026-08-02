import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db/client.js'
import { accounts, categories, transactions } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'
import {
  transactionBatchSchema,
  transactionCreateSchema,
  transactionListQuerySchema,
  transactionPatchSchema,
} from '../lib/schemas.js'
import { parseBody, parseQuery } from '../lib/validate.js'

export const transactionsRoutes = new Hono<{ Variables: AuthVariables }>()

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

transactionsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const query = parseQuery(c, transactionListQuerySchema)
  if (query instanceof Response) return query

  const conditions = [eq(transactions.userId, userId)]
  if (query.from) conditions.push(gte(transactions.date, query.from))
  if (query.to) conditions.push(lte(transactions.date, query.to))
  if (query.categoryId) conditions.push(eq(transactions.categoryId, query.categoryId))
  if (query.accountId) conditions.push(eq(transactions.accountId, query.accountId))
  if (query.type) conditions.push(eq(transactions.type, query.type))

  const where = and(...conditions)
  const [{ total }] = await db.select({ total: count() }).from(transactions).where(where)
  const items = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(sql`${transactions.date} desc, ${transactions.id} desc`)
    .limit(query.limit)
    .offset(query.offset)

  return c.json({ items, total })
})

transactionsRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, transactionCreateSchema)
  if (body instanceof Response) return body

  if (!(await ownedCategory(userId, body.categoryId))) {
    return c.json(apiError('VALIDATION_ERROR', 'categoryId no válido'), 400)
  }
  if (!(await ownedAccount(userId, body.accountId))) {
    return c.json(apiError('VALIDATION_ERROR', 'accountId no válido'), 400)
  }

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      date: body.date,
      amount: body.amount,
      type: body.type,
      categoryId: body.categoryId,
      accountId: body.accountId,
      note: body.note ?? null,
      tags: body.tags ?? null,
    })
    .returning()
  return c.json(row, 201)
})

transactionsRoutes.post('/batch', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, transactionBatchSchema)
  if (body instanceof Response) return body

  const accountIds = new Set(body.items.map((i) => i.accountId))
  const categoryIds = new Set(body.items.map((i) => i.categoryId))
  for (const id of accountIds) {
    if (!(await ownedAccount(userId, id))) {
      return c.json(apiError('VALIDATION_ERROR', 'accountId no válido'), 400)
    }
  }
  for (const id of categoryIds) {
    if (!(await ownedCategory(userId, id))) {
      return c.json(apiError('VALIDATION_ERROR', 'categoryId no válido'), 400)
    }
  }

  let existing = new Set<string>()
  if (body.skipDuplicates) {
    const dates = body.items.map((i) => i.date).sort()
    const from = dates[0]!
    const to = dates[dates.length - 1]!
    const rows = await db
      .select({
        date: transactions.date,
        amount: transactions.amount,
        note: transactions.note,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, from),
          lte(transactions.date, to),
        ),
      )
    existing = new Set(
      rows.map((r) => `${r.date}|${r.amount}|${(r.note ?? '').trim().toLowerCase()}`),
    )
  }

  const toInsert: (typeof body.items)[number][] = []
  let skippedDuplicates = 0
  const seenBatch = new Set<string>()
  for (const item of body.items) {
    if (item.amount < 0) {
      return c.json(apiError('VALIDATION_ERROR', 'amount debe ser ≥ 0'), 400)
    }
    const key = `${item.date}|${item.amount}|${(item.note ?? '').trim().toLowerCase()}`
    if (body.skipDuplicates && (existing.has(key) || seenBatch.has(key))) {
      skippedDuplicates++
      continue
    }
    seenBatch.add(key)
    toInsert.push(item)
  }

  const inserted =
    toInsert.length === 0
      ? []
      : await db
          .insert(transactions)
          .values(
            toInsert.map((item) => ({
              userId,
              date: item.date,
              amount: item.amount,
              type: item.type,
              categoryId: item.categoryId,
              accountId: item.accountId,
              note: item.note ?? null,
              tags: item.tags ?? null,
            })),
          )
          .returning()

  return c.json({
    inserted: inserted.length,
    skippedDuplicates,
    items: inserted,
  })
})

transactionsRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }
  const body = await parseBody(c, transactionPatchSchema)
  if (body instanceof Response) return body
  if (Object.keys(body).length === 0) {
    return c.json(apiError('VALIDATION_ERROR', 'Nada que actualizar'), 400)
  }

  if (body.categoryId !== undefined && !(await ownedCategory(userId, body.categoryId))) {
    return c.json(apiError('VALIDATION_ERROR', 'categoryId no válido'), 400)
  }
  if (body.accountId !== undefined && !(await ownedAccount(userId, body.accountId))) {
    return c.json(apiError('VALIDATION_ERROR', 'accountId no válido'), 400)
  }

  const [row] = await db
    .update(transactions)
    .set({
      ...body,
      note: body.note === undefined ? undefined : body.note,
      tags: body.tags === undefined ? undefined : body.tags,
    })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Movimiento no encontrado'), 404)
  return c.json(row)
})

transactionsRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  }

  const [row] = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning()
  if (!row) return c.json(apiError('NOT_FOUND', 'Movimiento no encontrado'), 404)
  return c.json({ ok: true })
})
