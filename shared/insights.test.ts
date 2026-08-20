import { describe, expect, it } from 'vitest'
import { evaluateInsights } from './insights.ts'

describe('evaluateInsights', () => {
  it('no emite nada sin límites ni ahorro', () => {
    expect(
      evaluateInsights({
        period: '2026-07',
        asOfDate: '2026-07-15',
        savedCents: 0,
        savingsGoalCents: 1_200_000,
        categories: [],
      }),
    ).toEqual([])
  })

  it('OVER cuando gasto > límite', () => {
    const insights = evaluateInsights({
      period: '2026-07',
      asOfDate: '2026-07-20',
      savedCents: 0,
      savingsGoalCents: 1_200_000,
      categories: [
        {
          categoryKey: 'Tech',
          categoryLabel: 'Tecnología',
          limitCents: 100_00,
          spentCents: 149_99,
          txCount: 1,
        },
      ],
    })
    expect(insights).toHaveLength(1)
    expect(insights[0]).toMatchObject({
      kind: 'over',
      code: 'budget_over',
      params: { overCents: 49_99, categoryKey: 'Tech' },
    })
  })

  it('HEADS UP cuando el ritmo supera el límite antes de fin de mes', () => {
    const insights = evaluateInsights({
      period: '2026-08',
      asOfDate: '2026-08-10',
      savedCents: 0,
      savingsGoalCents: 1_200_000,
      categories: [
        {
          categoryKey: 'Dining out',
          categoryLabel: 'Restaurantes',
          limitCents: 200_00,
          spentCents: 120_00,
          txCount: 9,
        },
      ],
    })
    // 120/10 * 31 = 372 > 200 → pace
    expect(insights.some((i) => i.code === 'budget_pace')).toBe(true)
    const pace = insights.find((i) => i.code === 'budget_pace')!
    expect(pace.kind).toBe('heads_up')
    expect(pace.params.breachDay).toBeGreaterThan(10)
  })

  it('no HEADS UP si ya está OVER (solo over)', () => {
    const insights = evaluateInsights({
      period: '2026-08',
      asOfDate: '2026-08-10',
      savedCents: 0,
      savingsGoalCents: 1_200_000,
      categories: [
        {
          categoryKey: 'Dining out',
          categoryLabel: 'Restaurantes',
          limitCents: 100_00,
          spentCents: 150_00,
          txCount: 5,
        },
      ],
    })
    expect(insights.map((i) => i.code)).toEqual(['budget_over'])
  })

  it('ON TRACK si el ahorro va por delante del ritmo anual', () => {
    // 15 ago ≈ día 227 / 365 · 1.200.000 ≈ 746k esperado; 842k → ahead
    const insights = evaluateInsights({
      period: '2026-08',
      asOfDate: '2026-08-15',
      savedCents: 842_000,
      savingsGoalCents: 1_200_000,
      categories: [],
    })
    expect(insights.some((i) => i.code === 'goal_on_track')).toBe(true)
    const ot = insights.find((i) => i.code === 'goal_on_track')!
    expect(ot.kind).toBe('on_track')
    expect(ot.params.daysAhead).toBeGreaterThan(0)
  })

  it('no ON TRACK si aún no hay ahorro', () => {
    const insights = evaluateInsights({
      period: '2026-08',
      asOfDate: '2026-08-15',
      savedCents: 0,
      savingsGoalCents: 1_200_000,
      categories: [],
    })
    expect(insights.filter((i) => i.code === 'goal_on_track')).toHaveLength(0)
  })
})
