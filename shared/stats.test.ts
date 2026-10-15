import { describe, expect, it } from 'vitest'
import {
  computePeriodStats,
  computeSavingsStreak,
  daysInPeriod,
  divRound,
  effectiveBudgets,
  type StatsTransaction,
} from './stats.ts'

/**
 * Dataset canónico (CLAUDE.md / Directions): julio 2026, 68 movimientos.
 * Ingreso 2.640,00 € · gasto 1.913,45 € · resto derivado.
 */
function buildCanonicalJuly2026(): StatsTransaction[] {
  const txs: StatsTransaction[] = [
    { date: '2026-07-14', amount: 264_000, type: 'income' },
  ]

  const expenseCount = 67
  const totalExpense = 191_345
  const base = Math.trunc(totalExpense / expenseCount)
  const rem = totalExpense - base * expenseCount

  for (let i = 0; i < expenseCount; i++) {
    const day = String((i % 28) + 1).padStart(2, '0')
    txs.push({
      date: `2026-07-${day}`,
      amount: i < rem ? base + 1 : base,
      type: 'expense',
    })
  }

  // Ruido fuera de periodo (no debe contar)
  txs.push(
    { date: '2026-06-30', amount: 50_000, type: 'expense' },
    { date: '2026-08-01', amount: 10_000, type: 'income' },
  )

  return txs
}

describe('daysInPeriod', () => {
  it('julio 2026 tiene 31 días', () => {
    expect(daysInPeriod('2026-07')).toBe(31)
  })

  it('febrero bisiesto', () => {
    expect(daysInPeriod('2024-02')).toBe(29)
  })
})

describe('divRound', () => {
  it('redondea half-up en enteros', () => {
    expect(divRound(191_345, 31)).toBe(6_172)
    expect(divRound(72655 * 1000, 264_000)).toBe(275)
    expect(divRound(842_000 * 100, 1_200_000)).toBe(70)
    expect(divRound(191_345 * 100, 230_000)).toBe(83)
  })
})

describe('computePeriodStats — dataset canónico julio 2026', () => {
  const stats = computePeriodStats({
    transactions: buildCanonicalJuly2026(),
    period: '2026-07',
    budgetLimitCents: 230_000,
    savingsGoalCents: 1_200_000,
    savedCents: 842_000,
  })

  it('cuenta 68 movimientos del periodo', () => {
    expect(stats.transactionCount).toBe(68)
  })

  it('ingreso / gasto / balance', () => {
    expect(stats.incomeCents).toBe(264_000)
    expect(stats.expenseCents).toBe(191_345)
    expect(stats.balanceCents).toBe(72_655)
  })

  it('tasa de ahorro 27,5 %', () => {
    expect(stats.savingsRateTenths).toBe(275)
  })

  it('objetivo 8.420 / 12.000 → 70 %', () => {
    expect(stats.savedCents).toBe(842_000)
    expect(stats.savingsGoalCents).toBe(1_200_000)
    expect(stats.goalProgressPercent).toBe(70)
  })

  it('límite 2.300 con 386,55 restantes (83 % usado)', () => {
    expect(stats.budgetLimitCents).toBe(230_000)
    expect(stats.budgetRemainingCents).toBe(38_655)
    expect(stats.budgetUsedPercent).toBe(83)
  })

  it('media diaria 61,72 €', () => {
    expect(stats.daysInPeriod).toBe(31)
    expect(stats.dailyAverageCents).toBe(6_172)
  })

  it('mes cerrado: proyección = gasto real', () => {
    expect(stats.daysElapsed).toBe(31)
    expect(stats.projectedExpenseCents).toBe(191_345)
  })
})

describe('computePeriodStats — mes en curso', () => {
  // 316,44 € gastados a 15 de octubre; límites solo en algunas categorías (261,66 € de ese gasto).
  const s = computePeriodStats({
    transactions: [
      { date: '2026-10-05', amount: 10_000, type: 'expense' },
      { date: '2026-10-12', amount: 21_644, type: 'expense' },
      { date: '2026-10-01', amount: 264_000, type: 'income' },
    ],
    period: '2026-10',
    budgetLimitCents: 58_000,
    budgetSpentCents: 26_166,
    savingsGoalCents: 1_200_000,
    savedCents: 0,
    asOfDate: '2026-10-15',
  })

  it('media sobre los días transcurridos y proyección a fin de mes', () => {
    expect(s.daysElapsed).toBe(15)
    expect(s.dailyAverageCents).toBe(2_110)
    expect(s.projectedExpenseCents).toBe(65_398)
  })

  it('el límite solo cuenta el gasto de las categorías con límite', () => {
    expect(s.budgetRemainingCents).toBe(31_834)
    expect(s.budgetUsedPercent).toBe(45)
  })

  it('hoy fuera del periodo → mes completo', () => {
    const closed = computePeriodStats({
      transactions: [{ date: '2026-09-10', amount: 3_100, type: 'expense' }],
      period: '2026-09',
      budgetLimitCents: 0,
      savingsGoalCents: 0,
      savedCents: 0,
      asOfDate: '2026-10-15',
    })
    expect(closed.daysElapsed).toBe(30)
    expect(closed.projectedExpenseCents).toBe(3_100)
  })
})

describe('computeSavingsStreak', () => {
  it('cuenta meses consecutivos en positivo', () => {
    const map = new Map([
      ['2026-05', 10_000],
      ['2026-06', 20_000],
      ['2026-07', 72_655],
    ])
    expect(computeSavingsStreak(map, '2026-07')).toBe(3)
  })

  it('corta en mes ≤ 0 o ausente', () => {
    const map = new Map([
      ['2026-06', -100],
      ['2026-07', 72_655],
    ])
    expect(computeSavingsStreak(map, '2026-07')).toBe(1)
  })
})

describe('computePeriodStats — bordes', () => {
  it('periodo vacío → ceros', () => {
    const s = computePeriodStats({
      transactions: [],
      period: '2026-07',
      budgetLimitCents: 230_000,
      savingsGoalCents: 1_200_000,
      savedCents: 0,
    })
    expect(s.transactionCount).toBe(0)
    expect(s.incomeCents).toBe(0)
    expect(s.expenseCents).toBe(0)
    expect(s.balanceCents).toBe(0)
    expect(s.savingsRateTenths).toBe(0)
    expect(s.dailyAverageCents).toBe(0)
    expect(s.budgetRemainingCents).toBe(230_000)
  })
})

describe('effectiveBudgets', () => {
  const rows = [
    { id: 1, categoryId: 10, period: '2026-08', limit: 20_000 },
    { id: 2, categoryId: 10, period: '2026-10', limit: 30_000 },
    { id: 3, categoryId: 11, period: '2026-09', limit: 5_000 },
    { id: 4, categoryId: 11, period: '2026-11', limit: 0 },
  ]
  const at = (p: string) =>
    Object.fromEntries(effectiveBudgets(rows, p).map((r) => [r.categoryId, r.limit]))

  it('hereda el último límite anterior o igual al mes', () => {
    expect(at('2026-07')).toEqual({})
    expect(at('2026-09')).toEqual({ 10: 20_000, 11: 5_000 })
    expect(at('2026-10')).toEqual({ 10: 30_000, 11: 5_000 })
    expect(at('2027-03')).toEqual({ 10: 30_000 })
  })
})
