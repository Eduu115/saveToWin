import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * TOTP (RFC 6238, HMAC-SHA1, 6 dígitos, 30 s): lo que usan Google Authenticator,
 * 1Password, Aegis… Sin dependencias.
 * ponytail: no se guarda el último contador usado (un código vale ±30 s y podría
 * reutilizarse dentro de esa ventana); añadir `totp_last_counter` si hace falta.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function totpAt(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', secret).update(msg).digest()
  const offset = h[h.length - 1] & 15
  const bin = (h.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits
  return String(bin).padStart(digits, '0')
}

/** Acepta el código del paso actual y ±1 (reloj del móvil desfasado). */
export function verifyTotp(secretBase32: string, code: string, now = Date.now()): boolean {
  const clean = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  const secret = base32Decode(secretBase32)
  const counter = Math.floor(now / 1000 / 30)
  for (const d of [-1, 0, 1]) {
    const expected = Buffer.from(totpAt(secret, counter + d))
    if (timingSafeEqual(expected, Buffer.from(clean))) return true
  }
  return false
}

export function otpauthUrl(secret: string, email: string): string {
  const label = encodeURIComponent(`saveToWin:${email}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=saveToWin&digits=6&period=30`
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** 8 códigos de recuperación de un solo uso (`xxxx-xxxx`). */
export function generateRecoveryCodes(): string[] {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const part = () => Array.from({ length: 4 }, () => chars[randomInt(chars.length)]).join('')
  return Array.from({ length: 8 }, () => `${part()}-${part()}`)
}

export const normalizeRecovery = (code: string) => code.trim().toLowerCase().replace(/\s/g, '')

/** Código de 6 dígitos para confirmar por correo. */
export const emailCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')
