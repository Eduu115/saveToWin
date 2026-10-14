import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
const { budgetsRoutes } = await import('./routes/budgets.js')
const { statsRoutes } = await import('./routes/stats.js')
const { backupRoutes } = await import('./routes/backup.js')
const { cardsRoutes } = await import('./routes/cards.js')
const { subscriptionsRoutes } = await import('./routes/subscriptions.js')
const { profileRoutes } = await import('./routes/profile.js')

export type {
  Account,
  Budget,
  Card,
  Category,
  Subscription,
  Transaction,
  User,
} from '@savetowin/shared/types'

const app = new Hono()

app.use('/api/auth/login', rateLimitAuth)
app.use('/api/auth/register', rateLimitAuth)
app.use('/api/auth/login/2fa', rateLimitAuth)
app.use('/api/profile/confirm', rateLimitAuth)
app.use('/api/profile/password', rateLimitAuth)
app.use('/api/profile/email', rateLimitAuth)
// Borrar cuenta (DELETE /api/profile): mismo límite que el resto de operaciones con contraseña.
app.on('DELETE', '/api/profile', rateLimitAuth)
app.use('/api/profile/2fa/*', rateLimitAuth)
app.use('/api/*', requireAuth)

// Extensión opcional: si existe `server/pro/` (no forma parte de este repo), se
// registra antes que las rutas del núcleo. Sin ella, la app funciona completa.
const proEntry = ['../pro/index.js', '../pro/index.ts']
  .map((rel) => new URL(rel, import.meta.url))
  .find((url) => existsSync(fileURLToPath(url)))
if (proEntry) {
  const pro = (await import(proEntry.href)) as { register: (a: typeof app) => Promise<void> }
  await pro.register(app)
}

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api/auth', authRoutes)
app.route('/api/accounts', accountsRoutes)
app.route('/api/cards', cardsRoutes)
app.route('/api/categories', categoriesRoutes)
app.route('/api/transactions', transactionsRoutes)
app.route('/api/subscriptions', subscriptionsRoutes)
app.route('/api/budgets', budgetsRoutes)
app.route('/api/stats', statsRoutes)
app.route('/api/backup', backupRoutes)
app.route('/api/profile', profileRoutes)

// ponytail: solo monta estáticos si hay build de web (dev API-only no tiene public/)
if (existsSync('./public')) {
  app.use('/*', serveStatic({ root: './public' }))
  // SPA fallback para rutas del cliente (/{locale}/…)
  app.get('*', serveStatic({ root: './public', path: './index.html' }))
}

const port = env.port()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`)
  console.log(`database: ${getDatabaseUrl().replace(/:[^:@]+@/, ':***@')}`)
})
