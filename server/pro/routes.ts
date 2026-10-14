import { daysInPeriod, effectiveBudgets, previousPeriod } from '@savetowin/shared/stats'
import { and, asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'
import { db } from '../db/client.js'
import { accounts, budgets, categories, transactions, users } from '../db/schema.js'
import type { AuthVariables } from '../src/lib/auth.js'
import { apiError } from '../src/lib/errors.js'
import { parseBody } from '../src/lib/validate.js'
import { computeInsights, type ProTx } from './insights.js'
import { planFor } from './plans.js'
import { computeWrapped, computeWrappedCover } from './wrapped.js'

type Env = { Variables: AuthVariables }

/** Las funciones premium se validan aquí, no en la UI. */
const requirePremium = createMiddleware<Env>(async (c, next) => {
  const { plan } = await planFor(c.get('userId'))
  if (plan !== 'premium') {
    return c.json(apiError('PREMIUM_REQUIRED', 'Función de saveToWin Premium'), 402)
  }
  return next()
})

type Row = ProTx & { categoryId: number; color: string; accountId: number }

/**
 * Todos los movimientos del usuario con su categoría.
 * ponytail: carga completa por petición (O(n)); agregar en SQL si una cuenta
 * llega a decenas de miles de movimientos.
 */
async function loadRows(userId: number): Promise<Row[]> {
  return db
    .select({
      date: transactions.date,
      amount: transactions.amount,
      type: transactions.type,
      categoryId: transactions.categoryId,
      categoryKey: categories.key,
      categoryLabel: categories.label,
      color: categories.color,
      accountId: transactions.accountId,
      note: transactions.note,
      subscriptionId: transactions.subscriptionId,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(eq(transactions.userId, userId))
    .orderBy(asc(transactions.date))
}

const periodQuery = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .optional()

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function lastN(end: string, n: number): string[] {
  const out = [end]
  while (out.length < n) out.unshift(previousPeriod(out[0]))
  return out
}

function readPeriod(raw: string | undefined): string | null {
  const parsed = periodQuery.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data ?? today().slice(0, 7)
}

const sumExpense = (rows: Row[], p: string, pick: (r: Row) => boolean = () => true) =>
  rows.reduce((s, r) => (r.type === 'expense' && r.date.startsWith(p) && pick(r) ? s + r.amount : s), 0)

export const proRoutes = new Hono<Env>()

proRoutes.use('/analytics', requirePremium)
proRoutes.use('/insights', requirePremium)
proRoutes.use('/groups', requirePremium)
proRoutes.use('/groups/*', requirePremium)

/** Gráficos avanzados (Directions 11a): 12 meses, reparto, heatmap, ahorro y límites. */
proRoutes.get('/analytics', async (c) => {
  const userId = c.get('userId')
  const period = readPeriod(c.req.query('period'))
  if (!period) return c.json(apiError('VALIDATION_ERROR', 'period debe ser YYYY-MM'), 400)

  const rows = await loadRows(userId)
  const budgetRows = await db.select().from(budgets).where(eq(budgets.userId, userId))
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const [savingsAcc] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.key, 'Savings')))
    .limit(1)

  const months12 = lastN(period, 12)
  const months = months12.map((p) => {
    const income = rows.reduce((s, r) => (r.type === 'income' && r.date.startsWith(p) ? s + r.amount : s), 0)
    const expense = sumExpense(rows, p)
    const limit = effectiveBudgets(budgetRows, p).reduce((s, b) => s + b.limit, 0)
    return { period: p, incomeCents: income, expenseCents: expense, overBudget: limit > 0 && expense > limit }
  })

  const byCat = new Map<number, { key: string; label: string; color: string; cents: number }>()
  for (const r of rows) {
    if (r.type !== 'expense' || !r.date.startsWith(period)) continue
    const row = byCat.get(r.categoryId) ?? { key: r.categoryKey, label: r.categoryLabel, color: r.color, cents: 0 }
    row.cents += r.amount
    byCat.set(r.categoryId, row)
  }
  const byCategory = [...byCat.values()].sort((a, b) => b.cents - a.cents)

  const daily = Array.from({ length: daysInPeriod(period) }, (_, i) => {
    const date = `${period}-${String(i + 1).padStart(2, '0')}`
    return { date, cents: rows.reduce((s, r) => (r.type === 'expense' && r.date === date ? s + r.amount : s), 0) }
  })

  // Saldo de la cuenta de ahorro al cierre de cada mes (mismo criterio que /api/stats).
  const savings = months12.map((p) => {
    if (!savingsAcc) return { period: p, balanceCents: 0 }
    const end = `${p}-31`
    let balance = savingsAcc.initialBalance
    for (const r of rows) {
      if (r.accountId !== savingsAcc.id || r.date > end) continue
      if (r.type === 'income') balance += r.amount
      else if (r.type === 'expense') balance -= r.amount
      else balance += r.categoryKey === 'Savings withdrawal' ? -r.amount : r.amount
    }
    return { period: p, balanceCents: balance }
  })

  // Límites visualizados: cada categoría con límite en los últimos 6 meses.
  const months6 = months12.slice(-6)
  const limited = new Map<number, Row | undefined>()
  for (const p of months6) for (const b of effectiveBudgets(budgetRows, p)) limited.set(b.categoryId, undefined)
  const cats = await db.select().from(categories).where(eq(categories.userId, userId))
  const limits = [...limited.keys()].map((categoryId) => {
    const cat = cats.find((x) => x.id === categoryId)
    return {
      categoryKey: cat?.key ?? '',
      label: cat?.label ?? '',
      color: cat?.color ?? 'c12',
      months: months6.map((p) => ({
        period: p,
        limitCents: effectiveBudgets(budgetRows, p).find((b) => b.categoryId === categoryId)?.limit ?? 0,
        spentCents: sumExpense(rows, p, (r) => r.categoryId === categoryId),
      })),
    }
  })

  return c.json({
    period,
    months,
    byCategory,
    daily,
    savings,
    savingsGoalCents: user?.savingsGoalCents ?? 0,
    limits,
  })
})

/** Analítica con sugerencias (heurísticas en `insights.ts`). */
proRoutes.get('/insights', async (c) => {
  const period = readPeriod(c.req.query('period'))
  if (!period) return c.json(apiError('VALIDATION_ERROR', 'period debe ser YYYY-MM'), 400)
  const rows = await loadRows(c.get('userId'))
  return c.json({ period, items: computeInsights({ txs: rows, period, today: today() }) })
})

/** Wrapped: la portada es gratis (para compartir); el resto, premium. */
proRoutes.get('/wrapped', async (c) => {
  const year = Number(c.req.query('year') ?? new Date().getFullYear())
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return c.json(apiError('VALIDATION_ERROR', 'year no válido'), 400)
  }
  const userId = c.get('userId')
  const rows = await loadRows(userId)
  const years = [...new Set(rows.map((r) => Number(r.date.slice(0, 4))))].sort()
  const { plan } = await planFor(userId)
  if (plan !== 'premium') {
    return c.json({ premium: false, years, cover: computeWrappedCover(rows, year) })
  }
  return c.json({ premium: true, years, wrapped: computeWrapped(rows, year, today()) })
})

// ——— Agrupaciones (Directions 6a / 6c) ———

const GROUP_ICONS = ['shapes', 'party', 'shield', 'home', 'car', 'utensils', 'plane', 'heart', 'gamepad', 'shirt'] as const

const groupBody = z.object({
  name: z.string().trim().min(1).max(40),
  icon: z.enum(GROUP_ICONS).default('shapes'),
  limitCents: z.number().int().positive().nullable().default(null),
  warnPercent: z.number().int().min(1).max(100).default(80),
  categoryIds: z.array(z.number().int().positive()).min(1).max(50),
})

async function ownedCategoryIds(userId: number, ids: number[]): Promise<boolean> {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.userId, userId))
  const owned = new Set(rows.map((r) => r.id))
  return ids.every((id) => owned.has(id))
}

type GroupRow = { id: number; name: string; icon: string; limit_cents: number | null; warn_percent: number }

async function loadGroups(userId: number) {
  const groups = await db.execute<GroupRow>(
    sql`SELECT id, name, icon, limit_cents, warn_percent FROM pro_groups WHERE user_id = ${userId} ORDER BY id`,
  )
  const links = await db.execute<{ group_id: number; category_id: number }>(sql`
    SELECT gc.group_id, gc.category_id FROM pro_group_categories gc
    JOIN pro_groups g ON g.id = gc.group_id WHERE g.user_id = ${userId}
  `)
  return [...groups].map((g) => ({
    ...g,
    categoryIds: [...links].filter((l) => l.group_id === g.id).map((l) => l.category_id),
  }))
}

proRoutes.get('/groups', async (c) => {
  const userId = c.get('userId')
  const period = readPeriod(c.req.query('period'))
  if (!period) return c.json(apiError('VALIDATION_ERROR', 'period debe ser YYYY-MM'), 400)
  const [groups, rows, cats] = await Promise.all([
    loadGroups(userId),
    loadRows(userId),
    db.select().from(categories).where(eq(categories.userId, userId)),
  ])
  const isCurrent = today().startsWith(period)
  const remainingDays = isCurrent ? daysInPeriod(period) - Number(today().slice(8, 10)) + 1 : 0
  const months6 = lastN(period, 6)

  const items = groups.map((g) => {
    const ids = new Set(g.categoryIds)
    const spent = sumExpense(rows, period, (r) => ids.has(r.categoryId))
    const limit = g.limit_cents
    const status =
      limit == null ? 'tracking' : spent > limit ? 'over' : spent * 100 >= limit * g.warn_percent ? 'tight' : 'ok'
    return {
      id: g.id,
      name: g.name,
      icon: g.icon,
      limitCents: limit,
      warnPercent: g.warn_percent,
      categoryIds: g.categoryIds,
      spentCents: spent,
      status,
      history: months6.map((p) => ({ period: p, cents: sumExpense(rows, p, (r) => ids.has(r.categoryId)) })),
    }
  })

  const expenseCats = cats.filter((x) => x.type === 'expense' && !x.archived)
  const coverage = expenseCats.map((cat) => ({
    categoryId: cat.id,
    groupIds: items.filter((g) => g.categoryIds.includes(cat.id)).map((g) => g.id),
    spentCents: sumExpense(rows, period, (r) => r.categoryId === cat.id),
  }))

  return c.json({ period, remainingDays, items, coverage })
})

async function saveGroup(userId: number, id: number | null, body: z.infer<typeof groupBody>) {
  return db.transaction(async (tx) => {
    let groupId = id
    if (groupId == null) {
      const [row] = await tx.execute<{ id: number }>(sql`
        INSERT INTO pro_groups (user_id, name, icon, limit_cents, warn_percent)
        VALUES (${userId}, ${body.name}, ${body.icon}, ${body.limitCents}, ${body.warnPercent})
        RETURNING id
      `)
      groupId = row.id
    } else {
      const updated = await tx.execute<{ id: number }>(sql`
        UPDATE pro_groups SET name = ${body.name}, icon = ${body.icon},
          limit_cents = ${body.limitCents}, warn_percent = ${body.warnPercent}
        WHERE id = ${groupId} AND user_id = ${userId} RETURNING id
      `)
      if (updated.length === 0) return null
      await tx.execute(sql`DELETE FROM pro_group_categories WHERE group_id = ${groupId}`)
    }
    for (const categoryId of body.categoryIds) {
      await tx.execute(sql`
        INSERT INTO pro_group_categories (group_id, category_id) VALUES (${groupId}, ${categoryId})
        ON CONFLICT DO NOTHING
      `)
    }
    return groupId
  })
}

proRoutes.post('/groups', async (c) => {
  const userId = c.get('userId')
  const body = await parseBody(c, groupBody)
  if (body instanceof Response) return body
  if (!(await ownedCategoryIds(userId, body.categoryIds))) {
    return c.json(apiError('VALIDATION_ERROR', 'categoryIds no válidos'), 400)
  }
  const id = await saveGroup(userId, null, body)
  return c.json({ id }, 201)
})

proRoutes.put('/groups/:id', async (c) => {
  const userId = c.get('userId')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  const body = await parseBody(c, groupBody)
  if (body instanceof Response) return body
  if (!(await ownedCategoryIds(userId, body.categoryIds))) {
    return c.json(apiError('VALIDATION_ERROR', 'categoryIds no válidos'), 400)
  }
  const saved = await saveGroup(userId, id, body)
  if (saved == null) return c.json(apiError('NOT_FOUND', 'Agrupación no encontrada'), 404)
  return c.json({ id: saved })
})

proRoutes.delete('/groups/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json(apiError('VALIDATION_ERROR', 'id inválido'), 400)
  const deleted = await db.execute(
    sql`DELETE FROM pro_groups WHERE id = ${id} AND user_id = ${c.get('userId')} RETURNING id`,
  )
  if (deleted.length === 0) return c.json(apiError('NOT_FOUND', 'Agrupación no encontrada'), 404)
  return c.json({ ok: true })
})
