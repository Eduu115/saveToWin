import { createMiddleware } from 'hono/factory'
import { apiError } from './errors.js'

type Bucket = { count: number; resetAt: number }

// ponytail: contador en memoria, mover a Redis/store si >1 proceso
const buckets = new Map<string, Bucket>()

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 10

function clientKey(ip: string, path: string) {
  return `${ip}:${path}`
}

export const rateLimitAuth = createMiddleware(async (c, next) => {
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  const key = clientKey(ip, c.req.path)
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
