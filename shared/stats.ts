/** Estadísticas de periodo. Todo en céntimos (integer). Nunca floats de dinero. */

export type StatsFlow = 'expense' | 'income'

export interface StatsTransaction {
  /** ISO `YYYY-MM-DD` */
  date: string
  /** Céntimos */
  amount: number
  type: StatsFlow
}

export interface ComputePeriodStatsInput {
  transactions: readonly StatsTransaction[]
  /** Periodo `YYYY-MM` */
  period: string
  /** Tope de presupuesto del periodo (céntimos) */
  budgetLimitCents: number
  /** Objetivo de ahorro (céntimos) */
  savingsGoalCents: number
  /** Ya ahorrado hacia el objetivo (céntimos) */
  savedCents: number
}

export interface PeriodStats {
  period: string
  transactionCount: number
  incomeCents: number
  expenseCents: number
  balanceCents: number
  /**
   * Tasa de ahorro en décimas de punto porcentual.
   * 275 → 27,5 %. Entero; sin float.
   */
  savingsRateTenths: number
  savedCents: number
  savingsGoalCents: number
  /** Progreso del objetivo 0–100+ (entero %). */
  goalProgressPercent: number
  budgetLimitCents: number
  budgetRemainingCents: number
  /** % del presupuesto usado (entero). */
  budgetUsedPercent: number
  /** Media diaria de gasto (céntimos), redondeada. */
  dailyAverageCents: number
  daysInPeriod: number
}

function assertIntegerCents(n: number, label: string): void {
  if (!Number.isInteger(n)) {
    throw new Error(`${label} debe ser entero (céntimos)`)
  }
}

/** Días del mes del periodo `YYYY-MM` (calendario). */
export function daysInPeriod(period: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(period)
  if (!m) throw new Error(`periodo inválido: ${period}`)
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) throw new Error(`periodo inválido: ${period}`)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function inPeriod(date: string, period: string): boolean {
  return date.startsWith(`${period}-`)
}

/**
 * División entera redondeada half-up (para tasas y medias en céntimos).
 * Evita floats de dinero: solo opera sobre enteros.
 */
export function divRound(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  if (numerator >= 0) {
    return Math.trunc((numerator + Math.trunc(denominator / 2)) / denominator)
  }
  return -Math.trunc((-numerator + Math.trunc(denominator / 2)) / denominator)
}

/** Stats del periodo filtrando por `YYYY-MM`. */
export function computePeriodStats(input: ComputePeriodStatsInput): PeriodStats {
  const {
    transactions,
    period,
    budgetLimitCents,
    savingsGoalCents,
    savedCents,
  } = input

  assertIntegerCents(budgetLimitCents, 'budgetLimitCents')
  assertIntegerCents(savingsGoalCents, 'savingsGoalCents')
  assertIntegerCents(savedCents, 'savedCents')

  let incomeCents = 0
  let expenseCents = 0
  let transactionCount = 0

  for (const tx of transactions) {
    if (!inPeriod(tx.date, period)) continue
    assertIntegerCents(tx.amount, 'amount')
    if (tx.amount < 0) throw new Error('amount debe ser ≥ 0')
    transactionCount += 1
    if (tx.type === 'income') incomeCents += tx.amount
    else expenseCents += tx.amount
  }

  const balanceCents = incomeCents - expenseCents
  const days = daysInPeriod(period)

  // (balance / income) * 1000 → décimas de % (27,5 % → 275)
  const savingsRateTenths =
    incomeCents === 0 ? 0 : divRound(balanceCents * 1000, incomeCents)

  const goalProgressPercent =
    savingsGoalCents === 0
      ? 0
      : divRound(savedCents * 100, savingsGoalCents)

  const budgetRemainingCents = budgetLimitCents - expenseCents
  const budgetUsedPercent =
    budgetLimitCents === 0
      ? 0
      : divRound(expenseCents * 100, budgetLimitCents)

  const dailyAverageCents =
    days === 0 ? 0 : divRound(expenseCents, days)

  return {
    period,
    transactionCount,
    incomeCents,
    expenseCents,
    balanceCents,
    savingsRateTenths,
    savedCents,
    savingsGoalCents,
    goalProgressPercent,
    budgetLimitCents,
    budgetRemainingCents,
    budgetUsedPercent,
    dailyAverageCents,
    daysInPeriod: days,
  }
}
