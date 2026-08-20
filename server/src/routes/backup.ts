import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { accounts, budgets, categories, transactions, users } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'
import { parseBody } from '../lib/validate.js'

const BACKUP_VERSION = 1 as const

const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  user: z.object({
    name: z.string().nullable().optional(),
    savingsGoalCents: z.number().int().positive().optional(),
  }),
  accounts: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      color: z.string().min(1),
      name: z.string().min(1),
      initialBalance: z.number().int(),
    }),
  ),
  categories: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      color: z.string().min(1),
      type: z.enum(['expense', 'income', 'savings']),
    }),
  ),
  transactions: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.number().int().nonnegative(),
      type: z.enum(['expense', 'income', 'savings']),
      categoryKey: z.string().min(1),
      accountKey: z.string().min(1),
      note: z.string().nullable().optional(),
      tags: z.array(z.string()).nullable().optional(),
    }),
  ),
  budgets: z.array(
    z.object({
      categoryKey: z.string().min(1),
      period: z.string().regex(/^\d{4}-\d{2}$/),
      limit: z.number().int(),
    }),
  ),
})

export const backupRoutes = new Hono<{ Variables: AuthVariables }>()

backupRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return c.json(apiError('UNAUTHORIZED', 'Usuario no encontrado'), 401)

  const accs = await db.select().from(accounts).where(eq(accounts.userId, userId))
  const cats = await db.select().from(categories).where(eq(categories.userId, userId))
  const txs = await db.select().from(transactions).where(eq(transactions.userId, userId))
  const buds = await db.select().from(budgets).where(eq(budgets.userId, userId))

  const accById = new Map(accs.map((a) => [a.id, a.key]))
  const catById = new Map(cats.map((c) => [c.id, c.key]))

  return c.json({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: {
      name: user.name,
      savingsGoalCents: user.savingsGoalCents,
    },
    accounts: accs.map((a) => ({
      key: a.key,
      label: a.label,
      color: a.color,
      name: a.name,
      initialBalance: a.initialBalance,
    })),
    categories: cats.map((cat) => ({
      key: cat.key,
      label: cat.label,
      color: cat.color,
      type: cat.type,
    })),
    transactions: txs.map((tx) => ({
      date: tx.date,
      amount: tx.amount,
      type: tx.type,
      categoryKey: catById.get(tx.categoryId) ?? 'Other',
      accountKey: accById.get(tx.accountId) ?? 'Current',
      note: tx.note,
      tags: tx.tags,
    })),
    budgets: buds.map((b) => ({
      categoryKey: catById.get(b.categoryId) ?? 'Other',
      period: b.period,
      limit: b.limit,
    })),
  })
})

backupRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, backupSchema)
  if (body instanceof Response) return body

  const existingAccs = await db.select().from(accounts).where(eq(accounts.userId, userId))
  const existingCats = await db.select().from(categories).where(eq(categories.userId, userId))
  const accByKey = new Map(existingAccs.map((a) => [a.key, a]))
  const catByKey = new Map(existingCats.map((cat) => [cat.key, cat]))

  for (const a of body.accounts) {
    const cur = accByKey.get(a.key)
    if (cur) {
      const [row] = await db
        .update(accounts)
        .set({
          label: a.label,
          color: a.color,
          name: a.name,
          initialBalance: a.initialBalance,
        })
        .where(eq(accounts.id, cur.id))
        .returning()
      accByKey.set(a.key, row)
    } else {
      const [row] = await db
        .insert(accounts)
        .values({ ...a, userId })
        .returning()
      accByKey.set(a.key, row)
    }
  }

  for (const cat of body.categories) {
    const cur = catByKey.get(cat.key)
    if (cur) {
      const [row] = await db
        .update(categories)
        .set({
          label: cat.label,
          color: cat.color,
          type: cat.type,
        })
        .where(eq(categories.id, cur.id))
        .returning()
      catByKey.set(cat.key, row)
    } else {
      const [row] = await db
        .insert(categories)
        .values({ ...cat, userId })
        .returning()
      catByKey.set(cat.key, row)
    }
  }

  await db.delete(transactions).where(eq(transactions.userId, userId))
  await db.delete(budgets).where(eq(budgets.userId, userId))

  const txValues = []
  for (const tx of body.transactions) {
    const cat = catByKey.get(tx.categoryKey)
    const acc = accByKey.get(tx.accountKey)
    if (!cat || !acc) continue
    txValues.push({
      userId,
      date: tx.date,
      amount: tx.amount,
      type: tx.type,
      categoryId: cat.id,
      accountId: acc.id,
      note: tx.note ?? null,
      tags: tx.tags ?? null,
    })
  }
  if (txValues.length > 0) {
    // ponytail: insert en bloques si el backup es enorme
    const chunk = 500
    for (let i = 0; i < txValues.length; i += chunk) {
      await db.insert(transactions).values(txValues.slice(i, i + chunk))
    }
  }

  for (const b of body.budgets) {
    const cat = catByKey.get(b.categoryKey)
    if (!cat) continue
    await db.insert(budgets).values({
      userId,
      categoryId: cat.id,
      period: b.period,
      limit: b.limit,
    })
  }

  if (body.user.savingsGoalCents !== undefined || body.user.name !== undefined) {
    await db
      .update(users)
      .set({
        ...(body.user.savingsGoalCents !== undefined
          ? { savingsGoalCents: body.user.savingsGoalCents }
          : {}),
        ...(body.user.name !== undefined ? { name: body.user.name } : {}),
      })
      .where(eq(users.id, userId))
  }

  return c.json({
    ok: true,
    transactions: txValues.length,
    budgets: body.budgets.length,
    accounts: body.accounts.length,
    categories: body.categories.length,
  })
})
