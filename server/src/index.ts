import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import { requireAuth } from './lib/auth.js'
import { assertAuthEnv, env } from './lib/env.js'
import { rateLimitAuth } from './lib/rate-limit.js'

assertAuthEnv()

const { getDatabaseUrl } = await import('../db/client.js')
const { authRoutes, purgeExpiredCodes } = await import('./routes/auth.js')
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

// La extensión (otro origen) llama a la API con Bearer. Solo esos orígenes;
// una web cualquiera no puede fingir chrome-extension://.
app.use('/api/*', async (c, next) => {
  const origin = c.req.header('origin') ?? ''
  const extensionOrigin =
    origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')
  if (extensionOrigin) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Vary', 'Origin')
    c.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-SaveToWin-Client',
    )
    c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
    c.header('Access-Control-Max-Age', '86400')
    if (c.req.method === 'OPTIONS') return c.body(null, 204)
  }
  await next()
})

app.use('/api/auth/login', rateLimitAuth)
app.use('/api/auth/register', rateLimitAuth)
app.use('/api/auth/register/confirm', rateLimitAuth)
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
  // Assets con hash de Vite: para siempre. index.html, sw.js y el manifest: revalidar
  // siempre, para que una versión nueva se vea a la primera.
  // Imágenes y fuentes sueltas (logos, iconos, landing): 30 días; cambian muy rara vez.
  const onFound = (path: string, c: Context) => {
    c.header(
      'Cache-Control',
      path.includes('/assets/')
        ? 'public, max-age=31536000, immutable'
        : /\.(webp|png|jpe?g|svg|ico|woff2)$/.test(path)
          ? 'public, max-age=2592000'
          : 'no-cache',
    )
  }
  app.use('/*', serveStatic({ root: './public', onFound }))
  // SPA fallback para rutas del cliente (/{locale}/…)
  app.get('*', serveStatic({ root: './public', path: './index.html', onFound }))
}

const port = env.port()

// Cada hora: fuera altas sin confirmar y códigos de correo caducados.
setInterval(() => void purgeExpiredCodes().catch((err) => console.error('[purge]', err)), 60 * 60_000).unref()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`)
  console.log(`database: ${getDatabaseUrl().replace(/:[^:@]+@/, ':***@')}`)
})
