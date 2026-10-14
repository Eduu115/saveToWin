import { describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, totpAt, verifyTotp } from '../src/lib/totp'

describe('TOTP (RFC 6238)', () => {
  // Vector oficial SHA-1: secreto ASCII "12345678901234567890".
  const secret = Buffer.from('12345678901234567890')
  const b32 = base32Encode(secret)

  it('reproduce los vectores del RFC (8 dígitos)', () => {
    expect(totpAt(secret, Math.floor(59 / 30), 8)).toBe('94287082')
    expect(totpAt(secret, Math.floor(1111111109 / 30), 8)).toBe('07081804')
    expect(totpAt(secret, Math.floor(2000000000 / 30), 8)).toBe('69279037')
  })

  it('base32 ida y vuelta', () => {
    expect(b32).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(base32Decode(b32).equals(secret)).toBe(true)
  })

  it('verifica el código actual y ±30 s, rechaza el resto', () => {
    const now = 1111111109 * 1000
    const code = totpAt(secret, Math.floor(1111111109 / 30))
    expect(verifyTotp(b32, code, now)).toBe(true)
    expect(verifyTotp(b32, code, now + 30_000)).toBe(true)
    expect(verifyTotp(b32, code, now + 90_000)).toBe(false)
    expect(verifyTotp(b32, '000000', now)).toBe(false)
    expect(verifyTotp(b32, 'abc', now)).toBe(false)
  })
})
