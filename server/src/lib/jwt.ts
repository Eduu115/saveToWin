import { SignJWT, jwtVerify } from 'jose'
import { env } from './env.js'

export type JwtPayload = {
  /** userId */
  sub: string
}

function secretKey() {
  return new TextEncoder().encode(env.jwtSecret())
}

export async function signAccessToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn())
    .sign(secretKey())
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secretKey())
  if (!payload.sub) throw new Error('token sin sub')
  // Un token con propósito (p. ej. el reto de 2FA) nunca vale como sesión.
  if (payload.purpose) throw new Error('no es un token de sesión')
  return { sub: payload.sub }
}

/** Reto intermedio del login con 2FA: prueba que la contraseña fue correcta. 5 minutos. */
export async function signTwoFactorChallenge(userId: number): Promise<string> {
  return new SignJWT({ purpose: '2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secretKey())
}

export async function verifyTwoFactorChallenge(token: string): Promise<number> {
  const { payload } = await jwtVerify(token, secretKey())
  const userId = Number(payload.sub)
  if (payload.purpose !== '2fa' || !Number.isInteger(userId)) throw new Error('reto no válido')
  return userId
}
