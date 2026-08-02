import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { requireAuth } from './lib/auth.js'
import { assertAuthEnv, env } from './lib/env.js'
import { rateLimitAuth } from './lib/rate-limit.js'

assertAuthEnv()

const { getDatabaseUrl } = await import('../db/client.js')
const { authRoutes } = await import('./routes/auth.js')
const { accountsRoutes } = await import('./routes/accounts.js')
const { categoriesRoutes } = await import('./routes/categories.js')
const { transactionsRoutes } = await import('./routes/transactions.js')

export type {
  Account,
  Budget,
  Category,
  Transaction,
  User,
} from '@savetowin/shared/types'

const app = new Hono()

app.use('/api/auth/login', rateLimitAuth)
app.use('/api/auth/register', rateLimitAuth)
app.use('/api/*', requireAuth)

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api/auth', authRoutes)
app.route('/api/accounts', accountsRoutes)
app.route('/api/categories', categoriesRoutes)
app.route('/api/transactions', transactionsRoutes)

if (existsSync('./public')) {
  app.use('/*', serveStatic({ root: './public' }))
}

const port = env.port()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`)
  console.log(`database: ${getDatabaseUrl().replace(/:[^:@]+@/, ':***@')}`)
})
