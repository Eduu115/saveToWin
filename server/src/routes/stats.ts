import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  computePeriodStats,
  computeSavingsStreak,
  type StatsTransaction,
} from '@savetowin/shared/stats'
import { db } from '../../db/client.js'
import { accounts, budgets, transactions, users } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'

export const statsRoutes = new Hono<{ Variables: AuthVariables }>()

function currentPeriod(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function parsePeriod(raw: string | undefined): string | null {
  if (!raw) return currentPeriod()
  if (!/^\d{4}-\d{2}$/.test(raw)) return null
  return raw
}

/** Ahorrado = saldo de la cuenta Savings (initial + ingresos − gastos). */
async function savedFromSavingsAccount(userId: number): Promise<number> {
  const [savings] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.key, 'Savings')))
    .limit(1)
  if (!savings) return 0

  const [agg] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`.mapWith(
        Number,
      ),
      expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`.mapWith(
        Number,
      ),
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), eq(transactions.accountId, savings.id)),
    )

  return savings.initialBalance + (agg?.income ?? 0) - (agg?.expense ?? 0)
}

statsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const period = parsePeriod(c.req.query('period'))
  if (!period) {
    return c.json(apiError('VALIDATION_ERROR', 'period debe ser YYYY-MM'), 400)
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return c.json(apiError('UNAUTHORIZED', 'No autenticado'), 401)

  const from = `${period}-01`
  const toDay = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0))
  const to = `${period}-${String(toDay.getUTCDate()).padStart(2, '0')}`

  const txs = await db
    .select({
      date: transactions.date,
      amount: transactions.amount,
      type: transactions.type,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, from),
        lte(transactions.date, to),
      ),
    )

  const periodBudgets = await db
    .select({ limit: budgets.limit })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.period, period)))

  const budgetLimitCents = periodBudgets.reduce((s, b) => s + b.limit, 0)
  const savedCents = await savedFromSavingsAccount(userId)

  const stats = computePeriodStats({
    transactions: txs as StatsTransaction[],
    period,
    budgetLimitCents,
    savingsGoalCents: user.savingsGoalCents,
    savedCents,
  })

  // Streak: balances mensuales de todos los movimientos del user
  const allTxs = await db
    .select({
      date: transactions.date,
      amount: transactions.amount,
      type: transactions.type,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))

  const monthly = new Map<string, number>()
  for (const tx of allTxs) {
    const p = tx.date.slice(0, 7)
    const delta = tx.type === 'income' ? tx.amount : -tx.amount
    monthly.set(p, (monthly.get(p) ?? 0) + delta)
  }
  const savingsStreakMonths = computeSavingsStreak(monthly, period)

  return c.json({
    ...stats,
    savingsStreakMonths,
  })
})
