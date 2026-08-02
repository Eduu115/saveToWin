/** Dinero en céntimos (integer). Nunca floats. */

export class MoneyParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyParseError'
  }
}

/**
 * Parsea un importe en formato es-ES a céntimos.
 * Ejemplos: "0,1" → 10 · "1.234,56" → 123456 · "12 €" → 1200
 */
export function parseAmountToCents(input: string): number {
  if (typeof input !== 'string') {
    throw new MoneyParseError('importe inválido')
  }

  let s = input.trim().replace(/\u00a0/g, ' ').replace(/\s/g, '').replace(/€/g, '')
  if (!s) throw new MoneyParseError('importe vacío')

  let sign = 1
  if (s[0] === '-') {
    sign = -1
    s = s.slice(1)
  } else if (s[0] === '+') {
    s = s.slice(1)
  }
  if (!s) throw new MoneyParseError('importe vacío')

  if ((s.match(/,/g) ?? []).length > 1) {
    throw new MoneyParseError('importe inválido')
  }
  if (!/^[\d.]+(,\d{1,2})?$/.test(s)) {
    throw new MoneyParseError('importe inválido')
  }

  const [intRaw, decRaw = ''] = s.split(',')
  if (intRaw.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(intRaw)) {
      throw new MoneyParseError('importe inválido')
    }
  } else if (!/^\d+$/.test(intRaw)) {
    throw new MoneyParseError('importe inválido')
  }

  const intDigits = intRaw.replace(/\./g, '')
  if (!/^\d+$/.test(intDigits)) throw new MoneyParseError('importe inválido')

  const euros = Number(intDigits)
  const cents = Number(decRaw.padEnd(2, '0') || '0')
  if (!Number.isSafeInteger(euros) || !Number.isSafeInteger(euros * 100 + cents)) {
    throw new MoneyParseError('importe fuera de rango')
  }

  return sign * (euros * 100 + cents)
}

/** Formato es-ES: `1.234,56 €` */
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new MoneyParseError('los céntimos deben ser enteros')
  }
  const neg = cents < 0
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const body = `${wholeStr},${String(frac).padStart(2, '0')} €`
  return neg ? `-${body}` : body
}

export function addCents(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new MoneyParseError('los céntimos deben ser enteros')
  }
  const sum = a + b
  if (!Number.isSafeInteger(sum)) throw new MoneyParseError('suma fuera de rango')
  return sum
}

export function sumCents(amounts: readonly number[]): number {
  let total = 0
  for (const n of amounts) {
    total = addCents(total, n)
  }
  return total
}
