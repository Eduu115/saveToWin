import { describe, expect, it } from 'vitest'
import {
  addCents,
  formatCents,
  parseAmountToCents,
  sumCents,
} from './money.ts'

describe('parseAmountToCents', () => {
  it('evita el clásico 0,1+0,2 con floats', () => {
    expect(parseAmountToCents('0,1') + parseAmountToCents('0,2')).toBe(30)
  })

  it('parsea formato es-ES con miles y decimales', () => {
    expect(parseAmountToCents('1.234,56')).toBe(123456)
    expect(parseAmountToCents('12')).toBe(1200)
    expect(parseAmountToCents('12 €')).toBe(1200)
    expect(parseAmountToCents('-3,50')).toBe(-350)
  })

  it('rechaza entradas inválidas', () => {
    expect(() => parseAmountToCents('')).toThrow()
    expect(() => parseAmountToCents('abc')).toThrow()
    expect(() => parseAmountToCents('1,234')).toThrow()
    expect(() => parseAmountToCents('1.23')).toThrow()
    expect(() => parseAmountToCents('1,,2')).toThrow()
  })
})

describe('formatCents', () => {
  it('formatea es-ES con euro', () => {
    expect(formatCents(123456)).toBe('1.234,56 €')
    expect(formatCents(0)).toBe('0,00 €')
    expect(formatCents(-350)).toBe('-3,50 €')
  })
})

describe('round-trip', () => {
  it('parse ∘ format conserva céntimos', () => {
    for (const cents of [0, 1, 10, 100, 123456, -99, 2_640_00]) {
      expect(parseAmountToCents(formatCents(cents))).toBe(cents)
    }
  })
})

describe('addCents / sumCents', () => {
  it('suma enteros', () => {
    expect(addCents(10, 20)).toBe(30)
    expect(sumCents([10, 20, -5])).toBe(25)
    expect(sumCents([])).toBe(0)
  })
})
