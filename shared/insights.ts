/** Conclusiones por reglas. Sin copy de UI: solo códigos + params para i18n. */

export type InsightKind = 'heads_up' | 'on_track' | 'over'

export type InsightCode = 'budget_over' | 'budget_pace' | 'goal_on_track'

export interface Insight {
  id: string
  kind: InsightKind
  code: InsightCode
  params: {
    categoryKey?: string
    categoryLabel?: string
    overCents?: number
    limitCents?: number
    spentCents?: number
    breachDay?: number
    breachMonth?: number
    txCount?: number
    daysAhead?: number
    goalCents?: number
  }
}

export interface CategoryBudgetSpend {
  categoryKey: string
  categoryLabel: string
  limitCents: number
  spentCents: number
  /** Movimientos de gasto de esa categoría en el periodo */
  txCount: number
}

export interface EvaluateInsightsInput {
  /** Periodo `YYYY-MM` */
  period: string
  /** Día de referencia ISO `YYYY-MM-DD` (hoy o fin de mes si cerrado) */
  asOfDate: string
  savedCents: number
  savingsGoalCents: number
  categories: readonly CategoryBudgetSpend[]
}

function assertInt(n: number, label: string): void {
  if (!Number.isInteger(n)) throw new Error(`${label} debe ser entero`)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function dayOfYearUTC(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((now - start) / 86_400_000)
}

function yearLength(year: number): number {
  return daysInMonth(year, 2) === 29 ? 366 : 365
}

/**
 * Evalúa reglas. Solo emite insight si la condición se cumple.
 * Orden: overs → heads_up → on_track.
 */
export function evaluateInsights(input: EvaluateInsightsInput): Insight[] {
  assertInt(input.savedCents, 'savedCents')
  assertInt(input.savingsGoalCents, 'savingsGoalCents')

  const m = /^(\d{4})-(\d{2})$/.exec(input.period)
  if (!m) throw new Error(`periodo inválido: ${input.period}`)
  const year = Number(m[1])
  const month = Number(m[2])
  const dim = daysInMonth(year, month)

  const asOf = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.asOfDate)
  if (!asOf) throw new Error(`asOfDate inválida: ${input.asOfDate}`)
  const asOfDay = Number(asOf[3])
  const dayInPeriod =
    asOf[1] === m[1] && Number(asOf[2]) === month
      ? Math.min(Math.max(asOfDay, 1), dim)
      : dim

  const out: Insight[] = []

  for (const cat of input.categories) {
    assertInt(cat.limitCents, 'limitCents')
    assertInt(cat.spentCents, 'spentCents')
    if (cat.limitCents <= 0) continue

    if (cat.spentCents > cat.limitCents) {
      out.push({
        id: `budget_over:${cat.categoryKey}`,
        kind: 'over',
        code: 'budget_over',
        params: {
          categoryKey: cat.categoryKey,
          categoryLabel: cat.categoryLabel,
          overCents: cat.spentCents - cat.limitCents,
          limitCents: cat.limitCents,
          spentCents: cat.spentCents,
          txCount: cat.txCount,
        },
      })
      continue
    }

    // Ritmo: proyecta gasto a fin de mes
    if (dayInPeriod > 0 && cat.spentCents > 0) {
      const projected = Math.trunc((cat.spentCents * dim) / dayInPeriod)
      if (projected > cat.limitCents) {
        const daily = Math.trunc(cat.spentCents / dayInPeriod)
        if (daily > 0) {
          const remaining = cat.limitCents - cat.spentCents
          const daysLeft = Math.ceil(remaining / daily)
          const breachDay = Math.min(dayInPeriod + daysLeft, dim)
          if (breachDay > dayInPeriod && breachDay <= dim) {
            out.push({
              id: `budget_pace:${cat.categoryKey}`,
              kind: 'heads_up',
              code: 'budget_pace',
              params: {
                categoryKey: cat.categoryKey,
                categoryLabel: cat.categoryLabel,
                limitCents: cat.limitCents,
                spentCents: cat.spentCents,
                breachDay,
                breachMonth: month,
                txCount: cat.txCount,
              },
            })
          }
        }
      }
    }
  }

  // Objetivo de ahorro vs ritmo lineal del año
  if (input.savingsGoalCents > 0 && input.savedCents > 0) {
    const d = new Date(`${input.asOfDate}T00:00:00Z`)
    const doy = dayOfYearUTC(d)
    const yl = yearLength(d.getUTCFullYear())
    const expected = Math.trunc((input.savingsGoalCents * doy) / yl)
    if (input.savedCents > expected) {
      const dailyGoal = Math.max(1, Math.trunc(input.savingsGoalCents / yl))
      const daysAhead = Math.trunc((input.savedCents - expected) / dailyGoal)
      if (daysAhead > 0) {
        out.push({
          id: 'goal_on_track',
          kind: 'on_track',
          code: 'goal_on_track',
          params: {
            daysAhead,
            goalCents: input.savingsGoalCents,
          },
        })
      }
    }
  }

  return out
}
