import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { env } from './env.js'
import { apiError } from './errors.js'

type Bucket = { count: number; resetAt: number }

// ponytail: contador en memoria, mover a Redis/store si >1 proceso
const buckets = new Map<string, Bucket>()

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 10

function clientKey(ip: string, path: string) {
  return `${ip}:${path}`
}

/**
 * IP del cliente. Las cabeceras de proxy las puede escribir cualquiera: solo se
 * usan si TRUSTED_PROXY dice que delante hay un proxy que las fija (antes se leía
 * el primer X-Forwarded-For y bastaba inventarlo para saltarse el límite).
 */
export function clientIp(c: Context): string {
  const mode = env.trustedProxy()
  if (mode === 'cloudflare') {
    const ip = c.req.header('cf-connecting-ip')?.trim()
    if (ip) return ip
  }
  if (mode === 'proxy') {
    const last = c.req.header('x-forwarded-for')?.split(',').pop()?.trim()
    if (last) return last
  }
  return getConnInfo(c).remote.address ?? 'unknown'
}

export const rateLimitAuth = createMiddleware(async (c, next) => {
  const key = clientKey(clientIp(c), c.req.path)
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(key, bucket)
  }
  bucket.count += 1
  if (bucket.count > MAX_ATTEMPTS) {
    return c.json(apiError('RATE_LIMITED', 'Demasiados intentos, espera un momento'), 429)
  }
  return next()
})
