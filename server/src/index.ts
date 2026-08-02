import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { assertAuthEnv, env } from './lib/env.js'

assertAuthEnv()

const { getDatabaseUrl } = await import('../db/client.js')
const { authRoutes } = await import('./routes/auth.js')

export type {
  Account,
  Budget,
  Category,
  Transaction,
  User,
} from '@savetowin/shared/types'

const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api/auth', authRoutes)

// ponytail: solo monta estáticos si hay build de web (dev API-only no tiene public/)
if (existsSync('./public')) {
  app.use('/*', serveStatic({ root: './public' }))
}

const port = env.port()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`)
  console.log(`database: ${getDatabaseUrl().replace(/:[^:@]+@/, ':***@')}`)
})
