import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  computePeriodStats,
  computeSavingsStreak,
  previousPeriod,
  type StatsTransaction,
} from '@savetowin/shared/stats'
import { evaluateInsights } from '@savetowin/shared/insights'
import { db } from '../../db/client.js'
import {
  accounts,
  budgets,
  categories,
  transactions,
  users,
} from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { apiError } from '../lib/errors.js'

export const statsRoutes = new Hono<{ Variables: AuthVariables }>()

const MONTH_SHORT_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

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

function periodBounds(period: string): { from: string; to: string } {
  const from = `${period}-01`
  const toDay = new Date(
    Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0),
  )
  const to = `${period}-${String(toDay.getUTCDate()).padStart(2, '0')}`
  return { from, to }
}

function lastNPeriods(end: string, n: number): string[] {
  const out: string[] = []
  let p = end
  for (let i = 0; i < n; i++) {
    out.unshift(p)
    p = previousPeriod(p)
  }
  return out
}

function shortLabel(period: string): string {
  const month = Number(period.slice(5, 7))
  return MONTH_SHORT_ES[month - 1] ?? period
}

/** Ahorrado = saldo de la cuenta Savings (initial + ingresos + movimientos ahorro − gastos). */
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
      savingsIn: sql<number>`coalesce(sum(case when ${transactions.type} = 'savings' then ${transactions.amount} else 0 end), 0)`.mapWith(
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

  return (
    savings.initialBalance +
    (agg?.income ?? 0) +
    (agg?.savingsIn ?? 0) -
    (agg?.expense ?? 0)
  )
}

statsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const period = parsePeriod(c.req.query('period'))
  if (!period) {
    return c.json(apiError('VALIDATION_ERROR', 'period debe ser YYYY-MM'), 400)
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return c.json(apiError('UNAUTHORIZED', 'No autenticado'), 401)

  const { from, to } = periodBounds(period)

  const txs = await db
    .select({
      date: transactions.date,
      amount: transactions.amount,
      type: transactions.type,
      categoryId: transactions.categoryId,
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
    .select({ limit: budgets.limit, period: budgets.period })
    .from(budgets)
    .where(eq(budgets.userId, userId))

  const budgetLimitCents = periodBudgets
    .filter((b) => b.period === period)
    .reduce((s, b) => s + b.limit, 0)
  const savedCents = await savedFromSavingsAccount(userId)

  const stats = computePeriodStats({
    transactions: txs as StatsTransaction[],
    period,
    budgetLimitCents,
    savingsGoalCents: user.savingsGoalCents,
    savedCents,
  })

  const allTxs = await db
    .select({
      date: transactions.date,
      amount: transactions.amount,
      type: transactions.type,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))

  const monthlyBalance = new Map<string, number>()
  const monthlyIncome = new Map<string, number>()
  const monthlyExpense = new Map<string, number>()
  for (const tx of allTxs) {
    const p = tx.date.slice(0, 7)
    if (tx.type === 'income') {
      monthlyIncome.set(p, (monthlyIncome.get(p) ?? 0) + tx.amount)
      monthlyBalance.set(p, (monthlyBalance.get(p) ?? 0) + tx.amount)
    } else if (tx.type === 'expense') {
      monthlyExpense.set(p, (monthlyExpense.get(p) ?? 0) + tx.amount)
      monthlyBalance.set(p, (monthlyBalance.get(p) ?? 0) - tx.amount)
    }
    // savings: no afecta balance mensual ni gráficos de gasto/ingreso
  }
  const savingsStreakMonths = computeSavingsStreak(monthlyBalance, period)

  const budgetByPeriod = new Map<string, number>()
  for (const b of periodBudgets) {
    budgetByPeriod.set(b.period, (budgetByPeriod.get(b.period) ?? 0) + b.limit)
  }

  const months = lastNPeriods(period, 6)
  const monthly = months.map((p) => {
    const expenseCents = monthlyExpense.get(p) ?? 0
    const incomeCents = monthlyIncome.get(p) ?? 0
    const limit = budgetByPeriod.get(p) ?? 0
    return {
      period: p,
      label: shortLabel(p),
      expenseCents,
      incomeCents,
      overBudget: limit > 0 && expenseCents > limit,
      isCurrent: p === period,
    }
  })

  const incomeWithData = monthly.filter((m) => m.incomeCents > 0)
  const incomeReferenceCents =
    (monthlyIncome.get(period) ?? 0) > 0
      ? (monthlyIncome.get(period) ?? 0)
      : incomeWithData.length > 0
        ? Math.round(
            incomeWithData.reduce((s, m) => s + m.incomeCents, 0) /
              incomeWithData.length,
          )
        : 0

  const cats = await db
    .select({
      id: categories.id,
      key: categories.key,
      label: categories.label,
      color: categories.color,
    })
    .from(categories)
    .where(eq(categories.userId, userId))

  const catById = new Map(cats.map((c) => [c.id, c]))
  const spendByCat = new Map<number, number>()
  const txCountByCat = new Map<number, number>()
  for (const tx of txs) {
    if (tx.type !== 'expense') continue
    spendByCat.set(tx.categoryId, (spendByCat.get(tx.categoryId) ?? 0) + tx.amount)
    txCountByCat.set(tx.categoryId, (txCountByCat.get(tx.categoryId) ?? 0) + 1)
  }

  const byCategory = [...spendByCat.entries()]
    .map(([categoryId, expenseCents]) => {
      const cat = catById.get(categoryId)
      if (!cat) return null
      return {
        key: cat.key,
        label: cat.label,
        color: cat.color as import('@savetowin/shared/types').ColorToken,
        expenseCents,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.expenseCents - a.expenseCents)

  const budgetRows = await db
    .select({
      categoryId: budgets.categoryId,
      limit: budgets.limit,
    })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.period, period)))

  const insightCategories = budgetRows.map((b) => {
    const cat = catById.get(b.categoryId)
    return {
      categoryKey: cat?.key ?? `id:${b.categoryId}`,
      categoryLabel: cat?.label ?? `id:${b.categoryId}`,
      limitCents: b.limit,
      spentCents: spendByCat.get(b.categoryId) ?? 0,
      txCount: txCountByCat.get(b.categoryId) ?? 0,
    }
  })

  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const asOfDate =
    todayIso.startsWith(period)
      ? todayIso
      : periodBounds(period).to

  const insights = evaluateInsights({
    period,
    asOfDate,
    savedCents,
    savingsGoalCents: user.savingsGoalCents,
    categories: insightCategories,
  })

  return c.json({
    ...stats,
    savingsStreakMonths,
    charts: {
      monthly,
      incomeReferenceCents,
      byCategory,
    },
    insights,
  })
})
