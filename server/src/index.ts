import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

export type {
  Account,
  Budget,
  Category,
  Transaction,
  User,
} from '@savetowin/shared/types'

const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true }))

// ponytail: solo monta estáticos si hay build de web (dev API-only no tiene public/)
if (existsSync('./public')) {
  app.use('/*', serveStatic({ root: './public' }))
}

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`)
})
