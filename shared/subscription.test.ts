import { describe, expect, it } from 'vitest'
import { advanceSubscriptionDate, yearlyCostCents } from './subscription.js'

describe('advanceSubscriptionDate', () => {
  it('avanza periodos fijos y custom', () => {
    expect(advanceSubscriptionDate('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(advanceSubscriptionDate('2026-01-15', 'weekly')).toBe('2026-01-22')
    expect(advanceSubscriptionDate('2026-01-15', 'quarterly')).toBe('2026-04-15')
    expect(advanceSubscriptionDate('2026-01-15', 'yearly')).toBe('2027-01-15')
    expect(advanceSubscriptionDate('2026-01-15', 'custom', 2, 'weeks')).toBe('2026-01-29')
    expect(advanceSubscriptionDate('2026-01-15', 'custom', 2, 'months')).toBe('2026-03-15')
  })
})

describe('yearlyCostCents', () => {
  it('pasa cada recurrencia a coste anual', () => {
    expect(yearlyCostCents(1_299, 'monthly')).toBe(15_588)
    expect(yearlyCostCents(500, 'weekly')).toBe(26_000)
    expect(yearlyCostCents(3_000, 'quarterly')).toBe(12_000)
    expect(yearlyCostCents(9_900, 'yearly')).toBe(9_900)
    expect(yearlyCostCents(1_000, 'custom', 2, 'months')).toBe(6_000)
    expect(yearlyCostCents(1_000, 'custom', 2, 'weeks')).toBe(26_000)
    expect(yearlyCostCents(10_000, 'custom', 2, 'years')).toBe(5_000)
  })
})
