import { describe, expect, it } from 'vitest'
import { advanceSubscriptionDate } from './subscription.js'

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
