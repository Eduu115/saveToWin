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
  return { sub: payload.sub }
}
